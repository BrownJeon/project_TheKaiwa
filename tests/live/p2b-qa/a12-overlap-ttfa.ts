/**
 * qa-p2b — high_risk "대기 중 회화 탭 이동 → 첫 턴 TTFA"(task-044 REV-125 §QA 1 · 설계서 §5-2) — **A12(주제 새 단어 생성)가 도는 동안 회화 TEXT 턴을 하나 걸면**
 * 첫 audio 이벤트(TTFA)·done 이 평소(바로 앞의 한가한 턴)보다 얼마나 느려지는가. LLM 직렬 슬롯에서 혼자 돌린다(Claude CLI 턴 + A12, M4 TTS).
 *   각 회차: (1) 한가한 TEXT 턴 1회(기준) → (2) A12 요청(#47, 응답 안 기다림) 700ms 뒤 TEXT 턴 1회 → 둘 다 끝날 때까지 기다림.
 * 합격 판정이 아니라 참고치(dev 모드·NAS DB). QA 계정 3. 이 실행이 만든 세트·턴 Trace·TALK 방을 지운다(topicWords Trace 는 남김).
 *   BASE=http://127.0.0.1:3032 [REPS=3] node --env-file=.env --import tsx tests/live/p2b-qa/a12-overlap-ttfa.ts /tmp/c3
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../../../src/modules/infra/db'
import { QA_USER_WHERE } from '../../../src/modules/infra/users'

if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 환경에서는 실행하지 않는다')
const BASE = process.env.BASE ?? 'http://127.0.0.1:3032'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE) || BASE.endsWith(':3010')) throw new Error('BASE 는 localhost(운영 3010 제외)만 허용')
const COOKIE = readFileSync(process.argv[2] ?? '', 'utf8').trim()
const REPS = Math.max(1, Math.min(3, Number(process.env.REPS ?? 3)))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
type Json = Record<string, unknown>
async function api(method: string, path: string, body?: unknown): Promise<{ status: number; data: Json }> {
  const r = await fetch(`${BASE}${path}`, { method, headers: { Cookie: COOKIE, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const j = (await r.json().catch(() => ({}))) as { data?: Json }
  return { status: r.status, data: j.data ?? {} }
}
const LINES = ['こんにちは。今日は少し寒いですね。', '週末は何をしましたか。', '駅までどうやって行きますか。', 'おすすめのお店はありますか。', '日本語の勉強は楽しいです。', '最近忙しいですか。']
const traceIds: string[] = []

async function turn(chatId: string, n: number): Promise<{ ttfa: number | null; done: number; ok: boolean }> {
  const reqAt = performance.now()
  const r = await fetch(`${BASE}/api/v1/chats/${chatId}/turns`, { method: 'POST', headers: { Cookie: COOKIE, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: LINES[n % LINES.length], inputSource: 'TEXT' }) })
  if (!(r.headers.get('content-type') ?? '').includes('text/event-stream')) {
    await r.text()
    return { ttfa: null, done: performance.now() - reqAt, ok: false }
  }
  let first: number | null = null
  let done = false
  const reader = r.body!.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done: end } = await reader.read()
    if (end) break
    buf += dec.decode(value, { stream: true })
    let i: number
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i)
      buf = buf.slice(i + 2)
      const ev = /^event: (.+)$/m.exec(block)?.[1]
      const d = /^data: (.+)$/m.exec(block)?.[1]
      if (!ev || !d) continue
      const data = JSON.parse(d) as Json
      if (ev === 'audio' && first === null && data.status === 'OK') first = performance.now()
      if ((ev === 'done' || ev === 'error') && typeof data.traceId === 'string') traceIds.push(data.traceId)
      if (ev === 'done') done = true
    }
  }
  return { ttfa: first === null ? null : first - reqAt, done: performance.now() - reqAt, ok: done }
}

async function main(): Promise<void> {
  const user = await prisma.user.findFirst({ where: { AND: [{ email: 'qa-bot3@thekaiwa.test' }, QA_USER_WHERE] }, select: { id: true } })
  if (!user) throw new Error('QA 계정 3 이 없다')
  const userId = user.id
  if (await prisma.aiJob.count({ where: { userId, status: { in: ['QUEUED', 'RUNNING'] } } })) throw new Error('계정 3 에 실행 중 잡이 있다')
  const topics = (await prisma.conversationTopic.findMany({ where: { userId: null, chunks: { some: {} } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true } })).slice(1, 4)
  const sessionsBefore = new Set((await prisma.vocabSession.findMany({ where: { userId }, select: { id: true } })).map((r) => r.id))
  const snapsBefore = new Set((await prisma.statsSnapshot.findMany({ where: { userId }, select: { id: true } })).map((r) => r.id))
  const since = new Date()
  const chat = await api('POST', '/api/v1/chats', { kind: 'TALK', title: 'p2b a12 overlap' })
  const chatId = String(chat.data.id ?? '')
  if (chat.status !== 200 || !chatId) throw new Error(`TALK 방 생성 실패 ${chat.status}`)
  const rows: { idle: { ttfa: number | null; done: number; ok: boolean }; busy: { ttfa: number | null; done: number; ok: boolean }; a12ReqMs: number; overlapMs: number }[] = []
  try {
    await api('GET', `/api/v1/chats/${chatId}`)
    await sleep(4_000)
    let n = 0
    for (let i = 0; i < REPS; i++) {
      const idle = await turn(chatId, n++)
      await sleep(5_500)
      const t0 = performance.now()
      const a12 = api('POST', '/api/v1/vocab/sessions', { topicId: topics[i].id, count: 5, mode: 'CHOICE' }).then((r) => ({ r, ms: performance.now() - t0 }))
      await sleep(700)
      const tTurn = performance.now()
      const busy = await turn(chatId, n++)
      const a = await a12
      const gen = a.r.data.generation as Json | undefined
      console.log(`rep ${i + 1}: 한가한 턴 ttfa=${idle.ttfa === null ? '-' : Math.round(idle.ttfa)}ms done=${Math.round(idle.done)}ms | A12 중 턴 ttfa=${busy.ttfa === null ? '-' : Math.round(busy.ttfa)}ms done=${Math.round(busy.done)}ms | A12 요청 ${Math.round(a.ms)}ms generatedNow=${String(gen?.generatedNow)} | 턴 시작은 A12 시작 후 ${Math.round(tTurn - t0)}ms${idle.ok && busy.ok ? '' : ' (턴 실패 있음)'}`)
      rows.push({ idle, busy, a12ReqMs: a.ms, overlapMs: tTurn - t0 })
      const sid = (a.r.data.session as Json | undefined)?.id
      if (sid) await api('POST', `/api/v1/vocab/sessions/${String(sid)}/finish`)
      await sleep(5_500)
    }
    const fmt = (v: number | null) => (v === null ? '-' : `${(v / 1000).toFixed(2)}s`)
    const ok = rows.filter((r) => r.idle.ok && r.busy.ok)
    console.log(`\n요약(n=${ok.length}): 한가한 턴 TTFA ${ok.map((r) => fmt(r.idle.ttfa)).join('/')} · A12 중 턴 TTFA ${ok.map((r) => fmt(r.busy.ttfa)).join('/')} · 차이 ${ok.map((r) => fmt((r.busy.ttfa ?? NaN) - (r.idle.ttfa ?? NaN))).join('/')} · done 한가 ${ok.map((r) => fmt(r.idle.done)).join('/')} vs A12 중 ${ok.map((r) => fmt(r.busy.done)).join('/')}`)
  } finally {
    const sessions = (await prisma.vocabSession.findMany({ where: { userId }, select: { id: true } })).map((r) => r.id).filter((id) => !sessionsBefore.has(id))
    if (sessions.length) {
      await prisma.vocabAttempt.deleteMany({ where: { sessionId: { in: sessions } } })
      await prisma.vocabSession.deleteMany({ where: { id: { in: sessions } } })
    }
    const snaps = (await prisma.statsSnapshot.findMany({ where: { userId }, select: { id: true } })).map((r) => r.id).filter((id) => !snapsBefore.has(id))
    if (snaps.length) await prisma.statsSnapshot.deleteMany({ where: { id: { in: snaps } } })
    await prisma.studyLog.deleteMany({ where: { userId, createdAt: { gte: since }, type: 'WORDS' } })
    await prisma.learningObservation.deleteMany({ where: { userId, occurredAt: { gte: since } } })
    await prisma.requestTrace.deleteMany({ where: { userId, traceId: { in: traceIds } } })
    await api('DELETE', `/api/v1/chats/${chatId}`)
    console.log(`(정리: 세트 ${sessions.length} · 스냅샷 ${snaps.length} · 턴 Trace ${traceIds.length} · TALK 방 1)`)
  }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
