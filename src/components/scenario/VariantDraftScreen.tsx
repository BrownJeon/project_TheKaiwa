'use client'

/**
 * 변형 상황 만들기 `/study/ai/scenario/[id]/variant[?from=manage]`(task-045 변형 A, screens.md §16-2 A).
 * BackBar 52 + 본문 한 곳만 스크롤. 원본 요약 → 무엇을 바꿀지(4축 + 직접 적기) → [변형 초안 만들기] → 검토(공유 편집기 + 「바뀜」) → [새 상황으로 저장].
 * 만들기 버튼은 만드는 동안 같은 자리의 [그만두기]가 된다(초점이 누른 버튼에 남음 — R6, 만드는 중 표시는 그 버튼 아래). 초안이 오면 검토 안내 제목으로 초점(R5 — 의도된 이동).
 * 초안이 있으면 ← 는 버리기 확인을 먼저 연다(안드로이드 뒤로는 막지 않는다 — §16-0 #7). 오류 문구는 `failure.ts` 고정 문구.
 */
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import Sheet from '@/components/common/Sheet'
import { Btn, Field } from '@/components/common/ui'
import { cpLength } from '@/components/common/format'
import { ErrorBox, InfoBox, Skeleton } from '@/components/challenge/parts'
import { Spinner } from '@/components/plan/parts'
import BackBar from '@/components/shell/BackBar'
import { SCENARIO_VARIANT_NOTE_MAX } from '@/types/scenarioVariant'
import DraftEditor from './DraftEditor'
import { oneLine, problemDomId, problemMap } from './logic'
import { DRAFT, VARIANT, type DraftFrom } from './scenarioCopy'
import { useVariantDraft, type VariantScreenModel } from './useVariantDraft'
import { variantReviewBody } from './variantLogic'
import VariantAxes from './VariantAxes'

export default function VariantDraftScreen({ id, from = null }: { id: string; from?: DraftFrom }) {
  const m = useVariantDraft({ id, from })
  const [leaveOpen, setLeaveOpen] = useState(false)
  return (
    <div className="flex h-full min-h-0 flex-col bg-ground">
      <BackBar backHref={m.gone ? m.back.listHref : m.back.href} backLabel={m.back.label} title={VARIANT.title} onBack={m.result && !m.saving ? () => setLeaveOpen(true) : undefined} />
      {/* `relative`: 축 칩의 숨은 라디오·표현 줄의 `sr-only`(absolute)가 앱 셸 `main` 기준으로 잡혀 `main` 이 따로 스크롤되지 않게 한다(ScenarioDraftScreen `Scroll` 과 같은 이유). */}
      <div className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-3.5">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <Body m={m} onDiscard={() => setLeaveOpen(true)} />
        </div>
      </div>
      <Sheet open={leaveOpen} title={DRAFT.discardTitle} onClose={() => setLeaveOpen(false)}>
        <p className="text-[14px] break-keep">{DRAFT.discardBody}</p>
        <div className="mt-3 flex gap-2 pb-2 [&>*]:min-w-0 [&>*]:flex-1">
          <Btn variant="danger" className="border-bad" onClick={m.discard}>
            {DRAFT.discardConfirm}
          </Btn>
          <Btn variant="ghost" onClick={() => setLeaveOpen(false)}>
            {DRAFT.discardKeep}
          </Btn>
        </div>
      </Sheet>
    </div>
  )
}

function Body({ m, onDiscard }: { m: VariantScreenModel; onDiscard: () => void }) {
  if (m.gone)
    return (
      <div role="alert" className="rounded-[14px] border border-line bg-surface p-4">
        <p className="text-[15px] font-semibold break-keep">{VARIANT.baseGone}</p>
        <Link href={m.back.listHref} className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-xl border border-line bg-surface text-[15px] font-semibold">
          {m.back.label}
        </Link>
      </div>
    )
  if (m.load.status === 'loading') return <Skeleton heights={[72, 120, 120, 52]} label={DRAFT.loadingSr} />
  if (m.load.status === 'error' || !m.base) return <ErrorBox title={DRAFT.loadError} onRetry={m.load.reload} retryLabel={DRAFT.retry} />
  return m.result && m.draft ? <Review m={m} onDiscard={onDiscard} /> : <Pick m={m} />
}

/** 실패 상자 — 다시 시도할 수 있으면 [다시 만들기]. */
function FailBox({ m }: { m: VariantScreenModel }) {
  const f = m.failure
  if (!f) return null
  if (f.retry) return <ErrorBox title={f.text} onRetry={m.generate} retryLabel={VARIANT.regen} />
  return (
    <p role="alert" className={`rounded-xl px-3.5 py-3 text-[13px] break-keep ${f.kind === 'unfit' || f.kind === 'noChange' ? 'bg-bad-soft text-bad' : 'bg-surface2 text-ink'}`}>
      {f.text}
    </p>
  )
}

function GenStatus({ long }: { long: boolean }) {
  return (
    <div role="status" className="rounded-[14px] border border-line bg-surface p-4">
      <p className="flex items-center gap-2 text-[15px] font-semibold break-keep">
        <Spinner />
        {VARIANT.gen}
      </p>
      <p className="mt-1 text-[13px] text-ink2 break-keep">{VARIANT.genSub}</p>
      {long ? <p className="mt-1 text-[13px] text-ink2 break-keep">{VARIANT.genLong}</p> : null}
    </div>
  )
}

function Pick({ m }: { m: VariantScreenModel }) {
  const base = m.base!
  const gen = m.generating
  const n = cpLength(oneLine(m.note))
  const over = n > SCENARIO_VARIANT_NOTE_MAX
  const daily = m.failure?.block === true
  const blocked = !!m.block || daily
  const reason = m.block === 'noChange' ? VARIANT.noChange : m.block === 'noteLong' ? VARIANT.noteTooLong : null
  const aboveAxes = m.failure && (m.failure.kind === 'noChange' || m.failure.kind === 'unfit')
  return (
    <>
      <InfoBox>
        <p className="text-[12px] text-ink2">{VARIANT.baseHead}</p>
        <p className="text-[15px] font-semibold [overflow-wrap:anywhere]">{base.title}</p>
        {base.titleJa ? (
          <p lang="ja" className="text-[13px] text-ink2 [overflow-wrap:anywhere]">
            {base.titleJa}
          </p>
        ) : null}
        <p className="mt-1 text-[12px] text-ink2 break-keep [overflow-wrap:anywhere]">{VARIANT.baseMeta(base.roles.learner, base.roles.tutor, base.level)}</p>
      </InfoBox>
      <section className="flex min-w-0 flex-col gap-4" aria-busy={gen || undefined}>
        <div>
          <h2 className="text-[16px] font-semibold">{VARIANT.ask}</h2>
          <p className="mt-1 text-[13px] text-ink2 break-keep">{VARIANT.askSub}</p>
        </div>
        {aboveAxes ? <FailBox m={m} /> : null}
        <VariantAxes axes={m.axes} baseLevel={base.level} onPick={m.pick} locked={gen} />
        <Field label={VARIANT.note} htmlFor="va-note">
          <textarea
            id="va-note"
            rows={2}
            value={m.note}
            readOnly={gen}
            placeholder={VARIANT.notePlaceholder}
            aria-invalid={over || m.noteError ? true : undefined}
            aria-describedby={m.noteError ? 'va-note-err va-note-count' : 'va-note-count'}
            onChange={(e) => m.setNote(e.target.value)}
            className={`w-full min-w-0 resize-none rounded-xl border bg-surface px-3 py-2.5 text-[16px] leading-snug text-ink placeholder:text-ink3 ${over || m.noteError ? 'border-bad' : 'border-line'}`}
          />
          <p id="va-note-count" className={`text-right text-[12px] tabular-nums ${over ? 'text-bad' : 'text-ink2'}`}>
            {VARIANT.noteCount(n)}
          </p>
          {m.noteError ? (
            <p id="va-note-err" className="text-[12px] text-bad break-keep">
              {m.noteError}
            </p>
          ) : null}
        </Field>
        <div className="flex min-w-0 flex-col gap-2">
          {!gen && !aboveAxes ? <FailBox m={m} /> : null}
          <Btn
            variant={gen ? 'ghost' : undefined}
            className={`w-full ${blocked && !gen ? 'opacity-40' : ''}`}
            aria-disabled={(gen ? !m.flight.cancelable : blocked) || undefined}
            aria-describedby={!gen && reason ? 'va-submit-why' : undefined}
            onClick={() => (gen ? m.cancel() : !blocked && m.generate())}
          >
            {gen ? VARIANT.cancel : VARIANT.submit}
          </Btn>
          {/* 만드는 중 표시는 누른 버튼 아래에 둔다 — 위에 끼면 [그만두기]가 표시 높이(88px)만큼 밀려 접힌 영역 밖으로 나간다(R1~R6: 높이 변화는 누른 줄 아래에만). */}
          {gen ? <GenStatus long={m.flight.long} /> : null}
          {!gen && reason ? (
            <p id="va-submit-why" className="text-center text-[12px] text-ink2 break-keep">
              {reason}
            </p>
          ) : null}
          <p className="text-center text-[12px] text-ink2 break-keep">{VARIANT.saveNote}</p>
        </div>
      </section>
    </>
  )
}

function Review({ m, onDiscard }: { m: VariantScreenModel; onDiscard: () => void }) {
  const errors = useMemo(() => problemMap(m.problems), [m.problems])
  const headRef = useRef<HTMLHeadingElement>(null)
  const [regenAsk, setRegenAsk] = useState(false)
  const gen = m.generating
  const busy = gen || m.saving
  const msg = m.saveMessage
  const saveBlocked = busy || (msg?.block ?? false)
  const openingOnly = m.problems.length > 0 && m.problems.every((p) => p.key === 'opening' || p.key === 'openingKo')

  // 검토 단계에 처음 들어올 때 한 번 — 다시 만들기로 초안이 바뀔 때는 초점을 옮기지 않는다(누른 버튼에 남음).
  useEffect(() => {
    headRef.current?.focus()
  }, [])

  const save = async () => {
    const probs = await m.save()
    if (probs && probs.length) requestAnimationFrame(() => document.getElementById(problemDomId(probs[0].key))?.focus())
  }
  const regen = () => {
    if (gen) return m.cancel()
    if (busy) return
    if (m.edited) setRegenAsk(true)
    else m.generate()
  }

  return (
    <>
      <div role="note" className="rounded-[14px] bg-accent-soft p-3.5">
        <h2 ref={headRef} tabIndex={-1} className="text-[14px] font-semibold outline-none">
          {VARIANT.reviewTitle}
        </h2>
        <p className="mt-1 text-[13px] text-ink break-keep">{m.base ? variantReviewBody(m.axes, m.base.level) : VARIANT.reviewBody}</p>
      </div>
      <DraftEditor draft={m.draft!} setDraft={m.setDraft} errors={errors} places={m.places} placesFailed={m.placesFailed} disabled={busy} changed={m.result!.changed} />
      <div className="flex min-w-0 flex-col gap-2">
        {m.problems.length ? (
          <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-[13px] font-semibold text-bad">
            {DRAFT.invalidSummary(m.problems.length, openingOnly)}
          </p>
        ) : null}
        {msg ? (
          <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-[13px] text-bad break-keep">
            {msg.text}
          </p>
        ) : null}
        <p className="text-[12px] text-ink2 break-keep">{VARIANT.saveNote}</p>
        <Btn className={`w-full ${saveBlocked && !m.saving ? 'opacity-40' : ''}`} aria-busy={m.saving || undefined} aria-disabled={saveBlocked || undefined} onClick={() => !saveBlocked && void save()}>
          {m.saving ? DRAFT.saving : VARIANT.save}
        </Btn>
        {gen ? <GenStatus long={m.flight.long} /> : null}
        {!gen ? <FailBox m={m} /> : null}
        <Btn variant="ghost" className="w-full" aria-disabled={(gen ? !m.flight.cancelable : m.saving) || undefined} onClick={regen}>
          {gen ? VARIANT.cancel : VARIANT.regen}
        </Btn>
        {regenAsk ? (
          <div className="rounded-xl bg-surface2 p-3">
            <p className="text-[13px] break-keep">{DRAFT.regenConfirm}</p>
            <div className="mt-2 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
              <Btn
                onClick={() => {
                  setRegenAsk(false)
                  m.generate()
                }}
              >
                {DRAFT.regenConfirmBtn}
              </Btn>
              <Btn variant="ghost" onClick={() => setRegenAsk(false)}>
                {DRAFT.cancel}
              </Btn>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          aria-disabled={busy || undefined}
          onClick={() => !busy && onDiscard()}
          className="mx-auto inline-flex min-h-11 items-center px-2 text-[14px] font-semibold text-bad underline underline-offset-[3px]"
        >
          {DRAFT.discard}
        </button>
      </div>
    </>
  )
}
