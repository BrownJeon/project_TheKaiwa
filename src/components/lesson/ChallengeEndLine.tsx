'use client'

/**
 * 수업 종료 카드의 챌린지 한 줄(task-044 가이드 §3-9) — #62 응답 `challenge` 가 있을 때만(방금 끝냈을 때). 복습·붙여넣기·다른 주제·다시 들어옴은 null → 그리지 않는다.
 * 목표 달성 토스트는 `LessonScreen` 이 한 번 띄운다. 모양은 글자 + 기호(✓ · 일부 반원 그림 `PartialMark`)로 함께.
 */
import Link from 'next/link'
import { PartialMark } from '@/components/challenge/parts'
import { LESSON_END_CH } from '@/components/vocab/topicCopy'
import type { ChallengeProgress } from '@/types/challenge'

const LINK = 'inline-flex min-h-11 items-center text-[13px] font-semibold text-ink underline underline-offset-4'

export default function ChallengeEndLine({ challenge, topicTitle }: { challenge: ChallengeProgress | null | undefined; topicTitle: string | null | undefined }) {
  if (!challenge) return null
  const met = challenge.goalMet || challenge.goalMetNow
  return (
    <div className="flex min-w-0 gap-3 rounded-[14px] border border-line bg-surface p-3.5">
      <span
        aria-hidden="true"
        className={`grid h-8 w-8 flex-none place-items-center rounded-full text-[15px] font-bold ${met ? 'bg-good-soft text-good' : 'bg-warn-soft text-ink'}`}
      >
        {met ? '✓' : <PartialMark />}
      </span>
      <div className="min-w-0 flex-1">
        {challenge.goalMetNow ? (
          <>
            <b className="block text-[15px]">{LESSON_END_CH.metNowTitle}</b>
            <p className="mt-0.5 text-[13px] text-ink2 break-keep [overflow-wrap:anywhere]">{LESSON_END_CH.metNowBody(topicTitle ?? '', challenge.dayIndex)}</p>
          </>
        ) : challenge.goalMet ? (
          <b className="block text-[14px] break-keep">{LESSON_END_CH.metTitle(challenge.dayIndex)}</b>
        ) : (
          <>
            <b className="block text-[14px] break-keep">{LESSON_END_CH.leftTitle(challenge.dayIndex)}</b>
            <p className="mt-0.5 text-[13px] text-ink2">{LESSON_END_CH.leftBody}</p>
          </>
        )}
        {met ? (
          <Link href={`/plan/challenge/${encodeURIComponent(challenge.challengeId)}`} className={LINK}>
            {LESSON_END_CH.toChallenge}
          </Link>
        ) : (
          <Link href="/study/today" className={LINK}>
            {LESSON_END_CH.toToday}
          </Link>
        )}
      </div>
    </div>
  )
}
