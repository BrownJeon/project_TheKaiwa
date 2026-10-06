'use client'

/**
 * 종료 카드(screens §12-2 K · 데모 v2 `#end`) — 방금 끝냈으면 #62 `result`, 다시 들어왔으면 #60 DONE 에서 같은 값을 계산(`endResultFrom`).
 * 붙여넣은 수업(주제 없음)은 다음 수업·이어 말하기 대신 [다른 문장으로 수업 만들기]·[주제 고르기](§12-11 ③ Leader 판정).
 * "넣은 단어" 수는 이 수업 화면에서 [단어장에 추가]를 누른 수만(모르면 줄을 숨김 — §12-11 ⑥).
 * 복습 수업(task-010b, screens §14-2 I)은 `kind` 분기를 `topic` 분기보다 먼저 둔다 — 머리·기록 문구와 "다음 복습" 카드 + [오늘로]만 바뀐다.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { apiPost } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { kstDateKey } from '@/components/common/format'
import { useAnnotations } from '@/components/common/japanese/annotations'
import { readStore } from '@/components/common/storage'
import { Btn, BtnRow, Card } from '@/components/common/ui'
import BackBar from '@/components/shell/BackBar'
import { formatMonthDay } from '@/components/vocab/format'
import type { ChallengeProgress } from '@/types/challenge'
import type { LessonContent, LessonDto } from '@/types/lesson'
import ChallengeEndLine from './ChallengeEndLine'
import type { ReviewItem } from '@/types/review'
import { END, FLASH, HOME, PASTED_TOPIC } from './lessonCopy'
import type { EndResult } from './logic'
import { ExprChip, targetsOf } from './parts'
import NextReviewCard from './review/NextReviewCard'
import { RV_END } from './review/reviewCopy'
import { useNextReview, type FreshReviewEnd } from './review/useNextReview'
import { LESSON_KEYS, useLessonCreate } from './useLessonCreate'

function ReviewNext({ lesson, fresh, items, teacherName }: { lesson: LessonDto; fresh: FreshReviewEnd | null; items: readonly ReviewItem[]; teacherName: string }) {
  const { state, next } = useNextReview(lesson.id, lesson.nextReview ?? null, fresh)
  return <NextReviewCard state={state} next={next} items={items} teacherName={teacherName} />
}

export default function LessonEnd({
  lesson,
  result,
  onToast,
  review = null,
  teacherName = '선생님',
  challenge = null,
}: {
  lesson: LessonDto & { content: LessonContent }
  result: EndResult
  onToast: (m: string) => void
  /** 복습 수업을 방금 끝냈으면 #62 의 복습 칸(다시 들어왔으면 null — #60 `nextReview` 를 쓴다). */
  review?: FreshReviewEnd | null
  teacherName?: string
  /** #62 `challenge`(task-044) — 방금 끝냈고 챌린지 과제로 세어졌을 때만. 다시 들어왔으면 null. */
  challenge?: ChallengeProgress | null
}) {
  const router = useRouter()
  const { create, busy } = useLessonCreate(onToast)
  const [talking, setTalking] = useState(false)
  const [added] = useState(() => Number(readStore('session', LESSON_KEYS.added(lesson.id)) ?? '0') || 0)
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    titleRef.current?.focus()
  }, [])
  const topic = lesson.topic
  const topicName = topic?.title ?? PASTED_TOPIC
  const date = lesson.completedAt ? formatMonthDay(kstDateKey(lesson.completedAt)) : formatMonthDay(lesson.date)
  const used = targetsOf(lesson.content, result.usedIds)
  const missed = targetsOf(lesson.content, result.missedIds)
  const total = used.length + missed.length
  // 쓴 표현·써 볼 표현 칩의 히라가나·한글 층(task-033 S1-A) — 한 묶음으로 분석. 일반 수업 종료 화면도 같은 칩이라 함께 적용된다.
  const exprAnns = useAnnotations([...used, ...missed].map((t) => t.ja))
  const isReview = lesson.kind === 'REVIEW'
  const reviewItems = lesson.reviewItems ?? []

  const talk = async () => {
    if (!topic || talking) return
    setTalking(true)
    try {
      const chat = await apiPost<{ id: string }>('/api/v1/chats', { kind: 'TALK', topicId: topic.id })
      router.push(`/study/ai/talk/${encodeURIComponent(chat.id)}`)
    } catch (e) {
      setTalking(false)
      const err = toErr(e)
      onToast(err.status === 404 ? FLASH.topicMissing : err.status === 0 ? FLASH.network : FLASH.failed)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-ground">
      <BackBar backHref="/study/today" backLabel={END.today} title={isReview ? RV_END.title : END.title} subtitle={isReview ? RV_END.subtitle(date) : END.subtitle(topicName, date)} />
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-4 pb-8 pt-3.5">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="grid h-[52px] w-[52px] flex-none place-items-center rounded-full bg-good-soft text-[22px] font-bold text-good">
            ✓
          </span>
          <div className="min-w-0">
            <h2 ref={titleRef} tabIndex={-1} className="text-[20px] font-bold outline-none">
              {isReview ? RV_END.title : END.title}
            </h2>
            <p lang="ja" className="text-[14px] [overflow-wrap:anywhere]">
              {lesson.content.title}
            </p>
            <p className="text-[12px] text-ink2 break-keep">{isReview && reviewItems.length > 0 ? RV_END.heroSub(reviewItems.length, lesson.content.titleKo) : lesson.content.titleKo}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            [`${result.correct}/${result.total}`, END.statQuiz],
            [String(result.applicationDone), END.statApply],
            [`${used.length}/${total}`, END.statExpr],
          ].map(([n, label]) => (
            <div key={label} className="flex min-w-0 flex-col items-center rounded-xl border border-line bg-surface py-2.5">
              <b className="text-[20px] tabular-nums">{n}</b>
              <span className="text-[12px] text-ink2">{label}</span>
            </div>
          ))}
        </div>
        <ChallengeEndLine challenge={challenge} topicTitle={topic?.title} />
        <Card>
          <h3 className="text-[15px] font-semibold">{END.usedTitle}</h3>
          {used.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {used.map((t, i) => (
                <ExprChip key={t.id} ja={t.ja} ko={t.ko} ann={exprAnns[i]} tone="good" tail={<span aria-hidden="true" className="text-[12px] font-bold text-good">✓</span>} />
              ))}
            </ul>
          ) : null}
          {missed.length ? (
            <>
              <h3 className="mt-3 text-[15px] font-semibold">{END.missedTitle}</h3>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {missed.map((t, i) => (
                  <ExprChip key={t.id} ja={t.ja} ko={t.ko} ann={exprAnns[used.length + i]} />
                ))}
              </ul>
            </>
          ) : null}
          <p className="mt-3 text-[12px] text-ink2 break-keep">{isReview ? RV_END.recordNote : END.recorded}</p>
          {added > 0 ? (
            <Link href="/drawer/words" className="mt-2 flex min-h-11 items-center border-t border-line pt-2 text-[13px] font-semibold text-accent">
              {END.addedWords(added)}
            </Link>
          ) : null}
        </Card>
        {isReview ? (
          <>
            <ReviewNext lesson={lesson} fresh={review} items={reviewItems} teacherName={teacherName} />
            <div>
              <Link className="flex h-12 w-full items-center justify-center rounded-xl bg-accent px-4 text-[15px] font-semibold text-on-accent" href="/study/today">
                {RV_END.backToday}
              </Link>
              <p className="mt-2 text-center text-[12px] text-ink2 break-keep">{RV_END.backTodayNote}</p>
            </div>
          </>
        ) : topic ? (
          <>
            {result.nextPreview ? (
              <section aria-labelledby="end-next" className="rounded-[14px] bg-accent-soft p-3.5">
                <p className="text-[13px] text-ink2">{END.nextTime}</p>
                <h3 id="end-next" className="mt-0.5 text-[17px] font-bold text-ink break-keep">
                  {result.nextPreview.titleKo}
                </h3>
                <p className="mt-0.5 text-[14px] text-ink break-keep">{result.nextPreview.teaserKo}</p>
                <Btn className="mt-3 w-full" aria-busy={busy || undefined} onClick={() => void create({ topicId: topic.id })}>
                  {busy ? HOME.creating : END.nextLesson}
                </Btn>
              </section>
            ) : (
              <Btn className="w-full" aria-busy={busy || undefined} onClick={() => void create({ topicId: topic.id })}>
                {busy ? HOME.creating : END.nextLesson}
              </Btn>
            )}
            <div>
              <Btn variant="ghost" className="w-full" aria-busy={talking || undefined} onClick={() => void talk()}>
                {END.talk}
              </Btn>
              <p className="mt-2 text-center text-[12px] text-ink2 break-keep">{END.talkNote(topic.title)}</p>
            </div>
          </>
        ) : (
          <BtnRow>
            <Link href="/study/today/talk/new/paste" className="inline-flex h-12 items-center justify-center rounded-xl bg-accent px-4 text-[15px] font-semibold text-on-accent">
              {END.otherText}
            </Link>
            <Link href="/study/today/talk/new" className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold">
              {END.pickTopic}
            </Link>
          </BtnRow>
        )}
        {isReview ? null : (
          <Link href="/study/today" className="flex h-11 shrink-0 items-center justify-center text-[13px] font-medium text-ink2 underline underline-offset-4">
            {END.today}
          </Link>
        )}
      </div>
    </div>
  )
}
