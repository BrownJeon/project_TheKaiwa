package com.miraclepenguin.kaiwa.sherpastt

import java.io.File
import java.io.FileInputStream
import java.io.IOException
import java.security.MessageDigest

internal data class InstalledModel(val manifest: ModelManifest, val dir: File) {
    val version: String get() = manifest.version
    val totalBytes: Long get() = manifest.totalBytes

    fun path(role: String): File = File(dir, manifest.file(role).path)
}

/**
 * `<root>/<version>/` 에 검증을 마친 모델만 둔다(root = `filesDir/models/stt` — 앱 전용, 백업 제외).
 * 받는 중에는 `<root>/.tmp-<version>/` 에 쌓고, 전부 sha256 이 맞은 뒤에만 인덱스를 쓰고 rename 한다.
 * 경로·파일명에는 엔진·모델 이름을 쓰지 않는다(JS 로 돌아가는 값이 없게).
 * 조회(io 스레드)와 설치(download 스레드)가 겹치지 않게 공개 메서드는 동기화한다 — 받는 동안의 파일 쓰기는 잠그지 않는다.
 */
internal class ModelStore(val root: File, private val pluginVersion: String) {

    /** 설치본 중 가장 높은 버전. 인덱스 검증 + 파일 크기까지만 본다(sha256 전체 재계산은 `verify`). */
    @Synchronized
    fun current(): InstalledModel? {
        val dirs = root.listFiles { f -> f.isDirectory && !f.name.startsWith(".") } ?: return null
        return dirs.sortedWith { a, b -> VersionOrder.compare(b.name, a.name) }
            .firstNotNullOfOrNull { load(it) }
    }

    private fun load(dir: File): InstalledModel? {
        val index = File(dir, ManifestValidator.INDEX_FILE)
        if (!index.isFile || index.length() > ManifestValidator.MAX_MANIFEST_BYTES) return null
        val manifest = try {
            ManifestValidator.parse(index.readText(Charsets.UTF_8), pluginVersion)
        } catch (e: SttException) {
            return null
        } catch (e: IOException) {
            return null
        }
        if (manifest.version != dir.name) return null
        for (f in manifest.files) {
            val file = File(dir, f.path)
            if (!file.isFile || file.length() != f.bytes) return null
        }
        return InstalledModel(manifest, dir)
    }

    /** sha256 전체 재계산. 틀리면 그 버전을 지우고 false. */
    @Synchronized
    fun verify(model: InstalledModel): Boolean {
        val ok = model.manifest.files.all { f ->
            val file = File(model.dir, f.path)
            file.isFile && file.length() == f.bytes && sha256(file) == f.sha256
        }
        if (!ok) model.dir.deleteRecursively()
        return ok
    }

    fun tmpDir(version: String): File {
        require(ManifestValidator.isValidVersion(version))
        return File(root, ".tmp-$version")
    }

    /** 이어받을 수 있는 미완성 다운로드(가장 최근 것). */
    @Synchronized
    fun pending(): Pair<String, Long>? {
        val tmps = root.listFiles { f -> f.isDirectory && f.name.startsWith(".tmp-") } ?: return null
        return tmps.maxByOrNull { it.lastModified() }?.let { d ->
            d.name.removePrefix(".tmp-") to (d.listFiles()?.sumOf { it.length() } ?: 0L)
        }
    }

    /** 다른 버전의 미완성 조각은 버린다(버전 디렉터리는 불변이라 섞어 쓸 수 없다). */
    @Synchronized
    fun dropOtherTmp(keepVersion: String) {
        root.listFiles { f -> f.isDirectory && f.name.startsWith(".tmp-") && f.name != ".tmp-$keepVersion" }
            ?.forEach { it.deleteRecursively() }
    }

    /**
     * 받은 파일이 전부 검증된 임시 디렉터리를 설치본으로 올린다: 인덱스 쓰기 → rename(같은 파일시스템, 원자적)
     * → 다른 버전 삭제. 같은 버전 디렉터리가 이미 있으면(손상본 재설치) 먼저 옆으로 치운다.
     */
    @Throws(IOException::class)
    @Synchronized
    fun commit(tmp: File, manifest: ModelManifest): InstalledModel {
        for (f in manifest.files) {
            val file = File(tmp, f.path)
            if (!file.isFile || file.length() != f.bytes) throw IOException("incomplete ${f.role}")
        }
        tmp.listFiles { f -> f.name.endsWith(".part") }?.forEach { it.delete() }
        val indexTmp = File(tmp, ManifestValidator.INDEX_FILE + ".tmp")
        indexTmp.writeText(manifest.toJson().toString(), Charsets.UTF_8)
        if (!indexTmp.renameTo(File(tmp, ManifestValidator.INDEX_FILE))) throw IOException("index rename failed")

        val target = File(root, manifest.version)
        if (target.exists()) {
            val aside = File(root, ".old-${manifest.version}-${System.nanoTime()}")
            if (!target.renameTo(aside)) throw IOException("cannot move existing version aside")
            aside.deleteRecursively()
        }
        if (!tmp.renameTo(target)) throw IOException("version rename failed")
        root.listFiles { f -> f.isDirectory && f.name != manifest.version }?.forEach { it.deleteRecursively() }
        return load(target) ?: throw IOException("installed model failed to load back")
    }

    @Synchronized
    fun deleteAll() {
        root.listFiles()?.forEach { it.deleteRecursively() }
    }

    companion object {
        fun sha256(file: File): String {
            val md = MessageDigest.getInstance("SHA-256")
            FileInputStream(file).use { input ->
                val buf = ByteArray(1 shl 16)
                while (true) {
                    val n = input.read(buf)
                    if (n < 0) break
                    md.update(buf, 0, n)
                }
            }
            // String.format 은 기본 로캘을 탄다 — 16진수는 손으로 만든다.
            val hex = "0123456789abcdef"
            return buildString(64) { for (b in md.digest()) append(hex[(b.toInt() shr 4) and 0xf]).append(hex[b.toInt() and 0xf]) }
        }
    }
}
