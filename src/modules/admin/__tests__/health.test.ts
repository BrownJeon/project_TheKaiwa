/**
 * /api/health 판정(task-009): 선택 의존성만 빠지면 200(degraded), 필수(DB·필수 env)가 빠지면 503(down) — release.sh 헬스 게이트 기준.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HEALTH_REQUIRED_CHECKS, getHealthSummary, healthHttpStatus, summarizeHealth } from '../health'

const ALL_OK = {
  env_database: true,
  env_jwt: true,
  env_google_oauth: true,
  env_data_root: true,
  env_internal_secret: true,
  db: true,
  llm: true,
  stt_gateway: true,
  stt_analysis: true,
  tts: true,
}

test('모두 true → ok·200', () => {
  const s = summarizeHealth(ALL_OK)
  assert.equal(s.status, 'ok')
  assert.deepEqual(s.degraded, [])
  assert.equal(healthHttpStatus(s.status), 200)
})

test('선택 의존성(tts·stt_gateway·stt_analysis·llm·env_internal_secret)만 빠지면 degraded·200 — 배포를 막지 않는다', () => {
  for (const k of ['tts', 'stt_gateway', 'stt_analysis', 'llm', 'env_internal_secret']) {
    const s = summarizeHealth({ ...ALL_OK, [k]: false })
    assert.equal(s.status, 'degraded', k)
    assert.deepEqual(s.degraded, [k])
    assert.equal(healthHttpStatus(s.status), 200, k)
  }
})

test('필수 항목이 하나라도 false 또는 누락이면 down·503', () => {
  for (const k of HEALTH_REQUIRED_CHECKS) {
    const s = summarizeHealth({ ...ALL_OK, [k]: false })
    assert.equal(s.status, 'down', k)
    assert.equal(healthHttpStatus(s.status), 503, k)
    const missing: Record<string, boolean> = { ...ALL_OK }
    delete missing[k]
    assert.equal(summarizeHealth(missing).status, 'down', `${k} 누락`)
  }
})

test('getHealthSummary — 값은 boolean 만, down 은 5초만 캐시(release.sh 30초 대기 안에 회복 판정), 정상은 60초 캐시', async () => {
  const keys = ['DATABASE_URL', 'JWT_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DATA_ROOT', 'SPEECH_INTERNAL_SECRET', 'CLAUDE_CLI_PATH', 'SPEECH_GATEWAY_URL', 'WHISPER_SERVICE_URL', 'TTS_SERVICE_URL'] as const
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]))
  try {
    for (const k of keys) delete process.env[k]
    for (const k of ['DATABASE_URL', 'JWT_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DATA_ROOT']) process.env[k] = 'x'
    let pings = 0
    const up = async () => {
      pings++
      return true
    }
    const dbDown = async () => {
      pings++
      return false
    }

    const t0 = 10_000_000
    const down = await getHealthSummary(t0, dbDown)
    assert.equal(down.status, 'down')
    assert.equal(down.checks.db, false)
    assert.ok(Object.values(down.checks).every((v) => typeof v === 'boolean'))
    assert.ok(!JSON.stringify(down).includes('"x"'), 'env 값이 응답에 실리지 않는다')

    assert.equal((await getHealthSummary(t0 + 4_000, up)).status, 'down', '5초 안에는 캐시')
    assert.equal(pings, 1)

    const recovered = await getHealthSummary(t0 + 6_000, up)
    assert.equal(recovered.status, 'degraded', '음성 서비스 URL 이 없어 degraded 지만 필수는 통과')
    assert.equal(recovered.checks.db, true)
    assert.equal(healthHttpStatus(recovered.status), 200)
    assert.equal(pings, 2)

    assert.equal((await getHealthSummary(t0 + 6_000 + 50_000, dbDown)).status, 'degraded', '정상 판정은 60초 캐시')
    assert.equal(pings, 2)

    delete process.env.JWT_SECRET
    const noJwt = await getHealthSummary(t0 + 6_000 + 61_000, up)
    assert.equal(noJwt.status, 'down')
    assert.equal(noJwt.checks.env_jwt, false)
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  }
})
