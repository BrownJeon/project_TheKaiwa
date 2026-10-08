/**
 * task-046 T2 보정 측정 — 단어가 있는 단어장/채팅 목록의 최종 블록 높이(자리표시 상수의 근거). 읽기 전용(화면 이동만).
 * 실행: node t2-heights.mjs <단어 있는 계정 쿠키파일> <채팅 있는 계정 쿠키파일>   (BASE 기본 http://127.0.0.1:3063)
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire('/home/brownjeon/x.js')
const { chromium } = require('playwright-core')
const BASE = process.env.BASE ?? 'http://127.0.0.1:3063'
const [wordsCookie, chatCookie] = [process.argv[2], process.argv[3]].map((f) => readFileSync(f, 'utf8').trim())
const WIDTHS = [[360, 740], [390, 844], [412, 892]]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const dump = () => {
  const main = document.querySelector('main')
  const mr = main.getBoundingClientRect()
  const rect = (e) => { const r = e.getBoundingClientRect(); return [Math.round((r.top - mr.top + main.scrollTop) * 10) / 10, Math.round(r.height * 10) / 10] }
  const body = main.querySelector(':scope > div.px-4')
  const cls = (e) => (typeof e.className === 'string' ? e.className : '').split(/\s+/).filter(Boolean).slice(0, 2).join('.')
  const kids = [...body.children].filter((e) => getComputedStyle(e).display !== 'none').map((e) => ({ s: e.tagName.toLowerCase() + '.' + cls(e), rect: rect(e), tx: (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 24) }))
  const uls = [...main.querySelectorAll('ul')]
  const ul = uls[uls.length - 1]
  const lis = ul ? [...ul.querySelectorAll(':scope > li')].map((e) => rect(e)[1]) : []
  return { header: rect(main.querySelector('header')), kids, ul: ul ? rect(ul) : null, nUl: uls.length, lis, scrollH: main.scrollHeight, mainH: Math.round(mr.height) }
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
const out = {}
for (const [w, h] of WIDTHS) {
  for (const [name, cookie, path, ready] of [['words', wordsCookie, '/drawer/words', 'ul.divide-y li'], ['chat', chatCookie, '/study/ai?tab=chat', 'main ul li a']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
    await ctx.addCookies(cookie.split('; ').map((kv) => { const i = kv.indexOf('='); return { name: kv.slice(0, i), value: kv.slice(i + 1), url: BASE } }))
    const page = await ctx.newPage()
    await page.goto(BASE + path, { waitUntil: 'load' })
    await page.waitForSelector(ready, { timeout: 30000 }).catch(() => {})
    await sleep(1200)
    out[`${name}@${w}`] = await page.evaluate(dump)
    await ctx.close()
  }
}
await browser.close()
for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify({ ...v, lis: v.lis.slice(0, 6), nLis: v.lis.length }))
