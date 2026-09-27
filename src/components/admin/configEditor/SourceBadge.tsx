/**
 * 출처(Source) 뱃지 `{층 번호} {SOURCE}`(screens.md §6-2 C). 강조는 둘만 — ENVIRONMENT(굵은 윤곽: "env 가 덮었다"),
 * RUNTIME_OVERRIDE(빨강 바탕). 나머지는 회색.
 */
import type { ConfigSourceName } from '@/types/admin'
import { SOURCE_KO, SOURCE_ORDER, sourceLayer } from '../console/labels'

function tone(source: ConfigSourceName): string {
  if (source === 'ENVIRONMENT') return 'border border-ink bg-surface font-semibold text-ink'
  if (source === 'RUNTIME_OVERRIDE') return 'bg-bad-soft text-bad'
  return 'bg-surface2 text-ink2'
}

export default function SourceBadge({ source }: { source: ConfigSourceName }) {
  const n = sourceLayer(source)
  return (
    <span
      aria-label={`출처 ${n}층 ${source}, ${SOURCE_KO[source] ?? source}`}
      className={`inline-flex h-[22px] min-w-0 max-w-full items-center gap-1 rounded-md px-1.5 font-mono text-[11px] ${tone(source)}`}
    >
      <span className="tabular-nums">{n}</span>
      <span className="truncate">{source}</span>
    </span>
  )
}

export function SourceLegend() {
  return (
    <div className="rounded-[14px] border border-line bg-surface p-3">
      <ol className="grid gap-1.5">
        {SOURCE_ORDER.map((s) => (
          <li key={s} className="flex min-w-0 flex-wrap items-center gap-2">
            <SourceBadge source={s} />
            <span className="text-[13px] text-ink">{SOURCE_KO[s]}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[12px] text-ink2 break-keep">
        위 층이 아래 층을 키 하나씩 덮어요. USER_SETTING·RUNTIME_OVERRIDE 는 이 화면(관리 설정)에는 보통 나오지 않아요.
      </p>
    </div>
  )
}
