package com.miraclepenguin.kaiwa.sherpastt

import kotlin.math.log10
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sqrt

/** 16kHz mono PCM16 공통 계산. 안드로이드 API 를 쓰지 않는다(JVM 단위 테스트 대상). */
internal object Audio {
    const val SAMPLE_RATE = 16000
    const val FRAME_SAMPLES = 640 // 40ms — gateway 프레임(1,280바이트)과 같은 단위
    const val SILENCE_DB = -100.0

    // gateway(reazon_sherpa.py)와 같은 값이어야 두 경로의 인식 결과가 같다.
    // 앞 무음이 ~0.3s 이하면 발화 첫 단어가 통째로 빠진다(2026-09-28 stt20 실측) — 0.4s.
    const val LEAD_ZERO_MS = 400
    // 세그먼트가 버퍼 끝에서 잘리면(stop 직후) 마지막 토큰이 안 나온다.
    const val TAIL_ZERO_MS = 200
    // VAD 세그먼트 경계는 말소리 시작·끝을 조금 먹는다 — 원 버퍼에서 앞뒤 여유를 붙여 자른다.
    const val PAD_BEFORE_MS = 200
    const val PAD_AFTER_MS = 300

    fun msToSamples(ms: Int): Int = (SAMPLE_RATE.toLong() * ms / 1000).toInt()

    fun samplesToMs(n: Long): Int = (n * 1000 / SAMPLE_RATE).toInt()

    fun pcm16ToFloat(src: ShortArray, from: Int = 0, to: Int = src.size): FloatArray {
        require(from in 0..to && to <= src.size) { "range" }
        return FloatArray(to - from) { src[from + it] / 32768f }
    }

    fun padForDecode(samples: FloatArray, leadMs: Int = LEAD_ZERO_MS, tailMs: Int = TAIL_ZERO_MS): FloatArray {
        val lead = msToSamples(leadMs)
        val out = FloatArray(lead + samples.size + msToSamples(tailMs))
        System.arraycopy(samples, 0, out, lead, samples.size)
        return out
    }

    /** 웹 `LevelMeter`(pcm.ts rmsDb) 와 같은 식: dBFS, 바닥 -100, 소수 1자리. */
    fun rmsDb(sumSquares: Double, count: Int): Double {
        if (count <= 0 || sumSquares <= 0.0) return SILENCE_DB
        val db = 20.0 * log10(sqrt(sumSquares / count))
        if (db.isNaN() || db.isInfinite()) return SILENCE_DB
        return max(SILENCE_DB, (db * 10).roundToInt() / 10.0)
    }
}

/** 약 100ms 마다 레벨을 낸다(화면 레벨 미터). 캡처 스레드 전용. */
internal class LevelMeter(windowMs: Int = 100, private val emit: (Double) -> Unit) {
    private val window = max(1, Audio.msToSamples(windowMs))
    private var sum = 0.0
    private var cnt = 0

    fun push(frame: ShortArray, n: Int) {
        for (i in 0 until n) {
            val v = frame[i] / 32768.0
            sum += v * v
            if (++cnt >= window) {
                emit(Audio.rmsDb(sum, cnt))
                sum = 0.0
                cnt = 0
            }
        }
    }
}

/**
 * 발화 버퍼(PCM16). 절대 샘플 인덱스(VAD 가 주는 `start`)로 자르고, `auto` 모드에서는 앞부분을 버려
 * 긴 핸즈프리 세션에서도 메모리가 늘지 않게 한다(`origin` = data[0] 의 절대 인덱스).
 */
internal class PcmBuffer(initialCapacity: Int = Audio.SAMPLE_RATE * 10) {
    private var data = ShortArray(max(1, initialCapacity))
    var origin = 0L
        private set
    var size = 0
        private set

    /** 지금까지 받은 누적 샘플 수(= 다음 샘플의 절대 인덱스). */
    val end: Long get() = origin + size

    fun append(frame: ShortArray, n: Int) {
        if (size + n > data.size) {
            var cap = data.size
            while (cap < size + n) cap *= 2
            data = data.copyOf(cap)
        }
        System.arraycopy(frame, 0, data, size, n)
        size += n
    }

    /** [a, b) 를 가진 범위로 잘라 돌려준다. 범위 밖은 잘린다. */
    fun slice(a: Long, b: Long): ShortArray {
        val lo = (a.coerceIn(origin, end) - origin).toInt()
        val hi = (b.coerceIn(origin, end) - origin).toInt()
        return if (hi <= lo) ShortArray(0) else data.copyOfRange(lo, hi)
    }

    fun all(): ShortArray = data.copyOf(size)

    /** 절대 인덱스 `abs` 이전을 버린다. */
    fun dropBefore(abs: Long) {
        val cut = (abs.coerceIn(origin, end) - origin).toInt()
        if (cut <= 0) return
        System.arraycopy(data, cut, data, 0, size - cut)
        size -= cut
        origin += cut
    }
}
