'use client'

/** 점검 결과 화면의 표시 전용 조각(screens.md §3-2 D): 안내 · 진행 · 총평. */
import { Btn, Card } from '@/components/common/ui'
import { elapsedSec, useNow } from './useNow'

export interface ReviewSummaryData {
  summaryKo?: string | null
  strengths?: string[] | null
  focus?: string[] | null
  skippedMessages?: number | null
}

export function ReviewIntro({
  messageCount,
  error,
  onStart,
  onBack,
  onBlocked,
}: {
  messageCount: number
  error: string | null
  onStart: () => void
  onBack: () => void
  onBlocked: (msg: string) => void
}) {
  const empty = messageCount === 0
  return (
    <Card className="flex flex-col gap-2.5">
      <h2 className="text-[17px] font-semibold break-keep">지금까지의 대화를 점검할까요?</h2>
      {empty ? (
        <p className="text-[15px] text-ink2 break-keep">먼저 대화를 나눠 보세요</p>
      ) : (
        <p className="text-[15px] break-keep">메시지 {messageCount}개가 오간 대화예요. 내가 쓴 문장을 하나씩 보고 틀린 곳을 고쳐 줘요.</p>
      )}
      <p className="rounded-xl bg-surface2 px-3 py-2.5 text-[13px] text-ink2 break-keep">
        ⓘ 점검은 채팅마다 한 번만 할 수 있어요. 점검 뒤에 이어서 쓴 메시지는 점검되지 않아요.
      </p>
      {error ? (
        <p role="alert" className="text-[13px] text-bad break-keep">
          {error}
        </p>
      ) : null}
      <Btn
        className={`w-full ${empty ? 'opacity-40' : ''}`}
        aria-disabled={empty || undefined}
        onClick={() => (empty ? onBlocked('먼저 대화를 나눠 보세요') : onStart())}
      >
        점검 받기
      </Btn>
      <Btn variant="ghost" className="w-full" onClick={onBack}>
        대화로 돌아가기
      </Btn>
    </Card>
  )
}

export function ReviewProgress({ startedAt, progress, waiting }: { startedAt: number; progress: number | null; waiting: boolean }) {
  const now = useNow(true)
  const sec = elapsedSec(now, startedAt)
  return (
    <Card>
      <div role="status" aria-live="polite" className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="flex items-center gap-1">
            {[0, 150, 300].map((d) => (
              <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink2 motion-reduce:animate-none" style={{ animationDelay: `${d}ms` }} />
            ))}
          </span>
          <p className="min-w-0 text-[15px] break-keep">
            {waiting ? '이미 점검이 진행 중이에요. 끝나면 결과가 여기에 보여요.' : '선생님이 문장을 하나씩 살펴보고 있어요'}
            {sec > 0 ? <span className="text-ink2"> · {sec}초</span> : null}
          </p>
        </div>
        {progress !== null && progress > 0 ? (
          <div
            role="progressbar"
            aria-label="점검 진행"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="h-1.5 overflow-hidden rounded bg-surface2"
          >
            <div className="h-full rounded bg-accent" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        ) : null}
        {sec >= 30 ? <p className="text-[13px] text-ink2 break-keep">메시지가 많으면 1분 넘게 걸릴 수 있어요</p> : null}
        <p className="text-[13px] text-ink2 break-keep">화면을 나가도 점검은 계속돼요. 나중에 이 채팅에서 결과를 볼 수 있어요.</p>
      </div>
    </Card>
  )
}

export function ReviewSummary({
  summary,
  counts,
}: {
  summary: ReviewSummaryData | null
  counts: { total: number; accepted: number; rejected: number; pending: number }
}) {
  const strengths = (summary?.strengths ?? []).filter((s) => typeof s === 'string' && s.trim())
  const focus = (summary?.focus ?? []).filter((s) => typeof s === 'string' && s.trim())
  const skipped = summary?.skippedMessages ?? 0
  return (
    <Card className="flex flex-col gap-2.5">
      {summary?.summaryKo ? (
        <div>
          <p className="text-[12px] font-semibold text-ink2">총평</p>
          <p className="mt-0.5 text-[15px] leading-normal break-keep [overflow-wrap:anywhere]">{summary.summaryKo}</p>
        </div>
      ) : null}
      {strengths.length ? (
        <div>
          <p className="text-[12px] font-semibold text-ink2">잘한 점</p>
          <ul className="mt-1 flex flex-col gap-1">
            {strengths.map((s, i) => (
              <li key={i} className="flex min-w-0 items-start gap-2 text-[14px]">
                <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-good" />
                <span className="min-w-0 break-keep [overflow-wrap:anywhere]">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {focus.length ? (
        <div>
          <p className="text-[12px] font-semibold text-ink2">집중할 점</p>
          <ul className="mt-1 flex flex-col gap-1">
            {focus.map((s, i) => (
              <li key={i} className="flex min-w-0 items-start gap-2 text-[14px]">
                <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-bad" />
                <span className="min-w-0 break-keep [overflow-wrap:anywhere]">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-[12px] text-ink2">
        교정 {counts.total}건 · 채택 {counts.accepted} · 무시 {counts.rejected} · 남음 {counts.pending}
      </p>
      {skipped > 0 ? <p className="text-[12px] text-ink2 break-keep">메시지가 많아 오래된 메시지 {skipped}개는 점검하지 않았어요.</p> : null}
    </Card>
  )
}
