/**
 * 변형 상황 초안(task-045 변형 A, `POST /api/v1/scenarios/:id/variants/drafts` #177) 화면 ↔ 서버 DTO.
 * 서버 모듈을 import 하지 않는다 — **화면 칩 목록과 서버 검사가 같은 열거를 쓰는 단일 출처**다(`types/scenario.ts` 의 `SCENARIO_LIMITS` 와 같은 역할).
 * 엔진·모델 정보는 싣지 않는다. 프롬프트·검사·보정은 `modules/conversation/prompts/scenarioVariant.ts`·`structuredResponse/scenarioVariantSchemas.ts`.
 *
 * 축(데모 v2 `AX` 를 어떤 상황에도 뜻이 통하게 일반화 — 카페 전용 `soldout`·`card` 는 `unavailable`·`trouble`):
 *  - persona(상대 성격) · twist(돌발 상황) · flow(대화 흐름) · level(표현 수준). `same`/`none` = 바꾸지 않음. 전부 바꾸지 않음이면 요청이 거절된다(`no_change`).
 */
import type { JlptLevel } from './lesson'
import type { ScenarioInput } from './scenario'

export const SCENARIO_VARIANT_AXES = {
  persona: ['same', 'kind', 'busy', 'picky'],
  twist: ['none', 'unavailable', 'mishear', 'trouble'],
  flow: ['same', 'suggest', 'rephrase'],
  level: ['same', 'up'],
} as const

export type ScenarioVariantAxisKey = keyof typeof SCENARIO_VARIANT_AXES
export const SCENARIO_VARIANT_AXIS_KEYS = ['persona', 'twist', 'flow', 'level'] as const satisfies readonly ScenarioVariantAxisKey[]

export interface ScenarioVariantAxes {
  persona: (typeof SCENARIO_VARIANT_AXES.persona)[number]
  twist: (typeof SCENARIO_VARIANT_AXES.twist)[number]
  flow: (typeof SCENARIO_VARIANT_AXES.flow)[number]
  level: (typeof SCENARIO_VARIANT_AXES.level)[number]
}

/** 아무것도 바꾸지 않은 상태 — 요청에서 빠진 축의 기본값. */
export const SCENARIO_VARIANT_NO_AXES: Readonly<ScenarioVariantAxes> = { persona: 'same', twist: 'none', flow: 'same', level: 'same' }

/** 화면 칩 문구(한국어 해요체·짧게). `level` 의 `same` 은 화면이 "그대로(N5)" 처럼 수준을 덧붙인다. */
export const SCENARIO_VARIANT_AXIS_LABELS: Readonly<{
  [K in ScenarioVariantAxisKey]: { title: string; options: Readonly<Record<ScenarioVariantAxes[K], string>> }
}> = {
  persona: { title: '상대 성격', options: { same: '그대로', kind: '친절해요', busy: '바빠서 말이 빨라요', picky: '꼼꼼히 되물어요' } },
  twist: { title: '돌발 상황', options: { none: '없음', unavailable: '원하는 게 안 돼요', mishear: '말을 잘못 알아들어요', trouble: '문제가 생겨요' } },
  flow: { title: '대화 흐름', options: { same: '그대로', suggest: '상대가 다른 걸 권해요', rephrase: '내가 한 번 바꿔 말해요' } },
  level: { title: '표현 수준', options: { same: '그대로', up: '한 단계 위' } },
}

/** 「직접 적기(선택)」 상한(코드포인트). */
export const SCENARIO_VARIANT_NOTE_MAX = 100

/** 바꿀 점을 하나도 고르지 않았을 때의 문구(서버가 먼저 막는다 — 422 `NO_VARIATION` 후보, 화면 문구와 같다). */
export const SCENARIO_VARIANT_NO_CHANGE_MESSAGE = '바꿀 점을 하나 이상 골라 주세요.'

/**
 * `changedFields` 에 나오는 칸 이름 — 화면 「바뀜」 표시용. 코드가 기준 상황과 새 초안을 **직접 비교해** 정한다(모델의 주장이 아니다).
 * 데모 `chg` 글자와의 대응: t=title · r=roles · g=goal · c=successCriteria · s=steps · e=keyExpressions · o=opening, 그리고 수준이 바뀌면 level.
 */
export const SCENARIO_VARIANT_FIELDS = ['title', 'roles', 'goal', 'successCriteria', 'steps', 'keyExpressions', 'opening', 'level'] as const
export type ScenarioVariantField = (typeof SCENARIO_VARIANT_FIELDS)[number]

/** #177 요청 본문. 기준 상황은 경로의 `:id` 로 정한다(서버가 읽어 넘긴다). */
export interface ScenarioVariantRequestBody {
  axes: Partial<ScenarioVariantAxes>
  note?: string | null
}

/** #177 응답 200 — `draft` 는 #163 만들기 본문 모양(표현 id 없음, 장소는 기준 상황의 `topicIds` 를 이어 받음). 행을 만들지 않는다. */
export interface ScenarioVariantResponse {
  draft: ScenarioInput
  /** 기준 상황과 실제로 달라진 칸(코드 비교). */
  changedFields: ScenarioVariantField[]
  /** 실제로 반영한 축(기준이 N1 이면 `level: 'up'` 은 `same` 으로 접힌다). */
  axes: ScenarioVariantAxes
}

/** 한 단계 위 수준(N1 은 그대로). */
export function raiseJlptLevel(level: JlptLevel): JlptLevel {
  const order: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
  const i = order.indexOf(level)
  return i < 0 ? level : order[Math.min(order.length - 1, i + 1)]
}
