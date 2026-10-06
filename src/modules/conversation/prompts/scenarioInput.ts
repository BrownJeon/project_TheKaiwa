/**
 * `Scenario` 행(JSON 칸) → A1 역할극 헤더(`TalkScenarioInput`)·종료 판정(`ScenarioVerdictInput` 의 상황 부분) 입력 — **순수 함수**(DB·LLM 없음), task-010d A1-PE.
 * 호출부(A3b — orchestrator·종료 라우트)가 행을 읽어 이 함수 하나로 두 입력을 같은 재료에서 만든다. 표현 id 는 `readScenarioExpressions` 결과 id 그대로라서
 * 강사 판정이 돌려주는 id 가 `normalizeScenarioVerdict`·`judgeScenarioCompletion` 의 보정을 통과한다(화면 DTO 와 같은 읽기 함수 — A3a `view.ts`).
 * 단계·첫마디·목표는 A3a 의 읽기 함수가 `goal`/`constraints` 두 위치(옛 키 포함)를 관대하게 읽는다.
 */
import {
  readScenarioExpressions,
  readScenarioGoal,
  readScenarioOpening,
  readScenarioRoles,
  readScenarioSteps,
  scenarioExpressionView,
  scenarioRequiredExpressions,
  type ScenarioChunkRef,
} from '@/modules/learning'
import type { ScenarioVerdictInput } from './scenarioVerdict'
import type { TalkScenarioInput } from './talkScenario'

export interface ScenarioRowForPrompt {
  roles: unknown
  goal: unknown
  constraints?: unknown
  keyExpressions: unknown
  completionRule: unknown
}

/** 판정 입력 중 상황에서 오는 부분(대화·코드 확인·종료 주체·수준은 호출부가 더한다). */
export type ScenarioVerdictSituation = Pick<ScenarioVerdictInput, 'roles' | 'goalKo' | 'successCriteria' | 'steps' | 'expressions' | 'requiredExpressions'>

export interface ScenarioPromptParts {
  talk: TalkScenarioInput
  verdict: ScenarioVerdictSituation
  /** 판정 대상 표현 id(표현 목록 순서) — 코드 표현 확인·`normalizeScenarioVerdict` 가 같은 목록을 쓴다. */
  expressionIds: string[]
}

export function scenarioPromptParts(row: ScenarioRowForPrompt, chunks: ReadonlyMap<string, ScenarioChunkRef> = new Map()): ScenarioPromptParts {
  const expressions = readScenarioExpressions(row.keyExpressions, chunks)
  const views = expressions.map(scenarioExpressionView)
  const roles = readScenarioRoles(row.roles)
  const goal = readScenarioGoal(row.goal)
  const steps = readScenarioSteps(row.constraints, row.goal)
  const required = scenarioRequiredExpressions(row.completionRule, expressions.length)
  const exprs = views.map((v) => ({ id: v.id, ja: v.ja, ko: v.ko || null }))
  return {
    talk: {
      roles,
      goalKo: goal.communicativeGoalKo,
      successCriteria: goal.successCriteria,
      steps,
      expressions: exprs,
      requiredExpressions: required,
      opening: readScenarioOpening(row.constraints, row.goal),
    },
    verdict: { roles, goalKo: goal.communicativeGoalKo, successCriteria: goal.successCriteria, steps, expressions: exprs, requiredExpressions: required },
    expressionIds: expressions.map((e) => e.id),
  }
}
