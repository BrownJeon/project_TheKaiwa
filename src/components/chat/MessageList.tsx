'use client'

/**
 * 채팅방의 **유일한 스크롤 영역**(screens.md §3-2 C MessageList). 스크롤은 코드가 관리한다(`overflow-anchor:none`):
 * 첫 로드 → 맨 아래 / 새 메시지 → 바닥 120px 안이면 따라 내려감, 아니면 "새 메시지 ↓" / 이전 메시지를 앞에
 * 붙이면 보던 자리 유지 / 목록 높이가 줄면(키보드) 바닥에 붙어 있던 경우 계속 바닥.
 *
 * 회화방(task-007 §9-2 E)은 선택 슬롯으로 말풍선을 바꿔 그린다(`renderUser`·`renderTutor`·`renderPending`·`intro`·`tail`·`liveOff`).
 * `followContent` 면 내용 높이가 늘 때(문장이 드러남·교정 카드·부분 인식·히라가나/한글/번역 층이 채워짐) 바닥에 붙어 있던 경우 계속 바닥.
 * 회화방과 채팅방(task-026 — 분석이 늦게 채워져도 바닥 유지) 모두 넘긴다.
 */
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { ChatMessageView, ProposalDto } from '@/types/chat'
import { formatDateDivider, kstDateKey } from '@/components/common/format'
import { OFF, useAnnotations, type AnnotationState } from '@/components/common/japanese/annotations'
import { withinGroupGap } from './format'
import { LOST_FAILURE } from './labels'
import { FailedBubble, FailedLine, PendingBubble, TutorBubble, UserBubble } from './MessageBubble'
import ProposalCard from './ProposalCard'
import RoomIntro from './RoomIntro'
import type { ChatTurn } from './useChatTurn'

export interface MessageListHandle {
  scrollToBottom: () => void
}

/** 슬롯이 받는 말풍선 문맥(묶음·시각·본문 분석 상태 — task-026 목록이 한 번에 받는다) */
export interface RowContext {
  groupStart: boolean
  groupEnd: boolean
  isLast: boolean
  ann: AnnotationState
}

/** 히라가나·한글을 다는 말 — 내 말(보낸 직후 포함)과 끝난 선생님 말. 스트리밍·실패 말은 달지 않는다. */
const annotatable = (m: ChatMessageView) => m.role === 'USER' || m.status === 'DONE'

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
  tail,
  liveOff,
  followContent,
  onUserTranslated,
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
  /** 목록 꼬리(회화: 부분 인식 말풍선) */
  tail?: React.ReactNode
  /** 녹음 중 — 스크린리더 음성이 마이크로 들어가지 않게 낭독을 끈다 */
  liveOff?: boolean
  followContent?: boolean
  /** 기본 내 말풍선이 손으로 가져온 번역(#32t)을 방 목록에 올린다(REV-094 M-1). `renderUser` 를 넘기는 방은 직접 `UserBubble` 에 준다 */
  onUserTranslated?: (messageId: string, text: string) => void
}) {
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
  const annTexts = messages.filter(annotatable).map((m) => m.content)
  const annStates = useAnnotations(annTexts)
  const annById = new Map<string, AnnotationState>()
  {
    let k = 0
    for (const m of messages) if (annotatable(m)) annById.set(m.id, annStates[k++])
  }

  const lastId = messages.length ? messages[messages.length - 1].id : null
  const firstId = messages.length ? messages[0].id : null

  const scrollToBottom = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    atBottomRef.current = true
    setAtBottom(true)
  }

  useImperativeHandle(handleRef, () => ({ scrollToBottom }))

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_SLACK_PX
    if (near !== atBottomRef.current) {
      atBottomRef.current = near
      setAtBottom(near)
      if (!near) setLeftAtLastId(lastId)
    }
  }

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const p = prev.current
    if (p.count === 0 && messages.length > 0) {
      el.scrollTop = el.scrollHeight
    } else if (firstId !== p.first && lastId === p.last && messages.length > p.count) {
      // 이전 메시지를 앞에 붙였다 — 늘어난 높이만큼 내려 보던 자리를 지킨다.
      el.scrollTop += el.scrollHeight - p.scrollHeight
    } else if (atBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
    prev.current = { first: firstId, last: lastId, count: messages.length, scrollHeight: el.scrollHeight }
  }, [messages, firstId, lastId])

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
      if (h > lastHeight && atBottomRef.current) el.scrollTop = el.scrollHeight
      lastHeight = h
    })
    ro.observe(inner)
    return () => ro.disconnect()
  }, [followContent])

  const showPill = !atBottom && lastId !== null && leftAtLastId !== null && lastId !== leftAtLastId

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
    } else if (isLast) {
      node = <FailedBubble teacherName={teacherName} showHeader={groupStart} failure={failure} busy={resumeBusy} onRetry={() => void turn.resume()} />
    } else {
      node = <FailedLine />
    }
    rows.push(
      <li key={m.id} className={groupStart ? 'mt-3 first:mt-0' : 'mt-1'}>
        {node}
      </li>,
    )
  })
  if (trailingPending) {
    rows.push(
      <li key="__pending" className="mt-3">
        <PendingBubble teacherName={teacherName} showHeader stage={turn.stage} startedAt={turn.startedAt} detached={turn.phase === 'detached'} />
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
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        aria-label="대화 내용"
        aria-live={liveOff ? 'off' : 'polite'}
        aria-relevant="additions"
        // `relative`: 말풍선의 `sr-only`(absolute)가 바깥 상자를 기준으로 잡혀 이 스크롤 밖으로 새면 앱 셸 `main` 이
        // 대화 길이만큼 스크롤돼 방 전체(헤더·입력 바)가 밀린다(task-021 키보드 확인 중 발견).
        className="relative h-full overflow-y-auto overscroll-contain px-4 py-3 [overflow-anchor:none]"
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
          <ul className="min-w-0">{rows}</ul>
        )}
        </div>
      </div>
      {showPill ? (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-3 left-1/2 inline-flex h-9 -translate-x-1/2 items-center rounded-full border border-line bg-surface px-3.5 text-[13px] font-semibold text-ink shadow-md before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']"
        >
          새 메시지 ↓
        </button>
      ) : null}
    </div>
  )
}
