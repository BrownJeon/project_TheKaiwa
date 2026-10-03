/**
 * task-010b 라이브 스모크 — 반복 학습 서버(#58 review·guard·decisionPending·nextReview / #60 reviewItems·nextReview / #62 reviewDecisionJobId /
 * #63 / #64 / #35·#36·#33 교정 관측 / #51 단어 세트 항목·관측)를 실제 서버(127.0.0.1)·실제 DB·실제 A11(복습 판단)·A5(복습 수업)·A3(표현 점검)에 친다.
 *
 * 흐름(QA1 = 주 계정, QA2 = 가드·IDOR·건너뛰기):
 *   0 인증 401·잘못된 id 404 → 1 QA2 가드 모양(기록이 모자랄 때만 — 아니면 NOTE) → 2 QA1 심기(옛 날짜 DAILY 2일 + 8일 전에 공부한 due 항목 6개,
 *   그중 2개 FOCUS·피드백 3) → 3 #58 하루 첫 진입: A11 잡 1개(decisionPending)·다시 읽어도 같은 잡 → 잡 DONE → 오늘 세션(DUE·근거·미리보기 ≤7·
 *   표기만)·항목 3~7·FOCUS ≤3·decidedBy·같은 날 다시 판단 없음 → 4 ★①: 지난 날짜 REVIEW 레슨은 resume 에 안 나옴 → 5 ★③: 세션에 FAILED 레슨을
 *   걸어 둔 뒤 #63 → **같은 레슨 행** 되살림(GENERATING·새 REVIEW_GEN 잡)·다시 누르면 같은 잡·QA2 404 → A5 DONE → #60 reviewItems(읽기 없음)·
 *   chunks ⊆ mixSpec∪new-N → ★⑦ #64: 하는 중 409·QA2 FAILED 세션 200·처리됨 409·타인 404 → 6 복습 완료: 진행·말하기(글자) → #62 →
 *   세션 DONE·mixSpec studiedCount+1·정오답·StudyLog REVIEW·LESSON 스냅샷 kind REVIEW·DAILY reviews+1·관측 8행·DAILY observations →
 *   2회째 409(행 0) → A11 잡 DONE → #60 nextReview 묶음(3~7, FOCUS ≤3)·progress 에 서버 칸 없음 → #58 완료 카드(score·nextReview) →
 *   7 교정: #33 A3 → 만든 교정마다 CORRECTION_PROPOSED / 채택 → EXPRESSION 항목(studied 0·피드백 1)·재채택 피드백 2·ACCEPTED / 거절 → IGNORED·항목 0 /
 *   단어 중복 409 → 항목·관측·DAILY 변화 0 / QA2 404 → 8 단어 세트: 답한 카드만 WORD 항목·카드마다 VOCAB_RECOGNITION·DAILY(세트 날짜)·A11 잡·
 *   멱등 재호출 잡 0 → 9 응답 전체 엔진명 0.
 *
 * LLM: A11 3회(하루 첫 진입·복습 완료·단어 세트) + A5 1회 + A3 1회. 약 3~5분. **이 실행이 만든 행만** 지운다 — 시작 때 QA 두 계정의 관련 테이블 id 집합을
 * 찍어 두고, 끝에 그 뒤에 생긴 id 만 지운다. 손댄 기존 행(반복 항목·오류 통계·DAILY)은 시작 전 값으로 되돌린다. 오늘 이미 복습 일정·판단 잡이 있으면
 * (다른 실행과 겹침) 아무것도 쓰지 않고 중단한다.
 *
 * 실행(우분투 미러): `bash tests/live/task010b-smoke.sh [포트=3011]` · 운영: `SMOKE_ENV=PRODUCTION bash tests/live/task010b-smoke.sh 3010`.
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { PrismaClient, type Prisma } from '@prisma/client'

const SMOKE_ENV = (process.env.SMOKE_ENV ?? process.env.APP_ENV ?? 'LOCAL').toUpperCase()
const BASE = process.env.BASE ?? (SMOKE_ENV === 'PRODUCTION' ? 'http://127.0.0.1:3010' : 'http://127.0.0.1:3011')
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만 허용')
const [c1file, c2file] = process.argv.slice(2)
if (!c1file || !c2file) throw new Error('사용: task010b-smoke.ts <cookie1> <cookie2>')
const COOKIE1 = readFileSync(c1file, 'utf8').trim()
const COOKIE2 = readFileSync(c2file, 'utf8').trim()
const prisma = new PrismaClient()
const LEAK = /claude|haiku|sonnet|opus|qwen|toolLog|home-m4|reazon|whisper|style-?bert|sbv2|promptVersion|"model"|REVIEW_DECISION|reviewMix@|reviewDecision@/i
const MARK = 'smk010b'
const WORD_CATEGORY = 't010b스모크'
const RUN = Date.now().toString(36)
let leakHits = 0
const results: { id: string; ok: boolean; note: string }[] = []
const notes: string[] = []
const metrics: Record<string, string | number> = {}
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
function note(id: string, text: string): void {
  notes.push(`${id}: ${text}`)
  console.log(`NOTE ${id} — ${text}`)
}

type Json = Record<string, unknown>
interface Res {
  status: number
  body: { success: boolean; data: Json & { code?: string; details?: Json }; message: string | null }
  text: string
  ms: number
}
async function api(cookie: string | null, method: string, path: string, body?: unknown): Promise<Res> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) headers.Cookie = cookie
  const t = performance.now()
  const r = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  const ms = performance.now() - t
  if (LEAK.test(text)) {
    leakHits++
    console.log(`  ! 누출 의심 ${method} ${path}: ${text.match(LEAK)?.[0]}`)
  }
  let parsed: Res['body']
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { success: false, data: {}, message: text.slice(0, 200) }
  }
  return { status: r.status, body: parsed, text, ms }
}
const d = (r: Res) => r.body.data as Json
const reason = (r: Res) => (r.body.data?.details as Json | undefined)?.reason
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))
const kstToday = (now = new Date()) => new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const dbDate = (date: string) => new Date(`${date}T00:00:00Z`)
const ymd = (v: Date | null | undefined) => (v ? v.toISOString().slice(0, 10) : null)
const sha1Norm = (t: string) => createHash('sha1').update(t.normalize('NFKC').replace(/[\s　、。，．,.!！?？・「」『』〜~…]/g, ''), 'utf8').digest('hex')

async function pollJob(cookie: string, jobId: string, timeoutMs = 180_000): Promise<{ status: string; ms: number; job: Json }> {
  const t0 = performance.now()
  let wait = 1_500
  for (;;) {
    const job = d(await api(cookie, 'GET', `/api/v1/jobs/${jobId}`))
    if (job.status === 'DONE' || job.status === 'FAILED') return { status: String(job.status), ms: performance.now() - t0, job }
    if (performance.now() - t0 > timeoutMs) return { status: 'TIMEOUT', ms: performance.now() - t0, job }
    await sleep(wait)
    wait = Math.min(4_000, wait + 500)
  }
}

// ── 이 실행이 만든 행만 지우기: 시작 때 id 집합을 찍는다 ─────────────────────────

const TRACKED = [
  'learningObservation',
  'studyLog',
  'statsSnapshot',
  'reviewSchedule',
  'lesson',
  'aiJob',
  'requestTrace',
  'correction',
  'chatMessage',
  'chat',
  'tutorProposal',
  'vocabSession',
  'wordEntry',
  'repetitionItem',
  'learnerErrorStat',
] as const
type Tracked = (typeof TRACKED)[number]
type IdModel = { findMany: (a: { where: { userId: string }; select: { id: true } }) => Promise<{ id: string }[]>; deleteMany: (a: { where: { id: { in: string[] } } }) => Promise<unknown> }
const model = (t: Tracked) => (prisma as unknown as Record<Tracked, IdModel>)[t]
async function idsOf(t: Tracked, userId: string): Promise<Set<string>> {
  return new Set((await model(t).findMany({ where: { userId }, select: { id: true } })).map((r) => r.id))
}

interface Baseline {
  ids: Map<string, Set<string>>
  daily: { id: string; data: Prisma.JsonValue }[]
  reps: Awaited<ReturnType<PrismaClient['repetitionItem']['findMany']>>
  errs: { id: string; count: number; lastAt: Date }[]
}
async function baseline(userId: string): Promise<Baseline> {
  const ids = new Map<string, Set<string>>()
  for (const t of TRACKED) ids.set(t, await idsOf(t, userId))
  return {
    ids,
    daily: await prisma.statsSnapshot.findMany({ where: { userId, kind: 'DAILY' }, select: { id: true, data: true } }),
    reps: await prisma.repetitionItem.findMany({ where: { userId } }),
    errs: await prisma.learnerErrorStat.findMany({ where: { userId }, select: { id: true, count: true, lastAt: true } }),
  }
}

/** 남은 판단·생성 잡이 끝나길 기다린다(정리 뒤에 백그라운드 쓰기가 남지 않게). */
async function drainJobs(userIds: string[], timeoutMs = 150_000): Promise<number> {
  const t0 = Date.now()
  for (;;) {
    const n = await prisma.aiJob.count({ where: { userId: { in: userIds }, kind: { in: ['REVIEW_DECISION', 'REVIEW_GEN', 'CHAT_REVIEW'] }, status: { in: ['QUEUED', 'RUNNING'] } } })
    if (n === 0 || Date.now() - t0 > timeoutMs) return n
    await sleep(3_000)
  }
}

async function restore(userId: string, b: Baseline): Promise<Record<string, number>> {
  const removed: Record<string, number> = {}
  const created = async (t: Tracked) => [...(await idsOf(t, userId))].filter((id) => !b.ids.get(t)!.has(id))
  // FK 순서: 교정 → 메시지 → 채팅 / 시도 → 세트 / 일정(SetNull) → 레슨
  const order: Tracked[] = ['learningObservation', 'correction', 'tutorProposal', 'chatMessage', 'chat', 'studyLog', 'reviewSchedule', 'lesson', 'aiJob', 'requestTrace', 'repetitionItem', 'learnerErrorStat']
  for (const t of order) {
    const ids = await created(t)
    if (ids.length) await model(t).deleteMany({ where: { id: { in: ids } } })
    removed[t] = ids.length
  }
  const sessions = await created('vocabSession')
  if (sessions.length) {
    await prisma.vocabAttempt.deleteMany({ where: { sessionId: { in: sessions } } })
    await prisma.vocabSession.deleteMany({ where: { id: { in: sessions } } })
  }
  removed.vocabSession = sessions.length
  const words = await created('wordEntry')
  if (words.length) await prisma.wordEntry.deleteMany({ where: { id: { in: words } } })
  removed.wordEntry = words.length
  const snaps = await created('statsSnapshot')
  if (snaps.length) await prisma.statsSnapshot.deleteMany({ where: { id: { in: snaps } } })
  removed.statsSnapshot = snaps.length
  for (const row of b.daily) await prisma.statsSnapshot.update({ where: { id: row.id }, data: { data: (row.data ?? {}) as Prisma.InputJsonValue } })
  for (const r of b.reps) {
    const { id, userId: _u, createdAt: _c, updatedAt: _up, ...rest } = r
    void _u
    void _c
    void _up
    await prisma.repetitionItem.updateMany({ where: { id }, data: rest })
  }
  for (const e of b.errs) await prisma.learnerErrorStat.updateMany({ where: { id: e.id }, data: { count: e.count, lastAt: e.lastAt } })
  return removed
}

/** 이전 실행이 남긴 표식 행(이 스크립트가 만든 것만 — refId 접두사·분류·채팅 제목). */
async function wipeMarked(userId: string): Promise<void> {
  await prisma.repetitionItem.deleteMany({ where: { userId, refId: { startsWith: `${MARK}-` } } })
  const chats = await prisma.chat.findMany({ where: { userId, title: { startsWith: MARK } }, select: { id: true } })
  if (chats.length) await prisma.chat.deleteMany({ where: { id: { in: chats.map((c) => c.id) } } })
  const words = await prisma.wordEntry.findMany({ where: { userId, category: WORD_CATEGORY }, select: { id: true } })
  if (words.length) {
    await prisma.vocabAttempt.updateMany({ where: { wordId: { in: words.map((w) => w.id) } }, data: { wordId: null } })
    await prisma.wordEntry.deleteMany({ where: { id: { in: words.map((w) => w.id) } } })
  }
}

const dailyOf = async (userId: string, date: string) =>
  ((await prisma.statsSnapshot.findUnique({ where: { userId_kind_periodKey: { userId, kind: 'DAILY', periodKey: date } }, select: { data: true } }))?.data ?? {}) as Json
const num = (v: unknown) => (typeof v === 'number' ? v : 0)
const obsTotal = (daily: Json) => num((daily.observations as Json | undefined)?.total)

async function main() {
  const u1 = (await prisma.user.findUniqueOrThrow({ where: { email: 'qa-bot@thekaiwa.test' } })).id
  const u2 = (await prisma.user.findUniqueOrThrow({ where: { email: 'qa-bot2@thekaiwa.test' } })).id
  const today = kstToday()
  console.log(`[task010b-smoke] env=${SMOKE_ENV} base=${BASE} today=${today} run=${RUN}`)

  // 겹침 방지: 오늘 일정·판단 잡이 이미 있으면 "하루 첫 진입"을 볼 수 없다 — 아무것도 쓰지 않고 중단.
  const dayStart = new Date(dbDate(today).getTime() - 9 * 3_600_000)
  const busy = await prisma.reviewSchedule.count({ where: { userId: u1, dueDate: dbDate(today) } })
  const busyJobs = await prisma.aiJob.count({ where: { userId: { in: [u1, u2] }, kind: { in: ['REVIEW_DECISION', 'REVIEW_GEN'] }, OR: [{ createdAt: { gte: dayStart } }, { status: { in: ['QUEUED', 'RUNNING'] } }] } })
  const inProgressSet = await prisma.vocabSession.count({ where: { userId: u1, status: 'IN_PROGRESS' } })
  if (busy || busyJobs || inProgressSet) {
    console.log(`중단: QA1 오늘 복습 일정 ${busy} · 오늘/진행 중 복습 잡 ${busyJobs} · 진행 중 단어 세트 ${inProgressSet} — 다른 실행과 겹친다. 끝난 뒤(또는 다음 날) 다시 실행.`)
    process.exitCode = 2
    return
  }
  await wipeMarked(u1)
  await wipeMarked(u2)
  const base1 = await baseline(u1)
  const base2 = await baseline(u2)
  try {
    await run(u1, u2, today)
  } finally {
    const left = await drainJobs([u1, u2])
    if (left) console.log(`  ! 정리 전 끝나지 않은 잡 ${left}건 — 그대로 지운다`)
    const r1 = await restore(u1, base1)
    const r2 = await restore(u2, base2)
    console.log(`(정리) QA1 ${JSON.stringify(r1)} · QA2 ${JSON.stringify(r2)} — 기존 반복 항목·오류 통계·DAILY 는 시작 전 값으로`)
  }
  const failed = results.filter((r) => !r.ok)
  console.log(`\n== task-010b 스모크 ${results.length - failed.length}/${results.length} PASS · NOTE ${notes.length} · 누출 ${leakHits} ==`)
  console.log(`지표 ${JSON.stringify(metrics)}`)
  if (failed.length) for (const f of failed) console.log(`  FAIL ${f.id} ${f.note}`)
  if (failed.length || leakHits) process.exitCode = 1
}

async function run(u1: string, u2: string, today: string): Promise<void> {
  // ── 0. 인증·형식 ──────────────────────────────────────────────
  check('0a #58 세션 없음 401', (await api(null, 'GET', '/api/v1/lessons/today')).status === 401)
  check('0b #63·#64 세션 없음 401', (await api(null, 'POST', '/api/v1/reviews/x/start')).status === 401 && (await api(null, 'POST', '/api/v1/reviews/x/skip')).status === 401)
  check('0c #63·#64 없는 id 404', (await api(COOKIE1, 'POST', '/api/v1/reviews/cnope00000000000000000000/start')).status === 404 && (await api(COOKIE1, 'POST', '/api/v1/reviews/cnope00000000000000000000/skip')).status === 404)

  // ── 1. 가드(QA2 — 기록이 모자랄 때만 볼 수 있다) ─────────────────────────
  const g2 = await api(COOKIE2, 'GET', '/api/v1/lessons/today')
  const guard = d(g2).guard as Json | null
  if (guard) {
    const sd = guard.studyDays as Json
    const it = guard.items as Json
    check('1a 가드 {reason:insufficient, studyDays{have,need 2}, items{have,need 2}}·review null·판단 대기 아님', guard.reason === 'insufficient' && sd?.need === 2 && it?.need === 2 && num(sd?.have) <= 2 && num(it?.have) <= 2 && d(g2).review === null && d(g2).decisionPending === false && d(g2).nextReview === null, JSON.stringify(guard))
  } else note('1a', `QA2 기록이 이미 가드 이상(review=${JSON.stringify(d(g2).review)?.slice(0, 60)}) — 가드 모양은 단위 테스트로 갈음`)
  check('1b #58 레슨 칸은 그대로(todayLessons 배열·mode 값)', g2.status === 200 && Array.isArray(d(g2).todayLessons) && ['NEW', 'BOTH', 'REVIEW'].includes(String(d(g2).mode)))

  // ── 2. QA1 심기: 공부한 날 2(옛 날짜) + due 항목 6(8일 전 학습 → 어떤 판단이든 오늘 due 유지) ─────────
  for (const date of ['2024-06-01', '2024-06-02']) {
    const cur = await dailyOf(u1, date)
    await prisma.statsSnapshot.upsert({
      where: { userId_kind_periodKey: { userId: u1, kind: 'DAILY', periodKey: date } },
      update: { data: { ...cur, lessons: Math.max(1, num(cur.lessons)) } as Prisma.InputJsonValue },
      create: { userId: u1, kind: 'DAILY', periodKey: date, data: { attended: true, lessons: 1 } },
    })
  }
  const studied8 = new Date(Date.now() - 8 * 86_400_000)
  const seeds = [
    { textJa: 'よろしくお願いします', meaningKo: '잘 부탁합니다', itemType: 'EXPRESSION', focus: true },
    { textJa: '〜てもいいですか', meaningKo: '~해도 될까요?', itemType: 'GRAMMAR', focus: true },
    { textJa: '会社員', meaningKo: '회사원', itemType: 'CHUNK', focus: false },
    { textJa: '緊張しています', meaningKo: '긴장하고 있어요', itemType: 'EXPRESSION', focus: false },
    { textJa: '座ってもいいですか', meaningKo: '앉아도 될까요?', itemType: 'EXPRESSION', focus: false },
    { textJa: '自己紹介', meaningKo: '자기소개', itemType: 'CHUNK', focus: false },
  ] as const
  const seeded: string[] = []
  for (const [i, s] of seeds.entries()) {
    const row = await prisma.repetitionItem.create({
      data: {
        userId: u1, itemType: s.itemType, refType: 'Expr', refId: `${MARK}-${RUN}-${i}`, textJa: s.textJa, meaningKo: s.meaningKo, studiedCount: 1 + (i % 3), lastStudiedAt: studied8,
        correctCount: 1, wrongCount: s.focus ? 3 : i % 2, feedbackCount: s.focus ? 3 : 0, intervalDays: 3, nextDueAt: dbDate(addDays(today, -5)),
        priority: s.focus ? 'FOCUS' : 'NORMAL', decidedBy: 'FALLBACK', decidedAt: new Date(studied8.getTime() + 3_600_000),
      },
      select: { id: true },
    })
    seeded.push(row.id)
  }

  // ── 3. #58 하루 첫 진입 → A11 잡 ─────────────────────────────────────
  const t1 = await api(COOKIE1, 'GET', '/api/v1/lessons/today')
  const jobId = d(t1).decisionJobId as string | null
  check('3a 첫 진입: guard null·review null·decisionPending true·decisionJobId', t1.status === 200 && d(t1).guard === null && d(t1).review === null && d(t1).decisionPending === true && typeof jobId === 'string', `ms=${Math.round(t1.ms)} pending=${String(d(t1).decisionPending)}`)
  const t1b = await api(COOKIE1, 'GET', '/api/v1/lessons/today')
  const jobsToday = () => prisma.aiJob.count({ where: { userId: u1, kind: 'REVIEW_DECISION', createdAt: { gte: new Date(dbDate(today).getTime() - 9 * 3_600_000) } } })
  check('3b 바로 다시 읽어도 같은 잡(새 잡 없음)', (d(t1b).decisionJobId === jobId || d(t1b).review !== null) && (await jobsToday()) === 1)
  const j1 = jobId ? await pollJob(COOKIE1, jobId, 120_000) : { status: 'NONE', ms: 0, job: {} }
  metrics.a11DailyMs = Math.round(j1.ms)
  metrics.a11DailyStatus = j1.status
  check('3c A11 잡 끝남(DONE — FAILED 면 폴백으로 저장)', j1.status === 'DONE' || j1.status === 'FAILED', `${j1.status} ${Math.round(j1.ms)}ms`)
  const t2 = await api(COOKIE1, 'GET', '/api/v1/lessons/today')
  const review = d(t2).review as Json | null
  const sched = await prisma.reviewSchedule.findUnique({ where: { userId_dueDate: { userId: u1, dueDate: dbDate(today) } } })
  const itemIds = (sched?.itemIds as string[] | null) ?? []
  const dueNow = await prisma.repetitionItem.count({ where: { userId: u1, nextDueAt: { lte: dbDate(today) } } })
  const decidedBy = j1.status === 'DONE' ? 'TUTOR' : 'FALLBACK'
  const preview = (review?.preview as Json[] | undefined) ?? []
  check(
    '3d 오늘 세션: DUE·mode BOTH·itemCount=세션 크기·focusCount·preview ≤7(textJa·priority 만, FOCUS 먼저)·lessonId/jobId null',
    !!review && !!sched && review.id === sched.id && review.status === 'DUE' && d(t2).mode === 'BOTH' && review.itemCount === itemIds.length && itemIds.length >= Math.min(4, dueNow) &&
      itemIds.length <= 12 && preview.length === Math.min(7, itemIds.length) && preview.every((p) => Object.keys(p).sort().join() === 'priority,textJa') &&
      preview.every((p, i) => i === 0 || p.priority !== 'FOCUS' || preview[i - 1].priority === 'FOCUS') &&
      review.lessonId === null && review.jobId === null && review.lessonStatus === null && review.score === null && d(t2).decisionPending === false,
    `items=${itemIds.length} focus=${String(review?.focusCount)} due=${dueNow}`,
  )
  check('3e 근거·주체: decidedBy·tutorRationale ≤300(폴백이면 코드 문구)·seed', review?.decidedBy === decidedBy && sched?.decidedBy === decidedBy && typeof review?.tutorRationale === 'string' && [...String(review?.tutorRationale)].length <= 300 && (decidedBy === 'TUTOR' || review?.tutorRationale === '지난 학습에서 틀리거나 오래된 항목을 골랐어요') && /^[0-9a-f]{32}$/.test(String(sched?.seed)), `${String(review?.decidedBy)} "${String(review?.tutorRationale).slice(0, 40)}…"`)
  const decided = await prisma.repetitionItem.findMany({ where: { id: { in: seeded } } })
  check(
    '3f 항목 판단: 3~7일·FOCUS ≤3(피드백 3회 FOCUS 유지)·decidedAt·근거 ≤200·nextDueAt = 마지막 학습일+간격',
    decided.every((r) => r.intervalDays >= 3 && r.intervalDays <= 7 && (r.priority !== 'FOCUS' || r.intervalDays <= 3) && (r.feedbackCount < 3 || r.priority === 'FOCUS') && !!r.decidedAt && [...(r.decisionReason ?? '')].length <= 200 && ymd(r.nextDueAt) === addDays(kstToday(r.lastStudiedAt!), r.intervalDays)),
    decided.map((r) => `${r.priority[0]}${r.intervalDays}${r.decidedBy[0]}`).join(' '),
  )
  check('3g 세션 항목 ⊆ 내 due 항목', itemIds.length > 0 && (await prisma.repetitionItem.count({ where: { userId: u1, id: { in: itemIds }, nextDueAt: { lte: dbDate(today) } } })) === itemIds.length)
  const t3 = await api(COOKIE1, 'GET', '/api/v1/lessons/today')
  check('3h 같은 날 다시 읽어도 같은 세션·판단 잡 1개(하루 1회)', (d(t3).review as Json)?.id === review?.id && (await jobsToday()) === 1 && d(t3).decisionPending === false)

  // ── 4. ★① resume 은 NEW 레슨만 ───────────────────────────────────────
  const oldNew = await prisma.lesson.create({ data: { userId: u1, date: dbDate(addDays(today, -3)), kind: 'NEW', title: `${MARK} 지난 수업`, level: 'N5', status: 'READY', stageDone: 1 } })
  await sleep(20)
  const oldRev = await prisma.lesson.create({ data: { userId: u1, date: dbDate(addDays(today, -1)), kind: 'REVIEW', title: '오늘의 복습', level: 'N5', status: 'IN_PROGRESS', stageDone: 2 } })
  const t4 = await api(COOKIE1, 'GET', '/api/v1/lessons/today')
  check('4a ★① 지난 날짜 하던 복습 레슨은 resume 에 안 나옴(NEW 만)', (d(t4).resume as Json | null)?.id !== oldRev.id && (d(t4).resume as Json | null)?.id === oldNew.id, `resume=${String((d(t4).resume as Json | null)?.id)}`)
  await prisma.lesson.deleteMany({ where: { id: { in: [oldNew.id, oldRev.id] } } })

  // ── 5. #63 ★③ 같은 행 되살리기 · A5 · #60 reviewItems · ★⑦ #64 ─────────────────
  const failed = await prisma.lesson.create({ data: { userId: u1, date: dbDate(today), kind: 'REVIEW', title: '오늘의 복습', level: 'N5', status: 'FAILED', error: 'ENGINE_TIMEOUT', stageDone: 0 } })
  await prisma.reviewSchedule.update({ where: { id: sched!.id }, data: { lessonId: failed.id } })
  const t5 = await api(COOKIE1, 'GET', '/api/v1/lessons/today')
  check('5a ★⑧ #58 review.lessonStatus FAILED·lessonId(만들기 실패 카드)', (d(t5).review as Json)?.lessonStatus === 'FAILED' && (d(t5).review as Json)?.lessonId === failed.id)
  check('5b IDOR: QA2 가 QA1 일정 #63·#64 → 404', (await api(COOKIE2, 'POST', `/api/v1/reviews/${sched!.id}/start`)).status === 404 && (await api(COOKIE2, 'POST', `/api/v1/reviews/${sched!.id}/skip`)).status === 404)
  const s1 = await api(COOKIE1, 'POST', `/api/v1/reviews/${sched!.id}/start`)
  const genJob = d(s1).jobId as string
  const revived = await prisma.lesson.findUnique({ where: { id: failed.id } })
  check('5c ★③ FAILED → 같은 레슨 행을 GENERATING 으로(새 행 없음)·REVIEW_GEN 잡 refId=그 레슨', s1.status === 200 && d(s1).lessonId === failed.id && d(s1).status === 'GENERATING' && d(s1).reused === false && revived?.status === 'GENERATING' && revived.error === null && (await prisma.aiJob.count({ where: { id: genJob, kind: 'REVIEW_GEN', refId: failed.id } })) === 1, JSON.stringify(d(s1)))
  const s2 = await api(COOKIE1, 'POST', `/api/v1/reviews/${sched!.id}/start`)
  check('5d 다시 눌러도 같은 레슨·같은 잡(reused)', d(s2).lessonId === failed.id && d(s2).jobId === genJob && d(s2).reused === true)
  const t6 = await api(COOKIE1, 'GET', '/api/v1/lessons/today')
  check('5e #58 만드는 중: review.jobId·lessonStatus GENERATING', (d(t6).review as Json)?.jobId === genJob && (d(t6).review as Json)?.lessonStatus === 'GENERATING')
  const g = await pollJob(COOKIE1, genJob, 200_000)
  metrics.a5Ms = Math.round(g.ms)
  metrics.a5Status = g.status
  check('5f A5 복습 수업 생성 DONE', g.status === 'DONE', `${g.status} ${Math.round(g.ms)}ms`)
  const L = d(await api(COOKIE1, 'GET', `/api/v1/lessons/${failed.id}`))
  const content = L.content as { chunks: { id: string }[]; grammar: { id: string }[]; quiz: { id: string; answer: number; targetIds: string[] }[]; speaking: { id: string; modelAnswerJa: string; targetIds: string[] }[] } | null
  const ri = (L.reviewItems as Json[] | null) ?? []
  const keys = 'feedbackCount,id,itemType,meaningKo,priority,refType,source,studiedCount,textJa,wrongCount'
  check('5g ★② #60 REVIEW: reviewItems = 세션 항목(순서)·키 고정(읽기 없음)·reviewScheduleId·nextReview null', L.kind === 'REVIEW' && L.status === 'READY' && L.reviewScheduleId === sched!.id && ri.map((x) => x.id).join() === itemIds.join() && ri.every((x) => Object.keys(x).sort().join() === keys) && L.nextReview === null, `${ri.length}개`)
  check('5h A5 후검증: chunks ⊆ mixSpec ∪ new-N', !!content && content.chunks.every((c) => itemIds.includes(c.id) || /^new-\d+$/.test(c.id)) && content.chunks.filter((c) => itemIds.includes(c.id)).length >= Math.min(4, itemIds.length), `chunks=${content?.chunks.map((c) => (itemIds.includes(c.id) ? 'm' : c.id)).join(',')}`)
  const t7 = await api(COOKIE1, 'GET', '/api/v1/lessons/today')
  check('5i ★⑧ todayLessons 에 복습 레슨(kind REVIEW) 유지·review.lessonStatus READY', ((d(t7).todayLessons as Json[]) ?? []).some((l) => l.id === failed.id && l.kind === 'REVIEW') && (d(t7).review as Json)?.lessonStatus === 'READY')

  // ★⑦ QA2: FAILED 레슨이 걸린 DUE 일정(직접 심음 — 항목 id 는 문자열만) → 200 / 다시 409 / QA1 이 건드리면 404
  const q2Lesson = await prisma.lesson.create({ data: { userId: u2, date: dbDate(today), kind: 'REVIEW', title: '오늘의 복습', level: 'N5', status: 'FAILED', error: 'ENGINE_TIMEOUT' } })
  const q2Sched = await prisma.reviewSchedule.create({ data: { userId: u2, dueDate: dbDate(today), itemIds: ['x1', 'x2', 'x3', 'x4'], status: 'DUE', lessonId: q2Lesson.id, decidedBy: 'FALLBACK' } })
  check('5j ★⑦ 타인 일정 #64 → 404', (await api(COOKIE1, 'POST', `/api/v1/reviews/${q2Sched.id}/skip`)).status === 404)
  const sk = await api(COOKIE2, 'POST', `/api/v1/reviews/${q2Sched.id}/skip`)
  check('5k ★⑦ 연결 레슨 FAILED 여도 건너뛰기 200 {id,status:SKIPPED,resolvedAt}', sk.status === 200 && d(sk).status === 'SKIPPED' && d(sk).id === q2Sched.id && typeof d(sk).resolvedAt === 'string')
  const sk2 = await api(COOKIE2, 'POST', `/api/v1/reviews/${q2Sched.id}/skip`)
  const st2 = await api(COOKIE2, 'POST', `/api/v1/reviews/${q2Sched.id}/start`)
  check('5l 처리된 일정 #64·#63 → 409 NOT_DUE', sk2.status === 409 && reason(sk2) === 'NOT_DUE' && st2.status === 409 && reason(st2) === 'NOT_DUE')

  // ── 6. 복습 레슨 진행·완료 ──────────────────────────────────────────
  if (!content) {
    check('6 복습 레슨 본문', false, '본문 없음 — 6절 건너뜀')
    return
  }
  const answers = content.quiz.map((q, i) => (i < 3 ? q.answer : i === 3 ? (q.answer + 1) % 4 : null))
  const p1 = await api(COOKIE1, 'PATCH', `/api/v1/lessons/${failed.id}/progress`, { stageDone: 4, progress: { quiz: { answers } } })
  check('6a 진행(#61) → IN_PROGRESS', p1.status === 200 && d(p1).status === 'IN_PROGRESS')
  const skBusy = await api(COOKIE1, 'POST', `/api/v1/reviews/${sched!.id}/skip`)
  check('6b ★⑦ 하던 복습(IN_PROGRESS) 건너뛰기 409 IN_PROGRESS', skBusy.status === 409 && reason(skBusy) === 'IN_PROGRESS')
  const sp = await api(COOKIE1, 'POST', `/api/v1/lessons/${failed.id}/speaking`, { itemId: content.speaking[0].id, text: content.speaking[0].modelAnswerJa })
  check('6c 말하기(글자, LLM 없음) 200', sp.status === 200, `used=${String(d(sp).used)} matched=${JSON.stringify(d(sp).matchedIds)}`)
  const before = await prisma.repetitionItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, studiedCount: true, correctCount: true, wrongCount: true } })
  const dailyBefore = await dailyOf(u1, today)
  const obsBefore = await prisma.learningObservation.count({ where: { userId: u1 } })
  const done = await api(COOKIE1, 'POST', `/api/v1/lessons/${failed.id}/complete`, {})
  const rdJob = d(done).reviewDecisionJobId as string | null
  check('6d #62 완료 200·reviewDecisionJobId(A11 걸림)·nextReview null(판단 대기)', done.status === 200 && (d(done).lesson as Json)?.status === 'DONE' && typeof rdJob === 'string' && d(done).nextReview === null, `ms=${Math.round(done.ms)}`)
  const schedDone = await prisma.reviewSchedule.findUnique({ where: { id: sched!.id } })
  check('6e 세션 DONE·resolvedAt', schedDone?.status === 'DONE' && !!schedDone.resolvedAt)
  const after = await prisma.repetitionItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, studiedCount: true, correctCount: true, wrongCount: true, lastStudiedAt: true } })
  const expected = new Map(itemIds.map((id) => [id, { c: 0, w: 0 }]))
  content.quiz.forEach((q, i) => {
    for (const t of new Set(q.targetIds)) {
      const e = expected.get(t)
      if (!e || answers[i] === null) continue
      if (answers[i] === q.answer) e.c++
      else e.w++
    }
  })
  check(
    '6f mixSpec 항목마다 studiedCount+1·quiz 정오답 증가·lastStudiedAt 오늘',
    after.length === itemIds.length && after.every((a) => {
      const b = before.find((x) => x.id === a.id)!
      const e = expected.get(a.id)!
      return a.studiedCount === b.studiedCount + 1 && a.correctCount === b.correctCount + e.c && a.wrongCount === b.wrongCount + e.w && kstToday(a.lastStudiedAt!) === today
    }),
  )
  const logs = await prisma.studyLog.findMany({ where: { userId: u1, refId: failed.id } })
  const lessonSnap = await prisma.statsSnapshot.findUnique({ where: { userId_kind_periodKey: { userId: u1, kind: 'LESSON', periodKey: failed.id } } })
  check('6g StudyLog REVIEW·DIRECT 1 · LESSON 스냅샷 kind REVIEW', logs.length === 1 && logs[0].type === 'REVIEW' && logs[0].origin === 'DIRECT' && (lessonSnap?.data as Json | undefined)?.kind === 'REVIEW')
  const dailyAfter = await dailyOf(u1, today)
  const obs = await prisma.learningObservation.findMany({ where: { userId: u1, refType: 'Lesson', refId: failed.id } })
  const byItem = (a: (typeof obs)[number], b: (typeof obs)[number]) => String((a.meta as Json | null)?.item).localeCompare(String((b.meta as Json | null)?.item))
  const quizKinds = obs.filter((o) => (o.meta as Json | null)?.stage === 'quiz').sort(byItem)
  const speakObs = obs.filter((o) => (o.meta as Json | null)?.stage === 'speaking').sort(byItem)
  check(
    '6h DAILY reviews+1(lessons 불변)·repetition.studied+n·관측 quiz 5(정답 SUCCESS·오답 FAIL·미답 SKIPPED)·말하기 3(안 함 SKIPPED)·DAILY observations +8',
    num(dailyAfter.reviews) === num(dailyBefore.reviews) + 1 && num(dailyAfter.lessons) === num(dailyBefore.lessons) && num((dailyAfter.repetition as Json)?.studied) === num((dailyBefore.repetition as Json)?.studied) + itemIds.length &&
      quizKinds.length === content.quiz.length && quizKinds.map((o) => o.outcome).join() === ['SUCCESS', 'SUCCESS', 'SUCCESS', 'FAIL', 'SKIPPED'].slice(0, content.quiz.length).join() &&
      speakObs.length === content.speaking.length && speakObs.filter((o) => o.outcome === 'SKIPPED').length === content.speaking.length - 1 &&
      obsTotal(dailyAfter) === obsTotal(dailyBefore) + obs.length && (await prisma.learningObservation.count({ where: { userId: u1 } })) === obsBefore + obs.length,
    `quiz=${quizKinds.map((o) => `${o.kind[0]}:${o.outcome}`).join(',')} speak=${speakObs.map((o) => o.outcome).join(',')}`,
  )
  const counts = async () => [await prisma.studyLog.count({ where: { userId: u1 } }), await prisma.learningObservation.count({ where: { userId: u1 } }), await prisma.aiJob.count({ where: { userId: u1 } })].join()
  const c0 = await counts()
  const done2 = await api(COOKIE1, 'POST', `/api/v1/lessons/${failed.id}/complete`, {})
  check('6i 두 번째 완료 409 ALREADY_DONE·행 증가 0', done2.status === 409 && reason(done2) === 'ALREADY_DONE' && (await counts()) === c0)
  const j2 = rdJob ? await pollJob(COOKIE1, rdJob, 120_000) : { status: 'NONE', ms: 0, job: {} }
  metrics.a11ReviewMs = Math.round(j2.ms)
  metrics.a11ReviewStatus = j2.status
  const L2 = d(await api(COOKIE1, 'GET', `/api/v1/lessons/${failed.id}`))
  const nr = L2.nextReview as { decidedBy: string; rationaleKo: string; groups: { days: number; date: string; itemIds: string[] }[] } | null
  const focusIds = new Set((await prisma.repetitionItem.findMany({ where: { id: { in: itemIds }, priority: 'FOCUS' }, select: { id: true } })).map((r) => r.id))
  check(
    '6j #60 nextReview {decidedBy, rationaleKo, groups[{days 3~7, date=오늘+days, itemIds}]}·FOCUS 묶음 ≤3·묶음 합 = 공부한 항목',
    !!nr && ['TUTOR', 'FALLBACK'].includes(nr.decidedBy) && typeof nr.rationaleKo === 'string' && nr.groups.length > 0 &&
      nr.groups.every((g) => g.days >= 3 && g.days <= 7 && g.date === addDays(today, g.days) && g.itemIds.every((id) => !focusIds.has(id) || g.days <= 3)) &&
      nr.groups.flatMap((g) => g.itemIds).sort().join() === [...itemIds].sort().join(),
    `${j2.status} ${nr?.decidedBy} ${nr?.groups.map((g) => `${g.days}d×${g.itemIds.length}`).join(' ')}`,
  )
  check('6k #60 progress 에 서버 칸(reviewDecision) 없음', !('reviewDecision' in ((L2.progress as Json) ?? {})))
  const t8 = await api(COOKIE1, 'GET', '/api/v1/lessons/today')
  const rv8 = d(t8).review as Json
  const nx8 = d(t8).nextReview as Json | null
  check('6l #58 완료 카드: status DONE·lessonStatus DONE·score=레슨 점수(★⑧)·decisionPending false·nextReview{date,days,itemCount,decidedBy}', rv8?.status === 'DONE' && rv8.lessonStatus === 'DONE' && rv8.score === (d(done).lesson as Json)?.score && d(t8).decisionPending === false && !!nx8 && num(nx8.days) >= 1 && num(nx8.itemCount) >= 1 && ['TUTOR', 'FALLBACK'].includes(String(nx8.decidedBy)), JSON.stringify(nx8))
  const stDone = await api(COOKIE1, 'POST', `/api/v1/reviews/${sched!.id}/start`)
  const skDone = await api(COOKIE1, 'POST', `/api/v1/reviews/${sched!.id}/skip`)
  check('6m 끝낸 일정 #63·#64 → 409 NOT_DUE', stDone.status === 409 && reason(stDone) === 'NOT_DUE' && skDone.status === 409 && reason(skDone) === 'NOT_DUE')

  // ── 7. 교정 경로 ─────────────────────────────────────────────────
  const chatR = await api(COOKIE1, 'POST', '/api/v1/chats', { kind: 'CHAT', title: `${MARK} 점검` })
  const chatId = String(d(chatR).id)
  for (const text of ['昨日友だちを会いました。', '私は学生でした、今は会社員です。']) await prisma.chatMessage.create({ data: { chatId, userId: u1, role: 'USER', content: text, inputSource: 'TEXT', status: 'DONE' } })
  const rv = await api(COOKIE1, 'POST', `/api/v1/chats/${chatId}/review`)
  const items = ((d(rv).items as Json[]) ?? []).map((x) => ({ id: String(x.correctionId), severity: String(x.severity) }))
  metrics.a3Ms = Math.round(rv.ms)
  if (rv.status === 200 && items.length) {
    const prop = await prisma.learningObservation.findMany({ where: { userId: u1, kind: 'CORRECTION_PROPOSED', refId: { in: items.map((i) => i.id) } } })
    check('7a #33 점검이 만든 교정마다 CORRECTION_PROPOSED 1행(MAJOR=FAIL·MINOR=PARTIAL)', prop.length === items.length && items.every((i) => prop.some((p) => p.refId === i.id && p.outcome === (i.severity === 'MAJOR' ? 'FAIL' : 'PARTIAL'))), `${items.length}건 ${Math.round(rv.ms)}ms`)
  } else note('7a', `#33 status=${rv.status} 교정 ${items.length}건 — 제안 관측은 단위 테스트로 갈음`)
  const msg = await prisma.chatMessage.findFirstOrThrow({ where: { chatId, role: 'USER' }, orderBy: { createdAt: 'asc' } })
  const mkCorr = (corrected: string, errorType: 'PARTICLE' | 'VOCABULARY' | 'NATURALNESS', explanation: string) =>
    prisma.correction.create({ data: { userId: u1, chatId, messageId: msg.id, original: msg.content, corrected, explanation, errorType, severity: 'MAJOR' } })
  const cA = await mkCorr('友だちに会いました。', 'PARTICLE', '「を」가 아니라 「に」를 써요. 만나다는 に를 씁니다.')
  const cB = await mkCorr('友人に会いました。', 'VOCABULARY', '어휘를 바꿨어요.')
  const cC = await mkCorr('友だちに会いました。', 'PARTICLE', '같은 표현 재채택.')
  const uniq = `駅まで歩いて行きます${RUN.slice(-3)}。`
  const cD = await mkCorr(uniq, 'NATURALNESS', '자연스러운 표현이에요.')
  check('7b IDOR: QA2 가 QA1 교정 채택·거절 → 404', (await api(COOKIE2, 'POST', `/api/v1/corrections/${cA.id}/accept`, {})).status === 404 && (await api(COOKIE2, 'POST', `/api/v1/corrections/${cB.id}/reject`)).status === 404)
  const dBefore = await dailyOf(u1, today)
  const acc = await api(COOKIE1, 'POST', `/api/v1/corrections/${cA.id}/accept`, {})
  const refId = sha1Norm('友だちに会いました。')
  const itemA = await prisma.repetitionItem.findUnique({ where: { userId_refType_refId: { userId: u1, refType: 'Correction', refId } } })
  const obsA = await prisma.learningObservation.findMany({ where: { userId: u1, kind: 'CORRECTION_ACCEPTED', refId: cA.id } })
  check(
    '7c 채택 → EXPRESSION 항목(refType Correction·sha1(교정문)·studied 0·lastStudiedAt null·피드백 1·뜻=설명 첫 문장) + ACCEPTED(GRAMMAR_PARTICLE) + DAILY observations +1',
    acc.status === 200 && itemA?.itemType === 'EXPRESSION' && itemA.studiedCount === 0 && itemA.lastStudiedAt === null && itemA.feedbackCount === 1 && itemA.meaningKo === '「を」가 아니라 「に」를 써요.' && itemA.textJa === '友だちに会いました。' &&
      obsA.length === 1 && obsA[0].outcome === 'SUCCESS' && obsA[0].skill === 'GRAMMAR_PARTICLE' && obsTotal(await dailyOf(u1, today)) === obsTotal(dBefore) + 1,
    `item=${JSON.stringify({ s: itemA?.studiedCount, f: itemA?.feedbackCount, p: itemA?.priority })}`,
  )
  const acc3 = await api(COOKIE1, 'POST', `/api/v1/corrections/${cC.id}/accept`, {})
  const itemA2 = await prisma.repetitionItem.findUnique({ where: { id: itemA?.id ?? '' } })
  check('7d 같은 교정문 재채택 → 같은 항목 피드백 2(새 항목 없음, studied 그대로 0)', acc3.status === 200 && itemA2?.feedbackCount === 2 && itemA2.studiedCount === 0 && (await prisma.repetitionItem.count({ where: { userId: u1, refType: 'Correction', refId } })) === 1)
  const rej = await api(COOKIE1, 'POST', `/api/v1/corrections/${cB.id}/reject`)
  const obsB = await prisma.learningObservation.findMany({ where: { userId: u1, refId: cB.id } })
  check('7e 거절 → CORRECTION_IGNORED(SKIPPED, VOCAB_RECALL) 1행·항목 없음', rej.status === 200 && obsB.length === 1 && obsB[0].kind === 'CORRECTION_IGNORED' && obsB[0].outcome === 'SKIPPED' && obsB[0].skill === 'VOCAB_RECALL' && (await prisma.repetitionItem.count({ where: { userId: u1, refType: 'Correction', refId: sha1Norm('友人に会いました。') } })) === 0)
  const word = await api(COOKIE1, 'POST', '/api/v1/words', { surface: `復習語${RUN.slice(-2)}`, meaning: '복습 단어', category: WORD_CATEGORY })
  const wordSurface = String((d(word).word as Json | undefined)?.surface)
  const snapCounts = async () => [await prisma.repetitionItem.count({ where: { userId: u1 } }), await prisma.learningObservation.count({ where: { userId: u1 } }), JSON.stringify(await dailyOf(u1, today))].join('|')
  const s0 = await snapCounts()
  const dup = await api(COOKIE1, 'POST', `/api/v1/corrections/${cD.id}/accept`, { addWord: { surface: wordSurface, meaning: '중복' } })
  const cDrow = await prisma.correction.findUniqueOrThrow({ where: { id: cD.id }, select: { status: true } })
  check('7f 단어 중복 409 → 채택 트랜잭션 전체 롤백(항목·관측·DAILY 변화 0, 교정 PROPOSED)', word.status === 200 && dup.status === 409 && cDrow.status === 'PROPOSED' && (await snapCounts()) === s0, `${word.status}/${dup.status}`)

  // ── 8. 단어 세트 ─────────────────────────────────────────────────
  for (const [s, m] of [['見学', '견학'], ['散歩', '산책'], ['料理', '요리']] as const) await api(COOKIE1, 'POST', '/api/v1/words', { surface: `${s}${RUN.slice(-2)}`, meaning: m, category: WORD_CATEGORY })
  const set = await api(COOKIE1, 'POST', '/api/v1/vocab/sessions', { category: WORD_CATEGORY, mode: 'FLIP', count: 4 })
  const sess = d(set).session as Json | null
  const cards = ((d(set).cards as Json[]) ?? []).map((c) => ({ order: Number(c.order), wordId: c.wordId as string | null }))
  if (!sess || cards.length < 3) {
    check('8 단어 세트 생성', false, `status=${set.status} ${JSON.stringify(d(set)).slice(0, 120)}`)
    return
  }
  const sid = String(sess.id)
  const plan = cards.map((c, i) => (i === 0 ? 'CORRECT' : i === 1 ? 'WRONG' : i === 2 ? 'CORRECT' : null))
  for (const [i, c] of cards.entries()) if (plan[i]) await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/attempts`, { order: c.order, selfResult: plan[i], responseMs: 2000 + i * 100 })
  const decBefore = await prisma.aiJob.count({ where: { userId: u1, kind: 'REVIEW_DECISION' } })
  const sessDate = ymd((await prisma.vocabSession.findUniqueOrThrow({ where: { id: sid }, select: { date: true } })).date)!
  const dSet0 = await dailyOf(u1, sessDate)
  const fin = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/finish`)
  check('8a #51 응답 형태 그대로(session·studyLogId·wrongWords·flaggedCount)', fin.status === 200 && Object.keys(d(fin)).sort().join() === 'flaggedCount,session,studyLogId,wrongWords')
  const wordItems = await prisma.repetitionItem.findMany({ where: { userId: u1, refType: 'WordEntry', refId: { in: cards.map((c) => c.wordId ?? '') } } })
  check(
    '8b 답한 카드만 WORD 항목(studied 1·정오답) — 건너뛴 카드 없음',
    wordItems.length === plan.filter(Boolean).length && cards.every((c, i) => {
      const it = wordItems.find((w) => w.refId === c.wordId)
      return plan[i] ? !!it && it.itemType === 'WORD' && it.studiedCount === 1 && it.correctCount === (plan[i] === 'CORRECT' ? 1 : 0) && it.wrongCount === (plan[i] === 'WRONG' ? 1 : 0) : !it
    }),
  )
  const attempts = await prisma.vocabAttempt.findMany({ where: { sessionId: sid }, orderBy: { order: 'asc' }, select: { id: true } })
  const vObs = await prisma.learningObservation.findMany({ where: { userId: u1, refType: 'VocabAttempt', refId: { in: attempts.map((a) => a.id) } } })
  const dSet1 = await dailyOf(u1, sessDate)
  check(
    '8c 카드마다 VOCAB_RECOGNITION(맞힘 SUCCESS·틀림 FAIL·건너뜀 SKIPPED·지연 null)·DAILY(세트 날짜) observations +카드 수·words.sessions+1',
    vObs.length === cards.length && vObs.filter((o) => o.outcome === 'SKIPPED').every((o) => o.latencyMs === null) && vObs.filter((o) => o.outcome === 'SUCCESS').length === 2 && vObs.filter((o) => o.outcome === 'FAIL').length === 1 &&
      obsTotal(dSet1) === obsTotal(dSet0) + cards.length && num((dSet1.words as Json)?.sessions) === num((dSet0.words as Json)?.sessions) + 1,
  )
  const decAfter = await prisma.aiJob.count({ where: { userId: u1, kind: 'REVIEW_DECISION' } })
  check('8d 세트를 끝낸 뒤 A11 잡 1개 더(트랜잭션 뒤 적재)', decAfter === decBefore + 1, `${decBefore}→${decAfter}`)
  const fin2 = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${sid}/finish`)
  check('8e 끝난 세트 다시 #51 → 같은 응답·새 판단 잡 없음·항목 변화 없음', fin2.status === 200 && JSON.stringify(d(fin2).session) === JSON.stringify(d(fin).session) && (await prisma.aiJob.count({ where: { userId: u1, kind: 'REVIEW_DECISION' } })) === decAfter)
  const lastDec = await prisma.aiJob.findFirst({ where: { userId: u1, kind: 'REVIEW_DECISION' }, orderBy: { createdAt: 'desc' }, select: { id: true } })
  const j3 = lastDec ? await pollJob(COOKIE1, lastDec.id, 120_000) : { status: 'NONE', ms: 0, job: {} }
  metrics.a11WordsMs = Math.round(j3.ms)
  metrics.a11WordsStatus = j3.status
  const judged = await prisma.repetitionItem.findMany({ where: { id: { in: wordItems.map((w) => w.id) } } })
  check('8f 단어 항목도 판단됨(decidedAt·3~7)', judged.every((w) => !!w.decidedAt && w.intervalDays >= 3 && w.intervalDays <= 7), `${j3.status} ${judged.map((w) => `${w.intervalDays}${w.decidedBy[0]}`).join(' ')}`)

  // ── 9. 엔진명·내부 값 누출 ─────────────────────────────────────────
  check('9a 응답 전체 엔진명·프롬프트 버전·모델 0', leakHits === 0, `hits=${leakHits}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
