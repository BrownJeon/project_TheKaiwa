'use client'

/**
 * AI와 공부하기 홈 `/study/ai?tab=talk|scenario|chat`(screens.md §3-2 A·§9-2 A). 전환은 `router.replace`(기록을 쌓지 않음).
 * 기본 탭은 회화(talk) — 새 회화 · 채택을 기다리는 교정 · 회화 목록. 시나리오(task-010d D-1 A)는 상황 역할극 홈(`?sc=` 시트 딥링크).
 */
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import Segmented from '@/components/common/Segmented'
import { Btn } from '@/components/common/ui'
import ChatList from './ChatList'
import NewChatSheet from './NewChatSheet'
import PendingCorrectionsCard from './PendingCorrectionsCard'
import { LIST_HOLD_CAP_MS, shouldHoldCard, shouldHoldList } from './listHold'
import ScenarioHome from '@/components/scenario/ScenarioHome'
import { newButtonLabel, STUDY_AI_TABS, type StudyAiTab } from './studyAiTabs'

type Tab = StudyAiTab

/**
 * 회화·채팅 탭의 본문 — [새로] · 채택을 기다리는 교정 · 목록. 교정 카드와 목록은 별도 요청이라 한쪽이 먼저 그려지면
 * 다른 쪽 때문에 밀리므로, 둘 다 끝난 뒤(또는 카드 상한 `LIST_HOLD_CAP_MS` 뒤) 한 번에 그린다(`listHold.ts`).
 * 이 판단 상태는 탭 홈에 들어올 때마다(시나리오에서 돌아올 때 포함) 새로 시작하고, 회화↔채팅 전환에서는 이어진다.
 */
function TalkChatPanel({ tab, onNew }: { tab: 'talk' | 'chat'; onNew: () => void }) {
  const [cardSettled, setCardSettled] = useState(false)
  const [listSettled, setListSettled] = useState(false)
  const [capElapsed, setCapElapsed] = useState(false)
  const markCardSettled = useCallback(() => setCardSettled(true), [])
  const markListSettled = useCallback(() => setListSettled(true), [])

  useEffect(() => {
    const t = setTimeout(() => setCapElapsed(true), LIST_HOLD_CAP_MS)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <Btn className="mt-3.5 w-full" onClick={onNew}>
        {newButtonLabel(tab)}
      </Btn>
      <PendingCorrectionsCard onSettled={markCardSettled} hold={shouldHoldCard(listSettled)} />
      <ChatList kind={tab === 'talk' ? 'TALK' : 'CHAT'} onNew={onNew} onSettled={markListSettled} hold={shouldHoldList(cardSettled, capElapsed)} />
    </>
  )
}

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
      <Segmented<Tab> ariaLabel="공부 방식" options={STUDY_AI_TABS} value={tab} onChange={change} />
      {tab === 'scenario' ? (
        <ScenarioHome initialSheetId={initialSheetId} saved={saved} />
      ) : (
        <TalkChatPanel tab={tab} onNew={() => setSheetOpen(true)} />
      )}
      <NewChatSheet open={sheetOpen && tab !== 'scenario'} kind={tab === 'chat' ? 'CHAT' : 'TALK'} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
