'use client'

/**
 * 내 발화 기록 `/settings/utterances`(task-012b-2 가이드 §2-C, 상태 L1~L14) — #21c 로 말로 한 기록을 최근 것부터 보고, 확인할 말(수업·평가 발화 포함 —
 * 거기엔 카드 자리가 없다)을 처리하고, 녹음(30일)을 다시 듣는다. 하단 탭은 보이고 스크롤은 앱 `main` 한 곳.
 * 확정은 이 줄의 글(`finalText`)만 바꾼다 — 보낸 말·교정·평가 점수는 그대로(맨 아래 안내). 엔진 이름·신뢰도 숫자는 없다.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { apiGet } from '@/components/common/api'
import { formatClock, formatDateDivider } from '@/components/common/format'
import { useAnnotations } from '@/components/common/japanese/annotations'
import { DisplayToggles, HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import Segmented from '@/components/common/Segmented'
import Toast, { useToast } from '@/components/common/Toast'
import { Badge, Btn, ErrorBlock } from '@/components/common/ui'
import BackBar from '@/components/shell/BackBar'
import ReplayButton from '@/components/talk/ReplayButton'
import type { UtteranceListDto, UtteranceListItem } from '@/types/speech'
import UtteranceReviewCard, { reviewBodyId } from './UtteranceReviewCard'
import { LOG_COPY } from './utteranceCopy'
import { appendPage, applyResolved, chipOf, contextOf, durationSec, isReviewable, needsDivider, requestGate, rowText, settleIfCurrent } from './utteranceReview'
import { useMinePlayback } from './useMinePlayback'

export type LogFilter = 'all' | 'review'
const PAGE = 20

export default function UtteranceLog({ initialFilter = 'all' }: { initialFilter?: LogFilter }) {
  const router = useRouter()
  const toast = useToast()
  const [filter, setFilter] = useState<LogFilter>(initialFilter)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [items, setItems] = useState<UtteranceListItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [count, setCount] = useState(0)
  const [more, setMore] = useState<'idle' | 'loading' | 'error'>('idle')
  const [openId, setOpenId] = useState<string | null>(null)
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set())
  const [tick, setTick] = useState(0)

  const showToast = toast.show
  const onMissing = useCallback(
    (id: string) => {
      setGone((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
      showToast(LOG_COPY.missingToast)
    },
    [showToast],
  )
  const mine = useMinePlayback(onMissing)

  const query = useCallback(
    (c: string | null) => {
      const q = new URLSearchParams({ limit: String(PAGE) })
      if (filter === 'review') q.set('reviewable', '1')
      if (c) q.set('cursor', c)
      return `/api/v1/speech/utterances?${q}`
    },
    [filter],
  )

  useEffect(() => {
    let cancelled = false
    apiGet<UtteranceListDto>(query(null)).then(
      (r) => {
        if (cancelled) return
        setItems(r.items)
        setCursor(r.nextCursor)
        setCount(r.reviewableCount)
        setState('ready')
      },
      () => !cancelled && setState('error'),
    )
    return () => {
      cancelled = true
    }
  }, [query, tick])

  // "더 보기" 가 오는 사이 필터를 바꾸면 그 응답(행·커서·오류)은 버린다 — 새 필터 목록에 옛 필터 행이 섞이지 않게(REV-132 L-1).
  const [gate] = useState(requestGate)
  const loadMore = async () => {
    if (!cursor || more === 'loading') return
    setMore('loading')
    const r = await settleIfCurrent(() => apiGet<UtteranceListDto>(query(cursor)), gate.ticket())
    if (r.kind === 'stale') return
    if (r.kind === 'error') {
      setMore('error')
      return
    }
    setItems((prev) => appendPage(prev, r.value.items))
    setCursor(r.value.nextCursor)
    setMore('idle')
  }

  const pick = (f: LogFilter) => {
    if (f === filter) return
    gate.invalidate()
    setFilter(f)
    setState('loading')
    setItems([])
    setCursor(null)
    setMore('idle')
    setOpenId(null)
    router.replace(f === 'review' ? '/settings/utterances?filter=review' : '/settings/utterances', { scroll: false })
  }

  const texts = useMemo(() => items.map(rowText), [items])
  const anns = useAnnotations(texts)

  let body: React.ReactNode
  if (state === 'loading') {
    body = (
      <p role="status" className="py-8 text-center text-[13px] text-ink2">
        {LOG_COPY.loading}
      </p>
    )
  } else if (state === 'error') {
    body = (
      <div className="mt-3">
        <ErrorBlock
          message={LOG_COPY.error}
          onRetry={() => {
            setState('loading')
            setTick((t) => t + 1)
          }}
        />
      </div>
    )
  } else if (items.length === 0) {
    body =
      filter === 'review' ? (
        <p className="mt-3 rounded-xl border border-dashed border-line px-3.5 py-4 text-center text-[13px] text-ink2 break-keep">{LOG_COPY.emptyReview}</p>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-1 rounded-xl border border-dashed border-line px-3.5 py-5 text-center text-[13px] text-ink2">
          {LOG_COPY.emptyLines.map((l) => (
            <p key={l} className="break-keep">
              {l}
            </p>
          ))}
          <Link href="/study/ai?tab=talk" className="mt-2 inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface px-5 text-[15px] font-semibold text-ink">
            {LOG_COPY.emptyGo}
          </Link>
        </div>
      )
  } else {
    body = (
      <>
        <ul aria-label={LOG_COPY.listAria} className="mt-2 min-w-0">
          {items.map((u, i) => {
            const prev = i > 0 ? items[i - 1].createdAt : null
            const clock = formatClock(u.createdAt)
            const ctx = contextOf(u.context)
            const chip = chipOf(u)
            const review = isReviewable(u)
            const open = openId === u.id
            const audio = u.audioAvailable && !gone.has(u.id)
            return (
              <Fragment key={u.id}>
                {needsDivider(prev, u.createdAt) ? (
                  <li role="separator" className="my-3 flex items-center gap-3 text-[12px] text-ink2">
                    <span aria-hidden="true" className="h-px flex-1 bg-line" />
                    {formatDateDivider(u.createdAt)}
                    <span aria-hidden="true" className="h-px flex-1 bg-line" />
                  </li>
                ) : null}
                <li className="min-w-0 border-b border-line py-3">
                  <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-ink2">
                    <time dateTime={u.createdAt} className="flex-none tabular-nums">
                      {clock}
                    </time>
                    <span aria-hidden="true">·</span>
                    <span className="min-w-0 truncate">{ctx.label}</span>
                    <span aria-hidden="true">·</span>
                    <span className="flex-none tabular-nums">{LOG_COPY.seconds(durationSec(u.durationMs))}</span>
                    {chip ? (
                      <span className="ml-auto flex-none">
                        <Badge tone={chip.tone}>{chip.label}</Badge>
                      </span>
                    ) : null}
                  </div>
                  <JaText text={rowText(u)} state={anns[i]} className="mt-1 whitespace-pre-wrap text-[16px] leading-[1.7] [overflow-wrap:anywhere]" />
                  <HangulLine state={anns[i]} size={13} />
                  <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 text-[13px]">
                    {audio ? (
                      <ReplayButton state={mine.stateOf(u.id)} idleLabel={LOG_COPY.mine} ariaLabel={LOG_COPY.mineAria(clock)} onClick={() => mine.toggle(u.id)} />
                    ) : (
                      <span className="inline-flex min-h-11 items-center text-[12px] text-ink2">{LOG_COPY.expired}</span>
                    )}
                    {review ? (
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={reviewBodyId(u.id)}
                        onClick={() => setOpenId(open ? null : u.id)}
                        className="h-11 px-1.5 font-semibold text-ink underline underline-offset-4"
                      >
                        {LOG_COPY.check}
                      </button>
                    ) : null}
                    {ctx.href ? (
                      <Link href={ctx.href} className="ml-auto inline-flex h-11 items-center px-1.5 text-ink2">
                        {ctx.linkLabel} ›
                      </Link>
                    ) : null}
                  </div>
                  {open ? (
                    <UtteranceReviewCard
                      item={u}
                      variant="log"
                      open
                      onResolved={(view) => {
                        setItems((prevItems) => prevItems.map((x) => (x.id === u.id ? applyResolved(x, view) : x)))
                        setCount((n) => Math.max(0, n - 1))
                      }}
                      onSettled={() => setCount((n) => Math.max(0, n - 1))}
                    />
                  ) : null}
                </li>
              </Fragment>
            )
          })}
        </ul>
        {cursor ? (
          <>
            <Btn variant="ghost" className="mt-3 w-full" aria-busy={more === 'loading' || undefined} onClick={() => void loadMore()}>
              {more === 'loading' ? LOG_COPY.loading : LOG_COPY.more}
            </Btn>
            {more === 'error' ? (
              <p role="alert" className="mt-1.5 flex flex-wrap items-center justify-center gap-x-1 text-[12.5px] text-bad">
                {LOG_COPY.moreError}
                <button type="button" onClick={() => void loadMore()} className="h-11 px-1.5 font-semibold underline">
                  {LOG_COPY.retry}
                </button>
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-center text-[12px] text-ink2">{LOG_COPY.end}</p>
        )}
      </>
    )
  }

  return (
    <>
      <BackBar backHref="/settings" backLabel={LOG_COPY.back} title={LOG_COPY.title} />
      <div className="px-4 pb-6">
        <p className="mt-3 text-[13px] text-ink2 break-keep">{LOG_COPY.intro}</p>
        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
          <div className="min-w-[176px]">
            <Segmented
              size="sm"
              ariaLabel={LOG_COPY.filterAria}
              value={filter}
              onChange={pick}
              options={[
                { value: 'all', label: LOG_COPY.all },
                { value: 'review', label: LOG_COPY.review(count) },
              ]}
            />
          </div>
          <div className="ml-auto flex gap-1.5">
            <DisplayToggles keys={['fu', 'hg']} onToast={showToast} />
          </div>
        </div>
        {body}
        <div className="mt-6 space-y-1 rounded-xl bg-surface2 px-3.5 py-3 text-[12.5px] text-ink2 break-keep">
          {LOG_COPY.notes.map((l) => (
            <p key={l}>{l}</p>
          ))}
        </div>
      </div>
      <Toast message={toast.message} />
    </>
  )
}
