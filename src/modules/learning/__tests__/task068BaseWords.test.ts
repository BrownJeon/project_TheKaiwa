/**
 * task-068 기본 단어 시드 — 순수 계획(`vocab/baseWordSeed`)과 실행기(`scripts/seed-base-words.ts`)를 가짜 DB 로. DB 접속 없음.
 * 합집합(팩 7,755 ∪ 옛 50 추가분)·seedKey 유일·조각 재분류 D4 ★B(표현 122·꾸밈 64·이름 11·느낌 3)·빈 조각 0·멱등·쓰기 가드.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SEED_PACKS, SEED_PACK_COUNT, seedPackCategory } from '@/types/seedPack'
import { parseChunkReclassRules, planBaseWords, reclassifyChunk, type BaseWordRow, type BaseWordSeedInput } from '../vocab/baseWordSeed'
import {
  CONFIRM_ENV, SEED_WRITE_CHUNK, formatSeedReport, loadBaseWordPlan, parseSeedArgs, runSeedBaseWords, type SeedBaseWordsDb,
} from '../../../../scripts/seed-base-words'

const ROOT = process.cwd()
const read = (...p: string[]) => JSON.parse(readFileSync(join(ROOT, 'prisma', 'seed-data', ...p), 'utf8')) as unknown
const input = (): BaseWordSeedInput => ({
  packs: Object.fromEntries(SEED_PACKS.map((p) => [p, read('jlpt', `${p.toLowerCase()}.json`)])) as BaseWordSeedInput['packs'],
  legacy: read('words-n5.json'),
  reclass: read('chunk-reclass.json'),
})
const PLAN = planBaseWords(input())
const bySurface = (s: string) => PLAN.rows.filter((r) => r.surface === s)

test('합집합: 팩 7,755(단계별 개수 = SEED_PACK_COUNT) + 옛 words-n5.json 중 (표기, 읽기)가 팩에 없는 2행 = 7,757', () => {
  assert.deepEqual(PLAN.packCount, SEED_PACK_COUNT)
  assert.equal(PLAN.legacyCount, 50)
  assert.deepEqual(PLAN.legacyAdded, [
    { seedKey: 'N5X-0004', surface: '友だち', reading: 'ともだち' },
    { seedKey: 'N5X-0007', surface: 'ご飯', reading: 'ごはん' },
  ])
  assert.equal(PLAN.rows.length, 7755 + 2)
  // 옛 50개는 하나도 잃지 않는다 — 모두 (표기, 읽기)로 기본 단어에 있다.
  const keys = new Set(PLAN.rows.map((r) => `${r.surface}\u0000${r.reading}`))
  for (const w of read('words-n5.json') as { surface: string; reading: string }[]) assert.ok(keys.has(`${w.surface}\u0000${w.reading}`), w.surface)
  assert.equal(keys.size, PLAN.rows.length, '(표기, 읽기) 중복 0')
})

test('seedKey: 유일 · 형식(단계-4자리, 옛 추가분 N5X-) · 단계 JSON 순서 그대로 · 공용 행 모양(userId null·SEED·단계·분류)', () => {
  assert.equal(new Set(PLAN.rows.map((r) => r.seedKey)).size, PLAN.rows.length)
  for (const r of PLAN.rows) {
    assert.match(r.seedKey, /^(N[1-5]|N5X)-\d{4}$/)
    assert.equal(r.userId, null)
    assert.equal(r.source, 'SEED')
  }
  const n4 = read('jlpt', 'n4.json') as { surface: string }[]
  const n4rows = PLAN.rows.filter((r) => r.seedKey.startsWith('N4-'))
  assert.deepEqual(n4rows.map((r) => r.surface), n4.map((w) => w.surface))
  assert.equal(n4rows[0].seedKey, 'N4-0001')
  assert.equal(n4rows.at(-1)?.seedKey, `N4-${String(SEED_PACK_COUNT.N4).padStart(4, '0')}`)
  for (const p of SEED_PACKS) assert.ok(PLAN.rows.filter((r) => r.seedKey.startsWith(`${p}-`)).every((r) => r.jlpt === p && r.category === seedPackCategory(p)))
  const legacy = PLAN.rows.filter((r) => r.seedKey.startsWith('N5X-'))
  assert.ok(legacy.every((r) => r.jlpt === 'N5' && r.category === seedPackCategory('N5')))
  assert.deepEqual(planBaseWords(input()), PLAN, '같은 입력 = 같은 계획(멱등 키)')
})

test('조각 재분류 D4 ★B: 빈 조각 200행 → 표현 122·꾸밈 64·이름 11·느낌 3, 결과에 빈 조각 0, 원래 조각이 있던 행은 그대로', () => {
  assert.deepEqual(PLAN.reclassified, { NAME: 11, ACTION: 0, FEELING: 3, MODIFIER: 64, EXPRESSION: 122 })
  assert.equal(PLAN.rows.filter((r) => !r.chunkType).length, 0)
  assert.equal(Object.values(PLAN.byChunk).reduce((a, b) => a + b, 0), PLAN.rows.length)
  // 대표 단어(데모 D4 예시·규칙 각 갈래)
  const chunkOf = (s: string) => bySurface(s).map((r) => r.chunkType)
  assert.deepEqual(chunkOf('はじめまして'), ['EXPRESSION'], '인사(품사 표현)')
  assert.deepEqual(chunkOf('しかし'), ['EXPRESSION'], '이음말 목록')
  assert.deepEqual(chunkOf('ちゃん'), ['MODIFIER'], '접사(품사 기타)')
  assert.deepEqual(chunkOf('など'), ['MODIFIER'], '조사')
  // 様 은 두 행: よう(명사, 원래 NAME — 그대로) · 조각이 빈 접미 행(품사 기타 → 꾸밈)
  assert.deepEqual(bySurface('様').map((r) => `${r.reading}:${r.partOfSpeech}:${r.chunkType}`).sort(), ['さま:OTHER:MODIFIER', 'よう:NOUN:NAME'])
  assert.deepEqual(chunkOf('その'), ['MODIFIER'], '연체사 목록')
  assert.deepEqual(chunkOf('どこ'), ['NAME'], '대명사 목록')
  assert.deepEqual(chunkOf('不可'), ['FEELING'], 'な형용사')
  assert.deepEqual(chunkOf('封建'), ['NAME'], '명사')
  // 원본 조각이 있던 행은 바꾸지 않는다.
  const n5 = read('jlpt', 'n5.json') as { chunkType: string | null }[]
  PLAN.rows.filter((r) => r.seedKey.startsWith('N5-')).forEach((r, i) => {
    if (n5[i].chunkType) assert.equal(r.chunkType, n5[i].chunkType)
  })
})

test('재분류 규칙 가드: expected 개수가 다르면·규칙 없는 품사·(표기, 읽기) 중복·칸 길이 초과는 계획 실패', () => {
  const rules = read('chunk-reclass.json') as Record<string, unknown>
  assert.throws(() => planBaseWords({ ...input(), reclass: { ...rules, expected: { EXPRESSION: 121, MODIFIER: 65, NAME: 11, FEELING: 3 } } }), /expected/)
  const r = parseChunkReclassRules(rules)
  assert.throws(() => reclassifyChunk({ surface: '走る', partOfSpeech: 'VERB' }, r), /규칙 없음/)
  assert.equal(reclassifyChunk({ surface: 'どこ', partOfSpeech: 'PARTICLE' }, r), 'NAME', '표기 목록이 품사 규칙보다 먼저')
  assert.throws(() => parseChunkReclassRules({ ...rules, bySurface: { NAME: ['どこ'], MODIFIER: ['どこ'] } }), /중복 표기/)
  const w = { surface: 'テスト', reading: 'てすと', meaning: '시험', partOfSpeech: 'NOUN', chunkType: 'NAME', example: '例。', exampleKo: '예.' }
  const base = input()
  assert.throws(() => planBaseWords({ ...base, packs: { ...base.packs, N4: [w, w] } }), /중복/)
  assert.throws(() => planBaseWords({ ...base, packs: { ...base.packs, N4: [{ ...w, meaning: '가'.repeat(201) }] } }), /칸 길이/)
})

// ── 실행기 (가짜 DB) ──

type Row = BaseWordRow | (Omit<BaseWordRow, 'userId' | 'seedKey'> & { userId: string | null; seedKey: string | null })

function fakeDb(initial: Row[] = []) {
  const rows: Row[] = initial.map((r) => ({ ...r }))
  const calls = { createMany: [] as { n: number; skip: boolean }[], updateMany: 0, transactions: 0 }
  const db = {
    wordEntry: {
      findMany: async (a: { where: { seedKey: { not: null } } }) => {
        assert.deepEqual(a.where, { seedKey: { not: null } })
        return rows.filter((r) => r.seedKey !== null).map((r) => ({ ...r }))
      },
      createMany: async (a: { data: BaseWordRow[]; skipDuplicates?: boolean }) => {
        calls.createMany.push({ n: a.data.length, skip: a.skipDuplicates === true })
        let count = 0
        for (const d of a.data) {
          if (rows.some((r) => r.seedKey === d.seedKey)) {
            if (!a.skipDuplicates) throw Object.assign(new Error('Unique constraint failed on seedKey'), { code: 'P2002' })
            continue
          }
          rows.push({ ...d })
          count++
        }
        return { count }
      },
      updateMany: async (a: { where: { seedKey: string; userId: null }; data: Partial<BaseWordRow> }) => {
        calls.updateMany++
        let count = 0
        for (const r of rows) {
          if (r.seedKey !== a.where.seedKey || r.userId !== a.where.userId) continue
          Object.assign(r, a.data)
          count++
        }
        return { count }
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => {
      calls.transactions++
      return Promise.all(ops)
    },
  } as unknown as SeedBaseWordsDb
  return { db, rows, calls }
}

test('dry-run 은 DB 를 열지 않는다(db=null) · 쓰기 모드는 확인 없이는 던지고 쓰기 0 · 인자 해석', async () => {
  const r = await runSeedBaseWords(null, PLAN, { mode: 'dry-run', confirm: false })
  assert.equal(r.before, null)
  assert.ok(formatSeedReport(r).some((l) => l.includes('total=7757')))
  const { db, rows, calls } = fakeDb()
  await assert.rejects(() => runSeedBaseWords(db, PLAN, { mode: 'apply', confirm: false }), new RegExp(CONFIRM_ENV))
  await assert.rejects(() => runSeedBaseWords(db, PLAN, { mode: 'update', confirm: false }), new RegExp(CONFIRM_ENV))
  assert.equal(rows.length, 0)
  assert.equal(calls.createMany.length + calls.updateMany, 0)
  assert.equal(parseSeedArgs([]), 'dry-run')
  assert.equal(parseSeedArgs(['--check-db']), 'check-db')
  assert.throws(() => parseSeedArgs(['--apply', '--update']), /exclusive/)
  assert.throws(() => parseSeedArgs(['--force']), /unknown/)
  assert.deepEqual(loadBaseWordPlan(ROOT), PLAN)
})

test('apply: 1,000행 조각 × skipDuplicates 를 한 트랜잭션으로, 다시 실행하면 0행(멱등) · 이미 있던 행·사용자 행은 그대로', async () => {
  const mine: Row = { ...PLAN.rows[0], seedKey: null, userId: 'u1', meaning: '내 뜻' }
  const { db, rows, calls } = fakeDb([mine])
  const first = await runSeedBaseWords(db, PLAN, { mode: 'apply', confirm: true })
  assert.equal(first.inserted, PLAN.rows.length)
  assert.equal(calls.transactions, 1)
  assert.deepEqual(calls.createMany.map((c) => c.n), [...Array(7).fill(SEED_WRITE_CHUNK), PLAN.rows.length - 7 * SEED_WRITE_CHUNK])
  assert.ok(calls.createMany.every((c) => c.skip))
  assert.equal(first.after?.present, PLAN.rows.length)
  assert.equal(first.after?.missing, 0)
  const second = await runSeedBaseWords(db, PLAN, { mode: 'apply', confirm: true })
  assert.equal(second.inserted, 0)
  assert.equal(rows.length, PLAN.rows.length + 1, '두 번 돌려도 같은 행 수')
  assert.deepEqual(rows[0], mine, '사용자 행 불변')
})

test('check-db 는 읽기만(present·missing·drift·unknown·owned) · update 는 내용이 다른 행만, drift·사용자 행은 건드리지 않는다', async () => {
  const [a, b, c, d] = PLAN.rows
  const seeded: Row[] = [
    { ...a },
    { ...b, meaning: '오타' }, // 내용만 다름 → update 대상
    { ...c, surface: '다른말', meaning: '다른 뜻' }, // 같은 seedKey·다른 표기 → drift(내용이 달라도 손대지 않음)
    { ...d, seedKey: 'N9-0001' }, // 계획에 없는 키
    { ...a, seedKey: 'OWN-1', userId: 'u1' }, // seedKey 가 있는 사용자 행(이상) — 보고만
  ]
  const { db, rows, calls } = fakeDb(seeded)
  const chk = await runSeedBaseWords(db, PLAN, { mode: 'check-db', confirm: false })
  assert.deepEqual(chk.before, { seedRows: 5, ownedSeedKeyRows: 1, present: 3, missing: PLAN.rows.length - 3, unknown: 1, drift: 1, contentDiff: 1 })
  assert.equal(calls.createMany.length + calls.updateMany, 0)
  const up = await runSeedBaseWords(db, PLAN, { mode: 'update', confirm: true })
  assert.equal(up.updated, 1)
  assert.equal(rows[1].meaning, b.meaning)
  assert.deepEqual([rows[2].surface, rows[2].meaning], ['다른말', '다른 뜻'])
  assert.equal(rows[4].userId, 'u1')
  assert.equal(up.after?.contentDiff, 0)
  assert.equal(up.after?.drift, 1)
})

test('CLI 가드: 환경변수 없이 --apply/--update 는 DB 를 열기 전에 종료 코드 2(쓰기 0)', () => {
  for (const flag of ['--apply', '--update']) {
    const r = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/seed-base-words.ts', flag], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, [CONFIRM_ENV]: '' }, timeout: 60_000 })
    assert.equal(r.status, 2, r.stderr)
    assert.match(r.stderr, new RegExp(`${CONFIRM_ENV}=yes`))
  }
})
