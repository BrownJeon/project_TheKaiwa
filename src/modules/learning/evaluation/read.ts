/**
 * 평가 상세(#66)·기록(#69). 정답 숨김 규칙은 `rows.ts` 머리말.
 */
import type { EvalKind, EvalStatus, JlptLevel } from '@prisma/client'
import { encodeCursor, jobs, prisma } from '@/modules/infra'
import { settleEvalGenerating } from './generate'
import { EVAL_SELECT, evaluationNotFound, isStarted, ITEM_SELECT, toEvaluationDto, type EvaluationDto } from './rows'
import { deadlineOf, gradeOf, type EvalGrade } from './scoring'
import { isEvaluationId, type EvaluationListQuery } from './validate'

/** #66 — 소유자만(타인·없음 404). GENERATING 인데 잡이 죽었으면 여기서 FAILED 로 닫는다. GRADING 이면 살아 있는 채점 잡 id. */
export async function getEvaluation(userId: string, id: string): Promise<EvaluationDto> {
  if (!isEvaluationId(id)) throw evaluationNotFound()
  let row = await prisma.evaluation.findFirst({ where: { id, userId }, select: EVAL_SELECT })
  if (!row) throw evaluationNotFound()
  let jobId: string | null = null
  if (row.status === 'GENERATING') {
    jobId = await settleEvalGenerating(userId, id)
    if (!jobId) row = (await prisma.evaluation.findFirst({ where: { id, userId }, select: EVAL_SELECT })) ?? row
  } else if (row.status === 'GRADING') {
    jobId = (await jobs.findActiveJob({ userId, kind: 'EVAL_GRADE', refId: id }))?.id ?? null
  }
  const items = row.status === 'GENERATING' || row.status === 'FAILED' ? [] : await prisma.evaluationItem.findMany({ where: { evaluationId: id }, select: ITEM_SELECT })
  return toEvaluationDto(row, items, { jobId })
}

export interface EvaluationListItem {
  id: string
  kind: EvalKind
  level: JlptLevel
  status: EvalStatus
  topic: { id: string; title: string } | null
  totalScore: number | null
  grade: EvalGrade | null
  /** 시작 전(READY)·출제 중이면 null. */
  startedAt: string | null
  deadlineAt: string | null
  submittedAt: string | null
  completedAt: string | null
}

/**
 * #69 — 최근 것부터(`startedAt desc, id desc` 키셋 커서). 출제에 실패한 빈 행(FAILED)은 기록이 아니라 빼고, 진행 중 평가는 넣는다
 * (오늘 홈 카드가 `limit=1` 로 "이어서 풀기·채점 중·결과 보기" 를 고른다).
 */
export async function listEvaluations(userId: string, q: EvaluationListQuery): Promise<{ items: EvaluationListItem[]; nextCursor: string | null }> {
  const rows = await prisma.evaluation.findMany({
    where: {
      userId,
      status: { not: 'FAILED' },
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.cursor ? { OR: [{ startedAt: { lt: new Date(q.cursor.t) } }, { startedAt: new Date(q.cursor.t), id: { lt: q.cursor.id } }] } : {}),
    },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    take: q.limit + 1,
    select: { id: true, kind: true, level: true, status: true, totalScore: true, startedAt: true, submittedAt: true, completedAt: true, topic: { select: { id: true, title: true } } },
  })
  const page = rows.slice(0, q.limit)
  const last = page.at(-1)
  return {
    items: page.map((r) => {
      const started = isStarted(r.status)
      const deadline = deadlineOf(r.startedAt, started)
      return {
        id: r.id,
        kind: r.kind,
        level: r.level,
        status: r.status,
        topic: r.topic ? { id: r.topic.id, title: r.topic.title } : null,
        totalScore: r.status === 'DONE' ? r.totalScore : null,
        grade: r.status === 'DONE' && r.totalScore !== null ? gradeOf(r.totalScore) : null,
        startedAt: started ? r.startedAt.toISOString() : null,
        deadlineAt: deadline ? deadline.toISOString() : null,
        submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
        completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      }
    }),
    nextCursor: rows.length > q.limit && last ? encodeCursor({ t: last.startedAt.toISOString(), id: last.id }) : null,
  }
}
