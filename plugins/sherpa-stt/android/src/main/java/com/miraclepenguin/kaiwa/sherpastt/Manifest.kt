package com.miraclepenguin.kaiwa.sherpastt

import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import org.json.JSONTokener
import java.net.URI
import java.net.URISyntaxException
import java.util.Locale

internal data class ManifestFile(val path: String, val sha256: String, val bytes: Long, val role: String)

internal data class ModelManifest(
    val name: String,
    val version: String,
    val files: List<ManifestFile>,
    val totalBytes: Long,
    val minPluginVersion: String?,
) {
    fun file(role: String): ManifestFile = files.first { it.role == role }

    fun toJson(): JSONObject = JSONObject().apply {
        put("name", name)
        put("version", version)
        put("engine", ManifestValidator.ENGINE)
        put("modelType", ManifestValidator.MODEL_TYPE)
        put("sampleRate", Audio.SAMPLE_RATE)
        put("totalBytes", totalBytes)
        if (minPluginVersion != null) put("minPluginVersion", minPluginVersion)
        put(
            "files",
            JSONArray().apply {
                for (f in files) {
                    put(JSONObject().put("path", f.path).put("sha256", f.sha256).put("bytes", f.bytes).put("role", f.role))
                }
            },
        )
    }
}

/**
 * 모델 manifest 엄격 검증(speech/models/README §3 + task-003f C1-3).
 * 서명은 두지 않는다(Leader 판정: WebView 가 같은 서버에서 UI 전체를 받으므로 서버 침해 시 서명과 무관) —
 * 대신 같은 origin https·스키마·크기 상한·파일별 sha256·다운그레이드 금지로 막는다.
 * 설치 인덱스(`installed.json`)도 같은 검증을 다시 거친다(디스크 손상·변조 대비).
 */
internal object ManifestValidator {
    const val ENGINE = "sherpa-onnx"
    const val MODEL_TYPE = "transducer"
    const val MAX_MANIFEST_BYTES = 64 * 1024
    const val MAX_TOTAL_BYTES = 300L * 1024 * 1024
    const val MAX_FILES = 16
    const val INDEX_FILE = "installed.json"
    val ROLES = setOf("encoder", "decoder", "joiner", "tokens", "vad")

    private val NAME_RE = Regex("^[a-z0-9][a-z0-9._-]{0,63}$")

    // 첫 글자를 영숫자로 강제한다 — 임시 디렉터리(`.tmp-*`)·`.`/`..` 와 겹치지 않게.
    private val VERSION_RE = Regex("^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$")
    private val FILE_RE = Regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
    private val SHA_RE = Regex("^[0-9a-f]{64}$")
    private val SEMVER_RE = Regex("^(\\d{1,4})\\.(\\d{1,4})\\.(\\d{1,4})$")

    fun isValidVersion(v: String): Boolean = VERSION_RE.matches(v)

    @Throws(SttException::class)
    fun parse(text: String, pluginVersion: String): ModelManifest {
        if (text.length > MAX_MANIFEST_BYTES) invalid("manifest too large")
        val root = try {
            JSONTokener(text).nextValue() as? JSONObject ?: invalid("manifest is not an object")
        } catch (e: JSONException) {
            invalid("manifest is not valid json")
        }
        val name = str(root, "name")
        val version = str(root, "version")
        if (!NAME_RE.matches(name)) invalid("name")
        if (!VERSION_RE.matches(version)) invalid("version")
        if (str(root, "engine") != ENGINE) invalid("engine")
        if (str(root, "modelType") != MODEL_TYPE) invalid("modelType")
        if (int(root, "sampleRate") != Audio.SAMPLE_RATE.toLong()) invalid("sampleRate")

        val arr = root.opt("files") as? JSONArray ?: invalid("files")
        if (arr.length() < ROLES.size || arr.length() > MAX_FILES) invalid("files count")
        val files = ArrayList<ManifestFile>(arr.length())
        val paths = HashSet<String>()
        val roles = HashSet<String>()
        for (i in 0 until arr.length()) {
            val o = arr.opt(i) as? JSONObject ?: invalid("files[$i]")
            val path = str(o, "path")
            if (!FILE_RE.matches(path) || path.contains("..") || path == INDEX_FILE || path.endsWith(".part")) {
                invalid("files[$i].path")
            }
            val sha = str(o, "sha256").lowercase(Locale.ROOT)
            if (!SHA_RE.matches(sha)) invalid("files[$i].sha256")
            val bytes = int(o, "bytes")
            if (bytes <= 0 || bytes > MAX_TOTAL_BYTES) invalid("files[$i].bytes")
            val role = str(o, "role")
            if (role !in ROLES) invalid("files[$i].role")
            if (!paths.add(path)) invalid("duplicate path")
            if (!roles.add(role)) invalid("duplicate role")
            files.add(ManifestFile(path, sha, bytes, role))
        }
        if (roles != ROLES) invalid("missing roles")
        val sum = files.sumOf { it.bytes }
        if (sum > MAX_TOTAL_BYTES) invalid("total too large")
        if (int(root, "totalBytes") != sum) invalid("totalBytes mismatch")

        val minPlugin = root.opt("minPluginVersion")?.let { v ->
            if (v == JSONObject.NULL) {
                null
            } else {
                val s = v as? String ?: invalid("minPluginVersion")
                if (!SEMVER_RE.matches(s)) invalid("minPluginVersion")
                s
            }
        }
        if (minPlugin != null && compareSemver(pluginVersion, minPlugin) < 0) {
            throw SttException("APP_UPDATE_REQUIRED", "plugin $pluginVersion < required $minPlugin")
        }
        return ModelManifest(name, version, files, sum, minPlugin)
    }

    fun compareSemver(a: String, b: String): Int {
        val pa = SEMVER_RE.matchEntire(a)?.destructured?.toList()?.map { it.toInt() } ?: return -1
        val pb = SEMVER_RE.matchEntire(b)?.destructured?.toList()?.map { it.toInt() } ?: return 1
        for (i in 0..2) {
            val c = pa[i].compareTo(pb[i])
            if (c != 0) return c
        }
        return 0
    }

    private fun str(o: JSONObject, key: String): String = o.opt(key) as? String ?: invalid(key)

    /** org.json 의 `getLong` 은 문자열·실수도 받아 준다 — 정수 타입만 허용한다. */
    private fun int(o: JSONObject, key: String): Long = when (val v = o.opt(key)) {
        is Int -> v.toLong()
        is Long -> v
        else -> invalid(key)
    }

    private fun invalid(what: String): Nothing = throw SttException("MANIFEST_INVALID", "manifest $what invalid")
}

/**
 * 버전 순서 — 숫자 덩어리는 수로, 나머지는 문자로 비교한다(자연 정렬).
 * `2024-08-01-int8-v1` < `2024-08-01-int8-v2` < `2024-08-01-int8-v10` < `2025-01-01-int8-v1`.
 */
internal object VersionOrder : Comparator<String> {
    private val TOKEN = Regex("\\d+|\\D+")

    override fun compare(a: String, b: String): Int {
        val ta = TOKEN.findAll(a).map { it.value }.toList()
        val tb = TOKEN.findAll(b).map { it.value }.toList()
        for (i in 0 until minOf(ta.size, tb.size)) {
            val x = ta[i]
            val y = tb[i]
            val c = if (x[0].isDigit() && y[0].isDigit()) {
                val nx = x.trimStart('0')
                val ny = y.trimStart('0')
                if (nx.length != ny.length) nx.length.compareTo(ny.length) else nx.compareTo(ny)
            } else {
                x.compareTo(y)
            }
            if (c != 0) return c
        }
        return ta.size.compareTo(tb.size)
    }
}

/** 모델 URL 은 앱 `server.url` 과 같은 origin 의 https 만(C1-3 ①). */
internal class OriginPolicy(serverUrl: String) {
    private val host: String
    private val port: Int

    init {
        val u = try {
            URI(serverUrl)
        } catch (e: URISyntaxException) {
            throw IllegalArgumentException("server url")
        }
        require(u.scheme.equals("https", ignoreCase = true) && !u.host.isNullOrEmpty()) { "server url must be https" }
        host = u.host.lowercase(Locale.ROOT)
        port = effectivePort(u)
    }

    @Throws(SttException::class)
    fun check(url: String): URI {
        val u = try {
            URI(url)
        } catch (e: URISyntaxException) {
            throw SttException("ORIGIN_NOT_ALLOWED", "url is not valid")
        }
        val ok = u.isAbsolute &&
            u.scheme.equals("https", ignoreCase = true) &&
            u.rawUserInfo == null &&
            u.rawFragment == null &&
            u.host?.lowercase(Locale.ROOT) == host &&
            effectivePort(u) == port
        if (!ok) throw SttException("ORIGIN_NOT_ALLOWED", "url must be same-origin https")
        return u
    }

    /** manifest 옆 `<version>/<path>` — 두 성분 모두 검증을 통과한 값만 들어온다. */
    fun fileUrl(manifestUrl: URI, version: String, path: String): URI {
        require(ManifestValidator.isValidVersion(version))
        val resolved = manifestUrl.resolve("$version/$path")
        return check(resolved.toString())
    }

    private fun effectivePort(u: URI): Int = if (u.port == -1) 443 else u.port
}

/** HTTP Range 이어받기 판정(순수 함수 — 단위 테스트 대상). */
internal sealed class RangeDecision {
    /** 206 이 우리가 가진 끝에서 이어 준다 → 이어 쓴다. */
    object Append : RangeDecision()

    /** 200(전체) → 처음부터 다시 쓴다. */
    object Restart : RangeDecision()

    /** 416 인데 이미 다 받았다. */
    object Complete : RangeDecision()

    data class Fail(val reason: String) : RangeDecision()
}

internal object RangeResume {
    private val CONTENT_RANGE = Regex("^bytes (\\d+)-(\\d+)/(\\d+|\\*)$")

    /** 이미 가진 조각 크기로 보낼 Range 헤더. 기대보다 크면 조각을 버리라는 뜻으로 -1. */
    fun startOffset(partBytes: Long, expected: Long): Long = when {
        partBytes < 0 -> 0
        partBytes > expected -> -1
        else -> partBytes
    }

    fun header(have: Long, expected: Long): String? = if (have in 1 until expected) "bytes=$have-" else null

    fun decide(have: Long, expected: Long, status: Int, contentRange: String?, contentLength: Long): RangeDecision {
        return when (status) {
            206 -> {
                val m = contentRange?.trim()?.let { CONTENT_RANGE.matchEntire(it) } ?: return RangeDecision.Fail("206 without content-range")
                val (a, b, total) = m.destructured
                when {
                    a.toLong() != have -> RangeDecision.Fail("range start mismatch")
                    total != "*" && total.toLong() != expected -> RangeDecision.Fail("total size mismatch")
                    b.toLong() != expected - 1 -> RangeDecision.Fail("range end mismatch")
                    else -> RangeDecision.Append
                }
            }
            200 -> if (contentLength >= 0 && contentLength != expected) RangeDecision.Fail("content-length mismatch") else RangeDecision.Restart
            416 -> if (have == expected) RangeDecision.Complete else RangeDecision.Restart
            else -> RangeDecision.Fail("http $status")
        }
    }
}
