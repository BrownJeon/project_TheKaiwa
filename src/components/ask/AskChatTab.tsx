'use client'

/**
 * 질문 탭 `/ask` 본체(task-066 §26-3·26-5 A — D1=B 「열 때마다 빈 대화」 → task-067 §27-1·27-6).
 * - 쿼리 없음 = 새 빈 대화(`AskNewConversation`) · `?chat=<id>` = 지금 대화(`AskRoom`) — 이 탭에서 시작·복원했거나 「지난 질문」 시트에서 고른 것.
 * - 주소는 `replaceUrl` 한 곳(= `replaceAskUrl`)으로만 바꿔 적는다: 첫 질문으로 만든 방 · 시트에서 연 대화 · 「새 질문 시작」 · 없어진 대화.
 *   `router.replace/push` 는 서버 다시 그리기·다시 마운트(보던 쪽·토스트·알약 상태를 잃음)이고 `push` 는 휴대폰 뒤로가기 기록까지 쌓는다(D4 A).
 * - `key` 를 받지 않는다: 쿼리 `chat` 의 **바뀜**을 렌더 중에 비교해(`askConvTransition`) 같은 인스턴스가 남든 다시 마운트되든 같은 결과를 낸다.
 * - 이 화면의 토스트는 이것 하나(자식에게 내려 준다 — 두 토스트 겹침 방지).
 */
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ChatSummary } from '@/types/chat'
import { readStore, writeStore } from '@/components/common/storage'
import Toast, { useToast } from '@/components/common/Toast'
import AskHistoryButton from './AskHistoryButton'
import AskHistorySheet from './AskHistorySheet'
import AskNewConversation from './AskNewConversation'
import AskRoom, { afterCommit, askToastBottom, useKbOpen } from './AskRoom'
import { ASK_COPY } from './askCopy'
import { ASK_KEYS, askChatHref, askConvTransition, isAskId, replaceAskUrl, type AskSeed } from './logic'
import { useAskActivity } from './useAskActivity'

/** `hint` = 불러오는 동안 머리 둘째 줄에 먼저 보일 제목(시트에서 고른 행 제목, §27-1 A 2). */
type Conv = { id: string | null; seed: AskSeed | null; greeting: boolean; n: number; hint: string | null }

/** 주소만 바꿔 적는다 — 호출 모양(첫 인자 `null`)은 `replaceAskUrl` 이 정한다. */
function replaceUrl(u: string) {
  replaceAskUrl(window.history, u)
}

/**
 * 처음 대화 id — **주소 쿼리가 정본**(§27-1 D). 형식이 맞는 `chat` 이면 그 대화, 없거나 틀리면 빈 대화(`null`).
 * 서버가 처음 그린 값은 쓰지 않는다: 휴대폰 뒤로가기가 낡은 화면을 되살리면 `replaceState` 로 `/ask` 로 바꾼 뒤에도 그 값(`?chat=A` 로 그린 A)이 되살아난다.
 * `useSearchParams()` 는 서버 렌더에서도 실제 요청 쿼리를 준다(이 페이지는 `searchParams`·`auth()` 를 읽는 동적 페이지).
 */
export function askInitialConvId(q: string | null): string | null {
  return isAskId(q) ? q : null
}

/** 시트 행을 눌렀을 때 — 지금 대화면 시트만 닫고(주소·대화·스크롤 그대로), 아니면 그 대화를 연다(§27-1 A 1). */
export function askOpenAction(rowId: string, convId: string | null): 'close' | 'open' {
  return rowId === convId ? 'close' : 'open'
}

const noopSubscribe = () => () => {}

function LoadErrorBox({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl bg-bad-soft px-3.5 py-3 text-[13.5px] text-bad">
      <span className="block text-[14.5px] font-semibold">{ASK_COPY.loadError}</span>
      <span className="block break-keep">{ASK_COPY.loadErrorBody}</span>
      <button type="button" onClick={onRetry} className="mt-0.5 inline-flex min-h-11 items-center font-semibold underline">
        {ASK_COPY.retry}
      </button>
    </div>
  )
}

export default function AskChatTab({ teacherName }: { teacherName: string }) {
  const q = useSearchParams().get('chat')
  const [conv, setConv] = useState<Conv>(() => ({ id: askInitialConvId(q), seed: null, greeting: false, n: 0, hint: null }))
  const [failed, setFailed] = useState<string | null>(null)
  const [prevQ, setPrevQ] = useState<string | null>(q)
  const [historyOpen, setHistoryOpen] = useState(false)
  // 빈 대화에서 새 대화가 생기면 시트를 1쪽부터(J2 — 이어 묻기는 보던 쪽 유지, L6)
  const [pageResetKey, setPageResetKey] = useState(0)
  const pillRef = useRef<HTMLButtonElement>(null)
  const toast = useToast()
  const act = useAskActivity(conv.id, toast.show)
  const kbOpen = useKbOpen()
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)

  // 쿼리 전이(§26-3 D) — 렌더 중에 바뀜을 맞춘다(효과로 하면 한 번 옛 대화가 그려진다).
  if (q !== prevQ) {
    setPrevQ(q)
    const t = askConvTransition(prevQ, q, conv.id)
    if (t === 'new') {
      setFailed(null)
      setConv((c) => ({ id: null, seed: null, greeting: false, n: c.n + 1, hint: null }))
    } else if (t !== 'none') {
      setFailed(null)
      setConv((c) => ({ id: t.open, seed: null, greeting: false, n: c.n, hint: null }))
    }
  }

  const startNew = useCallback(() => setConv((c) => ({ id: null, seed: null, greeting: false, n: c.n + 1, hint: null })), [])

  // 머리가 새로 그려지면(`AskRoom key` 바뀜) 공용 Sheet 의 「연 사람에게 초점 되돌리기」 대상이 사라진다 — 알약으로(§27-8 A).
  const focusPill = () => afterCommit(() => pillRef.current?.focus())

  /** ⋯ 「새 질문 시작」(D4 A) — 상태 먼저, 주소는 나중(`askConvTransition(x, null, null)` = none 이라 빈 대화를 두 번 만들지 않는다). */
  const startFresh = () => {
    setFailed(null)
    startNew()
    replaceUrl('/ask')
    focusPill()
  }

  /** 시트 행 열기(§27-1 A) — 상태 먼저(쿼리 전이가 같은 대화를 두 번 열지 않게), 주소는 나중. 기록은 늘지 않는다(D4 A). */
  const openConv = (row: ChatSummary) => {
    if (askOpenAction(row.id, conv.id) === 'close') {
      setHistoryOpen(false)
      return
    }
    setFailed(null)
    setConv((c) => ({ id: row.id, seed: null, greeting: false, n: c.n, hint: row.title }))
    replaceUrl(askChatHref(row.id))
    setHistoryOpen(false)
    focusPill()
  }

  /** 제목이 바뀜(시트 행 ⋯ · 머리 · ⋯ 메뉴) — 지금 대화면 힌트를 맞춘다(머리 둘째 줄이 옛 제목으로 되돌아가지 않게, §27-3 D). */
  const renamed = (id: string, title: string) => setConv((c) => (c.id === id ? { ...c, hint: title } : c))

  /** 시트에서 지움(§27-5 D) — 토스트·표지 지우기·알약 새로 읽기는 시트가 한다. 지금 대화였으면 시트를 닫고 빈 대화로. */
  const onDeleted = (_id: string, wasCurrent: boolean) => {
    if (!wasCurrent) return
    setHistoryOpen(false)
    startFresh()
  }

  // 대화 삭제(⋯ → 이 대화 삭제) 뒤 `/ask` 로 오면 토스트 한 번 — 마운트·쿼리 전이 때 표지를 읽고 지운다(§26-3 B).
  const { show } = toast
  useEffect(() => {
    if (readStore('session', ASK_KEYS.flash) !== 'deleted') return
    writeStore('session', ASK_KEYS.flash, null)
    show(ASK_COPY.deletedToast)
  }, [show, q])

  const pill = <AskHistoryButton ref={pillRef} running={act.running} newCount={act.newCount} onClick={() => setHistoryOpen(true)} />
  const mode = hydrated && readStore('session', ASK_KEYS.inputMode) === 'voice' ? 'voice' : 'text'

  return (
    <>
      {conv.id === null ? (
        <AskNewConversation
          key={`new-${conv.n}`}
          teacherName={teacherName}
          pill={pill}
          toast={toast}
          intro={
            failed ? (
              <LoadErrorBox
                onRetry={() => {
                  const id = failed
                  setFailed(null)
                  setConv((c) => ({ id, seed: null, greeting: false, n: c.n, hint: null }))
                }}
              />
            ) : undefined
          }
          onCreated={(seed) => {
            // 상태를 먼저 바꾸고 주소를 적는다 — 쿼리가 `null → id` 로 바뀌는 렌더에서 `conv.id` 가 이미 새 id 라 전이가 `none`(새 대화로 오판하지 않게).
            setFailed(null)
            setConv((c) => ({ id: seed.chat.id, seed, greeting: true, n: c.n, hint: null }))
            replaceUrl(askChatHref(seed.chat.id))
            setPageResetKey((k) => k + 1)
          }}
        />
      ) : (
        <AskRoom
          key={conv.id}
          chatId={conv.id}
          teacherName={teacherName}
          pill={pill}
          toast={toast}
          seed={conv.seed}
          greeting={conv.greeting}
          titleHint={conv.hint}
          onTitleChange={renamed}
          onGone={() => {
            replaceUrl('/ask')
            toast.show(ASK_COPY.goneToast)
            startNew()
          }}
          onLoadFailed={() => {
            setFailed(conv.id)
            startNew()
          }}
          onNewConversation={startFresh}
        />
      )}
      <AskHistorySheet
        open={historyOpen}
        activity={act}
        currentChatId={conv.id}
        pageResetKey={pageResetKey}
        onClose={() => setHistoryOpen(false)}
        onOpen={openConv}
        onRenamed={renamed}
        onDeleted={onDeleted}
        onToast={toast.show}
      />
      <Toast message={toast.message} bottomPx={askToastBottom({ mode, kbOpen })} />
    </>
  )
}
