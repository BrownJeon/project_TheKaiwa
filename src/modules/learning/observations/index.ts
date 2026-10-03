/**
 * LearningObservation(learning-personalization §2-2) — append-only 학습 관측. **호출자 트랜잭션 `tx` 안에서만** 쓴다(기록률 — 원천 행과 같이
 * 남거나 같이 사라진다). 원문·오디오는 복제하지 않고 `refType/refId` 만 가리킨다. 수정·삭제 경로는 없다(계정 삭제 cascade 만).
 *
 * task-010c 가 처음 썼다(코치 자기수정 `SELF_CORRECTION`). task-010b 가 단어 세트·교정 제안/채택/거절·레슨 완료 관측과
 * **같은 트랜잭션의 DAILY 스냅샷 `observations` 증가**를 더했다 — `recordObservations` 한 번이 관측 행과 DAILY 증가를 함께 쓴다
 * (DAILY 행 잠금은 사용자 행 잠금 뒤 — 모든 호출자가 사용자 행을 먼저 잡는다).
 */
import type { ErrorType, ObservationKind, ObservationOutcome, Prisma, SkillAxis } from '@prisma/client'
import { dates, prisma, type Tx } from '@/modules/infra'
import { bumpDailySnapshot, type DailyObservationsDelta } from '../snapshots'

/**
 * kind → 능력 축(§2-3). `CORRECTION_*` 는 교정 오류 유형에 따라 축이 갈리므로(§2-3 GRAMMAR_PARTICLE 행) 여기 두지 않는다 — 호출자가 `skill` 을 준다
 * (`correctionSkill`).
 */
export const OBSERVATION_SKILL: Partial<Record<ObservationKind, SkillAxis>> = {
  VOCAB_RECOGNITION: 'VOCAB_RECALL',
  VOCAB_PRODUCTION: 'VOCAB_RECALL',
  GRAMMAR_USE: 'GRAMMAR_PARTICLE',
  LISTEN_RESPOND: 'LISTEN_RESPOND',
  SENTENCE_PRODUCTION: 'SENTENCE_PRODUCTION',
  EXPRESSION_REUSE: 'SENTENCE_PRODUCTION',
  CONVERSATION_MAINTAIN: 'CONVERSATION_MAINTAIN',
  SELF_CORRECTION: 'CONVERSATION_MAINTAIN',
  SCENARIO_COMPLETED: 'CONVERSATION_MAINTAIN',
}

/**
 * 교정 오류 유형 → 축. §2-3 은 PARTICLE·CONJUGATION·GRAMMAR 만 GRAMMAR_PARTICLE 로 정한다 — 어휘는 VOCAB_RECALL, 나머지(존댓말·자연스러움·
 * 어순·기타)는 문장을 만드는 일이라 SENTENCE_PRODUCTION 으로 둔다(발음은 교정에 쓰지 않는다 — 들어오면 듣기 축).
 */
export function correctionSkill(errorType: ErrorType | string): SkillAxis {
  if (errorType === 'PARTICLE' || errorType === 'CONJUGATION' || errorType === 'GRAMMAR') return 'GRAMMAR_PARTICLE'
  if (errorType === 'VOCABULARY') return 'VOCAB_RECALL'
  if (errorType === 'PRONUNCIATION') return 'LISTEN_RESPOND'
  return 'SENTENCE_PRODUCTION'
}

/** `meta` 상한(§2-2 "≤1KB 요약, 원문 없음") — 넘으면 meta 를 버린다(관측 자체는 남긴다). */
export const OBSERVATION_META_MAX = 1024

export type ObservationRefType = 'VocabAttempt' | 'Correction' | 'ChatMessage' | 'EvaluationItem' | 'Lesson' | 'Chat'

export interface ObservationInput {
  kind: ObservationKind
  outcome: ObservationOutcome
  /** 생략하면 `OBSERVATION_SKILL[kind]`. 둘 다 없으면 오류. */
  skill?: SkillAxis
  refType: ObservationRefType
  refId: string
  /** 0~1(텍스트 1.0 · STT 신뢰도 · 리뷰 미확정 0.5). 범위 밖은 자른다. */
  confidence?: number
  latencyMs?: number | null
  wordId?: string | null
  scenarioId?: string | null
  meta?: Record<string, string | number | boolean | null> | null
}

export function observationRow(userId: string, o: ObservationInput): Prisma.LearningObservationCreateManyInput {
  const skill = o.skill ?? OBSERVATION_SKILL[o.kind]
  if (!skill) throw new Error(`관측 ${o.kind} 의 능력 축이 없습니다`)
  const conf = typeof o.confidence === 'number' && Number.isFinite(o.confidence) ? Math.min(1, Math.max(0, o.confidence)) : 1
  const metaJson = o.meta ? JSON.stringify(o.meta) : null
  return {
    userId,
    kind: o.kind,
    outcome: o.outcome,
    skill,
    confidence: conf,
    latencyMs: typeof o.latencyMs === 'number' && Number.isFinite(o.latencyMs) && o.latencyMs >= 0 ? Math.round(o.latencyMs) : null,
    refType: o.refType,
    refId: o.refId.slice(0, 40),
    wordId: o.wordId ?? null,
    scenarioId: o.scenarioId ?? null,
    ...(metaJson && metaJson.length <= OBSERVATION_META_MAX ? { meta: o.meta as Prisma.InputJsonValue } : {}),
  }
}

const OUTCOME_KEY: Record<ObservationOutcome, 'success' | 'partial' | 'fail' | 'skipped'> = { SUCCESS: 'success', PARTIAL: 'partial', FAIL: 'fail', SKIPPED: 'skipped' }

/**
 * 관측 행 → DAILY `observations` 증가분(순수). 자기수정은 고쳐 말한 것(SUCCESS·PARTIAL)만, 재사용은 `CORRECTION_REUSED`·`EXPRESSION_REUSE` 의
 * 성공만 센다.
 */
export function observationDailyDelta(rows: readonly Pick<Prisma.LearningObservationCreateManyInput, 'kind' | 'outcome' | 'skill'>[]): DailyObservationsDelta {
  const bySkill: Record<string, { success: number; partial: number; fail: number; skipped: number }> = {}
  let selfCorrections = 0
  let reuses = 0
  for (const r of rows) {
    const s = (bySkill[r.skill] ??= { success: 0, partial: 0, fail: 0, skipped: 0 })
    s[OUTCOME_KEY[r.outcome]]++
    if (r.kind === 'SELF_CORRECTION' && (r.outcome === 'SUCCESS' || r.outcome === 'PARTIAL')) selfCorrections++
    if ((r.kind === 'CORRECTION_REUSED' || r.kind === 'EXPRESSION_REUSE') && r.outcome === 'SUCCESS') reuses++
  }
  return { total: rows.length, bySkill, selfCorrections, reuses }
}

/**
 * 관측 여러 건 + DAILY `observations` 증가를 한 번에(호출자 tx, 사용자 행 잠금 뒤). 0건이면 아무것도 하지 않는다.
 * `date` = DAILY 날짜(KST, 생략 시 오늘) — 원천 기록과 같은 날로 맞출 때 준다(단어 세트는 세트 날짜).
 */
export async function recordObservations(userId: string, rows: readonly ObservationInput[], tx: Tx, opts: { date?: string } = {}): Promise<number> {
  if (rows.length === 0) return 0
  const data = rows.map((o) => observationRow(userId, o))
  const res = await tx.learningObservation.createMany({ data })
  await bumpDailySnapshot(userId, opts.date ?? dates.todayKst(), { observations: observationDailyDelta(data) }, tx)
  return res.count
}

/** A11 입력 — 최근 `days`일 축별 성공/실패 수(원문 없음, 코드 집계 — Leader's Plan L2). 실패 = FAIL 만(SKIPPED·PARTIAL 은 세지 않는다). */
export async function summarizeRecentObservations(userId: string, days = 14, now = new Date()): Promise<{ skill: SkillAxis; success: number; fail: number }[]> {
  const since = new Date(now.getTime() - days * 86_400_000)
  const rows = await prisma.learningObservation.groupBy({
    by: ['skill', 'outcome'],
    where: { userId, occurredAt: { gte: since }, outcome: { in: ['SUCCESS', 'FAIL'] } },
    _count: { _all: true },
  })
  const out = new Map<SkillAxis, { skill: SkillAxis; success: number; fail: number }>()
  for (const r of rows) {
    const s = out.get(r.skill) ?? { skill: r.skill, success: 0, fail: 0 }
    if (r.outcome === 'SUCCESS') s.success += r._count._all
    else s.fail += r._count._all
    out.set(r.skill, s)
  }
  return [...out.values()].sort((a, b) => a.skill.localeCompare(b.skill))
}
