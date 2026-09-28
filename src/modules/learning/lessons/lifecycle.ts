/**
 * 레슨 상세(#60)·진행 저장(#61)·완료(#62).
 *
 * 완료는 **한 트랜잭션**(task-010 완료 기준): 사용자 행 → 레슨 행 잠금 → 상태 확인(DONE 409·열리지 않음 409·단계 부족 409) →
 * 서버 재채점(L4, body 의 score 는 쓰지 않음) → RepetitionItem 등록/갱신(L5) → `Lesson DONE` → `StudyLog(LESSON, DIRECT)` →
 * `StatsSnapshot(LESSON)` → `DAILY(lessons+1, repetition.studied+n)`. 중간 실패는 전부 롤백. 같은 레슨 두 번째 완료는 409(행 변화 0).
 * 강사 복습 판단(A11)·ReviewSchedule 은 task-010b — 응답의 `reviewDecisionJobId`·`nextReview` 는 null.
 */
import type { Prisma, StudyType } from '@prisma/client'
import { ApiError, dates, lockUserRow, prisma, truncateCodePoints, withTransaction } from '@/modules/infra'
import { registerRepetitionItems } from '../repetition'
import { bumpDailySnapshot, createLessonSnapshot } from '../snapshots'
import { recordStudyLog } from '../studyLog'
import { lessonRepetitionItems, readStoredContent, scoreQuiz, summarizeExpressions } from './content'
import { settleGenerating } from './generate'
import { memoDrafts, memoProcessed, mergeProgress, parseProgressPatch, readProgress, speakingRecords } from './progress'
import { LESSON_SELECT, lessonNotFound, lockLesson, lockLessonForWrite, stateConflict, toLessonDto, writeProgress, type LessonDto } from './rows'
import { isLessonId, LESSON_STAGE_MAX } from './validate'

/** 완료할 수 있는 최소 단계 — 응용까지 끝내고 말하기 단계에 들어섰을 때(stageDone ≥ 4). */
export const LESSON_COMPLETE_MIN_STAGE = 4

/** #60 — 소유자만(타인·없음 404). GENERATING 인데 잡이 죽었으면 여기서 FAILED 로 닫는다. */
export async function getLesson(userId: string, id: string): Promise<LessonDto> {
  if (!isLessonId(id)) throw lessonNotFound()
  let row = await prisma.lesson.findFirst({ where: { id, userId }, select: LESSON_SELECT })
  if (!row) throw lessonNotFound()
  let jobId: string | null = null
  if (row.status === 'GENERATING') {
    jobId = await settleGenerating(userId, id)
    if (!jobId) row = (await prisma.lesson.findFirst({ where: { id, userId }, select: LESSON_SELECT })) ?? row
  }
  return toLessonDto(row, jobId)
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
    const patch = body.progress === undefined ? null : parseProgressPatch(body.progress, { segmentCount: h.content.segmentCount, quizCount: h.content.quiz.length, applicationCount: h.content.application.length })
    const progress = patch ? mergeProgress(h.progress, patch) : h.progress
    const row = await writeProgress(tx, h, progress, body.stageDone ?? undefined)
    return toLessonDto(row)
  })
}

export interface CompleteLessonResult {
  lesson: { id: string; status: 'DONE'; score: number; stageDone: number; completedAt: string }
  studyLogId: string
  reviewDecisionJobId: null
  nextReview: null
  result: {
    score: number
    quiz: { correct: number; total: number; answered: number }
    applicationDone: number
    /** 말하기에서 쓴 표현·못 쓴 표현(레슨 안 id — content.chunks/grammar 의 id). */
    expressions: { usedIds: string[]; missedIds: string[] }
    repetition: { items: number; created: number; updated: number }
    nextPreview: { titleKo: string; teaserKo: string } | null
  }
}

/** #62 — 위 머리말의 단일 트랜잭션. */
export async function completeLesson(userId: string, id: string): Promise<CompleteLessonResult> {
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

    const quiz = scoreQuiz(content.quiz, progress.quiz?.answers)
    const topicChunkIds = row.topicId ? new Set((await tx.topicChunk.findMany({ where: { topicId: row.topicId }, select: { id: true } })).map((c) => c.id)) : new Set<string>()
    const repInputs = lessonRepetitionItems(content, { topicChunkIds, outcomes: quiz.outcomes })
    const registered = await registerRepetitionItems(userId, repInputs, tx, { today, now })
    const idByKey = new Map(registered.map((r) => [`${r.refType}\u0000${r.refId}`, r.id]))
    const itemIdOf = new Map(repInputs.map((i) => [i.contentId, idByKey.get(`${i.refType}\u0000${i.refId}`)]))
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
        summary: `오늘의 회화 「${title}」 · 문제 ${quiz.correct}/${quiz.total} · 말하기 표현 ${expr.usedIds.length}/${expr.usedIds.length + expr.missedIds.length}`,
        result: {
          stageDone: LESSON_STAGE_MAX,
          score: quiz.score,
          quizCorrect: quiz.correct,
          quizTotal: quiz.total,
          quizAnswered: quiz.answered,
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
    await createLessonSnapshot(userId, id, { kind: row.kind, topicId: row.topicId, score: quiz.score, stageDone: LESSON_STAGE_MAX, itemCount: registered.length, quizCorrect: quiz.correct, quizTotal: quiz.total, date: today }, tx)
    await bumpDailySnapshot(userId, today, { lessons: 1, repetition: { studied: registered.length } }, tx)
    const np = content.nextPreview
    return {
      lesson: { id, status: 'DONE', score: quiz.score, stageDone: LESSON_STAGE_MAX, completedAt: now.toISOString() },
      studyLogId: log.id,
      reviewDecisionJobId: null,
      nextReview: null,
      result: {
        score: quiz.score,
        quiz: { correct: quiz.correct, total: quiz.total, answered: quiz.answered },
        applicationDone,
        expressions: expr,
        repetition: { items: registered.length, created: registered.filter((r) => r.created).length, updated: registered.filter((r) => !r.created).length },
        nextPreview: np && typeof np.titleKo === 'string' ? { titleKo: np.titleKo, teaserKo: np.teaserKo } : null,
      },
    }
  })
}
