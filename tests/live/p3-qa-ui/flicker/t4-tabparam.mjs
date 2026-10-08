/**
 * task-046 REV-171 M-1 — /study/ai?tab=… 로 **새로 들어올 때** 로딩 자리표시가 같은 탭 모양인지 잰다 (읽기 전용 화면 이동, LLM 없음, 데이터 쓰기 없음).
 * 실행: node t4-tabparam.mjs <쿠키파일> [결과.json]   (BASE 기본 http://127.0.0.1:3067)
 *   TABS="chat,scenario,talk,none,bogus"  WIDTHS="360x740,390x844,412x892"  KBPS=300 (내려받기 속도 — 낮추면 서버 loading.tsx 자리표시가 먼저 그려지는 구간이 길어진다)
 * 이동 방식: /ask 를 연 뒤 클라이언트 라우터(window.next.router.push)로 /study/ai?tab=… 로 이동한다(채팅방 뒤로가기·채팅 삭제 뒤와 같은 클라이언트 이동).
 * 네트워크: 왕복 150ms · 내려받기 KBPS kbps.
 * 프레임(requestAnimationFrame)마다 [선택된 탭 · [새로 만들기] 버튼 문구 · 섹션 머리 · 서버 loading 자리표시(`[inert]` 가 있는 구간) 유무 · 탭줄 top · 목록 첫 줄 top] 을 적고, 바뀔 때만 남긴다.
 *   서버 loading 자리표시는 탭줄 묶음이 `inert` 인 것으로 알아본다(진짜 화면에는 없다) — 목록 자리표시(`aria-busy`)는 진짜 화면의 `ChatList` 도 그리므로 구분 기준이 아니다.
 *   「바뀐 프레임」 = 서버 자리표시 구간에서 다음 상태로 넘어갈 때 선택 탭·버튼 문구·섹션 머리 중 하나가 달라진 횟수(버튼이 없다가 새로 붙는 것은 별도 `added`).
 *   목록 첫 줄 top 변화(`rowDelta`)에는 「채택을 기다리는 교정」 카드가 있는 계정이면 그 카드가 위에 끼는 높이가 섞인다(자리표시는 있을 때만 생기는 섹션을 그리지 않는 것이 의도).
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
const require = createRequire('/home/brownjeon/x.js')
const { chromium } = require('playwright-core')
const BASE = process.env.BASE ?? 'http://127.0.0.1:3067'
const cookie = readFileSync(process.argv[2], 'utf8').trim()
const OUT = process.argv[3]
const KBPS = Number(process.env.KBPS ?? 300)
const WIDTHS = (process.env.WIDTHS ?? '360x740,390x844,412x892').split(',').map((s) => s.split('x').map(Number))
const TABS = (process.env.TABS ?? 'chat,scenario,talk,none,bogus').split(',')
const URL_OF = { chat: '/study/ai?tab=chat', scenario: '/study/ai?tab=scenario', talk: '/study/ai?tab=talk', none: '/study/ai', bogus: '/study/ai?tab=zzz' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const recorder = () => {
  window.__r = { on: false, t0: 0, rows: [], last: '' }
  const sample = () => {
    if (location.pathname !== '/study/ai') return null
    const main = document.querySelector('main')
    if (!main) return null
    const mr = main.getBoundingClientRect()
    const top = (e) => (e ? Math.round((e.getBoundingClientRect().top - mr.top + main.scrollTop) * 10) / 10 : null)
    const sel = main.querySelector('[role="radio"][aria-checked="true"]')?.textContent ?? null
    const btn = [...main.querySelectorAll('button')].find((b) => /＋/.test(b.textContent ?? '') && b.className.includes('w-full'))?.textContent ?? null
    const sec = [...main.querySelectorAll('h3')].map((h) => h.textContent).join('|')
    const skelEl = main.querySelector('[aria-busy="true"]')
    const lastSec = [...main.querySelectorAll('section')].pop() ?? null
    const rowEl = skelEl && lastSec ? lastSec.querySelector('[aria-busy="true"] span.block') : lastSec ? lastSec.querySelector('ul > li, .border-dashed') : null
    return { sel, btn, sec, srv: !!main.querySelector('[inert]'), skel: !!skelEl, seg: top(main.querySelector('[role="radiogroup"]')), row: top(rowEl) }
  }
  const tick = () => {
    const r = window.__r
    if (!r.on) return
    const s = sample()
    if (s) {
      const sig = JSON.stringify(s)
      if (sig === r.last) r.rows[r.rows.length - 1].n++
      else { r.rows.push({ t: Math.round(performance.now() - r.t0), ...s, n: 1 }); r.last = sig }
    }
    requestAnimationFrame(tick)
  }
  window.__start = () => { window.__r.on = true; window.__r.t0 = performance.now(); window.__r.rows = []; window.__r.last = ''; requestAnimationFrame(tick) }
  window.__stop = () => { window.__r.on = false; return window.__r.rows }
}

const summarize = (rows) => {
  const skel = rows.filter((r) => r.srv)
  const real = rows.filter((r) => !r.srv)
  const keyOf = (r) => `${r.sel}|${r.btn}|${(r.sec ?? '').replace('채택을 기다리는 교정|', '')}` // 교정 카드 머리가 끼는 것은 탭 모양이 바뀐 것이 아니다
  let changed = 0, added = 0
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i]
    if (keyOf(a) === keyOf(b)) continue
    if (a.btn === null && b.btn !== null && a.sel === b.sel) added++
    else changed++
  }
  const lastSkel = skel[skel.length - 1] ?? null
  const final = real[real.length - 1] ?? null
  return {
    srvFrames: skel.reduce((a, r) => a + r.n, 0),
    skel: lastSkel ? { sel: lastSkel.sel, btn: lastSkel.btn, sec: lastSkel.sec, seg: lastSkel.seg, row: lastSkel.row } : null,
    final: final ? { sel: final.sel, btn: final.btn, sec: final.sec, seg: final.seg, row: final.row } : null,
    changedFrames: changed,
    added,
    rowDelta: lastSkel && final && lastSkel.row !== null && final.row !== null ? Math.round((final.row - lastSkel.row) * 10) / 10 : null,
    segDelta: lastSkel && final && lastSkel.seg !== null && final.seg !== null ? Math.round((final.seg - lastSkel.seg) * 10) / 10 : null,
    distinctStates: rows.length,
  }
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
const out = {}
for (const [w, h] of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  await ctx.addCookies(cookie.split('; ').map((kv) => { const i = kv.indexOf('='); return { name: kv.slice(0, i), value: kv.slice(i + 1), url: BASE } }))
  const page = await ctx.newPage()
  await page.addInitScript(recorder)
  // 각 경로를 한 번씩 열어 개발 서버가 컴파일해 둔다(측정에 컴파일 시간이 섞이지 않게).
  for (const p of ['/ask', ...new Set(Object.values(URL_OF))]) { await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 120000 }); await sleep(500) }
  const cdp = await ctx.newCDPSession(page)
  for (const tab of TABS) {
    await page.goto(BASE + '/ask', { waitUntil: 'networkidle', timeout: 120000 })
    await sleep(800)
    const hasRouter = await page.evaluate(() => !!(window.next && window.next.router && window.next.router.push))
    if (!hasRouter) { out[`${tab}@${w}`] = { error: 'window.next.router 없음' }; continue }
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (KBPS * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
    await page.evaluate((u) => { window.__start(); window.next.router.push(u) }, URL_OF[tab])
    await page.waitForFunction(() => location.pathname === '/study/ai', null, { timeout: 30000 }).catch(() => {})
    await sleep(4500)
    const rows = await page.evaluate(() => window.__stop())
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
    out[`${tab}@${w}`] = { ...summarize(rows), rows: rows.slice(0, 12) }
  }
  await ctx.close()
}
await browser.close()
if (OUT) writeFileSync(OUT, JSON.stringify(out))
for (const [k, v] of Object.entries(out)) {
  const rest = { ...v }
  delete rest.rows
  console.log(k, JSON.stringify(rest))
}
