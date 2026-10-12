/**
 * 손님이 요청을 끊어(`req.signal`) 엔진 호출이 취소됐을 때의 공용 판정·오류(task-058, #169·#178·#180).
 * 세 서비스(`replyPractice`·`openingDraftRun`·`phraseHelp`)가 모두 이 정의를 쓴다 — 한쪽에만 조건이 뒤늦게 붙던 표류(REV-190→192)를 막으려고 task-062 에서 `phraseHelp` 의 사본을 걷었다.
 */
import { ApiError } from '@/modules/infra'

/**
 * 엔진이 `name === 'AbortError'` 로 거절했는가(재시도·폴백 대상이 아니다).
 * 이름만으로 취소로 단정하면 안 된다 — 호출부가 `signal?.aborted === true` 와 함께 본다(어댑터가 자기 타이머로 만든 AbortError 가 새도 진짜 오류가 취소로 둔갑하지 않게).
 */
export const isAbortError = (e: unknown): boolean => (e as { name?: unknown } | null)?.name === 'AbortError'

/** 분류된 `ApiError` 라 `withApi` 가 500 도 오류 로그도 내지 않는다(#47 `cancelledError`·#180 과 같은 모양). 응답을 읽을 손님이 이미 없다. */
export const cancelledError = (): ApiError => new ApiError('CONFLICT', '요청이 취소됐어요.', { reason: 'CANCELLED' })
