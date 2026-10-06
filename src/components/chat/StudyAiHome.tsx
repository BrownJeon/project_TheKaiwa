'use client'

/**
 * AI와 공부하기 홈 `/study/ai?tab=talk|scenario|chat`(screens.md §3-2 A·§9-2 A). 전환은 `router.replace`(기록을 쌓지 않음).
 * 기본 탭은 회화(talk) — 새 회화 · 채택을 기다리는 교정 · 회화 목록. 시나리오(task-010d D-1 A)는 상황 역할극 홈(`?sc=` 시트 딥링크).
 */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Segmented from '@/components/common/Segmented'
import { Btn } from '@/components/common/ui'
import ChatList from './ChatList'
import NewChatSheet from './NewChatSheet'
import PendingCorrectionsCard from './PendingCorrectionsCard'
import { TALK_HOME } from '@/components/talk/talkCopy'
import ScenarioHome from '@/components/scenario/ScenarioHome'

type Tab = 'chat' | 'talk' | 'scenario'

const TABS = [
  { value: 'talk', label: '회화' },
  { value: 'scenario', label: '시나리오' },
  { value: 'chat', label: '채팅' },
] as const

export default function StudyAiHome({ initialTab, initialSheetId = null, saved = false }: { initialTab: Tab; initialSheetId?: string | null; saved?: boolean }) {
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
      {tab === 'scenario' ? (
        <ScenarioHome initialSheetId={initialSheetId} saved={saved} />
      ) : tab === 'talk' ? (
        <>
          <Btn className="mt-3.5 w-full" onClick={() => setSheetOpen(true)}>
            {TALK_HOME.newTalk}
          </Btn>
          <PendingCorrectionsCard />
          <ChatList kind="TALK" onNew={() => setSheetOpen(true)} />
        </>
      ) : (
        <>
          <Btn className="mt-3.5 w-full" onClick={() => setSheetOpen(true)}>
            ＋ 새 채팅
          </Btn>
          <PendingCorrectionsCard />
          <ChatList kind="CHAT" onNew={() => setSheetOpen(true)} />
        </>
      )}
      <NewChatSheet open={sheetOpen && tab !== 'scenario'} kind={tab === 'chat' ? 'CHAT' : 'TALK'} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
