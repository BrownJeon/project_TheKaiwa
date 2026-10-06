/**
 * 역할극 대화 시작 재료(#28 `{kind:'TALK', scenarioId, lessonId?}` — task-010d A1-서버) — **읽기 전용**. Chat 행은 L2 conversation 이 만들고,
 * 상황·주제·레슨(L3 소유 표) 판정은 여기서 한다(module-dependency §3-1 판독 규칙 2: conversation → learning 은 읽기만).
 *
 * - 접근: 상황은 시드(`userId null` + `isSeed`) 또는 본인 것만, 레슨은 본인 것만 — 아니면 **404**(다른 사용자 행이 있는지 드러내지 않는다).
 *   숨긴(`ARCHIVED`) 상황은 새 역할극을 열지 않는다(409 `ARCHIVED` — 진행 중 역할극·기록은 그대로, domain-model 상태 전이 표).
 * - `scenarioId` 없이 `lessonId` 만 오면 그 레슨의 상황(상황 수업, A2)을 쓴다. 상황이 없는 레슨이면 400(역할극이 아님 — 주제로 이어 말하기는 기존 `topicId` 경로).
 * - 주제(`Chat.topicId`): 요청 `topicId`(그 상황과 이어진 주제여야 함, 아니면 400) > 레슨 주제(이어져 있을 때) > 이어진 주제 중 `weight` 큰 것(같으면 id 순) > 없음.
 *   이어진 주제라도 남의 사용자 주제는 고르지 않는다.
 */
import type { JlptLevel } from '@prisma/client'
import { ApiError, prisma } from '@/modules/infra'

export interface ScenarioChatStartInput {
  scenarioId: string | null
  lessonId: string | null
  topicId: string | null
}

export type ScenarioTopicSource = 'REQUEST' | 'LESSON' | 'SCENARIO' | 'NONE'

export interface ScenarioChatStart {
  scenario: { id: string; title: string; titleJa: string | null; level: JlptLevel }
  lessonId: string | null
  topic: { id: string; title: string } | null
  topicSource: ScenarioTopicSource
}

export function scenarioNotFound(): ApiError {
  return new ApiError('NOT_FOUND', '상황을 찾을 수 없어요.')
}

function lessonNotFound(): ApiError {
  return new ApiError('NOT_FOUND', '수업을 찾을 수 없어요.')
}

const validId = (v: string | null): v is string => typeof v === 'string' && v.length > 0 && v.length <= 40

/** 시드 또는 본인 상황 — 다른 사용자 상황을 읽지 않는 조건(시작·종료가 같은 조건을 쓴다). */
export function scenarioAccessWhere(userId: string, scenarioId: string) {
  return { id: scenarioId, OR: [{ userId: null, isSeed: true }, { userId }] }
}

const START_SELECT = {
  id: true,
  title: true,
  titleJa: true,
  level: true,
  status: true,
  topics: { select: { topicId: true, weight: true, topic: { select: { id: true, title: true, userId: true } } } },
} as const

interface StartScenarioRow {
  id: string
  title: string
  titleJa: string | null
  level: JlptLevel
  status: string
  topics: { topicId: string; weight: number; topic: { id: string; title: string; userId: string | null } }[]
}

/** 테스트가 가짜를 넣을 수 있게 쓰는 면만 좁힌 읽기 DB. */
export interface ScenarioStartDb {
  lesson: { findFirst(args: { where: { id: string; userId: string }; select: { id: true; topicId: true; scenarioId: true } }): Promise<{ id: string; topicId: string | null; scenarioId: string | null } | null> }
  scenario: { findFirst(args: { where: ReturnType<typeof scenarioAccessWhere>; select: typeof START_SELECT }): Promise<StartScenarioRow | null> }
}

/** 이어진 주제 중 이 사용자가 볼 수 있는 것(시드·본인) — weight 큰 순, 같으면 id 순. */
export function linkedTopicsFor(userId: string, rows: StartScenarioRow['topics']): { id: string; title: string }[] {
  return rows
    .filter((r) => r.topic.userId === null || r.topic.userId === userId)
    .sort((a, b) => b.weight - a.weight || (a.topicId < b.topicId ? -1 : a.topicId > b.topicId ? 1 : 0))
    .map((r) => ({ id: r.topic.id, title: r.topic.title }))
}

export async function resolveScenarioChatStart(userId: string, input: ScenarioChatStartInput, db: ScenarioStartDb = prisma as unknown as ScenarioStartDb): Promise<ScenarioChatStart> {
  if (input.scenarioId === null && input.lessonId === null) throw new ApiError('VALIDATION', '상황을 골라 주세요.', { field: 'scenarioId', reason: 'required' })
  let lesson: { id: string; topicId: string | null; scenarioId: string | null } | null = null
  if (input.lessonId !== null) {
    if (!validId(input.lessonId)) throw lessonNotFound()
    lesson = await db.lesson.findFirst({ where: { id: input.lessonId, userId }, select: { id: true, topicId: true, scenarioId: true } })
    if (!lesson) throw lessonNotFound()
  }
  const scenarioId = input.scenarioId ?? lesson?.scenarioId ?? null
  if (scenarioId === null) throw new ApiError('VALIDATION', '이 수업에는 이어진 상황이 없어요.', { field: 'scenarioId', reason: 'required' })
  if (!validId(scenarioId)) throw scenarioNotFound()
  const row = await db.scenario.findFirst({ where: scenarioAccessWhere(userId, scenarioId), select: START_SELECT })
  if (!row) throw scenarioNotFound()
  if (row.status !== 'ACTIVE') throw new ApiError('CONFLICT', '지금은 열 수 없는 상황이에요.', { reason: 'ARCHIVED' })

  const linked = linkedTopicsFor(userId, row.topics)
  let topic: { id: string; title: string } | null = null
  let topicSource: ScenarioTopicSource = 'NONE'
  if (input.topicId !== null) {
    topic = linked.find((t) => t.id === input.topicId) ?? null
    if (!topic) throw new ApiError('VALIDATION', '이 상황과 이어진 주제가 아니에요.', { field: 'topicId', reason: 'not_linked' })
    topicSource = 'REQUEST'
  } else if (lesson?.topicId && linked.some((t) => t.id === lesson.topicId)) {
    topic = linked.find((t) => t.id === lesson.topicId) ?? null
    topicSource = 'LESSON'
  } else if (linked.length) {
    topic = linked[0]
    topicSource = 'SCENARIO'
  }
  return { scenario: { id: row.id, title: row.title, titleJa: row.titleJa, level: row.level }, lessonId: lesson?.id ?? null, topic, topicSource }
}
