'use client'

/** 설정값 요약(#91a `effectiveSummary`, screens.md §6-2 E·H) — 역할 페이지·연결 상세 공용. `config.effective.read` 가 없으면 그리지 않는다. */
import Link from 'next/link'
import { Card, Section, SectionHeader } from '@/components/common/ui'
import type { EffectiveSummaryDto } from '@/types/admin'
import SourceBadge from '../configEditor/SourceBadge'
import { useCan } from './ConsoleProvider'
import { sourceCounts } from './format'

export default function EffectiveSummaryCard({ summary, targetKey }: { summary: EffectiveSummaryDto | null | undefined; targetKey: string }) {
  const can = useCan()
  if (!can('config.effective.read') || !summary) return null
  const counts = sourceCounts(summary.bySource)
  return (
    <Section>
      <SectionHeader title="설정값 요약" />
      <Card>
        <p className="text-[14px]">
          설정 {summary.keys}개{summary.warnings > 0 ? <span className="text-ink2"> · 경고 {summary.warnings}</span> : null}
        </p>
        {counts.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {counts.map(([s, n]) => (
              <span key={s} className="inline-flex min-w-0 max-w-full items-center gap-1">
                <SourceBadge source={s} />
                <span className="text-[12px] tabular-nums text-ink2">{n}</span>
              </span>
            ))}
          </div>
        ) : null}
        <Link
          href={`/admin/configuration?target=${encodeURIComponent(targetKey)}`}
          className="mt-2 flex h-11 items-center justify-end text-[14px] font-medium text-accent"
        >
          설정값 전체 보기 ›
        </Link>
      </Card>
    </Section>
  )
}
