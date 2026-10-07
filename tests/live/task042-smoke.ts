/**
 * task-042 주제 단어 세트(B2 — A12 새 단어 + B1 폴백) 라이브 스모크 — **QA 계정 3(챌린지 레인)** + 계정 2(IDOR)로 실제 서버(127.0.0.1)·실제 DB.
 *
 *  A. LLM 0(다른 LLM 레인과 병렬 가능): 입력 400(topicId+category·generate 단독) · 404(없는 주제·**계정 2 의 내 주제**) → T_A `generate:false` 세트
 *     (SKIPPED·AiWord 0·topicWords Trace +0·AiJob +0) → **정답·refId 미노출** → `topic` 두 수 #47 = #48 = #49 = DB 카드 수 → 계정 2 의 #49 404 →
 *     답(맞힘 1·틀림 1) → #51(`wrongWords[].source`·VOCAB_SESSION 스냅샷 `data.topicId`·`RepetitionItem` 키·**`WordEntry` 행 수 불변**·`topic` 같음) →
 *     #52 보관 → #53 다시 풀기(주제 유지·카드 refType/refId 복사·Trace +0) → 0답 끝내기(ABANDONED).
 *  B. LLM(직렬 슬롯): T_B 첫 세트 → **A12 1회**(Trace +1·lane interactive·totalMs ≤ 30s) · AiJob +0 · 새 단어 카드(읽기 가나·뜻 한글·refId = 정규화 sha1 40자) ·
 *     `generation.source` AI|MIXED → 답·끝내기 → `RepetitionItem('Expr', 카드 refId)` → 같은 날 두 번째 세트 **Trace +0**(재사용) · 오늘 답한 카드 다시 안 나옴 →
 *     다시 풀기·끝내기 → 같은 키 행 수 불변(병합, 카운터만 증가).
 *  C. LLM: T_C 생성 요청을 1.5초 뒤 손님이 끊음 → 40초 안에 T_C 세트 0 · Trace `errorCode=CANCELLED`(아니면 FAIL "취소 미전파" — 설계서 §4-3b ② 확인 항목).
 *  D. LLM: T_D 동시 두 요청 → 200 하나 + 409 `{reason:'GENERATING'}` 하나.
 *  E. 참고치(합격 판정 아님): 이 실행의 A12 대기 ms · `TRACE_DAYS=n` 이면 최근 n일 topicWords Trace 의 p50/p95·사유(errorCode)별 건수 · `OVERLAP=1` 이면 B 직전에
 *     #58(오늘 탭 — A11 DAILY 판단 잡) 을 불러 겹친 대기를 잰다(그날 첫 진입일 때만 잡이 걸린다).
 *
 * 실행: `bash tests/live/task042-smoke.sh [포트=3022] [미러=~/.node-local/thekaiwa-042]`(서버는 그 미러에서 `next dev -H 127.0.0.1 -p <포트>` 로 따로).
 * `ONLY=A` 면 LLM 구간(B~D)을 건너뛴다. 하루 시도 상한(사용자당 3)·생성 중 표시는 **서버 메모리**라 같은 날 두 번 돌리려면 서버를 다시 띄운다(아니면 B~D 가 LIMIT).
 * 공유 DB 라 **이 실행이 만든 행만** 지운다(세트·카드·StudyLog·스냅샷·관측·잡·새 반복 항목·계정 2 의 표식 주제) · 기존 DAILY·반복 항목은 시작 값으로 되돌린다.
 * topicWords Trace 는 남긴다(원문 없음 — 30초 초과 0 의 근거, `TRACE_DAYS` 참고치 재료).
 */
import { readFileSync } from 'node:fs'
import { Prisma, PrismaClient, type RepetitionItem } from '@prisma/client'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3022'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만 허용')
const [c3file, c2file] = process.argv.slice(2)
if (!c3file || !c2file) throw new Error('사용: task042-smoke.ts <QA3 쿠키> <QA2 쿠키>')
const COOKIE3 = readFileSync(c3file, 'utf8').trim()
const COOKIE2 = readFileSync(c2file, 'utf8').trim()
const ONLY_A = process.env.ONLY === 'A'
const prisma = new PrismaClient()
const LEAK = /claude|haiku|sonnet|opus|qwen|toolLog|home-m4|reazon|whisper|style-?bert|sbv2/i
const MARK = 't042'
const WALL_MS = 30_000
let leakHits = 0
const results: { id: string; ok: boolean; note: string }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
const info = (msg: string) => console.log(`INFO ${msg}`)
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
interface Res {
  status: number
  data: Json & { code?: string; details?: Json }
  text: string
  ms: number
}
async function api(cookie: string, method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<Res> {
  const t0 = performance.now()
  const r = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body), signal })
  const text = await r.text()
  const ms = performance.now() - t0
  if (LEAK.test(text)) {
    leakHits++
    console.log(`  ! 누출 의심 ${method} ${path}`)
  }
  let data: Res['data'] = {}
  try {
    data = (JSON.parse(text) as { data: Res['data'] }).data ?? {}
  } catch {
    data = {}
  }
  return { status: r.status, data, text, ms }
}

const KANA_READING = /^[ぁ-ゖァ-ヺー・]+$/
const HANGUL = /[가-힣]/
const SHA1 = /^[0-9a-f]{40}$/
type Session = { id: string; topic?: { id: string; title: string; lessonCardCount: number; aiCardCount: number } | null; status?: string; replayOfId?: string | null; mode?: string }
type Card = Json & { order: number; surface: string; reading: string | null; choices?: string[] }
const sess = (r: Res) => r.data.session as Session | null
const cards = (r: Res) => (r.data.cards ?? []) as Card[]

/** 응답 카드에 정답·출처가 없는가(CHOICE 미답). */
function noAnswerLeak(cs: Card[]): boolean {
  return cs.every((c) => !('meaning' in c) && !('correctText' in c) && !('answer' in c) && !('refId' in c) && !('refType' in c) && !('meaningSnap' in c))
}

async function dbCounts(sessionId: string): Promise<{ lesson: number; ai: number }> {
  const rows = await prisma.vocabAttempt.groupBy({ by: ['refType'], where: { sessionId }, _count: { _all: true } })
  const n = (t: string) => rows.find((r) => r.refType === t)?._count._all ?? 0
  return { lesson: n('Expr'), ai: n('AiWord') }
}

const traceCount = (userId: string, since: Date, refId?: string) => prisma.requestTrace.count({ where: { userId, refType: 'topicWords', createdAt: { gte: since }, ...(refId ? { refId } : {}) } })
const aiJobCount = (userId: string) => prisma.aiJob.count({ where: { userId } })

/** CHOICE 카드에 답(맞힘/틀림) — 정답은 DB 스냅샷에서(QA 도구만). */
async function answer(cookie: string, sessionId: string, order: number, correct: boolean): Promise<Res> {
  const a = await prisma.vocabAttempt.findUniqueOrThrow({ where: { sessionId_order: { sessionId, order } }, select: { meaningSnap: true, choices: true } })
  const choices = Array.isArray(a.choices) ? (a.choices as string[]) : []
  if (!choices.length) return api(cookie, 'POST', `/api/v1/vocab/sessions/${sessionId}/attempts`, { order, selfResult: correct ? 'CORRECT' : 'WRONG' })
  const pick = correct ? a.meaningSnap : choices.find((c) => c !== a.meaningSnap)
  return api(cookie, 'POST', `/api/v1/vocab/sessions/${sessionId}/attempts`, { order, chosenText: pick })
}

// ── 기준선·정리 ───────────────────────────────────────────────────────────────

interface Baseline {
  sessions: Set<string>
  logs: Set<string>
  snaps: Set<string>
  obs: Set<string>
  jobs: Set<string>
  reps: RepetitionItem[]
  daily: { id: string; data: Prisma.JsonValue }[]
  words: number
}
async function baseline(userId: string): Promise<Baseline> {
  const ids = async (rows: Promise<{ id: string }[]>) => new Set((await rows).map((r) => r.id))
  return {
    sessions: await ids(prisma.vocabSession.findMany({ where: { userId }, select: { id: true } })),
    logs: await ids(prisma.studyLog.findMany({ where: { userId }, select: { id: true } })),
    snaps: await ids(prisma.statsSnapshot.findMany({ where: { userId }, select: { id: true } })),
    obs: await ids(prisma.learningObservation.findMany({ where: { userId }, select: { id: true } })),
    jobs: await ids(prisma.aiJob.findMany({ where: { userId }, select: { id: true } })),
    reps: await prisma.repetitionItem.findMany({ where: { userId } }),
    daily: await prisma.statsSnapshot.findMany({ where: { userId, kind: 'DAILY' }, select: { id: true, data: true } }),
    words: await prisma.wordEntry.count({ where: { userId } }),
  }
}

async function drainJobs(userId: string, timeoutMs = 150_000): Promise<number> {
  const t0 = Date.now()
  for (;;) {
    const n = await prisma.aiJob.count({ where: { userId, status: { in: ['QUEUED', 'RUNNING'] } } })
    if (n === 0 || Date.now() - t0 > timeoutMs) return n
    await sleep(3_000)
  }
}

async function restore(userId: string, b: Baseline): Promise<Json> {
  const left = await drainJobs(userId)
  const fresh = async (rows: Promise<{ id: string }[]>, old: Set<string>) => (await rows).map((r) => r.id).filter((id) => !old.has(id))
  const obs = await fresh(prisma.learningObservation.findMany({ where: { userId }, select: { id: true } }), b.obs)
  if (obs.length) await prisma.learningObservation.deleteMany({ where: { id: { in: obs } } })
  const logs = await fresh(prisma.studyLog.findMany({ where: { userId }, select: { id: true } }), b.logs)
  if (logs.length) await prisma.studyLog.deleteMany({ where: { id: { in: logs } } })
  const jobs = await fresh(prisma.aiJob.findMany({ where: { userId }, select: { id: true } }), b.jobs)
  if (jobs.length) await prisma.aiJob.deleteMany({ where: { id: { in: jobs } } })
  const sessions = await fresh(prisma.vocabSession.findMany({ where: { userId }, select: { id: true } }), b.sessions)
  if (sessions.length) {
    await prisma.vocabAttempt.deleteMany({ where: { sessionId: { in: sessions } } })
    await prisma.vocabSession.deleteMany({ where: { id: { in: sessions } } })
  }
  const snaps = await fresh(prisma.statsSnapshot.findMany({ where: { userId }, select: { id: true } }), b.snaps)
  if (snaps.length) await prisma.statsSnapshot.deleteMany({ where: { id: { in: snaps } } })
  for (const row of b.daily) await prisma.statsSnapshot.update({ where: { id: row.id }, data: { data: (row.data ?? {}) as Prisma.InputJsonValue } })
  const oldReps = new Set(b.reps.map((r) => r.id))
  const reps = (await prisma.repetitionItem.findMany({ where: { userId }, select: { id: true } })).map((r) => r.id).filter((id) => !oldReps.has(id))
  if (reps.length) await prisma.repetitionItem.deleteMany({ where: { id: { in: reps } } })
  for (const r of b.reps) {
    const { id, userId: _u, createdAt: _c, updatedAt: _up, ...rest } = r
    void _u
    void _c
    void _up
    await prisma.repetitionItem.updateMany({ where: { id }, data: rest })
  }
  return { jobsLeftRunning: left, observations: obs.length, studyLogs: logs.length, aiJobs: jobs.length, sessions: sessions.length, snapshots: snaps.length, repetitionItems: reps.length }
}

// ── 본문 ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const u3 = await prisma.user.findUniqueOrThrow({ where: { email: 'qa-bot3@thekaiwa.test' }, select: { id: true } })
  const u2 = await prisma.user.findUniqueOrThrow({ where: { email: 'qa-bot2@thekaiwa.test' }, select: { id: true } })
  const inProgress = await prisma.vocabSession.findFirst({ where: { userId: u3.id, status: 'IN_PROGRESS' }, select: { id: true } })
  if (inProgress) throw new Error(`계정 3 에 풀던 세트가 있다(${inProgress.id}) — 다른 레인이 쓰는 중이면 기다리고, 아니면 끝내거나 지운 뒤 다시`)
  const seeds = await prisma.conversationTopic.findMany({
    where: { userId: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, title: true, level: true, _count: { select: { chunks: true } } },
  })
  const usable = seeds.filter((t) => t._count.chunks >= 4)
  if (usable.length < (ONLY_A ? 1 : 4)) throw new Error(`조각 4개 이상 시드 주제가 ${usable.length}개뿐`)
  const [TA, TB, TC, TD] = usable
  info(`주제 A=${TA.title} B=${TB?.title ?? '-'} C=${TC?.title ?? '-'} D=${TD?.title ?? '-'}`)
  const start = new Date()
  const b3 = await baseline(u3.id)
  const mine2 = await prisma.conversationTopic.create({ data: { userId: u2.id, title: `${MARK} 계정2 주제`, level: 'N5' } })
  const waits: number[] = []
  try {
    // ── A ──
    const v1 = await api(COOKIE3, 'POST', '/api/v1/vocab/sessions', { topicId: TA.id, category: '음식' })
    const v2 = await api(COOKIE3, 'POST', '/api/v1/vocab/sessions', { generate: false })
    check('A1 topicId+category·generate 단독 → 400 VALIDATION', v1.status === 400 && v2.status === 400 && v1.data.code === 'VALIDATION', `${v1.status}/${v2.status}`)
    const n1 = await api(COOKIE3, 'POST', '/api/v1/vocab/sessions', { topicId: 'nope-topic-id' })
    const n2 = await api(COOKIE3, 'POST', '/api/v1/vocab/sessions', { topicId: mine2.id })
    check('A2 없는 주제·남(계정 2)의 내 주제 → 404', n1.status === 404 && n2.status === 404, `${n1.status}/${n2.status}`)

    const tr0 = await traceCount(u3.id, start)
    const job0 = await aiJobCount(u3.id)
    const countA = Math.min(10, TA._count.chunks)
    const a = await api(COOKIE3, 'POST', '/api/v1/vocab/sessions', { topicId: TA.id, count: countA, mode: 'CHOICE', generate: false })
    const sa = sess(a)
    check('A3 generate:false → 200·SKIPPED·source TOPIC', a.status === 200 && !!sa && (a.data.generation as Json)?.reason === 'SKIPPED' && (a.data.generation as Json)?.source === 'TOPIC', `${a.status} ${JSON.stringify(a.data.generation)}`)
    if (!sa) throw new Error('A3 세트가 없다 — 중단')
    check('A4 정답·refId·refType 미노출(CHOICE 미답)', noAnswerLeak(cards(a)) && !/"refId"|"meaningSnap"/.test(a.text))
    check('A5 LLM 0·AiJob +0(generate:false)', (await traceCount(u3.id, start)) === tr0 && (await aiJobCount(u3.id)) === job0)
    const dbA = await dbCounts(sa.id)
    const listA = await api(COOKIE3, 'GET', '/api/v1/vocab/sessions?limit=20')
    const itemA = ((listA.data.items ?? []) as Session[]).find((s) => s.id === sa.id)
    const getA = await api(COOKIE3, 'GET', `/api/v1/vocab/sessions/${sa.id}`)
    const same = (t?: Session['topic'] | null) => !!t && t.id === TA.id && t.lessonCardCount === dbA.lesson && t.aiCardCount === dbA.ai
    check('A6 topic 두 수 #47 = #48 = #49 = DB 카드 수', same(sa.topic) && same(itemA?.topic) && same(sess(getA)?.topic) && dbA.ai === 0, JSON.stringify({ db: dbA, p47: sa.topic }))
    const attA = await prisma.vocabAttempt.findMany({ where: { sessionId: sa.id }, select: { wordId: true, refType: true, refId: true } })
    check('A7 카드 = wordId null·refType TopicChunk|Expr·refId 있음', attA.every((x) => x.wordId === null && (x.refType === 'TopicChunk' || x.refType === 'Expr') && !!x.refId), attA.map((x) => x.refType).join(','))
    const idor = await api(COOKIE2, 'GET', `/api/v1/vocab/sessions/${sa.id}`)
    check('A8 계정 2 의 #49 → 404', idor.status === 404, String(idor.status))

    const r0 = await answer(COOKIE3, sa.id, 0, true)
    const r1 = await answer(COOKIE3, sa.id, 1, false)
    const fin = await api(COOKIE3, 'POST', `/api/v1/vocab/sessions/${sa.id}/finish`)
    const finS = fin.data.session as Session
    const wrongs = (fin.data.wrongWords ?? []) as Json[]
    check('A9 #51 → DONE·wrongWords 1·source TOPIC·wordId null·topic 같음', r0.status === 200 && r1.status === 200 && fin.status === 200 && finS?.status === 'DONE' && wrongs.length === 1 && wrongs[0].source === 'TOPIC' && wrongs[0].wordId === null && same(finS?.topic), JSON.stringify(wrongs))
    check('A9b #51 응답에 challenge 칸(null 또는 객체)', 'challenge' in fin.data, JSON.stringify(fin.data.challenge ?? null))
    const snapA = await prisma.statsSnapshot.findFirst({ where: { userId: u3.id, kind: 'VOCAB_SESSION', periodKey: sa.id }, select: { data: true } })
    check('A10 VOCAB_SESSION 스냅샷 data.topicId = 주제', (snapA?.data as Json | null)?.topicId === TA.id, JSON.stringify(snapA?.data ?? null))
    const answeredA = await prisma.vocabAttempt.findMany({ where: { sessionId: sa.id, answer: { in: ['CORRECT', 'WRONG'] } }, select: { refType: true, refId: true } })
    const repA = await prisma.repetitionItem.findMany({ where: { userId: u3.id, OR: answeredA.map((x) => ({ refType: x.refType as string, refId: x.refId as string })) }, select: { refType: true, itemType: true } })
    check('A11 답한 카드 2장 → RepetitionItem 2행(TopicChunk→CHUNK·Expr→EXPRESSION)', repA.length === 2 && repA.every((r) => (r.refType === 'TopicChunk' ? r.itemType === 'CHUNK' : r.itemType === 'EXPRESSION')), JSON.stringify(repA))
    check('A12 WordEntry 행 수 불변(자동 추가 0)', (await prisma.wordEntry.count({ where: { userId: u3.id } })) === b3.words)

    const keep = await api(COOKIE3, 'POST', `/api/v1/vocab/sessions/${sa.id}/keep`, { kept: true })
    check('A13 #52 보관 → topic 같음', keep.status === 200 && same((keep.data as Session).topic ?? (keep.data.session as Session | undefined)?.topic), String(keep.status))
    const trR = await traceCount(u3.id, start)
    const rep = await api(COOKIE3, 'POST', `/api/v1/vocab/sessions/${sa.id}/replay`)
    const sr = sess(rep)
    const repAtt = sr ? await prisma.vocabAttempt.findMany({ where: { sessionId: sr.id }, select: { refType: true, refId: true } }) : []
    const key = (x: { refType: string | null; refId: string | null }) => `${x.refType}:${x.refId}`
    const origKeys = (await prisma.vocabAttempt.findMany({ where: { sessionId: sa.id }, select: { refType: true, refId: true } })).map(key).sort()
    check('A14 #53 다시 풀기 → 주제 세트(topicId·refType/refId 복사)·LLM 0·topic 같음', rep.status === 200 && !!sr && sr.replayOfId === sa.id && sr.topic?.id === TA.id && same(sr.topic) && JSON.stringify(repAtt.map(key).sort()) === JSON.stringify(origKeys) && (await traceCount(u3.id, start)) === trR && noAnswerLeak(cards(rep)), `${rep.status} mode=${sr?.mode}`)
    if (sr) {
      const ab = await api(COOKIE3, 'POST', `/api/v1/vocab/sessions/${sr.id}/finish`)
      check('A15 0답 끝내기 → ABANDONED', (ab.data.session as Session | undefined)?.status === 'ABANDONED', String(ab.status))
    }
    if (ONLY_A) return

    // ── B ──
    if (process.env.OVERLAP === '1') {
      const today = await api(COOKIE3, 'GET', '/api/v1/lessons/today')
      info(`OVERLAP: #58 ${today.status} ${Math.round(today.ms)}ms 직후 생성 요청(그날 첫 진입이면 A11 DAILY 잡과 겹친다)`)
    }
    const trB = await traceCount(u3.id, start, TB.id)
    const jobB = await aiJobCount(u3.id)
    const g1 = await api(COOKIE3, 'POST', '/api/v1/vocab/sessions', { topicId: TB.id, count: 10, mode: 'CHOICE' })
    waits.push(g1.ms)
    const s1 = sess(g1)
    const gen1 = g1.data.generation as Json | undefined
    info(`B 첫 세트 대기 ${Math.round(g1.ms)}ms generation=${JSON.stringify(gen1)}`)
    check('B1 첫 세트 200·generation.generatedNow·source AI|MIXED', g1.status === 200 && !!s1 && gen1?.generatedNow === true && (gen1?.source === 'AI' || gen1?.source === 'MIXED'), `${g1.status} ${JSON.stringify(gen1)}`)
    if (!s1) throw new Error('B1 세트가 없다 — 중단')
    const jobAfter = await aiJobCount(u3.id)
    const trAfter = await pollUntil(() => traceCount(u3.id, start, TB.id), (c) => c - trB >= 1)
    check('B2 A12 = Trace +1·AiJob +0(동기 — 잡 없음)', trAfter - trB === 1 && jobAfter === jobB, `trace+${trAfter - trB} job+${jobAfter - jobB}`)
    const t1 = await pollUntil(() => prisma.requestTrace.findFirst({ where: { userId: u3.id, refType: 'topicWords', refId: TB.id, createdAt: { gte: start } }, orderBy: { createdAt: 'desc' }, select: { status: true, totalMs: true, steps: true, errorCode: true } }), (r) => r !== null)
    const step = Array.isArray(t1?.steps) ? (t1?.steps[0] as Json | undefined) : undefined
    check('B3 Trace lane interactive·totalMs ≤ 30s·원문 없음', step?.lane === 'interactive' && (t1?.totalMs ?? 99_999) <= WALL_MS + 500, JSON.stringify({ status: t1?.status, totalMs: t1?.totalMs, kept: step?.kept, dropped: step?.dropped }))
    const ai1 = await prisma.vocabAttempt.findMany({ where: { sessionId: s1.id, refType: 'AiWord' }, orderBy: { order: 'asc' }, select: { order: true, surfaceSnap: true, readingSnap: true, meaningSnap: true, refId: true } })
    check('B4 새 단어 카드: 읽기 가나·뜻 한글·refId sha1 40자·aiCardCount = DB', ai1.length > 0 && ai1.every((c) => KANA_READING.test(c.readingSnap ?? '') && HANGUL.test(c.meaningSnap) && SHA1.test(c.refId ?? '')) && s1.topic?.aiCardCount === ai1.length, ai1.map((c) => `${c.surfaceSnap}(${c.readingSnap})=${c.meaningSnap}`).join(' / '))
    check('B5 정답·refId 미노출', noAnswerLeak(cards(g1)) && ai1.every((c) => !g1.text.includes(c.refId ?? '@@')))
    const aiOrder = ai1[0].order
    await answer(COOKIE3, s1.id, aiOrder, true)
    await api(COOKIE3, 'POST', `/api/v1/vocab/sessions/${s1.id}/finish`)
    const repKey = { userId: u3.id, refType: 'Expr', refId: ai1[0].refId as string }
    const rep1 = await prisma.repetitionItem.findMany({ where: repKey, select: { id: true, correctCount: true, studiedCount: true } })
    check('B6 새 단어 답 → RepetitionItem(Expr, 카드 refId) 1행', rep1.length === 1, JSON.stringify(rep1))

    const trB2 = await traceCount(u3.id, start, TB.id)
    const g2 = await api(COOKIE3, 'POST', '/api/v1/vocab/sessions', { topicId: TB.id, count: 10, mode: 'CHOICE' })
    waits.push(g2.ms)
    const s2 = sess(g2)
    const ai2 = s2 ? await prisma.vocabAttempt.findMany({ where: { sessionId: s2.id }, select: { refType: true, refId: true } }) : []
    check('B7 같은 날 두 번째 세트 → Trace +0(재사용)·generatedNow false', g2.status === 200 && (await traceCount(u3.id, start, TB.id)) === trB2 && (g2.data.generation as Json)?.generatedNow === false, `${g2.status} ${JSON.stringify(g2.data.generation)} ${Math.round(g2.ms)}ms`)
    check('B8 오늘 답한 새 단어는 다시 안 나옴', !ai2.some((x) => x.refId === ai1[0].refId))
    if (s2) await api(COOKIE3, 'POST', `/api/v1/vocab/sessions/${s2.id}/finish`)
    await api(COOKIE3, 'POST', `/api/v1/vocab/sessions/${s1.id}/keep`, { kept: true })
    const r2 = await api(COOKIE3, 'POST', `/api/v1/vocab/sessions/${s1.id}/replay`)
    const sr2 = sess(r2)
    if (sr2) {
      const ord = await prisma.vocabAttempt.findFirst({ where: { sessionId: sr2.id, refId: ai1[0].refId }, select: { order: true } })
      if (ord) await answer(COOKIE3, sr2.id, ord.order, true)
      await api(COOKIE3, 'POST', `/api/v1/vocab/sessions/${sr2.id}/finish`)
    }
    const rep2 = await prisma.repetitionItem.findMany({ where: repKey, select: { id: true, correctCount: true, studiedCount: true } })
    check('B9 다시 풀기로 같은 새 단어를 또 맞힘 → 같은 행(행 수 1)·카운터만 증가', rep2.length === 1 && rep2[0].id === rep1[0]?.id && rep2[0].correctCount > (rep1[0]?.correctCount ?? 0), JSON.stringify({ before: rep1[0], after: rep2[0] }))

    // ── C ──
    const cStart = new Date()
    const ac = new AbortController()
    const pending = api(COOKIE3, 'POST', '/api/v1/vocab/sessions', { topicId: TC.id, count: 10, mode: 'CHOICE' }, ac.signal).catch((e: unknown) => ({ aborted: e instanceof Error ? e.name : 'error' }))
    await sleep(1_500)
    ac.abort()
    await pending
    let cTrace: { errorCode: string | null; status: string; totalMs: number | null } | null = null
    for (let i = 0; i < 20 && !cTrace; i++) {
      await sleep(2_000)
      cTrace = await prisma.requestTrace.findFirst({ where: { userId: u3.id, refType: 'topicWords', refId: TC.id, createdAt: { gte: cStart } }, select: { errorCode: true, status: true, totalMs: true } })
    }
    await sleep(2_000)
    const cSets = await prisma.vocabSession.count({ where: { userId: u3.id, topicId: TC.id, startedAt: { gte: cStart } } })
    check('C1 대기 중 이탈 → T_C 세트 0·Trace errorCode CANCELLED(취소 전파)', cSets === 0 && cTrace?.errorCode === 'CANCELLED', JSON.stringify({ sets: cSets, trace: cTrace }))
    if (cSets > 0) {
      info('취소가 서버에 닿지 않았다(req.signal 미전파) — 벽시계 30초가 최악을 묶는지 Trace totalMs 로 확인하고 Leader 에게 보고')
      const left = await prisma.vocabSession.findMany({ where: { userId: u3.id, topicId: TC.id, status: 'IN_PROGRESS' }, select: { id: true } })
      for (const s of left) await api(COOKIE3, 'POST', `/api/v1/vocab/sessions/${s.id}/finish`)
    }

    // ── D ──
    const [d1, d2] = await Promise.all([
      api(COOKIE3, 'POST', '/api/v1/vocab/sessions', { topicId: TD.id, count: 5, mode: 'CHOICE' }),
      sleep(300).then(() => api(COOKIE3, 'POST', '/api/v1/vocab/sessions', { topicId: TD.id, count: 5, mode: 'CHOICE' })),
    ])
    const okOne = [d1, d2].filter((r) => r.status === 200)
    const gen409 = [d1, d2].filter((r) => r.status === 409 && r.data.details?.reason === 'GENERATING')
    check('D1 동시 두 생성 → 200 1 + 409 GENERATING 1', okOne.length === 1 && gen409.length === 1, `${d1.status}/${d2.status} ${JSON.stringify([d1.data.details, d2.data.details])}`)
    waits.push(...okOne.map((r) => r.ms))
    for (const r of okOne) {
      const s = sess(r)
      if (s) await api(COOKIE3, 'POST', `/api/v1/vocab/sessions/${s.id}/finish`)
    }

    // ── 30초 상한 ──
    const over = await prisma.requestTrace.count({ where: { userId: u3.id, refType: 'topicWords', createdAt: { gte: start }, totalMs: { gt: WALL_MS + 500 } } })
    check('B10 벽시계 30초를 넘는 A12 Trace 0', over === 0, String(over))
  } finally {
    // ── E 참고치 ──
    if (waits.length) info(`이 실행의 생성 요청 대기(ms): ${waits.map((w) => Math.round(w)).join(', ')}`)
    const days = Number(process.env.TRACE_DAYS ?? 0)
    if (days > 0) {
      const rows = await prisma.requestTrace.findMany({ where: { refType: 'topicWords', createdAt: { gte: new Date(Date.now() - days * 86_400_000) } }, select: { totalMs: true, errorCode: true, status: true } })
      const ms = rows.flatMap((r) => (r.totalMs == null ? [] : [r.totalMs])).sort((x, y) => x - y)
      const pct = (p: number) => (ms.length ? ms[Math.min(ms.length - 1, Math.ceil((p / 100) * ms.length) - 1)] : null)
      const by: Record<string, number> = {}
      for (const r of rows) by[r.errorCode ?? r.status] = (by[r.errorCode ?? r.status] ?? 0) + 1
      info(`최근 ${days}일 topicWords Trace ${rows.length}건 p50=${pct(50)}ms p95=${pct(95)}ms 사유별=${JSON.stringify(by)}`)
    }
    await prisma.conversationTopic.deleteMany({ where: { id: mine2.id } })
    console.log('정리:', JSON.stringify(await restore(u3.id, b3)))
  }
}

main()
  .catch((e) => {
    console.error('스모크 중단:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    check('Z 엔진명·모델명 누출 0', leakHits === 0, String(leakHits))
    const failed = results.filter((r) => !r.ok)
    console.log(`\n결과: ${results.length - failed.length}/${results.length} PASS${failed.length ? ` — FAIL: ${failed.map((f) => f.id).join(', ')}` : ''}`)
    if (failed.length) process.exitCode = 1
    await prisma.$disconnect()
  })
