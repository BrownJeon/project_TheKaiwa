/**
 * 서버 오류 → 화면 고정 문구(screens.md §16-7). **서버 `message` 는 쓰지 않는다** — 400 문구에 「을(를)」 조사 병기가 섞여 있다.
 * 고르는 열쇠 = (문맥, HTTP 상태, `details.reason`, `details.field`, `retryAfterSec`). `reason` 하나로 고르지 않는다:
 * 같은 409 도 문맥마다 뜻이 다르고, 429 는 `rateLimit()` 이 `reason` 없이 `retryAfterSec` 만 준다(선생님 초안 4종은 60초를 넘으면 하루 한도로 읽는다).
 * 표에 없는 조합은 그 문맥의 일반 실패 문구로 떨어진다(서버 문구로 떨어지지 않는다). 순수 함수 — 화면 동작(초점·닫기)은 `kind` 를 보고 화면이 정한다.
 */
import { detailString, retryAfterOf, type Err } from '@/components/common/errors'
import { SCENARIO_LIMITS } from '@/types/scenario'
import { TOPIC_SAVE_LIMITS } from '@/types/topicWrite'
import { EDIT, FAIL, HIDDEN, REMOVAL, SCDRAFT, TOPIC, type FieldLabel } from './topicCopy'

export type FailContext =
  | 'topicDraft' // #170 · 수준 바꿔 표현 다시 받기(D4)
  | 'scenarioDraft' // #166 (S4)
  | 'topicSave' // #57
  | 'topicEdit' // #171
  | 'topicFork' // #174
  | 'scenarioSave' // #163 (S4·A)
  | 'scenarioFork' // #175
  | 'removalPreview' // #172
  | 'topicDelete' // #173 내 주제·내 버전
  | 'topicRestore' // #176 주제 내 버전 되돌리기
  | 'topicHide' // #173 기본 주제 숨기기
  | 'hiddenRestore' // #176 숨긴 항목 다시 보기
  | 'scenarioHide' // #165 상황 시트(기본 숨기기)
  | 'scenarioRevert' // #176 상황 시트(내 버전 되돌리기)
  | 'openingDraft' // #178
  | 'variantDraft' // #177

export type FailureKind =
  | 'network'
  | 'userGone'
  | 'field'
  | 'unfit'
  | 'busy'
  | 'rate'
  | 'daily'
  | 'engine'
  | 'limit'
  | 'gone'
  | 'useFork'
  | 'copied'
  | 'seedGone'
  | 'impactChanged'
  | 'notOverridden'
  | 'shown'
  | 'noVariation'
  | 'tooLong'
  | 'fail'

export interface FieldFailure {
  /** 서버 칸 경로 그대로(`chunks[3].reading`·`opening.ko` …) — 화면 칸 열쇠로 바꾸는 일은 화면이 한다. */
  field: string
  text: string
  /** 화면이 막았어야 할 모양 오류(`type`·`unknown_key` …) — 화면 결함이라 콘솔 경고 대상. */
  defect: boolean
}

export interface Failure {
  kind: FailureKind
  text: string
  /** 둘째 줄(찾을 수 없음 본문·첫마디 「한국어는 그대로 있어요」). */
  body: string | null
  /** 400 칸 문제(`details.problems[]` 또는 `{field, reason}`). */
  problems: FieldFailure[]
  /** 그 자리 [다시 …] 버튼을 보일지. */
  retry: boolean
  /** 버튼을 막을지(하루 한도). */
  block: boolean
  /** 429 남은 초. */
  waitSec: number | null
  /** 409 `IMPACT_CHANGED` 의 새 사전 조회(`details.preview`) — 확인 창을 이 값으로 다시 채운다. */
  preview: unknown
}

const LLM_CONTEXTS: ReadonlySet<FailContext> = new Set(['topicDraft', 'scenarioDraft', 'openingDraft', 'variantDraft'])
const FIELD_CONTEXTS: ReadonlySet<FailContext> = new Set([
  'topicDraft',
  'scenarioDraft',
  'topicSave',
  'topicEdit',
  'topicFork',
  'scenarioSave',
  'scenarioFork',
  'openingDraft',
  'variantDraft',
])
const TOPIC_BODY_CONTEXTS: ReadonlySet<FailContext> = new Set(['topicSave', 'topicEdit', 'topicFork'])

function make(kind: FailureKind, text: string, extra: Partial<Omit<Failure, 'kind' | 'text'>> = {}): Failure {
  return { kind, text, body: null, problems: [], retry: false, block: false, waitSec: null, preview: null, ...extra }
}

const CHUNK_FIELD = /^chunks\[\d+\]\.(textJa|reading|meaningKo|chunkType|id)$/

/** 칸 경로 → 이름표·상한. 이름표가 없는 칸(상황 편집기 칸 등)은 null — 이름이 들어가는 문구는 일반 문구로 떨어진다. */
function labelOf(ctx: FailContext, field: string): { label: FieldLabel; max: number | null } | null {
  if (ctx === 'topicDraft') return field === 'title' ? { label: 'topic', max: TOPIC_ASK_TITLE_MAX } : null
  if (ctx === 'openingDraft') return field === 'ko' ? { label: 'opening', max: SCENARIO_LIMITS.openingKoMax } : null
  if (field === 'opening.ko') return { label: 'opening', max: SCENARIO_LIMITS.openingKoMax }
  if (!TOPIC_BODY_CONTEXTS.has(ctx)) return null
  if (field === 'title') return { label: 'title', max: TOPIC_SAVE_LIMITS.titleMax }
  if (field === 'titleJa') return { label: 'titleJa', max: TOPIC_SAVE_LIMITS.titleJaMax }
  if (field === 'description') return { label: 'description', max: TOPIC_SAVE_LIMITS.descriptionMax }
  if (field === 'level') return { label: 'level', max: null }
  if (field === 'chunks') return { label: 'chunks', max: null }
  const m = CHUNK_FIELD.exec(field)
  if (m?.[1] === 'textJa') return { label: 'textJa', max: TOPIC_SAVE_LIMITS.textJaMax }
  if (m?.[1] === 'reading') return { label: 'reading', max: TOPIC_SAVE_LIMITS.readingMax }
  if (m?.[1] === 'meaningKo') return { label: 'meaningKo', max: TOPIC_SAVE_LIMITS.meaningMax }
  return null
}

/** #170 주제 한 줄 글자 범위(라우트 `topicDraft` 본문 검사 2~40자). 화면이 먼저 막는다. */
export const TOPIC_ASK_TITLE_MIN = 2
export const TOPIC_ASK_TITLE_MAX = 40

/** 400 칸 문제 한 개 → 고정 문구(§16-7 칸 문구 표). */
export function fieldFailure(ctx: FailContext, field: string, reason: string, opts: { chunkCount?: number } = {}): FieldFailure {
  const ok = (text: string): FieldFailure => ({ field, text, defect: false })
  const defect: FieldFailure = { field, text: FAIL.field.defect, defect: true }
  const lab = labelOf(ctx, field)
  switch (reason) {
    case 'required':
    case 'no_text':
      return lab ? ok(FAIL.field.required(lab.label)) : defect
    case 'max_length':
      if (lab?.label === 'opening') return ok(FAIL.opening.max)
      return lab && lab.max !== null ? ok(FAIL.field.max(lab.label, lab.max)) : defect
    case 'forbidden_char':
    case 'url':
      return ok(FAIL.field.forbiddenChar)
    case 'secret_like':
      return ok(FAIL.field.secretLike)
    case 'not_japanese':
      return ok(FAIL.field.notJapanese)
    case 'chars':
      return ok(FAIL.field.chars)
    case 'reading':
      return ok(FAIL.field.reading)
    case 'duplicate':
      return ok(FAIL.field.duplicate)
    case 'count':
      return ok(FAIL.field.count(typeof opts.chunkCount === 'number' ? opts.chunkCount : null))
    case 'enum':
      return ok(FAIL.field.enum)
    case 'engine_name':
      return ok(FAIL.field.engineName)
    case 'no_hangul':
      return ok(FAIL.field.noHangul)
    case 'not_found':
    case 'not_linked':
      if (/^chunks\[\d+\]\.id$/.test(field)) return ok(FAIL.field.chunkGone)
      if (field === 'topicId' || field === 'topicIds' || field.startsWith('topicIds[')) return ok(FAIL.field.notLinked)
      return defect
    default:
      return defect
  }
}

/** `details.problems[]` 가 있으면 그것을, 없으면 `{field, reason}` 한 개를 읽는다. */
export function fieldFailures(ctx: FailContext, details: Record<string, unknown>, opts: { chunkCount?: number } = {}): FieldFailure[] {
  const raw = Array.isArray(details.problems) ? details.problems : [details]
  const out: FieldFailure[] = []
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue
    const { field, reason } = p as { field?: unknown; reason?: unknown }
    if (typeof field !== 'string' || !field || typeof reason !== 'string' || !reason) continue
    out.push(fieldFailure(ctx, field, reason, opts))
  }
  return out
}

function dailyByAge(ctx: FailContext, sec: number): Failure {
  const wait = FAIL.waitAbout(sec)
  const text =
    ctx === 'topicDraft'
      ? FAIL.topicDraft.daily(wait)
      : ctx === 'openingDraft'
        ? FAIL.opening.daily(wait)
        : FAIL.scenarioDraft.daily
  return make('daily', text, { block: true, waitSec: sec })
}

function rateFor(ctx: FailContext, sec: number): Failure {
  const text =
    ctx === 'topicDraft'
      ? FAIL.topicDraft.rate(sec)
      : ctx === 'scenarioDraft'
        ? FAIL.scenarioDraft.rate(sec)
        : ctx === 'openingDraft'
          ? FAIL.opening.rate(sec)
          : ctx === 'variantDraft'
            ? FAIL.variant.rate(sec)
            : FAIL.writeRate(sec)
  return make('rate', text, { waitSec: sec })
}

function onTooMany(ctx: FailContext, err: Err, reason: string | null): Failure {
  const sec = retryAfterOf(err)
  if (LLM_CONTEXTS.has(ctx)) return reason === 'DAILY_LIMIT' || sec > 60 ? dailyByAge(ctx, sec) : rateFor(ctx, sec)
  if (reason === 'DAILY_LIMIT') {
    if (ctx === 'topicSave' || ctx === 'topicEdit') return make('daily', FAIL.topicSave.daily, { block: true, waitSec: sec })
    if (ctx === 'topicFork') return make('daily', FAIL.topicSave.dailyFork, { block: true, waitSec: sec })
    if (ctx === 'scenarioSave' || ctx === 'scenarioFork') return make('daily', FAIL.scenarioSave.daily, { block: true, waitSec: sec })
  }
  return rateFor(ctx, sec)
}

const REMOVAL_FAIL: Record<'topicDelete' | 'topicRestore' | 'topicHide', string> = {
  topicDelete: REMOVAL.fail.delete,
  topicRestore: REMOVAL.fail.restore,
  topicHide: REMOVAL.fail.hide,
}

/** 그 문맥의 일반 실패(표에 없는 조합). */
function generic(ctx: FailContext): Failure {
  switch (ctx) {
    case 'topicDraft':
    case 'variantDraft':
      return make('engine', FAIL.engine, { retry: true })
    case 'scenarioDraft':
      return make('engine', SCDRAFT.fail, { retry: true })
    case 'openingDraft':
      return make('engine', FAIL.opening.fail, { body: FAIL.opening.failKeep, retry: true })
    case 'topicSave':
    case 'topicEdit':
    case 'topicFork':
      return make('fail', FAIL.topicSave.fail, { retry: true })
    case 'scenarioSave':
    case 'scenarioFork':
      return make('fail', FAIL.scenarioSave.fail, { retry: true })
    case 'removalPreview':
      return make('fail', REMOVAL.loadFail, { retry: true })
    case 'topicDelete':
    case 'topicRestore':
    case 'topicHide':
      return make('fail', REMOVAL_FAIL[ctx], { retry: true })
    case 'hiddenRestore':
      return make('fail', HIDDEN.fail, { retry: true })
    case 'scenarioHide':
      return make('fail', FAIL.scenarioHideFail, { retry: true })
    case 'scenarioRevert':
      return make('fail', FAIL.scenarioRevertFail, { retry: true })
  }
}

/**
 * 문맥 + 오류 → 화면 문구·동작 힌트. `opts.chunkCount` 는 표현 개수 문구(`count`)에 지금 개수를 넣을 때만.
 */
export function failureCopy(ctx: FailContext, err: Err, opts: { chunkCount?: number } = {}): Failure {
  const reason = detailString(err, 'reason')

  if (err.status === 0) {
    if (ctx === 'scenarioSave' || ctx === 'scenarioFork') return make('network', FAIL.scenarioSave.fail, { retry: true })
    return make('network', FAIL.network, { retry: true })
  }
  if (err.status === 404 && reason === 'USER_GONE') return make('userGone', FAIL.userGone)
  if (err.status === 429) return onTooMany(ctx, err, reason)

  if (err.status === 400 && FIELD_CONTEXTS.has(ctx)) {
    const problems = fieldFailures(ctx, err.details, opts)
    if (problems.length) return make('field', problems[0].text, { problems })
    return make('field', FAIL.field.defect, { problems: [] })
  }

  switch (ctx) {
    case 'topicDraft':
      if (err.status === 422) return make('unfit', FAIL.topicDraft.unfit)
      if (err.status === 409) return make('busy', FAIL.topicDraft.busy)
      break
    case 'scenarioDraft':
      if (err.status === 422) return make('unfit', SCDRAFT.unfit)
      if (err.status === 409) return make('busy', FAIL.scenarioDraft.busy)
      break
    case 'openingDraft':
      if (err.status === 422) return reason === 'TOO_LONG' ? make('tooLong', FAIL.opening.tooLong) : make('unfit', FAIL.opening.unfit)
      if (err.status === 409) return make('busy', FAIL.opening.busy)
      break
    case 'variantDraft':
      if (err.status === 404) return make('gone', FAIL.variant.baseGone)
      if (err.status === 422) return reason === 'NO_VARIATION' ? make('noVariation', FAIL.variant.noVariation) : make('unfit', FAIL.variant.unfit)
      if (err.status === 409) return make('busy', FAIL.variant.busy)
      break
    case 'topicSave':
      if (err.status === 409 && reason === 'TOPIC_LIMIT') return make('limit', FAIL.topicSave.limit)
      break
    case 'topicEdit':
      if (err.status === 404) return make('gone', TOPIC.notFound, { body: TOPIC.notFoundBody })
      if (err.status === 409 && reason === 'USE_FORK') return make('useFork', EDIT.useFork)
      break
    case 'topicFork':
    case 'scenarioFork':
      if (err.status === 409 && reason === 'ALREADY_COPIED') return make('copied', EDIT.copied)
      if (err.status === 404) return make('seedGone', FAIL.seedGone)
      if (err.status === 409 && reason === 'TOPIC_LIMIT') return make('limit', FAIL.topicSave.limit)
      if (err.status === 409 && reason === 'SCENARIO_LIMIT') return make('limit', FAIL.scenarioSave.limit)
      break
    case 'scenarioSave':
      if (err.status === 409 && reason === 'SCENARIO_LIMIT') return make('limit', FAIL.scenarioSave.limit)
      break
    case 'removalPreview':
      if (err.status === 404) return make('gone', REMOVAL.gone)
      break
    case 'topicDelete':
    case 'topicRestore':
    case 'topicHide':
      if (err.status === 409 && reason === 'IMPACT_CHANGED') return make('impactChanged', REMOVAL.changed, { preview: err.details.preview ?? null })
      if (err.status === 404 && reason === 'NOT_OVERRIDDEN') return make('notOverridden', FAIL.notOverridden)
      if (err.status === 404) return make('gone', REMOVAL.gone)
      break
    case 'hiddenRestore':
      if (err.status === 404 && reason === 'NOT_OVERRIDDEN') return make('shown', HIDDEN.shown)
      break
    case 'scenarioHide':
    case 'scenarioRevert':
      if (err.status === 404) return make('gone', FAIL.scenarioGone)
      break
  }
  return generic(ctx)
}
