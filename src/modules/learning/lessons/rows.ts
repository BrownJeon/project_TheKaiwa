/**
 * 레슨 행 공통 — 조회 모양·DTO(엔진명·모델 칸 제외)·잠금·오류.
 *
 * 잠금 순서(교착 방지 — task-006/008 과 같은 "사용자 행 → 대상 행"):
 *   생성(#59): 사용자 행 → (같은 날 같은 주제 레슨·진행 중 생성 잡 확인) → 레슨·잡 생성
 *   진행 저장(#61)·메모(#62a)·말하기(#62b): 사용자 행 → 레슨 행(FOR UPDATE) → (메모: 제안 행 / 말하기: 발화 행) → progress
 *   완료(#62): 사용자 행 → 레슨 행 → RepetitionItem → StudyLog → StatsSnapshot(LESSON) → DAILY
 */
import type { JlptLevel, LessonKind, LessonStatus, Prisma } from '@prisma/client'
import { ApiError, dates, lockUserRow, type Tx } from '@/modules/infra'
import { readStoredContent, type StoredLessonContent } from './content'
import { readProgress, type LessonProgress } from './progress'
import { isLessonId } from './validate'

export const LESSON_SELECT = {
  id: true, userId: true, topicId: true, scenarioId: true, date: true, kind: true, title: true, level: true, content: true, status: true, stageDone: true,
  progress: true, score: true, sourceLessonIds: true, sourceText: true, error: true, createdAt: true, updatedAt: true, completedAt: true,
  topic: { select: { id: true, title: true } },
  reviewSchedule: { select: { id: true, itemIds: true } },
} as const
export type LessonRow = Prisma.LessonGetPayload<{ select: typeof LESSON_SELECT }>

export function lessonNotFound(): ApiError {
  return new ApiError('NOT_FOUND', '수업을 찾을 수 없어요.')
}

export interface LessonDto {
  id: string
  kind: LessonKind
  date: string
  title: string
  titleKo: string | null
  level: JlptLevel
  status: LessonStatus
  stageDone: number
  progress: LessonProgress
  score: number | null
  source: 'TOPIC' | 'TEXT'
  topic: { id: string; title: string } | null
  /** 상황 수업(task-010d A2)이면 그 상황 id — 일반·붙여넣기·복습 수업은 null. 상황이 지워지면 null(SetNull). */
  scenarioId: string | null
  sourceLessonIds: string[] | null
  /** READY 이후만. A4 스키마 JSON + 대화 줄 `segment`(청취 구간 번호) + `segmentCount`. */
  content: StoredLessonContent | null
  /** 오디오는 미리 만들지 않는다 — 재생할 때 #62c 로 요청(L2). */
  audio: null
  reviewScheduleId: string | null
  /** GENERATING 이면 진행 중 잡 id(#55 폴링). */
  jobId: string | null
  /** FAILED 이면 오류 코드(ENGINE_TIMEOUT 등, 본문 없음). */
  error: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

function idList(v: unknown): string[] | null {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null
}

/** 진행 기록 중 서버 전용 칸(`reviewDecision` — 강사 복습 판단 결과, task-010b)은 응답 `progress` 에 싣지 않는다(#60 `nextReview` 로만). */
function publicProgress(p: LessonProgress): LessonProgress {
  if (!('reviewDecision' in p)) return p
  const { reviewDecision: _hidden, ...rest } = p
  void _hidden
  return rest
}

/** `model`·`promptVersion`·`sourceText` 는 싣지 않는다(엔진 식별 정보 비노출 — 모델은 저장만). */
export function toLessonDto(row: LessonRow, jobId: string | null = null): LessonDto {
  const content = readStoredContent(row.content)
  return {
    id: row.id,
    kind: row.kind,
    date: dates.fromDbDate(row.date),
    title: row.title,
    titleKo: content?.titleKo ?? null,
    level: row.level,
    status: row.status,
    stageDone: row.stageDone,
    progress: publicProgress(readProgress(row.progress)),
    score: row.score,
    source: row.sourceText ? 'TEXT' : 'TOPIC',
    topic: row.topic ? { id: row.topic.id, title: row.topic.title } : null,
    scenarioId: row.scenarioId ?? null,
    sourceLessonIds: idList(row.sourceLessonIds),
    content,
    audio: null,
    reviewScheduleId: row.reviewSchedule?.id ?? null,
    jobId: row.status === 'GENERATING' ? jobId : null,
    error: row.status === 'FAILED' ? row.error : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  }
}

/** 레슨 행 잠금(FOR UPDATE) 후 최신 행 — 없거나 남의 것 404. 사용자 행은 호출자가 먼저 잡는다. */
export async function lockLesson(tx: Tx, userId: string, id: string): Promise<LessonRow> {
  if (!isLessonId(id)) throw lessonNotFound()
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM Lesson WHERE id = ${id} AND userId = ${userId} FOR UPDATE`
  if (!rows.length) throw lessonNotFound()
  return tx.lesson.findUniqueOrThrow({ where: { id }, select: LESSON_SELECT })
}

export function stateConflict(row: Pick<LessonRow, 'status'>): ApiError | null {
  if (row.status === 'DONE') return new ApiError('CONFLICT', '이미 끝낸 수업이에요.', { reason: 'ALREADY_DONE', status: row.status })
  if (row.status !== 'READY' && row.status !== 'IN_PROGRESS') return new ApiError('CONFLICT', '아직 수업을 열 수 없어요.', { reason: 'NOT_READY', status: row.status })
  return null
}

export interface LessonWriteHandle {
  row: LessonRow
  content: StoredLessonContent
  progress: LessonProgress
}

/** 진행 쓰기용 잠금 — 사용자 행 → 레슨 행. READY·IN_PROGRESS 만(DONE 409 ALREADY_DONE, 그 밖 409 NOT_READY). */
export async function lockLessonForWrite(tx: Tx, userId: string, id: string): Promise<LessonWriteHandle> {
  if (!isLessonId(id)) throw lessonNotFound()
  await lockUserRow(tx, userId)
  const row = await lockLesson(tx, userId, id)
  const conflict = stateConflict(row)
  if (conflict) throw conflict
  const content = readStoredContent(row.content)
  if (!content) throw new ApiError('CONFLICT', '아직 수업을 열 수 없어요.', { reason: 'NOT_READY', status: row.status })
  return { row, content, progress: readProgress(row.progress) }
}

/** 진행 저장 — READY 면 IN_PROGRESS 로(첫 진행). */
export async function writeProgress(tx: Tx, h: LessonWriteHandle, progress: LessonProgress, stageDone?: number): Promise<LessonRow> {
  return tx.lesson.update({
    where: { id: h.row.id },
    data: {
      progress: progress as unknown as Prisma.InputJsonValue,
      ...(stageDone !== undefined ? { stageDone } : {}),
      ...(h.row.status === 'READY' ? { status: 'IN_PROGRESS' as const } : {}),
    },
    select: LESSON_SELECT,
  })
}
