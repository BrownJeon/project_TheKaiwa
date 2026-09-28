import com.k2fsa.sherpa.onnx.*
import com.miraclepenguin.kaiwa.sherpastt.*
import org.json.JSONObject
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.Executor

// 플러그인 Recognizer.kt·SherpaVadEngine 과 같은 설정을 sherpa-onnx JVM(Java) API 로 옮겨 적은 데스크톱 검증 하네스.
// SttSession·Audio 는 플러그인 소스 그대로다.
fun readWav(f: File): ShortArray {
    val b = ByteBuffer.wrap(f.readBytes()).order(ByteOrder.LITTLE_ENDIAN)
    var pos = 12
    while (pos + 8 <= b.limit()) {
        val id = String(ByteArray(4) { b.get(pos + it) }, Charsets.US_ASCII)
        val len = b.getInt(pos + 4)
        if (id == "fmt ") check(b.getShort(pos + 8 + 2).toInt() == 1 && b.getInt(pos + 8 + 4) == 16000) { "need 16k mono" }
        if (id == "data") return ShortArray(len / 2) { b.getShort(pos + 8 + it * 2) }
        pos += 8 + len + (len and 1)
    }
    error("no data chunk")
}

fun norm(s: String) = s.replace(Regex("[、。，．,.!?！？\\s]"), "")

fun cer(ref: String, hyp: String): Double {
    val r = norm(ref); val h = norm(hyp)
    val d = Array(r.length + 1) { IntArray(h.length + 1) }
    for (i in 0..r.length) d[i][0] = i
    for (j in 0..h.length) d[0][j] = j
    for (i in 1..r.length) for (j in 1..h.length) d[i][j] = minOf(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + if (r[i-1] == h[j-1]) 0 else 1)
    return if (r.isEmpty()) 0.0 else d[r.length][h.length].toDouble() / r.length
}

fun main(args: Array<String>) {
    val model = File(args[0]); val wavDir = File(args[1])
    val threads = args.getOrNull(2)?.toInt() ?: 2
    val t0 = System.nanoTime()
    val rec = OfflineRecognizer(OfflineRecognizerConfig.Builder()
        .setFeatureConfig(FeatureConfig.Builder().setSampleRate(16000).setFeatureDim(80).setDither(0f).build())
        .setOfflineModelConfig(OfflineModelConfig.Builder()
            .setTransducer(OfflineTransducerModelConfig.Builder()
                .setEncoder(File(model, "encoder-epoch-99-avg-1.int8.onnx").path)
                .setDecoder(File(model, "decoder-epoch-99-avg-1.onnx").path)
                .setJoiner(File(model, "joiner-epoch-99-avg-1.int8.onnx").path).build())
            .setTokens(File(model, "tokens.txt").path).setNumThreads(threads).setDebug(false).setProvider("cpu").setModelType("transducer").build())
        .setDecodingMethod("greedy_search").build())
    println("load ${(System.nanoTime() - t0) / 1_000_000}ms threads=$threads")
    val decoder = Decoder { s ->
        val st = rec.createStream(); st.acceptWaveform(s, 16000); rec.decode(st)
        val t = rec.getResult(st).text; st.release(); t
    }
    decoder.decode(FloatArray(8000))
    val sentences = JSONObject(File(wavDir, "sentences.json").readText()).getJSONArray("sentences")
    var pass = 0; var passNoPad = 0
    val direct = Executor { it.run() }
    for (i in 0 until sentences.length()) {
        val s = sentences.getJSONObject(i)
        val refs = listOf(s.getString("text")) + (s.optJSONArray("alternatives")?.let { a -> List(a.length()) { a.getString(it) } } ?: emptyList())
        val pcm = readWav(File(wavDir, s.getString("id") + ".wav"))
        val vad = object : VadEngine {
            val v = Vad(VadModelConfig.Builder().setSileroVadModelConfig(SileroVadModelConfig.Builder()
                .setModel(File(model, "silero_vad.onnx").path).setThreshold(0.5f).setMinSilenceDuration(0.5f)
                .setMinSpeechDuration(0.25f).setWindowSize(512).setMaxSpeechDuration(30f).build())
                .setSampleRate(16000).setNumThreads(1).setProvider("cpu").setDebug(false).build())
            override fun acceptWaveform(samples: FloatArray) = v.acceptWaveform(samples)
            override fun isSpeechDetected() = v.isSpeechDetected()
            override fun empty() = v.empty()
            override fun front(): VadSegment { val x = v.front(); return VadSegment(x.start.toLong(), x.samples.size) }
            override fun pop() = v.pop()
            override fun flush() = v.flush()
            override fun reset() = v.reset()
        }
        var final: FinalResult? = null
        val partials = ArrayList<String>()
        val sink = object : SessionSink {
            override fun onVad(sessionId: String, state: String, atMs: Int) {}
            override fun onPartial(sessionId: String, seg: Segment) { partials.add(seg.text) }
            override fun onFinal(result: FinalResult) { final = result }
            override fun onError(sessionId: String, code: String, message: String) { println("ERROR $code $message") }
            override fun onClosed(sessionId: String, last: FinalResult?) {}
        }
        val session = SttSession("s$i", "v", SessionOptions(false, true, 60_000, false), vad, { decoder }, direct, sink, WavStore { _, _, _ -> null })
        // 푸시투토크처럼: 앞 0.3s 무음 → 음성 → 뒤 0.3s 무음 뒤 stop
        val lead = ShortArray(Audio.msToSamples(300)); val tail = ShortArray(Audio.msToSamples(300))
        val all = lead + pcm + tail
        var k = 0
        while (k + Audio.FRAME_SAMPLES <= all.size) { session.pushFrame(all.copyOfRange(k, k + Audio.FRAME_SAMPLES), Audio.FRAME_SAMPLES); k += Audio.FRAME_SAMPLES }
        session.finish("stop")
        val f = final!!
        val best = refs.minOf { cer(it, f.text) }
        val noPad = decoder.decode(Audio.pcm16ToFloat(pcm))  // 패딩 없이 통째로(비교용)
        val bestNoPad = refs.minOf { cer(it, noPad) }
        if (1 - best >= 0.9) pass++
        if (1 - bestNoPad >= 0.9) passNoPad++
        println("%s sim=%.2f dur=%dms decode=%dms segs=%d text=%s | noPad sim=%.2f %s".format(java.util.Locale.ROOT, s.getString("id"), 1 - best, f.durationMs, f.timings.decodeMs, f.segments.size, f.text, 1 - bestNoPad, noPad))
    }
    println("PASS(plugin session, sim>=0.9) $pass/${sentences.length()}  |  no-padding whole-utterance $passNoPad/${sentences.length()}")
}
