'use client'

/**
 * 평가 경로 `/study/today/eval/[evaluationId]` 루트 — #66 을 읽고 `evalView(status)` 로 가른다(레슨 경로와 같은 방식 — 새로고침·재방문·오늘 홈 카드가 한 주소로 끝난다):
 * 만드는 중·실패(데모 `#gen-*`) / 준비됨(`#ready` — 결정 d=B: [시작하기] = #67b, 이때 10분 시작) / 풀기 / 채점 중·실패(`#grading*`) / 결과 / 없음(`#e-404`).
 * 타인·없는 평가는 같은 "찾을 수 없어요". 잡(#55)은 화면이 보이는 동안만 확인한다.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiPost } from '@/components/common/api'
import { detailString, toErr } from '@/components/common/errors'
import { readStore, writeStore } from '@/components/common/storage'
import Toast, { useToast } from '@/components/common/Toast'
import { useNow } from '@/components/common/useNow'
import { Btn, ErrorBlock } from '@/components/common/ui'
import { useJobWatch } from '@/components/lesson/useJobWatch'
import BackBar from '@/components/shell/BackBar'
import type { CreateEvaluationResult, EvaluationDetail, SubmitResult } from '@/types/evaluation'
import { COMMON, GEN, GRADING, ITEM_KIND, KIND_NAME, READY, RUN, START, SUBMIT } from './evalCopy'
import EvalResult from './EvalResult'
import EvalRunner from './EvalRunner'
import { clockText, countByKind, elapsedSince, evalView, missingIndexes, spanSec, type EvalView } from './logic'
import { EvalSummary, Hero, SumGrid } from './parts'
import { evalPath, genAtKey } from './paths'
import { useEvaluation } from './useEvaluation'

const sub = (d: EvaluationDetail) => `${KIND_NAME[d.kind]} · ${d.level}`

function Frame({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-ground">
      <BackBar backHref="/study/today" backLabel={GEN.today} title={title} subtitle={subtitle} />
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto overscroll-contain px-4 pb-8 pt-3.5">{children}</div>
    </div>
  )
}

function GenScreen({ d, onSettled, onToast }: { d: EvaluationDetail; onSettled: () => void; onToast: (m: string) => void }) {
  const router = useRouter()
  const failed = d.status === 'FAILED'
  const { offline } = useJobWatch(failed ? null : d.jobId, { delays: [2000, 3000, 5000], onSettled })
  const [since] = useState(() => {
    const v = Number(readStore('session', genAtKey(d.id)))
    return Number.isFinite(v) && v > 0 ? v : Date.now()
  })
  const now = useNow(!failed)
  const t = now ? Math.max(0, Math.floor((now - since) / 1000)) : 0
  const [busy, setBusy] = useState(false)

  const retry = async () => {
    if (busy) return
    setBusy(true)
    try {
      const r = await apiPost<CreateEvaluationResult>('/api/v1/evaluations', { kind: d.kind, level: d.level, topicId: d.topic?.id ?? null })
      writeStore('session', genAtKey(r.evaluationId), String(Date.now()))
      if (r.evaluationId === d.id) onSettled()
      else router.replace(evalPath(r.evaluationId))
    } catch (e) {
      const err = toErr(e)
      const id = detailString(err, 'evaluationId')
      if (err.status === 409 && id) return router.replace(evalPath(id))
      onToast(err.status === 400 && detailString(err, 'reason') === 'NOT_ENOUGH_WORDS' ? START.fewWhy(Number(err.details.need) || 6) : START.failed)
    } finally {
      setBusy(false)
    }
  }

  if (failed) {
    return (
      <Frame title={GEN.title} subtitle={sub(d)}>
        <Hero tone="bad" title={GEN.failTitle}>
          <p className="text-[14px] break-keep">{GEN.failBody}</p>
        </Hero>
        <div>
          <Btn className="w-full aria-busy:opacity-70" aria-busy={busy || undefined} onClick={() => void retry()}>
            {busy ? START.making : GEN.retry}
          </Btn>
          <Link href="/study/today" className="mt-2 flex h-12 w-full items-center justify-center rounded-xl border border-line bg-surface text-[15px] font-semibold">
            {GEN.today}
          </Link>
        </div>
      </Frame>
    )
  }
  return (
    <Frame title={GEN.title} subtitle={sub(d)}>
      <Hero tone="spin" title={GEN.hero}>
        <p role="status" aria-live="polite" className="text-[14px] break-keep">
          {GEN.phase(t)}
        </p>
        <p className="text-[12px] tabular-nums text-ink2">{GEN.elapsed(clockText(t))}</p>
      </Hero>
      {offline ? <p className="rounded-xl bg-surface2 px-3.5 py-3 text-[13px] break-keep">{GEN.offline}</p> : null}
      <section className="rounded-[14px] bg-surface2 p-3.5">
        <h3 className="text-[15px] font-semibold">{GEN.summary}</h3>
        <EvalSummary kind={d.kind} level={d.level} topic={d.topic?.title ?? null} itemCount={d.kind === 'WORDS' ? 10 : 6} />
      </section>
      <p className="text-[12px] text-ink2 break-keep">{GEN.leave}</p>
      <Link href="/study/today" className="flex h-12 w-full items-center justify-center rounded-xl border border-line bg-surface text-[15px] font-semibold">
        {GEN.backToday}
      </Link>
    </Frame>
  )
}

function ReadyScreen({ d, onStarted, onConflict, onToast }: { d: EvaluationDetail; onStarted: (next: EvaluationDetail) => void; onConflict: () => void; onToast: (m: string) => void }) {
  const [busy, setBusy] = useState(false)
  const start = async () => {
    if (busy) return
    setBusy(true)
    try {
      const next = await apiPost<EvaluationDetail>(`/api/v1/evaluations/${encodeURIComponent(d.id)}/start`)
      onStarted(next)
    } catch (e) {
      setBusy(false)
      if (toErr(e).status === 409) return onConflict()
      onToast(READY.startFail)
    }
  }
  return (
    <Frame title={READY.title} subtitle={sub(d)}>
      <Hero tone="good" title={READY.hero}>
        <p className="text-[14px] break-keep">{READY.body}</p>
      </Hero>
      <section className="rounded-[14px] bg-surface2 p-3.5">
        <EvalSummary kind={d.kind} level={d.level} topic={d.topic?.title ?? null} itemCount={d.itemCount} />
      </section>
      <section className="rounded-[14px] border border-line bg-surface p-3.5">
        <h3 className="text-[15px] font-semibold">{READY.plan}</h3>
        <ul className="mt-2 flex flex-col gap-2.5">
          {countByKind(d.items).map((r, k) => (
            <li key={r.kind} className="grid grid-cols-[26px_minmax(0,1fr)] items-start gap-2.5">
              <span aria-hidden="true" className="grid h-[26px] w-[26px] place-items-center rounded-full bg-surface2 text-[12.5px] font-bold text-ink2">
                {k + 1}
              </span>
              <p className="min-w-0 text-[14px]">
                <b className="font-semibold">{ITEM_KIND[r.kind]}</b> · {READY.planRow(r.n)}
              </p>
            </li>
          ))}
        </ul>
      </section>
      <p className="rounded-xl bg-surface2 px-3.5 py-3 text-[13px] break-keep">{READY.note}</p>
      <div>
        <Btn className="w-full aria-busy:opacity-70" aria-busy={busy || undefined} onClick={() => void start()}>
          {busy ? READY.starting : READY.start}
        </Btn>
        <Link href="/study/today" className="mt-1 flex min-h-11 w-full items-center justify-center text-[13px] font-semibold underline underline-offset-[3px]">
          {READY.later}
        </Link>
      </div>
    </Frame>
  )
}

function GradingScreen({ d, failed, onSettled, onToast }: { d: EvaluationDetail; failed: boolean; onSettled: () => void; onToast: (m: string) => void }) {
  const words = d.kind === 'WORDS'
  const { offline } = useJobWatch(failed ? null : d.jobId, { delays: words ? [1500, 2000, 3000] : [3000, 4000, 5000], onSettled })
  const now = useNow(!failed)
  const t = elapsedSince(d.submittedAt, now)
  const [busy, setBusy] = useState(false)
  const missing = missingIndexes(d.items).length
  const used = spanSec(d.startedAt, d.submittedAt)
  const overSec = used !== null && used > d.timeLimitSec ? used - d.timeLimitSec : null

  const regrade = async () => {
    if (busy) return
    setBusy(true)
    try {
      await apiPost<SubmitResult>(`/api/v1/evaluations/${encodeURIComponent(d.id)}/submit`)
      onSettled()
    } catch (e) {
      if (toErr(e).status === 409) onSettled()
      else onToast(GRADING.retryFail)
    } finally {
      setBusy(false)
    }
  }

  if (failed) {
    return (
      <Frame title={GRADING.title} subtitle={sub(d)}>
        <Hero tone="bad" title={GRADING.failTitle}>
          <p className="text-[14px] break-keep">{GRADING.failBody}</p>
        </Hero>
        <div>
          <Btn className="w-full aria-busy:opacity-70" aria-busy={busy || undefined} onClick={() => void regrade()}>
            {busy ? SUBMIT.going : GRADING.retry}
          </Btn>
          <Link href="/study/today" className="mt-2 flex h-12 w-full items-center justify-center rounded-xl border border-line bg-surface text-[15px] font-semibold">
            {GRADING.later}
          </Link>
          <p className="mt-2 text-center text-[12px] text-ink2 break-keep">{GRADING.once}</p>
        </div>
      </Frame>
    )
  }
  return (
    <Frame title={GRADING.title} subtitle={sub(d)}>
      <Hero tone="spin" title={GRADING.hero}>
        <p role="status" aria-live="polite" className="text-[14px] break-keep">
          {GRADING.phase(t, words)}
        </p>
        <p className="text-[12px] tabular-nums text-ink2">{GRADING.elapsed(clockText(t), words)}</p>
      </Hero>
      {offline ? <p className="rounded-xl bg-surface2 px-3.5 py-3 text-[13px] break-keep">{GEN.offline}</p> : null}
      <section className="rounded-[14px] bg-surface2 p-3.5">
        <h3 className="mb-2 text-[15px] font-semibold">{GRADING.submitted}</h3>
        <SumGrid
          cells={[
            { value: String(d.items.length - missing), label: SUBMIT.answered },
            { value: String(missing), label: SUBMIT.missing },
            overSec !== null ? { value: clockText(-overSec), label: SUBMIT.over } : { value: clockText(used ?? 0), label: SUBMIT.used },
          ]}
        />
      </section>
      <p className="text-[12px] text-ink2 break-keep">{GRADING.leave}</p>
      <Link href="/study/today" className="flex h-12 w-full items-center justify-center rounded-xl border border-line bg-surface text-[15px] font-semibold">
        {GRADING.backToday}
      </Link>
    </Frame>
  )
}

export default function EvalScreen({ evaluationId, teacherName }: { evaluationId: string; teacherName: string }) {
  const ev = useEvaluation(evaluationId)
  const toast = useToast()
  const { show } = toast
  const prevView = useRef<EvalView | null>(null)
  const d = ev.data
  const view = d ? evalView(d) : null

  useEffect(() => {
    const p = prevView.current
    prevView.current = view
    if (!p || p === view) return
    if (p === 'gen' && (view === 'ready' || view === 'run')) queueMicrotask(() => show(GEN.readyToast))
    if ((p === 'grading' || p === 'gradefail') && view === 'result') queueMicrotask(() => show(GRADING.doneToast))
    if (p === 'ready' && view === 'run') queueMicrotask(() => show(READY.startedToast))
  }, [view, show])

  const reload = useCallback(() => {
    ev.reload().catch(() => show(COMMON.network))
  }, [ev, show])

  if (ev.load === 'notFound') {
    return (
      <div className="flex h-full min-h-0 flex-col bg-ground">
        <BackBar backHref="/study/today" backLabel={COMMON.today} title={READY.title} />
        <div className="flex flex-1 flex-col items-center gap-2 px-4 pt-16 text-center">
          <p className="text-[15px] font-semibold">{COMMON.notFound}</p>
          <p className="text-[13px] text-ink2 break-keep">{COMMON.notFoundBody}</p>
          <Link href="/study/today" className="mt-3 inline-flex h-12 items-center justify-center rounded-xl bg-accent px-6 text-[15px] font-semibold text-on-accent">
            {COMMON.today}
          </Link>
        </div>
      </div>
    )
  }
  if (!d || !view) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-ground">
        <BackBar backHref="/study/today" backLabel={COMMON.today} title={READY.title} />
        <div className="flex flex-col gap-2 px-4 pt-3.5">
          {ev.load === 'error' ? (
            <ErrorBlock message={RUN.loadError} onRetry={reload} />
          ) : (
            <>
              <p role="status" className="sr-only">
                {RUN.loading}
              </p>
              {[0, 1, 2].map((i) => (
                <span key={i} aria-hidden="true" className="block h-[86px] rounded-[14px] bg-surface2" />
              ))}
            </>
          )}
        </div>
      </div>
    )
  }

  let screen: React.ReactNode
  let toastBottom = 24
  switch (view) {
    case 'gen':
    case 'genfail':
      screen = <GenScreen key={`${d.id}-${d.jobId ?? 'x'}`} d={d} onSettled={reload} onToast={show} />
      break
    case 'ready':
      screen = <ReadyScreen d={d} onStarted={(next) => ev.set(next)} onConflict={reload} onToast={show} />
      break
    case 'run':
      screen = <EvalRunner key={d.id} detail={d} onSubmitted={reload} onConflict={reload} />
      toastBottom = 84
      break
    case 'grading':
    case 'gradefail':
      screen = <GradingScreen key={`${d.id}-${d.jobId ?? 'x'}`} d={d} failed={view === 'gradefail'} onSettled={reload} onToast={show} />
      break
    default:
      screen = <EvalResult detail={d} teacherName={teacherName} />
  }
  return (
    <>
      {screen}
      <Toast message={toast.message} bottomPx={toastBottom} />
    </>
  )
}
