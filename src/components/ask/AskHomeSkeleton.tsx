'use client'

/**
 * 질문 탭 `/ask` 서버 `loading.tsx` 의 내용(screens.md §25-7 B, §17-1). 정적으로 아는 부분(앱바·입력 카드·예시 줄·「지난 질문」 머리)은
 * **실제 부품 그대로** 그리고 `inert` 로 막는다 — 진짜 화면과 모양이 같아 점프가 없고 읽기 도구에도 안 읽힌다. 행만 회색 자리표시.
 * 예시는 흔한 상태(지난 질문 있음)의 `row`. 데이터 요청은 없다 — 진짜 화면(`AskHome`)이 올라오면 그쪽이 불러온다.
 */
import AppBar from '@/components/shell/AppBar'
import { ChatRowsSkeleton } from '@/components/shell/TabSkeleton'
import { ASK_COPY } from './askCopy'
import AskComposerCard from './AskComposerCard'
import AskExamples from './AskExamples'

const noop = () => {}

export default function AskHomeSkeleton() {
  return (
    <>
      <AppBar title="질문" />
      <div className="flex min-w-0 flex-col gap-[18px] px-4 pb-8">
        <div inert>
          <AskComposerCard value="" busy={false} onChange={noop} onSubmit={noop} onScopeInfo={noop} />
        </div>
        <div inert>
          <AskExamples mode="row" onPick={noop} />
        </div>
        <section className="min-w-0">
          <h3 className="mb-2.5 text-[15px] font-bold">{ASK_COPY.roomsTitle}</h3>
          <ChatRowsSkeleton />
        </section>
      </div>
    </>
  )
}
