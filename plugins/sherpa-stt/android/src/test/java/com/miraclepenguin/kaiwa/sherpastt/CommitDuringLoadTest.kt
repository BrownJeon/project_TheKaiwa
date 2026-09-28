package com.miraclepenguin.kaiwa.sherpastt

import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.CyclicBarrier
import java.util.concurrent.Executor
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Codex C2 High — 다운로드 commit(rename + 옛 버전 삭제) ↔ 세션의 인식기 로드. 둘은 `ModelGate.withModelFiles` 로 배타이고,
 * 세션 `modelVersion` 은 실제로 올린 버전과 같다.
 */
class CommitDuringLoadTest {
    private lateinit var dir: File
    private lateinit var store: ModelStore
    private val gate = ModelGate<Any, Any>()

    @Before
    fun setUp() {
        dir = createTempDirectory()
        store = ModelStore(File(dir, "stt"), "0.1.0")
    }

    @After
    fun tearDown() {
        dir.deleteRecursively()
    }

    /** `<root>/.tmp-<version>/` 에 작은 모델 한 벌을 놓고 검증된 manifest 를 돌려준다. */
    private fun stage(version: String, seed: Int): ModelManifest {
        val tmp = store.tmpDir(version).apply { mkdirs() }
        val arr = JSONArray()
        var total = 0
        listOf("encoder", "decoder", "joiner", "tokens", "vad").forEachIndexed { i, role ->
            val bytes = ByteArray(2000 + i * 300) { (it * 31 + i + seed).toByte() }
            File(tmp, "$role.bin").writeBytes(bytes)
            arr.put(JSONObject().put("path", "$role.bin").put("sha256", ModelStore.sha256(File(tmp, "$role.bin"))).put("bytes", bytes.size).put("role", role))
            total += bytes.size
        }
        val text = JSONObject().put("name", "m").put("version", version).put("engine", "sherpa-onnx").put("modelType", "transducer")
            .put("sampleRate", 16000).put("files", arr).put("totalBytes", total).toString()
        return ManifestValidator.parse(text, "0.1.0")
    }

    private fun install(version: String, seed: Int) = store.commit(store.tmpDir(version), stage(version, seed))

    private fun session(initialVersion: String, sink: SessionSink = NoSink) = SttSession(
        "s1", initialVersion, SessionOptions(false, true, 60_000, false), NoVad, { Decoder { "" } }, Executor { it.run() }, sink, WavStore { _, _, _ -> null },
    )

    /** 로더가 "파일을 실제로 읽는" 흉내 — 파일이 다 있고 sha256 이 맞아야 성공. */
    private fun readAll(m: InstalledModel): Boolean = m.manifest.files.all { f ->
        val file = File(m.dir, f.path)
        file.isFile && ModelStore.sha256(file) == f.sha256
    }

    @Test
    fun commitArrivingMidLoadWaitsUntilLoadFinishes() {
        install("2024-08-01-int8-v1", 1)
        val v2 = stage("2024-08-01-int8-v2", 2)
        val s = session("2024-08-01-int8-v1")
        val loadStarted = CountDownLatch(1)
        val letLoadFinish = CountDownLatch(1)
        val filesIntact = AtomicBoolean(false)
        val loader = Thread {
            loadRecognizerForSession(gate, { store.current() }, s) { m ->
                loadStarted.countDown()
                letLoadFinish.await(5, TimeUnit.SECONDS) // 네이티브 로드 ≈1~2s 흉내 — 이 사이에 commit 이 온다
                filesIntact.set(readAll(m))
                321
            }
        }.apply { start() }
        assertTrue(loadStarted.await(5, TimeUnit.SECONDS))

        val committed = CountDownLatch(1)
        val committer = Thread {
            gate.withModelFiles { store.commit(store.tmpDir(v2.version), v2) }
            committed.countDown()
        }.apply { start() }
        assertFalse("로드 중에는 commit(옛 버전 삭제)이 진행되지 않는다", committed.await(300, TimeUnit.MILLISECONDS))
        assertTrue(File(store.root, "2024-08-01-int8-v1").isDirectory)

        letLoadFinish.countDown()
        loader.join(5000)
        assertTrue("로드는 온전한 v1 파일을 읽었다", filesIntact.get())
        assertEquals("2024-08-01-int8-v1", s.modelVersion) // 세션 버전 = 실제로 올린 버전
        assertEquals(321, s.loadMs)

        assertTrue(committed.await(5, TimeUnit.SECONDS))
        committer.join(5000)
        assertEquals("2024-08-01-int8-v2", store.current()!!.version)
        assertFalse(File(store.root, "2024-08-01-int8-v1").exists()) // 로드가 끝난 뒤에야 옛 버전이 지워졌다
    }

    @Test
    fun commitBetweenOpenAndLoadMakesSessionReportTheLoadedVersion() {
        install("2024-08-01-int8-v1", 3)
        val s = session(store.current()!!.version) // start 가 열 때의 버전
        val v2 = stage("2024-08-01-int8-v2", 4)
        gate.withModelFiles { store.commit(store.tmpDir(v2.version), v2) } // 열기와 로드 사이에 commit
        var loaded: String? = null
        loadRecognizerForSession(gate, { store.current() }, s) { m ->
            assertTrue(readAll(m))
            loaded = m.version
            0
        }
        assertEquals("2024-08-01-int8-v2", loaded)
        assertEquals(loaded, s.modelVersion)
    }

    @Test
    fun loadWithoutModelFailsSessionOutsideTheLock() {
        val closedWhileLocked = AtomicBoolean(true)
        val sink = object : SessionSink by NoSink {
            override fun onClosed(sessionId: String, last: FinalResult?) {
                // 실패 보고(→ 플러그인 onClosed → 게이트 모니터)는 파일 잠금을 쥔 채 오지 않는다(잠금 순서).
                closedWhileLocked.set(probeLocked(gate))
            }
        }
        val s = session("x-v1", sink)
        loadRecognizerForSession(gate, { store.current() }, s) { 0 }
        assertTrue(s.isClosed)
        assertFalse(closedWhileLocked.get())
    }

    /** commit 과 로드를 2,000번 경합시켜 파일 잠금 안에서 둘이 겹친 순간이 없는지. */
    @Test
    fun commitAndLoadNeverOverlapUnderContention() {
        val pool = Executors.newFixedThreadPool(2)
        val inLoad = AtomicInteger()
        val inCommit = AtomicInteger()
        val overlaps = AtomicInteger()
        try {
            repeat(2000) {
                val barrier = CyclicBarrier(2)
                val done = CountDownLatch(2)
                pool.execute {
                    barrier.await()
                    gate.withModelFiles {
                        inLoad.incrementAndGet()
                        if (inCommit.get() != 0) overlaps.incrementAndGet()
                        Thread.yield()
                        if (inCommit.get() != 0) overlaps.incrementAndGet()
                        inLoad.decrementAndGet()
                    }
                    done.countDown()
                }
                pool.execute {
                    barrier.await()
                    gate.withModelFiles {
                        inCommit.incrementAndGet()
                        if (inLoad.get() != 0) overlaps.incrementAndGet()
                        Thread.yield()
                        if (inLoad.get() != 0) overlaps.incrementAndGet()
                        inCommit.decrementAndGet()
                    }
                    done.countDown()
                }
                assertTrue(done.await(5, TimeUnit.SECONDS))
            }
        } finally {
            pool.shutdownNow()
        }
        assertEquals(0, overlaps.get())
    }

    @Test
    fun modelFilesLockDoesNotBlockSessionStateQueries() {
        val held = CountDownLatch(1)
        val release = CountDownLatch(1)
        val t = Thread { gate.withModelFiles { held.countDown(); release.await(5, TimeUnit.SECONDS) } }.apply { start() }
        assertTrue(held.await(5, TimeUnit.SECONDS))
        // 로드가 파일 잠금을 쥔 1~2초 동안에도 handleOnPause·stop 이 부르는 세션 조회는 멈추지 않는다.
        val q = Thread { gate.session(); gate.download() }.apply { start() }
        q.join(1000)
        assertFalse(q.isAlive)
        release.countDown()
        t.join(5000)
        assertNull(gate.session())
    }

    private fun probeLocked(g: ModelGate<*, *>): Boolean {
        val free = AtomicBoolean(false)
        val t = Thread { g.withModelFiles { free.set(true) } }.apply { start() }
        t.join(500)
        return !free.get()
    }

    private object NoVad : VadEngine {
        override fun acceptWaveform(samples: FloatArray) {}
        override fun isSpeechDetected() = false
        override fun empty() = true
        override fun front(): VadSegment = throw NoSuchElementException()
        override fun pop() {}
        override fun flush() {}
        override fun reset() {}
    }

    private object NoSink : SessionSink {
        override fun onVad(sessionId: String, state: String, atMs: Int) {}
        override fun onPartial(sessionId: String, seg: Segment) {}
        override fun onFinal(result: FinalResult) {}
        override fun onError(sessionId: String, code: String, message: String) {}
        override fun onClosed(sessionId: String, last: FinalResult?) {}
    }
}
