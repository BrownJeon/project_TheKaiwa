package com.miraclepenguin.kaiwa.sherpastt

import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * 모델 파일을 **실제로 읽는 구간**(VAD·인식기 네이티브 로드)과 **설치본을 바꾸는 구간**(commit 의 rename + 옛 버전 삭제,
 * deleteModel 의 삭제)을 서로 배타로 만드는 잠금(Codex C2 High).
 */
internal interface ModelFilesLock {
    fun <T> withModelFiles(block: () -> T): T

    companion object {
        /** 테스트·단독 사용용 — 잠그지 않는다. */
        val NONE: ModelFilesLock = object : ModelFilesLock {
            override fun <T> withModelFiles(block: () -> T): T = block()
        }
    }
}

/**
 * 모델을 **쓰는 일**(인식 세션·다운로드)과 **지우는 일**을 한 임계구역에서 판정·점유한다(REV-021 Medium).
 *
 * 이전에는 `deleteModel` 이 락 안에서 "세션·다운로드 없음"만 보고 삭제는 락 밖(worker)에서 했다 — 그 사이에 `start()` 가
 * 모델 경로를 잡으면 방금 잡은 파일이 지워진 채 네이티브 로드가 시도됐다. 이제 판정과 점유가 한 번의 락 안에서 끝나고,
 * 삭제는 `beginDelete`~`endDelete` 동안 점유를 들고 있어 그 사이의 `openSession`·`beginDownload` 는 `BUSY` 다.
 *
 * `openSession(open)` 의 `open` 은 **락 안에서** 돈다 — 설치본 확인(`store.current()`)·VAD 생성·마이크 열기까지 삭제와 겹치지 않는다.
 * 플러그인은 세션 종료 대기(`pendingStops`)처럼 세션 상태와 함께 바뀌어야 하는 값을 `synchronized(gate)` 로 묶는다
 * (`@Synchronized` 와 같은 모니터).
 *
 * **모델 파일 잠금**([withModelFiles], Codex C2): 다운로드는 세션과 동시에 돌 수 있다(받는 몇 분 동안 회화 가능 — 의도).
 * 위험한 것은 다운로드의 끝(commit 이 옛 버전 디렉터리를 지움)과 세션의 네이티브 로드(≈1~2s)가 겹치는 순간뿐이라,
 * 그 두 구간만 이 게이트의 파일 잠금으로 배타로 만든다. 로드가 끝난 인식기·VAD 는 모델을 메모리에 들고 있어(sherpa-onnx 는
 * 파일을 버퍼로 읽어 onnxruntime 세션을 만든다 — tools/desktop-check `--delete-after-load` 로 확인) 그 뒤의 commit 은 안전하다.
 * 게이트 모니터(`@Synchronized`)와 따로 둔 이유: 로드가 1~2초 걸리는 동안 메인 스레드의 `handleOnPause`·플러그인 스레드의
 * `stop` 이 세션 상태를 읽느라 멈추지 않게. **잠그는 순서는 늘 게이트 모니터 → 파일 잠금**(반대로 잡는 경로 없음 — 교착 없음).
 */
internal class ModelGate<S : Any, D : Any> : ModelFilesLock {
    private val files = ReentrantLock()

    override fun <T> withModelFiles(block: () -> T): T = files.withLock(block)

    private var session: S? = null
    private var download: D? = null
    private var deleting = false

    @Synchronized
    fun openSession(open: () -> S): S {
        if (deleting) throw SttException("BUSY", "model is being deleted")
        if (session != null) throw SttException("ALREADY_STARTED", "session already started")
        return open().also { session = it }
    }

    @Synchronized
    fun session(): S? = session

    /** `s` 가 아직 현재 세션이면 비우고 true. */
    @Synchronized
    fun closeSession(s: S): Boolean {
        if (session !== s) return false
        session = null
        return true
    }

    @Synchronized
    fun beginDownload(d: D) {
        if (deleting) throw SttException("BUSY", "model is being deleted")
        if (download != null) throw SttException("DOWNLOAD_IN_PROGRESS", "download already running")
        download = d
    }

    @Synchronized
    fun download(): D? = download

    @Synchronized
    fun endDownload(d: D) {
        if (download === d) download = null
    }

    /** 세션·다운로드·다른 삭제가 없을 때만 삭제를 점유한다. 끝나면 반드시 [endDelete]. */
    @Synchronized
    fun beginDelete() {
        if (deleting || session != null || download != null) throw SttException("BUSY", "session, download or delete running")
        deleting = true
    }

    @Synchronized
    fun endDelete() {
        deleting = false
    }

    @get:Synchronized
    val isDeleting: Boolean get() = deleting
}
