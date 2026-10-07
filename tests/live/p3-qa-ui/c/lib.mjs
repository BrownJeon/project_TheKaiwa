/**
 * qa-045-ui-c 공용 도우미 — 화면(Playwright) + DB 대조. QA 계정 4(주)·1(다른 계정 전환 시험)만 쓴다. 실제 Claude 호출(항목 1·3·4 일부).
 * 실행: `cd $HOME/.node-local/thekaiwa-qa045ui-c && QA_COOKIE=<c4 쿠키 파일> QA_COOKIE1=<c1 쿠키 파일> node --env-file=.env <이 폴더>/<스크립트>.mjs`
 * (127.0.0.1:3053 dev 서버. 스냅샷의 node_modules 로 prisma 를, ~/node_modules 로 playwright-core 를 읽는다.)
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const reqPw = createRequire('/home/brownjeon/x.js')
const { chromium } = reqPw('playwright-core')
const Q = process.env.QA_SNAPSHOT ?? `${process.env.HOME}/.node-local/thekaiwa-qa045ui-c`
const { PrismaClient } = createRequire(`${Q}/x.js`)('@prisma/client')

export const BASE = process.env.QA_BASE ?? 'http://127.0.0.1:3053'
export const prisma = new PrismaClient()
export const WIDTHS = [
  [360, 740],
  [390, 844],
  [412, 892],
]
export const SCRATCH = process.env.QA_SCRATCH ?? '/tmp/claude-1000/-home-brownjeon-NFS-homes-brownjeon-project-TheKaiwa/729e3300-9a56-4bdf-bda2-ca7f7603c97f/scratchpad'
export const SSDIR = `${SCRATCH}/qaui-c`
mkdirSync(SSDIR, { recursive: true })
export const DEVLOG = `${SCRATCH}/qaui-c-dev.log`
export const SNAP_FILE = `${SCRATCH}/qaui-c-snapshot.json`

export const QA4 = 'qa-bot4@thekaiwa.test'
export const QA1 = 'qa-bot@thekaiwa.test'
export const STORE_KEY = 'kaiwa.topic.draft'
export const NEW_PATH = '/settings/scenarios/topics/new'

export const cookieOf = (path) => readFileSync(path, 'utf8').trim()
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const j = (v) => JSON.stringify(v)
export const NO_BIGINT = (_k, v) => (typeof v === 'bigint' ? v.toString() : v)

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

export async function qaUser(email) {
  if (!email.endsWith('@thekaiwa.test')) throw new Error('QA 계정만')
  const u = await prisma.user.findUnique({ where: { email } })
  if (!u) throw new Error('QA 계정 없음: ' + email)
  return u
}

/** 시드 해시(이전 QA 와 같은 방식 — 기본 주제·조각·상황·연결 내용). */
export async function seedHash() {
  const topics = await prisma.conversationTopic.findMany({ where: { userId: null }, orderBy: { id: 'asc' }, include: { chunks: { orderBy: { id: 'asc' } } } })
  const scenarios = await prisma.scenario.findMany({ where: { userId: null }, orderBy: { id: 'asc' }, include: { topics: { orderBy: { topicId: 'asc' } } } })
  const norm = JSON.stringify({ topics, scenarios }, NO_BIGINT)
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
    chunks: await prisma.topicChunk.count({ where: { topic: { userId } } }),
    scenarios: await prisma.scenario.count({ where: { userId } }),
    scenarioTopics: await prisma.scenarioTopic.count({ where: { scenario: { userId } } }),
    challenges: await prisma.challenge.count({ where: { userId } }),
  }
}
export async function globalCounts() {
  return { topics: await prisma.conversationTopic.count(), chunks: await prisma.topicChunk.count(), scenarios: await prisma.scenario.count() }
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

/** 새 컨텍스트+페이지. 요청 기록(`reqs`: {m,p,body,status,resp}) 포함(/api/v1/ 만). */
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
    const e = { m: r.method(), p: u.pathname + u.search, body: r.postData(), status: null, resp: null, t: Date.now() }
    reqs.push(e)
    byReq.set(r, e)
  })
  page.on('response', (res) => {
    const e = byReq.get(res.request())
    if (!e) return
    e.status = res.status()
    e.dt = Date.now() - e.t
    res.text().then((t) => (e.resp = t.slice(0, 600))).catch(() => {})
  })
  page.on('requestfailed', (r) => {
    const e = byReq.get(r)
    if (e) e.status = 'FAILED'
  })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
  return { ctx, page, reqs, errors }
}

export const mainScrollTop = (page) => page.evaluate(() => document.querySelector('main')?.scrollTop ?? -1)
export const docScrollMetrics = (page) =>
  page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, docScrollH: document.documentElement.scrollHeight, innerH: window.innerHeight }))

/** 가로 넘침 — 문서 clientWidth 를 넘는 요소(우측)·좌측 음수 요소 수와 목록(상위 5). */
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
      if (el.closest('.sr-only') || el.closest('[hidden]')) continue
      if (r.right > cw + 0.5 || r.left < -0.5) bad.push({ tag: el.tagName, cls: String(el.className).slice(0, 50), l: Math.round(r.left), r: Math.round(r.right), txt: (el.textContent ?? '').slice(0, 24) })
    }
    return { cw, count: bad.length, items: bad.slice(0, 5), docScrollW: document.documentElement.scrollWidth }
  }, rootSel)
}

/** 터치 대상 44px 미만 — 보이는 button·a·input·radio·checkbox. 알약의 `::before` 히트 영역(absolute 세로 확장)을 합산한다. */
export async function smallTargets(page) {
  return page.evaluate(() => {
    const out = []
    const sel = 'button, a[href], input, textarea, select, [role=radio], [role=checkbox], [role=button], [role=menuitem], summary'
    for (const el of document.querySelectorAll(sel)) {
      if (el.closest('[hidden]') || el.closest('[aria-hidden=true]')) continue
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      let h = r.height
      let w = r.width
      const b = getComputedStyle(el, '::before')
      if (b && b.position === 'absolute' && b.content !== 'none') {
        const bh = parseFloat(b.height)
        const bw = b.width === 'auto' ? w : parseFloat(b.width)
        if (!Number.isNaN(bh)) h = Math.max(h, bh)
        if (!Number.isNaN(bw)) w = Math.max(w, bw)
      }
      if (h < 43.5 || w < 43.5) out.push({ tag: el.tagName, role: el.getAttribute('role'), txt: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24), h: Math.round(h * 10) / 10, w: Math.round(w) })
    }
    return out
  })
}

export const readStore = (page) => page.evaluate((k) => sessionStorage.getItem(k), STORE_KEY)
export const activeInfo = (page) =>
  page.evaluate(() => {
    const a = document.activeElement
    return a ? { tag: a.tagName, id: a.id || null, aria: a.getAttribute('aria-label'), role: a.getAttribute('role'), txt: (a.textContent ?? '').trim().slice(0, 40) } : null
  })
export const mainText = (page) => page.evaluate(() => (document.querySelector('main')?.innerText ?? '').replace(/\s+/g, ' '))

/** dev 로그의 Claude 호출 수(task 별). */
export function claudeCalls() {
  const txt = readFileSync(DEVLOG, 'utf8')
  const counts = {}
  for (const m of txt.matchAll(/완료 — task=([A-Za-z]+)/g)) counts[m[1]] = (counts[m[1]] ?? 0) + 1
  const starts = {}
  for (const m of txt.matchAll(/task=([A-Za-z]+)/g)) starts[m[1]] = (starts[m[1]] ?? 0) + 1
  return { done: counts, any: starts }
}

export async function closeBrowser(browser) {
  try {
    await browser.close()
  } catch {}
}
export const saveJson = (path, v) => writeFileSync(path, JSON.stringify(v, null, 1))

/** 실제 손가락처럼 좌표 탭(aria-disabled 버튼도 Playwright 의 enabled 대기에 막히지 않게). 요소 가운데. */
export async function tapAt(page, locator) {
  await locator.scrollIntoViewIfNeeded()
  const b = await locator.boundingBox()
  if (!b) throw new Error('tapAt: boundingBox null')
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
}
