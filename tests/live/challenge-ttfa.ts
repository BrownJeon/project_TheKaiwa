/**
 * task-041 5초 지표 **참고치**(설계서 `docs/design/challenge.md` §5-2 완료 기준 (2)·(3)) — 합격 판정이 아니다(목표 회귀 ≤ +0.3s 는 설계 목표,
 * +2s 이상이면 A11 잡 겹침 여부를 Trace 로 확인해 이력서에 남긴다). 합격 판정(LLM·AiJob·Trace 증가 0)은 `challenge-smoke.ts` A16·단위 테스트.
 *
 * 같은 세션·같은 TALK 방에서 **챌린지 없음(base) → 챌린지 진행 중(challenge)** 순으로 시나리오마다 N 회(기본 30):
 *  (가) 오늘 탭 진입(#58 + #158 동시) → 곧바로 회화 첫 턴(텍스트). 반복마다 그날 첫 진입 A11 잡이 다시 걸리도록, 계정의 잡이 다 끝난 뒤
 *       **오늘(KST) 끝난 REVIEW_DECISION AiJob 행을 지운다**(`challenge-cleanup.ts --review-decision-today` 와 같은 규칙 — QA 계정 3 만).
 *  (나) 주제 단어 세트를 끝낸 직후(#53 다시 풀기 → #50 전부 CORRECT → #51) → 곧바로 회화 첫 턴. 세트는 `generate:false`(A12 없음 — B1 풀),
 *       FLIP 5장. 완료 뒤 A11 은 계정이 최소 기록 가드(공부한 날 2·항목 2)를 통과해야 걸린다 — 걸리지 않은 반복 수를 함께 찍는다.
 * 턴은 `inputSource:'TEXT'`(STT 경로 제외) — 손님 기준 "턴 요청 → 첫 audio 이벤트"(TTFA)와 "턴 요청 → done"(턴)을 잰다. 턴 시작 간격 ≥ 5.5s(분당 12턴).
 *
 * **LLM 직렬 슬롯**: 턴마다 Claude CLI 1회 + A11 잡(배치)이 돈다 — 계획서 §6 순서대로 다른 LLM 라이브와 겹치지 않게 혼자 돌린다.
 * 실행: `bash tests/live/challenge-ttfa.sh [포트=3021] [반복=30] [시나리오=both|ga|na]`. 시간: 반복 30 이면 대략 60~90분 [추측 — A11 13~17s × 반복].
 * 정리: 이 실행이 만든 챌린지·세트(+스냅샷·학습 기록)·턴 Trace·REVIEW_DECISION 잡·TALK 방을 지운다. 반복 항목 카운터(공부 횟수)는 되돌리지 않는다
 * (QA 계정 3 의 학습 기록 — 실사용자 행 아님). 출력에 쿠키·대화 전문을 찍지 않는다.
 * **삭제 범위 주의(REV-120 L-5)**: REVIEW_DECISION 잡은 이 실행이 만든 것만이 아니라 QA 계정 3 의 (가) 반복마다 "오늘 끝난 것 전부",
 * 끝에 "이 실행 시작 뒤 만들어져 끝난 것 전부"를 지운다 — 같은 계정을 쓰는 다른 레인(042·043·044 QA·challenge-smoke)과 동시에 돌리지 않는다.
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../../src/modules/infra/db'
import { QA_USER_WHERE } from '../../src/modules/infra/users'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3021'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE) || BASE.endsWith(':3010')) throw new Error('BASE 는 localhost(운영 3010 제외)만 허용')
if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 환경에서는 실행하지 않는다')
const COOKIE = readFileSync(process.argv[2] ?? '', 'utf8').trim()
if (!COOKIE) throw new Error('QA 쿠키 파일이 비어 있다 — qa-session.ts 실패 여부를 확인')
const REPS = Math.max(1, Math.min(60, Number(process.argv[3] ?? 30)))
const SCENARIO = (process.argv[4] ?? 'both') as 'both' | 'ga' | 'na'
const QA3 = 'qa-bot3@thekaiwa.test'
const KST = 9 * 3600_000
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const kstToday = () => new Date(Date.now() + KST).toISOString().slice(0, 10)
const kstMidnight = () => new Date(`${kstToday()}T00:00:00+09:00`)
const LINES = ['こんにちは。今日は少し寒いですね。', '週末は何をしましたか。', '駅までどうやって行きますか。', 'おすすめのお店はありますか。', '日本語の勉強は楽しいです。']

type Json = Record<string, unknown>
async function api(method: string, path: string, body?: unknown): Promise<{ status: number; data: Json }> {
  const r = await fetch(`${BASE}${path}`, { method, headers: { Cookie: COOKIE, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const j = (await r.json().catch(() => ({}))) as { data?: Json }
  return { status: r.status, data: j.data ?? {} }
}

let userId = ''
const made = { challenges: [] as string[], sessions: [] as string[], traces: [] as string[], since: new Date() }

/** 계정의 잡(QUEUED·RUNNING)이 다 끝날 때까지(최대 150초 — A11 CLI 상한 근처). */
async function quiesce(): Promise<boolean> {
  for (let i = 0; i < 75; i++) {
    if ((await prisma.aiJob.count({ where: { userId, status: { in: ['QUEUED', 'RUNNING'] } } })) === 0) return true
    await sleep(2_000)
  }
  return false
}

async function a11Running(): Promise<boolean> {
  return (await prisma.aiJob.count({ where: { userId, kind: 'REVIEW_DECISION', status: { in: ['QUEUED', 'RUNNING'] } } })) > 0
}

interface Turn {
  ttfaMs: number | null
  doneMs: number
  ok: boolean
  a11AtTurn: boolean
  a11Started: boolean
}

async function turn(chatId: string, n: number, a11AtTurn: boolean, a11Started: boolean): Promise<Turn> {
  const reqAt = performance.now()
  const r = await fetch(`${BASE}/api/v1/chats/${chatId}/turns`, { method: 'POST', headers: { Cookie: COOKIE, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: LINES[n % LINES.length], inputSource: 'TEXT' }) })
  if (!(r.headers.get('content-type') ?? '').includes('text/event-stream')) {
    await r.text()
    return { ttfaMs: null, doneMs: performance.now() - reqAt, ok: false, a11AtTurn, a11Started }
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
      if (ev === 'done') {
        done = true
        if (typeof data.traceId === 'string') made.traces.push(data.traceId)
      }
      if (ev === 'error' && typeof data.traceId === 'string') made.traces.push(data.traceId)
    }
  }
  return { ttfaMs: first === null ? null : first - reqAt, doneMs: performance.now() - reqAt, ok: done, a11AtTurn, a11Started }
}

async function dropTodayReviewDecisionJobs(): Promise<void> {
  await prisma.aiJob.deleteMany({ where: { userId, kind: 'REVIEW_DECISION', createdAt: { gte: kstMidnight() }, status: { notIn: ['QUEUED', 'RUNNING'] } } })
}

/** (가) 오늘 탭 진입 → 곧바로 첫 턴. */
async function scenarioGa(chatId: string, n: number): Promise<Turn> {
  await quiesce()
  await dropTodayReviewDecisionJobs()
  const jobsBefore = await prisma.aiJob.count({ where: { userId, kind: 'REVIEW_DECISION' } })
  await Promise.all([api('GET', '/api/v1/lessons/today'), api('GET', '/api/v1/challenges/today')])
  const started = (await prisma.aiJob.count({ where: { userId, kind: 'REVIEW_DECISION' } })) > jobsBefore
  return turn(chatId, n, await a11Running(), started)
}

/** (나) 주제 세트를 끝낸 직후 → 곧바로 첫 턴. `keptId` = 보관한 원본 세트(다시 풀기 원천). */
async function scenarioNa(chatId: string, n: number, keptId: string): Promise<Turn & { counted: boolean }> {
  await quiesce()
  const rep = await api('POST', `/api/v1/vocab/sessions/${keptId}/replay`)
  const sid = String((rep.data.session as Json | undefined)?.id ?? '')
  if (rep.status !== 200 || !sid) throw new Error(`#53 다시 풀기 실패 ${rep.status}`)
  made.sessions.push(sid)
  for (const c of (rep.data.cards as Json[]) ?? []) await api('POST', `/api/v1/vocab/sessions/${sid}/attempts`, { order: c.order, selfResult: 'CORRECT' })
  const jobsBefore = await prisma.aiJob.count({ where: { userId, kind: 'REVIEW_DECISION' } })
  const fin = await api('POST', `/api/v1/vocab/sessions/${sid}/finish`)
  if (fin.status !== 200) throw new Error(`#51 끝내기 실패 ${fin.status}`)
  const started = (await prisma.aiJob.count({ where: { userId, kind: 'REVIEW_DECISION' } })) > jobsBefore
  const t = await turn(chatId, n, await a11Running(), started)
  return { ...t, counted: fin.data.challenge != null }
}

async function prepareKeptTopicSet(topicId: string): Promise<string> {
  const s = await api('POST', '/api/v1/vocab/sessions', { topicId, generate: false, count: 5, mode: 'FLIP' })
  const sid = String((s.data.session as Json | undefined)?.id ?? '')
  if (s.status !== 200 || !sid) throw new Error(`#47 주제 세트 생성 실패 ${s.status} ${JSON.stringify((s.data.empty as Json | undefined)?.reason ?? '')}`)
  made.sessions.push(sid)
  for (const c of (s.data.cards as Json[]) ?? []) await api('POST', `/api/v1/vocab/sessions/${sid}/attempts`, { order: c.order, selfResult: 'CORRECT' })
  await api('POST', `/api/v1/vocab/sessions/${sid}/finish`)
  const k = await api('POST', `/api/v1/vocab/sessions/${sid}/keep`, { kept: true })
  if (k.status !== 200) throw new Error(`#52 보관 실패 ${k.status}`)
  return sid
}

function pct(xs: number[], p: number): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  return v.length ? v[Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1))] : null
}

async function main(): Promise<void> {
  const user = await prisma.user.findFirst({ where: { AND: [{ email: QA3 }, QA_USER_WHERE] }, select: { id: true } })
  if (!user) throw new Error('QA 계정 3 이 없거나 QA 계정 규칙에 맞지 않는다')
  userId = user.id
  made.since = new Date()
  const hhmm = new Date(Date.now() + KST).toISOString().slice(11, 16)
  if (hhmm < '00:10' || hhmm > '21:30') throw new Error(`KST ${hhmm} — 실행 중 자정을 넘기지 않게 00:10~21:30 에 시작한다`)
  if (await prisma.challenge.count({ where: { userId, status: 'ACTIVE' } })) throw new Error('계정 3 에 진행 중 챌린지가 있다 — 다른 레인과 시간을 나눈다(정리 후 다시)')
  if (await prisma.vocabSession.count({ where: { userId, status: 'IN_PROGRESS' } })) throw new Error('계정 3 에 풀던 세트가 있다 — 끝내거나 정리 후 다시')
  const topic = await prisma.conversationTopic.findFirstOrThrow({ where: { userId: null, level: 'N5' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true } })
  const chat = await api('POST', '/api/v1/chats', { kind: 'TALK', title: 't041 ttfa' })
  const chatId = String(chat.data.id ?? '')
  if (chat.status !== 200 || !chatId) throw new Error(`TALK 방 생성 실패 ${chat.status}`)
  const rows: { cond: 'base' | 'challenge'; sc: 'ga' | 'na'; t: Turn & { counted?: boolean } }[] = []
  try {
    await api('GET', `/api/v1/chats/${chatId}`)
    await sleep(4_000)
    const kept = SCENARIO === 'ga' ? '' : await prepareKeptTopicSet(topic.id)
    let n = 0
    for (const cond of ['base', 'challenge'] as const) {
      if (cond === 'challenge') {
        const c = await api('POST', '/api/v1/challenges', { topicId: topic.id, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: true, words: true, wordCount: 5 } })
        if (c.status !== 200) throw new Error(`#156 실패 ${c.status}`)
        made.challenges.push(String(c.data.id))
      }
      for (const sc of SCENARIO === 'both' ? (['ga', 'na'] as const) : [SCENARIO]) {
        for (let i = 0; i < REPS; i++) {
          const startedAt = performance.now()
          const t = sc === 'ga' ? await scenarioGa(chatId, n++) : await scenarioNa(chatId, n++, kept)
          rows.push({ cond, sc, t })
          console.log(`${cond}/${sc} #${i + 1} ttfa=${t.ttfaMs === null ? '-' : Math.round(t.ttfaMs)}ms done=${Math.round(t.doneMs)}ms A11(시작 ${t.a11Started ? 'Y' : 'N'} · 턴 시점 실행 중 ${t.a11AtTurn ? 'Y' : 'N'})${'counted' in t && t.counted !== undefined ? ` 챌린지 셈 ${t.counted ? 'Y' : 'N'}` : ''} ${t.ok ? 'OK' : 'ERR'}`)
          const wait = 5_500 - (performance.now() - startedAt)
          if (wait > 0) await sleep(wait)
        }
      }
    }
    console.log('\n| 시나리오 | 조건 | n(OK) | TTFA p50 | TTFA p90 | 턴 p50 | 턴 p90 | A11 시작 | 턴 시점 A11 실행 중 |')
    console.log('|---|---|---|---|---|---|---|---|---|')
    const fmt = (v: number | null) => (v === null ? '-' : `${(v / 1000).toFixed(2)}s`)
    for (const sc of ['ga', 'na'] as const) {
      const p50: Record<string, number | null> = {}
      for (const cond of ['base', 'challenge'] as const) {
        const rs = rows.filter((r) => r.sc === sc && r.cond === cond)
        if (!rs.length) continue
        const ok = rs.filter((r) => r.t.ok)
        p50[cond] = pct(ok.map((r) => r.t.ttfaMs ?? NaN), 50)
        console.log(`| ${sc === 'ga' ? '(가) 진입 직후' : '(나) 끝낸 직후'} | ${cond} | ${rs.length}(${ok.length}) | ${fmt(p50[cond])} | ${fmt(pct(ok.map((r) => r.t.ttfaMs ?? NaN), 90))} | ${fmt(pct(ok.map((r) => r.t.doneMs), 50))} | ${fmt(pct(ok.map((r) => r.t.doneMs), 90))} | ${rs.filter((r) => r.t.a11Started).length}/${rs.length} | ${rs.filter((r) => r.t.a11AtTurn).length}/${rs.length} |`)
      }
      if (p50.base != null && p50.challenge != null) {
        const delta = (p50.challenge - p50.base) / 1000
        console.log(`  ${sc} TTFA p50 차이(challenge − base) ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}s — 참고치(설계 목표 ≤ +0.3s, 합격 판정 아님)${delta >= 2 ? ' · ⚠ +2s 이상: A11 겹침을 Trace 로 확인해 이력서에 남긴다' : ''}`)
      }
    }
    const naRows = rows.filter((r) => r.sc === 'na')
    if (naRows.length && naRows.every((r) => !r.t.a11Started)) console.log('  (나) A11 이 한 번도 걸리지 않음 — 계정 3 이 최소 기록 가드(공부한 날 2·항목 2)를 아직 못 넘었다. 다른 날 공부 기록을 만든 뒤 다시 잰다.')
  } finally {
    await quiesce()
    await prisma.challenge.deleteMany({ where: { userId, id: { in: made.challenges } } })
    await prisma.statsSnapshot.deleteMany({ where: { userId, kind: 'VOCAB_SESSION', periodKey: { in: made.sessions } } })
    await prisma.studyLog.deleteMany({ where: { userId, type: 'WORDS', refId: { in: made.sessions } } })
    await prisma.vocabSession.deleteMany({ where: { userId, id: { in: made.sessions } } })
    await prisma.requestTrace.deleteMany({ where: { userId, traceId: { in: made.traces } } })
    await prisma.aiJob.deleteMany({ where: { userId, kind: 'REVIEW_DECISION', createdAt: { gte: made.since }, status: { notIn: ['QUEUED', 'RUNNING'] } } })
    if (chatId) await api('DELETE', `/api/v1/chats/${chatId}`)
    console.log(`(정리: 챌린지 ${made.challenges.length} · 세트 ${made.sessions.length} · 턴 Trace ${made.traces.length} · TALK 방 1)`)
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('참고치 측정 중단:', e instanceof Error ? e.message : String(e))
  process.exit(1)
})
