/**
 * A11 복습 판단(REVIEW_DECISION) — design-spec §7-4·§8 A11, learning-personalization §2-5, task-010b Leader's Plan L2.
 * "무엇을 언제(3~7일 사이) 다시 볼지"는 강사(LLM)가 정하고, **그 범위를 지키게 만드는 것은 스키마가 아니라 코드**다
 * (`normalizeReviewDecision`, `structuredResponse/reviewRepair.ts`) — 범위 밖 값·FOCUS 초과·입력에 없는 id 는
 * LLM 에게 재시도를 시키지 않고 코드가 결정적으로 고친다(learning-personalization §2-5 "코드 후검증: 범위 밖 값
 * 클램프·누락 폴백" — A4 lesson@v2 의 `repairLessonResponse` 와 같은 방향의 설계, [[llm-japanese-quality]] §8).
 * 그래서 `nextIntervalDays` 는 스키마에서 3~7 보다 넉넉한 정수 범위만 요구한다 — ajv 가 여기서 막아 버리면 불필요한
 * 재시도(레이턴시)만 늘어나고, 클램프는 항상 결정적으로 고칠 수 있어 재시도가 필요 없다.
 *
 * `reviewSchemas.ts`/`reviewChecks.ts`/`reviewRepair.ts` 를 `schemas.ts`/`checks.ts`(다른 prompt-engineer 가 평가
 * 프롬프트 작업으로 동시에 건드리는 파일) 와 분리해 새로 둔 이유는 파일 충돌을 피하기 위해서다(task-010b 지시).
 */
export const REVIEW_PRIORITIES = ['NORMAL', 'FOCUS'] as const
export type ReviewPriority = (typeof REVIEW_PRIORITIES)[number]

export interface ReviewDecisionItem {
  itemId: string
  nextIntervalDays: number
  priority: ReviewPriority
  reason_ko: string
}

export interface ReviewSessionPlan {
  itemIds: string[]
  mixNote_ko: string
}

export interface ReviewDecisionResponse {
  decisions: ReviewDecisionItem[]
  sessionPlan: ReviewSessionPlan
  rationale_ko: string
}

/** 후보 상한(design-spec §8 A11 "≤40건") — `prompts/reviewDecision.ts`·`reviewRepair.ts` 가 공유. */
export const REVIEW_DECISION_MAX_ITEMS = 40
/** `reason_ko` 상한(task-010b 지시 "reason_ko ≤80"). */
const REASON_MAX = 80
/** `rationale_ko` 상한(design-spec §8 A11 출력 계약). */
const RATIONALE_MAX = 300
/** `sessionPlan.mixNote_ko` 상한 — REVIEW_DECISION 헤더 상한(600)보다 훨씬 작게, 한 줄 설명 정도로. */
const MIX_NOTE_MAX = 200

const reviewDecisionItem = {
  type: 'object',
  additionalProperties: false,
  required: ['itemId', 'nextIntervalDays', 'priority', 'reason_ko'],
  properties: {
    itemId: { type: 'string', minLength: 1, maxLength: 40 },
    // 3~7 강제는 코드(normalizeReviewDecision)의 몫 — 여기서는 터무니없는 값만 막는다(협소한 범위로 재시도를 늘리지 않는다).
    nextIntervalDays: { type: 'integer', minimum: 1, maximum: 30 },
    priority: { type: 'string', enum: [...REVIEW_PRIORITIES] },
    reason_ko: { type: 'string', minLength: 1, maxLength: REASON_MAX },
  },
} as const

const reviewSessionPlan = {
  type: 'object',
  additionalProperties: false,
  required: ['itemIds', 'mixNote_ko'],
  properties: {
    itemIds: { type: 'array', minItems: 0, maxItems: REVIEW_DECISION_MAX_ITEMS, items: { type: 'string', minLength: 1, maxLength: 40 } },
    mixNote_ko: { type: 'string', minLength: 1, maxLength: MIX_NOTE_MAX },
  },
} as const

export const REVIEW_DECISION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['decisions', 'sessionPlan', 'rationale_ko'],
  properties: {
    // minItems:1 — 후보가 있으면(호출 전제) 최소 하나는 판단해야 한다. 나머지는 normalizeReviewDecision 이 폴백으로 채운다.
    decisions: { type: 'array', minItems: 1, maxItems: REVIEW_DECISION_MAX_ITEMS, items: reviewDecisionItem },
    sessionPlan: reviewSessionPlan,
    rationale_ko: { type: 'string', minLength: 1, maxLength: RATIONALE_MAX },
  },
} as const
