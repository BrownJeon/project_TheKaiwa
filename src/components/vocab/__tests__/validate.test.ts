import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { WordEntry } from '@/types/vocab'
import {
  categoryTotals,
  diffPatch,
  emptyForm,
  emptyVariant,
  fieldOf,
  firstErrorField,
  formFromDraft,
  formFromWord,
  normalizeCategories,
  normalizeWordDetail,
  toCreateBody,
  validateWord,
  visibleCategories,
} from '../validate'

const word: WordEntry = {
  id: 'w_1',
  surface: '映画',
  reading: 'えいが',
  meaning: '영화',
  partOfSpeech: 'NOUN',
  jlpt: 'N5',
  example: '昨日映画を見ました。',
  exampleKo: null,
  note: null,
  category: '일상',
  source: 'CORRECTION',
  correctCount: 3,
  wrongCount: 1,
  archived: false,
}

test('validateWord: 필수·코드포인트 한도(이모지는 1자)', () => {
  const ok = { ...emptyForm('映画'), meaning: '영화' }
  assert.deepEqual(validateWord(ok), {})
  assert.equal(validateWord(emptyForm('')).surface, '표현을 적어 주세요')
  assert.equal(validateWord({ ...ok, meaning: '   ' }).meaning, '뜻을 적어 주세요')
  assert.deepEqual(validateWord({ ...ok, surface: '😀'.repeat(80) }), {}, '이모지 80개 = 80자')
  assert.equal(validateWord({ ...ok, surface: 'あ'.repeat(81) }).surface, '표현은 80자까지 쓸 수 있어요')
  assert.equal(validateWord({ ...ok, reading: 'あ'.repeat(121) }).reading, '읽기는 120자까지 쓸 수 있어요')
  assert.equal(validateWord({ ...ok, category: 'x'.repeat(41) }).category, '분류는 40자까지 쓸 수 있어요')
  assert.equal(validateWord({ ...ok, note: 'x'.repeat(501) }).note, '메모는 500자까지 쓸 수 있어요')
  assert.equal(validateWord({ ...ok, example: 'x'.repeat(2001) }).example, '예문은 2,000자까지 쓸 수 있어요')
  assert.equal(firstErrorField({ note: 'x', meaning: 'y' }), 'meaning', '화면 위쪽 필드가 먼저')
})

test('toCreateBody: 빈 선택값은 보내지 않고 enrich 도 없다', () => {
  const body = toCreateBody({ ...emptyForm(' 映画 '), meaning: ' 영화 ', category: '  ' })
  assert.deepEqual(body, { surface: '映画', meaning: '영화', partOfSpeech: 'OTHER' })
  const full = toCreateBody({ ...formFromWord(word), note: '메모' })
  assert.equal(full.jlpt, 'N5')
  assert.equal(full.note, '메모')
  assert.equal('enrich' in full, false)
})

test('diffPatch: 바뀐 필드만, 비운 선택값은 null, 카운터·source 는 나오지 않는다', () => {
  assert.deepEqual(diffPatch(word, formFromWord(word)), {})
  const edited = { ...formFromWord(word), reading: '', meaning: '영화(무비)', jlpt: '' as const, exampleKo: '어제 영화를 봤어요.' }
  assert.deepEqual(diffPatch(word, edited), { meaning: '영화(무비)', jlpt: null, reading: null, exampleKo: '어제 영화를 봤어요.' })
  const keys = Object.keys(diffPatch(word, { ...formFromWord(word), surface: '映画館' }))
  assert.deepEqual(keys, ['surface'])
  for (const k of ['correctCount', 'wrongCount', 'source', 'archived']) assert.equal(k in diffPatch(word, edited), false)
})

test('formFromDraft: 표현은 사용자가 쓴 그대로, null 은 빈 문자열', () => {
  const f = formFromDraft('食べる', { valid: true, reading: 'たべる', meaning: '먹다', partOfSpeech: 'VERB', jlpt: null, example: null }, '일상')
  assert.equal(f.surface, '食べる')
  assert.equal(f.jlpt, '')
  assert.equal(f.example, '')
  assert.equal(f.category, '일상')
  assert.equal(f.partOfSpeech, 'VERB')
})

test('fieldOf: details.field 의 마지막 조각', () => {
  assert.equal(fieldOf('word.meaning'), 'meaning')
  assert.equal(fieldOf('surface'), 'surface')
  assert.equal(fieldOf('count'), null)
  assert.equal(fieldOf(null), null)
})

test('normalizeWordDetail: 평평한 응답·감싼 응답 둘 다', () => {
  const flat = normalizeWordDetail({ ...word, stats: { attempts: 4, last7d: { correct: 1, wrong: 0 }, evalAppearances: 0 }, corrections: [{ id: 'cr_1', chatId: 'c_1' }] })
  assert.equal(flat.word.surface, '映画')
  assert.equal(flat.stats?.attempts, 4)
  assert.deepEqual(flat.corrections, [{ id: 'cr_1', chatId: 'c_1' }])
  assert.equal('stats' in flat.word, false)
  const nested = normalizeWordDetail({ word, stats: null, corrections: [{ id: 1 }] })
  assert.equal(nested.word.id, 'w_1')
  assert.equal(nested.stats, null)
  assert.deepEqual(nested.corrections, [])
})

test('분류: 칩·합계·빈 상태 변형', () => {
  const cats = normalizeCategories([
    { category: '일상', count: 32, archivedCount: 2 },
    { category: 'N5 기초', count: 0, archivedCount: 3 },
    { category: null, count: 5 },
  ])
  assert.deepEqual(visibleCategories(cats, 'active'), [{ category: '일상', n: 32 }])
  assert.deepEqual(visibleCategories(cats, 'archived'), [
    { category: '일상', n: 2 },
    { category: 'N5 기초', n: 3 },
  ])
  assert.deepEqual(categoryTotals(cats), { active: 37, archived: 5 })
  assert.deepEqual(normalizeCategories({ items: [{ category: 'a', count: 1 }] }), [{ category: 'a', count: 1 }])

  const q = { q: '', category: null, archived: false }
  assert.equal(emptyVariant({ ...q, q: '映画' }, null), 'noSearch')
  assert.equal(emptyVariant({ ...q, category: '일상' }, null), 'noCategory')
  assert.equal(emptyVariant({ ...q, archived: true }, null), 'noArchived')
  assert.equal(emptyVariant(q, { active: 0, archived: 2 }), 'allArchived')
  assert.equal(emptyVariant(q, { active: 0, archived: 0 }), 'noWords')
  assert.equal(emptyVariant(q, null), 'noWords')
})
