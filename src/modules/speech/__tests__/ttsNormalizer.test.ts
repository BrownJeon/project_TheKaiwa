import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeJapanese } from '../tts/normalizer'
import { integerToKanji, numberToKanji } from '../tts/numbers'
import { splitSentences } from '../tts/sentences'
import { NORMALIZER_GOLDEN } from './fixtures/normalizerGolden'

test('정규화 골든셋 — 숫자·날짜·시간·단위·조수사·기호·약어(완료 기준 4, 20건 이상)', () => {
  assert.ok(NORMALIZER_GOLDEN.length >= 20)
  const failed: string[] = []
  for (const g of NORMALIZER_GOLDEN) {
    const out = normalizeJapanese(g.text).normalizedText
    if (out !== g.normalized) failed.push(`${g.id}: ${out} ≠ ${g.normalized}`)
  }
  assert.deepEqual(failed, [])
})

test('한자 숫자: 万·億 단위, 1 생략 규칙, 0 과 앞자리 0', () => {
  assert.equal(integerToKanji('10000'), '一万')
  assert.equal(integerToKanji('100000000'), '一億')
  assert.equal(integerToKanji('1111'), '千百十一')
  assert.equal(integerToKanji('20050'), '二万五十')
  assert.equal(integerToKanji('0'), 'ゼロ')
  assert.equal(integerToKanji('090'), 'ゼロキューゼロ')
  assert.equal(numberToKanji('3.05'), '三点ゼロ五')
  assert.equal(numberToKanji('-12'), 'マイナス十二')
})

test('token map 은 원문 좌표 — 치환 구간을 원문으로 되돌릴 수 있다', () => {
  const text = '9:30に5km'
  const r = normalizeJapanese(text)
  for (const t of r.tokens) assert.equal(text.slice(t.srcStart, t.srcEnd), t.surface)
  assert.deepEqual(
    r.tokens.map((t) => t.rule),
    ['TIME', 'UNIT'],
  )
  assert.equal(r.rulesApplied, 2)
})

test('사전 보호 구간은 정규화가 건드리지 않는다(§3.2 ①)', () => {
  const text = '7-Eleven で3個'
  const r = normalizeJapanese(text, { protect: [{ start: 0, end: 8 }] })
  assert.ok(r.normalizedText.startsWith('7-Eleven'))
  assert.ok(r.normalizedText.endsWith('三個'))
})

test('영숫자 사이 공백·알 수 없는 영문은 유지, 이모지·장식 기호는 제거', () => {
  assert.equal(normalizeJapanese('Hello world').normalizedText, 'Hello world')
  assert.equal(normalizeJapanese('★今日は♪晴れ').normalizedText, '今日は晴れ')
  assert.equal(normalizeJapanese('iPhone15').normalizedText, 'アイフォーン15')
})

test('문장 감지 — 。！？ 기준, 긴 문장은 、 에서, 4자 미만은 앞에 붙인다', () => {
  const p = splitSentences('そうですね。昨日は何をしましたか？はい。', { maxChars: 100 })
  assert.deepEqual(
    p.map((x) => x.text),
    ['そうですね。', '昨日は何をしましたか？はい。'],
  )
  const long = 'あ'.repeat(60) + '、' + 'い'.repeat(60) + '。'
  const q = splitSentences(long, { maxChars: 100 })
  assert.equal(q.length, 2)
  assert.ok(q.every((x) => [...x.text].length <= 100))
  const r = splitSentences('こんにちは、元気ですか。', { maxChars: 100, splitAtComma: true })
  assert.deepEqual(
    r.map((x) => x.text),
    ['こんにちは、', '元気ですか。'],
  )
  // 조각 좌표로 원문을 다시 만들 수 있다
  const s = '「そうです。」と言った。'
  assert.equal(
    splitSentences(s, { maxChars: 100 })
      .map((x) => s.slice(x.start, x.end))
      .join(''),
    s,
  )
})
