/**
 * 레슨 생성(api-contract #59, A4 잡) — module-dependency §4-4: A4 **요청 객체는 라우트가** conversation 의 `buildLessonRequest` 로 만들어
 * 값으로 넘기고, 이 모듈은 재료 읽기·점유(트랜잭션)·잡 실행·저장만 한다(L3 는 L2 를 import 하지 않는다).
 *
 * 점유(한 트랜잭션, 사용자 행 잠금 아래):
 *   ① 주제 레슨이면 오늘 같은 주제의 GENERATING·READY·IN_PROGRESS 레슨을 돌려준다(새 잡 없음, L10). GENERATING 인데 살아 있는 잡이
 *      없으면(프로세스가 죽은 잡) 그 행을 FAILED 로 닫고 새로 만든다.
 *   ② 사용자의 다른 LESSON_GEN 잡이 돌고 있으면 409 `{jobId, lessonId}`(사용자당 동시 생성 1).
 *   ③ 오늘 같은 주제의 FAILED 행이 있으면 그 행을 GENERATING 으로 되살리고(domain-model §5-3), 없으면 새 행. 잡(QUEUED) 생성.
 * 실행(같은 프로세스 백그라운드, batch 레인): A4 → 청취 구간 번호(L2) → `Lesson READY + content` 와 잡 DONE 을 한 트랜잭션.
 * 실패하면 레슨 FAILED(error = 오류 코드만) + 잡 FAILED. 잡 payload·Trace 에는 프롬프트·본문을 싣지 않는다(입력 메타만).
 *
 * 세대 펜싱(Codex C2-1): ③ 되살리기는 같은 레슨 행을 다시 쓰므로, 나이로 죽었다고 판정된 옛 잡 A 가 실제로는 살아 있다가 늦게
 * 끝나면(배포 전환·시스템 지연) 새 잡 B 의 레슨을 덮을 수 있다. 저장·실패 기록은 **사용자 행 잠금(점유와 같은 잠금) 뒤 자기 잡이
 * 아직 이 레슨의 현재 세대일 때만**(`jobs.isCurrentJob`) 레슨을 바꾸고, 아니면 결과를 버린다(로그만). 스키마 변경 없음.
 */
import { Prisma, type JlptLevel, type LessonStatus } from '@prisma/client'
import { llm, newTraceId, recordTrace, type LlmJsonRequest, type TraceStep } from '@/modules/engine'
import { ApiError, classifyError, dates, jobs, lockUserRow, prisma, truncateCodePoints, withTransaction, type Tx } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'
import { getTopicForLesson, type LessonTopicMaterial } from '../topics'
import { readStoredContent, toStoredContent, type LessonGenOutput } from './content'
import type { CreateLessonInput } from './validate'

export const LESSON_PREVIOUS_TITLES_MAX = 5

export interface LessonMaterials {
  input: CreateLessonInput
  topic: LessonTopicMaterial | null
  /** 레슨 수준 — 주제 수준, 붙여넣기면 학습자 수준. */
  level: JlptLevel
  /** 같은 주제의 이전 수업 제목(최근 것부터 ≤5, L6). */
  previousTitles: string[]
  /** 같은 주제 직전 완료 수업의 예고(L6). */
  previousNextPreview: { titleKo: string; teaserKo: string } | null
}

/** #59 재료 — 주제는 시드 또는 내 것(아니면 404). 읽기 전용(점유 전). */
export async function loadLessonMaterials(userId: string, input: CreateLessonInput): Promise<LessonMaterials> {
  if (input.kind === 'text') {
    const profile = await getProfile(userId)
    return { input, topic: null, level: profile.level as JlptLevel, previousTitles: [], previousNextPreview: null }
  }
  const topic = await getTopicForLesson(userId, input.topicId)
  if (!topic) throw new ApiError('NOT_FOUND', '주제를 찾을 수 없어요.')
  const prev = await prisma.lesson.findMany({
    where: { userId, topicId: topic.id, status: { in: ['READY', 'IN_PROGRESS', 'DONE'] } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: LESSON_PREVIOUS_TITLES_MAX,
    select: { title: true },
  })
  const lastDone = await prisma.lesson.findFirst({
    where: { userId, topicId: topic.id, status: 'DONE' },
    orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
    select: { content: true },
  })
  const np = readStoredContent(lastDone?.content)?.nextPreview ?? null
  return {
    input,
    topic,
    level: topic.level,
    previousTitles: prev.map((p) => p.title),
    previousNextPreview: np && typeof np.titleKo === 'string' && typeof np.teaserKo === 'string' ? { titleKo: np.titleKo, teaserKo: np.teaserKo } : null,
  }
}

export interface CreateLessonResult {
  lessonId: string
  jobId: string | null
  status: LessonStatus
  /** 오늘 같은 주제 레슨을 그대로 돌려줬는가(새 잡 없음). */
  reused: boolean
}

export interface LessonGeneration {
  /** 라우트가 `buildLessonRequest` 로 만든 요청(스키마·후검증 포함). */
  request: LlmJsonRequest<LessonGenOutput>
  promptVersion: string
  /** AiJob.payload 입력 메타(개수·길이 — 본문 없음). */
  inputMeta: Record<string, string | number | boolean | null>
}

const TEXT_LESSON_TITLE = '붙여 넣은 문장으로 만드는 수업'

export interface LessonGenClaim {
  lessonId: string
  jobId: string
  traceId: string
}
type Claim = LessonGenClaim

async function claimLesson(userId: string, m: LessonMaterials, gen: LessonGeneration): Promise<CreateLessonResult & { claim: Claim | null }> {
  const today = dates.todayKst()
  const traceId = newTraceId()
  return withTransaction(async (tx) => {
    await lockUserRow(tx, userId)
    let revive: string | null = null
    if (m.topic) {
      const same = await tx.lesson.findMany({
        where: { userId, topicId: m.topic.id, kind: 'NEW', date: dates.toDbDate(today), status: { in: ['GENERATING', 'READY', 'IN_PROGRESS', 'FAILED'] } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true, status: true },
      })
      for (const l of same) {
        if (l.status === 'READY' || l.status === 'IN_PROGRESS') return { lessonId: l.id, jobId: null, status: l.status, reused: true, claim: null }
        if (l.status === 'GENERATING') {
          const active = await jobs.findActiveJob({ userId, kind: 'LESSON_GEN', refId: l.id }, tx)
          if (active) return { lessonId: l.id, jobId: active.id, status: 'GENERATING', reused: true, claim: null }
          await tx.lesson.updateMany({ where: { id: l.id, status: 'GENERATING' }, data: { status: 'FAILED', error: 'stale' } })
        }
        revive ??= l.id
      }
    }
    const busy = await jobs.findActiveJobByKind({ userId, kind: 'LESSON_GEN' }, tx)
    if (busy) throw new ApiError('CONFLICT', '다른 수업을 만들고 있어요. 다 되면 새로 만들 수 있어요.', { reason: 'GENERATING', jobId: busy.id, lessonId: busy.refId })
    const base = {
      status: 'GENERATING' as const,
      title: truncateCodePoints(m.topic ? m.topic.title : TEXT_LESSON_TITLE, 120),
      level: m.level,
      stageDone: 0,
      score: null,
      error: null,
    }
    let lessonId: string
    if (revive) {
      await tx.lesson.update({ where: { id: revive }, data: { ...base, content: Prisma.DbNull, progress: Prisma.DbNull } })
      lessonId = revive
    } else {
      const row = await tx.lesson.create({
        data: { ...base, userId, topicId: m.topic?.id ?? null, date: dates.toDbDate(today), kind: 'NEW', sourceText: m.input.kind === 'text' ? m.input.sourceText : null },
        select: { id: true },
      })
      lessonId = row.id
    }
    const job = await jobs.createJob(
      { userId, kind: 'LESSON_GEN', refId: lessonId, traceId, payload: { promptKey: 'lesson', promptVersion: gen.promptVersion, inputMeta: gen.inputMeta } as Prisma.InputJsonValue },
      tx,
    )
    return { lessonId, jobId: job.id, status: 'GENERATING', reused: false, claim: { lessonId, jobId: job.id, traceId } }
  })
}

/** 이 잡이 더는 레슨의 현재 세대가 아니다(되살린 새 잡이 있거나 stale 로 닫힘) — 결과를 버린다. */
export class LessonGenerationSuperseded extends Error {
  constructor() {
    super('lesson generation superseded')
    this.name = 'LessonGenerationSuperseded'
  }
}

async function assertCurrentGeneration(tx: Tx, userId: string, c: Claim): Promise<void> {
  // 점유(claimLesson)와 같은 사용자 행 잠금 — 되살리기(옛 잡 stale + 새 잡)와 저장·실패가 어느 순서로 끼어들어도 한쪽만 레슨을 쓴다.
  await lockUserRow(tx, userId)
  if (!(await jobs.isCurrentJob({ id: c.jobId, userId, kind: 'LESSON_GEN', refId: c.lessonId }, tx))) throw new LessonGenerationSuperseded()
}

/** 생성 결과 저장(펜싱) — 레슨 READY + 잡 DONE 을 호출자 트랜잭션에서. 세대가 바뀌었으면 `LessonGenerationSuperseded`(트랜잭션 되돌림). */
export async function saveGeneratedLesson(
  tx: Tx,
  userId: string,
  c: Claim,
  fields: { title: string; content: Prisma.InputJsonValue; model: string; promptVersion: string },
): Promise<void> {
  await assertCurrentGeneration(tx, userId, c)
  const upd = await tx.lesson.updateMany({
    where: { id: c.lessonId, userId, status: 'GENERATING' },
    data: { status: 'READY', title: truncateCodePoints(fields.title, 120), content: fields.content, model: fields.model.slice(0, 20), promptVersion: fields.promptVersion.slice(0, 20), error: null },
  })
  if (upd.count === 0) throw new ApiError('CONFLICT', '수업 상태가 바뀌어 저장하지 못했어요.', { reason: 'STATE_CHANGED' })
  // 잠금 밖의 stale 정리(#55 조회 등)가 확인과 이 사이에 끼어들었으면 잡이 DONE 이 되지 않는다 — 레슨 갱신도 되돌린다.
  if (!(await jobs.completeJob(c.jobId, tx))) throw new LessonGenerationSuperseded()
}

/** 생성 실패 기록(펜싱) — 레슨 FAILED(오류 코드만) + 잡 FAILED 를 호출자 트랜잭션에서. 세대가 바뀌었으면 `LessonGenerationSuperseded`. */
export async function failGeneratedLesson(tx: Tx, userId: string, c: Claim, code: string): Promise<void> {
  await assertCurrentGeneration(tx, userId, c)
  await tx.lesson.updateMany({ where: { id: c.lessonId, userId, status: 'GENERATING' }, data: { status: 'FAILED', error: code.slice(0, 300) } })
  await jobs.failJob(c.jobId, code, tx)
}

function logSuperseded(c: Claim, phase: 'save' | 'fail'): void {
  console.warn(`[lesson] 세대가 바뀌어 ${phase === 'save' ? '결과' : '실패 기록'}를 버림 — job=${c.jobId} lesson=${c.lessonId}`)
}

async function markLessonFailed(userId: string, c: Claim, code: string): Promise<void> {
  try {
    await withTransaction((tx) => failGeneratedLesson(tx, userId, c, code))
  } catch (e) {
    if (e instanceof LessonGenerationSuperseded) return logSuperseded(c, 'fail')
    console.error('[lesson] FAILED 기록 실패:', e instanceof Error ? e.name : 'unknown')
  }
}

async function runGeneration(userId: string, c: Claim, gen: LessonGeneration): Promise<void> {
  const startedAt = Date.now()
  const steps: TraceStep[] = []
  let status: 'OK' | 'ERROR' = 'OK'
  let errorCode: string | null = null
  try {
    await jobs.updateJobProgress(c.jobId, 10, 'LLM')
    let t = Date.now()
    const r = await llm.completeJson<LessonGenOutput>({ ...gen.request, priority: 'batch' })
    steps.push({ name: 'LLM', ms: Date.now() - t, connection: r.connectionKey, model: r.model, attempts: r.attempts ?? 1, promptChars: r.promptChars })
    await jobs.updateJobProgress(c.jobId, 90, 'SAVE')
    t = Date.now()
    const content = toStoredContent(r.data)
    try {
      await withTransaction((tx) =>
        saveGeneratedLesson(tx, userId, c, { title: content.title, content: content as unknown as Prisma.InputJsonValue, model: r.model, promptVersion: gen.promptVersion }),
      )
    } catch (e) {
      if (!(e instanceof LessonGenerationSuperseded)) throw e
      logSuperseded(c, 'save')
      steps.push({ name: 'SAVE', ms: Date.now() - t, superseded: true })
      return
    }
    steps.push({ name: 'SAVE', ms: Date.now() - t, dialogue: content.dialogue.length, segments: content.segmentCount, chunks: content.chunks.length })
  } catch (e) {
    status = 'ERROR'
    errorCode = classifyError(e).code
    await markLessonFailed(userId, c, errorCode)
    throw e
  } finally {
    void recordTrace({ traceId: c.traceId, kind: 'TURN', userId, status, steps, totalMs: Date.now() - startedAt, errorCode, refType: 'lessonGen', refId: c.lessonId })
  }
}

/** #59 — 점유 후(새 잡이면) 백그라운드 실행을 걸고 바로 돌려준다. */
export async function createLesson(userId: string, m: LessonMaterials, gen: LessonGeneration): Promise<CreateLessonResult> {
  const { claim, ...result } = await claimLesson(userId, m, gen)
  if (claim) jobs.runJobInBackground(claim.jobId, () => runGeneration(userId, claim, gen))
  return result
}

/**
 * GENERATING 레슨의 잡이 죽었으면(프로세스 재시작·stale) FAILED 로 닫는다 — 읽는 자리의 지연 정리. 살아 있으면 잡 id.
 * 닫기는 "진행 중 잡이 **지금도** 없을 때만" 한 문장으로 한다 — 확인과 닫기 사이에 다시 만들기(#59 가 같은 행을 새 잡으로
 * 되살림)가 끼어들어도 새 잡의 레슨을 닫지 않는다. 저장(READY)과 겹쳐도 status 조건 때문에 READY 를 덮지 않는다.
 */
export async function settleGenerating(userId: string, lessonId: string, tx?: Tx): Promise<string | null> {
  const active = await jobs.findActiveJob({ userId, kind: 'LESSON_GEN', refId: lessonId }, tx)
  if (active) return active.id
  await (tx ?? prisma).$executeRaw`UPDATE Lesson SET status = 'FAILED', error = 'stale', updatedAt = NOW(3)
    WHERE id = ${lessonId} AND userId = ${userId} AND status = 'GENERATING'
      AND NOT EXISTS (SELECT 1 FROM AiJob j WHERE j.refId = ${lessonId} AND j.kind = 'LESSON_GEN' AND j.status IN ('QUEUED', 'RUNNING'))`
  return null
}
