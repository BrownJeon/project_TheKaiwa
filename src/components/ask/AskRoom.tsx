'use client'

/**
 * 질문 대화 화면(task-064 §25-5 → task-066 §26-5 B). 두 변형:
 * - `tab`  = `/ask?chat=<id>` — 탭 화면의 지금 대화. 머리 `AppBar`(「지난 질문」 알약 · ⋯), 하단 탭 보임. 첫 질문 직후엔 `seed` 로 #29 없이 바로 보낸다.
 * - `room` = `/ask/<id>` — 「지난 질문」에서 연 지난 대화. 머리 `BackBar`(‹ 질문으로), 하단 탭 숨김.
 * 공용 부품을 질문 옵션으로 쓴다: 본문 분석 끔(예문·말로 물은 일본어만 따로) · 목록 낭독 끔(도착은 한 줄 알림) · 한국어 입력 · ASK 안내 문구 · 실패 카드.
 * **보내기 전 확인 창이 없다**(사용자 요청 — 보내는 범위는 입력 바 아래 정보 줄·시트뿐). 표시 바도 없다(D8 — ⋯ 메뉴로).
 * 기다리는 동안 취소·나가기 버튼은 없다(D6) — 화면을 떠나도 서버가 답을 끝까지 만든다.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { AskScopeOption } from '@/types/ask'
import type { ChatDetail, ChatInfo, ChatKind, ChatMessageView, Paged, ProposalDto } from '@/types/chat'
import { apiGet } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import Toast, { useToast } from '@/components/common/Toast'
import { ErrorBlock, LoadingBlock } from '@/components/common/ui'
import { OFF, useAnnotations } from '@/components/common/japanese/annotations'
import { useDisplayPrefs } from '@/components/common/japanese/displayPrefs'
import { DisplayToggles } from '@/components/common/japanese/JapaneseText'
import AppBar from '@/components/shell/AppBar'
import BackBar from '@/components/shell/BackBar'
import { forgetAskReturn } from '@/components/shell/askReturn'
import ChatMenuSheet from '@/components/chat/ChatMenuSheet'
import { actionErrorText } from '@/components/chat/labels'
import MessageList, { type MessageListHandle } from '@/components/chat/MessageList'
import { endsWithUnfinishedReply, prependMessages, turnBaseOf } from '@/components/chat/messages'
import { useChatTurn, type SendOptions } from '@/components/chat/useChatTurn'
import SttRouteRow from '@/components/talk/SttRouteRow'
import { isNativeApp } from '@/modules/infra/native'
import type { SttRoute } from '@/modules/speech/stt/client'
import AskAnswer, { answerProposals } from './AskAnswer'
import AskFailed from './AskFailed'
import AskGreeting from './AskGreeting'
import AskPending from './AskPending'
import AskQuestionBubble from './AskQuestionBubble'
import { exampleJaLines, parseAnswerMd } from './answerMd'
import { ASK_COPY } from './askCopy'
import { addId, ASK_KEYS, askChatHref, askNoticeText, askOf, askPendingSince, askReplyFromDone, askSendOptions, removeId, takeSeed, teacherTitle, type AskSeed, type AskVia } from './logic'
import ScopeLine from './ScopeLine'
import ScopeNoticeSheet from './ScopeNoticeSheet'
import { useAskInput, type AskInputApi } from './useAskInput'
import { lastUserVoiceId, voiceQuestionTexts } from './voiceBubble'

type LoadState = 'loading' | 'ready' | 'notFound' | 'error'
export type AskVariant = 'tab' | 'room'
export type ToastApi = { message: string | null; show: (msg: string, ms?: number) => void }

/** 메뉴 줄(ChatMenuSheet 의 줄과 같은 모양). */
export const MENU_ROW = 'flex h-[52px] w-full min-w-0 items-center justify-between gap-3 rounded-xl px-1 text-left text-[15px]'
/** 메뉴 머리 줄(데모 `.mhd`). */
export const MENU_HEAD = 'pt-3 pb-1 text-[12px] font-semibold text-ink2'

// ── 순수 도우미(시험 대상) ──────────────────────────────────────────────────────

/** 입력 바 안내 — [직접 쓸게요] 뒤 > 답을 기다리는 중 > 기본(§25-5 A·§26-6). */
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

/** 질문이 아닌 대화를 질문 주소로 연 경우 제자리 주소. */
export function askRoomRedirect(kind: ChatKind, chatId: string): string | null {
  const id = encodeURIComponent(chatId)
  if (kind === 'TALK') return `/study/ai/talk/${id}`
  if (kind === 'CHAT') return `/study/ai/chat/${id}`
  return null
}

/** 토스트 위치(§26-8 D) — 입력 묶음(바 + 범위 줄 36) 위 12px, 탭 화면은 키보드가 닫혀 있으면 하단 탭 72 를 더한다. */
export function askToastBottom(o: { mode: 'text' | 'voice'; variant: AskVariant; kbOpen: boolean }): number {
  return (o.mode === 'voice' ? 117 : 61) + 36 + 12 + (o.variant === 'tab' && !o.kbOpen ? 72 : 0)
}

const kbSubscribe = (fn: () => void) => {
  const mo = new MutationObserver(fn)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-kb'] })
  return () => mo.disconnect()
}

/** 키보드가 열려 있는지(`KeyboardInset` 이 문서 뿌리에 `data-kb="open"`). 서버·첫 수화는 false. */
export function useKbOpen(): boolean {
  return useSyncExternalStore(
    kbSubscribe,
    () => document.documentElement.dataset.kb === 'open',
    () => false,
  )
}

function upsertProposals(prev: ProposalDto[], next: ProposalDto[]): ProposalDto[] {
  const byId = new Map(prev.map((p) => [p.id, p]))
  for (const p of next) byId.set(p.id, { ...byId.get(p.id), ...p })
  return Array.from(byId.values())
}

/** 시트가 닫히며 초점을 돌려준 뒤에 실행(같은 커밋 안에서 옮긴 초점은 닫히는 시트·사라지는 칩에 씻겨 나간다). */
export function afterCommit(fn: () => void) {
  if (typeof window === 'undefined') return
  window.requestAnimationFrame(() => window.setTimeout(fn, 0))
}

// ── 머리 ⋯ · 메뉴 위쪽 줄(빈 대화 `AskNewConversation` 도 같은 것을 쓴다) ─────────────────

export function AskMenuButton({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" aria-label={ASK_COPY.menuAria} onClick={onClick} className="grid h-11 w-11 flex-none place-items-center rounded-full text-[20px] leading-none text-ink">
      <span aria-hidden="true">⋯</span>
    </button>
  )
}

/** 질문 메뉴 1~4 줄(§26-9) — 새 질문 시작(대화가 있을 때만) · 보내는 범위 보기 · 일본어 표시 · 알아듣는 곳(앱만). */
export function AskMenuTop({
  onNewQ,
  onScope,
  onToast,
  route,
}: {
  onNewQ?: () => void
  onScope: () => void
  onToast: (msg: string, ms?: number) => void
  route: SttRoute
}) {
  const [native] = useState(() => typeof window !== 'undefined' && isNativeApp())
  const M = ASK_COPY.menu
  return (
    <>
      {onNewQ ? (
        <button type="button" className={MENU_ROW} onClick={onNewQ}>
          {M.newQ} <span aria-hidden="true" className="text-ink2">›</span>
        </button>
      ) : null}
      <button type="button" className={MENU_ROW} onClick={onScope}>
        {M.scope} <span aria-hidden="true" className="text-ink2">›</span>
      </button>
      <div className="min-w-0 pb-2">
        <p className={MENU_HEAD}>{M.displayHead}</p>
        <DisplayToggles keys={['fu', 'hg']} onToast={onToast} />
      </div>
      {native && route.reason !== 'WEB' ? (
        <div className="min-w-0 pb-2">
          <p className={MENU_HEAD}>{M.voiceHead}</p>
          <SttRouteRow route={route} />
        </div>
      ) : null}
    </>
  )
}

/** `?chat=` 복원 중 목록 칸(데모 B·loading) — 회색 말풍선 4개. 머리·입력 묶음·범위 줄은 실제 요소. */
function ConvSkeleton() {
  const bar = 'rounded bg-surface2'
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden px-4 py-3">
      <p role="status" className="sr-only">
        {ASK_COPY.loadingConv}
      </p>
      <div aria-hidden="true" className="flex min-w-0 flex-col gap-3">
        <div className={`${bar} ml-auto h-11 w-[62%]`} />
        <div className={`${bar} h-[150px] w-full`} />
        <div className={`${bar} ml-auto h-11 w-[54%]`} />
        <div className={`${bar} h-[110px] w-full`} />
      </div>
    </div>
  )
}

export interface AskRoomProps {
  variant: AskVariant
  chatId: string
  teacherName: string
  /** 빈 대화에서 방금 만든 방 — 첫 전송을 한 번 한다(§26-3 C 5) */
  seed?: AskSeed | null
  /** 이 화면에서 만든 대화 — 첫 질문 위에 안내 말풍선을 남긴다(데모 C·chip) */
  greeting?: boolean
  /** 탭 머리 알약(`AskHistoryButton`) */
  pill?: React.ReactNode
  /** 화면 하나에 토스트 하나 — 탭 화면은 `AskChatTab` 의 것을 받는다 */
  toast?: ToastApi
  /** tab: 대화가 없음·남의 것·질문 아님 */
  onGone?: () => void
  /** tab: 그 밖 불러오기 오류 */
  onLoadFailed?: () => void
  /** tab: ⋯ 새 질문 시작 */
  onNewConversation?: () => void
}

export default function AskRoom({ variant, chatId, teacherName, seed = null, greeting = false, pill, toast: toastIn, onGone, onLoadFailed, onNewConversation }: AskRoomProps) {
  const fresh = !!seed && !seed.used
  const [load, setLoad] = useState<LoadState>(fresh ? 'ready' : 'loading')
  const [attempt, setAttempt] = useState(0)
  const [chat, setChat] = useState<ChatInfo | null>(fresh && seed ? seed.chat : null)
  const [messages, setMessages] = useState<ChatMessageView[]>([])
  const [olderCursor, setOlderCursor] = useState<string | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [proposals, setProposals] = useState<ProposalDto[] | null>(fresh ? [] : null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [scopeOwn, setScopeOwn] = useState(false)
  const [arrivedId, setArrivedId] = useState<string | null>(null)
  const ownToast = useToast()
  const toast = toastIn ?? ownToast
  const router = useRouter()
  const kbOpen = useKbOpen()
  useDisplayPrefs()
  const title = teacherTitle(teacherName)

  const listRef = useRef<MessageListHandle | null>(null)
  const messagesRef = useRef<ChatMessageView[]>(messages)
  const inputRef = useRef<AskInputApi | null>(null)
  const seedRef = useRef<AskSeed | null>(seed)
  const loadRef = useRef<LoadState>(load)
  const busyRef = useRef(false)
  const goneRef = useRef(onGone)
  const failedRef = useRef(onLoadFailed)
  useEffect(() => {
    messagesRef.current = messages
    loadRef.current = load
    goneRef.current = onGone
    failedRef.current = onLoadFailed
  })

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
    // 입력 묶음이 턴보다 뒤에 만들어지므로 ref 를 거친다(§26-14 B 7) — 글자는 입력창, 말은 「보내지 못한 말」 띠.
    restoreText: (text, info) => inputRef.current?.onRestore(text, info),
    onNotFound: () => {
      if (variant === 'tab') goneRef.current?.()
      else setLoad('notFound')
    },
    toReply: askReplyFromDone,
    onSettled: (kind, aid) => {
      if (kind === 'done' && aid) setArrivedId(aid)
    },
  })
  const { attach, markFailed, send } = turn
  const turnBusy = turn.phase === 'sending' || turn.phase === 'streaming' || turn.phase === 'detached'

  // 대화에 들어오면(두 변형 모두): 근거에서 돌아오기 기록은 쓸모가 끝나고, 알약·시트의 「답 만드는 중·새 답」 표지도 지운다.
  // 떠날 때 답을 기다리던 중이면 알약이 「새 답」을 붙일 수 있게 적어 둔다(§26-4 A).
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
    // 첫 전송은 한 번만(§26-13 ⑤) — 두 번째 실행(개발 모드 이중 마운트·빠른 재마운트)은 #29 로 읽어 진행 중 턴을 이어받는다.
    const s = seedRef.current
    if (takeSeed(s) && s) {
      listRef.current?.scrollToBottom()
      void send(s.text, askSendOptions(s.via))
      return
    }
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
          if (variant === 'tab') goneRef.current?.()
          else router.replace(elsewhere)
          return
        }
        setChat(detail.chat)
        setMessages(detail.messages)
        messagesRef.current = detail.messages
        setOlderCursor(detail.nextCursor)
        if (props) setProposals(props.items)
        setLoad('ready')
        if (detail.chat.running) attach(turnBaseOf(detail.messages))
        else if (endsWithUnfinishedReply(detail.messages)) markFailed()
      } catch (e) {
        if (cancelled) return
        const notFound = toErr(e).status === 404
        if (variant === 'tab') (notFound ? goneRef.current : failedRef.current)?.()
        else setLoad(notFound ? 'notFound' : 'error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [chatId, attempt, attach, markFailed, router, send, variant])

  const exTexts = exampleTexts(messages)
  const voiceTexts = voiceQuestionTexts(messages)
  const annTexts = [...new Set([...exTexts, ...voiceTexts])]
  const annStates = useAnnotations(annTexts)
  const annMap = new Map(annTexts.map((t, i) => [t, annStates[i]]))
  const annOf = (ja: string) => annMap.get(ja) ?? OFF
  const lastVoiceId = lastUserVoiceId(messages)

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

  /** 관문 없이 바로 보낸다(§26-5 B) — 말로 물은 질문은 `REALTIME_STT` 만, 발화 id 는 싣지 않는다. */
  const doSend = (text: string, via: AskVia, extra?: SendOptions) => {
    listRef.current?.scrollToBottom()
    setScopeOwn(false)
    setArrivedId(null)
    void send(text, { ...extra, ...askSendOptions(via) })
  }

  const loading = load !== 'ready'
  const input = useAskInput({
    draftKey: chatId,
    busy: turnBusy || loading,
    busyReason: loading ? ASK_COPY.loadingConv : ASK_COPY.sendLocked,
    voiceBusyText: loading ? ASK_COPY.loadingConv : undefined,
    isBusy: () => turn.isBusy() || loadRef.current !== 'ready',
    blockedUntil: turn.blockedUntil,
    notice: turn.notice,
    clearNotice: turn.clearNotice,
    placeholder: askPlaceholder({ scopeOwn, busy: turnBusy }),
    onSend: (text, via) => doSend(text, via),
    toast: toast.show,
  })
  useEffect(() => {
    inputRef.current = input
  })

  const pickChip = (q: string) => {
    if (input.sendChip(q)) afterCommit(() => listRef.current?.focusList())
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
    doSend(o.label, 'text', { scope: { key: o.key } })
    afterCommit(() => listRef.current?.focusList())
  }

  const newQ = () => {
    setMenuOpen(false)
    if (variant === 'tab' && onNewConversation) onNewConversation()
    else router.push('/ask')
  }
  const openScopeFromMenu = () => {
    // 메뉴를 먼저 닫아 초점이 ⋯ 로 돌아간 뒤 연다 — 두 시트를 겹치지 않고, 닫으면 초점이 다시 ⋯ 로.
    setMenuOpen(false)
    afterCommit(() => setScopeOpen(true))
  }

  const menuButton = <AskMenuButton onClick={() => setMenuOpen(true)} />
  const head =
    variant === 'tab' ? (
      <AppBar
        title={ASK_COPY.title}
        right={
          <>
            {pill}
            {menuButton}
          </>
        }
      />
    ) : (
      <BackBar
        backHref="/ask"
        backLabel={ASK_COPY.backLabel}
        title={chat?.title ?? ASK_COPY.roomLoadingTitle}
        subtitle={chat ? ASK_COPY.subtitle(title) : undefined}
        right={chat ? menuButton : undefined}
      />
    )
  const ownToastEl = toastIn ? null : <Toast message={toast.message} bottomPx={askToastBottom({ mode: input.mode, variant, kbOpen })} />
  const bottom = (
    <>
      {input.strip}
      {input.bar}
      <ScopeLine variant={variant} onOpen={() => setScopeOpen(true)} />
      <ScopeNoticeSheet open={scopeOpen} onClose={() => setScopeOpen(false)} />
      {ownToastEl}
    </>
  )

  if (variant === 'room' && load === 'loading') {
    return (
      <div className="flex h-full min-h-0 flex-col bg-ground">
        {head}
        <LoadingBlock />
      </div>
    )
  }
  if (variant === 'room' && (load === 'notFound' || load === 'error')) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-ground">
        {head}
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
  if (load !== 'ready' || !chat) {
    // tab 의 `?chat=` 복원 중(오류·없음은 `AskChatTab` 이 빈 대화로 바꾼다) — 입력창은 쓸 수 있고 보내기·누르고 말하기만 잠긴다.
    return (
      <div className="relative flex h-full min-h-0 min-w-0 flex-col bg-ground">
        {head}
        <ConvSkeleton />
        {bottom}
      </div>
    )
  }

  const idle = turn.phase === 'idle' || turn.phase === 'failed'
  const list = proposals ?? []
  const since = askPendingSince(turn.phase, turn.startedAt, messages)
  const pending = <AskPending teacherName={teacherName} title={title} stage={turn.stage} phase={turn.phase} since={since} />
  const arrived = arrivedId ? messages.find((m) => m.id === arrivedId && m.status === 'DONE') : undefined
  const arrivalLive = arrived ? askArrivalText(title, arrived, list) : ''
  const returnHref = variant === 'tab' ? askChatHref(chatId) : undefined

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col bg-ground">
      {head}
      <MessageList
        chatId={chatId}
        messages={messages}
        proposals={list}
        teacherName={teacherName}
        turn={turn}
        hasOlder={!!olderCursor}
        loadingOlder={loadingOlder}
        onLoadOlder={() => void loadOlder()}
        onPick={(text) => input.fill(text)}
        onProposalChange={(p) => setProposals((prev) => upsertProposals(prev ?? [], [p]))}
        onToast={toast.show}
        handleRef={listRef}
        liveOff
        annotate={false}
        focusable
        followContent
        arrivalAlign="answer-start"
        pillLabel={ASK_COPY.newAnswer}
        intro={<AskGreeting teacherName={teacherName} onPick={pickChip} />}
        lead={greeting ? <AskGreeting teacherName={teacherName} onPick={pickChip} /> : undefined}
        tail={input.tail ?? undefined}
        renderUser={(m, ctx) => <AskQuestionBubble m={m} showTime={ctx.groupEnd} canFix={m.id === lastVoiceId} onFix={input.fixAsk} ann={annOf} />}
        renderTutor={(m, ctx) => (
          <AskAnswer
            m={m}
            isLast={ctx.isLast}
            idle={idle}
            chatId={chatId}
            returnHref={returnHref}
            teacherName={teacherName}
            title={title}
            proposals={list}
            annOf={annOf}
            onPickScope={pickScope}
            onOwnScope={() => {
              setScopeOwn(true)
              input.focus()
            }}
            onProposalChange={(p) => setProposals((prev) => upsertProposals(prev ?? [], [p]))}
            onToast={toast.show}
          />
        )}
        renderPending={() => pending}
        renderTrailingPending={() => pending}
        renderFailed={(m, ctx, view) => <AskFailed teacherName={teacherName} title={title} failure={view.failure} busy={view.busy} onRetry={view.onRetry} />}
      />
      <p role="status" className="sr-only">
        {arrivalLive}
      </p>
      {bottom}
      <ChatMenuSheet
        open={menuOpen}
        chat={chat}
        turnBusy={turnBusy}
        onClose={() => setMenuOpen(false)}
        onRenamed={(t) => setChat((c) => (c ? { ...c, title: t } : c))}
        onToast={toast.show}
        extraTop={<AskMenuTop onNewQ={newQ} onScope={openScopeFromMenu} onToast={toast.show} route={input.route} />}
      />
    </div>
  )
}
