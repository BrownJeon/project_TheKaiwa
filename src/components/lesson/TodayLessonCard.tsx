'use client'

/**
 * 오늘 홈 "오늘의 회화" 카드(screens §12-2 A · 데모 v2 `#home-*`) — 상태는 `deriveLessonCard`(순수)가 #58 한 번으로 정한다.
 * 만드는 중이면 화면이 보이는 동안 잡(#55)을 5초마다 확인하고 끝나면 #58 을 다시 읽는다(`onReload`).
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatMonthDay } from '@/components/vocab/format'
import { readStore } from '@/components/common/storage'
import { Badge, Btn, BtnRow, Card, ErrorBlock } from '@/components/common/ui'
import type { TodayLessons } from '@/types/lesson'
import { deriveLessonCard, correctFromScore } from './logic'
import { HOME, PASTED_TOPIC, STAGE_NAMES, stageLabel } from './lessonCopy'
import { LESSON_KEYS, lessonPath, useLessonCreate } from './useLessonCreate'
import { useJobWatch } from './useJobWatch'

export function MiniSteps({ done }: { done: number }) {
  return (
    <ol aria-label={HOME.stepsAria(done)} className="mt-2.5 grid grid-cols-5 gap-1">
      {STAGE_NAMES.map((name, i) => {
        const cls =
          i < done ? 'bg-good-soft font-semibold text-good' : i === done ? 'bg-surface font-semibold text-ink ring-[1.5px] ring-accent ring-inset' : 'bg-surface2 text-ink2'
        return (
          <li key={name} className={`grid h-7 min-w-0 place-items-center truncate rounded-lg px-0.5 text-[11.5px] ${cls}`}>
            {name}
            {i < done ? ' ✓' : ''}
          </li>
        )
      })}
    </ol>
  )
}

function Head({ minutes }: { minutes?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h2 id="lesson-card-title" className="text-[15px] font-semibold">
        {HOME.title}
      </h2>
      {minutes ? <span className="text-[12px] text-ink2">{HOME.minutes}</span> : null}
    </div>
  )
}

export default function TodayLessonCard({
  state,
  today,
  onReload,
  onToast,
  errorText = HOME.loadError,
}: {
  state: 'loading' | 'error' | 'ready'
  today: TodayLessons | null
  onReload: () => void
  onToast: (msg: string) => void
  /** #58 실패 문구 — 오늘 홈은 복습 카드와 합친 문구를 넘긴다(task-010b, Leader ⑥). */
  errorText?: string
}) {
  const router = useRouter()
  const { create, busy } = useLessonCreate(onToast)
  const card = deriveLessonCard(state, today)
  useJobWatch(card.kind === 'gen' ? card.lesson.jobId : null, { delays: [5000], onSettled: onReload })
  const topicName = (t: { title: string } | null) => t?.title ?? PASTED_TOPIC
  const rec = today?.recommendation ?? null
  const pick = (
    <Link href="/study/today/talk/new" className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold">
      {HOME.pickTopic}
    </Link>
  )

  let body: React.ReactNode
  switch (card.kind) {
    case 'loading':
      body = (
        <>
          <Head />
          <p role="status" className="mt-1 text-[13px] text-ink2">
            {HOME.loading}
          </p>
        </>
      )
      break
    case 'error':
      body = (
        <>
          <Head />
          <div className="mt-2">
            <ErrorBlock message={errorText} onRetry={onReload} />
          </div>
        </>
      )
      break
    case 'gen':
      body = (
        <>
          <Head />
          <p className="mt-1 text-[15px] font-semibold">{HOME.genTitle}</p>
          <p className="mt-1 text-[13px] text-ink2 break-keep">{HOME.genBody(topicName(card.lesson.topic))}</p>
          <div aria-hidden="true" className="mt-3 h-1 overflow-hidden rounded-full bg-surface2">
            <div className="h-full w-2/5 rounded-full bg-accent motion-safe:animate-[lesson-indet_1.6s_ease-in-out_infinite]" />
          </div>
          <Btn variant="ghost" className="mt-3 w-full" onClick={() => router.push(lessonPath(card.lesson.id))}>
            {HOME.genOpen}
          </Btn>
        </>
      )
      break
    case 'progress': {
      const topic = card.topic ?? PASTED_TOPIC
      body = (
        <>
          <Head />
          <p className="mt-1 text-[15px] font-semibold">{card.ready ? HOME.readyTitle : HOME.progressTitle}</p>
          <p className="mt-1 text-[13px] text-ink2 break-keep [overflow-wrap:anywhere]">
            {card.ready ? HOME.readyBody(topic) : HOME.progressBody(topic, card.date ? formatMonthDay(card.date) : HOME.today, card.stageDone)}
          </p>
          <MiniSteps done={card.stageDone} />
          {card.stageDone < 5 ? <p className="mt-2 text-[12px] text-ink2">{HOME.nextStage(stageLabel(card.stageDone + 1))}</p> : null}
          <Btn className="mt-3 w-full" onClick={() => router.push(lessonPath(card.lessonId))}>
            {card.ready ? HOME.start : HOME.resume}
          </Btn>
        </>
      )
      break
    }
    case 'genfail': {
      const l = card.lesson
      body = (
        <>
          <Head />
          <p className="mt-1 text-[15px] font-semibold">{HOME.failTitle}</p>
          <p className="mt-1 text-[13px] text-ink2 break-keep">{HOME.failBody(topicName(l.topic))}</p>
          <BtnRow>
            <Btn
              aria-busy={busy || undefined}
              onClick={() => {
                if (l.topic) return void create({ topicId: l.topic.id })
                const src = readStore('session', LESSON_KEYS.src(l.id))
                if (src) void create({ sourceText: src })
                else router.push('/study/today/talk/new/paste')
              }}
            >
              {busy ? HOME.creating : HOME.retry}
            </Btn>
            {pick}
          </BtnRow>
        </>
      )
      break
    }
    case 'done': {
      const l = card.lesson
      body = (
        <>
          <Head />
          <p className="mt-1 text-[15px] font-semibold">{HOME.doneTitle}</p>
          <p className="mt-1 text-[13px] text-ink2 break-keep">{HOME.doneBody(topicName(l.topic), correctFromScore(l.score), l.speaking ?? null)}</p>
          {card.nextPreview ? (
            <div className="mt-2.5 rounded-xl bg-accent-soft px-3 py-2.5">
              <p className="text-[12px] text-ink2">{HOME.nextTime}</p>
              <p className="mt-0.5 text-[14px] font-semibold text-ink break-keep">{card.nextPreview.titleKo}</p>
            </div>
          ) : null}
          <BtnRow>
            <Btn
              aria-busy={busy || undefined}
              onClick={() => {
                const topicId = l.topic?.id ?? rec?.topicId
                if (topicId) void create({ topicId })
                else router.push('/study/today/talk/new')
              }}
            >
              {busy ? HOME.creating : HOME.nextLesson}
            </Btn>
            {pick}
          </BtnRow>
          <button type="button" onClick={() => router.push(lessonPath(l.id))} className="mt-1 flex h-11 w-full items-center justify-center text-[13px] font-medium text-ink2 underline underline-offset-4">
            {HOME.doneResult}
          </button>
        </>
      )
      break
    }
    default: {
      body = (
        <>
          <Head minutes />
          <p className="mt-1 text-[13px] text-ink2 break-keep">{HOME.startIntro}</p>
          {rec ? (
            <>
              <div className="mt-2.5 rounded-xl bg-surface2 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-ink2">{HOME.recommended}</span>
                  <span className="[&>span]:bg-surface">
                    <Badge tone="neutral">{rec.level}</Badge>
                  </span>
                </div>
                <p className="mt-0.5 text-[15px] font-semibold break-keep [overflow-wrap:anywhere]">{rec.topicTitle}</p>
                <p className="mt-0.5 text-[12px] text-ink2 break-keep">
                  {rec.reason === 'CONTINUE' && rec.nextPreview ? HOME.reasonContinue(rec.nextPreview.titleKo) : rec.reason === 'NEXT_TOPIC' ? HOME.reasonNextTopic : HOME.reasonStart}
                </p>
              </div>
              <BtnRow>
                <Btn aria-label={HOME.createAria(rec.topicTitle)} aria-busy={busy || undefined} onClick={() => void create({ topicId: rec.topicId })}>
                  {busy ? HOME.creating : HOME.create}
                </Btn>
                {pick}
              </BtnRow>
            </>
          ) : (
            <Link href="/study/today/talk/new" className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-accent text-[15px] font-semibold text-on-accent">
              {HOME.pickTopic}
            </Link>
          )}
        </>
      )
    }
  }

  return (
    <section aria-labelledby="lesson-card-title" className="mt-[18px] min-w-0">
      <Card>{body}</Card>
    </section>
  )
}
