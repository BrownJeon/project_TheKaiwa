import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SignJWT } from 'jose'

process.env.JWT_SECRET ??= 'test-jwt-secret-0123456789abcdef'
process.env.SPEECH_INTERNAL_SECRET = 'internal-secret-0123456789'

import { signScopedToken, verifyScopedToken } from '../../infra/scopedToken'
import { checkInternalSecret } from '../../infra/internalAuth'
import { readFormDataCapped } from '../../infra/multipart'
import { verifyJwt } from '../../infra/jwt'
import { parseTicketRequest, WS_TICKET_AUDIENCE } from '../stt/ticket'
import { gatewayNeedsProbe, GATEWAY_REPROBE_MS } from '../stt/gateway'
import { parseWav, isPcm16Mono16k } from '../utterances/wav'
import { parseGatewayBody, parseUploadForm } from '../utterances/validate'
import { newUtteranceId, utteranceSegments } from '../utterances'
import { interpretGatewayHealth } from '../../engine/adapters/stt/sherpaReazon.provider'

function wav(opts: { ms: number; rate?: number; channels?: number; bits?: number; format?: number; list?: boolean }): Buffer {
  const rate = opts.rate ?? 16_000
  const ch = opts.channels ?? 1
  const bits = opts.bits ?? 16
  const data = Math.round((rate * ch * (bits / 8) * opts.ms) / 1000)
  const list = opts.list ? Buffer.concat([Buffer.from('LIST'), Buffer.from([4, 0, 0, 0]), Buffer.from('INFO')]) : Buffer.alloc(0)
  const b = Buffer.alloc(44 + data)
  b.write('RIFF', 0, 'ascii')
  b.writeUInt32LE(36 + data + list.length, 4)
  b.write('WAVE', 8, 'ascii')
  b.write('fmt ', 12, 'ascii')
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(opts.format ?? 1, 20)
  b.writeUInt16LE(ch, 22)
  b.writeUInt32LE(rate, 24)
  b.writeUInt32LE((rate * ch * bits) / 8, 28)
  b.writeUInt16LE((ch * bits) / 8, 32)
  b.writeUInt16LE(bits, 34)
  b.write('data', 36, 'ascii')
  b.writeUInt32LE(data, 40)
  if (!opts.list) return b
  return Buffer.concat([b.subarray(0, 36), list, b.subarray(36)])
}

test('WS 티켓: aud·만료·서명 검증, 세션 쿠키로는 통과하지 못한다', async () => {
  const t = await signScopedToken({ sub: 'cuser0000000000000000001', aud: WS_TICKET_AUDIENCE, ttlSec: 60, claims: { purpose: 'MIC_TEST', chatId: 'c1' } })
  assert.ok(t.jti.length >= 8)
  assert.ok(Math.abs(t.expiresAt.getTime() - Date.now() - 60_000) < 2_000)
  const p = await verifyScopedToken(t.token, 'ws-speech')
  assert.equal(p?.sub, 'cuser0000000000000000001')
  assert.deepEqual(p?.claims, { purpose: 'MIC_TEST', chatId: 'c1' })
  assert.equal(await verifyScopedToken(t.token, 'speech-ws'), null, 'aud 불일치 거부')
  assert.equal(await verifyScopedToken(t.token, 'ws-speech', new Date(Date.now() + 61_000)), null, '만료 거부')
  assert.equal(await verifyScopedToken(`${t.token.slice(0, -2)}xx`, 'ws-speech'), null, '위조 거부')
  const other = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject('u').setAudience('ws-speech').setJti('j1234567').setIssuedAt().setExpirationTime('60s').sign(new TextEncoder().encode('other-secret-xxxxxxxxxxxxxxxx'))
  assert.equal(await verifyScopedToken(other, 'ws-speech'), null, '다른 키 거부')
  assert.equal(await verifyJwt(t.token), null, '티켓은 세션 JWT 가 아니다(userId·email 없음)')
  await assert.rejects(() => signScopedToken({ sub: 'u', aud: 'ws-speech', ttlSec: 60, claims: { userId: 'x' } }), /예약 클레임/)
  await assert.rejects(() => signScopedToken({ sub: 'u', aud: 'ws-speech', ttlSec: 0 }), /ttl/)
})

test('#20 요청: purpose 기본 TURN, MIC_TEST 허용, 그 밖 400', () => {
  assert.deepEqual(parseTicketRequest({}), { chatId: null, purpose: 'TURN' })
  assert.deepEqual(parseTicketRequest({ purpose: 'MIC_TEST' }), { chatId: null, purpose: 'MIC_TEST' })
  assert.deepEqual(parseTicketRequest({ chatId: 'cabc', purpose: null }), { chatId: 'cabc', purpose: 'TURN' })
  assert.throws(() => parseTicketRequest({ purpose: 'TALK' }), /VALIDATION/)
  assert.throws(() => parseTicketRequest({ chatId: '../x' }), /VALIDATION/)
  assert.throws(() => parseTicketRequest({ chatId: 12 }), /VALIDATION/)
})

test('internal 시크릿: 없음=MISSING(404) · 틀림=INVALID(401) · 맞음=OK · 서버 값 부족이면 전부 거부', () => {
  assert.equal(checkInternalSecret(new Headers()), 'MISSING')
  assert.equal(checkInternalSecret(new Headers({ 'x-internal-secret': 'nope' })), 'INVALID')
  assert.equal(checkInternalSecret(new Headers({ 'x-internal-secret': '' })), 'INVALID')
  assert.equal(checkInternalSecret(new Headers({ 'X-Internal-Secret': 'internal-secret-0123456789' })), 'OK')
  assert.equal(checkInternalSecret(new Headers({ 'x-internal-secret': 'internal-secret-012345678' })), 'INVALID', '한 글자 부족')
  const saved = process.env.SPEECH_INTERNAL_SECRET
  process.env.SPEECH_INTERNAL_SECRET = 'short'
  assert.equal(checkInternalSecret(new Headers({ 'x-internal-secret': 'short' })), 'INVALID')
  delete process.env.SPEECH_INTERNAL_SECRET
  assert.equal(checkInternalSecret(new Headers({ 'x-internal-secret': 'anything' })), 'INVALID')
  process.env.SPEECH_INTERNAL_SECRET = saved
})

test('wav 헤더: 길이는 data 청크로, PCM16 mono 16k 만 통과', () => {
  const w = parseWav(wav({ ms: 1500 }))
  assert.ok(w && isPcm16Mono16k(w))
  assert.equal(w?.durationMs, 1500)
  assert.equal(parseWav(wav({ ms: 1000, list: true }))?.durationMs, 1000, 'LIST 청크 건너뜀')
  assert.equal(isPcm16Mono16k(parseWav(wav({ ms: 100, rate: 48_000 }))!), false)
  assert.equal(isPcm16Mono16k(parseWav(wav({ ms: 100, channels: 2 }))!), false)
  assert.equal(isPcm16Mono16k(parseWav(wav({ ms: 100, format: 3, bits: 32 }))!), false)
  assert.equal(parseWav(Buffer.from('not a wav at all, definitely not riff data....')), null)
  const stream = wav({ ms: 1000 })
  stream.writeUInt32LE(0xffffffff, 40)
  assert.equal(parseWav(stream)?.durationMs, 1000, '스트리밍 자리표시(0xFFFFFFFF)는 남은 바이트로')
  assert.equal(parseWav(stream)?.trailingBytes, 0)
  const zero = wav({ ms: 800 })
  zero.writeUInt32LE(0, 40)
  assert.equal(parseWav(zero)?.durationMs, 800, '자리표시 0 도 남은 바이트로')
  const cut = wav({ ms: 1000 }).subarray(0, 44 + 16_000)
  assert.equal(parseWav(Buffer.from(cut))?.durationMs, 500, '선언보다 짧게 잘린 파일은 실제 바이트로')
})

test('REV-013 M1 회귀: data 선언을 줄이고 PCM 을 덧붙여도 길이는 실제 바이트 기준 — 덧붙은 바이트는 trailingBytes', () => {
  const forged = Buffer.concat([wav({ ms: 1000 }), Buffer.alloc(32_000 * 59)])
  const w = parseWav(forged)
  assert.equal(w?.durationMs, 1000, '선언된 data 길이')
  assert.equal(w?.trailingBytes, 32_000 * 59, '선언 밖 바이트를 드러낸다(업로드는 이 값이 0 이 아니면 400)')
  const pad = wav({ ms: 1000 })
  pad.writeUInt32LE(31_999, 40)
  assert.equal(parseWav(pad)?.trailingBytes, 0, '홀수 선언 뒤 패딩 1바이트는 정상')
  const odd = Buffer.concat([wav({ ms: 1000 }), Buffer.alloc(1)])
  odd.writeUInt32LE(31_999, 40)
  assert.equal(parseWav(odd)?.trailingBytes, 2, '패딩을 넘는 바이트는 덧붙은 것')
})

test('internal 콜백 본문: 형식 검증, 경로 필드는 무시', () => {
  const ok = parseGatewayBody({
    userId: 'cmfuser00000000000000000a',
    chatId: null,
    durationMs: 2400,
    sampleRate: 16000,
    audioBytes: 76844,
    realtimeEngine: 'reazon-gateway',
    realtimeText: '  こんにちは\u0007 ',
    segments: [{ segIdx: 0, start: 0, end: 1200, text: 'こんにちは' }],
    timings: { vadMs: 10, sttMs: 300, decodeMs: 250, secret: 'x' },
    traceId: 't_abcdefghijklmnopqrst',
    tmpPath: '../../etc/passwd',
  })
  assert.equal(ok.realtimeText, 'こんにちは')
  assert.deepEqual(ok.timings, { vadMs: 10, decodeMs: 250, sttMs: 300 })
  assert.equal((ok as unknown as Record<string, unknown>).tmpPath, undefined)
  assert.throws(() => parseGatewayBody({ ...ok, userId: '../x' }), /VALIDATION/)
  assert.throws(() => parseGatewayBody({ ...ok, userId: 'ABC' }), /VALIDATION/)
  assert.throws(() => parseGatewayBody({ ...ok, realtimeText: 'あ'.repeat(1001) }), /VALIDATION/)
  assert.throws(() => parseGatewayBody({ ...ok, segments: Array.from({ length: 51 }, () => ({ start: 0, end: 1, text: '' })) }), /VALIDATION/)
  assert.throws(() => parseGatewayBody({ ...ok, sampleRate: 48000 }), /VALIDATION/)
  assert.throws(() => parseGatewayBody({ ...ok, durationMs: 70_000 }), /VALIDATION/)
  assert.throws(() => parseGatewayBody({ ...ok, timings: { vadMs: -1 } }), /VALIDATION/)
  assert.throws(() => parseGatewayBody({ ...ok, traceId: 'x' }), /VALIDATION/)
})

test('#21 multipart: 필수값·상한, 레슨·평가 연결은 아직 400', async () => {
  const form = new FormData()
  form.set('audio', new File([new Uint8Array(wav({ ms: 500 }))], 'a.wav', { type: 'audio/wav' }))
  form.set('text', 'はい')
  form.set('realtimeConnectionKey', 'cabcdef123')
  form.set('durationMs', '500')
  form.set('segments', JSON.stringify([{ start: 0, end: 500, text: 'はい' }]))
  const input = await parseUploadForm(form)
  assert.equal(input.text, 'はい')
  assert.equal(input.durationMs, 500)
  assert.equal(input.segments?.length, 1)
  form.set('lessonId', 'l1')
  await assert.rejects(() => parseUploadForm(form), /FEATURE_NOT_READY/)
  form.delete('lessonId')
  form.set('segments', '{bad')
  await assert.rejects(() => parseUploadForm(form), /VALIDATION/)
  form.delete('segments')
  form.delete('audio')
  await assert.rejects(() => parseUploadForm(form), /VALIDATION/)
})

test('multipart 상한: Content-Length·실제 바이트 둘 다 끊는다', async () => {
  const big = new FormData()
  big.set('audio', new File([new Uint8Array(3000)], 'a.wav'))
  const req = new Request('http://x/u', { method: 'POST', body: big })
  await assert.rejects(() => readFormDataCapped(req, 1000), /VALIDATION/)
  const plain = new Request('http://x/u', { method: 'POST', body: 'x', headers: { 'content-type': 'text/plain' } })
  await assert.rejects(() => readFormDataCapped(plain, 1000), /VALIDATION/)
  const small = new FormData()
  small.set('text', 'a')
  const f = await readFormDataCapped(new Request('http://x/u', { method: 'POST', body: small }), 10_000)
  assert.equal(f.get('text'), 'a')
})

test('발화 id·경로: cuid 모양, 월은 KST 기준', () => {
  const id = newUtteranceId()
  assert.match(id, /^c[0-9a-z]{24}$/)
  assert.notEqual(newUtteranceId(), id)
  assert.deepEqual(utteranceSegments('cuser1', 'cid1', new Date('2026-09-30T15:30:00Z')), ['users', 'cuser1', 'utterances', '2026-10', 'cid1.wav'])
  assert.deepEqual(utteranceSegments('cuser1', 'cid1', new Date('2026-09-30T14:59:00Z')).slice(3, 4), ['2026-09'])
})

test('gateway 재확인 판단: UNKNOWN 3초·불가/설정오류 30초·정상은 안 함', () => {
  const now = 1_000_000
  assert.equal(gatewayNeedsProbe('UNKNOWN', now - 3_000, now), true)
  assert.equal(gatewayNeedsProbe('UNKNOWN', now - 1_000, now), false)
  assert.equal(gatewayNeedsProbe('UNAVAILABLE', now - GATEWAY_REPROBE_MS, now), true)
  assert.equal(gatewayNeedsProbe('UNAVAILABLE', now - 10_000, now), false)
  assert.equal(gatewayNeedsProbe('MISCONFIGURED', now - GATEWAY_REPROBE_MS, now), true)
  assert.equal(gatewayNeedsProbe('HEALTHY', 0, now), false)
})

test('gateway 공개 /health 판정: OK=정상, LOADING·FAILED=불가, MISCONFIGURED 유지', () => {
  assert.deepEqual(interpretGatewayHealth({ ok: true, status: 'OK' }), {})
  assert.equal(interpretGatewayHealth({ ok: false, status: 'LOADING' }).status, 'UNAVAILABLE')
  assert.equal(interpretGatewayHealth({ ok: false, status: 'FAILED' }).status, 'UNAVAILABLE')
  assert.equal(interpretGatewayHealth({ ok: false, status: 'MISCONFIGURED' }).status, 'MISCONFIGURED')
  assert.equal(interpretGatewayHealth({ ok: false }).status, 'UNAVAILABLE')
})
