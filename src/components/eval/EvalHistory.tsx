'use client'

/**
 * 평가 기록 `/study/today/eval/history`(데모 v1 `#hist*`) — #69 로 최근 것부터 한 줄씩(종류·레벨·날짜·주제 / 점수·등급), 위 칩으로 단어/회화 거르기,
 * [더 보기]는 커서로 이어 읽기. 진행 중 평가도 목록에 있어(#69) 점수 대신 상태를 보인다. 줄을 누르면 그 평가 경로로.
 */
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '@/components/common/api'
import { formatDateDivider } from '@/components/common/format'
import { Btn, ErrorBlock } from '@/components/common/ui'
import BackBar from '@/components/shell/BackBar'
import type { EvalKind, EvaluationList, EvaluationListItem } from '@/types/evaluation'
import { GRADE_LABEL, HIST, KIND_NAME, KIND_SHORT } from './evalCopy'
import { histDateIso } from './logic'
import { evalPath, startPath } from './paths'

type Filter = 'ALL' | EvalKind

export default function EvalHistory() {
  const [filter, setFilter] = useState<Filter>('ALL')
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [items, setItems] = useState<EvaluationListItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [more, setMore] = useState<'idle' | 'loading' | 'error'>('idle')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    const q = new URLSearchParams({ limit: '20' })
    if (filter !== 'ALL') q.set('kind', filter)
    apiGet<EvaluationList>(`/api/v1/evaluations?${q}`).then(
      (r) => {
        if (cancelled) return
        setItems(r.items)
        setCursor(r.nextCursor)
        setState('ready')
      },
      () => !cancelled && setState('error'),
    )
    return () => {
      cancelled = true
    }
  }, [filter, tick])

  const loadMore = useCallback(async () => {
    if (!cursor || more === 'loading') return
    setMore('loading')
    const q = new URLSearchParams({ limit: '20', cursor })
    if (filter !== 'ALL') q.set('kind', filter)
    try {
      const r = await apiGet<EvaluationList>(`/api/v1/evaluations?${q}`)
      setItems((prev) => [...prev, ...r.items.filter((x) => !prev.some((p) => p.id === x.id))])
      setCursor(r.nextCursor)
      setMore('idle')
    } catch {
      setMore('error')
    }
  }, [cursor, filter, more])

  const pick = (f: Filter) => {
    if (f === filter) return
    setFilter(f)
    setState('loading')
    setMore('idle')
  }

  const everEmpty = state === 'ready' && items.length === 0 && filter === 'ALL'
  let body: React.ReactNode
  if (state === 'loading') {
    body = (
      <div className="flex flex-col gap-2">
        <p role="status" className="sr-only">
          {HIST.loading}
        </p>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} aria-hidden="true" className="block h-16 rounded-[14px] bg-surface2" />
        ))}
      </div>
    )
  } else if (state === 'error') {
    body = (
      <ErrorBlock
        message={HIST.error}
        onRetry={() => {
          setState('loading')
          setTick((t) => t + 1)
        }}
      />
    )
  } else if (everEmpty) {
    body = (
      <div className="flex flex-col items-center gap-2 px-2 pt-10 text-center">
        <p className="text-[15px] font-semibold">{HIST.emptyTitle}</p>
        <p className="text-[13px] text-ink2 break-keep">{HIST.emptyBody}</p>
        <Link href={startPath('WORDS')} className="mt-3 inline-flex h-12 items-center justify-center rounded-xl bg-accent px-6 text-[15px] font-semibold text-on-accent">
          {HIST.emptyGo}
        </Link>
      </div>
    )
  } else if (items.length === 0) {
    body = (
      <div className="flex flex-col items-center gap-2 px-2 pt-8 text-center">
        <p className="text-[15px] font-semibold">{HIST.emptyKind(filter === 'TALK' ? KIND_SHORT.TALK : KIND_SHORT.WORDS)}</p>
        <Btn variant="ghost" className="mt-3" onClick={() => pick('ALL')}>
          {HIST.showAll}
        </Btn>
      </div>
    )
  } else {
    body = (
      <>
        <ul className="overflow-hidden rounded-[14px] border border-line bg-surface">
          {items.map((h, k) => {
            const iso = histDateIso(h)
            const done = h.status === 'DONE' && h.totalScore !== null
            return (
              <li key={h.id} className={k > 0 ? 'border-t border-line' : ''}>
                <Link href={evalPath(h.id)} className="flex min-h-[68px] w-full items-center gap-3 py-2.5 pl-3.5 pr-3 text-left">
                  <span aria-hidden="true" className="grid h-10 w-10 flex-none place-items-center rounded-[10px] bg-surface2 text-[12.5px] font-bold">
                    {KIND_SHORT[h.kind]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[15px] font-semibold">
                      {KIND_NAME[h.kind]} · {h.level}
                    </b>
                    <span className="block truncate text-[12px] text-ink2">{[iso ? formatDateDivider(iso) : '', h.topic?.title ?? ''].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="flex flex-none flex-col items-end text-right">
                    {done ? (
                      <>
                        <b className="text-[18px] font-bold leading-[1.2] tabular-nums">{HIST.score(h.totalScore ?? 0)}</b>
                        <span className="whitespace-nowrap text-[11.5px] text-ink2">{h.grade ? GRADE_LABEL[h.grade] : ''}</span>
                      </>
                    ) : (
                      <span className="whitespace-nowrap text-[13px] font-semibold text-ink2">{HIST.status[h.status] ?? ''}</span>
                    )}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
        {cursor ? (
          <Btn variant="ghost" className="w-full aria-busy:opacity-70" aria-busy={more === 'loading' || undefined} onClick={() => void loadMore()}>
            {more === 'loading' ? HIST.moreLoading : HIST.more}
          </Btn>
        ) : (
          <p className="text-center text-[12px] text-ink2">{HIST.allLoaded}</p>
        )}
        {more === 'error' ? <ErrorBlock message={HIST.error} /> : null}
      </>
    )
  }

  const chips: [Filter, string][] = [
    ['ALL', HIST.all],
    ['WORDS', KIND_NAME.WORDS],
    ['TALK', KIND_NAME.TALK],
  ]
  return (
    <div className="flex h-full min-h-0 flex-col bg-ground">
      <BackBar backHref="/study/today" backLabel={HIST.back} title={HIST.title} subtitle={HIST.sub} />
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto overscroll-contain px-4 pb-8 pt-3.5">
        {everEmpty ? null : (
          <div role="radiogroup" aria-label={HIST.filterAria} className="no-scrollbar flex gap-1.5 overflow-x-auto py-1.5">
            {chips.map(([f, label]) => {
              const on = filter === f
              return (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pick(f)}
                  className={`relative inline-flex h-8 flex-none items-center rounded-full border px-3 text-[13px] before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] ${
                    on ? 'border-ink bg-ink font-semibold text-surface' : 'border-line bg-surface'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}
        {body}
      </div>
    </div>
  )
}
