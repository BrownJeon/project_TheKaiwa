'use client'

/**
 * 설정 › 음성 인식의 "내 발화 기록" 진입 줄(task-012b-2 가이드 §2-D). 확인할 말 수는 #21c `limit=1` 의 `reviewableCount` 로 한 번 받는다 —
 * 받는 중·실패면 배지만 없고 줄은 늘 보인다(인식 방식 조회 실패와 무관).
 */
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { apiGet } from '@/components/common/api'
import { Badge } from '@/components/common/ui'
import type { UtteranceListDto } from '@/types/speech'
import { ENTRY_COPY } from './utteranceCopy'

export default function UtteranceLogEntry() {
  const [n, setN] = useState(0)
  useEffect(() => {
    let cancelled = false
    apiGet<UtteranceListDto>('/api/v1/speech/utterances?limit=1').then(
      (r) => !cancelled && setN(r.reviewableCount),
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [])
  return (
    <Link
      href="/settings/utterances"
      aria-label={n > 0 ? ENTRY_COPY.aria(n) : undefined}
      className="mt-2 flex min-h-14 min-w-0 items-center gap-2 rounded-[14px] border border-line bg-surface px-3.5"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-ink">{ENTRY_COPY.title}</span>
        <span className="block text-[13px] text-ink2 break-keep">{ENTRY_COPY.sub}</span>
      </span>
      {n > 0 ? <Badge>{ENTRY_COPY.badge(n)}</Badge> : null}
      <span aria-hidden="true" className="text-ink2">
        ›
      </span>
    </Link>
  )
}
