import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  actionErrorText,
  enrichErrorText,
  FLASH,
  HINT,
  homeLoadErrorText,
  listErrorText,
  POS_LABEL,
  resultBand,
  seedResultText,
  SOURCE_BADGE,
  startErrorText,
} from '../labels'

const LEAK = /claude|haiku|sonnet|opus|qwen|엔진|모델|trace|Phase|task-/i

test('오류 문구: 400 만 서버 문구, 나머지는 화면 표 문구(서버 문구의 구현 용어가 새지 않는다)', () => {
  const serverMsg = 'AI 엔진을 지금 사용할 수 없습니다 (traceId t_abc)'
  for (const fn of [actionErrorText, startErrorText, (e: { status: number; message?: string }) => enrichErrorText(e, 7)]) {
    assert.equal(fn({ status: 400, message: '표현은 80자까지' }), '표현은 80자까지')
    for (const status of [0, 404, 409, 422, 429, 502, 504, 500, -1]) {
      const text = fn({ status, message: serverMsg })
      assert.doesNotMatch(text, LEAK, `status=${status}`)
      assert.notEqual(text, serverMsg)
    }
  }
  for (const status of [0, 400, 422, 502, 504]) {
    assert.doesNotMatch(listErrorText({ status, message: serverMsg }), LEAK)
    assert.doesNotMatch(homeLoadErrorText({ status, message: serverMsg }), LEAK)
  }
  assert.match(enrichErrorText({ status: 429 }, 7), /7초/)
  assert.match(enrichErrorText({ status: 422 }), /직접 입력/)
})

test('고정 문구·라벨에 구현 용어 없음', () => {
  const all = [...Object.values(HINT), ...Object.values(FLASH), ...Object.values(POS_LABEL), ...Object.values(SOURCE_BADGE).filter(Boolean)]
  for (const t of all) assert.doesNotMatch(String(t), LEAK)
})

test('seedResultText: 넣음·건너뜀·이미 모두 있음', () => {
  assert.equal(seedResultText({ added: 50, skipped: 0 }), '기본 단어 50개를 넣었어요')
  assert.equal(seedResultText({ added: 47, skipped: 3 }), '기본 단어 47개를 넣었어요 · 이미 있는 3개는 건너뛰었어요')
  assert.equal(seedResultText({ added: 0, skipped: 50 }), '기본 단어가 이미 모두 들어 있어요')
})

test('resultBand: CHOICE 맞았어요/틀렸어요 · FLIP 알았어요/몰랐어요 · 건너뜀은 중립', () => {
  assert.deepEqual(resultBand('CORRECT', 'CHOICE'), { text: '✓ 맞았어요', tone: 'good' })
  assert.deepEqual(resultBand('WRONG', 'CHOICE'), { text: '✗ 틀렸어요', tone: 'bad' })
  assert.deepEqual(resultBand('CORRECT', 'FLIP'), { text: '✓ 알았어요', tone: 'good' })
  assert.deepEqual(resultBand('WRONG', 'FLIP'), { text: '✗ 몰랐어요', tone: 'bad' })
  assert.deepEqual(resultBand('SKIPPED', 'FLIP'), { text: '건너뛴 카드', tone: 'neutral' })
})
