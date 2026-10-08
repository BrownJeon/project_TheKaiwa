/**
 * task-046 T3 — 상한(1500ms) 시나리오: 오늘 탭의 요청 하나(기본 #58 `lessons/today`)를 일부러 늦춰 상한이 지난 뒤의 화면을 본다.
 * 기대: 상한 전엔 자리표시만 → 상한에 카드가 한 번에 보이고(늦은 카드는 몸통 자리표시, 전체 높이 = 실측 상수) → 늦은 응답이 오면 제자리에서 채워진다(위쪽 점프 0).
 * 또 하나: 요청이 실패(500)해도 나머지를 막지 않는지(DELAY_URL 을 `FAIL=1` 로).
 * 실행: node t3-cap.mjs <쿠키파일> [지연ms=2500]   (BASE 기본 http://127.0.0.1:3064, URL 기본 lessons/today, FAIL=1 이면 지연 뒤 500, WIDTH 기본 390)
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire('/home/brownjeon/x.js')
const { chromium } = require('playwright-core')
const BASE = process.env.BASE ?? 'http://127.0.0.1:3064'
const cookie = readFileSync(process.argv[2], 'utf8').trim()
const DELAY = Number(process.argv[3] ?? 2500)
const URL_PART = process.env.URL_PART ?? '/api/v1/lessons/today'
const FAIL = process.env.FAIL === '1'
const WIDTH = Number(process.env.WIDTH ?? 390)
const H = { 360: 740, 390: 844, 412: 892 }[WIDTH] ?? 844

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: H }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
await ctx.addCookies(cookie.split('; ').map((kv) => { const i = kv.indexOf('='); return { name: kv.slice(0, i), value: kv.slice(i + 1), url: BASE } }))
const page = await ctx.newPage()
await page.addInitScript(() => {
  window.addEventListener('load', () => { const st = document.createElement('style'); st.textContent = 'nextjs-portal{display:none!important}'; document.head.appendChild(st) })
  const visibleText = (root) => {
    const out = []
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement
      if (!el || el.closest('.sr-only')) continue
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const t = n.textContent.trim(); if (t) out.push(t)
    }
    return out.join(' ')
  }
  window.__sample = () => {
    const main = document.querySelector('main'); if (!main) return null
    const body = main.querySelector(':scope > div.px-4'); if (!body) return null
    const mr = main.getBoundingClientRect()
    const rect = (e) => { const r = e.getBoundingClientRect(); return [Math.round((r.top - mr.top + main.scrollTop) * 10) / 10, Math.round(r.height * 10) / 10] }
    const overlay = body.querySelector(':scope > div.absolute')
    let els
    if (overlay) els = [...overlay.querySelectorAll('section')]
    else { const wrap = [...body.children].find((e) => e.tagName === 'DIV' && !/absolute|fixed|sr-only|pointer-events/.test(e.className)); els = wrap ? [...wrap.children].filter((e) => getComputedStyle(e).display !== 'none' && !/fixed|sr-only|pointer-events/.test(e.className)) : [] }
    const vt = visibleText(main)
    return { p: location.pathname, sk: !!overlay, blocks: els.map(rect), load: /불러오는 중|불러오고 있/.test(vt), busy: main.querySelectorAll('[aria-busy=true]').length }
  }
})
await page.goto(`${BASE}/study/ai`, { waitUntil: 'networkidle' })
// 워밍업: 오늘 탭을 한 번 지나가 컴파일을 끝낸다(지연 없이)
await page.locator('nav[aria-label="주 메뉴"] a', { hasText: '오늘' }).first().tap()
await page.waitForTimeout(2500)
await page.locator('nav[aria-label="주 메뉴"] a', { hasText: '회화' }).first().tap()
await page.waitForTimeout(1500)
await page.route(`**${URL_PART}*`, async (route) => {
  await new Promise((r) => setTimeout(r, DELAY))
  if (FAIL) await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'x' }) })
  else await route.continue()
})
const states = []
await page.evaluate(() => { window.__t0 = null; window.__last = ''; window.__st = []; document.addEventListener('pointerdown', () => { if (window.__t0 === null) window.__t0 = performance.now() }, true); const tick = () => { const s = window.__sample(); if (window.__t0 !== null && s && s.p === '/study/today') { const sig = JSON.stringify([s.sk, s.blocks, s.load]); if (sig !== window.__last) { window.__last = sig; window.__st.push({ t: Math.round(performance.now() - window.__t0), ...s }) } } requestAnimationFrame(tick) }; tick() })
await page.locator('nav[aria-label="주 메뉴"] a', { hasText: '오늘' }).first().tap()
await page.waitForTimeout(DELAY + 2500)
const st = await page.evaluate(() => window.__st)
console.log(`지연 ${DELAY}ms ${FAIL ? '(500 응답)' : ''} 대상 ${URL_PART} 폭 ${WIDTH}`)
for (const s of st) console.log(`  ${String(s.t).padStart(5)}ms sk=${+s.sk} load=${+s.load} busy=${s.busy} blocks=${JSON.stringify(s.blocks)}`)
await browser.close()
