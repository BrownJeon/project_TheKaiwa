/** 마지막 갱신 줄(screens.md §6-2 C). 다시 불러오는 동안 이전 데이터는 그대로 두고 이 줄만 "불러오는 중…". */
import { formatClockSec } from './format'

export default function RefreshLine({
  loadedAt,
  reloading,
  polling = false,
  onReload,
}: {
  loadedAt: number | null
  reloading: boolean
  polling?: boolean
  onReload: () => void
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-[12px] text-ink2">
      <span className="min-w-0 flex-1 truncate">
        {loadedAt ? `마지막 갱신 ${formatClockSec(loadedAt)}` : '아직 불러오지 않았어요'}
        {polling ? ' · 30초마다 새로 고침' : ''}
      </span>
      <button type="button" aria-busy={reloading} onClick={onReload} disabled={reloading} className="h-11 flex-none px-2 text-[13px] font-medium text-ink disabled:opacity-60">
        {reloading ? '불러오는 중…' : '다시 불러오기'}
      </button>
    </div>
  )
}
