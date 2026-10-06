/**
 * 상황 역할극 종료 판정(`scenarioVerdict`) 응답 계약 — task-010d A1-PE. 프롬프트는 `prompts/scenarioVerdict.ts`.
 *
 * 설계(왜 모델 출력이 `learning.scenario` 모양과 다른가):
 *  - 모델은 **증거(evidence) → 순서 도달 수 → 의사소통 → 목표** 순으로 낸다. 증거 `{id, quote}` 는 "학습자가 그 핵심 표현을 쓴 말"을 글자 그대로 옮기게 해 판정이 근거 위에 서게 한다.
 *    `usedExpressionIds`·`missedExpressionIds` 는 **모델이 따로 내지 않는다** — 증거의 id 와 코드 확인분에서 코드가 만든다(`finalizeScenarioVerdict`). 같은 정보를 두 번 쓰게 하면 출력이 길어지고
 *    둘이 어긋날 때 어느 쪽을 믿을지 정할 수 없다.
 *  - **근거 없는 인정 방지**(A1-서버 해석 1 `[추측]` 의 코드 쪽 답): 증거의 id 가 목록 밖이거나 quote 가 학습자 말에 글자 그대로 들어 있지 않으면 그 id 는 "썼다"로 세지 않는다(선생님이 먼저 한 말·지어낸 인용을 막는다).
 *    걸러진 주장은 `rejectedClaims` 로 남겨 호출부가 Trace 에 수치만 기록할 수 있다(학습자 말 원문은 어디에도 남기지 않는다). 재시도는 걸지 않는다 — 20s 안의 판정 호출이 두 배가 되지 않게 코드가 결정적으로 고친다
 *    (A11 `normalizeReviewDecision` 과 같은 방향).
 *  - 코드가 이미 확인한 표현(`verifiedExpressionIds`)은 증거 없이 "쓴 것"이다(코드 규칙의 입력 — `learning/scenarios/expressions.ts`). 결과의 `usedExpressionIds` 는 (증거로 뒷받침된 모델 주장 ∪ 코드 확인) 이다.
 *    학습 쪽 최종 결합(`judgeScenarioCompletion`)이 같은 합집합을 다시 만들어도 결과는 같다(멱등).
 *  - 결과 객체는 `learning.normalizeScenarioVerdict(raw, expressionIds)` 가 그대로 읽는 모양이다 — `{goalAchieved, communicationSuccess, usedExpressionIds, missedExpressionIds}`(+ 읽지 않는 `stepsReached`·`rejectedClaims`).
 */

/** 표현 상한 — `learning/scenarios/expressions.ts` `SCENARIO_EXPRESSION_MAX` 와 같은 값(L2 가 L3 상수를 import 하지 않게 복제, 테스트가 같은지 대조). */
export const SCENARIO_VERDICT_EXPRESSION_MAX = 12
/** 순서(`steps`) 상한 — `prompts/scenarioVerdict.ts` 가 입력에서 자르는 수와 같다. */
export const SCENARIO_VERDICT_STEPS_MAX = 8
export const SCENARIO_VERDICT_QUOTE_MAX = 200

export interface ScenarioVerdictEvidence {
  id: string
  quote: string
}

export interface ScenarioVerdictResponse {
  evidence: ScenarioVerdictEvidence[]
  stepsReached: number
  communicationSuccess: boolean
  goalAchieved: boolean
}

const idString = { type: 'string', minLength: 1, maxLength: 40 } as const

export const SCENARIO_VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['evidence', 'stepsReached', 'communicationSuccess', 'goalAchieved'],
  properties: {
    // 선언 순서 = 출력 순서 지시(증거가 판정보다 먼저 나온다). 증거 없음은 빈 배열.
    evidence: {
      type: 'array',
      maxItems: SCENARIO_VERDICT_EXPRESSION_MAX,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'quote'],
        properties: {
          id: idString,
          quote: { type: 'string', minLength: 1, maxLength: SCENARIO_VERDICT_QUOTE_MAX },
        },
      },
    },
    // 범위(0~단계 수) 맞추기는 코드(`finalizeScenarioVerdict`)의 몫 — 여기서는 터무니없는 값만 막는다(좁은 범위로 재시도를 늘리지 않는다).
    stepsReached: { type: 'integer', minimum: 0, maximum: 30 },
    communicationSuccess: { type: 'boolean' },
    goalAchieved: { type: 'boolean' },
  },
} as const

/**
 * 걸러낸 이유 — UNKNOWN_ID(목록 밖) · NO_QUOTE_MATCH(인용이 학습자 말에 글자 그대로 없음 — 선생님 말·지어낸 인용 포함) ·
 * LOOSE_MATCH(인용은 학습자 말에 있으나 그 표현과 겹치는 글자가 너무 적음 — 일부 낱말만 쓰거나 뜻만 비슷한 말을 "썼다" 한 경우).
 */
export type ScenarioClaimRejection = 'UNKNOWN_ID' | 'NO_QUOTE_MATCH' | 'LOOSE_MATCH'

/** 인용이 표현과 겹쳐야 하는 최소 비율(가장 긴 공통 부분 문자열 ÷ 표현 글자 수). 실측: 일부 낱말만(「大きい」↔「大きいサイズ」 = 0.5)·뜻만 비슷한 말은 걸러지고 활용 변형(「ございました」↔「ございます」 ≈ 0.8)은 남는다. */
export const SCENARIO_VERDICT_OVERLAP_MIN = 0.6

export interface ScenarioVerdictFinal {
  goalAchieved: boolean
  communicationSuccess: boolean
  /** 표현 목록 순서. ⊆ expressionIds. */
  usedExpressionIds: string[]
  missedExpressionIds: string[]
  /** 0~순서 단계 수. 순서가 없으면 0. */
  stepsReached: number
  /** 걸러낸 모델 주장(근거 없는 인정) — Trace 수치용. quote 원문은 담지 않는다. */
  rejectedClaims: { id: string; reason: ScenarioClaimRejection }[]
}

export interface FinalizeScenarioVerdictInput {
  /** 판정 대상 표현 id(목록 순서) — `readScenarioExpressions` 결과. */
  expressionIds: readonly string[]
  /** 학습자 말(원문 — 증거 대조에만 쓰고 저장하지 않는다). 선생님 말은 넣지 않는다. */
  learnerTexts: readonly string[]
  /** 표현 id → 표기(`ja`). 주면 모델이 댄 증거가 그 표현과 충분히 겹치는지(`SCENARIO_VERDICT_OVERLAP_MIN`, 핵심 1자 이하 표현은 인용 안에 글자 그대로 — `overlapsExpression`)도 본다 — 그 id 의 표기를 안 주면 이 검사를 건너뛴다. */
  expressionTexts?: Readonly<Record<string, string>>
  /** 코드가 이미 학습자 말에서 확인한 표현 id. */
  verifiedExpressionIds?: readonly string[]
  /** 대화의 순서 단계 수(없으면 0). */
  stepCount?: number
}

/** 증거 대조용 정규화 — 폭·호환 문자(NFKC)·공백·문장부호를 걷어 낸다(음성 인식 결과의 공백·구두점 차이에 흔들리지 않게). 가나 종류는 합치지 않는다. */
export function normalizeForQuote(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[。、，．,.!?！？「」『』()（）［］\[\]"'“”‘’…・･~〜〰:：;；]/g, '')
}

const asBool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)

/** 두 글자열의 가장 긴 공통 부분 문자열 길이(코드포인트). 표현·인용은 짧아(≤200) 이중 루프로 충분하다. */
function longestCommonRun(a: readonly string[], b: readonly string[]): number {
  let best = 0
  let prev = new Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0)
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1] + 1
        if (cur[j] > best) best = cur[j]
      }
    }
    prev = cur
  }
  return best
}

/** 표현 표기에서 비교용 핵심(〜·문장부호·공백 제외). */
const expressionCore = (ja: string): string[] => Array.from(normalizeForQuote(ja))

/**
 * 인용(`quote`, 정규화·코드포인트 배열)이 표현(`core`)을 충분히 담았는가 — 증거 대조의 겹침 검사.
 *  - 핵심 2자 이상: 가장 긴 공통 부분 문자열이 `max(2, ceil(0.6×핵심 글자 수))` 이상.
 *  - **핵심 1자**(예: `〜を`·`〜は`)와 **핵심 0자**(표기가 문장부호뿐)는 비율이 의미 없다. 이전에는 이 경우 검사를 건너뛰어 학습자 말에 있는 아무 2자 인용이나 인정됐다(REV-137 L-3) —
 *    이제 1자는 **인용 안에 그 글자가 그대로** 있어야 인정하고(정확 부분문자열), 0자는 인용으로는 인정하지 않는다(코드 확인 `verifiedExpressionIds` 만 인정한다).
 */
function overlapsExpression(quote: readonly string[], core: readonly string[]): boolean {
  if (core.length === 0) return false
  if (core.length === 1) return quote.includes(core[0])
  return longestCommonRun(quote, core) >= Math.max(2, Math.ceil(core.length * SCENARIO_VERDICT_OVERLAP_MIN))
}

/**
 * 모델 응답 → 학습 쪽이 읽는 판정 객체. 스키마를 통과한 응답을 받지만 방어적으로 읽는다(타입이 어긋난 값은 버림).
 * - 증거: id 가 목록 안이어야 하고 `quote` 정규화 값이 **어느 한 학습자 말**의 정규화 값에 들어 있어야 인정. 아니면 `rejectedClaims`.
 * - 쓴 표현 = 인정된 증거 id ∪ 코드 확인 id(표현 목록 순서). 못 쓴 표현 = 나머지 전부.
 * - `stepsReached` 는 0~단계 수로 자른다.
 */
export function finalizeScenarioVerdict(input: FinalizeScenarioVerdictInput, data: ScenarioVerdictResponse): ScenarioVerdictFinal {
  const known = new Set(input.expressionIds)
  const learner = input.learnerTexts.map(normalizeForQuote).filter(Boolean)
  const credited = new Set<string>()
  const rejectedClaims: ScenarioVerdictFinal['rejectedClaims'] = []
  const seenClaim = new Set<string>()
  for (const e of Array.isArray(data?.evidence) ? data.evidence : []) {
    const id = typeof e?.id === 'string' ? e.id : ''
    const quote = typeof e?.quote === 'string' ? normalizeForQuote(e.quote) : ''
    if (!id || seenClaim.has(id)) continue
    seenClaim.add(id)
    if (!known.has(id)) {
      rejectedClaims.push({ id, reason: 'UNKNOWN_ID' })
      continue
    }
    // 한 글자 인용은 아무 말에나 들어맞는다 — 2자 이상만 증거로 본다.
    if (!(Array.from(quote).length >= 2 && learner.some((t) => t.includes(quote)))) {
      rejectedClaims.push({ id, reason: 'NO_QUOTE_MATCH' })
      continue
    }
    const ja = input.expressionTexts?.[id]
    if (typeof ja === 'string' && !overlapsExpression(Array.from(quote), expressionCore(ja))) {
      rejectedClaims.push({ id, reason: 'LOOSE_MATCH' })
      continue
    }
    credited.add(id)
  }
  for (const id of input.verifiedExpressionIds ?? []) if (known.has(id)) credited.add(id)
  const usedExpressionIds = input.expressionIds.filter((id) => credited.has(id))
  const used = new Set(usedExpressionIds)
  const stepCount = Math.max(0, Math.floor(input.stepCount ?? 0))
  const reached = Number.isFinite(data?.stepsReached) ? Math.floor(data.stepsReached) : 0
  return {
    goalAchieved: asBool(data?.goalAchieved) ?? false,
    communicationSuccess: asBool(data?.communicationSuccess) ?? false,
    usedExpressionIds,
    missedExpressionIds: input.expressionIds.filter((id) => !used.has(id)),
    stepsReached: Math.max(0, Math.min(stepCount, reached)),
    rejectedClaims,
  }
}
