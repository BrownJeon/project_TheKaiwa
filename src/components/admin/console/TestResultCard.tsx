'use client'

/**
 * 상태 확인·기능 테스트 결과 카드(screens.md §6-2 C). **언제나 회색 바탕** — 상태는 뱃지와 사유 글로만 말한다
 * (응답 없음 = 빨간 카드가 아니다). `detail` 은 화이트리스트 칩만 그린다(`resultView`).
 */
import Link from 'next/link'
import { useNow } from '@/components/common/useNow'
import type { EngineStatusName, HealthKindName } from '@/types/admin'
import { StatusBadge } from './Badges'
import { useCan } from './ConsoleProvider'
import { formatAgo, formatMs } from './format'
import { HEALTH_KIND_KO, STATUS_KO } from './labels'
import MonoId from './MonoId'
import { type ResultLike, resultView } from './resultView'

export function TraceRef({ traceId }: { traceId: string }) {
  const can = useCan()
  return (
    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2">
      <span className="flex-none text-[12px] text-ink2">trace</span>
      <MonoId value={traceId} copy label="Trace ID" className="min-w-0 flex-1" />
      {can('trace.read') ? (
        <Link href={`/admin/diagnostics/traces/${encodeURIComponent(traceId)}`} className="inline-flex h-11 flex-none items-center text-[13px] font-medium text-accent">
          Trace 보기 ›
        </Link>
      ) : null}
    </div>
  )
}

export interface TestResult extends ResultLike {
  connectionStatus?: EngineStatusName
}

export default function TestResultCard({ kind, result, receivedAt }: { kind: HealthKindName; result: TestResult; receivedAt: number }) {
  const now = useNow(true, 30_000)
  const view = resultView(kind, result)
  const d = result.detail ?? {}
  const transcript = typeof d.transcript === 'string' && d.transcript ? d.transcript : null
  // 오디오 URL 은 같은 출처 경로만(콘솔 세션 전용 임시 파일, api-contract #96).
  const audioUrl = typeof d.audioUrl === 'string' && d.audioUrl.startsWith('/api/admin/') ? d.audioUrl : null
  const when = result.checkedAt ?? new Date(receivedAt).toISOString()
  return (
    <div role="group" aria-label={`${HEALTH_KIND_KO[kind]} 결과`} className="mt-3 min-w-0 rounded-xl border border-line bg-surface2 p-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <StatusBadge value={view.badge} />
        <span className="text-[13px] font-semibold">{HEALTH_KIND_KO[kind]}</span>
        <span className="ml-auto text-[12px] tabular-nums text-ink2">
          {formatMs(result.latencyMs)} · {formatAgo(when, now)}
        </span>
      </div>
      {view.reason ? <p className="mt-1.5 text-[14px] text-ink break-keep">{view.reason}</p> : null}
      {view.hint ? <p className="mt-1 text-[12.5px] text-ink2 break-keep">{view.hint}</p> : null}
      {view.message ? <p className="mt-1 text-[12px] text-ink2 [overflow-wrap:anywhere]">{view.message}</p> : null}
      {view.chips.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {view.chips.map(([k, v]) => (
            <li key={k} className="max-w-full rounded-md bg-surface px-2 py-0.5 font-mono text-[12px] text-ink2 [overflow-wrap:anywhere]">
              {k} {v}
            </li>
          ))}
        </ul>
      ) : null}
      {transcript ? (
        <p lang="ja" className="mt-2 text-[16px] leading-[1.7] [overflow-wrap:anywhere]">
          {transcript}
        </p>
      ) : null}
      {audioUrl ? <audio controls preload="none" src={audioUrl} className="mt-2 w-full" /> : null}
      {result.traceId ? <TraceRef traceId={result.traceId} /> : null}
      {result.connectionStatus ? (
        <p className="mt-2 text-[12px] text-ink2">연결 상태를 {STATUS_KO[result.connectionStatus] ?? result.connectionStatus}(으)로 바꿨어요</p>
      ) : null}
    </div>
  )
}
