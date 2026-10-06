/**
 * 상황 역할극(Scenario — task-010d A3a) 화면 ↔ 서버 DTO. #161 목록 · #162 상세 · #163 만들기 · #164 고치기 · #165 지우기(ARCHIVED).
 * 서버 모듈을 import 하지 않는다. 서버(`learning/scenarios`)도 이 타입·한도를 그대로 쓴다(응답 모양·입력 한도의 단일 출처).
 * 엔진·모델 정보는 싣지 않는다. 표현 id 는 `learning/scenarios/expressions.ts` 규약(`id` > `chunkId` > `k<순번>`) 그대로다.
 */
import type { JlptLevel } from './lesson'

/** 역할극 결과(종료 판정 — `learning/scenarios/end.ts` 와 같은 값). */
export type ScenarioOutcome = 'ACHIEVED' | 'ALMOST' | 'NOT_YET'

/** 추천 이유 코드(서버가 코드 규칙으로 정한다 — LLM 0). 화면은 코드 → 문구 1:1, 모르는 코드면 줄을 숨긴다. */
export type ScenarioRecommendReason = 'RETRY_NOT_YET' | 'REVIEW_DUE' | 'NEXT_IN_TOPIC' | 'NEW_EASY'

/**
 * 사용자 상황 입력 한도(코드포인트 기준 글자 수·개수). 화면 입력칸·카운터·문구가 이 값을 쓴다.
 * 시드(`prisma/seed-data/scenarios.json`)도 같은 한도로 검사한다.
 */
export const SCENARIO_LIMITS = {
  titleMax: 40,
  titleJaMax: 40,
  descriptionMax: 300,
  roleMax: 12,
  goalMax: 80,
  successCriteriaMin: 1,
  successCriteriaMax: 3,
  successCriterionMax: 40,
  stepsMin: 2,
  stepsMax: 8,
  stepMax: 40,
  expressionsMin: 2,
  expressionsMax: 12,
  expressionJaMax: 40,
  expressionReadingMax: 60,
  expressionKoMax: 40,
  openingJaMax: 60,
  openingKoMax: 80,
  topicsMax: 3,
  difficultyMin: 1,
  difficultyMax: 5,
  /** 지우지 않은(ACTIVE) 내 상황 수 상한 — 넘으면 #163 409 `SCENARIO_LIMIT`. */
  activePerUser: 50,
  /** 하루(KST) 만들기 상한 — 넘으면 #163 429 `DAILY_LIMIT`. */
  createPerDay: 30,
  /** 목록 한 번에(기본·최대). */
  listDefault: 50,
  listMax: 100,
} as const

export interface ScenarioRoles {
  learner: string
  tutor: string
}

export interface ScenarioTopicRef {
  id: string
  title: string
  titleJa: string | null
}

/** 마지막 역할극 결과(관측 `SCENARIO_COMPLETED` 에서 — 원문 없음). */
export interface ScenarioLastAttempt {
  /** ISO 시각. */
  at: string
  outcome: ScenarioOutcome
  /** 그때 쓴 핵심 표현 수 / 핵심 표현 수(상황 시트 "핵심 표현 u/n"). */
  usedCount: number
  totalCount: number
}

/** #161 목록 항목. */
export interface ScenarioListItem {
  id: string
  title: string
  titleJa: string | null
  level: JlptLevel
  /** 1~5. */
  difficulty: number
  /** 내가 만든 상황(고치기·지우기 가능). 시드는 false. */
  isMine: boolean
  roles: ScenarioRoles
  goalKo: string
  stepCount: number
  expressionCount: number
  /** 이 상황과 이어진 주제(장소) — weight 큰 순, 시드·내 주제만. */
  topics: ScenarioTopicRef[]
  recommended: boolean
  recommendReason?: ScenarioRecommendReason
  last?: ScenarioLastAttempt
  /** 끝내지 않은 가장 최근 역할극 대화(있을 때만). */
  inProgressChatId?: string
}

export interface ScenarioListResponse {
  items: ScenarioListItem[]
  /** 다음 쪽 커서(불투명) — 없으면 null. */
  nextCursor: string | null
  /** 추천 상황 id(추천 순서, ≤3). `recommended=1` 이 아니어도 함께 온다 — 화면은 이 순서로 추천 칸을 그린다. */
  recommendedIds: string[]
}

export interface ScenarioGoal {
  communicativeGoalKo: string
  successCriteria: string[]
}

export interface ScenarioStep {
  ko: string
}

export interface ScenarioKeyExpression {
  id: string
  ja: string
  reading?: string
  ko: string
}

/** 선생님 첫마디 — 역할극을 열 때 첫 선생님 말로 쓴다(LLM 0). */
export interface ScenarioOpening {
  ja: string
  ko: string
}

/** #162 상세(= #163·#164 응답). */
export interface ScenarioDetail extends ScenarioListItem {
  description: string | null
  goal: ScenarioGoal
  steps: ScenarioStep[]
  keyExpressions: ScenarioKeyExpression[]
  /** 표현 조건을 채우는 필수 표현 수(0~핵심 표현 수). */
  requiredExpressions: number
  opening?: ScenarioOpening
}

/** #163 만들기 본문(= AI 초안 모양). `keyExpressions[].id` 는 #164 에서 기존 표현을 그대로 둘 때만 쓴다(만들 때는 서버가 정한다). */
export interface ScenarioInput {
  title: string
  titleJa?: string | null
  description?: string | null
  level: JlptLevel
  difficulty?: number
  roles: ScenarioRoles
  goal: ScenarioGoal
  steps: ScenarioStep[]
  keyExpressions: { id?: string; ja: string; reading?: string | null; ko: string }[]
  /** 생략하면 min(2, 표현 수). 1~표현 수. */
  requiredExpressions?: number
  opening?: ScenarioOpening | null
  /** 장소(주제) — 시드 또는 내 주제, ≤3, 앞쪽이 대표. */
  topicIds?: string[]
}

/** #164 고치기 — 보낸 칸만 바꾼다(최소 1칸). */
export type ScenarioPatch = Partial<ScenarioInput>

/** #165 지우기 — 목록에서 숨김(ARCHIVED). 이미 지운 상황이면 `alreadyArchived:true`(멱등). */
export interface ScenarioArchiveResult {
  id: string
  status: 'ARCHIVED'
  alreadyArchived: boolean
}

/** 400 VALIDATION `details.problems[]` — 칸마다 하나. `field` 는 `title`·`roles.tutor`·`steps[2].ko`·`keyExpressions[0].ja` 꼴. */
export interface ScenarioFieldProblem {
  field: string
  reason: string
  message: string
}
