'use client'

/**
 * S4 「상황 초안」 절·`partial` 상자·S5 상황 초안 고치기(screens.md §16-2 S4·S5 — 데모 v2 `scrReview` 상황 카드·`scedit`).
 * - 카드: 제목·일본어 제목·역할·첫마디 + 「이 상황도 저장」 체크 + [고치기](→ S5). 체크는 그 카드의 흐림·체크·머리 숫자만 바꾼다
 *   (목록 `key` 는 카드 열쇠 그대로 — 다시 그리지 않는다, R1·R2). 만드는 중에는 같은 높이(132px) 자리 카드.
 * - [＋ 상황 하나 더 만들기]는 그 자리에서 펼친다(최대 2개, 앞 요청이 도는 동안 막힘 — #166 동시 1건).
 * - 문구는 `topicCopy` 고정 문구(서버 `message` 는 쓰지 않는다). 장소는 아직 id 가 없는 새 주제라 S5 는 장소 칸을 정적 글로 둔다(`placesFixed`).
 */
import { useState } from 'react'
import { Btn, Field } from '@/components/common/ui'
import { cpLength } from '@/components/common/format'
import { ErrorBox } from '@/components/challenge/parts'
import { Spinner } from '@/components/plan/parts'
import DraftEditor from '@/components/scenario/DraftEditor'
import { oneLine, type DraftProblem, type EditableDraft } from '@/components/scenario/logic'
import { DRAFT } from '@/components/scenario/scenarioCopy'
import { SCENARIO_LIMITS } from '@/types/scenario'
import type { Failure } from './failure'
import { SCENARIO_DRAFTS_MAX, topicProblemDomId, type PartialView, type ScenarioSlot, type ScenarioSlotKey, type TopicDraftFlightState } from './logic'
import { PARTIAL, REVIEW, SCDRAFT } from './topicCopy'

export const SC_GEN_DOM_ID = 'tp-sc-gen'
export const PARTIAL_DOM_ID = 'tp-partial'
const PARTIAL_BLOCK_DOM_ID = 'tp-partial-block'
const MORE_BUSY_DOM_ID = 'tp-sc-more-busy'
export const scEditDomId = (key: ScenarioSlotKey): string => `tp-sc-edit-${key}`

export default function ScenarioDraftCards({
  slots,
  pick,
  flight,
  failure,
  problems,
  disabled,
  allowMore,
  onToggle,
  onEdit,
  onCancel,
  onRetry,
  onMore,
}: {
  /** 아직 저장하지 않은 카드만(부분 저장 뒤 저장된 카드는 빠진다). */
  slots: ScenarioSlot[]
  pick: { k: number; n: number }
  flight: TopicDraftFlightState
  failure: Failure | null
  problems: Map<ScenarioSlotKey, DraftProblem[]>
  disabled: boolean
  /** [하나 더]를 보일지(주제를 저장한 뒤 `partial` 에서는 숨긴다). */
  allowMore: boolean
  onToggle: (key: ScenarioSlotKey, keep: boolean) => void
  onEdit: (key: ScenarioSlotKey) => void
  onCancel: () => void
  onRetry: () => void
  onMore: (desc: string) => string | null
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [moreText, setMoreText] = useState('')
  const [moreError, setMoreError] = useState<string | null>(null)
  const busy = flight.busy
  const showMore = allowMore && slots.length < SCENARIO_DRAFTS_MAX
  // 「이 주제로는 만들기 어려워요」면 아래 입력을 펼쳐 둔다(§16-2 S4 7).
  const formOpen = moreOpen || failure?.kind === 'unfit'
  const moreLen = cpLength(oneLine(moreText))
  const submit = () => {
    if (busy || disabled) return
    const p = onMore(moreText)
    setMoreError(p)
    if (!p) setMoreOpen(false)
  }

  return (
    <section aria-labelledby="tp-sc-h" className="flex min-w-0 flex-col gap-2.5">
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <h2 id="tp-sc-h" className="text-[15px] font-semibold">
          {SCDRAFT.head}
        </h2>
        {pick.n ? <span className="shrink-0 text-[13px] text-ink2 tabular-nums">{SCDRAFT.pick(pick.k, pick.n)}</span> : null}
      </div>
      <p className="text-[13px] text-ink2 break-keep">{SCDRAFT.intro}</p>

      {slots.map((s) => (
        <ScenarioCard key={s.key} slot={s} problemCount={problems.get(s.key)?.length ?? 0} disabled={disabled} onToggle={onToggle} onEdit={onEdit} />
      ))}

      {busy ? (
        <div id={SC_GEN_DOM_ID} tabIndex={-1} role="status" className="min-h-[132px] rounded-[14px] border border-dashed border-line bg-surface p-3.5 outline-none">
          <p className="flex items-center gap-2 text-[14px] font-semibold break-keep">
            <Spinner />
            {SCDRAFT.gen}
          </p>
          <p className="mt-1 text-[13px] text-ink2 break-keep">{SCDRAFT.genSub}</p>
          <Btn size="sm" variant="ghost" className="mt-2 min-h-11" aria-disabled={!flight.cancelable || undefined} onClick={onCancel}>
            {SCDRAFT.cancel}
          </Btn>
        </div>
      ) : null}

      {failure && !busy ? (
        failure.retry && !failure.block ? (
          <ErrorBox title={failure.text} onRetry={onRetry} retryLabel={SCDRAFT.retry} />
        ) : (
          <p role="alert" className="rounded-xl bg-surface2 px-3.5 py-3 text-[13px] text-ink break-keep">
            {failure.text}
          </p>
        )
      ) : null}

      {showMore ? (
        formOpen ? (
          <div className="rounded-[14px] border border-line bg-surface p-3.5">
            <Field label={SCDRAFT.moreLabel} htmlFor="tp-sc-more">
              <textarea
                id="tp-sc-more"
                rows={2}
                value={moreText}
                placeholder={SCDRAFT.morePlaceholder}
                disabled={disabled}
                aria-invalid={moreError ? true : undefined}
                aria-describedby={moreError ? 'tp-sc-more-err' : 'tp-sc-more-count'}
                onChange={(e) => {
                  setMoreText(e.target.value)
                  setMoreError(null)
                }}
                className={`w-full min-w-0 resize-none rounded-xl border bg-surface px-3 py-2.5 text-[16px] leading-snug text-ink ${moreError ? 'border-bad' : 'border-line'}`}
              />
              <p id="tp-sc-more-count" className={`text-right text-[12px] tabular-nums ${moreLen > SCENARIO_LIMITS.descriptionMax ? 'text-bad' : 'text-ink2'}`}>
                {moreLen}/{SCENARIO_LIMITS.descriptionMax}
              </p>
              {moreError ? (
                <p id="tp-sc-more-err" className="text-[12px] text-bad break-keep">
                  {moreError}
                </p>
              ) : null}
            </Field>
            <Btn
              className={`mt-2 w-full ${busy ? 'opacity-40' : ''}`}
              aria-disabled={busy || disabled || undefined}
              aria-describedby={busy ? MORE_BUSY_DOM_ID : undefined}
              onClick={submit}
            >
              {SCDRAFT.moreSubmit}
            </Btn>
          </div>
        ) : (
          <Btn
            variant="ghost"
            className={`w-full ${busy ? 'opacity-40' : ''}`}
            aria-expanded={false}
            aria-disabled={busy || disabled || undefined}
            aria-describedby={busy ? MORE_BUSY_DOM_ID : undefined}
            onClick={() => !busy && !disabled && setMoreOpen(true)}
          >
            {SCDRAFT.more}
          </Btn>
        )
      ) : null}
      {showMore && busy ? (
        <p id={MORE_BUSY_DOM_ID} className="text-[12px] text-ink2 break-keep">
          {SCDRAFT.moreBusy}
        </p>
      ) : null}
    </section>
  )
}

function ScenarioCard({
  slot,
  problemCount,
  disabled,
  onToggle,
  onEdit,
}: {
  slot: ScenarioSlot
  problemCount: number
  disabled: boolean
  onToggle: (key: ScenarioSlotKey, keep: boolean) => void
  onEdit: (key: ScenarioSlotKey) => void
}) {
  const d = slot.draft
  const title = oneLine(d.title)
  const titleJa = oneLine(d.titleJa)
  const opening = oneLine(d.opening?.ko ?? '')
  const ck = `tp-sc-ck-${slot.key}`
  return (
    <div className="min-h-[132px] min-w-0 rounded-[14px] border border-line bg-surface p-3.5">
      <div className={slot.keep ? '' : 'opacity-50'}>
        <p className="text-[15px] font-semibold break-keep [overflow-wrap:anywhere]">{title}</p>
        {titleJa ? (
          <p lang="ja" className="text-[13px] text-ink2 [overflow-wrap:anywhere]">
            {titleJa}
          </p>
        ) : null}
        <p className="mt-1 text-[13px] text-ink2 break-keep [overflow-wrap:anywhere]">{`${DRAFT.fLearner} ${oneLine(d.learner)} · ${DRAFT.fTutor} ${oneLine(d.tutor)}`}</p>
        <p className="text-[13px] text-ink2 break-keep [overflow-wrap:anywhere]">{opening ? SCDRAFT.opening(opening) : SCDRAFT.noOpening}</p>
      </div>
      {problemCount ? (
        <button
          id={topicProblemDomId(`sc:${slot.key}`)}
          type="button"
          onClick={() => onEdit(slot.key)}
          className="mt-1 inline-flex min-h-11 items-center text-[13px] font-semibold text-bad underline underline-offset-[3px]"
        >
          {SCDRAFT.problems(problemCount)}
        </button>
      ) : null}
      <div className="mt-1 flex min-w-0 items-center justify-between gap-2">
        <label htmlFor={ck} className="flex min-h-11 min-w-0 items-center gap-2 text-[14px]">
          <input id={ck} type="checkbox" className="h-5 w-5 shrink-0" checked={slot.keep} disabled={disabled} onChange={(e) => onToggle(slot.key, e.target.checked)} />
          <span className="break-keep">{SCDRAFT.keep}</span>
        </label>
        <Btn
          id={scEditDomId(slot.key)}
          size="sm"
          variant="ghost"
          className="min-h-11 shrink-0"
          aria-label={`${title} ${SCDRAFT.edit}`}
          aria-disabled={disabled || undefined}
          onClick={() => !disabled && onEdit(slot.key)}
        >
          {SCDRAFT.edit}
        </Btn>
      </div>
    </div>
  )
}

/** `partial` 맨 위 상태 상자 — 도착 시 초점(`role=alert`). 남은 상황 제목과 이유 한 줄씩. */
export function PartialTop({ view }: { view: PartialView }) {
  return (
    <div id={PARTIAL_DOM_ID} tabIndex={-1} role="alert" className="rounded-[14px] bg-bad-soft p-3.5 text-bad outline-none">
      <p className="text-[14px] font-bold break-keep">{PARTIAL.title}</p>
      {view.m ? <p className="mt-1 text-[13px] break-keep">{PARTIAL.body(view.m)}</p> : null}
      {view.lines.length ? (
        <ul className="mt-1.5 flex flex-col gap-1 text-[13px]">
          {view.lines.map((l) => (
            <li key={l.key} className="break-keep [overflow-wrap:anywhere]">
              <b className="font-semibold">{l.title}</b>
              {l.text ? ` · ${l.text}` : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** `partial` 행동 줄 — [상황 다시 저장](내 상황 50·하루 30 이면 막고 이유를 잇는다) · [주제 보기로]. */
export function PartialActions({ view, saving, savingText, onRetry, onLater }: { view: PartialView; saving: boolean; savingText: string; onRetry: () => void; onLater: () => void }) {
  const blocked = saving || !!view.block
  return (
    <>
      {view.block ? (
        <p id={PARTIAL_BLOCK_DOM_ID} className="rounded-xl bg-bad-soft px-3 py-2 text-[13px] text-bad break-keep">
          {view.block}
        </p>
      ) : null}
      {view.m ? (
        <Btn
          className={`w-full ${view.block ? 'opacity-40' : ''}`}
          aria-busy={saving || undefined}
          aria-disabled={blocked || undefined}
          aria-describedby={view.block ? PARTIAL_BLOCK_DOM_ID : undefined}
          onClick={() => !blocked && onRetry()}
        >
          {saving ? savingText : PARTIAL.retry}
        </Btn>
      ) : null}
      <Btn variant={view.m ? 'ghost' : 'primary'} className="w-full" aria-disabled={saving || undefined} onClick={() => !saving && onLater()}>
        {PARTIAL.later}
      </Btn>
    </>
  )
}

/** S5 — 공유 편집기 그대로(장소 칸만 정적 글). [완료]는 S4 카드 값만 바꾸고(서버 0) [취소]는 들어오기 전 값으로 되돌린다. */
export function ScenarioSlotEditor({
  draft,
  topicTitle,
  errors,
  headRef,
  onChange,
  onDone,
  onCancel,
}: {
  draft: EditableDraft
  topicTitle: string
  errors: Record<string, string>
  headRef: React.RefObject<HTMLHeadingElement | null>
  onChange: (fn: (d: EditableDraft) => EditableDraft) => void
  onDone: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex min-w-0 flex-col gap-[18px]">
      <h2 ref={headRef} tabIndex={-1} className="text-[15px] font-semibold outline-none">
        {SCDRAFT.head}
      </h2>
      <DraftEditor draft={draft} setDraft={onChange} errors={errors} places={[]} placesFailed={false} placesFixed={{ title: topicTitle, label: SCDRAFT.placeFixed(topicTitle) }} />
      <div className="flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
        <Btn onClick={onDone}>{SCDRAFT.done}</Btn>
        <Btn variant="ghost" onClick={onCancel}>
          {REVIEW.cancel}
        </Btn>
      </div>
    </div>
  )
}
