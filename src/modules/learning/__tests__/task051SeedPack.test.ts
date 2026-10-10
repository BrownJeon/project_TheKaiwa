import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Tx } from '@/modules/infra'
import { SEED_PACKS, SEED_PACK_COUNT, seedPackCategory, type SeedPack } from '@/types/seedPack'
import {
  SEED_INSERT_CHUNK, SEED_QUERY_CHUNK, asSeedWords, createSeedPackStore, insertSeedWords, planSeedInsert, seedPackWords, type ExistingWord, type SeedWord,
} from '../vocab/seedPack'
import { parseWordInput } from '../vocab/words'
import wordsN5 from '../../../../prisma/seed-data/words-n5.json'

type Row = { userId: string; surface: string; reading: string | null; [k: string]: unknown }

function word(surface: string, reading: string, over: Partial<SeedWord> = {}): SeedWord {
  return { surface, reading, meaning: `${surface} 뜻`, partOfSpeech: 'NOUN', chunkType: 'NAME', example: `${surface}です。`, exampleKo: '예문', ...over }
}

/** DB 콜레이션 흉내 — 가타카나를 히라가나로 접어 비교한다(실제 utf8mb4 일반 콜레이션은 탁음까지 같게 본다). */
const fold = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))

function fakeTx(rows: Row[], opts: { failInsertAt?: number } = {}) {
  const calls = { findIn: [] as string[][], createRows: [] as number[] }
  const tx = {
    wordEntry: {
      findMany: async (a: { where: { userId: string; surface: { in: string[] } } }) => {
        calls.findIn.push(a.where.surface.in)
        const keys = new Set(a.where.surface.in.map(fold))
        return rows.filter((r) => r.userId === a.where.userId && keys.has(fold(r.surface))).map((r) => ({ surface: r.surface, reading: r.reading }))
      },
      createMany: async (a: { data: Row[] }) => {
        if (opts.failInsertAt === calls.createRows.length) throw new Error('insert failed')
        calls.createRows.push(a.data.length)
        rows.push(...a.data)
        return { count: a.data.length }
      },
    },
  } as unknown as Tx
  return { tx, calls, rows }
}

test('task-051 건너뜀 규칙: 같은 표기·같은 읽기 skip / 같은 표기·다른 읽기 add / 기존 읽기 비어 있음 skip / 팩 안 (표기, 읽기) 중복은 한 번', () => {
  const words = [word('明日', 'あした'), word('明日', 'あす'), word('私', 'わたし'), word('猫', 'ねこ'), word('犬', 'いぬ'), word('犬', 'いぬ'), word('ねこ', 'ねこ')]
  const existing: ExistingWord[] = [
    { surface: '明日', reading: 'あした' },
    { surface: '私', reading: null },
    { surface: '猫', reading: '  ' },
    { surface: 'ネコ', reading: 'ねこ' }, // 콜레이션이 같게 본 다른 표기 — JS `===` 로는 다른 단어
  ]
  const fresh = planSeedInsert(words, existing)
  assert.deepEqual(fresh.map((w) => `${w.surface}/${w.reading}`), ['明日/あす', '犬/いぬ', 'ねこ/ねこ'])
  assert.equal(planSeedInsert(words, []).length, 6, '빈 단어장: 팩 안 중복 1개만 빠진다')
})

test('task-051 쓰기: source=SEED·jlpt=단계·category=표시 이름, 다시 눌러도 두 번 안 들어감, 다른 사용자 행은 보지 않는다', async () => {
  const { tx, rows } = fakeTx([{ userId: 'other', surface: '犬', reading: 'いぬ' }])
  const words = [word('犬', 'いぬ'), word('明日', 'あす')]
  assert.deepEqual(await insertSeedWords(tx, 'u1', 'N4', words), { added: 2, skipped: 0 })
  const mine = rows.filter((r) => r.userId === 'u1')
  assert.equal(mine.length, 2)
  for (const r of mine) {
    assert.equal(r.source, 'SEED')
    assert.equal(r.jlpt, 'N4')
    assert.equal(r.category, seedPackCategory('N4'))
    assert.equal(r.category, '초급 (N4)')
  }
  assert.deepEqual(await insertSeedWords(tx, 'u1', 'N4', words), { added: 0, skipped: 2 }, '다시 누름')
  assert.equal(rows.filter((r) => r.userId === 'u1').length, 2)
})

test('task-051 쓰기: 이전 N5 50개(words-n5.json, 분류 N5 기초)를 가진 사용자 — 같은 (표기, 읽기)는 건너뛴다', async () => {
  const old = asSeedWords(wordsN5)
  const { tx } = fakeTx(old.map((w) => ({ userId: 'u1', surface: w.surface, reading: w.reading, category: 'N5 기초' })))
  const pack = [...old, word('飛行機雲', 'ひこうきぐも')]
  assert.deepEqual(await insertSeedWords(tx, 'u1', 'N5', pack), { added: 1, skipped: 50 })
})

test('task-051 쓰기: 큰 후보는 조회·삽입을 나눠서(표기 중복 없이), 결과 합은 그대로', async () => {
  const n = SEED_QUERY_CHUNK * 2 + 234
  const words = Array.from({ length: n }, (_, i) => word(`語${i}`, `ご${i}`))
  words.push(word('語0', 'べつ')) // 같은 표기 다른 읽기 — 조회 목록에는 표기 한 번
  const { tx, calls } = fakeTx([{ userId: 'u1', surface: '語1', reading: 'ご1' }])
  assert.deepEqual(await insertSeedWords(tx, 'u1', 'N1', words), { added: n, skipped: 1 })
  assert.deepEqual(calls.findIn.map((c) => c.length), [SEED_QUERY_CHUNK, SEED_QUERY_CHUNK, 234])
  assert.equal(new Set(calls.findIn.flat()).size, n)
  assert.ok(calls.createRows.every((c) => c <= SEED_INSERT_CHUNK))
  assert.equal(calls.createRows.reduce((a, b) => a + b, 0), n)
  assert.equal(calls.createRows.length, Math.ceil(n / SEED_INSERT_CHUNK))
})

test('task-051 쓰기: 나눠 넣는 중 실패하면 예외를 그대로 올린다(트랜잭션이 전부 되돌리게 — 삼키지 않음)', async () => {
  const words = Array.from({ length: SEED_INSERT_CHUNK + 1 }, (_, i) => word(`語${i}`, `ご${i}`))
  const { tx, calls } = fakeTx([], { failInsertAt: 1 })
  await assert.rejects(insertSeedWords(tx, 'u1', 'N3', words), /insert failed/)
  assert.deepEqual(calls.createRows, [SEED_INSERT_CHUNK])
})

test('task-051 지연 로더: 단계별 한 번만 로드·검사하고 같은 배열(동결), 형식 오류는 단계 이름과 함께 거절 후 다음 요청에 다시 로드', async () => {
  const loads: SeedPack[] = []
  let broken = true
  const store = createSeedPackStore(async (pack) => {
    loads.push(pack)
    if (pack === 'N2' && broken) return [{ ...word('壊', 'x'), reading: '' }]
    return [{ ...word('犬', 'いぬ'), jlpt: pack }]
  })
  const [a, b] = await Promise.all([store('N5'), store('N5')])
  assert.equal(a, b)
  assert.ok(Object.isFrozen(a))
  assert.equal(a.length, 1)
  assert.equal('jlpt' in a[0], false, '레코드의 여분 칸은 버린다(단계는 팩에서)')
  await store('N4')
  assert.deepEqual(loads, ['N5', 'N4'])
  await assert.rejects(store('N2'), /시드 팩 형식 오류\(N2\): \[0\]\.reading/)
  broken = false
  assert.equal((await store('N2')).length, 1)
  assert.deepEqual(loads, ['N5', 'N4', 'N2', 'N2'])
  await assert.rejects(createSeedPackStore(async () => ({ not: 'array' }))('N1'), /배열이 아님/)
})

// ── 데이터 일관성(A1 생성 파일) — 파일이 아직 없으면 이유를 남기고 건너뛴다 ────────────────────────────────────────────
const JLPT_DIR = join(process.cwd(), 'prisma/seed-data/jlpt')
const fileOf = (p: SeedPack) => join(JLPT_DIR, `${p.toLowerCase()}.json`)
const missing = SEED_PACKS.filter((p) => !existsSync(fileOf(p)))
const skipReason = missing.length ? `prisma/seed-data/jlpt/{${missing.map((p) => p.toLowerCase()).join(',')}}.json 이 아직 없다(A1 생성 뒤 Leader 가 실행)` : false
if (skipReason) console.log(`[task-051] 데이터 일관성 시험 건너뜀: ${skipReason}`)
const keyOf = (w: { surface: string; reading: string }) => `${w.surface}\u0000${w.reading}`

for (const pack of SEED_PACKS) {
  test(`task-051 데이터 일관성 ${pack}: 개수 맵 = 파일 길이 = 로더 길이, 전부 형식·#41 한도 통과, (표기, 읽기) 중복 없음`, { skip: existsSync(fileOf(pack)) ? false : skipReason || true }, async () => {
    const raw: unknown = JSON.parse(readFileSync(fileOf(pack), 'utf8'))
    assert.ok(Array.isArray(raw))
    assert.equal(raw.length, SEED_PACK_COUNT[pack], 'seedPackCounts.ts 를 다시 생성해야 한다')
    for (const [i, r] of (raw as Record<string, unknown>[]).entries()) if ('jlpt' in r && r.jlpt != null) assert.equal(r.jlpt, pack, `[${i}].jlpt`)
    const words = asSeedWords(raw, pack)
    const keys = new Set(words.map(keyOf))
    assert.equal(keys.size, words.length, '(표기, 읽기) 중복')
    for (const w of words) {
      parseWordInput({ surface: w.surface, meaning: w.meaning, reading: w.reading, partOfSpeech: w.partOfSpeech, chunkType: w.chunkType, example: w.example, exampleKo: w.exampleKo, jlpt: pack, category: seedPackCategory(pack) })
    }
    assert.equal((await seedPackWords(pack)).length, SEED_PACK_COUNT[pack], '번들 경로(동적 import) 로더')
  })
}

test('task-051 데이터 일관성: 단계 사이 (표기, 읽기) 중복 없음 · 이전 50개 중 새 N5 와 표기가 같은 단어는 읽기도 같다(다시 눌러도 두 번 안 들어감)', { skip: skipReason }, () => {
  const seen = new Map<string, SeedPack>()
  for (const pack of SEED_PACKS) {
    for (const w of asSeedWords(JSON.parse(readFileSync(fileOf(pack), 'utf8')), pack)) {
      const k = keyOf(w)
      assert.equal(seen.get(k), undefined, `${w.surface}/${w.reading} 이 ${seen.get(k)}·${pack} 둘 다에 있다`)
      seen.set(k, pack)
    }
  }
  const n5 = asSeedWords(JSON.parse(readFileSync(fileOf('N5'), 'utf8')), 'N5')
  const n5Surfaces = new Set(n5.map((w) => w.surface))
  const n5Keys = new Set(n5.map(keyOf))
  const notInN5: string[] = []
  for (const w of asSeedWords(wordsN5)) {
    if (!n5Surfaces.has(w.surface)) notInN5.push(w.surface)
    else assert.ok(n5Keys.has(keyOf(w)), `이전 50개 ${w.surface}/${w.reading}: 새 N5 에 같은 표기·다른 읽기만 있다 → 다시 누르면 추가된다`)
  }
  if (notInN5.length) console.log(`[task-051] 이전 50개 중 새 N5 에 같은 표기가 없는 단어 ${notInN5.length}개(표기 규칙상 새 단어로 들어간다): ${notInN5.join(' ')}`)
})
