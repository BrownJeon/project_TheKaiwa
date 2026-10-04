'use client'

/**
 * 채팅방 `/study/ai/chat/[chatId]`(screens.md §3-2 C). 앱 셸 `main` 을 **정확히 100%** 채워 `main` 은 스크롤되지 않고
 * `MessageList` 만 스크롤된다(화면당 스크롤 1곳). 하단 탭은 숨김(TabBar), 머리는 `BackBar`.
 *
 * 첫 로드는 #29 `?limit=50`(최근 50개, 오름차순 — D2) + #37 `?chatId=`(단어 제안을 말풍선에 붙인다).
 * 서버가 아직 답하는 중이면 곧바로 폴링, 마지막 강사 답이 실패면 [다시 받기] 상태로 시작한다(자동 재시도 없음).
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet } from '@/components/common/api'
import { readStore, writeStore } from '@/components/common/storage'
import Toast, { useToast } from '@/components/common/Toast'
import { ErrorBlock, LoadingBlock } from '@/components/common/ui'
import { useDisplayPrefs } from '@/components/common/japanese/displayPrefs'
import { DisplayBar } from '@/components/common/japanese/JapaneseText'
import BackBar from '@/components/shell/BackBar'
import type { ChatDetail, ChatInfo, ChatMessageView, Paged, ProposalDto } from '@/types/chat'
import ChatMenuSheet from './ChatMenuSheet'
import ChatRoomHeader from './ChatRoomHeader'
import Composer, { type ComposerHandle } from './Composer'
import { toErr } from '@/components/common/errors'
import { actionErrorText } from './labels'
import MessageList, { type MessageListHandle } from './MessageList'
import { endsWithUnfinishedReply, pendingCorrectionCount, prependMessages, turnBaseOf, userMessageCount, withUserTranslation } from './messages'
import ReviewDoneBar from './ReviewDoneBar'
import ReviewNudge from './ReviewNudge'
import { KEYS } from './storageKeys'
import TurnNotice from './TurnNotice'
import { useChatTurn } from './useChatTurn'

type LoadState = 'loading' | 'ready' | 'notFound' | 'error'

const NUDGE_USER_MESSAGES = 5

function upsertProposals(prev: ProposalDto[], next: ProposalDto[]): ProposalDto[] {
  const byId = new Map(prev.map((p) => [p.id, p]))
  for (const p of next) byId.set(p.id, { ...byId.get(p.id), ...p })
  return Array.from(byId.values())
}

export default function ChatRoom({ chatId, teacherName }: { chatId: string; teacherName: string }) {
  const [load, setLoad] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)
  const [chat, setChat] = useState<ChatInfo | null>(null)
  const [messages, setMessages] = useState<ChatMessageView[]>([])
  const [olderCursor, setOlderCursor] = useState<string | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [proposals, setProposals] = useState<ProposalDto[] | null>(null)
  const [serverPendingProposals, setServerPendingProposals] = useState(0)
  // 첫 렌더는 늘 'loading'(말풍선 없음)이라 저장소 값을 초기값으로 읽어도 서버 렌더와 어긋나지 않는다.
  const [nudgeDismissed, setNudgeDismissed] = useState(() => readStore('session', KEYS.nudge(chatId)) === '1')
  const [menuOpen, setMenuOpen] = useState(false)
  const toast = useToast()
  const router = useRouter()
  // 표시 설정(task-026)을 대화와 같이 읽기 시작한다 — 말풍선이 그려진 뒤 층 자리가 늦게 생겨 바닥이 밀리지 않게.
  useDisplayPrefs()

  const composerRef = useRef<ComposerHandle | null>(null)
  const listRef = useRef<MessageListHandle | null>(null)
  const messagesRef = useRef<ChatMessageView[]>(messages)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const reloadProposals = useCallback(() => {
    apiGet<Paged<ProposalDto>>(`/api/v1/proposals?chatId=${encodeURIComponent(chatId)}`)
      .then((r) => setProposals(r.items))
      .catch(() => {
        /* 제안은 부가 정보 — 실패해도 대화는 계속된다 */
      })
  }, [chatId])

  const turn = useChatTurn({
    chatId,
    getMessages: () => messagesRef.current,
    setMessages,
    patchChat: (fn) => setChat((c) => (c ? fn(c) : c)),
    addProposals: (ps) => setProposals((prev) => upsertProposals(prev ?? [], ps)),
    reloadProposals,
    restoreText: (text) => composerRef.current?.restore(text),
    onNotFound: () => setLoad('notFound'),
  })
  const { attach, markFailed } = turn

  useEffect(() => {
    let cancelled = false
    const base = `/api/v1/chats/${encodeURIComponent(chatId)}`
    void (async () => {
      try {
        const [detail, props] = await Promise.all([
          apiGet<ChatDetail>(`${base}?limit=50`),
          apiGet<Paged<ProposalDto>>(`/api/v1/proposals?chatId=${encodeURIComponent(chatId)}`).catch(() => null),
        ])
        if (cancelled) return
        // 음성 회화는 회화방에서 연다(목록 밖 링크·북마크 대비, task-007 §9-3 H).
        if (detail.chat.kind === 'TALK') {
          router.replace(`/study/ai/talk/${encodeURIComponent(chatId)}`)
          return
        }
        setChat(detail.chat)
        setMessages(detail.messages)
        messagesRef.current = detail.messages
        setOlderCursor(detail.nextCursor)
        setServerPendingProposals(detail.pendingProposals ?? 0)
        if (props) setProposals(props.items)
        setLoad('ready')
        if (detail.chat.running) attach(turnBaseOf(detail.messages))
        else if (endsWithUnfinishedReply(detail.messages)) markFailed()
      } catch (e) {
        if (cancelled) return
        setLoad(toErr(e).status === 404 ? 'notFound' : 'error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [chatId, attempt, attach, markFailed, router])

  const loadOlder = async () => {
    if (!olderCursor || loadingOlder) return
    setLoadingOlder(true)
    try {
      const r = await apiGet<ChatDetail>(`/api/v1/chats/${encodeURIComponent(chatId)}?cursor=${encodeURIComponent(olderCursor)}&limit=50`)
      setMessages((ms) => prependMessages(ms, r.messages))
      setOlderCursor(r.nextCursor)
    } catch (e) {
      toast.show(actionErrorText(toErr(e)))
    } finally {
      setLoadingOlder(false)
    }
  }

  const backBar = <BackBar backHref="/study/ai?tab=chat" backLabel="채팅 목록으로" title="채팅" />

  if (load === 'loading') {
    return (
      <div className="flex h-full min-h-0 flex-col bg-ground">
        {backBar}
        <LoadingBlock />
      </div>
    )
  }
  if (load === 'notFound' || !chat) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-ground">
        {backBar}
        <div className="px-4 pt-6">
          {load === 'error' ? (
            <ErrorBlock
              message="채팅을 불러오지 못했어요."
              onRetry={() => {
                setLoad('loading')
                setAttempt((n) => n + 1)
              }}
            />
          ) : (
            <div role="alert" className="rounded-[14px] border border-line bg-surface p-4">
              <p className="text-[15px] font-semibold break-keep">채팅을 찾을 수 없어요. 삭제되었을 수 있어요.</p>
              <Link href="/study/ai?tab=chat" className="mt-3 inline-flex h-11 items-center rounded-xl border border-line px-4 text-[14px] font-semibold">
                채팅 목록으로
              </Link>
            </div>
          )}
        </div>
      </div>
    )
  }

  const turnBusy = turn.phase === 'sending' || turn.phase === 'streaming' || turn.phase === 'detached'
  const userCount = userMessageCount(messages)
  const remaining = pendingCorrectionCount(messages)
  const pendingProposals = proposals ? proposals.filter((p) => p.status === 'PROPOSED').length : serverPendingProposals
  const showNudge =
    !chat.reviewedAt && turn.phase === 'idle' && !nudgeDismissed && (userCount >= NUDGE_USER_MESSAGES || turn.endOfTopic)
  const placeholder = chat.reviewedAt ? '계속 대화할 수 있어요 (새 메시지는 점검되지 않아요)' : '일본어로 써 보세요'

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-ground">
      <ChatRoomHeader
        chatId={chatId}
        title={chat.title}
        teacherName={teacherName}
        reviewed={!!chat.reviewedAt}
        turnBusy={turnBusy}
        userMessageCount={userCount}
        onMenu={() => setMenuOpen(true)}
        onToast={toast.show}
      />
      <DisplayBar onToast={toast.show} />
      {chat.reviewedAt ? <ReviewDoneBar chatId={chatId} remaining={remaining} pendingProposals={pendingProposals} /> : null}
      <MessageList
        chatId={chatId}
        messages={messages}
        proposals={proposals ?? []}
        teacherName={teacherName}
        turn={turn}
        hasOlder={!!olderCursor}
        loadingOlder={loadingOlder}
        onLoadOlder={() => void loadOlder()}
        onPick={(text) => composerRef.current?.fill(text)}
        onProposalChange={(p) => setProposals((prev) => upsertProposals(prev ?? [], [p]))}
        onToast={toast.show}
        handleRef={listRef}
        followContent
        onUserTranslated={(id, text) => setMessages((ms) => withUserTranslation(ms, id, text))}
      />
      {showNudge ? (
        <ReviewNudge
          chatId={chatId}
          onDismiss={() => {
            setNudgeDismissed(true)
            writeStore('session', KEYS.nudge(chatId), '1')
          }}
        />
      ) : null}
      {turn.notice ? <TurnNotice notice={turn.notice} blockedUntil={turn.blockedUntil} onClose={turn.clearNotice} /> : null}
      <Composer
        chatId={chatId}
        busy={turnBusy}
        blockedUntil={turn.blockedUntil}
        placeholder={placeholder}
        onSend={(text) => {
          listRef.current?.scrollToBottom()
          void turn.send(text)
        }}
        onBlocked={toast.show}
        handleRef={composerRef}
      />
      <ChatMenuSheet
        open={menuOpen}
        chat={chat}
        turnBusy={turnBusy}
        onClose={() => setMenuOpen(false)}
        onRenamed={(title) => setChat((c) => (c ? { ...c, title } : c))}
        onToast={toast.show}
      />
      <Toast message={toast.message} />
    </div>
  )
}
