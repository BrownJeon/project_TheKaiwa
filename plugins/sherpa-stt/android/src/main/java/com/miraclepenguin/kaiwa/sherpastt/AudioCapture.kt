package com.miraclepenguin.kaiwa.sherpastt

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Process

/**
 * AudioRecord 16kHz mono PCM16 → 40ms 프레임을 전용 스레드에서 `onFrame` 으로 넘긴다.
 * `onFrame` 이 false 를 돌려주면(세션이 닫힘) 스스로 멈춘다. 녹음은 `start()`~`stop()` 사이에만 켜져 있다.
 */
internal class AudioCapture(
    private val audioSource: Int,
    private val onFrame: (ShortArray, Int) -> Boolean,
    private val onFailure: (code: String, message: String) -> Unit,
) {
    @Volatile private var running = false
    private val recordLock = Any()
    private var released = false
    private var record: AudioRecord? = null
    private var thread: Thread? = null

    /** 권한은 호출자가 먼저 확인한다(플러그인 `start`). */
    @SuppressLint("MissingPermission")
    @Throws(SttException::class)
    fun start() {
        val minBuf = AudioRecord.getMinBufferSize(Audio.SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        if (minBuf <= 0) throw SttException("AUDIO_INIT_FAILED", "unsupported audio format")
        // 0.2s 이상 여유 — 디코드와 무관하게 캡처 스레드는 read 만 하므로 넘칠 일은 적다.
        val bufBytes = maxOf(minBuf, Audio.SAMPLE_RATE * 2 / 5)
        val r = try {
            AudioRecord(audioSource, Audio.SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufBytes)
        } catch (e: Exception) {
            throw SttException("AUDIO_INIT_FAILED", "audio record create failed: ${e.javaClass.simpleName}")
        }
        if (r.state != AudioRecord.STATE_INITIALIZED) {
            r.release()
            throw SttException("AUDIO_INIT_FAILED", "audio record not initialized")
        }
        try {
            r.startRecording()
        } catch (e: IllegalStateException) {
            r.release()
            throw SttException("AUDIO_INIT_FAILED", "start recording failed")
        }
        if (r.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
            r.release()
            throw SttException("AUDIO_INIT_FAILED", "microphone busy")
        }
        record = r
        running = true
        thread = Thread({ loop(r) }, "sherpa-stt-capture").also { it.start() }
    }

    private fun loop(r: AudioRecord) {
        Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)
        val frame = ShortArray(Audio.FRAME_SAMPLES)
        var filled = 0
        try {
            while (running) {
                val n = r.read(frame, filled, frame.size - filled)
                if (n < 0) {
                    if (running) onFailure("AUDIO_INIT_FAILED", "audio read error $n")
                    break
                }
                filled += n
                if (filled == frame.size) {
                    filled = 0
                    if (!onFrame(frame, frame.size)) break
                }
            }
        } catch (t: Throwable) {
            // VAD(JNI)·이벤트 처리 중 예외 — 캡처 스레드에서 새면 앱이 죽는다.
            if (t is OutOfMemoryError) onFailure("OOM", "out of memory in capture") else onFailure("DECODE_FAILED", "capture failed: ${t.javaClass.simpleName}")
        } finally {
            running = false
            synchronized(recordLock) {
                halt(r)
                r.release()
                released = true
            }
        }
    }

    /** 캡처를 멈추고 스레드가 끝날 때까지 기다린다 — 이후 `onFrame` 은 더 불리지 않는다. 해제는 캡처 스레드가 한다. */
    fun stop() {
        running = false
        val t = thread
        val r = record
        // 막힌 read 를 풀어 준다(다른 스레드에서 stop 은 허용, release 는 read 중이면 위험해 캡처 스레드에 맡긴다).
        if (r != null) synchronized(recordLock) { if (!released) halt(r) }
        if (t != null && t !== Thread.currentThread()) {
            try {
                t.join(JOIN_TIMEOUT_MS)
            } catch (e: InterruptedException) {
                Thread.currentThread().interrupt()
            }
        }
        thread = null
        record = null
    }

    private fun halt(r: AudioRecord) {
        try {
            if (r.recordingState == AudioRecord.RECORDSTATE_RECORDING) r.stop()
        } catch (e: IllegalStateException) {
            // 이미 멈췄다
        }
    }

    companion object {
        const val JOIN_TIMEOUT_MS = 1500L

        fun sourceOf(name: String?): Int = when (name) {
            null, "MIC" -> MediaRecorder.AudioSource.MIC
            "VOICE_RECOGNITION" -> MediaRecorder.AudioSource.VOICE_RECOGNITION
            else -> throw SttException("INVALID_ARGUMENT", "audioSource")
        }
    }
}
