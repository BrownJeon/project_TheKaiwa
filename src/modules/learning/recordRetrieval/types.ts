/**
 * ASK(무엇이든 물어보세요) 기록 조회 계층의 타입·상한 — 정본 api-contract §2-18-A 5항·learning-personalization §3-2·§8 D2=(b).
 *
 * 외부 전송 범위(D2=(b), 사용자가 승인한 「보내는 범위」 동의 문구와 같다 — 2026-10-12 Leader 정정): 이 계층이 내보낼 수 있는 것은
 *   ① 공부 기록 요약(횟수·점수·복습 예정 목록 — 연속 출석 일수는 보내지 않는다) ② 채택(ACCEPTED) 교정의 원래 문장·고친 문장(+ 오류 유형 라벨) ③ 수업(레슨)에서 배운 표현 뿐이다.
 *   교정 설명·역할극 표현·단어장 단어는 **읽지도 않는다**(상황 연습은 「역할극 「제목」 마침」 수준의 요약만).
 *
 * `ExternalRecordItem` 은 **외부(LLM) 로 나가는 유일한 모양**이다 — 허용 필드(key·type·dateKst·text·label)만 있고 내부 id·userId·이메일은
 * 타입에 없다. 실제 행 참조(`RecordSourceRef`)는 `sourceMap` 에만 있고 서버 안에서 `sourceKeys` → `sources[]` 로 풀 때만 쓴다.
 */

export const ASK_INTENTS = ['PROGRESS', 'EXPRESSION', 'GENERAL', 'MIXED'] as const
export type AskIntent = (typeof ASK_INTENTS)[number]

export const ASK_SCOPE_KEYS = ['THIS_WEEK', 'LAST_30D', 'ALL'] as const
export type AskScopeKey = (typeof ASK_SCOPE_KEYS)[number]
export interface AskScope {
  key: AskScopeKey
}

/** 범위를 정하지 않은 기록 조회(되묻기 대상이 아닌 질문 — 복습 남은 것·「저번에 쓰던 표현 뭐였지」 류)는 전체 기간에서 최근순 상한으로 찾는다. */
export const ASK_DEFAULT_SCOPE: AskScope = { key: 'ALL' }

/** 단어장 단어는 외부 전송 범위 밖이라 `WORD` 종류가 없다(계약 3항). */
export const RECORD_SOURCE_TYPES = ['LESSON', 'CORRECTION', 'SCENARIO', 'REVIEW', 'STUDY_LOG', 'EVALUATION'] as const
export type RecordSourceType = (typeof RECORD_SOURCE_TYPES)[number]

export const RETRIEVAL_FUNCTIONS = ['getProgressSummary', 'getDueReviews', 'getRecentCorrections', 'findExpressions', 'getLessonsByTopic', 'getSkillState'] as const
export type RetrievalFunctionName = (typeof RETRIEVAL_FUNCTIONS)[number]

/** 프롬프트로 나가는 항목 — 이 다섯 칸 말고는 없다(내부 id·userId·이메일 금지, 계약 5항). */
export interface ExternalRecordItem {
  /** 턴 안 임시 키 `S1`…`Sn`(연속·중복 없음). */
  readonly key: string
  readonly type: RecordSourceType
  /** KST 달력 날짜 `YYYY-MM-DD`. */
  readonly dateKst: string
  /** ≤300자, 한 줄(줄바꿈·제어문자 없음). */
  readonly text: string
  /** ≤60자, 한 줄. 화면 근거 카드 라벨과 같다. */
  readonly label: string
}

/**
 * 서버 내부용 실제 참조 — 프롬프트에 가지 않는다. `id` 는 종류별 행 id(`SCENARIO` 는 역할극 방 `chatId`).
 * `id=null` 은 집계 항목(기간 학습 요약 STUDY_LOG·복습 대기 수 REVIEW·교정 유형 누적 CORRECTION)이라 열 행이 없다:
 * 화면은 `type` 별 기본 위치로 보내거나(REVIEW → 오늘 탭, CORRECTION → 교정 모음) 누를 수 없는 라벨로 그린다. SCENARIO 는 늘 id 가 있다.
 */
export interface RecordSourceRef {
  type: RecordSourceType
  id: string | null
  date: string
  label: string
}

export interface RetrievalMeta {
  /** 나간 항목 수(= items.length). */
  count: number
  /** 이 의도에서 실제로 부른 화이트리스트 함수(부른 순서). GENERAL 은 빈 배열. */
  functionsCalled: RetrievalFunctionName[]
  /** 상한(건수·총 글자·항목 글자) 때문에 빠지거나 줄어든 후보가 있었는지. */
  truncated: boolean
  /** 실제 적용한 범위(입력이 null 이면 기본값). */
  scopeKey: AskScopeKey
  elapsedMs: number
}

export interface RetrievalResult {
  intent: AskIntent
  items: ExternalRecordItem[]
  sourceMap: Record<string, RecordSourceRef>
  meta: RetrievalMeta
}

/** 계약 5항 상한. `totalChars` 는 항목 `text`+`label` 코드포인트 합(프롬프트 블록이 둘 다 싣는다 — 더 엄격한 쪽). */
export const RECORD_RETRIEVAL_LIMITS = {
  items: 20,
  totalChars: 2000,
  itemChars: 300,
  labelChars: 60,
  /** 검색어: 개수·글자 상한(정규화 뒤). */
  terms: 3,
  termChars: 20,
} as const

/**
 * 채택 교정 읽기 — `Correction` 은 L2(conversation) 소유 표라 learning 이 직접 읽지 않는다(domain-model §1).
 * 표 소유자(conversation `askCorrectionReader`)가 구현해 넘긴다. 구현은 `userId`·`status=ACCEPTED` 를 where 에 걸고
 * 아래 칸만 select 해야 한다(설명 `explanation` 은 전송 범위 밖이라 칸 자체가 없다) — learning 도 `userId`·`status` 를 다시 걸러 이중으로 막는다.
 */
export interface AcceptedCorrectionQuery {
  /** 포함 하한(null = 하한 없음). */
  from: Date | null
  /** 미포함 상한. */
  toExclusive: Date
  /** 정규화된 검색어(빈 배열 = 최근순). 원래 문장·고친 문장에서만 찾는다. */
  terms: readonly string[]
  take: number
}

export interface AcceptedCorrectionRow {
  id: string
  userId: string
  status: string
  original: string
  corrected: string
  errorType: string
  createdAt: Date
}

export type AcceptedCorrectionReader = (userId: string, query: AcceptedCorrectionQuery) => Promise<readonly AcceptedCorrectionRow[]>

/**
 * 역할극 방 읽기 — `Chat` 도 L2 소유라 conversation(`askRolePlayReader`)이 넘긴다. 상황(`scenarioId`)이 붙은 본인 회화 방만, 메시지는 읽지 않는다.
 * 지워진 방은 행이 없으니 근거에서 저절로 빠진다(계약 3항 「방이 지워졌으면 뺀다」).
 */
export interface RolePlayQuery {
  from: Date | null
  toExclusive: Date
  take: number
}

export interface RolePlayRow {
  chatId: string
  userId: string
  scenarioId: string | null
  createdAt: Date
  endedAt: Date | null
}

export type RolePlayReader = (userId: string, query: RolePlayQuery) => Promise<readonly RolePlayRow[]>

export const isAskIntent = (v: unknown): v is AskIntent => typeof v === 'string' && (ASK_INTENTS as readonly string[]).includes(v)
export const isAskScopeKey = (v: unknown): v is AskScopeKey => typeof v === 'string' && (ASK_SCOPE_KEYS as readonly string[]).includes(v)
export const isRecordSourceType = (v: unknown): v is RecordSourceType => typeof v === 'string' && (RECORD_SOURCE_TYPES as readonly string[]).includes(v)
