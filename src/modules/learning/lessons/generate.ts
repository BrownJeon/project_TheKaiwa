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
import { getActiveChallengeTopic } from '../challenges'
import { assertScenarioStartableTx, readScenarioRolePlayMaterial, resolveScenarioChatStart, scenarioNotFound, type ScenarioChatStart, type ScenarioChatStartInput, type ScenarioRolePlayMaterial } from '../scenarios/start'
import { isSeedVisibleFor } from '../seedOverride/visibility'
import { readTargetLevel, type TargetLevel } from '../targetLevel'
import { getTopicForLesson, type LessonTopicMaterial } from '../topics'
import { assertTopicVisible, mapTopicGone, topicGone } from '../topics/visible'
import { readStoredContent, toStoredContent, type LessonGenOutput } from './content'
import type { CreateLessonInput } from './validate'

export const LESSON_PREVIOUS_TITLES_MAX = 5

export interface LessonMaterials {
  input: CreateLessonInput
  /** 주제 수업의 주제 · 상황 수업의 대표 주제(없으면 null). `Lesson.topicId` 가 된다. */
  topic: LessonTopicMaterial | null
  /** 상황 수업(task-010d A2) 재료 — 라우트가 conversation `scenarioPromptParts` 로 A4 `[상황]` 입력을 만든다. 그 밖 수업은 null. */
  scenario: ScenarioRolePlayMaterial | null
  /**
   * 레슨 수준(`Lesson.level`·A4 `topic.level` 둘 다 이 값 — `lessonInput.ts`). 주제 수업은 기준 수준 T(task-076 L7: 진행 중 챌린지 난이도,
   * 없으면 목표 수준, 없으면 지금 수준 — T 를 확정하지 못하면 주제 수준). 상황 수업은 대표 주제가 있으면 주제 수준, 없으면 상황 수준,
   * 붙여넣기면 학습자 수준(둘 다 task-076 전과 같다).
   */
  level: JlptLevel
  /** 같은 주제의 이전 수업 제목(최근 것부터 ≤5, L6). 주제 없는 상황 수업은 같은 상황의 이전 수업. */
  previousTitles: string[]
  /** 같은 주제 직전 완료 수업의 예고(L6). */
  previousNextPreview: { titleKo: string; teaserKo: string } | null
}

type LessonHistory = Pick<LessonMaterials, 'previousTitles' | 'previousNextPreview'>
type LessonHistoryKey = { topicId: string } | { scenarioId: string }

async function loadLessonHistory(userId: string, key: LessonHistoryKey): Promise<LessonHistory> {
  const prev = await prisma.lesson.findMany({
    where: { userId, ...key, status: { in: ['READY', 'IN_PROGRESS', 'DONE'] } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: LESSON_PREVIOUS_TITLES_MAX,
    select: { title: true },
  })
  const lastDone = await prisma.lesson.findFirst({
    where: { userId, ...key, status: 'DONE' },
    orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
    select: { content: true },
  })
  const np = readStoredContent(lastDone?.content)?.nextPreview ?? null
  return {
    previousTitles: prev.map((p) => p.title),
    previousNextPreview: np && typeof np.titleKo === 'string' && typeof np.teaserKo === 'string' ? { titleKo: np.titleKo, teaserKo: np.teaserKo } : null,
  }
}

/** 상황 수업 재료 읽기의 바깥 의존 — 시험이 가짜를 넣는다(기본 = 실제 DB 읽기). */
export interface ScenarioLessonDeps {
  start: (userId: string, input: ScenarioChatStartInput) => Promise<ScenarioChatStart>
  material: (userId: string, scenarioId: string) => Promise<ScenarioRolePlayMaterial | null>
  topic: (userId: string, topicId: string) => Promise<LessonTopicMaterial | null>
  history: (userId: string, key: LessonHistoryKey) => Promise<LessonHistory>
}

const SCENARIO_LESSON_DEPS: ScenarioLessonDeps = {
  start: (userId, input) => resolveScenarioChatStart(userId, input),
  material: (userId, scenarioId) => readScenarioRolePlayMaterial(userId, scenarioId),
  topic: getTopicForLesson,
  history: loadLessonHistory,
}

/**
 * 상황 수업 재료(#59 `{scenarioId, topicId?}`). 접근·상태·주제 규칙은 역할극 대화 시작(#28)과 **같은 함수**(`resolveScenarioChatStart`)로 판정한다 —
 * 시드(`userId null`+`isSeed`) 또는 본인 상황만(아니면 404), 숨긴(`ARCHIVED`) 상황은 새 수업도 409 `ARCHIVED`, 요청 `topicId` 는 그 상황과 이어진 주제여야
 * 한다(아니면 400 `not_linked`). **대표 주제**(`Lesson.topicId`) = 요청 주제, 없으면 이어진 주제 중 `weight` 가 가장 큰 것(같으면 topicId 오름차순 첫 번째 —
 * 역할극 대화의 기본 주제와 같은 순서), 이어진 주제가 없으면 null(상황 단독 수업 — 챌린지 주제 수업으로 세지 않는다).
 */
export async function loadScenarioLessonMaterials(
  userId: string,
  input: Extract<CreateLessonInput, { kind: 'scenario' }>,
  deps: ScenarioLessonDeps = SCENARIO_LESSON_DEPS,
): Promise<LessonMaterials> {
  const start = await deps.start(userId, { scenarioId: input.scenarioId, lessonId: null, topicId: input.topicId })
  const scenario = await deps.material(userId, start.scenario.id)
  if (!scenario) throw scenarioNotFound()
  const topic = start.topic ? await deps.topic(userId, start.topic.id) : null
  const history = await deps.history(userId, topic ? { topicId: topic.id } : { scenarioId: scenario.id })
  return { input, topic, scenario, level: topic ? topic.level : scenario.level, ...history }
}

/** 주제 수업 재료 읽기의 바깥 의존 — 시험이 가짜를 넣는다(기본 = 실제 DB 읽기). */
export interface TopicLessonDeps {
  topic: (userId: string, topicId: string) => Promise<LessonTopicMaterial | null>
  /** 이 사용자가 가린(숨김·내 버전) 시드 주제가 아닌가(task-045 §2). */
  visible: (userId: string, topicId: string) => Promise<boolean>
  /** 진행 중 챌린지의 오늘 수업 주제 id(수업 과제가 켜져 있고 기간 안일 때만) 또는 null. */
  challengeTopicId: (userId: string) => Promise<string | null>
  history: (userId: string, key: LessonHistoryKey) => Promise<LessonHistory>
  /** 기준 수준 T(task-076) — 확정하지 못하면 null(→ 주제 수준, 지금 동작). 던지지 않는다. */
  targetLevel: (userId: string) => Promise<TargetLevel | null>
}

const TOPIC_LESSON_DEPS: TopicLessonDeps = {
  topic: getTopicForLesson,
  visible: (userId, topicId) => isSeedVisibleFor(prisma, userId, 'TOPIC', topicId),
  challengeTopicId: async (userId) => (await getActiveChallengeTopic(userId))?.topicId ?? null,
  history: loadLessonHistory,
  targetLevel: (userId) => readTargetLevel(userId),
}

/**
 * 주제 수업 재료(#59 `{topicId}`) — 시드 또는 내 주제, 이 사용자가 가린 시드 주제는 없는 주제와 같은 404 `TOPIC_GONE`(#156·#47·#65 와 같은 오류 계약, 새 수업을 만들지 않는다 — 지난 수업은 그대로).
 * 예외: 진행 중 챌린지의 수업 주제면 허용한다(계약 §0 #9 "시드 숨김에서 진행 중 챌린지는 계속" — 챌린지 오늘 수업 과제가 이 경로로 수업을 만든다).
 * 챌린지 조회는 가려진 주제일 때만 한다(override 없는 사용자는 추가 조회 1회 = override 확인뿐).
 * 잠금 안 재확인(삭제 경쟁, Codex C1 ⓐ)은 `claimLessonTx` 의 `assertTopicVisible`(같은 예외). 상황 수업은 `resolveScenarioChatStart` 가 같은 규칙(가린 시드 상황 404·장소 치환)을 판정한다.
 */
export async function loadTopicLessonMaterials(userId: string, input: Extract<CreateLessonInput, { kind: 'topic' }>, deps: TopicLessonDeps = TOPIC_LESSON_DEPS): Promise<LessonMaterials> {
  const topic = await deps.topic(userId, input.topicId)
  const allowed = topic !== null && ((await deps.visible(userId, topic.id)) || (await deps.challengeTopicId(userId)) === topic.id)
  if (!topic || !allowed) throw topicGone()
  const target = await deps.targetLevel(userId)
  return { input, topic, scenario: null, level: target?.level ?? topic.level, ...(await deps.history(userId, { topicId: topic.id })) }
}

/** #59 재료 — 주제는 시드 또는 내 것(아니면 404). 읽기 전용(점유 전). */
export async function loadLessonMaterials(userId: string, input: CreateLessonInput): Promise<LessonMaterials> {
  if (input.kind === 'text') {
    const profile = await getProfile(userId)
    return { input, topic: null, scenario: null, level: profile.level as JlptLevel, previousTitles: [], previousNextPreview: null }
  }
  if (input.kind === 'scenario') return loadScenarioLessonMaterials(userId, input)
  return loadTopicLessonMaterials(userId, input)
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
  /** 생성 잡 종류 — 새 수업 `LESSON_GEN`(기본), 복습 수업 `REVIEW_GEN`(task-010b #63). 세대 펜싱·지연 정리가 같은 종류만 본다. */
  kind?: LessonGenKind
}
export type LessonGenKind = 'LESSON_GEN' | 'REVIEW_GEN'
type Claim = LessonGenClaim

/**
 * 오늘 "같은 수업"(재사용·되살리기 후보)을 찾는 조건 — 키 = (사용자, 주제, **상황**, 오늘, NEW). 상황을 키에 넣지 않으면 같은 날 같은 주제의 일반 수업과
 * 상황 수업(또는 서로 다른 상황 수업)이 서로를 재사용한다(task-010d A2). 일반 수업은 `scenarioId IS NULL`, 주제 없는 상황 수업은 `topicId IS NULL`.
 * 붙여넣기 수업(주제·상황 없음)은 null — 재사용하지 않는다(이전과 같다).
 */
export function sameLessonWhere(userId: string, m: Pick<LessonMaterials, 'topic' | 'scenario'>, todayDb: Date) {
  if (!m.topic && !m.scenario) return null
  return {
    userId,
    topicId: m.topic?.id ?? null,
    scenarioId: m.scenario?.id ?? null,
    kind: 'NEW' as const,
    date: todayDb,
    status: { in: ['GENERATING', 'READY', 'IN_PROGRESS', 'FAILED'] as LessonStatus[] },
  }
}

/** 점유 본체(호출자 트랜잭션) — 시험이 가짜 tx 로 재사용 판정·생성 행을 본다. */
export async function claimLessonTx(tx: Tx, userId: string, m: LessonMaterials, gen: LessonGeneration, today: string, traceId: string): Promise<CreateLessonResult & { claim: Claim | null }> {
  await lockUserRow(tx, userId)
  // 재료는 잠금 전에 읽었다 — 상황 지우기·숨김(#165, 같은 잠금)이 그 사이 끝났으면 시작 판정과 같은 404/409 ARCHIVED(Codex C2). 챌린지 예외는 주제에만 있다.
  if (m.scenario) await assertScenarioStartableTx(tx, userId, m.scenario.id)
  // 주제 삭제(#173, 같은 잠금)가 그 사이 끝났으면 404 TOPIC_GONE(Codex C1 ⓐ). 진행 중 챌린지 주제는 가린 시드여도 허용(§0 #9).
  if (m.topic) await assertTopicVisible(tx, userId, m.topic.id, { allowActiveChallenge: true })
  let revive: string | null = null
  const sameWhere = sameLessonWhere(userId, m, dates.toDbDate(today))
  if (sameWhere) {
    const same = await tx.lesson.findMany({ where: sameWhere, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, status: true } })
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
    title: truncateCodePoints(m.scenario ? m.scenario.title : m.topic ? m.topic.title : TEXT_LESSON_TITLE, 120),
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
    let row: { id: string }
    try {
      row = await tx.lesson.create({
        data: {
          ...base,
          userId,
          topicId: m.topic?.id ?? null,
          scenarioId: m.scenario?.id ?? null,
          date: dates.toDbDate(today),
          kind: 'NEW',
          sourceText: m.input.kind === 'text' ? m.input.sourceText : null,
        },
        select: { id: true },
      })
    } catch (e) {
      // 잠금 밖에서 주제가 지워진 경우(시드 로더 등) — FK 위반을 500 대신 404 TOPIC_GONE 으로.
      throw mapTopicGone(e)
    }
    lessonId = row.id
  }
  const job = await jobs.createJob(
    { userId, kind: 'LESSON_GEN', refId: lessonId, traceId, payload: { promptKey: 'lesson', promptVersion: gen.promptVersion, inputMeta: gen.inputMeta } as Prisma.InputJsonValue },
    tx,
  )
  return { lessonId, jobId: job.id, status: 'GENERATING', reused: false, claim: { lessonId, jobId: job.id, traceId } }
}

async function claimLesson(userId: string, m: LessonMaterials, gen: LessonGeneration): Promise<CreateLessonResult & { claim: Claim | null }> {
  const today = dates.todayKst()
  const traceId = newTraceId()
  return withTransaction((tx) => claimLessonTx(tx, userId, m, gen, today, traceId))
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
  if (!(await jobs.isCurrentJob({ id: c.jobId, userId, kind: c.kind ?? 'LESSON_GEN', refId: c.lessonId }, tx))) throw new LessonGenerationSuperseded()
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

/** 생성 잡 본체 — 새 수업(A4)·복습 수업(A5, task-010b #63) 공용. 요청 객체는 라우트가 conversation 으로 만들어 값으로 넘긴다. */
export async function runLessonGeneration(userId: string, c: Claim, gen: LessonGeneration): Promise<void> {
  const startedAt = Date.now()
  const steps: TraceStep[] = []
  let status: 'OK' | 'ERROR' = 'OK'
  let errorCode: string | null = null
  try {
    await jobs.updateJobProgress(c.jobId, 10, 'LLM')
    let t = Date.now()
    const r = await llm.completeJson<LessonGenOutput>({ ...gen.request, priority: 'batch', traceId: c.traceId })
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
    void recordTrace({ traceId: c.traceId, kind: 'TURN', userId, status, steps, totalMs: Date.now() - startedAt, errorCode, refType: c.kind === 'REVIEW_GEN' ? 'reviewGen' : 'lessonGen', refId: c.lessonId })
  }
}

/** #59 — 점유 후(새 잡이면) 백그라운드 실행을 걸고 바로 돌려준다. */
export async function createLesson(userId: string, m: LessonMaterials, gen: LessonGeneration): Promise<CreateLessonResult> {
  const { claim, ...result } = await claimLesson(userId, m, gen)
  if (claim) jobs.runJobInBackground(claim.jobId, () => runLessonGeneration(userId, claim, gen))
  return result
}

/**
 * GENERATING 레슨의 잡이 죽었으면(프로세스 재시작·stale) FAILED 로 닫는다 — 읽는 자리의 지연 정리. 살아 있으면 잡 id.
 * 닫기는 "진행 중 잡이 **지금도** 없을 때만" 한 문장으로 한다 — 확인과 닫기 사이에 다시 만들기(#59 가 같은 행을 새 잡으로
 * 되살림)가 끼어들어도 새 잡의 레슨을 닫지 않는다. 저장(READY)과 겹쳐도 status 조건 때문에 READY 를 덮지 않는다.
 */
export async function settleGenerating(userId: string, lessonId: string, tx?: Tx, kind: LessonGenKind = 'LESSON_GEN'): Promise<string | null> {
  const active = await jobs.findActiveJob({ userId, kind, refId: lessonId }, tx)
  if (active) return active.id
  await (tx ?? prisma).$executeRaw`UPDATE Lesson SET status = 'FAILED', error = 'stale', updatedAt = NOW(3)
    WHERE id = ${lessonId} AND userId = ${userId} AND status = 'GENERATING'
      AND NOT EXISTS (SELECT 1 FROM AiJob j WHERE j.refId = ${lessonId} AND j.kind = ${kind} AND j.status IN ('QUEUED', 'RUNNING'))`
  return null
}

/** 레슨 종류 → 생성 잡 종류(복습 수업은 A5 `REVIEW_GEN`). */
export function lessonGenKindOf(kind: 'NEW' | 'REVIEW'): LessonGenKind {
  return kind === 'REVIEW' ? 'REVIEW_GEN' : 'LESSON_GEN'
}
