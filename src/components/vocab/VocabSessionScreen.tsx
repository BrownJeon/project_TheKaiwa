'use client'

/**
 * 오늘의 단어 세트 `/study/today/words/[sessionId]`(screens.md §5-2 B·E). 세트 상태로 갈라 그린다:
 * IN_PROGRESS → 덱 · DONE → 결과 · ABANDONED(답 0장으로 닫힘, F2) → 안내 · 404(없음·타인) → "세트를 찾을 수 없어요".
 * 하단 탭은 숨김(TabBar `HIDDEN_PREFIXES`), 머리는 `BackBar`.
 */
import Link from 'next/link'
import { useCallback } from 'react'
import { ErrorBlock, LoadingBlock } from '@/components/common/ui'
import BackBar from '@/components/shell/BackBar'
import { useVocabDeck } from './useVocabDeck'
import VocabDeck from './VocabDeck'
import VocabResult from './VocabResult'

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-ground">
      <BackBar backHref="/study/today" backLabel="공부로" title="오늘의 단어" />
      <div className="px-4 pt-6">{children}</div>
    </div>
  )
}

function Notice({ title, body }: { title: string; body?: string }) {
  return (
    <div role="alert" className="rounded-[14px] border border-line bg-surface p-4">
      <p className="text-[15px] font-semibold break-keep">{title}</p>
      {body ? <p className="mt-1 text-[13px] text-ink2 break-keep">{body}</p> : null}
      <Link href="/study/today" className="mt-3 inline-flex h-11 items-center rounded-xl border border-line px-4 text-[14px] font-semibold">
        공부로
      </Link>
    </div>
  )
}

export default function VocabSessionScreen({ sessionId }: { sessionId: string }) {
  const deck = useVocabDeck(sessionId)
  const { setSession, clearFlash } = deck
  const onSession = useCallback((s: Parameters<typeof setSession>[0]) => setSession(s), [setSession])

  switch (deck.phase) {
    case 'loading':
      return (
        <div className="flex h-full min-h-0 flex-col bg-ground">
          <BackBar backHref="/study/today" backLabel="공부로" title="오늘의 단어" />
          <LoadingBlock />
        </div>
      )
    case 'notFound':
      return (
        <Frame>
          <Notice title="세트를 찾을 수 없어요." />
        </Frame>
      )
    case 'error':
      return (
        <Frame>
          <ErrorBlock message="세트를 불러오지 못했어요." onRetry={deck.reload} />
        </Frame>
      )
    case 'closed':
      return (
        <Frame>
          <Notice title="기록 없이 닫은 세트예요." body="답한 카드가 없어서 기록에 남지 않았어요. 공부 화면에서 새 세트를 시작할 수 있어요." />
        </Frame>
      )
    case 'result':
      return deck.session ? (
        <VocabResult
          session={deck.session}
          cards={deck.cards}
          finish={deck.finishResult}
          today={deck.today}
          flash={deck.flash}
          onFlashShown={clearFlash}
          onSession={onSession}
        />
      ) : null
    default:
      return <VocabDeck deck={deck} />
  }
}
