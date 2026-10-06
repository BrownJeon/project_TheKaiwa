/**
 * 상황 추천 — **코드 규칙만**(LLM 0, task-010d A3a). 근거는 지난 역할극 결과(관측 `SCENARIO_COMPLETED`)·반복 항목(`RepetitionItem(SCENARIO)`)
 * 다음 학습일·학습자 수준·오늘 수업 주제. 순수 함수 — 재료는 catalog.ts 가 읽어 넘긴다.
 *
 * 상황마다 이유 하나(위에서부터 먼저 맞는 것):
 *   1. RETRY_NOT_YET — 지난 결과가 목표 전(NOT_YET·ALMOST)이고 마지막 시도가 오늘(KST) 전.
 *   2. REVIEW_DUE    — 해 본 상황이고 반복 항목의 다음 학습일이 오늘 이전·오늘(마지막 시도가 오늘 전).
 *   3. NEXT_IN_TOPIC — 안 해 본 상황 + 기준 주제(요청 `topicId` 또는 오늘 끝낸 수업의 주제)와 이어짐.
 *   4. NEW_EASY      — 안 해 본 상황 + 수준이 학습자 수준 이하(N5 학습자 → N5).
 * 이유 안 순서: 1 = NOT_YET 먼저·오래된 시도 먼저 / 2 = FOCUS 먼저·다음 학습일 이른 순 / 3 = 그 주제 weight 큰 순·난이도 낮은 순 /
 * 4 = 난이도 낮은 순·학습자 수준에 가까운 순. 끝은 만든 순·id.
 * 고르기(≤3): 1차로 이유마다 맨 앞 하나씩(1→4 순서), 남는 자리는 이유 순서대로 나머지에서 채운다 — 한 이유가 칸을 다 차지하지 않게.
 */
import type { JlptLevel, RepetitionPriority } from '@prisma/client'
import type { ScenarioOutcome, ScenarioRecommendReason } from '@/types/scenario'

export const SCENARIO_RECOMMEND_MAX = 3
export const SCENARIO_RECOMMEND_REASONS: readonly ScenarioRecommendReason[] = ['RETRY_NOT_YET', 'REVIEW_DUE', 'NEXT_IN_TOPIC', 'NEW_EASY']

const LEVEL_RANK: Record<JlptLevel, number> = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 }

export interface RecommendCandidate {
  id: string
  level: JlptLevel
  difficulty: number
  createdAt: Date
  /** 이어진(볼 수 있는) 주제 id → weight. */
  topicWeights: ReadonlyMap<string, number>
}

export interface RecommendSignals {
  /** 오늘(KST, YYYY-MM-DD). */
  today: string
  learnerLevel: JlptLevel
  /** 상황별 마지막 결과(시각의 KST 날짜 포함). */
  last: ReadonlyMap<string, { at: Date; day: string; outcome: ScenarioOutcome }>
  /** 상황별 반복 항목(다음 학습일 YYYY-MM-DD). */
  repetition: ReadonlyMap<string, { nextDue: string | null; priority: RepetitionPriority }>
  focusTopicId: string | null
}

export interface ScenarioRecommendation {
  id: string
  reason: ScenarioRecommendReason
}

const byCreated = (a: RecommendCandidate, b: RecommendCandidate) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** 이 상황의 추천 이유(없으면 null). */
export function recommendReasonOf(c: RecommendCandidate, s: RecommendSignals): ScenarioRecommendReason | null {
  const last = s.last.get(c.id)
  if (last) {
    if (last.day >= s.today) return null
    if (last.outcome !== 'ACHIEVED') return 'RETRY_NOT_YET'
    const rep = s.repetition.get(c.id)
    return rep?.nextDue && rep.nextDue <= s.today ? 'REVIEW_DUE' : null
  }
  if (s.focusTopicId && c.topicWeights.has(s.focusTopicId)) return 'NEXT_IN_TOPIC'
  return LEVEL_RANK[c.level] <= LEVEL_RANK[s.learnerLevel] ? 'NEW_EASY' : null
}

function rankWithin(reason: ScenarioRecommendReason, list: RecommendCandidate[], s: RecommendSignals): RecommendCandidate[] {
  const learner = LEVEL_RANK[s.learnerLevel]
  return [...list].sort((a, b) => {
    if (reason === 'RETRY_NOT_YET') {
      const la = s.last.get(a.id)!
      const lb = s.last.get(b.id)!
      return Number(lb.outcome === 'NOT_YET') - Number(la.outcome === 'NOT_YET') || la.at.getTime() - lb.at.getTime() || byCreated(a, b)
    }
    if (reason === 'REVIEW_DUE') {
      const ra = s.repetition.get(a.id)!
      const rb = s.repetition.get(b.id)!
      return Number(rb.priority === 'FOCUS') - Number(ra.priority === 'FOCUS') || (ra.nextDue ?? '').localeCompare(rb.nextDue ?? '') || byCreated(a, b)
    }
    if (reason === 'NEXT_IN_TOPIC') {
      const t = s.focusTopicId!
      return (b.topicWeights.get(t) ?? 0) - (a.topicWeights.get(t) ?? 0) || a.difficulty - b.difficulty || LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || byCreated(a, b)
    }
    return a.difficulty - b.difficulty || Math.abs(LEVEL_RANK[a.level] - learner) - Math.abs(LEVEL_RANK[b.level] - learner) || byCreated(a, b)
  })
}

export function recommendScenarios(candidates: readonly RecommendCandidate[], s: RecommendSignals, max = SCENARIO_RECOMMEND_MAX): ScenarioRecommendation[] {
  const groups = new Map<ScenarioRecommendReason, RecommendCandidate[]>(SCENARIO_RECOMMEND_REASONS.map((r) => [r, []]))
  for (const c of candidates) {
    const r = recommendReasonOf(c, s)
    if (r) groups.get(r)!.push(c)
  }
  const ranked = SCENARIO_RECOMMEND_REASONS.map((r) => ({ reason: r, list: rankWithin(r, groups.get(r)!, s) }))
  const out: ScenarioRecommendation[] = []
  const taken = new Set<string>()
  const take = (id: string, reason: ScenarioRecommendReason) => {
    if (out.length >= max || taken.has(id)) return
    taken.add(id)
    out.push({ id, reason })
  }
  for (const g of ranked) if (g.list[0]) take(g.list[0].id, g.reason)
  for (const g of ranked) for (const c of g.list) take(c.id, g.reason)
  return out
}
