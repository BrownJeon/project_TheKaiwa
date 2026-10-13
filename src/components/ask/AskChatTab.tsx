'use client'

/**
 * 질문 탭 `/ask` 본체(task-066 §26-3·26-5 A — D1=B 「열 때마다 빈 대화」).
 * - 쿼리 없음 = 새 빈 대화(`AskNewConversation`) · `?chat=<id>` = 이 탭에서 시작·복원한 지금 대화(`AskRoom variant="tab"`).
 * - 첫 질문으로 방을 만들면 주소를 `history.replaceState` 로만 바꿔 적는다 — `router.replace/push` 는 서버 다시 그리기·다시 마운트로 보내던 질문을 잃는다(§26-14 A 6).
 * - `key` 를 받지 않는다: 쿼리 `chat` 의 **바뀜**을 렌더 중에 비교해(`askConvTransition`) 같은 인스턴스가 남든 다시 마운트되든 같은 결과를 낸다.
 * - 이 화면의 토스트는 이것 하나(자식에게 내려 준다 — 두 토스트 겹침 방지).
 */
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { readStore, writeStore } from '@/components/common/storage'
import Toast, { useToast } from '@/components/common/Toast'
import AskHistoryButton from './AskHistoryButton'
import AskHistorySheet from './AskHistorySheet'
import AskNewConversation from './AskNewConversation'
import AskRoom, { askToastBottom, useKbOpen } from './AskRoom'
import { ASK_COPY } from './askCopy'
import { ASK_KEYS, askChatHref, askConvTransition, replaceAskUrl, type AskSeed } from './logic'
import { useAskActivity } from './useAskActivity'

type Conv = { id: string | null; seed: AskSeed | null; greeting: boolean; n: number }

/** 주소만 바꿔 적는다 — 호출 모양(첫 인자 `null`)은 `replaceAskUrl` 이 정한다. */
function replaceUrl(u: string) {
  replaceAskUrl(window.history, u)
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

export default function AskChatTab({ teacherName, initialChatId }: { teacherName: string; initialChatId: string | null }) {
  const router = useRouter()
  const q = useSearchParams().get('chat')
  const [conv, setConv] = useState<Conv>(() => ({ id: initialChatId, seed: null, greeting: false, n: 0 }))
  const [failed, setFailed] = useState<string | null>(null)
  const [prevQ, setPrevQ] = useState<string | null>(q)
  const [historyOpen, setHistoryOpen] = useState(false)
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
      setConv((c) => ({ id: null, seed: null, greeting: false, n: c.n + 1 }))
    } else if (t !== 'none') {
      setFailed(null)
      setConv((c) => ({ id: t.open, seed: null, greeting: false, n: c.n }))
    }
  }

  const startNew = useCallback(() => setConv((c) => ({ id: null, seed: null, greeting: false, n: c.n + 1 })), [])

  // 대화 삭제(⋯ → 이 대화 삭제) 뒤 `/ask` 로 오면 토스트 한 번 — 마운트·쿼리 전이 때 표지를 읽고 지운다(§26-3 B).
  const { show } = toast
  useEffect(() => {
    if (readStore('session', ASK_KEYS.flash) !== 'deleted') return
    writeStore('session', ASK_KEYS.flash, null)
    show(ASK_COPY.deletedToast)
  }, [show, q])

  const pill = <AskHistoryButton running={act.running} newCount={act.newCount} onClick={() => setHistoryOpen(true)} />
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
                  setConv((c) => ({ id, seed: null, greeting: false, n: c.n }))
                }}
              />
            ) : undefined
          }
          onCreated={(seed) => {
            // 상태를 먼저 바꾸고 주소를 적는다 — 쿼리가 `null → id` 로 바뀌는 렌더에서 `conv.id` 가 이미 새 id 라 전이가 `none`(새 대화로 오판하지 않게).
            setFailed(null)
            setConv((c) => ({ id: seed.chat.id, seed, greeting: true, n: c.n }))
            replaceUrl(askChatHref(seed.chat.id))
          }}
        />
      ) : (
        <AskRoom
          key={conv.id}
          variant="tab"
          chatId={conv.id}
          teacherName={teacherName}
          pill={pill}
          toast={toast}
          seed={conv.seed}
          greeting={conv.greeting}
          onGone={() => {
            replaceUrl('/ask')
            toast.show(ASK_COPY.goneToast)
            startNew()
          }}
          onLoadFailed={() => {
            setFailed(conv.id)
            startNew()
          }}
          onNewConversation={() => router.push('/ask')}
        />
      )}
      <AskHistorySheet open={historyOpen} activity={act} currentChatId={conv.id} onClose={() => setHistoryOpen(false)} />
      <Toast message={toast.message} bottomPx={askToastBottom({ mode, variant: 'tab', kbOpen })} />
    </>
  )
}
