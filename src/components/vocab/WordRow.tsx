'use client'

/** 단어 목록 한 줄(screens.md §4-2 A) — 행 전체가 버튼, 누르면 상세 시트. 버튼 안 글이 곧 접근 가능한 이름이다. */
import { memo } from 'react'
import { Badge } from '@/components/common/ui'
import type { WordEntry, WordSort } from '@/types/vocab'
import { SOURCE_BADGE } from './labels'

function WordRow({ word, sort, onOpen }: { word: WordEntry; sort: WordSort; onOpen: (w: WordEntry) => void }) {
  const badge = SOURCE_BADGE[word.source] ?? null
  const played = word.correctCount + word.wrongCount > 0
  return (
    <li>
      <button type="button" onClick={() => onOpen(word)} className="flex min-h-[64px] w-full min-w-0 flex-col justify-center gap-0.5 px-3.5 py-2.5 text-left">
        <span className="flex w-full min-w-0 items-baseline gap-2">
          <span lang="ja" className="min-w-0 truncate text-[18px] font-semibold">
            {word.surface}
          </span>
          {word.reading && word.reading !== word.surface ? (
            <span lang="ja" className="min-w-0 flex-1 truncate text-[13px] text-ink2">
              {word.reading}
            </span>
          ) : (
            <span className="flex-1" />
          )}
          {badge ? <Badge tone="neutral">{badge}</Badge> : null}
        </span>
        <span className="flex w-full min-w-0 items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[14px] text-ink2">{word.meaning}</span>
          {sort === 'wrong' && word.wrongCount > 0 ? (
            <Badge tone="bad">틀림 {word.wrongCount}</Badge>
          ) : played ? (
            <span className="flex-none text-[12px] text-ink2 tabular-nums">
              맞힘 {word.correctCount} · 틀림 {word.wrongCount}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  )
}

export default memo(WordRow)
