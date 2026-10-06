/**
 * 상황 핵심 표현(`Scenario.keyExpressions`)·완료 규칙(`completionRule`) 읽기와 역할극 종료 판정 — **순수 함수**(DB·LLM 없음, task-010d A1-서버).
 *
 * 표현 id 규약(A1 `[상황]` 헤더·강사 `learning.scenario.usedExpressionIds`·StudyLog 결과가 모두 이 id 를 쓴다 — 단일 출처):
 *   항목의 `id`(영숫자·`_`·`-` 1~40자) > `chunkId`(TopicChunk 참조) > 자리 번호 `k1`·`k2`…(배열 순서). 같은 id 는 처음 것만.
 * 표기: 항목 자체 `ja`(또는 `textJa`) > 참조한 TopicChunk 표기. 둘 다 없으면 그 항목은 판정 재료가 아니라 버린다.
 * `match`(선택): 코드가 발화에서 찾을 핵심(예 `〜にしてください` → `にしてください`) — 표기·읽기와 함께 "어느 하나라도 들어 있으면 사용"으로 본다.
 *
 * 종료 판정(Leader's Plan L2 · 데모 결정 (d)): 쓴 표현 = 코드가 학습자 말에서 확인한 것 ∪ (강사 제안 ∩ 핵심 표현 — 보정, 목록 밖 id 는 버림).
 * 코드 규칙 = 쓴 표현 수 ≥ 필수 수. **목표 달성 = 강사 판단(goalAchieved=true) 과 코드 규칙을 둘 다 채울 때만.**
 * 강사만 달성 → "거의"(ALMOST). 강사 판정이 없을 때(판정 턴 실패 등)는 달성으로 올리지 않고, 코드 규칙을 채웠으면 "거의" — 이때 관측 신뢰도는 낮춘다(end.ts).
 */
import type { ChunkType } from '@prisma/client'
import { chunkForms, matchTargets, type MatchTarget, type TargetForms } from '../lessons/matching'

/** 상황 1개가 판정에 쓰는 핵심 표현 상한(시드는 3~5개 — 프롬프트·매칭 비용 상한). */
export const SCENARIO_EXPRESSION_MAX = 12
/** `completionRule.requiredExpressions` 가 없을 때의 필수 수(핵심 표현 수보다 크면 그 수). */
export const SCENARIO_REQUIRED_DEFAULT = 2

const EXPRESSION_ID = /^[A-Za-z0-9_-]{1,40}$/
const CHUNK_TYPES: readonly ChunkType[] = ['NAME', 'ACTION', 'FEELING', 'MODIFIER']

export interface ScenarioExpression {
  id: string
  /** TopicChunk 참조(있을 때만) — 반복 학습·추천이 주제 조각과 잇는 고리. */
  chunkId: string | null
  textJa: string
  reading: string | null
  meaningKo: string | null
  chunkType: ChunkType | null
  match: string | null
}

/** 참조 조각의 표기(learning 이 TopicChunk 를 읽어 넘긴다). */
export interface ScenarioChunkRef {
  textJa: string
  reading: string | null
  meaningKo: string | null
  chunkType: ChunkType
}

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? Array.from(t).slice(0, max).join('') : null
}

/** keyExpressions 안의 TopicChunk 참조 id(읽어야 할 조각) — 중복 없이, 형식이 맞는 것만. */
export function scenarioChunkIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out = new Set<string>()
  for (const e of raw.slice(0, SCENARIO_EXPRESSION_MAX)) {
    const o = obj(e)
    const id = o && typeof o.chunkId === 'string' ? o.chunkId : null
    if (id && id.length <= 40) out.add(id)
  }
  return [...out]
}

/** `Scenario.keyExpressions` JSON → 판정용 표현 목록(위 id·표기 규약). 모양이 어긋난 항목은 건너뛴다. */
export function readScenarioExpressions(raw: unknown, chunks: ReadonlyMap<string, ScenarioChunkRef> = new Map()): ScenarioExpression[] {
  if (!Array.isArray(raw)) return []
  const out: ScenarioExpression[] = []
  const seen = new Set<string>()
  raw.slice(0, SCENARIO_EXPRESSION_MAX).forEach((e, i) => {
    const o = typeof e === 'string' ? { ja: e } : obj(e)
    if (!o) return
    const chunkId = typeof o.chunkId === 'string' && o.chunkId.length > 0 && o.chunkId.length <= 40 ? o.chunkId : null
    const chunk = chunkId ? chunks.get(chunkId) : undefined
    const own = text(o.ja, 120) ?? text(o.textJa, 120)
    const textJa = own ?? chunk?.textJa ?? null
    if (!textJa) return
    const explicitId = typeof o.id === 'string' && EXPRESSION_ID.test(o.id) ? o.id : null
    const id = explicitId ?? chunkId ?? `k${i + 1}`
    if (seen.has(id)) return
    seen.add(id)
    const ct = typeof o.chunkType === 'string' && (CHUNK_TYPES as readonly string[]).includes(o.chunkType) ? (o.chunkType as ChunkType) : (chunk?.chunkType ?? null)
    out.push({
      id,
      chunkId,
      textJa,
      reading: (own ? text(o.reading, 160) : null) ?? chunk?.reading ?? text(o.reading, 160),
      meaningKo: text(o.ko, 160) ?? text(o.meaningKo, 160) ?? chunk?.meaningKo ?? null,
      chunkType: ct,
      match: text(o.match, 120),
    })
  })
  return out
}

/** 필수 표현 수 — `requiredExpressions`(정본 domain-model §9-1) > `minKeyExpressions`(learning-personalization §1-2 옛 키, #22) > 기본 2. 0~표현 수로 자른다. */
export function scenarioRequiredExpressions(completionRule: unknown, total: number): number {
  const r = obj(completionRule)
  const pick = [r?.requiredExpressions, r?.minKeyExpressions].find((v) => typeof v === 'number' && Number.isFinite(v))
  const n = typeof pick === 'number' ? Math.floor(pick) : SCENARIO_REQUIRED_DEFAULT
  return Math.max(0, Math.min(Math.max(0, total), n))
}

/** 매칭 대안 — 표기·읽기(chunkForms)에 `match` 의 대안을 더한다(어느 하나라도 들어 있으면 사용). */
export function scenarioExpressionForms(e: ScenarioExpression): TargetForms {
  const alts = new Map<string, string[]>()
  for (const alt of [...chunkForms(e.textJa, e.reading), ...(e.match ? chunkForms(e.match) : [])]) alts.set(alt.join('\u0000'), alt)
  return [...alts.values()]
}

/** 학습자 말들(원문 — 저장하지 않는다)에서 코드가 확인한 표현 id(표현 목록 순서). */
export function detectScenarioExpressions(learnerTexts: readonly string[], expressions: readonly ScenarioExpression[]): string[] {
  const targets: MatchTarget[] = expressions.map((e) => ({ id: e.id, forms: scenarioExpressionForms(e) }))
  const hit = new Set<string>()
  for (const t of learnerTexts) {
    if (typeof t !== 'string' || !t) continue
    for (const id of matchTargets(t, targets).matchedIds) hit.add(id)
  }
  return expressions.filter((e) => hit.has(e.id)).map((e) => e.id)
}

/** 강사 종료 판정(A1 `learning.scenario`, additive — A1-PE 가 채운다)을 코드가 쓸 수 있게 다듬은 것. */
export interface ScenarioVerdict {
  goalAchieved: boolean | null
  communicationSuccess: boolean | null
  /** ⊆ 핵심 표현 id(보정 뒤). */
  usedExpressionIds: string[]
  missedExpressionIds: string[]
}

const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)

/**
 * 보정 — 모양이 어긋나면 null(판정 없음), id 는 핵심 표현 목록 안의 것만·중복 없이, 쓴 표현과 못 쓴 표현에 같이 있으면 쓴 표현 쪽만 남긴다.
 * LLM 이 만든 값이라 그대로 믿지 않는다(목록 밖 id 는 "쓴 표현"으로 세지 않음).
 */
export function normalizeScenarioVerdict(raw: unknown, expressionIds: readonly string[]): ScenarioVerdict | null {
  const o = obj(raw)
  if (!o) return null
  const known = new Set(expressionIds)
  const ids = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && known.has(x)))] : [])
  const used = ids(o.usedExpressionIds)
  const usedSet = new Set(used)
  const verdict: ScenarioVerdict = {
    goalAchieved: bool(o.goalAchieved),
    communicationSuccess: bool(o.communicationSuccess),
    usedExpressionIds: used,
    missedExpressionIds: ids(o.missedExpressionIds).filter((id) => !usedSet.has(id)),
  }
  if (verdict.goalAchieved === null && verdict.communicationSuccess === null && !used.length && !verdict.missedExpressionIds.length) return null
  return verdict
}

export type ScenarioOutcome = 'ACHIEVED' | 'ALMOST' | 'NOT_YET'

export interface ScenarioJudgement {
  /** 결과 카드·StudyLog 의 쓴 표현(표현 목록 순서). */
  usedIds: string[]
  missedIds: string[]
  /** 그중 코드가 학습자 말에서 직접 확인한 것(강사 제안만으로 들어온 것은 빠진다). */
  verifiedIds: string[]
  required: number
  total: number
  codeRulePassed: boolean
  tutorGoalAchieved: boolean | null
  communicationSuccess: boolean | null
  /** 강사 판단 + 코드 규칙 둘 다(결과 제목 "목표를 달성했어요"·반복 학습 정답). */
  goalAchieved: boolean
  outcome: ScenarioOutcome
  /** 강사 판정이 있었는가(없으면 관측 신뢰도를 낮춘다). */
  judged: boolean
}

/** 종료 판정(코드가 최종 결합 — learning-personalization §1-3). */
export function judgeScenarioCompletion(i: { expressions: readonly ScenarioExpression[]; required: number; learnerTexts: readonly string[]; verdict: ScenarioVerdict | null }): ScenarioJudgement {
  const verified = new Set(detectScenarioExpressions(i.learnerTexts, i.expressions))
  const proposed = new Set(i.verdict?.usedExpressionIds ?? [])
  const usedIds = i.expressions.filter((e) => verified.has(e.id) || proposed.has(e.id)).map((e) => e.id)
  const usedSet = new Set(usedIds)
  const total = i.expressions.length
  const required = Math.max(0, Math.min(total, Math.floor(i.required)))
  const codeRulePassed = usedIds.length >= required
  const tutor = i.verdict?.goalAchieved ?? null
  const goalAchieved = tutor === true && codeRulePassed
  const outcome: ScenarioOutcome = goalAchieved ? 'ACHIEVED' : tutor === true || (tutor === null && codeRulePassed) ? 'ALMOST' : 'NOT_YET'
  return {
    usedIds,
    missedIds: i.expressions.filter((e) => !usedSet.has(e.id)).map((e) => e.id),
    verifiedIds: i.expressions.filter((e) => verified.has(e.id)).map((e) => e.id),
    required,
    total,
    codeRulePassed,
    tutorGoalAchieved: tutor,
    communicationSuccess: i.verdict?.communicationSuccess ?? null,
    goalAchieved,
    outcome,
    judged: i.verdict !== null,
  }
}
