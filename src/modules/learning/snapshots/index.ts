/**
 * StatsSnapshot — 집계 원장(domain-model 규칙 2: **생성·증가만**, 삭제 경로에서 쓰지 않는다). task-006 은 DAILY 증가만.
 *
 * DAILY `data` 형태(domain-model §9-3):
 *   {attended, words:{sessions,correct,wrong}, talkTurns, chatTurns, corrections:{proposed,accepted}, lessons, reviews, evals, repetition:{studied, focus}
 *    , observations?:{total, bySkill:{<SkillAxis>:{success,partial,fail,skipped}}, selfCorrections, reuses}}
 *   `observations` 는 task-010b(학습 관측)가 더한 **선택 칸**이다 — 관측이 한 건도 없는 날의 행에는 생기지 않는다(기존 행·소비자 불변).
 *    , skills?:{<SkillAxis>:{success,partial,fail,skipped,uncertain,fromCorrection?}}
 *   `skills` 는 task-080(성장 탭 공부결과)이 더한 **선택 칸**이다 — `observations.bySkill` 과 달리 교정 채택·무시·자기수정을 세지 않고
 *   신뢰도 < 0.6 은 `uncertain` 으로만 센다(`observations/growthSkillDelta`, screens.md §36-8). 셀 관측이 없는 날의 행에는 생기지 않는다.
 *   `fromCorrection`(2026-10-21, §36-17-2 C 규칙) = success·partial·fail 로 센 관측 중 교정 제안·재사용에서 온 개수. 그 전 행에는 없다(= 0).
 *   옛 코드의 `mergeDaily` 는 모르는 키를 보존(`...c`)하므로 코드를 되돌려도 칸은 남는다(증가만 멈춤).
 *
 * 동시성: 행이 없을 때 두 트랜잭션이 동시에 만들면 유니크(userId,kind,periodKey) 충돌, 있을 때 동시에 읽고 쓰면 증가 유실이다.
 * 그래서 `INSERT … ON DUPLICATE KEY UPDATE id=id`(행 보장 + 행 잠금) → `SELECT … FOR UPDATE` → 병합 → UPDATE 를 **호출자 트랜잭션 안**에서 한다.
 */
import type { Prisma } from '@prisma/client'
import { type Tx } from '@/modules/infra'
import { rawRowId } from '../learningHistory'

export interface DailyData {
  attended: boolean
  words: { sessions: number; correct: number; wrong: number }
  talkTurns: number
  chatTurns: number
  corrections: { proposed: number; accepted: number }
  lessons: number
  reviews: number
  evals: number
  repetition: { studied: number; focus: number }
}

export interface ObservationOutcomeCounts {
  success: number
  partial: number
  fail: number
  skipped: number
}

/** DAILY `observations`(learning-personalization §2-9) — 축별 결과 수 · 자기수정 · 재사용. */
export interface DailyObservations {
  total: number
  bySkill: Record<string, ObservationOutcomeCounts>
  selfCorrections: number
  reuses: number
}

export interface DailyObservationsDelta {
  total?: number
  bySkill?: Record<string, Partial<ObservationOutcomeCounts>>
  selfCorrections?: number
  reuses?: number
}

/**
 * DAILY `skills` 한 축의 칸(task-080) — `uncertain` = 신뢰도 낮은 관측(맞힘·틀림에 넣지 않는다).
 * `fromCorrection` = success+partial+fail 중 교정(제안·재사용)에서 온 수 — 저장된 옛 행에는 없을 수 있다(읽는 쪽은 0 으로).
 */
export interface GrowthSkillCounts {
  success: number
  partial: number
  fail: number
  skipped: number
  uncertain: number
  fromCorrection: number
}

export type DailySkillsDelta = Record<string, Partial<GrowthSkillCounts>>

export interface DailyDelta {
  attended?: boolean
  words?: Partial<DailyData['words']>
  talkTurns?: number
  chatTurns?: number
  corrections?: Partial<DailyData['corrections']>
  lessons?: number
  reviews?: number
  evals?: number
  repetition?: Partial<DailyData['repetition']>
  observations?: DailyObservationsDelta
  skills?: DailySkillsDelta
}

export function emptyDaily(): DailyData {
  return {
    attended: false,
    words: { sessions: 0, correct: 0, wrong: 0 },
    talkTurns: 0,
    chatTurns: 0,
    corrections: { proposed: 0, accepted: 0 },
    lessons: 0,
    reviews: 0,
    evals: 0,
    repetition: { studied: 0, focus: 0 },
  }
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/**
 * 순수 병합 — 기존 `data`(형태가 어긋나도 됨)에 증가분을 더한다. 음수 증가는 무시한다(생성·증가만).
 * 모르는 키는 보존한다(다른 task 가 먼저 넣은 필드를 지우지 않게).
 */
export function mergeDaily(current: unknown, delta: DailyDelta): DailyData & Record<string, unknown> {
  const c = obj(current)
  const add = (a: unknown, d: number | undefined) => num(a) + (d && d > 0 ? d : 0)
  const w = obj(c.words)
  const cr = obj(c.corrections)
  const rp = obj(c.repetition)
  const merged: DailyData & Record<string, unknown> = {
    ...c,
    attended: c.attended === true || delta.attended === true,
    words: { ...w, sessions: add(w.sessions, delta.words?.sessions), correct: add(w.correct, delta.words?.correct), wrong: add(w.wrong, delta.words?.wrong) },
    talkTurns: add(c.talkTurns, delta.talkTurns),
    chatTurns: add(c.chatTurns, delta.chatTurns),
    corrections: { ...cr, proposed: add(cr.proposed, delta.corrections?.proposed), accepted: add(cr.accepted, delta.corrections?.accepted) },
    lessons: add(c.lessons, delta.lessons),
    reviews: add(c.reviews, delta.reviews),
    evals: add(c.evals, delta.evals),
    repetition: { ...rp, studied: add(rp.studied, delta.repetition?.studied), focus: add(rp.focus, delta.repetition?.focus) },
  }
  if (c.observations !== undefined || delta.observations) merged.observations = mergeObservations(c.observations, delta.observations ?? {})
  if (c.skills !== undefined || (delta.skills && Object.keys(delta.skills).length > 0)) merged.skills = mergeSkills(c.skills, delta.skills ?? {})
  return merged
}

export const SKILL_COUNT_KEYS = ['success', 'partial', 'fail', 'skipped', 'uncertain', 'fromCorrection'] as const

/** `skills` 병합 — 증가만, 모르는 축·모르는 칸 보존(`mergeObservations` 와 같은 방식). */
export function mergeSkills(current: unknown, delta: DailySkillsDelta): Record<string, GrowthSkillCounts & Record<string, unknown>> {
  const c = obj(current)
  const add = (a: unknown, d: number | undefined) => num(a) + (d && d > 0 ? d : 0)
  const out: Record<string, GrowthSkillCounts & Record<string, unknown>> = {}
  for (const axis of new Set([...Object.keys(c), ...Object.keys(delta)])) {
    const cs = obj(c[axis])
    const ds = delta[axis] ?? {}
    const merged = { ...cs } as GrowthSkillCounts & Record<string, unknown>
    for (const k of SKILL_COUNT_KEYS) merged[k] = add(cs[k], ds[k])
    out[axis] = merged
  }
  return out
}

/** `observations` 병합 — 증가만, 모르는 키 보존(축 이름은 문자열 그대로). */
export function mergeObservations(current: unknown, delta: DailyObservationsDelta): DailyObservations & Record<string, unknown> {
  const c = obj(current)
  const add = (a: unknown, d: number | undefined) => num(a) + (d && d > 0 ? d : 0)
  const curSkills = obj(c.bySkill)
  const bySkill: Record<string, ObservationOutcomeCounts> = {}
  for (const skill of new Set([...Object.keys(curSkills), ...Object.keys(delta.bySkill ?? {})])) {
    const cs = obj(curSkills[skill])
    const ds = delta.bySkill?.[skill] ?? {}
    bySkill[skill] = { ...cs, success: add(cs.success, ds.success), partial: add(cs.partial, ds.partial), fail: add(cs.fail, ds.fail), skipped: add(cs.skipped, ds.skipped) }
  }
  return {
    ...c,
    total: add(c.total, delta.total),
    bySkill,
    selfCorrections: add(c.selfCorrections, delta.selfCorrections),
    reuses: add(c.reuses, delta.reuses),
  }
}

/** DAILY(`periodKey` = KST `YYYY-MM-DD`) 증가 — 반드시 호출자 트랜잭션 안에서. */
export async function bumpDailySnapshot(userId: string, date: string, delta: DailyDelta, tx: Tx): Promise<void> {
  const empty = JSON.stringify(emptyDaily())
  await tx.$executeRaw`INSERT INTO StatsSnapshot (id, userId, kind, periodKey, data, createdAt, updatedAt)
    VALUES (${rawRowId()}, ${userId}, 'DAILY', ${date}, ${empty}, NOW(3), NOW(3))
    ON DUPLICATE KEY UPDATE id = id`
  const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM StatsSnapshot WHERE userId = ${userId} AND kind = 'DAILY' AND periodKey = ${date} FOR UPDATE`
  if (!locked.length) throw new Error('DAILY 스냅샷 행을 잠그지 못했습니다')
  const row = await tx.statsSnapshot.findUnique({ where: { id: locked[0].id }, select: { data: true } })
  await tx.statsSnapshot.update({ where: { id: locked[0].id }, data: { data: mergeDaily(row?.data, delta) as unknown as Prisma.InputJsonValue } })
}

/** VOCAB_SESSION `data`(domain-model §9-3 `{cardCount, correct, wrong, skipped, durationSec, mode}` + 기록 날짜 `date` — #54 일별 집계용). */
export interface VocabSessionSnapshotData {
  cardCount: number
  correct: number
  wrong: number
  skipped: number
  durationSec: number
  mode: 'CHOICE' | 'FLIP'
  /** 세션 `date`(시작한 KST 날짜, E3). */
  date: string
  /** task-042(챌린지 T2): 주제 세트만 채운다(JSON additive — 옛 행은 없음 = 내 단어장 세트). 챌린지 지표(T1)가 읽을 때 계산하는 원천. */
  topicId?: string
}

/**
 * 세트 1개의 확정 집계 — finish 트랜잭션 안에서 **한 번만** 만든다(`@@unique(userId, kind, periodKey=sessionId)` 가 최종 보증).
 * 이후 원본(단어·세트) 삭제와 무관하게 불변이다(규칙 2).
 */
export async function createVocabSessionSnapshot(userId: string, sessionId: string, data: VocabSessionSnapshotData, tx: Tx): Promise<void> {
  await tx.statsSnapshot.create({ data: { userId, kind: 'VOCAB_SESSION', periodKey: sessionId, data: data as unknown as Prisma.InputJsonValue } })
}

/**
 * LESSON `data`(domain-model §9-3 `{kind, topicId?, score, stageDone, date}` + learning-personalization §2-9 `itemCount`) — 레슨 1개의 확정 집계.
 * 완료 트랜잭션 안에서 **한 번만**(`@@unique(userId, kind, periodKey=lessonId)` 이 최종 보증). 이후 레슨 삭제와 무관하게 불변(규칙 2).
 * task-081(§37-13 ③): 문항이 없는 새 수업은 `score: null` 이고 `quizCorrect`·`quizTotal` 키가 없다. 그 전에 만든 행은 그대로 둔다
 * (이 모듈은 LESSON 행을 만들기만 하고 고치지 않는다) — 읽는 쪽(챌린지)은 `quizTotal` 키가 없으면 문항 없음(null)으로 읽는다.
 */
export interface LessonSnapshotData {
  kind: 'NEW' | 'REVIEW'
  topicId: string | null
  score: number | null
  stageDone: number
  itemCount: number
  quizCorrect?: number
  quizTotal?: number
  /** 완료한 KST 날짜. */
  date: string
}

export async function createLessonSnapshot(userId: string, lessonId: string, data: LessonSnapshotData, tx: Tx): Promise<void> {
  await tx.statsSnapshot.create({ data: { userId, kind: 'LESSON', periodKey: lessonId, data: data as unknown as Prisma.InputJsonValue } })
}

/**
 * EVALUATION `data`(domain-model §9-3 `{kind, level, total, rubric, date}` + `grade`·`itemCount`) — 평가 1개의 확정 집계(task-011).
 * 채점 완료 트랜잭션 안에서 **한 번만**(`@@unique(userId, kind, periodKey=evaluationId)` 이 최종 보증 — 두 채점 잡이 겹쳐도 한 건).
 */
export interface EvaluationSnapshotData {
  kind: 'WORDS' | 'TALK'
  level: string
  total: number
  grade: string
  rubric: Record<string, number> | null
  itemCount: number
  /** 채점을 끝낸 KST 날짜. */
  date: string
}

export async function createEvaluationSnapshot(userId: string, evaluationId: string, data: EvaluationSnapshotData, tx: Tx): Promise<void> {
  await tx.statsSnapshot.create({ data: { userId, kind: 'EVALUATION', periodKey: evaluationId, data: data as unknown as Prisma.InputJsonValue } })
}
