/**
 * qa-p2b — task-044 오늘 탭 통합(T4)의 **고정 응답이 아닌 실제 흐름**(A12·A4 실호출) + 챌린지 카드의 상황 수업 경로(F). QA 계정 3, 실제 서버·실제 DB, LLM 직렬 슬롯.
 *
 * 모드(둘째 인자):
 *   d      D — 단어만 켠 챌린지(wordCount 10 → 8장 인정): 오늘 탭 [시작하기] → 대기 화면 → **실제 A12** → 덱(출처 줄) → 4장 풀고 끝내기 → 오늘 탭 띠·카드("오늘 4/8장")
 *          → [한 세트 더](오늘 새 단어 재사용 — A12 0) → 틀림 포함 풀이·끝내기 → 결과 [단어장에 넣기](WordEntry +1) → 오늘 탭 띠 갱신(달성).
 *   limit  D2 — 하루 시도 상한(3)을 다른 주제 3개로 소진(실제 A12 3회)한 뒤(서버를 막 재기동해 둔 상태에서 시작), 챌린지 주제로 오늘 탭 [시작하기]
 *          → A12 0회·덱 알림 "오늘 새 단어 만들기는 여기까지예요 …"(사유 LIMIT 폴백).
 *   f      F — 챌린지 주제와 이어진 시드 상황 수업(#59 `{scenarioId}`, 실제 A4): 생성 중 오늘 탭 카드("수업을 만들고 있어요")·준비됨 카드·[시작하기] 가
 *          그 수업(`lessonId`)을 연다·`POST /api/v1/lessons`(#59 `{topicId}`)를 새로 부르지 않는다·#158 레슨 과제가 그 수업을 가리킨다.
 *
 * 실행(미러, dev 127.0.0.1·APP_ENV=LOCAL, 00:05~23:50 KST):
 *   QA_ACCOUNT=3 node --env-file=.env --import tsx tests/live/qa-session.ts /tmp/c3
 *   BASE=http://127.0.0.1:3032 [SHOTS=/tmp/qa-artifacts/TheKaiwa/qa-p2b] node --env-file=.env --import tsx tests/live/p2b-qa/challenge-today-live-ui.ts /tmp/c3 d
 * 브라우저: 시스템 Chrome(/usr/bin/google-chrome) + playwright-core(상위 node_modules). 쿠키·대화·수업 본문은 출력하지 않는다.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { Prisma, PrismaClient, type RepetitionItem } from '@prisma/client'
import { QA_USER_WHERE } from '../../../src/modules/infra/users'

/* eslint-disable @typescript-eslint/no-explicit-any -- playwright-core 는 프로젝트 의존성이 아니라 동적 import(타입 없음) */
type Page = any

if ((process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 환경에서는 실행하지 않는다')
const BASE = process.env.BASE ?? 'http://127.0.0.1:3032'
const bm = /^http:\/\/(127\.0\.0\.1|localhost):(\d+)$/.exec(BASE)
if (!bm || Number(bm[2]) === 3010) throw new Error('BASE 는 localhost(운영 3010 제외)만 허용')
const [c3file, MODE = 'd'] = process.argv.slice(2)
if (!c3file) throw new Error('사용: challenge-today-live-ui.ts <QA3 쿠키> [d|limit|f|cancel]')
const COOKIE = readFileSync(c3file, 'utf8').trim()
const [cname, ...crest] = COOKIE.split('=')
const SHOTS = process.env.SHOTS ?? ''
if (SHOTS) {
  if (!SHOTS.startsWith('/tmp/qa-artifacts/TheKaiwa/')) throw new Error('스크린샷은 /tmp/qa-artifacts/TheKaiwa/ 아래만')
  mkdirSync(SHOTS, { recursive: true })
}
const KST = 9 * 3600_000
const hhmm = new Date(Date.now() + KST).toISOString().slice(11, 16)
if (hhmm < '00:05' || hhmm > '23:50') throw new Error(`KST ${hhmm} — 00:05~23:50 에 실행한다`)

const prisma = new PrismaClient()
const results: { id: string; ok: boolean }[] = []
function check(id: string, ok: boolean, note = ''): void {
  results.push({ id, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
const info = (m: string) => console.log(`INFO ${m}`)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
type Json = Record<string, unknown>
interface Res {
  status: number
  data: Json & { code?: string; details?: Json }
  ms: number
}
async function api(method: string, path: string, body?: unknown): Promise<Res> {
  const t0 = performance.now()
  const r = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', Cookie: COOKIE }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  let data: Res['data'] = {}
  try {
    data = (JSON.parse(text) as { data: Res['data'] }).data ?? {}
  } catch {
    data = {}
  }
  return { status: r.status, data, ms: performance.now() - t0 }
}

interface Baseline {
  sessions: Set<string>
  logs: Set<string>
  snaps: Set<string>
  obs: Set<string>
  jobs: Set<string>
  challenges: Set<string>
  lessons: Set<string>
  words: Set<string>
  reps: RepetitionItem[]
  daily: { id: string; data: Prisma.JsonValue }[]
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
    lessons: await ids(prisma.lesson.findMany({ where: { userId }, select: { id: true } })),
    words: await ids(prisma.wordEntry.findMany({ where: { userId }, select: { id: true } })),
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
  const lessons = await fresh(prisma.lesson.findMany({ where: { userId }, select: { id: true } }), b.lessons)
  if (lessons.length) {
    await prisma.reviewSchedule.deleteMany({ where: { lessonId: { in: lessons } } })
    await prisma.lesson.deleteMany({ where: { id: { in: lessons } } })
  }
  const words = await fresh(prisma.wordEntry.findMany({ where: { userId }, select: { id: true } }), b.words)
  if (words.length) await prisma.wordEntry.deleteMany({ where: { id: { in: words } } })
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
  return { challenges: ch.length, observations: obs.length, studyLogs: logs.length, aiJobs: jobs.length, sessions: sessions.length, snapshots: snaps.length, lessons: lessons.length, wordEntries: words.length, repetitionItems: reps.length }
}

const compact = (s: string, n = 700) => s.replace(/\s+/g, ' ').trim().slice(0, n)
const bodyText = (page: Page): Promise<string> => page.evaluate(() => document.body.innerText)
async function buttons(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('button,a[href]'))
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => (el.getAttribute('aria-label') ?? (el as HTMLElement).innerText ?? '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 40),
  )
}
const ovfs: { name: string; px: number; small: number }[] = []
/** 화면 상태 하나를 기록한다 — 가로 넘침(px)·44px 미만 터치 대상 수를 모으고(최종에 판정), SHOTS 가 있으면 스크린샷도 찍는다. */
async function shot(page: Page, name: string): Promise<void> {
  const m = await page.evaluate(() => {
    const over = Math.max(document.documentElement.scrollWidth - window.innerWidth, 0)
    const small = Array.from(document.querySelectorAll('button,a[href],[role="button"]'))
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .filter((el) => {
        const r = (el as HTMLElement).getBoundingClientRect()
        return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44)
      }).length
    return { over, small }
  })
  ovfs.push({ name, px: m.over, small: m.small })
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` })
}
async function waitText(page: Page, re: RegExp, ms = 20_000): Promise<string | null> {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const t = await bodyText(page)
    if (re.test(t)) return t
    await sleep(300)
  }
  return null
}

/** 끝내기 요청이 끝나 세트가 DONE 이 될 때까지 DB 를 본다(화면 문구는 시트에도 "결과" 가 있어 기준이 못 된다). */
async function waitSessionDone(sessionId: string, ms = 20_000): Promise<boolean> {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const s = await prisma.vocabSession.findUnique({ where: { id: sessionId }, select: { status: true } })
    if (s?.status === 'DONE' || s?.status === 'ABANDONED') return true
    await sleep(250)
  }
  return false
}

/** 덱에서 지금 카드를 푼다(DB 의 정답 뜻으로 보기를 고르거나 일부러 오답을 고른다). 반환 = 푼 카드의 order. */
async function answerCurrentCard(page: Page, sessionId: string, wrong: boolean): Promise<number | null> {
  const cur = await prisma.vocabAttempt.findFirst({ where: { sessionId, answer: null }, orderBy: { order: 'asc' }, select: { order: true, meaningSnap: true, choices: true } })
  if (!cur) return null
  const labels: string[] = await page.evaluate(() => Array.from(document.querySelectorAll('ol[aria-label="보기"] button')).map((b) => b.getAttribute('aria-label') ?? ''))
  if (!labels.length) return null
  const idx = labels.findIndex((l) => (wrong ? !l.includes(`, ${cur.meaningSnap}`) : l.includes(`, ${cur.meaningSnap}`)))
  if (idx < 0) return null
  await page.locator('ol[aria-label="보기"] button').nth(idx).click()
  for (let i = 0; i < 40; i++) {
    const a = await prisma.vocabAttempt.findUnique({ where: { sessionId_order: { sessionId, order: cur.order } }, select: { answer: true } })
    if (a?.answer) break
    await sleep(150)
  }
  return cur.order
}

async function main(): Promise<void> {
  const user = await prisma.user.findFirst({ where: { AND: [{ email: 'qa-bot3@thekaiwa.test' }, QA_USER_WHERE] }, select: { id: true } })
  if (!user) throw new Error('QA 계정 3 이 없거나 QA 계정 규칙에 맞지 않는다')
  const userId = user.id
  const busyCh = await prisma.challenge.findFirst({ where: { userId, status: 'ACTIVE' }, select: { id: true } })
  const busyVs = await prisma.vocabSession.findFirst({ where: { userId, status: 'IN_PROGRESS' }, select: { id: true } })
  const busyJob = await prisma.aiJob.count({ where: { userId, status: { in: ['QUEUED', 'RUNNING'] } } })
  if (busyCh || busyVs || busyJob) throw new Error('계정 3 에 진행 중 챌린지·세트·잡이 있다 — 다른 레인이 쓰는 중이면 기다린다')
  const topics = await prisma.conversationTopic.findMany({ where: { userId: null, chunks: { some: {} } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, title: true, _count: { select: { chunks: true } } } })
  const usable = topics.filter((t) => t._count.chunks >= 5)
  const [T1, T2, T3, T4] = usable
  const b = await baseline(userId)
  const jobsBefore = await prisma.aiJob.count({ where: { userId } })
  const tracesBefore = await prisma.requestTrace.count({ where: { userId } })
  // playwright-core 는 프로젝트 의존성이 아니라(상위 node_modules) 정적 import 하면 클린 체크아웃 tsc 가 TS2307 — 변수 지정자로 동적 import(task044-screens.ts 와 같은 방식).
  const pwName = 'playwright-core'
  const { chromium } = (await import(pwName)) as { chromium: any }
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true })
  const ctx = await browser.newContext({ viewport: { width: 390, height: 892 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
  await ctx.addCookies([{ name: cname, value: crest.join('='), url: BASE, httpOnly: true }])
  const page: Page = await ctx.newPage()
  const reqs: { m: string; p: string; t: number; body: string }[] = []
  const reqFailed: { p: string; why: string }[] = []
  const errs: string[] = []
  page.on('request', (r: any) => reqs.push({ m: r.method(), p: new URL(r.url()).pathname, t: Date.now(), body: (r.postData() ?? '').slice(0, 200) }))
  page.on('requestfailed', (r: any) => reqFailed.push({ p: new URL(r.url()).pathname, why: String(r.failure()?.errorText ?? '') }))
  page.on('pageerror', (e: Error) => errs.push(e.message.slice(0, 120)))
  const posts = (path: RegExp) => reqs.filter((r) => r.m === 'POST' && path.test(r.p)).length
  const traceN = (topicId: string, since: Date) => prisma.requestTrace.count({ where: { userId, refType: 'topicWords', refId: topicId, createdAt: { gte: since } } })
  try {
    if (MODE === 'd') {
      const c = await api('POST', '/api/v1/challenges', { topicId: T1.id, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: false, words: true, wordCount: 10 } })
      check('D0 챌린지 생성(단어만·10장·8장 인정)', c.status === 200, String(c.status))
      await page.goto(`${BASE}/study/today`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      const t0txt = await waitText(page, /새 단어 10장/, 30_000)
      info(`D1 오늘 탭 첫 화면: ${compact(t0txt ?? await bodyText(page), 500)}`)
      info(`D1 버튼: ${(await buttons(page)).join(' | ').slice(0, 500)}`)
      await shot(page, 'd1-today')
      check('D1 오늘 탭 — 챌린지 띠 + 단어 카드 "새 단어 10장 · 오늘 0/8장"', !!t0txt && /챌린지/.test(t0txt) && /0\/8장/.test(t0txt))
      const since = new Date()
      const tStart = Date.now()
      await page.getByRole('button', { name: /새 단어 10장 시작하기/ }).click()
      const waitTxt = await waitText(page, /새 단어를 만들고 있어요/, 15_000)
      info(`D2 대기 화면 ${waitTxt ? '표시' : '안 보임'}: ${compact(waitTxt ?? '', 200)}`)
      await shot(page, 'd2-wait')
      let sid = ''
      for (let i = 0; i < 200; i++) {
        const m = /\/study\/today\/words\/([^/?#]+)/.exec(page.url())
        if (m && m[1] !== 'new') {
          sid = decodeURIComponent(m[1])
          break
        }
        await sleep(300)
      }
      const genMs = Date.now() - tStart
      check('D2 대기 화면 → 덱 열림(실제 A12)', !!waitTxt && !!sid, `${genMs}ms 클릭→덱 URL`)
      if (!sid) throw new Error('덱이 안 열렸다')
      await sleep(1_500)
      const deckTxt = await bodyText(page)
      info(`D3 덱 첫 화면: ${compact(deckTxt, 600)}`)
      await shot(page, 'd3-deck')
      const tr = await prisma.requestTrace.findMany({ where: { userId, refType: 'topicWords', refId: T1.id, createdAt: { gte: since } }, select: { status: true, totalMs: true, steps: true, errorCode: true } })
      const lane = Array.isArray(tr[0]?.steps) ? ((tr[0].steps as Json[])[0]?.lane as string | undefined) : undefined
      check('D3 A12 Trace 1행(lane interactive·원문 없음)·덱 출처 줄 "새 단어"·AI 주의', tr.length === 1 && lane === 'interactive' && /새 단어/.test(deckTxt) && /AI 가 만든 단어/.test(deckTxt), `trace ${tr.length} ${tr[0]?.status}/${tr[0]?.totalMs}ms lane=${lane}`)
      const attempts = await prisma.vocabAttempt.findMany({ where: { sessionId: sid }, orderBy: { order: 'asc' }, select: { order: true, refType: true } })
      info(`D3 카드 ${attempts.length}장 — 출처 ${['AiWord', 'TopicChunk', 'Expr'].map((k) => `${k} ${attempts.filter((a) => a.refType === k).length}`).join(' · ')}`)
      // 4장 풀기
      for (let i = 0; i < 4; i++) {
        const o = await answerCurrentCard(page, sid, false)
        if (o === null) {
          info(`D4 카드 ${i + 1} 풀기 실패 — 버튼: ${(await buttons(page)).join(' | ').slice(0, 400)}`)
          break
        }
        const next = page.getByRole('button', { name: /다음 카드|결과 보기/ })
        if (await next.count()) await next.first().click()
        await sleep(400)
      }
      const answered1 = await prisma.vocabAttempt.count({ where: { sessionId: sid, answer: { in: ['CORRECT', 'WRONG'] } } })
      check('D4 UI 로 4장 풀었다(DB 답 4)', answered1 === 4, `DB 답 ${answered1}`)
      info(`D4 덱 버튼: ${(await buttons(page)).join(' | ').slice(0, 500)}`)
      await shot(page, 'd4-deck-after4')
      // 일찍 끝내기 — 헤더 [끝내기] → 확인 시트 → [끝내기]
      await page.getByRole('button', { name: '끝내기', exact: true }).first().click()
      await sleep(700)
      info(`D5 끝내기 시트: ${compact(await bodyText(page), 400)}`)
      info(`D5 시트 버튼: ${(await buttons(page)).join(' | ').slice(0, 400)}`)
      await shot(page, 'd5-finish-sheet')
      await page.getByRole('button', { name: '끝내기', exact: true }).last().click()
      const res1 = await waitSessionDone(sid)
      await sleep(1_200)
      const res1Txt = await bodyText(page)
      info(`D5 결과 화면: ${compact(res1Txt, 700)}`)
      info(`D5 결과 버튼: ${(await buttons(page)).join(' | ').slice(0, 500)}`)
      await shot(page, 'd5-result1')
      const s1 = await prisma.vocabSession.findUnique({ where: { id: sid }, select: { status: true } })
      check('D5 일찍 끝내기 → 세트 DONE·결과 화면(4장 더·합계 문구)', s1?.status === 'DONE' && !!res1, `세트 ${s1?.status}`)
      // 오늘 탭으로
      await page.goto(`${BASE}/study/today`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      const t1 = await waitText(page, /4\/8장/, 20_000)
      info(`D6 오늘 탭(4장 후): ${compact(t1 ?? (await bodyText(page)), 520)}`)
      info(`D6 버튼: ${(await buttons(page)).join(' | ').slice(0, 400)}`)
      await shot(page, 'd6-today-after1')
      check('D6 오늘 탭 — "오늘 4/8장 — 4장 더 풀면 오늘 단어 완료"·[한 세트 더]·띠 단어 4/8장', !!t1 && /4장 더 풀면 오늘 단어 완료/.test(t1) && /한 세트 더/.test(t1))
      // 두 번째 세트 — 오늘 새 단어 재사용(A12 0)
      const traces1 = await traceN(T1.id, since)
      await page.getByRole('button', { name: /한 세트 더/ }).click()
      let sid2 = ''
      for (let i = 0; i < 200; i++) {
        const m = /\/study\/today\/words\/([^/?#]+)/.exec(page.url())
        if (m && m[1] !== 'new' && decodeURIComponent(m[1]) !== sid) {
          sid2 = decodeURIComponent(m[1])
          break
        }
        await sleep(300)
      }
      await sleep(1_500)
      const deck2 = await bodyText(page)
      info(`D7 두 번째 덱: ${compact(deck2, 500)}`)
      const a2 = sid2 ? await prisma.vocabAttempt.findMany({ where: { sessionId: sid2 }, select: { refType: true, refId: true } }) : []
      const firstSetAnswered = await prisma.vocabAttempt.findMany({ where: { sessionId: sid, answer: { in: ['CORRECT', 'WRONG'] } }, select: { refId: true } })
      const dup = a2.filter((x) => firstSetAnswered.some((y) => y.refId === x.refId)).length
      check('D7 [한 세트 더] → 새 세트·A12 0회(재사용)·이미 푼 새 단어는 안 나옴', !!sid2 && (await traceN(T1.id, since)) === traces1 && dup === 0, `세트 ${sid2 ? '열림' : '안 열림'} Trace ${traces1}→${await traceN(T1.id, since)} 중복 ${dup} 카드 ${a2.length}장(${['AiWord', 'TopicChunk', 'Expr'].map((k) => `${k} ${a2.filter((a) => a.refType === k).length}`).join(' · ')})`)
      check('D7 두 번째 덱 출처 줄 — "오늘 만든 새 단어 중 안 푼"', /오늘 만든 새 단어 중 안 푼/.test(deck2))
      if (!sid2) throw new Error('두 번째 덱이 안 열렸다')
      // 6장 — 처음 2장은 일부러 오답
      let wrongWords = 0
      for (let i = 0; i < 6; i++) {
        const o = await answerCurrentCard(page, sid2, i < 2)
        if (o === null) {
          info(`D8 카드 ${i + 1} 풀기 실패 — 버튼: ${(await buttons(page)).join(' | ').slice(0, 300)}`)
          break
        }
        if (i < 2) wrongWords++
        const next = page.getByRole('button', { name: /다음 카드|결과 보기/ })
        if (await next.count()) await next.first().click()
        await sleep(400)
      }
      const ans2 = await prisma.vocabAttempt.count({ where: { sessionId: sid2, answer: { in: ['CORRECT', 'WRONG'] } } })
      check('D8 UI 로 6장(오답 2 포함) 풀었다', ans2 === 6, `DB 답 ${ans2}`)
      await page.getByRole('button', { name: '끝내기', exact: true }).first().click()
      await sleep(600)
      await page.getByRole('button', { name: '끝내기', exact: true }).last().click()
      await waitSessionDone(sid2)
      await sleep(1_200)
      const res2Txt = await bodyText(page)
      info(`D9 결과 화면: ${compact(res2Txt, 800)}`)
      const rb = await buttons(page)
      info(`D9 결과 버튼: ${rb.join(' | ').slice(0, 600)}`)
      await shot(page, 'd9-result2')
      // [단어장에 넣기]
      const wordsBefore = await prisma.wordEntry.count({ where: { userId } })
      const addBtn = page.getByRole('button', { name: /단어장에 넣기/ })
      const addN = await addBtn.count()
      check('D9 결과 화면에 [단어장에 넣기](틀린 AI 단어 행)', addN >= 1 && wrongWords === 2, `버튼 ${addN}개`)
      if (addN >= 1) {
        await addBtn.first().click()
        await sleep(2_000)
        const wordsAfter = await prisma.wordEntry.count({ where: { userId } })
        info(`D10 눌러서 → ${compact(await bodyText(page), 300)}`)
        check('D10 [단어장에 넣기] → WordEntry +1(사용자가 눌렀을 때만)', wordsAfter === wordsBefore + 1, `${wordsBefore}→${wordsAfter}`)
      }
      const repAi = await prisma.repetitionItem.count({ where: { userId, refType: 'Expr' } })
      info(`D10 반복 항목(Expr) ${repAi}행(푼 새 단어 ${firstSetAnswered.length + ans2}장 중 중복 제외)`)
      // 오늘 탭 — 달성
      await page.goto(`${BASE}/study/today`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      const t2 = await waitText(page, /달성|단어 완료|✓/, 20_000)
      info(`D11 오늘 탭(달성 후): ${compact(t2 ?? (await bodyText(page)), 520)}`)
      await shot(page, 'd11-today-met')
      check('D11 오늘 탭 — 띠 "✓ 오늘 챌린지 목표 달성"·카드 "✓ 오늘 단어 완료"', !!t2 && /오늘 챌린지 목표 달성/.test(t2) && /오늘 단어 완료/.test(t2))
      const t158 = await api('GET', '/api/v1/challenges/today')
      const w = (((t158.data.today as Json | undefined)?.tasks ?? []) as Json[]).find((t) => t.kind === 'WORDS')
      info(`D11 #158 단어 과제: state=${String(w?.state)} answered=${String(w?.answered)} sets=${String(w?.sets)}`)
    }
    if (MODE === 'cancel') {
      // high_risk 1 — 대기 화면을 떠나는 4가지 방법(링크·Android 뒤로·새로 고침)과 [주제 표현으로 바로 풀기] 빠른 두 번 누름. 실제 A12 를 1.5초 뒤 끊는다(취소 → Trace CANCELLED → 시도 환불).
      const c = await api('POST', '/api/v1/challenges', { topicId: T1.id, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: false, words: true, wordCount: 5 } })
      check('C0 챌린지 생성', c.status === 200, String(c.status))
      const traces = async (since: Date) => prisma.requestTrace.findMany({ where: { userId, refType: 'topicWords', refId: T1.id, createdAt: { gte: since } }, select: { status: true, errorCode: true, totalMs: true }, orderBy: { createdAt: 'asc' } })
      const startWait = async (): Promise<boolean> => {
        await page.goto(`${BASE}/study/today`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await waitText(page, /새 단어 5장/, 30_000)
        await page.getByRole('button', { name: /새 단어 5장 시작하기/ }).click()
        return !!(await waitText(page, /새 단어를 만들고 있어요/, 15_000))
      }
      const postCount = () => reqs.filter((r) => r.m === 'POST' && r.p === '/api/v1/vocab/sessions').length
      // (1) 링크 [오늘로]
      let since = new Date()
      let n0 = postCount()
      let f0 = reqFailed.length
      const ok1 = await startWait()
      await sleep(1_500)
      await page.getByRole('link', { name: '오늘로' }).first().click()
      await sleep(3_000)
      let tr = await traces(since)
      const abort1 = reqFailed.slice(f0).some((x) => x.p === '/api/v1/vocab/sessions' && /ABORTED/.test(x.why))
      check('C1 대기 화면 [오늘로] 링크 → 요청 ERR_ABORTED·Trace CANCELLED 1행·세트 0', ok1 && abort1 && tr.length === 1 && tr[0].errorCode === 'CANCELLED' && (await prisma.vocabSession.count({ where: { userId } })) === 0, `abort ${abort1} trace ${JSON.stringify(tr)} POST ${postCount() - n0}회`)
      // (2) Android 뒤로 가기(history back)
      since = new Date()
      n0 = postCount()
      f0 = reqFailed.length
      const ok2 = await startWait()
      await sleep(1_500)
      await page.goBack()
      await sleep(3_000)
      tr = await traces(since)
      const abort2 = reqFailed.slice(f0).some((x) => x.p === '/api/v1/vocab/sessions' && /ABORTED/.test(x.why))
      check('C2 대기 화면 뒤로 가기 → 요청 ERR_ABORTED·Trace CANCELLED 1행·세트 0', ok2 && abort2 && tr.length === 1 && tr[0].errorCode === 'CANCELLED' && (await prisma.vocabSession.count({ where: { userId } })) === 0, `abort ${abort2} trace ${JSON.stringify(tr)} URL ${new URL(page.url()).pathname}`)
      // (3) 새로 고침 — 생성 요청이 다시 나가지 않는다
      since = new Date()
      n0 = postCount()
      f0 = reqFailed.length
      const ok3 = await startWait()
      await sleep(1_500)
      const nBeforeReload = postCount()
      await page.reload({ waitUntil: 'domcontentloaded' })
      await sleep(4_000)
      tr = await traces(since)
      const afterReload = compact(await bodyText(page), 260)
      info(`C3 새로 고침 뒤 화면: ${afterReload} · URL ${new URL(page.url()).pathname}`)
      check('C3 새로 고침 → 기존 요청 ERR_ABORTED·Trace CANCELLED·생성 요청 다시 안 나감(POST 추가 0)', ok3 && reqFailed.slice(f0).some((x) => x.p === '/api/v1/vocab/sessions' && /ABORTED/.test(x.why)) && postCount() === nBeforeReload && tr.length >= 1 && tr[0].errorCode === 'CANCELLED', `POST ${n0}→${nBeforeReload}→${postCount()} trace ${JSON.stringify(tr)}`)
      // (4) [주제 표현으로 바로 풀기] 빠른 두 번 누름(터치) — 요청 1번·덱 도착
      since = new Date()
      const ok4 = await startWait()
      await sleep(1_200)
      const skip = page.getByRole('button', { name: '주제 표현으로 바로 풀기' })
      const box = await skip.boundingBox()
      const nB = postCount()
      if (box) {
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
      }
      let sid4 = ''
      for (let i = 0; i < 100; i++) {
        const m = /\/study\/today\/words\/([^/?#]+)/.exec(page.url())
        if (m && m[1] !== 'new') {
          sid4 = decodeURIComponent(m[1])
          break
        }
        await sleep(200)
      }
      await sleep(1_500)
      const skipPosts = reqs.slice(-40).filter((r) => r.m === 'POST' && r.p === '/api/v1/vocab/sessions' && /"generate":false/.test(r.body)).length
      tr = await traces(since)
      check('C4 [주제 표현으로 바로 풀기] 두 번 누름(터치) — generate:false 요청 1번·덱 도착·세트 1개', ok4 && !!box && skipPosts === 1 && !!sid4 && (await prisma.vocabSession.count({ where: { userId } })) === 1, `skip POST ${skipPosts}(전체 ${postCount() - nB}) 덱 ${sid4 ? '열림' : '안 열림'} 세트 ${await prisma.vocabSession.count({ where: { userId } })} Trace ${JSON.stringify(tr)}`)
      // (5) 취소 환불 — 취소가 시도를 소모하지 않았다면 이제 정상 시작이 A12 를 부른다(4번 시작·3번 취소·1번 skip, LIMIT 3 이면 소모됐을 때 LIMIT)
      const last = await prisma.vocabSession.findMany({ where: { userId }, select: { id: true } })
      for (const x of last) await api('POST', `/api/v1/vocab/sessions/${x.id}/finish`)
      await restore(userId, b)
      const c2 = await api('POST', '/api/v1/challenges', { topicId: T1.id, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: false, words: true, wordCount: 5 } })
      const g = await api('POST', '/api/v1/vocab/sessions', { topicId: T1.id, count: 5, mode: 'CHOICE' })
      const gen = g.data.generation as Json | undefined
      check('C5 취소 3번 뒤에도 하루 시도가 남아 있다 — 정상 시작이 새 단어를 만든다(LIMIT 아님)', c2.status === 200 && g.status === 200 && gen?.generatedNow === true, `${g.status} ${JSON.stringify(gen)}`)
    }
    if (MODE === 'f') {
      const c = await api('POST', '/api/v1/challenges', { topicId: T1.id, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: true, words: true, wordCount: 5 } })
      check('F0 챌린지 생성(수업+단어 5장, 주제 자기소개)', c.status === 200, String(c.status))
      const scn = await prisma.scenario.findFirst({ where: { userId: null, isSeed: true, status: 'ACTIVE', topics: { some: { topicId: T1.id } } }, orderBy: [{ id: 'asc' }], select: { id: true, title: true, topics: { select: { topicId: true, weight: true } } } })
      if (!scn) throw new Error('챌린지 주제와 이어진 시드 상황이 없다')
      info(`F0 시드 상황: ${scn.title}(이어진 주제 ${scn.topics.length}개)`)
      const g = await api('POST', '/api/v1/lessons', { scenarioId: scn.id })
      const lessonId = String(g.data.lessonId ?? '')
      const lrow = lessonId ? await prisma.lesson.findUnique({ where: { id: lessonId }, select: { scenarioId: true, topicId: true, status: true, kind: true } }) : null
      check('F1 #59 {scenarioId} → GENERATING·Lesson.scenarioId = 상황·topicId = 챌린지 주제(대표 주제)', g.status === 200 && g.data.status === 'GENERATING' && lrow?.scenarioId === scn.id && lrow?.topicId === T1.id && lrow?.kind === 'NEW', `${g.status} ${String(g.data.status)} scenario=${lrow?.scenarioId === scn.id} topic=${lrow?.topicId === T1.id}`)
      const t158a = await api('GET', '/api/v1/challenges/today')
      const lta = (((t158a.data.today as Json | undefined)?.tasks ?? []) as Json[]).find((t) => t.kind === 'LESSON')
      check('F2 #158 레슨 과제가 그 상황 수업(lessonId)을 가리킨다(GENERATING·jobId)', lta?.lessonId === lessonId && lta?.state === 'GENERATING' && !!lta?.jobId, `${String(lta?.state)} lessonId 일치 ${lta?.lessonId === lessonId}`)
      await page.goto(`${BASE}/study/today`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      const genTxt = await waitText(page, /수업을 만들고 있어요/, 30_000)
      info(`F3 오늘 탭(생성 중): ${compact(genTxt ?? (await bodyText(page)), 480)}`)
      await shot(page, 'f3-today-gen')
      const makeBtn = (await buttons(page)).filter((x) => /오늘 수업 만들기|수업 만들기/.test(x))
      check('F3 생성 중 카드 — "수업을 만들고 있어요"·[오늘 수업 만들기] 없음·#59 새로 안 부름', !!genTxt && makeBtn.length === 0 && posts(/^\/api\/v1\/lessons$/) === 0, `만들기 버튼 ${makeBtn.length}개 · POST /lessons ${posts(/^\/api\/v1\/lessons$/)}회`)
      // 수업이 준비될 때까지 — 카드가 폴링으로 스스로 바뀌는지(최대 200초). A4 가 FAILED 면 같은 #59 로 한 번 되살린다.
      let readyTxt = await waitText(page, /수업이 준비됐어요|수업을 만들지 못했어요/, 200_000)
      let a4Tries = 1
      if (readyTxt && /수업을 만들지 못했어요/.test(readyTxt)) {
        info('F4 A4 생성 실패(카드 FAILED 표시) — 같은 상황으로 #59 를 한 번 다시 보낸다(되살리기, 실제 A4 1회 더)')
        await shot(page, 'f4-today-fail')
        const re = await api('POST', '/api/v1/lessons', { scenarioId: scn.id })
        a4Tries++
        check('F4a 실패한 상황 수업 → 같은 #59 = 같은 레슨 행 되살리기(새 행 없음)', re.data.lessonId === lessonId, `lessonId 일치 ${re.data.lessonId === lessonId}`)
        await page.reload({ waitUntil: 'domcontentloaded' })
        readyTxt = await waitText(page, /수업이 준비됐어요/, 200_000)
      }
      info(`F4 오늘 탭(준비됨): ${compact(readyTxt ?? (await bodyText(page)), 480)} · A4 시도 ${a4Tries}회`)
      await shot(page, 'f4-today-ready')
      const t158b = await api('GET', '/api/v1/challenges/today')
      const ltb = (((t158b.data.today as Json | undefined)?.tasks ?? []) as Json[]).find((t) => t.kind === 'LESSON')
      check('F4 준비됨 — 카드 "수업이 준비됐어요"(폴링으로 자동 갱신)·#158 READY·lessonId 같음', !!readyTxt && /수업이 준비됐어요/.test(readyTxt) && ltb?.state === 'READY' && ltb?.lessonId === lessonId, `${String(ltb?.state)}`)
      if (readyTxt && /수업이 준비됐어요/.test(readyTxt)) {
        await page.getByRole('button', { name: '시작하기', exact: true }).first().click()
        let url = ''
        for (let i = 0; i < 100; i++) {
          url = page.url()
          if (url.includes(`/study/today/talk/${lessonId}`)) break
          await sleep(200)
        }
        await sleep(1_000)
        await shot(page, 'f5-lesson-open')
        const lcount = await prisma.lesson.count({ where: { userId } })
        check('F5 [시작하기] → 그 상황 수업(lessonId)을 연다·#59 {topicId} 새로 안 부름·Lesson 행 1개', url.includes(`/study/today/talk/${lessonId}`) && posts(/^\/api\/v1\/lessons$/) === 0 && lcount === 1, `URL 일치 ${url.includes(lessonId)} · POST /lessons ${posts(/^\/api\/v1\/lessons$/)}회 · 수업 ${lcount}개`)
        const lessonTxt = await bodyText(page)
        info(`F5 수업 화면: ${compact(lessonTxt, 300)}`)
      }
      // 상황 수업을 끝내면 챌린지 수업으로 세어지는가(설계 010d: 대표 주제 = 챌린지 주제면 센다) — 사실 기록
      if (ltb?.state === 'READY') {
        const gl = await api('GET', `/api/v1/lessons/${lessonId}`)
        const content = gl.data.content as { quiz: { answer: number }[]; application: { modelAnswerJa: string }[] }
        await api('PATCH', `/api/v1/lessons/${lessonId}/progress`, { stageDone: 3, progress: { quiz: { answers: content.quiz.map((q) => q.answer) }, application: { answers: [content.application[0].modelAnswerJa, null, null] } } })
        await api('PATCH', `/api/v1/lessons/${lessonId}/progress`, { stageDone: 4 })
        const done = await api('POST', `/api/v1/lessons/${lessonId}/complete`, {})
        const chp = done.data.challenge as Json | null | undefined
        info(`F6 상황 수업 #62 완료 → challenge=${JSON.stringify(chp ?? null)}`)
        check('F6 상황 수업(대표 주제 = 챌린지 주제) #62 완료 200 — challenge 키 있음(값 객체 = 챌린지 수업으로 센다)', done.status === 200 && 'challenge' in done.data && !!chp && chp.challengeId === String(c.data.id), `${done.status} ${JSON.stringify(chp ?? null)}`)
        await page.goto(`${BASE}/study/today`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        const dTxt = await waitText(page, /오늘 수업을 끝냈어요/, 20_000)
        await shot(page, 'f6-today-lesson-done')
        info(`F6 오늘 탭(수업 완료): ${compact(dTxt ?? (await bodyText(page)), 400)}`)
        check('F6 오늘 탭 회화 카드 — "✓ 오늘 수업을 끝냈어요"(상황 수업이 챌린지 오늘 수업)·일반 수업 새로 안 만듦', !!dTxt && (await prisma.lesson.count({ where: { userId } })) === 1 && posts(/^\/api\/v1\/lessons$/) === 0)
      }
    }
    if (MODE === 'limit') {
      // 하루 시도 상한(3)을 다른 주제로 소진한다 — 응답 `generation.reason === 'LIMIT'` 이 나오면 소진된 것(최대 5번 요청, 실제 A12 는 상한까지만).
      // (`attemptsByDay` 는 서버 메모리 — dev 서버가 `qa-sync.sh` 의 tutor.md 갱신으로 HMR 되면 초기화된다. 이 모드 직전에 동기화한 뒤 다른 동기화 없이 돌릴 것.)
      const others = [T2, T3, T4, T2, T3]
      let a12Calls = 0
      let limitSeen = false
      for (const t of others) {
        const r = await api('POST', '/api/v1/vocab/sessions', { topicId: t.id, count: 5, mode: 'CHOICE' })
        const g = r.data.generation as Json | undefined
        const sess = r.data.session as Json | undefined
        if (g?.generatedNow === true) a12Calls++
        if (sess?.id) await api('POST', `/api/v1/vocab/sessions/${String(sess.id)}/finish`)
        if (g?.reason === 'LIMIT') {
          limitSeen = true
          break
        }
      }
      // 상한 소진의 판정 = 실제 A12 가 상한 횟수(3)만큼 불렸다. (4번째 이후 요청이 오늘 이미 새 단어를 만든 주제면 LIMIT 이 아니라 재사용이라 reason LIMIT 이 안 올 수 있다 — 소진 증거는 L1·L2.)
      check('L-pre 다른 주제로 하루 시도 상한 소진 — 실제 A12 3회', a12Calls === 3 || limitSeen, `실제 A12 ${a12Calls}회 · 응답 reason LIMIT ${limitSeen ? '관측' : '못 봄(재사용 주제 요청)'}`)
      const c = await api('POST', '/api/v1/challenges', { topicId: T1.id, lengthDays: 7, start: 'TODAY', dailyGoal: { lesson: false, words: true, wordCount: 5 } })
      check('L0 챌린지 생성(단어만·5장)', c.status === 200, String(c.status))
      await page.goto(`${BASE}/study/today`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await waitText(page, /새 단어 5장/, 30_000)
      const since = new Date()
      const tStart = Date.now()
      await page.getByRole('button', { name: /새 단어 5장 시작하기/ }).click()
      let sid = ''
      for (let i = 0; i < 200; i++) {
        const m = /\/study\/today\/words\/([^/?#]+)/.exec(page.url())
        if (m && m[1] !== 'new') {
          sid = decodeURIComponent(m[1])
          break
        }
        await sleep(200)
      }
      const ms = Date.now() - tStart
      await sleep(1_500)
      const deck = await bodyText(page)
      info(`L1 덱: ${compact(deck, 600)}`)
      await shot(page, 'l1-deck-limit')
      const tn = await traceN(T1.id, since)
      const cards = sid ? await prisma.vocabAttempt.findMany({ where: { sessionId: sid }, select: { refType: true } }) : []
      check('L1 하루 시도 상한 뒤 시작 — A12 0회(Trace 0)·덱 열림·카드 전부 주제 표현(AiWord 0)', !!sid && tn === 0 && cards.length > 0 && cards.every((x) => x.refType !== 'AiWord'), `${ms}ms Trace ${tn} 카드 ${cards.length}(${[...new Set(cards.map((x) => x.refType))].join(',')})`)
      check('L2 덱 알림 "오늘 새 단어 만들기는 여기까지예요 · 「자기소개」 표현으로 골랐어요"(사유 LIMIT 폴백)', /오늘 새 단어 만들기는 여기까지예요/.test(deck) && /표현으로 골랐어요/.test(deck))
    }
  } finally {
    if (ovfs.length) {
      info(`화면 지표(390×892, DSF 2.625): ${ovfs.map((o) => `${o.name} 넘침 ${o.px}px·44px 미만 터치대상 ${o.small}`).join(' | ')}`)
      check('V 실제 흐름 화면 가로 넘침 0px(390)', ovfs.every((o) => o.px === 0), ovfs.filter((o) => o.px > 0).map((o) => `${o.name} ${o.px}px`).join(' '))
    }
    info(`네트워크: POST /api/v1/lessons ${posts(/^\/api\/v1\/lessons$/)}회 · POST /api/v1/vocab/sessions ${posts(/^\/api\/v1\/vocab\/sessions$/)}회`)
    info(`페이지 오류 ${errs.length}건 ${errs.join(' | ').slice(0, 200)}`)
    await browser.close()
    const left = await restore(userId, b)
    info(`정리: ${JSON.stringify(left)} · AiJob ${jobsBefore}→${await prisma.aiJob.count({ where: { userId } })} · Trace ${tracesBefore}→${await prisma.requestTrace.count({ where: { userId } })}(topicWords·턴 Trace 는 남김)`)
  }
  const failed = results.filter((r) => !r.ok)
  console.log(`\n결과: ${results.length - failed.length}/${results.length} PASS${failed.length ? ` — FAIL: ${failed.map((r) => r.id).join(', ')}` : ''}`)
  if (failed.length) process.exitCode = 1
}
main().catch((e) => { console.error(e instanceof Error ? e.stack : e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
