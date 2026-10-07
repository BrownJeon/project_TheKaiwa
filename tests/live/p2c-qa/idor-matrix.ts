/**
 * qa-p2c-A C — 상황 역할극 IDOR·권한 매트릭스(LLM 0). 개발 서버(localhost, 운영 3010 거부)·실제 DB.
 * 행위자 QA2 가 QA4 의 자원(상황·대화·수업·장소·마친/지운 상황)에 접근하면 **없는 id 와 같은 모양**(상태·본문)의 404 여야 한다 — 존재 여부를 흘리지 않는다.
 * 또 비로그인·깨진 쿠키 → 401, USER 의 /admin·/api/admin/v1 → 404/403, 시드 고치기·지우기 → 404 SEED(존재를 숨기지 않는 시드 전용 사유).
 * 사용: BASE=http://127.0.0.1:3033 node --env-file=.env --import tsx tests/live/p2c-qa/idor-matrix.ts <QA4 쿠키> <QA2 쿠키>
 * 정리: 이 실행이 만든 행(제목 MARK)만 지운다 — 대화(cascade)·상황·수업·장소·QA4 오늘 DAILY 는 시작 전 값.
 * LLM 이 불리는 경로(#32 턴·#166 초안 정상·#169 정상·#59 정상)는 본문이 거부되는 요청만 보낸다. 끝에 AiJob·RequestTrace 증가 0 으로 확인.
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../../../src/modules/infra/db'
import { todayKst } from '../../../src/modules/infra/dates'

const SMOKE_ENV = (process.env.SMOKE_ENV ?? process.env.APP_ENV ?? 'LOCAL').toUpperCase()
if (SMOKE_ENV === 'PRODUCTION') throw new Error('PRODUCTION 에서는 실행하지 않는다')
const BASE = process.env.BASE ?? 'http://127.0.0.1:3033'
const url = new URL(BASE)
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || Number(url.port) === 3010) throw new Error('BASE 는 localhost(운영 포트 3010 제외)만 허용')
const [f4, f2] = process.argv.slice(2)
if (!f4 || !f2) throw new Error('사용: idor-matrix.ts <QA4 쿠키> <QA2 쿠키>')
const C4 = readFileSync(f4, 'utf8').trim()
const C2 = readFileSync(f2, 'utf8').trim()
const MARK = `p2cA-idor-${Date.now().toString(36)}`

type Json = Record<string, unknown>
const results: { id: string; ok: boolean; note: string }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})
async function call(cookie: string | null, method: string, path: string, body?: unknown): Promise<{ status: number; raw: string; json: Json; headers: Headers }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) headers.Cookie = cookie
  const r = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' })
  const raw = await r.text()
  let json: Json = {}
  try { json = JSON.parse(raw) as Json } catch { json = {} }
  return { status: r.status, raw, json, headers: r.headers }
}
/** 상태 + 본문 모양(id·traceId·시각 제거) — 존재·비존재 비교용. */
function shape(res: { status: number; json: Json }, ids: string[]): string {
  let s = JSON.stringify(res.json)
  for (const id of ids) if (id) s = s.split(id).join('<ID>')
  s = s.replace(/"traceId":"[^"]*"/g, '"traceId":"-"')
  return `${res.status}:${s}`
}
const fakeId = () => `c${'x'.repeat(24)}`
const made = { scenarioIds: [] as string[], chatIds: [] as string[], lessonIds: [] as string[], topicIds: [] as string[] }

async function main(): Promise<void> {
  const qa4 = await prisma.user.findUnique({ where: { email: 'qa-bot4@thekaiwa.test' }, select: { id: true, provider: true } })
  const qa2 = await prisma.user.findUnique({ where: { email: 'qa-bot2@thekaiwa.test' }, select: { id: true, provider: true } })
  if (!qa4 || !qa2 || qa4.provider !== 'test' || qa2.provider !== 'test') throw new Error('QA4·QA2 계정이 없다')
  const U4 = qa4.id
  const U2 = qa2.id
  const today = todayKst()
  const daily = await prisma.statsSnapshot.findFirst({ where: { userId: U4, kind: 'DAILY', periodKey: today }, select: { id: true, data: true } })
  const jobs0 = await prisma.aiJob.count()
  const traces0 = await prisma.requestTrace.count()
  const since = new Date(Date.now() - 1000)

  try {
    const seedTopic = await prisma.conversationTopic.findFirst({ where: { userId: null, chunks: { some: {} } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true } })
    if (!seedTopic) throw new Error('시드 주제 없음')
    const body = (t: string) => ({
      title: `${MARK} ${t}`, titleJa: 'カフェで注文する', level: 'N5', roles: { learner: '손님', tutor: '점원' },
      goal: { communicativeGoalKo: '음료 크기를 말해 주문해요', successCriteria: ['크기 말하기'] },
      steps: [{ ko: '인사' }, { ko: '주문' }, { ko: '계산' }],
      keyExpressions: [{ ja: 'Lサイズでお願いします', ko: 'L 사이즈로 부탁해요' }, { ja: 'ホットでお願いします', ko: '따뜻한 걸로 부탁해요' }],
      opening: { ja: 'いらっしゃいませ。', ko: '어서 오세요.' }, topicIds: [seedTopic.id],
    })
    // ── 준비 ──
    const s4 = await call(C4, 'POST', '/api/v1/scenarios', body('QA4 상황'))
    const g4 = await call(C4, 'POST', '/api/v1/scenarios', body('QA4 지운 상황'))
    const s2 = await call(C2, 'POST', '/api/v1/scenarios', body('QA2 상황'))
    const S4 = String(s4.json.data ? obj(s4.json.data).id : '')
    const G4 = String(g4.json.data ? obj(g4.json.data).id : '')
    const S2 = String(s2.json.data ? obj(s2.json.data).id : '')
    for (const id of [S4, G4, S2]) if (id && id !== 'undefined') made.scenarioIds.push(id)
    await call(C4, 'DELETE', `/api/v1/scenarios/${G4}`)
    const rp4 = await call(C4, 'POST', '/api/v1/chats', { kind: 'TALK', scenarioId: S4 })
    const CH4 = String(obj(rp4.json.data).id ?? '')
    if (CH4) made.chatIds.push(CH4)
    const msg4 = await prisma.chatMessage.findFirst({ where: { chatId: CH4 }, select: { id: true } })
    const rp2 = await call(C2, 'POST', '/api/v1/chats', { kind: 'TALK', scenarioId: S2 })
    const CH2 = String(obj(rp2.json.data).id ?? '')
    if (CH2) made.chatIds.push(CH2)
    const T4 = await prisma.conversationTopic.create({ data: { userId: U4, title: `${MARK} QA4 장소`, level: 'N5' } as never, select: { id: true } })
    made.topicIds.push(T4.id)
    const L4 = await prisma.lesson.create({ data: { userId: U4, topicId: seedTopic.id, scenarioId: S4, date: new Date(`${today}T00:00:00.000Z`), kind: 'NEW', status: 'READY', title: `${MARK} QA4 상황 수업`, level: 'N5' }, select: { id: true } })
    made.lessonIds.push(L4.id)
    check('0 준비: QA4 상황·지운 상황·역할극 대화·장소·상황 수업 / QA2 상황·역할극 대화', [s4.status, g4.status, s2.status].every((s) => s === 201) && rp4.status === 200 && rp2.status === 200 && !!msg4, `${s4.status}/${g4.status}/${s2.status}/${rp4.status}/${rp2.status}`)

    const before = {
      q2: await Promise.all([prisma.scenario.count({ where: { userId: U2 } }), prisma.chat.count({ where: { userId: U2 } }), prisma.lesson.count({ where: { userId: U2 } }), prisma.studyLog.count({ where: { userId: U2 } }), prisma.repetitionItem.count({ where: { userId: U2 } }), prisma.learningObservation.count({ where: { userId: U2 } })]),
      q4: await Promise.all([prisma.scenario.findUnique({ where: { id: S4 }, select: { title: true, status: true, updatedAt: true } }), prisma.chatMessage.count({ where: { chatId: CH4 } }), prisma.studyLog.count({ where: { userId: U4 } }), prisma.repetitionItem.count({ where: { userId: U4 } }), prisma.learningObservation.count({ where: { userId: U4 } })]),
    }

    // ── 같은 모양 404: QA2 가 QA4 자원 vs 없는 id ──
    const N = fakeId()
    const known = [S4, G4, CH4, L4.id, T4.id, N, msg4?.id ?? '']
    type Case = { id: string; method: string; mk: (x: string) => string; real: string; body?: (x: string) => unknown; want?: number }
    const cases: Case[] = [
      { id: '#162 GET 상세(남의 상황)', method: 'GET', mk: (x) => `/api/v1/scenarios/${x}`, real: S4 },
      { id: '#162 GET 상세(남의 지운 상황 — ARCHIVED 사유 누출 없음)', method: 'GET', mk: (x) => `/api/v1/scenarios/${x}`, real: G4 },
      { id: '#164 PATCH 고치기', method: 'PATCH', mk: (x) => `/api/v1/scenarios/${x}`, real: S4, body: () => ({ title: `${MARK} 해킹` }) },
      { id: '#165 DELETE 지우기', method: 'DELETE', mk: (x) => `/api/v1/scenarios/${x}`, real: S4 },
      { id: '#28 POST 대화 시작 scenarioId(남의 상황)', method: 'POST', mk: () => '/api/v1/chats', real: S4, body: (x) => ({ kind: 'TALK', scenarioId: x }) },
      { id: '#28 POST 대화 시작 scenarioId(남의 지운 상황 — 409 ARCHIVED 누출 없음)', method: 'POST', mk: () => '/api/v1/chats', real: G4, body: (x) => ({ kind: 'TALK', scenarioId: x }) },
      { id: '#28 POST 대화 시작 lessonId(남의 수업)', method: 'POST', mk: () => '/api/v1/chats', real: L4.id, body: (x) => ({ kind: 'TALK', lessonId: x }) },
      { id: '#29 GET 대화(남의 역할극 chat.scenario)', method: 'GET', mk: (x) => `/api/v1/chats/${x}`, real: CH4 },
      { id: '#167 POST 마치기', method: 'POST', mk: (x) => `/api/v1/chats/${x}/scenario/finish`, real: CH4 },
      { id: '#169 POST 대답 연습', method: 'POST', mk: (x) => `/api/v1/chats/${x}/reply-practice`, real: CH4, body: () => ({ messageId: msg4?.id ?? 'x' }) },
      { id: '#59 POST 상황 수업 {scenarioId}(남의 상황)', method: 'POST', mk: () => '/api/v1/lessons', real: S4, body: (x) => ({ scenarioId: x }) },
      { id: '#59 POST 상황 수업 {scenarioId}(남의 지운 상황)', method: 'POST', mk: () => '/api/v1/lessons', real: G4, body: (x) => ({ scenarioId: x }) },
      { id: '#60 GET 수업(남의 상황 수업)', method: 'GET', mk: (x) => `/api/v1/lessons/${x}`, real: L4.id },
      { id: '#166 POST 초안 topicId(남의 장소)', method: 'POST', mk: () => '/api/v1/scenarios/drafts', real: T4.id, body: (x) => ({ description: '카페에서 커피를 주문해요', level: 'N5', topicId: x }), want: 400 },
    ]
    for (const c of cases) {
      const a = await call(C2, c.method, c.mk(c.real), c.body?.(c.real))
      const b = await call(C2, c.method, c.mk(N), c.body?.(N))
      const sa = shape(a, known)
      const sb = shape(b, known)
      check(`C1 ${c.id}`, (c.want ?? 404) === a.status && sa === sb, a.status === 404 && sa === sb ? `${a.status} · 없는 id 와 같은 모양` : (() => { let i = 0; while (i < sa.length && sa[i] === sb[i]) i++; return `첫 차이 @${i}: 남의=…${sa.slice(Math.max(0, i - 20), i + 90)} / 없는=…${sb.slice(Math.max(0, i - 20), i + 90)}` })())
    }

    // ── #27·#161 목록에 남의 것 없음 ──
    const l2 = await call(C2, 'GET', '/api/v1/chats?limit=100')
    const items2 = (obj(l2.json.data).items as Json[] | undefined) ?? []
    check('C2 #27 QA2 목록에 QA4 대화 없음 · QA2 역할극 행만 scenario 칸', l2.status === 200 && !items2.some((i) => i.id === CH4) && items2.every((i) => !('scenario' in i) || obj(i.scenario).id === S2 || i.id === CH2), `items=${items2.length}`)
    const sl2 = await call(C2, 'GET', '/api/v1/scenarios')
    const sitems2 = (obj(sl2.json.data).items as Json[] | undefined) ?? []
    const inProg2 = obj(sl2.json.data).inProgressChatId
    check('C3 #161 QA2 목록: QA4 상황·지운 상황 없음 · inProgressChatId ≠ QA4 대화 · private,no-store', sl2.status === 200 && !sitems2.some((i) => i.id === S4 || i.id === G4) && inProg2 !== CH4 && /no-store/.test(sl2.headers.get('cache-control') ?? ''), `items=${sitems2.length} inProgress=${String(inProg2).slice(0, 8)}`)
    const sl2mine = await call(C2, 'GET', '/api/v1/scenarios?mine=1')
    check('C4 #161 mine=1 은 QA2 것만', ((obj(sl2mine.json.data).items as Json[]) ?? []).every((i) => i.id === S2), `n=${((obj(sl2mine.json.data).items as Json[]) ?? []).length}`)

    // ── 시드: 보이기 · 고치기·지우기 404 SEED(QA2 도) ──
    const seed = sitems2.find((i) => String(i.id).startsWith('scn_'))
    if (!seed) check('C5 시드 상황이 QA2 목록에 보임', false, '시드 0')
    else {
      const sp = await call(C2, 'PATCH', `/api/v1/scenarios/${seed.id}`, { title: `${MARK} 해킹` })
      const sd = await call(C2, 'DELETE', `/api/v1/scenarios/${seed.id}`)
      const still = await prisma.scenario.findUnique({ where: { id: String(seed.id) }, select: { title: true, status: true } })
      const reason = (r: { json: Json }) => obj(obj(r.json.data).details).reason
      check('C5 QA2 가 시드 고치기·지우기 → 404 SEED · 시드 불변', sp.status === 404 && sd.status === 404 && reason(sp) === 'SEED' && reason(sd) === 'SEED' && !!still && still.status === 'ACTIVE' && !still.title.includes(MARK), `patch=${sp.status}/${String(reason(sp))} del=${sd.status}/${String(reason(sd))}`)
      const sg = await call(C2, 'GET', `/api/v1/scenarios/${seed.id}`)
      check('C6 QA2 가 시드 상세 읽기 200', sg.status === 200)
    }

    // ── 인증 ──
    const auth: [string, string, string?, unknown?][] = [
      ['GET', '/api/v1/scenarios'], ['POST', '/api/v1/scenarios', '', body('x')], ['GET', `/api/v1/scenarios/${S4}`], ['PATCH', `/api/v1/scenarios/${S4}`, '', { title: 'x' }], ['DELETE', `/api/v1/scenarios/${S4}`],
      ['POST', '/api/v1/scenarios/drafts', '', { description: '카페에서 커피를 주문해요', level: 'N5' }], ['POST', '/api/v1/chats', '', { kind: 'TALK', scenarioId: S4 }], ['GET', `/api/v1/chats/${CH4}`],
      ['POST', `/api/v1/chats/${CH4}/scenario/finish`], ['POST', `/api/v1/chats/${CH4}/reply-practice`, '', { messageId: msg4?.id }], ['POST', '/api/v1/lessons', '', { scenarioId: S4 }], ['GET', '/api/v1/chats'],
    ]
    const noCookie: string[] = []
    const badCookie: string[] = []
    for (const [m, p, , b] of auth) {
      const r1 = await call(null, m, p, b)
      if (r1.status !== 401) noCookie.push(`${m} ${p.replace(/c[a-z0-9]{20,}/, ':id')}→${r1.status}`)
      const r2 = await call('thekaiwa_session=not-a-jwt', m, p, b)
      if (r2.status !== 401) badCookie.push(`${m} ${p.replace(/c[a-z0-9]{20,}/, ':id')}→${r2.status}`)
    }
    check('C7 쿠키 없음 → 401(12개 경로)', noCookie.length === 0, noCookie.join(' | '))
    check('C8 깨진 쿠키 → 401(12개 경로)', badCookie.length === 0, badCookie.join(' | '))
    const adm = await call(C2, 'GET', '/admin')
    const admApi = await call(C2, 'GET', '/api/admin/v1/overview')
    check('C9 USER 의 /admin → 404(HTML), /api/admin/v1/overview → 404|403', adm.status === 404 && [403, 404].includes(admApi.status), `/admin=${adm.status} api=${admApi.status}`)

    // ── 불변: QA2 시도가 어떤 행도 만들지·바꾸지 않았다 ──
    const after = {
      q2: await Promise.all([prisma.scenario.count({ where: { userId: U2 } }), prisma.chat.count({ where: { userId: U2 } }), prisma.lesson.count({ where: { userId: U2 } }), prisma.studyLog.count({ where: { userId: U2 } }), prisma.repetitionItem.count({ where: { userId: U2 } }), prisma.learningObservation.count({ where: { userId: U2 } })]),
      q4: await Promise.all([prisma.scenario.findUnique({ where: { id: S4 }, select: { title: true, status: true, updatedAt: true } }), prisma.chatMessage.count({ where: { chatId: CH4 } }), prisma.studyLog.count({ where: { userId: U4 } }), prisma.repetitionItem.count({ where: { userId: U4 } }), prisma.learningObservation.count({ where: { userId: U4 } })]),
    }
    check('C10 QA2 행 수 불변(상황·대화·수업·StudyLog·반복·관측)', JSON.stringify(before.q2) === JSON.stringify(after.q2), `${before.q2.join(',')} → ${after.q2.join(',')}`)
    check('C11 QA4 상황 S4 불변(제목·상태·updatedAt) · 대화 메시지 수 · StudyLog·반복·관측 불변', JSON.stringify(before.q4) === JSON.stringify(after.q4), `${JSON.stringify(after.q4).slice(0, 140)}`)
    const jobs1 = await prisma.aiJob.count()
    const traces1 = await prisma.requestTrace.count({ where: { createdAt: { gte: since }, userId: { in: [U4, U2] } } })
    check('C12 LLM 0 — QA4·QA2 의 RequestTrace(이 실행 이후) 0 · AiJob 증가 0', traces1 === 0 && jobs1 === jobs0, `trace=${traces1} job ${jobs0}→${jobs1}`)
    void traces0
  } finally {
    // 정리
    for (const id of made.chatIds) await prisma.chat.deleteMany({ where: { id } })
    await prisma.lesson.deleteMany({ where: { id: { in: made.lessonIds } } })
    await prisma.scenario.deleteMany({ where: { OR: [{ id: { in: made.scenarioIds } }, { title: { startsWith: MARK } }] } })
    await prisma.conversationTopic.deleteMany({ where: { id: { in: made.topicIds } } })
    await prisma.studyLog.deleteMany({ where: { userId: { in: [U4, U2] }, createdAt: { gte: since }, refId: { in: made.chatIds } } })
    if (daily) await prisma.statsSnapshot.update({ where: { id: daily.id }, data: { data: daily.data as never } }).catch(() => undefined)
    else await prisma.statsSnapshot.deleteMany({ where: { userId: U4, kind: 'DAILY', periodKey: today, createdAt: { gte: since } } })
    console.log(`(정리: 대화 ${made.chatIds.length} · 상황 ${made.scenarioIds.length} · 수업 ${made.lessonIds.length} · 장소 ${made.topicIds.length})`)
  }
  const fail = results.filter((r) => !r.ok).length
  console.log(`RESULT pass=${results.length - fail} fail=${fail}`)
  process.exitCode = fail ? 1 : 0
}
main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
