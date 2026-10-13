/**
 * 「무엇이든 물어보세요」(ASK, task-064 3a) 클라이언트·서버 공용 DTO — api-contract §2-18-A 의 모양을 그대로 옮긴 타입이다.
 * 서버 모듈(Prisma 타입)을 import 하지 않는다. 채팅 공용 타입(`./chat`)은 고치지 않고 ASK 전용 값만 여기 둔다
 * (화면 dev-U 가 먼저 만들고 서버 dev-S2 가 같은 파일을 import 한다 — 한쪽만 바뀌지 않게).
 */
import type { ChatMessage } from './chat'

/** #32 요청 `scope.key`·`done.needsScope.options[].key` — 이번 주(KST 월~일)·지난 30일·전체 기간. */
export type AskScopeKey = 'THIS_WEEK' | 'LAST_30D' | 'ALL'
export const ASK_SCOPE_KEYS: readonly AskScopeKey[] = ['THIS_WEEK', 'LAST_30D', 'ALL']

/** 근거 유형(§2-18-A 3항 — 단어장 단어는 외부 전송 범위 밖이라 `WORD` 유형 없음). */
export type AskSourceType = 'LESSON' | 'CORRECTION' | 'SCENARIO' | 'REVIEW' | 'STUDY_LOG' | 'EVALUATION'
export const ASK_SOURCE_TYPES: readonly AskSourceType[] = ['LESSON', 'CORRECTION', 'SCENARIO', 'REVIEW', 'STUDY_LOG', 'EVALUATION']

export type AskConfidence = 'HIGH' | 'MEDIUM' | 'LOW'
export const ASK_CONFIDENCES: readonly AskConfidence[] = ['HIGH', 'MEDIUM', 'LOW']

/** 서버 규칙 의도 분류(§2-18-A 6항). */
export type AskIntent = 'PROGRESS' | 'EXPRESSION' | 'GENERAL' | 'MIXED'
export const ASK_INTENTS: readonly AskIntent[] = ['PROGRESS', 'EXPRESSION', 'GENERAL', 'MIXED']

/**
 * 근거 한 건 — 서버가 LLM `sourceKeys` 를 실제 조회 행으로 풀어 만든다(LLM 이 만들지 않는다).
 * `id`: `SCENARIO` 는 역할극 방 chatId, 그 밖은 그 기록의 id. **집계 항목(기간 학습 요약·복습 대기 수·교정 유형 누적)은 가리킬 행이 없어 `null`**
 * (계약 §2-18-A 3항). `date`: `YYYY-MM-DD`(KST). `label`: 표시용 짧은 글(≤60자).
 * `type`: 화면이 읽은 값 — 계약 목록 밖(이전·미래 서버 값)은 `askMetaOf` 가 `null` 로 바꿔 라벨만 그린다(Leader 2026-10-12).
 */
export interface AskSource {
  type: AskSourceType | null
  id: string | null
  date: string
  label: string
}

export interface AskScopeOption {
  key: AskScopeKey
  label: string
}

/** 기간 되묻기 — 고정 칩(이번 주·지난 30일·전체 기간) + 되묻는 문장. */
export interface AskNeedsScope {
  prompt: string
  options: AskScopeOption[]
}

/** 「관련 기록을 못 찾았어요」 줄의 서버 신호 — 기록 의도인데 `count=0`. */
export interface AskRecords {
  intent: AskIntent
  count: number
}

/** 답의 구조화 값 — #29 ASK ASSISTANT 메시지의 `ask` 객체 = 서버 `toolLog.ask`. 화면은 `askMetaOf` 로 검사한 뒤에만 쓴다. */
export interface AskMeta {
  sources: AskSource[]
  confidence: AskConfidence
  needsScope: AskNeedsScope | null
  records: AskRecords | null
}

/** #32 ASK `done.conversation`(§2-18-A 3항). `answerMd` 는 한국어 마크다운 ≤4,000자(서버 살균 뒤), `replyKo` 는 늘 null. */
export interface AskDoneConversation {
  answerMd: string
  replyKo: null
  sources: AskSource[]
  confidence: AskConfidence
  needsScope: AskNeedsScope | null
  records: AskRecords
}

/**
 * #32 ASK 요청 본문 — `inputSource` 는 글자 `TEXT` 또는 말 `REALTIME_STT`(task-066 — 인식된 일본어 글만, 발화 id 는 싣지 않는다: 서버가 400),
 * `scope` 는 ASK 한정·직전 답이 되물었을 때만 쓰인다.
 */
export interface AskTurnRequest {
  text: string
  inputSource: 'TEXT' | 'REALTIME_STT'
  scope?: { key: AskScopeKey }
}

/** #29 메시지(ASK) — ASSISTANT 에 한해 `ask` 객체가 붙는다(USER·옛 행은 없음). */
export interface AskChatMessage extends ChatMessage {
  ask?: AskMeta | null
}

/** ASK 3a 에서 서버가 내고 화면이 그리는 제안 종류(`ADD_TOPIC` 은 3a 범위 밖 — Leader 결정 L-2). */
export type AskProposalKind = 'ADD_WORD' | 'ADD_STUDY_LOG' | 'SET_LEVEL'
export const ASK_PROPOSAL_KINDS: readonly AskProposalKind[] = ['ADD_WORD', 'ADD_STUDY_LOG', 'SET_LEVEL']
