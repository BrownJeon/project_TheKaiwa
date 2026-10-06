'use client'

/**
 * 역할극 방의 띠 두 개(가이드 §3-D).
 *  - `RolePlayFinishNudge`(v1 결정 c=B, `rp-teacher-end`): 직전 턴이 `done.endOfTopic` 이면 띠 자리 5순위에 — [마치고 결과 보기]는 확인 없이 바로 기록,
 *    [조금 더 하기]는 띠를 닫고 토스트. 닫음 규칙은 일반 회화의 `TopicEndNudge` 와 같다(방이 넘겨 준다).
 *  - `RolePlayEndedBar`(`rp-ended`): 마친 역할극의 입력 바 자리 — [결과 보기]·[다시 하기](같은 상황으로 새 역할극, #28).
 */
import { ErrorBox } from '@/components/challenge/parts'
import type { StartFailure } from './logic'
import { ROOM, SHEET } from './scenarioCopy'
import { useStartRolePlay } from './useStartRolePlay'
import type { RolePlay } from './useRolePlay'

export function RolePlayFinishNudge({ rp, onClose, onToast }: { rp: RolePlay; onClose: () => void; onToast: (msg: string) => void }) {
  return (
    <div role="status" className="min-w-0 rounded-[14px] bg-accent-soft p-3">
      <p className="text-[14px] text-ink break-keep">
        <b className="font-semibold">{ROOM.nudgeLead}</b>
        {ROOM.nudgeAsk}
      </p>
      <div className="mt-2 flex min-w-0 gap-2 [&>*]:min-w-0 [&>*]:flex-1">
        <button type="button" onClick={rp.finishNow} className="h-11 truncate rounded-xl bg-accent px-3 text-[14px] font-semibold text-on-accent">
          {ROOM.nudgeFinish}
        </button>
        <button
          type="button"
          onClick={() => {
            onClose()
            onToast(ROOM.nudgeMoreToast)
          }}
          className="h-11 truncate rounded-xl border border-line bg-surface px-3 text-[14px] font-semibold text-ink"
        >
          {ROOM.nudgeMore}
        </button>
      </div>
    </div>
  )
}

const START_FAIL_TEXT: Record<StartFailure, string> = { gone: SHEET.goneBody, archived: SHEET.archived, rate: SHEET.startRate, fail: SHEET.startFail }

export function RolePlayEndedBar({ rp }: { rp: RolePlay }) {
  const start = useStartRolePlay()
  const v = rp.view
  const starting = start.state.phase === 'starting'
  const failed = start.state.phase === 'failed' ? start.state.failure : null
  return (
    <div className="flex-none border-t border-line bg-surface px-4 pt-2.5" style={{ paddingBottom: 'max(8px, var(--safe-bottom))' }}>
      <p className="text-[14px] font-semibold text-ink break-keep">{ROOM.endedTitle}</p>
      <p className="text-[12px] text-ink2 break-keep">{ROOM.endedBody}</p>
      {failed ? <ErrorBox className="mt-2" title={START_FAIL_TEXT[failed]} /> : null}
      <div className="mt-2 flex min-w-0 gap-2 [&>*]:min-w-0 [&>*]:flex-1">
        <button type="button" onClick={rp.openResult} className="h-11 truncate rounded-xl bg-accent px-3 text-[14px] font-semibold text-on-accent">
          {ROOM.endedResult}
        </button>
        <button
          type="button"
          aria-disabled={starting || !v || undefined}
          aria-busy={starting || undefined}
          onClick={() => {
            if (!starting && v) void start.start(v.id, v.lesson?.id ? { lessonId: v.lesson.id } : undefined)
          }}
          className={`h-11 truncate rounded-xl border border-line bg-surface px-3 text-[14px] font-semibold text-ink ${starting ? 'opacity-60' : ''}`}
        >
          {starting ? ROOM.endedRetrying : ROOM.endedRetry}
        </button>
      </div>
    </div>
  )
}

