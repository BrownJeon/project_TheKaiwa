'use client'

/**
 * 단어장 탭 서버 `loading.tsx` 의 내용(task-046 IMP-0027) — `WordsScreen` 의 첫 화면과 같은 위치·높이로 서버 응답 전에 바로 그려진다.
 * 정적으로 아는 부분(검색·조각 칩·정렬 줄·개수 줄)은 실제 부품 그대로 `inert`(눌리지 않음·읽기에서 빠짐)이고, 단어 목록과 분류 칩 줄만 자리표시다.
 * 분류 칩 줄 자리는 단어가 있는 흔한 상태를 따른다(단어가 하나도 없는 계정은 응답 뒤 이 줄과 조각 줄이 접힌다 — `WordsScreen` 도 같다).
 * 여기엔 데이터 요청이 없다 — 진짜 화면이 올라오면 그쪽이 불러온다.
 */
import Segmented from '@/components/common/Segmented'
import { DisplayToggles } from '@/components/common/japanese/JapaneseText'
import { DISPLAY_COPY } from '@/components/common/japanese/displayPrefs'
import AppBar from '@/components/shell/AppBar'
import { WordCategoryRowSkeleton, WordRowsSkeleton } from '@/components/shell/TabSkeleton'
import ArchiveToggle from './ArchiveToggle'
import ChunkChips from './ChunkChips'
import WordSearchBar from './WordSearchBar'
import { WORD_SORT_OPTIONS } from './WordsScreen'

const noop = () => {}

export default function WordsSkeleton() {
  return (
    <>
      <AppBar
        title="단어장"
        right={
          <button type="button" inert aria-label="단어 추가" className="h-11 flex-none rounded-xl bg-surface2 px-3 text-[14px] font-semibold">
            ＋ 추가
          </button>
        }
      />
      <div className="px-4 pb-8">
        <div inert>
          <WordSearchBar value="" onInput={noop} onCommit={noop} onClear={noop} error={null} />
        </div>
        <WordCategoryRowSkeleton />
        <div inert>
          <ChunkChips value={null} onChange={noop} />
          <div className="mt-2 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Segmented size="sm" ariaLabel="정렬" options={WORD_SORT_OPTIONS} value="recent" onChange={noop} />
            </div>
            <ArchiveToggle pressed={false} onToggle={noop} />
          </div>
          <div className="mb-1.5 mt-2 flex min-h-8 items-center justify-between gap-2">
            <p className="min-w-0 flex-1 text-[12px] text-ink2" />
            <div role="group" aria-label={DISPLAY_COPY.toolGroup} className="flex flex-none items-center gap-1.5">
              <DisplayToggles keys={['fu', 'hg']} onToast={noop} />
            </div>
          </div>
        </div>
        <WordRowsSkeleton />
      </div>
    </>
  )
}
