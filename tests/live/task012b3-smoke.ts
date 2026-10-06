/**
 * task-012b-3 라이브 스모크 — TTS 일별 지표(지연 물화·조회·권한·멱등·동시성·즉석 집계 캐시) + TTS 캐시 정리 실행(픽스처 한정).
 * **DB 에 EngineMetricsDaily 6칸이 push 된 뒤에만** 돈다(Leader 통합 push 후 QA). LLM·M4 호출 0.
 *
 * 실행(우분투 미러 루트, dev 서버 127.0.0.1 — APP_ENV=LOCAL):
 *   node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/c-user
 *   QA_ACCOUNT=admin     node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/c-admin
 *   QA_ACCOUNT=developer node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/c-dev
 *   QA_ACCOUNT=super     node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/c-super
 *   BASE=http://127.0.0.1:3023 [WAIT_LIVE=1] node --env-file=.env --import tsx tests/live/task012b3-smoke.ts /tmp/c-user /tmp/c-admin /tmp/c-dev /tmp/c-super
 *   rm -f /tmp/c-user /tmp/c-admin /tmp/c-dev /tmp/c-super
 *   WAIT_LIVE=1 이면 오늘 즉석 집계의 60초 캐시 만료(61초 대기)까지 확인한다.
 *   - KST 자정 직후 2분(어제가 아직 LIVE 인 유예)과 자정 직전에는 돌리지 않는다(E3·E5 의 날짜 기대가 어긋난다).
 *   - G1 은 첫 지표 조회(A4)부터 60초 안에 끝나야 한다 — 같은 dev 서버로 60초 안에 다른 지표 조회를 섞지 않는다.
 *   - dev 서버의 APP_ENV 도 LOCAL 이어야 물화한다(조회 환경 ≠ APP_ENV 면 행을 쓰지 않는 규칙 — engine/metrics `writable`).
 *
 * DB(개발·운영 공유) — 이 실행이 만드는 행과 정리:
 *   EngineConnection 1(LOCAL, role TTS, enabled=false, key `qa012b3-tts-<난수>` — Fallback 정책에 없어서 실제 합성 경로가 쓰지 않는다)
 *   RequestTrace(LOCAL, refType `qa012b3`, 지난 이틀·오늘 날짜로 createdAt 지정) · EngineMetricsDaily(픽스처 연결 행 — 연결 삭제 시 cascade)
 *   TtsCache 3행 + 파일 3개(키 = 난수 40자, 2000-01-01 시각 — DATA_ROOT/tts-cache 아래)
 *   → finally 에서 전부 id·키로 지운다. 실패로 중단돼도 남은 행 찾기: `refType='qa012b3'` Trace · key LIKE 'qa012b3-tts-%' 연결 · TtsCache createdAt < 2001-01-01.
 * 운영(PRODUCTION) 행은 읽지도 쓰지도 않는다. 다른 실 연결의 지표 행은 이 실행이 계산할 수 있다(지연 물화 — 정상 동작, 값은 실 Trace 기준).
 */
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { PrismaClient, type Prisma } from '@prisma/client'
import { cacheSegments, missingCacheKeys, planCachePrune, prismaCachePruneStore, pruneTtsCache, type CachePruneStore } from '../../src/modules/speech/tts/cache'
import { dataPath, writeDataFile } from '../../src/modules/infra/storage'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3023'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만 허용')
if ((process.env.APP_ENV ?? '').toUpperCase() !== 'LOCAL') throw new Error('APP_ENV=LOCAL 에서만 실행(픽스처는 LOCAL 행)')
const [cUser, cAdmin, cDev, cSuper] = process.argv.slice(2).map((f) => readFileSync(f, 'utf8').trim())
if (!cUser || !cAdmin || !cDev || !cSuper) throw new Error('사용: task012b3-smoke.ts <user> <admin> <developer> <super> 쿠키 파일')
const COOKIE = { USER: cUser, ADMIN: cAdmin, DEVELOPER: cDev, SUPER_ADMIN: cSuper } as const

const prisma = new PrismaClient()
const results: { id: string; ok: boolean; note: string }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}

type Json = Record<string, unknown>
interface Res {
  status: number
  body: { success: boolean; data: Json & { code?: string; details?: Json }; message: string | null }
  text: string
}
async function api(role: keyof typeof COOKIE | null, path: string): Promise<Res> {
  const r = await fetch(`${BASE}${path}`, { headers: role ? { Cookie: COOKIE[role] } : {}, redirect: 'manual' })
  const text = await r.text()
  let body: Res['body']
  try {
    body = JSON.parse(text)
  } catch {
    body = { success: false, data: {}, message: text.slice(0, 120) }
  }
  return { status: r.status, body, text }
}

// ── 날짜(KST) ──────────────────────────────────────────────────────────────
const KST = 9 * 3600_000
const kstDate = (t: Date) => new Date(t.getTime() + KST).toISOString().slice(0, 10)
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const dayStart = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - KST)
const at = (d: string, h: number, m = 0) => new Date(dayStart(d).getTime() + (h * 60 + m) * 60_000)

const TODAY = kstDate(new Date())
const D1 = addDays(TODAY, -3)
const D2 = addDays(TODAY, -2)
const RUN = randomBytes(3).toString('hex')
const KEY = `qa012b3-tts-${RUN}`
const LEAK_TEXT = '本文テスト012b3'
const VA = 'qa_voice_a'
const VB = 'qa_voice_b'

let seq = 0
const traceId = () => `t_qa012b3${RUN}${String(++seq).padStart(5, '0')}`.slice(0, 22).padEnd(22, '0')
const synth = (i: number, o: { ms?: number; rtf?: number; hit?: boolean; voice?: string; status?: string }) => ({
  name: `TTS_SYNTH[${i}]`,
  ms: o.ms ?? 3,
  chunkIndex: i,
  cacheHit: o.hit === true,
  connectionKey: KEY,
  status: o.status ?? 'OK',
  ...(o.rtf !== undefined ? { rtf: o.rtf } : {}),
  ...(o.voice ? { voiceId: o.voice } : {}),
  text: LEAK_TEXT, // 화이트리스트 밖 칸 — 응답에 새면 FAIL
})

const createdTraceIds: string[] = []
let connectionId = ''
const cacheKeys: string[] = []

async function trace(kind: 'PREVIEW' | 'TURN', createdAt: Date, steps: unknown[], userId: string | null): Promise<void> {
  const id = traceId()
  createdTraceIds.push(id)
  await prisma.requestTrace.create({ data: { traceId: id, environment: 'LOCAL', kind, status: 'OK', steps: steps as Prisma.InputJsonValue, createdAt, refType: 'qa012b3', userId } })
}
const preview = (d: Date, s: unknown, ttfaMs: number | null, userId: string | null) =>
  trace('PREVIEW', d, [{ name: 'TTS', ms: 10, sentences: 1, chunks: 1, ttfaMs, status: ttfaMs === null ? 'ERROR' : 'OK' }, s], userId)

type DayDto = Json & { date: string; source: string; byVoice: Json | null }
const daysOf = (r: Res): DayDto[] => {
  const conns = (r.body.data.connections ?? []) as { days: DayDto[] }[]
  return conns[0]?.days ?? []
}
const pick = (d: DayDto | undefined) =>
  d ? { requests: d.requests, errors: d.errors, avgMs: d.avgMs, p50Ms: d.p50Ms, p95Ms: d.p95Ms, p99Ms: d.p99Ms, ttfaP50Ms: d.ttfaP50Ms, ttfaP95Ms: d.ttfaP95Ms, rtfAvg: d.rtfAvg, cacheHitRate: d.cacheHitRate, byVoice: d.byVoice } : null

async function main(): Promise<void> {
  const qaUser = await prisma.user.findUnique({ where: { email: 'qa-bot@thekaiwa.test' }, select: { id: true } })
  const userId = qaUser?.id ?? null
  const engine = await prisma.engine.findFirst({ where: { type: 'TTS' }, select: { id: true } })
  if (!engine) throw new Error('TTS Engine 행 없음(seed 확인)')
  const conn = await prisma.engineConnection.create({
    data: { environment: 'LOCAL', key: KEY, engineId: engine.id, name: 'QA 012b3 TTS', role: 'TTS', connectionType: 'HTTP', enabled: false, status: 'DISABLED', connection: {}, runtime: {}, createdAt: new Date(dayStart(addDays(TODAY, -13))) },
  })
  connectionId = conn.id
  const otherConn = await prisma.engineConnection.findFirst({ where: { environment: 'LOCAL', role: { not: 'TTS' } }, select: { id: true } })

  // ── D1 픽스처(손계산 기대값은 아래 E1) ──
  await preview(at(D1, 10), synth(0, { ms: 600, rtf: 0.5, voice: VA }), 650, userId)
  await preview(at(D1, 11), synth(0, { ms: 800, rtf: 0.7, voice: VB }), 850, userId)
  await preview(new Date(dayStart(D2).getTime() - 1), synth(0, { hit: true, voice: VA }), 10, userId) // D1 23:59:59.999 KST
  await preview(at(D1, 12), synth(0, { ms: 8000, status: 'FAILED', voice: VB }), null, userId)
  await trace(
    'TURN',
    at(D1, 13),
    [
      { name: 'LLM', ms: 2000 },
      synth(0, { ms: 500, rtf: 0.4, voice: VA }),
      { name: 'TTS[0]', ms: 520, chunkIndex: 0, status: 'OK', ttfaServerMs: 520 },
      synth(1, { hit: true, voice: VA }),
      { name: 'TTS[1]', ms: 4, chunkIndex: 1, status: 'OK' },
      { name: 'TTS[2]', ms: 9000, chunkIndex: 2, status: 'FAILED', errorCode: 'TTS_TIMEOUT' }, // 고아 실패 → 이 Trace 의 유일 연결
    ],
    userId,
  )
  // ── D2 픽스처: voiceId 없는 MISS 25건(100~2500ms), 첫 건은 KST 자정 정각 ──
  for (let i = 1; i <= 25; i++) await preview(i === 1 ? dayStart(D2) : at(D2, 9, i), synth(0, { ms: i * 100 }), i * 100 + 10, null)
  // ── 오늘 픽스처 2건 ──
  const nowMin = Math.floor((Date.now() - dayStart(TODAY).getTime()) / 60_000)
  await preview(at(TODAY, 0, Math.max(0, nowMin - 2)), synth(0, { ms: 300 }), 310, null)
  await preview(at(TODAY, 0, Math.max(0, nowMin - 1)), synth(0, { ms: 300 }), 310, null)

  const q = `/api/admin/v1/tts/metrics?range=7d&connectionId=${connectionId}`

  // A. 권한
  check('A1 세션 없음 401', (await api(null, q)).status === 401)
  check('A2 USER 404(콘솔 비노출)', (await api('USER', q)).status === 404)
  const a3 = await api('ADMIN', q)
  check('A3 ADMIN 403 missing trace.read', a3.status === 403 && JSON.stringify(a3.body.data.details?.missing) === '["trace.read"]', String(a3.status))
  const r1 = await api('DEVELOPER', q)
  check('A4 DEVELOPER 200', r1.status === 200 && r1.body.success === true, String(r1.status))
  check('A5 SUPER_ADMIN 200', (await api('SUPER_ADMIN', q)).status === 200)

  // B. 입력
  check('B1 range=365d 400', (await api('DEVELOPER', '/api/admin/v1/tts/metrics?range=365d')).status === 400)
  check('B2 voiceId 형식 400', (await api('DEVELOPER', '/api/admin/v1/tts/metrics?voiceId=..%2Fx')).status === 400)
  check('B3 없는 connectionId 404', (await api('DEVELOPER', '/api/admin/v1/tts/metrics?connectionId=nope_conn_012b3')).status === 404)
  if (otherConn) check('B4 TTS 가 아닌 연결 400', (await api('DEVELOPER', `/api/admin/v1/tts/metrics?connectionId=${otherConn.id}`)).status === 400)

  // E. 손계산 대조
  const days = daysOf(r1)
  const d1 = days.find((d) => d.date === D1)
  const d2 = days.find((d) => d.date === D2)
  const dT = days.find((d) => d.date === TODAY)
  check('E0 기간 7일·오늘 포함', days.length === 7 && days[6]?.date === TODAY, days.map((d) => d.date).join(','))
  check('E1 D1 물화 값 = 손계산', d1?.source === 'MATERIALIZED' && JSON.stringify(pick(d1)) === JSON.stringify({
    requests: 7, errors: 2, avgMs: 633, p50Ms: 600, p95Ms: null, p99Ms: null, ttfaP50Ms: 520, ttfaP95Ms: null, rtfAvg: 0.5333, cacheHitRate: 0.2857,
    byVoice: { [VA]: { requests: 4, errors: 0, p50Ms: 500 }, [VB]: { requests: 2, errors: 1, p50Ms: 800 } },
  }), JSON.stringify(pick(d1)))
  check('E2 D2 물화 값 = 손계산(p95 n=25 계산, p99 null, voiceId 없는 행 → byVoice null)', d2?.source === 'MATERIALIZED' && JSON.stringify(pick(d2)) === JSON.stringify({
    requests: 25, errors: 0, avgMs: 1300, p50Ms: 1300, p95Ms: 2400, p99Ms: null, ttfaP50Ms: 1310, ttfaP95Ms: 2410, rtfAvg: null, cacheHitRate: 0, byVoice: null,
  }), JSON.stringify(pick(d2)))
  check('E3 표본 0 인 날 = 0·null(MATERIALIZED)', days.filter((d) => d.date !== D1 && d.date !== D2 && d.date !== TODAY).every((d) => d.source === 'MATERIALIZED' && d.requests === 0 && d.p50Ms === null))
  check('E4 오늘 = LIVE, 저장 안 함', dT?.source === 'LIVE' && dT.requests === 2 && (await prisma.engineMetricsDaily.count({ where: { connectionId, date: new Date(`${TODAY}T00:00:00Z`) } })) === 0, JSON.stringify(pick(dT)))
  const rows1 = await prisma.engineMetricsDaily.findMany({ where: { connectionId }, orderBy: { date: 'asc' } })
  check('E5 물화 행 = 끝난 6일 × 1', rows1.length === 6, String(rows1.length))

  // D. 멱등 — 다시 조회해도 행·값·계산 시각 그대로
  const r2 = await api('DEVELOPER', q)
  const rows2 = await prisma.engineMetricsDaily.findMany({ where: { connectionId }, orderBy: { date: 'asc' } })
  check('D1 두 번째 조회 — 행 수·computedAt·값 동일', rows2.length === 6 && rows2.every((r, i) => r.computedAt.getTime() === rows1[i].computedAt.getTime()) && JSON.stringify(daysOf(r2).slice(0, 6)) === JSON.stringify(days.slice(0, 6)))

  // C. 동시성 — 행을 지우고 두 요청을 동시에
  await prisma.engineMetricsDaily.deleteMany({ where: { connectionId } })
  const [c1, c2] = await Promise.all([api('DEVELOPER', q), api('SUPER_ADMIN', q)])
  const rows3 = await prisma.engineMetricsDaily.findMany({ where: { connectionId } })
  const sameVals = (a: DayDto[], b: DayDto[]) => JSON.stringify(a.slice(0, 6).map(pick)) === JSON.stringify(b.slice(0, 6).map(pick))
  check('C1 동시 두 요청 — 200·200, 행 6개((연결,날짜)당 1), 값 = 처음과 같음', c1.status === 200 && c2.status === 200 && rows3.length === 6 && sameVals(daysOf(c1), days) && sameVals(daysOf(c2), days), `${c1.status}/${c2.status}/${rows3.length}`)

  // F. 목소리 필터
  const fv = await api('DEVELOPER', `${q}&voiceId=${VA}`)
  const fd1 = daysOf(fv).find((d) => d.date === D1)
  const sum = ((fv.body.data.connections ?? []) as { summary: Json }[])[0]?.summary
  check('F1 voiceId 필터 — byVoice 는 그 목소리만, 합계 voice', JSON.stringify(fd1?.byVoice) === JSON.stringify({ [VA]: { requests: 4, errors: 0, p50Ms: 500 } }) && JSON.stringify(sum?.voice) === JSON.stringify({ voiceId: VA, requests: 4, errors: 0 }))

  // G. 오늘 즉석 집계 60초 캐시
  await preview(at(TODAY, 0, Math.max(0, nowMin)), synth(0, { ms: 300 }), 310, null)
  const g1 = daysOf(await api('DEVELOPER', q)).find((d) => d.date === TODAY)
  check('G1 60초 안 재조회 — 캐시 값(2) 그대로', g1?.requests === 2, String(g1?.requests))
  if (process.env.WAIT_LIVE === '1') {
    await new Promise((r) => setTimeout(r, 61_000))
    const g2 = daysOf(await api('DEVELOPER', q)).find((d) => d.date === TODAY)
    check('G2 61초 뒤 — 새 Trace 반영(3)', g2?.requests === 3, String(g2?.requests))
  }

  // K. 다른 환경 보기 — DEVELOPER 는 403(environment.policy), SUPER_ADMIN 은 200 이지만 그 환경 행을 쓰지 않는다(writable=false). PRODUCTION 은 건드리지 않는다.
  const devEnvIds = (await prisma.engineConnection.findMany({ where: { environment: 'DEVELOPMENT', role: 'TTS' }, select: { id: true } })).map((c) => c.id)
  const emdBefore = await prisma.engineMetricsDaily.count({ where: { connectionId: { in: devEnvIds } } })
  check('K1 DEVELOPER 다른 환경 403', (await api('DEVELOPER', '/api/admin/v1/tts/metrics?environment=DEVELOPMENT')).status === 403)
  const k2 = await api('SUPER_ADMIN', '/api/admin/v1/tts/metrics?range=30d&environment=DEVELOPMENT')
  const emdAfter = await prisma.engineMetricsDaily.count({ where: { connectionId: { in: devEnvIds } } })
  check('K2 SUPER_ADMIN 다른 환경 200·그 환경 행 쓰기 0', k2.status === 200 && emdAfter === emdBefore, `${k2.status} TTS연결 ${devEnvIds.length} 행 ${emdBefore}->${emdAfter}`)

  // H. 누출 — 사용자 id·화이트리스트 밖 본문·서버 비밀값 없음
  const allText = [r1.text, r2.text, c1.text, fv.text].join('\n')
  const needles = ['JWT_SECRET', 'SPEECH_INTERNAL_SECRET', 'DATABASE_URL', 'GOOGLE_CLIENT_SECRET'].map((n) => process.env[n]?.trim()).filter((v): v is string => !!v && v.length >= 8)
  check('H1 응답에 QA 사용자 id·본문·시크릿 없음', (!userId || !allText.includes(userId)) && !allText.includes(LEAK_TEXT) && needles.every((v) => !allText.includes(v)))

  // J. 캐시 정리 — 픽스처 3행(2000-01-01)만 실제로 지운다
  const old = new Date('2000-01-01T00:00:00Z')
  for (let i = 0; i < 3; i++) {
    const key = randomBytes(20).toString('hex')
    cacheKeys.push(key)
    await writeDataFile(cacheSegments(key), Buffer.alloc(1000, 1))
    await prisma.ttsCache.create({
      data: { key, normalizedText: 'qa012b3', modelVersion: '0.0.0', style: 'Neutral', styleWeight: 1, speed: 1, pitch: 1, intonation: 1, engineConnectionKey: KEY, textHash: key, path: cacheSegments(key).join('/'), bytes: 1000, createdAt: old },
    })
  }
  const listing = await prismaCachePruneStore.listEntries(200_001)
  const total = listing.reduce((s, r) => s + r.bytes, 0)
  const plan = planCachePrune(listing, { maxBytes: total - 3000, now: new Date() })
  check('J1 LRU 계획 — 가장 오래된 픽스처 3행만 지울 차례', plan.remove.length === 3 && plan.remove.every((r) => cacheKeys.includes(r.key)), `${plan.remove.length}`)
  const dry = await pruneTtsCache({ dryRun: true, maxBytes: total - 3000 })
  check('J2 dryRun — 계획 3, 삭제 0', dry.planned === 3 && dry.deleted === 0 && (await prisma.ttsCache.count({ where: { key: { in: cacheKeys } } })) === 3)
  const fixtureOnly: CachePruneStore = { ...prismaCachePruneStore, listEntries: async () => (await prismaCachePruneStore.listEntries(200_001)).filter((r) => cacheKeys.includes(r.key)) }
  const done = await pruneTtsCache({ dryRun: false, maxBytes: 0, store: fixtureOnly })
  const filesLeft = cacheKeys.filter((k) => existsSync(dataPath(...cacheSegments(k)))).length
  check('J3 실행(픽스처 한정) — 행 3·파일 3 삭제, 남은 크기 ≤ 상한', done.deleted === 3 && done.fileErrors === 0 && filesLeft === 0 && (await prisma.ttsCache.count({ where: { key: { in: cacheKeys } } })) === 0 && done.reachable)
  check('J4 예열 후보 — 지운 키는 전부 missing', (await missingCacheKeys(cacheKeys)).length === 3)
}

async function cleanup(): Promise<void> {
  const t = await prisma.requestTrace.deleteMany({ where: { traceId: { in: createdTraceIds } } })
  const e = connectionId ? await prisma.engineMetricsDaily.deleteMany({ where: { connectionId } }) : { count: 0 }
  const c = connectionId ? await prisma.engineConnection.deleteMany({ where: { id: connectionId } }) : { count: 0 }
  const k = await prisma.ttsCache.deleteMany({ where: { key: { in: cacheKeys } } })
  console.log(`[cleanup] RequestTrace ${t.count} · EngineMetricsDaily ${e.count} · EngineConnection ${c.count} · TtsCache ${k.count} (파일은 J3 가 지움)`)
}

main()
  .catch((e) => {
    check('RUN', false, e instanceof Error ? e.message : String(e))
  })
  .finally(async () => {
    await cleanup().catch((e) => console.error('[cleanup] 실패 — 헤더 주석의 조건으로 남은 행을 지울 것:', e instanceof Error ? e.message : e))
    await prisma.$disconnect()
    const fail = results.filter((r) => !r.ok).length
    console.log(`\n${results.length - fail}/${results.length} PASS`)
    process.exit(fail ? 1 : 0)
  })
