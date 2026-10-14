/**
 * task-068 기본 단어 사본 이관 — 순수 계획(`vocab/seedCopyMigration`)과 실행기(`scripts/migrate-seed-copies.ts`)를 가짜 DB 로. DB 접속 없음.
 * 짝 맞춤(바이트)·짝 없음은 절대 건드리지 않음·상태 합산(옛 칸 + 사본 상태 + 대상, 감사 REV-068A-1)·멱등 표지·고친 사본 보존(REV-068A-2)·
 * 참조 옮김의 사용자 조건과 삭제 where(REV-068A-5)·쓰기 가드. 「고친 사본」 판정 기준 자체는 `task068SeedCopyEdited.test.ts`.
 */
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { SEED_PACKS, seedPackCategory } from '@/types/seedPack'
import { planBaseWords } from '../vocab/baseWordSeed'
import { asSeedWords } from '../vocab/seedPack'
import {
  EMPTY_OLD_SEED, contentDiff, copySideState, decideState, deleteDecision, indexOldOwnerSeed, isDefaultState, isEditedCopy, matchSeedCopies, mergeStates,
  oldOwnerSeedCopy, wordPairKey, type CopyPair, type SeedCopyRow, type WordContent, type WordStateValues,
} from '../vocab/seedCopyMigration'
import {
  CONFIRM_ENV, PRE_MIGRATION_EXPECTED, PRE_MIGRATION_INFO, expectationLine, formatMigrateReport, loadOldOwnerSeed, parseMigrateArgs, runMigration,
  type MigrateDb,
} from '../../../../scripts/migrate-seed-copies'

const T0 = new Date('2026-10-01T00:00:00Z')
const T1 = new Date('2026-10-05T00:00:00Z')
const T2 = new Date('2026-10-09T00:00:00Z')
const ZERO: WordStateValues = { correctCount: 0, wrongCount: 0, lastSeenAt: null, lastResult: null, archived: false, archivedAt: null }
const st = (over: Partial<WordStateValues>): WordStateValues => ({ ...ZERO, ...over })
const C: WordContent = { meaning: '뜻', partOfSpeech: 'NOUN', example: '例文', exampleKo: '예문', note: null }
const copy = (id: string, userId: string, surface: string, reading: string | null, over: Partial<WordStateValues & WordContent> = {}): SeedCopyRow => ({ id, userId, surface, reading, ...C, ...ZERO, ...over })
const pairOf = (legacy: WordStateValues, copyState: WordStateValues | null = null, diff: CopyPair['diff'] = []): CopyPair => ({ copyId: 'c', userId: 'u', baseId: 'b', legacy, copyState, diff, seedOrigin: false })
const ms = (v: unknown) => (v instanceof Date ? v.getTime() : null)

test('짝 맞춤: (표기, 읽기) 바이트 일치만 — 가타카나/히라가나·읽기 차이는 짝 없음, 같은 사용자의 두 사본이 한 기본 단어면 둘 다 보류', () => {
  const b = (id: string, surface: string, reading: string) => ({ id, surface, reading, ...C })
  const base = [b('b1', '猫', 'ねこ'), b('b2', 'ネコ', 'ねこ'), b('b3', '明日', 'あした'), b('b4', 'x', 'y'), b('b5', 'x', 'y')]
  const copies = [
    copy('c1', 'u1', '猫', 'ねこ'),
    copy('c2', 'u1', 'ネコ', 'ねこ'),
    copy('c3', 'u1', '明日', 'あす'), // 읽기가 다름 → 짝 없음
    copy('c4', 'u1', 'ねこ', 'ねこ'), // 콜레이션이 같게 볼 표기 → 짝 없음
    copy('c5', 'u2', '明日', 'あした'),
    copy('c6', 'u2', '明日', 'あした'), // u2 의 겹친 사본
    copy('c7', 'u3', '明日', 'あした', { correctCount: 5, wrongCount: 2 }),
    copy('c8', 'u3', 'x', 'y'), // 기본 단어 쪽 키가 겹침 → 짝 없음
  ]
  const m = matchSeedCopies(base, copies, new Map([['c7', st({ correctCount: 1 })]]))
  assert.deepEqual(m.pairs.map((p) => `${p.copyId}>${p.baseId}`), ['c1>b1', 'c2>b2', 'c7>b3'])
  assert.deepEqual(m.unmatched, ['c3', 'c4', 'c8'])
  assert.deepEqual(m.duplicate, ['c5', 'c6'])
  assert.equal(m.ambiguousBaseKeys, 1)
  const p7 = m.pairs[2]
  assert.deepEqual([p7.legacy.correctCount, p7.legacy.wrongCount, p7.copyState?.correctCount], [5, 2, 1], '옛 칸과 사본 상태를 둘 다 들고 간다(버리지 않음)')
  assert.equal(m.pairs[0].copyState, null)
})

test('고친 사본 판정: 뜻·품사·예문·번역·메모만 비교 · 빈 값은 null 과 같음 · 옛 OWNER 시드 사본 모양과 같으면 seedOrigin(안 고침)', () => {
  assert.deepEqual(contentDiff(C, C), [])
  assert.deepEqual(contentDiff({ ...C, meaning: '고친 뜻' }, C), ['meaning'])
  assert.deepEqual(contentDiff({ ...C, partOfSpeech: 'VERB' }, C), ['partOfSpeech'])
  assert.deepEqual(contentDiff({ ...C, note: '내 메모' }, C), ['note'])
  assert.deepEqual(contentDiff({ ...C, example: '別の例', exampleKo: '다른 예' }, C), ['example', 'exampleKo'])
  assert.deepEqual(contentDiff({ ...C, note: '  ' }, C), [], '공백뿐인 메모는 정보 없음')
  assert.deepEqual(contentDiff({ ...C, example: '' }, { ...C, example: null }), [])

  const base = [{ id: 'b1', surface: '猫', reading: 'ねこ', ...C }, { id: 'b2', surface: '犬', reading: 'いぬ', ...C }]
  const oldSeed = indexOldOwnerSeed([{ surface: '猫', reading: 'ねこ', meaning: '옛 뜻', partOfSpeech: 'NOUN', example: '例文', exampleKo: '예문', chunkType: 'NAME' }, { bad: true }, null])
  assert.deepEqual([oldSeed.rows, oldSeed.byKey.size], [3, 1], '형식이 다른 줄은 기준에서 빠짐')
  const m = matchSeedCopies(base, [copy('c1', 'u1', '猫', 'ねこ', { meaning: '옛 뜻' }), copy('c2', 'u1', '犬', 'いぬ', { meaning: '내가 고침' })], new Map(), oldSeed)
  assert.deepEqual(m.pairs.map((p) => [p.copyId, p.diff.join(','), p.seedOrigin, isEditedCopy(p)]), [['c1', 'meaning', true, false], ['c2', 'meaning', false, true]])
})

test('상태 합산(REV-068A-1): 감사 A 시연 — 옛 칸 5/2 + 사본 상태 1/0 → 기본 단어 6/2 · 대상이 있으면 대상까지 더함', () => {
  const legacy = st({ correctCount: 5, wrongCount: 2, lastSeenAt: T0, lastResult: 'WRONG' })
  const cs = st({ correctCount: 1, wrongCount: 0, lastSeenAt: T1, lastResult: 'CORRECT' })
  assert.equal(decideState(pairOf(legacy, cs), undefined), 'create')
  const created = mergeStates(undefined, legacy, cs)
  assert.deepEqual([created.correctCount, created.wrongCount, ms(created.lastSeenAt), created.lastResult], [6, 2, ms(T1), 'CORRECT'])
  assert.deepEqual(copySideState(legacy, cs), created)

  const target = st({ correctCount: 1, wrongCount: 1, lastSeenAt: T2, lastResult: 'SKIPPED' })
  assert.equal(decideState(pairOf(legacy, cs), target), 'merge')
  const merged = mergeStates(target, legacy, cs)
  assert.deepEqual([merged.correctCount, merged.wrongCount, ms(merged.lastSeenAt), merged.lastResult], [7, 3, ms(T2), 'SKIPPED'])
  const legacyOnly = mergeStates(st({ correctCount: 1 }), legacy, null)
  assert.deepEqual([legacyOnly.correctCount, legacyOnly.wrongCount, ms(legacyOnly.lastSeenAt), legacyOnly.lastResult], [6, 2, ms(T0), 'WRONG'], '대상에 시각이 없으면 옛 칸 시각·결과')
})

test('마지막 본 시각 = 가장 늦은 값, 결과는 그 출처를 따름 · 같은 시각이면 대상 > 사본 상태 > 옛 칸', () => {
  const late = mergeStates(st({ lastSeenAt: T0, lastResult: 'CORRECT' }), st({ lastSeenAt: T2, lastResult: 'WRONG' }), st({ lastSeenAt: T1, lastResult: 'SKIPPED' }))
  assert.deepEqual([ms(late.lastSeenAt), late.lastResult], [ms(T2), 'WRONG'], '옛 칸이 가장 늦으면 옛 칸')
  const tie = mergeStates(st({ lastSeenAt: T1, lastResult: 'WRONG' }), st({ lastSeenAt: T1, lastResult: 'SKIPPED' }), st({ lastSeenAt: T1, lastResult: 'CORRECT' }))
  assert.equal(tie.lastResult, 'WRONG', '같은 시각이면 대상')
  const tie2 = copySideState(st({ lastSeenAt: T1, lastResult: 'SKIPPED' }), st({ lastSeenAt: T1, lastResult: 'CORRECT' }))
  assert.equal(tie2.lastResult, 'CORRECT', '같은 시각이면 사본 상태가 옛 칸보다 앞')
  const none = mergeStates(undefined, st({ lastResult: 'WRONG' }), null)
  assert.deepEqual([none.lastSeenAt, none.lastResult], [null, 'WRONG'])
})

test('보관 정책: 대상 행이 있으면 대상 값 · 없으면 사본 상태 · 그것도 없으면 옛 칸(archivedAt 함께)', () => {
  const legacyArchived = st({ archived: true, archivedAt: T0, correctCount: 1 })
  assert.equal(mergeStates(st({ archived: false }), legacyArchived, null).archived, false, '대상 행이 있으면 대상의 선택')
  const kept = mergeStates(st({ archived: true, archivedAt: T1 }), st({ correctCount: 1 }), st({ archived: false }))
  assert.deepEqual([kept.archived, ms(kept.archivedAt)], [true, ms(T1)])
  const fromCopyState = mergeStates(undefined, legacyArchived, st({ correctCount: 1 }))
  assert.deepEqual([fromCopyState.archived, fromCopyState.archivedAt], [false, null], '대상이 없으면 새 코드의 사본 상태')
  const fromLegacy = mergeStates(undefined, legacyArchived, null)
  assert.deepEqual([fromLegacy.archived, ms(fromLegacy.archivedAt)], [true, ms(T0)])
})

test('결정: 기본값뿐이면 행 안 만듦(none-needed·clear-only) · 표지(옛 칸 0 + 사본 상태 없음) 뒤에는 할 일 없음 · 삭제 판단', () => {
  assert.ok(isDefaultState(ZERO))
  assert.equal(decideState(pairOf(ZERO), undefined), 'none-needed')
  assert.equal(decideState(pairOf(ZERO), st({ correctCount: 3 })), 'none-needed', '이미 이관된 사본(대상만 있음)')
  assert.equal(decideState(pairOf(ZERO, ZERO), undefined), 'clear-only', '빈 사본 상태 행은 지우기만')
  assert.equal(decideState(pairOf(st({ archived: true, archivedAt: T0 }), ZERO), undefined), 'clear-only', '새 코드 상태가 보관 안 함이면 그 값')
  assert.equal(decideState(pairOf(st({ archived: true, archivedAt: T0 })), undefined), 'create', '보관만 해도 옮긴다')
  assert.deepEqual(deleteDecision(pairOf(st({ correctCount: 1 })), 1), { ok: false, reason: 'refs-left' })
  assert.deepEqual(deleteDecision(pairOf(st({ correctCount: 1 })), 0), { ok: false, reason: 'state-pending' })
  assert.deepEqual(deleteDecision(pairOf(ZERO, ZERO), 0), { ok: false, reason: 'state-pending' }, '사본 상태 행이 남아 있으면 아직')
  assert.deepEqual(deleteDecision(pairOf(ZERO, null, ['note']), 0), { ok: false, reason: 'edited' })
  assert.deepEqual(deleteDecision({ ...pairOf(ZERO, null, ['example', 'exampleKo']), seedOrigin: true }, 0), { ok: true }, '옛 시드 그대로 = 안 고침')
  assert.deepEqual(deleteDecision(pairOf(ZERO), 0), { ok: true })
})

// ── 실행기 (가짜 DB) ──

type Rec = Record<string, unknown>
type Where = Record<string, unknown>
type TableName = 'wordEntry' | 'userWordState' | 'vocabAttempt' | 'evaluationItem' | 'correction' | 'repetitionItem' | 'learningObservation'
interface Call { table: TableName; op: string; args: Rec }

function matches(row: Rec, where: Where): boolean {
  return Object.entries(where).every(([k, cond]) => {
    if (k === 'OR') return (cond as Where[]).some((w) => matches(row, w))
    const v = row[k] ?? null
    if (cond instanceof Date) return v instanceof Date && v.getTime() === cond.getTime()
    if (cond !== null && typeof cond === 'object') {
      const c = cond as { in?: unknown[]; not?: unknown }
      if ('in' in c || 'not' in c) {
        if (c.in && !c.in.includes(v)) return false
        if ('not' in c && (c.not === null ? v === null : v === c.not)) return false
        return true
      }
      // 관계 필터(예: `session: { userId }`) — 픽스처는 소유 관계를 행 안에 둔다.
      return v !== null && typeof v === 'object' && matches(v as Rec, cond as Where)
    }
    return v === cond
  })
}

function applyData(row: Rec, data: Rec) {
  for (const [k, v] of Object.entries(data)) {
    if (v !== null && typeof v === 'object' && !(v instanceof Date) && 'increment' in v) row[k] = (row[k] as number) + (v as { increment: number }).increment
    else row[k] = v
  }
}

let seq = 0
function fakeDb(tables: Record<TableName, Rec[]>, beforeWrite?: (c: Call, t: Record<TableName, Rec[]>) => void) {
  const t = tables
  const calls: Call[] = []
  const write = (c: Call) => {
    beforeWrite?.(c, t)
    calls.push(c)
  }
  const table = (name: TableName, unique?: (r: Rec) => string) => ({
    findMany: async (a: { where: Where }) => t[name].filter((r) => matches(r, a.where)).map((r) => ({ ...r })),
    count: async (a: { where: Where }) => t[name].filter((r) => matches(r, a.where)).length,
    createMany: async (a: { data: Rec[]; skipDuplicates?: boolean }) => {
      write({ table: name, op: 'createMany', args: a })
      let count = 0
      for (const d of a.data) {
        if (unique && t[name].some((r) => unique(r) === unique(d))) {
          if (!a.skipDuplicates) throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
          continue
        }
        t[name].push({ id: `n${++seq}`, ...d })
        count++
      }
      return { count }
    },
    upsert: async (a: { where: { userId_wordId: { userId: string; wordId: string } }; create: Rec; update: Rec }) => {
      write({ table: name, op: 'upsert', args: a })
      const { userId, wordId } = a.where.userId_wordId
      const hit = t[name].find((r) => r.userId === userId && r.wordId === wordId)
      if (hit) applyData(hit, a.update)
      else t[name].push({ id: `n${++seq}`, ...a.create })
      return {}
    },
    updateMany: async (a: { where: Where; data: Rec }) => {
      write({ table: name, op: 'updateMany', args: a })
      const hit = t[name].filter((r) => matches(r, a.where))
      for (const r of hit) applyData(r, a.data)
      return { count: hit.length }
    },
    deleteMany: async (a: { where: Where }) => {
      write({ table: name, op: 'deleteMany', args: a })
      const gone = new Set(t[name].filter((r) => matches(r, a.where)).map((r) => r.id))
      t[name] = t[name].filter((r) => !gone.has(r.id))
      if (name === 'wordEntry') {
        // FK: UserWordState Cascade · VocabAttempt/EvaluationItem/Correction SetNull
        t.userWordState = t.userWordState.filter((s) => !gone.has(s.wordId))
        for (const r of t.vocabAttempt) if (gone.has(r.wordId)) r.wordId = null
        for (const r of t.evaluationItem) if (gone.has(r.wordId)) r.wordId = null
        for (const r of t.correction) if (gone.has(r.savedWordId)) r.savedWordId = null
      }
      return { count: gone.size }
    },
  })
  const db = {
    wordEntry: table('wordEntry'),
    userWordState: table('userWordState', (r) => `${r.userId}|${r.wordId}`),
    vocabAttempt: table('vocabAttempt'),
    evaluationItem: table('evaluationItem'),
    correction: table('correction'),
    repetitionItem: table('repetitionItem'),
    learningObservation: table('learningObservation'),
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  } as unknown as MigrateDb
  return { db, t, calls }
}

const empty = (): Record<TableName, Rec[]> => ({ wordEntry: [], userWordState: [], vocabAttempt: [], evaluationItem: [], correction: [], repetitionItem: [], learningObservation: [] })
const baseRow = (id: string, surface: string, reading: string) => ({ id, userId: null, seedKey: `N5-${id}`, source: 'SEED', surface, reading, ...C, chunkType: 'NAME', category: '초보자 (N5)', jlpt: 'N5', ...ZERO })
const copyRow = (id: string, userId: string, surface: string, reading: string, over: Partial<WordStateValues & WordContent> = {}) => ({
  id, userId, seedKey: null, source: 'SEED', surface, reading, ...C, chunkType: null, category: 'N5 기초', jlpt: 'N5', ...ZERO, ...over,
})
const attempt = (id: string, wordId: string, owner: string) => ({ id, wordId, session: { userId: owner } })
const evalItem = (id: string, wordId: string, owner: string) => ({ id, wordId, evaluation: { userId: owner } })

function world() {
  return fakeDb({
    wordEntry: [
      baseRow('b1', '猫', 'ねこ'), baseRow('b2', '犬', 'いぬ'), baseRow('b3', '鳥', 'とり'), baseRow('b4', '魚', 'さかな'), baseRow('b5', '牛', 'うし'),
      copyRow('c1', 'u1', '猫', 'ねこ', { correctCount: 3, wrongCount: 1, lastSeenAt: T0, lastResult: 'CORRECT' }), // 옛 칸 + 사본 상태 + 참조
      copyRow('c2', 'u1', '犬', 'いぬ'), // 기본값·Correction 참조
      copyRow('c3', 'u1', '鳥', 'とり', { wrongCount: 2, lastSeenAt: T0, lastResult: 'WRONG' }), // 대상이 이미 있음 → 합산
      copyRow('c4', 'u1', '馬', 'うま', { correctCount: 7 }), // 짝 없음
      copyRow('c5', 'u2', '魚', 'さかな', { archived: true, archivedAt: T0 }), // 보관만 · 반복 항목 충돌
      copyRow('c6', 'u1', '牛', 'うし', { correctCount: 1, lastSeenAt: T0, lastResult: 'CORRECT', meaning: '내가 고친 뜻' }), // 고친 사본
      copyRow('c7', 'u2', '犬', 'いぬ'), // 옛 칸 기본값 + 빈 사본 상태 행 → 지우기만
      { id: 'm1', userId: 'u1', seedKey: null, source: 'MANUAL', surface: '猫', reading: 'ねこ', ...C, ...ZERO }, // 사용자 직접 단어 — 대상 아님
    ],
    userWordState: [
      { id: 's0', userId: 'u1', wordId: 'b3', ...st({ wrongCount: 1, lastSeenAt: T1, lastResult: 'SKIPPED', archived: true, archivedAt: T1 }) },
      { id: 's1', userId: 'u1', wordId: 'c1', ...st({ correctCount: 1, lastSeenAt: T1, lastResult: 'CORRECT' }) },
      { id: 's7', userId: 'u2', wordId: 'c7', ...ZERO },
    ],
    vocabAttempt: [attempt('a1', 'c1', 'u1'), attempt('a2', 'c1', 'u1'), attempt('a3', 'c4', 'u1'), attempt('a4', 'b2', 'u1')],
    evaluationItem: [evalItem('e1', 'c1', 'u1')],
    correction: [{ id: 'k1', userId: 'u1', savedWordId: 'c2' }],
    repetitionItem: [
      { id: 'r1', userId: 'u1', refType: 'WordEntry', refId: 'c1' },
      { id: 'r2', userId: 'u2', refType: 'WordEntry', refId: 'c5' },
      { id: 'r3', userId: 'u2', refType: 'WordEntry', refId: 'b4' }, // 같은 (사용자, 기본 단어) 반복 항목이 이미 있음
    ],
    learningObservation: [{ id: 'o1', userId: 'u1', refType: 'WordEntry', refId: 'c1', wordId: 'c1' }],
  })
}

const opts = (step: 'plan' | 'state' | 'repoint' | 'delete-copies', over: Partial<{ apply: boolean; confirm: boolean; confirmDelete: boolean }> = {}) => ({ step, apply: true, confirm: true, confirmDelete: false, ...over })

test('plan: 개수만 보고하고 쓰기 0 · 합칠 행·사본 상태 행·고친 사본(EDITED)·내용 차이·기대값 대조 · --apply 를 줘도 plan 은 쓰지 않는다', async () => {
  const { db, calls } = world()
  const r = await runMigration(db, opts('plan'))
  assert.equal(r.apply, false)
  assert.deepEqual(calls, [])
  const s = r.before
  assert.deepEqual([s.base, s.copies, s.users, s.matched, s.unmatched, s.duplicate], [5, 7, 2, 6, 1, 0])
  assert.deepEqual(s.state, { pending: 5, create: 3, merge: 1, clearOnly: 1, noneNeeded: 1, legacyRows: 4, copyStateRows: 2 })
  const zeroFields = { meaning: 0, partOfSpeech: 0, example: 0, exampleKo: 0, note: 0 }
  assert.deepEqual(s.edited, { total: 1, byField: { ...zeroFields, meaning: 1 } }, '조각·분류·수준 차이는 고친 것이 아니다')
  assert.deepEqual(s.seedOrigin, { total: 0, byField: zeroFields })
  assert.deepEqual(s.oldSeed, { rows: 0, usable: 0, ambiguousKeys: 0 })
  assert.deepEqual(s.refs, { attempts: 2, evalItems: 1, corrections: 1, repetition: 2, repetitionConflict: 1, copiesWithRefs: 3 })
  assert.equal(s.observationsReportOnly, 1)
  assert.equal(s.deletable, 0)
  const lines = formatMigrateReport(r).join('\n')
  for (const secret of ['c1', 'u1', '猫', 'ねこ', '내가 고친 뜻']) assert.ok(!lines.includes(secret), `출력에 ${secret} 없음`)
  assert.match(lines, /EDITED copies .*=1 · by field vs base word: meaning=1 · partOfSpeech=0 · example=0 · exampleKo=0 · note=0/)
  assert.match(lines, /seed-origin copies .*=0 · by field vs base word: meaning=0/)
  assert.match(lines, /old OWNER seed file: rows=0 .*MISSING\/UNREADABLE/)
  assert.match(lines, /copy-id UserWordState rows to merge\+delete=2/)
  assert.ok(!/conflict=/.test(lines.replace(/RepetitionItem=\d+ \(conflict \d+\)/, '')), '상태 conflict 개념은 없다')
  assert.match(lines, /expect \(pre-migration.*copies 7\/678 DIFF.*DIFF — stop/)
  const good = { ...s, copies: 678, matched: 678, unmatched: 0, duplicate: 0, ambiguousBaseKeys: 0, edited: { ...s.edited, total: 0 } }
  assert.match(expectationLine({ ...good, seedOrigin: { ...s.seedOrigin, total: 35 } }), /→ ALL OK · info \(not gated\): seed-origin .* 35\/≈35$/)
  assert.match(expectationLine({ ...good, seedOrigin: { ...s.seedOrigin, total: 30 } }), /→ ALL OK · .*30\/≈35 — differs from estimate, report it$/, 'seed-origin 은 관문이 아니다')
  assert.match(expectationLine({ ...good, edited: { ...s.edited, total: 1 } }), /edited 1\/0 DIFF → DIFF — stop/)
  assert.deepEqual(PRE_MIGRATION_EXPECTED, { copies: 678, matched: 678, unmatched: 0, duplicate: 0, ambiguousBaseKeys: 0, edited: 0 })
  assert.deepEqual(PRE_MIGRATION_INFO, { seedOrigin: 35 })
})

test('쓰기 가드: 확인 환경변수 없으면 state/repoint/delete 모두 던지고 쓰기 0 · delete 는 --confirm-delete 도 요구 · 인자 해석', async () => {
  const { db, calls } = world()
  for (const step of ['state', 'repoint', 'delete-copies'] as const) {
    await assert.rejects(() => runMigration(db, opts(step, { confirm: false, confirmDelete: true })), new RegExp(CONFIRM_ENV))
  }
  await assert.rejects(() => runMigration(db, opts('delete-copies')), /confirm-delete/)
  assert.deepEqual(calls, [])
  const noApply = await runMigration(db, opts('state', { apply: false }))
  assert.equal(noApply.apply, false)
  assert.deepEqual(calls, [])
  assert.deepEqual(parseMigrateArgs([]), { step: 'plan', apply: false, confirmDelete: false })
  assert.deepEqual(parseMigrateArgs(['delete-copies', '--apply', '--confirm-delete']), { step: 'delete-copies', apply: true, confirmDelete: true })
  assert.throws(() => parseMigrateArgs(['state', '--confirm-delete']), /only for delete-copies/)
  assert.throws(() => parseMigrateArgs(['wipe']), /usage/)
})

test('전체 흐름: state(합산·표지·멱등) → 새 사본 기록만 다시 더함 → repoint(사본 참조 0) → delete(검증된 사본만, 고친 사본·짝 없음·직접 단어 불변)', async () => {
  const { db, t } = world()
  const early = await runMigration(db, opts('delete-copies', { confirmDelete: true }))
  assert.equal(early.written.deleted, 0, 'c2 는 Correction 참조, c1·c5 는 참조, c3·c6·c7 은 상태가 아직')

  const s1 = await runMigration(db, opts('state'))
  assert.deepEqual([s1.written.stateUpserted, s1.written.legacyCleared, s1.written.copyStatesDeleted], [4, 4, 2])
  const stateOf = (u: string, w: string) => t.userWordState.find((s) => s.userId === u && s.wordId === w)
  const b1 = stateOf('u1', 'b1')
  assert.deepEqual([b1?.correctCount, b1?.wrongCount, ms(b1?.lastSeenAt), b1?.lastResult], [4, 1, ms(T1), 'CORRECT'], '옛 칸 3/1 + 사본 상태 1/0')
  const b3 = stateOf('u1', 'b3')
  assert.deepEqual([b3?.correctCount, b3?.wrongCount, ms(b3?.lastSeenAt), b3?.lastResult, b3?.archived], [0, 3, ms(T1), 'SKIPPED', true], '대상 0/1 + 옛 칸 0/2, 보관은 대상 값')
  assert.equal(stateOf('u2', 'b4')?.archived, true)
  assert.equal(stateOf('u1', 'b5')?.correctCount, 1, '고친 사본도 상태는 옮긴다')
  assert.equal(stateOf('u1', 'b2'), undefined, '기본값 사본은 행을 만들지 않는다')
  assert.equal(stateOf('u2', 'b2'), undefined, '빈 사본 상태 행은 지우기만')
  assert.equal(stateOf('u1', 'c1'), undefined, '합친 사본 상태 행은 지운다')
  assert.equal(stateOf('u2', 'c7'), undefined)
  const word = (id: string) => t.wordEntry.find((w) => w.id === id) as Rec
  for (const id of ['c1', 'c3', 'c5', 'c6']) assert.ok(isDefaultState(word(id) as unknown as WordStateValues), `${id} 옛 칸은 표지로 0`)
  assert.equal(word('c4').correctCount, 7, '짝 없는 사본은 그대로')
  assert.equal(word('c6').meaning, '내가 고친 뜻', '내용은 손대지 않는다')

  const snapshot = JSON.stringify(t.userWordState)
  const s2 = await runMigration(db, opts('state'))
  assert.deepEqual([s2.written.stateUpserted, s2.written.legacyCleared, s2.written.copyStatesDeleted], [0, 0, 0], '다시 실행해도 더하지 않는다')
  assert.equal(JSON.stringify(t.userWordState), snapshot)
  assert.equal(s2.before.state.pending, 0)

  // 이관 뒤 새 코드가 사본에 다시 기록을 남기면(0 에서 시작) 그만큼만 더해진다.
  t.userWordState.push({ id: 's9', userId: 'u1', wordId: 'c6', ...st({ correctCount: 2, lastSeenAt: T2, lastResult: 'WRONG' }) })
  const s3 = await runMigration(db, opts('state'))
  assert.deepEqual([s3.written.stateUpserted, s3.written.copyStatesDeleted], [1, 1])
  const b5 = stateOf('u1', 'b5')
  assert.deepEqual([b5?.correctCount, ms(b5?.lastSeenAt), b5?.lastResult], [3, ms(T2), 'WRONG'])

  const rp = await runMigration(db, opts('repoint'))
  assert.deepEqual([rp.written.attempts, rp.written.evalItems, rp.written.corrections, rp.written.repetition], [2, 1, 1, 1])
  const copyIds = ['c1', 'c2', 'c3', 'c5', 'c6', 'c7']
  assert.equal(t.vocabAttempt.filter((a) => copyIds.includes(a.wordId as string)).length, 0, '사본을 가리키는 기록 0')
  assert.equal(t.evaluationItem.filter((e) => copyIds.includes(e.wordId as string)).length, 0)
  assert.equal(t.correction.find((k) => k.id === 'k1')?.savedWordId, 'b2')
  assert.equal(t.repetitionItem.find((r) => r.id === 'r1')?.refId, 'b1')
  assert.equal(t.repetitionItem.find((r) => r.id === 'r2')?.refId, 'c5', '같은 (사용자, 기본 단어) 반복 항목이 있으면 옮기지 않는다')
  assert.equal(t.vocabAttempt.find((a) => a.id === 'a3')?.wordId, 'c4', '짝 없는 사본의 기록은 그대로')
  assert.equal(t.learningObservation[0].wordId, 'c1', '관측(append-only)은 고치지 않는다')

  const del = await runMigration(db, opts('delete-copies', { confirmDelete: true }))
  assert.deepEqual(del.before.refused, { refsLeft: 1, statePending: 0, edited: 1 })
  assert.equal(del.written.deleted, 4, 'c1·c2·c3·c7')
  assert.deepEqual(t.wordEntry.map((w) => w.id).sort(), ['b1', 'b2', 'b3', 'b4', 'b5', 'c4', 'c5', 'c6', 'm1'], '고친 사본 c6 은 남는다')
  assert.equal(t.vocabAttempt.find((a) => a.id === 'a1')?.wordId, 'b1', '지운 뒤에도 기록은 기본 단어에 연결')
  assert.equal(stateOf('u1', 'b1')?.correctCount, 4, '사본 삭제가 기본 단어 상태를 건드리지 않는다')
  const again = await runMigration(db, opts('delete-copies', { confirmDelete: true }))
  assert.equal(again.written.deleted, 0)
  assert.equal(again.before.edited.total, 1, '고친 사본은 계속 보고된다')
})

test('방어 깊이(REV-068A-5): 다른 사용자 행은 옮기지 않고 그 사본은 남는다 · repoint·delete where 에 사용자·사본 조건', async () => {
  const tb = empty()
  tb.wordEntry.push(baseRow('b1', '猫', 'ねこ'), copyRow('c1', 'u1', '猫', 'ねこ'))
  tb.vocabAttempt.push(attempt('a1', 'c1', 'u1'), attempt('x1', 'c1', 'u9'))
  tb.evaluationItem.push(evalItem('e1', 'c1', 'u1'), evalItem('x2', 'c1', 'u9'))
  tb.correction.push({ id: 'k1', userId: 'u1', savedWordId: 'c1' }, { id: 'x3', userId: 'u9', savedWordId: 'c1' })
  tb.repetitionItem.push({ id: 'r1', userId: 'u1', refType: 'WordEntry', refId: 'c1' })
  const { db, t, calls } = fakeDb(tb)
  await runMigration(db, opts('repoint'))
  const wordOf = (rows: Rec[], id: string, k = 'wordId') => rows.find((r) => r.id === id)?.[k]
  assert.deepEqual([wordOf(t.vocabAttempt, 'a1'), wordOf(t.vocabAttempt, 'x1')], ['b1', 'c1'])
  assert.deepEqual([wordOf(t.evaluationItem, 'e1'), wordOf(t.evaluationItem, 'x2')], ['b1', 'c1'])
  assert.deepEqual([wordOf(t.correction, 'k1', 'savedWordId'), wordOf(t.correction, 'x3', 'savedWordId')], ['b1', 'c1'])
  assert.equal(wordOf(t.repetitionItem, 'r1', 'refId'), 'b1')
  const scope = (table: TableName) => calls.filter((c) => c.table === table && c.op === 'updateMany').map((c) => c.args.where as Where)
  assert.deepEqual(scope('vocabAttempt').map((w) => (w.session as Where)?.userId), ['u1'])
  assert.deepEqual(scope('evaluationItem').map((w) => (w.evaluation as Where)?.userId), ['u1'])
  assert.deepEqual(scope('correction').map((w) => w.userId), ['u1'])
  assert.deepEqual(scope('repetitionItem').map((w) => w.userId), ['u1'])

  const del = await runMigration(db, opts('delete-copies', { confirmDelete: true }))
  assert.equal(del.written.deleted, 0, '다른 사용자 참조가 남은 사본은 지우지 않는다')
  assert.equal(del.before.refused.refsLeft, 1)
})

test('삭제는 쓰는 순간에 사본 조건·표지를 다시 확인한다 — 그 사이 바뀐 행은 지우지 않는다', async () => {
  const tb = empty()
  for (const [i, s] of ['猫', '犬', '鳥', '魚', '牛'].entries()) tb.wordEntry.push(baseRow(`b${i}`, s, 'r'), copyRow(`c${i}`, 'u1', s, 'r'))
  const { db, t, calls } = fakeDb(tb, (c, tables) => {
    if (c.table !== 'wordEntry' || c.op !== 'deleteMany') return
    const w = (id: string) => tables.wordEntry.find((r) => r.id === id) as Rec
    w('c0').source = 'MANUAL'
    w('c1').seedKey = 'N5-9999'
    w('c2').correctCount = 1
    w('c3').userId = 'u2'
  })
  const r = await runMigration(db, opts('delete-copies', { confirmDelete: true }))
  assert.equal(r.before.deletable, 5)
  assert.equal(r.written.deleted, 1)
  assert.deepEqual(t.wordEntry.filter((w) => String(w.id).startsWith('c')).map((w) => w.id).sort(), ['c0', 'c1', 'c2', 'c3'])
  const where = calls.find((c) => c.op === 'deleteMany')?.args.where as Where
  assert.deepEqual([where.userId, where.source, where.seedKey, where.correctCount, where.lastSeenAt, where.archived], ['u1', 'SEED', null, 0, null, false])
})

test('옛 시드 원본 읽기: 미러 루트의 words-n5.json(없으면 빈 기준 = 막는 쪽) · plan 이 seed-origin 을 따로 세고 삭제를 허용한다', async () => {
  const known = loadOldOwnerSeed(process.cwd())
  assert.deepEqual([known.rows, known.byKey.size, known.ambiguousKeys], [50, 50, 0], '저장소 seed-data/words-n5.json')
  assert.equal(loadOldOwnerSeed('/nonexistent-root'), EMPTY_OLD_SEED)
  const k = [...known.byKey.values()][0]
  const tb = empty()
  tb.wordEntry.push(
    { ...baseRow('b1', k.surface, k.reading as string), meaning: `${k.meaning}(새)` },
    copyRow('c1', 'u1', k.surface, k.reading as string, { meaning: k.meaning, partOfSpeech: k.partOfSpeech, example: k.example, exampleKo: k.exampleKo }),
  )
  const { db, t } = fakeDb(tb)
  const r = await runMigration(db, { ...opts('plan'), oldSeed: known })
  assert.deepEqual([r.before.edited.total, r.before.seedOrigin.total, r.before.seedOrigin.byField.meaning, r.before.oldSeed.rows], [0, 1, 1, 50])
  assert.equal(r.before.deletable, 1, 'seed-origin 은 안 고친 것 — 지울 수 있다')
  const noSeed = await runMigration(db, opts('plan'))
  assert.deepEqual([noSeed.before.edited.total, noSeed.before.deletable], [1, 0], '기준 파일이 없으면 (a) 만 — 지우지 않는 쪽')
  const del = await runMigration(db, { ...opts('delete-copies', { confirmDelete: true }), oldSeed: known })
  assert.equal(del.written.deleted, 1)
  assert.deepEqual(t.wordEntry.map((w) => w.id), ['b1'])
})

test('plan 실제 JSON 모의(옛 OWNER 사본 50 + N5 팩 사본 628 = 678): 기대값 줄 ALL OK · edited 0 · seed-origin 35 · 678 모두 삭제 가능', async () => {
  const read = (...p: string[]) => JSON.parse(readFileSync(join(process.cwd(), 'prisma', 'seed-data', ...p), 'utf8')) as unknown
  const legacy = read('words-n5.json') as unknown[]
  const packs = Object.fromEntries(SEED_PACKS.map((p) => [p, read('jlpt', `${p.toLowerCase()}.json`)]))
  const plan = planBaseWords({ packs: packs as Parameters<typeof planBaseWords>[0]['packs'], legacy, reclass: read('chunk-reclass.json') })
  const tb = empty()
  for (const r of plan.rows) tb.wordEntry.push({ id: r.seedKey, ...r, note: null, ...ZERO })
  const owner = legacy.map((w) => oldOwnerSeedCopy(w)).filter((c): c is NonNullable<typeof c> => c !== null)
  owner.forEach((c, i) => tb.wordEntry.push({ id: `o${i}`, userId: 'owner', seedKey: null, ...c, ...ZERO }))
  // HEAD #46b `planSeedInsert`·`insertSeedWords` 재현: 같은 표기 + 같은 읽기의 기존 단어가 있으면 건너뛰고, 팩 JSON 을 그대로 복사.
  const taken = new Set(owner.map((c) => wordPairKey(c.surface, c.reading)))
  const packCopies = asSeedWords(packs.N5, 'N5').filter((w) => !taken.has(wordPairKey(w.surface, w.reading)))
  assert.equal(packCopies.length, 628, 'Leader 실측 678 = 옛 50 + 팩 628')
  packCopies.forEach((w, i) => tb.wordEntry.push({ id: `p${i}`, userId: 'owner', seedKey: null, source: 'SEED', ...w, jlpt: 'N5', category: seedPackCategory('N5'), note: null, ...ZERO }))
  const { db, calls } = fakeDb(tb)
  const r = await runMigration(db, { ...opts('plan'), oldSeed: loadOldOwnerSeed(process.cwd()) })
  const s = r.before
  assert.deepEqual([s.copies, s.matched, s.unmatched, s.duplicate, s.ambiguousBaseKeys, s.edited.total, s.seedOrigin.total, s.deletable], [678, 678, 0, 0, 0, 0, 35, 678])
  assert.deepEqual(calls, [])
  assert.match(expectationLine(s), /edited 0\/0 → ALL OK · info \(not gated\): seed-origin .* 35\/≈35$/)
  const before = await runMigration(db, { ...opts('plan'), oldSeed: EMPTY_OLD_SEED })
  assert.deepEqual([before.before.edited.total, before.before.deletable], [35, 643], '(b) 없는 판정이면 35행이 남는다(이번에 발견한 문제)')
})

test('CLI 가드: 환경변수 없이 쓰기 단계 --apply · delete 에 --confirm-delete 없음 은 DB 를 열기 전에 종료 코드 2(쓰기 0)', () => {
  const run = (args: string[], env: string) => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/migrate-seed-copies.ts', ...args], { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, [CONFIRM_ENV]: env }, timeout: 60_000 })
  for (const args of [['state', '--apply'], ['repoint', '--apply'], ['delete-copies', '--apply', '--confirm-delete']]) {
    const r = run(args, '')
    assert.equal(r.status, 2, r.stderr)
    assert.match(r.stderr, new RegExp(`${CONFIRM_ENV}=yes`))
  }
  const r = run(['delete-copies', '--apply'], 'yes')
  assert.equal(r.status, 2, r.stderr)
  assert.match(r.stderr, /requires --confirm-delete/)
})
