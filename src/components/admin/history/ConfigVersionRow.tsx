/**
 * 설정 버전 한 행(데모 v2 `histVersions`): vN · 상태 · 기준선 · 기록 손상 · "vK 로 되돌림" · 언제 / (전체일 때) 대상·종류 / 변경 요약 / 작업자 · 출처 · 테스트.
 * 행 전체가 상세 시트를 여는 버튼.
 */
import type { ConfigVersionItemDto } from '@/types/admin'
import { formatAgo } from '../console/format'
import { ORIGIN_KO, SCOPE_KO } from '../configEditor/configCopy'
import { DamagedBadge, NeutralTag, VersionStatusBadge } from '../configEditor/ui'

export default function ConfigVersionRow({ v, now, showTarget, onOpen }: { v: ConfigVersionItemDto; now: number; showTarget: boolean; onOpen: (v: ConfigVersionItemDto) => void }) {
  const test = v.testResult ? (v.testResult.ok ? '테스트 통과' : '테스트 실패') : null
  return (
    <li>
      <button type="button" aria-haspopup="dialog" onClick={() => onOpen(v)} className="flex min-h-[64px] w-full min-w-0 flex-col gap-0.5 px-3.5 py-2.5 text-left">
        <span className="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[15px] font-semibold">v{v.version}</span>
          <VersionStatusBadge status={v.status} />
          {v.origin === 'BASELINE' ? <NeutralTag>기준선</NeutralTag> : null}
          <DamagedBadge integrity={v.integrity} />
          {v.restoredFromVersion !== null ? <span className="text-[12px] text-ink2">v{v.restoredFromVersion} 로 되돌림</span> : null}
          <span className="ml-auto text-[12px] tabular-nums text-ink2">{formatAgo(v.createdAt, now)}</span>
        </span>
        {showTarget ? (
          <span className="w-full min-w-0 truncate text-[12px] text-ink2">
            {v.targetName ?? v.targetKey ?? v.targetId} · {SCOPE_KO[v.scope]}
          </span>
        ) : null}
        <span className="w-full min-w-0 truncate text-[14px]">{v.origin === 'BASELINE' ? '기준선 — 첫 적용 전 값' : (v.diffSummary ?? '요약 없음')}</span>
        <span className="flex w-full min-w-0 gap-2 text-[12px] text-ink2">
          <span className="min-w-0 flex-1 truncate">
            {v.actor?.email ?? '시스템'}
            {v.origin ? ` · ${ORIGIN_KO[v.origin]}` : ''}
            {test ? ` · ${test}` : ''}
          </span>
          <span aria-hidden="true">›</span>
        </span>
      </button>
    </li>
  )
}
