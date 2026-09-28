/** 버전 기록 한 행(screens.md §10-2 I) — 번호·상태·(손상이면) "기록 손상"·시각 / 요약 / 작업자·항목 수. 행 전체가 상세 시트를 여는 버튼. */
import type { LexiconVersionDto } from '@/types/lexicon'
import { formatAgo } from '../console/format'
import { IntegrityBadge, VersionStatusBadge } from './Badges'
import { actorLabel, versionCountText } from './lexiconCopy'

export default function VersionRow({ v, now, onOpen }: { v: LexiconVersionDto; now: number; onOpen: (version: number) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onOpen(v.version)} className="flex min-h-[64px] w-full min-w-0 flex-col gap-0.5 px-3.5 py-2.5 text-left">
        <span className="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[15px] font-semibold">v{v.version}</span>
          <VersionStatusBadge status={v.status} />
          <IntegrityBadge integrity={v.integrity} />
          {v.rollbackOf !== null ? <span className="text-[12px] text-ink2">v{v.rollbackOf} 로 되돌림</span> : null}
          <span className="ml-auto text-[12px] tabular-nums text-ink2">{formatAgo(v.createdAt, now)}</span>
        </span>
        <span className="w-full min-w-0 truncate text-[14px]">{v.changeSummary ?? '요약 없음'}</span>
        <span className="flex w-full min-w-0 gap-2 text-[12px] text-ink2">
          <span className="min-w-0 flex-1 truncate">
            {actorLabel(v.actor)} · {versionCountText(v)}
          </span>
          <span aria-hidden="true">›</span>
        </span>
      </button>
    </li>
  )
}
