import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diffCodepoints, type DiffSeg } from '../diff'

const join = (s: DiffSeg[]) => s.map((x) => x.text).join('')

test('diff: 조각을 이어 붙이면 원문·교정문과 정확히 같다(원문 무수정)', () => {
  const cases: Array<[string, string]> = [
    ['昨日映画を見に行くました', '昨日映画を見に行きました'],
    ['今日は😀楽しかった🎉', '今日は😀楽しかったです🎉'],
    ['', 'あ'],
    ['あいう', ''],
    ['  前後の空白  \n改行', '前後の空白\n改行'],
    ['同じ', '同じ'],
  ]
  for (const [a, b] of cases) {
    const r = diffCodepoints(a, b)
    assert.ok(r, `${a} → ${b}`)
    assert.equal(join(r.a), a)
    assert.equal(join(r.b), b)
  }
})

test('diff: 바뀐 글자만 changed 로 표시한다', () => {
  const r = diffCodepoints('見に行くました', '見に行きました')
  assert.ok(r)
  assert.deepEqual(r.a.filter((s) => s.changed).map((s) => s.text), ['く'])
  assert.deepEqual(r.b.filter((s) => s.changed).map((s) => s.text), ['き'])
})

test('diff: 이모지(서로게이트 쌍)를 반으로 가르지 않는다', () => {
  const r = diffCodepoints('😀A', '😃A')
  assert.ok(r)
  assert.deepEqual(r.a, [{ text: '😀', changed: true }, { text: 'A', changed: false }])
  assert.deepEqual(r.b, [{ text: '😃', changed: true }, { text: 'A', changed: false }])
})

test('diff: 같은 문장은 changed 가 없다', () => {
  const r = diffCodepoints('おはよう', 'おはよう')
  assert.ok(r)
  assert.equal(r.a.some((s) => s.changed), false)
})

test('diff: 상한(코드포인트)을 넘으면 null — 강조 없이 원문 그대로 보여 준다', () => {
  const long = '😀'.repeat(201)
  assert.equal(diffCodepoints(long, 'a'), null)
  assert.ok(diffCodepoints('😀'.repeat(200), 'a'), '200 코드포인트(400 UTF-16)는 허용')
})
