import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createJsonPathStreamReader } from '../json/jsonPathStream'

function run(doc: string, chunkSize: number) {
  const chunks: string[] = []
  const done: string[] = []
  let style: string | null = null
  const r = createJsonPathStreamReader([
    { path: ['conversation', 'replyJa'], onChunk: (t) => chunks.push(t), onComplete: (v) => done.push(v) },
    { path: ['speech', 'style'], onComplete: (v) => (style = v) },
  ])
  for (let i = 0; i < doc.length; i += chunkSize) r.push(doc.slice(i, i + chunkSize))
  return { text: chunks.join(''), done, style, failed: r.failed, finished: r.finished }
}

const speechFirst =
  '```json\n{"speech":{"style":"CALM"},"conversation":{"replyJa":"そうですね。どんな映画を見ましたか？","replyReading":"そうですね。","replyKo":"그렇군요."},"correction":null,"learning":{"grammarPoint":null,"difficulty":"N5"},"endOfTopic":false,"proposals":[]}\n```'

test('JSON 경로 리더: 코드펜스 앞 글자를 건너뛰고 conversation.replyJa 만 조각으로 흘린다(조각 크기 무관)', () => {
  for (const size of [1, 2, 3, 7, 50, 1000]) {
    const r = run(speechFirst, size)
    assert.equal(r.text, 'そうですね。どんな映画を見ましたか？', `size=${size}`)
    assert.deepEqual(r.done, ['そうですね。どんな映画を見ましたか？'])
    assert.equal(r.style, 'CALM')
    assert.equal(r.failed, false)
    assert.equal(r.finished, true)
  }
})

test('JSON 경로 리더: 키 순서와 무관(conversation 이 먼저여도), 이스케이프·서로게이트 쌍을 풀어 낸다', () => {
  const doc = '{"conversation":{"replyKo":"x","replyJa":"a\\"b\\\\c\\n\\u3042\\ud83d\\ude00。"},"speech":{"style":"CHEERFUL"}}'
  const r = run(doc, 1)
  assert.equal(r.text, 'a"b\\c\nあ😀。')
  assert.equal(r.style, 'CHEERFUL')
  assert.equal(r.failed, false)
})

test('JSON 경로 리더: 다른 문자열 안의 "replyJa" 흉내·다른 경로의 같은 키·배열 안 객체는 무시한다', () => {
  const doc =
    '{"learning":{"grammarPoint":"\\"conversation\\":{\\"replyJa\\":\\"偽物\\"}"},"x":{"conversation":{"replyJa":"偽2"}},"proposals":[{"conversation":{"replyJa":"偽3"}}],"conversation":{"replyJa":"本物。"}}'
  const r = run(doc, 3)
  assert.equal(r.text, '本物。')
  assert.deepEqual(r.done, ['本物。'])
})

test('JSON 경로 리더: 문법 오류면 failed 로 멈추고 이후 조각을 흘리지 않는다', () => {
  const chunks: string[] = []
  const r = createJsonPathStreamReader([{ path: ['conversation', 'replyJa'], onChunk: (t) => chunks.push(t) }])
  r.push('{"conversation":{"replyJa":"あい')
  r.push('う"} "oops": 1}')
  assert.equal(r.failed, true)
  r.push('{"conversation":{"replyJa":"もっと"}}')
  assert.equal(chunks.join(''), 'あいう')
})

test('JSON 경로 리더: 숫자·true/false/null 리터럴과 빈 객체·배열을 지나간다', () => {
  const doc = '{"a":1.5e3,"b":[true,false,null,{}],"c":{},"conversation":{"n":-2,"replyJa":"はい。"}}'
  const r = run(doc, 4)
  assert.equal(r.text, 'はい。')
  assert.equal(r.failed, false)
})
