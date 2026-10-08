'use client'

/**
 * 채팅 목록(#27, `lastMessageAt desc`, 커서). 마운트·화면 복귀(visible) 때만 첫 쪽을 새로 읽는다(자동 폴링 없음).
 * task-007 음성 회화 목록도 `kind` 만 바꿔 재사용한다.
 * `hold`: true 면 데이터가 와 있어도 자리표시를 유지한다(교정 카드와 함께 나타나려고 — `listHold.ts`). 오류 상자는 막지 않는다.
 * `onSettled`: 첫 결과(데이터 또는 오류)가 정해졌을 때 알린다(이후 다시 읽을 때마다 불려도 부모는 같은 값으로 받는다).
 */
import { useEffect, useRef, useState } from 'react'
import { apiGet } from '@/components/common/api'
import { Btn, ErrorBlock, Section, SectionHeader } from '@/components/common/ui'
import type { ChatKind, ChatSummary, Paged } from '@/types/chat'
import { ChatRowsSkeleton } from '@/components/shell/TabSkeleton'
import { retryFailHoldMs } from '@/components/topic/logic'
import ChatListItem from './ChatListItem'
import { TALK_HOME } from '@/components/talk/talkCopy'
import { settleFirstFailure } from './listHold'
import { listSectionTitle } from './studyAiTabs'
import { toErr } from '@/components/common/errors'
import { actionErrorText } from './labels'

export default function ChatList({ kind, onNew, hold = false, onSettled }: { kind: ChatKind; onNew: () => void; hold?: boolean; onSettled?: () => void }) {
  const talk = kind === 'TALK'
  const basePath = talk ? '/study/ai/talk/' : '/study/ai/chat/'
  const [items, setItems] = useState<ChatSummary[] | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  // 목록 시각("오늘/어제")의 기준. 렌더 중에 시계를 읽지 않게 불러올 때 같이 정한다.
  const [now, setNow] = useState<Date | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  // 오류 상자 [다시 시도] 를 누른 시각 — 바로 다시 실패해도 자리표시가 최소 시간 보인 뒤에 오류 상자가 돌아온다(깜빡임 방지, useManageData 와 같은 규칙).
  const retryAt = useRef<number | null>(null)
  // 요청 효과가 콜백 정체성에 매이지 않게 ref 로 읽는다.
  const settledRef = useRef(onSettled)
  useEffect(() => {
    settledRef.current = onSettled
  }, [onSettled])

  useEffect(() => {
    let cancelled = false
    let holdTimer: ReturnType<typeof setTimeout> | undefined
    const fetchFirst = () =>
      apiGet<Paged<ChatSummary>>(`/api/v1/chats?kind=${kind}&limit=20`)
        .then((r) => {
          if (cancelled) return
          setItems(r.items)
          setNextCursor(r.nextCursor)
          setNow(new Date())
          setError(null)
          settledRef.current?.()
        })
        .catch((e: unknown) => {
          if (cancelled) return
          const holdMs = retryAt.current === null ? 0 : retryFailHoldMs(true, retryAt.current, Date.now())
          retryAt.current = null
          // 오류 상자와 「첫 결과 정해짐」 알림은 한 호출에서 함께 — 순서는 `settleFirstFailure` 가 지킨다(시험으로 고정).
          holdTimer = settleFirstFailure(holdMs, {
            showError: () => {
              if (!cancelled) setError(actionErrorText(toErr(e)))
            },
            settle: () => {
              if (!cancelled) settledRef.current?.()
            },
          })
        })
    void fetchFirst()
    const onVis = () => {
      if (document.visibilityState === 'visible') void fetchFirst()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      if (holdTimer) clearTimeout(holdTimer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [kind, reloadKey])

  const more = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const r = await apiGet<Paged<ChatSummary>>(`/api/v1/chats?kind=${kind}&limit=20&cursor=${encodeURIComponent(nextCursor)}`)
      setItems((prev) => {
        const have = new Set((prev ?? []).map((c) => c.id))
        return [...(prev ?? []), ...r.items.filter((c) => !have.has(c.id))]
      })
      setNextCursor(r.nextCursor)
    } catch (e) {
      setError(actionErrorText(toErr(e)))
    } finally {
      setLoadingMore(false)
    }
  }

  let content: React.ReactNode
  if (items === null || hold) {
    content =
      items === null && error ? (
        <ErrorBlock
          message={error}
          onRetry={() => {
            retryAt.current = Date.now()
            setError(null)
            setReloadKey((k) => k + 1)
          }}
        />
      ) : (
        <ChatRowsSkeleton />
      )
  } else if (items.length === 0) {
    content = (
      <div className="rounded-xl border border-dashed border-line px-4 py-7 text-center">
        <p className="text-[15px] font-semibold">{talk ? TALK_HOME.emptyTitle : '아직 채팅이 없어요'}</p>
        <p className="mt-1 text-[14px] text-ink2 break-keep">
          {talk ? TALK_HOME.emptyBody : '일본어로 하고 싶은 말을 써 보세요. 틀려도 괜찮아요 — 대화를 마치면 선생님이 문장마다 고쳐 줘요.'}
        </p>
        <Btn className="mt-3" onClick={onNew}>
          {talk ? TALK_HOME.emptyAction : '첫 채팅 시작하기'}
        </Btn>
      </div>
    )
  } else {
    content = (
      <>
        <ul className="flex min-w-0 flex-col gap-2">
          {items.map((c) => (
            <ChatListItem key={c.id} chat={c} href={`${basePath}${encodeURIComponent(c.id)}`} now={now} />
          ))}
        </ul>
        {error ? (
          <p role="alert" className="mt-2 text-[13px] text-bad break-keep">
            {error}
          </p>
        ) : null}
        {nextCursor ? (
          <Btn variant="ghost" className="mt-2 w-full" onClick={() => void more()} aria-busy={loadingMore || undefined}>
            {loadingMore ? '불러오는 중…' : talk ? TALK_HOME.more : '이전 채팅 더 보기'}
          </Btn>
        ) : null}
      </>
    )
  }

  return (
    <Section>
      <SectionHeader title={listSectionTitle(talk ? 'talk' : 'chat')} />
      {content}
    </Section>
  )
}
