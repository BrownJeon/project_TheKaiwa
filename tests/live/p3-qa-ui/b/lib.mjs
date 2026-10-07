/**
 * qa-045-ui-b 공용 도우미 — 화면(Playwright) + DB 대조. QA 계정 3(주)·2(읽기 전용)만 쓴다. LLM 호출 0.
 * 실행: `cd $HOME/.node-local/thekaiwa-qa045ui-b && QA_COOKIE=<c3 쿠키 파일> QA_COOKIE2=<c2 쿠키 파일> node --env-file=.env <이 폴더>/<스크립트>.mjs`
 * (127.0.0.1:3052 dev 서버. 스냅샷의 node_modules 로 prisma 를, ~/node_modules 로 playwright-core 를 읽는다.)
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const reqPw = createRequire('/home/brownjeon/x.js')
const { chromium } = reqPw('playwright-core')
const Q = process.env.QA_SNAPSHOT ?? `${process.env.HOME}/.node-local/thekaiwa-qa045ui-b`
const { PrismaClient } = createRequire(`${Q}/x.js`)('@prisma/client')

export const BASE = process.env.QA_BASE ?? 'http://127.0.0.1:3052'
export const prisma = new PrismaClient()
export const WIDTHS = [
  [360, 740],
  [390, 844],
  [412, 892],
]
export const SCRATCH = process.env.QA_SCRATCH ?? '/tmp/claude-1000/-home-brownjeon-NFS-homes-brownjeon-project-TheKaiwa/729e3300-9a56-4bdf-bda2-ca7f7603c97f/scratchpad'
export const SSDIR = `${SCRATCH}/qaui-b`
mkdirSync(SSDIR, { recursive: true })

export const QA3 = 'qa-bot3@thekaiwa.test'
export const QA2 = 'qa-bot2@thekaiwa.test'
export const T_CAFE = 'cmuihjozt000dw1dgeo2on2uf'
export const T_ROAD = 'cmuihjs9h000qw1dgthvl3fxn'
export const SEED_SC = 'scn_cafe-order-drink'

export const cookieOf = (path) => readFileSync(path, 'utf8').trim()
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const j = (v) => JSON.stringify(v)

export async function api(cookie, method, path, body) {
  const headers = {}
  if (cookie) headers.Cookie = cookie
  let payload
  if (body !== undefined) {
    payload = JSON.stringify(body)
    headers['Content-Type'] = 'application/json'
  }
  const r = await fetch(BASE + path, { method, headers, body: payload })
  const text = await r.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { _raw: text.slice(0, 300) }
  }
  return { status: r.status, body: json }
}
export const data = (r) => r.body?.data
export const details = (r) => r.body?.data?.details ?? r.body?.details ?? null

export async function qaUser(email) {
  if (!email.endsWith('@thekaiwa.test')) throw new Error('QA 계정만')
  const u = await prisma.user.findUnique({ where: { email } })
  if (!u) throw new Error('QA 계정 없음: ' + email)
  return u
}

export async function seedHash() {
  const topics = await prisma.conversationTopic.findMany({ where: { userId: null }, orderBy: { id: 'asc' }, include: { chunks: { orderBy: { id: 'asc' } } } })
  const scenarios = await prisma.scenario.findMany({ where: { userId: null }, orderBy: { id: 'asc' }, include: { topics: { orderBy: { topicId: 'asc' } } } })
  const norm = JSON.stringify({ topics, scenarios }, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
  return {
    topics: topics.length,
    chunks: topics.reduce((n, t) => n + t.chunks.length, 0),
    scenarios: scenarios.length,
    links: scenarios.reduce((n, s) => n + s.topics.length, 0),
    sha: createHash('sha256').update(norm).digest('hex').slice(0, 16),
  }
}

/** QA 계정 행 정리 — override → 챌린지 → 상황 → 주제 순. userId 는 QA 계정만. */
export async function cleanupQa(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (!u || !u.email.endsWith('@thekaiwa.test')) throw new Error('cleanup: QA 계정이 아님')
  const o = await prisma.userSeedOverride.deleteMany({ where: { userId } })
  const ch = await prisma.challenge.deleteMany({ where: { userId } })
  const sc = await prisma.scenario.deleteMany({ where: { userId } })
  const tp = await prisma.conversationTopic.deleteMany({ where: { userId } })
  return { overrides: o.count, challenges: ch.count, scenarios: sc.count, topics: tp.count }
}
export async function qaRowCounts(userId) {
  return {
    overrides: await prisma.userSeedOverride.count({ where: { userId } }),
    topics: await prisma.conversationTopic.count({ where: { userId } }),
    scenarios: await prisma.scenario.count({ where: { userId } }),
    challenges: await prisma.challenge.count({ where: { userId } }),
  }
}

const todayKst = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
export const dayDate = (offset) => {
  const d = new Date(todayKst() + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + offset)
  return d
}

/** 챌린지 행을 QA 계정에 직접 삽입(주제 연결). status: ACTIVE|COMPLETED|ENDED. */
export async function insertChallenge(userId, topic, status, opts = {}) {
  const lengthDays = opts.lengthDays ?? 7
  const startOffset = status === 'ACTIVE' ? -1 : -10
  const endOffset = status === 'ACTIVE' ? lengthDays - 2 : -4
  const base = {
    userId,
    title: opts.title ?? `QA ${topic.title} ${lengthDays}일 챌린지`,
    topicId: topic.id,
    topicTitleSnap: topic.title,
    level: topic.level ?? 'N5',
    lengthDays,
    startDate: dayDate(startOffset),
    endDate: dayDate(endOffset),
    dailyGoal: { lesson: true, words: false, wordCount: null, wordsMinAnswered: null, countSkipped: false, ruleVersion: 1 },
    status,
  }
  if (status === 'ACTIVE') base.activeKey = userId
  if (status === 'COMPLETED') {
    base.endedAt = dayDate(-3)
    base.result = { ruleVersion: 1, endReason: null, metDays: 5, partialDays: 1, missedDays: 1, stoppedDays: 0, elapsedDays: 7, rate: 0.71, longestStreak: 4, lessonsDone: 5, wordSets: 0, wordsCorrect: 0, days: [] }
  }
  if (status === 'ENDED') {
    base.endedAt = dayDate(-4)
    base.result = { ruleVersion: 1, endReason: 'USER', metDays: 2, partialDays: 0, missedDays: 1, stoppedDays: 4, elapsedDays: 3, rate: 0.66, longestStreak: 2, lessonsDone: 2, wordSets: 0, wordsCorrect: 0, days: [] }
  }
  return prisma.challenge.create({ data: base })
}

let pass = 0
let fail = 0
export function check(name, ok, detail = '') {
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`)
}
export function note(msg) {
  console.log('INFO | ' + msg)
}
export function summary(label) {
  console.log(`== ${label}: ${pass}/${pass + fail} PASS, FAIL ${fail}`)
  return { pass, fail }
}

export async function launch() {
  return chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
}

/** 새 컨텍스트+페이지. 요청 기록(`reqs`: {m,p,body,status}) 포함. */
export async function openPage(browser, w, h, cookieStr) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
  const eq = cookieStr.indexOf('=')
  await ctx.addCookies([{ name: cookieStr.slice(0, eq), value: cookieStr.slice(eq + 1), url: BASE }])
  const page = await ctx.newPage()
  const reqs = []
  const byReq = new Map()
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (!u.pathname.startsWith('/api/v1/')) return
    const e = { m: r.method(), p: u.pathname + u.search, body: r.postData(), status: null }
    reqs.push(e)
    byReq.set(r, e)
  })
  page.on('response', (res) => {
    const e = byReq.get(res.request())
    if (e) e.status = res.status()
  })
  page.on('requestfailed', (r) => {
    const e = byReq.get(r)
    if (e) e.status = 'FAILED'
  })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  return { ctx, page, reqs, errors }
}

/** 스크롤 컨테이너 main 의 scrollTop. */
export const mainScrollTop = (page) => page.evaluate(() => (document.querySelector('[data-app-shell] main') ?? document.querySelector('main'))?.scrollTop ?? -1)
export const docScrollMetrics = (page) =>
  page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, docScrollH: document.documentElement.scrollHeight, innerH: window.innerHeight }))

/** 가로 넘침 — 문서 clientWidth 를 넘는 요소(우측)·좌측 음수 요소 수와 목록(상위 5). root 선택자 안만 보거나 전체. */
export async function overflowInfo(page, rootSel = null) {
  return page.evaluate((rootSel) => {
    const cw = document.documentElement.clientWidth
    const root = rootSel ? document.querySelector(rootSel) : document.body
    if (!root) return { cw, count: -1, items: [], rootMissing: true }
    const bad = []
    for (const el of root.querySelectorAll('*')) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      if (el.closest('.sr-only')) continue
      if (r.right > cw + 0.5 || r.left < -0.5) bad.push({ tag: el.tagName, cls: String(el.className).slice(0, 50), l: Math.round(r.left), r: Math.round(r.right), txt: (el.textContent ?? '').slice(0, 24) })
    }
    return { cw, count: bad.length, items: bad.slice(0, 5), docScrollW: document.documentElement.scrollWidth }
  }, rootSel)
}

export const dialogOf = (page) => page.getByRole('dialog')

/** 접근성 상태 요약: 초점 요소, 대화상자 aria-describedby 대상 존재. */
export async function dialogA11y(page) {
  return page.evaluate(() => {
    const d = document.querySelector('[role=dialog]')
    if (!d) return null
    const ae = document.activeElement
    const desc = d.getAttribute('aria-describedby')
    const labelledby = d.getAttribute('aria-labelledby')
    const descEl = desc ? document.getElementById(desc) : null
    const titleEl = labelledby ? document.getElementById(labelledby) : null
    const r = d.getBoundingClientRect()
    return {
      activeTag: ae?.tagName ?? null,
      activeText: (ae?.textContent ?? '').trim().slice(0, 40),
      activeIsTitle: !!ae && ae === titleEl,
      describedby: desc,
      descExists: !!descEl,
      descInDialog: !!descEl && d.contains(descEl),
      descText: descEl ? (descEl.textContent ?? '').trim().slice(0, 80) : null,
      title: titleEl ? (titleEl.textContent ?? '').trim() : null,
      dialogH: Math.round(r.height),
      dialogW: Math.round(r.width),
    }
  })
}

/** 시트 안(role=dialog) 버튼 높이·aria 상태. */
export async function dialogButtons(page) {
  return page.evaluate(() => {
    const d = document.querySelector('[role=dialog]')
    if (!d) return []
    return [...d.querySelectorAll('button')].map((b) => {
      const r = b.getBoundingClientRect()
      return { text: (b.textContent ?? '').trim().slice(0, 30), aria: b.getAttribute('aria-label'), h: Math.round(r.height * 10) / 10, w: Math.round(r.width), busy: b.getAttribute('aria-busy'), disabled: b.getAttribute('aria-disabled') }
    })
  })
}

/** 시트 본문(스크롤 영역)이 가로로 넘치는지. */
export async function sheetBodyOverflow(page) {
  return page.evaluate(() => {
    const d = document.querySelector('[role=dialog]')
    if (!d) return null
    const body = d.querySelector('.overflow-y-auto')
    if (!body) return null
    return { clientW: body.clientWidth, scrollW: body.scrollWidth, over: body.scrollWidth > body.clientWidth + 1, clientH: body.clientHeight, scrollH: body.scrollHeight }
  })
}

export const toastText = (page) =>
  page.evaluate(() => {
    const el = [...document.querySelectorAll('[role=status],[role=alert]')].filter((e) => !e.closest('[role=dialog]') && (e.textContent ?? '').trim())
    return el.map((e) => (e.textContent ?? '').trim())
  })

export async function closeBrowser(browser) {
  try {
    await browser.close()
  } catch {}
}

/** 429(분당 한도) 만나면 62초 쉬고 한 번 다시. */
async function withRetry(fn) {
  let r = await fn()
  if (r.status === 429) {
    note('429 — 62초 대기 후 재시도')
    await sleep(62000)
    r = await fn()
  }
  return r
}

/** 내 주제(#57) 만들기 — 시드 「자기소개」 조각 8개를 본문으로. 반환: 주제 id. */
export async function mkTopic(cookie, title, level = 'N5') {
  const intro = (data(await api(cookie, 'GET', '/api/v1/topics?level=all'))?.items ?? []).find((t) => t.isSeed && t.title === '자기소개')
  const chunks = intro.chunks.slice(0, 8).map((x) => ({ chunkType: x.chunkType, textJa: x.textJa, reading: x.reading, meaningKo: x.meaningKo }))
  const r = await withRetry(() => api(cookie, 'POST', '/api/v1/topics', { title, titleJa: '自己紹介', level, description: 'QA 삭제 시험용 주제', chunks }))
  if (r.status !== 201) note('mkTopic FAIL ' + r.status + ' ' + j(r.body).slice(0, 250))
  return data(r)?.topic?.id
}

/** 내 상황(#163) 만들기 — 시드 「카페 음료 주문」 본문 기반. 반환: 상황 id. */
export async function mkScenario(cookie, title, topicIds) {
  const base = data(await api(cookie, 'GET', `/api/v1/scenarios/${SEED_SC}`))
  const r = await withRetry(() =>
    api(cookie, 'POST', '/api/v1/scenarios', {
      title, titleJa: base.titleJa, description: 'QA 상황', level: base.level, difficulty: base.difficulty, roles: base.roles,
      goal: { communicativeGoalKo: base.goal.communicativeGoalKo, successCriteria: base.goal.successCriteria },
      steps: base.steps.map((s) => ({ ko: s.ko })), keyExpressions: base.keyExpressions.map((e) => ({ ja: e.ja, reading: e.reading, ko: e.ko })),
      requiredExpressions: base.requiredExpressions, ...(base.opening ? { opening: base.opening } : {}), topicIds,
    }),
  )
  if (r.status !== 201) note('mkScenario FAIL ' + r.status + ' ' + j(r.body).slice(0, 250))
  return data(r)?.id
}

export const linksOf = async (scenarioId) => (await prisma.scenarioTopic.findMany({ where: { scenarioId } })).map((x) => x.topicId).sort()

/** 토스트 문구를 최대 3.6초 기다려 모은다. */
export async function toastWait(page, pat) {
  let t = []
  for (let i = 0; i < 24 && !t.some((x) => pat.test(x)); i++) {
    await sleep(150)
    t = await toastText(page)
  }
  return t
}
