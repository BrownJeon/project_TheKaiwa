'use client'

/**
 * 단어 목록 한 줄(screens.md §4-2 A) — 행 전체가 버튼, 누르면 상세 시트. 버튼 안 글이 곧 접근 가능한 이름이다.
 * 오른쪽 뱃지는 조각(task-023 — 출처 뱃지를 모두 바꿨다). 조각이 없으면 뱃지를 그리지 않는다(결정 a).
 * 표제어 위 히라가나는 저장 읽기로 정렬한 루비(`ruby`), 아래 `[한글]` 은 표제어 분석(`hangul` — 저장 읽기와 다르면 none). 둘 다 목록이
 * 한 번에 받아 넘긴다(task-026 §15-4-4). 옆 읽기 칸은 루비로 바뀌어 없앴다.
 */
import { memo } from 'react'
import type { AnnotationState } from '@/components/common/japanese/annotations'
import { HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import { Badge } from '@/components/common/ui'
import type { RubyPiece } from '@/modules/speech/reading/client'
import type { WordEntry, WordSort } from '@/types/vocab'
import { CHUNK_LABEL } from './labels'

function WordRow({
  word,
  sort,
  onOpen,
  ruby,
  hangul,
}: {
  word: WordEntry
  sort: WordSort
  onOpen: (w: WordEntry) => void
  ruby: RubyPiece[] | null
  hangul: AnnotationState
}) {
  const badge = word.chunkType ? (CHUNK_LABEL[word.chunkType] ?? null) : null
  const played = word.correctCount + word.wrongCount > 0
  return (
    <li>
      <button type="button" onClick={() => onOpen(word)} className="flex min-h-[64px] w-full min-w-0 flex-col justify-center gap-0.5 px-3.5 py-2.5 text-left">
        <span className="flex w-full min-w-0 items-baseline gap-2">
          <JaText as="span" text={word.surface} state={hangul} ruby={ruby} leading={1.95} className="min-w-0 truncate text-[18px] font-semibold" />
          <span className="flex-1" />
          {badge ? <Badge tone="neutral">{badge}</Badge> : null}
        </span>
        <HangulLine as="span" state={hangul} size={12.5} className="w-full" />
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
