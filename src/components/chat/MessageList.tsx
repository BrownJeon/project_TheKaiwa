'use client'

/**
 * 채팅방의 **유일한 스크롤 영역**(screens.md §3-2 C MessageList). 스크롤은 코드가 관리한다(`overflow-anchor:none`):
 * 첫 로드 → 맨 아래 / 새 메시지 → 바닥 120px 안이면 따라 내려감, 아니면 "새 메시지 ↓" / 이전 메시지를 앞에
 * 붙이면 보던 자리 유지 / 목록 높이가 줄면(키보드) 바닥에 붙어 있던 경우 계속 바닥.
 *
 * 회화방(task-007 §9-2 E)은 선택 슬롯으로 말풍선을 바꿔 그린다(`renderUser`·`renderTutor`·`renderPending`·`intro`·`tail`·`liveOff`).
 * `followContent` 면 내용 높이가 늘 때(문장이 드러남·교정 카드·부분 인식·히라가나/한글/번역 층이 채워짐) 바닥에 붙어 있던 경우 계속 바닥.
 * 회화방과 채팅방(task-026 — 분석이 늦게 채워져도 바닥 유지) 모두 넘긴다.
 *
 * 질문 방(task-064)만 `arrivalAlign="answer-start"` 를 켠다 — 답이 도착하거나 방을 다시 열면 바닥이 아니라 직전 질문 윗면에 맞춘다
 * (긴 답의 시작이 화면 밖으로 밀리지 않게, screens.md §25-5 J). 계산은 `arrivalAlign.ts`. 기본 `'bottom'` 은 위 동작 그대로다.
 */
import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { ChatMessageView, ProposalDto } from '@/types/chat'
import { formatDateDivider, kstDateKey } from '@/components/common/format'
import { OFF, useAnnotations, type AnnotationState } from '@/components/common/japanese/annotations'
import {
  answerStartPlan,
  ARRIVAL_WINDOW_MS,
  isTopInView,
  measureArrivalTarget,
  questionIdBefore,
  rowTop,
  windowGrowthAction,
} from './arrivalAlign'
import { contentGrowthAction, FOLLOW_HOLD_MS, FollowHoldContext } from './followHold'
import { withinGroupGap } from './format'
import { annotatedMessages } from './messages'
import { LOST_FAILURE, type FailureView } from './labels'
import { FailedBubble, FailedLine, PendingBubble, TutorBubble, UserBubble } from './MessageBubble'
import ProposalCard from './ProposalCard'
import RoomIntro from './RoomIntro'
import type { ChatTurn } from './useChatTurn'

export interface MessageListHandle {
  scrollToBottom: () => void
  /** 스크롤 상자에 초점(`focusable` 일 때만 받는다) — 누른 칩이 사라져 초점이 문서 처음으로 빠지지 않게(task-064 질문 방). */
  focusList: () => void
}

/** 실패한 마지막 강사 답 슬롯이 받는 값(질문 방 실패 카드 — task-064). */
export interface FailedView {
  failure: FailureView
  busy: boolean
  onRetry: () => void
}

/** 슬롯이 받는 말풍선 문맥(묶음·시각·본문 분석 상태 — task-026 목록이 한 번에 받는다) */
export interface RowContext {
  groupStart: boolean
  groupEnd: boolean
  isLast: boolean
  ann: AnnotationState
}

const BOTTOM_SLACK_PX = 120

export default function MessageList({
  chatId,
  messages,
  proposals,
  teacherName,
  turn,
  hasOlder,
  loadingOlder,
  onLoadOlder,
  onPick,
  onProposalChange,
  onToast,
  handleRef,
  renderUser,
  renderTutor,
  renderPending,
  intro,
  lead,
  tail,
  liveOff,
  followContent,
  onUserTranslated,
  annotate = true,
  renderFailed,
  renderTrailingPending,
  focusable = false,
  arrivalAlign = 'bottom',
  pillLabel,
}: {
  chatId: string
  messages: ChatMessageView[]
  proposals: ProposalDto[]
  teacherName: string
  turn: ChatTurn
  hasOlder: boolean
  loadingOlder: boolean
  onLoadOlder: () => void
  onPick: (text: string) => void
  onProposalChange: (p: ProposalDto) => void
  onToast: (msg: string) => void
  handleRef: RefObject<MessageListHandle | null>
  renderUser?: (m: ChatMessageView, ctx: RowContext) => React.ReactNode
  /** 완료(DONE) 강사 답 — 제안 카드까지 슬롯이 그린다 */
  renderTutor?: (m: ChatMessageView, ctx: RowContext) => React.ReactNode
  /** 진행 중 강사 답 — null 을 돌려주면 기본 PendingBubble */
  renderPending?: (m: ChatMessageView, ctx: RowContext) => React.ReactNode | null
  /** 빈 방 안내(없으면 채팅 RoomIntro) */
  intro?: React.ReactNode
  /** 목록(`<ul>`)이 그려질 때 그 위에 놓을 것(질문 탭: 첫 질문 위에 남는 안내 말풍선, task-066 §26-5 B). 기본 없음. */
  lead?: React.ReactNode
  /** 목록 꼬리(회화: 부분 인식 말풍선) */
  tail?: React.ReactNode
  /** 녹음 중 — 스크린리더 음성이 마이크로 들어가지 않게 낭독을 끈다 */
  liveOff?: boolean
  followContent?: boolean
  /** 기본 내 말풍선이 손으로 가져온 번역(#32t)을 방 목록에 올린다(REV-094 M-1). `renderUser` 를 넘기는 방은 직접 `UserBubble` 에 준다 */
  onUserTranslated?: (messageId: string, text: string) => void
  /** false 면 본문 히라가나·한글 분석을 요청하지 않는다(질문 방 — 답 전문 대신 예문 줄만 방이 따로 요청, task-064 §25-6 E). 기본 true. */
  annotate?: boolean
  /** 실패한 마지막 강사 답(없으면 기본 FailedBubble) */
  renderFailed?: (m: ChatMessageView, ctx: RowContext, view: FailedView) => React.ReactNode
  /** 강사 행이 아직 없는 꼬리 대기 말풍선(없으면 기본 PendingBubble) */
  renderTrailingPending?: () => React.ReactNode
  /** 스크롤 상자를 프로그램 초점 대상으로(`tabIndex=-1`) — `handleRef.focusList()` 가 쓴다. 기본 false. */
  focusable?: boolean
  /**
   * `'answer-start'` = 답 도착·재진입 때 직전 질문 윗면에 맞춘다(질문 방, §25-5 J) · 위로 올려 둔 채 도착하면 위치를 지키고 알약.
   * 기본 `'bottom'` = 바닥에 붙인다(채팅·회화·역할극 방 — 동작 불변). 정렬 뒤 2초 재정렬이 `followContent` 관찰자를 쓰므로 함께 넘긴다.
   */
  arrivalAlign?: 'bottom' | 'answer-start'
  /** 알약 글(`↓` 는 목록이 붙인다) — 없으면 「새 메시지 ↓」. 질문 방은 「새 답」. */
  pillLabel?: string
}) {
  const alignAnswerStart = arrivalAlign === 'answer-start'
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)
  const [atBottom, setAtBottom] = useState(true)
  /** 바닥에서 벗어날 때의 마지막 메시지 — 그 뒤로 새 메시지가 오면 알약을 띄운다. */
  const [leftAtLastId, setLeftAtLastId] = useState<string | null>(null)
  const prev = useRef<{ first: string | null; last: string | null; count: number; scrollHeight: number }>({
    first: null,
    last: null,
    count: 0,
    scrollHeight: 0,
  })

  // 화면에 그린 말의 본문을 한 번에(요청 묶기 — §15-2 B). [이전 메시지]로 앞에 붙인 말은 다음 묶음으로 간다.
  const annMessages = annotatedMessages(messages, annotate)
  const annStates = useAnnotations(annMessages.map((m) => m.content))
  const annById = new Map<string, AnnotationState>()
  annMessages.forEach((m, k) => annById.set(m.id, annStates[k]))

  const lastId = messages.length ? messages[messages.length - 1].id : null
  const firstId = messages.length ? messages[0].id : null
  /** 카드 안 접이식 줄을 펼친 시각 + 여유(task-039 ⑧) — 그 안의 첫 높이 증가는 따라가지 않는다. */
  const holdUntilRef = useRef(0)
  const lastIdRef = useRef<string | null>(lastId)
  useEffect(() => {
    lastIdRef.current = lastId
  }, [lastId])
  const holdFollow = useCallback(() => {
    holdUntilRef.current = performance.now() + FOLLOW_HOLD_MS
  }, [])

  // ── 질문 방(arrivalAlign="answer-start") 전용 — 기본 모드에서는 아래 값이 쓰이지 않는다 ─────────────────
  const messagesRef = useRef(messages)
  useLayoutEffect(() => {
    messagesRef.current = messages
  }, [messages])
  /** 직전 렌더의 id → 상태 — 「이 답이 방금 DONE 이 됐나」를 같은 id 로 비교한다(마지막 행끼리 비교하면 임시 말풍선이 걷힐 때 오인). */
  const statusRef = useRef<Map<string, string>>(new Map())
  /** 정렬 뒤 2초 창(J-3): 사용자가 목록을 만지면 `touched` — 창 안에서 내용이 늘면 같은 식으로 다시 맞춘다. 시간 비교만 하므로 타이머가 없다. */
  const alignRef = useRef<{ answerId: string; until: number; touched: boolean } | null>(null)
  /** 위로 올려 둔 채 도착한 답 id(규칙 2) — 기본 알약 조건(`lastId !== leftAtLastId`)을 쓰지 않는다(대기 행과 답 행 id 가 같다, J-6 ②). */
  const pillIdRef = useRef<string | null>(null)
  const [pillId, setPillId] = useState<string | null>(null)
  const setPill = useCallback((id: string | null) => {
    pillIdRef.current = id
    setPillId(id)
  }, [])

  // 정렬한 직후 「바닥에 붙음」 판정을 새 위치로 바로 다시 잰다 — onScroll 은 비동기라 늦어서, 같은 커밋의 진행 말풍선 효과·내용 따라가기가
  // 옛 값(true)을 보고 방금 맞춘 자리를 바닥으로 되돌린다(J-6 ①).
  const settleBottom = useCallback((el: HTMLDivElement) => {
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_SLACK_PX
    atBottomRef.current = near
    setAtBottom(near)
  }, [])
  /** 답 행(과 앞 질문 행)을 지금 DOM 에서 재서 `scrollTop` 에 즉시 대입(J-1·J-4). 답 행을 못 찾으면 false. */
  const alignTo = useCallback(
    (answerId: string): boolean => {
      const el = scrollRef.current
      if (!el) return false
      const padTop = parseFloat(getComputedStyle(el).paddingTop) || 0
      const target = measureArrivalTarget(el, padTop, answerId, questionIdBefore(messagesRef.current, answerId))
      if (target === null) return false
      el.scrollTop = target
      settleBottom(el)
      return true
    },
    [settleBottom],
  )
  const alignAndWatch = useCallback(
    (answerId: string): boolean => {
      if (!alignTo(answerId)) return false
      alignRef.current = { answerId, until: performance.now() + ARRIVAL_WINDOW_MS, touched: false }
      setPill(null)
      return true
    },
    [alignTo, setPill],
  )

  const scrollToBottom = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    atBottomRef.current = true
    setAtBottom(true)
    if (alignAnswerStart) {
      alignRef.current = null
      setPill(null)
    }
  }

  const focusList = () => {
    if (focusable) scrollRef.current?.focus({ preventScroll: true })
  }

  useImperativeHandle(handleRef, () => ({
    scrollToBottom,
    focusList,
  }))

  /** 「새 답 ↓」 — 도착 규칙과 같은 자리로 가고 초점을 목록으로(누른 알약이 사라져 초점이 문서 처음으로 빠지지 않게, J-2·J-4). */
  const onArrivalPill = () => {
    const id = pillIdRef.current
    if (!id || !alignAndWatch(id)) scrollToBottom()
    focusList()
  }

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_SLACK_PX
    if (near !== atBottomRef.current) {
      atBottomRef.current = near
      setAtBottom(near)
      if (!near) setLeftAtLastId(lastId)
    }
    if (alignAnswerStart && pillIdRef.current) {
      // 알약은 바닥에 닿거나 답 행 윗면이 보이는 영역에 들어오면 사라진다(J-2 규칙 2).
      const aTop = rowTop(el, pillIdRef.current)
      if (near || aTop === null || isTopInView(aTop, el.scrollTop, el.clientHeight)) setPill(null)
    }
  }

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const p = prev.current
    let handled = false
    if (alignAnswerStart) {
      const last = messages[messages.length - 1]
      const plan = answerStartPlan({
        firstLoad: p.count === 0 && messages.length > 0,
        last,
        prevStatus: last ? statusRef.current.get(last.id) : undefined,
        atBottom: atBottomRef.current,
      })
      if (plan === 'align' && last) {
        handled = alignAndWatch(last.id)
      } else if (plan === 'pill' && last) {
        // 위로 올려 둔 채 도착 — 위치를 지키고(앞붙임이 같이 왔으면 그 보정만) 답 행 윗면이 안 보일 때만 알약.
        handled = true
        if (firstId !== p.first && lastId === p.last && messages.length > p.count) el.scrollTop += el.scrollHeight - p.scrollHeight
        const aTop = rowTop(el, last.id)
        if (aTop !== null && !isTopInView(aTop, el.scrollTop, el.clientHeight)) setPill(last.id)
      }
      statusRef.current = new Map(messages.map((m) => [m.id, m.status] as const))
    }
    if (handled) {
      // 도착·재진입 정렬(또는 알약)이 이 커밋의 스크롤을 정했다 — 바닥 붙임 규칙은 건너뛴다.
    } else if (p.count === 0 && messages.length > 0) {
      el.scrollTop = el.scrollHeight
    } else if (firstId !== p.first && lastId === p.last && messages.length > p.count) {
      // 이전 메시지를 앞에 붙였다 — 늘어난 높이만큼 내려 보던 자리를 지킨다.
      el.scrollTop += el.scrollHeight - p.scrollHeight
    } else if (atBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
    prev.current = { first: firstId, last: lastId, count: messages.length, scrollHeight: el.scrollHeight }
  }, [messages, firstId, lastId, alignAnswerStart, alignAndWatch, setPill])

  // 진행 말풍선이 나타나거나 사라질 때도 바닥에 붙어 있었으면 따라간다.
  const pendingVisible = turn.phase === 'streaming' || turn.phase === 'detached'
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight
  }, [pendingVisible, turn.phase])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let lastHeight = el.clientHeight
    const ro = new ResizeObserver(() => {
      const h = el.clientHeight
      if (h < lastHeight && atBottomRef.current) el.scrollTop = el.scrollHeight
      lastHeight = h
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    const inner = contentRef.current
    if (!followContent || !el || !inner || typeof ResizeObserver === 'undefined') return
    let lastHeight = inner.offsetHeight
    const ro = new ResizeObserver(() => {
      const h = inner.offsetHeight
      if (h > lastHeight) {
        const now = performance.now()
        const win = alignRef.current
        const action = alignAnswerStart
          ? windowGrowthAction({ now, windowUntil: win ? win.until : 0, touched: win ? win.touched : false, atBottom: atBottomRef.current, holdUntil: holdUntilRef.current })
          : contentGrowthAction(now, holdUntilRef.current, atBottomRef.current)
        if (action === 'realign') {
          // 정렬 뒤 2초 안에 늦게 붙은 제안 카드·예문 층 — 바닥 따라가기 대신 같은 식으로 다시 맞춘다(J-3).
          if (win) alignTo(win.answerId)
        } else if (action === 'hold') {
          // 사용자가 펼쳐 늘어난 높이 — 바닥으로 따라가면 누른 줄이 밀린다. 대신 실제 위치로 "바닥 근처"를 다시 잰다.
          holdUntilRef.current = 0
          const near = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_SLACK_PX
          if (near !== atBottomRef.current) {
            atBottomRef.current = near
            setAtBottom(near)
            if (!near) setLeftAtLastId(lastIdRef.current)
          }
        } else if (action === 'follow') {
          el.scrollTop = el.scrollHeight
        }
      }
      lastHeight = h
    })
    ro.observe(inner)
    return () => ro.disconnect()
  }, [followContent, alignAnswerStart, alignTo])

  // 사용자가 목록을 만지면 2초 창을 끝낸다(J-3) — 읽는 자리를 되돌리지 않는다.
  // `click` 은 스크린리더(TalkBack)의 접근성 클릭이 포인터·터치 이벤트 없이 click 만 내는 경우를 위한 것이다(도착 직후 2초 안에 [n개 더 보기]를 열어도 끌어올리지 않게).
  useEffect(() => {
    const el = scrollRef.current
    if (!alignAnswerStart || !el) return
    const touched = () => {
      if (alignRef.current) alignRef.current.touched = true
    }
    const events = ['pointerdown', 'touchstart', 'wheel', 'keydown', 'click'] as const
    for (const name of events) el.addEventListener(name, touched, { passive: true })
    return () => {
      for (const name of events) el.removeEventListener(name, touched)
    }
  }, [alignAnswerStart])

  const showPill = alignAnswerStart ? pillId !== null : !atBottom && lastId !== null && leftAtLastId !== null && lastId !== leftAtLastId

  const lastMessage = messages[messages.length - 1]
  const trailingPending = pendingVisible && !(lastMessage && lastMessage.role === 'ASSISTANT' && lastMessage.status === 'PENDING')
  const resumeBusy = turn.phase === 'sending'
  const failure = turn.failure ?? LOST_FAILURE

  const rows: React.ReactNode[] = []
  let prevKey = ''
  messages.forEach((m, i) => {
    const key = kstDateKey(m.createdAt)
    const divider = key !== prevKey && key !== ''
    if (divider) {
      rows.push(
        <li key={`d_${key}_${m.id}`} role="separator" className="my-3 flex items-center gap-3 text-[12px] text-ink2">
          <span aria-hidden="true" className="h-px flex-1 bg-line" />
          {formatDateDivider(m.createdAt)}
          <span aria-hidden="true" className="h-px flex-1 bg-line" />
        </li>,
      )
    }
    prevKey = key || prevKey
    const before = messages[i - 1]
    const after = messages[i + 1]
    const groupStart = divider || !before || before.role !== m.role || !withinGroupGap(before.createdAt, m.createdAt)
    const groupEnd =
      !after || after.role !== m.role || !withinGroupGap(m.createdAt, after.createdAt) || kstDateKey(after.createdAt) !== key
    const isLast = i === messages.length - 1

    const ann = annById.get(m.id) ?? OFF
    const ctx: RowContext = { groupStart, groupEnd, isLast, ann }
    const pendingSlot = m.role === 'ASSISTANT' && m.status === 'PENDING' && pendingVisible && isLast && renderPending ? renderPending(m, ctx) : null
    let node: React.ReactNode
    if (m.role === 'USER') {
      node = renderUser ? renderUser(m, ctx) : <UserBubble chatId={chatId} message={m} showTime={groupEnd} ann={ann} onTranslated={onUserTranslated} />
    } else if (m.status === 'DONE' && renderTutor) {
      node = renderTutor(m, ctx)
    } else if (m.status === 'DONE') {
      node = (
        <>
          <TutorBubble message={m} teacherName={teacherName} showHeader={groupStart} showTime={groupEnd} ann={ann} />
          {proposals
            .filter((p) => p.kind === 'ADD_WORD' && p.messageId === m.id)
            .map((p) => (
              <div key={p.id} className="mt-1.5 pl-9">
                <div className="max-w-[85%]">
                  <ProposalCard proposal={p} onChange={onProposalChange} onToast={onToast} />
                </div>
              </div>
            ))}
        </>
      )
    } else if (pendingSlot) {
      node = pendingSlot
    } else if (m.status === 'PENDING' && pendingVisible && isLast) {
      node = <PendingBubble teacherName={teacherName} showHeader={groupStart} stage={turn.stage} startedAt={turn.startedAt} detached={turn.phase === 'detached'} />
    } else if (isLast && renderFailed) {
      node = renderFailed(m, ctx, { failure, busy: resumeBusy, onRetry: () => void turn.resume() })
    } else if (isLast) {
      node = <FailedBubble teacherName={teacherName} showHeader={groupStart} failure={failure} busy={resumeBusy} onRetry={() => void turn.resume()} />
    } else {
      node = <FailedLine />
    }
    rows.push(
      <li key={m.id} data-mid={alignAnswerStart ? m.id : undefined} className={groupStart ? 'mt-3 first:mt-0' : 'mt-1'}>
        {node}
      </li>,
    )
  })
  if (trailingPending) {
    rows.push(
      <li key="__pending" className="mt-3">
        {renderTrailingPending ? (
          renderTrailingPending()
        ) : (
          <PendingBubble teacherName={teacherName} showHeader stage={turn.stage} startedAt={turn.startedAt} detached={turn.phase === 'detached'} />
        )}
      </li>,
    )
  }
  if (tail) {
    rows.push(
      <li key="__tail" className="mt-3">
        {tail}
      </li>,
    )
  }

  return (
    <FollowHoldContext.Provider value={holdFollow}>
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        tabIndex={focusable ? -1 : undefined}
        aria-label="대화 내용"
        aria-live={liveOff ? 'off' : 'polite'}
        aria-relevant="additions"
        // `relative`: 말풍선의 `sr-only`(absolute)가 바깥 상자를 기준으로 잡혀 이 스크롤 밖으로 새면 앱 셸 `main` 이
        // 대화 길이만큼 스크롤돼 방 전체(헤더·입력 바)가 밀린다(task-021 키보드 확인 중 발견).
        className={`relative h-full overflow-y-auto overscroll-contain px-4 py-3 [overflow-anchor:none]${focusable ? ' outline-none' : ''}`}
      >
        <div ref={contentRef} className="min-w-0">
        {hasOlder ? (
          <div className="mb-2 flex justify-center">
            <button
              type="button"
              onClick={onLoadOlder}
              aria-disabled={loadingOlder || undefined}
              aria-busy={loadingOlder || undefined}
              className="inline-flex h-11 items-center rounded-xl border border-line bg-surface px-4 text-[13px] font-semibold text-ink"
            >
              {loadingOlder ? '불러오는 중…' : '이전 메시지 보기'}
            </button>
          </div>
        ) : null}
        {messages.length === 0 && !trailingPending && !tail ? (
          (intro ?? <RoomIntro teacherName={teacherName} onPick={onPick} />)
        ) : (
          <>
            {lead}
            <ul className="min-w-0">{rows}</ul>
          </>
        )}
        </div>
      </div>
      {showPill ? (
        <button
          type="button"
          onClick={alignAnswerStart ? onArrivalPill : scrollToBottom}
          className="absolute bottom-3 left-1/2 inline-flex h-9 -translate-x-1/2 items-center rounded-full border border-line bg-surface px-3.5 text-[13px] font-semibold text-ink shadow-md before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']"
        >
          {pillLabel ? (
            <>
              {pillLabel}
              <span aria-hidden="true"> ↓</span>
            </>
          ) : (
            '새 메시지 ↓'
          )}
        </button>
      ) : null}
    </div>
    </FollowHoldContext.Provider>
  )
}
