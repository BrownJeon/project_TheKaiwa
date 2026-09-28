package com.miraclepenguin.kaiwa.sherpastt

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.CyclicBarrier
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/** REV-021 Medium — deleteModel ↔ start TOCTOU. 판정과 점유가 한 임계구역에서 일어나는지. */
class ModelGateTest {
    private class Sess
    private class Dl

    private val gate = ModelGate<Sess, Dl>()

    private fun code(block: () -> Unit): String = assertThrows(SttException::class.java) { block() }.code

    @Test
    fun deleteIsBusyWhileSessionOrDownload() {
        val s = gate.openSession { Sess() }
        assertEquals("BUSY", code { gate.beginDelete() })
        assertTrue(gate.closeSession(s))
        val d = Dl()
        gate.beginDownload(d)
        assertEquals("BUSY", code { gate.beginDelete() })
        gate.endDownload(d)
        gate.beginDelete()
        assertEquals("BUSY", code { gate.beginDelete() }) // 삭제 두 번도 겹치지 않는다
        gate.endDelete()
    }

    @Test
    fun sessionAndDownloadAreBusyWhileDeleting() {
        gate.beginDelete()
        var opened = false
        assertEquals("BUSY", code { gate.openSession { opened = true; Sess() } })
        assertFalse("삭제 중에는 open(설치본 확인·VAD 생성)이 돌지 않는다", opened)
        assertEquals("BUSY", code { gate.beginDownload(Dl()) })
        gate.endDelete()
        gate.openSession { Sess() }
    }

    @Test
    fun keepsExistingCodesForOtherConflicts() {
        gate.openSession { Sess() }
        assertEquals("ALREADY_STARTED", code { gate.openSession { Sess() } })
        gate.beginDownload(Dl())
        assertEquals("DOWNLOAD_IN_PROGRESS", code { gate.beginDownload(Dl()) })
    }

    @Test
    fun failedOpenLeavesNoSession() {
        assertEquals("MODEL_MISSING", code { gate.openSession { throw SttException("MODEL_MISSING", "x") } })
        assertNull(gate.session())
        gate.beginDelete() // 실패한 open 이 점유를 남기지 않았다
        gate.endDelete()
    }

    @Test
    fun closeOnlyClearsTheSameSession() {
        val a = gate.openSession { Sess() }
        assertFalse(gate.closeSession(Sess()))
        assertSame(a, gate.session())
        assertTrue(gate.closeSession(a))
        assertNull(gate.session())
    }

    /** 삭제와 세션 열기를 동시에 수천 번 — 둘이 함께 점유한 순간이 한 번도 없어야 한다. */
    @Test
    fun deleteAndOpenNeverOverlapUnderContention() {
        val pool = Executors.newFixedThreadPool(2)
        val overlaps = AtomicInteger()
        val opened = AtomicInteger()
        val deleted = AtomicInteger()
        try {
            repeat(2000) {
                val barrier = CyclicBarrier(2)
                val done = CountDownLatch(2)
                pool.execute {
                    barrier.await()
                    try {
                        val s = gate.openSession {
                            if (gate.isDeleting) overlaps.incrementAndGet()
                            Sess()
                        }
                        opened.incrementAndGet()
                        if (gate.isDeleting) overlaps.incrementAndGet()
                        gate.closeSession(s)
                    } catch (e: SttException) {
                        assertTrue(e.code == "BUSY")
                    } finally {
                        done.countDown()
                    }
                }
                pool.execute {
                    barrier.await()
                    try {
                        gate.beginDelete()
                        deleted.incrementAndGet()
                        if (gate.session() != null) overlaps.incrementAndGet()
                        gate.endDelete()
                    } catch (e: SttException) {
                        assertTrue(e.code == "BUSY")
                    } finally {
                        done.countDown()
                    }
                }
                assertTrue(done.await(5, TimeUnit.SECONDS))
            }
        } finally {
            pool.shutdownNow()
        }
        assertEquals(0, overlaps.get())
        assertTrue(opened.get() > 0 && deleted.get() > 0)
    }
}

/** 삭제 흐름(판정 → worker 에서 삭제 → 해제) 사이에 start 가 끼어도 지워진 설치본을 잡지 않는다. */
class DeleteVsStartTest {
    private lateinit var dir: File

    @Before
    fun setUp() {
        dir = createTempDirectory()
    }

    @After
    fun tearDown() {
        dir.deleteRecursively()
    }

    @Test
    fun startBetweenDeleteClaimAndWorkerIsRefusedThenSeesNoModel() {
        val store = ModelStore(File(dir, "stt"), "0.1.0")
        val manifest = ManifestValidator.parse(sampleSmallManifest(store), "0.1.0")
        store.commit(store.tmpDir(manifest.version), manifest)
        val gate = ModelGate<InstalledModel, Any>()
        val queued = ArrayList<Runnable>() // worker 흉내 — 아직 돌지 않은 작업

        // deleteModel: 판정·점유는 즉시, 삭제는 worker 에서 나중에
        gate.beginDelete()
        queued.add(Runnable {
            try {
                store.deleteAll()
            } finally {
                gate.endDelete()
            }
        })

        // 그 사이 start: 예전 코드는 여기서 설치본을 잡았다
        val busy = assertThrows(SttException::class.java) { gate.openSession { store.current() ?: throw SttException("MODEL_MISSING", "x") } }
        assertEquals("BUSY", busy.code)

        queued.forEach { it.run() }
        val after = assertThrows(SttException::class.java) { gate.openSession { store.current() ?: throw SttException("MODEL_MISSING", "x") } }
        assertEquals("MODEL_MISSING", after.code)
        assertNull(gate.session())
    }

    /** 임시 디렉터리에 작은 모델 한 벌을 놓고 그 manifest 원문을 돌려준다. */
    private fun sampleSmallManifest(store: ModelStore): String {
        val version = "2024-08-01-int8-v1"
        val tmp = store.tmpDir(version).apply { mkdirs() }
        val files = listOf("encoder", "decoder", "joiner", "tokens", "vad").mapIndexed { i, role ->
            val bytes = ByteArray(100 + i) { (it * 7 + i).toByte() }
            File(tmp, "$role.bin").writeBytes(bytes)
            Triple("$role.bin", role, bytes)
        }
        val arr = org.json.JSONArray()
        files.forEach { (p, r, b) -> arr.put(org.json.JSONObject().put("path", p).put("sha256", ModelStore.sha256(File(tmp, p))).put("bytes", b.size).put("role", r)) }
        return org.json.JSONObject().put("name", "m").put("version", version).put("engine", "sherpa-onnx").put("modelType", "transducer")
            .put("sampleRate", 16000).put("files", arr).put("totalBytes", files.sumOf { it.third.size }).toString()
    }
}
