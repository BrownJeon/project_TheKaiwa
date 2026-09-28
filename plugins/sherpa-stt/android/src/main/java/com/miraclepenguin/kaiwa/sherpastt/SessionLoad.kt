package com.miraclepenguin.kaiwa.sherpastt

/**
 * 세션의 인식기 로드(worker 스레드). 설치본 확인과 네이티브 로드를 **모델 파일 잠금 안에서 한 번에** 해 그 사이에 commit·삭제가
 * 끼지 못하게 하고(Codex C2), 실제로 올린 버전을 세션에 적는다(세션 `modelVersion` = 인식기 키의 버전).
 * 실패 보고(`failOnWorker` → onClosed → 게이트 모니터)는 잠금 **밖에서** 한다 — 잠금 순서(게이트 → 파일)를 거스르지 않게.
 */
internal fun loadRecognizerForSession(
    files: ModelFilesLock,
    current: () -> InstalledModel?,
    session: SttSession,
    ensure: (InstalledModel) -> Int,
) {
    val failure: Pair<String, String>? = try {
        files.withModelFiles {
            val model = current() ?: throw SttException("MODEL_MISSING", "model not installed")
            session.loadMs = ensure(model)
            session.modelVersion = model.version
        }
        null
    } catch (e: SttException) {
        e.code to (e.message ?: e.code)
    } catch (e: OutOfMemoryError) {
        "OOM" to "out of memory while loading recognizer"
    } catch (e: Throwable) {
        "MODEL_CORRUPT" to "recognizer load failed: ${e.javaClass.simpleName}"
    }
    if (failure != null) session.failOnWorker(failure.first, failure.second)
}
