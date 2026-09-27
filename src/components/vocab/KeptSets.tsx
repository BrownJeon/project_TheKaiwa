'use client'

/**
 * 보관한 세트(screens.md §5-2 A KeptSets, #48 `?kept=1`). 행을 누르면 결과 화면, [다시 풀기]는 #53(보관 세트만, F7).
 * 더 보기는 제자리에 이어 붙인다. 0개면 섹션을 그리지 않는다.
 */
import Link from 'next/link'
import { useState, type Ref } from 'react'
import { apiGet } from '@/components/common/api'
import { Btn, Section, SectionHeader } from '@/components/common/ui'
import type { Paged, SessionSummary } from '@/types/vocab'
import { formatSessionDate } from './format'
import { MODE_LABEL } from './labels'

export default function KeptSets({
  initial,
  today,
  busyId,
  onReplay,
  anchorRef,
}: {
  initial: Paged<SessionSummary>
  today: string
  busyId: string | null
  onReplay: (id: string) => void
  /** "보관한 세트 보기" 가 이 섹션으로 스크롤한다 */
  anchorRef?: Ref<HTMLDivElement>
}) {
  const [items, setItems] = useState(initial.items)
  const [cursor, setCursor] = useState(initial.nextCursor)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)

  if (items.length === 0) return null

  const more = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    setError(false)
    try {
      const r = await apiGet<Paged<SessionSummary>>(`/api/v1/vocab/sessions?kept=1&limit=5&cursor=${encodeURIComponent(cursor)}`)
      setItems((prev) => {
        const have = new Set(prev.map((s) => s.id))
        return [...prev, ...r.items.filter((s) => !have.has(s.id) && s.status === 'DONE')]
      })
      setCursor(r.nextCursor)
    } catch {
      setError(true)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div ref={anchorRef} className="scroll-mt-16">
      <Section>
        <SectionHeader
          title="보관한 세트"
          right={
            cursor ? (
              <button type="button" onClick={() => void more()} aria-busy={loadingMore || undefined} className="min-h-[44px] flex-none px-1 text-[13px] font-medium text-accent">
                {loadingMore ? '불러오는 중…' : '더 보기'}
              </button>
            ) : null
          }
        />
        <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
          {items.map((s) => (
            <li key={s.id} className="flex min-h-[64px] min-w-0 items-center gap-2 px-3.5 py-2">
              <Link href={`/study/today/words/${encodeURIComponent(s.id)}`} className="min-w-0 flex-1 py-1">
                <p className="truncate text-[15px]">
                  {formatSessionDate(s.date, today)} · {s.cardCount}장 · {MODE_LABEL[s.mode]}
                </p>
                <p className="text-[12px] text-ink2 tabular-nums">
                  맞힘 {s.correctCount} · 틀림 {s.wrongCount} · 건너뜀 {s.skippedCount}
                </p>
              </Link>
              <Btn
                variant="soft"
                className="flex-none px-3 text-[14px]"
                onClick={() => onReplay(s.id)}
                aria-disabled={busyId !== null || undefined}
                aria-busy={busyId === s.id || undefined}
              >
                {busyId === s.id ? '만드는 중…' : '다시 풀기'}
              </Btn>
            </li>
          ))}
        </ul>
        {error ? (
          <p role="alert" className="mt-2 text-[13px] text-bad break-keep">
            보관한 세트를 더 불러오지 못했어요.
          </p>
        ) : null}
      </Section>
    </div>
  )
}
