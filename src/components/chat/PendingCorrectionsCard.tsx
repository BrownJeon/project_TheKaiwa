'use client'

/** 홈의 "채택을 기다리는 교정"(#34 `status=PROPOSED&limit=3`). 0건·오류면 그리지 않는다(부가 정보). */
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { apiGet } from '@/components/common/api'
import { Section, SectionHeader } from '@/components/common/ui'
import type { CorrectionDto, Paged } from '@/types/chat'

export default function PendingCorrectionsCard() {
  const [data, setData] = useState<Paged<CorrectionDto> | null>(null)

  useEffect(() => {
    let cancelled = false
    apiGet<Paged<CorrectionDto>>('/api/v1/corrections?status=PROPOSED&limit=3')
      .then((r) => {
        if (!cancelled) setData(r)
      })
      .catch(() => {
        /* 조용히 숨긴다 */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 음성 회화방(TALK)의 교정은 그 방이 열리면 연결한다 — 지금은 채팅 교정만 결과 화면으로 보낸다.
  const rows = (data?.items ?? []).filter((c) => c.chat && c.chat.kind === 'CHAT')
  if (rows.length === 0) return null

  return (
    <Section>
      <SectionHeader title="채택을 기다리는 교정" />
      <ul className="min-w-0 divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
        {rows.map((c) => (
          <li key={c.id}>
            <Link
              href={`/study/ai/chat/${encodeURIComponent(c.chat!.id)}/review#cr_${c.id}`}
              className="flex min-h-14 min-w-0 flex-col justify-center gap-0.5 px-3.5 py-2"
            >
              <span lang="ja" className="truncate text-[15px]">
                {c.original}
              </span>
              <span className="flex min-w-0 items-center gap-1 text-[12px] text-ink2">
                <span className="min-w-0 truncate">{c.chat!.title}</span>
                <span className="flex-none">· 결과 보기 ›</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {data?.nextCursor ? <p className="mt-1.5 text-[12px] text-ink2 break-keep">더 있어요 — 채팅별 점검 결과에서 확인해요</p> : null}
    </Section>
  )
}
