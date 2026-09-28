package com.miraclepenguin.kaiwa.sherpastt

import java.io.ByteArrayOutputStream
import java.io.Closeable
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URI
import java.util.concurrent.atomic.AtomicBoolean

internal fun interface NetworkGate {
    /** 지금 받아도 되면 null, 아니면 오류 코드(`OFFLINE`·`NETWORK_NOT_ALLOWED`). */
    fun check(wifiOnly: Boolean): String?
}

internal data class DownloadProgress(
    val version: String,
    val fileIndex: Int,
    val fileCount: Int,
    val received: Long,
    val total: Long,
    val totalReceived: Long,
    val totalBytes: Long,
)

internal data class DownloadResult(val version: String, val bytes: Long, val alreadyInstalled: Boolean)

internal data class DownloadRequest(
    val manifestUrl: String,
    val wifiOnly: Boolean = true,
    val expectedVersion: String? = null,
    val allowDowngrade: Boolean = false,
)

/** HTTP 응답 한 건. 리다이렉트는 따라가지 않은 날것(3xx 도 그대로). */
internal interface HttpResponse : Closeable {
    val status: Int
    val contentLength: Long
    fun header(name: String): String?
    fun body(): InputStream
}

/** 전송 계층 — 실제는 [UrlConnectionTransport], 단위 테스트는 가짜(Range·끊김·리다이렉트 흉내). */
internal fun interface HttpTransport {
    @Throws(IOException::class)
    fun get(url: URI, headers: Map<String, String>): HttpResponse
}

internal class UrlConnectionTransport : HttpTransport {
    override fun get(url: URI, headers: Map<String, String>): HttpResponse {
        val conn = (url.toURL().openConnection() as HttpURLConnection).apply {
            instanceFollowRedirects = false
            connectTimeout = 15_000
            readTimeout = 30_000
            useCaches = false
            headers.forEach { (k, v) -> setRequestProperty(k, v) }
        }
        val status = try {
            conn.responseCode
        } catch (e: IOException) {
            conn.disconnect()
            throw e
        }
        return object : HttpResponse {
            override val status = status
            override val contentLength = conn.contentLengthLong
            override fun header(name: String): String? = conn.getHeaderField(name)
            override fun body(): InputStream = conn.inputStream
            override fun close() = conn.disconnect()
        }
    }
}

/**
 * manifest → 파일별 Range 이어받기(`.part`) → sha256 → 임시 디렉터리 → 원자적 전환 → 옛 버전 정리
 * (plugins/sherpa-stt/README §5 · speech/models/README §3·§4 · task-003f C1-3).
 *
 * - URL 은 [OriginPolicy] 로 같은 origin https 만, 리다이렉트는 같은 origin 으로만 [MAX_REDIRECTS] 번.
 *   파일 주소는 manifest 의 `url`·`baseUrl` 을 믿지 않고 `<manifest 디렉터리>/<version>/<path>` 로 직접 만든다.
 * - 파일 하나가 [MAX_ATTEMPTS] 번 틀리면 그 버전의 임시 디렉터리를 통째로 버린다.
 * - 과금 네트워크로 바뀌면(wifiOnly) 도중에 멈춘다 — 받은 조각은 남아 다음에 이어받는다. 취소도 같다.
 * 한 인스턴스는 다운로드 1회용이다(취소 플래그를 되돌리지 않는다).
 */
internal class ModelDownloader(
    private val store: ModelStore,
    private val origin: OriginPolicy,
    private val network: NetworkGate,
    private val usableSpace: () -> Long,
    private val userAgent: String,
    private val pluginVersion: String,
    private val transport: HttpTransport = UrlConnectionTransport(),
    private val nowNanos: () -> Long = System::nanoTime,
    private val retryBaseMs: Long = 1000L,
) {
    private val cancelled = AtomicBoolean(false)

    fun cancel() = cancelled.set(true)

    @Throws(SttException::class)
    fun download(req: DownloadRequest, onProgress: (DownloadProgress) -> Unit): DownloadResult {
        val manifestUri = origin.check(req.manifestUrl)
        if (!MANIFEST_PATH.matches(manifestUri.rawPath ?: "") || manifestUri.rawQuery != null) {
            throw SttException("ORIGIN_NOT_ALLOWED", "manifest url must be /models/<id>/manifest.json")
        }
        network.check(req.wifiOnly)?.let { throw SttException(it, "network not allowed") }

        val manifest = ManifestValidator.parse(fetchManifest(manifestUri), pluginVersion)
        if (req.expectedVersion != null && req.expectedVersion != manifest.version) {
            throw SttException("DOWNLOAD_FAILED", "manifest version differs from expected")
        }
        val installed = store.current()
        if (installed != null) {
            val cmp = VersionOrder.compare(manifest.version, installed.version)
            if (cmp == 0 && !req.allowDowngrade) return DownloadResult(installed.version, installed.totalBytes, true)
            if (cmp < 0 && !req.allowDowngrade) throw SttException("DOWNGRADE_REFUSED", "manifest version is older than installed")
        }

        store.root.mkdirs()
        store.dropOtherTmp(manifest.version)
        val tmp = store.tmpDir(manifest.version)
        if (!tmp.isDirectory && !tmp.mkdirs()) throw SttException("DOWNLOAD_FAILED", "cannot create temp dir")
        val have = tmp.listFiles()?.sumOf { it.length() } ?: 0L
        if (usableSpace() + have < (manifest.totalBytes * SPACE_FACTOR).toLong()) {
            throw SttException("INSUFFICIENT_STORAGE", "not enough free space")
        }

        var done = 0L
        val count = manifest.files.size
        manifest.files.forEachIndexed { i, f ->
            checkRunning(req.wifiOnly)
            fetchVerified(manifestUri, manifest.version, i, f, tmp, req.wifiOnly) { received ->
                onProgress(DownloadProgress(manifest.version, i, count, received, f.bytes, done + received, manifest.totalBytes))
            }
            done += f.bytes
        }
        val model = try {
            store.commit(tmp, manifest)
        } catch (e: IOException) {
            throw SttException("DOWNLOAD_FAILED", "install failed: ${e.message}")
        }
        return DownloadResult(model.version, model.totalBytes, false)
    }

    private fun checkRunning(wifiOnly: Boolean) {
        if (cancelled.get()) throw SttException("DOWNLOAD_CANCELLED", "cancelled")
        network.check(wifiOnly)?.let { throw SttException(it, "network changed") }
    }

    private fun fetchVerified(base: URI, version: String, index: Int, f: ManifestFile, tmp: File, wifiOnly: Boolean, progress: (Long) -> Unit) {
        val target = File(tmp, f.path)
        if (target.isFile && target.length() == f.bytes && ModelStore.sha256(target) == f.sha256) {
            progress(f.bytes)
            return
        }
        target.delete()
        val url = origin.fileUrl(base, version, f.path)
        var lastError = "unknown"
        var integrityFailures = 0
        for (attempt in 1..MAX_ATTEMPTS) {
            try {
                fetchToPart(url, target, f.bytes, wifiOnly, progress)
                if (ModelStore.sha256(target) == f.sha256) return
                lastError = "sha256 mismatch"
            } catch (e: SttException) {
                // 취소·네트워크 정책·origin 위반은 재시도하지 않고 조각을 남긴다(다음에 이어받기).
                if (e.code != "DOWNLOAD_FAILED") throw e
                lastError = e.message ?: "download failed"
            } catch (e: IOException) {
                // 끊김 — 받은 조각은 그대로 두고 잠시 뒤 이어받는다. 끝내 안 되면 조각을 남긴 채 실패(다음 호출이 이어받음).
                lastError = e.message?.takeIf { it.startsWith("http ") } ?: e.javaClass.simpleName
                backoff(attempt)
                continue
            }
            integrityFailures++
            target.delete()
            File(tmp, f.path + ".part").delete()
        }
        // 내용이 틀린 것(sha256·크기·Range 응답)이 매번이면 이 버전 조각을 통째로 버린다(README §5).
        if (integrityFailures == MAX_ATTEMPTS) tmp.deleteRecursively()
        throw SttException("DOWNLOAD_FAILED", "file ${index + 1} failed after $MAX_ATTEMPTS attempts: $lastError")
    }

    private fun backoff(attempt: Int) {
        if (attempt >= MAX_ATTEMPTS) return
        val until = nowNanos() + retryBaseMs * attempt * 1_000_000
        while (nowNanos() < until) {
            if (cancelled.get()) throw SttException("DOWNLOAD_CANCELLED", "cancelled")
            try {
                Thread.sleep(50)
            } catch (e: InterruptedException) {
                Thread.currentThread().interrupt()
                throw SttException("DOWNLOAD_CANCELLED", "interrupted")
            }
        }
    }

    private fun fetchToPart(url: URI, target: File, expected: Long, wifiOnly: Boolean, progress: (Long) -> Unit) {
        val part = File(target.parentFile, target.name + ".part")
        var have = RangeResume.startOffset(if (part.isFile) part.length() else 0L, expected)
        if (have < 0) {
            part.delete()
            have = 0
        }
        if (have == expected) {
            finishPart(part, target, expected)
            return
        }
        open(url, RangeResume.header(have, expected)).use { res ->
            // 404·5xx 는 내용이 틀린 것이 아니다 — 끊김처럼 다루어 조각을 남긴다(다음에 이어받기).
            if (res.status != 200 && res.status != 206 && res.status != 416) throw IOException("http ${res.status}")
            when (val d = RangeResume.decide(have, expected, res.status, res.header("Content-Range"), res.contentLength)) {
                is RangeDecision.Fail -> throw SttException("DOWNLOAD_FAILED", d.reason)
                RangeDecision.Complete -> {
                    finishPart(part, target, expected)
                    return
                }
                RangeDecision.Restart -> have = 0
                RangeDecision.Append -> Unit
            }
            res.body().use { input -> copy(input, part, have, expected, wifiOnly, progress) }
        }
        finishPart(part, target, expected)
    }

    private fun finishPart(part: File, target: File, expected: Long) {
        if (part.length() != expected) throw SttException("DOWNLOAD_FAILED", "size mismatch")
        if (!part.renameTo(target)) throw SttException("DOWNLOAD_FAILED", "rename failed")
    }

    private fun copy(input: InputStream, part: File, start: Long, expected: Long, wifiOnly: Boolean, progress: (Long) -> Unit) {
        var have = start
        var lastEmit = 0L
        var sinceCheck = 0L
        FileOutputStream(part, start > 0).use { out ->
            val buf = ByteArray(1 shl 16)
            while (true) {
                if (cancelled.get()) throw SttException("DOWNLOAD_CANCELLED", "cancelled")
                val n = input.read(buf)
                if (n < 0) break
                if (have + n > expected) throw SttException("DOWNLOAD_FAILED", "more bytes than expected")
                out.write(buf, 0, n)
                have += n
                sinceCheck += n
                if (sinceCheck >= NET_RECHECK_BYTES) {
                    sinceCheck = 0
                    out.flush()
                    network.check(wifiOnly)?.let { throw SttException(it, "network changed") }
                }
                val now = nowNanos()
                if (now - lastEmit >= PROGRESS_INTERVAL_NS) {
                    lastEmit = now
                    progress(have)
                }
            }
        }
        progress(have)
    }

    private fun fetchManifest(url: URI): String {
        try {
            open(url, null, noCache = true).use { res ->
                if (res.status != 200) throw SttException("DOWNLOAD_FAILED", "manifest http ${res.status}")
                if (res.contentLength > ManifestValidator.MAX_MANIFEST_BYTES) throw SttException("MANIFEST_INVALID", "manifest too large")
                val bytes = res.body().use { it.readUpTo(ManifestValidator.MAX_MANIFEST_BYTES + 1) }
                if (bytes.size > ManifestValidator.MAX_MANIFEST_BYTES) throw SttException("MANIFEST_INVALID", "manifest too large")
                return String(bytes, Charsets.UTF_8)
            }
        } catch (e: IOException) {
            throw SttException("DOWNLOAD_FAILED", "manifest fetch failed: ${e.javaClass.simpleName}")
        }
    }

    /** 리다이렉트는 손으로 따라간다 — 같은 origin https 가 아니면 `ORIGIN_NOT_ALLOWED`. */
    @Throws(IOException::class)
    private fun open(start: URI, range: String?, noCache: Boolean = false): HttpResponse {
        val headers = LinkedHashMap<String, String>()
        headers["User-Agent"] = userAgent
        // gzip 이면 Content-Length·Range 가 압축본 기준이 된다.
        headers["Accept-Encoding"] = "identity"
        if (noCache) headers["Cache-Control"] = "no-cache"
        if (range != null) headers["Range"] = range
        var url = start
        repeat(MAX_REDIRECTS + 1) {
            val res = transport.get(url, headers)
            if (res.status !in 300..399 || res.status == 304) return res
            val location = res.header("Location")
            res.close()
            if (location.isNullOrEmpty()) throw SttException("DOWNLOAD_FAILED", "redirect without location")
            url = origin.check(url.resolve(location).toString())
        }
        throw SttException("DOWNLOAD_FAILED", "too many redirects")
    }

    companion object {
        const val MAX_ATTEMPTS = 3
        const val MAX_REDIRECTS = 3
        const val SPACE_FACTOR = 2.5
        const val NET_RECHECK_BYTES = 8L * 1024 * 1024
        const val PROGRESS_INTERVAL_NS = 250_000_000L
        val MANIFEST_PATH = Regex("^/models/[A-Za-z0-9][A-Za-z0-9._-]{0,63}/manifest\\.json$")
    }
}

/** `InputStream.readNBytes` 는 API 33+ — 상한까지만 읽는다. */
internal fun InputStream.readUpTo(limit: Int): ByteArray {
    val out = ByteArrayOutputStream()
    val buf = ByteArray(8192)
    var total = 0
    while (total < limit) {
        val n = read(buf, 0, minOf(buf.size, limit - total))
        if (n < 0) break
        out.write(buf, 0, n)
        total += n
    }
    return out.toByteArray()
}
