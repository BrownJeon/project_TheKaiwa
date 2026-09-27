'use client'

/**
 * AI와 공부하기 홈 `/study/ai?tab=chat|talk`(screens.md §3-2 A). 전환은 `router.replace`(기록을 쌓지 않음).
 * 음성 회화 탭은 회화방이 열리기 전까지 안내만 보인다.
 */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Segmented from '@/components/common/Segmented'
import { Btn } from '@/components/common/ui'
import ChatList from './ChatList'
import NewChatSheet from './NewChatSheet'
import PendingCorrectionsCard from './PendingCorrectionsCard'
import TalkComingSoon from './TalkComingSoon'

type Tab = 'chat' | 'talk'

const TABS = [
  { value: 'talk', label: '회화' },
  { value: 'chat', label: '채팅' },
] as const

export default function StudyAiHome({ initialTab }: { initialTab: Tab }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [sheetOpen, setSheetOpen] = useState(false)

  const change = (v: Tab) => {
    setTab(v)
    router.replace(`/study/ai?tab=${v}`, { scroll: false })
  }

  return (
    <div className="px-4 pb-8">
      <Segmented<Tab> ariaLabel="공부 방식" options={TABS} value={tab} onChange={change} />
      {tab === 'talk' ? (
        <TalkComingSoon onGoChat={() => change('chat')} />
      ) : (
        <>
          <Btn className="mt-3.5 w-full" onClick={() => setSheetOpen(true)}>
            ＋ 새 채팅
          </Btn>
          <PendingCorrectionsCard />
          <ChatList kind="CHAT" onNew={() => setSheetOpen(true)} />
        </>
      )}
      <NewChatSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
