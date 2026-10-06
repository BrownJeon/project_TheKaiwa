'use client'

/**
 * 마치기 시트(가이드 §3-F, v1 `#rp-confirm`·`#rp-confirm-empty` + ★정리 중·기록 실패). 공용 `Sheet`.
 *  - 내 말 ≥1: 확인 → [마치고 결과 보기] 로 #167 기록(성공하면 방이 결과 화면으로 바꿔 간다).
 *  - 내 말 0(또는 서버 409 NO_TURNS): 결과가 남지 않는다는 안내 → [계속하기] · [그만두기](빈 대화를 지우고 시나리오로, D-7).
 *  - 기록 중에는 닫을 수 없다(`dismissible=false`). 실패하면 시트 안에서 [다시 시도](기록은 서버에서 한 번) · [나중에 하기].
 * 뱃지: 내 말 수 · 핵심 표현(체크 보기일 때만) · 단계(진행값이 있을 때만 — 지금 서버는 없음).
 */
import Sheet from '@/components/common/Sheet'
import { Badge } from '@/components/common/ui'
import { stepPosition } from './logic'
import { END } from './scenarioCopy'
import type { RolePlay } from './useRolePlay'

const PRIMARY = 'h-11 truncate rounded-xl bg-accent px-3 text-[14px] font-semibold text-on-accent'
const GHOST = 'h-11 truncate rounded-xl border border-line bg-surface px-3 text-[14px] font-semibold text-ink'

export default function RolePlayEndSheet({ rp }: { rp: RolePlay }) {
  const v = rp.view
  const { open, phase } = rp.sheet
  if (!v) return null
  const empty = phase === 'empty' || phase === 'quitting'
  const total = v.keyExpressions.length
  const used = v.keyExpressions.filter((e) => rp.progress.usedIds.includes(e.id)).length
  const at = stepPosition(rp.progress.stepIndex, v.steps.length)
  const working = phase === 'busy' || phase === 'quitting'
  return (
    <Sheet open={open && !!v && !rp.ended} title={empty ? END.emptyTitle : END.confirmTitle} onClose={rp.closeEnd} dismissible={!working}>
      <div className="flex min-w-0 flex-col gap-3">
        <p className="text-[14px] text-ink break-keep">{empty ? END.emptyBody : END.confirmBody}</p>
        {!empty ? (
          <div className="flex min-w-0 flex-wrap gap-1.5">
            <Badge>{END.badgeTurns(rp.turns)}</Badge>
            {!rp.checksHidden && total > 0 ? <Badge>{END.badgeExpr(used, total)}</Badge> : null}
            {at !== null ? <Badge>{END.badgeSteps(at + 1, v.steps.length)}</Badge> : null}
          </div>
        ) : null}
        {phase === 'fail' ? (
          <p role="alert" className="rounded-xl bg-bad-soft px-3.5 py-3 text-[13px] text-bad break-keep">
            {END.fail}
          </p>
        ) : null}
        {phase === 'busy' ? (
          <div aria-busy="true">
            <p role="status" className="flex h-11 items-center justify-center rounded-xl bg-surface2 px-3 text-[14px] font-semibold text-ink break-keep">
              {END.busy}
            </p>
            <p className="mt-1 text-center text-[12px] text-ink2">{END.busyNote}</p>
          </div>
        ) : empty ? (
          <div className="flex min-w-0 gap-2 [&>*]:min-w-0 [&>*]:flex-1">
            <button type="button" onClick={rp.closeEnd} aria-disabled={working || undefined} className={PRIMARY}>
              {END.keepGoing}
            </button>
            <button
              type="button"
              aria-disabled={working || undefined}
              aria-busy={phase === 'quitting' || undefined}
              onClick={() => {
                if (!working) void rp.quit()
              }}
              className={GHOST}
            >
              {phase === 'quitting' ? END.quitting : END.quit}
            </button>
          </div>
        ) : (
          <div className="flex min-w-0 gap-2 [&>*]:min-w-0 [&>*]:flex-1">
            <button type="button" onClick={() => void rp.finish()} className={PRIMARY}>
              {phase === 'fail' ? END.retry : END.finish}
            </button>
            <button type="button" onClick={rp.closeEnd} className={GHOST}>
              {phase === 'fail' ? END.later : END.keepGoing}
            </button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
