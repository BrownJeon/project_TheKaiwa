/**
 * 상황 행(JSON 칸) → 화면 DTO 읽기 — **순수 함수**(task-010d A3a). 저장 모양은 shape.ts 머리말.
 * 읽기는 관대하게: 시드·옛 키(`communicativeGoal`·`communicativeGoalKo`·`goal.steps`·`goal.opening`)도 읽고, 모양이 어긋난 항목은 건너뛴다.
 * A1 `[상황]` 헤더(A1-PE)도 이 함수들로 단계·첫마디·목표를 읽어야 화면과 같은 값이 된다.
 */
import type { ScenarioGoal, ScenarioKeyExpression, ScenarioOpening, ScenarioRoles, ScenarioStep } from '@/types/scenario'
import type { ScenarioExpression } from './expressions'

/** 읽을 때 단계 상한(입력 상한 8 보다 넉넉히 — 시드·옛 행도 자르지 않게). */
const STEPS_READ_MAX = 12
const CRITERIA_READ_MAX = 5

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

export function readScenarioRoles(raw: unknown): ScenarioRoles {
  const r = rec(raw)
  return { learner: str(r.learner) ?? '', tutor: str(r.tutor) ?? '' }
}

export function readScenarioGoal(raw: unknown): ScenarioGoal {
  const g = rec(raw)
  const criteria = Array.isArray(g.successCriteria) ? g.successCriteria.map(str).filter((c): c is string => !!c).slice(0, CRITERIA_READ_MAX) : []
  return { communicativeGoalKo: str(g.communicativeGoal_ko) ?? str(g.communicativeGoalKo) ?? str(g.communicativeGoal) ?? '', successCriteria: criteria }
}

/** 단계 — `constraints.steps` > `goal.steps`. 항목은 `{ko}` 또는 글. */
export function readScenarioSteps(constraints: unknown, goal?: unknown): ScenarioStep[] {
  const pick = [rec(constraints).steps, rec(goal).steps].find((v) => Array.isArray(v) && v.length > 0)
  if (!Array.isArray(pick)) return []
  return pick
    .map((s) => str(typeof s === 'string' ? s : rec(s).ko))
    .filter((s): s is string => !!s)
    .slice(0, STEPS_READ_MAX)
    .map((ko) => ({ ko }))
}

/** 선생님 첫마디 — `constraints.opening` > `goal.opening`. `ja` 가 없으면 없음. */
export function readScenarioOpening(constraints: unknown, goal?: unknown): ScenarioOpening | null {
  for (const v of [rec(constraints).opening, rec(goal).opening]) {
    const o = rec(v)
    const ja = str(o.ja)
    if (ja) return { ja, ko: str(o.ko) ?? '' }
  }
  return null
}

export function expressionView(e: ScenarioExpression): ScenarioKeyExpression {
  return { id: e.id, ja: e.textJa, ...(e.reading ? { reading: e.reading } : {}), ko: e.meaningKo ?? '' }
}
