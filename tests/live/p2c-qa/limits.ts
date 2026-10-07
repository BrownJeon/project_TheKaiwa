/**
 * qa-p2c-A C — #163 쓰기 한도(LLM 0): ACTIVE 50(409 SCENARIO_LIMIT) · 하루 30(429 DAILY_LIMIT, 지운 행도 셈) · 분당 20(429).
 * 전용 임시 QA 계정(`qa-p2c-lim@thekaiwa.test`, provider test)만 쓴다 — 레인 계정 4·2·1 의 오늘 만든 수·활성 수를 건드리지 않는다. 끝에 그 계정과 행을 지운다.
 * 한도 직전·직후 경계(49↔50 · 29↔30 · 20↔21)를 본다. 하루 30 < ACTIVE 50 이라 API 만으로는 50 에 닿지 않는다 — 어제 날짜로 직접 심은 행으로 만든다.
 * 사용: BASE=http://127.0.0.1:3033 node --env-file=.env --import tsx tests/live/p2c-qa/limits.ts   (분당 한도 구간 때문에 약 70초)
 */
import { chmodSync, writeFileSync } from 'node:fs'
import jwt from 'jsonwebtoken'
import { prisma } from '../../../src/modules/infra/db'
import { SESSION_COOKIE_NAME } from '../../../src/modules/infra/jwt'

if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 금지')
const BASE = process.env.BASE ?? 'http://127.0.0.1:3033'
const url = new URL(BASE)
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || Number(url.port) === 3010) throw new Error('BASE 는 localhost(운영 포트 3010 제외)만 허용')
const EMAIL = 'qa-p2c-lim@thekaiwa.test'
const MARK = `p2cA-lim-${Date.now().toString(36)}`
type Json = Record<string, unknown>
const results: { id: string; ok: boolean }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main(): Promise<void> {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET 없음')
  const user = await prisma.user.upsert({ where: { email: EMAIL }, update: {}, create: { email: EMAIL, name: 'QA p2c lim', provider: 'test', oauthId: 'qa-p2c-lim', role: 'USER' } })
  if (user.provider !== 'test' || user.role !== 'USER' || !user.email.endsWith('@thekaiwa.test')) throw new Error('임시 계정 속성이 예상과 다르다')
  const U = user.id
  const cookie = `${SESSION_COOKIE_NAME}=${jwt.sign({ userId: U, email: EMAIL, qa: true }, secret, { expiresIn: '1h' })}`
  void chmodSync; void writeFileSync
  const call = async (method: string, path: string, body?: unknown) => {
    const r = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) })
    const text = await r.text()
    let json: Json = {}
    try { json = JSON.parse(text) as Json } catch { json = {} }
    return { status: r.status, json, retryAfter: r.headers.get('retry-after') }
  }
  const body = (t: string) => ({
    title: `${MARK} ${t}`, titleJa: 'カフェで注文する', level: 'N5', roles: { learner: '손님', tutor: '점원' },
    goal: { communicativeGoalKo: '음료 크기를 말해 주문해요', successCriteria: ['크기 말하기'] }, steps: [{ ko: '인사' }, { ko: '주문' }, { ko: '계산' }],
    keyExpressions: [{ ja: 'Lサイズでお願いします', ko: 'L 사이즈로 부탁해요' }, { ja: 'ホットでお願いします', ko: '따뜻한 걸로 부탁해요' }],
    opening: { ja: 'いらっしゃいませ。', ko: '어서 오세요.' },
  })
  const count = () => prisma.scenario.count({ where: { userId: U } })
  const active = () => prisma.scenario.count({ where: { userId: U, status: 'ACTIVE' } })
  try {
    await prisma.scenario.deleteMany({ where: { userId: U } })
    // 템플릿 1행(API 로 만든다 — 서버 검사·직렬화 그대로)
    const first = await call('POST', '/api/v1/scenarios', body('템플릿'))
    const tpl = await prisma.scenario.findFirst({ where: { userId: U } })
    check('L0 템플릿 상황 201', first.status === 201 && !!tpl, `status=${first.status}`)
    if (!tpl) return
    const clone = (n: number, createdAt: Date, status: 'ACTIVE' | 'ARCHIVED') =>
      Array.from({ length: n }, (_, i) => ({
        userId: U, isSeed: false, status, title: `${MARK} 심은 ${status}-${i}`, titleJa: tpl.titleJa, description: tpl.description, level: tpl.level, difficulty: tpl.difficulty,
        roles: tpl.roles as never, goal: tpl.goal as never, constraints: tpl.constraints as never, keyExpressions: tpl.keyExpressions as never, completionRule: tpl.completionRule as never, createdAt,
      }))
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000)

    // ── ACTIVE 50 (어제 이전 날짜로 49개 심어 템플릿 포함 50) ──
    await prisma.scenario.createMany({ data: clone(49, threeDaysAgo, 'ACTIVE') })
    check('L1 ACTIVE 50 상태 준비(템플릿 1 + 심은 49)', (await active()) === 50, `active=${await active()}`)
    const over = await call('POST', '/api/v1/scenarios', body('51번째'))
    check('L2 ACTIVE 50 에서 만들기 → 409 SCENARIO_LIMIT · limit 50 · 행 증가 0', over.status === 409 && obj(obj(over.json.data).details).reason === 'SCENARIO_LIMIT' && obj(obj(over.json.data).details).limit === 50 && (await count()) === 50, `status=${over.status} ${JSON.stringify(obj(over.json.data).details)}`)
    // 경계: 하나 지우면(ARCHIVED) 49 → 통과. ARCHIVED 는 ACTIVE 로 세지 않는다
    const victim = await prisma.scenario.findFirst({ where: { userId: U, title: { contains: '심은 ACTIVE-0' } }, select: { id: true } })
    const del = await call('DELETE', `/api/v1/scenarios/${victim!.id}`)
    check('L3 하나 지우면 active 49', del.status === 200 && (await active()) === 49, `active=${await active()}`)
    const under = await call('POST', '/api/v1/scenarios', body('50번째'))
    check('L4 active 49 에서 만들기 → 201 · active 50', under.status === 201 && (await active()) === 50, `status=${under.status}`)
    const again = await call('POST', '/api/v1/scenarios', body('또 51번째'))
    check('L5 다시 50 이면 409 SCENARIO_LIMIT', again.status === 409 && obj(obj(again.json.data).details).reason === 'SCENARIO_LIMIT', `status=${again.status}`)

    // ── 하루 30 (지운 행도 오늘 만든 수에 든다) ──
    await prisma.scenario.deleteMany({ where: { userId: U } })
    const now = new Date()
    // KST 오늘 00:00 이후로 보장 — 지금 시각에서 1분 전(KST 자정 직후가 아니라면 같은 날)
    const justNow = new Date(now.getTime() - 60_000)
    await prisma.scenario.createMany({ data: [...clone(20, justNow, 'ACTIVE'), ...clone(10, justNow, 'ARCHIVED')].map((r, i) => ({ ...r, title: `${MARK} 오늘 ${i}` })) })
    check('L6 오늘 만든 수 30(ACTIVE 20 + ARCHIVED 10) 준비', (await count()) === 30, `count=${await count()}`)
    const daily = await call('POST', '/api/v1/scenarios', body('31번째'))
    const dd = obj(obj(daily.json.data).details)
    check('L7 오늘 30 에서 만들기 → 429 DAILY_LIMIT · limit 30 · retryAfterSec>0 · 행 증가 0', daily.status === 429 && dd.reason === 'DAILY_LIMIT' && dd.limit === 30 && typeof dd.retryAfterSec === 'number' && (dd.retryAfterSec as number) > 0 && (await count()) === 30, `status=${daily.status} ${JSON.stringify(dd)} retry-after=${daily.retryAfter ?? '-'}`)
    // 경계: 한 행을 (물리) 지우면 29 → 통과(오늘 수는 행 기준)
    const one = await prisma.scenario.findFirst({ where: { userId: U, status: 'ARCHIVED' }, select: { id: true } })
    await prisma.scenario.delete({ where: { id: one!.id } })
    const ok29 = await call('POST', '/api/v1/scenarios', body('30번째'))
    check('L8 오늘 29 에서 만들기 → 201', ok29.status === 201, `status=${ok29.status}`)
    const stop30 = await call('POST', '/api/v1/scenarios', body('다시 31번째'))
    check('L9 오늘 30 이면 다시 429 DAILY_LIMIT', stop30.status === 429 && obj(obj(stop30.json.data).details).reason === 'DAILY_LIMIT', `status=${stop30.status}`)
    // 소프트 삭제(API DELETE)가 오늘 수를 줄이지 않는다
    const act = await prisma.scenario.findFirst({ where: { userId: U, status: 'ACTIVE' }, select: { id: true } })
    await call('DELETE', `/api/v1/scenarios/${act!.id}`)
    const stillBlocked = await call('POST', '/api/v1/scenarios', body('지운 뒤 31번째'))
    check('L10 API 로 지워도(ARCHIVED) 오늘 수는 그대로 → 여전히 429 DAILY_LIMIT', stillBlocked.status === 429, `status=${stillBlocked.status}`)

    // ── 분당 20 ──
    await prisma.scenario.deleteMany({ where: { userId: U } })
    console.log('… 분당 한도 구간: 직전 요청이 창에서 빠지도록 65초 대기')
    await sleep(65_000)
    const codes: number[] = []
    for (let i = 0; i < 22; i++) codes.push((await call('POST', '/api/v1/scenarios', {})).status)
    const first20 = codes.slice(0, 20)
    check('L11 분당 20: 앞 20번은 본문 검사까지 가서 400(행 0)', first20.every((c) => c === 400) && (await count()) === 0, `codes[0..19]=${[...new Set(first20)].join(',')}`)
    check('L12 21·22번째는 429 RATE_LIMITED', codes[20] === 429 && codes[21] === 429, `codes[20..21]=${codes[20]},${codes[21]}`)
    const sample = await call('POST', '/api/v1/scenarios', {})
    check('L13 429 응답에 재시도 안내(retry-after 헤더 또는 retryAfter 칸)', sample.status === 429 && (sample.retryAfter !== null || JSON.stringify(sample.json).includes('retry')), `retry-after=${sample.retryAfter ?? '-'} body=${JSON.stringify(sample.json).slice(0, 120)}`)
    // 한도 구간의 429 가 다른 경로를 막지 않는다(키가 scenario-write 만)
    const read = await call('GET', '/api/v1/scenarios')
    check('L14 쓰기 한도 중에도 목록 읽기 200', read.status === 200, `status=${read.status}`)
  } finally {
    const d = await prisma.scenario.deleteMany({ where: { userId: U } })
    const u = await prisma.user.deleteMany({ where: { email: EMAIL, provider: 'test' } }).catch(() => ({ count: -1 }))
    console.log(`(정리: 임시 계정 상황 ${d.count}행 삭제 · 계정 삭제 ${u.count})`)
  }
  const fail = results.filter((r) => !r.ok).length
  console.log(`RESULT pass=${results.length - fail} fail=${fail}`)
  process.exitCode = fail ? 1 : 0
}
main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
