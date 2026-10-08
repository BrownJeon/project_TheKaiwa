/**
 * task-046 T2 — 탭 누름 즉시 반응·loading.tsx 적용 범위 확인 (읽기 전용 화면 이동, LLM 없음).
 * 실행: node t2-press.mjs <쿠키A 파일> <채팅이 있는 계정 쿠키 파일>   (BASE 기본 http://127.0.0.1:3063, 왕복 150ms 스로틀)
 * 프레임마다 [경로, 눌린 탭(data-pending), aria-current 탭, 켜진 모양(text-accent) 탭, aria-busy 자리표시 유무, 앱바 제목, 보이는 「불러오는 중」, 선택된 라디오] 가 바뀔 때만 기록한다.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire('/home/brownjeon/x.js')
const { chromium } = require('playwright-core')
const BASE = process.env.BASE ?? 'http://127.0.0.1:3063'
const [cA, cB] = [process.argv[2], process.argv[3]].map((f) => readFileSync(f, 'utf8').trim())
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const install = () => {
  if (window.__stop) window.__stop.v = true
  const stop = (window.__stop = { v: false })
  window.__rec = []
  const t0 = performance.now()
  let last = ''
  const tick = () => {
    if (stop.v) return
    const m = document.querySelector('main')
    const nav = document.querySelector('nav[aria-label="주 메뉴"]')
    const links = nav ? [...nav.querySelectorAll('a')] : []
    const txt = (a) => (a ? a.textContent.trim() : '')
    const vis = m ? [...m.querySelectorAll('*')].some((e) => !e.closest('.sr-only') && e.children.length === 0 && /불러오는 중/.test(e.textContent)) : false
    const s = JSON.stringify([location.pathname + location.search, txt(links.find((a) => a.dataset.pending === 'true')), txt(links.find((a) => a.getAttribute('aria-current') === 'page')), links.filter((a) => /text-accent/.test(a.className)).map(txt).join(','), !!m?.querySelector('[aria-busy=true]'), m?.querySelector('header h1')?.textContent ?? '', vis, txt(m?.querySelector('[role=radio][aria-checked=true]')), !!nav])
    if (s !== last) { window.__rec.push([Math.round(performance.now() - t0), ...JSON.parse(s)]); last = s }
    requestAnimationFrame(tick)
  }
  tick()
  window.__t0 = t0
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
async function open(cookie, path) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  await ctx.addCookies(cookie.split('; ').map((kv) => { const i = kv.indexOf('='); return { name: kv.slice(0, i), value: kv.slice(i + 1), url: BASE } }))
  const page = await ctx.newPage()
  await page.addInitScript(() => window.addEventListener('load', () => { const st = document.createElement('style'); st.textContent = 'nextjs-portal{display:none!important}'; document.head.appendChild(st) }))
  await page.goto(BASE + path, { waitUntil: 'load' })
  await sleep(1500)
  return { ctx, page }
}
async function slow(page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
}
async function tap(page, locator, label) {
  await page.evaluate(install)
  await sleep(100)
  const box = await locator.boundingBox()
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
  await sleep(2200)
  const rec = await page.evaluate(() => window.__rec)
  console.log(`\n## ${label}  [t_ms, path, pending, current, on, busy, title, visibleLoadingText, radio, nav]`)
  for (const r of rec) console.log(JSON.stringify(r))
}
const tabLink = (page, name) => page.locator('nav[aria-label="주 메뉴"] a', { hasText: name })

// 워밍업(개발 서버 컴파일): 모든 탭 한 번씩
{
  const { ctx, page } = await open(cA, '/study/ai')
  for (const p of ['/study/today', '/plan', '/drawer/words', '/ask', '/study/ai', '/study/ai?tab=chat', '/study/ai?tab=scenario']) { await page.goto(BASE + p, { waitUntil: 'load' }); await sleep(900) }
  await ctx.close()
}
{
  const { ctx, page } = await open(cA, '/study/ai')
  await slow(page)
  for (let i = 0; i < (process.env.REPEAT ? 3 : 1); i++) {
  await tap(page, tabLink(page, '단어장'), `S1 회화 -> 단어장 탭 (왕복 150ms) #${i}`)
  await sleep(500)
  await tap(page, tabLink(page, '회화'), `S1b 단어장 -> 회화 탭 #${i}`)
  }
  await sleep(500)
  await tap(page, tabLink(page, '회화'), 'S1c 이미 활성인 회화 탭 다시 누름')
  await tap(page, page.getByRole('radio', { name: '채팅' }), 'S2 회화 홈에서 분절 [채팅] (router.replace ?tab=chat)')
  await ctx.close()
}
{
  const { ctx, page } = await open(cB, '/study/ai?tab=chat')
  await slow(page)
  await tap(page, page.locator('main ul li a').last(), 'S3 채팅 목록 -> 채팅방 (loading.tsx 가 하위 경로에 새지 않는지)')
  await ctx.close()
}
await browser.close()
