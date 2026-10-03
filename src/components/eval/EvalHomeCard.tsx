'use client'

/**
 * 오늘 홈 "AI 평가" 카드(데모 v1 `#home-*` 13상태) — 오늘의 회화 카드 바로 아래. 상태는 `deriveEvalCard`(순수)가
 * #69 `limit=1`(가장 최근 평가, 진행 중 포함·출제 실패 제외) + 필요할 때만 #66 으로 정한다. 평가는 한 번에 하나라 진행 중이면 그 평가로만 간다.
 * 만드는 중·채점 중이면 화면이 보이는 동안 잡(#55)을 5초마다 확인하고 끝나면 다시 읽는다. 이 카드의 오류는 다른 카드와 따로 표시한다.
 * 자막만(선생님 목소리 불가)이면 [회화 평가]를 막는다(결정 b=B).
 */
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { formatMonthDay, todayKey } from '@/components/vocab/format'
import { kstDateKey } from '@/components/common/format'
import { useNow } from '@/components/common/useNow'
import { Badge, Btn, BtnRow, Card, ErrorBlock } from '@/components/common/ui'
import { useJobWatch } from '@/components/lesson/useJobWatch'
import { useTtsRuntimeStatus } from '@/components/speech/useTtsRuntimeStatus'
import type { EvalKind, EvaluationDetail, EvaluationList, EvaluationListItem, SubmitResult } from '@/types/evaluation'
import type { JlptLevel } from '@/types/lesson'
import { COMMON, GRADE_LABEL, HOME, KIND_NAME, KIND_SHORT } from './evalCopy'
import { cardNeedsDetail, clockText, deriveEvalCard } from './logic'
import { ClockIcon, GradeChip, IndetBar } from './parts'
import { evalPath, EVAL_HISTORY_PATH, startPath } from './paths'

interface CardData {
  state: 'loading' | 'error' | 'ready'
  latest: EvaluationListItem | null
  detail: EvaluationDetail | null
  today: string
}

function Head({ myLevel, badge }: { myLevel: JlptLevel; badge: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h2 id="eval-card-title" className="text-[15px] font-semibold">
        {HOME.title}
      </h2>
      {badge ? <Badge tone="neutral">{HOME.myLevel(myLevel)}</Badge> : null}
    </div>
  )
}

function KindTiles({ textOnly, onPick, onBlocked }: { textOnly: boolean; onPick: (k: EvalKind) => void; onBlocked: () => void }) {
  const tile = 'flex min-h-16 min-w-0 flex-col items-start gap-0.5 rounded-xl border border-line px-3 py-2.5 text-left'
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button type="button" onClick={() => onPick('WORDS')} className={`${tile} bg-surface`}>
        <b className="text-[15px] font-semibold">{KIND_NAME.WORDS}</b>
        <span className="text-[12px] text-ink2 break-keep">{HOME.wordsTile}</span>
      </button>
      <button type="button" aria-disabled={textOnly || undefined} onClick={() => (textOnly ? onBlocked() : onPick('TALK'))} className={`${tile} ${textOnly ? 'bg-surface2' : 'bg-surface'}`}>
        <b className={`text-[15px] font-semibold ${textOnly ? 'text-ink2' : ''}`}>{KIND_NAME.TALK}</b>
        <span className="text-[12px] text-ink2 break-keep">{textOnly ? HOME.talkBlocked : HOME.talkTile}</span>
      </button>
    </div>
  )
}

function Pill({ warn, children }: { warn?: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold tabular-nums ${warn ? 'bg-bad-soft text-bad' : 'bg-surface2'}`}>
      <ClockIcon />
      {children}
    </span>
  )
}

export default function EvalHomeCard({ myLevel, reloadKey, onToast }: { myLevel: JlptLevel; reloadKey: number; onToast: (m: string) => void }) {
  const router = useRouter()
  const tts = useTtsRuntimeStatus()
  const textOnly = tts.snapshot.state === 'TEXT_ONLY'
  const [data, setData] = useState<CardData>({ state: 'loading', latest: null, detail: null, today: '' })
  const [tick, setTick] = useState(0)
  const [busy, setBusy] = useState(false)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    const today = todayKey()
    apiGet<EvaluationList>('/api/v1/evaluations?limit=1')
      .then(async (list) => {
        const latest = list.items[0] ?? null
        const detail = latest && cardNeedsDetail(latest, today) ? await apiGet<EvaluationDetail>(`/api/v1/evaluations/${encodeURIComponent(latest.id)}`).catch(() => null) : null
        if (!cancelled) setData({ state: 'ready', latest, detail, today })
      })
      .catch(() => {
        if (!cancelled) setData((prev) => ({ ...prev, state: 'error' }))
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey, tick])

  const inProgress = data.latest?.status === 'IN_PROGRESS'
  const now = useNow(inProgress)
  const card = deriveEvalCard(data.state, data.latest, data.detail, data.today, now)
  const watchId = card.kind === 'gen' ? card.jobId : card.kind === 'grading' ? card.jobId || null : null
  useJobWatch(watchId, { delays: [5000], onSettled: reload })

  const open = (id: string) => router.push(evalPath(id))
  const pick = (k: EvalKind) => router.push(startPath(k))
  const regrade = async (id: string) => {
    if (busy) return
    setBusy(true)
    try {
      await apiPost<SubmitResult>(`/api/v1/evaluations/${encodeURIComponent(id)}/submit`)
      router.push(evalPath(id))
    } catch (e) {
      const err = toErr(e)
      setBusy(false)
      if (err.status === 409) return reload()
      onToast(err.status === 0 ? COMMON.network : err.message || COMMON.network)
    }
  }

  const kindName = (ev: EvaluationListItem) => KIND_NAME[ev.kind]
  let body: React.ReactNode
  switch (card.kind) {
    case 'loading':
      body = (
        <>
          <Head myLevel={myLevel} badge={false} />
          <p role="status" className="mt-1 text-[13px] text-ink2">
            {HOME.loading}
          </p>
        </>
      )
      break
    case 'error':
      body = (
        <>
          <Head myLevel={myLevel} badge={false} />
          <div className="mt-2">
            <ErrorBlock message={HOME.loadError} onRetry={() => {
              setData((prev) => ({ ...prev, state: 'loading' }))
              reload()
            }} />
          </div>
        </>
      )
      break
    case 'gen':
      body = (
        <>
          <Head myLevel={myLevel} badge />
          <p className="mt-1 text-[15px] font-semibold">{HOME.genTitle}</p>
          <p className="mt-1 text-[13px] text-ink2 break-keep">{HOME.genBody(kindName(card.ev), card.ev.topic?.title ?? null)}</p>
          <IndetBar />
          <Btn variant="ghost" className="mt-3 w-full" onClick={() => open(card.ev.id)}>
            {HOME.genOpen}
          </Btn>
        </>
      )
      break
    case 'ready':
      body = (
        <>
          <Head myLevel={myLevel} badge />
          <p className="mt-1 text-[15px] font-semibold">{HOME.readyTitle}</p>
          <p className="mt-1 text-[13px] text-ink2 break-keep">{HOME.readyBody(kindName(card.ev), card.itemCount)}</p>
          <Btn className="mt-3 w-full" onClick={() => open(card.ev.id)}>
            {HOME.readyGo}
          </Btn>
        </>
      )
      break
    case 'progress':
    case 'over': {
      const over = card.kind === 'over'
      const remain = card.remain
      body = (
        <>
          <Head myLevel={myLevel} badge />
          <p className="mt-1 text-[15px] font-semibold break-keep">{over ? HOME.overTitle : HOME.progressTitle}</p>
          <p className="mt-1 text-[13px] text-ink2 break-keep">{(over ? HOME.overBody : HOME.progressBody)(kindName(card.ev), card.itemCount, card.answered)}</p>
          {remain !== null ? (
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <Pill warn={over}>{over ? HOME.overPill(clockText(-remain)) : HOME.remain(clockText(remain))}</Pill>
            </div>
          ) : null}
          <Btn className="mt-3 w-full" onClick={() => open(card.ev.id)}>
            {over ? HOME.resumeOver : HOME.resume}
          </Btn>
        </>
      )
      break
    }
    case 'grading':
      body = (
        <>
          <Head myLevel={myLevel} badge />
          <p className="mt-1 text-[15px] font-semibold">{HOME.gradingTitle}</p>
          <p className="mt-1 text-[13px] text-ink2 break-keep">{HOME.gradingBody(kindName(card.ev))}</p>
          <IndetBar />
          <Btn variant="ghost" className="mt-3 w-full" onClick={() => open(card.ev.id)}>
            {HOME.genOpen}
          </Btn>
        </>
      )
      break
    case 'gradefail':
      body = (
        <>
          <Head myLevel={myLevel} badge />
          <p className="mt-1 text-[15px] font-semibold">{HOME.gradeFailTitle}</p>
          <p className="mt-1 text-[13px] text-ink2 break-keep">{HOME.gradeFailBody(kindName(card.ev))}</p>
          <Btn className="mt-3 w-full" aria-busy={busy || undefined} onClick={() => void regrade(card.ev.id)}>
            {busy ? HOME.regrading : HOME.regrade}
          </Btn>
        </>
      )
      break
    case 'done': {
      const ev = card.ev
      body = (
        <>
          <Head myLevel={myLevel} badge />
          <p className="mt-1 text-[12px] text-ink2 break-keep">{HOME.doneCap(kindName(ev), ev.topic?.title ?? null)}</p>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[26px] font-bold leading-[1.2] tabular-nums">
              {ev.totalScore ?? 0}
              <small className="ml-0.5 text-[13px] font-medium text-ink2">점</small>
            </span>
            {ev.grade ? <GradeChip grade={ev.grade} /> : null}
          </div>
          {card.focus ? (
            <div className="mt-2.5 rounded-xl bg-accent-soft px-3 py-2.5">
              <p className="text-[12px] text-ink2">{HOME.focus}</p>
              <p className="mt-1 text-[14px] break-keep [overflow-wrap:anywhere]">{card.focus}</p>
            </div>
          ) : null}
          <BtnRow>
            <Btn onClick={() => open(ev.id)}>{HOME.result}</Btn>
            <Btn variant="ghost" onClick={() => pick('WORDS')}>
              {HOME.newEval}
            </Btn>
          </BtnRow>
          <button type="button" onClick={() => router.push(EVAL_HISTORY_PATH)} className="mt-1 flex h-11 w-full items-center justify-center text-[13px] font-semibold underline underline-offset-[3px]">
            {HOME.history}
          </button>
        </>
      )
      break
    }
    default: {
      const last = card.kind === 'start' ? card.last : null
      body = (
        <>
          <Head myLevel={myLevel} badge />
          <p className="mt-1 text-[13px] text-ink2 break-keep">{HOME.intro}</p>
          <KindTiles textOnly={textOnly} onPick={pick} onBlocked={() => onToast(HOME.talkBlockedWhy)} />
          {last && last.completedAt ? (
            <button type="button" onClick={() => router.push(EVAL_HISTORY_PATH)} className="mt-2.5 flex min-h-11 w-full items-center justify-between gap-2 border-t border-line pt-2 text-left text-[13px] text-ink2">
              <span className="min-w-0 flex-1 break-keep">
                {HOME.last(formatMonthDay(kstDateKey(last.completedAt)), KIND_SHORT[last.kind])}
                <b className="font-semibold text-ink">{last.totalScore ?? 0}점</b>
                {last.grade ? ` · ${GRADE_LABEL[last.grade]}` : ''}
              </span>
              <span aria-hidden="true" className="flex-none text-[18px] text-ink3">
                ›
              </span>
            </button>
          ) : (
            <p className="mt-2 text-[12px] text-ink2 break-keep">{HOME.first}</p>
          )}
        </>
      )
    }
  }

  return (
    <section aria-labelledby="eval-card-title" className="mt-[18px] min-w-0">
      <Card>{body}</Card>
    </section>
  )
}
