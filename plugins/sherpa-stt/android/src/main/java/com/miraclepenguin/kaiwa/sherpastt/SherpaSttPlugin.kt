package com.miraclepenguin.kaiwa.sherpastt

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Uri
import android.net.NetworkCapabilities
import android.os.Build
import android.provider.Settings
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException

/**
 * 온디바이스 실시간 STT(silero VAD + ReazonSpeech zipformer int8, sherpa-onnx). 계약: task-003f 이력서
 * "플러그인 JS 계약 v1" · plugins/sherpa-stt/README §4.
 *
 * 스레드: 메서드는 Capacitor 플러그인 스레드, 캡처는 `sherpa-stt-capture`, 모델 로드·디코드·세션 이벤트는
 * 단일 스레드 `worker`(순서 보장), 모델 다운로드는 `download`, 파일 조회·검증은 `io`.
 * 서버와는 모델 다운로드 말고는 통신하지 않는다 — 발화 업로드·티켓·설정은 웹 계층이 한다.
 */
@CapacitorPlugin(
    name = "SherpaStt",
    permissions = [Permission(alias = SherpaSttPlugin.MIC, strings = [Manifest.permission.RECORD_AUDIO])],
)
class SherpaSttPlugin : Plugin() {
    private val worker: ExecutorService = Executors.newSingleThreadExecutor { Thread(it, "sherpa-stt-worker") }
    private val download: ExecutorService = Executors.newSingleThreadExecutor { Thread(it, "sherpa-stt-download") }
    private val io: ExecutorService = Executors.newSingleThreadExecutor { Thread(it, "sherpa-stt-io") }
    private val recognizer = RecognizerHolder()
    private lateinit var store: ModelStore
    private lateinit var utterDir: File

    /** 세션·다운로드·삭제 점유의 단일 임계구역(REV-021). `pendingStops` 도 이 모니터로 묶는다. */
    private val gate = ModelGate<Active, ModelDownloader>()
    private val pendingStops = ArrayList<PluginCall>()

    /** 진단용 — 이번 프로세스의 마지막 발화(말한 길이, 디코드 ms). 텍스트·소리는 두지 않는다. */
    @Volatile private var lastFinal: Pair<Int, Int>? = null

    private class Active(val session: SttSession, val capture: AudioCapture, val vad: SherpaVadEngine)

    override fun load() {
        store = ModelStore(File(context.filesDir, "models/stt"), VERSION)
        utterDir = File(context.filesDir, "utterances")
        io.execute {
            try {
                utterDir.mkdirs()
                // 이전 프로세스의 발화 파일(업로드 중이던 것 포함)은 더 쓸 곳이 없다.
                utterDir.listFiles()?.forEach { it.delete() }
                store.root.listFiles { f -> f.name.startsWith(".old-") }?.forEach { it.deleteRecursively() }
            } catch (e: Exception) {
                // 정리는 부가 작업 — 다음 기동에 다시 한다.
            }
        }
    }

    /**
     * 백그라운드 작업 실행. 안드로이드는 어느 스레드든 잡히지 않은 예외(네이티브 `UnsatisfiedLinkError`·OOM 포함)가
     * 앱 프로세스를 죽이므로 전부 잡아 `call` 의 reject 로 돌려준다.
     */
    private fun ExecutorService.task(call: PluginCall, fallbackCode: String, block: () -> Unit) {
        execute {
            try {
                block()
            } catch (e: SttException) {
                call.reject(e.message, e.code)
            } catch (e: OutOfMemoryError) {
                call.reject("out of memory", "OOM")
            } catch (e: Throwable) {
                call.reject("failed: ${e.javaClass.simpleName}", fallbackCode)
            }
        }
    }

    // ── 모델 ────────────────────────────────────────────────────────────────

    @PluginMethod
    fun checkModel(call: PluginCall) {
        val verify = call.getBoolean("verify", false) == true
        io.task(call, "UNAVAILABLE") {
            var model = store.current()
            if (verify && model != null && !store.verify(model)) model = store.current()
            val out = JSObject().put("installed", model != null)
            if (model != null) {
                out.put("version", model.version)
                out.put("bytes", model.totalBytes)
            }
            out.put("downloading", gate.download() != null)
            out.put("freeBytes", context.filesDir.usableSpace)
            store.pending()?.let { (v, bytes) ->
                if (v != model?.version) {
                    out.put("pendingVersion", v)
                    out.put("pendingBytes", bytes)
                }
            }
            call.resolve(out)
        }
    }

    @PluginMethod
    fun downloadModel(call: PluginCall) {
        val manifestUrl = call.getString("manifestUrl")
        if (manifestUrl.isNullOrEmpty()) return call.reject("manifestUrl required", "INVALID_ARGUMENT")
        val expected = call.getString("expectedVersion")
        if (expected != null && !ManifestValidator.isValidVersion(expected)) return call.reject("expectedVersion", "INVALID_ARGUMENT")
        val req = DownloadRequest(
            manifestUrl = manifestUrl,
            wifiOnly = call.getBoolean("wifiOnly", true) != false,
            expectedVersion = expected,
            allowDowngrade = call.getBoolean("allowDowngrade", false) == true,
        )
        val serverUrl = bridge.config.serverUrl ?: return call.reject("app has no server url", "ORIGIN_NOT_ALLOWED")
        val d = try {
            ModelDownloader(store, OriginPolicy(serverUrl), NetworkGate { wifiOnly -> networkError(wifiOnly) }, { context.filesDir.usableSpace }, "thekaiwa-sherpa-stt/$VERSION", VERSION)
        } catch (e: IllegalArgumentException) {
            return call.reject("app server url is not https", "ORIGIN_NOT_ALLOWED")
        }
        try {
            gate.beginDownload(d) // 삭제 중이면 BUSY, 이미 받는 중이면 DOWNLOAD_IN_PROGRESS
        } catch (e: SttException) {
            return call.reject(e.message, e.code)
        }
        download.execute {
            try {
                val r = d.download(req) { p ->
                    notifyListeners(
                        "downloadProgress",
                        JSObject().put("version", p.version).put("fileIndex", p.fileIndex).put("fileCount", p.fileCount)
                            .put("received", p.received).put("total", p.total)
                            .put("totalReceived", p.totalReceived).put("totalBytes", p.totalBytes),
                    )
                }
                call.resolve(JSObject().put("version", r.version).put("bytes", r.bytes).put("alreadyInstalled", r.alreadyInstalled))
            } catch (e: SttException) {
                call.reject(e.message, e.code)
            } catch (e: OutOfMemoryError) {
                call.reject("out of memory", "OOM")
            } catch (e: Throwable) {
                call.reject("download failed: ${e.javaClass.simpleName}", "DOWNLOAD_FAILED")
            } finally {
                gate.endDownload(d)
            }
        }
    }

    @PluginMethod
    fun cancelDownload(call: PluginCall) {
        gate.download()?.cancel()
        call.resolve()
    }

    @PluginMethod
    fun deleteModel(call: PluginCall) {
        try {
            gate.beginDelete() // 판정과 점유가 한 번에 — 이후 start·downloadModel 은 endDelete 까지 BUSY
        } catch (e: SttException) {
            return call.reject(e.message, e.code)
        }
        try {
            worker.task(call, "UNAVAILABLE") {
                try {
                    recognizer.release()
                    store.deleteAll()
                    call.resolve()
                } finally {
                    gate.endDelete()
                }
            }
        } catch (e: RejectedExecutionException) {
            gate.endDelete()
            call.reject("plugin is shutting down", "UNAVAILABLE")
        }
    }

    // ── 인식 ────────────────────────────────────────────────────────────────

    @PluginMethod
    fun preload(call: PluginCall) {
        val threads: Int
        val method: String
        try {
            threads = Opts.int(call.data, "numThreads", 2, 1..8)
            method = decodingOpt(call.data)
        } catch (e: SttException) {
            return call.reject(e.message, e.code)
        }
        worker.task(call, "MODEL_CORRUPT") {
            val model = store.current() ?: throw SttException("MODEL_MISSING", "model not installed")
            val ms = recognizer.ensure(model, threads, method)
            call.resolve(JSObject().put("modelVersion", model.version).put("loadMs", ms))
        }
    }

    @PluginMethod
    fun start(call: PluginCall) {
        if (getPermissionState(MIC) != PermissionState.GRANTED) {
            return call.reject("microphone permission not granted", "PERMISSION_DENIED")
        }
        val o = try {
            parseStart(call.data)
        } catch (e: SttException) {
            return call.reject(e.message, e.code)
        }
        val a = try {
            // 설치본 확인·VAD 생성·마이크 열기까지 gate 안에서 — 그 사이 deleteModel 이 끼지 못한다(REV-021).
            gate.openSession { openSession(o) }
        } catch (e: SttException) {
            return call.reject(e.message, e.code)
        }
        call.resolve(JSObject().put("sessionId", a.session.sessionId).put("modelVersion", a.session.modelVersion))
    }

    /** gate 락 안에서 불린다. 실패하면 만든 것을 되돌리고 SttException. */
    private fun openSession(o: StartOptions): Active {
        val model = store.current() ?: throw SttException("MODEL_MISSING", "model not installed")
        pruneWavs()
        val vad = SherpaVadEngine(model.path("vad").absolutePath, o.vad)
        val sessionId = UUID.randomUUID().toString().replace("-", "")
        val session = SttSession(sessionId, model.version, o.session, vad, { recognizer.decoder }, worker, sink, wavStore)
        // worker 는 FIFO — 이 로드가 끝난 뒤에야 이 세션의 디코드가 돈다. 그동안 소리는 버퍼에 쌓인다.
        // 설치본은 실행 시점에 다시 읽는다(그 사이 다운로드가 새 버전을 올리고 옛 파일을 지웠을 수 있다).
        worker.execute {
            try {
                val current = store.current() ?: throw SttException("MODEL_MISSING", "model not installed")
                session.loadMs = recognizer.ensure(current, o.numThreads, o.decodingMethod)
            } catch (e: SttException) {
                session.failOnWorker(e.code, e.message ?: e.code)
            } catch (e: OutOfMemoryError) {
                session.failOnWorker("OOM", "out of memory while loading recognizer")
            } catch (e: Throwable) {
                session.failOnWorker("MODEL_CORRUPT", "recognizer load failed: ${e.javaClass.simpleName}")
            }
        }
        val meter = LevelMeter { db -> notifyListeners("level", JSObject().put("sessionId", sessionId).put("db", db)) }
        val capture = AudioCapture(
            o.audioSource,
            onFrame = { frame, n ->
                meter.push(frame, n)
                session.pushFrame(frame, n)
            },
            onFailure = { code, msg -> session.fail(code, msg) },
        )
        try {
            capture.start()
        } catch (e: SttException) {
            session.cancel()
            vad.release()
            throw e
        }
        return Active(session, capture, vad)
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        val a = synchronized(gate) {
            val a = gate.session() ?: return call.resolve(JSObject())
            pendingStops.add(call)
            a
        }
        a.capture.stop()
        a.session.finish("stop")
        // resolve 는 마지막 final 뒤 `sink.onClosed` 에서.
    }

    @PluginMethod
    fun cancel(call: PluginCall) {
        val a = gate.session()
        if (a != null) {
            a.capture.stop()
            a.session.cancel()
        }
        call.resolve()
    }

    @PluginMethod
    fun release(call: PluginCall) {
        val a = gate.session()
        if (a != null) {
            a.capture.stop()
            a.session.cancel()
        }
        worker.task(call, "UNAVAILABLE") {
            recognizer.release()
            call.resolve()
        }
    }

    @PluginMethod
    fun deleteWav(call: PluginCall) {
        val path = call.getString("wavPath") ?: return call.reject("wavPath required", "INVALID_ARGUMENT")
        io.task(call, "INVALID_ARGUMENT") {
            val f = File(path)
            val inside = try {
                f.canonicalFile.parentFile == utterDir.canonicalFile && WAV_NAME.matches(f.name)
            } catch (e: Exception) {
                false
            }
            if (!inside) throw SttException("INVALID_ARGUMENT", "not a plugin wav")
            f.delete()
            call.resolve()
        }
    }

    @PluginMethod
    fun getDiagnostics(call: PluginCall) {
        io.task(call, "UNAVAILABLE") {
            val key = recognizer.loadedKey
            val rt = Runtime.getRuntime()
            val out = JSObject()
                .put("pluginVersion", VERSION)
                .put("abi", Build.SUPPORTED_ABIS.firstOrNull() ?: "unknown")
                .put("recognizerLoaded", key != null)
                .put("rssMb", rssMb())
                .put("javaHeapMb", (rt.totalMemory() - rt.freeMemory()) / (1024 * 1024))
            store.current()?.let { out.put("modelVersion", it.version) }
            key?.let { out.put("numThreads", it.numThreads) }
            recognizer.lastLoadMs?.let { out.put("lastLoadMs", it) }
            lastFinal?.let { (durationMs, decodeMs) ->
                out.put("lastUtteranceMs", durationMs)
                out.put("lastDecodeMs", decodeMs)
            }
            call.resolve(out)
        }
    }

    /** 영구 거절된 마이크 권한을 사용자가 켜러 가는 길(docs/screens.md §11-2 F). */
    @PluginMethod
    fun openAppSettings(call: PluginCall) {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            context.startActivity(intent)
            call.resolve()
        } catch (e: ActivityNotFoundException) {
            call.reject("app settings screen not available", "UNAVAILABLE")
        }
    }

    // ── 생명주기 ──────────────────────────────────────────────────────────────

    /**
     * 화면을 떠나면 녹음을 남기지 않는다 — 말하는 중이던 발화는 버리고 `INTERRUPTED` 를 알린다. 이미 손을 뗀 발화(final 마무리 중)는
     * 그대로 끝낸다. 메인 스레드라 join 하지 않는다.
     */
    override fun handleOnPause() {
        val a = gate.session() ?: return
        if (a.session.isClosed) return
        a.session.cancel() // 캡처 스레드는 다음 프레임(≤40ms)에 pushFrame=false 로 스스로 멈추고 AudioRecord 를 해제한다
        notifyListeners("error", JSObject().put("sessionId", a.session.sessionId).put("code", "INTERRUPTED").put("message", "app paused"))
    }

    override fun handleOnDestroy() {
        gate.session()?.session?.cancel()
        gate.download()?.cancel()
        worker.execute { recognizer.release() }
        worker.shutdown()
        download.shutdown()
        io.shutdown()
    }

    // ── 세션 이벤트 ───────────────────────────────────────────────────────────

    private val sink = object : SessionSink {
        override fun onVad(sessionId: String, state: String, atMs: Int) {
            notifyListeners("vad", JSObject().put("sessionId", sessionId).put("state", state).put("atMs", atMs))
        }

        override fun onPartial(sessionId: String, seg: Segment) {
            notifyListeners(
                "partial",
                JSObject().put("sessionId", sessionId).put("segIdx", seg.segIdx).put("text", seg.text)
                    .put("startMs", seg.startMs).put("endMs", seg.endMs),
            )
        }

        override fun onFinal(result: FinalResult) {
            if (result.text.isNotEmpty()) lastFinal = result.durationMs to result.timings.decodeMs
            notifyListeners("final", finalJson(result))
        }

        override fun onError(sessionId: String, code: String, message: String) {
            notifyListeners("error", JSObject().put("sessionId", sessionId).put("code", code).put("message", message))
        }

        override fun onClosed(sessionId: String, last: FinalResult?) {
            val (a, calls) = synchronized(gate) {
                val mine = gate.session()?.takeIf { it.session.sessionId == sessionId }
                if (mine != null) gate.closeSession(mine)
                val calls = pendingStops.toList()
                pendingStops.clear()
                mine to calls
            }
            if (a != null) {
                a.capture.stop()
                a.vad.release()
            }
            val out = JSObject().put("sessionId", sessionId)
            if (last != null) out.put("utterance", finalJson(last))
            calls.forEach { it.resolve(out) }
        }
    }

    private val wavStore = WavStore { sessionId, index, pcm ->
        try {
            utterDir.mkdirs()
            val f = File(utterDir, if (index == 0) "$sessionId.wav" else "$sessionId-$index.wav")
            WavWriter.write(f, pcm)
            f.absolutePath
        } catch (e: Exception) {
            null
        }
    }

    private fun finalJson(r: FinalResult): JSObject {
        val segs = JSArray()
        for (s in r.segments) {
            segs.put(JSONObject().put("segIdx", s.segIdx).put("text", s.text).put("startMs", s.startMs).put("endMs", s.endMs))
        }
        return JSObject()
            .put("sessionId", r.sessionId)
            .put("text", r.text)
            .put("durationMs", r.durationMs)
            .put("wavPath", r.wavPath ?: JSONObject.NULL)
            .put("segments", segs)
            .put(
                "timings",
                JSObject().put("vadMs", r.timings.vadMs).put("decodeMs", r.timings.decodeMs)
                    .put("loadMs", r.timings.loadMs).put("sttMs", r.timings.sttMs),
            )
            .put("reason", r.reason)
            .put("modelVersion", r.modelVersion)
    }

    // ── 보조 ────────────────────────────────────────────────────────────────

    /** 업로드 뒤 `deleteWav` 를 못 부른 파일 — 10분 지나면 지운다(진행 중 업로드는 건드리지 않게). */
    private fun pruneWavs() {
        val cutoff = System.currentTimeMillis() - WAV_TTL_MS
        utterDir.listFiles()?.forEach { if (it.lastModified() < cutoff) it.delete() }
    }

    private fun networkError(wifiOnly: Boolean): String? {
        val cm = context.getSystemService(ConnectivityManager::class.java) ?: return "OFFLINE"
        val net = cm.activeNetwork ?: return "OFFLINE"
        val caps = cm.getNetworkCapabilities(net) ?: return "OFFLINE"
        if (!caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) return "OFFLINE"
        if (wifiOnly && !caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)) return "NETWORK_NOT_ALLOWED"
        return null
    }

    private fun rssMb(): Long = try {
        File("/proc/self/status").readLines().firstOrNull { it.startsWith("VmRSS:") }
            ?.split(Regex("\\s+"))?.getOrNull(1)?.toLong()?.div(1024) ?: -1
    } catch (e: Exception) {
        -1
    }

    private class StartOptions(
        val session: SessionOptions,
        val vad: VadParams,
        val numThreads: Int,
        val decodingMethod: String,
        val audioSource: Int,
    )

    @Throws(SttException::class)
    private fun parseStart(data: JSONObject): StartOptions {
        val vadObj = when (val v = data.opt("vad")) {
            null, JSONObject.NULL -> JSONObject()
            is JSONObject -> v
            else -> throw SttException("INVALID_ARGUMENT", "vad")
        }
        val vad = VadParams(
            silenceMs = Opts.int(vadObj, "silenceMs", 500, 100..3000),
            threshold = Opts.float(vadObj, "threshold", 0.5f, 0.05f..0.95f),
            minSpeechMs = Opts.int(vadObj, "minSpeechMs", 250, 50..2000),
            maxSegmentSec = Opts.int(vadObj, "maxSegmentSec", 30, 1..60),
        )
        val endpoint = Opts.str(data, "endpoint", "manual")
        if (endpoint != "manual" && endpoint != "auto") throw SttException("INVALID_ARGUMENT", "endpoint")
        return StartOptions(
            session = SessionOptions(
                endpointAuto = endpoint == "auto",
                partial = Opts.bool(data, "partial", true),
                maxUtteranceMs = Opts.int(data, "maxUtteranceSec", 60, 1..300) * 1000,
                saveWav = Opts.bool(data, "saveWav", true),
            ),
            vad = vad,
            numThreads = Opts.int(data, "numThreads", 2, 1..8),
            decodingMethod = decodingOpt(data),
            audioSource = AudioCapture.sourceOf(data.opt("audioSource")?.takeIf { it != JSONObject.NULL }?.let { it as? String ?: throw SttException("INVALID_ARGUMENT", "audioSource") }),
        )
    }

    private fun decodingOpt(data: JSONObject): String {
        val m = Opts.str(data, "decodingMethod", "greedy_search")
        if (m != "greedy_search" && m != "modified_beam_search") throw SttException("INVALID_ARGUMENT", "decodingMethod")
        return m
    }

    companion object {
        const val VERSION = "0.1.0"
        const val MIC = "recordAudio"
        private const val WAV_TTL_MS = 10 * 60 * 1000L
        private val WAV_NAME = Regex("^[0-9a-f]{32}(-\\d{1,4})?\\.wav$")
    }
}
