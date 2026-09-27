import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '@/modules/infra'
import { emptyDaily, mergeDaily } from '../snapshots'
import { parseWordInput } from '../vocab/words'
import { errorPatternFor } from '../learningHistory'

const code = (c: string) => (e: unknown) => e instanceof ApiError && e.code === c

test('DAILY 병합: 빈 행에서 시작해 증가만, 모르는 키 보존, 음수 증가 무시', () => {
  const a = mergeDaily(emptyDaily(), { chatTurns: 5, corrections: { proposed: 3 } })
  assert.equal(a.chatTurns, 5)
  assert.deepEqual(a.corrections, { proposed: 3, accepted: 0 })
  const b = mergeDaily(a, { corrections: { accepted: 1 }, chatTurns: -10 })
  assert.equal(b.chatTurns, 5, '감소 없음')
  assert.deepEqual(b.corrections, { proposed: 3, accepted: 1 })
  const c = mergeDaily({ attended: true, future: { x: 1 }, words: { sessions: 2 } }, { words: { correct: 4 } })
  assert.equal(c.attended, true)
  assert.deepEqual(c.future, { x: 1 })
  assert.deepEqual(c.words, { sessions: 2, correct: 4, wrong: 0 })
  assert.deepEqual(mergeDaily(null, {}), emptyDaily(), '형태가 어긋난 값도 기본 형태로')
})

test('단어 입력(#41 한도, 코드포인트): surface 1~80·meaning 1~200·reading ≤120·category ≤40, 모르는 키 400', () => {
  const ok = parseWordInput({ surface: ' 行きました ', meaning: '갔습니다', partOfSpeech: 'EXPRESSION', chunkType: 'ACTION', category: '교정' })
  assert.equal(ok.surface, '行きました')
  assert.equal(ok.reading, null)
  assert.equal(parseWordInput({ surface: '😀'.repeat(80), meaning: 'm' }).surface.length, 160, '이모지 80개 = 80 코드포인트 통과')
  assert.throws(() => parseWordInput({ surface: 'あ'.repeat(81), meaning: 'm' }), code('VALIDATION'))
  assert.throws(() => parseWordInput({ surface: 'a', meaning: '' }), code('VALIDATION'))
  assert.throws(() => parseWordInput({ surface: 'a', meaning: 'm', category: 'c'.repeat(41) }), code('VALIDATION'))
  assert.throws(() => parseWordInput({ surface: 'a', meaning: 'm', source: 'TUTOR' }), code('VALIDATION'))
  assert.throws(() => parseWordInput({ surface: 'a', meaning: 'm', partOfSpeech: 'VERBY' }), code('VALIDATION'))
  try {
    parseWordInput({ surface: '', meaning: 'm' }, 'addWord.')
    assert.fail('던져야 한다')
  } catch (e) {
    assert.deepEqual((e as ApiError).details, { field: 'addWord.surface', reason: 'required' })
  }
})

test('오류 통계 패턴: 조각 유형 → chunk:<유형>, 없으면 general', () => {
  assert.equal(errorPatternFor('ACTION'), 'chunk:ACTION')
  assert.equal(errorPatternFor(null), 'general')
})
