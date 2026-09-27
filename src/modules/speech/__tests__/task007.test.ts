import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { deriveSubkey } from '@/modules/infra'
import { readSignedTtsAudio, signTtsAudioToken, verifyTtsAudioToken, TTS_AUDIO_URL_PATH } from '../tts/audioUrl'
import { clearRecentAudio, recallRecentAudio, recentAudioStats, rememberRecentAudio, RECENT_AUDIO_MAX_ENTRIES } from '../tts/recentAudio'
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

test('방금 합성한 오디오 보관소: TTL·항목 상한·바이트 상한, 같은 키는 교체', () => {
  clearRecentAudio()
  const now = 1_790_000_000_000
  const a = (n: number) => ({ audio: Buffer.alloc(n, 1), durationMs: 800, modelVersion: '1.0.0', dictionaryVersion: 1 })
  rememberRecentAudio(KEY, a(10), now, 1_000)
  assert.equal(recallRecentAudio(KEY, now + 999)?.audio.length, 10)
  assert.equal(recallRecentAudio(KEY, now + 1_000), null, 'TTL 지나면 없음')
  assert.equal(recentAudioStats().bytes, 0)
  for (let i = 0; i < RECENT_AUDIO_MAX_ENTRIES + 5; i++) rememberRecentAudio(i.toString(16).padStart(40, '0'), a(100), now)
  assert.equal(recentAudioStats().entries, RECENT_AUDIO_MAX_ENTRIES, '항목 상한 — 오래된 것부터 버림')
  assert.equal(recallRecentAudio('0'.repeat(40), now), null)
  rememberRecentAudio(KEY, a(10 * 1024 * 1024), now)
  rememberRecentAudio('cd'.repeat(20), a(10 * 1024 * 1024), now)
  assert.ok(recentAudioStats().bytes <= 16 * 1024 * 1024, '바이트 상한')
  assert.equal(recallRecentAudio(KEY, now), null, '바이트 상한에서 먼저 넣은 큰 항목이 밀려남')
  clearRecentAudio()
})

test('#24 MISS 경합 수정: 캐시 행 커밋 전에도 서명 검증을 통과하면 보관소에서 바로 준다(DB 없이), 서명이 틀리면 보관소를 보지 않는다', async () => {
  clearRecentAudio()
  const wav = Buffer.from('RIFF....WAVEfmt ')
  rememberRecentAudio(KEY, { audio: wav, durationMs: 900, modelVersion: '1.0.0', dictionaryVersion: 3 })
  const s = signTtsAudioToken(U1, KEY)
  const got = await readSignedTtsAudio(U1, s.token)
  assert.ok(got && got.audio.equals(wav) && got.durationMs === 900 && got.modelVersion === '1.0.0' && got.dictionaryVersion === 3 && got.remainingSec > 590)
  assert.equal(await readSignedTtsAudio(U2, s.token), null, '타인 세션 — 보관소에 있어도 null')
  assert.equal(await readSignedTtsAudio(U1, 'garbage'), null)
  clearRecentAudio()
})
