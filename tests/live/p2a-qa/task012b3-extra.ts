/**
 * qa-p2a — task-012b-3 보충 라이브(LLM·M4 0). `tests/live/task012b3-smoke.ts` 가 덮지 않는 REV-119·123 high_risk_areas 를 본다.
 *
 *  X. 부작용 출처 가리기: 실 LOCAL TTS 연결의 EngineMetricsDaily 행을 SINCE 이후 만든 것만 지우고(파생 캐시 — 다시 계산됨), 단독 요청
 *     (오류 400·404 3종은 물화 전에 끝나 행 0이어야 하고, connectionId 지정 정상 요청은 설계상 환경 전체 물화 — 정보로 기록)이 그 행을 만드는지 하나씩 센다.
 *  C. 동시 요청 반복(N=5, 매 회 픽스처 행을 지우고 3 요청 동시) — 전부 200·행 6개·값이 첫 값과 같음(MariaDB 실 인스턴스의 upsert 경합 — 유일한 증거).
 *  D. 한 날 행만 지운 뒤 재조회 → 그 날만 같은 값으로 다시 계산·computedAt 만 새로, 나머지 행·computedAt 불변.
 *  P. `voiceId=constructor|toString|__proto__` → byVoice null · summary.voice {voiceId, 0, 0}, 응답 200.
 *  T. 전체 TtsCache 행 수 전후 동일(정리 실행은 이 도구가 부르지 않는다).
 *
 * 실행(미러, dev 서버 127.0.0.1·APP_ENV=LOCAL):
 *   QA_ACCOUNT=developer node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/c-dev
 *   QA_ACCOUNT=super     node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/c-super
 *   BASE=http://127.0.0.1:3031 SINCE=<ISO> node --env-file=.env --import tsx tests/live/p2a-qa/task012b3-extra.ts /tmp/c-dev /tmp/c-super
 * 만드는 행: EngineConnection 1(LOCAL, enabled=false, key `qa012b3x-tts-<난수>`)·RequestTrace(refType `qa012b3x`)·그 연결의 EngineMetricsDaily — 끝에 전부 지운다.
 * 추가로 SINCE 이후 계산된 **실 LOCAL TTS 연결의** EngineMetricsDaily 행도 지운다(이 QA 실행이 부른 지연 물화의 부산물, 파생값). PRODUCTION 행은 읽지도 쓰지도 않는다.
 */
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { PrismaClient, type Prisma } from '@prisma/client'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3031'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE) || BASE.endsWith(':3010')) throw new Error('BASE 는 localhost(운영 3010 제외)만 허용')
if ((process.env.APP_ENV ?? '').toUpperCase() !== 'LOCAL') throw new Error('APP_ENV=LOCAL 에서만 실행')
const SINCE = new Date(process.env.SINCE ?? '')
if (Number.isNaN(SINCE.getTime())) throw new Error('SINCE=<ISO 시각> 필요')
const [cDev, cSuper] = process.argv.slice(2).map((f) => readFileSync(f, 'utf8').trim())
if (!cDev || !cSuper) throw new Error('사용: task012b3-extra.ts <developer 쿠키> <super 쿠키>')

const prisma = new PrismaClient()
const results: { id: string; ok: boolean }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
const info = (m: string) => console.log(`INFO ${m}`)

type Json = Record<string, unknown>
interface Res {
  status: number
  body: { data: Json }
  text: string
}
async function api(cookie: string, path: string): Promise<Res> {
  const r = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie }, redirect: 'manual' })
  const text = await r.text()
  let body: Res['body'] = { data: {} }
  try {
    body = JSON.parse(text)
  } catch {
    body = { data: {} }
  }
  return { status: r.status, body, text }
}

const KST = 9 * 3600_000
const kstDate = (t: Date) => new Date(t.getTime() + KST).toISOString().slice(0, 10)
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const dayStart = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - KST)
const at = (d: string, h: number, m = 0) => new Date(dayStart(d).getTime() + (h * 60 + m) * 60_000)
const TODAY = kstDate(new Date())
const D1 = addDays(TODAY, -3)
const D2 = addDays(TODAY, -2)
const RUN = randomBytes(3).toString('hex')
const KEY = `qa012b3x-tts-${RUN}`
let seq = 0
const traceId = () => `t_qax${RUN}${String(++seq).padStart(5, '0')}`.slice(0, 22).padEnd(22, '0')
const createdTraceIds: string[] = []
let connectionId = ''

async function preview(createdAt: Date, ms: number, voice: string | null, ttfa: number): Promise<void> {
  const id = traceId()
  createdTraceIds.push(id)
  const step = { name: 'TTS_SYNTH[0]', ms, chunkIndex: 0, cacheHit: false, connectionKey: KEY, status: 'OK', rtf: 0.5, ...(voice ? { voiceId: voice } : {}) }
  await prisma.requestTrace.create({
    data: {
      traceId: id,
      environment: 'LOCAL',
      kind: 'PREVIEW',
      status: 'OK',
      steps: [{ name: 'TTS', ms: 10, sentences: 1, chunks: 1, ttfaMs: ttfa, status: 'OK' }, step] as Prisma.InputJsonValue,
      createdAt,
      refType: 'qa012b3x',
      userId: null,
    },
  })
}

type Day = Json & { date: string; source: string; byVoice: Json | null }
const daysOf = (r: Res): Day[] => ((r.body.data.connections ?? []) as { days: Day[] }[])[0]?.days ?? []
const vals = (d: Day[]) => JSON.stringify(d.slice(0, 6).map((x) => [x.date, x.requests, x.errors, x.avgMs, x.p50Ms, x.p95Ms, x.ttfaP50Ms, x.rtfAvg, x.cacheHitRate, x.byVoice]))

async function realLocalEmdSince(): Promise<{ id: string; key: string; date: string }[]> {
  const rows = await prisma.engineMetricsDaily.findMany({
    where: { computedAt: { gte: SINCE }, connection: { environment: 'LOCAL', key: { not: KEY } } },
    select: { id: true, date: true, connection: { select: { key: true } } },
  })
  return rows.map((r) => ({ id: r.id, key: r.connection.key, date: r.date.toISOString().slice(0, 10) }))
}

async function main(): Promise<void> {
  const ttsCacheBefore = await prisma.ttsCache.count()
  const engine = await prisma.engine.findFirst({ where: { type: 'TTS' }, select: { id: true } })
  if (!engine) throw new Error('TTS Engine 행 없음')
  const conn = await prisma.engineConnection.create({
    data: { environment: 'LOCAL', key: KEY, engineId: engine.id, name: 'QA 012b3x TTS', role: 'TTS', connectionType: 'HTTP', enabled: false, status: 'DISABLED', connection: {}, runtime: {}, createdAt: dayStart(addDays(TODAY, -13)) },
  })
  connectionId = conn.id
  await preview(at(D1, 10), 600, 'qa_voice_a', 650)
  await preview(at(D1, 11), 800, 'qa_voice_b', 850)
  for (let i = 1; i <= 5; i++) await preview(i === 1 ? dayStart(D2) : at(D2, 9, i), i * 100, null, i * 100 + 10)

  // X. 부작용 출처 — 먼저 SINCE 이후 실 연결 행을 지운다(이전 스모크 부산물 포함).
  const stray = await realLocalEmdSince()
  info(`SINCE 이후 실 LOCAL 연결 행 ${stray.length}개(${[...new Set(stray.map((s) => s.key))].join(',') || '-'}) → 지우고 단독 요청으로 출처 확인`)
  await prisma.engineMetricsDaily.deleteMany({ where: { id: { in: stray.map((s) => s.id) } } })
  const q = `/api/admin/v1/tts/metrics?range=7d&connectionId=${connectionId}`
  // 오류 요청(검증 400·404)은 물화 전에 끝나야 한다 → 실 연결 행 0. 정상 요청(connectionId 지정)은 설계상 환경 TTS 연결 전부를 물화한다(index.ts 주석 "필터와 무관") → 정보로만.
  const errProbes: [string, string][] = [
    ['X2 range=365d(400)', '/api/admin/v1/tts/metrics?range=365d'],
    ['X3 voiceId 형식 오류(400)', '/api/admin/v1/tts/metrics?voiceId=..%2Fx'],
    ['X4 없는 connectionId(404)', '/api/admin/v1/tts/metrics?connectionId=nope_conn_x'],
  ]
  const probeResult: string[] = []
  for (const [name, path] of errProbes) {
    const r = await api(cDev, path)
    const n = (await realLocalEmdSince()).length
    probeResult.push(`${name.slice(0, 2)}:${r.status}/실연결행${n}`)
    check(`${name} → 실 LOCAL 연결 행 생성 0`, n === 0, `status ${r.status} 실연결행 ${n}`)
  }
  const x1 = await api(cDev, q)
  const x1n = await realLocalEmdSince()
  info(`X1 connectionId=픽스처(${x1.status}) → 실 LOCAL 연결 행 ${x1n.length}개 생성(${[...new Set(x1n.map((a) => a.key))].join(',')}) — 설계상(필터와 무관한 환경 전체 물화)`)
  await prisma.engineMetricsDaily.deleteMany({ where: { id: { in: x1n.map((a) => a.id) } } })

  // 기준 값(픽스처)
  await prisma.engineMetricsDaily.deleteMany({ where: { connectionId } })
  const first = await api(cDev, q)
  const base = vals(daysOf(first))
  const rowsFirst = await prisma.engineMetricsDaily.findMany({ where: { connectionId }, orderBy: { date: 'asc' } })
  check('C0 기준 조회 — 200·행 6·D1 requests 2·D2 requests 5', first.status === 200 && rowsFirst.length === 6 && rowsFirst.find((r) => r.date.toISOString().slice(0, 10) === D1)?.requests === 2 && rowsFirst.find((r) => r.date.toISOString().slice(0, 10) === D2)?.requests === 5, `${first.status}/${rowsFirst.length}`)

  // C. 동시 요청 5회 반복(3 요청 동시)
  let bad = 0
  const codes: number[] = []
  for (let round = 1; round <= 5; round++) {
    await prisma.engineMetricsDaily.deleteMany({ where: { connectionId } })
    const rs = await Promise.all([api(cDev, q), api(cSuper, q), api(cDev, q)])
    const rows = await prisma.engineMetricsDaily.findMany({ where: { connectionId } })
    const okAll = rs.every((r) => r.status === 200 && vals(daysOf(r)) === base) && rows.length === 6
    codes.push(...rs.map((r) => r.status))
    if (!okAll) bad++
    info(`C 회차 ${round}: ${rs.map((r) => r.status).join('/')} 행 ${rows.length} 값같음 ${rs.every((r) => vals(daysOf(r)) === base)}`)
  }
  check('C1 동시 3요청 × 5회 — 500 0·전부 200·행 6·값 동일', bad === 0 && codes.every((c) => c === 200), `불일치 회차 ${bad} 상태 ${[...new Set(codes)].join(',')}`)

  // D. 한 날 삭제 후 재계산
  const before = await prisma.engineMetricsDaily.findMany({ where: { connectionId }, orderBy: { date: 'asc' } })
  const target = before.find((r) => r.date.toISOString().slice(0, 10) === D1)!
  await prisma.engineMetricsDaily.delete({ where: { id: target.id } })
  const d = await api(cDev, q)
  const after = await prisma.engineMetricsDaily.findMany({ where: { connectionId }, orderBy: { date: 'asc' } })
  const same = after.length === 6 && after.every((r, i) => r.date.getTime() === before[i].date.getTime() && (r.date.getTime() === target.date.getTime() ? r.requests === target.requests && r.computedAt.getTime() > target.computedAt.getTime() : r.computedAt.getTime() === before[i].computedAt.getTime()))
  check('D1 한 날 행 삭제 → 그 날만 같은 값으로 재계산·나머지 computedAt 불변', d.status === 200 && same && vals(daysOf(d)) === base, `${d.status} 행 ${after.length}`)

  // P. 프로토타입 키 이름 voiceId
  for (const v of ['constructor', 'toString', '__proto__']) {
    const r = await api(cDev, `${q}&voiceId=${v}`)
    const conn0 = ((r.body.data.connections ?? []) as { summary: Json }[])[0]
    const sumVoice = JSON.stringify(conn0?.summary?.voice)
    const byV = daysOf(r).every((x) => x.byVoice === null)
    check(`P ${v} → 200·byVoice null·summary.voice {${v},0,0}`, r.status === 200 && byV && sumVoice === JSON.stringify({ voiceId: v, requests: 0, errors: 0 }), `${r.status} ${sumVoice}`)
  }

  // T. TtsCache 행 수 불변
  const ttsCacheAfter = await prisma.ttsCache.count()
  check('T1 전체 TtsCache 행 수 전후 동일', ttsCacheAfter === ttsCacheBefore, `${ttsCacheBefore}->${ttsCacheAfter}`)
  info(`X 요약 ${probeResult.join(' · ')}`)
}

async function cleanup(): Promise<void> {
  const t = await prisma.requestTrace.deleteMany({ where: { traceId: { in: createdTraceIds } } })
  const stray = await realLocalEmdSince()
  const s = await prisma.engineMetricsDaily.deleteMany({ where: { id: { in: stray.map((x) => x.id) } } })
  const e = connectionId ? await prisma.engineMetricsDaily.deleteMany({ where: { connectionId } }) : { count: 0 }
  const c = connectionId ? await prisma.engineConnection.deleteMany({ where: { id: connectionId } }) : { count: 0 }
  console.log(`[cleanup] RequestTrace ${t.count} · 실 연결 EngineMetricsDaily(SINCE 이후 계산분) ${s.count} · 픽스처 EngineMetricsDaily ${e.count} · EngineConnection ${c.count}`)
}

main()
  .catch((e) => check('RUN', false, e instanceof Error ? e.message : String(e)))
  .finally(async () => {
    await cleanup().catch((e) => console.error('[cleanup] 실패:', e instanceof Error ? e.message : e))
    await prisma.$disconnect()
    const fail = results.filter((r) => !r.ok).length
    console.log(`\n${results.length - fail}/${results.length} PASS`)
    process.exit(fail ? 1 : 0)
  })
