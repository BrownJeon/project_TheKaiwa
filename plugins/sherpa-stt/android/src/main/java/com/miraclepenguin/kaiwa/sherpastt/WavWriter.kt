package com.miraclepenguin.kaiwa.sherpastt

import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** 16kHz mono PCM16 wav. 임시 파일에 다 쓴 뒤 rename 해 반쯤 쓴 파일이 업로드되지 않게 한다. */
internal object WavWriter {
    const val HEADER_BYTES = 44

    fun header(numSamples: Int, sampleRate: Int = Audio.SAMPLE_RATE): ByteArray {
        val dataBytes = numSamples * 2
        return ByteBuffer.allocate(HEADER_BYTES).order(ByteOrder.LITTLE_ENDIAN).apply {
            put("RIFF".toByteArray(Charsets.US_ASCII))
            putInt(36 + dataBytes)
            put("WAVE".toByteArray(Charsets.US_ASCII))
            put("fmt ".toByteArray(Charsets.US_ASCII))
            putInt(16)
            putShort(1) // PCM
            putShort(1) // mono
            putInt(sampleRate)
            putInt(sampleRate * 2) // byte rate
            putShort(2) // block align
            putShort(16) // bits per sample
            put("data".toByteArray(Charsets.US_ASCII))
            putInt(dataBytes)
        }.array()
    }

    @Throws(IOException::class)
    fun write(target: File, pcm: ShortArray, sampleRate: Int = Audio.SAMPLE_RATE) {
        val tmp = File(target.parentFile, target.name + ".tmp")
        BufferedOutputStream(FileOutputStream(tmp)).use { out ->
            out.write(header(pcm.size, sampleRate))
            val buf = ByteBuffer.allocate(8192).order(ByteOrder.LITTLE_ENDIAN)
            for (s in pcm) {
                if (buf.remaining() < 2) {
                    out.write(buf.array(), 0, buf.position())
                    buf.clear()
                }
                buf.putShort(s)
            }
            out.write(buf.array(), 0, buf.position())
        }
        if (!tmp.renameTo(target)) {
            tmp.delete()
            throw IOException("wav rename failed")
        }
    }
}
