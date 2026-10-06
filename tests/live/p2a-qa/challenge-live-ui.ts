/**
 * qa-p2a — task-043 실데이터 대조(D): QA 계정 3 에 챌린지를 실제 DB 행·실제 API 로 만들고, 화면(`/plan`·`/plan/challenge/[id]`·`/plan/challenges`)에 찍힌
 * 수치가 서버 응답(#155·#157·#158·#70·#71)과 같은지 + 독립 기대값(손계산)과 같은지 본다. 오늘이 MET 인 날의 S4 도 이 데이터로 직접 만든다. LLM 0.
 *
 * 만드는 데이터(계정 3, 끝에 기준선 차집합으로 정리):
 *   챌린지 1(오늘−3 시작·7일·{수업 켬·단어 5장→4장 인정}) — d1: 수업(문제 4/5)+단어 세트(맞힘 4·틀림 1) → MET · d2: 수업(5/5)만 → PARTIAL · d3: 없음 → MISSED ·
 *   오늘: 수업 스냅샷(00:10 KST, 4/5) + **실제 API 로** 주제 단어 세트(#47 generate:false → 답 4 → #51) → MET.
 *   기대(손계산): 4일째/7일 · 지난 3일 중 1일 → 오늘 포함 4일 중 2일 · 50% · 수행 연속 1 · 최장 1 · 수업 3 · 세트 2 · 맞힌 카드 8.
 *
 * 실행(미러, dev 127.0.0.1 — APP_ENV=LOCAL, 00:15~23:50 KST):
 *   QA_ACCOUNT=3 node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/c-qa3
 *   BASE=http://127.0.0.1:3031 node --env-file=.env --import tsx tests/live/p2a-qa/challenge-live-ui.ts /tmp/c-qa3 [/tmp/qa-artifacts/TheKaiwa/qa-p2a]
 * 쿠키·응답 전문은 출력하지 않는다. 브라우저: 시스템 Chrome(/usr/bin/google-chrome) + playwright-core(상위 node_modules).
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { Prisma, PrismaClient, type RepetitionItem } from '@prisma/client'
import { chromium } from 'playwright-core'
import { QA_USER_WHERE } from '../../../src/modules/infra/users'

if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 환경에서는 실행하지 않는다')
const BASE = process.env.BASE ?? 'http://127.0.0.1:3031'
const bm = /^http:\/\/(127\.0\.0\.1|localhost):(\d+)$/.exec(BASE)
if (!bm || Number(bm[2]) === 3010) throw new Error('BASE 는 localhost(운영 3010 제외)만 허용')
const [c3file, OUT] = process.argv.slice(2)
if (!c3file) throw new Error('사용: challenge-live-ui.ts <QA3 쿠키> [스크린샷 디렉터리]')
const COOKIE = readFileSync(c3file, 'utf8').trim()
const [cname, ...crest] = COOKIE.split('=')
if (OUT) {
  if (!OUT.startsWith('/tmp/qa-artifacts/TheKaiwa/')) throw new Error('스크린샷은 /tmp/qa-artifacts/TheKaiwa/ 아래만')
  mkdirSync(OUT, { recursive: true })
}
const KST = 9 * 3600_000
const hhmm = new Date(Date.now() + KST).toISOString().slice(11, 16)
if (hhmm < '00:15' || hhmm > '23:50') throw new Error(`KST ${hhmm} — 00:15~23:50 에 실행한다`)

const prisma = new PrismaClient()
const results: { id: string; ok: boolean }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
const info = (m: string) => console.log(`INFO ${m}`)
type Json = Record<string, unknown>
async function api(method: string, path: string, body?: unknown): Promise<{ status: number; data: Json }> {
  const r = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: COOKIE }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  try {
    return { status: r.status, data: ((JSON.parse(text) as { data?: Json }).data ?? {}) as Json }
  } catch {
    return { status: r.status, data: {} }
  }
}
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const todayKst = () => new Date(Date.now() + KST).toISOString().slice(0, 10)
const at = (d: string, hms: string) => new Date(Date.parse(`${d}T${hms}+09:00`))
const dbDate = (d: string) => new Date(`${d}T00:00:00.000Z`)
const lessonData = (topicId: string, date: string, q: number) => ({ kind: 'NEW', topicId, score: q * 20, stageDone: 5, itemCount: 4, quizCorrect: q, quizTotal: 5, date })
const setData = (topicId: string, date: string, c: number, w: number, s: number) => ({ cardCount: c + w + s, correct: c, wrong: w, skipped: s, durationSec: 60, mode: 'CHOICE', date, topicId })

interface Baseline {
  sessions: Set<string>; logs: Set<string>; snaps: Set<string>; obs: Set<string>; jobs: Set<string>; challenges: Set<string>
  reps: RepetitionItem[]; daily: { id: string; data: Prisma.JsonValue }[]
}
async function baseline(userId: string): Promise<Baseline> {
  const ids = async (rows: Promise<{ id: string }[]>) => new Set((await rows).map((r) => r.id))
  return {
    sessions: await ids(prisma.vocabSession.findMany({ where: { userId }, select: { id: true } })),
    logs: await ids(prisma.studyLog.findMany({ where: { userId }, select: { id: true } })),
    snaps: await ids(prisma.statsSnapshot.findMany({ where: { userId }, select: { id: true } })),
    obs: await ids(prisma.learningObservation.findMany({ where: { userId }, select: { id: true } })),
    jobs: await ids(prisma.aiJob.findMany({ where: { userId }, select: { id: true } })),
    challenges: await ids(prisma.challenge.findMany({ where: { userId }, select: { id: true } })),
    reps: await prisma.repetitionItem.findMany({ where: { userId } }),
    daily: await prisma.statsSnapshot.findMany({ where: { userId, kind: 'DAILY' }, select: { id: true, data: true } }),
  }
}
async function restore(userId: string, b: Baseline): Promise<Json> {
  const fresh = async (rows: Promise<{ id: string }[]>, old: Set<string>) => (await rows).map((r) => r.id).filter((id) => !old.has(id))
  const ch = await fresh(prisma.challenge.findMany({ where: { userId }, select: { id: true } }), b.challenges)
  if (ch.length) await prisma.challenge.deleteMany({ where: { id: { in: ch } } })
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
  return { challenges: ch.length, observations: obs.length, studyLogs: logs.length, aiJobs: jobs.length, sessions: sessions.length, snapshots: snaps.length, repetitionItems: reps.length }
}

async function main(): Promise<void> {
  const user = await prisma.user.findFirst({ where: { AND: [{ email: 'qa-bot3@thekaiwa.test' }, QA_USER_WHERE] }, select: { id: true } })
  if (!user) throw new Error('QA 계정 3 이 없다')
  const userId = user.id
  if ((await prisma.challenge.count({ where: { userId, status: 'ACTIVE' } })) || (await prisma.vocabSession.count({ where: { userId, status: 'IN_PROGRESS' } }))) throw new Error('계정 3 에 진행 중 챌린지·세트가 있다')
  const topic = await prisma.conversationTopic.findFirstOrThrow({ where: { userId: null, level: 'N5', chunks: { some: {} } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, title: true } })
  const b = await baseline(userId)
  const today = todayKst()
  const [d1, d2, d3] = [addDays(today, -3), addDays(today, -2), addDays(today, -1)]
  const jobs0 = await prisma.aiJob.count({ where: { userId } })
  const traces0 = await prisma.requestTrace.count({ where: { userId } })
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
  try {
    const row = await prisma.challenge.create({
      data: {
        userId, title: `${topic.title} 7일 챌린지`, topicId: topic.id, topicTitleSnap: topic.title, level: 'N5', lengthDays: 7,
        startDate: dbDate(d1), endDate: dbDate(addDays(d1, 6)),
        dailyGoal: { lesson: true, words: true, wordCount: 5, wordsMinAnswered: 4, countSkipped: false, ruleVersion: 1 },
        status: 'ACTIVE', activeKey: userId, createdAt: at(d1, '08:00:00'),
      },
      select: { id: true },
    })
    const cid = row.id
    const snap = (kind: 'LESSON' | 'VOCAB_SESSION', key: string, data: Json, createdAt: Date) => prisma.statsSnapshot.create({ data: { userId, kind, periodKey: key, data: data as object, createdAt } })
    await snap('LESSON', 'p2a-l-d1', lessonData(topic.id, d1, 4), at(d1, '11:00:00'))
    await snap('VOCAB_SESSION', 'p2a-s-d1', setData(topic.id, d1, 4, 1, 0), at(d1, '12:00:00'))
    await snap('LESSON', 'p2a-l-d2', lessonData(topic.id, d2, 5), at(d2, '11:00:00'))
    await snap('LESSON', 'p2a-l-t', lessonData(topic.id, today, 4), at(today, '00:10:00'))
    // 오늘 단어 세트 — 실제 API
    const ses = await api('POST', '/api/v1/vocab/sessions', { topicId: topic.id, count: 5, mode: 'CHOICE', generate: false })
    const sid = String((ses.data.session as Json | undefined)?.id ?? '')
    for (let o = 0; o < 4; o++) {
      const a = await prisma.vocabAttempt.findUniqueOrThrow({ where: { sessionId_order: { sessionId: sid, order: o } }, select: { meaningSnap: true, choices: true } })
      const ch = Array.isArray(a.choices) ? (a.choices as string[]) : []
      await api('POST', `/api/v1/vocab/sessions/${sid}/attempts`, ch.length ? { order: o, chosenText: a.meaningSnap } : { order: o, selfResult: 'CORRECT' })
    }
    const fin = await api('POST', `/api/v1/vocab/sessions/${sid}/finish`)
    const finCh = fin.data.challenge as Json | null
    check('L0 오늘 세트 #51 → 챌린지 칸 goalMet true(수업 스냅샷 + 단어 4장)', fin.status === 200 && !!finCh && finCh.goalMet === true, JSON.stringify(finCh))

    // ── 서버 응답(진실) ──
    const d157 = await api('GET', `/api/v1/challenges/${cid}`)
    const d158 = await api('GET', '/api/v1/challenges/today')
    const d155 = await api('GET', '/api/v1/challenges')
    const cal = await api('GET', `/api/v1/plan/calendar?month=${today.slice(0, 7)}`)
    const day = await api('GET', `/api/v1/plan/day?date=${today}`)
    const st = d157.data.stats as Json
    const totals = d157.data.totals as Json
    const days = d157.data.days as Json[]
    const want = { dayIndex: 4, elapsedDays: 4, metDays: 2, rate: 0.5, streak: 1, longestStreak: 1 }
    check('L1 #157 수치 = 손계산(4일째·4일 중 2일·50%·연속 1·최장 1)', d157.status === 200 && Object.entries(want).every(([k, v]) => st[k] === v), JSON.stringify(st))
    check('L2 #157 days 상태 MET·PARTIAL·MISSED·MET(오늘)·UPCOMING×3', days.map((d) => d.state).join(',') === 'MET,PARTIAL,MISSED,MET,UPCOMING,UPCOMING,UPCOMING', days.map((d) => d.state).join(','))
    check('L3 누적 수업 3·세트 2·맞힌 카드 8', totals.lessonsDone === 3 && totals.wordSets === 2 && totals.wordsCorrect === 8, JSON.stringify(totals))
    const t158 = (d158.data.today as Json | null)
    check('L4 #158 goalMet true·과제 둘 DONE', d158.status === 200 && !!t158 && t158.goalMet === true && ((t158.tasks as Json[]) ?? []).every((t) => t.state === 'DONE'), JSON.stringify((t158?.tasks as Json[] | undefined)?.map((t) => `${String(t.kind)}:${String(t.state)}`)))
    const calDays = cal.data.days as Json[]
    const calMap = new Map(calDays.map((x) => [String(x.date), x.challenge as Json | null]))
    info(`#70 챌린지 칸 — ${[d1, d2, d3, today].map((d) => `${d.slice(5)}=${String((calMap.get(d) as Json | null)?.state ?? '-')}`).join(' ')}`)
    info(`#71 하루 시트 challenge — ${JSON.stringify(day.data.challenge)}`)
    info(`#155 첫 항목 — ${JSON.stringify({ id: ((d155.data.items as Json[])[0] ?? {}).id === cid, status: ((d155.data.items as Json[])[0] ?? {}).status })}`)

    // ── 화면 ──
    const pct = `${Math.round((st.rate as number) * 100)}%`
    const expectDetail = [`${st.dayIndex}일째 / ${d157.data.lengthDays}일`, pct, `${st.elapsedDays}일 중 ${st.metDays}일`, `수행 연속`, `최장 연속`, `끝냈어요 · 문제 4/5`, `${totals.wordsCorrect}장`]
    for (const width of [360, 390, 412]) {
      const ctx = await browser.newContext({ viewport: { width, height: 892 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
      await ctx.addCookies([{ name: cname, value: crest.join('='), url: BASE, httpOnly: true }])
      // 브라우저발 쓰기는 막는다(출석 체크 등 — 화면 확인만).
      await ctx.route('**/api/**', (r) => (r.request().method() === 'GET' ? r.continue() : r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":{},"message":null}' })))
      const page = await ctx.newPage()
      const errs: string[] = []
      page.on('pageerror', (e) => errs.push(e.message.slice(0, 100)))
      const text = async () => page.evaluate(() => document.body.innerText)
      // 1) 상세 S4
      await page.goto(`${BASE}/plan/challenge/${cid}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => undefined)
      await page.waitForTimeout(800)
      const t2 = await text()
      const miss = expectDetail.filter((e) => !t2.includes(e))
      check(`D@${width} 상세 화면 수치 = API·손계산`, miss.length === 0, miss.length ? `없음: ${miss.join(' | ')}` : '')
      const strip = await page.evaluate(() => Array.from(document.querySelectorAll('[data-strip]')).map((el) => ({ d: el.getAttribute('data-strip'), a: el.getAttribute('aria-label'), b: el.className.includes('border-accent'), t: el.getAttribute('tabindex') })))
      const todayCell = strip.find((s) => s.d === today)
      check(`D@${width} S4 오늘 칸 — accent 테두리 1개·tabindex 0·읽기 이름 끝 "4일째, 달성, 오늘"`, strip.filter((s) => s.b).length === 1 && !!todayCell?.b && todayCell.t === '0' && !!todayCell.a?.endsWith('4일째, 달성, 오늘'), JSON.stringify(todayCell))
      check(`D@${width} 날짜 띠 7칸`, strip.length === 7, String(strip.length))
      const wasDone = /다 했어요/.test(t2)
      info(`D@${width} 날짜 띠 읽기 이름 — ${strip.map((s) => (s.a ?? '').replace(/\s+/g, ' ')).join(' / ')}`)
      if (width === 390) info(`D@390 상세에 "다 했어요" ${wasDone ? '있음' : '없음(계획표 카드 전용 문구)'} · 점수 표 오늘 행 ${(t2.match(/\d+\/\d+ 오늘/g) ?? []).join(',') || '없음'}`)
      const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth - window.innerWidth, 0))
      check(`D@${width} 상세 가로 넘침 0`, overflow === 0, `${overflow}px`)
      if (OUT && width !== 412) await page.screenshot({ path: `${OUT}/detail-${width}.png` })
      // 2) 계획표 카드 + 달력 칩
      await page.goto(`${BASE}/plan`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => undefined)
      await page.waitForTimeout(800)
      const t1 = await text()
      const planExpect = [`챌린지 · ${st.dayIndex}일째 / ${d157.data.lengthDays}일`, pct, '2 / 2 · 다 했어요']
      const miss1 = planExpect.filter((e) => !t1.includes(e))
      check(`P@${width} 계획표 카드 수치 = API`, miss1.length === 0, miss1.length ? `없음: ${miss1.join(' | ')}` : '')
      const chips = await page.evaluate((dates) => dates.map((d) => {
        const el = document.querySelector(`[data-date="${d}"], [data-day="${d}"], [data-cal="${d}"]`)
        return { d, found: !!el, label: el?.getAttribute('aria-label') ?? el?.textContent ?? '' }
      }), [d1, d2, d3, today])
      if (width === 390) info(`P@390 달력 칸(셀렉터 3종 탐색) — ${JSON.stringify(chips).slice(0, 400)}`)
      const labelCount = await page.evaluate((md) => Array.from(document.querySelectorAll('[aria-label]')).filter((el) => (el.getAttribute('aria-label') ?? '').includes(md)).length, `${Number(today.slice(5, 7))}월 ${Number(today.slice(8))}일`)
      info(`P@${width} 오늘(${today.slice(5)}) 이름이 들어간 aria-label 요소 ${labelCount}개`)
      if (OUT && width === 390) await page.screenshot({ path: `${OUT}/plan-${width}.png` })
      // 3) 기록 목록
      await page.goto(`${BASE}/plan/challenges`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => undefined)
      await page.waitForTimeout(600)
      const t3 = await text()
      const listDesc = `${st.dayIndex}일째 · ${st.elapsedDays}일 중 ${st.metDays}일 달성`
      check(`L@${width} 기록 목록 — 진행 중 배지·제목·"${listDesc}"`, t3.includes('진행 중') && t3.includes(String(d157.data.title)) && t3.includes(listDesc), `진행 중 ${t3.includes('진행 중')} 제목 ${t3.includes(String(d157.data.title))} 설명 ${t3.includes(listDesc)}`)
      if (OUT && width === 390) await page.screenshot({ path: `${OUT}/list-${width}.png` })
      check(`D@${width} 페이지 오류 0`, errs.length === 0, errs.join(' | '))
      await ctx.close()
    }
  } finally {
    await browser.close()
    const r = await restore(userId, b)
    info(`정리: ${JSON.stringify(r)}`)
    const jobs1 = await prisma.aiJob.count({ where: { userId } })
    const traces1 = await prisma.requestTrace.count({ where: { userId } })
    check('Z 이 흐름의 AiJob·RequestTrace 증가 0(LLM 0)', jobs1 === jobs0 && traces1 === traces0, `jobs ${jobs0}→${jobs1} traces ${traces0}→${traces1}`)
  }
}

main()
  .catch((e) => check('RUN', false, e instanceof Error ? e.message : String(e)))
  .finally(async () => {
    await prisma.$disconnect()
    const fail = results.filter((r) => !r.ok).length
    console.log(`\n${results.length - fail}/${results.length} PASS`)
    process.exit(fail ? 1 : 0)
  })
