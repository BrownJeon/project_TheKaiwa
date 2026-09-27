import { test } from 'node:test'
import assert from 'node:assert/strict'
import { completeChunkTexts, hasMoreAfter, sentenceSpans, visiblePrefix, type AudioChunkView } from '../revealChunks'

const c = (chunkIndex: number, text: string, last = false, status: 'OK' | 'FAILED' = 'OK'): AudioChunkView => ({ chunkIndex, text, last, status })

test('드러내기: 0 부터 이어진 앞부분만(순서 뒤바뀜·빈틈)', () => {
  assert.deepEqual(visiblePrefix([]), [])
  assert.deepEqual(visiblePrefix([c(1, 'B')]), [], '0 이 없으면 아무것도 안 드러냄')
  assert.deepEqual(visiblePrefix([c(1, 'B'), c(0, 'A')]).map((x) => x.text), ['A', 'B'])
  assert.deepEqual(visiblePrefix([c(0, 'A'), c(2, 'C')]).map((x) => x.text), ['A'], '1 이 빠지면 2 는 기다린다')
  assert.deepEqual(visiblePrefix([c(0, 'A'), c(0, 'A2'), c(1, 'B')]).map((x) => x.text), ['A', 'B'], '같은 index 는 먼저 온 것')
})

test('드러내기: FAILED 청크도 글자는 드러낸다', () => {
  assert.deepEqual(visiblePrefix([c(0, 'A', false, 'FAILED'), c(1, 'B', true)]).map((x) => x.text), ['A', 'B'])
})

test('드러내기: 뒤따를 문장 표시(…)는 마지막 청크 전까지', () => {
  assert.equal(hasMoreAfter([]), true)
  assert.equal(hasMoreAfter([c(0, 'A')]), true)
  assert.equal(hasMoreAfter([c(0, 'A'), c(1, 'B', true)]), false)
})

test('문장 나눔: 조각을 이은 것이 본문과 정확히 같을 때만', () => {
  assert.deepEqual(sentenceSpans('そうですね。何を見ましたか？', ['そうですね。', '何を見ましたか？']), ['そうですね。', '何を見ましたか？'])
  assert.equal(sentenceSpans('そうですね。何を見ましたか？', ['そうですね。', '何を見たの？']), null, '재시도로 본문이 바뀌면 통째로')
  assert.equal(sentenceSpans('あ', []), null)
  assert.equal(sentenceSpans('あ', null), null)
})

test('완료 조각: 0..last 가 다 있어야', () => {
  assert.deepEqual(completeChunkTexts([c(1, 'B', true), c(0, 'A')]), ['A', 'B'])
  assert.equal(completeChunkTexts([c(0, 'A'), c(2, 'C', true)]), null)
  assert.equal(completeChunkTexts([c(0, 'A')]), null, 'last 가 없으면 아직')
})

test('완료 조각: 턴이 끝났으면(done) last 표시 없이도 0..max 가 이어져 있으면 완전(조기 합성 문장)', () => {
  assert.deepEqual(completeChunkTexts([c(0, 'A'), c(1, 'B')], true), ['A', 'B'])
  assert.equal(completeChunkTexts([c(0, 'A'), c(2, 'C')], true), null, '빈틈이 있으면 아님')
  assert.equal(completeChunkTexts([], true), null)
})
