/**
 * task-046 T3 — 오늘·계획표 최종 안정 화면의 블록 높이(자리표시 상수의 근거). 읽기 전용(화면 이동만).
 * 실행: node t3-heights.mjs <라벨=쿠키파일> [<라벨=쿠키파일> …]   (BASE 기본 http://127.0.0.1:3064, ONLY="today"|"plan")
 * 출력: 라벨·폭·화면별로 `main > div.px-4` 의 직계 자식 [top, height] 과 한 단계 안쪽 자식 요약(첫 글자 24자).
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire('/home/brownjeon/x.js')
const { chromium } = require('playwright-core')
const BASE = process.env.BASE ?? 'http://127.0.0.1:3064'
const ONLY = process.env.ONLY ?? null
const accounts = process.argv.slice(2).map((a) => { const i = a.indexOf('='); return [a.slice(0, i), readFileSync(a.slice(i + 1), 'utf8').trim()] })
const WIDTHS = [[360, 740], [390, 844], [412, 892]]
const PAGES = [['today', '/study/today'], ['plan', '/plan']]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const dump = () => {
  const main = document.querySelector('main')
  const mr = main.getBoundingClientRect()
  const rect = (e) => { const r = e.getBoundingClientRect(); return [Math.round((r.top - mr.top + main.scrollTop) * 10) / 10, Math.round(r.height * 10) / 10] }
  const body = main.querySelector(':scope > div.px-4')
  const cls = (e) => (typeof e.className === 'string' ? e.className : '').split(/\s+/).filter(Boolean).slice(0, 2).join('.')
  const tx = (e) => (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 26)
  const visible = (e) => getComputedStyle(e).display !== 'none'
  const kids = [...body.children].filter(visible).map((e) => ({
    s: e.tagName.toLowerCase() + '.' + cls(e),
    rect: rect(e),
    tx: tx(e),
    in: [...e.children].filter(visible).slice(0, 12).map((c) => ({ s: c.tagName.toLowerCase() + '.' + cls(c), rect: rect(c), tx: tx(c).slice(0, 18) })),
  }))
  return { header: rect(main.querySelector('header')), body: rect(body), kids, scrollH: main.scrollHeight, mainH: Math.round(mr.height), busy: main.querySelectorAll('[aria-busy=true]').length }
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
for (const [label, cookie] of accounts) {
  for (const [w, h] of WIDTHS) {
    for (const [name, path] of PAGES) {
      if (ONLY && ONLY !== name) continue
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
      await ctx.addCookies(cookie.split('; ').map((kv) => { const i = kv.indexOf('='); return { name: kv.slice(0, i), value: kv.slice(i + 1), url: BASE } }))
      const page = await ctx.newPage()
      await page.goto(BASE + path, { waitUntil: 'load' })
      await page.waitForFunction(() => { const m = document.querySelector('main'); return m && !m.querySelector('[aria-busy=true]') && !/불러오는 중|불러오고 있/.test(m.innerText) }, null, { timeout: 30000 }).catch(() => {})
      await sleep(1500)
      const d = await page.evaluate(dump)
      console.log(`## ${label} ${name}@${w}  header=${JSON.stringify(d.header)} body=${JSON.stringify(d.body)} scrollH=${d.scrollH} mainH=${d.mainH} busy=${d.busy}`)
      for (const k of d.kids) {
        console.log(`  ${k.s} ${JSON.stringify(k.rect)} «${k.tx}»`)
        for (const c of k.in) console.log(`      ${c.s} ${JSON.stringify(c.rect)} «${c.tx}»`)
      }
      await ctx.close()
    }
  }
}
await browser.close()
