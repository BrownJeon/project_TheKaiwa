/**
 * task-080 — DAILY `data.skills` 과거 백필(screens.md §36-8): top-up `max(0, R − C)`(R>C·R=C·R<C·빈 칸) · 날짜 묶기(세트 날짜 vs occurredAt·
 * 자정 넘김·세트 삭제) · 단계 분포 · dry-run 쓰기 0 · apply 백업 먼저·멱등(두 번째 실행 0) · 스크립트 인자. DB 0(메모리 가짜 DB).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ObservationKind, ObservationOutcome, SkillAxis } from '@prisma/client'
import type { Tx } from '@/modules/infra'
import {
  axisWindowStat,
  distributionBucket,
  formatGrowthSkillsBackfillReport,
  observationDailyDate,
  planUserBackfill,
  recountByDate,
  runGrowthSkillsBackfill,
  topUpChanges,
  topUpSkills,
  type BackfillObservation,
  type BackfillReadDb,
  type GrowthSkillsBackup,
} from '../snapshots/backfillSkills'
import { backupDirHint, backupFileName, parseBackfillArgs, PROD_BACKUP_DIR } from '../../../../scripts/backfill-growth-skills'

const U1 = 'cuser0000000000000000080a'
const U2 = 'cuser0000000000000000080b'
const NOW = new Date('2026-10-21T03:00:00Z')
const cells = (o: Partial<Record<'success' | 'partial' | 'fail' | 'skipped' | 'uncertain' | 'fromCorrection', number>>) => ({
  success: 0,
  partial: 0,
  fail: 0,
  skipped: 0,
  uncertain: 0,
  fromCorrection: 0,
  ...o,
})
/** fromCorrection 칸이 생기기 전(2026-10-21 전) 모양의 칸. */
const legacyCells = (o: Partial<Record<'success' | 'partial' | 'fail' | 'skipped' | 'uncertain', number>>) => ({ success: 0, partial: 0, fail: 0, skipped: 0, uncertain: 0, ...o })
const ob = (kind: ObservationKind, outcome: ObservationOutcome, skill: SkillAxis, at: string, refType = 'Chat', refId = 'r', confidence = 1): BackfillObservation => ({
  kind,
  outcome,
  skill,
  confidence,
  refType,
  refId,
  occurredAt: new Date(at),
})

// ── top-up ─────────────────────────────────────────────────────────────────

test('topUpSkills — R>C 는 차이만 · R=C 0 · R<C 는 더하지 않고 어긋남 · 빈 칸은 R 전부 · C 에만 있는 축도 어긋남', () => {
  const R = { VOCAB_RECALL: cells({ success: 5, fail: 2 }), GRAMMAR_PARTICLE: cells({ partial: 1 }) }
  assert.deepEqual(topUpSkills(R, { VOCAB_RECALL: cells({ success: 3, fail: 2 }), GRAMMAR_PARTICLE: cells({ partial: 1 }) }), { add: { VOCAB_RECALL: { success: 2 } }, added: 2, fromCorrectionAdded: 0, mismatches: 0 })
  assert.deepEqual(topUpSkills(R, { VOCAB_RECALL: cells({ success: 5, fail: 2 }), GRAMMAR_PARTICLE: cells({ partial: 1 }) }), { add: {}, added: 0, fromCorrectionAdded: 0, mismatches: 0 })
  assert.deepEqual(topUpSkills(R, { VOCAB_RECALL: cells({ success: 7, fail: 1 }), GRAMMAR_PARTICLE: cells({ partial: 1 }) }), { add: { VOCAB_RECALL: { fail: 1 } }, added: 1, fromCorrectionAdded: 0, mismatches: 1 })
  assert.deepEqual(topUpSkills(R, undefined), { add: { VOCAB_RECALL: { success: 5, fail: 2 }, GRAMMAR_PARTICLE: { partial: 1 } }, added: 8, fromCorrectionAdded: 0, mismatches: 0 })
  assert.deepEqual(topUpSkills(undefined, { SENTENCE_PRODUCTION: { success: 2, uncertain: 1 } }), { add: {}, added: 0, fromCorrectionAdded: 0, mismatches: 2 })
  assert.deepEqual(topUpSkills({ CONVERSATION_MAINTAIN: cells({ uncertain: 2 }) }, { CONVERSATION_MAINTAIN: { uncertain: 'x', note: 1 } }), { add: { CONVERSATION_MAINTAIN: { uncertain: 2 } }, added: 2, fromCorrectionAdded: 0, mismatches: 0 }, '숫자 아닌 칸 = 0')
})

test('topUpSkills — fromCorrection 도 max(0, R − C): 옛 행(칸 없음)은 C = 0 · 관측 수(added)에는 넣지 않고 따로 · R<C 는 어긋남', () => {
  const R = { GRAMMAR_PARTICLE: cells({ success: 1, fail: 3, fromCorrection: 3 }) }
  const legacy = topUpSkills(R, { GRAMMAR_PARTICLE: legacyCells({ success: 1, fail: 3 }) })
  assert.deepEqual(legacy, { add: { GRAMMAR_PARTICLE: { fromCorrection: 3 } }, added: 0, fromCorrectionAdded: 3, mismatches: 0 }, '관측 칸이 다 차 있어도 fromCorrection 만 채운다')
  assert.equal(topUpChanges(legacy), true)
  assert.deepEqual(topUpSkills(R, { GRAMMAR_PARTICLE: cells({ success: 1, fail: 1, fromCorrection: 1 }) }), { add: { GRAMMAR_PARTICLE: { fail: 2, fromCorrection: 2 } }, added: 2, fromCorrectionAdded: 2, mismatches: 0 })
  assert.deepEqual(topUpSkills(R, undefined), { add: { GRAMMAR_PARTICLE: { success: 1, fail: 3, fromCorrection: 3 } }, added: 4, fromCorrectionAdded: 3, mismatches: 0 })
  const same = topUpSkills(R, { GRAMMAR_PARTICLE: cells({ success: 1, fail: 3, fromCorrection: 3 }) })
  assert.equal(topUpChanges(same), false, '멱등 — 다 차면 바꿀 것 없음')
  assert.equal(topUpSkills(R, { GRAMMAR_PARTICLE: cells({ success: 1, fail: 3, fromCorrection: 4 }) }).mismatches, 1)
})

// ── 날짜 묶기 ──────────────────────────────────────────────────────────────

test('날짜 묶기 — 단어 카드는 세트 날짜(자정 넘김 포함) · 세트가 지워졌으면 occurredAt KST · 그 밖은 occurredAt KST(15:00Z = 다음 날)', () => {
  const att = new Map([['a1', '2026-10-10']])
  assert.deepEqual(observationDailyDate({ refType: 'VocabAttempt', refId: 'a1', occurredAt: new Date('2026-10-10T15:10:00Z') }, att), { date: '2026-10-10', source: 'session' })
  assert.deepEqual(observationDailyDate({ refType: 'VocabAttempt', refId: 'gone', occurredAt: new Date('2026-10-10T15:10:00Z') }, att), { date: '2026-10-11', source: 'fallback' })
  assert.deepEqual(observationDailyDate({ refType: 'Lesson', refId: 'a1', occurredAt: new Date('2026-10-10T14:59:59Z') }, att), { date: '2026-10-10', source: 'occurredAt' }, 'refType 이 다르면 같은 id 라도 occurredAt')
  assert.deepEqual(observationDailyDate({ refType: 'Chat', refId: 'c', occurredAt: new Date('2026-10-10T15:00:00Z') }, att), { date: '2026-10-11', source: 'occurredAt' })

  const { recount, stats } = recountByDate(
    [
      ob('VOCAB_RECOGNITION', 'SUCCESS', 'VOCAB_RECALL', '2026-10-10T15:10:00Z', 'VocabAttempt', 'a1'),
      ob('VOCAB_RECOGNITION', 'FAIL', 'VOCAB_RECALL', '2026-10-10T15:10:00Z', 'VocabAttempt', 'gone'),
      ob('CORRECTION_PROPOSED', 'FAIL', 'LISTEN_RESPOND', '2026-10-12T01:00:00Z', 'Correction', 'c1'),
    ],
    att,
  )
  assert.deepEqual([...recount.entries()], [
    ['2026-10-10', { VOCAB_RECALL: cells({ success: 1 }) }],
    ['2026-10-11', { VOCAB_RECALL: cells({ fail: 1 }) }],
  ], '발음 교정만 있는 날(10-12)은 R 이 비어 행을 만들지 않는다')
  assert.deepEqual(stats, { session: 1, shifted: 1, fallback: 1, occurredAt: 1 })
})

// ── 단계 분포 ──────────────────────────────────────────────────────────────

test('axisWindowStat·distributionBucket — 20건·3일 90% → 3단계 · 창 밖 날 제외 · 19건 short · 0건 none · 듣고 응답은 unrecorded · 역할극 5번 기준', () => {
  const after = new Map<string, unknown>([
    ['2026-09-01', { VOCAB_RECALL: cells({ fail: 50 }) }],
    ['2026-10-15', { VOCAB_RECALL: cells({ success: 7 }), LISTEN_RESPOND: cells({ success: 30 }), CONVERSATION_MAINTAIN: cells({ success: 3, partial: 1 }) }],
    ['2026-10-16', { VOCAB_RECALL: cells({ success: 7, skipped: 4, uncertain: 2 }), CONVERSATION_MAINTAIN: cells({ fail: 1 }) }],
    ['2026-10-17', { VOCAB_RECALL: cells({ success: 3, partial: 2, fail: 1 }), GRAMMAR_PARTICLE: cells({ success: 19 }) }],
  ])
  const v4 = axisWindowStat(after, 'VOCAB_RECALL', '2026-09-27', '2026-10-21')
  assert.deepEqual(v4, { ...cells({ success: 17, partial: 2, fail: 1, skipped: 4, uncertain: 2 }), recorded: true, n: 20, obsDays: 3, ratePct: 90, stage: 3, enough: true, oneSided: false })
  assert.equal(distributionBucket(v4), 'stage3')
  const all = axisWindowStat(after, 'VOCAB_RECALL', null, '2026-10-21')
  assert.equal(all.n, 70)
  assert.equal(all.stage, 0, '전체 기간은 9월 틀림 50건이 들어가 0단계')
  assert.equal(distributionBucket(axisWindowStat(after, 'GRAMMAR_PARTICLE', '2026-09-27', '2026-10-21')), 'short')
  assert.equal(distributionBucket(axisWindowStat(after, 'SENTENCE_PRODUCTION', '2026-09-27', '2026-10-21')), 'none')
  assert.equal(distributionBucket(axisWindowStat(after, 'LISTEN_RESPOND', '2026-09-27', '2026-10-21')), 'unrecorded')
  const cm = axisWindowStat(after, 'CONVERSATION_MAINTAIN', '2026-09-27', '2026-10-21')
  assert.equal(cm.n, 5)
  assert.equal(cm.enough, true, '역할극은 5번·일수 기준 없음')
  assert.equal(distributionBucket(cm), 'stage2')
})

test('axisWindowStat·distributionBucket — C 규칙: 정확히 90% 교정 유래 → oneSided(분포 칸 oneSided) · 89.x% → 단계 · 옛 행(칸 없음) → 아님 · 표본 부족이면 oneSided 아님(short) · 기간 합으로 판정', () => {
  const days = ['2026-10-15', '2026-10-16', '2026-10-17']
  // 3일에 걸쳐 n = 20, 교정 유래 18(= 90%) — 하루하루는 6/7·6/7·6/6 이라 날마다 따로 보면 다르다.
  const exact = new Map<string, unknown>([
    [days[0], { GRAMMAR_PARTICLE: cells({ success: 1, fail: 6, fromCorrection: 6 }) }],
    [days[1], { GRAMMAR_PARTICLE: cells({ success: 1, fail: 6, fromCorrection: 6 }) }],
    [days[2], { GRAMMAR_PARTICLE: cells({ fail: 6, fromCorrection: 6 }) }],
  ])
  const s = axisWindowStat(exact, 'GRAMMAR_PARTICLE', '2026-09-27', '2026-10-21')
  assert.deepEqual([s.n, s.fromCorrection, s.enough, s.oneSided, s.stage], [20, 18, true, true, 0])
  assert.equal(distributionBucket(s), 'oneSided')
  // 교정 유래 179/200 = 89.5% → 아님(3일 합)
  const b = axisWindowStat(new Map([[days[0], { GRAMMAR_PARTICLE: cells({ success: 11, fail: 89, fromCorrection: 89 }) }], [days[1], { GRAMMAR_PARTICLE: cells({ fail: 50, fromCorrection: 50 }) }], [days[2], { GRAMMAR_PARTICLE: cells({ fail: 50, fromCorrection: 40 }) }]]), 'GRAMMAR_PARTICLE', '2026-09-27', '2026-10-21')
  assert.deepEqual([b.n, b.fromCorrection, b.oneSided], [200, 179, false], '10·179 = 1790 < 9·200 = 1800')
  assert.equal(distributionBucket(b), 'stage0')
  const legacy = new Map<string, unknown>(days.map((d) => [d, { GRAMMAR_PARTICLE: legacyCells({ fail: 7 }) }]))
  const l = axisWindowStat(legacy, 'GRAMMAR_PARTICLE', '2026-09-27', '2026-10-21')
  assert.deepEqual([l.n, l.fromCorrection, l.oneSided], [21, 0, false], '백필 전 옛 행은 C 규칙에 걸리지 않는다(승인 규칙 그대로)')
  const short = axisWindowStat(new Map([[days[0], { GRAMMAR_PARTICLE: cells({ fail: 5, fromCorrection: 5 }) }]]), 'GRAMMAR_PARTICLE', '2026-09-27', '2026-10-21')
  assert.deepEqual([short.enough, short.oneSided, distributionBucket(short)], [false, false, 'short'], '표본 부족이면 교정 100% 여도 oneSided 아님')
  const lr = axisWindowStat(new Map(days.map((d) => [d, { LISTEN_RESPOND: cells({ fail: 10, fromCorrection: 10 }) }])), 'LISTEN_RESPOND', null, '2026-10-21')
  assert.deepEqual([lr.recorded, lr.enough, lr.oneSided, distributionBucket(lr)], [false, true, false, 'unrecorded'], '기록 전 축은 표본이 차도 늘 false')
})

// ── 실행(가짜 DB) ───────────────────────────────────────────────────────────

interface Row {
  id: string
  userId: string
  periodKey: string
  data: unknown
}

function fakeWorld(extra: { obs?: (BackfillObservation & { userId: string })[]; daily?: Row[] } = {}) {
  const users = new Set([U1, U2, ...(extra.obs ?? []).map((o) => o.userId)])
  const obs: (BackfillObservation & { userId: string })[] = [
    ...['SUCCESS', 'FAIL', 'SKIPPED'].map((o, i) => ({ userId: U1, ...ob('VOCAB_RECOGNITION', o as ObservationOutcome, 'VOCAB_RECALL', '2026-10-10T15:10:00Z', 'VocabAttempt', `a${i + 1}`) })),
    { userId: U1, ...ob('VOCAB_RECOGNITION', 'SUCCESS', 'VOCAB_RECALL', '2026-10-12T01:00:00Z', 'VocabAttempt', 'a4') },
    { userId: U1, ...ob('SCENARIO_COMPLETED', 'SUCCESS', 'CONVERSATION_MAINTAIN', '2026-10-12T02:00:00Z', 'Chat', 'ch1') },
    { userId: U1, ...ob('SCENARIO_COMPLETED', 'SKIPPED', 'CONVERSATION_MAINTAIN', '2026-10-12T02:00:00Z', 'Chat', 'ch2', 0.5) },
    { userId: U1, ...ob('CORRECTION_ACCEPTED', 'SUCCESS', 'GRAMMAR_PARTICLE', '2026-10-12T03:00:00Z', 'Correction', 'c1') },
    { userId: U1, ...ob('CORRECTION_PROPOSED', 'FAIL', 'LISTEN_RESPOND', '2026-10-12T03:00:00Z', 'Correction', 'c2') },
    { userId: U2, ...ob('GRAMMAR_USE', 'SUCCESS', 'GRAMMAR_PARTICLE', '2026-10-14T05:00:00Z', 'Lesson', 'l1') },
    // 남의 세트를 가리키는 카드(소유자 불일치) → 세트 날짜를 쓰지 않는다.
    { userId: U2, ...ob('VOCAB_RECOGNITION', 'FAIL', 'VOCAB_RECALL', '2026-10-14T05:00:00Z', 'VocabAttempt', 'a1') },
    ...(extra.obs ?? []),
  ]
  const attempts = new Map([
    ['a1', { userId: U1, date: new Date('2026-10-10T00:00:00Z') }],
    ['a2', { userId: U1, date: new Date('2026-10-10T00:00:00Z') }],
    ['a3', { userId: U1, date: new Date('2026-10-10T00:00:00Z') }],
  ])
  const daily: Row[] = [
    { id: 'd1', userId: U1, periodKey: '2026-10-10', data: { words: { sessions: 1, correct: 1, wrong: 1 }, skills: { VOCAB_RECALL: cells({ success: 1 }) } } },
    { id: 'd2', userId: U1, periodKey: '2026-10-13', data: { lessons: 1, skills: { GRAMMAR_PARTICLE: cells({ fail: 2 }) } } },
    { id: 'd3', userId: U2, periodKey: '2026-10-14', data: { lessons: 1, custom: 'keep', words: { sessions: 0, correct: 0, wrong: 1 } } },
    ...(extra.daily ?? []),
  ]
  const ops = { tx: 0, lockUser: 0, lockDaily: 0, insert: 0, update: 0, backup: 0, order: [] as string[] }
  const hooks: { onLockDaily?: (r: Row) => void } = {}
  const kindIn = (where: { kind?: { in?: string[] } }) => (o: { kind: string }) => !where.kind?.in || where.kind.in.includes(o.kind)
  const db = {
    learningObservation: {
      findMany: async (args: { where: { userId?: string; kind?: { in?: string[] } }; distinct?: string[] }) => {
        const hits = obs.filter((o) => (!args.where.userId || o.userId === args.where.userId) && kindIn(args.where)(o))
        if (args.distinct) return [...new Set(hits.map((o) => o.userId))].sort().map((userId) => ({ userId }))
        return hits.map(({ kind, outcome, skill, confidence, refType, refId, occurredAt }) => ({ kind, outcome, skill, confidence, refType, refId, occurredAt }))
      },
    },
    vocabAttempt: {
      findMany: async (args: { where: { id: { in: string[] } } }) =>
        args.where.id.in.flatMap((id) => (attempts.has(id) ? [{ id, session: attempts.get(id)! }] : [])),
    },
    statsSnapshot: {
      findMany: async (args: { where: { userId: string; kind: string } }) => daily.filter((r) => r.userId === args.where.userId && args.where.kind === 'DAILY').map((r) => ({ ...r, data: structuredClone(r.data) })),
      findUnique: async (args: { where: { id: string } }) => {
        const r = daily.find((x) => x.id === args.where.id)
        return r ? { data: structuredClone(r.data) } : null
      },
      update: async (args: { where: { id: string }; data: { data: unknown } }) => {
        ops.update++
        ops.order.push('write')
        const r = daily.find((x) => x.id === args.where.id)!
        r.data = args.data.data
        return r
      },
    },
    $queryRaw: async (strings: TemplateStringsArray, ...vals: unknown[]) => {
      const sql = strings.join('?')
      if (sql.includes('`User`')) {
        ops.lockUser++
        return users.has(vals[0] as string) ? [{ id: vals[0] }] : []
      }
      ops.lockDaily++
      const hits = daily.filter((r) => r.userId === vals[0] && r.periodKey === vals[1])
      for (const h of hits) hooks.onLockDaily?.(h)
      return hits.map((r) => ({ id: r.id }))
    },
    $executeRaw: async (_s: TemplateStringsArray, ...vals: unknown[]) => {
      ops.insert++
      ops.order.push('write')
      const [id, userId, periodKey, empty] = vals as string[]
      if (!daily.some((r) => r.userId === userId && r.periodKey === periodKey)) daily.push({ id, userId, periodKey, data: JSON.parse(empty) })
      return 1
    },
  }
  const backups: GrowthSkillsBackup[] = []
  const deps = {
    db: db as unknown as BackfillReadDb,
    transaction: async <T,>(fn: (tx: Tx) => Promise<T>) => {
      ops.tx++
      return fn(db as unknown as Tx)
    },
    backup: async (b: GrowthSkillsBackup) => {
      ops.backup++
      ops.order.push('backup')
      backups.push(structuredClone(b))
      return '/backups/growth-skills-backup-test.json'
    },
    now: NOW,
  }
  return { deps, daily, ops, backups, hooks }
}

const skillsOf = (daily: Row[], userId: string, periodKey: string) => (daily.find((r) => r.userId === userId && r.periodKey === periodKey)?.data as { skills?: unknown } | undefined)?.skills

test('dry-run — 트랜잭션·잠금·쓰기·백업 0, 보고서 숫자(사용자·관측·날짜 묶기·대상 행·축별 합·날짜 범위·어긋남)', async () => {
  const w = fakeWorld()
  const before = structuredClone(w.daily)
  const r = await runGrowthSkillsBackfill(w.deps, { apply: false })
  assert.deepEqual({ tx: w.ops.tx, lockUser: w.ops.lockUser, lockDaily: w.ops.lockDaily, insert: w.ops.insert, update: w.ops.update, backup: w.ops.backup }, { tx: 0, lockUser: 0, lockDaily: 0, insert: 0, update: 0, backup: 0 })
  assert.deepEqual(w.daily, before)
  assert.equal(r.users, 2)
  assert.equal(r.observations, 9, '세지 않는 kind(교정 채택)는 읽지 않는다')
  assert.deepEqual(r.bucket, { session: 3, shifted: 3, fallback: 2, occurredAt: 4 })
  assert.equal(r.targetRows, 2, '기존 행만(10-10 · U2 10-14)')
  assert.deepEqual(r.skippedNoRow, { rows: 1, observations: 3 }, 'U1 10-12 는 DAILY 행이 없어 건너뜀(어휘 성공 1 · 대화 유지 성공 1·불확실 1)')
  assert.equal(r.addedTotal, 4)
  assert.deepEqual(r.addedByAxis, {
    VOCAB_RECALL: cells({ fail: 2, skipped: 1 }),
    GRAMMAR_PARTICLE: cells({ success: 1 }),
  })
  assert.deepEqual(r.dateRange, { min: '2026-10-10', max: '2026-10-14' })
  assert.deepEqual(r.mismatches, { cells: 1, rows: 1 })
  assert.deepEqual(r.applied, { rows: 0, observations: 0 })
  assert.equal(r.backupPath, null)
  assert.deepEqual(r.accounts.map((a) => a.label), ['#1', '#2'])
  assert.equal(r.accounts[0].axes.VOCAB_RECALL['4w'].n, 2, '적용 뒤 값 = 기존 행만(10-10 성공1·틀림1, 건너뛴 10-12 제외)')
  assert.equal(r.accounts[0].axes.CONVERSATION_MAINTAIN['4w'].n, 0)
  assert.equal(r.distribution4w.LISTEN_RESPOND.unrecorded, 2)
  const text = formatGrowthSkillsBackfillReport(r).join('\n')
  assert.ok(text.includes('DRY-RUN (no writes)'))
  assert.ok(!text.includes(U1) && !text.includes(U2) && !text.includes('cuser'), '보고서에 userId 없음')
})

test('apply — 백업이 첫 쓰기보다 먼저 · 칸마다 max(R, C) · 없는 행은 만들지 않는다 · 어긋난 행·다른 칸 보존 · 두 번째 실행 0건(멱등)', async () => {
  const w = fakeWorld()
  const r = await runGrowthSkillsBackfill(w.deps, { apply: true })
  assert.equal(w.ops.order[0], 'backup')
  assert.equal(w.ops.backup, 1)
  assert.deepEqual(
    w.backups[0].rows.map((b) => [b.periodKey, b.id, b.data === null, b.userId === U1]),
    [
      ['2026-10-10', 'd1', false, true],
      ['2026-10-14', 'd3', false, false],
    ],
  )
  assert.deepEqual(w.backups[0].rows[0].data, { words: { sessions: 1, correct: 1, wrong: 1 }, skills: { VOCAB_RECALL: cells({ success: 1 }) } }, '적용 직전 data 전체')
  assert.deepEqual(r.applied, { rows: 2, observations: 4 })
  assert.equal(w.ops.insert, 0, '행을 만드는 INSERT 0')
  assert.equal(w.daily.some((x) => x.userId === U1 && x.periodKey === '2026-10-12'), false, '행이 없는 날은 만들지 않는다')
  assert.equal(r.backupPath, '/backups/growth-skills-backup-test.json')
  assert.equal(w.ops.tx, 2, '사용자마다 트랜잭션 하나')
  assert.equal(w.ops.lockUser, 2)

  assert.deepEqual(skillsOf(w.daily, U1, '2026-10-10'), { VOCAB_RECALL: cells({ success: 1, fail: 1, skipped: 1 }) }, '이미 있던 성공 1 은 다시 더하지 않는다')
  assert.deepEqual((w.daily.find((x) => x.id === 'd1')!.data as { words: unknown }).words, { sessions: 1, correct: 1, wrong: 1 })
  assert.deepEqual(skillsOf(w.daily, U1, '2026-10-13'), { GRAMMAR_PARTICLE: cells({ fail: 2 }) }, '어긋난 칸은 줄이지 않는다')
  assert.deepEqual(skillsOf(w.daily, U2, '2026-10-11'), undefined)
  assert.deepEqual(skillsOf(w.daily, U2, '2026-10-14'), { GRAMMAR_PARTICLE: cells({ success: 1 }), VOCAB_RECALL: cells({ fail: 1 }) }, '남의 세트 카드는 occurredAt 날짜')
  const d3 = w.daily.find((x) => x.id === 'd3')!.data as Record<string, unknown>
  assert.equal(d3.custom, 'keep')
  assert.equal(d3.lessons, 1)

  const writes = w.ops.insert + w.ops.update
  const again = await runGrowthSkillsBackfill(w.deps, { apply: true })
  assert.equal(again.addedTotal, 0)
  assert.deepEqual(again.applied, { rows: 0, observations: 0 })
  assert.equal(again.targetRows, 0)
  assert.deepEqual(again.skippedNoRow, { rows: 1, observations: 3 }, '행 없음은 매번 건너뜀으로만 센다')
  assert.equal(w.ops.insert + w.ops.update, writes, '두 번째 실행은 쓰기 0')
  assert.equal(w.ops.backup, 1, '더할 것이 없으면 백업도 쓰지 않는다')
  assert.equal(w.ops.tx, 2)
})

test('apply — 계획 뒤 실시간으로 늘어난 칸은 잠근 뒤 다시 읽어 그만큼 덜 더한다(이중 계산 없음)', async () => {
  const w = fakeWorld()
  const orig = w.deps.transaction
  w.deps.transaction = async (fn) => {
    // 계획(트랜잭션 밖 읽기) 뒤, 적용 트랜잭션 직전에 10-10 행에 실시간 쓰기가 틀림 1 을 더한 상황.
    const d1 = w.daily.find((x) => x.id === 'd1')!
    const s = (d1.data as { skills: { VOCAB_RECALL: Record<string, number> } }).skills.VOCAB_RECALL
    if (s.fail === 0) s.fail = 1
    return orig(fn)
  }
  const r = await runGrowthSkillsBackfill(w.deps, { apply: true })
  assert.deepEqual(skillsOf(w.daily, U1, '2026-10-10'), { VOCAB_RECALL: cells({ success: 1, fail: 1, skipped: 1 }) })
  assert.deepEqual(r.applied, { rows: 2, observations: 3 })
})

test('apply — 행을 잠그는 사이 바뀐 data 기준으로 병합(다른 칸 증가 보존 · skills 도 잠근 뒤 값으로 다시 top-up)', async () => {
  const w = fakeWorld()
  w.hooks.onLockDaily = (r) => {
    if (r.id !== 'd1') return
    // 사용자 잠금 없이 DAILY 를 쓰는 경로(평가 등)가 계획 읽기와 행 잠금 사이에 커밋한 상황 + (방어) skills 칸 변화.
    const d = r.data as { evals?: number; skills: { VOCAB_RECALL: Record<string, number> } }
    d.evals = (d.evals ?? 0) + 1
    if (d.skills.VOCAB_RECALL.fail === 0) d.skills.VOCAB_RECALL.fail = 1
  }
  await runGrowthSkillsBackfill(w.deps, { apply: true })
  const d1 = w.daily.find((x) => x.id === 'd1')!.data as { evals: number; skills: unknown }
  assert.equal(d1.evals, 1, '잠근 뒤 다시 읽은 data 에 병합 — 다른 칸 증가를 덮지 않는다')
  assert.deepEqual(d1.skills, { VOCAB_RECALL: cells({ success: 1, fail: 1, skipped: 1 }) }, '잠근 뒤 칸 기준 top-up(틀림을 두 번 세지 않는다)')
})

test('apply — 계획 뒤 행이 사라져도(잠금 결과 0행) 만들지 않고 넘어간다', async () => {
  const w = fakeWorld()
  const orig = w.deps.transaction
  w.deps.transaction = async (fn) => orig(async (tx) => {
    const raw = tx.$queryRaw.bind(tx)
    const proxy = new Proxy(tx, {
      get: (t, k) => (k === '$queryRaw' ? (s: TemplateStringsArray, ...v: unknown[]) => (s.join('?').includes('StatsSnapshot') ? Promise.resolve([]) : raw(s, ...v)) : Reflect.get(t, k)),
    })
    return fn(proxy)
  })
  const r = await runGrowthSkillsBackfill(w.deps, { apply: true })
  assert.deepEqual(r.applied, { rows: 0, observations: 0 })
  assert.equal(w.ops.insert + w.ops.update, 0)
})

test('L2 자료 — 교정 제안 틀림 때문에만 0단계인 계정 수(4주): 제안을 빼면 short 인 계정은 셈, 수업 문제로도 0단계인 계정은 안 셈', async () => {
  const U3 = 'cuser0000000000000000080c'
  const U4 = 'cuser0000000000000000080d'
  const days = ['2026-10-15', '2026-10-16', '2026-10-17']
  const obs = [
    ...Array.from({ length: 21 }, (_, i) => ({ userId: U3, ...ob('CORRECTION_PROPOSED', 'FAIL', 'GRAMMAR_PARTICLE', `${days[i % 3]}T03:00:00Z`, 'Correction', `p${i}`) })),
    ...[0, 1].map((i) => ({ userId: U3, ...ob('GRAMMAR_USE', 'SUCCESS', 'GRAMMAR_PARTICLE', `${days[i]}T03:00:00Z`, 'Lesson', `l${i}`) })),
    ...Array.from({ length: 21 }, (_, i) => ({ userId: U4, ...ob('GRAMMAR_USE', 'FAIL', 'GRAMMAR_PARTICLE', `${days[i % 3]}T03:00:00Z`, 'Lesson', `q${i}`) })),
  ]
  const daily = [U3, U4].flatMap((u) => days.map((d) => ({ id: `${u}-${d}`, userId: u, periodKey: d, data: {} })))
  const r = await runGrowthSkillsBackfill(fakeWorld({ obs, daily }).deps, { apply: false })
  assert.deepEqual(r.accounts.slice(2).map((a) => a.axes.GRAMMAR_PARTICLE['4w'].stage), [0, 0])
  assert.equal(r.stage0ByProposals4w.GRAMMAR_PARTICLE, 1)
  assert.equal(r.stage0ByProposals4w.VOCAB_RECALL, 0)
  assert.ok(formatGrowthSkillsBackfillReport(r).some((l) => l.includes('GRAMMAR_PARTICLE=1')))
})

test('apply — 옛 행(fromCorrection 칸 없음)은 관측 칸이 맞아도 fromCorrection 만 채운다 · 보고서 줄 · 두 번째 실행 0건', async () => {
  const U3 = 'cuser0000000000000000080c'
  const days = ['2026-10-15', '2026-10-16', '2026-10-17']
  const obs = [
    ...Array.from({ length: 21 }, (_, i) => ({ userId: U3, ...ob(i % 2 ? 'CORRECTION_REUSED' : 'CORRECTION_PROPOSED', i % 2 ? 'SUCCESS' : 'FAIL', 'GRAMMAR_PARTICLE', `${days[i % 3]}T03:00:00Z`, 'Correction', `p${i}`) })),
    { userId: U3, ...ob('GRAMMAR_USE', 'SUCCESS', 'GRAMMAR_PARTICLE', `${days[0]}T04:00:00Z`, 'Lesson', 'l0') },
  ]
  // 실시간 쓰기(fromCorrection 칸이 생기기 전 코드)로 관측 칸은 이미 다 들어간 옛 행.
  const R = new Map<string, { s: number; f: number }>()
  for (const o of obs) {
    const d = o.occurredAt.toISOString().slice(0, 10)
    const c = R.get(d) ?? { s: 0, f: 0 }
    if (o.outcome === 'SUCCESS') c.s++
    else c.f++
    R.set(d, c)
  }
  const daily = days.map((d) => ({ id: `u3-${d}`, userId: U3, periodKey: d, data: { lessons: 1, skills: { GRAMMAR_PARTICLE: legacyCells({ success: R.get(d)!.s, fail: R.get(d)!.f }) } } }))
  const w = fakeWorld({ obs, daily })
  const dry = await runGrowthSkillsBackfill(w.deps, { apply: false })
  assert.equal(dry.accounts[2].axes.GRAMMAR_PARTICLE['4w'].oneSided, true, '적용 뒤 칸 기준 — 교정 유래 21/22 ≥ 90%')
  assert.equal(dry.distribution4w.GRAMMAR_PARTICLE.oneSided, 1)
  const text = formatGrowthSkillsBackfillReport(dry).join('\n')
  assert.ok(text.includes('(of which fromCorrection: 21)'), '관측 수와 따로 보고')
  assert.ok(text.includes('oneSided(hidden)') && text.includes('oneSided=1'))
  const r = await runGrowthSkillsBackfill(w.deps, { apply: true })
  for (const d of days) {
    const g = (skillsOf(w.daily, U3, d) as Record<string, Record<string, number>>).GRAMMAR_PARTICLE
    assert.equal(g.fromCorrection, obs.filter((o) => o.kind !== 'GRAMMAR_USE' && o.occurredAt.toISOString().startsWith(d)).length, d)
    assert.equal(g.success + g.fail, R.get(d)!.s + R.get(d)!.f, '관측 칸은 그대로(이중 계산 없음)')
  }
  assert.ok(r.applied.rows >= 3)
  const writes = w.ops.update
  const again = await runGrowthSkillsBackfill(w.deps, { apply: true })
  assert.equal(again.fromCorrectionTotal, 0)
  assert.equal(w.ops.update, writes, '멱등 — 두 번째 실행 쓰기 0')
})

test('apply — transaction·backup 없이 부르면 쓰기 전에 실패', async () => {
  const w = fakeWorld()
  await assert.rejects(runGrowthSkillsBackfill({ db: w.deps.db, now: NOW }, { apply: true }), /transaction 과 backup/)
  assert.equal(w.ops.insert + w.ops.update, 0)
})

test('planUserBackfill — 바꿀 행·어긋난 행만 rows, after 는 바뀌지 않는 날도 담는다', () => {
  const plan = planUserBackfill({
    observations: [ob('GRAMMAR_USE', 'SUCCESS', 'GRAMMAR_PARTICLE', '2026-10-14T05:00:00Z', 'Lesson', 'l1')],
    attemptDate: new Map(),
    daily: [
      { id: 'x', periodKey: '2026-10-14', data: { skills: { GRAMMAR_PARTICLE: cells({ success: 1 }) } } },
      { id: 'y', periodKey: '2026-10-15', data: { lessons: 1 } },
      { id: 'z', periodKey: '2026-10-16', data: { skills: { VOCAB_RECALL: cells({ fail: 3 }) } } },
    ],
  })
  assert.deepEqual(plan.rows.map((r) => [r.date, r.added, r.mismatches]), [['2026-10-16', 0, 1]])
  assert.deepEqual([...plan.after.keys()], ['2026-10-14', '2026-10-16'])
})

test('스크립트 인자 — 기본 dry-run · --apply · --backup-dir · 모르는 인자는 오류 · 백업 파일 이름', () => {
  assert.deepEqual(parseBackfillArgs([], '/w'), { apply: false, backupDir: '/w/backups' })
  assert.deepEqual(parseBackfillArgs(['--apply', '--backup-dir=bk'], '/w'), { apply: true, backupDir: '/w/bk' })
  assert.ok('error' in parseBackfillArgs(['--aply'], '/w'))
  assert.ok('error' in parseBackfillArgs(['--backup-dir='], '/w'))
  assert.equal(backupFileName('2026-10-21T03:04:05.678Z'), 'growth-skills-backup-20261021T030405Z.json')
  const hint = backupDirHint({ apply: false, backupDir: '/w/backups' })
  assert.ok(hint.includes('/w/backups') && hint.includes(`--backup-dir=${PROD_BACKUP_DIR}`), '운영 백업 폴더 안내')
  assert.equal(PROD_BACKUP_DIR, '/home/brownjeon/apps/thekaiwa/shared/backups')
})
