package com.miraclepenguin.kaiwa.sherpastt

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.URI

/** speech/models/manifest.example.json 과 같은 값(+ 서버 #9 가 붙이는 id·baseUrl·url). */
internal fun sampleManifest(version: String = "2024-08-01-int8-v1"): JSONObject = JSONObject(
    """
    {
      "id": "ondevice-ja-v1",
      "name": "reazonspeech-int8",
      "version": "$version",
      "engine": "sherpa-onnx",
      "model": "zipformer-ja-reazonspeech-2024-08-01-int8",
      "modelType": "transducer",
      "sampleRate": 16000,
      "language": "ja",
      "license": "Apache-2.0",
      "minPluginVersion": "0.1.0",
      "baseUrl": "https://kaiwa.example.com/models/ondevice-ja-v1/$version/",
      "files": [
        {"path": "encoder-epoch-99-avg-1.int8.onnx", "sha256": "2c7bd08a8a99f9ddd0d9e458456577b1f6279214e51426f114f9eced44c54e1d", "bytes": 154670139, "role": "encoder", "url": "https://kaiwa.example.com/x"},
        {"path": "decoder-epoch-99-avg-1.onnx", "sha256": "58b18211ae06265466bfa17172dab574df94f76c8bcb61a3640c28ba860e4124", "bytes": 11767836, "role": "decoder"},
        {"path": "joiner-epoch-99-avg-1.int8.onnx", "sha256": "49cc7ea1d3d35a40a27442db5e89996da64bf0e683a903dce76e99e57a12e4de", "bytes": 2696970, "role": "joiner"},
        {"path": "tokens.txt", "sha256": "2c3ac659818a48a0c04010e0593bbc4d7c8a24a054340b01131499c05fd52def", "bytes": 45754, "role": "tokens"},
        {"path": "silero_vad.onnx", "sha256": "9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6", "bytes": 643854, "role": "vad"}
      ],
      "totalBytes": 169824553,
      "createdAt": "2026-09-28T00:01:25+0900"
    }
    """.trimIndent(),
)

class ManifestTest {
    private fun parse(o: JSONObject, plugin: String = "0.1.0") = ManifestValidator.parse(o.toString(), plugin)

    private fun code(o: JSONObject, plugin: String = "0.1.0"): String =
        assertThrows(SttException::class.java) { parse(o, plugin) }.code

    private fun JSONObject.file(i: Int): JSONObject = getJSONArray("files").getJSONObject(i)

    @Test
    fun acceptsRealManifest() {
        val m = parse(sampleManifest())
        assertEquals("2024-08-01-int8-v1", m.version)
        assertEquals(5, m.files.size)
        assertEquals(169824553L, m.totalBytes)
        assertEquals("tokens.txt", m.file("tokens").path)
        // 설치 인덱스로 다시 써도 같은 검증을 통과한다
        assertEquals(m, parse(m.toJson()))
    }

    @Test
    fun rejectsPathTraversalAndOddNames() {
        for (bad in listOf("../encoder.onnx", "a/b.onnx", ".hidden", "installed.json", "x.part", "", "a b")) {
            val o = sampleManifest().apply { file(0).put("path", bad) }
            assertEquals(bad, "MANIFEST_INVALID", code(o))
        }
    }

    @Test
    fun rejectsBadVersionAndName() {
        for (bad in listOf("..", ".tmp-x", "a", "v/1", "x".repeat(65))) {
            assertEquals(bad, "MANIFEST_INVALID", code(sampleManifest().put("version", bad)))
        }
        assertEquals("MANIFEST_INVALID", code(sampleManifest().put("name", "a/b")))
        assertEquals("MANIFEST_INVALID", code(sampleManifest().put("version", "v..1")))
    }

    @Test
    fun rejectsWrongEngineTypeOrRate() {
        assertEquals("MANIFEST_INVALID", code(sampleManifest().put("engine", "whisper")))
        assertEquals("MANIFEST_INVALID", code(sampleManifest().put("modelType", "ctc")))
        assertEquals("MANIFEST_INVALID", code(sampleManifest().put("sampleRate", 8000)))
        assertEquals("MANIFEST_INVALID", code(sampleManifest().put("sampleRate", "16000")))
    }

    @Test
    fun requiresSha256AndIntegerBytes() {
        assertEquals("MANIFEST_INVALID", code(sampleManifest().apply { file(1).put("sha256", "abc") }))
        assertEquals("MANIFEST_INVALID", code(sampleManifest().apply { file(1).remove("sha256") }))
        assertEquals("MANIFEST_INVALID", code(sampleManifest().apply { file(1).put("bytes", "11767836") }))
        assertEquals("MANIFEST_INVALID", code(sampleManifest().apply { file(1).put("bytes", 1.5) }))
        assertEquals("MANIFEST_INVALID", code(sampleManifest().apply { file(1).put("bytes", 0) }))
    }

    @Test
    fun rejectsUppercaseShaLikeServer() {
        val o = sampleManifest().apply { file(1).put("sha256", file(1).getString("sha256").uppercase()) }
        assertEquals("MANIFEST_INVALID", code(o))
    }

    @Test
    fun requiresEveryRoleExactlyOnce() {
        assertEquals("MANIFEST_INVALID", code(sampleManifest().apply { file(4).put("role", "encoder") }))
        assertEquals("MANIFEST_INVALID", code(sampleManifest().apply { file(4).put("role", "lm") }))
        val fourFiles = sampleManifest().apply {
            val arr = getJSONArray("files")
            arr.remove(4)
            put("totalBytes", 169824553L - 643854L)
        }
        assertEquals("MANIFEST_INVALID", code(fourFiles))
        assertEquals("MANIFEST_INVALID", code(sampleManifest().apply { file(1).put("path", file(0).getString("path")) }))
    }

    @Test
    fun enforcesTotalsAndCaps() {
        assertEquals("MANIFEST_INVALID", code(sampleManifest().put("totalBytes", 1)))
        val huge = sampleManifest().apply {
            file(0).put("bytes", 290L * 1024 * 1024)
            put("totalBytes", 290L * 1024 * 1024 + 11767836 + 2696970 + 45754 + 643854)
        }
        assertEquals("MANIFEST_INVALID", code(huge)) // 합계 300MiB 초과
        val many = sampleManifest().apply {
            val arr = getJSONArray("files")
            val extra = JSONArray()
            for (i in 0 until 12) extra.put(JSONObject().put("path", "x$i").put("sha256", "0".repeat(64)).put("bytes", 1).put("role", "vad"))
            for (i in 0 until extra.length()) arr.put(extra.get(i))
        }
        assertEquals("MANIFEST_INVALID", code(many))
        assertEquals("MANIFEST_INVALID", code(JSONObject().put("x", "y".repeat(70_000))))
    }

    @Test
    fun findsDuplicateKeysIncludingEscapedOnes() {
        assertEquals("a", JsonKeys.firstDuplicateKey("""{"a":1,"b":{"a":2},"a":3}"""))
        assertEquals(null, JsonKeys.firstDuplicateKey("""{"a":1,"b":{"a":2},"c":["a","a",{"a":1}]}"""))
        assertEquals("engine", JsonKeys.firstDuplicateKey("""{"engine":"x","\u0065ngine":"y"}"""))
        assertEquals(null, JsonKeys.firstDuplicateKey("""{"k":"a\"b","j":"\\"}"""))
        assertEquals("k", JsonKeys.firstDuplicateKey("""{"k":"a\"b","k":1}"""))
        // 서버 검사기는 아직 이스케이프를 풀지 않는다 — 공용 픽스처에는 넣지 않고 여기서만 확인(B 후속).
        val escaped = sampleManifest().toString().replace("\"engine\":", "\"\\u0065ngine\":\"sherpa-onnx\",\"engine\":")
        assertEquals("MANIFEST_INVALID", assertThrows(SttException::class.java) { ManifestValidator.parse(escaped, "0.1.0") }.code)
    }

    @Test
    fun rejectsNonJsonAndNonObject() {
        assertEquals("MANIFEST_INVALID", assertThrows(SttException::class.java) { ManifestValidator.parse("not json", "0.1.0") }.code)
        assertEquals("MANIFEST_INVALID", assertThrows(SttException::class.java) { ManifestValidator.parse("[1,2]", "0.1.0") }.code)
    }

    @Test
    fun minPluginVersionGatesOldApps() {
        assertEquals("APP_UPDATE_REQUIRED", code(sampleManifest().put("minPluginVersion", "0.2.0")))
        assertEquals("0.1.0", parse(sampleManifest().put("minPluginVersion", "0.1.0")).minPluginVersion)
        parse(sampleManifest().put("minPluginVersion", "0.0.9"), plugin = "0.1.0")
        assertEquals("MANIFEST_INVALID", code(sampleManifest().put("minPluginVersion", "latest")))
        assertTrue(ManifestValidator.compareSemver("0.10.0", "0.9.9") > 0)
    }

    @Test
    fun versionOrderIsNatural() {
        val sorted = listOf("2025-01-01-int8-v1", "2024-08-01-int8-v10", "2024-08-01-int8-v2", "2024-08-01-int8-v1").sortedWith(VersionOrder)
        assertEquals(listOf("2024-08-01-int8-v1", "2024-08-01-int8-v2", "2024-08-01-int8-v10", "2025-01-01-int8-v1"), sorted)
        assertEquals(0, VersionOrder.compare("v01", "v1"))
        assertTrue(VersionOrder.compare("v1", "v1-a") < 0)
    }
}

class OriginPolicyTest {
    private val p = OriginPolicy("https://kaiwa.xn--lh0b87pnudm10a4vd.com")

    @Test
    fun allowsSameOriginHttpsOnly() {
        p.check("https://kaiwa.xn--lh0b87pnudm10a4vd.com/models/ondevice-ja-v1/manifest.json")
        p.check("https://KAIWA.xn--lh0b87pnudm10a4vd.com:443/models/x/manifest.json")
        for (bad in listOf(
            "http://kaiwa.xn--lh0b87pnudm10a4vd.com/models/x/manifest.json",
            "https://evil.example.com/models/x/manifest.json",
            "https://kaiwa.xn--lh0b87pnudm10a4vd.com.evil.com/m",
            "https://kaiwa.xn--lh0b87pnudm10a4vd.com:8443/m",
            "https://user@kaiwa.xn--lh0b87pnudm10a4vd.com/m",
            "https://kaiwa.xn--lh0b87pnudm10a4vd.com/m#frag",
            "/models/x/manifest.json",
            "file:///data/x",
            "ht tp://bad",
        )) {
            assertEquals(bad, "ORIGIN_NOT_ALLOWED", assertThrows(SttException::class.java) { p.check(bad) }.code)
        }
    }

    @Test
    fun buildsFileUrlBesideManifest() {
        val m = URI("https://kaiwa.xn--lh0b87pnudm10a4vd.com/models/ondevice-ja-v1/manifest.json")
        assertEquals(
            "https://kaiwa.xn--lh0b87pnudm10a4vd.com/models/ondevice-ja-v1/2024-08-01-int8-v1/tokens.txt",
            p.fileUrl(m, "2024-08-01-int8-v1", "tokens.txt").toString(),
        )
    }

    @Test(expected = IllegalArgumentException::class)
    fun serverUrlMustBeHttps() {
        OriginPolicy("http://kaiwa.example.com")
    }
}

class RangeResumeTest {
    @Test
    fun plansStartOffset() {
        assertEquals(0L, RangeResume.startOffset(0, 100))
        assertEquals(40L, RangeResume.startOffset(40, 100))
        assertEquals(100L, RangeResume.startOffset(100, 100))
        assertEquals(-1L, RangeResume.startOffset(101, 100)) // 기대보다 크면 조각을 버린다
        assertEquals(null, RangeResume.header(0, 100))
        assertEquals("bytes=40-", RangeResume.header(40, 100))
        assertEquals(null, RangeResume.header(100, 100))
    }

    @Test
    fun decidesOnResponse() {
        assertEquals(RangeDecision.Append, RangeResume.decide(40, 100, 206, "bytes 40-99/100", 60))
        assertEquals(RangeDecision.Append, RangeResume.decide(40, 100, 206, "bytes 40-99/*", 60))
        assertTrue(RangeResume.decide(40, 100, 206, "bytes 0-99/100", 100) is RangeDecision.Fail)
        assertTrue(RangeResume.decide(40, 100, 206, "bytes 40-99/120", 60) is RangeDecision.Fail)
        assertTrue(RangeResume.decide(40, 100, 206, "bytes 40-80/100", 41) is RangeDecision.Fail)
        assertTrue(RangeResume.decide(40, 100, 206, null, 60) is RangeDecision.Fail)
        assertEquals(RangeDecision.Restart, RangeResume.decide(40, 100, 200, null, 100))
        assertEquals(RangeDecision.Restart, RangeResume.decide(0, 100, 200, null, -1))
        assertTrue(RangeResume.decide(0, 100, 200, null, 99) is RangeDecision.Fail)
        assertEquals(RangeDecision.Complete, RangeResume.decide(100, 100, 416, null, 0))
        assertEquals(RangeDecision.Restart, RangeResume.decide(40, 100, 416, null, 0))
        assertTrue(RangeResume.decide(0, 100, 404, null, 0) is RangeDecision.Fail)
    }
}

class OptsTest {
    @Test
    fun readsTypedOptionsStrictly() {
        val o = JSONObject().put("a", 3).put("b", 3.5).put("c", "3").put("d", true).put("f", 0.5).put("n", JSONObject.NULL)
        assertEquals(3, Opts.int(o, "a", 1, 1..8))
        assertEquals(1, Opts.int(o, "missing", 1, 1..8))
        assertEquals(1, Opts.int(o, "n", 1, 1..8))
        assertEquals("INVALID_ARGUMENT", assertThrows(SttException::class.java) { Opts.int(o, "b", 1, 1..8) }.code)
        assertEquals("INVALID_ARGUMENT", assertThrows(SttException::class.java) { Opts.int(o, "c", 1, 1..8) }.code)
        assertEquals("INVALID_ARGUMENT", assertThrows(SttException::class.java) { Opts.int(o, "a", 1, 4..8) }.code)
        assertEquals(0.5f, Opts.float(o, "f", 0.1f, 0.05f..0.95f), 0f)
        assertEquals("INVALID_ARGUMENT", assertThrows(SttException::class.java) { Opts.float(o, "a", 0.1f, 0.05f..0.95f) }.code)
        assertEquals(true, Opts.bool(o, "d", false))
        assertEquals("INVALID_ARGUMENT", assertThrows(SttException::class.java) { Opts.bool(o, "a", false) }.code)
        assertEquals("x", Opts.str(o, "missing", "x"))
        assertEquals("INVALID_ARGUMENT", assertThrows(SttException::class.java) { Opts.str(o, "a", "x") }.code)
    }
}
