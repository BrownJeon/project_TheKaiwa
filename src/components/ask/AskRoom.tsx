'use client'

/**
 * 질문 방 `/ask/[chatId]`(task-064 §25-5). 채팅방(`ChatRoom`)과 같은 뼈대 — 셸 `main` 을 정확히 채우고 `MessageList` 만 스크롤된다.
 * 공용 부품을 질문 방 옵션으로 쓴다: 본문 분석 끔(예문 일본어 줄만 따로) · 목록 낭독 끔(도착은 한 줄 알림) · 표시 바 두 토글 ·
 * 한국어 입력 · ASK 안내 문구 · 실패 카드. 기다리는 동안 취소·나가기 버튼은 없다(D6) — 화면을 떠나도 서버가 답을 끝까지 만든다.
 * 3a 는 글자 질문만(마이크 없음, D13 A).
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AskScopeOption } from '@/types/ask'
import type { ChatDetail, ChatInfo, ChatKind, ChatMessageView, Paged, ProposalDto } from '@/types/chat'
import { apiGet } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { readStore, writeStore } from '@/components/common/storage'
import Toast, { useToast } from '@/components/common/Toast'
import { ErrorBlock, LoadingBlock } from '@/components/common/ui'
import { OFF, useAnnotations } from '@/components/common/japanese/annotations'
import { useDisplayPrefs } from '@/components/common/japanese/displayPrefs'
import { DisplayBar } from '@/components/common/japanese/JapaneseText'
import BackBar from '@/components/shell/BackBar'
import { forgetAskReturn } from '@/components/shell/askReturn'
import ChatMenuSheet from '@/components/chat/ChatMenuSheet'
import Composer, { type ComposerHandle } from '@/components/chat/Composer'
import { actionErrorText } from '@/components/chat/labels'
import MessageList, { type MessageListHandle } from '@/components/chat/MessageList'
import { endsWithUnfinishedReply, prependMessages, turnBaseOf } from '@/components/chat/messages'
import TurnNotice from '@/components/chat/TurnNotice'
import { useChatTurn, type SendOptions } from '@/components/chat/useChatTurn'
import AskAnswer, { answerProposals } from './AskAnswer'
import AskExamples from './AskExamples'
import AskFailed from './AskFailed'
import AskPending from './AskPending'
import AskQuestionBubble from './AskQuestionBubble'
import { exampleJaLines, parseAnswerMd } from './answerMd'
import { ASK_COPY } from './askCopy'
import { addId, ASK_KEYS, askNoticeText, askOf, askPendingSince, askReplyFromDone, removeId, scopeSheetRestoreText, teacherTitle } from './logic'
import ScopeNoticeSheet, { type ScopeNoticeMode } from './ScopeNoticeSheet'
import { useScopeNoticeGate } from './useScopeNoticeGate'

type LoadState = 'loading' | 'ready' | 'notFound' | 'error'

/** 메뉴 줄(ChatMenuSheet 의 줄과 같은 모양 — 회화방 메뉴 확장과 같은 관례로 이 파일에 둔다). */
const MENU_ROW = 'flex h-[52px] w-full min-w-0 items-center justify-between gap-3 rounded-xl px-1 text-left text-[15px]'

// ── 순수 도우미(시험 대상) ──────────────────────────────────────────────────────

/** 입력 바 안내 — [직접 쓸게요] 뒤 > 답을 기다리는 중 > 기본(§25-5 A). */
export function askPlaceholder({ scopeOwn, busy }: { scopeOwn: boolean; busy: boolean }): string {
  if (scopeOwn) return ASK_COPY.placeholderScopeOwn
  return busy ? ASK_COPY.placeholderWaiting : ASK_COPY.placeholder
}

/** 도착 알림 한 줄(§25-9) — 근거·제안 수(0 은 뺌). */
export function askArrivalText(title: string, m: ChatMessageView, proposals: readonly ProposalDto[]): string {
  return ASK_COPY.arrivedLive(title, askOf(m)?.sources.length ?? 0, answerProposals(proposals, m.id).length)
}

/** 히라가나·한글 분석을 요청할 글 — 끝난 선생님 답의 예문 일본어 줄만(답 전문은 보내지 않는다, §25-6 E). */
export function exampleTexts(messages: readonly ChatMessageView[]): string[] {
  const out = new Set<string>()
  for (const m of messages) {
    if (m.role !== 'ASSISTANT' || m.status !== 'DONE') continue
    for (const ja of exampleJaLines(parseAnswerMd(m.content))) out.add(ja)
  }
  return [...out]
}

/** 목록이 남긴 첫 질문(§25-4 E 5) — 키는 늘 먼저 지우고(새로고침 두 번 보내기 방지), 대화가 비었을 때만 글을 돌려준다. */
export function takeAskHandoff(chatId: string, messageCount: number): string | null {
  const key = ASK_KEYS.pending(chatId)
  const raw = readStore('session', key)
  if (raw === null) return null
  writeStore('session', key, null)
  return messageCount === 0 && raw.trim() !== '' ? raw : null
}

/** 질문 방이 아닌 대화를 질문 주소로 연 경우 제자리 주소. */
export function askRoomRedirect(kind: ChatKind, chatId: string): string | null {
  const id = encodeURIComponent(chatId)
  if (kind === 'TALK') return `/study/ai/talk/${id}`
  if (kind === 'CHAT') return `/study/ai/chat/${id}`
  return null
}

function upsertProposals(prev: ProposalDto[], next: ProposalDto[]): ProposalDto[] {
  const byId = new Map(prev.map((p) => [p.id, p]))
  for (const p of next) byId.set(p.id, { ...byId.get(p.id), ...p })
  return Array.from(byId.values())
}

/** 시트가 닫히며 초점을 돌려준 뒤에 실행(같은 커밋 안에서 옮긴 초점은 닫히는 시트·사라지는 칩에 씻겨 나간다). */
function afterCommit(fn: () => void) {
  if (typeof window === 'undefined') return
  window.requestAnimationFrame(() => window.setTimeout(fn, 0))
}

interface PendingSend {
  text: string
  opts?: SendOptions
  /** 입력 바에서 보낸 글 — 안내에서 [취소]하면 입력 바로 돌려준다 */
  fromComposer: boolean
}

export default function AskRoom({ chatId, teacherName }: { chatId: string; teacherName: string }) {
  const [load, setLoad] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)
  const [chat, setChat] = useState<ChatInfo | null>(null)
  const [messages, setMessages] = useState<ChatMessageView[]>([])
  const [olderCursor, setOlderCursor] = useState<string | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [proposals, setProposals] = useState<ProposalDto[] | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scopeSheet, setScopeSheet] = useState<ScopeNoticeMode | null>(null)
  const [scopeOwn, setScopeOwn] = useState(false)
  const [arrivedId, setArrivedId] = useState<string | null>(null)
  const toast = useToast()
  const router = useRouter()
  const gate = useScopeNoticeGate()
  useDisplayPrefs()
  const title = teacherTitle(teacherName)

  const composerRef = useRef<ComposerHandle | null>(null)
  const listRef = useRef<MessageListHandle | null>(null)
  const messagesRef = useRef<ChatMessageView[]>(messages)
  const pendingSendRef = useRef<PendingSend | null>(null)
  const handoffRef = useRef<string | null>(null)
  const busyRef = useRef(false)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const reloadProposals = useCallback(() => {
    apiGet<Paged<ProposalDto>>(`/api/v1/proposals?chatId=${encodeURIComponent(chatId)}`)
      .then((r) => setProposals(r.items))
      .catch(() => {
        /* 제안은 부가 정보 — 실패해도 질문은 계속된다 */
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
    toReply: askReplyFromDone,
    onSettled: (kind, aid) => {
      if (kind === 'done' && aid) setArrivedId(aid)
    },
  })
  const { attach, markFailed, send } = turn
  const turnBusy = turn.phase === 'sending' || turn.phase === 'streaming' || turn.phase === 'detached'

  // 방에 들어오면: 근거에서 돌아오기 기록은 쓸모가 끝나고, 목록의 「답 만드는 중·새 답」 표지도 지운다.
  // 떠날 때 답을 기다리던 중이면 목록이 「새 답」을 붙일 수 있게 적어 둔다(§25-4 D).
  useEffect(() => {
    forgetAskReturn()
    removeId(ASK_KEYS.waiting, chatId)
    removeId(ASK_KEYS.newAnswer, chatId)
    const busy = busyRef
    return () => {
      if (busy.current) addId(ASK_KEYS.waiting, chatId)
    }
  }, [chatId])
  useEffect(() => {
    busyRef.current = turnBusy
  }, [turnBusy])

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
        const elsewhere = askRoomRedirect(detail.chat.kind, chatId)
        if (elsewhere) {
          router.replace(elsewhere)
          return
        }
        setChat(detail.chat)
        setMessages(detail.messages)
        messagesRef.current = detail.messages
        setOlderCursor(detail.nextCursor)
        if (props) setProposals(props.items)
        handoffRef.current = takeAskHandoff(chatId, detail.messages.length)
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

  // 목록이 넘긴 첫 질문은 입력 바가 그려진 뒤 보낸다 — 거절(429·409·네트워크)되면 글이 입력 바로 돌아와야 한다.
  // 목록에서 이미 보내는 범위를 확인했으므로 관문을 다시 거치지 않는다.
  useEffect(() => {
    if (load !== 'ready' || handoffRef.current === null) return
    const text = handoffRef.current
    handoffRef.current = null
    listRef.current?.scrollToBottom()
    void send(text)
  }, [load, send])

  const exTexts = exampleTexts(messages)
  const exStates = useAnnotations(exTexts)
  const exAnn = new Map(exTexts.map((t, i) => [t, exStates[i]]))
  const annOf = (ja: string) => exAnn.get(ja) ?? OFF

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

  const doSend = (p: PendingSend) => {
    listRef.current?.scrollToBottom()
    setScopeOwn(false)
    setArrivedId(null)
    void send(p.text, p.opts)
    if (!p.fromComposer) afterCommit(() => listRef.current?.focusList())
  }

  /** 보내는 범위 관문(D2) — 처음이면 시트를 띄우고 이 보내기 하나만 들고 있다가 [알겠어요, 보내기]에서 잇는다. */
  const gatedSend = (p: PendingSend) => {
    if (gate.acknowledged === true) {
      doSend(p)
      return
    }
    pendingSendRef.current = p
    setScopeSheet('first')
  }

  const pickScope = (o: AskScopeOption) => {
    if (turn.isBusy()) {
      toast.show(ASK_COPY.sendLocked)
      return
    }
    const left = turn.blockedUntil ? Math.ceil((turn.blockedUntil - Date.now()) / 1000) : 0
    if (left > 0) {
      toast.show(askNoticeText(turn.notice ?? { kind: 'rate', text: '' }, left))
      return
    }
    gatedSend({ text: o.label, opts: { scope: { key: o.key } }, fromComposer: false })
  }

  const closeScopeSheet = () => {
    const restore = scopeSheetRestoreText(pendingSendRef.current)
    pendingSendRef.current = null
    setScopeSheet(null)
    if (restore !== null) composerRef.current?.restore(restore)
  }

  const backBar = <BackBar backHref="/ask" backLabel={ASK_COPY.backLabel} title={ASK_COPY.roomLoadingTitle} />

  if (load === 'loading') {
    return (
      <div className="flex h-full min-h-0 flex-col bg-ground">
        {backBar}
        <LoadingBlock />
      </div>
    )
  }
  if (load === 'notFound' || load === 'error' || !chat) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-ground">
        {backBar}
        <div className="px-4 pt-6 [&_button]:min-h-11">
          {load === 'error' ? (
            <ErrorBlock
              message={ASK_COPY.loadError}
              onRetry={() => {
                setLoad('loading')
                setAttempt((n) => n + 1)
              }}
            />
          ) : (
            <div role="alert" className="flex flex-col rounded-[14px] border border-line bg-surface p-4">
              <p className="text-[16px] font-semibold break-keep">{ASK_COPY.notFoundTitle}</p>
              <p className="mt-1 text-[14px] text-ink2 break-keep">{ASK_COPY.notFoundBody}</p>
              <Link href="/ask" className="mt-3 inline-flex h-11 items-center self-start rounded-xl border border-line px-4 text-[14px] font-semibold">
                {ASK_COPY.toList}
              </Link>
            </div>
          )}
        </div>
      </div>
    )
  }

  const idle = turn.phase === 'idle' || turn.phase === 'failed'
  const list = proposals ?? []
  const since = askPendingSince(turn.phase, turn.startedAt, messages)
  const pending = <AskPending teacherName={teacherName} title={title} stage={turn.stage} phase={turn.phase} since={since} />
  const arrived = arrivedId ? messages.find((m) => m.id === arrivedId && m.status === 'DONE') : undefined
  const arrivalLive = arrived ? askArrivalText(title, arrived, list) : ''

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col bg-ground">
      <BackBar
        backHref="/ask"
        backLabel={ASK_COPY.backLabel}
        title={chat.title}
        subtitle={ASK_COPY.subtitle(title)}
        right={
          <button
            type="button"
            aria-label={ASK_COPY.menuAria}
            onClick={() => setMenuOpen(true)}
            className="grid h-11 w-11 flex-none place-items-center rounded-full text-[20px] leading-none text-ink"
          >
            <span aria-hidden="true">⋯</span>
          </button>
        }
      />
      <DisplayBar keys={['fu', 'hg']} onToast={toast.show} />
      <MessageList
        chatId={chatId}
        messages={messages}
        proposals={list}
        teacherName={teacherName}
        turn={turn}
        hasOlder={!!olderCursor}
        loadingOlder={loadingOlder}
        onLoadOlder={() => void loadOlder()}
        onPick={(text) => composerRef.current?.fill(text)}
        onProposalChange={(p) => setProposals((prev) => upsertProposals(prev ?? [], [p]))}
        onToast={toast.show}
        handleRef={listRef}
        liveOff
        annotate={false}
        focusable
        followContent
        arrivalAlign="answer-start"
        pillLabel={ASK_COPY.newAnswer}
        renderUser={(m, ctx) => <AskQuestionBubble m={m} showTime={ctx.groupEnd} />}
        renderTutor={(m, ctx) => (
          <AskAnswer
            m={m}
            isLast={ctx.isLast}
            idle={idle}
            chatId={chatId}
            teacherName={teacherName}
            title={title}
            proposals={list}
            annOf={annOf}
            onPickScope={pickScope}
            onOwnScope={() => {
              setScopeOwn(true)
              composerRef.current?.focus()
            }}
            onProposalChange={(p) => setProposals((prev) => upsertProposals(prev ?? [], [p]))}
            onToast={toast.show}
          />
        )}
        renderPending={() => pending}
        renderTrailingPending={() => pending}
        renderFailed={(m, ctx, view) => <AskFailed teacherName={teacherName} title={title} failure={view.failure} busy={view.busy} onRetry={view.onRetry} />}
        intro={<AskExamples mode="row" onPick={(text) => composerRef.current?.fill(text)} />}
      />
      <p role="status" className="sr-only">
        {arrivalLive}
      </p>
      {turn.notice ? (
        <TurnNotice
          notice={turn.notice}
          blockedUntil={turn.blockedUntil}
          onClose={turn.clearNotice}
          textOf={askNoticeText}
          notFoundLink={{ href: '/ask', label: ASK_COPY.toList }}
        />
      ) : null}
      <Composer
        chatId={chatId}
        lang="ko"
        inputLabel={ASK_COPY.inputLabel}
        busy={turnBusy}
        busyReason={ASK_COPY.sendLocked}
        blockedUntil={turn.blockedUntil}
        placeholder={askPlaceholder({ scopeOwn, busy: turnBusy })}
        onSend={(text) => gatedSend({ text, fromComposer: true })}
        onBlocked={toast.show}
        handleRef={composerRef}
      />
      <ChatMenuSheet
        open={menuOpen}
        chat={chat}
        turnBusy={turnBusy}
        onClose={() => setMenuOpen(false)}
        onRenamed={(t) => setChat((c) => (c ? { ...c, title: t } : c))}
        onToast={toast.show}
        extra={
          <button
            type="button"
            className={MENU_ROW}
            onClick={() => {
              // 메뉴를 먼저 닫아 초점이 ⋯ 로 돌아간 뒤 연다 — 두 시트를 겹치지 않고, 닫으면 초점이 다시 ⋯ 로.
              setMenuOpen(false)
              afterCommit(() => setScopeSheet('again'))
            }}
          >
            {ASK_COPY.menu.scope} <span aria-hidden="true" className="text-ink2">›</span>
          </button>
        }
      />
      <ScopeNoticeSheet
        open={scopeSheet !== null}
        mode={scopeSheet ?? 'first'}
        onConfirm={() => {
          gate.ack()
          const p = pendingSendRef.current
          pendingSendRef.current = null
          setScopeSheet(null)
          if (p) doSend(p)
        }}
        onClose={closeScopeSheet}
      />
      <Toast message={toast.message} />
    </div>
  )
}
