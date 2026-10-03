import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  actionErrorText,
  CHUNK_FILTER_ALL,
  CHUNK_FILTER_CHIPS,
  CHUNK_LABEL,
  chunkEmptyText,
  chunkFilterName,
  enrichErrorText,
  FLASH,
  HINT,
  homeLoadErrorText,
  listConditionText,
  listErrorText,
  POS_LABEL,
  resultBand,
  seedResultText,
  SOURCE_SENTENCE,
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
  const all = [
    ...Object.values(HINT),
    ...Object.values(FLASH),
    ...Object.values(POS_LABEL),
    ...Object.values(SOURCE_SENTENCE),
    ...Object.values(CHUNK_LABEL),
    ...CHUNK_FILTER_CHIPS.flatMap((c) => [c.label, c.sr]),
  ]
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

test('조각 줄(task-023): 전체·이름·액션·느낌·꾸밈·없음 순, 칩 글자 짧게 + 화면 읽기 "○○ 조각"', () => {
  assert.equal(CHUNK_FILTER_ALL.label, '전체')
  assert.deepEqual(
    CHUNK_FILTER_CHIPS.map((c) => c.value),
    ['NAME', 'ACTION', 'FEELING', 'MODIFIER', 'none'],
  )
  assert.deepEqual(
    CHUNK_FILTER_CHIPS.map((c) => c.label),
    ['이름', '액션', '느낌', '꾸밈', '없음'],
  )
  for (const c of CHUNK_FILTER_CHIPS.filter((x) => x.value !== 'none')) assert.equal(`${c.label}${c.sr}`, CHUNK_LABEL[c.value as 'NAME'])
  assert.equal(chunkFilterName('FEELING'), '느낌 조각')
  assert.equal(chunkFilterName('none'), '조각 없음')
})

test('목록 머리 조건 · 조각 결과 0 문구(데모 v1 list-and·list-empty·list-search-empty)', () => {
  assert.equal(listConditionText({ category: null, chunk: null }), null)
  assert.equal(listConditionText({ category: 'N5 기초', chunk: 'FEELING' }), 'N5 기초 · 느낌 조각')
  assert.equal(listConditionText({ category: null, chunk: 'none' }), '조각 없음')
  assert.equal(listConditionText({ category: '일상' }), '일상')
  assert.deepEqual(chunkEmptyText({ q: '', category: '일상', chunk: 'ACTION', archived: false }), {
    title: '‘일상’에 액션 조각 단어가 없어요',
    body: '분류와 조각을 함께 고르면 둘 다 맞는 단어만 보여요.',
  })
  assert.deepEqual(chunkEmptyText({ q: '', category: null, chunk: 'ACTION', archived: false }), { title: '액션 조각 단어가 없어요', body: null })
  assert.deepEqual(chunkEmptyText({ q: '', category: null, chunk: 'NAME', archived: true }), { title: '보관한 단어 중 이름 조각 단어가 없어요', body: null })
  assert.deepEqual(chunkEmptyText({ q: '映', category: null, chunk: 'ACTION', archived: false }), { title: null, body: '액션 조각 안에서 찾았어요.' })
  assert.deepEqual(chunkEmptyText({ q: '映', category: '교정', chunk: 'ACTION', archived: false }), { title: null, body: '액션 조각 · 교정 안에서 찾았어요.' })
})
