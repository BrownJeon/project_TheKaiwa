/**
 * 발화 기록 화면 ↔ 서버 DTO(task-012b-2) — #21c 내 발화 목록 · #22 발화 조회 · #21a 확정 요청의 필드명 그대로.
 * 엔진 이름·신뢰도 숫자·임계(`engineVersions`·`transcriptConfidence`)는 목록에 싣지 않는다 — 화면이 숫자를 쓰지 않는다(가이드 §3 D-1).
 * 화면은 서버 모듈을 import 하지 않고 이 파일만 본다(module-dependency §3 규칙 5). `types/chat.ts` 와 섞지 않는다(파일 경계 C12).
 */

export type UtteranceStatus = 'RECORDED' | 'QUEUED' | 'ANALYZED' | 'FAILED'
export type UtteranceFinalSource = 'REALTIME' | 'ANALYSIS' | 'USER'
export type UtteranceResolveChoice = UtteranceFinalSource

/**
 * 발화가 쓰인 곳. TALK = 회화 메시지로 보냄(`id` = 대화방, 옛 행은 null) · LESSON = 오늘의 회화 수업(`id` = 수업) ·
 * EVALUATION = AI 평가 문항(`id` = 평가 — 아직 조회 경로가 없어 null) ·
 * ROOM_ONLY = 방에서 녹음했지만 메시지로 보내지 않음(`id` = 대화방 — 방이 남아 있다는 뜻, 다시 녹음·글자로 고쳐 보냄 등, 화면 "보내지 않은 말") ·
 * UNSENT = 방 연결도 없음(방 밖 녹음·옛 행·연결된 대화가 지워짐·평가 답으로 녹음했지만 내지 않음 — 화면은 원인을 단정하지 않는 "연결된 대화 없음") ·
 * DELETED = 예약(지운 대화를 구분할 근거가 데이터에 없어 지금은 보내지 않는다 — 대화 삭제 시 방·메시지 연결이 함께 비워진다).
 * 값은 늘기만 한다 — 화면은 모르는 값을 UNSENT 문구로 보인다(`contextOf`).
 */
export type UtteranceContextKind = 'TALK' | 'LESSON' | 'EVALUATION' | 'ROOM_ONLY' | 'UNSENT' | 'DELETED'

export interface UtteranceContext {
  kind: UtteranceContextKind
  id: string | null
}

/** #21c 목록 한 줄. */
export interface UtteranceListItem {
  id: string
  createdAt: string
  durationMs: number
  status: UtteranceStatus
  realtimeText: string
  /** 분석이 끝난(`ANALYZED`) 발화만 — 그 밖 null. */
  analysisText: string | null
  finalText: string | null
  finalSource: UtteranceFinalSource
  requiresReview: boolean
  /** 분석 때 "다르게 들렸다"로 판정됐었는가(확정 뒤에도 true) — 서버가 판정 스냅샷으로 계산한다. */
  wasReviewTarget: boolean
  /** 원음(#21b)을 아직 받을 수 있는가(30일 보관·지워지지 않음). */
  audioAvailable: boolean
  chatMessageId: string | null
  context: UtteranceContext
}

export interface UtteranceListDto {
  items: UtteranceListItem[]
  nextCursor: string | null
  /** 같은 범위(`chatId` 가 있으면 그 방)에서 지금 확인할 수 있는 발화 수 — `reviewable`·`cursor` 와 무관. */
  reviewableCount: number
}

/** #22 · #21a 응답(화면이 쓰는 칸만). */
export interface UtteranceViewDto {
  id: string
  chatMessageId: string | null
  durationMs: number
  status: UtteranceStatus
  realtimeText: string
  analysisText: string | null
  requiresReview: boolean
  finalText: string | null
  finalSource: UtteranceFinalSource
  audioUrl: string | null
}

export type UtteranceResolveBody = { choice: 'REALTIME' | 'ANALYSIS' } | { choice: 'USER'; text: string }
