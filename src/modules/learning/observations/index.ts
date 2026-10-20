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
import { bumpDailySnapshot, type DailyObservationsDelta, type DailySkillsDelta } from '../snapshots'

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
 * 성장 탭 공부결과(task-080, screens.md §36-8)가 세는 관측 kind → 축. 여기 없는 kind 는 세지 않는다 —
 * 교정 채택·무시(채택 ≠ 습득, §2-3)·자기수정·대화 유지 관측(«대화 유지 = 역할극 완료만», 단위 «번»과 섞임).
 * `null` = 축을 관측 행의 `skill`(교정 오류 유형 축)에서 가져온다.
 */
export const GROWTH_SKILL_OF_KIND: Partial<Record<ObservationKind, SkillAxis | null>> = {
  VOCAB_RECOGNITION: 'VOCAB_RECALL',
  VOCAB_PRODUCTION: 'VOCAB_RECALL',
  GRAMMAR_USE: 'GRAMMAR_PARTICLE',
  LISTEN_RESPOND: 'LISTEN_RESPOND',
  SENTENCE_PRODUCTION: 'SENTENCE_PRODUCTION',
  EXPRESSION_REUSE: 'SENTENCE_PRODUCTION',
  SCENARIO_COMPLETED: 'CONVERSATION_MAINTAIN',
  CORRECTION_PROPOSED: null,
  CORRECTION_REUSED: null,
}

/**
 * `skills[axis].fromCorrection` 으로 세는 kind(§36-17-2 C 규칙). 교정 제안은 틀린 문장만 남기므로(맞게 쓴 문장은 기록 없음)
 * 판정된 관측이 거의 이것뿐인 축은 단계를 숨긴다(`snapshots/growth isOneSided`).
 */
export const GROWTH_FROM_CORRECTION_KINDS: ReadonlySet<ObservationKind> = new Set<ObservationKind>(['CORRECTION_PROPOSED', 'CORRECTION_REUSED'])

export type GrowthSkillRow = Pick<Prisma.LearningObservationCreateManyInput, 'kind' | 'outcome' | 'skill' | 'confidence'>

/**
 * 관측 행 → DAILY `skills` 증가분(순수, §36-8 표). 신뢰도 < `OBSERVATION_CONFIDENCE_MIN` 은 `uncertain` 만 +1(음성 저신뢰를 틀림으로 세지 않는다).
 * 교정 관측의 축이 `LISTEN_RESPOND`(발음 교정)면 세지 않는다 — 듣고 응답 «기록 전» 이 거짓이 되지 않게. 셀 행이 없으면 `{}`.
 * `fromCorrection` = success·partial·fail 로 센 것 중 `GROWTH_FROM_CORRECTION_KINDS` 인 수(불확실·넘김은 세지 않는다).
 */
export function growthSkillDelta(rows: readonly GrowthSkillRow[]): DailySkillsDelta {
  const out: Record<string, { success: number; partial: number; fail: number; skipped: number; uncertain: number; fromCorrection: number }> = {}
  for (const r of rows) {
    const mapped = GROWTH_SKILL_OF_KIND[r.kind]
    if (mapped === undefined) continue
    const axis = mapped ?? r.skill
    if (mapped === null && axis === 'LISTEN_RESPOND') continue
    const c = (out[axis] ??= { success: 0, partial: 0, fail: 0, skipped: 0, uncertain: 0, fromCorrection: 0 })
    const conf = typeof r.confidence === 'number' && Number.isFinite(r.confidence) ? r.confidence : 1
    if (conf < OBSERVATION_CONFIDENCE_MIN) {
      c.uncertain++
      continue
    }
    const key = OUTCOME_KEY[r.outcome]
    c[key]++
    if (key !== 'skipped' && GROWTH_FROM_CORRECTION_KINDS.has(r.kind)) c.fromCorrection++
  }
  return out
}

/**
 * 관측 여러 건 + DAILY `observations`·`skills` 증가를 한 번에(호출자 tx, 사용자 행 잠금 뒤). 0건이면 아무것도 하지 않는다.
 * `date` = DAILY 날짜(KST, 생략 시 오늘) — 원천 기록과 같은 날로 맞출 때 준다(단어 세트는 세트 날짜).
 */
export async function recordObservations(userId: string, rows: readonly ObservationInput[], tx: Tx, opts: { date?: string } = {}): Promise<number> {
  if (rows.length === 0) return 0
  const data = rows.map((o) => observationRow(userId, o))
  const res = await tx.learningObservation.createMany({ data })
  await bumpDailySnapshot(userId, opts.date ?? dates.todayKst(), { observations: observationDailyDelta(data), skills: growthSkillDelta(data) }, tx)
  return res.count
}

/**
 * 관측 신뢰도 하한(task-010b ★결정 3). 이보다 낮은 관측(STT 저신뢰·리뷰 미확정 0.5 등)은 성공/실패 판단에 쓰지 않고 `uncertain` 으로만 센다 —
 * 모르는 것을 틀린 것으로 오판해 복습 간격을 줄이지 않게 한다. 컬럼 `confidence` 는 NOT NULL default 1 이라 null 은 없다(기존 행도 1.0).
 */
export const OBSERVATION_CONFIDENCE_MIN = 0.6

export interface ObservationSkillSummary {
  skill: SkillAxis
  success: number
  fail: number
  /** confidence < `OBSERVATION_CONFIDENCE_MIN` 인 SUCCESS·FAIL 관측 수(success/fail 에는 들지 않는다). */
  uncertain: number
}

/**
 * A11 입력 — 최근 `days`일 축별 성공/실패 수(원문 없음, 코드 집계 — Leader's Plan L2). 실패 = FAIL 만(SKIPPED·PARTIAL 은 세지 않는다).
 * 신뢰도가 낮은 관측은 success/fail 에서 빼고 `uncertain` 으로 센다 — 축별 success+fail+uncertain = 그 축의 SUCCESS·FAIL 관측 전부.
 */
export async function summarizeRecentObservations(userId: string, days = 14, now = new Date(), db: Pick<typeof prisma.learningObservation, 'groupBy'> = prisma.learningObservation): Promise<ObservationSkillSummary[]> {
  const since = new Date(now.getTime() - days * 86_400_000)
  const base = { userId, occurredAt: { gte: since }, outcome: { in: ['SUCCESS', 'FAIL'] as ObservationOutcome[] } }
  const [confident, uncertain] = await Promise.all([
    db.groupBy({ by: ['skill', 'outcome'], where: { ...base, confidence: { gte: OBSERVATION_CONFIDENCE_MIN } }, _count: { _all: true } }),
    db.groupBy({ by: ['skill'], where: { ...base, confidence: { lt: OBSERVATION_CONFIDENCE_MIN } }, _count: { _all: true } }),
  ])
  const out = new Map<SkillAxis, ObservationSkillSummary>()
  const row = (skill: SkillAxis) => {
    let s = out.get(skill)
    if (!s) out.set(skill, (s = { skill, success: 0, fail: 0, uncertain: 0 }))
    return s
  }
  for (const r of confident) {
    const s = row(r.skill)
    if (r.outcome === 'SUCCESS') s.success += r._count._all
    else s.fail += r._count._all
  }
  for (const r of uncertain) row(r.skill).uncertain += r._count._all
  return [...out.values()].sort((a, b) => a.skill.localeCompare(b.skill))
}
