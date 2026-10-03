'use client'

/**
 * 수업 대기·실패(screens §12-2 D · 데모 v2 `#gen-wait`·`#gen-long`·`#gen-offline`·`#gen-fail`).
 * #60 의 `jobId` 로 #55 를 2 → 3 → 5초(이후 5초) 간격으로 확인한다(화면이 가려지면 멈춤). 경과 시간은 `createdAt`(서버 시각) 기준이라
 * 다시 들어와도 이어진다. 잡은 LLM → SAVE 두 단계만 알려 주므로 % 막대는 그리지 않는다. 오류 코드는 화면에 싣지 않는다.
 */
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiPost } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { readStore } from '@/components/common/storage'
import BackBar from '@/components/shell/BackBar'
import { Btn, Card } from '@/components/common/ui'
import type { LessonDto } from '@/types/lesson'
import type { StartReviewResult } from '@/types/review'
import { GEN, PASTED_TOPIC } from './lessonCopy'
import { genPhase, mmss } from './logic'
import ReviewGenItems from './review/ReviewGenItems'
import { RV_GEN } from './review/reviewCopy'
import { reviewGenPhase, startReviewErrorText } from './review/reviewLogic'
import { useJobWatch } from './useJobWatch'
import { LESSON_KEYS, useLessonCreate } from './useLessonCreate'

export default function LessonGenScreen({ lesson, onSettled, onToast }: { lesson: LessonDto; onSettled: () => void; onToast: (m: string) => void }) {
  const router = useRouter()
  const failed = lesson.status === 'FAILED'
  const { stage, offline } = useJobWatch(failed ? null : lesson.jobId, { delays: [2000, 3000, 5000], onSettled })
  const { create, busy: creating } = useLessonCreate(onToast)
  const isReview = lesson.kind === 'REVIEW'
  const reviewItems = lesson.reviewItems ?? []
  const [restarting, setRestarting] = useState(false)
  const busy = creating || restarting
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (failed) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [failed])
  const elapsed = Math.max(0, Math.floor((now - new Date(lesson.createdAt).getTime()) / 1000))
  const subtitle = lesson.topic?.title ?? PASTED_TOPIC
  const src = failed && !lesson.topic ? readStore('session', LESSON_KEYS.src(lesson.id)) : null

  // 복습 수업 [다시 만들기](§14-2 D) — #63 은 FAILED 레슨을 같은 일정으로 되살린다(★③). 다른 레슨이 오면 그 경로로 옮긴다.
  const restartReview = async (scheduleId: string) => {
    if (restarting) return
    setRestarting(true)
    try {
      const r = await apiPost<StartReviewResult>(`/api/v1/reviews/${encodeURIComponent(scheduleId)}/start`, {})
      if (r.lessonId === lesson.id) onSettled()
      else router.replace(`/study/today/talk/${encodeURIComponent(r.lessonId)}`)
    } catch (e) {
      const { text, reload } = startReviewErrorText(toErr(e))
      onToast(text)
      if (reload) onSettled()
    } finally {
      setRestarting(false)
    }
  }

  const retry = async () => {
    if (isReview) {
      if (lesson.reviewScheduleId) await restartReview(lesson.reviewScheduleId)
      else router.push('/study/today')
      return
    }
    if (lesson.topic) {
      if ((await create({ topicId: lesson.topic.id })) === 'ok') onSettled()
    } else if (src) {
      if ((await create({ sourceText: src })) === 'ok') onSettled()
    } else router.push('/study/today/talk/new/paste')
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-ground">
      <BackBar
        backHref="/study/today"
        backLabel={GEN.backToday}
        title={isReview ? RV_GEN.backTitle : GEN.title}
        subtitle={isReview ? RV_GEN.backSub(reviewItems.length > 0 ? reviewItems.length : null) : subtitle}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-4 pb-8 pt-3.5">
        {failed ? (
          <>
            <div className="flex flex-col items-center pt-6 text-center">
              <span aria-hidden="true" className="grid h-[52px] w-[52px] place-items-center rounded-full bg-bad-soft text-[22px] font-bold text-bad">
                !
              </span>
              <h2 tabIndex={-1} className="mt-3 text-[19px] font-bold">
                {isReview ? RV_GEN.failTitle : GEN.failTitle}
              </h2>
              <p className="mt-1.5 text-[14px] break-keep">{GEN.failBody}</p>
            </div>
            <div>
              <Btn className="w-full" aria-busy={busy || undefined} onClick={() => void retry()}>
                {busy ? '만드는 중…' : !isReview && !lesson.topic && !src ? GEN.repaste : GEN.retry}
              </Btn>
              {isReview ? (
                <Link href="/study/today" className="mt-2 flex h-12 w-full items-center justify-center rounded-xl border border-line bg-surface text-[15px] font-semibold">
                  {RV_GEN.backToday}
                </Link>
              ) : (
                <Link href="/study/today/talk/new" className="mt-2 flex h-12 w-full items-center justify-center rounded-xl border border-line bg-surface text-[15px] font-semibold">
                  {GEN.otherTopic}
                </Link>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center pt-6 text-center">
              <span aria-hidden="true" className="h-10 w-10 rounded-full border-[3px] border-accent border-t-transparent motion-safe:animate-spin" />
              <h2 className="mt-3 text-[19px] font-bold">{isReview ? RV_GEN.title : GEN.hero}</h2>
              <p role="status" aria-live="polite" className="mt-1.5 text-[14px] break-keep">
                {isReview ? reviewGenPhase(elapsed, stage) : genPhase(elapsed, stage)}
              </p>
              <p className="mt-1 text-[12px] tabular-nums text-ink2">{GEN.elapsed(mmss(elapsed))}</p>
            </div>
            {offline ? (
              <p role="status" className="rounded-xl bg-surface2 px-3.5 py-2.5 text-[13px] break-keep">
                {GEN.offline}
              </p>
            ) : null}
            {isReview && reviewItems.length > 0 ? (
              <ReviewGenItems items={reviewItems} />
            ) : (
              <Card flat>
                <h3 className="text-[15px] font-semibold">{GEN.orderTitle}</h3>
                <ol className="mt-2 flex flex-col gap-2">
                  {GEN.order.map(([name, body], i) => (
                    <li key={name} className="flex items-start gap-2.5">
                      <span aria-hidden="true" className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full bg-surface text-[12px] font-semibold">
                        {i + 1}
                      </span>
                      <p className="min-w-0 pt-0.5 text-[14px] break-keep">
                        <b>{name}</b> · {body}
                      </p>
                    </li>
                  ))}
                </ol>
              </Card>
            )}
            <p className="text-[12px] text-ink2 break-keep">{GEN.leaveNote}</p>
            <Link href="/study/today" className="flex h-12 w-full items-center justify-center rounded-xl border border-line bg-surface text-[15px] font-semibold">
              {GEN.backToday}
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
