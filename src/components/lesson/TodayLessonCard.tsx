'use client'

/**
 * 오늘 홈 "오늘의 회화" 카드(screens §12-2 A · 데모 v2 `#home-*`) — 상태는 `deriveLessonCard`(순수)가 #58 한 번으로 정한다.
 * 만드는 중이면 화면이 보이는 동안 잡(#55)을 5초마다 확인하고 끝나면 #58 을 다시 읽는다(`onReload`).
 * task-044: 진행 중 챌린지에 회화 과제가 있으면 `challenge` 가 카드의 주인(`deriveChallengeLessonCard`) — [오늘 수업 만들기]는 앱에서 이 카드에만 있다(N3 A).
 * #158 을 읽는 동안(`challengeLoading`)은 몸통 자리표시(`CardLoadingBody`) — 챌린지 카드로 바뀌며 깜빡이지 않게. 「불러오는 중…」 글자는 그리지 않는다(task-046).
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatMonthDay } from '@/components/vocab/format'
import { CardLoadingBody } from '@/components/vocab/TodaySkeleton'
import { readStore } from '@/components/common/storage'
import { Badge, Btn, BtnRow, Card, ErrorBlock } from '@/components/common/ui'
import type { ChallengeLessonTask } from '@/types/challenge'
import type { TodayLessons } from '@/types/lesson'
import { LESSON_CH } from '@/components/vocab/topicCopy'
import type { ChallengeCtx } from '@/components/vocab/topicLogic'
import { deriveChallengeLessonCard, deriveLessonCard, correctFromScore, type AuxLessonLine, type ChallengeLessonCard } from './logic'
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

function Head({ minutes, chip }: { minutes?: boolean; chip?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
      <h2 id="lesson-card-title" className="text-[15px] font-semibold">
        {HOME.title}
      </h2>
      {chip ? (
        <span className="mr-auto inline-flex h-6 min-w-0 items-center truncate rounded-full bg-surface2 px-2 text-[12px] font-semibold text-ink2">{chip}</span>
      ) : null}
      {minutes ? <span className="text-[12px] text-ink2">{HOME.minutes}</span> : null}
    </div>
  )
}

function IndetBar() {
  return (
    <div aria-hidden="true" className="mt-3 h-1 overflow-hidden rounded-full bg-surface2">
      <div className="h-full w-2/5 rounded-full bg-accent motion-safe:animate-[lesson-indet_1.6s_ease-in-out_infinite]" />
    </div>
  )
}

function AuxLine({ aux, onOpen }: { aux: AuxLessonLine; onOpen: (id: string) => void }) {
  if (!aux) return null
  const t = aux.title ?? PASTED_TOPIC
  if (aux.kind === 'done') return <p className="mt-1 text-[13px] text-ink2 break-keep [overflow-wrap:anywhere]">{LESSON_CH.auxDone(t, correctFromScore(aux.score))}</p>
  return (
    <div className="mt-1.5 flex min-w-0 items-center gap-2 rounded-xl border border-line px-3 py-2">
      <p className="min-w-0 flex-1 text-[13px] break-keep [overflow-wrap:anywhere]">{LESSON_CH.auxOpen(t, aux.stageDone)}</p>
      <Btn variant="ghost" className="!h-11 flex-none !px-3 !text-[13px]" aria-label={LESSON_CH.auxOpenAria(t)} onClick={() => onOpen(aux.lessonId)}>
        {LESSON_CH.resume}
      </Btn>
    </div>
  )
}

export default function TodayLessonCard({
  state,
  today,
  onReload,
  onToast,
  errorText = HOME.loadError,
  challenge = null,
  challengeLoading = false,
}: {
  state: 'loading' | 'error' | 'ready'
  today: TodayLessons | null
  onReload: () => void
  onToast: (msg: string) => void
  /** #58 실패 문구 — 오늘 홈은 복습 카드와 합친 문구를 넘긴다(task-010b, Leader ⑥). */
  errorText?: string
  /** 진행 중 챌린지의 오늘 회화 과제(#158). 없거나 과제가 꺼졌으면 null — 지금 카드 그대로. */
  challenge?: { ctx: ChallengeCtx; task: ChallengeLessonTask } | null
  challengeLoading?: boolean
}) {
  const router = useRouter()
  const { create, busy } = useLessonCreate(onToast)
  const card = deriveLessonCard(challengeLoading ? 'loading' : state, today)
  const ch = challenge && !challengeLoading ? deriveChallengeLessonCard(state, today, challenge.task, challenge.ctx.topicId) : null
  useJobWatch(ch ? ch.watchJobId : card.kind === 'gen' ? card.lesson.jobId : null, { delays: [5000], onSettled: onReload })
  const topicName = (t: { title: string } | null) => t?.title ?? PASTED_TOPIC
  const rec = today?.recommendation ?? null
  const pick = (
    <Link href="/study/today/talk/new" className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold">
      {HOME.pickTopic}
    </Link>
  )

  if (ch && challenge) {
    return (
      <section aria-labelledby="lesson-card-title" className="mt-[18px] min-w-0">
        <Card>
          <ChallengeBody
            card={ch.card}
            aux={ch.aux}
            ctx={challenge.ctx}
            today={today}
            busy={busy}
            errorText={errorText}
            onReload={onReload}
            onOpen={(id) => router.push(lessonPath(id))}
            onCreate={() => void create({ topicId: challenge.ctx.topicId })}
          />
        </Card>
      </section>
    )
  }

  let body: React.ReactNode
  switch (card.kind) {
    case 'loading':
      body = (
        <>
          <Head />
          <CardLoadingBody kind="lesson" />
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
                  {rec.reason === 'CONTINUE' && rec.nextPreview
                    ? HOME.reasonContinue(rec.nextPreview.titleKo)
                    : rec.reason === 'NEXT_TOPIC'
                      ? HOME.reasonNextTopic
                      : rec.reason === 'CHALLENGE'
                        ? LESSON_CH.reasonChallenge
                        : HOME.reasonStart}
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

/** 챌린지 모드 본문(task-044 가이드 §3-4 표). 보조 줄은 모든 상태 위에 하나만. */
function ChallengeBody({
  card,
  aux,
  ctx,
  today,
  busy,
  errorText,
  onReload,
  onOpen,
  onCreate,
}: {
  card: ChallengeLessonCard
  aux: AuxLessonLine
  ctx: ChallengeCtx
  today: TodayLessons | null
  busy: boolean
  errorText: string
  onReload: () => void
  onOpen: (id: string) => void
  onCreate: () => void
}) {
  const dayIndex = ctx.today.dayIndex
  const head = <Head chip={LESSON_CH.chip(dayIndex)} />
  const otherLink = (
    <Link href="/study/today/talk/new" aria-label={LESSON_CH.otherAria} className="mt-1 flex min-h-11 items-center justify-center text-[13px] font-semibold text-ink underline underline-offset-4">
      {LESSON_CH.other}
    </Link>
  )
  const auxLine = <AuxLine aux={aux} onOpen={onOpen} />
  const rec = today?.recommendation ?? null
  switch (card.kind) {
    case 'loading':
      return (
        <>
          {head}
          <CardLoadingBody kind="lesson" />
        </>
      )
    case 'error':
      return (
        <>
          {head}
          <div className="mt-2">
            <ErrorBlock message={errorText} onRetry={onReload} />
          </div>
        </>
      )
    case 'gen': {
      const id = card.lessonId
      return (
        <>
          {head}
          {auxLine}
          <p className="mt-1 text-[15px] font-semibold">{LESSON_CH.genTitle}</p>
          <p className="mt-1 text-[13px] text-ink2 break-keep">{LESSON_CH.genBody(ctx.title)}</p>
          <IndetBar />
          <p role="status" className="sr-only">
            {LESSON_CH.genSr}
          </p>
          {id ? (
            <Btn variant="ghost" className="mt-3 w-full" onClick={() => onOpen(id)}>
              {LESSON_CH.open}
            </Btn>
          ) : null}
        </>
      )
    }
    case 'busy':
      return (
        <>
          {head}
          {auxLine}
          <p className="mt-1 text-[15px] font-semibold">{LESSON_CH.busyTitle}</p>
          <p className="mt-1 text-[13px] text-ink2 break-keep [overflow-wrap:anywhere]">{LESSON_CH.busyBody(card.other.topic?.title ?? PASTED_TOPIC)}</p>
          <IndetBar />
          <p className="mt-2.5 rounded-xl bg-surface2 px-3 py-2.5 text-[13px] break-keep">{LESSON_CH.busyInfo(ctx.title)}</p>
          <Btn variant="ghost" className="mt-3 w-full" onClick={() => onOpen(card.other.id)}>
            {LESSON_CH.open}
          </Btn>
        </>
      )
    case 'ready':
    case 'progress':
    case 'continue': {
      const stageDone = card.kind === 'ready' ? 0 : (card.stageDone ?? 0)
      const id = card.lessonId
      return (
        <>
          {head}
          {auxLine}
          <p className="mt-1 text-[15px] font-semibold">
            {card.kind === 'ready' ? LESSON_CH.readyTitle : card.kind === 'progress' ? LESSON_CH.progressTitle : LESSON_CH.continueTitle}
          </p>
          <p className="mt-1 text-[13px] text-ink2 break-keep [overflow-wrap:anywhere]">
            {card.kind === 'ready'
              ? LESSON_CH.readyBody(ctx.title)
              : card.kind === 'progress'
                ? HOME.progressBody(`「${ctx.title}」`, HOME.today, card.stageDone)
                : LESSON_CH.continueBody(ctx.title, card.date, card.stageDone)}
          </p>
          <MiniSteps done={stageDone} />
          {card.kind === 'continue' && stageDone < 5 ? (
            <p className="mt-2 text-[12px] text-ink2 break-keep">{LESSON_CH.continueNote(stageLabel(stageDone + 1), dayIndex)}</p>
          ) : card.kind === 'progress' && stageDone < 5 ? (
            <p className="mt-2 text-[12px] text-ink2">{HOME.nextStage(stageLabel(stageDone + 1))}</p>
          ) : null}
          <Btn className="mt-3 w-full" onClick={() => onOpen(id)}>
            {card.kind === 'ready' ? LESSON_CH.start : LESSON_CH.resume}
          </Btn>
        </>
      )
    }
    case 'fail':
      return (
        <>
          {head}
          {auxLine}
          <p className="mt-1 text-[15px] font-semibold">{LESSON_CH.failTitle}</p>
          <p className="mt-1 text-[13px] text-ink2 break-keep">{LESSON_CH.failBody(ctx.title)}</p>
          <Btn className="mt-3 w-full" aria-busy={busy || undefined} onClick={onCreate}>
            {busy ? LESSON_CH.creating : LESSON_CH.retry}
          </Btn>
          {otherLink}
        </>
      )
    case 'done': {
      const l = card.lesson
      const id = card.lessonId
      return (
        <>
          {head}
          {auxLine}
          <p className="mt-1 text-[15px] font-semibold">{LESSON_CH.doneTitle}</p>
          <p className="mt-1 text-[13px] text-ink2 break-keep">{HOME.doneBody(`「${ctx.title}」`, correctFromScore(l?.score ?? null), l?.speaking ?? null)}</p>
          {card.nextPreview ? (
            <div className="mt-2.5 rounded-xl bg-accent-soft px-3 py-2.5">
              <p className="text-[12px] text-ink2">{HOME.nextTime}</p>
              <p className="mt-0.5 text-[14px] font-semibold text-ink break-keep">{card.nextPreview.titleKo}</p>
            </div>
          ) : null}
          <Btn variant="ghost" className="mt-3 w-full" aria-busy={busy || undefined} onClick={onCreate}>
            {busy ? LESSON_CH.creating : LESSON_CH.nextLesson}
          </Btn>
          <p className="mt-1.5 text-[12px] text-ink2 break-keep">{LESSON_CH.doneNote}</p>
          {id ? (
            <button type="button" onClick={() => onOpen(id)} className="mt-1 flex h-11 w-full items-center justify-center text-[13px] font-medium text-ink2 underline underline-offset-4">
              {LESSON_CH.doneResult}
            </button>
          ) : null}
        </>
      )
    }
    default: {
      const r3 =
        dayIndex <= 1
          ? LESSON_CH.r3First
          : rec && rec.reason === 'CHALLENGE' && rec.topicId === ctx.topicId && rec.nextPreview
            ? LESSON_CH.r3Preview(dayIndex, rec.nextPreview.titleKo)
            : LESSON_CH.r3Day(dayIndex)
      return (
        <>
          {head}
          {auxLine}
          <div className="mt-2.5 rounded-xl bg-surface2 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-ink2">{LESSON_CH.recLabel}</span>
              <span className="[&>span]:bg-surface">
                <Badge tone="neutral">{ctx.level}</Badge>
              </span>
            </div>
            <p className="mt-0.5 text-[15px] font-semibold break-keep [overflow-wrap:anywhere]">「{ctx.title}」</p>
            <p className="mt-0.5 text-[12px] text-ink2 break-keep">{r3}</p>
          </div>
          <Btn className="mt-3 w-full" aria-label={LESSON_CH.makeAria(ctx.title)} aria-busy={busy || undefined} onClick={onCreate}>
            {busy ? LESSON_CH.creating : LESSON_CH.make}
          </Btn>
          <p className="mt-1.5 text-[12px] text-ink2 break-keep">{LESSON_CH.makeNote}</p>
          {otherLink}
        </>
      )
    }
  }
}
