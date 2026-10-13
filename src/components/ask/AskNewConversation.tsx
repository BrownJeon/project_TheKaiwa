'use client'

/**
 * 빈 대화(task-066 §26-5 C — D1=B). 방이 아직 없다: `/ask` 를 여는 것만으로는 방을 만들지 않고(§26-14 A 7), **첫 질문을 보낼 때** #28 로 만든 뒤
 * 같은 화면에서 `AskRoom` 으로 바뀐다(`onCreated` — 목록 → 방 이동 없음). `useChatTurn`·`MessageList` 를 쓰지 않는다(`MessageList` 는 턴이 필수).
 * 목록 상자 클래스는 `MessageList` 의 바깥 상자·스크롤 상자와 같다 — 생성 뒤 바뀔 때 안내 말풍선 위치가 튀지 않게(§26-11 F8).
 */
import { useRef, useState } from 'react'
import type { ChatMessageView, CreatedChat } from '@/types/chat'
import { apiPost } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import Sheet from '@/components/common/Sheet'
import AppBar from '@/components/shell/AppBar'
import { actionErrorText } from '@/components/chat/labels'
import AskGreeting from './AskGreeting'
import AskQuestionBubble from './AskQuestionBubble'
import { AskMenuButton, AskMenuTop, afterCommit, type ToastApi } from './AskRoom'
import { ASK_COPY } from './askCopy'
import { askDraftCheck, createAskConversation } from './homeLogic'
import { askSendOptions, chatInfoOfCreated, type AskSeed, type AskVia } from './logic'
import ScopeLine from './ScopeLine'
import ScopeNoticeSheet from './ScopeNoticeSheet'
import { useAskInput } from './useAskInput'

/** 빈 대화의 초안 키(`Composer chatId`) — 보내면 입력 묶음이 비운다(§26-15 Q-6). */
export const ASK_NEW_DRAFT_KEY = 'ask-new'

/** #28 동안 보이는 임시 내 말풍선(§26-3 C 2) — 빈 화면이 아니게. */
export function tempQuestion(text: string, via: AskVia, now: string): ChatMessageView {
  return { id: 'tmp_ask_new', role: 'USER', content: text, inputSource: via === 'voice' ? 'REALTIME_STT' : 'TEXT', status: 'DONE', createdAt: now, localStatus: 'SENDING' }
}

export default function AskNewConversation({
  teacherName,
  pill,
  toast,
  intro,
  onCreated,
}: {
  teacherName: string
  pill: React.ReactNode
  toast: ToastApi
  /** 대신 그릴 첫 칸(`?chat=` 불러오기 오류 상자 — §26-3 B) */
  intro?: React.ReactNode
  onCreated: (seed: AskSeed) => void
}) {
  const [creating, setCreating] = useState(false)
  const creatingRef = useRef(false)
  const [temp, setTemp] = useState<ChatMessageView | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const create = (text: string, via: AskVia) => {
    const bad = askDraftCheck(text)
    if (bad) {
      toast.show(bad === 'empty' ? ASK_COPY.emptyAsk : ASK_COPY.tooLong)
      return
    }
    if (creatingRef.current) return
    setTemp(tempQuestion(text, via, new Date().toISOString()))
    void createAskConversation(
      {
        lock: creatingRef,
        createChat: (title) => apiPost<CreatedChat>('/api/v1/chats', { kind: 'ASK', title }),
        setBusy: setCreating,
        onCreated: (c, t, v) => onCreated({ chat: chatInfoOfCreated(c), text: t, via: v, used: false }),
        onError: (e, t, v) => {
          setTemp(null)
          toast.show(actionErrorText(toErr(e)))
          // 글자는 입력창으로, 말은 「보내지 못한 말」 띠로(이유 = 네트워크 문구) — 입력 묶음이 갈래를 고른다.
          input.onRestore(t, { opts: askSendOptions(v), status: 0, message: null, details: {} })
        },
      },
      text,
      via,
    )
  }

  const input = useAskInput({
    draftKey: ASK_NEW_DRAFT_KEY,
    busy: creating,
    busyReason: ASK_COPY.sendLocked,
    isBusy: () => creatingRef.current,
    blockedUntil: null,
    notice: null,
    clearNotice: () => {},
    placeholder: ASK_COPY.placeholderNew,
    onSend: create,
    toast: toast.show,
  })

  const pickChip = (q: string) => {
    if (input.sendChip(q)) afterCommit(() => boxRef.current?.focus())
  }

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col bg-ground">
      <AppBar
        title={ASK_COPY.title}
        right={
          <>
            {pill}
            <AskMenuButton onClick={() => setMenuOpen(true)} />
          </>
        }
      />
      <div className="relative min-h-0 flex-1">
        <div
          ref={boxRef}
          role="log"
          aria-label="대화 내용"
          aria-live="off"
          tabIndex={-1}
          className="relative h-full overflow-y-auto overscroll-contain px-4 py-3 outline-none [overflow-anchor:none]"
        >
          <div className="min-w-0">
            {intro ?? <AskGreeting teacherName={teacherName} onPick={pickChip} />}
            {temp || input.tail ? (
              <ul className="min-w-0">
                {temp ? (
                  <li className="mt-3">
                    <AskQuestionBubble m={temp} showTime={false} />
                  </li>
                ) : null}
                {input.tail ? <li className="mt-3">{input.tail}</li> : null}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
      {input.strip}
      {input.bar}
      <ScopeLine variant="tab" onOpen={() => setScopeOpen(true)} />
      <Sheet open={menuOpen} title={ASK_COPY.menu.title} onClose={() => setMenuOpen(false)}>
        <div className="flex flex-col divide-y divide-line">
          <AskMenuTop
            onScope={() => {
              setMenuOpen(false)
              afterCommit(() => setScopeOpen(true))
            }}
            onToast={toast.show}
            route={input.route}
          />
          <p className="pt-3 text-[13px] text-ink2">{ASK_COPY.menu.emptyNote}</p>
        </div>
      </Sheet>
      <ScopeNoticeSheet open={scopeOpen} onClose={() => setScopeOpen(false)} />
    </div>
  )
}
