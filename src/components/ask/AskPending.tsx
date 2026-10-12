'use client'

/**
 * 답을 기다리는 카드(task-064 §25-5 F, D6 C) — 단계 3개 + 경과 초(5초부터, 읽지 않음) + 30·90초 안내. **버튼 없음**(취소·나가기 없음).
 * 단계 문장은 `role=status`(단계가 바뀔 때만 읽힘), 단계 목록은 같은 뜻이라 `aria-hidden`. 깜빡임은 `motion-safe:` 만.
 */
import type { TurnStage } from '@/types/chat'
import TeacherAvatar from '@/components/common/TeacherAvatar'
import { useNow } from '@/components/common/useNow'
import type { TurnPhase } from '@/components/chat/useChatTurn'
import { ASK_COPY } from './askCopy'
import { askElapsedSec, askPendingView } from './logic'

const HINT = 'text-[13px] text-ink2 break-keep'

export function TeacherLine({ teacherName, title }: { teacherName: string; title: string }) {
  return (
    <p className="flex items-center gap-2 text-[12px] text-ink2">
      <TeacherAvatar name={teacherName} />
      {title}
    </p>
  )
}

export default function AskPending({
  teacherName,
  title,
  stage,
  phase,
  since,
}: {
  teacherName: string
  title: string
  stage: TurnStage | null
  phase: TurnPhase
  /** 경과 초 기준 시각(ms) — `askPendingSince` */
  since: number | null
}) {
  const now = useNow(true)
  const sec = askElapsedSec(now, since)
  const { step, hint, showSec } = askPendingView(stage, phase, sec)
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <TeacherLine teacherName={teacherName} title={title} />
      <div className="flex min-w-0 flex-col gap-2 rounded-[6px_16px_16px_16px] border border-line bg-surface px-3.5 py-3">
        <ol aria-hidden="true" className="flex flex-col gap-1 text-[13px] text-ink2">
          {ASK_COPY.steps.map((t, i) => (
            <li key={t} className={`flex items-center gap-2 ${i === step ? 'font-semibold text-ink' : ''}`}>
              <span
                className={`grid h-[18px] w-[18px] flex-none place-items-center rounded-full border-[1.5px] text-[11px] font-bold ${
                  i < step ? 'border-good bg-good-soft text-good' : i === step ? 'border-accent' : 'border-line'
                }`}
              >
                {i < step ? '✓' : i === step ? <i className="h-2 w-2 rounded-full bg-accent motion-safe:animate-pulse" /> : null}
              </span>
              {t}
            </li>
          ))}
        </ol>
        <p role="status" className="text-[14.5px] font-semibold break-keep">
          {ASK_COPY.stageMain[step]}
          {showSec ? (
            <span aria-hidden="true" className="font-normal tabular-nums text-ink2">
              {ASK_COPY.secSuffix(sec)}
            </span>
          ) : null}
        </p>
        <div aria-live="polite" className="flex flex-col gap-2">
          {hint ? (
            <>
              <p className={HINT}>{hint === 'h90' ? ASK_COPY.hint90 : ASK_COPY.hint30}</p>
              <p className={HINT}>{ASK_COPY.leaveLine}</p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
