package com.miraclepenguin.kaiwa.sherpastt

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

class AudioTest {
    @Test
    fun padsLeadAndTailSilenceLikeGateway() {
        val samples = FloatArray(1600) { 0.5f }
        val padded = Audio.padForDecode(samples)
        // 앞 0.4s(6,400) · 뒤 0.2s(3,200) — gateway reazon_sherpa.py LEAD_ZERO_MS/TAIL_ZERO_MS 와 같아야 한다.
        assertEquals(6400 + 1600 + 3200, padded.size)
        assertEquals(0f, padded[6399], 0f)
        assertEquals(0.5f, padded[6400], 0f)
        assertEquals(0.5f, padded[6400 + 1599], 0f)
        assertEquals(0f, padded[6400 + 1600], 0f)
        assertEquals(0f, padded.last(), 0f)
    }

    @Test
    fun convertsPcm16ToFloat() {
        val f = Audio.pcm16ToFloat(shortArrayOf(0, 16384, -32768, 32767))
        assertEquals(0f, f[0], 0f)
        assertEquals(0.5f, f[1], 0f)
        assertEquals(-1f, f[2], 0f)
        assertEquals(32767 / 32768f, f[3], 0f)
    }

    @Test
    fun rmsDbMatchesWebMeter() {
        assertEquals(-100.0, Audio.rmsDb(0.0, 10), 0.0)
        assertEquals(-100.0, Audio.rmsDb(1.0, 0), 0.0)
        // 진폭 0.5 사인 없이 상수 0.5 → 20·log10(0.5) = -6.0206 → 소수 1자리 -6.0
        assertEquals(-6.0, Audio.rmsDb(0.25 * 100, 100), 0.0)
        // 아주 작은 값은 바닥 -100
        assertEquals(-100.0, Audio.rmsDb(1e-20, 1), 0.0)
    }

    @Test
    fun levelMeterEmitsEvery100ms() {
        val out = ArrayList<Double>()
        val m = LevelMeter { out.add(it) }
        val frame = ShortArray(Audio.FRAME_SAMPLES) { 16384 }
        repeat(5) { m.push(frame, frame.size) } // 200ms
        assertEquals(2, out.size)
        assertEquals(-6.0, out[0], 0.0)
    }

    @Test
    fun pcmBufferSlicesByAbsoluteIndexAndDropsFront() {
        val b = PcmBuffer(4)
        b.append(ShortArray(10) { it.toShort() }, 10)
        assertEquals(10L, b.end)
        assertArrayEquals(shortArrayOf(2, 3, 4), b.slice(2, 5))
        assertArrayEquals(shortArrayOf(8, 9), b.slice(8, 100)) // 끝은 잘린다
        b.dropBefore(6)
        assertEquals(6L, b.origin)
        assertEquals(4, b.size)
        assertArrayEquals(shortArrayOf(6, 7), b.slice(0, 8)) // 버린 앞부분은 잘린다
        b.append(shortArrayOf(10, 11), 2)
        assertEquals(12L, b.end)
        assertArrayEquals(shortArrayOf(6, 7, 8, 9, 10, 11), b.all())
    }

    @Test
    fun writesWavHeaderAndSamples() {
        val dir = createTempDirectory()
        val f = File(dir, "a.wav")
        WavWriter.write(f, shortArrayOf(1, -2, 3))
        val bytes = f.readBytes()
        assertEquals(44 + 6, bytes.size)
        val bb = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
        assertEquals("RIFF", String(bytes, 0, 4, Charsets.US_ASCII))
        assertEquals(36 + 6, bb.getInt(4))
        assertEquals("WAVE", String(bytes, 8, 4, Charsets.US_ASCII))
        assertEquals(1, bb.getShort(20).toInt()) // PCM
        assertEquals(1, bb.getShort(22).toInt()) // mono
        assertEquals(16000, bb.getInt(24))
        assertEquals(16, bb.getShort(34).toInt())
        assertEquals(6, bb.getInt(40))
        assertEquals(-2, bb.getShort(46).toInt())
        assertEquals(false, File(dir, "a.wav.tmp").exists())
        dir.deleteRecursively()
    }
}

internal fun createTempDirectory(): File = kotlin.io.path.createTempDirectory("sherpa-stt-test").toFile()
