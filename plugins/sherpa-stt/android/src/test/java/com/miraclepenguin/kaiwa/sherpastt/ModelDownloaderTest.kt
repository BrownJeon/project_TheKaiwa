package com.miraclepenguin.kaiwa.sherpastt

import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.net.URI
import java.security.MessageDigest
import kotlin.random.Random

private const val ORIGIN = "https://kaiwa.example.com"
private const val MANIFEST_URL = "$ORIGIN/models/ondevice-ja-v1/manifest.json"
private val ROLES = listOf("encoder", "decoder", "joiner", "tokens", "vad")

private fun sha(b: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(b).joinToString("") { "%02x".format(it) }

/** 작은 가짜 모델 한 벌(파일 5개). */
private class FakeModel(val version: String, seed: Int) {
    val files: Map<String, ByteArray> = ROLES.mapIndexed { i, r -> "$r-$i.bin" to Random(seed * 10 + i).nextBytes(1000 + i * 700) }.toMap()

    fun manifest(minPlugin: String = "0.1.0"): String {
        val arr = JSONArray()
        files.entries.forEachIndexed { i, (p, b) -> arr.put(JSONObject().put("path", p).put("sha256", sha(b)).put("bytes", b.size).put("role", ROLES[i])) }
        return JSONObject()
            .put("id", "ondevice-ja-v1").put("name", "reazonspeech-int8").put("version", version)
            .put("engine", "sherpa-onnx").put("modelType", "transducer").put("sampleRate", 16000)
            .put("minPluginVersion", minPlugin).put("files", arr).put("totalBytes", files.values.sumOf { it.size })
            .toString()
    }
}

private class Res(override val status: Int, private val bytes: ByteArray, private val headers: Map<String, String> = emptyMap(), private val failAfter: Int = -1) : HttpResponse {
    override val contentLength: Long = bytes.size.toLong()
    override fun header(name: String): String? = headers[name]
    override fun body(): InputStream = if (failAfter < 0) ByteArrayInputStream(bytes) else CutStream(bytes, failAfter)
    override fun close() {}
}

/** `failAfter` 바이트를 준 뒤 끊기는 스트림(네트워크 끊김 흉내). */
private class CutStream(private val b: ByteArray, private val cut: Int) : InputStream() {
    private var pos = 0
    override fun read(): Int {
        if (pos >= cut) throw IOException("connection reset")
        return if (pos < b.size) b[pos++].toInt() and 0xff else -1
    }

    override fun read(buf: ByteArray, off: Int, len: Int): Int {
        if (pos >= cut) throw IOException("connection reset")
        if (pos >= b.size) return -1
        val n = minOf(len, cut - pos, b.size - pos)
        System.arraycopy(b, pos, buf, off, n)
        pos += n
        return n
    }
}

/** 경로별 내용 + Range 를 흉내 내는 서버. 요청 기록을 남긴다. */
private class FakeServer : HttpTransport {
    val routes = HashMap<String, ByteArray>()
    val requests = ArrayList<Pair<String, String?>>()
    var cutOnce = HashMap<String, Int>() // 경로 → 첫 응답만 이 바이트에서 끊음
    var corrupt = HashSet<String>() // 늘 틀린 내용
    var redirect: Pair<String, String>? = null
    var ignoreRange = false

    fun serve(m: FakeModel) {
        routes["/models/ondevice-ja-v1/manifest.json"] = m.manifest().toByteArray()
        m.files.forEach { (p, b) -> routes["/models/ondevice-ja-v1/${m.version}/$p"] = b }
    }

    override fun get(url: URI, headers: Map<String, String>): HttpResponse {
        val path = url.rawPath
        val range = headers["Range"]
        requests.add(path to range)
        redirect?.let { (from, to) -> if (path == from) return Res(302, ByteArray(0), mapOf("Location" to to)) }
        var body = routes[path] ?: return Res(404, ByteArray(0))
        if (path in corrupt) body = body.copyOf().also { it[0] = (it[0] + 1).toByte() }
        val cut = cutOnce.remove(path) ?: -1
        if (range != null && !ignoreRange) {
            val start = range.removePrefix("bytes=").removeSuffix("-").toInt()
            val part = body.copyOfRange(start, body.size)
            return Res(206, part, mapOf("Content-Range" to "bytes $start-${body.size - 1}/${body.size}"), if (cut >= 0) cut else -1)
        }
        return Res(200, body, emptyMap(), cut)
    }
}

class ModelDownloaderTest {
    private lateinit var dir: File
    private lateinit var store: ModelStore
    private val server = FakeServer()
    private var net: String? = null
    private var space = Long.MAX_VALUE / 4
    private val progress = ArrayList<DownloadProgress>()

    @Before
    fun setUp() {
        dir = createTempDirectory()
        store = ModelStore(File(dir, "models/stt"), "0.1.0")
    }

    @After
    fun tearDown() {
        dir.deleteRecursively()
    }

    private fun downloader(plugin: String = "0.1.0") =
        ModelDownloader(store, OriginPolicy(ORIGIN), { net }, { space }, "test", plugin, server, retryBaseMs = 1)

    private fun download(req: DownloadRequest = DownloadRequest(MANIFEST_URL), d: ModelDownloader = downloader()) = d.download(req) { progress.add(it) }

    private fun failCode(req: DownloadRequest = DownloadRequest(MANIFEST_URL), d: ModelDownloader = downloader()): String =
        assertThrows(SttException::class.java) { download(req, d) }.code

    @Test
    fun installsVerifiedModelAtomically() {
        val m = FakeModel("2024-08-01-int8-v1", 1)
        server.serve(m)
        val r = download()
        assertEquals(DownloadResult("2024-08-01-int8-v1", m.files.values.sumOf { it.size }.toLong(), false), r)
        val installed = store.current()!!
        assertEquals("2024-08-01-int8-v1", installed.version)
        m.files.forEach { (p, b) -> assertArrayEquals(b, File(installed.dir, p).readBytes()) }
        assertTrue(store.verify(installed))
        assertNull(store.pending()) // 임시 디렉터리 없음
        assertEquals(m.files.values.sumOf { it.size }.toLong(), progress.last().totalReceived)
        assertEquals(4, progress.last().fileIndex)
        // manifest 는 no-cache 로, 파일은 manifest 옆 <version>/<path> 에서
        assertEquals("/models/ondevice-ja-v1/2024-08-01-int8-v1/encoder-0.bin", server.requests[1].first)
    }

    @Test
    fun resumesInterruptedFileWithRange() {
        val m = FakeModel("2024-08-01-int8-v1", 2)
        server.serve(m)
        val encPath = "/models/ondevice-ja-v1/2024-08-01-int8-v1/encoder-0.bin"
        server.cutOnce[encPath] = 600
        download()
        val encRequests = server.requests.filter { it.first == encPath }
        assertEquals(listOf(encPath to null, encPath to "bytes=600-"), encRequests)
        assertTrue(store.verify(store.current()!!))
    }

    @Test
    fun resumesAcrossCallsAfterNetworkLoss() {
        val m = FakeModel("2024-08-01-int8-v1", 3)
        server.serve(m)
        val decPath = "/models/ondevice-ja-v1/2024-08-01-int8-v1/decoder-1.bin"
        server.routes.remove(decPath)
        // 첫 파일은 받고, 두 번째는 서버가 없는 것처럼(404 → DOWNLOAD_FAILED 3회 — 내용이 틀린 게 아니다)
        assertEquals("DOWNLOAD_FAILED", failCode())
        server.serve(m)
        server.requests.clear()
        download()
        // 이미 받은 첫 파일은 다시 받지 않는다(sha256 확인 후 건너뜀)
        assertFalse(server.requests.any { it.first.endsWith("encoder-0.bin") })
        assertNotNull(store.current())
    }

    @Test
    fun discardsVersionAfterThreeChecksumFailures() {
        val m = FakeModel("2024-08-01-int8-v1", 4)
        server.serve(m)
        server.corrupt.add("/models/ondevice-ja-v1/2024-08-01-int8-v1/joiner-2.bin")
        assertEquals("DOWNLOAD_FAILED", failCode())
        assertEquals(3, server.requests.count { it.first.endsWith("joiner-2.bin") })
        assertNull(store.pending()) // .tmp 폐기
        assertNull(store.current())
    }

    @Test
    fun serverIgnoringRangeRestartsFromZero() {
        val m = FakeModel("2024-08-01-int8-v1", 5)
        server.serve(m)
        server.ignoreRange = true
        server.cutOnce["/models/ondevice-ja-v1/2024-08-01-int8-v1/encoder-0.bin"] = 300
        download()
        assertTrue(store.verify(store.current()!!))
    }

    @Test
    fun refusesDowngradeUnlessExplicit() {
        server.serve(FakeModel("2024-08-01-int8-v2", 6))
        download()
        server.serve(FakeModel("2024-08-01-int8-v1", 7))
        assertEquals("DOWNGRADE_REFUSED", failCode())
        assertEquals("2024-08-01-int8-v2", store.current()!!.version)
        download(DownloadRequest(MANIFEST_URL, allowDowngrade = true))
        assertEquals("2024-08-01-int8-v1", store.current()!!.version)
        assertEquals(1, store.root.listFiles()!!.count { it.isDirectory }) // 옛 버전 정리
    }

    @Test
    fun sameVersionIsAlreadyInstalled() {
        server.serve(FakeModel("2024-08-01-int8-v1", 8))
        download()
        server.requests.clear()
        val r = download()
        assertTrue(r.alreadyInstalled)
        assertEquals(1, server.requests.size) // manifest 만
    }

    @Test
    fun upgradesAndRemovesOldVersion() {
        server.serve(FakeModel("2024-08-01-int8-v1", 9))
        download()
        server.serve(FakeModel("2024-08-01-int8-v2", 10))
        assertFalse(download().alreadyInstalled)
        assertEquals(listOf("2024-08-01-int8-v2"), store.root.listFiles()!!.filter { it.isDirectory }.map { it.name })
    }

    @Test
    fun rejectsForeignManifestUrlsAndRedirects() {
        server.serve(FakeModel("2024-08-01-int8-v1", 11))
        assertEquals("ORIGIN_NOT_ALLOWED", failCode(DownloadRequest("https://evil.example.com/models/x/manifest.json")))
        assertEquals("ORIGIN_NOT_ALLOWED", failCode(DownloadRequest("http://kaiwa.example.com/models/x/manifest.json")))
        assertEquals("ORIGIN_NOT_ALLOWED", failCode(DownloadRequest("$ORIGIN/api/v1/me")))
        assertEquals("ORIGIN_NOT_ALLOWED", failCode(DownloadRequest("$MANIFEST_URL?x=1")))
        server.redirect = "/models/ondevice-ja-v1/2024-08-01-int8-v1/encoder-0.bin" to "https://cdn.evil.com/encoder.bin"
        assertEquals("ORIGIN_NOT_ALLOWED", failCode())
        assertTrue(server.requests.none { it.first.contains("evil") })
    }

    @Test
    fun followsSameOriginRedirect() {
        val m = FakeModel("2024-08-01-int8-v1", 12)
        server.serve(m)
        server.routes["/moved/manifest.json"] = m.manifest().toByteArray()
        server.redirect = "/models/ondevice-ja-v1/manifest.json" to "/moved/manifest.json"
        download()
        assertNotNull(store.current())
    }

    @Test
    fun honoursNetworkPolicyAndExpectedVersion() {
        server.serve(FakeModel("2024-08-01-int8-v1", 13))
        net = "NETWORK_NOT_ALLOWED"
        assertEquals("NETWORK_NOT_ALLOWED", failCode())
        assertTrue(server.requests.isEmpty())
        net = null
        assertEquals("DOWNLOAD_FAILED", failCode(DownloadRequest(MANIFEST_URL, expectedVersion = "2024-08-01-int8-v9")))
    }

    @Test
    fun checksStorageAndPluginVersion() {
        val m = FakeModel("2024-08-01-int8-v1", 14)
        server.serve(m)
        space = (m.files.values.sumOf { it.size } * 2L)
        assertEquals("INSUFFICIENT_STORAGE", failCode())
        space = Long.MAX_VALUE / 4
        server.routes["/models/ondevice-ja-v1/manifest.json"] = m.manifest(minPlugin = "9.0.0").toByteArray()
        assertEquals("APP_UPDATE_REQUIRED", failCode())
    }

    @Test
    fun cancelKeepsPartialForLater() {
        val m = FakeModel("2024-08-01-int8-v1", 15)
        server.serve(m)
        val d = downloader()
        var cancelledAt = -1
        val code = assertThrows(SttException::class.java) {
            d.download(DownloadRequest(MANIFEST_URL)) { p ->
                if (p.fileIndex == 2 && cancelledAt < 0) {
                    cancelledAt = p.fileIndex
                    d.cancel()
                }
            }
        }.code
        assertEquals("DOWNLOAD_CANCELLED", code)
        val pending = store.pending()!!
        assertEquals("2024-08-01-int8-v1", pending.first)
        assertTrue(pending.second > 0)
        download() // 새 인스턴스로 이어받는다
        assertTrue(store.verify(store.current()!!))
    }
}

class ModelStoreTest {
    private lateinit var dir: File

    @Before
    fun setUp() {
        dir = createTempDirectory()
    }

    @After
    fun tearDown() {
        dir.deleteRecursively()
    }

    private fun stage(store: ModelStore, m: FakeModel): ModelManifest {
        val manifest = ManifestValidator.parse(m.manifest(), "0.1.0")
        val tmp = store.tmpDir(m.version).apply { mkdirs() }
        m.files.forEach { (p, b) -> File(tmp, p).writeBytes(b) }
        return manifest
    }

    @Test
    fun commitMakesCurrentAndVerifyCatchesCorruption() {
        val store = ModelStore(File(dir, "stt"), "0.1.0")
        assertNull(store.current())
        val m = FakeModel("2024-08-01-int8-v1", 21)
        val installed = store.commit(store.tmpDir(m.version).also { stage(store, m) }, ManifestValidator.parse(m.manifest(), "0.1.0"))
        assertEquals(installed, store.current())
        assertTrue(File(installed.dir, ManifestValidator.INDEX_FILE).isFile)

        // 같은 크기, 다른 내용 → 크기 검사는 통과하지만 verify 가 잡고 지운다
        val enc = installed.path("encoder")
        enc.writeBytes(enc.readBytes().also { it[0] = (it[0] + 1).toByte() })
        assertNotNull(store.current())
        assertFalse(store.verify(installed))
        assertNull(store.current())
    }

    @Test
    fun ignoresTamperedIndexAndMissingFiles() {
        val store = ModelStore(File(dir, "stt"), "0.1.0")
        val m = FakeModel("2024-08-01-int8-v1", 22)
        val installed = store.commit(store.tmpDir(m.version).also { stage(store, m) }, ManifestValidator.parse(m.manifest(), "0.1.0"))
        installed.path("tokens").delete()
        assertNull(store.current())

        val m2 = FakeModel("2024-08-01-int8-v2", 23)
        val inst2 = store.commit(store.tmpDir(m2.version).also { stage(store, m2) }, ManifestValidator.parse(m2.manifest(), "0.1.0"))
        File(inst2.dir, ManifestValidator.INDEX_FILE).writeText("{\"version\":\"../x\"}")
        assertNull(store.current())
    }

    @Test
    fun refusesIncompleteCommit() {
        val store = ModelStore(File(dir, "stt"), "0.1.0")
        val m = FakeModel("2024-08-01-int8-v1", 24)
        val manifest = stage(store, m)
        File(store.tmpDir(m.version), m.files.keys.first()).delete()
        assertThrows(IOException::class.java) { store.commit(store.tmpDir(m.version), manifest) }
        assertNull(store.current())
    }
}
