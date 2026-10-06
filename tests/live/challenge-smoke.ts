/**
 * task-041 챌린지 서버 코어 라이브 스모크 — **QA 계정 3(챌린지 레인)** + 계정 2(IDOR)로 실제 서버(127.0.0.1)·실제 DB 를 친다. LLM 호출 없음.
 *
 *  A. API(오늘): 시작 전 정리 → #158 없음 → 입력 400·주제 404 → **동시 두 #156 → 하나만 200, 나머지 409 ACTIVE_EXISTS** → #155 → #157 →
 *     타인 #157·#159 404 → #158 할 일 → #58 `reason:'CHALLENGE'` → #70·#71 챌린지 칸 → #159 그만두기·멱등 → **끝낸 뒤 새로 만들기 성공** → 정리.
 *     이 구간 전후로 계정 3 의 **AiJob·RequestTrace 행 증가 0**(5초 지표 ⓐ — #58 은 챌린지 없이 부른 값과 비교).
 *  B. 지표(DB 로 심은 과거 날짜 챌린지 — 시작일 = 오늘−3): 확인 표 1·12(소급 달성 — 3일째 23:50 시작·오늘 00:01 끝낸 세트)·23:59/00:01 경계 ·
 *     **StudyLog(#73)·Lesson 을 지운 전후 지표 동일**(스냅샷만 읽음) · 그만둔 당일 `result.days[]` = 그 직전 상세의 지난 날 상태.
 *  C. 지연 전이: 마지막 날이 어제인 진행 중 챌린지 + 오늘 00:00:30 에 끝낸(어제 시작) 세트 → #158 이 COMPLETED 로 전이 ·
 *     `endedAt` = 오늘 00:00 KST · 마감 뒤 세트 제외 · 다시 불러도 같은 결과.
 *  D. 참고치: #157 p50/p95 — **진행 중(D 에서 새로 심은 ACTIVE)·끝난(C 의 COMPLETED, result 있음) 챌린지 각각 20회**(설계 목표 ≤300ms,
 *     합격 판정 아님). 20회 중 하나라도 200·기대 상태가 아니면 FAIL 이고 지연을 참고치로 찍지 않는다(REV-120 M-1 — 지운 챌린지의 404 지연이
 *     p95 로 찍히던 결함).
 *
 * 실행(우분투 미러, 서버는 따로): `bash tests/live/challenge-smoke.sh [포트]`. 00:05~23:50 KST 사이에 돌린다(B·C 가 오늘 00:01·00:00:30 스냅샷을 심는다).
 * 공유 DB(개발·운영 같은 NAS)에 직접 쓰므로 가드: `APP_ENV=PRODUCTION` 거부 · 서버는 localhost 이고 운영 포트 3010 거부 · 두 계정 모두
 * 앱과 같은 QA 계정 규칙(`QA_USER_WHERE` — provider test + @thekaiwa.test)에 맞아야 시작한다(REV-120 L-3).
 * **이 실행이 만든 행만** 지운다(챌린지 id 목록·periodKey 접두 `t041`·표식 수업·기록). 남은 행은 `challenge-cleanup.ts` 로.
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../../src/modules/infra/db'
import { QA_USER_WHERE } from '../../src/modules/infra/users'

if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 환경에서는 실행하지 않는다')
const BASE = process.env.BASE ?? 'http://127.0.0.1:3021'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE) || BASE.endsWith(':3010')) throw new Error('BASE 는 localhost(운영 3010 제외)만 허용')
const [c3file, c2file] = process.argv.slice(2)
if (!c3file || !c2file) throw new Error('사용: challenge-smoke.ts <QA3 쿠키> <QA2 쿠키>')
const COOKIE3 = readFileSync(c3file, 'utf8').trim()
const COOKIE2 = readFileSync(c2file, 'utf8').trim()
if (!COOKIE3 || !COOKIE2) throw new Error('QA 쿠키 파일이 비어 있다 — qa-session.ts 실패 여부를 확인')
const LEAK = /claude|haiku|sonnet|opus|qwen|toolLog|home-m4|reazon|whisper|style-?bert|sbv2/i
const MARK = 't041'
let leakHits = 0
const results: { id: string; ok: boolean; note: string }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok, note })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}

type Json = Record<string, unknown>
interface Res {
  status: number
  data: Json & { code?: string; details?: Json }
  ms: number
}
async function api(cookie: string, method: string, path: string, body?: unknown): Promise<Res> {
  const t0 = performance.now()
  const r = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) })
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
  return { status: r.status, data, ms }
}

const KST = 9 * 3600_000
const todayKst = (d = new Date()) => new Date(d.getTime() + KST).toISOString().slice(0, 10)
const addDays = (s: string, n: number) => new Date(Date.parse(`${s}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const at = (date: string, hhmmss: string) => new Date(`${date}T${hhmmss}+09:00`)
const dbDate = (s: string) => new Date(`${s}T00:00:00.000Z`)

const created: string[] = []
const lessonsMade: string[] = []
let snapSeq = 0
/** 확인을 통과한 QA 계정 3 id — 비어 있으면 아무 행도 만들지 않은 것이라 정리도 건너뛴다. */
let qa3 = ''

/** QA 계정만(앱과 같은 `QA_USER_WHERE`) — 실사용자(Google) 계정은 이메일이 같아도 걸리지 않는다. */
async function uid(email: string): Promise<string> {
  const user = await prisma.user.findFirst({ where: { AND: [{ email }, QA_USER_WHERE] }, select: { id: true } })
  if (!user) throw new Error(`${email} 이 없거나 QA 계정 규칙에 맞지 않는다 — 중단`)
  return user.id
}

async function seedSnap(userId: string, kind: 'LESSON' | 'VOCAB_SESSION', data: Json, createdAt: Date, periodKey?: string): Promise<string> {
  const key = periodKey ?? `${MARK}${kind === 'LESSON' ? 'l' : 's'}${Date.now().toString(36)}${(++snapSeq).toString(36)}`
  await prisma.statsSnapshot.create({ data: { userId, kind, periodKey: key, data: data as object, createdAt } })
  return key
}
const lessonData = (topicId: string, date: string, quizCorrect = 4) => ({ kind: 'NEW', topicId, score: quizCorrect * 20, stageDone: 5, itemCount: 4, quizCorrect, quizTotal: 5, date })
const setData = (topicId: string, date: string, c: number, w: number, s: number) => ({ cardCount: c + w + s, correct: c, wrong: w, skipped: s, durationSec: 60, mode: 'CHOICE', date, topicId })

async function seedChallenge(userId: string, topic: { id: string; title: string }, startDate: string, lengthDays = 7): Promise<string> {
  const row = await prisma.challenge.create({
    data: {
      userId, title: `${MARK} ${topic.title}`, topicId: topic.id, topicTitleSnap: topic.title, level: 'N5', lengthDays,
      startDate: dbDate(startDate), endDate: dbDate(addDays(startDate, lengthDays - 1)),
      dailyGoal: { lesson: true, words: true, wordCount: 10, wordsMinAnswered: 8, countSkipped: false, ruleVersion: 1 },
      status: 'ACTIVE', activeKey: userId, createdAt: at(startDate, '08:00:00'),
    },
    select: { id: true },
  })
  created.push(row.id)
  return row.id
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * AiJob·RequestTrace 행 수 — 계정의 잡이 다 끝난 뒤에 센다. 기준 #58 이 건 A11 잡이 구간 중간에 끝나며 Trace 를 쓰면
 * "챌린지 때문에 생긴 행"으로 잘못 셀 수 있어서다(잡이 실행 중이면 최대 150초 기다린다 — A11 CLI 상한 근처).
 */
async function counts(userId: string): Promise<{ jobs: number; traces: number; settled: boolean }> {
  let settled = false
  for (let i = 0; i < 75; i++) {
    if ((await prisma.aiJob.count({ where: { userId, status: { in: ['QUEUED', 'RUNNING'] } } })) === 0) {
      settled = true
      break
    }
    await sleep(2_000)
  }
  await sleep(1_000)
  const [jobs, traces] = await Promise.all([prisma.aiJob.count({ where: { userId } }), prisma.requestTrace.count({ where: { userId } })])
  return { jobs, traces, settled }
}

async function endActive(userId: string, cookie: string): Promise<void> {
  const active = await prisma.challenge.findFirst({ where: { userId, status: 'ACTIVE' }, select: { id: true } })
  if (active) await api(cookie, 'POST', `/api/v1/challenges/${active.id}/end`, {})
}

/** #157 을 20번 — 전부 200·기대 상태일 때만 p50/p95(nearest-rank)를 찍는다. 하나라도 어긋나면 FAIL(지연을 참고치로 남기지 않는다). */
async function detailLatency(checkId: string, label: string, id: string, wantStatus: string): Promise<void> {
  const ms: number[] = []
  const bad: string[] = []
  for (let i = 0; i < 20; i++) {
    const r = await api(COOKIE3, 'GET', `/api/v1/challenges/${id}`)
    ms.push(r.ms)
    if (r.status !== 200 || r.data.status !== wantStatus) bad.push(`${r.status}/${String(r.data.status)}`)
  }
  check(`${checkId} #157 ${label} 20회 모두 200·${wantStatus}`, bad.length === 0, bad.length ? `어긋남 ${bad.length}회 (${[...new Set(bad)].join(' ')}) — 참고치 무효` : '')
  if (bad.length) return
  ms.sort((a, b) => a - b)
  const at = (p: number) => ms[Math.min(ms.length - 1, Math.ceil((p / 100) * ms.length) - 1)].toFixed(0)
  console.log(`INFO ${checkId} #157 ${label} p50 ${at(50)}ms · p95 ${at(95)}ms (설계 목표 ≤300ms — 참고치)`)
}

async function main(): Promise<void> {
  const u3 = await uid('qa-bot3@thekaiwa.test')
  const u2 = await uid('qa-bot2@thekaiwa.test')
  qa3 = u3
  const today = todayKst()
  const hhmm = new Date(Date.now() + KST).toISOString().slice(11, 16)
  if (hhmm < '00:05' || hhmm > '23:50') throw new Error(`KST ${hhmm} — 00:05~23:50 에 실행한다(자정 경계 스냅샷을 심는다)`)
  const topic = await prisma.conversationTopic.findFirstOrThrow({ where: { userId: null, level: 'N5' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, title: true } })
  const other = await prisma.conversationTopic.findFirstOrThrow({ where: { userId: null, id: { not: topic.id } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, title: true } })
  await endActive(u3, COOKIE3)

  // ── A. API ────────────────────────────────────────────────────────────
  const r58base = await api(COOKIE3, 'GET', '/api/v1/lessons/today')
  const before = await counts(u3)
  const t0 = await api(COOKIE3, 'GET', '/api/v1/challenges/today')
  check('A1 #158 진행 중 없음', t0.status === 200 && t0.data.challenge === null && t0.data.today === null, `${t0.status}`)
  const bad = await Promise.all([
    api(COOKIE3, 'POST', '/api/v1/challenges', { topicId: topic.id, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: false, words: false } }),
    api(COOKIE3, 'POST', '/api/v1/challenges', { topicId: topic.id, lengthDays: 9, start: 'TODAY', dailyGoal: { lesson: true, words: false } }),
    api(COOKIE3, 'POST', '/api/v1/challenges', { topicId: topic.id, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: true, words: false }, x: 1 }),
    api(COOKIE3, 'POST', '/api/v1/challenges', { topicId: topic.id, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: true, words: true, wordCount: 15 } }),
  ])
  check('A2 #156 400(둘 다 끔·기간·모르는 키·WORD_COUNT_OVER_POOL)', bad.every((r) => r.status === 400) && bad[3].data.details?.reason === 'WORD_COUNT_OVER_POOL' && typeof bad[3].data.details?.poolSize === 'number', bad.map((r) => r.status).join('/'))
  const mineU2 = await prisma.conversationTopic.findFirst({ where: { userId: u2 }, select: { id: true } })
  const nf = await api(COOKIE3, 'POST', '/api/v1/challenges', { topicId: mineU2?.id ?? 'cnotexist000000000000000', lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: true, words: false } })
  check('A3 #156 남의/없는 주제 404', nf.status === 404, `${nf.status}${mineU2 ? '' : ' (계정 2 주제 없음 — 없는 id 로 확인)'}`)
  const goal = { lesson: true, words: true, wordCount: 10 }
  const pair = await Promise.all([1, 2].map(() => api(COOKIE3, 'POST', '/api/v1/challenges', { topicId: topic.id, lengthDays: 7, start: 'TODAY', dailyGoal: goal })))
  const okOne = pair.find((r) => r.status === 200)
  const conflict = pair.find((r) => r.status === 409)
  if (okOne) created.push(String(okOne.data.id))
  check('A4 동시 두 #156 → 하나 200 · 하나 409 ACTIVE_EXISTS', !!okOne && !!conflict && conflict.data.details?.reason === 'ACTIVE_EXISTS' && conflict.data.details?.challengeId === okOne.data.id, pair.map((r) => r.status).join('/'))
  check('A5 진행 중 행 1개', (await prisma.challenge.count({ where: { userId: u3, status: 'ACTIVE' } })) === 1)
  const cid = String(okOne?.data.id ?? '')
  const d157 = await api(COOKIE3, 'GET', `/api/v1/challenges/${cid}`)
  const days = (d157.data.days as Json[] | undefined) ?? []
  check('A6 #157 상세 — 7일·오늘 TODAY·dailyGoal 얼림(8장)·topicProgress', d157.status === 200 && days.length === 7 && days[0].state === 'TODAY' && (d157.data.dailyGoal as Json)?.wordsMinAnswered === 8 && !!d157.data.topicProgress, `${d157.status}`)
  const idor = await Promise.all([api(COOKIE2, 'GET', `/api/v1/challenges/${cid}`), api(COOKIE2, 'POST', `/api/v1/challenges/${cid}/end`, {})])
  check('A7 타인 #157·#159 404', idor.every((r) => r.status === 404), idor.map((r) => r.status).join('/'))
  const list = await api(COOKIE3, 'GET', '/api/v1/challenges')
  check('A8 #155 진행 중 먼저', list.status === 200 && ((list.data.items as Json[])[0]?.id === cid), `${list.status}`)
  const t1 = await api(COOKIE3, 'GET', '/api/v1/challenges/today')
  const tasks = ((t1.data.today as Json)?.tasks as Json[] | undefined) ?? []
  check('A9 #158 오늘 할 일 순서 단어 → 회화', t1.status === 200 && tasks.map((t) => t.kind).join(',') === 'WORDS,LESSON', tasks.map((t) => `${t.kind}:${t.state}`).join(' '))
  const r58 = await api(COOKIE3, 'GET', '/api/v1/lessons/today')
  const rec = r58.data.recommendation as Json | null
  check('A10 #58 recommendation CHALLENGE(챌린지 주제)', r58.status === 200 && rec?.reason === 'CHALLENGE' && rec?.topicId === topic.id, String(rec?.reason))
  check('A10b #58 기존 칸 모양 불변', JSON.stringify(Object.keys(r58.data).sort()) === JSON.stringify(Object.keys(r58base.data).sort()))
  const cal = await api(COOKIE3, 'GET', `/api/v1/plan/calendar?month=${today.slice(0, 7)}`)
  const calDay = (cal.data.days as Json[]).find((x) => x.date === today)
  check('A11 #70 days[].challenge·summary.challenge', cal.status === 200 && (calDay?.challenge as Json)?.challengeId === cid && ((cal.data.summary as Json).challenge as Json)?.id === cid)
  const day = await api(COOKIE3, 'GET', `/api/v1/plan/day?date=${today}`)
  check('A12 #71 challenge 줄', day.status === 200 && (day.data.challenge as Json)?.challengeId === cid && (day.data.challenge as Json)?.dayIndex === 1)
  const e1 = await api(COOKIE3, 'POST', `/api/v1/challenges/${cid}/end`, {})
  const e2 = await api(COOKIE3, 'POST', `/api/v1/challenges/${cid}/end`, {})
  check('A13 #159 ENDED · 두 번째도 같은 응답(멱등)', e1.status === 200 && e1.data.status === 'ENDED' && JSON.stringify(e1.data) === JSON.stringify(e2.data))
  const row = await prisma.challenge.findUniqueOrThrow({ where: { id: cid }, select: { activeKey: true, result: true } })
  check('A14 끝낸 행 activeKey=null · result 얼림(USER)', row.activeKey === null && (row.result as Json)?.endReason === 'USER')
  const again = await api(COOKIE3, 'POST', '/api/v1/challenges', { topicId: other.id, lengthDays: 14, start: 'TOMORROW', dailyGoal: { lesson: true, words: false } })
  if (again.status === 200) created.push(String(again.data.id))
  check('A15 끝낸 뒤 새로 만들기 성공(내일 시작)', again.status === 200 && again.data.startDate === addDays(today, 1), `${again.status}`)
  await endActive(u3, COOKIE3)
  const after = await counts(u3)
  // 기준선: 챌린지 없이 부른 #58(r58base)이 그날 첫 진입 A11 잡을 이미 걸었으므로, 아래 구간에서 더 생긴 것 = 챌린지 때문에 생긴 것.
  check('A16 챌린지 경로(#155~#159·#58·#70·#71) AiJob·RequestTrace 증가 0', before.settled && after.settled && after.jobs === before.jobs && after.traces === before.traces, `jobs ${before.jobs}→${after.jobs} traces ${before.traces}→${after.traces}${before.settled && after.settled ? '' : ' (잡이 150초 안에 끝나지 않음 — 다시 실행)'}`)

  // ── B. 지표(과거 날짜 — 시작일 오늘−3) ─────────────────────────────────
  const s = addDays(today, -3)
  const [d1, d2, d3] = [s, addDays(s, 1), addDays(s, 2)]
  const bId = await seedChallenge(u3, topic, s)
  const lesson = await prisma.lesson.create({ data: { userId: u3, topicId: topic.id, date: dbDate(d1), kind: 'NEW', title: MARK, level: 'N5', status: 'DONE', stageDone: 5, score: 80, completedAt: at(d1, '20:00:00') } })
  lessonsMade.push(lesson.id)
  const log = await prisma.studyLog.create({ data: { userId: u3, date: dbDate(d1), type: 'LESSON', origin: 'DIRECT', refId: lesson.id, summary: `${MARK} 수업`, result: { smoke: true } } })
  await seedSnap(u3, 'VOCAB_SESSION', setData(topic.id, d1, 7, 2, 1), at(d1, '19:00:00'))
  await seedSnap(u3, 'LESSON', lessonData(topic.id, d1, 4), at(d1, '20:00:00'), lesson.id)
  await seedSnap(u3, 'VOCAB_SESSION', setData(topic.id, d2, 8, 2, 0), at(d2, '19:00:00'))
  await seedSnap(u3, 'LESSON', lessonData(topic.id, d2, 5), at(d2, '23:59:00')) // 23:59 경계 — 2일째
  await seedSnap(u3, 'LESSON', lessonData(topic.id, d3, 4), at(d3, '15:00:00'))
  await seedSnap(u3, 'VOCAB_SESSION', setData(topic.id, d3, 6, 3, 1), at(today, '00:01:00')) // 3일째 23:50 시작 · 오늘 00:01 끝냄 → 3일째 소급
  await seedSnap(u3, 'LESSON', lessonData(other.id, today, 5), at(today, '00:02:00')) // 다른 주제 — 세지 않음
  const b1 = await api(COOKIE3, 'GET', `/api/v1/challenges/${bId}`)
  const states = ((b1.data.days as Json[]) ?? []).map((x) => x.state).join(',')
  const st = b1.data.stats as Json
  check('B1 확인 표 12ⓒ — ✓✓✓오··· · 3·3·1.0 · 연속 3', states === 'MET,MET,MET,TODAY,UPCOMING,UPCOMING,UPCOMING' && st?.elapsedDays === 3 && st?.metDays === 3 && st?.rate === 1 && st?.streak === 3, `${states} ${JSON.stringify(st)}`)
  check('B2 누적 수업 3 · 세트 3 · 맞힌 카드 21', JSON.stringify(b1.data.totals) === JSON.stringify({ lessonsDone: 3, wordSets: 3, wordsCorrect: 21 }), JSON.stringify(b1.data.totals))
  const delLog = await api(COOKIE3, 'DELETE', `/api/v1/study-logs/${log.id}`)
  await prisma.lesson.delete({ where: { id: lesson.id } })
  const b2 = await api(COOKIE3, 'GET', `/api/v1/challenges/${bId}`)
  const same = JSON.stringify([b1.data.stats, b1.data.totals, (b1.data.days as Json[]).map((x) => x.state)]) === JSON.stringify([b2.data.stats, b2.data.totals, (b2.data.days as Json[]).map((x) => x.state)])
  check('B3 StudyLog(#73)·Lesson 삭제 전후 지표 동일 · 링크만 refExists=false', delLog.status === 200 && same && ((b2.data.days as Json[])[0].lesson as Json)?.refExists === false, `${delLog.status}`)
  const pastStates = ((b2.data.days as Json[]) ?? []).slice(0, 3).map((x) => x.state)
  const eB = await api(COOKIE3, 'POST', `/api/v1/challenges/${bId}/end`, {})
  const frozen = ((await prisma.challenge.findUniqueOrThrow({ where: { id: bId }, select: { result: true } })).result as { days: { state: string }[] }).days.map((x) => x.state)
  check('B4 그만둔 당일 result.days = 직전 상세의 지난 날 + 오늘·뒤 날 그만둠', eB.status === 200 && JSON.stringify(frozen) === JSON.stringify([...pastStates, 'STOPPED', 'STOPPED', 'STOPPED', 'STOPPED']), frozen.join(','))

  // ── C. 지연 전이 — 마지막 날 = 어제 ───────────────────────────────────
  // A·B 에서 그만둔 챌린지는 endedAt = 지금이라 C 의 COMPLETED(endedAt = 오늘 00:00)보다 나중이다 — recentlyEnded(endedAt desc 1개)가
  // C 를 가리키는지 보려면 이 실행이 만든 끝난 행을 먼저 지운다(정리 대상과 같은 행).
  await prisma.challenge.deleteMany({ where: { userId: u3, id: { in: created }, status: { in: ['COMPLETED', 'ENDED'] } } })
  const strayEnded = await prisma.challenge.count({ where: { userId: u3, status: { in: ['COMPLETED', 'ENDED'] }, endedAt: { gte: at(today, '00:00:00') } } })
  if (strayEnded) console.log(`  ! 계정 3 에 오늘 끝난 다른 챌린지 ${strayEnded}개 — C3 이 그쪽을 가리킬 수 있다(다른 레인 정리 확인)`)
  const cStart = addDays(today, -7)
  const yesterday = addDays(today, -1)
  const cId = await seedChallenge(u3, topic, cStart)
  await seedSnap(u3, 'LESSON', lessonData(topic.id, yesterday, 3), at(yesterday, '21:00:00'))
  await seedSnap(u3, 'VOCAB_SESSION', setData(topic.id, yesterday, 9, 1, 0), at(today, '00:00:30')) // 마감 뒤
  const c1 = await api(COOKIE3, 'GET', '/api/v1/challenges/today')
  const cRow = await prisma.challenge.findUniqueOrThrow({ where: { id: cId }, select: { status: true, activeKey: true, endedAt: true, result: true } })
  const lastDay = (cRow.result as { days: { state: string; words: unknown }[] } | null)?.days?.[6]
  check('C1 #158 이 COMPLETED 로 전이 · endedAt = 오늘 00:00 KST · activeKey=null', c1.status === 200 && cRow.status === 'COMPLETED' && cRow.activeKey === null && cRow.endedAt?.getTime() === at(today, '00:00:00').getTime(), `${cRow.status} ${cRow.endedAt?.toISOString()}`)
  check('C2 마감 뒤 세트 제외(마지막 날 = 수업만 → PARTIAL, 단어 없음)', lastDay?.state === 'PARTIAL' && lastDay?.words === null, JSON.stringify(lastDay))
  check('C3 recentlyEnded = 이 챌린지', (c1.data.recentlyEnded as Json)?.id === cId)
  const c2 = await api(COOKIE3, 'GET', `/api/v1/challenges/${cId}`)
  check('C4 다시 읽어도 같은 결과(얼린 값)', c2.status === 200 && JSON.stringify(c2.data.result) === JSON.stringify(cRow.result) && (c2.data.stats as Json).streak === null)

  // ── D. #157 참고치 — 진행 중·끝난 챌린지 각각 ─────────────────────────────
  // B 의 bId 는 C 앞에서 지워졌다(위 deleteMany) — 그 id 를 재면 404 지연이 찍힌다. 진행 중은 B 와 같은 시작일(오늘−3)로 새로 심어
  // B·C 가 심은 스냅샷이 기간 안에 들어오게 하고(실제 계산 경로), 끝난 것은 C 에서 COMPLETED 로 전이된 cId(result 있음 — 링크 재계산 경로).
  const dId = await seedChallenge(u3, topic, s)
  await detailLatency('D1a', '진행 중', dId, 'ACTIVE')
  await detailLatency('D1b', '끝난(COMPLETED)', cId, 'COMPLETED')
  check('D2 응답에 엔진·모델명 0', leakHits === 0, `${leakHits}`)
}

async function cleanup(): Promise<void> {
  if (!qa3) return
  const u3 = qa3
  await prisma.challenge.deleteMany({ where: { userId: u3, OR: [{ id: { in: created } }, { title: { startsWith: MARK } }] } })
  await prisma.statsSnapshot.deleteMany({ where: { userId: u3, kind: { in: ['LESSON', 'VOCAB_SESSION'] }, OR: [{ periodKey: { startsWith: MARK } }, { periodKey: { in: lessonsMade } }] } })
  await prisma.studyLog.deleteMany({ where: { userId: u3, summary: { startsWith: MARK } } })
  await prisma.lesson.deleteMany({ where: { userId: u3, id: { in: lessonsMade } } })
}

main()
  .catch((e) => {
    console.error('스모크 중단:', e instanceof Error ? e.message : String(e))
    results.push({ id: 'RUN', ok: false, note: 'exception' })
  })
  .finally(async () => {
    await cleanup().catch((e) => console.error('정리 실패 — challenge-cleanup.ts 로 정리:', e instanceof Error ? e.message : String(e)))
    const fail = results.filter((r) => !r.ok)
    console.log(`\n결과: ${results.length - fail.length}/${results.length} PASS${fail.length ? ` · FAIL ${fail.map((f) => f.id).join(',')}` : ''}`)
    await prisma.$disconnect()
    process.exit(fail.length ? 1 : 0)
  })
