import { test } from 'node:test'
import assert from 'node:assert/strict'
import { arriveShare, charCount, normalizeShared, PASTE_MAX, swapShare, trimRemoved, trimToLimit } from '../pasteShare'
import { PASTE_SHARE, PASTE_TRIM } from '../lessonCopy'

const SHARE = '★ 오늘의 표현 — 허락 구하기\n写真を撮ってもいいですか。\nここに座ってもいいですか。'
const DRAFT = '駅までの道を教えてください。\nまっすぐ行って、二つ目の角を右に曲がってください。'

test('normalizeShared — \\r\\n·\\r 를 \\n 로, 앞뒤 공백만 정리', () => {
  assert.equal(normalizeShared('  あ\r\nい\rう\n  '), 'あ\nい\nう')
  assert.equal(normalizeShared('　\n\t '), '')
  assert.equal(normalizeShared('あ  い'), 'あ  い')
})

test('arriveShare — 빈 입력칸이면 채우고 arrived 띠', () => {
  assert.deepEqual(arriveShare('', SHARE), { kind: 'fill', text: SHARE, alt: null, banner: { kind: 'arrived' } })
})

test('arriveShare — 같은 글이면 쓰던 글로 치지 않는다', () => {
  assert.deepEqual(arriveShare(SHARE, `  ${SHARE}\r\n`), { kind: 'fill', text: SHARE, alt: null, banner: { kind: 'arrived' } })
})

test('arriveShare — 쓰던 글이 있으면 바꾸고 쓰던 글은 alt 로(글자 수 = 쓰던 글)', () => {
  const r = arriveShare(DRAFT, SHARE)
  assert.deepEqual(r, { kind: 'fill', text: SHARE, alt: DRAFT, banner: { kind: 'replaced', n: charCount(DRAFT) } })
})

test('arriveShare — 빈 공유(공백뿐 포함)는 아무것도 바꾸지 않음', () => {
  assert.deepEqual(arriveShare(DRAFT, ''), { kind: 'empty' })
  assert.deepEqual(arriveShare(DRAFT, ' \r\n　 '), { kind: 'empty' })
  assert.deepEqual(arriveShare('', ''), { kind: 'empty' })
})

test('swapShare — 되돌리기·다시 넣기를 오가도 잃는 글 없음, n = 빠지는 쪽 길이', () => {
  const a = swapShare(SHARE, DRAFT, { kind: 'replaced' })
  assert.deepEqual(a, { text: DRAFT, alt: SHARE, banner: { kind: 'restored', n: charCount(SHARE) } })
  const b = swapShare(a.text, a.alt, a.banner)
  assert.deepEqual(b, { text: SHARE, alt: DRAFT, banner: { kind: 'replaced', n: charCount(DRAFT) } })
})

test('charCount — 서로게이트 쌍을 1자로', () => {
  assert.equal(charCount('😀あ'), 2)
  assert.equal('😀あ'.length, 3)
})

test('trimToLimit — 2,000자 이하는 그대로(끝 공백도 건드리지 않음)', () => {
  const s = 'あ'.repeat(PASTE_MAX - 1) + ' '
  assert.equal(trimToLimit(s), s)
  assert.equal(trimToLimit(''), '')
  assert.equal(trimRemoved(s), 0)
})

test('trimToLimit — 문장 끝(。)에서 자른다', () => {
  const head = 'あ'.repeat(1899) + '。' // 1,900자, 마지막이 문장 끝
  const s = head + 'い'.repeat(300)
  assert.equal(trimToLimit(s), head)
  assert.equal(trimRemoved(s), 300)
})

test('trimToLimit — 마지막 문장 끝을 고른다(！？!? 줄바꿈 포함)', () => {
  for (const end of ['！', '？', '!', '?']) {
    const s = 'あ'.repeat(1700) + '。' + 'い'.repeat(200) + end + 'う'.repeat(500)
    const out = trimToLimit(s)
    assert.equal(charCount(out), 1902, end)
    assert.ok(out.endsWith(end), end)
  }
  const nl = 'あ'.repeat(1800) + '\n' + 'い'.repeat(500)
  assert.equal(trimToLimit(nl), 'あ'.repeat(1800)) // 줄바꿈에서 자르고 끝 줄바꿈 제거
})

test('trimToLimit — 끝 400자 안에 문장 끝이 없으면 2,000자에서', () => {
  const s = 'あ'.repeat(1599) + '。' + 'い'.repeat(1000) // 문장 끝이 1,600번째 = 400자 범위 밖
  const out = trimToLimit(s)
  assert.equal(charCount(out), PASTE_MAX)
  assert.equal(trimRemoved(s), 600)
  const edge = 'あ'.repeat(1600) + '。' + 'い'.repeat(1000) // 1,601번째(인덱스 1600) = 범위 안 마지막 칸
  assert.equal(trimToLimit(edge), 'あ'.repeat(1600) + '。')
})

test('trimToLimit — 자른 끝의 공백·줄바꿈 제거', () => {
  const s = 'あ'.repeat(1990) + '   \n  ' + 'い'.repeat(100)
  const out = trimToLimit(s)
  assert.equal(out, 'あ'.repeat(1990))
})

test('trimToLimit — 이모지(서로게이트 쌍)를 1자로 세고 반쪽을 남기지 않는다', () => {
  const s = '😀'.repeat(2100)
  const out = trimToLimit(s)
  assert.equal(charCount(out), PASTE_MAX)
  assert.equal(out, '😀'.repeat(PASTE_MAX))
  assert.equal(trimRemoved(s), 100)
})

test('trimToLimit — 결과는 언제나 2,000자 이하', () => {
  const samples = [
    'あ'.repeat(10_000),
    ('今日は練習しましょう。\n').repeat(400),
    '😀あ。'.repeat(1500),
    'x'.repeat(2001),
    ' '.repeat(3000) + 'あ',
  ]
  for (const s of samples) assert.ok(charCount(trimToLimit(s)) <= PASTE_MAX)
})

test('문구 — 데모 v1 SH 와 한 글자도 다르지 않다', () => {
  assert.equal(PASTE_SHARE.arrivedTitle, '공유한 글을 넣어 두었어요')
  assert.equal(PASTE_SHARE.arrivedBody, '아직 아무 데도 보내지 않았어요. 확인하고 수업을 만들어 보세요.')
  assert.equal(PASTE_SHARE.replacedTitle, '공유한 글로 바꿔 넣었어요')
  assert.equal(PASTE_SHARE.replacedBody(1234), '쓰던 글(1,234자)은 이 화면에 있는 동안 되돌릴 수 있어요.')
  assert.equal(PASTE_SHARE.replacedAction, '쓰던 글로 되돌리기')
  assert.equal(PASTE_SHARE.restoredTitle, '쓰던 글로 되돌렸어요')
  assert.equal(PASTE_SHARE.restoredBody(98), '공유한 글(98자)을 다시 넣을 수 있어요.')
  assert.equal(PASTE_SHARE.restoredAction, '공유한 글 다시 넣기')
  assert.equal(PASTE_SHARE.lost, '공유한 글을 받지 못했어요. 다시 공유해 주세요.')
  assert.equal(PASTE_SHARE.empty, '공유한 내용에 글이 없어요. 글을 골라 공유해 주세요.')
  assert.equal(PASTE_TRIM.hint(1340), '문장이 끝나는 곳에서 잘라 2,000자 안으로 맞춰요. 뒷부분 1,340자는 빠져요.')
  assert.equal(PASTE_TRIM.action, '2,000자에 맞춰 자르기')
  assert.equal(PASTE_TRIM.done(12), '뒷부분 12자를 뺐어요.')
  assert.equal(PASTE_TRIM.undo, '되돌리기')
})
