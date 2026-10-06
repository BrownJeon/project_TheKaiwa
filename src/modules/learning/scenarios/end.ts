/**
 * 역할극 종료 기록(task-010d A1-서버, Leader 결정 S1) — 학습자 [역할극 마치기](직접 행위)를 **호출자 트랜잭션 하나**에 남긴다:
 *   사용자 행 잠금 → 이미 끝낸 대화인지 확인(멱등) → 상황(시드·본인)·참조 조각 읽기 → 판정(expressions.ts) →
 *   `RepetitionItem(SCENARIO)` 등록/갱신 → `StudyLog(TALK, DIRECT, result.scenario…)` → DAILY(`talkTurns`·`corrections.proposed`·`repetition.studied`) →
 *   `LearningObservation(SCENARIO_COMPLETED)` + DAILY `observations`(recordObservations).
 *
 * - DAILY 규칙은 기존 TALK 종료(ADD_STUDY_LOG 채택, `recordAcceptedChatLog`)와 같은 칸이다. 역할극 1건 스냅샷은 만들지 않는다(S1 — 챌린지 T6 가 필요하면 승인과 함께 더한다).
 * - 멱등: 끝낸 표식은 그 대화의 `SCENARIO_COMPLETED` 관측(append-only, 삭제 경로 없음)이다. 두 번째 종료는 아무 행도 쓰지 않고 처음 결과를 돌려준다
 *   (`replayed:true`). StudyLog 는 사용자가 지울 수 있어(#73) 표식으로 쓰지 않는다.
 * - Chat·ChatMessage·Correction 은 L2 소유라 여기서 읽지 않는다 — 라우트가 conversation 의 종료 재료(`readRolePlayEndFacts`)를 같은 tx 에서 넘긴다.
 *   학습자 말 원문은 표현 확인에만 쓰고 어디에도 저장하지 않는다.
 */
import type { ObservationOutcome, Prisma } from '@prisma/client'
import { ApiError, dates, lockUserRow, prisma, truncateCodePoints, type Tx } from '@/modules/infra'
import { registerRepetitionItems } from '../repetition'
import { recordObservations } from '../observations'
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

export interface ScenarioEndInput {
  chatId: string
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

/** 이 대화를 이미 끝냈는가(읽기 — A3 턴·화면이 "마친 역할극에는 더 말할 수 없어요"에 쓴다). */
export async function isScenarioRolePlayEnded(userId: string, chatId: string, db: Pick<Tx, 'learningObservation'> = prisma): Promise<boolean> {
  if (!validId(chatId)) return false
  return (await db.learningObservation.count({ where: { userId, kind: 'SCENARIO_COMPLETED', refType: 'Chat', refId: chatId } })) > 0
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
    where: { userId, kind: 'SCENARIO_COMPLETED', refType: 'Chat', refId: input.chatId },
    orderBy: { occurredAt: 'asc' },
    select: { meta: true },
  })
  if (done) return replayResult(userId, input, done.meta, tx)

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
  await recordObservations(
    userId,
    [
      {
        kind: 'SCENARIO_COMPLETED',
        outcome: OUTCOME_OBS[j.outcome],
        refType: 'Chat',
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
      },
    ],
    tx,
    { date: today },
  )
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
async function replayResult(userId: string, input: ScenarioEndInput, metaJson: Prisma.JsonValue | null, tx: Tx): Promise<ScenarioEndResult> {
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
