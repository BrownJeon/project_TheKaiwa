/** qa-045-ui-a 공용 — 쿠키·Playwright 컨텍스트·측정 헬퍼. 127.0.0.1:3051 만(3010 운영 거부). 쿠키 값은 출력하지 않는다. */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

export const BASE = process.env.BASE ?? 'http://127.0.0.1:3051'
const u = new URL(BASE)
if (u.hostname !== '127.0.0.1' || Number(u.port) === 3010) throw new Error('BASE 는 127.0.0.1(3010 제외)만')
export const SP = process.env.SP
export const SHOTS = `${SP}/qaui-a`
const require = createRequire('/home/brownjeon/x.js')
export const { chromium } = require('playwright-core')
const raw = readFileSync(`${SP}/qaui-a-cookie`, 'utf8').trim()
const eq = raw.indexOf('=')
export const COOKIE = { name: raw.slice(0, eq), value: raw.slice(eq + 1) }
export const cookieHeader = `${COOKIE.name}=${COOKIE.value}`
export const WIDTHS = [
  { w: 360, h: 740 },
  { w: 390, h: 844 },
  { w: 412, h: 892 },
]
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const results = []
export function check(id, ok, note = '') {
  results.push({ id, ok, note })
  console.log(`${ok === null ? 'NOT_VERIFIED' : ok ? 'PASS' : 'FAIL'} ${id}${note ? ` — ${note}` : ''}`)
}
export function summary() {
  const fail = results.filter((x) => x.ok === false).length
  const nv = results.filter((x) => x.ok === null).length
  console.log(`RESULT total=${results.length} pass=${results.length - fail - nv} fail=${fail} not_verified=${nv}`)
}
export async function api(path) {
  const r = await fetch(`${BASE}${path}`, { headers: { Cookie: cookieHeader }, signal: AbortSignal.timeout(60_000) })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* html */ }
  return { status: r.status, json, text }
}
export async function launch() {
  return chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
}
export async function newCtx(browser, vp, { dark = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    colorScheme: dark ? 'dark' : 'light',
    reducedMotion: 'reduce',
  })
  await ctx.addCookies([{ name: COOKIE.name, value: COOKIE.value, url: BASE }])
  return ctx
}
/** 가로 넘침·세로 스크롤·main 지표 */
export async function overflowReport(page) {
  return page.evaluate(() => {
    const cw = document.documentElement.clientWidth
    const main = document.querySelector('main')
    const bad = []
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      const cs = getComputedStyle(el)
      if (cs.position === 'fixed' && cs.display === 'none') continue
      if (r.right > cw + 0.5 || r.left < -0.5) bad.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 3).join('.') : ''}:${Math.round(r.left)}..${Math.round(r.right)}`)
    }
    return {
      innerWidth: innerWidth,
      clientWidth: cw,
      docScrollWidth: document.documentElement.scrollWidth,
      docOverflowX: document.documentElement.scrollWidth > innerWidth,
      mainScrollW: main ? main.scrollWidth : null,
      mainClientW: main ? main.clientWidth : null,
      mainOverflowX: main ? main.scrollWidth > main.clientWidth : null,
      pageVScroll: document.documentElement.scrollHeight > innerHeight + 1,
      docScrollH: document.documentElement.scrollHeight,
      innerHeight: innerHeight,
      overflowEls: bad.slice(0, 8),
      overflowCount: bad.length,
    }
  })
}
export const tabbarPresent = (page) => page.evaluate(() => !!document.querySelector('nav[aria-label="주 메뉴"]'))
export const mainTop = (page) => page.evaluate(() => document.querySelector('main')?.scrollTop ?? -1)
