package com.miraclepenguin.kaiwa.sherpastt

import org.json.JSONObject

/**
 * 플러그인 옵션 읽기 — 타입이 틀리거나 범위를 벗어나면 `INVALID_ARGUMENT`. org.json 의 `getInt` 등은 문자열·실수를
 * 조용히 바꿔 주므로 쓰지 않는다(없음·null 만 기본값).
 */
internal object Opts {
    fun int(o: JSONObject, key: String, def: Int, range: IntRange): Int {
        val v = o.opt(key) ?: return def
        if (v == JSONObject.NULL) return def
        val n = (v as? Number) ?: throw SttException("INVALID_ARGUMENT", key)
        val d = n.toDouble()
        if (d != Math.floor(d) || d < range.first || d > range.last) throw SttException("INVALID_ARGUMENT", key)
        return d.toInt()
    }

    fun float(o: JSONObject, key: String, def: Float, range: ClosedFloatingPointRange<Float>): Float {
        val v = o.opt(key) ?: return def
        if (v == JSONObject.NULL) return def
        val f = (v as? Number)?.toFloat() ?: throw SttException("INVALID_ARGUMENT", key)
        if (f.isNaN() || f !in range) throw SttException("INVALID_ARGUMENT", key)
        return f
    }

    fun bool(o: JSONObject, key: String, def: Boolean): Boolean {
        val v = o.opt(key) ?: return def
        if (v == JSONObject.NULL) return def
        return v as? Boolean ?: throw SttException("INVALID_ARGUMENT", key)
    }

    fun str(o: JSONObject, key: String, def: String): String {
        val v = o.opt(key) ?: return def
        if (v == JSONObject.NULL) return def
        return v as? String ?: throw SttException("INVALID_ARGUMENT", key)
    }
}
