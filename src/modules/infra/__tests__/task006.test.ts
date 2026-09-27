import { test } from 'node:test'
import assert from 'node:assert/strict'
import { codePointLength, sanitizeText, toPreview, truncateCodePoints } from '../text'
import { decodeCursor, encodeCursor, isOffsetCursor, isTimeIdCursor, parseLimit } from '../pagination'
import { formatSseEvent } from '../sse'
import { isStaleJob, staleAfterMs } from '../jobs'
import { classifyError, ApiError } from '../http'

test('코드포인트 길이: 이모지(서로게이트 쌍)는 1자, 짝 없는 서로게이트도 1자', () => {
  assert.equal(codePointLength('今日は😀楽しかった🎉'), 10)
  assert.equal(codePointLength('abc'), 3)
  assert.equal(codePointLength('\uD83D'), 1)
  assert.equal(codePointLength('😀'.repeat(1000)), 1000)
})

test('입력 정리(D10): 여러 줄은 \\n·\\t 보존, 그 밖 C0/C1·DEL 제거, \\r\\n → \\n, 앞뒤 공백 제거', () => {
  assert.equal(sanitizeText('  a\u0000b\u0007c\u007f\u0085d\te\r\nf  ', { multiline: true }), 'abcd\te\nf')
  assert.equal(sanitizeText('제목\n줄\t탭'), '제목줄탭', '한 줄 필드는 줄바꿈·탭도 지운다')
  assert.equal(sanitizeText(' \u0001\u0002 \n\t '), '', '공백·제어문자만이면 빈 문자열')
  assert.equal(sanitizeText('今日は😀楽しかった🎉', { multiline: true }), '今日は😀楽しかった🎉', '이모지는 그대로')
  assert.equal(sanitizeText('a\uD83Db'), 'a�b', '짝 없는 서로게이트는 U+FFFD')
  assert.equal(Buffer.from(sanitizeText('今日は😀楽しかった🎉'), 'utf8').toString('utf8'), '今日は😀楽しかった🎉', 'UTF-8 왕복 바이트 동일')
})

test('자르기: 코드포인트 상한 안, 글자 경계(서로게이트·ZWJ 이모지)를 깨지 않고 … 를 붙인다', () => {
  const s = '😀'.repeat(130)
  const t = truncateCodePoints(s, 120)
  assert.equal(codePointLength(t), 120)
  assert.ok(t.endsWith('…'))
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(t), '반쪽 서로게이트 없음')
  const family = '👨‍👩‍👧' // 5 코드포인트(ZWJ 결합)
  const u = truncateCodePoints(`ab${family}cd`, 5)
  assert.equal(u, 'ab…', '결합 이모지는 통째로 빼고 반쪽을 남기지 않는다')
  assert.equal(truncateCodePoints('short', 120), 'short')
  assert.equal(toPreview('一行目\n二行目\t\t三', 120), '一行目 二行目 三')
})

test('커서: 왕복·형태 검사·잘못된 커서는 400', () => {
  const c = encodeCursor({ t: '2026-09-27T01:00:00.000Z', id: 'cabc' })
  assert.deepEqual(decodeCursor(c, isTimeIdCursor), { t: '2026-09-27T01:00:00.000Z', id: 'cabc' })
  assert.deepEqual(decodeCursor(encodeCursor({ o: 100 }), isOffsetCursor), { o: 100 })
  assert.equal(decodeCursor(null, isTimeIdCursor), null)
  assert.throws(() => decodeCursor('not-base64-json', isTimeIdCursor), (e: unknown) => e instanceof ApiError && e.code === 'VALIDATION')
  assert.throws(() => decodeCursor(encodeCursor({ o: -1 }), isOffsetCursor), (e: unknown) => e instanceof ApiError && e.code === 'VALIDATION')
  assert.equal(parseLimit(null, 50), 50)
  assert.equal(parseLimit('100', 20, 100), 100)
  assert.throws(() => parseLimit('0'))
  assert.throws(() => parseLimit('101', 20, 100))
  assert.throws(() => parseLimit('1e2'))
})

test('SSE 형식: event/data 두 줄 + 빈 줄, 데이터 안의 줄바꿈은 이스케이프', () => {
  assert.equal(formatSseEvent('done', { a: '가\n나' }), 'event: done\ndata: {"a":"가\\n나"}\n\n')
})

test('잡 stale 판정: 종류별 기준보다 오래된 QUEUED/RUNNING 만', () => {
  const now = Date.parse('2026-09-27T10:00:00Z')
  const base = { id: 'j1', kind: 'CHAT_REVIEW' as const, createdAt: new Date(now - 6 * 60_000), startedAt: new Date(now - 6 * 60_000) }
  assert.equal(staleAfterMs('CHAT_REVIEW'), 5 * 60_000)
  assert.equal(isStaleJob({ ...base, status: 'RUNNING' }, now), true)
  assert.equal(isStaleJob({ ...base, status: 'RUNNING', startedAt: new Date(now - 60_000) }, now), false, '시작한 지 1분이면 살아 있다')
  assert.equal(isStaleJob({ ...base, status: 'DONE' }, now), false)
  assert.equal(isStaleJob({ ...base, kind: 'LESSON_GEN', status: 'QUEUED' }, now), false, '기본 기준 10분')
})

test('오류 분류: 엔진 오류 이름 → 코드, traceId 는 details 로, 알 수 없는 예외는 INTERNAL', () => {
  const e = Object.assign(new Error('x'), { name: 'LlmTimeoutError', userMessage: '늦음', traceId: 't_abc' })
  assert.deepEqual(classifyError(e), { code: 'ENGINE_TIMEOUT', status: 504, userMessage: '늦음', details: { traceId: 't_abc' } })
  assert.equal(classifyError(new ApiError('FEATURE_NOT_READY', 'x')).status, 400)
  assert.equal(classifyError(new ApiError('ALREADY_REVIEWED', 'x')).status, 409)
  assert.equal(classifyError(new Error('boom')).code, 'INTERNAL')
})
