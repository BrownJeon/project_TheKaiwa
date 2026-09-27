import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { deriveSubkey } from '@/modules/infra'
import { signTtsAudioToken, verifyTtsAudioToken, TTS_AUDIO_URL_PATH } from '../tts/audioUrl'
import { chunkPauseMs } from '../tts/synthesize'

const saved = process.env.JWT_SECRET
before(() => {
  process.env.JWT_SECRET = 'unit-test-secret-0123456789abcdef'
})
after(() => {
  process.env.JWT_SECRET = saved
})

const KEY = 'ab'.repeat(20)
const U1 = 'cuser00000000000000000001'
const U2 = 'cuser00000000000000000002'

test('#24 서명 URL: 본인·미만료는 통과, 남은 초를 돌려준다', () => {
  const now = 1_790_000_000_000
  const s = signTtsAudioToken(U1, KEY, { now })
  assert.ok(s.url.startsWith(TTS_AUDIO_URL_PATH))
  const v = verifyTtsAudioToken(U1, s.token, now + 5_000)
  assert.deepEqual(v, { cacheKey: KEY, expiresAtSec: Math.floor(now / 1000) + 600, remainingSec: 595 })
})

test('#24 서명 URL: URL 에 userId 원문이 없다(C1-1) — payload 는 {k,e} 뿐', () => {
  const s = signTtsAudioToken(U1, KEY)
  assert.ok(!s.url.includes(U1))
  const payload = JSON.parse(Buffer.from(s.token.split('.')[0], 'base64url').toString('utf8'))
  assert.deepEqual(Object.keys(payload).sort(), ['e', 'k'])
})

test('#24 서명 URL: 다른 사용자 세션·만료·변조·형식 오류·먼 미래 만료는 모두 null(이유 구분 없음)', () => {
  const now = 1_790_000_000_000
  const s = signTtsAudioToken(U1, KEY, { now })
  assert.equal(verifyTtsAudioToken(U2, s.token, now), null, '타인 세션')
  assert.equal(verifyTtsAudioToken(U1, s.token, now + 601_000), null, '만료')
  const [p, m] = s.token.split('.')
  const flipped = `${p}.${m.slice(0, -2)}${m.endsWith('AA') ? 'AB' : 'AA'}`
  assert.equal(verifyTtsAudioToken(U1, flipped, now), null, 'MAC 변조')
  const other = Buffer.from(JSON.stringify({ k: 'cd'.repeat(20), e: Math.floor(now / 1000) + 600 })).toString('base64url')
  assert.equal(verifyTtsAudioToken(U1, `${other}.${m}`, now), null, 'payload 바꿔치기')
  const extra = Buffer.from(JSON.stringify({ k: KEY, e: Math.floor(now / 1000) + 600, u: U1 })).toString('base64url')
  assert.equal(verifyTtsAudioToken(U1, `${extra}.${m}`, now), null, 'payload 키 추가')
  for (const bad of ['', 'abc', `${p}.`, `${p}.${m}.x`, '../../etc/passwd', null, 42]) assert.equal(verifyTtsAudioToken(U1, bad, now), null, String(bad))
  // 서명은 맞아도 만료가 1시간보다 먼 토큰은 받지 않는다(서버가 만든 적 없는 형태).
  const e = Math.floor(now / 1000) + 7200
  const far = `${Buffer.from(JSON.stringify({ k: KEY, e })).toString('base64url')}.${createHmac('sha256', deriveSubkey('thekaiwa/tts-audio-url/v1')).update(`tts-audio|${U1}|${KEY}|${e}`).digest('base64url')}`
  assert.equal(verifyTtsAudioToken(U1, far, now), null)
})

test('#24 서명 키는 JWT_SECRET 그대로가 아니라 HKDF 파생(용도 분리)', () => {
  const k = deriveSubkey('thekaiwa/tts-audio-url/v1')
  assert.equal(k.length, 32)
  assert.notDeepEqual(k, Buffer.from(process.env.JWT_SECRET!))
  assert.notDeepEqual(k, deriveSubkey('thekaiwa/other-purpose/v1'))
  assert.throws(() => deriveSubkey('bad info'))
})

test('청크 앞 간격: 첫 청크 0, 이후 프로필 간격(NATIVE 0·LEARNING_NORMAL 200)·세그먼트 쉼 중 큰 값, SHADOWING 은 직전 길이', () => {
  assert.equal(chunkPauseMs('NATIVE', 0, 0), 0)
  assert.equal(chunkPauseMs('NATIVE', 1, 0), 0)
  assert.equal(chunkPauseMs('LEARNING_NORMAL', 1, 0), 200)
  assert.equal(chunkPauseMs('PRONUNCIATION', 2, 300), 300)
  assert.equal(chunkPauseMs('NATIVE', 1, 150), 150)
  assert.equal(chunkPauseMs('SHADOWING', 1, 0, 1234), 1234)
  assert.equal(chunkPauseMs('SHADOWING', 1, 0, null), 0)
})
