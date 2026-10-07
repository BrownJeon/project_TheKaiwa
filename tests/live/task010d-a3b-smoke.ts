/**
 * task-010d A3b-1 라이브 스모크 — 상황 역할극 서버 배선(#28 시작·첫마디 / #32 턴 `done.scenario` / #29 `chat.scenario` / #167 마치기 / 마친 뒤 턴 409 /
 * 종료 vs 턴 동시 / #161 `inProgressChatId` / IDOR)을 **실제 개발 서버(localhost)·실제 DB** 로 친다. 작성만 했고 실행은 QA 몫이다(developer 는 실행하지 않음).
 *
 * 계정: QA4 `qa-bot4@thekaiwa.test`(상황 역할극 레인) = 주 계정 · QA2 `qa-bot2@thekaiwa.test` = 남의 것(IDOR·남의 상황).
 * 단계(LLM 0 / LLM 구분):
 *   [LLM 0] 1 상황 준비: QA4 내 상황 2개(하나는 지워 ARCHIVED) · QA2 상황 1개를 #163 으로 만든다(제목 접두 MARK).
 *   [LLM 0] 2 #28 시작: 내 상황 200(첫마디 → messageCount 1·ASSISTANT DONE 1행·toolLog.source SCENARIO_OPENING) · 남의 상황 404 · ARCHIVED 409 · CHAT 400 · 형식 400
 *           · ★시드 상황 200(시드가 적재돼 있을 때만 — `prisma/seed-data/scenarios.json` 이 DB 에 없으면 SKIP)
 *   [LLM 0] 3 #29: chat.scenario(진행 값 usedIds [] · stepIndex null · ended null) · 첫마디 메시지 · 일반 TALK 대화는 scenario 칸 없음
 *   [LLM 0] 4 0턴 마치기 409 NO_TURNS(행 0) · IDOR: QA2 의 #29·#167·#32 → 404(행 0)
 *   [LLM 0] 5 #161·#162 inProgressChatId = 끝내지 않은 최근 역할극 대화
 *   [LLM]   6 턴(역할극) → done.scenario(usedIds 에 e1·stepIndex null) = #29 progress · Trace PROMPT.rolePlay · 일반 TALK 턴과 TTFA·ACCEPT 비교(측정값 출력, 실패 아님)
 *   [LLM]   7 #167 마치기 200 → 행 수: StudyLog(TALK·DIRECT) 1 · RepetitionItem(SCENARIO) 1 · 관측 SCENARIO_COMPLETED 1 · DAILY repetition.studied+1·observations.total+1
 *           → 다시 마치기 replayed·행 변화 0 → 마친 뒤 턴 409 ROLEPLAY_ENDED(메시지 행 0) → #29 ended = 결과 · inProgress 에서 빠짐 · 종료 Trace 에 원문 0
 *   [LLM]   8 종료 vs 턴 동시(새 역할극 대화) — 허용 결과 셋 중 하나 · 불변식(관측 ≤1 · 기록된 turns = DB 학습자 말 수 · 409 면 행 0)
 * LLM 직렬 슬롯: 턴 4회(역할극 3 · 일반 1) + 종료 판정 2회(+ 경합 결과에 따라 0~1회). 다른 LLM 스모크와 동시에 돌리지 않는다. `SMOKE_LLM=0` 이면 1~5 만.
 * TTS: 6 의 TTFA 비교는 M4 TTS 가 살아 있어야 의미가 있다(없으면 audio 이벤트 0 → 측정 SKIP).
 * 턴당 추가 쿼리: 서버 프로세스의 쿼리 수는 여기서 셀 수 없다(공유 NAS DB 전역 카운터는 운영 트래픽과 섞임). 단위 시험이 고정한 값(재료 1~2 + 끝낸 표식 1 +
 *   학습자 말 1, task010dA3b.test.ts)을 기준으로 두고, 여기서는 Trace `ACCEPT` ms 와 TTFA 를 일반 TALK 와 나란히 출력한다.
 * 정리: 이 실행이 만든 행만 — 대화(메시지·교정 cascade)·그 대화의 StudyLog·관측·Trace·이 실행이 만든 RepetitionItem·상황(MARK)·QA4 오늘 DAILY 는 시작 전 값으로.
 *
 * 가드: `SMOKE_ENV`(없으면 `APP_ENV`)가 PRODUCTION 이면 거부 · BASE 는 localhost 만, 포트 3010(운영) 거부.
 * 실행(우분투 미러, 개발 서버는 따로 — 예 `PORT=3029`):
 *   QA_ACCOUNT=4 node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/q4 && QA_ACCOUNT=2 node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/q2
 *   BASE=http://127.0.0.1:3029 node --env-file=.env --import tsx tests/live/task010d-a3b-smoke.ts /tmp/q4 /tmp/q2 ; rm /tmp/q4 /tmp/q2
 * 끝 줄 `RESULT pass=N fail=M skip=K`, 실패가 있으면 종료 코드 1.
 */
import { readFileSync } from 'node:fs'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../src/modules/infra/db'
// infra index 는 auth·session 까지 불러오므로 날짜 모듈만 직접(다른 스모크 chat-review-measure 와 같은 경로).
import { todayKst } from '../../src/modules/infra/dates'

const SMOKE_ENV = (process.env.SMOKE_ENV ?? process.env.APP_ENV ?? 'LOCAL').toUpperCase()
if (SMOKE_ENV === 'PRODUCTION') throw new Error('PRODUCTION 에서는 실행하지 않는다(새 API — 개발 서버 전용)')
const BASE = process.env.BASE ?? 'http://127.0.0.1:3029'
const url = new URL(BASE)
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || Number(url.port) === 3010) throw new Error('BASE 는 localhost(운영 포트 3010 제외)만 허용')
const LLM_ON = process.env.SMOKE_LLM !== '0'
const [c4file, c2file] = process.argv.slice(2)
if (!c4file || !c2file) throw new Error('사용: task010d-a3b-smoke.ts <QA4 쿠키 파일> <QA2 쿠키 파일>')
const COOKIE4 = readFileSync(c4file, 'utf8').trim()
const COOKIE2 = readFileSync(c2file, 'utf8').trim()
if (!COOKIE4 || !COOKIE2) throw new Error('QA 쿠키 파일이 비어 있다 — qa-session.ts 결과를 확인')

const MARK = `smkA3b-${Date.now().toString(36)}`
// done.traceId 는 계약 칸이라 뺀다. 학습자 원문 누출은 따로 본다.
const LEAK = /claude|haiku|sonnet|opus|qwen|toolLog|home-m4|reazon|whisper|style-?bert|sbv2|SCENARIO_OPENING/i
let leakHits = 0
const results: { id: string; ok: boolean | null; note: string }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
function skip(id: string, note: string): void {
  results.push({ id, ok: null, note })
  console.log(`SKIP ${id} — ${note}`)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** Trace 는 응답 뒤 `void recordTrace` 로 늦게 쓰인다(0.25~1.8초) — `ready` 가 참이 될 때까지 최대 5초(250ms 간격) 다시 읽는다. 끝내 안 되면 마지막 값을 그대로 돌려줘 판정이 FAIL 로 드러난다(기대값은 그대로). */
async function pollUntil<T>(read: () => Promise<T>, ready: (v: T) => boolean, timeoutMs = 5_000, stepMs = 250): Promise<T> {
  const until = Date.now() + timeoutMs
  let v = await read()
  while (!ready(v) && Date.now() < until) {
    await sleep(stepMs)
    v = await read()
  }
  return v
}

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {})
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

async function api(cookie: string, method: string, path: string, body?: unknown): Promise<{ status: number; data: Json }> {
  const r = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  if (LEAK.test(text)) {
    leakHits++
    console.log(`  ! 누출 의심 ${method} ${path}`)
  }
  let data: Json = {}
  try {
    data = obj((JSON.parse(text) as { data?: unknown }).data)
  } catch {
    data = {}
  }
  return { status: r.status, data }
}
const reason = (d: Json) => obj(d.details).reason

interface Ev {
  event: string
  data: Json
  at: number
}
interface Turn {
  status: number
  events: Ev[]
  data: Json
}
async function turn(cookie: string, chatId: string, text: string): Promise<Turn> {
  const t0 = performance.now()
  const r = await fetch(`${BASE}/api/v1/chats/${chatId}/turns`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, inputSource: 'TEXT' }) })
  if (!(r.headers.get('content-type') ?? '').includes('text/event-stream')) {
    const body = await r.text()
    let data: Json = {}
    try {
      data = obj((JSON.parse(body) as { data?: unknown }).data)
    } catch {
      data = {}
    }
    return { status: r.status, events: [], data }
  }
  const events: Ev[] = []
  const reader = r.body!.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    const chunk = dec.decode(value, { stream: true })
    if (LEAK.test(chunk)) {
      leakHits++
      console.log(`  ! 누출 의심 SSE ${chatId}`)
    }
    buf += chunk
    let i: number
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i)
      buf = buf.slice(i + 2)
      if (block.startsWith(':')) continue
      const ev = /^event: (.+)$/m.exec(block)?.[1]
      const d = /^data: (.+)$/m.exec(block)?.[1]
      if (ev && d) events.push({ event: ev, data: JSON.parse(d) as Json, at: performance.now() - t0 })
    }
  }
  return { status: r.status, events, data: {} }
}
/** 429·다른 턴 진행 중 409 는 잠깐 기다렸다 다시(턴 LLM 슬롯 직렬). */
async function turnOk(cookie: string, chatId: string, text: string): Promise<Turn> {
  for (let i = 0; i < 4; i++) {
    const r = await turn(cookie, chatId, text)
    if (r.status !== 429 && !(r.status === 409 && 'runningMessageId' in obj(r.data.details))) return r
    await sleep(r.status === 429 ? 15_000 : 2_000)
  }
  throw new Error('턴이 계속 거절된다')
}
const doneOf = (t: Turn) => t.events.find((e) => e.event === 'done')?.data
const firstAudioAt = (t: Turn) => t.events.find((e) => e.event === 'audio')?.at ?? null

const made = { chatIds: [] as string[], scenarioIds: [] as string[], traceIds: [] as string[] }

async function scenarioRows(U: string, chatId: string, scenarioId: string) {
  const [log, rep, obs, msgs] = await Promise.all([
    prisma.studyLog.count({ where: { userId: U, refId: chatId } }),
    prisma.repetitionItem.count({ where: { userId: U, refType: 'Scenario', refId: scenarioId } }),
    prisma.learningObservation.count({ where: { userId: U, kind: 'SCENARIO_COMPLETED', refType: 'Chat', refId: chatId } }),
    prisma.chatMessage.count({ where: { chatId } }),
  ])
  return { log, rep, obs, msgs }
}

async function main(): Promise<void> {
  const qa4 = await prisma.user.findUnique({ where: { email: 'qa-bot4@thekaiwa.test' }, select: { id: true, provider: true } })
  const qa2 = await prisma.user.findUnique({ where: { email: 'qa-bot2@thekaiwa.test' }, select: { id: true, provider: true } })
  if (!qa4 || !qa2 || qa4.provider !== 'test' || qa2.provider !== 'test') throw new Error('QA4·QA2 계정이 없다 — qa-session.ts(QA_ACCOUNT=4·2)를 먼저 실행')
  const U = qa4.id
  const today = todayKst()
  const dailyBefore = await prisma.statsSnapshot.findUnique({ where: { userId_kind_periodKey: { userId: U, kind: 'DAILY', periodKey: today } }, select: { id: true, data: true } })
  const since = new Date()
  console.log(`[task010d-a3b-smoke] env=${SMOKE_ENV} base=${BASE} run=${MARK} llm=${LLM_ON ? 'on' : 'off'}`)

  try {
    // ── 1 [LLM 0] 상황 준비(#163) ──────────────────────────────────────────
    const body = (title: string) => ({
      title: `${MARK} ${title}`,
      titleJa: 'カフェで注文する',
      level: 'N5',
      roles: { learner: '손님', tutor: '점원' },
      goal: { communicativeGoalKo: '음료 크기와 온도를 말해 주문해요', successCriteria: ['크기 말하기'] },
      steps: [{ ko: '인사' }, { ko: '주문' }, { ko: '계산' }],
      keyExpressions: [{ ja: 'Lサイズ', ko: 'L 사이즈' }, { ja: 'ホットで', ko: '따뜻한 걸로' }],
      opening: { ja: 'いらっしゃいませ。ご注文は？', ko: '어서 오세요. 주문은요?' },
    })
    const mine = await api(COOKIE4, 'POST', '/api/v1/scenarios', body('내 상황'))
    const gone = await api(COOKIE4, 'POST', '/api/v1/scenarios', body('지울 상황'))
    const theirs = await api(COOKIE2, 'POST', '/api/v1/scenarios', body('남의 상황'))
    for (const s of [mine, gone, theirs]) if (typeof s.data.id === 'string') made.scenarioIds.push(s.data.id)
    check('1a #163 상황 3개 201(QA4 2 · QA2 1)', mine.status === 201 && gone.status === 201 && theirs.status === 201, `${mine.status}/${gone.status}/${theirs.status}`)
    const SID = mine.data.id as string
    const GONE = gone.data.id as string
    const THEIRS = theirs.data.id as string
    const del = await api(COOKIE4, 'DELETE', `/api/v1/scenarios/${GONE}`)
    check('1b #165 지우기 → ARCHIVED', del.status === 200 && (await prisma.scenario.findUnique({ where: { id: GONE }, select: { status: true } }))?.status === 'ARCHIVED')

    // ── 2 [LLM 0] #28 시작 ────────────────────────────────────────────────
    const start = await api(COOKIE4, 'POST', '/api/v1/chats', { kind: 'TALK', scenarioId: SID })
    const CHAT = start.data.id as string
    if (CHAT) made.chatIds.push(CHAT)
    check('2a #28 내 상황 200 · scenarioId · 제목 = 상황 제목 · messageCount 1(첫마디)', start.status === 200 && start.data.scenarioId === SID && start.data.title === `${MARK} 내 상황` && start.data.messageCount === 1, `status=${start.status}`)
    const dbChat = CHAT ? await prisma.chat.findUnique({ where: { id: CHAT }, select: { userId: true, kind: true, scenarioId: true, level: true, messageCount: true } }) : null
    const opening = CHAT ? await prisma.chatMessage.findMany({ where: { chatId: CHAT }, select: { role: true, status: true, content: true, translation: true, toolLog: true } }) : []
    check('2b DB Chat(QA4·TALK·scenarioId·N5) + 첫마디 ASSISTANT DONE 1행(원문·번역·toolLog.source)', dbChat?.userId === U && dbChat.kind === 'TALK' && dbChat.scenarioId === SID && dbChat.level === 'N5' && opening.length === 1 && opening[0].role === 'ASSISTANT' && opening[0].status === 'DONE' && opening[0].content === 'いらっしゃいませ。ご注文は？' && opening[0].translation === '어서 오세요. 주문은요?' && obj(opening[0].toolLog).source === 'SCENARIO_OPENING')
    const chatsBefore = await prisma.chat.count({ where: { userId: U } })
    const r404 = await api(COOKIE4, 'POST', '/api/v1/chats', { kind: 'TALK', scenarioId: THEIRS })
    const r409 = await api(COOKIE4, 'POST', '/api/v1/chats', { kind: 'TALK', scenarioId: GONE })
    const r400 = await api(COOKIE4, 'POST', '/api/v1/chats', { kind: 'CHAT', scenarioId: SID })
    const rBad = await api(COOKIE4, 'POST', '/api/v1/chats', { kind: 'TALK', scenarioId: 'x'.repeat(41) })
    check('2c 남의 상황 404 · ARCHIVED 409 · CHAT 400 · id 형식 400', r404.status === 404 && r409.status === 409 && reason(r409.data) === 'ARCHIVED' && r400.status === 400 && rBad.status === 400, `${r404.status}/${r409.status}:${String(reason(r409.data))}/${r400.status}/${rBad.status}`)
    check('2d 거부된 시작은 Chat 행 0', (await prisma.chat.count({ where: { userId: U } })) === chatsBefore)
    // ★ 시드 의존: 시드 상황(prisma/seed-data/scenarios.json)이 DB 에 적재돼 있어야 한다.
    const list = await api(COOKIE4, 'GET', '/api/v1/scenarios')
    const seed = ((list.data.items ?? []) as Json[]).find((i) => i.isMine === false)
    if (seed) {
      const s = await api(COOKIE4, 'POST', '/api/v1/chats', { kind: 'TALK', scenarioId: seed.id })
      if (typeof s.data.id === 'string') made.chatIds.push(s.data.id)
      const seedRow = await prisma.scenario.findUnique({ where: { id: seed.id as string }, select: { constraints: true } })
      const hasOpening = typeof obj(obj(seedRow?.constraints).opening).ja === 'string'
      check('2e ★시드 상황 시작 200 · messageCount = 첫마디 유무', s.status === 200 && s.data.scenarioId === seed.id && s.data.messageCount === (hasOpening ? 1 : 0), `seed=${String(seed.id)} opening=${hasOpening}`)
    } else skip('2e ★시드 상황 시작', '시드 상황이 DB 에 없다(prisma db seed 로 scenarios.json 적재 후 다시)')

    // ── 3 [LLM 0] #29 ────────────────────────────────────────────────────
    const d0 = await api(COOKIE4, 'GET', `/api/v1/chats/${CHAT}`)
    const sc0 = obj(obj(d0.data.chat).scenario)
    check('3a #29 chat.scenario: id · 표현 e1·e2 · 필수 수 · progress {[] , null} · ended null', d0.status === 200 && sc0.id === SID && JSON.stringify(((sc0.keyExpressions ?? []) as Json[]).map((e) => e.id)) === '["e1","e2"]' && typeof sc0.requiredExpressions === 'number' && JSON.stringify(sc0.progress) === '{"usedIds":[],"stepIndex":null}' && sc0.ended === null, JSON.stringify(sc0.progress))
    const msgs0 = (d0.data.messages ?? []) as Json[]
    check('3b #29 메시지 = 첫마디 선생님 1개', msgs0.length === 1 && msgs0[0].role === 'ASSISTANT' && msgs0[0].content === 'いらっしゃいませ。ご注文は？')
    const plain = await api(COOKIE4, 'POST', '/api/v1/chats', { kind: 'TALK' })
    const PLAIN = plain.data.id as string
    if (PLAIN) made.chatIds.push(PLAIN)
    const dp = await api(COOKIE4, 'GET', `/api/v1/chats/${PLAIN}`)
    check('3c 일반 TALK 대화의 #29 chat 에는 scenario 칸 없음', dp.status === 200 && !('scenario' in obj(dp.data.chat)))

    // ── 4 [LLM 0] 0턴 마치기 · IDOR ─────────────────────────────────────────
    const rows0 = await scenarioRows(U, CHAT, SID)
    const f0 = await api(COOKIE4, 'POST', `/api/v1/chats/${CHAT}/scenario/finish`)
    check('4a 0턴(첫마디만) 마치기 409 NO_TURNS · 행 0', f0.status === 409 && reason(f0.data) === 'NO_TURNS' && JSON.stringify(await scenarioRows(U, CHAT, SID)) === JSON.stringify(rows0), `status=${f0.status}`)
    const i29 = await api(COOKIE2, 'GET', `/api/v1/chats/${CHAT}`)
    const i167 = await api(COOKIE2, 'POST', `/api/v1/chats/${CHAT}/scenario/finish`)
    const i32 = await turn(COOKIE2, CHAT, 'Lサイズで')
    check('4b IDOR: QA2 의 #29·#167·#32 → 404 · 행 변화 0', i29.status === 404 && i167.status === 404 && i32.status === 404 && JSON.stringify(await scenarioRows(U, CHAT, SID)) === JSON.stringify(rows0), `${i29.status}/${i167.status}/${i32.status}`)
    const fPlain = await api(COOKIE4, 'POST', `/api/v1/chats/${PLAIN}/scenario/finish`)
    check('4c 일반 TALK 대화 마치기 400(역할극 아님)', fPlain.status === 400, `status=${fPlain.status}`)

    // ── 5 [LLM 0] inProgressChatId ──────────────────────────────────────────
    const det = await api(COOKIE4, 'GET', `/api/v1/scenarios/${SID}`)
    check('5a #162 inProgressChatId = 방금 시작한 대화', det.status === 200 && det.data.inProgressChatId === CHAT, String(det.data.inProgressChatId))

    if (!LLM_ON) {
      skip('6~8 LLM 단계', 'SMOKE_LLM=0')
      return
    }

    // ── 6 [LLM 슬롯] 턴 → done.scenario · TTFA 비교 ───────────────────────────
    const t1 = await turnOk(COOKIE4, CHAT, 'Lサイズのコーヒーをください')
    const done1 = obj(doneOf(t1))
    const prog1 = obj(done1.scenario)
    if (typeof done1.traceId === 'string') made.traceIds.push(done1.traceId)
    check('6a 턴 SSE done.scenario: usedIds 에 e1 · stepIndex null', t1.status === 200 && Array.isArray(prog1.usedIds) && (prog1.usedIds as string[]).includes('e1') && prog1.stepIndex === null, JSON.stringify(prog1))
    const d1 = await api(COOKIE4, 'GET', `/api/v1/chats/${CHAT}`)
    check('6b #29 progress = done.scenario(같은 코드 계산)', JSON.stringify(obj(obj(d1.data.chat).scenario).progress) === JSON.stringify(prog1))
    const waitTrace = async (id: unknown) => {
      if (typeof id !== 'string') return null
      const traceId = id
      return pollUntil(() => prisma.requestTrace.findUnique({ where: { traceId }, select: { steps: true } }), (r) => r !== null)
    }
    const tr1 = await waitTrace(done1.traceId)
    const steps1 = (Array.isArray(tr1?.steps) ? tr1.steps : []) as Json[]
    check('6c Trace PROMPT.rolePlay=true', steps1.some((s) => s.name === 'PROMPT' && s.rolePlay === true))
    // 비교: 일반 TALK 1턴 → 역할극 1턴(같은 길이 말). 둘 다 예열된 뒤라 순서 영향이 작다.
    const tp = await turnOk(COOKIE4, PLAIN, 'ホットのコーヒーをください')
    const t2 = await turnOk(COOKIE4, CHAT, 'ホットでお願いします')
    for (const t of [tp, t2]) {
      const id = obj(doneOf(t)).traceId
      if (typeof id === 'string') made.traceIds.push(id)
    }
    const acceptMs = async (t: Turn) => {
      const tr = await waitTrace(obj(doneOf(t)).traceId)
      return num(((Array.isArray(tr?.steps) ? tr.steps : []) as Json[]).find((s) => s.name === 'ACCEPT')?.ms)
    }
    const ttfaServer = async (chatId: string) => num(obj((await prisma.chatMessage.findFirst({ where: { chatId, role: 'ASSISTANT', status: 'DONE' }, orderBy: { createdAt: 'desc' }, select: { toolLog: true } }))?.toolLog).ttfaMs)
    const [aP, aR, sP, sR] = [await acceptMs(tp), await acceptMs(t2), await ttfaServer(PLAIN), await ttfaServer(CHAT)]
    const [cP, cR] = [firstAudioAt(tp), firstAudioAt(t2)]
    console.log(`MEASURE 일반 TALK: ACCEPT ${aP}ms · 서버 TTFA ${sP}ms · 클라 첫 audio ${cP === null ? '-' : Math.round(cP)}ms`)
    console.log(`MEASURE 역할극  : ACCEPT ${aR}ms · 서버 TTFA ${sR}ms · 클라 첫 audio ${cR === null ? '-' : Math.round(cR)}ms`)
    check('6d 두 턴 모두 done(역할극 done.scenario 에 e1·e2 누적)', !!doneOf(tp) && JSON.stringify(obj(obj(doneOf(t2)).scenario).usedIds) === '["e1","e2"]', JSON.stringify(obj(doneOf(t2)).scenario))
    if (cP === null || cR === null) skip('6e TTFA 비교', 'audio 이벤트 없음(M4 TTS 확인)')
    else if (cR > cP + 1500) console.log(`WARN 6e 역할극 첫 audio 가 일반보다 ${Math.round(cR - cP)}ms 늦다(1회 측정 — 반복 측정으로 확인)`)

    // ── 7 [LLM 슬롯] #167 마치기 → 행 수 · 재종료 · 마친 뒤 턴 ───────────────────
    const learnerCount = await prisma.chatMessage.count({ where: { chatId: CHAT, role: 'USER' } })
    const fin = await api(COOKIE4, 'POST', `/api/v1/chats/${CHAT}/scenario/finish`)
    const rows1 = await scenarioRows(U, CHAT, SID)
    check('7a #167 200 · outcome · replayed false · turns = 학습자 말 수 · endedAt', fin.status === 200 && ['ACHIEVED', 'ALMOST', 'NOT_YET'].includes(fin.data.outcome as string) && fin.data.replayed === false && fin.data.turns === learnerCount && typeof fin.data.endedAt === 'string', `status=${fin.status} outcome=${String(fin.data.outcome)} judged=${String(fin.data.judged)} turns=${String(fin.data.turns)}/${learnerCount}`)
    const log = await prisma.studyLog.findFirst({ where: { userId: U, refId: CHAT }, select: { type: true, origin: true, result: true } })
    check('7b StudyLog(TALK·DIRECT) 1 · RepetitionItem(SCENARIO) 1 · 관측 SCENARIO_COMPLETED 1', rows1.log === 1 && log?.type === 'TALK' && log.origin === 'DIRECT' && rows1.rep === 1 && rows1.obs === 1, JSON.stringify(rows1))
    const daily = await prisma.statsSnapshot.findUnique({ where: { userId_kind_periodKey: { userId: U, kind: 'DAILY', periodKey: today } }, select: { data: true } })
    const a = obj(daily?.data)
    const b = obj(dailyBefore?.data)
    const delta = { studied: num(obj(a.repetition).studied) - num(obj(b.repetition).studied), observations: num(obj(a.observations).total) - num(obj(b.observations).total) }
    check('7c DAILY repetition.studied+1 · observations.total ≥ +1(턴 교정 관측 포함 가능)', delta.studied === 1 && delta.observations >= 1, JSON.stringify(delta))
    const fin2 = await api(COOKIE4, 'POST', `/api/v1/chats/${CHAT}/scenario/finish`)
    check('7d 다시 마치기 = replayed true · 같은 결과 · 행 변화 0', fin2.status === 200 && fin2.data.replayed === true && fin2.data.outcome === fin.data.outcome && fin2.data.studyLogId === fin.data.studyLogId && JSON.stringify(await scenarioRows(U, CHAT, SID)) === JSON.stringify(rows1))
    const after = await turn(COOKIE4, CHAT, 'もう一杯ください')
    check('7e 마친 뒤 턴 409 ROLEPLAY_ENDED · 메시지 행 0', after.status === 409 && reason(after.data) === 'ROLEPLAY_ENDED' && (await prisma.chatMessage.count({ where: { chatId: CHAT } })) === rows1.msgs, `status=${after.status} reason=${String(reason(after.data))}`)
    const d2 = await api(COOKIE4, 'GET', `/api/v1/chats/${CHAT}`)
    const ended = obj(obj(obj(d2.data.chat).scenario).ended)
    check('7f #29 ended = 결과(outcome·studyLogId·replayed true)', ended.outcome === fin.data.outcome && ended.studyLogId === fin.data.studyLogId && ended.replayed === true)
    const det2 = await api(COOKIE4, 'GET', `/api/v1/scenarios/${SID}`)
    check('7g 마친 대화는 inProgressChatId 에서 빠짐', det2.status === 200 && det2.data.inProgressChatId !== CHAT, String(det2.data.inProgressChatId))
    const ftr = await pollUntil(() => prisma.requestTrace.findFirst({ where: { userId: U, refType: 'scenarioFinish', refId: CHAT }, select: { traceId: true, steps: true } }), (r) => r !== null)
    if (ftr) made.traceIds.push(ftr.traceId)
    const ftext = JSON.stringify(ftr?.steps ?? null)
    check('7h 종료 Trace(SCENARIO_VERDICT) 있음 · 학습자 원문·인용 0', !!ftr && ftext.includes('SCENARIO_VERDICT') && !ftext.includes('コーヒー') && !ftext.includes('ホット'))
    const logText = JSON.stringify(log?.result ?? null)
    check('7i StudyLog.result 에 엔진명·학습자 원문 0', !LEAK.test(logText) && !logText.includes('コーヒーをください'))

    // ── 8 [LLM 슬롯] 종료 vs 턴 동시 ───────────────────────────────────────
    const s2 = await api(COOKIE4, 'POST', '/api/v1/chats', { kind: 'TALK', scenarioId: SID })
    const RACE = s2.data.id as string
    if (RACE) made.chatIds.push(RACE)
    const warm = await turnOk(COOKIE4, RACE, 'Lサイズにしてください')
    if (typeof obj(doneOf(warm)).traceId === 'string') made.traceIds.push(obj(doneOf(warm)).traceId as string)
    const [rt, rf] = await Promise.all([turn(COOKIE4, RACE, 'ホットでお願いします'), sleep(60).then(() => api(COOKIE4, 'POST', `/api/v1/chats/${RACE}/scenario/finish`))])
    if (typeof obj(doneOf(rt)).traceId === 'string') made.traceIds.push(obj(doneOf(rt)).traceId as string)
    await sleep(500)
    const raceObs = await prisma.learningObservation.count({ where: { userId: U, kind: 'SCENARIO_COMPLETED', refType: 'Chat', refId: RACE } })
    const raceLearner = await prisma.chatMessage.count({ where: { chatId: RACE, role: 'USER' } })
    const outcome = `turn=${rt.status}${rt.status === 409 ? `:${String(reason(rt.data))}` : ''} finish=${rf.status}${rf.status === 409 ? `:${String(reason(rf.data))}` : ''}`
    const ok =
      raceObs <= 1 &&
      // (가) 턴 먼저 끝남 → 종료가 그 턴까지 기록
      ((rt.status === 200 && rf.status === 200 && rf.data.turns === raceLearner && raceObs === 1) ||
        // (나) 종료가 진행 중 턴을 보고 거절 → 기록 0
        (rt.status === 200 && rf.status === 409 && reason(rf.data) === 'TURN_RUNNING' && raceObs === 0) ||
        // (다) 종료가 먼저 → 턴 409 ROLEPLAY_ENDED, 기록된 turns = 그 전 학습자 말 수
        (rt.status === 409 && reason(rt.data) === 'ROLEPLAY_ENDED' && rf.status === 200 && rf.data.turns === raceLearner && raceObs === 1))
    check('8a 종료 vs 턴 동시: 허용 결과 셋 중 하나 · 관측 ≤1 · 기록 turns = DB 학습자 말 수', ok, outcome)

    check('9a 응답·SSE 에 엔진명 0', leakHits === 0, `hits=${leakHits}`)
  } finally {
    await cleanup(U, today, dailyBefore, since)
  }
}

async function cleanup(U: string, today: string, dailyBefore: { id: string; data: Prisma.JsonValue } | null, since: Date): Promise<void> {
  try {
    const msgIds = made.chatIds.length ? (await prisma.chatMessage.findMany({ where: { chatId: { in: made.chatIds } }, select: { id: true } })).map((m) => m.id) : []
    const corrIds = made.chatIds.length ? (await prisma.correction.findMany({ where: { chatId: { in: made.chatIds } }, select: { id: true } })).map((c) => c.id) : []
    const refIds = [...made.chatIds, ...msgIds, ...corrIds]
    if (refIds.length) {
      await prisma.learningObservation.deleteMany({ where: { userId: U, refId: { in: refIds }, occurredAt: { gte: since } } })
      await prisma.studyLog.deleteMany({ where: { userId: U, refId: { in: refIds }, createdAt: { gte: since } } })
    }
    if (made.scenarioIds.length) await prisma.repetitionItem.deleteMany({ where: { userId: U, refType: 'Scenario', refId: { in: made.scenarioIds }, createdAt: { gte: since } } })
    if (made.traceIds.length) await prisma.requestTrace.deleteMany({ where: { traceId: { in: made.traceIds } } })
    await prisma.chat.deleteMany({ where: { id: { in: made.chatIds } } })
    const sc = await prisma.scenario.deleteMany({ where: { id: { in: made.scenarioIds }, title: { startsWith: MARK } } })
    if (dailyBefore) await prisma.statsSnapshot.update({ where: { id: dailyBefore.id }, data: { data: dailyBefore.data as Prisma.InputJsonValue } })
    else await prisma.statsSnapshot.deleteMany({ where: { userId: U, kind: 'DAILY', periodKey: today } })
    console.log(`(정리: 대화 ${made.chatIds.length} · 상황 ${sc.count} · Trace ${made.traceIds.length} · DAILY ${dailyBefore ? '되돌림' : '삭제'})`)
  } catch (e) {
    console.log(`! 정리 실패 — 수동 확인 필요(MARK=${MARK}): ${String(e)}`)
  }
}

main()
  .catch((e) => check('run', false, String(e)))
  .finally(async () => {
    await prisma.$disconnect()
    const fail = results.filter((x) => x.ok === false).length
    const skipped = results.filter((x) => x.ok === null).length
    console.log(`RESULT pass=${results.length - fail - skipped} fail=${fail} skip=${skipped}`)
    process.exitCode = fail ? 1 : 0
  })
