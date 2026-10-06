/**
 * task-012b-3 `GET /api/admin/v1/tts/metrics` — 권한(trace.read, role-permission.md:49) · 라우트 첫 줄 가드 · 입력 파서 · 기간 합계 · 응답 모양(사용자 식별자 없음).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError } from '@/modules/infra'
import type { TtsMetricsDay } from '@/modules/engine'
import { can } from '../permissions/can'
import { getTtsMetricsDto, parseTtsMetricsRange, parseTtsVoiceId, summarize, ttsDayDto, TTS_METRICS_RANGES, type TtsMetricsDeps } from '../diagnostics/tts'

test('권한 — trace.read 는 DEVELOPER·SUPER_ADMIN 만, ADMIN 은 403(missing), USER 는 콘솔 자체가 없어 404', () => {
  assert.equal(can('DEVELOPER', 'trace.read').allowed, true)
  assert.equal(can('SUPER_ADMIN', 'trace.read').allowed, true)
  const admin = can('ADMIN', 'trace.read')
  assert.equal(admin.allowed, false)
  assert.deepEqual(admin.missing, ['trace.read'])
  assert.equal(can('ADMIN', 'console.access').allowed, true)
  assert.equal(can('USER', 'console.access').allowed, false)
})

test('라우트 — GET 처리 함수의 첫 문장이 requireCapability(\'trace.read\'), engine 직접 import 없음', () => {
  const src = readFileSync(join(process.cwd(), 'src/app/api/admin/v1/tts/metrics/route.ts'), 'utf8')
  const m = /export const GET = withApi(?:<\w+>)?\(async \([^)]*\) => \{\s*const actor = await requireCapability\('([a-z_.]+)'\)/.exec(src)
  assert.ok(m, '첫 줄이 requireCapability 가 아니다')
  assert.equal(m[1], 'trace.read')
  assert.ok(!src.includes("'@/modules/engine'"))
})

const isValidation = (field: string) => (e: unknown) => e instanceof ApiError && e.code === 'VALIDATION' && e.details?.field === field

test('입력 — range 기본 7d·4종만, voiceId 형식만(존재는 묻지 않음)', () => {
  assert.equal(parseTtsMetricsRange(null), '7d')
  assert.equal(parseTtsMetricsRange(''), '7d')
  for (const k of Object.keys(TTS_METRICS_RANGES)) assert.equal(parseTtsMetricsRange(k), k)
  assert.deepEqual(TTS_METRICS_RANGES, { today: 1, '7d': 7, '30d': 30, '90d': 90 })
  for (const bad of ['365d', '1d', 'toString', '__proto__', '7D']) assert.throws(() => parseTtsMetricsRange(bad), isValidation('range'))
  assert.equal(parseTtsVoiceId(null), null)
  assert.equal(parseTtsVoiceId('teacher_haruka'), 'teacher_haruka')
  for (const bad of ['../x', 'a b', 'x'.repeat(61), '春香']) assert.throws(() => parseTtsVoiceId(bad), isValidation('voiceId'))
})

const day = (date: string, o: Partial<TtsMetricsDay>): TtsMetricsDay => ({
  date,
  source: 'MATERIALIZED',
  computedAt: null,
  requests: 0,
  errors: 0,
  avgMs: null,
  p50Ms: null,
  p95Ms: null,
  p99Ms: null,
  ttfaP50Ms: null,
  ttfaP95Ms: null,
  rtfAvg: null,
  cacheHitRate: null,
  byVoice: null,
  ...o,
})

test('기간 합계 — 요청·오류·오류율·적중률(저장 비율 × 요청 수 반올림으로 적중 수 복원), 목소리 합계, 표본 0 은 null', () => {
  const days = [
    day('2026-10-04', { requests: 7, errors: 1, cacheHitRate: 0.4286, byVoice: { teacher_a: { requests: 5, errors: 1, p50Ms: 600 } } }),
    day('2026-10-05', { requests: 3, errors: 0, cacheHitRate: 0.3333 }),
    day('2026-10-06', { source: 'LIVE' }),
  ]
  const s = summarize(days, 'teacher_a')
  assert.equal(s.requests, 10)
  assert.equal(s.errors, 1)
  assert.equal(s.errorRate, 0.1)
  assert.equal(s.cacheHitRate, 0.4) // 3 + 1 = 4 / 10
  assert.deepEqual(s.voice, { voiceId: 'teacher_a', requests: 5, errors: 1 })
  const empty = summarize([day('2026-10-06', {})], null)
  assert.deepEqual(empty, { requests: 0, errors: 0, errorRate: null, cacheHitRate: null, voice: null })
})

test('날짜 DTO — 오류율 계산, voiceId 필터는 byVoice 를 그 목소리만(없으면 null), computedAt ISO, 응답에 사용자 식별자 칸 없음', () => {
  const d = day('2026-10-05', { requests: 4, errors: 1, computedAt: new Date('2026-10-06T00:00:00Z'), byVoice: { teacher_a: { requests: 3, errors: 1, p50Ms: 500 }, teacher_b: { requests: 1, errors: 0, p50Ms: 400 } } })
  const all = ttsDayDto(d, null)
  assert.equal(all.errorRate, 0.25)
  assert.equal(all.computedAt, '2026-10-06T00:00:00.000Z')
  assert.deepEqual(Object.keys(all.byVoice!), ['teacher_a', 'teacher_b'])
  assert.deepEqual(ttsDayDto(d, 'teacher_b').byVoice, { teacher_b: { requests: 1, errors: 0, p50Ms: 400 } })
  assert.equal(ttsDayDto(d, 'teacher_z').byVoice, null)
  assert.equal(ttsDayDto(day('2026-10-05', {}), null).errorRate, null)
  const keys = Object.keys(all)
  for (const banned of ['userId', 'text', 'normalizedText', 'traceId', 'audio']) assert.ok(!keys.includes(banned), banned)
})

test('REV-119 M-1 — voiceId 가 프로토타입 키(constructor·toString·__proto__)·없는 목소리면 byVoice null·목소리 합계 0·0, 정상 목소리는 그대로(JSON 응답 모양 기준)', async () => {
  const NOW = new Date('2026-10-06T03:00:00Z')
  const byVoice = { voice_a: { requests: 3, errors: 1, p50Ms: 500 }, voice_b: { requests: 1, errors: 0, p50Ms: 400 } }
  const deps: TtsMetricsDeps = {
    getConnection: async () => null,
    getTtsMetrics: async (o) => ({
      environment: o.environment,
      from: o.from,
      to: o.to,
      today: '2026-10-06',
      connections: [
        {
          connection: { id: 'ec_tts', key: 'tts-main', name: 'TTS', enabled: true, status: 'HEALTHY', createdAt: new Date('2026-09-01T00:00:00Z') },
          days: [day('2026-10-05', { requests: 4, errors: 1, cacheHitRate: 0.25, byVoice }), day('2026-10-06', { source: 'LIVE' })],
        },
      ],
    }),
  }
  const shape = async (voiceId: string) => JSON.parse(JSON.stringify(await getTtsMetricsDto('LOCAL', { voiceId }, NOW, deps)))
  for (const v of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'voice_zz']) {
    assert.equal(parseTtsVoiceId(v), v) // 형식은 통과한다 — 막는 곳은 조회 쪽
    const dto = await shape(v)
    assert.equal(dto.voiceId, v)
    const c = dto.connections[0]
    assert.deepEqual(c.days.map((d: { byVoice: unknown }) => d.byVoice), [null, null], v)
    assert.deepEqual(c.summary, { requests: 4, errors: 1, errorRate: 0.25, cacheHitRate: 0.25, voice: { voiceId: v, requests: 0, errors: 0 } }, v)
    // 직접 호출도 같은 모양(직렬화 전 객체)
    assert.equal(ttsDayDto(day('2026-10-05', { byVoice }), v).byVoice, null)
    assert.deepEqual(summarize([day('2026-10-05', { byVoice })], v).voice, { voiceId: v, requests: 0, errors: 0 })
  }
  // 정상 목소리 — 그 목소리만, 합계는 그 목소리 값
  const ok = await shape('voice_a')
  assert.deepEqual(ok.connections[0].days.map((d: { byVoice: unknown }) => d.byVoice), [{ voice_a: { requests: 3, errors: 1, p50Ms: 500 } }, null])
  assert.deepEqual(ok.connections[0].summary.voice, { voiceId: 'voice_a', requests: 3, errors: 1 })
  // voiceId 없음 — byVoice 전체, summary.voice null
  const all = await shape('')
  assert.deepEqual(all.connections[0].days[0].byVoice, byVoice)
  assert.equal(all.connections[0].summary.voice, null)
  // 저장된 목소리 id 가 정말 그 이름이면(자기 속성) 그대로 집는다 — JSON.parse 로 만든 행처럼
  const own = JSON.parse('{"__proto__":{"requests":2,"errors":1,"p50Ms":100},"constructor":{"requests":5,"errors":0,"p50Ms":200}}')
  const p = ttsDayDto(day('2026-10-05', { byVoice: own }), '__proto__')
  assert.equal(Object.getPrototypeOf(p.byVoice), Object.prototype)
  assert.equal(JSON.stringify(p.byVoice), '{"__proto__":{"requests":2,"errors":1,"p50Ms":100}}')
  assert.deepEqual(summarize([day('2026-10-05', { byVoice: own })], 'constructor').voice, { voiceId: 'constructor', requests: 5, errors: 0 })
  assert.equal(({} as Record<string, unknown>).requests, undefined) // 전역 오염 없음
})

test('조립 — connectionId 형식 400(DB 조회 전)·없는 연결 404(존재 비노출)·TTS 아닌 연결 400·range 오류는 집계 전, 기간 = KST 오늘 포함, 연결 id 전달, 응답 연결 칸은 5개만', async () => {
  const NOW = new Date('2026-10-05T16:30:00Z') // 10-06 01:30 KST — UTC 날짜(10-05)와 다르다
  const connCalls: string[] = []
  const metricCalls: Parameters<TtsMetricsDeps['getTtsMetrics']>[0][] = []
  const deps: TtsMetricsDeps = {
    getConnection: async (_env, ref) => {
      connCalls.push(ref)
      if (ref === 'ec_tts' || ref === 'tts-main') return { id: 'ec_tts', role: 'TTS' }
      if (ref === 'ec_llm') return { id: 'ec_llm', role: 'LLM' }
      return null
    },
    getTtsMetrics: async (o) => {
      metricCalls.push(o)
      return {
        environment: o.environment,
        from: o.from,
        to: o.to,
        today: '2026-10-06',
        connections: [
          {
            connection: { id: 'ec_tts', key: 'tts-main', name: 'TTS', enabled: true, status: 'HEALTHY', createdAt: new Date('2026-09-01T00:00:00Z') },
            days: [day('2026-10-06', { source: 'LIVE', requests: 4, errors: 1, cacheHitRate: 0.5, byVoice: { voice_a: { requests: 3, errors: 1, p50Ms: 500 }, voice_b: { requests: 1, errors: 0, p50Ms: 400 } } })],
          },
        ],
      }
    },
  }
  await assert.rejects(getTtsMetricsDto('LOCAL', { connectionId: '../x' }, NOW, deps), isValidation('connectionId'))
  assert.equal(connCalls.length, 0)
  await assert.rejects(getTtsMetricsDto('LOCAL', { connectionId: 'nope_conn' }, NOW, deps), (e: unknown) => e instanceof ApiError && e.code === 'NOT_FOUND')
  await assert.rejects(getTtsMetricsDto('LOCAL', { connectionId: 'ec_llm' }, NOW, deps), isValidation('connectionId'))
  await assert.rejects(getTtsMetricsDto('LOCAL', { range: '365d', connectionId: 'ec_tts' }, NOW, deps), isValidation('range'))
  await assert.rejects(getTtsMetricsDto('LOCAL', { voiceId: 'a b' }, NOW, deps), isValidation('voiceId'))
  assert.equal(metricCalls.length, 0)

  const dto = await getTtsMetricsDto('LOCAL', { range: '30d', connectionId: 'tts-main', voiceId: 'voice_a' }, NOW, deps)
  assert.deepEqual({ env: metricCalls[0].environment, from: metricCalls[0].from, to: metricCalls[0].to, ids: metricCalls[0].connectionIds }, { env: 'LOCAL', from: '2026-09-07', to: '2026-10-06', ids: ['ec_tts'] })
  assert.deepEqual(dto.range, { key: '30d', from: '2026-09-07', to: '2026-10-06' })
  assert.equal(dto.voiceId, 'voice_a')
  const c = dto.connections[0]
  assert.deepEqual(Object.keys(c.connection).sort(), ['enabled', 'id', 'key', 'name', 'status'])
  assert.deepEqual(c.days[0].byVoice, { voice_a: { requests: 3, errors: 1, p50Ms: 500 } })
  assert.deepEqual(c.summary, { requests: 4, errors: 1, errorRate: 0.25, cacheHitRate: 0.5, voice: { voiceId: 'voice_a', requests: 3, errors: 1 } })

  const dflt = await getTtsMetricsDto('LOCAL', {}, NOW, deps)
  assert.deepEqual(dflt.range, { key: '7d', from: '2026-09-30', to: '2026-10-06' })
  assert.equal(metricCalls[1].connectionIds, undefined)
  const one = await getTtsMetricsDto('LOCAL', { range: 'today' }, NOW, deps)
  assert.deepEqual(one.range, { key: 'today', from: '2026-10-06', to: '2026-10-06' })
})
