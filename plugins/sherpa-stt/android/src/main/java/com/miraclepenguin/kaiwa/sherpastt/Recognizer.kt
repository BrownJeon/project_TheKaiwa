package com.miraclepenguin.kaiwa.sherpastt

import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizer
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import com.k2fsa.sherpa.onnx.OfflineTransducerModelConfig
import com.k2fsa.sherpa.onnx.SileroVadModelConfig
import com.k2fsa.sherpa.onnx.Vad
import com.k2fsa.sherpa.onnx.VadModelConfig

internal data class RecognizerKey(val version: String, val numThreads: Int, val decodingMethod: String)

/**
 * OfflineRecognizer(zipformer transducer int8) 한 벌을 캐시한다 — 로드 ≈1~2s·메모리 ≈200MB 라 세션마다 새로 만들지 않는다.
 * 설정은 gateway 와 같게(feature_dim 80·dither 0·transducer). **worker 스레드에서만** 부른다.
 */
internal class RecognizerHolder {
    private var recognizer: OfflineRecognizer? = null
    private var key: RecognizerKey? = null

    @Volatile var lastLoadMs: Int? = null
        private set

    @Volatile var loadedKey: RecognizerKey? = null
        private set

    /** 로드했으면 걸린 ms, 이미 있었으면 0. */
    @Throws(SttException::class)
    fun ensure(model: InstalledModel, numThreads: Int, decodingMethod: String): Int {
        val want = RecognizerKey(model.version, numThreads, decodingMethod)
        if (recognizer != null && key == want) return 0
        release()
        val t0 = System.nanoTime()
        val config = OfflineRecognizerConfig(
            featConfig = FeatureConfig(sampleRate = Audio.SAMPLE_RATE, featureDim = 80, dither = 0f),
            modelConfig = OfflineModelConfig(
                transducer = OfflineTransducerModelConfig(
                    encoder = model.path("encoder").absolutePath,
                    decoder = model.path("decoder").absolutePath,
                    joiner = model.path("joiner").absolutePath,
                ),
                tokens = model.path("tokens").absolutePath,
                numThreads = numThreads,
                debug = false,
                provider = "cpu",
                modelType = "transducer",
            ),
            decodingMethod = decodingMethod,
        )
        val r = try {
            OfflineRecognizer(config = config)
        } catch (e: OutOfMemoryError) {
            throw SttException("OOM", "out of memory while loading recognizer")
        } catch (e: Throwable) {
            throw SttException("MODEL_CORRUPT", "recognizer load failed: ${e.javaClass.simpleName}")
        }
        recognizer = r
        key = want
        loadedKey = want
        // 첫 디코드는 그래프 초기화로 느리다 — 로드에 흡수한다(gateway 와 같음).
        try {
            decode(FloatArray(Audio.SAMPLE_RATE / 2))
        } catch (e: Throwable) {
            release()
            throw SttException(if (e is OutOfMemoryError) "OOM" else "MODEL_CORRUPT", "warm-up decode failed: ${e.javaClass.simpleName}")
        }
        val ms = ((System.nanoTime() - t0) / 1_000_000).toInt()
        lastLoadMs = ms
        return ms
    }

    val decoder: Decoder = Decoder { samples -> decode(samples) }

    private fun decode(samples: FloatArray): String {
        val r = recognizer ?: throw SttException("MODEL_MISSING", "recognizer not loaded")
        val stream = r.createStream()
        try {
            stream.acceptWaveform(samples, Audio.SAMPLE_RATE)
            r.decode(stream)
            return r.getResult(stream).text
        } finally {
            stream.release()
        }
    }

    fun release() {
        recognizer?.release()
        recognizer = null
        key = null
        loadedKey = null
    }
}

internal data class VadParams(val silenceMs: Int, val threshold: Float, val minSpeechMs: Int, val maxSegmentSec: Int)

/** sherpa-onnx silero VAD. 세션마다 새로 만든다(0.6MB, 수십 ms) — 세션 사이에 상태가 새지 않게. */
internal class SherpaVadEngine(modelPath: String, p: VadParams) : VadEngine {
    private val vad: Vad = try {
        Vad(
            config = VadModelConfig(
                sileroVadModelConfig = SileroVadModelConfig(
                    model = modelPath,
                    threshold = p.threshold,
                    minSilenceDuration = p.silenceMs / 1000f,
                    minSpeechDuration = p.minSpeechMs / 1000f,
                    windowSize = 512,
                    maxSpeechDuration = p.maxSegmentSec.toFloat(),
                ),
                sampleRate = Audio.SAMPLE_RATE,
                numThreads = 1,
                provider = "cpu",
                debug = false,
            ),
        )
    } catch (e: Throwable) {
        throw SttException("MODEL_CORRUPT", "vad load failed: ${e.javaClass.simpleName}")
    }

    override fun acceptWaveform(samples: FloatArray) = vad.acceptWaveform(samples)

    override fun isSpeechDetected(): Boolean = vad.isSpeechDetected()

    override fun empty(): Boolean = vad.empty()

    override fun front(): VadSegment {
        val s = vad.front()
        return VadSegment(s.start.toLong(), s.samples.size)
    }

    override fun pop() = vad.pop()

    override fun flush() = vad.flush()

    override fun reset() = vad.reset()

    fun release() = vad.release()
}
