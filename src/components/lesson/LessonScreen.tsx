'use client'

/**
 * 수업 경로 `/study/today/talk/[lessonId]` 루트(screens §12-0 ① · §12-2 D~L) — #60 을 읽고 `status` 로 가른다:
 * GENERATING·FAILED → 대기·실패 / READY·IN_PROGRESS → 5단계 / DONE → 종료 카드 / 404 → 없음.
 * 5단계 틀: 머리(56) · 단계 표시 · 본문(유일한 스크롤) · (⑤만) 입력 바. 단계는 순서대로(a=B) — 끝낸 단계는 읽기 전용 다시 보기.
 * 복습 수업(`kind === 'REVIEW'`, task-010b screens §14-3 B)도 같은 경로·분기 — 머리 뱃지·① 앞 항목 카드·② 집중·③ 문구·종료 카드만 선택 prop 으로 바뀐다.
 */
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiPost } from '@/components/common/api'
import { detailString, toErr } from '@/components/common/errors'
import { writeStore } from '@/components/common/storage'
import Toast, { useToast } from '@/components/common/Toast'
import { Btn, ErrorBlock } from '@/components/common/ui'
import BackBar from '@/components/shell/BackBar'
import type { ChallengeProgress } from '@/types/challenge'
import type { CompleteResult, LessonContent, LessonDto } from '@/types/lesson'
import { LESSON_END_CH } from '@/components/vocab/topicCopy'
import LessonEnd from './LessonEnd'
import LessonGenScreen from './LessonGenScreen'
import { GEN, LESSON, PASTED_TOPIC } from './lessonCopy'
import { endResultFrom, firstStage, type EndResult } from './logic'
import { lessonToastBottom } from './lessonVoiceView'
import { LessonHeader, StageSteps } from './parts'
import ReviewItemsCard from './review/ReviewItemsCard'
import { RV_GEN } from './review/reviewCopy'
import { focusIdsOf } from './review/reviewLogic'
import type { FreshReviewEnd } from './review/useNextReview'
import StageApply from './StageApply'
import StageGrammar from './StageGrammar'
import StageQuiz from './StageQuiz'
import StageSpeak from './StageSpeak'
import StageUnderstand from './StageUnderstand'
import { useLesson, type UseLesson } from './useLesson'
import { LESSON_KEYS, takeFlash } from './useLessonCreate'
import { useLessonPlayback } from './useLessonPlayback'
import { useSpeechConfig } from './useLessonVoice'
import { useSpeakTrCache } from './useSpeakTranslation'

type ReadyLesson = LessonDto & { content: LessonContent }

export default function LessonScreen({ lessonId, teacherName, learningSpeed }: { lessonId: string; teacherName: string; learningSpeed: number | null }) {
  const st = useLesson(lessonId)
  const toast = useToast()
  const { show } = toast
  const [end, setEnd] = useState<EndResult | null>(null)
  const [endReview, setEndReview] = useState<FreshReviewEnd | null>(null)
  const [endChallenge, setEndChallenge] = useState<ChallengeProgress | null>(null)
  const wasGenerating = useRef(false)
  const [justReady, setJustReady] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => {
      const msg = takeFlash()
      if (msg) show(msg)
    }, 0)
    return () => clearTimeout(id)
  }, [show])

  const lesson = st.lesson
  useEffect(() => {
    if (!lesson) return
    if (lesson.status === 'GENERATING') wasGenerating.current = true
    if ((lesson.status === 'READY' || lesson.status === 'IN_PROGRESS') && lesson.source === 'TEXT') writeStore('session', LESSON_KEYS.src(lesson.id), null)
  }, [lesson])

  const onSettled = useCallback(async () => {
    const l = await st.reload()
    if (l && (l.status === 'READY' || l.status === 'IN_PROGRESS') && wasGenerating.current) {
      show(l.kind === 'REVIEW' ? RV_GEN.readyToast : GEN.ready)
      setJustReady(true)
    }
  }, [st, show])

  if (st.load === 'notFound') {
    return (
      <div className="flex h-full min-h-0 flex-col bg-ground">
        <BackBar backHref="/study/today" backLabel={LESSON.back} title="오늘의 회화" />
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-4 text-center">
          <p className="text-[15px] font-semibold">{LESSON.notFound}</p>
          <p className="text-[13px] text-ink2">{LESSON.notFoundBody}</p>
          <Link href="/study/today" className="mt-3 inline-flex h-12 items-center justify-center rounded-xl bg-accent px-6 text-[15px] font-semibold text-on-accent">
            {LESSON.today}
          </Link>
        </div>
      </div>
    )
  }
  if (st.load === 'error' || st.load === 'loading' || !lesson) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-ground">
        <BackBar backHref="/study/today" backLabel={LESSON.back} title="오늘의 회화" />
        <div className="flex flex-col gap-2 px-4 pt-3.5">
          {st.load === 'error' ? (
            <ErrorBlock message={LESSON.loadError} onRetry={() => void st.reload()} />
          ) : (
            <>
              <p role="status" className="sr-only">
                {LESSON.loading}
              </p>
              {[0, 1, 2].map((i) => (
                <span key={i} aria-hidden="true" className="block h-24 rounded-[14px] bg-surface2" />
              ))}
            </>
          )}
        </div>
      </div>
    )
  }

  if (lesson.status === 'GENERATING' || lesson.status === 'FAILED' || !lesson.content) {
    return (
      <>
        <LessonGenScreen lesson={lesson} onSettled={() => void onSettled()} onToast={show} />
        <Toast message={toast.message} bottomPx={24} />
      </>
    )
  }
  const ready = lesson as ReadyLesson
  if (lesson.status === 'DONE') {
    const result = end ?? endResultFrom(ready)
    return (
      <>
        {result ? (
          <LessonEnd lesson={ready} result={result} onToast={show} review={end ? endReview : null} teacherName={teacherName} challenge={end ? endChallenge : null} />
        ) : null}
        <Toast message={toast.message} bottomPx={24} />
      </>
    )
  }
  return (
    <LessonStages
      key={lesson.id}
      lesson={ready}
      st={st}
      teacherName={teacherName}
      learningSpeed={learningSpeed}
      justReady={justReady}
      toast={toast}
      onEnded={(r, rv, chp) => {
        setEnd(r)
        setEndReview(rv ?? null)
        setEndChallenge(chp ?? null)
        // 종료 화면 제목 초점 뒤 한 번(task-044 §3-9) — 그날을 달성으로 바꾼 수업일 때만.
        if (chp?.goalMetNow) setTimeout(() => show(LESSON_END_CH.toast), 0)
      }}
    />
  )
}

function LessonStages({
  lesson,
  st,
  teacherName,
  learningSpeed,
  justReady,
  toast,
  onEnded,
}: {
  lesson: ReadyLesson
  st: UseLesson
  teacherName: string
  learningSpeed: number | null
  justReady: boolean
  toast: ReturnType<typeof useToast>
  onEnded: (r: EndResult, review?: FreshReviewEnd, challenge?: ChallengeProgress | null) => void
}) {
  const { show } = toast
  const [stage, setStage] = useState(() => firstStage(lesson.stageDone))
  const [saveFail, setSaveFail] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const pb = useLessonPlayback(lesson.id, show)
  const { config, textFirst } = useSpeechConfig()
  // ⑤ 하단 묶음(도우미 판 + 입력 바) 실제 높이 — 토스트 바닥(B8 A, task-077). 재기 전·다시 보기는 null(지금 값 136).
  const [speakBottom, setSpeakBottom] = useState<number | null>(null)
  // 「내가 한 말」 한국어 뜻 메모리 — 수업 화면 동안만(저장 없음).
  const trCache = useSpeakTrCache()
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const topic = lesson.topic?.title ?? PASTED_TOPIC
  const reviewing = stage <= lesson.stageDone
  const isReviewLesson = lesson.kind === 'REVIEW'
  const reviewItems = useMemo(() => lesson.reviewItems ?? [], [lesson.reviewItems])
  const focusIds = useMemo(() => focusIdsOf(reviewItems), [reviewItems])
  const variant = isReviewLesson ? 'REVIEW' : 'NEW'

  // 처음 열 때: 생성 직후가 아니고 진행이 있으면 "이어서" 토스트 1회.
  const greeted = useRef(false)
  useEffect(() => {
    if (greeted.current) return
    greeted.current = true
    if (!justReady && lesson.stageDone >= 1 && lesson.stageDone < 5) setTimeout(() => show(LESSON.resumeToast(firstStage(lesson.stageDone))), 0)
  }, [justReady, lesson.stageDone, show])

  const focusStage = () =>
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0 })
      rootRef.current?.querySelector<HTMLElement>('[data-stage-title]')?.focus()
    })
  useEffect(() => {
    if (justReady) focusStage()
  }, [justReady])

  const go = (n: number) => {
    if (n > lesson.stageDone + 1) return show(LESSON.locked)
    if (n === stage) return
    pb.stop('HIDDEN')
    setSaveFail(false)
    setStage(n)
    focusStage()
  }

  const advance = async () => {
    if (advancing) return
    setAdvancing(true)
    const ok = await st.advance(stage)
    setAdvancing(false)
    if (!ok) return setSaveFail(true)
    setSaveFail(false)
    pb.stop('HIDDEN')
    setStage(Math.min(5, stage + 1))
    focusStage()
  }

  const footer =
    reviewing && lesson.stageDone < 5 ? (
      <Btn className="w-full" onClick={() => go(lesson.stageDone + 1)}>
        {LESSON.toCurrent(lesson.stageDone + 1)}
      </Btn>
    ) : stage < 5 ? (
      <div>
        {saveFail ? (
          <p role="alert" className="mb-2 rounded-xl border border-bad-soft bg-bad-soft px-3.5 py-3 text-[13px] text-bad break-keep">
            {LESSON.saveFail}
          </p>
        ) : null}
        <Btn className="w-full" aria-busy={advancing || undefined} onClick={() => void advance()}>
          {LESSON.next(stage + 1)}
        </Btn>
      </div>
    ) : null

  const complete = async () => {
    const path = `/api/v1/lessons/${encodeURIComponent(lesson.id)}/complete`
    await st.flush()
    const done = (r: CompleteResult) => {
      onEnded(
        { correct: r.result.quiz.correct, total: r.result.quiz.total, applicationDone: r.result.applicationDone, usedIds: r.result.expressions.usedIds, missedIds: r.result.expressions.missedIds, nextPreview: r.result.nextPreview },
        isReviewLesson ? { jobId: r.reviewDecisionJobId ?? null, nextReview: r.nextReview ?? null } : undefined,
        r.challenge ?? null,
      )
      st.replace({ ...lesson, status: 'DONE', stageDone: 5, score: r.lesson.score, completedAt: r.lesson.completedAt })
    }
    try {
      done(await apiPost<CompleteResult>(path, {}))
    } catch (e) {
      const err = toErr(e)
      const reason = detailString(err, 'reason')
      if (err.status === 409 && reason === 'ALREADY_DONE') {
        await st.reload()
        show(LESSON.alreadyDone)
        return
      }
      if (err.status === 409 && reason === 'STAGES_LEFT') {
        if (await st.advance(4)) {
          done(await apiPost<CompleteResult>(path, {}))
          return
        }
      }
      throw e
    }
  }

  const reviewNote = reviewing ? (
    <p role="status" className="mb-3 rounded-xl bg-surface2 px-3.5 py-2.5 text-[13px] break-keep">
      {LESSON.reviewNote}
    </p>
  ) : null

  return (
    <div ref={rootRef} className="mx-auto flex h-full min-h-0 w-full max-w-[520px] min-w-0 flex-col bg-ground">
      <LessonHeader teacherName={teacherName} topic={topic} title={lesson.content.title} onAnnounce={show} review={isReviewLesson} />
      <StageSteps stageDone={lesson.stageDone} current={stage} onPick={go} />
      {stage === 5 ? (
        <StageSpeak
          lesson={lesson}
          st={st}
          pb={pb}
          reviewing={reviewing}
          config={config}
          textFirst={textFirst}
          onToast={show}
          onDone={complete}
          reviewNote={reviewNote}
          footer={footer}
          toastOpen={!!toast.message}
          onBottomHeight={setSpeakBottom}
          trCache={trCache}
        />
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-3.5">
          {reviewNote}
          {stage === 1 && isReviewLesson && reviewItems.length > 0 ? <ReviewItemsCard lessonId={lesson.id} items={reviewItems} /> : null}
          {stage === 1 ? (
            <StageUnderstand lesson={lesson} st={st} pb={pb} reviewing={reviewing} learningSpeed={learningSpeed} onToast={show} footer={footer} />
          ) : stage === 2 ? (
            <StageGrammar content={lesson.content} pb={pb} onToast={show} footer={footer} variant={variant} focusIds={isReviewLesson ? focusIds : undefined} />
          ) : stage === 3 ? (
            <StageQuiz lesson={lesson} st={st} reviewing={reviewing} onToast={show} footer={footer} variant={variant} />
          ) : (
            <StageApply lesson={lesson} st={st} pb={pb} reviewing={reviewing} config={config} onToast={show} footer={footer} />
          )}
        </div>
      )}
      <Toast message={toast.message} bottomPx={lessonToastBottom(stage, speakBottom)} />
    </div>
  )
}
