package com.miraclepenguin.kaiwa.sherpastt

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
 */
internal class ModelGate<S : Any, D : Any> {
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
