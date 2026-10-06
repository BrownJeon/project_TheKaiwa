'use client'

/**
 * AI 초안 만들기 `/study/ai/scenario/new` · 고치기 `/study/ai/scenario/[id]/edit`(가이드 §3-H, D-6).
 * BackBar 52 + 본문 한 곳만 스크롤, 맨 끝 버튼 줄은 제자리(키보드 규칙 D2 A). 이 탭 sessionStorage 의 초안은 하이드레이션 뒤에만 읽는다
 * (서버 HTML 과 어긋나지 않게 — 그 전에는 머리만 그린다). 저장 성공은 훅이 시나리오 탭 시트(`?sc=&saved=1`)로 `replace`.
 * 저장 전에는 서버에 행이 없다는 것을 화면 문구로 말한다(제안→채택).
 */
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Segmented from '@/components/common/Segmented'
import Sheet from '@/components/common/Sheet'
import { Btn, Field } from '@/components/common/ui'
import { cpLength } from '@/components/common/format'
import { ErrorBox, Skeleton } from '@/components/challenge/parts'
import { Spinner } from '@/components/plan/parts'
import BackBar from '@/components/shell/BackBar'
import { SCENARIO_LIMITS as L } from '@/types/scenario'
import DraftEditor, { levelOptions } from './DraftEditor'
import { DRAFT_LEVELS, oneLine, problemDomId, problemMap, type DraftLevel } from './logic'
import PlaceChips from './PlaceChips'
import { DRAFT, SCENARIO_HOME_HREF } from './scenarioCopy'
import { useScenarioDraft, type DraftScreenModel } from './useScenarioDraft'

const noopSubscribe = () => () => {}

export default function ScenarioDraftScreen({ mode, id = null, defaultLevel }: { mode: 'new' | 'edit'; id?: string | null; defaultLevel: DraftLevel }) {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)
  return (
    <div className="flex h-full min-h-0 flex-col bg-ground">
      <BackBar backHref={SCENARIO_HOME_HREF} backLabel={DRAFT.back} title={mode === 'edit' ? DRAFT.titleEdit : DRAFT.titleNew} />
      {hydrated ? <Body mode={mode} id={id} defaultLevel={defaultLevel} /> : <div className="min-h-0 flex-1" />}
    </div>
  )
}

function focusProblem(key: string) {
  const el = document.getElementById(problemDomId(key))
  if (!el) return
  el.scrollIntoView({ block: 'center' })
  el.focus({ preventScroll: true })
}

function Body({ mode, id, defaultLevel }: { mode: 'new' | 'edit'; id: string | null; defaultLevel: DraftLevel }) {
  const m = useScenarioDraft({ mode, id, defaultLevel })
  const errors = useMemo(() => problemMap(m.problems), [m.problems])
  const [regenAsk, setRegenAsk] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const noteRef = useRef<HTMLHeadingElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)
  const prevStage = useRef(m.stage)

  useEffect(() => {
    if (m.stage === 'edit' && prevStage.current === 'generating') noteRef.current?.focus()
    prevStage.current = m.stage
  }, [m.stage])
  useEffect(() => {
    if (m.genError?.kind === 'unfit') descRef.current?.focus()
  }, [m.genError])

  const places = useMemo(() => {
    const seen = new Set<string>()
    return [...m.originalTopics, ...m.topics.items.map((t) => ({ id: t.id, title: t.title }))].filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
  }, [m.originalTopics, m.topics.items])

  const save = async () => {
    const probs = await m.save()
    if (probs && probs.length) requestAnimationFrame(() => focusProblem(probs[0].key))
  }
  const regen = () => {
    if (m.edited) setRegenAsk(true)
    else m.generate()
  }

  if (mode === 'edit') {
    if (m.gone) return <Gone />
    if (m.load.status === 'loading' || (m.load.status === 'ready' && !m.draft))
      return (
        <Scroll>
          <Skeleton heights={[44, 44, 120, 160]} label={DRAFT.loadingSr} />
        </Scroll>
      )
    if (m.load.status === 'error' || !m.draft)
      return (
        <Scroll>
          <ErrorBox title={DRAFT.loadError} onRetry={m.load.reload} retryLabel={DRAFT.retry} />
        </Scroll>
      )
    return (
      <Scroll>
        <p className="text-[13px] text-ink2 break-keep">{DRAFT.editExistingNote}</p>
        <DraftEditor draft={m.draft} setDraft={m.setDraft} errors={errors} places={places} placesFailed={m.topics.status === 'error' && !places.length} disabled={m.stage === 'saving'} />
        <SaveArea m={m} onSave={save}>
          <Link href={SCENARIO_HOME_HREF} className="inline-flex min-h-11 items-center justify-center text-[14px] font-semibold text-ink2 underline underline-offset-[3px]">
            {DRAFT.leaveEdit}
          </Link>
        </SaveArea>
      </Scroll>
    )
  }

  const generating = m.stage === 'generating'
  const editing = !!m.draft && (m.stage === 'edit' || m.stage === 'saving')

  return (
    <>
      <Scroll>
        {m.restore ? (
          <div className="rounded-[14px] border border-line bg-surface p-3.5">
            <p className="text-[14px] font-semibold break-keep [overflow-wrap:anywhere]">{DRAFT.restoreTitle(oneLine(m.restore.draft?.title ?? ''))}</p>
            <div className="mt-3 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
              <Btn onClick={m.acceptRestore}>{DRAFT.restoreContinue}</Btn>
              <Btn variant="ghost" onClick={m.dropRestore}>
                {DRAFT.restoreNew}
              </Btn>
            </div>
          </div>
        ) : null}

        {generating ? (
          <div role="status" className="rounded-[14px] border border-line bg-surface p-4">
            <p className="flex items-center gap-2 text-[15px] font-semibold">
              <Spinner />
              {DRAFT.genTitle}
            </p>
            <p className="mt-1 text-[13px] text-ink2 break-keep">{DRAFT.genBody}</p>
            {m.long ? <p className="mt-1 text-[13px] text-ink2">{DRAFT.genLong}</p> : null}
            <Btn variant="ghost" className="mt-3 w-full" onClick={m.cancelGenerate}>
              {DRAFT.genCancel}
            </Btn>
          </div>
        ) : null}

        {m.genError ? <GenErrorBox m={m} /> : null}

        {editing && m.draft && !generating ? (
          <>
            <div role="note" className="rounded-[14px] bg-accent-soft p-3.5">
              <h2 ref={noteRef} tabIndex={-1} className="text-[14px] font-semibold outline-none">
                {DRAFT.editNoteTitle}
              </h2>
              <p className="mt-1 text-[13px] text-ink break-keep">{DRAFT.editNoteBody}</p>
            </div>
            <DraftEditor draft={m.draft} setDraft={m.setDraft} errors={errors} places={places} placesFailed={m.topics.status === 'error'} disabled={m.stage === 'saving'} />
            <SaveArea m={m} onSave={save}>
              <Btn variant="ghost" className="w-full" aria-disabled={m.stage === 'saving' || undefined} onClick={() => m.stage !== 'saving' && regen()}>
                {DRAFT.regen}
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
                aria-disabled={m.stage === 'saving' || undefined}
                onClick={() => m.stage !== 'saving' && setDiscardOpen(true)}
                className="mx-auto inline-flex min-h-11 items-center px-2 text-[14px] font-semibold text-bad underline underline-offset-[3px]"
              >
                {DRAFT.discard}
              </button>
            </SaveArea>
          </>
        ) : !generating ? (
          <AskForm m={m} descRef={descRef} />
        ) : (
          <AskForm m={m} descRef={descRef} locked />
        )}
      </Scroll>

      <Sheet open={discardOpen} title={DRAFT.discardTitle} onClose={() => setDiscardOpen(false)}>
        <p className="text-[14px] break-keep">{DRAFT.discardBody}</p>
        <div className="mt-3 flex gap-2 pb-2 [&>*]:min-w-0 [&>*]:flex-1">
          <Btn variant="danger" className="border-bad" onClick={m.discard}>
            {DRAFT.discardConfirm}
          </Btn>
          <Btn variant="ghost" onClick={() => setDiscardOpen(false)}>
            {DRAFT.discardKeep}
          </Btn>
        </div>
      </Sheet>
    </>
  )
}

function Scroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-3.5">
      <div className="flex min-w-0 flex-col gap-[18px]">{children}</div>
    </div>
  )
}

function Gone() {
  return (
    <Scroll>
      <div className="rounded-[14px] border border-line bg-surface p-4">
        <p className="text-[15px] font-semibold">{DRAFT.edit404}</p>
        <Link href={SCENARIO_HOME_HREF} className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-xl border border-line bg-surface text-[15px] font-semibold">
          {DRAFT.edit404Btn}
        </Link>
      </div>
    </Scroll>
  )
}

function GenErrorBox({ m }: { m: DraftScreenModel }) {
  const e = m.genError
  if (!e) return null
  if (e.kind === 'fail') return <ErrorBox title={DRAFT.genFail} onRetry={m.generate} retryLabel={DRAFT.retry} />
  if (e.kind === 'unfit')
    return (
      <p role="alert" className="rounded-xl bg-bad-soft px-3.5 py-3 text-[13px] text-bad break-keep">
        {DRAFT.gen422}
      </p>
    )
  if (e.kind === 'rate')
    return (
      <p role="alert" className="rounded-xl bg-surface2 px-3.5 py-3 text-[13px] text-ink break-keep">
        {DRAFT.gen429(e.sec)}
      </p>
    )
  return null
}

function SaveArea({ m, onSave, children }: { m: DraftScreenModel; onSave: () => void; children: React.ReactNode }) {
  const saving = m.stage === 'saving'
  const msg = m.saveMessage
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {m.problems.length ? (
        <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-[13px] font-semibold text-bad">
          {DRAFT.invalidSummary(m.problems.length)}
        </p>
      ) : null}
      {msg ? (
        <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-[13px] text-bad break-keep">
          {msg.kind === 'text' ? msg.text : msg.kind === 'rate' ? DRAFT.saveRate : DRAFT.saveFail}
        </p>
      ) : null}
      <Btn className="w-full" aria-busy={saving || undefined} aria-disabled={saving || undefined} onClick={() => !saving && onSave()}>
        {saving ? DRAFT.saving : DRAFT.save}
      </Btn>
      {children}
    </div>
  )
}

function AskForm({ m, descRef, locked = false }: { m: DraftScreenModel; descRef: React.RefObject<HTMLTextAreaElement | null>; locked?: boolean }) {
  const n = cpLength(oneLine(m.ask.desc))
  const short = n < DRAFT.descMin
  const over = n > L.descriptionMax
  const placeOpts = [{ value: '', label: DRAFT.placeNone }, ...m.topics.items.map((t) => ({ value: t.id, label: t.title }))]
  return (
    <section className="flex min-w-0 flex-col gap-[18px]" aria-busy={locked || undefined}>
      <div>
        <h2 className="text-[16px] font-semibold">{DRAFT.askTitle}</h2>
        <p className="mt-1 text-[13px] text-ink2 break-keep">{DRAFT.askBody}</p>
      </div>
      <Field label={DRAFT.descLabel} htmlFor="dr-description">
        <textarea
          id="dr-description"
          ref={descRef}
          rows={4}
          value={m.ask.desc}
          readOnly={locked}
          placeholder={DRAFT.descPlaceholder}
          aria-invalid={m.askError || over ? true : undefined}
          aria-describedby={m.askError ? 'dr-description-err dr-description-count' : 'dr-description-count'}
          onChange={(e) => m.setAsk({ desc: e.target.value })}
          className={`w-full min-w-0 resize-none rounded-xl border bg-surface px-3 py-2.5 text-[16px] leading-snug text-ink placeholder:text-ink3 ${m.askError || over ? 'border-bad' : 'border-line'}`}
        />
        <p id="dr-description-count" className={`text-right text-[12px] tabular-nums ${over ? 'text-bad' : 'text-ink2'}`}>
          {DRAFT.descCount(n)}
        </p>
        {m.askError ? (
          <p id="dr-description-err" className="text-[12px] text-bad break-keep">
            {m.askError}
          </p>
        ) : null}
      </Field>
      <div>
        <p className="text-[12px] text-ink2">{DRAFT.examplesLabel}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {DRAFT.examples.map((ex) => (
            <button
              key={ex}
              type="button"
              aria-disabled={locked || undefined}
              onClick={() => !locked && m.setAsk({ desc: ex })}
              className="relative h-9 rounded-full border border-line bg-surface px-3.5 text-[13.5px] text-ink before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-ink2">{DRAFT.placeLabelAsk}</span>
        {m.topics.status === 'error' ? (
          <p className="text-[12px] text-ink2 break-keep">{DRAFT.placesFail}</p>
        ) : m.topics.status === 'ready' ? (
          <PlaceChips<string> ariaLabel={DRAFT.placeLabelAsk} options={placeOpts} value={m.ask.topicId ?? ''} onChange={(v) => !locked && m.setAsk({ topicId: v || null })} />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-ink2">{DRAFT.levelLabel}</span>
        <Segmented<DraftLevel>
          ariaLabel={DRAFT.levelLabel}
          options={levelOptions(m.ask.level).filter((o): o is { value: DraftLevel; label: string } => (DRAFT_LEVELS as readonly string[]).includes(o.value))}
          value={m.ask.level}
          onChange={(v) => !locked && m.setAsk({ level: v })}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <Btn className={`w-full ${short || over ? 'opacity-40' : ''}`} aria-disabled={short || over || locked || undefined} onClick={() => !locked && m.generate()}>
          {DRAFT.generate}
        </Btn>
        <p className="text-[12px] text-ink2 break-keep">{DRAFT.askNote}</p>
      </div>
    </section>
  )
}
