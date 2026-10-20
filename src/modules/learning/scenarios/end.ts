/**
 * 역할극 종료 기록(task-010d A1-서버, Leader 결정 S1) — 학습자 [역할극 마치기](직접 행위)를 **호출자 트랜잭션 하나**에 남긴다:
 *   사용자 행 잠금 → 이미 끝낸 대화인지 확인(멱등) → 상황(시드·본인)·참조 조각 읽기 → 판정(expressions.ts) →
 *   `RepetitionItem(SCENARIO)` 등록/갱신 → `StudyLog(TALK, DIRECT, result.scenario…)` → DAILY(`talkTurns`·`corrections.proposed`·`repetition.studied`) →
 *   `LearningObservation(SCENARIO_COMPLETED)` + DAILY `observations`·`skills`(recordObservations 와 같은 두 걸음, task-080 `skills`).
 *
 * - DAILY 규칙은 기존 TALK 종료(ADD_STUDY_LOG 채택, `recordAcceptedChatLog`)와 같은 칸이다. 역할극 1건 스냅샷은 만들지 않는다(S1 — 챌린지 T6 가 필요하면 승인과 함께 더한다).
 * - 멱등: 끝낸 표식의 정본은 대화 행 `Chat.endedAt`(task-048 — conversation 이 같은 tx 에서 쓰고, 잠근 행에서 읽어 `chatEndedAt` 으로 넘긴다).
 *   `chatEndedAt` 이 있으면 **어떤 경우에도 쓰지 않는다**. 2차 방어로 그 대화의 `SCENARIO_COMPLETED` 관측(append-only, 삭제 경로 없음)도 본다(옛 행·백필 전).
 *   두 번째 종료는 아무 행도 쓰지 않고 처음 결과를 돌려준다(`replayed:true`). StudyLog 는 사용자가 지울 수 있어(#73) 표식으로 쓰지 않는다.
 * - Chat·ChatMessage·Correction 은 L2 소유라 여기서 읽지 않는다 — 라우트가 conversation 의 종료 재료(`readRolePlayEndFacts`)를 같은 tx 에서 넘긴다.
 *   학습자 말 원문은 표현 확인에만 쓰고 어디에도 저장하지 않는다.
 */
import type { ObservationOutcome, Prisma } from '@prisma/client'
import { ApiError, dates, lockUserRow, prisma, truncateCodePoints, type Tx } from '@/modules/infra'
import { registerRepetitionItems } from '../repetition'
import { growthSkillDelta, observationDailyDelta, observationRow } from '../observations'
import { bumpDailySnapshot } from '../snapshots'
import { recordStudyLog } from '../studyLog'
import {
  judgeScenarioCompletion,
  normalizeScenarioVerdict,
  readScenarioExpressions,
  scenarioChunkIds,
  scenarioRequiredExpressions,
  type ScenarioChunkRef,
  type ScenarioOutcome,
} from './expressions'
import { scenarioAccessWhere, scenarioNotFound } from './start'

/** RepetitionItem(SCENARIO) 키의 refType(refId = Scenario.id) — domain-model RepetitionItem 주석 "원천 행 … Scenario". */
export const SCENARIO_REPETITION_REF_TYPE = 'Scenario'
/** 판정 턴이 없었을 때(강사 판정 없음) 관측 신뢰도 — 0.6 미만이라 A11 은 성공/실패로 세지 않는다(observations OBSERVATION_CONFIDENCE_MIN). */
export const SCENARIO_UNJUDGED_CONFIDENCE = 0.5
/** durationSec 상한(대화를 열어 둔 채 다음 날 마쳐도 하루 넘게 적지 않는다). */
export const SCENARIO_DURATION_MAX_SEC = 3 * 3600
/**
 * 끝낸 표식(관측) 조회 하한의 여유. `LearningObservation` 인덱스가 `(userId, occurredAt)` 뿐이라(종류·참조 칸 인덱스는 스키마 변경 — DB 승인 필요, 보류)
 * 시간 하한 없이 `refType·refId` 로 찾으면 그 사용자 관측 전체를 훑는다(REV-134 M-2). 표식은 대화가 생긴 뒤에만 생기므로 `occurredAt >= Chat.createdAt`
 * 으로 범위를 좁힌다. 표식의 `occurredAt` 은 기록 때 앱 시계(`opts.now`)로 **명시해 쓴다** — `Chat.createdAt` 과 같은 시계라 시계 *차이* 위험은 없고(A3b-2),
 * 남는 위험(앱 호스트 시계 되돌림·두 호스트 blue/green 의 시계 어긋남)을 7일 여유로 덮는다(REV-140 Codex C2 — 비용 = 그 7일치 관측 행을 더 훑음).
 * 시계와 무관한 근본 해결은 `Chat.endedAt`(task-048) — 그 값이 있으면 관측은 같은 `now` 로 쓰였으므로 하한을 그 시각 기준으로도 잡는다.
 */
export const SCENARIO_END_LOOKUP_MARGIN_MS = 7 * 86_400_000

/** 끝낸 표식 관측 행의 종류·참조(refId = Chat.id) — 기록·조회·백필(`scripts/backfill-roleplay-endedat.ts`)이 같은 값을 쓴다. */
export const SCENARIO_END_MARK = { kind: 'SCENARIO_COMPLETED', refType: 'Chat' } as const

const validDate = (d: Date | null | undefined): d is Date => d instanceof Date && !Number.isNaN(d.getTime())

/**
 * 끝낸 표식 조회 하한 = (대화 생성 시각, 대화 행의 끝낸 시각 중 이른 쪽) − 여유. `chatEndedAt` 은 생략 가능 — 넣어도 하한이 늦어지지 않는다.
 * 올바른 시각이 하나도 없으면 null(하한 없음 — 느리지만 결과는 맞다).
 */
export function scenarioEndLookupSince(chatCreatedAt: Date | null | undefined, chatEndedAt?: Date | null): Date | null {
  const at = [chatCreatedAt, chatEndedAt].filter(validDate).map((d) => d.getTime())
  return at.length ? new Date(Math.min(...at) - SCENARIO_END_LOOKUP_MARGIN_MS) : null
}

const endedWhere = (userId: string, chatId: string, chatCreatedAt: Date | null | undefined, chatEndedAt?: Date | null) => {
  const since = scenarioEndLookupSince(chatCreatedAt, chatEndedAt)
  return { userId, ...(since ? { occurredAt: { gte: since } } : {}), ...SCENARIO_END_MARK, refId: chatId }
}

/**
 * 여러 역할극 대화 중 끝낸 대화 id(#27 목록 뱃지·#161 진행 중 칸) — **한 번의 조회**. 창 하한 = 그 대화들의 생성 시각 최솟값 − 여유(`scenarioEndLookupSince`).
 * 생성 시각이 올바르지 않은 대화는 범위로 확인할 수 없어 빼고 본다(끝낸 것으로 세지 않음 — 호출자가 처리). 읽기 전용.
 */
export async function endedScenarioRolePlayChatIds(
  userId: string,
  chats: readonly { id: string; createdAt: Date }[],
  db: Pick<Tx, 'learningObservation'> = prisma,
): Promise<Set<string>> {
  const ok = chats.filter((c) => validId(c.id) && scenarioEndLookupSince(c.createdAt) !== null)
  if (!ok.length) return new Set()
  const since = scenarioEndLookupSince(new Date(Math.min(...ok.map((c) => c.createdAt.getTime()))))!
  const rows = await db.learningObservation.findMany({
    where: { userId, occurredAt: { gte: since }, ...SCENARIO_END_MARK, refId: { in: [...new Set(ok.map((c) => c.id))] } },
    select: { refId: true },
  })
  return new Set(rows.map((r) => r.refId))
}

export interface ScenarioEndInput {
  chatId: string
  /** 대화 생성 시각(`Chat.createdAt`, conversation 이 잠근 행에서 읽은 값) — 끝낸 표식 조회의 시간 하한(`scenarioEndLookupSince`). */
  chatCreatedAt: Date
  /** 대화 행의 끝낸 시각(`Chat.endedAt`, 잠근 행에서 읽은 값) — 있으면 이미 끝낸 대화라 쓰지 않는다(task-048). 생략·null = 관측으로만 확인. */
  chatEndedAt?: Date | null
  /** 대화의 `Chat.scenarioId`(conversation 이 잠근 행에서 읽은 값). */
  scenarioId: string
  lessonId: string | null
  topicId: string | null
  /** 학습자 말 수(USER 메시지). 0 이면 기록하지 않는다(데모 "그만두기"). */
  turns: number
  /** 코드 표현 확인 재료 — 저장하지 않는다. */
  learnerTexts: readonly string[]
  corrections: { proposed: number; accepted: number; ignored: number }
  /** 코치 힌트를 받은 말 수 · 스스로 고친 수(SELF·REPEAT). */
  hintsUsed: number
  selfCorrections: number
  /** 첫 학습자 말 시각(durationSec 재료). */
  startedAt?: Date | null
  endOfTopic?: boolean
  /** 강사 종료 판정 `learning.scenario`(A1-PE 가 채운다) — 생략 = 판정 없음. 모양은 `normalizeScenarioVerdict` 가 다듬는다. */
  verdict?: unknown
}

export interface ScenarioEndResult {
  /** 이미 끝낸 대화였다(이번 호출은 아무 행도 쓰지 않음). */
  replayed: boolean
  chatId: string
  scenarioId: string
  studyLogId: string | null
  repetitionItemId: string | null
  outcome: ScenarioOutcome
  goalAchieved: boolean
  tutorGoalAchieved: boolean | null
  codeRulePassed: boolean
  communicationSuccess: boolean | null
  judged: boolean
  expressions: { usedIds: string[]; missedIds: string[]; verifiedIds: string[]; required: number; total: number }
  turns: number
  hintsUsed: number
  selfCorrections: number
}

const OUTCOME_OBS: Record<ScenarioOutcome, ObservationOutcome> = { ACHIEVED: 'SUCCESS', ALMOST: 'PARTIAL', NOT_YET: 'FAIL' }
const OUTCOME_KO: Record<ScenarioOutcome, string> = { ACHIEVED: '목표 달성', ALMOST: '거의 다 왔어요', NOT_YET: '아직 목표 전' }
const OUTCOMES = new Set<string>(['ACHIEVED', 'ALMOST', 'NOT_YET'])

const validId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 40
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)

/**
 * 이 대화를 이미 끝냈는가(읽기 — A3b 턴·화면이 "마친 역할극에는 더 말할 수 없어요"에 쓴다). `chat.createdAt` 은 그 대화 행의 생성 시각 —
 * 시간 하한으로 `(userId, occurredAt)` 인덱스 범위만 탄다(위 여유 주석). 턴 경로에서는 이미 읽은 Chat 행의 값을 넘긴다.
 */
export async function isScenarioRolePlayEnded(userId: string, chat: { id: string; createdAt: Date }, db: Pick<Tx, 'learningObservation'> = prisma): Promise<boolean> {
  if (!validId(chat.id)) return false
  return !!(await db.learningObservation.findFirst({ where: endedWhere(userId, chat.id, chat.createdAt), select: { id: true } }))
}

/**
 * 끝낸 역할극의 결과 읽기(task-010d A3b, Leader 승인 additive) — **읽기 전용, 쓰기·잠금 0**. #29 `chat.scenario.ended` 와 결과 화면(S9)이 같이 쓰는 단일 출처다
 * (두 번째 종료의 `replayed` 결과와 같은 함수 `replayResult` 로 만든다). 끝내지 않은 대화·다른 사용자·다른 상황이면 null.
 * 끝낸 표식 조회는 `endedWhere`(min(대화 생성, `chat.endedAt`) − 여유 하한, REV-134 M-2) + 관측의 `scenarioId` 가 그 대화의 상황과 같을 때만.
 * `endedAt` = 그 관측 시각(대화 행의 `Chat.endedAt` 이 정본이면 conversation 이 그 값을 먼저 쓴다 — 새 기록·백필 행은 둘이 같다).
 */
export async function readScenarioRolePlayResult(
  userId: string,
  chat: { id: string; createdAt: Date; scenarioId: string; endedAt?: Date | null },
  db: Pick<Tx, 'learningObservation' | 'studyLog'> = prisma,
): Promise<(ScenarioEndResult & { endedAt: Date }) | null> {
  if (!validId(userId) || !validId(chat.id) || !validId(chat.scenarioId)) return null
  const done = await db.learningObservation.findFirst({
    where: { ...endedWhere(userId, chat.id, chat.createdAt, chat.endedAt), scenarioId: chat.scenarioId },
    orderBy: { occurredAt: 'asc' },
    select: { meta: true, occurredAt: true },
  })
  if (!done) return null
  return { ...(await replayResult(userId, { chatId: chat.id, scenarioId: chat.scenarioId }, done.meta, db)), endedAt: done.occurredAt }
}

export async function endScenarioRolePlay(userId: string, input: ScenarioEndInput, tx: Tx, opts: { now?: Date } = {}): Promise<ScenarioEndResult> {
  if (!validId(input.chatId)) throw new ApiError('NOT_FOUND', '채팅을 찾을 수 없어요.')
  if (!validId(input.scenarioId)) throw scenarioNotFound()
  const turns = count(input.turns)
  if (turns === 0) throw new ApiError('CONFLICT', '아직 한 마디도 하지 않았어요.', { reason: 'NO_TURNS' })
  const now = opts.now ?? new Date()
  const today = dates.todayKst(now)

  await lockUserRow(tx, userId)
  const done = await tx.learningObservation.findFirst({
    where: endedWhere(userId, input.chatId, input.chatCreatedAt, input.chatEndedAt),
    orderBy: { occurredAt: 'asc' },
    select: { meta: true },
  })
  if (done) return replayResult(userId, input, done.meta, tx)
  // 대화 행이 끝났다고 하는데 관측을 못 찾음(정상 경로로는 생기지 않는다 — 둘은 같은 tx 에서 쓰인다): 다시 기록하지 않는다. 결과 칸은 비어 있다.
  if (validDate(input.chatEndedAt)) return replayResult(userId, input, null, tx)

  const scenario = await tx.scenario.findFirst({
    where: scenarioAccessWhere(userId, input.scenarioId),
    select: { id: true, title: true, titleJa: true, keyExpressions: true, completionRule: true },
  })
  if (!scenario) throw scenarioNotFound()
  const chunkIds = scenarioChunkIds(scenario.keyExpressions)
  const chunkRows = chunkIds.length
    ? await tx.topicChunk.findMany({ where: { id: { in: chunkIds } }, select: { id: true, textJa: true, reading: true, meaningKo: true, chunkType: true } })
    : []
  const chunks = new Map<string, ScenarioChunkRef>(chunkRows.map((c) => [c.id, c]))
  const expressions = readScenarioExpressions(scenario.keyExpressions, chunks)
  const verdict = normalizeScenarioVerdict(input.verdict, expressions.map((e) => e.id))
  const j = judgeScenarioCompletion({ expressions, required: scenarioRequiredExpressions(scenario.completionRule, expressions.length), learnerTexts: input.learnerTexts, verdict })

  const [rep] = await registerRepetitionItems(
    userId,
    [
      {
        itemType: 'SCENARIO',
        refType: SCENARIO_REPETITION_REF_TYPE,
        refId: scenario.id,
        textJa: scenario.titleJa ?? scenario.title,
        meaningKo: scenario.title,
        correct: j.goalAchieved ? 1 : 0,
        wrong: j.goalAchieved ? 0 : 1,
      },
    ],
    tx,
    { today, now },
  )
  const corrections = { proposed: count(input.corrections.proposed), accepted: count(input.corrections.accepted), ignored: count(input.corrections.ignored) }
  const hintsUsed = count(input.hintsUsed)
  const selfCorrections = count(input.selfCorrections)
  const startedAt = input.startedAt instanceof Date && !Number.isNaN(input.startedAt.getTime()) ? input.startedAt : null
  const durationSec = startedAt ? Math.min(SCENARIO_DURATION_MAX_SEC, Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 1000))) : null
  const title = truncateCodePoints(scenario.title, 60)
  const log = await recordStudyLog(
    userId,
    {
      date: today,
      type: 'TALK',
      origin: 'DIRECT',
      refId: input.chatId,
      summary: `상황 역할극 「${title}」 · ${OUTCOME_KO[j.outcome]} · 핵심 표현 ${j.usedIds.length}/${j.total}`,
      result: {
        turns,
        corrections,
        scenario: {
          scenarioId: scenario.id,
          outcome: j.outcome,
          goalAchieved: j.goalAchieved,
          tutorGoalAchieved: j.tutorGoalAchieved,
          codeRulePassed: j.codeRulePassed,
          communicationSuccess: j.communicationSuccess,
          judged: j.judged,
          hintsUsed,
          selfCorrections,
          usedExpressionIds: j.usedIds,
          missedExpressionIds: j.missedIds,
          verifiedExpressionIds: j.verifiedIds,
          requiredExpressions: j.required,
          totalExpressions: j.total,
          topicId: input.topicId,
          lessonId: input.lessonId,
          repetitionItemId: rep?.id ?? null,
        },
        endOfTopic: input.endOfTopic === true,
      } as Prisma.InputJsonValue,
      correctionsCount: corrections.proposed,
      durationSec,
    },
    tx,
  )
  await bumpDailySnapshot(userId, today, { talkTurns: turns, corrections: { proposed: corrections.proposed }, repetition: { studied: rep ? 1 : 0 } }, tx)
  // 끝낸 표식 — `occurredAt` 을 앱 시계(`now`)로 명시한다(위 여유 주석·REV-140 L-2: 첫 응답 `endedAt`(=now)과 이후 #29·재종료가 읽는 저장 값이 같다).
  // recordObservations 와 같은 두 걸음(createMany + DAILY observations)을 시각 칸 하나만 더해 여기서 한다.
  const endObservation = {
    ...observationRow(userId, {
      ...SCENARIO_END_MARK,
      outcome: OUTCOME_OBS[j.outcome],
      refId: input.chatId,
      scenarioId: scenario.id,
      confidence: j.judged ? 1 : SCENARIO_UNJUDGED_CONFIDENCE,
      meta: {
        outcome: j.outcome,
        goal: j.goalAchieved,
        tutor: j.tutorGoalAchieved,
        rule: j.codeRulePassed,
        comm: j.communicationSuccess,
        judged: j.judged,
        used: j.usedIds.length,
        req: j.required,
        total: j.total,
        turns,
        hints: hintsUsed,
        self: selfCorrections,
        logId: log.id,
        repId: rep?.id ?? null,
      },
    }),
    occurredAt: now,
  }
  await tx.learningObservation.createMany({ data: [endObservation] })
  await bumpDailySnapshot(userId, today, { observations: observationDailyDelta([endObservation]), skills: growthSkillDelta([endObservation]) }, tx)
  return {
    replayed: false,
    chatId: input.chatId,
    scenarioId: scenario.id,
    studyLogId: log.id,
    repetitionItemId: rep?.id ?? null,
    outcome: j.outcome,
    goalAchieved: j.goalAchieved,
    tutorGoalAchieved: j.tutorGoalAchieved,
    codeRulePassed: j.codeRulePassed,
    communicationSuccess: j.communicationSuccess,
    judged: j.judged,
    expressions: { usedIds: j.usedIds, missedIds: j.missedIds, verifiedIds: j.verifiedIds, required: j.required, total: j.total },
    turns,
    hintsUsed,
    selfCorrections,
  }
}

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const boolOrNull = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** 두 번째 종료 — 처음 기록(관측 meta, StudyLog 가 남아 있으면 표현 id 까지)으로 같은 결과를 만든다. 쓰기 0. */
async function replayResult(userId: string, input: Pick<ScenarioEndInput, 'chatId' | 'scenarioId'>, metaJson: Prisma.JsonValue | null, tx: Pick<Tx, 'studyLog'>): Promise<ScenarioEndResult> {
  const m = rec(metaJson)
  const logId = validId(m.logId) ? m.logId : null
  const log = logId ? await tx.studyLog.findFirst({ where: { id: logId, userId }, select: { id: true, result: true } }) : null
  const s = rec(rec(log?.result).scenario)
  const outcome: ScenarioOutcome = typeof m.outcome === 'string' && OUTCOMES.has(m.outcome) ? (m.outcome as ScenarioOutcome) : 'NOT_YET'
  return {
    replayed: true,
    chatId: input.chatId,
    scenarioId: validId(s.scenarioId) ? s.scenarioId : input.scenarioId,
    studyLogId: log?.id ?? null,
    repetitionItemId: validId(m.repId) ? m.repId : null,
    outcome,
    goalAchieved: m.goal === true,
    tutorGoalAchieved: boolOrNull(m.tutor),
    codeRulePassed: m.rule === true,
    communicationSuccess: boolOrNull(m.comm),
    judged: m.judged === true,
    expressions: { usedIds: strList(s.usedExpressionIds), missedIds: strList(s.missedExpressionIds), verifiedIds: strList(s.verifiedExpressionIds), required: count(m.req), total: count(m.total) },
    turns: count(m.turns),
    hintsUsed: count(m.hints),
    selfCorrections: count(m.self),
  }
}
