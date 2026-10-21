/**
 * 레슨 상세(#60)·진행 저장(#61)·완료(#62).
 *
 * 완료는 **한 트랜잭션**(task-010 완료 기준): 사용자 행 → 레슨 행 잠금 → 상태 확인(DONE 409·열리지 않음 409·단계 부족 409) →
 * 서버 재채점(L4, body 의 score 는 쓰지 않음) → RepetitionItem 등록/갱신(L5) → `Lesson DONE` → `StudyLog(LESSON|REVIEW, DIRECT)` →
 * `StatsSnapshot(LESSON)` → `DAILY(lessons|reviews +1, repetition.studied+n)` → 학습 관측(quiz 문항·말하기 과제, task-010b L3) +
 * DAILY `observations`. 중간 실패는 전부 롤백. 같은 레슨 두 번째 완료는 409(행 변화 0).
 * task-081(§37-13): 새 수업은 `content.quiz` 가 비어 있다 — 점수 없음(`Lesson.score`·응답 `score`·`result.quiz` null, StudyLog·스냅샷의
 * 문항 키 생략). 문항이 있는 옛 수업은 지금 계산 그대로(진행 중이던 옛 수업의 답도 그대로 채점한다).
 * 복습 레슨(kind=REVIEW, task-010b L6)은 새 항목을 등록하지 않고 mixSpec(세션 `itemIds`) 항목의 `studiedCount+1`·quiz 정오답을 더하며
 * 세션을 DONE 으로 닫는다. 강사 복습 판단(A11)은 트랜잭션 **뒤** 라우트가 건다(`afterStudyCompleted`) — 응답의 `reviewDecisionJobId`·
 * `nextReview` 는 라우트가 채운다.
 */
import type { LessonKind, Prisma, StudyType } from '@prisma/client'
import { ApiError, dates, lockUserRow, prisma, truncateCodePoints, withTransaction } from '@/modules/infra'
import { markRepetitionStudied, registerRepetitionItems } from '../repetition'
import { recordObservations } from '../observations'
import { completeScheduleForLesson, lessonReviewExtras, type LessonNextReview, type ReviewItemDto } from '../reviewSchedule'
import { bumpDailySnapshot, createLessonSnapshot } from '../snapshots'
import { recordStudyLog } from '../studyLog'
import { lessonRepetitionItems, readStoredContent, scoreQuiz, summarizeExpressions, type QuizOutcome } from './content'
import { lessonGenKindOf, settleGenerating } from './generate'
import { lessonObservations, quizTargetTally } from './observations'
import { memoDrafts, memoProcessed, mergeProgress, parseProgressPatch, readProgress, speakingRecords } from './progress'
import { LESSON_SELECT, lessonNotFound, lockLesson, lockLessonForWrite, stateConflict, toLessonDto, writeProgress, type LessonDto } from './rows'
import { isLessonId, LESSON_STAGE_MAX } from './validate'

/** 완료할 수 있는 최소 단계 — 응용까지 끝내고 말하기 단계에 들어섰을 때(stageDone ≥ 4). */
export const LESSON_COMPLETE_MIN_STAGE = 4

/** #60 응답 — 공통 레슨 DTO + 복습 칸(task-010b, additive): 복습 레슨의 mixSpec 항목(모든 상태 — ★②)·끝낸 레슨의 다음 복습(L5). */
export interface LessonDetailDto extends LessonDto {
  reviewItems: ReviewItemDto[] | null
  nextReview: LessonNextReview | null
}

/** #60 — 소유자만(타인·없음 404). GENERATING 인데 잡이 죽었으면 여기서 FAILED 로 닫는다. */
export async function getLesson(userId: string, id: string): Promise<LessonDetailDto> {
  if (!isLessonId(id)) throw lessonNotFound()
  let row = await prisma.lesson.findFirst({ where: { id, userId }, select: LESSON_SELECT })
  if (!row) throw lessonNotFound()
  let jobId: string | null = null
  if (row.status === 'GENERATING') {
    jobId = await settleGenerating(userId, id, undefined, lessonGenKindOf(row.kind))
    if (!jobId) row = (await prisma.lesson.findFirst({ where: { id, userId }, select: LESSON_SELECT })) ?? row
  }
  const extras = await lessonReviewExtras(userId, { id: row.id, kind: row.kind, status: row.status, progress: row.progress, completedAt: row.completedAt, scheduleItemIds: row.reviewSchedule?.itemIds })
  return { ...toLessonDto(row, jobId), ...extras }
}

/** 레슨 존재·소유 확인만(#21 발화 업로드의 lessonId) — 없거나 남의 것 404. */
export async function assertOwnedLesson(userId: string, id: string): Promise<void> {
  if (!isLessonId(id)) throw lessonNotFound()
  const n = await prisma.lesson.count({ where: { id, userId } })
  if (!n) throw lessonNotFound()
}

/** #61 — stageDone 단조 증가(줄이면 400), progress 는 클라이언트 칸만 병합(≤8KB). READY → IN_PROGRESS. */
export async function updateLessonProgress(userId: string, id: string, body: { stageDone: number | null; progress: unknown }): Promise<LessonDto> {
  return withTransaction(async (tx) => {
    const h = await lockLessonForWrite(tx, userId, id)
    if (body.stageDone !== null && body.stageDone < h.row.stageDone) {
      throw new ApiError('VALIDATION', '끝낸 단계는 되돌릴 수 없어요.', { field: 'stageDone', reason: 'monotonic', current: h.row.stageDone })
    }
    const patch = body.progress === undefined ? null : parseProgressPatch(body.progress, { segmentCount: h.content.segmentCount, quizCount: h.content.quiz.length, applicationCount: h.content.application.length, dialogueCount: h.content.dialogue.length })
    const progress = patch ? mergeProgress(h.progress, patch) : h.progress
    const row = await writeProgress(tx, h, progress, body.stageDone ?? undefined)
    return toLessonDto(row)
  })
}

/** 문항 채점 결과 — 새 수업(문항 없음, task-081)은 `score`·`quiz` 가 null 이고 `outcomes` 는 빈 배열. */
export interface LessonQuizFigures {
  score: number | null
  quiz: { correct: number; total: number; answered: number } | null
  outcomes: QuizOutcome[]
}

export function lessonQuizFigures(quiz: readonly { answer: number }[], answers: readonly (number | null)[] | undefined): LessonQuizFigures {
  if (!quiz.length) return { score: null, quiz: null, outcomes: [] }
  const s = scoreQuiz(quiz, answers)
  return { score: s.score, quiz: { correct: s.correct, total: s.total, answered: s.answered }, outcomes: s.outcomes }
}

/** StudyLog `summary` — 새 수업은 «문제 c/t» 를 뺀다(옛 수업은 지금 문자열 그대로). */
export function lessonStudySummary(kind: LessonKind, title: string, quiz: LessonQuizFigures['quiz'], expr: { usedIds: readonly string[]; missedIds: readonly string[] }): string {
  const quizPart = quiz ? ` · 문제 ${quiz.correct}/${quiz.total}` : ''
  return `${kind === 'REVIEW' ? '오늘의 복습' : '오늘의 회화'} 「${title}」${quizPart} · 말하기 표현 ${expr.usedIds.length}/${expr.usedIds.length + expr.missedIds.length}`
}

/** StudyLog `result` 의 문항 키 — 새 수업은 키 자체를 넣지 않는다(0 으로 채우면 «문제 0/0» 으로 읽힌다). */
export function lessonQuizResultKeys(f: LessonQuizFigures): { score?: number; quizCorrect?: number; quizTotal?: number; quizAnswered?: number } {
  if (!f.quiz || f.score === null) return {}
  return { score: f.score, quizCorrect: f.quiz.correct, quizTotal: f.quiz.total, quizAnswered: f.quiz.answered }
}

export interface CompleteLessonResult {
  lesson: { id: string; status: 'DONE'; score: number | null; stageDone: number; completedAt: string }
  studyLogId: string
  /** 강사 복습 판단 잡(#55) — 트랜잭션 뒤 라우트가 채운다(없으면 null). */
  reviewDecisionJobId: string | null
  /** #60 과 같은 모양(Leader 결정 (b)). 판단 대기면 null. */
  nextReview: LessonNextReview | null
  result: {
    /** 새 수업(문항 없음)은 null. */
    score: number | null
    /** 새 수업(문항 없음)은 null — 화면은 더 읽지 않는다(§37-6). */
    quiz: { correct: number; total: number; answered: number } | null
    applicationDone: number
    /** 말하기에서 쓴 표현·못 쓴 표현(레슨 안 id — content.chunks/grammar 의 id). */
    expressions: { usedIds: string[]; missedIds: string[] }
    repetition: { items: number; created: number; updated: number }
    nextPreview: { titleKo: string; teaserKo: string } | null
  }
}

export interface CompleteLessonOptions {
  /** 말하기 발화의 STT 신뢰도(speech 소유 — 라우트가 넘긴다). 없으면 1.0. */
  utteranceConfidence?: (utteranceIds: string[]) => Promise<Map<string, number>>
}

/** #62 — 위 머리말의 단일 트랜잭션. */
export async function completeLesson(userId: string, id: string, opts: CompleteLessonOptions = {}): Promise<CompleteLessonResult> {
  return (await completeLessonDetailed(userId, id, opts)).result
}

/** #62 + 판단 잡 재료(레슨 종류·이 레슨이 공부한 반복 항목 id). */
export async function completeLessonDetailed(userId: string, id: string, opts: CompleteLessonOptions = {}): Promise<{ result: CompleteLessonResult; kind: LessonKind; itemIds: string[] }> {
  if (!isLessonId(id)) throw lessonNotFound()
  return withTransaction(async (tx) => {
    await lockUserRow(tx, userId)
    const row = await lockLesson(tx, userId, id)
    const conflict = stateConflict(row)
    if (conflict) throw conflict
    const content = readStoredContent(row.content)
    if (!content) throw new ApiError('CONFLICT', '아직 수업을 열 수 없어요.', { reason: 'NOT_READY', status: row.status })
    if (row.stageDone < LESSON_COMPLETE_MIN_STAGE) {
      throw new ApiError('CONFLICT', '마지막 단계까지 진행한 뒤 끝낼 수 있어요.', { reason: 'STAGES_LEFT', stageDone: row.stageDone, required: LESSON_COMPLETE_MIN_STAGE })
    }
    const progress = readProgress(row.progress)
    const now = new Date()
    const today = dates.todayKst(now)

    const quiz = lessonQuizFigures(content.quiz, progress.quiz?.answers)
    let itemIdOf: Map<string, string | undefined>
    let registered: { id: string; created: boolean }[]
    if (row.kind === 'REVIEW') {
      // 복습 레슨: content 의 조각 id = RepetitionItem id(mixSpec, A5 `chunks ⊆ mixSpec`). 새 항목은 만들지 않는다.
      const schedule = await completeScheduleForLesson(userId, id, tx, now)
      const mixIds = schedule?.itemIds.length ? schedule.itemIds : content.chunks.map((c) => c.id)
      const tally = quizTargetTally(content.quiz, quiz.outcomes)
      const studied = await markRepetitionStudied(userId, mixIds.map((itemId) => ({ id: itemId, ...tally.get(itemId) })), tx, { today, now })
      const studiedSet = new Set(studied)
      registered = studied.map((itemId) => ({ id: itemId, created: false }))
      itemIdOf = new Map(content.chunks.map((c) => [c.id, studiedSet.has(c.id) ? c.id : undefined]))
    } else {
      const topicChunkIds = row.topicId ? new Set((await tx.topicChunk.findMany({ where: { topicId: row.topicId }, select: { id: true } })).map((c) => c.id)) : new Set<string>()
      const repInputs = lessonRepetitionItems(content, { topicChunkIds, outcomes: quiz.outcomes })
      const reg = await registerRepetitionItems(userId, repInputs, tx, { today, now })
      const idByKey = new Map(reg.map((r) => [`${r.refType}\u0000${r.refId}`, r.id]))
      itemIdOf = new Map(repInputs.map((i) => [i.contentId, idByKey.get(`${i.refType}\u0000${i.refId}`)]))
      registered = reg
    }
    const expr = summarizeExpressions(content, speakingRecords(progress))
    const toItemIds = (ids: string[]) => [...new Set(ids.flatMap((c) => (itemIdOf.get(c) ? [itemIdOf.get(c) as string] : [])))]
    const applicationDone = (progress.application?.answers ?? []).filter((a) => typeof a === 'string' && a.trim()).length

    await tx.lesson.update({ where: { id }, data: { status: 'DONE', completedAt: now, score: quiz.score, stageDone: LESSON_STAGE_MAX } })
    const type: StudyType = row.kind === 'REVIEW' ? 'REVIEW' : 'LESSON'
    const title = truncateCodePoints(content.titleKo || content.title, 60)
    const log = await recordStudyLog(
      userId,
      {
        date: today,
        type,
        origin: 'DIRECT',
        refId: id,
        summary: lessonStudySummary(row.kind, title, quiz.quiz, expr),
        result: {
          stageDone: LESSON_STAGE_MAX,
          ...lessonQuizResultKeys(quiz),
          applicationDone,
          usedExpressionIds: toItemIds(expr.usedIds),
          missedExpressionIds: toItemIds(expr.missedIds),
          itemIds: registered.map((r) => r.id),
          listen: { segmentsDone: progress.listen?.segmentsDone?.length ?? 0, memoCount: memoDrafts(progress).length, proposedCount: memoProcessed(progress).filter((m) => m.result === 'PROPOSED').length },
          speakingDone: speakingRecords(progress).length,
          topicId: row.topicId,
          source: row.sourceText ? 'TEXT' : 'TOPIC',
        } as Prisma.InputJsonValue,
      },
      tx,
    )
    await createLessonSnapshot(userId, id, { kind: row.kind, topicId: row.topicId, score: quiz.score, stageDone: LESSON_STAGE_MAX, itemCount: registered.length, ...(quiz.quiz ? { quizCorrect: quiz.quiz.correct, quizTotal: quiz.quiz.total } : {}), date: today }, tx)
    await bumpDailySnapshot(userId, today, { ...(row.kind === 'REVIEW' ? { reviews: 1 } : { lessons: 1 }), repetition: { studied: registered.length } }, tx)
    const spoken = speakingRecords(progress)
    const utteranceIds = [...new Set(spoken.flatMap((sp) => (sp.utteranceId ? [sp.utteranceId] : [])))]
    const confidence = utteranceIds.length && opts.utteranceConfidence ? await opts.utteranceConfidence(utteranceIds) : new Map<string, number>()
    await recordObservations(userId, lessonObservations(id, content, quiz.outcomes, spoken, confidence), tx, { date: today })
    const np = content.nextPreview
    const result: CompleteLessonResult = {
      lesson: { id, status: 'DONE', score: quiz.score, stageDone: LESSON_STAGE_MAX, completedAt: now.toISOString() },
      studyLogId: log.id,
      reviewDecisionJobId: null,
      nextReview: null,
      result: {
        score: quiz.score,
        quiz: quiz.quiz,
        applicationDone,
        expressions: expr,
        repetition: { items: registered.length, created: registered.filter((r) => r.created).length, updated: registered.filter((r) => !r.created).length },
        nextPreview: np && typeof np.titleKo === 'string' ? { titleKo: np.titleKo, teaserKo: np.teaserKo } : null,
      },
    }
    return { result, kind: row.kind, itemIds: registered.map((r) => r.id) }
  })
}
