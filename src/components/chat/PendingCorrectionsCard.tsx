'use client'

/**
 * 홈의 "채택을 기다리는 교정"(#34 `status=PROPOSED&limit=3`). 0건·오류면 그리지 않는다(부가 정보).
 * 채팅 교정은 점검 결과 화면으로, 회화(TALK) 교정은 회화방의 그 카드로 보낸다(ASK 는 교정이 없다).
 */
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { apiGet } from '@/components/common/api'
import { Section, SectionHeader } from '@/components/common/ui'
import type { CorrectionDto, Paged } from '@/types/chat'
import { TALK_HOME } from '@/components/talk/talkCopy'

/**
 * `onSettled`: 요청이 끝났을 때(성공·0건·오류 모두) 한 번 알린다 — 목록이 이 카드와 함께 나타나려고 기다린다(`listHold.ts`).
 * `hold`: true 면 데이터가 와 있어도 그리지 않는다(목록 자리표시가 카드 높이만큼 밀리지 않게).
 */
export default function PendingCorrectionsCard({ onSettled, hold = false }: { onSettled?: () => void; hold?: boolean }) {
  const [data, setData] = useState<Paged<CorrectionDto> | null>(null)
  // 요청 효과가 콜백 정체성에 매이지 않게 ref 로 읽는다(정체성이 바뀌어도 다시 요청하지 않는다).
  const settledRef = useRef(onSettled)
  useEffect(() => {
    settledRef.current = onSettled
  }, [onSettled])

  useEffect(() => {
    let cancelled = false
    // setData 와 같은 틱에서 알려야 부모가 같은 렌더에서 목록·카드를 함께 푼다(효과로 미루면 한 프레임 어긋난다).
    apiGet<Paged<CorrectionDto>>('/api/v1/corrections?status=PROPOSED&limit=3')
      .then((r) => {
        if (cancelled) return
        setData(r)
        settledRef.current?.()
      })
      .catch(() => {
        // 조용히 숨기되 끝난 것으로는 친다 — 카드 실패가 목록을 막지 않는다.
        if (!cancelled) settledRef.current?.()
      })
    return () => {
      cancelled = true
    }
  }, [])

  const rows = (data?.items ?? []).filter((c) => c.chat && (c.chat.kind === 'CHAT' || c.chat.kind === 'TALK'))
  if (hold || rows.length === 0) return null

  return (
    <Section>
      <SectionHeader title="채택을 기다리는 교정" />
      <ul className="min-w-0 divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
        {rows.map((c) => (
          <li key={c.id}>
            <Link
              href={
                c.chat!.kind === 'TALK'
                  ? `/study/ai/talk/${encodeURIComponent(c.chat!.id)}#cr_${c.id}`
                  : `/study/ai/chat/${encodeURIComponent(c.chat!.id)}/review#cr_${c.id}`
              }
              className="flex min-h-14 min-w-0 flex-col justify-center gap-0.5 px-3.5 py-2"
            >
              <span lang="ja" className="truncate text-[15px]">
                {c.original}
              </span>
              <span className="flex min-w-0 items-center gap-1 text-[12px] text-ink2">
                <span className="min-w-0 truncate">{c.chat!.title}</span>
                <span className="flex-none">· {c.chat!.kind === 'TALK' ? TALK_HOME.pendingRowSuffix : '결과 보기 ›'}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {data?.nextCursor ? <p className="mt-1.5 text-[12px] text-ink2 break-keep">더 있어요 — 채팅 점검 결과·회화방에서 확인해요</p> : null}
    </Section>
  )
}
