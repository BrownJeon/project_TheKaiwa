package com.miraclepenguin.kaiwa.sherpastt

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * 서버 검증기와 같은 사례를 읽는다 — `plugins/sherpa-stt/test-fixtures/manifest-cases.json`(REV-021 High).
 * 서버(TS)도 같은 파일로 "plugin 이 valid·APP_UPDATE_REQUIRED 인 사례만 통과"를 확인한다.
 */
class ManifestFixtureTest {
    private fun fixture(): JSONObject {
        // gradle 단위 테스트의 작업 디렉터리는 모듈(plugins/sherpa-stt/android)이다.
        val f = File(System.getProperty("user.dir"), "../test-fixtures/manifest-cases.json").canonicalFile
        assertTrue("fixture 없음: $f", f.isFile)
        return JSONObject(f.readText(Charsets.UTF_8))
    }

    @Test
    fun everySharedCaseGetsTheExpectedVerdict() {
        val doc = fixture()
        val plugin = doc.getString("pluginVersion")
        val cases = doc.getJSONArray("cases")
        assertTrue(cases.length() >= 40)
        val wrong = ArrayList<String>()
        for (i in 0 until cases.length()) {
            val c = cases.getJSONObject(i)
            val text = if (c.has("raw")) c.getString("raw") else c.getJSONObject("manifest").toString()
            val got = try {
                ManifestValidator.parse(text, plugin)
                "valid"
            } catch (e: SttException) {
                e.code
            }
            if (got != c.getString("plugin")) wrong.add("${c.getString("name")}: expected ${c.getString("plugin")} got $got")
        }
        assertEquals(emptyList<String>(), wrong)
    }

    @Test
    fun limitsMatchValidatorConstants() {
        val l = fixture().getJSONObject("limits")
        assertEquals(ManifestValidator.MAX_MANIFEST_BYTES, l.getInt("maxManifestBytes"))
        assertEquals(ManifestValidator.MAX_TOTAL_BYTES, l.getLong("maxTotalBytes"))
        assertEquals(ManifestValidator.MAX_FILES, l.getInt("maxFiles"))
        assertEquals(ManifestValidator.ROLES.size, l.getInt("minFiles"))
        assertEquals(ManifestValidator.ROLES, (0 until l.getJSONArray("roles").length()).map { l.getJSONArray("roles").getString(it) }.toSet())
        assertEquals(ManifestValidator.ENGINE, l.getString("engine"))
        assertEquals(ManifestValidator.MODEL_TYPE, l.getString("modelType"))
        assertEquals(Audio.SAMPLE_RATE, l.getInt("sampleRate"))
    }
}
