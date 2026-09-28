/**
 * task-012 라이브 스모크 — QA 계정 두 개로 달력(#70)·하루 상세(#71)·학습 기록 목록(#72)·삭제(#73)를 실제 서버(127.0.0.1)·실제 DB 에 친다.
 *
 * 데이터 두 갈래:
 *   (1) **2024-02(윤년) 격리 달**에 기록·출석·복습 예정·레슨·평가·스냅샷을 DB 로 직접 심는다 — 월 경계(1/31·3/1)·KST 날짜·
 *       minutes 합·refExists(본인 대화 ✓ / 남의 대화 ✗ / 없는 레슨 ✗)·타 사용자 격리를 정확한 기대값으로 검증한다.
 *   (2) **오늘** 실제 API 로 단어 5개 → 뒤집기 세트 → 답 2장 → 끝내기 → StudyLog(WORDS, DIRECT)·VOCAB_SESSION·DAILY 를 만든다(LLM 호출 없음).
 * 삭제 검증: 삭제 전후 **QA 두 계정의 StatsSnapshot 모든 행(id·kind·periodKey·data·updatedAt)** 이 같아야 한다.
 *
 * 실행(우분투 미러): `bash tests/live/task012-smoke.sh [포트=3013]`. DB 는 개발·운영 공유라 **이 실행이 만든 QA 행만** 지우고,
 * 오늘 DAILY 는 시작 전 값으로 되돌린다(없었으면 행 삭제).
 */
import { readFileSync } from 'node:fs'
import { PrismaClient, type Prisma } from '@prisma/client'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3013'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만 허용')
const [c1file, c2file] = process.argv.slice(2)
if (!c1file || !c2file) throw new Error('사용: task012-smoke.ts <cookie1> <cookie2>')
const COOKIE1 = readFileSync(c1file, 'utf8').trim()
const COOKIE2 = readFileSync(c2file, 'utf8').trim()
const prisma = new PrismaClient()
const LEAK = /claude|haiku|sonnet|opus|qwen|toolLog|home-m4|reazon|whisper|style-?bert|sbv2/i
const MARK = 't012-smoke'
const WORD_CATEGORY = 't012스모크'
let leakHits = 0
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
async function api(cookie: string | null, method: string, path: string, body?: unknown): Promise<Res> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) headers.Cookie = cookie
  const r = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  if (LEAK.test(text)) {
    leakHits++
    console.log(`  ! 누출 의심 ${method} ${path}`)
  }
  let parsed: Res['body']
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { success: false, data: {}, message: text.slice(0, 200) }
  }
  return { status: r.status, body: parsed, text }
}
const d = (r: Res) => r.body.data as Json

const dbDate = (s: string) => new Date(`${s}T00:00:00.000Z`)
const SEED_FROM = dbDate('2024-01-01')
const SEED_TO = dbDate('2024-03-31')
const LOG_KEYS = ['correctionsCount', 'createdAt', 'date', 'durationSec', 'id', 'origin', 'refExists', 'refId', 'result', 'summary', 'type'].join(',')

interface State {
  u1: string
  u2: string
  chatIds: string[]
  lessonId: string | null
  evalId: string | null
  sessionIds: string[]
  wordIds: string[]
  today: string | null
  dailyBefore: { existed: boolean; data: Prisma.JsonValue | null }
  seededSnapshotKeys: { kind: 'DAILY' | 'LESSON' | 'EVALUATION'; periodKey: string }[]
}
const st: State = { u1: '', u2: '', chatIds: [], lessonId: null, evalId: null, sessionIds: [], wordIds: [], today: null, dailyBefore: { existed: false, data: null }, seededSnapshotKeys: [] }

async function uid(email: string): Promise<string> {
  return (await prisma.user.findUniqueOrThrow({ where: { email } })).id
}

/** 이전 실행이 중단돼 남은 격리 달(2024-01~03) 행·표식 행을 지운다 — QA 두 계정만. */
async function wipeSeed(users: string[]): Promise<void> {
  const inRange = { gte: SEED_FROM, lte: SEED_TO }
  await prisma.studyLog.deleteMany({ where: { userId: { in: users }, date: inRange } })
  await prisma.attendance.deleteMany({ where: { userId: { in: users }, date: inRange } })
  await prisma.reviewSchedule.deleteMany({ where: { userId: { in: users }, dueDate: inRange } })
  const lessons = await prisma.lesson.findMany({ where: { userId: { in: users }, title: MARK }, select: { id: true } })
  const evals = await prisma.evaluation.findMany({ where: { userId: { in: users }, promptVersion: MARK }, select: { id: true } })
  await prisma.statsSnapshot.deleteMany({ where: { userId: { in: users }, OR: [{ kind: 'DAILY', periodKey: { startsWith: '2024-0' } }, { kind: 'LESSON', periodKey: { in: lessons.map((l) => l.id) } }, { kind: 'EVALUATION', periodKey: { in: evals.map((e) => e.id) } }] } })
  await prisma.lesson.deleteMany({ where: { id: { in: lessons.map((l) => l.id) } } })
  await prisma.evaluation.deleteMany({ where: { id: { in: evals.map((e) => e.id) } } })
  await prisma.chat.deleteMany({ where: { userId: { in: users }, title: MARK } })
}

async function allSnapshots(): Promise<string> {
  const rows = await prisma.statsSnapshot.findMany({ where: { userId: { in: [st.u1, st.u2] } }, orderBy: [{ userId: 'asc' }, { kind: 'asc' }, { periodKey: 'asc' }], select: { id: true, userId: true, kind: true, periodKey: true, data: true, updatedAt: true } })
  return JSON.stringify(rows)
}

async function main() {
  st.u1 = await uid('qa-bot@thekaiwa.test')
  st.u2 = await uid('qa-bot2@thekaiwa.test')
  const { u1, u2 } = st
  await wipeSeed([u1, u2])

  // ── 준비: 대화(본인·남의) — API 로 만든다 ─────────────────────────────
  const c1 = await api(COOKIE1, 'POST', '/api/v1/chats', { kind: 'CHAT', title: MARK })
  const c2 = await api(COOKIE2, 'POST', '/api/v1/chats', { kind: 'CHAT', title: MARK })
  const chat1 = String(d(c1).id ?? '')
  const chat2 = String(d(c2).id ?? '')
  st.chatIds.push(chat1, chat2)
  check('0a 준비: 대화 2개(QA1·QA2)', c1.status === 200 && c2.status === 200 && !!chat1 && !!chat2, `${c1.status}/${c2.status}`)

  // ── 준비: 2024-02 격리 달 ─────────────────────────────────────────
  const lesson = await prisma.lesson.create({ data: { userId: u1, date: dbDate('2024-02-15'), kind: 'NEW', title: MARK, level: 'N5', status: 'DONE', stageDone: 7, score: 80, completedAt: new Date() } })
  st.lessonId = lesson.id
  const ev = await prisma.evaluation.create({ data: { userId: u1, kind: 'WORDS', level: 'N5', status: 'DONE', totalScore: 82, promptVersion: MARK, completedAt: new Date() } })
  st.evalId = ev.id
  const at = (s: string, ms: number) => new Date(Date.parse(`${s}T00:00:00.000Z`) + ms)
  const seedLog = (userId: string, date: string, type: Prisma.StudyLogCreateInput['type'], refId: string | null, durationSec: number | null, order: number, origin: 'DIRECT' | 'ACCEPTED' = 'DIRECT') =>
    prisma.studyLog.create({ data: { userId, date: dbDate(date), type, origin, refId, summary: `${MARK} ${type} ${date}`, result: { smoke: true }, correctionsCount: type === 'CHAT' ? 2 : 0, durationSec, createdAt: at(date, 3_600_000 + order * 60_000) } })
  const L = {
    jan31: await seedLog(u1, '2024-01-31', 'WORDS', null, 300, 0),
    feb01Talk: await seedLog(u1, '2024-02-01', 'TALK', chat1, 60, 0, 'ACCEPTED'),
    feb15Lesson: await seedLog(u1, '2024-02-15', 'LESSON', lesson.id, 96, 0),
    feb15Eval: await seedLog(u1, '2024-02-15', 'EVALUATION', ev.id, null, 1),
    feb15OtherChat: await seedLog(u1, '2024-02-15', 'CHAT', chat2, null, 2, 'ACCEPTED'),
    feb15GoneReview: await seedLog(u1, '2024-02-15', 'REVIEW', 'gone_lesson_t012', null, 3),
    feb29: await seedLog(u1, '2024-02-29', 'WORDS', null, 20, 0),
    mar01: await seedLog(u1, '2024-03-01', 'CHAT', chat1, 600, 0, 'ACCEPTED'),
  }
  const u2Log = await seedLog(u2, '2024-02-15', 'WORDS', null, 600, 0)
  await prisma.evaluation.update({ where: { id: ev.id }, data: { studyLogId: L.feb15Eval.id } })
  for (const day of ['2024-01-31', '2024-02-01', '2024-02-02', '2024-02-03', '2024-02-15', '2024-02-29', '2024-03-01']) await prisma.attendance.create({ data: { userId: u1, date: dbDate(day), source: 'SMOKE' } })
  await prisma.attendance.create({ data: { userId: u2, date: dbDate('2024-02-15'), source: 'SMOKE' } })
  const rvDue = await prisma.reviewSchedule.create({ data: { userId: u1, dueDate: dbDate('2024-02-20'), itemIds: [], status: 'DUE' } })
  await prisma.reviewSchedule.create({ data: { userId: u1, dueDate: dbDate('2024-02-21'), itemIds: [], status: 'DONE', resolvedAt: new Date() } })
  await prisma.reviewSchedule.create({ data: { userId: u1, dueDate: dbDate('2024-03-01'), itemIds: [], status: 'DUE' } })
  await prisma.statsSnapshot.create({ data: { userId: u1, kind: 'DAILY', periodKey: '2024-02-15', data: { attended: true, lessons: 1, evals: 1 } } })
  await prisma.statsSnapshot.create({ data: { userId: u1, kind: 'LESSON', periodKey: lesson.id, data: { kind: 'NEW', score: 80, date: '2024-02-15' } } })
  await prisma.statsSnapshot.create({ data: { userId: u1, kind: 'EVALUATION', periodKey: ev.id, data: { total: 82, date: '2024-02-15' } } })
  st.seededSnapshotKeys.push({ kind: 'DAILY', periodKey: '2024-02-15' }, { kind: 'LESSON', periodKey: lesson.id }, { kind: 'EVALUATION', periodKey: ev.id })

  // ── 준비: 오늘 실제 흐름(단어 5 → 뒤집기 세트 → 답 2 → 끝내기) ───────────
  for (let i = 0; i < 5; i++) {
    const w = await api(COOKIE1, 'POST', '/api/v1/words', { surface: `${MARK}語${i}`, meaning: `시험${i}`, partOfSpeech: 'NOUN', category: WORD_CATEGORY })
    if (w.status !== 200) console.log(`  단어 추가 ${w.status} ${w.text.slice(0, 120)}`)
  }
  st.wordIds = (await prisma.wordEntry.findMany({ where: { userId: u1, category: WORD_CATEGORY }, select: { id: true } })).map((w) => w.id)
  const created = await api(COOKIE1, 'POST', '/api/v1/vocab/sessions', { count: 5, mode: 'FLIP', category: WORD_CATEGORY })
  const session = d(created).session as (Json & { id: string; date: string }) | null
  if (session?.id) st.sessionIds.push(session.id)
  st.today = session?.date ?? null
  const today = st.today ?? ''
  const dailyRow = today ? await prisma.statsSnapshot.findUnique({ where: { userId_kind_periodKey: { userId: u1, kind: 'DAILY', periodKey: today } } }) : null
  st.dailyBefore = { existed: !!dailyRow, data: dailyRow?.data ?? null }
  let wordsLogId = ''
  if (session?.id) {
    await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${session.id}/attempts`, { order: 0, selfResult: 'CORRECT', responseMs: 2000 })
    await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${session.id}/attempts`, { order: 1, selfResult: 'WRONG', responseMs: 2000 })
    const fin = await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${session.id}/finish`)
    wordsLogId = String(d(fin).studyLogId ?? '')
  }
  const wordsLog = wordsLogId ? await prisma.studyLog.findUnique({ where: { id: wordsLogId } }) : null
  check('0b 준비: 오늘 세트 끝내기 → StudyLog(WORDS, DIRECT) + VOCAB_SESSION·DAILY', created.status === 200 && !!wordsLog && wordsLog.origin === 'DIRECT' && (await prisma.statsSnapshot.count({ where: { userId: u1, kind: 'VOCAB_SESSION', periodKey: session?.id ?? '' } })) === 1, `${created.status} ${created.text.slice(0, 100)}`)

  // ── #70 달력 ────────────────────────────────────────────────────────
  const cal = await api(COOKIE1, 'GET', '/api/v1/plan/calendar?month=2024-02')
  const days = (d(cal).days as Json[]) ?? []
  const day = (date: string) => days.find((x) => x.date === date) as Json | undefined
  const sum = d(cal).summary as Json
  const att26 = await api(COOKIE1, 'GET', '/api/v1/attendance?month=2024-02')
  check('1a #70 2024-02: 29일 전부·날짜 오름차순·today(서버 KST)', cal.status === 200 && days.length === 29 && days[0]?.date === '2024-02-01' && days[28]?.date === '2024-02-29' && d(cal).month === '2024-02' && d(cal).today === today, `${cal.status} len=${days.length} today=${d(cal).today}`)
  const f15 = day('2024-02-15')
  check('1b 2/15: types 고정순서·logCount(타 사용자 제외)·minutes=round(96/60)·hasEvaluation·attended', JSON.stringify(f15?.types) === JSON.stringify(['CHAT', 'LESSON', 'REVIEW', 'EVALUATION']) && f15?.logCount === 4 && f15?.minutes === 2 && f15?.hasEvaluation === true && f15?.attended === true && f15?.reviewDue === false, JSON.stringify(f15))
  check('1c 2/1 TALK 1분·2/29 WORDS 20초→0분(윤일)·2/5 빈 날', JSON.stringify(day('2024-02-01')?.types) === '["TALK"]' && day('2024-02-01')?.minutes === 1 && day('2024-02-29')?.minutes === 0 && day('2024-02-29')?.logCount === 1 && JSON.stringify(day('2024-02-05')) === JSON.stringify({ date: '2024-02-05', attended: false, types: [], minutes: 0, logCount: 0, hasEvaluation: false, reviewDue: false }))
  check('1d reviewDue: 2/20(DUE)만 — 2/21(DONE)·3/1(달 밖) 아님', day('2024-02-20')?.reviewDue === true && day('2024-02-21')?.reviewDue === false && days.filter((x) => x.reviewDue).length === 1)
  check('1e 월 경계: 1/31·3/1 기록·출석 제외', days.reduce((n, x) => n + Number(x.logCount), 0) === 6 && sum?.attendedDays === 5)
  check('1f summary: attendedDays 5·studyDays 3·longestStreak 3·streak = #26 과 같은 오늘 기준 값', sum?.studyDays === 3 && sum?.longestStreak === 3 && typeof sum?.streak === 'number' && sum?.streak === d(att26).streak, JSON.stringify(sum))
  const cal2 = await api(COOKIE2, 'GET', '/api/v1/plan/calendar?month=2024-02')
  const d2 = (d(cal2).days as Json[]) ?? []
  check('1g 타 사용자 격리: QA2 달력엔 자기 2/15 WORDS 10분만', cal2.status === 200 && d2.reduce((n, x) => n + Number(x.logCount), 0) === 1 && JSON.stringify(d2.find((x) => x.date === '2024-02-15')?.types) === '["WORDS"]' && d2.find((x) => x.date === '2024-02-15')?.minutes === 10 && (d(cal2).summary as Json).attendedDays === 1)
  const calNow = await api(COOKIE1, 'GET', '/api/v1/plan/calendar')
  const todayCell = ((d(calNow).days as Json[]) ?? []).find((x) => x.date === today)
  const wordsToday = await prisma.studyLog.aggregate({ where: { userId: u1, date: dbDate(today || '2000-01-01') }, _count: { _all: true }, _sum: { durationSec: true } })
  check('1h month 생략 → 이번 달(KST), 오늘 칸에 WORDS·logCount·minutes 가 DB 합과 일치', calNow.status === 200 && d(calNow).month === today.slice(0, 7) && Array.isArray(todayCell?.types) && (todayCell?.types as string[]).includes('WORDS') && todayCell?.logCount === wordsToday._count._all && todayCell?.minutes === Math.round((wordsToday._sum.durationSec ?? 0) / 60), JSON.stringify(todayCell))
  const calBad = await Promise.all(['2024-13', '2024-2', 'x', '1999-12'].map((m) => api(COOKIE1, 'GET', `/api/v1/plan/calendar?month=${m}`)))
  const calAnon = await api(null, 'GET', '/api/v1/plan/calendar?month=2024-02')
  check('1i 검증 400(month 형식·범위)·미인증 401', calBad.every((r) => r.status === 400 && r.body.data.code === 'VALIDATION') && calAnon.status === 401, `${calBad.map((r) => r.status).join(',')} anon=${calAnon.status}`)

  // ── #71 하루 ────────────────────────────────────────────────────────
  const day15 = await api(COOKIE1, 'GET', '/api/v1/plan/day?date=2024-02-15')
  const logs15 = (d(day15).logs as Json[]) ?? []
  check('2a #71 2/15: 로그 4건 작성 순·출석·복습 없음', day15.status === 200 && d(day15).date === '2024-02-15' && d(day15).attended === true && d(day15).review === null && logs15.map((l) => l.id).join() === [L.feb15Lesson, L.feb15Eval, L.feb15OtherChat, L.feb15GoneReview].map((l) => l.id).join(), logs15.map((l) => l.type).join())
  check('2b 로그 객체 키(계약 + date·refExists)·값', logs15.every((l) => Object.keys(l).sort().join() === LOG_KEYS) && logs15[0]?.durationSec === 96 && logs15[0]?.date === '2024-02-15' && logs15[0]?.origin === 'DIRECT' && logs15[2]?.correctionsCount === 2 && logs15[2]?.origin === 'ACCEPTED')
  check('2c refExists: 레슨 ✓·평가 ✓·남의 대화 ✗·없는 레슨 ✗', logs15.map((l) => l.refExists).join() === 'true,true,false,false', logs15.map((l) => `${l.type}:${l.refExists}`).join(' '))
  const day01 = await api(COOKIE1, 'GET', '/api/v1/plan/day?date=2024-02-01')
  check('2d 본인 대화 원본 refExists ✓(conversation 공개 함수 경유)', ((d(day01).logs as Json[]) ?? [])[0]?.refExists === true && ((d(day01).logs as Json[]) ?? [])[0]?.refId === chat1)
  const day20 = await api(COOKIE1, 'GET', '/api/v1/plan/day?date=2024-02-20')
  const day21 = await api(COOKIE1, 'GET', '/api/v1/plan/day?date=2024-02-21')
  check('2e 그날 복습: 2/20 DUE(id·lessonId)·2/21 DONE·로그 0·출석 false', (d(day20).review as Json)?.id === rvDue.id && (d(day20).review as Json)?.status === 'DUE' && (d(day20).review as Json)?.lessonId === null && (d(day20).logs as Json[]).length === 0 && d(day20).attended === false && (d(day21).review as Json)?.status === 'DONE')
  const day15u2 = await api(COOKIE2, 'GET', '/api/v1/plan/day?date=2024-02-15')
  check('2f 타 사용자 격리: QA2 의 2/15 는 자기 로그 1건', ((d(day15u2).logs as Json[]) ?? []).map((l) => l.id).join() === u2Log.id && d(day15u2).review === null)
  const dayBad = await Promise.all(['', '?date=2024-02-30', '?date=2024-2-1'].map((q) => api(COOKIE1, 'GET', `/api/v1/plan/day${q}`)))
  const dayAnon = await api(null, 'GET', '/api/v1/plan/day?date=2024-02-15')
  check('2g 검증 400(date 없음·없는 날·형식)·미인증 401', dayBad.every((r) => r.status === 400) && dayAnon.status === 401, dayBad.map((r) => r.status).join())

  // ── #72 목록 ────────────────────────────────────────────────────────
  const seen: string[] = []
  let cursor: string | null = null
  let pages = 0
  do {
    const qs = `from=2024-01-15&to=2024-03-15&limit=3${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
    const pg = await api(COOKIE1, 'GET', `/api/v1/study-logs?${qs}`)
    if (pg.status !== 200) break
    for (const it of (d(pg).items as Json[]) ?? []) seen.push(String(it.id))
    cursor = (d(pg).nextCursor as string | null) ?? null
    pages++
  } while (cursor && pages < 10)
  const expectOrder = [L.mar01, L.feb29, L.feb15GoneReview, L.feb15OtherChat, L.feb15Eval, L.feb15Lesson, L.feb01Talk, L.jan31].map((l) => l.id)
  check('3a #72 커서 3건씩: 8건 전부·중복 없음·(date, createdAt) 최신순·타 사용자 제외', seen.join() === expectOrder.join() && pages === 3, `pages=${pages} n=${seen.length}`)
  const onlyLesson = await api(COOKIE1, 'GET', '/api/v1/study-logs?from=2024-01-15&to=2024-03-15&type=LESSON')
  check('3b type 필터(LESSON 1건)·nextCursor null', ((d(onlyLesson).items as Json[]) ?? []).map((l) => l.id).join() === L.feb15Lesson.id && d(onlyLesson).nextCursor === null)
  const listU2 = await api(COOKIE2, 'GET', '/api/v1/study-logs?from=2024-01-15&to=2024-03-15')
  check('3c 타 사용자 목록엔 자기 것만', ((d(listU2).items as Json[]) ?? []).map((l) => l.id).join() === u2Log.id)
  const listDefault = await api(COOKIE1, 'GET', '/api/v1/study-logs?type=WORDS')
  check('3d 구간 생략 = 오늘 포함 92일(오늘 WORDS 기록 포함)', listDefault.status === 200 && ((d(listDefault).items as Json[]) ?? []).some((l) => l.id === wordsLogId && l.refExists === true))
  const listBad = await Promise.all(['from=2024-01-01&to=2024-04-02', 'from=2024-03-01&to=2024-02-01', 'type=words', 'limit=101', 'cursor=garbage', 'to=2024-02-30'].map((q) => api(COOKIE1, 'GET', `/api/v1/study-logs?${q}`)))
  check('3e 검증 400(93일·뒤집힘·type·limit·커서·없는 날)', listBad.every((r) => r.status === 400), listBad.map((r) => r.status).join())

  // ── #73 삭제 ────────────────────────────────────────────────────────
  const snapBefore = await allSnapshots()
  const idor = await api(COOKIE2, 'DELETE', `/api/v1/study-logs/${L.feb15Eval.id}`)
  check('4a 남의 기록 삭제 → 404, 행 그대로', idor.status === 404 && idor.body.data.code === 'NOT_FOUND' && (await prisma.studyLog.count({ where: { id: L.feb15Eval.id } })) === 1)
  const delEval = await api(COOKIE1, 'DELETE', `/api/v1/study-logs/${L.feb15Eval.id}`)
  const evAfter = await prisma.evaluation.findUnique({ where: { id: ev.id } })
  check('4b EVALUATION 기록 삭제 {deleted, snapshotKept} → 평가는 남고 studyLogId=NULL(SetNull)', delEval.status === 200 && d(delEval).deleted === true && d(delEval).snapshotKept === true && !!evAfter && evAfter.studyLogId === null && evAfter.status === 'DONE')
  const delLesson = await api(COOKIE1, 'DELETE', `/api/v1/study-logs/${L.feb15Lesson.id}`)
  const delWords = wordsLogId ? await api(COOKIE1, 'DELETE', `/api/v1/study-logs/${wordsLogId}`) : null
  check('4c DIRECT 기록(LESSON·오늘 WORDS) 삭제 허용 — 원본 레슨·세트는 남는다', delLesson.status === 200 && delWords?.status === 200 && (await prisma.lesson.count({ where: { id: lesson.id } })) === 1 && (await prisma.vocabSession.count({ where: { id: session?.id ?? '' } })) === 1)
  const race = await Promise.all([1, 2].map(() => api(COOKIE1, 'DELETE', `/api/v1/study-logs/${L.feb15OtherChat.id}`)))
  check('4d 같은 기록 동시 삭제 2회 → 200 하나·404 하나', race.map((r) => r.status).sort().join() === '200,404', race.map((r) => r.status).join())
  const again = await api(COOKIE1, 'DELETE', `/api/v1/study-logs/${L.feb15Lesson.id}`)
  const ghost = await api(COOKIE1, 'DELETE', '/api/v1/study-logs/nonexistent_t012')
  const longId = await api(COOKIE1, 'DELETE', `/api/v1/study-logs/${'x'.repeat(60)}`)
  const anonDel = await api(null, 'DELETE', `/api/v1/study-logs/${L.feb29.id}`)
  check('4e 이미 지운 기록·없는 id·긴 id → 404, 미인증 → 401(행 그대로)', again.status === 404 && ghost.status === 404 && longId.status === 404 && anonDel.status === 401 && (await prisma.studyLog.count({ where: { id: L.feb29.id } })) === 1)
  const snapAfter = await allSnapshots()
  const kinds = new Set((JSON.parse(snapAfter) as { kind: string }[]).map((r) => r.kind))
  check('4f 삭제 전후 QA 두 계정 StatsSnapshot 모든 행·값·updatedAt 불변(DAILY·VOCAB_SESSION·LESSON·EVALUATION)', snapBefore === snapAfter && ['DAILY', 'VOCAB_SESSION', 'LESSON', 'EVALUATION'].every((k) => kinds.has(k)), `rows=${(JSON.parse(snapAfter) as unknown[]).length} kinds=${[...kinds].join('/')}`)
  const calAfter = await api(COOKIE1, 'GET', '/api/v1/plan/calendar?month=2024-02')
  const f15b = ((d(calAfter).days as Json[]) ?? []).find((x) => x.date === '2024-02-15')
  check('4g 삭제 후 달력 2/15: REVIEW 1건만·hasEvaluation false·minutes 0(출석은 그대로)', JSON.stringify(f15b?.types) === '["REVIEW"]' && f15b?.logCount === 1 && f15b?.hasEvaluation === false && f15b?.minutes === 0 && f15b?.attended === true, JSON.stringify(f15b))
  const dayAfter = await api(COOKIE1, 'GET', '/api/v1/plan/day?date=2024-02-15')
  const sessAfter = session?.id ? await api(COOKIE1, 'GET', `/api/v1/vocab/sessions/${session.id}`) : null
  const finAgain = session?.id ? await api(COOKIE1, 'POST', `/api/v1/vocab/sessions/${session.id}/finish`) : null
  check('4h 삭제 후 하루 상세 1건 · 세트 조회 200 · 끝난 세트 재조회(finish 멱등) studyLogId null', ((d(dayAfter).logs as Json[]) ?? []).length === 1 && sessAfter?.status === 200 && finAgain?.status === 200 && d(finAgain).studyLogId === null, `${sessAfter?.status}/${finAgain?.status}`)

  // ── 엔진명 누출 ─────────────────────────────────────────────────────
  check('5 응답에 엔진·모델명 0건', leakHits === 0, `hits=${leakHits}`)

  const failed = results.filter((r) => !r.ok)
  console.log(`\n결과: ${results.length - failed.length}/${results.length} PASS`)
  if (failed.length) {
    console.log(`실패: ${failed.map((f) => f.id).join(', ')}`)
    process.exitCode = 1
  }
}

async function cleanup() {
  const users = [st.u1, st.u2].filter(Boolean)
  if (!users.length) return
  await wipeSeed(users)
  if (st.sessionIds.length) {
    await prisma.studyLog.deleteMany({ where: { userId: st.u1, type: 'WORDS', refId: { in: st.sessionIds } } })
    await prisma.statsSnapshot.deleteMany({ where: { userId: st.u1, kind: 'VOCAB_SESSION', periodKey: { in: st.sessionIds } } })
    await prisma.vocabSession.deleteMany({ where: { id: { in: st.sessionIds } } })
  }
  if (st.wordIds.length) {
    await prisma.repetitionItem.deleteMany({ where: { userId: st.u1, refId: { in: st.wordIds } } })
    await prisma.wordEntry.deleteMany({ where: { id: { in: st.wordIds } } })
  }
  await prisma.chat.deleteMany({ where: { id: { in: st.chatIds.filter(Boolean) } } })
  if (st.today && st.sessionIds.length) {
    const key = { userId_kind_periodKey: { userId: st.u1, kind: 'DAILY' as const, periodKey: st.today } }
    if (st.dailyBefore.existed) await prisma.statsSnapshot.update({ where: key, data: { data: st.dailyBefore.data as Prisma.InputJsonValue } })
    else await prisma.statsSnapshot.deleteMany({ where: { userId: st.u1, kind: 'DAILY', periodKey: st.today } })
  }
  const left = await Promise.all([
    prisma.studyLog.count({ where: { userId: { in: users }, OR: [{ date: { gte: SEED_FROM, lte: SEED_TO } }, { refId: { in: st.sessionIds } }] } }),
    prisma.attendance.count({ where: { userId: { in: users }, date: { gte: SEED_FROM, lte: SEED_TO } } }),
    prisma.reviewSchedule.count({ where: { userId: { in: users }, dueDate: { gte: SEED_FROM, lte: SEED_TO } } }),
    prisma.lesson.count({ where: { userId: { in: users }, title: MARK } }),
    prisma.evaluation.count({ where: { userId: { in: users }, promptVersion: MARK } }),
    prisma.chat.count({ where: { userId: { in: users }, title: MARK } }),
    prisma.wordEntry.count({ where: { userId: st.u1, category: WORD_CATEGORY } }),
    prisma.statsSnapshot.count({ where: { userId: { in: users }, OR: [{ periodKey: { startsWith: '2024-0' } }, { periodKey: { in: [...st.sessionIds, st.lessonId ?? '', st.evalId ?? ''] } }] } }),
  ])
  console.log(`(QA 데이터 정리 완료 — 잔존 기록/출석/복습/레슨/평가/대화/단어/스냅샷 = ${left.join('/')}, 오늘 DAILY ${st.dailyBefore.existed ? '원복' : '삭제'})`)
}

main()
  .catch((e) => {
    console.error('스모크 중단:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await cleanup().catch((e) => console.error('정리 실패:', e))
    await prisma.$disconnect()
  })
