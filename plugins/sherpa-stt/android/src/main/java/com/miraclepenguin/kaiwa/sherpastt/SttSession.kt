package com.miraclepenguin.kaiwa.sherpastt

import java.util.concurrent.Executor
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.max
import kotlin.math.min

/** 플러그인 오류. `code` 는 JS 계약의 오류 코드(task-003f 이력서 "플러그인 JS 계약 v1"). */
internal class SttException(val code: String, message: String, cause: Throwable? = null) : Exception(message, cause)

internal data class VadSegment(val start: Long, val length: Int)

/** VAD 추상 — 실제 구현은 sherpa-onnx silero(`SherpaVadEngine`), 테스트는 가짜. */
internal interface VadEngine {
    fun acceptWaveform(samples: FloatArray)
    fun isSpeechDetected(): Boolean
    fun empty(): Boolean
    fun front(): VadSegment
    fun pop()
    fun flush()
    fun reset()
}

internal fun interface Decoder {
    /** 앞뒤 무음 패딩이 이미 붙은 입력을 받는다. */
    fun decode(samples: FloatArray): String
}

internal data class Segment(val segIdx: Int, val text: String, val startMs: Int, val endMs: Int)

internal data class Timings(val vadMs: Int, val decodeMs: Int, val loadMs: Int, val sttMs: Int)

internal data class FinalResult(
    val sessionId: String,
    val text: String,
    val durationMs: Int,
    val wavPath: String?,
    val segments: List<Segment>,
    val timings: Timings,
    val reason: String,
    val modelVersion: String,
)

internal interface SessionSink {
    fun onVad(sessionId: String, state: String, atMs: Int)
    fun onPartial(sessionId: String, seg: Segment)
    fun onFinal(result: FinalResult)
    fun onError(sessionId: String, code: String, message: String)
    /** 세션당 정확히 1회. `last` 는 마지막 final(오류·취소면 null). */
    fun onClosed(sessionId: String, last: FinalResult?)
}

internal fun interface WavStore {
    /** 저장 경로, 실패하면 null(발화 자체는 살린다). */
    fun save(sessionId: String, index: Int, pcm: ShortArray): String?
}

internal data class SessionOptions(
    val endpointAuto: Boolean,
    val partial: Boolean,
    val maxUtteranceMs: Int,
    val saveWav: Boolean,
    /** `auto`(핸즈프리) 세션 전체 상한 — gateway 세션 10분과 같다. */
    val maxSessionMs: Int = 10 * 60 * 1000,
)

/**
 * 발화 1회(= `start`~`stop`) 상태기계. gateway `SherpaRealtimeSession`(reazon_sherpa.py)과 같은 규칙:
 * - 프레임마다 VAD 에 넣고, 끝난 VAD 구간은 원 버퍼에서 앞 0.2s·뒤 0.3s 여유를 붙여 잘라 디코드한다.
 * - `manual`(푸시투토크): 구간 → partial, `finish`/발화 상한 → final(구간 텍스트를 잇는다).
 * - `auto`: 구간 1개 = 발화 1개(끝점 final), 버퍼는 구간 끝까지 버린다.
 * - vad·partial·final 은 하나의 단일 스레드 실행기(`worker`)를 지나므로 발화 순서대로 나간다.
 *
 * 입력 쪽(`pushFrame`·`finish`·`cancel`)은 `lock` 아래에서, 디코드·이벤트는 `worker` 스레드에서만 돈다.
 */
internal class SttSession(
    val sessionId: String,
    val modelVersion: String,
    private val opts: SessionOptions,
    private val vad: VadEngine,
    private val decoder: () -> Decoder,
    private val worker: Executor,
    private val sink: SessionSink,
    private val wavStore: WavStore,
    private val nowNanos: () -> Long = System::nanoTime,
) {
    private val lock = Any()
    private val buf = PcmBuffer()
    private val maxUtteranceSamples = Audio.msToSamples(opts.maxUtteranceMs)
    private val maxSessionSamples = Audio.msToSamples(opts.maxSessionMs).toLong()
    private var speech = false
    private var closed = false

    @Volatile private var cancelled = false

    @Volatile private var failed = false
    private val closedNotified = AtomicBoolean(false)

    // worker 스레드 전용
    private val segs = ArrayList<Segment>()
    private var decodeMs = 0
    private var wavIndex = 0

    /** 인식기 로드 시간(이번 세션에서 새로 올렸을 때만 > 0). worker 에서 쓰고 읽는다. */
    @Volatile var loadMs = 0

    val isClosed: Boolean get() = synchronized(lock) { closed }

    /** 캡처 스레드가 부른다. false 면 세션이 닫혔으니 캡처를 멈춘다(발화 상한 도달 등). */
    fun pushFrame(frame: ShortArray, n: Int): Boolean = synchronized(lock) {
        if (closed) return false
        buf.append(frame, n)
        vad.acceptWaveform(Audio.pcm16ToFloat(frame, 0, n))
        checkVadState()
        drain("endpoint", lastFinalOnFlush = false)
        if (!opts.endpointAuto && buf.size >= maxUtteranceSamples) {
            finishLocked("max_length")
            return false
        }
        if (opts.endpointAuto) {
            if (buf.end >= maxSessionSamples) {
                finishLocked("max_length")
                return false
            }
            if (!speech) trimIdle()
        }
        true
    }

    /** 발화를 닫는다 — 이 세션의 마지막 final 이 정확히 1회 나간다(오류·취소가 먼저면 없음). */
    fun finish(reason: String) = synchronized(lock) { finishLocked(reason) }

    /** 현재 발화 폐기 — final 없이 닫는다. */
    fun cancel() {
        synchronized(lock) {
            if (cancelled) return
            cancelled = true
            closed = true
        }
        worker.execute { notifyClosed(null) }
    }

    /** 캡처·로드 쪽에서 난 치명 오류. worker 로 넘겨 이벤트 순서를 지킨다. */
    fun fail(code: String, message: String) {
        synchronized(lock) {
            if (closed) return
            closed = true
        }
        worker.execute { failOnWorker(code, message) }
    }

    /** worker 스레드에서 이미 돌고 있을 때(인식기 로드 실패) 바로 실패 처리. */
    fun failOnWorker(code: String, message: String) {
        if (cancelled || failed) return
        failed = true
        synchronized(lock) { closed = true }
        sink.onError(sessionId, code, message)
        notifyClosed(null)
    }

    // ── 입력 쪽(lock 아래) ─────────────────────────────────────────────────

    private fun atMs(): Int = Audio.samplesToMs(buf.size.toLong())

    private fun checkVadState() {
        val detected = vad.isSpeechDetected()
        if (detected != speech) {
            speech = detected
            postVad(if (detected) "SPEECH" else "SILENCE", atMs())
        }
    }

    private fun postVad(state: String, at: Int) {
        worker.execute { if (live()) sink.onVad(sessionId, state, at) }
    }

    private fun drain(reason: String, lastFinalOnFlush: Boolean) {
        while (!vad.empty()) {
            val seg = vad.front()
            vad.pop()
            val isLast = lastFinalOnFlush && vad.empty()
            enqueueSegment(seg.start, seg.start + seg.length, reason, isLast)
        }
    }

    private fun enqueueSegment(start: Long, end: Long, reason: String, lastFinal: Boolean) {
        val a = max(start - Audio.msToSamples(Audio.PAD_BEFORE_MS), buf.origin)
        val b = min(end + Audio.msToSamples(Audio.PAD_AFTER_MS), buf.end)
        if (opts.endpointAuto) {
            val pcm = buf.slice(a, b)
            postSegment(Audio.pcm16ToFloat(pcm), Audio.samplesToMs(start - a), Audio.samplesToMs(end - a))
            postFinal(reason, pcm, Audio.samplesToMs(max(0L, buf.end - end)), nowNanos(), lastFinal)
            buf.dropBefore(min(end, buf.end))
        } else {
            postSegment(
                Audio.pcm16ToFloat(buf.slice(a, b)),
                Audio.samplesToMs(start - buf.origin),
                Audio.samplesToMs(end - buf.origin),
            )
        }
    }

    private fun trimIdle() {
        val held = buf.size
        if (held > Audio.msToSamples(AUTO_TRIM_OVER_MS)) {
            buf.dropBefore(buf.end - Audio.msToSamples(AUTO_KEEP_TAIL_MS))
        }
    }

    private fun finishLocked(reason: String) {
        if (closed) return
        closed = true
        val trigger = nowNanos()
        if (opts.endpointAuto) {
            drain("endpoint", lastFinalOnFlush = false) // flush 전에 이미 끝난 구간은 각자 끝점 final
            vad.flush()
            closeSpeech()
            if (vad.empty()) {
                postFinal(reason, ShortArray(0), 0, trigger, last = true)
            } else {
                drain(reason, lastFinalOnFlush = true) // 진행 중이던 음성 = 이번 finish 의 final
            }
            vad.reset()
            return
        }
        vad.flush()
        drain(reason, lastFinalOnFlush = false)
        closeSpeech()
        postFinal(reason, buf.all(), 0, trigger, last = true)
        vad.reset()
    }

    private fun closeSpeech() {
        if (speech) {
            speech = false
            postVad("SILENCE", atMs())
        }
    }

    // ── worker 쪽 ───────────────────────────────────────────────────────────

    private fun live(): Boolean = !cancelled && !failed

    private fun postSegment(samples: FloatArray, startMs: Int, endMs: Int) {
        worker.execute {
            if (!live()) return@execute
            val t0 = nowNanos()
            val text = try {
                decoder().decode(Audio.padForDecode(samples)).trim()
            } catch (e: SttException) {
                failOnWorker(e.code, e.message ?: e.code)
                return@execute
            } catch (e: OutOfMemoryError) {
                failOnWorker("OOM", "out of memory while decoding")
                return@execute
            } catch (e: Throwable) {
                failOnWorker("DECODE_FAILED", "decode failed: ${e.javaClass.simpleName}")
                return@execute
            }
            decodeMs += ((nowNanos() - t0) / 1_000_000).toInt()
            if (text.isEmpty()) return@execute
            val seg = Segment(segs.size, text, startMs, endMs)
            segs.add(seg)
            if (opts.partial && !opts.endpointAuto) sink.onPartial(sessionId, seg)
        }
    }

    private fun postFinal(reason: String, pcm: ShortArray, vadMs: Int, trigger: Long, last: Boolean) {
        worker.execute {
            if (!live()) return@execute
            val done = segs.toList()
            segs.clear()
            val spent = decodeMs
            decodeMs = 0
            val text = done.joinToString("") { it.text }
            val wavPath = if (opts.saveWav && text.isNotEmpty() && pcm.isNotEmpty()) {
                wavStore.save(sessionId, wavIndex++, pcm)
            } else {
                null
            }
            val result = FinalResult(
                sessionId = sessionId,
                text = text,
                durationMs = Audio.samplesToMs(pcm.size.toLong()),
                wavPath = wavPath,
                segments = done,
                timings = Timings(vadMs, spent, loadMs, ((nowNanos() - trigger) / 1_000_000).toInt()),
                reason = reason,
                modelVersion = modelVersion,
            )
            sink.onFinal(result)
            if (last) notifyClosed(result)
        }
    }

    private fun notifyClosed(last: FinalResult?) {
        if (closedNotified.compareAndSet(false, true)) sink.onClosed(sessionId, last)
    }

    companion object {
        const val AUTO_TRIM_OVER_MS = 5000
        const val AUTO_KEEP_TAIL_MS = 3000
    }
}
