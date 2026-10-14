import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SEED_PACKS, SEED_PACK_COUNT, seedPackCategory, type SeedPack } from '@/types/seedPack'
// task-068: 사용자별 복사(#46b insertSeedWords·planSeedInsert)는 폐지 — 로더·형식 검사·데이터 일관성 시험만 남긴다(기본 단어 시드가 같은 로더를 쓴다).
import { asSeedWords, createSeedPackStore, seedPackWords, type SeedWord } from '../vocab/seedPack'
import { parseWordInput } from '../vocab/words'
import wordsN5 from '../../../../prisma/seed-data/words-n5.json'

function word(surface: string, reading: string, over: Partial<SeedWord> = {}): SeedWord {
  return { surface, reading, meaning: `${surface} 뜻`, partOfSpeech: 'NOUN', chunkType: 'NAME', example: `${surface}です。`, exampleKo: '예문', ...over }
}

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

/**
 * 기존 50개와 OpenJLPT N5 의 철자만 다른 같은 단어(같은 읽기) — 병합하지 않는다(`scripts/seed-build/enrich.ts` LEGACY_SPELLING_VARIANTS 와 같아야 한다).
 * 알려진 한계: 옛 50개를 이미 가진 사용자는 N5 를 넣으면 두 표기(ご飯·御飯, 友だち·友達)가 함께 남는다 — 중복 키가 (표기, 읽기)라 다른 단어로 본다.
 */
const KNOWN_SPELLING_VARIANTS: Readonly<Record<string, string>> = { 'ご飯': '御飯', '友だち': '友達' }

test('task-051 데이터 일관성: 단계 사이 (표기, 읽기) 중복 없음', { skip: skipReason }, () => {
  const seen = new Map<string, SeedPack>()
  for (const pack of SEED_PACKS) {
    for (const w of asSeedWords(JSON.parse(readFileSync(fileOf(pack), 'utf8')), pack)) {
      const k = keyOf(w)
      assert.equal(seen.get(k), undefined, `${w.surface}/${w.reading} 이 ${seen.get(k)}·${pack} 둘 다에 있다`)
      seen.set(k, pack)
    }
  }
})

test('task-051 데이터 일관성: 기존 50개는 모두 N5 에 (표기, 읽기)로 있다 — 철자 차이 짝만 상대 표기로(허용 목록), 병합 행은 기존 값 그대로', { skip: skipReason }, () => {
  const n5 = asSeedWords(JSON.parse(readFileSync(fileOf('N5'), 'utf8')), 'N5')
  const n5ByKey = new Map(n5.map((w) => [keyOf(w), w]))
  const viaVariant: string[] = []
  for (const w of asSeedWords(wordsN5)) {
    const hit = n5ByKey.get(keyOf(w))
    if (hit) continue
    const alt = KNOWN_SPELLING_VARIANTS[w.surface]
    assert.ok(alt && n5ByKey.has(keyOf({ surface: alt, reading: w.reading })), `기존 ${w.surface}/${w.reading} 이 N5 에 없다(병합 누락)`)
    viaVariant.push(w.surface)
  }
  assert.deepEqual(viaVariant.sort(), Object.keys(KNOWN_SPELLING_VARIANTS).sort(), '허용 목록 밖의 철자 차이가 생겼거나 목록이 낡았다')
  // REV-179 가 짚은 병합 행(OpenJLPT N5 에 없던 기존 행)은 N5 끝에 기존 레코드 그대로 — 사람이 쓴 뜻·예문 유지.
  const legacyByKey = new Map(asSeedWords(wordsN5).map((w) => [keyOf(w), w]))
  const tail = n5.slice(-2)
  assert.deepEqual(tail.map((w) => `${w.surface}/${w.reading}`), ['私/わたし', '日本語/にほんご'])
  for (const w of tail) assert.deepEqual(w, legacyByKey.get(keyOf(w)), `${w.surface} 병합 행이 기존 값과 다르다`)
})
