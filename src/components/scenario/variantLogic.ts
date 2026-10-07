/**
 * 변형 상황 만들기 A(task-045, screens.md §16-2 A) — React 를 모르는 순수 함수와 #177 요청 제어기(시험 가능). 상태는 `useVariantDraft`.
 *  - 축 열거·라벨은 `types/scenarioVariant.ts` 단일 출처(화면에 복사하지 않는다). 기준이 N1 이면 「한 단계 위」는 고를 수 없다(서버는 `same` 으로 접는다).
 *  - 하나도 안 고르면 요청을 보내지 않는다(직접 적기만 적은 경우도 — 서버 `no_change`).
 *  - 초안은 저장 전까지 어디에도 남지 않는다(이 탭 보관도 하지 않는다). 직접 적은 글(`note`)은 저장 본문에 들어가지 않는다.
 *  - 요청은 한 번에 하나(409 `DRAFT_BUSY` 도 한도를 쓴다), 시작 뒤 `OPENING_CANCEL_LOCK_MS` 동안은 [그만두기]가 듣지 않는다(같은 버튼 더블 탭 — REV-160 M-3 과 같은 이유).
 */
import { isAbort } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { cpLength } from '@/components/common/format'
import type { JlptLevel } from '@/types/lesson'
import type { ScenarioInput } from '@/types/scenario'
import {
  SCENARIO_VARIANT_AXES,
  SCENARIO_VARIANT_AXIS_KEYS,
  SCENARIO_VARIANT_AXIS_LABELS,
  SCENARIO_VARIANT_FIELDS,
  SCENARIO_VARIANT_NO_AXES,
  SCENARIO_VARIANT_NOTE_MAX,
  raiseJlptLevel,
  type ScenarioVariantAxes,
  type ScenarioVariantAxisKey,
  type ScenarioVariantField,
  type ScenarioVariantRequestBody,
} from '@/types/scenarioVariant'
import { scenarioFailure, type ScenarioFailure } from './failure'
import { draftFromResponse, draftInput, draftLevelOf, oneLine, type EditableDraft } from './logic'
import { OPENING_CANCEL_LOCK_MS } from './openingFlight'
import { VARIANT } from './scenarioCopy'

export const VARIANT_LONG_MS = 20_000
/** 서버 `maxDuration` 60초(엔진 40초 + 큐 대기)와 같은 벽시계. */
export const VARIANT_TIMEOUT_MS = 60_000
export const VARIANT_CANCEL_LOCK_MS = OPENING_CANCEL_LOCK_MS

export interface AxisOption {
  value: string
  label: string
  disabled: boolean
}

/** 축 하나의 칩 — 순서·라벨은 단일 출처 그대로, 표현 수준만 수준 글자를 붙인다. */
export function axisOptions(key: ScenarioVariantAxisKey, baseLevel: JlptLevel): AxisOption[] {
  const labels = SCENARIO_VARIANT_AXIS_LABELS[key].options as Readonly<Record<string, string>>
  return (SCENARIO_VARIANT_AXES[key] as readonly string[]).map((value) => {
    if (key !== 'level') return { value, label: labels[value], disabled: false }
    if (value === 'same') return { value, label: VARIANT.levelSame(baseLevel), disabled: false }
    const top = baseLevel === 'N1'
    return { value, label: top ? labels[value] : VARIANT.levelUp(raiseJlptLevel(baseLevel)), disabled: top }
  })
}

/** 칩 누르기 — 목록에 없는 값·N1 의 「한 단계 위」는 무시한다. 같은 값이면 같은 객체(다시 그리지 않게). */
export function pickAxis(axes: ScenarioVariantAxes, key: ScenarioVariantAxisKey, value: string, baseLevel: JlptLevel): ScenarioVariantAxes {
  if (!(SCENARIO_VARIANT_AXES[key] as readonly string[]).includes(value)) return axes
  if (key === 'level' && value === 'up' && baseLevel === 'N1') return axes
  if (axes[key] === value) return axes
  return { ...axes, [key]: value } as ScenarioVariantAxes
}

/** 실제로 바뀌는 축(N1 의 `up` 은 `same` — 서버와 같은 규칙). */
export function effectiveAxes(axes: ScenarioVariantAxes, baseLevel: JlptLevel): ScenarioVariantAxes {
  return baseLevel === 'N1' && axes.level === 'up' ? { ...axes, level: 'same' } : axes
}

export function hasVariation(axes: ScenarioVariantAxes, baseLevel: JlptLevel): boolean {
  const a = effectiveAxes(axes, baseLevel)
  return SCENARIO_VARIANT_AXIS_KEYS.some((k) => a[k] !== SCENARIO_VARIANT_NO_AXES[k])
}

export type SubmitBlock = 'noChange' | 'noteLong' | null

/** [변형 초안 만들기]를 막는 이유(막히면 요청 0). */
export function submitBlock(axes: ScenarioVariantAxes, note: string, baseLevel: JlptLevel): SubmitBlock {
  if (!hasVariation(axes, baseLevel)) return 'noChange'
  if (cpLength(oneLine(note)) > SCENARIO_VARIANT_NOTE_MAX) return 'noteLong'
  return null
}

/**
 * 검토 안내의 「바꾼 것」(데모 v2 `:957` `picked`) — 실제로 바뀌는 축(N1 의 `up` 은 `same` 으로 접힌다)의 칩 글자를 성격·돌발·흐름·수준 순서로.
 * 직접 적은 글(`note`)은 싣지 않는다(데모도 축만). 축 없이 직접 적기만으로는 요청이 나가지 않으므로 검토 단계엔 빈 목록이 오지 않는다.
 */
export function changedAxisLabels(axes: ScenarioVariantAxes, baseLevel: JlptLevel): string[] {
  const a = effectiveAxes(axes, baseLevel)
  return SCENARIO_VARIANT_AXIS_KEYS.filter((k) => a[k] !== SCENARIO_VARIANT_NO_AXES[k])
    .map((k) => axisOptions(k, baseLevel).find((o) => o.value === a[k])?.label ?? '')
    .filter((l) => l !== '')
}

/** 검토 안내 글 — 「바꾼 것 · …」 + 「바뀜」 안내 + 「원본은 그대로예요」. 바뀐 축이 없으면 뒤쪽 안내만(방어). */
export function variantReviewBody(axes: ScenarioVariantAxes, baseLevel: JlptLevel): string {
  const labels = changedAxisLabels(axes, baseLevel)
  return labels.length ? `${VARIANT.reviewChanged(labels.join(' · '))} ${VARIANT.reviewBody}` : VARIANT.reviewBody
}

/** #177 본문 — 바꾸는 축만 싣는다. 직접 적은 글은 한 줄로 정리해 비었으면 뺀다. */
export function variantRequestBody(axes: ScenarioVariantAxes, note: string, baseLevel: JlptLevel): ScenarioVariantRequestBody {
  const a = effectiveAxes(axes, baseLevel)
  const picked: Partial<Record<ScenarioVariantAxisKey, string>> = {}
  for (const k of SCENARIO_VARIANT_AXIS_KEYS) if (a[k] !== SCENARIO_VARIANT_NO_AXES[k]) picked[k] = a[k]
  const n = oneLine(note)
  const body: ScenarioVariantRequestBody = { axes: picked as Partial<ScenarioVariantAxes> }
  if (n) body.note = n
  return body
}

export interface VariantDraft {
  draft: EditableDraft
  /** 설명은 원본 그대로 온다(화면에서 고치지 않는다) — 저장 본문에 그대로 싣는다. */
  description: string
  changed: ReadonlySet<ScenarioVariantField>
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** #177 응답 → 편집 값·설명·「바뀜」 칸. 장소는 응답 `draft.topicIds`(서버가 기준 상황의 장소를 이어 준다). 쓸 수 없는 응답은 null. */
export function variantResult(raw: unknown, baseLevel: JlptLevel): VariantDraft | null {
  if (!isObj(raw) || !isObj(raw.draft)) return null
  const draft = draftFromResponse(raw, { desc: '', topicId: null, level: draftLevelOf(baseLevel) })
  if (!draft || !oneLine(draft.title)) return null
  const description = typeof raw.draft.description === 'string' ? raw.draft.description : ''
  const known = SCENARIO_VARIANT_FIELDS as readonly string[]
  const changed = new Set((Array.isArray(raw.changedFields) ? raw.changedFields : []).filter((f): f is ScenarioVariantField => typeof f === 'string' && known.includes(f)))
  return { draft, description, changed }
}

/** #163 저장 본문 — 고친 편집 값 + 원본 설명. 직접 적은 글은 싣지 않는다. */
export function variantSaveBody(v: Pick<VariantDraft, 'description'>, edited: EditableDraft): ScenarioInput {
  return draftInput(edited, { desc: v.description })
}

/* ── #177 요청 한 건의 흐름 ─────────────────────────────────────────── */

export type VariantPhase = 'idle' | 'busy' | 'failed'

export interface VariantFlightState {
  phase: VariantPhase
  failure: ScenarioFailure | null
  /** 만드는 중이고 `VARIANT_LONG_MS` 가 지났을 때. */
  long: boolean
  /** 만드는 중이고 취소 잠금 시간이 지났을 때만 true. */
  cancelable: boolean
}

export const VARIANT_IDLE: VariantFlightState = { phase: 'idle', failure: null, long: false, cancelable: false }

export interface VariantFlightDeps {
  post: (body: ScenarioVariantRequestBody, signal: AbortSignal) => Promise<unknown>
  onState: (s: VariantFlightState) => void
  timers?: { set: (fn: () => void, ms: number) => unknown; clear: (handle: unknown) => void }
}

export interface VariantFlight {
  /** 요청 — 응답을 `parse` 로 읽어 쓸 수 있으면 `onResult`. 요청 중이면 아무것도 하지 않는다. */
  make: <T>(body: ScenarioVariantRequestBody, parse: (raw: unknown) => T | null, onResult: (v: T) => void) => void
  /** 취소 잠금이 지난 요청만 끊는다. */
  cancel: () => void
  /** 지난 실패를 지운다(요청 중에는 아무것도 안 한다). */
  clear: () => void
  /** 화면이 사라질 때 — 요청·타이머를 정리한다(상태는 알리지 않는다). */
  dispose: () => void
}

const BAD_RESPONSE = { status: 502, message: '', code: null, details: {}, retryAfterSec: null }

export function createVariantFlight(deps: VariantFlightDeps): VariantFlight {
  const timers = deps.timers ?? { set: (fn: () => void, ms: number) => setTimeout(fn, ms), clear: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>) }
  let cur: { ac: AbortController; handles: unknown[]; timedOut: boolean } | null = null
  let state = VARIANT_IDLE

  const emit = (next: Partial<VariantFlightState>) => {
    state = { ...state, ...next }
    deps.onState(state)
  }
  const release = () => {
    if (!cur) return
    cur.handles.forEach((h) => timers.clear(h))
    cur = null
  }

  const make: VariantFlight['make'] = (body, parse, onResult) => {
    if (cur) return
    const run = { ac: new AbortController(), handles: [] as unknown[], timedOut: false }
    cur = run
    run.handles.push(
      timers.set(() => {
        run.timedOut = true
        run.ac.abort()
      }, VARIANT_TIMEOUT_MS),
      timers.set(() => cur === run && emit({ cancelable: true }), VARIANT_CANCEL_LOCK_MS),
      timers.set(() => cur === run && emit({ long: true }), VARIANT_LONG_MS),
    )
    emit({ phase: 'busy', failure: null, long: false, cancelable: false })
    deps.post(body, run.ac.signal).then(
      (raw) => {
        if (cur !== run) return
        release()
        const v = parse(raw)
        if (v === null) return emit({ phase: 'failed', failure: scenarioFailure('variantDraft', BAD_RESPONSE), long: false, cancelable: false })
        emit({ phase: 'idle', long: false, cancelable: false })
        onResult(v)
      },
      (e: unknown) => {
        if (cur !== run) return
        const timedOut = run.timedOut
        release()
        if (isAbort(e) && !timedOut) return emit({ phase: 'idle', long: false, cancelable: false })
        const err = toErr(e)
        emit({ phase: 'failed', failure: scenarioFailure('variantDraft', timedOut ? { ...err, status: 504 } : err), long: false, cancelable: false })
      },
    )
  }

  const cancel: VariantFlight['cancel'] = () => {
    const run = cur
    if (!run || !state.cancelable) return
    release()
    run.ac.abort()
    emit({ phase: 'idle', long: false, cancelable: false })
  }

  const clear: VariantFlight['clear'] = () => {
    if (cur || state.phase !== 'failed') return
    emit({ phase: 'idle', failure: null })
  }

  const dispose: VariantFlight['dispose'] = () => {
    const run = cur
    if (!run) return
    release()
    run.ac.abort()
  }

  return { make, cancel, clear, dispose }
}
