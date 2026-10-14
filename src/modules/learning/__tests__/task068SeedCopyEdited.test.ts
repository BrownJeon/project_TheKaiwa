/**
 * task-068 이관 「고친 사본」 판정(edited 판정 수정) — 기준은 사본이 만들어질 때 받은 내용: (a) 짝 기본 단어 또는 (b) 옛 OWNER 시드 사본 모양.
 * 실제 `words-n5.json`·팩 JSON 으로 옛 시드 50행을 옛 seed.ts 모양 사본으로 만들어 edited 0(이번에 발견한 35행 문제의 회귀 시험). DB 접속 없음.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SEED_PACKS } from '@/types/seedPack'
import { planBaseWords, type BaseWordSeedInput } from '../vocab/baseWordSeed'
import {
  EMPTY_OLD_SEED, deleteDecision, indexOldOwnerSeed, isEditedCopy, matchSeedCopies, oldOwnerSeedCopy, wordPairKey,
  type BaseWordRow, type CopyMatchPlan, type SeedCopyRow, type WordContent, type WordStateValues,
} from '../vocab/seedCopyMigration'
import { PRE_MIGRATION_INFO } from '../../../../scripts/migrate-seed-copies'

const ZERO: WordStateValues = { correctCount: 0, wrongCount: 0, lastSeenAt: null, lastResult: null, archived: false, archivedAt: null }
const C: WordContent = { meaning: '기본 뜻', partOfSpeech: 'NOUN', example: '新しい例。', exampleKo: '새 예문', note: null }
const contentOf = (x: WordContent): WordContent => ({ meaning: x.meaning, partOfSpeech: x.partOfSpeech, example: x.example, exampleKo: x.exampleKo, note: x.note })
const base = (id: string, surface: string, reading: string): BaseWordRow => ({ id, surface, reading, ...C })
// 사본마다 다른 사용자 — 같은 사용자의 두 사본이 한 기본 단어에 짝지어지면 duplicate 로 빠지므로.
const copy = (id: string, surface: string, reading: string | null, content: WordContent): SeedCopyRow => ({ id, userId: `u-${id}`, surface, reading, ...contentOf(content), ...ZERO })
const oldLine = (surface: string, reading: string, over: Record<string, unknown> = {}) => ({
  surface, reading, meaning: '옛 뜻', partOfSpeech: 'NOUN', chunkType: 'NAME', example: '古い例。', exampleKo: '옛 예문', ...over,
})
const pairIn = (m: CopyMatchPlan, id: string) => {
  const p = m.pairs.find((x) => x.copyId === id)
  assert.ok(p, `${id} 짝`)
  return p
}
const verdict = (m: CopyMatchPlan, id: string) => {
  const p = pairIn(m, id)
  return { edited: isEditedCopy(p), seedOrigin: p.seedOrigin, deletable: deleteDecision(p, 0).ok }
}

test('옛 OWNER 사본 모양: 옛 seed.ts 매핑 그대로 — note 는 늘 null(파일에 있어도)·분류 N5 기초·수준 N5·조각 ?? null·빠진 선택 칸 null · create 가 실패했을 줄은 null', () => {
  assert.deepEqual(
    oldOwnerSeedCopy({ surface: '猫', reading: 'ねこ', meaning: '고양이', partOfSpeech: 'NOUN', chunkType: 'NAME', example: '猫。', exampleKo: '고양이.', note: '파일 메모', extra: 1 }),
    { surface: '猫', reading: 'ねこ', meaning: '고양이', partOfSpeech: 'NOUN', chunkType: 'NAME', jlpt: 'N5', example: '猫。', exampleKo: '고양이.', note: null, category: 'N5 기초', source: 'SEED' },
  )
  const sparse = oldOwnerSeedCopy({ surface: 'あ', meaning: '아', partOfSpeech: 'NOUN', chunkType: null })
  assert.deepEqual([sparse?.reading, sparse?.chunkType, sparse?.example, sparse?.exampleKo, sparse?.note], [null, null, null, null, null])
  const bad = [null, [], 'x', { surface: '猫', partOfSpeech: 'NOUN' }, { surface: 1, meaning: 'a', partOfSpeech: 'NOUN' }, { surface: '猫', meaning: 'a', partOfSpeech: 'NOUN', example: 3 }]
  for (const w of bad) assert.equal(oldOwnerSeedCopy(w), null)
  assert.throws(() => indexOldOwnerSeed({}), /not an array/)
  assert.deepEqual([EMPTY_OLD_SEED.rows, EMPTY_OLD_SEED.byKey.size, EMPTY_OLD_SEED.ambiguousKeys], [0, 0, 0])
})

test('판정 ①②③: 옛 시드 그대로(기본 단어와 다름) → 안 고침·삭제 허용 · 기본 단어 그대로 → 삭제 허용 · 둘 다와 다름(뜻·예문·메모) → edited·삭제 거절', () => {
  const B = [base('b1', '猫', 'ねこ'), base('b2', '犬', 'いぬ'), base('b3', '鳥', 'とり'), base('b4', '魚', 'さかな'), base('b5', '牛', 'うし')]
  const old = indexOldOwnerSeed([oldLine('猫', 'ねこ'), oldLine('鳥', 'とり'), oldLine('魚', 'さかな'), oldLine('牛', 'うし')])
  const oldOf = (s: string, r: string) => {
    const c = old.byKey.get(wordPairKey(s, r))
    assert.ok(c)
    return contentOf(c)
  }
  const m = matchSeedCopies(B, [
    copy('seed', '猫', 'ねこ', oldOf('猫', 'ねこ')), // ① 옛 시드 그대로
    copy('seedBlankNote', '猫', 'ねこ', { ...oldOf('猫', 'ねこ'), note: '  ' }), // ① 공백뿐인 메모 = 정보 없음
    copy('baseOnly', '犬', 'いぬ', contentOf(B[1])), // ② 옛 시드에 없는 단어, 기본 단어 그대로
    copy('baseOverSeed', '鳥', 'とり', contentOf(B[2])), // ② 옛 시드에 있지만 기본 단어 그대로
    copy('meaning', '魚', 'さかな', { ...oldOf('魚', 'さかな'), meaning: '내가 고친 뜻' }), // ③ 뜻
    copy('example', '牛', 'うし', { ...contentOf(B[4]), example: '自分の例。' }), // ③ 예문
    copy('noteOnSeed', '魚', 'さかな', { ...oldOf('魚', 'さかな'), note: '내 메모' }), // ③ 메모(옛 시드 내용 + 메모)
    copy('noteOnBase', '犬', 'いぬ', { ...contentOf(B[1]), note: '내 메모' }), // ③ 메모(기본 단어 내용 + 메모)
  ], new Map(), old)
  assert.deepEqual(verdict(m, 'seed'), { edited: false, seedOrigin: true, deletable: true })
  assert.deepEqual(pairIn(m, 'seed').diff, ['meaning', 'example', 'exampleKo'], '기본 단어와는 다르다(차이는 보고용으로 남김)')
  assert.deepEqual(verdict(m, 'seedBlankNote'), { edited: false, seedOrigin: true, deletable: true })
  assert.deepEqual(verdict(m, 'baseOnly'), { edited: false, seedOrigin: false, deletable: true })
  assert.deepEqual(verdict(m, 'baseOverSeed'), { edited: false, seedOrigin: false, deletable: true })
  for (const id of ['meaning', 'example', 'noteOnSeed', 'noteOnBase']) {
    assert.deepEqual(verdict(m, id), { edited: true, seedOrigin: false, deletable: false }, id)
    assert.deepEqual(deleteDecision(pairIn(m, id), 0), { ok: false, reason: 'edited' })
  }
  assert.deepEqual(pairIn(m, 'noteOnBase').diff, ['note'])
  assert.equal(verdict(matchSeedCopies(B, [copy('seed', '猫', 'ねこ', oldOf('猫', 'ねこ'))]), 'seed').edited, true, '(b) 기준이 없으면 (a) 만 — 막는 쪽')
})

test('판정 ④: 옛 파일에 같은 (표기, 읽기)가 두 줄(또는 같은 표기가 두 줄)이면 그 키는 (b) 를 쓰지 않고 (a) 만으로 판정', () => {
  const B = [base('b1', '猫', 'ねこ'), base('b2', '犬', 'いぬ'), base('b3', '犬', 'けん')]
  const lines = [
    oldLine('猫', 'ねこ', { meaning: '첫째 줄' }), oldLine('猫', 'ねこ', { meaning: '둘째 줄' }), // 같은 (표기, 읽기) 두 줄
    oldLine('犬', 'いぬ', { meaning: '개' }), oldLine('犬', 'けん', { meaning: '견' }), // 같은 표기, 다른 읽기 — 옛 코드는 표기만으로 건너뛰었다
  ]
  const idx = indexOldOwnerSeed(lines)
  assert.deepEqual([idx.rows, idx.byKey.size, idx.ambiguousKeys], [4, 0, 3])
  const shape = (i: number) => {
    const c = oldOwnerSeedCopy(lines[i])
    assert.ok(c)
    return contentOf(c)
  }
  const m = matchSeedCopies(B, [
    copy('first', '猫', 'ねこ', shape(0)), copy('second', '猫', 'ねこ', shape(1)), copy('inu', '犬', 'いぬ', shape(2)), copy('ken', '犬', 'けん', shape(3)),
    copy('base', '猫', 'ねこ', contentOf(B[0])),
  ], new Map(), idx)
  for (const id of ['first', 'second', 'inu', 'ken']) assert.deepEqual(verdict(m, id), { edited: true, seedOrigin: false, deletable: false }, id)
  assert.deepEqual(verdict(m, 'base'), { edited: false, seedOrigin: false, deletable: true }, '(a) 는 그대로 쓴다')
  const withOther = indexOldOwnerSeed([...lines, oldLine('鳥', 'とり')])
  assert.deepEqual([...withOther.byKey.keys()], [wordPairKey('鳥', 'とり')], '모호하지 않은 다른 표기는 (b) 를 그대로 쓴다')
})

// ── 실제 시드 JSON ──

const read = (...p: string[]) => JSON.parse(readFileSync(join(process.cwd(), 'prisma', 'seed-data', ...p), 'utf8')) as unknown
const legacyRaw = read('words-n5.json') as unknown[]
const basePlan = planBaseWords({
  packs: Object.fromEntries(SEED_PACKS.map((p) => [p, read('jlpt', `${p.toLowerCase()}.json`)])) as BaseWordSeedInput['packs'],
  legacy: legacyRaw,
  reclass: read('chunk-reclass.json'),
})
// 기본 단어 행에는 메모가 없다(시드 계획에 note 칸 없음 → DB null).
const realBase: BaseWordRow[] = basePlan.rows.map((r) => ({ id: r.seedKey, surface: r.surface, reading: r.reading, ...contentOf({ ...r, note: null }) }))
const oldCopies: SeedCopyRow[] = legacyRaw.map((w, i) => {
  const c = oldOwnerSeedCopy(w)
  assert.ok(c, `words-n5.json [${i}]`)
  return copy(`old${i}`, c.surface, c.reading, c)
})
const realIndex = indexOldOwnerSeed(legacyRaw)

test('⑤ 실제 JSON 회귀: 옛 시드 50행을 옛 seed.ts 모양 사본으로 만들어 실제 기본 단어 계획(7,757)과 대조 → 짝 50 · edited 0 · seed-origin 35(= PRE_MIGRATION_INFO) · 50 모두 삭제 허용', () => {
  assert.equal(basePlan.rows.length, 7757)
  assert.deepEqual([oldCopies.length, realIndex.rows, realIndex.byKey.size, realIndex.ambiguousKeys], [50, 50, 50, 0])
  const m = matchSeedCopies(realBase, oldCopies, new Map(), realIndex)
  assert.deepEqual([m.pairs.length, m.unmatched.length, m.duplicate.length, m.ambiguousBaseKeys], [50, 0, 0, 0])
  assert.deepEqual(m.pairs.filter(isEditedCopy).map((p) => p.copyId), [])
  const differs = m.pairs.filter((p) => p.diff.length > 0)
  assert.equal(differs.length, 35, '기본 단어와 내용이 다른 옛 OWNER 사본')
  assert.ok(differs.every((p) => p.seedOrigin))
  assert.equal(m.pairs.filter((p) => p.seedOrigin).length, PRE_MIGRATION_INFO.seedOrigin, 'plan 의 대조 추정치가 실제 JSON 과 맞다')
  assert.ok(m.pairs.every((p) => deleteDecision(p, 0).ok))
  const without = matchSeedCopies(realBase, oldCopies, new Map(), EMPTY_OLD_SEED)
  assert.equal(without.pairs.filter(isEditedCopy).length, 35, '(b) 없는 직전 판정 = 이번에 발견한 문제')
})

test('⑥ 그 상태에서 사용자가 뜻 한 칸만 고치면 정확히 그 사본만 edited — seed-origin 사본·기본 단어와 같은 사본 둘 다', () => {
  const first = matchSeedCopies(realBase, oldCopies, new Map(), realIndex)
  const seedOriginId = first.pairs.find((p) => p.seedOrigin)?.copyId
  const sameAsBaseId = first.pairs.find((p) => p.diff.length === 0)?.copyId
  assert.ok(seedOriginId && sameAsBaseId)
  for (const target of [seedOriginId, sameAsBaseId]) {
    const changed = oldCopies.map((c) => (c.id === target ? { ...c, meaning: `${c.meaning}(내 뜻)` } : c))
    const m = matchSeedCopies(realBase, changed, new Map(), realIndex)
    assert.deepEqual(m.pairs.filter(isEditedCopy).map((p) => p.copyId), [target])
    assert.deepEqual(deleteDecision(pairIn(m, target), 0), { ok: false, reason: 'edited' })
    assert.equal(m.pairs.filter((p) => deleteDecision(p, 0).ok).length, 49)
  }
})
