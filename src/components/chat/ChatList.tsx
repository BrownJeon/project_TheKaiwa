'use client'

/**
 * 채팅 목록(#27, `lastMessageAt desc`, 커서). 마운트·화면 복귀(visible) 때만 첫 쪽을 새로 읽는다(자동 폴링 없음).
 * task-007 음성 회화 목록도 `kind` 만 바꿔 재사용한다.
 */
import { useEffect, useState } from 'react'
import { apiGet } from '@/components/common/api'
import { Btn, ErrorBlock, LoadingBlock, Section, SectionHeader } from '@/components/common/ui'
import type { ChatKind, ChatSummary, Paged } from '@/types/chat'
import ChatListItem from './ChatListItem'
import { toErr } from './errors'
import { actionErrorText } from './labels'

export default function ChatList({ kind, onNew }: { kind: ChatKind; onNew: () => void }) {
  const [items, setItems] = useState<ChatSummary[] | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  // 목록 시각("오늘/어제")의 기준. 렌더 중에 시계를 읽지 않게 불러올 때 같이 정한다.
  const [now, setNow] = useState<Date | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const fetchFirst = () =>
      apiGet<Paged<ChatSummary>>(`/api/v1/chats?kind=${kind}&limit=20`)
        .then((r) => {
          if (cancelled) return
          setItems(r.items)
          setNextCursor(r.nextCursor)
          setNow(new Date())
          setError(null)
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(actionErrorText(toErr(e)))
        })
    void fetchFirst()
    const onVis = () => {
      if (document.visibilityState === 'visible') void fetchFirst()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
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
  if (items === null) {
    content = error ? <ErrorBlock message={error} onRetry={() => { setError(null); setReloadKey((k) => k + 1) }} /> : <LoadingBlock />
  } else if (items.length === 0) {
    content = (
      <div className="rounded-xl border border-dashed border-line px-4 py-7 text-center">
        <p className="text-[15px] font-semibold">아직 채팅이 없어요</p>
        <p className="mt-1 text-[14px] text-ink2 break-keep">
          일본어로 하고 싶은 말을 써 보세요. 틀려도 괜찮아요 — 대화를 마치면 선생님이 문장마다 고쳐 줘요.
        </p>
        <Btn className="mt-3" onClick={onNew}>
          첫 채팅 시작하기
        </Btn>
      </div>
    )
  } else {
    content = (
      <>
        <ul className="flex min-w-0 flex-col gap-2">
          {items.map((c) => (
            <ChatListItem key={c.id} chat={c} href={`/study/ai/chat/${encodeURIComponent(c.id)}`} now={now} />
          ))}
        </ul>
        {error ? (
          <p role="alert" className="mt-2 text-[13px] text-bad break-keep">
            {error}
          </p>
        ) : null}
        {nextCursor ? (
          <Btn variant="ghost" className="mt-2 w-full" onClick={() => void more()} aria-busy={loadingMore || undefined}>
            {loadingMore ? '불러오는 중…' : '이전 채팅 더 보기'}
          </Btn>
        ) : null}
      </>
    )
  }

  return (
    <Section>
      <SectionHeader title="채팅" />
      {content}
    </Section>
  )
}
