'use client'

/**
 * Trace 상세(#129, screens.md §6-2 J). Trace 에는 본문이 없다 — 원음·전체 대화·시크릿 없음(규칙 7). "본문 보기" 자리도 없다.
 * 단계 막대는 장식이고 상태는 뱃지 글자가 진다. 막대 폭은 "전체 대비 비율"로만(겹쳐 도는 TTS 문장 단계도 같은 규칙).
 */
import { Card, Section, SectionHeader } from '@/components/common/ui'
import type { TraceDetailDto, TraceStepDto } from '@/types/admin'
import { NeutralBadge, StepStatusBadge, TraceStatusBadge } from '../console/Badges'
import { BackLink, ConsoleLoading, LoadError } from '../console/ConsoleStates'
import { displayValue, formatDateTime, formatMs } from '../console/format'
import KeyValueList from '../console/KeyValueList'
import { TRACE_KIND_KO } from '../console/labels'
import MonoId from '../console/MonoId'
import { useAdminResource } from '../console/useAdminResource'

const NOT_FOUND = { backHref: '/admin/diagnostics?tab=traces', backLabel: 'Trace 목록으로' }

/** 머리 줄에서 따로 그리는 단계 키 — 나머지 원시 값은 칩으로. */
const HEAD_KEYS = new Set([
  'name',
  'status',
  'ms',
  'latencyMs',
  'engineId',
  'engine',
  'connectionKey',
  'connection',
  'connectionId',
  'model',
  'attempt',
  'fallbackFrom',
  'cache',
  'client',
  'errorCode',
  'errorMessage',
  'error',
  'startedAt',
])

const BAR: Record<string, string> = { OK: 'bg-ink2', FAILED: 'bg-bad', TIMEOUT: 'bg-bad', FALLBACK: 'bg-warn', SKIPPED: '' }

function str(v: unknown): string | null {
  return typeof v === 'string' && v ? v : null
}

function stepMs(s: TraceStepDto): number | null {
  const v = typeof s.latencyMs === 'number' ? s.latencyMs : s.ms
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function StepCard({ step, totalMs }: { step: TraceStepDto; totalMs: number | null }) {
  const ms = stepMs(step)
  const status = str(step.status)
  const engine = str(step.engineId) ?? str(step.engine)
  const conn = str(step.connectionKey) ?? str(step.connection)
  const model = str(step.model)
  const attempt = typeof step.attempt === 'number' ? step.attempt : null
  const fallbackFrom = str(step.fallbackFrom)
  const cache = str(step.cache)
  const client = str(step.client)
  const errorCode = str(step.errorCode)
  const errorMessage = str(step.errorMessage) ?? str(step.error)
  const meta = [
    engine,
    conn,
    model ? `모델 ${model}` : null,
    attempt && attempt > 1 ? `${attempt}번째 시도` : null,
    fallbackFrom ? `${fallbackFrom} 에서 넘어옴` : null,
    cache ? `캐시 ${cache}` : null,
    client,
  ].filter(Boolean)
  const chips = Object.entries(step).filter(([k, v]) => !HEAD_KEYS.has(k) && v !== null && v !== undefined && v !== '')
  const pct = ms !== null && totalMs ? Math.max(2, Math.min(100, (ms / totalMs) * 100)) : 0
  return (
    <li className="min-w-0 rounded-[14px] border border-line bg-surface p-3.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[14px] font-semibold">{step.name}</span>
        <StepStatusBadge status={status} />
        <span className="flex-none text-[13px] tabular-nums">{formatMs(ms)}</span>
      </div>
      <div aria-hidden="true" className="mt-2 h-1.5 rounded-full bg-surface2">
        {status !== 'SKIPPED' && pct > 0 ? <div className={`h-full rounded-full ${BAR[status ?? 'OK'] ?? 'bg-ink2'}`} style={{ width: `${pct}%` }} /> : null}
      </div>
      {meta.length ? <p className="mt-2 text-[12.5px] text-ink2 [overflow-wrap:anywhere]">{meta.map((m) => displayValue('meta', m)).join(' · ')}</p> : null}
      {chips.length ? (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {chips.map(([k, v]) => (
            <li key={k} className="max-w-full rounded-md bg-surface2 px-2 py-0.5 font-mono text-[12px] text-ink2 [overflow-wrap:anywhere]">
              {k} {displayValue(k, v)}
            </li>
          ))}
        </ul>
      ) : null}
      {errorCode ? <p className="mt-1.5 text-[13px] font-semibold text-bad [overflow-wrap:anywhere]">{errorCode}</p> : null}
      {errorMessage ? <p className="font-mono text-[12px] text-ink2 [overflow-wrap:anywhere]">{displayValue('errorMessage', errorMessage)}</p> : null}
    </li>
  )
}

export default function TraceDetailScreen({ traceId }: { traceId: string }) {
  const res = useAdminResource<TraceDetailDto>(`/api/admin/v1/traces/${encodeURIComponent(traceId)}`)
  const back = <BackLink href="/admin/diagnostics?tab=traces">Trace 목록</BackLink>
  if (res.status === 'loading' || res.status === 'idle') {
    return (
      <>
        {back}
        <ConsoleLoading />
      </>
    )
  }
  if (res.status === 'error' && res.err) {
    return (
      <>
        {back}
        <LoadError err={res.err} name="Trace" onRetry={res.reload} notFound={NOT_FOUND} />
      </>
    )
  }
  const t = res.data
  if (!t) return null
  return (
    <>
      {back}
      <Card>
        <h2 className="sr-only">Trace 상세</h2>
        <MonoId value={t.traceId} copy label="Trace ID" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <NeutralBadge>{TRACE_KIND_KO[t.kind] ?? t.kind}</NeutralBadge>
          <TraceStatusBadge status={t.status} />
          <span className="text-[13px] tabular-nums">{formatMs(t.totalMs)}</span>
          {t.errorCode ? <span className="font-mono text-[12.5px] font-semibold text-bad [overflow-wrap:anywhere]">{t.errorCode}</span> : null}
        </div>
        <KeyValueList
          className="mt-2"
          items={[
            { key: 'environment', label: '환경', value: t.environment },
            { key: 'createdAt', label: '시각', value: formatDateTime(t.createdAt) },
            { key: 'ref', label: '대상', value: t.refType || t.refId ? `${t.refType ?? '—'} ${t.refId ?? ''}`.trim() : null, mono: true },
            { key: 'debugSessionId', label: '디버그 세션', value: t.debugSessionId ?? '없음', mono: Boolean(t.debugSessionId) },
            { key: 'userId', label: '사용자', value: t.userId ?? '—', mono: true },
          ]}
        />
      </Card>
      <Section>
        <SectionHeader title={`단계 (${t.steps.length})`} />
        {t.steps.length === 0 ? (
          <p className="text-[13px] text-ink2">기록된 단계가 없어요.</p>
        ) : (
          <ol className="grid gap-2">
            {t.steps.map((s, i) => (
              <StepCard key={`${s.name}-${i}`} step={s} totalMs={t.totalMs} />
            ))}
          </ol>
        )}
      </Section>
    </>
  )
}
