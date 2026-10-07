/**
 * 변형 상황 초안(`scenarioVariant`, `POST /api/v1/scenarios/:id/variants/drafts` #177) 요청 검사·응답 계약·보정 — task-045 변형 A. 프롬프트는 `prompts/scenarioVariant.ts`.
 * 축 열거·한국어 칩 문구·`changedFields` 이름은 화면과 공유하는 단일 출처 `types/scenarioVariant.ts` 에 있다.
 *
 * 하는 일: 학습자가 이미 가진 상황(**기준 상황** — 서버가 읽어 넘긴다)에서 장소·목적·역할 구도는 두고 고른 축(상대 성격·돌발 상황·대화 흐름·표현 수준)만 바꾼 **새 상황 초안**을 제안한다.
 * 이 호출은 **아무것도 저장하지 않는다**(제안→채택: 학습자가 검토·수정해 [새 상황으로 저장]할 때 #163 이 행을 만든다. 표현 id 는 그때 서버가 발급한다 — AI 는 id 를 내지 않는다).
 *
 * 설계(`scenarioDraft`·`openingDraft`·`topicDraft` 선례)
 *  - **모델 출력은 #166 과 같은 납작한 초안**(`SCENARIO_DRAFT_SCHEMA` 의 draft 객체를 그대로 쓴다) + 상태는 `OK | UNSAFE` 뿐이다. `level`·`description`·`topicIds` 는 모델이 내지 않는다 — 코드가 채운다
 *    (수준 = 기준 수준 또는 한 단계 위, 설명 = 학습자가 적은 한 줄 또는 기준 설명, 장소 = 기준 상황의 장소).
 *  - **`changedFields` 는 모델이 주장하지 않는다.** 코드가 기준 상황과 새 초안을 정규화해 **직접 비교**한다(주장만 하고 안 바뀐 칸이 화면에 「바뀜」으로 나오는 일이 구조적으로 없다).
 *  - **반영 검사**: 고른 축이 대화에 실제로 들어갔는지를 코드가 본다 — 돌발 상황·되묻기·권유(`twist`·`flow`)는 **대화 순서가 바뀌고 원본에 없던 표현이 1개 이상**,
 *    수준 상향은 원본에 없던 표현 2개 이상, 성격만 바꿀 때는 순서·첫마디·목표가 바뀌거나 원본에 없던 표현이 1개 이상 있어야 한다. 못 맞추면 `INVALID`(재시도 1회 → 그래도 못 맞추면 502).
 *  - **코드가 고치는 것**(재시도를 만들지 않는다): 학습자 역할은 기준과 똑같이(구도 유지) · 상대 역할은 성격 축이 없으면 기준과 똑같이, 있으면 기준 앞에 성격을 붙인 이름(모델이 못 붙이면 코드가 `바쁜 점원` 식으로) ·
 *    기준과 같은 제목은 `· 변형` 을 붙임 · 첫마디는 `openingDraft` 와 같은 일본어 검사(`fitOpeningDraft` — 60자·3문장·글자 종류·로마자 규칙)를 통과해야 하고 못 통과하면 첫마디 없이 ·
 *    기준에 없는 로마자(PWNED 같은 주입 장식)가 든 표현·한글 뜻이 없는 표현은 버림 · 길이·개수 한도·표현 정리는 `fitScenarioDraft`(= #166 과 같은 코드) 그대로.
 *  - **막는 것**(INVALID → 재시도): 모든 칸의 URL·꺾쇠·비밀 모양·숨은 글자(`detectUnsafeTopicText`)·엔진명 · 한국어 칸(제목·역할·목표·조건·순서·첫마디 뜻)에 한글이 없음.
 *  - `note`(직접 적기, ≤100자)는 학습자 글이다 — 요청 검사에서 꺾쇠·URL·비밀 모양을 막고(이모지 접합 문자는 허용), 프롬프트에서는 `[입력]` 구획 안에만 둔다. 지시 변경 시도는 모델이 `UNSAFE` 로 거절한다.
 *  - 축이 전부 `same/none` 이면 LLM 을 부르지 않는다(`no_change`, 서버 422 후보). 기준이 N1 이면 `level: up` 은 `same` 으로 접힌다.
 */
import { llm } from '@/modules/engine'
import { codePointLength } from '@/modules/infra'
import { SCENARIO_LIMITS as L } from '@/types/scenario'
import {
  raiseJlptLevel,
  SCENARIO_VARIANT_AXES,
  SCENARIO_VARIANT_AXIS_KEYS,
  SCENARIO_VARIANT_NO_AXES,
  SCENARIO_VARIANT_NO_CHANGE_MESSAGE,
  SCENARIO_VARIANT_NOTE_MAX,
  type ScenarioVariantAxes,
  type ScenarioVariantField,
} from '@/types/scenarioVariant'
import { fitOpeningDraft } from './openingDraftSchemas'
import { JLPT_LEVELS, type JlptLevel } from './schemas'
import {
  SCENARIO_DRAFT_SCHEMA,
  expressionCore,
  fitScenarioDraft,
  type ScenarioDraftModel,
  type ScenarioDraftOutput,
  type ScenarioDraftProblem,
  type ScenarioDraftRepairs,
} from './scenarioDraft'
import { cleanTopicText, detectUnsafeTopicText, detectUnsafeUserTopicText } from './topicDraftSchemas'

// ─────────────────────────────────────────────────────────────────────────────
// 기준 상황(서버가 읽어 넘기는 값) · 정리
// ─────────────────────────────────────────────────────────────────────────────
export interface ScenarioVariantBase {
  title: string
  titleJa?: string | null
  description?: string | null
  level: JlptLevel
  roles: { learner: string; tutor: string }
  goal: { communicativeGoalKo: string; successCriteria: string[] }
  steps: { ko: string }[]
  keyExpressions: { ja: string; reading?: string | null; ko: string }[]
  opening?: { ja: string; ko: string } | null
  /** 이 상황과 이어진 장소(주제) — `id` 는 결과 `topicIds` 로만(프롬프트에 싣지 않음), `title` 은 프롬프트의 장소 줄. 시드·내 주제만 넘긴다(권한 확인은 서버). */
  topics?: { id?: string | null; title?: string | null }[]
}

const cps = (s: string): string[] => Array.from(s)
const HANGUL = /[가-힣]/u
const LINE_BREAKS = /[\r\n\t\v\f\u{85}\u{2028}\u{2029}]+/gu

/** 코드포인트 `max` 이하로 자른다(넘으면 끝을 `…` 로). */
function cutTo(s: string, max: number): string {
  const a = cps(s)
  return a.length <= max ? s : `${a.slice(0, Math.max(1, max - 1)).join('').trimEnd()}…`
}

/** 프롬프트 입력용 한 칸 정리 — 한 줄·보이지 않는 문자·꺾쇠 제거, `[`·`]` → `(`·`)`(블록 표식·줄 위조 방지), 코드포인트 상한. */
export function cleanVariantInput(raw: unknown, max: number): string {
  const t = typeof raw === 'string' ? cleanTopicText(raw).replace(/[<>]/g, '').replace(/\[/g, '(').replace(/\]/g, ')') : ''
  const a = cps(t)
  return a.length <= max ? t : a.slice(0, max).join('').trim()
}

/** 기준 상황을 한도 안으로 정리한다(비는 칸·항목은 버림). 모델에 싣는 값이자 `changedFields` 비교의 기준이다. */
export function normalizeVariantBase(base: ScenarioVariantBase): ScenarioVariantBase {
  const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
  const level = (JLPT_LEVELS as readonly string[]).includes(base?.level) ? base.level : 'N4'
  const opening = base?.opening && typeof base.opening === 'object' ? { ja: cleanVariantInput(base.opening.ja, L.openingJaMax), ko: cleanVariantInput(base.opening.ko, L.openingKoMax) } : null
  return {
    title: cleanVariantInput(base?.title, L.titleMax),
    titleJa: cleanVariantInput(base?.titleJa, L.titleJaMax) || null,
    description: cleanVariantInput(base?.description, L.descriptionMax) || null,
    level,
    roles: { learner: cleanVariantInput(base?.roles?.learner, L.roleMax), tutor: cleanVariantInput(base?.roles?.tutor, L.roleMax) },
    goal: {
      communicativeGoalKo: cleanVariantInput(base?.goal?.communicativeGoalKo, L.goalMax),
      successCriteria: list<string>(base?.goal?.successCriteria).map((s) => cleanVariantInput(s, L.successCriterionMax)).filter(Boolean).slice(0, L.successCriteriaMax),
    },
    steps: list<{ ko: string }>(base?.steps).map((s) => ({ ko: cleanVariantInput(s?.ko, L.stepMax) })).filter((s) => s.ko).slice(0, L.stepsMax),
    keyExpressions: list<{ ja: string; reading?: string | null; ko: string }>(base?.keyExpressions)
      .map((e) => ({ ja: cleanVariantInput(e?.ja, L.expressionJaMax), reading: cleanVariantInput(e?.reading, L.expressionReadingMax) || null, ko: cleanVariantInput(e?.ko, L.expressionKoMax) }))
      .filter((e) => e.ja && e.ko)
      .slice(0, L.expressionsMax),
    opening: opening && opening.ja && opening.ko ? opening : null,
    topics: list<{ id?: string | null; title?: string | null }>(base?.topics)
      .map((t) => ({ id: typeof t?.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(t.id) ? t.id : null, title: cleanVariantInput(t?.title, 40) || null }))
      .slice(0, L.topicsMax),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 요청 본문 검사 (순수)
// ─────────────────────────────────────────────────────────────────────────────
export interface ScenarioVariantBodyProblem {
  /** `axes`·`axes.<축>`·`note`·`body`. */
  field: string
  reason: 'required' | 'type' | 'enum' | 'unknown_key' | 'no_change' | 'max_length' | 'forbidden_char' | 'url' | 'secret_like'
  message: string
}

export interface ScenarioVariantBody {
  /** 모든 축이 채워진 값(빠진 축은 `same`/`none`). 기준이 N1 이면 `level` 은 `same` 으로 접힌다(`baseLevel` 을 넘겼을 때). */
  axes: ScenarioVariantAxes
  note: string | null
}

export type ScenarioVariantBodyResult = { ok: true; value: ScenarioVariantBody } | { ok: false; problems: ScenarioVariantBodyProblem[] }

const BODY_KEYS = ['axes', 'note'] as const

function isObj(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** 기준 수준에서 실제로 의미가 있는 축만 남긴다(N1 의 `up` 은 올릴 곳이 없다). */
export function effectiveVariantAxes(baseLevel: JlptLevel, axes: ScenarioVariantAxes): ScenarioVariantAxes {
  return { ...axes, level: axes.level === 'up' && raiseJlptLevel(baseLevel) !== baseLevel ? 'up' : 'same' }
}

/** 바꿀 점이 하나라도 있는가(기준 수준을 알면 의미 없는 `up` 은 세지 않는다). */
export function hasVariantChange(axes: ScenarioVariantAxes, baseLevel?: JlptLevel): boolean {
  const a = baseLevel ? effectiveVariantAxes(baseLevel, axes) : axes
  return a.persona !== 'same' || a.twist !== 'none' || a.flow !== 'same' || a.level === 'up'
}

/**
 * #177 요청 본문 검사(LLM 호출 전) — `{axes, note?}` 만(그 밖 키는 `unknown_key`). 문제는 한 번에 모두 모은다.
 * `axes` 의 빠진 축은 `same`/`none`, 모르는 축·값은 `axes.<축>` `unknown_key`/`enum`. 바꿀 점이 하나도 없으면 `axes` `no_change`(서버 422 후보 — 메시지 `SCENARIO_VARIANT_NO_CHANGE_MESSAGE`).
 * `note` 는 정리 뒤 1~100자, 꺾쇠·URL·비밀 모양 금지(이모지 접합 문자는 허용). `opts.baseLevel` 을 주면 N1 의 `up` 을 `same` 으로 접고 그 기준으로 `no_change` 를 판정한다.
 */
export function parseScenarioVariantBody(body: unknown, opts: { baseLevel?: JlptLevel } = {}): ScenarioVariantBodyResult {
  if (!isObj(body)) return { ok: false, problems: [{ field: 'body', reason: 'type', message: '요청 형식이 올바르지 않아요.' }] }
  const problems: ScenarioVariantBodyProblem[] = []
  for (const k of Object.keys(body)) if (!(BODY_KEYS as readonly string[]).includes(k)) problems.push({ field: 'body', reason: 'unknown_key', message: `넣을 수 없는 항목이에요: ${k}` })

  const axes: ScenarioVariantAxes = { ...SCENARIO_VARIANT_NO_AXES }
  if (body.axes === undefined || body.axes === null) problems.push({ field: 'axes', reason: 'required', message: SCENARIO_VARIANT_NO_CHANGE_MESSAGE })
  else if (!isObj(body.axes)) problems.push({ field: 'axes', reason: 'type', message: '바꿀 점의 형식이 올바르지 않아요.' })
  else {
    for (const [k, v] of Object.entries(body.axes)) {
      if (!(SCENARIO_VARIANT_AXIS_KEYS as readonly string[]).includes(k)) {
        problems.push({ field: `axes.${k}`, reason: 'unknown_key', message: `넣을 수 없는 항목이에요: ${k}` })
        continue
      }
      if (v === undefined || v === null) continue
      if (typeof v !== 'string' || !(SCENARIO_VARIANT_AXES[k as keyof ScenarioVariantAxes] as readonly string[]).includes(v)) {
        problems.push({ field: `axes.${k}`, reason: 'enum', message: '고를 수 없는 값이에요. 다시 골라 주세요.' })
        continue
      }
      ;(axes as unknown as Record<string, string>)[k] = v
    }
  }

  let note: string | null = null
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== 'string') problems.push({ field: 'note', reason: 'type', message: '직접 적은 내용은 글이어야 해요.' })
    else {
      const t = cleanTopicText(body.note)
      const n = codePointLength(t)
      if (n === 0) note = null
      else if (n > SCENARIO_VARIANT_NOTE_MAX) problems.push({ field: 'note', reason: 'max_length', message: `직접 적은 내용은 ${SCENARIO_VARIANT_NOTE_MAX}자까지 쓸 수 있어요.` })
      else if (/[<>]/.test(t)) problems.push({ field: 'note', reason: 'forbidden_char', message: '직접 적은 내용에 꺾쇠(< >)는 쓸 수 없어요.' })
      else {
        const unsafe = detectUnsafeUserTopicText(t)
        if (unsafe === 'URL') problems.push({ field: 'note', reason: 'url', message: '직접 적은 내용에 주소(URL)는 넣을 수 없어요.' })
        else if (unsafe === 'SECRET_LIKE') problems.push({ field: 'note', reason: 'secret_like', message: '직접 적은 내용에 비밀번호·키처럼 보이는 글은 넣을 수 없어요.' })
        else if (unsafe !== null) problems.push({ field: 'note', reason: 'forbidden_char', message: '직접 적은 내용에 쓸 수 없는 글자가 있어요.' })
        else note = t
      }
    }
  }

  const eff = opts.baseLevel ? effectiveVariantAxes(opts.baseLevel, axes) : axes
  if (problems.length === 0 && !hasVariantChange(eff)) problems.push({ field: 'axes', reason: 'no_change', message: SCENARIO_VARIANT_NO_CHANGE_MESSAGE })
  if (problems.length > 0) return { ok: false, problems }
  return { ok: true, value: { axes: eff, note } }
}

// ─────────────────────────────────────────────────────────────────────────────
// 모델 응답 계약
// ─────────────────────────────────────────────────────────────────────────────
export type ScenarioVariantModelStatus = 'OK' | 'UNSAFE'

export interface ScenarioVariantModelResponse {
  status: ScenarioVariantModelStatus
  draft: ScenarioDraftModel | null
}

/** #166 과 같은 납작한 초안 객체(키 순서 title → … → opening, 한도 `SCENARIO_LIMITS`). */
const DRAFT_OBJECT = SCENARIO_DRAFT_SCHEMA.properties.draft.anyOf[1]

export const SCENARIO_VARIANT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'draft'],
  properties: {
    status: { type: 'string', enum: ['OK', 'UNSAFE'] },
    draft: { anyOf: [{ type: 'null' }, DRAFT_OBJECT] },
  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// 보정·검사
// ─────────────────────────────────────────────────────────────────────────────
export interface ScenarioVariantContext {
  /** 정리된 기준 상황(`normalizeVariantBase`). */
  base: ScenarioVariantBase
  /** 실제로 반영한 축(N1 의 `up` 은 접힘). */
  axes: ScenarioVariantAxes
  /** 새 상황 수준 = 기준 또는 한 단계 위. */
  level: JlptLevel
  /** 학습자가 적은 한 줄(정리한 글) — 프롬프트에만 쓰이고 **저장되지 않는다**(새 상황의 `description` 은 기준 설명 그대로). */
  note: string | null
  /** 결과 `topicIds`(기준 상황의 장소 — 프롬프트에는 싣지 않는다). */
  topicIds: string[]
}

export type ScenarioVariantProblem =
  | ScenarioDraftProblem
  | 'TEXT_UNSAFE'
  | 'ENGINE_NAME'
  | 'KO_FIELD_NO_HANGUL'
  | 'NOT_REFLECTED'
  | 'LEVEL_NOT_REFLECTED'

export interface ScenarioVariantRepairs extends ScenarioDraftRepairs {
  /** 한글 뜻이 없어 버린 표현 수. */
  koDropped: number
  /** 기준에 없는 로마자가 들어 있어 버린 표현 수. */
  latinDropped: number
  learnerRoleFixed: boolean
  tutorRoleFixed: boolean
  titleFixed: boolean
  /** 모델의 첫마디를 쓸 수 없어(일본어 검사 탈락) 기준 상황의 첫마디로 되돌렸다. */
  openingFromBase: boolean
}

export type ScenarioVariantFinalStatus = 'OK' | 'UNSAFE' | 'INVALID'

export interface ScenarioVariantFinal {
  status: ScenarioVariantFinalStatus
  /** `status === 'OK'` 일 때만 — `ScenarioInput` 모양(표현 id 없음, `level` = 새 수준, `topicIds` = 기준의 장소). */
  draft: ScenarioDraftOutput | null
  /** `status === 'OK'` 일 때만 — 기준 상황과 실제로 달라진 칸(코드 비교). */
  changedFields: ScenarioVariantField[]
  problems: ScenarioVariantProblem[]
  repairs: ScenarioVariantRepairs
}

/** 성격 축이 있을 때 상대 역할 앞에 붙이는 말 — 모델이 못 붙였을 때만 코드가 쓴다. */
export const SCENARIO_VARIANT_PERSONA_ADJECTIVE = { kind: '친절한', busy: '바쁜', picky: '꼼꼼한' } as const
/** 기준과 같은 제목일 때 코드가 붙이는 말. */
export const SCENARIO_VARIANT_TITLE_SUFFIX = ' · 변형'

const emptyDraftRepairs = (): ScenarioDraftRepairs => ({
  truncated: 0,
  droppedSteps: 0,
  droppedCriteria: 0,
  droppedExpressions: { tooLong: 0, tooShort: 0, notJapanese: 0, duplicate: 0, noMeaning: 0, overLimit: 0, generic: 0, midBlank: 0 },
  readingsDropped: 0,
  openingDropped: false,
  difficultyClamped: false,
  requiredClamped: false,
})
const emptyRepairs = (): ScenarioVariantRepairs => ({ ...emptyDraftRepairs(), koDropped: 0, latinDropped: 0, learnerRoleFixed: false, tutorRoleFixed: false, titleFixed: false, openingFromBase: false })
const bad = (status: ScenarioVariantFinalStatus, problems: ScenarioVariantProblem[] = [], repairs: ScenarioVariantRepairs = emptyRepairs()): ScenarioVariantFinal => ({ status, draft: null, changedFields: [], problems, repairs })

/** 비교용 정규화 — 가타카나→히라가나·NFKC·부호·공백 제거(`expressionCore` 와 같은 규칙, 한글도 같은 규칙으로 접힌다). */
const nk = (s: unknown): string => (typeof s === 'string' ? expressionCore(s) : '')

const sameList = (a: string[], b: string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i])

/** 로마자 낱말 비교용 — 전각 → 반각(NFKC)·소문자. */
const latinRuns = (s: string): string[] => (s.normalize('NFKC').match(/[A-Za-z]+/g) ?? []).map((r) => r.toLowerCase())

function baseLatinSet(base: ScenarioVariantBase): Set<string> {
  const texts = [base.title, base.titleJa, base.description, base.roles.learner, base.roles.tutor, base.goal.communicativeGoalKo, ...base.goal.successCriteria, ...base.steps.map((s) => s.ko), base.opening?.ja, base.opening?.ko]
  for (const e of base.keyExpressions) texts.push(e.ja, e.ko)
  return new Set(texts.flatMap((t) => (typeof t === 'string' ? latinRuns(t) : [])))
}

function collectStrings(d: ScenarioDraftModel): string[] {
  const out: unknown[] = [d.title, d.titleJa, d.roles?.learner, d.roles?.tutor, d.goalKo, ...(Array.isArray(d.successCriteria) ? d.successCriteria : []), ...(Array.isArray(d.steps) ? d.steps : []), d.opening?.ja, d.opening?.ko]
  for (const e of Array.isArray(d.keyExpressions) ? d.keyExpressions : []) out.push(e?.ja, e?.reading, e?.ko)
  return out.filter((s): s is string => typeof s === 'string')
}

/** 비교에 쓰는 칸 — `ScenarioDraftOutput`(초안)과 `ScenarioVariantBase`(기준 상황)가 모두 이 모양을 만족한다. */
export interface VariantComparable {
  title: string
  titleJa?: string | null
  level: JlptLevel
  roles: { learner: string; tutor: string }
  goal: { communicativeGoalKo: string; successCriteria: string[] }
  steps: { ko: string }[]
  keyExpressions: { ja: string }[]
  opening?: { ja: string; ko: string } | null
}

/** 기준 상황과 새 초안을 칸별로 비교한다 — 정규화한 값이 다르면 바뀐 칸. 난이도·필수 표현 수·설명·장소는 따라가는 값이라 세지 않는다. */
export function computeVariantChangedFields(base: ScenarioVariantBase, draft: VariantComparable): ScenarioVariantField[] {
  const changed: ScenarioVariantField[] = []
  if (nk(draft.title) !== nk(base.title) || nk(draft.titleJa) !== nk(base.titleJa)) changed.push('title')
  if (nk(draft.roles.learner) !== nk(base.roles.learner) || nk(draft.roles.tutor) !== nk(base.roles.tutor)) changed.push('roles')
  if (nk(draft.goal.communicativeGoalKo) !== nk(base.goal.communicativeGoalKo)) changed.push('goal')
  if (!sameList(draft.goal.successCriteria.map(nk), base.goal.successCriteria.map(nk))) changed.push('successCriteria')
  if (!sameList(draft.steps.map((s) => nk(s.ko)), base.steps.map((s) => nk(s.ko)))) changed.push('steps')
  const dc = new Set(draft.keyExpressions.map((e) => nk(e.ja)))
  const bc = new Set(base.keyExpressions.map((e) => nk(e.ja)))
  if (dc.size !== bc.size || [...dc].some((c) => !bc.has(c))) changed.push('keyExpressions')
  if (nk(draft.opening?.ja) !== nk(base.opening?.ja) || nk(draft.opening?.ko) !== nk(base.opening?.ko)) changed.push('opening')
  if (draft.level !== base.level) changed.push('level')
  return changed
}

/** 새 초안의 표현 중 기준에 없던 것의 수(같은 표현이거나 한쪽이 다른 쪽에 통째로 든 표현은 같은 것으로 본다). */
export function countNewExpressions(base: ScenarioVariantBase, expressions: ReadonlyArray<{ ja: string }>): number {
  const baseCores = base.keyExpressions.map((e) => nk(e.ja)).filter(Boolean)
  return expressions.filter((e) => {
    const c = nk(e.ja)
    return c && !baseCores.some((b) => b === c || b.includes(c) || c.includes(b))
  }).length
}

/**
 * 고른 축이 대화에 실제로 들어갔는지(코드 판정) — 못 들어간 이유 코드. 표현은 "목록이 달라졌다"가 아니라 **원본에 없던 새 표현이 있는가**(`newExpr`)로 본다 —
 * 원본에 빈 말(「ありがとうございます」 등)이 있으면 코드 정리가 그것을 버려 목록이 저절로 달라지므로, 목록 비교는 반영의 증거가 되지 못한다.
 */
function reflectionProblems(ctx: ScenarioVariantContext, changed: readonly ScenarioVariantField[], newExpr: number): ScenarioVariantProblem[] {
  const out: ScenarioVariantProblem[] = []
  const has = (f: ScenarioVariantField) => changed.includes(f)
  const twistOrFlow = ctx.axes.twist !== 'none' || ctx.axes.flow !== 'same'
  if (twistOrFlow) {
    if (!has('steps') || newExpr < 1) out.push('NOT_REFLECTED')
  } else if (ctx.axes.level !== 'up') {
    // 성격만 바뀜 — 말투·반응은 첫마디·순서·목표·표현 어디엔가 보여야 한다(상대 역할 이름은 코드가 붙이므로 근거가 되지 않는다).
    if (!has('steps') && !has('opening') && !has('goal') && newExpr < 1) out.push('NOT_REFLECTED')
  }
  if (ctx.axes.level === 'up' && newExpr < 2) out.push('LEVEL_NOT_REFLECTED')
  return out
}

/**
 * 모델 응답 → `ScenarioInput` 모양 초안 + `changedFields`. 고칠 수 있는 것은 고치고(`repairs` 로 센다), 고칠 수 없는 것(안전하지 않은 글·한국어 칸에 한글 없음·필수 칸 비었음·
 * 고른 축이 반영되지 않음)은 `INVALID` 와 이유를 돌려준다.
 */
export function fitScenarioVariant(ctx: ScenarioVariantContext, data: ScenarioVariantModelResponse): ScenarioVariantFinal {
  if (data?.status === 'UNSAFE') return bad('UNSAFE')
  const d = data?.draft
  if (data?.status !== 'OK' || !d || typeof d !== 'object') return bad('INVALID', ['DRAFT_MISSING'])

  // 1) 안전: 모든 칸의 URL·꺾쇠·비밀 모양·숨은 글자, 엔진명.
  const strings = collectStrings(d)
  if (strings.some((s) => detectUnsafeTopicText(s.replace(LINE_BREAKS, ' ')) !== null)) return bad('INVALID', ['TEXT_UNSAFE'])
  if (llm.mentionsEngineIdentity(strings.join('\n'))) return bad('INVALID', ['ENGINE_NAME'])

  // 2) 한국어 칸에 한글이 있어야 한다(일본어·영어가 한국어 칸에 새는 것).
  const koFields: unknown[] = [d.title, d.roles?.learner, d.roles?.tutor, d.goalKo, ...(Array.isArray(d.successCriteria) ? d.successCriteria : []), ...(Array.isArray(d.steps) ? d.steps : []), d.opening?.ko]
  if (koFields.some((s) => typeof s !== 'string' || !HANGUL.test(s))) return bad('INVALID', ['KO_FIELD_NO_HANGUL'])

  // 3) 표현: 한글 뜻 없음·기준에 없는 로마자(주입 장식)는 버린다. 나머지 정리(길이·겹침·읽기·빈 말)는 #166 과 같은 코드.
  const repairs = emptyRepairs()
  const allowedLatin = baseLatinSet(ctx.base)
  const kept = (Array.isArray(d.keyExpressions) ? d.keyExpressions : []).filter((e) => {
    if (typeof e?.ko !== 'string' || !HANGUL.test(e.ko)) {
      repairs.koDropped += 1
      return false
    }
    if (latinRuns(String(e?.ja ?? '')).some((r) => !allowedLatin.has(r))) {
      repairs.latinDropped += 1
      return false
    }
    return true
  })

  // 설명은 기준 상황의 것을 이어 받는다 — 직접 적은 한 줄(`ctx.note`)은 상황의 변화로 이미 반영됐고, 저장하면 주입 문구가 학습자 상황에 남을 수 있다.
  const description = ctx.base.description ?? null
  const fit = fitScenarioDraft({ level: ctx.level, description, topicId: null }, { status: 'OK', draft: { ...d, keyExpressions: kept } })
  if (fit.status !== 'OK' || !fit.draft) return bad('INVALID', fit.problems, { ...repairs, ...fit.repairs })
  Object.assign(repairs, fit.repairs, { koDropped: repairs.koDropped, latinDropped: repairs.latinDropped })

  const draft: ScenarioDraftOutput = { ...fit.draft }

  // 4) 역할 구도: 학습자 역할은 기준과 똑같이, 상대 역할은 성격 축이 없으면 기준과 똑같이 있으면 기준 앞에 성격을 붙인 이름.
  const learner = ctx.base.roles.learner
  if (nk(draft.roles.learner) !== nk(learner)) repairs.learnerRoleFixed = true
  let tutor = draft.roles.tutor
  const baseTutor = ctx.base.roles.tutor
  if (ctx.axes.persona === 'same') {
    if (nk(tutor) !== nk(baseTutor)) {
      tutor = baseTutor
      repairs.tutorRoleFixed = true
    }
  } else if (nk(tutor) === nk(baseTutor) || !nk(tutor).includes(nk(baseTutor))) {
    tutor = cutTo(`${SCENARIO_VARIANT_PERSONA_ADJECTIVE[ctx.axes.persona]} ${baseTutor}`, L.roleMax)
    repairs.tutorRoleFixed = true
  }
  draft.roles = { learner, tutor }

  // 5) 제목: 기준과 같으면 변형임이 드러나게.
  if (nk(draft.title) === nk(ctx.base.title)) {
    draft.title = cutTo(`${ctx.base.title}${SCENARIO_VARIANT_TITLE_SUFFIX}`, L.titleMax)
    repairs.titleFixed = true
  }

  // 6) 첫마디: `openingDraft` 와 같은 일본어 검사(60자·3문장·글자 종류·로마자 규칙). 모델의 첫마디가 못 통과하면 기준 상황의 첫마디로 되돌린다(역할 구도를 유지 — 기준에 첫마디가
  //    없었다면 첫마디 없이, 학습자가 편집기에서 한국어로 적어 일본어를 만들 수 있다). 1차 실측: 4문장 첫마디가 `DROPS_ASK` 로 탈락해 첫마디가 사라졌다.
  const checkedOpening = (o: { ja: string; ko: string } | null | undefined): { ja: string; ko: string } | null => {
    if (!o) return null
    const r = fitOpeningDraft({ status: 'OK', ja: o.ja, reading: null }, { ko: o.ko })
    return r.status === 'OK' && r.ja ? { ja: r.ja, ko: o.ko } : null
  }
  const modelOpening = checkedOpening(draft.opening)
  if (modelOpening) draft.opening = modelOpening
  else {
    draft.opening = checkedOpening(ctx.base.opening)
    repairs.openingDropped = true
    repairs.openingFromBase = draft.opening !== null
  }

  // 7) 장소는 기준 상황 그대로(목적 유지).
  if (ctx.topicIds.length > 0) draft.topicIds = [...ctx.topicIds]

  // 8) 바뀐 칸(코드 비교)과 반영 검사.
  const changedFields = computeVariantChangedFields(ctx.base, draft)
  const problems = reflectionProblems(ctx, changedFields, countNewExpressions(ctx.base, draft.keyExpressions))
  if (problems.length > 0) return bad('INVALID', problems, repairs)
  return { status: 'OK', draft, changedFields, problems: [], repairs }
}

const PROBLEM_TEXT: Record<ScenarioVariantProblem, string> = {
  DRAFT_MISSING: 'status 가 OK 이면 draft 객체가 있어야 합니다.',
  TITLE_EMPTY: 'title 이 비어 있습니다.',
  ROLES_EMPTY: 'roles.learner 와 roles.tutor 에 짧은 한국어 역할 이름을 모두 채워야 합니다.',
  GOAL_EMPTY: 'goalKo 가 비어 있습니다.',
  CRITERIA_EMPTY: 'successCriteria 에 한국어 성공 조건이 1개 이상 있어야 합니다.',
  STEPS_TOO_FEW: `steps 는 비지 않은 항목이 ${L.stepsMin}개 이상이어야 합니다.`,
  EXPRESSIONS_TOO_FEW: `keyExpressions 는 쓸 수 있는 표현(일본어, 고정 부분 5자 이상, 한국어 뜻 있음, 서로 겹치지 않음)이 ${L.expressionsMin}개 이상이어야 합니다.`,
  TEXT_UNSAFE: '어떤 칸에도 URL(http://·www.)·꺾쇠(< >)·키나 비밀번호처럼 보이는 글·보이지 않는 글자를 넣지 않습니다. 평범한 글로 다시 쓰세요.',
  ENGINE_NAME: '어떤 칸에도 AI·모델·도구 이름을 넣지 않습니다. 상황 안의 말과 내용만 쓰세요.',
  KO_FIELD_NO_HANGUL: 'title·roles·goalKo·successCriteria·steps·opening.ko 는 한국어(한글)로 씁니다. 일본어나 영어만 있는 칸이 있습니다.',
  NOT_REFLECTED:
    '바꾸라고 한 조건이 대화에 반영되지 않았습니다. steps 에는 그 변화가 일어나는 단계를 넣고, keyExpressions 에는 그 변화에 대응하는 새 표현(원본에 없던 것)을 1개 이상 넣으세요(원본과 같은 단계·표현을 그대로 두지 마세요).',
  LEVEL_NOT_REFLECTED: '표현 수준을 한 단계 올리라고 했는데 원본 표현이 거의 그대로입니다. 더 자연스럽고 조금 긴 표현으로 새로 쓴 표현을 2개 이상 넣으세요.',
}

/** `completeJson` 의 `extraCheck` — 고칠 수 없는 위반만 알려 재시도 1회로 보낸다(그 밖은 `fitScenarioVariant` 가 코드로 고친다). */
export function scenarioVariantViolations(ctx: ScenarioVariantContext, data: ScenarioVariantModelResponse): string[] {
  const fin = fitScenarioVariant(ctx, data)
  return fin.status === 'INVALID' ? fin.problems.map((p) => PROBLEM_TEXT[p]) : []
}

