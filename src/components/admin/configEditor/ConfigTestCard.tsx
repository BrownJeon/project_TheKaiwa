'use client'

/**
 * 후보 설정 기능 테스트 결과(#105, 데모 v2 `testCard`). ok = 바뀐 키를 모두 실행으로 확인(운영 적용에 첨부, 30분) ·
 * partial = 확인 못 한 키가 있음(운영 적용 불가, Codex C1 CX-2) · failed = 실행 실패. 저장은 하지 않는다.
 */
import Link from 'next/link'
import { useNow } from '@/components/common/useNow'
import type { ConfigTestDto } from '@/types/admin'
import { StatusBadge } from '../console/Badges'
import { errorCodeText } from '../console/labels'
import { formatClockSec, formatMs } from '../console/format'
import { testMinutesLeft } from './flow'

export default function ConfigTestCard({ test, at, production, canTrace }: { test: ConfigTestDto; at: number | null; production: boolean; canTrace: boolean }) {
  const now = useNow(true, 30_000)
  const left = testMinutesLeft(test.expiresAt, now)
  const badge = test.status === 'ok' ? 'PASSED' : test.status === 'partial' ? 'DEGRADED' : 'FAILED'
  const failedRun = test.runs.find((r) => !r.ok)
  return (
    <div role="group" aria-label="기능 테스트 결과" className="mt-3 min-w-0 rounded-[14px] bg-surface2 p-3.5">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {test.status === 'partial' ? (
          <span className="inline-flex h-[22px] flex-none items-center rounded-md bg-warn-soft px-2 text-[11.5px] font-semibold text-ink" aria-label="상태: 일부만 확인">
            일부만 확인
          </span>
        ) : (
          <StatusBadge value={badge} />
        )}
        <span className="text-[13px] font-semibold">기능 테스트 · 후보 설정</span>
        <span className="ml-auto text-[12px] tabular-nums text-ink2">
          {test.latencyMs !== null ? `${formatMs(test.latencyMs)} · ` : ''}
          {at ? formatClockSec(at) : ''}
        </span>
      </div>
      {test.status === 'ok' ? (
        <>
          <p className="mt-1.5 text-[14px] break-keep">
            {test.testedKeys.length > 0 ? '후보 설정으로 바뀐 키를 모두 실제로 실행해 확인했어요. 저장은 하지 않았어요.' : '바뀐 키가 모두 실행 확인이 필요 없는 키예요. 저장은 하지 않았어요.'}
          </p>
          {test.testResultId ? (
            <p className="mt-1 text-[12px] text-ink2">
              {left === null ? '결과는 30분 동안 유효해요.' : left > 0 ? `결과는 ${left}분 더 유효해요(운영 적용 때 첨부돼요).` : <b className="text-bad">결과가 만료됐어요 — 운영에 적용하려면 다시 테스트해 주세요.</b>}
            </p>
          ) : null}
        </>
      ) : test.status === 'partial' ? (
        <>
          <p className="mt-1.5 text-[14px] break-keep">일부 키는 실행으로 확인할 방법이 없어요.</p>
          {test.untestedKeys.length ? (
            <p className="mt-1 text-[12.5px] [overflow-wrap:anywhere]">
              확인 못 한 키 <span className="font-mono">{test.untestedKeys.join(', ')}</span>
            </p>
          ) : null}
          <p className="mt-1 text-[12px] text-ink2 break-keep">
            {production ? (
              <>
                <b className="text-bad">운영에서는 이 초안을 적용할 수 없어요</b> — 확인 못 한 키를 원래대로 돌리면 다시 테스트할 수 있어요.
              </>
            ) : (
              '개발 환경에서는 그대로 적용할 수 있어요. 운영에서는 이런 초안은 적용할 수 없어요.'
            )}
          </p>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-[14px] break-keep">{failedRun?.errorCode ? errorCodeText(failedRun.errorCode) : '후보 설정으로 실행하지 못했어요.'}</p>
          <p className="mt-1 text-[12.5px] text-ink2 break-keep">바꾼 값이 맞는지 확인해 주세요. 서비스가 꺼져 있으면 정상적인 결과예요.</p>
        </>
      )}
      {test.testedKeys.length > 0 ? (
        <p className="mt-1 text-[12.5px] text-ink2 [overflow-wrap:anywhere]">
          실행으로 확인한 키 <span className="font-mono text-ink">{test.testedKeys.join(', ')}</span>
        </p>
      ) : null}
      {test.traceId ? (
        <div className="mt-1.5 flex min-w-0 items-center gap-2">
          <span className="flex-none text-[12px] text-ink2">trace</span>
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink2">{test.traceId}</span>
          {canTrace ? (
            <Link href={`/admin/diagnostics/traces/${encodeURIComponent(test.traceId)}`} className="inline-flex min-h-11 flex-none items-center text-[12.5px] font-medium text-accent">
              Trace 보기 ›
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
