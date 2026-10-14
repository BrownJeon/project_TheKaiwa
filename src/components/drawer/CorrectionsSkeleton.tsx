'use client'

/**
 * 채택 교정 모음 서버 `loading.tsx` 의 내용(task-055 §21-7 B) — `CorrectionsScreen` 첫 로딩과 같은 위치·높이로 서버 응답 전에 바로 그려진다.
 * 정적으로 아는 부분(분절·검색·조각 칩·보기 설정 줄)은 실제 부품 그대로 `inert` 이고, 「유형」 칩 줄과 카드 목록만 자리표시다(화면 첫 로딩과 **같은 부품**).
 * 여기엔 데이터 요청이 없다 — 진짜 화면이 올라오면 그쪽이 불러온다. 화면 모듈(`CorrectionsScreen`)을 import 하지 않는다.
 */
import { DisplayToggles } from '@/components/common/japanese/JapaneseText'
import { DISPLAY_COPY } from '@/components/common/japanese/displayPrefs'
import AppBar from '@/components/shell/AppBar'
import { CorrectionCardsSkeleton, ErrorTypeRowSkeleton } from '@/components/shell/TabSkeleton'
import ChunkChips from '@/components/vocab/ChunkChips'
import WordSearchBar from '@/components/vocab/WordSearchBar'
import { CORRECTIONS_COPY as C } from './correctionsCopy'
import DrawerSwitch from './DrawerSwitch'

const noop = () => {}

export default function CorrectionsSkeleton() {
  return (
    <>
      <AppBar title="단어장" />
      <div className="px-4 pb-8">
        <DrawerSwitch current="corrections" placeholder />
        <div inert>
          <WordSearchBar label={C.search} placeholder={C.search} commitWhileTyping={false} value="" onInput={noop} onCommit={noop} onClear={noop} error={null} />
        </div>
        <ErrorTypeRowSkeleton />
        <div inert>
          <ChunkChips value={null} variant="corrections" onChange={noop} />
          <div className="mb-1.5 mt-2 flex min-h-8 items-center justify-between gap-2">
            <p className="min-w-0 flex-1 text-[12px] text-ink2" />
            <div role="group" aria-label={DISPLAY_COPY.toolGroup} className="flex flex-none items-center gap-1.5">
              <DisplayToggles keys={['fu', 'hg']} onToast={noop} />
            </div>
          </div>
        </div>
        <CorrectionCardsSkeleton />
      </div>
    </>
  )
}
