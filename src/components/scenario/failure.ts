/**
 * 상황 쪽 서버 오류 → 화면 고정 문구(screens.md §16-7 규칙 — 상황 초안 #166·저장 #163·고치기 #164·내 버전 #175·지우기/숨기기 #165·
 * 되돌리기 #176·첫마디 제안 #178). **서버 `message` 는 화면에 쓰지 않는다**(400 문구에 「을(를)」 조사 병기가 섞여 있다).
 * 고르는 열쇠 = (문맥, HTTP 상태, `details.reason`, `details.field`, `retryAfterSec`) — 429 는 `reason` 없이 `retryAfterSec` 만 오기도 해서
 * 선생님 초안류(#166·#178)는 60초를 넘으면 하루 한도로 읽는다. 표에 없는 조합은 그 문맥의 일반 실패 문구로 떨어진다.
 * topic 폴더(`components/topic/failure.ts`)를 import 하지 않는다(의존 방향 topic → scenario). 순수 함수 — 초점·닫기는 `kind` 를 보고 화면이 정한다.
 */
import { detailString, retryAfterOf, type Err } from '@/components/common/errors'
import { SCENARIO_LIMITS as L } from '@/types/scenario'
import { CHECK, DRAFT, FAIL, SHEET, type FieldLabelKey } from './scenarioCopy'

export type ScenarioFailContext =
  | 'scenarioDraft' // #166 내 상황 만들기 묻기 단계
  | 'scenarioSave' // #163
  | 'scenarioEdit' // #164
  | 'scenarioFork' // #175 기본 상황 → 내 버전
  | 'scenarioDelete' // #165 내 상황
  | 'scenarioHide' // #165 기본 상황(나에게서 숨기기)
  | 'scenarioRevert' // #176 내 버전 → 기본
  | 'openingDraft' // #178

export type ScenarioFailureKind =
  | 'network'
  | 'userGone'
  | 'field'
  | 'unfit'
  | 'tooLong'
  | 'busy'
  | 'rate'
  | 'daily'
  | 'engine'
  | 'limit'
  | 'gone'
  | 'copied'
  | 'seedGone'
  | 'notOverridden'
  | 'fail'

export interface ScenarioFieldFailure {
  /** 서버 칸 경로 그대로(`steps[2].ko`·`opening.ko`·`ko` …) — 화면 칸 열쇠로 바꾸는 일은 `logic.problemKey`. */
  field: string
  text: string
  /** 화면이 막았어야 할 모양 오류(`type`·`unknown_key`·`format` …). */
  defect: boolean
}

export interface ScenarioFailure {
  kind: ScenarioFailureKind
  text: string
  /** 둘째 줄(첫마디 「한국어는 그대로 있어요」). */
  body: string | null
  problems: ScenarioFieldFailure[]
  /** 그 자리 [다시 …] 버튼을 보일지. */
  retry: boolean
  /** 버튼을 막을지(하루 한도). */
  block: boolean
  waitSec: number | null
}

const LLM_CONTEXTS: ReadonlySet<ScenarioFailContext> = new Set(['scenarioDraft', 'openingDraft'])
const FIELD_CONTEXTS: ReadonlySet<ScenarioFailContext> = new Set(['scenarioDraft', 'scenarioSave', 'scenarioEdit', 'scenarioFork', 'openingDraft'])

function make(kind: ScenarioFailureKind, text: string, extra: Partial<Omit<ScenarioFailure, 'kind' | 'text'>> = {}): ScenarioFailure {
  return { kind, text, body: null, problems: [], retry: false, block: false, waitSec: null, ...extra }
}

/** 칸 경로 → 이름표·글자 상한·목록 개수 범위. 이름표가 없는 칸은 null(이름이 들어가는 문구는 결함 문구로 떨어진다). */
function labelOf(ctx: ScenarioFailContext, field: string): { key: FieldLabelKey; max: number | null } | null {
  if (ctx === 'openingDraft') {
    if (field === 'ko') return { key: 'openingKo', max: L.openingKoMax }
    return null
  }
  if (field === 'title') return { key: 'title', max: L.titleMax }
  if (field === 'titleJa') return { key: 'titleJa', max: L.titleJaMax }
  if (field === 'description') return { key: 'description', max: L.descriptionMax }
  if (field === 'level') return { key: 'level', max: null }
  if (field === 'difficulty') return { key: 'difficulty', max: null }
  if (field === 'topicId' || field === 'topicIds' || /^topicIds\[\d+\]$/.test(field)) return { key: 'place', max: null }
  if (field === 'roles' || field === 'roles.learner') return { key: 'learner', max: L.roleMax }
  if (field === 'roles.tutor') return { key: 'tutor', max: L.roleMax }
  if (field === 'goal' || field === 'goal.communicativeGoalKo') return { key: 'goal', max: L.goalMax }
  if (field === 'goal.successCriteria' || /^goal\.successCriteria\[\d+\]$/.test(field)) return { key: 'criterion', max: L.successCriterionMax }
  if (field === 'steps' || /^steps\[\d+\](\.ko)?$/.test(field)) return { key: 'step', max: L.stepMax }
  if (field === 'keyExpressions' || field === 'requiredExpressions') return { key: 'expressions', max: null }
  if (/^keyExpressions\[\d+\]\.ja$/.test(field)) return { key: 'exprJa', max: L.expressionJaMax }
  if (/^keyExpressions\[\d+\]\.ko$/.test(field)) return { key: 'exprKo', max: L.expressionKoMax }
  if (/^keyExpressions\[\d+\]\.reading$/.test(field)) return { key: 'exprReading', max: L.expressionReadingMax }
  if (field === 'opening.ko') return { key: 'openingKo', max: L.openingKoMax }
  if (field === 'opening.ja') return { key: 'openingJa', max: L.openingJaMax }
  return null
}

/** 목록 칸의 개수 문구(`min N`·`max N` reason). 단위는 칸마다 고정 — 대화 순서만 「단계」. */
function countText(key: FieldLabelKey, kind: 'min' | 'max', n: number): string | null {
  if (key === 'step') return kind === 'min' ? `대화 순서는 ${n}단계 이상이어야 해요.` : `대화 순서는 ${n}단계까지 넣을 수 있어요.`
  if (key === 'criterion' || key === 'expressions' || key === 'place') return kind === 'min' ? CHECK.listMin(key, n) : CHECK.listMax(key, n)
  return null
}

/** 400 칸 문제 한 개 → 고정 문구(§16-7 칸 문구 표 — 상황 편집기 칸 이름표). */
export function scenarioFieldFailure(ctx: ScenarioFailContext, field: string, reason: string): ScenarioFieldFailure {
  const ok = (text: string): ScenarioFieldFailure => ({ field, text, defect: false })
  const defect: ScenarioFieldFailure = { field, text: CHECK.defect, defect: true }
  const lab = labelOf(ctx, field)
  const count = /^(min|max) (\d+)$/.exec(reason)
  if (count) {
    const text = lab ? countText(lab.key, count[1] as 'min' | 'max', Number(count[2])) : null
    return text ? ok(text) : defect
  }
  switch (reason) {
    case 'required':
    case 'no_text':
    case 'empty':
      if (field === 'body') return defect
      return lab ? ok(CHECK.required(lab.key)) : defect
    case 'max_length':
      if (lab?.key === 'openingKo') return ok(FAIL.opening.max)
      return lab && lab.max !== null ? ok(CHECK.tooLong(lab.key, lab.max)) : defect
    case 'forbidden_char':
    case 'url':
      return ok(CHECK.forbidden)
    case 'secret_like':
      return ok(CHECK.secretLike)
    case 'no_hangul':
      return ok(CHECK.noHangul)
    case 'duplicate':
      return /^keyExpressions\[\d+\]\.ja$/.test(field) ? ok(CHECK.duplicate) : defect
    case 'enum':
      return lab ? ok(CHECK.enumPick) : defect
    case 'not_found':
    case 'not_linked':
      return lab?.key === 'place' ? ok(CHECK.notLinked) : defect
    default:
      // `range 1-5`(난이도)·`N5|N4|…`(수준 목록) 꼴 — 고르는 칸이라 「목록에서 골라 주세요」.
      if (lab && (lab.key === 'level' || lab.key === 'difficulty') && /^(range |N\d)/.test(reason)) return ok(CHECK.enumPick)
      return defect
  }
}

/** `details.problems[]` 가 있으면 그것을, 없으면 `{field, reason}` 한 개를 읽는다. */
export function scenarioFieldFailures(ctx: ScenarioFailContext, details: Record<string, unknown>): ScenarioFieldFailure[] {
  const raw = Array.isArray(details.problems) ? details.problems : [details]
  const out: ScenarioFieldFailure[] = []
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue
    const { field, reason } = p as { field?: unknown; reason?: unknown }
    if (typeof field !== 'string' || !field || typeof reason !== 'string' || !reason) continue
    out.push(scenarioFieldFailure(ctx, field, reason))
  }
  return out
}

function onTooMany(ctx: ScenarioFailContext, err: Err, reason: string | null): ScenarioFailure {
  const sec = retryAfterOf(err)
  if (LLM_CONTEXTS.has(ctx)) {
    const daily = reason === 'DAILY_LIMIT' || sec > 60
    if (ctx === 'openingDraft') {
      return daily
        ? make('daily', FAIL.opening.daily(FAIL.waitAbout(sec)), { block: true, waitSec: sec })
        : make('rate', FAIL.opening.rate(sec), { waitSec: sec })
    }
    return daily ? make('daily', FAIL.draftDaily, { block: true, waitSec: sec }) : make('rate', FAIL.draftRate(sec), { waitSec: sec })
  }
  if (reason === 'DAILY_LIMIT' && (ctx === 'scenarioSave' || ctx === 'scenarioFork')) return make('daily', FAIL.saveDaily, { block: true, waitSec: sec })
  return make('rate', FAIL.writeRate(sec), { waitSec: sec })
}

/** 그 문맥의 일반 실패(표에 없는 조합·5xx). */
function generic(ctx: ScenarioFailContext): ScenarioFailure {
  switch (ctx) {
    case 'scenarioDraft':
      return make('engine', DRAFT.genFail, { retry: true })
    case 'openingDraft':
      return make('engine', FAIL.opening.fail, { body: FAIL.opening.failKeep, retry: true })
    case 'scenarioSave':
    case 'scenarioEdit':
    case 'scenarioFork':
      return make('fail', DRAFT.saveFail, { retry: true })
    case 'scenarioDelete':
      return make('fail', SHEET.deleteFail, { retry: true })
    case 'scenarioHide':
      return make('fail', FAIL.hideFail, { retry: true })
    case 'scenarioRevert':
      return make('fail', FAIL.revertFail, { retry: true })
  }
}

/** 문맥 + 오류 → 화면 문구·동작 힌트. */
export function scenarioFailure(ctx: ScenarioFailContext, err: Err): ScenarioFailure {
  const reason = detailString(err, 'reason')

  if (err.status === 0) {
    if (ctx === 'openingDraft') return make('network', FAIL.network, { body: FAIL.opening.failKeep, retry: true })
    return make('network', FAIL.network, { retry: true })
  }
  if (err.status === 404 && reason === 'USER_GONE') return make('userGone', FAIL.userGone)
  if (err.status === 429) return onTooMany(ctx, err, reason)

  if (err.status === 400 && FIELD_CONTEXTS.has(ctx)) {
    const problems = scenarioFieldFailures(ctx, err.details)
    if (problems.length) return make('field', problems[0].text, { problems })
    return make('field', CHECK.defect)
  }

  switch (ctx) {
    case 'scenarioDraft':
      if (err.status === 422) return make('unfit', DRAFT.gen422)
      if (err.status === 409) return make('busy', FAIL.draftBusy)
      break
    case 'openingDraft':
      if (err.status === 422) return reason === 'TOO_LONG' ? make('tooLong', FAIL.opening.tooLong) : make('unfit', FAIL.opening.unfit)
      if (err.status === 409) return make('busy', FAIL.opening.busy)
      break
    case 'scenarioFork':
      if (err.status === 409 && reason === 'ALREADY_COPIED') return make('copied', DRAFT.copied)
      if (err.status === 404) return make('seedGone', FAIL.seedGone)
      if (err.status === 409 && reason === 'SCENARIO_LIMIT') return make('limit', FAIL.saveLimit)
      break
    case 'scenarioSave':
    case 'scenarioEdit':
      if (err.status === 409 && reason === 'SCENARIO_LIMIT') return make('limit', FAIL.saveLimit)
      if (err.status === 404 || (err.status === 409 && reason === 'ARCHIVED')) return make('gone', DRAFT.edit404)
      break
    case 'scenarioRevert':
      if (err.status === 404 && reason === 'NOT_OVERRIDDEN') return make('notOverridden', FAIL.notOverridden)
      if (err.status === 404) return make('gone', FAIL.scenarioGone)
      break
    case 'scenarioDelete':
    case 'scenarioHide':
      if (err.status === 404 || (err.status === 409 && reason === 'ARCHIVED')) return make('gone', FAIL.scenarioGone)
      break
  }
  return generic(ctx)
}
