package com.miraclepenguin.kaiwa.sherpastt

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.Executor
import kotlin.math.abs

/** 소리가 있는 프레임이 speech, 무음 `silenceMs` 가 이어지면 구간을 끝내는 단순 VAD(sherpa silero 의 계약만 흉내). */
private class FakeVad(silenceMs: Int) : VadEngine {
    private val silence = Audio.msToSamples(silenceMs)
    private var fed = 0L
    private var inSpeech = false
    private var start = 0L
    private var lastLoud = 0L
    private val q = ArrayDeque<VadSegment>()

    override fun acceptWaveform(samples: FloatArray) {
        val loud = samples.any { abs(it) > 0.01f }
        if (loud) {
            if (!inSpeech) {
                inSpeech = true
                start = fed
            }
            lastLoud = fed + samples.size
        }
        fed += samples.size
        if (inSpeech && !loud && fed - lastLoud >= silence) close()
    }

    private fun close() {
        q.addLast(VadSegment(start, (lastLoud - start).toInt()))
        inSpeech = false
    }

    override fun isSpeechDetected() = inSpeech
    override fun empty() = q.isEmpty()
    override fun front() = q.first()
    override fun pop() {
        q.removeFirst()
    }

    override fun flush() {
        if (inSpeech) close()
    }

    override fun reset() {
        fed = 0
        inSpeech = false
        q.clear()
    }
}

private class Recorder : SessionSink {
    val events = ArrayList<String>()
    val finals = ArrayList<FinalResult>()
    var closed: Pair<String, FinalResult?>? = null
    var closedCount = 0

    override fun onVad(sessionId: String, state: String, atMs: Int) {
        events.add("vad:$state")
    }

    override fun onPartial(sessionId: String, seg: Segment) {
        events.add("partial:${seg.segIdx}:${seg.text}")
    }

    override fun onFinal(result: FinalResult) {
        events.add("final:${result.reason}:${result.text}")
        finals.add(result)
    }

    override fun onError(sessionId: String, code: String, message: String) {
        events.add("error:$code")
    }

    override fun onClosed(sessionId: String, last: FinalResult?) {
        closedCount++
        closed = sessionId to last
        events.add("closed")
    }
}

class SttSessionTest {
    private val direct = Executor { it.run() }
    private val decoderInputs = ArrayList<FloatArray>()
    private var decodeCount = 0
    private val decoder = Decoder { samples ->
        decoderInputs.add(samples)
        "語${decodeCount++}"
    }
    private val wavs = ArrayList<Pair<String, Int>>()
    private val wavStore = WavStore { id, idx, pcm ->
        wavs.add(id to pcm.size)
        "/wav/$id-$idx.wav"
    }

    private fun session(rec: Recorder, auto: Boolean = false, maxUtteranceMs: Int = 60_000, partial: Boolean = true, dec: Decoder = decoder) =
        SttSession("s1", "v1", SessionOptions(auto, partial, maxUtteranceMs, saveWav = true), FakeVad(500), { dec }, direct, rec, wavStore)

    /** ms 만큼 소리(true)/무음(false) 프레임을 넣는다. 세션이 닫히면 false. */
    private fun SttSession.feed(ms: Int, loud: Boolean): Boolean {
        val frame = ShortArray(Audio.FRAME_SAMPLES) { if (loud) 8000 else 0 }
        repeat(ms / 40) { if (!pushFrame(frame, frame.size)) return false }
        return true
    }

    @Test
    fun manualModeEmitsPartialsThenOneFinalWithJoinedText() {
        val rec = Recorder()
        val s = session(rec)
        assertTrue(s.feed(480, false))
        assertTrue(s.feed(1000, true))
        assertTrue(s.feed(1000, false)) // 무음 500ms 로 첫 구간 끝
        assertTrue(s.feed(800, true))
        s.finish("stop")

        assertEquals(
            listOf("vad:SPEECH", "vad:SILENCE", "partial:0:語0", "vad:SPEECH", "partial:1:語1", "vad:SILENCE", "final:stop:語0語1", "closed"),
            rec.events,
        )
        val f = rec.finals.single()
        assertEquals(listOf(0, 1), f.segments.map { it.segIdx })
        assertEquals(3280, f.durationMs)
        assertEquals("/wav/s1-0.wav", f.wavPath)
        assertEquals(Audio.msToSamples(3280), wavs.single().second) // 발화 전체가 wav 로
        assertEquals("v1", f.modelVersion)
        assertEquals(f, rec.closed!!.second)
        assertTrue(s.isClosed)
        assertFalse(s.feed(40, true)) // 닫힌 뒤 입력은 버린다
    }

    @Test
    fun decodeInputCarriesVadMarginsAndZeroPadding() {
        val rec = Recorder()
        val s = session(rec)
        s.feed(480, false)
        s.feed(1000, true)
        s.feed(1000, false)
        // 구간 [480ms, 1480ms) → 원 버퍼에서 앞 200·뒤 300ms 여유 = 1.5s, 여기에 앞 0.4s·뒤 0.2s 0 패딩
        val input = decoderInputs.single()
        assertEquals(Audio.msToSamples(1500) + Audio.msToSamples(400) + Audio.msToSamples(200), input.size)
        assertTrue((0 until Audio.msToSamples(400)).all { input[it] == 0f })
        // 앞 여유 200ms 는 원래 무음, 그 뒤가 말소리
        assertEquals(0f, input[Audio.msToSamples(400) + Audio.msToSamples(199)], 0f)
        assertTrue(input[Audio.msToSamples(400) + Audio.msToSamples(200)] > 0f)
        assertTrue((input.size - Audio.msToSamples(200) until input.size).all { input[it] == 0f })
    }

    @Test
    fun emptyUtteranceGivesEmptyFinalWithoutWav() {
        val rec = Recorder()
        val s = session(rec)
        s.feed(1000, false)
        s.finish("stop")
        val f = rec.finals.single()
        assertEquals("", f.text)
        assertNull(f.wavPath)
        assertTrue(wavs.isEmpty())
        assertEquals(1, rec.closedCount)
    }

    @Test
    fun maxUtteranceStopsCaptureWithMaxLengthFinal() {
        val rec = Recorder()
        val s = session(rec, maxUtteranceMs = 1000)
        assertFalse(s.feed(1400, true))
        val f = rec.finals.single()
        assertEquals("max_length", f.reason)
        assertEquals(1000, f.durationMs)
        assertEquals("語0", f.text) // 강제 flush 한 구간
        s.finish("stop") // 이미 닫힘 — 두 번째 final 없음
        assertEquals(1, rec.finals.size)
        assertEquals(1, rec.closedCount)
    }

    @Test
    fun cancelDropsUtteranceWithoutFinal() {
        val rec = Recorder()
        val s = session(rec)
        s.feed(1000, true)
        s.cancel()
        s.finish("stop")
        assertTrue(rec.finals.isEmpty())
        assertEquals(1, rec.closedCount)
        assertNull(rec.closed!!.second)
        assertFalse(s.feed(40, true))
    }

    @Test
    fun cancelledTasksQueuedEarlierAreSkipped() {
        val queued = ArrayList<Runnable>()
        val rec = Recorder()
        val s = SttSession("s1", "v1", SessionOptions(false, true, 60_000, true), FakeVad(500), { decoder }, { queued.add(it) }, rec, wavStore)
        s.feed(1000, true)
        s.feed(600, false) // 구간 하나가 worker 큐에 대기
        s.cancel()
        queued.forEach { it.run() }
        assertTrue(decoderInputs.isEmpty())
        assertEquals(listOf("closed"), rec.events)
    }

    @Test
    fun decodeFailureClosesSessionWithErrorAndNoFinal() {
        val rec = Recorder()
        val s = session(rec, dec = Decoder { throw IllegalStateException("boom") })
        s.feed(1000, true)
        s.feed(600, false)
        s.finish("stop")
        assertEquals(listOf("vad:SPEECH", "vad:SILENCE", "error:DECODE_FAILED", "closed"), rec.events)
        assertTrue(rec.finals.isEmpty())
    }

    @Test
    fun loadFailureOnWorkerStopsSession() {
        val rec = Recorder()
        val s = session(rec)
        s.failOnWorker("MODEL_CORRUPT", "load failed")
        assertFalse(s.feed(40, true))
        s.finish("stop")
        assertEquals(listOf("error:MODEL_CORRUPT", "closed"), rec.events)
    }

    @Test
    fun captureFailureReportsOnce() {
        val rec = Recorder()
        val s = session(rec)
        s.feed(200, true)
        s.fail("AUDIO_INIT_FAILED", "read error")
        s.fail("AUDIO_INIT_FAILED", "again")
        assertEquals(listOf("vad:SPEECH", "error:AUDIO_INIT_FAILED", "closed"), rec.events)
    }

    @Test
    fun autoModeFinalizesEachSegmentAndClosesOnFinish() {
        val rec = Recorder()
        val s = session(rec, auto = true)
        s.feed(400, false)
        s.feed(600, true)
        s.feed(600, false)
        s.feed(800, true)
        s.feed(600, false)
        s.feed(400, true)
        s.finish("stop")

        val reasons = rec.finals.map { it.reason to it.text }
        assertEquals(listOf("endpoint" to "語0", "endpoint" to "語1", "stop" to "語2"), reasons)
        assertTrue(rec.events.none { it.startsWith("partial") }) // auto 는 partial 없음
        assertEquals(3, wavs.size)
        assertEquals(listOf("/wav/s1-0.wav", "/wav/s1-1.wav", "/wav/s1-2.wav"), rec.finals.map { it.wavPath })
        // 끝점 지연: 구간 끝 뒤 무음 500ms 에 감지 → vadMs 500 근처
        assertTrue(rec.finals[0].timings.vadMs in 480..520)
        assertEquals(rec.finals.last(), rec.closed!!.second)
        assertEquals(1, rec.closedCount)
    }

    @Test
    fun autoModeFinishWithoutSpeechGivesEmptyLastFinal() {
        val rec = Recorder()
        val s = session(rec, auto = true)
        s.feed(600, true)
        s.feed(600, false)
        s.feed(400, false)
        s.finish("stop")
        assertEquals(listOf("endpoint" to "語0", "stop" to ""), rec.finals.map { it.reason to it.text })
        assertNull(rec.finals.last().wavPath)
        assertNotNull(rec.closed!!.second)
    }

    @Test
    fun loadMsIsReportedInFinal() {
        val rec = Recorder()
        val s = session(rec)
        s.loadMs = 1234
        s.feed(600, true)
        s.finish("stop")
        assertEquals(1234, rec.finals.single().timings.loadMs)
    }
}
