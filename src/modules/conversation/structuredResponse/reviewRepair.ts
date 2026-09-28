/**
 * A11 복습 판단(REVIEW_DECISION) 결정적 보정 — design-spec §7-4·§8 A11, learning-personalization §2-5.
 *
 * **왜 `extraCheck`(재시도)가 아니라 별도 함수인가**: A4 lesson@v2 의 `repairLessonResponse` 는 "채울 수 없으면
 * 위반으로 남겨 재시도로 보낸다"는 탈출구가 있었다(그래도 재시도에서 못 고치는 경우가 실측으로 발견됐다,
 * [[llm-japanese-quality]] §8). REVIEW_DECISION 은 그 탈출구 자체가 필요 없다 — 범위 클램프(3~7)·FOCUS 상한(≤3)·
 * 입력에 없는 id 폐기·누락 항목 폴백은 **모델의 협조 없이 코드만으로 항상 완전히 고칠 수 있는 결정적 연산**이라서다
 * (정수를 자르고, 모르는 id 를 버리고, 빠진 항목에 기존 값을 채우는 데는 재시도가 필요 없다). 그래서 이 함수는
 * `buildReviewDecisionRequest` 의 `extraCheck` 로 연결하지 않고, `llm.completeJson` 이 반환한 뒤 **호출자(잡 실행기,
 * developer)** 가 한 번 더 불러 최종 값을 만든다 — task-010b 지시("코드 후검증/보정 함수 normalizeReviewDecision").
 *
 * 규칙(Leader's Plan L2·learning-personalization §2-5 "코드 후검증" 그대로):
 *  1. `decisions[].itemId` 가 후보 풀(`input.candidates`)에 없으면 그 결정은 버린다(입력에 없던 id 폐기 — 환각 방어).
 *  2. 같은 itemId 가 여러 번 나오면 처음 것만 쓴다(방어적 — 스키마가 중복을 막지 않는다).
 *  3. 살아남은 결정의 `nextIntervalDays` 를 3~7 로 클램프하고, `priority==='FOCUS'` 면 추가로 ≤3 으로 더 클램프한다
 *     (범위 하한이 이미 3 이라 FOCUS 의 최종값은 사실상 3 — design-spec §7-4 "FOCUS 인 동안은 3일을 넘길 수 없다").
 *  4. 후보 풀에는 있지만 모델이 판단하지 않은(또는 ①·②로 버려진) 항목은 **폴백**을 채운다: 후보가 가진 현재
 *     `intervalDays` 를 그대로 3~7 로 클램프해 쓰고, 현재값이 없으면(신규 항목) 초기값 3. `priority` 는 후보가 가진
 *     현재 우선순위를 유지한다(모른다고 FOCUS 를 임의로 풀거나 걸지 않는다).
 *  5. `sessionPlan.itemIds` 는 후보 풀의 부분집합만 남긴다(중복 제거, 순서 보존) — "출력 서브셋 ⊆ 입력 풀" 규칙을
 *     `chunks ⊆ mixSpec`(A5)와 같은 방향으로 적용한 것.
 *  6. `rationale_ko`·`sessionPlan.mixNote_ko` 는 그대로 통과시킨다(엔진명 노출 등은 `reviewChecks.ts` 의 재시도용
 *     검사가 이미 걸렀다는 전제 — 이 함수는 그 검사 뒤에 부른다).
 *
 * 반환하는 `decisions` 는 **후보 풀 전체를 정확히 한 번씩** 담는다(입력 40건이면 출력도 40건) — 호출자가 이후
 * `RepetitionItem` 을 upsert 할 때 "판단 못 받은 항목"을 따로 처리할 필요가 없게 하기 위해서다.
 */
import type { ReviewDecisionItem, ReviewDecisionResponse, ReviewPriority, ReviewSessionPlan } from './reviewSchemas'

export const REVIEW_INTERVAL_MIN = 3
export const REVIEW_INTERVAL_MAX = 7
/** FOCUS 항목의 상한 — 전역 하한(3)과 만나 사실상 고정값 3 이 된다(design-spec §7-4). */
export const REVIEW_FOCUS_INTERVAL_MAX = 3
/** 폴백(신규 항목·판단 정보 없음)일 때 쓰는 초기 간격(design-spec §7-4 "초기 3"). */
export const REVIEW_FALLBACK_INTERVAL_DAYS = 3
/** 폴백 결정에 남기는 한국어 근거 — 학습자에게 보일 수 있으므로 짧고 사실만(지어내지 않는다). */
export const REVIEW_FALLBACK_REASON_KO = '이번엔 판단하지 못해 기존 간격을 유지해요'

function clampInterval(days: number): number {
  return Math.min(REVIEW_INTERVAL_MAX, Math.max(REVIEW_INTERVAL_MIN, Math.round(days)))
}

function finalizeInterval(days: number, priority: ReviewPriority): number {
  const base = clampInterval(days)
  return priority === 'FOCUS' ? Math.min(base, REVIEW_FOCUS_INTERVAL_MAX) : base
}

/** `normalizeReviewDecision` 의 입력 — `prompts/reviewDecision.ts` 의 `ReviewDecisionCandidateInput` 에서 이 세 필드만 뽑아 넘긴다. */
export interface ReviewDecisionCandidateRef {
  itemId: string
  /** 현재(갱신 전) 간격 — 폴백 때 이 값을 클램프해 쓴다. 신규 항목처럼 없으면 생략(그러면 초기값 3). */
  intervalDays?: number | null
  /** 현재(갱신 전) 우선순위 — 폴백 때 유지한다. 생략하면 NORMAL. */
  priority?: ReviewPriority
}

export interface ReviewDecisionNormalizeResult {
  decisions: ReviewDecisionItem[]
  sessionPlan: ReviewSessionPlan
  rationale_ko: string
  /** 로그용 보정 집계(task-010b 지시 "결과에 보정·폴백 건수"). */
  counts: {
    /** 3~7(또는 FOCUS 3) 클램프로 값이 바뀐 결정 수. */
    clamped: number
    /** 후보 풀에 없는 itemId 를 참조해 버린 결정 수(중복 포함). */
    discarded: number
    /** 모델이 판단하지 않아 폴백으로 채운 항목 수. */
    fallback: number
    /** `sessionPlan.itemIds` 에서 후보 풀 밖이라 뺀 개수. */
    sessionPlanPruned: number
  }
}

export function normalizeReviewDecision(input: { candidates: ReviewDecisionCandidateRef[] }, data: ReviewDecisionResponse): ReviewDecisionNormalizeResult {
  const byId = new Map(input.candidates.map((c) => [c.itemId, c]))
  const seen = new Set<string>()
  let clamped = 0
  let discarded = 0

  const decisions: ReviewDecisionItem[] = []
  for (const d of data.decisions) {
    const cand = byId.get(d.itemId)
    if (!cand || seen.has(d.itemId)) {
      discarded++
      continue
    }
    seen.add(d.itemId)
    const finalInterval = finalizeInterval(d.nextIntervalDays, d.priority)
    if (finalInterval !== d.nextIntervalDays) clamped++
    decisions.push({ itemId: d.itemId, nextIntervalDays: finalInterval, priority: d.priority, reason_ko: d.reason_ko })
  }

  let fallback = 0
  for (const cand of input.candidates) {
    if (seen.has(cand.itemId)) continue
    const priority: ReviewPriority = cand.priority ?? 'NORMAL'
    const base = cand.intervalDays != null && cand.intervalDays > 0 ? cand.intervalDays : REVIEW_FALLBACK_INTERVAL_DAYS
    decisions.push({ itemId: cand.itemId, nextIntervalDays: finalizeInterval(base, priority), priority, reason_ko: REVIEW_FALLBACK_REASON_KO })
    fallback++
  }

  const poolIds = new Set(input.candidates.map((c) => c.itemId))
  const seenPlan = new Set<string>()
  const itemIds: string[] = []
  let sessionPlanPruned = 0
  for (const id of data.sessionPlan.itemIds) {
    if (!poolIds.has(id) || seenPlan.has(id)) {
      sessionPlanPruned++
      continue
    }
    seenPlan.add(id)
    itemIds.push(id)
  }

  return {
    decisions,
    sessionPlan: { itemIds, mixNote_ko: data.sessionPlan.mixNote_ko },
    rationale_ko: data.rationale_ko,
    counts: { clamped, discarded, fallback, sessionPlanPruned },
  }
}
