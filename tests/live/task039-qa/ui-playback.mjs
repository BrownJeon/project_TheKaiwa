// task-039 QA — 회화방에서 [▶ 다시 듣기] 재생 중 추가 설명 줄을 펼쳐도 재생(Web Audio — ttsAudio.playWav)이 끊기지 않는지.
// AudioBufferSourceNode 마다 start/stop/ended 를 따로 기록한다(첫 클릭의 무음 해제 노드와 실제 재생 노드를 구분: 가장 긴 buffer = 실제 재생).
// 소리 자체(스피커)는 들을 수 없다 — 실제 재생 노드가 stop() 없이 자연 종료까지 가는지, 펼침 클릭이 그 사이에 있었는지만 본다.
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
const a = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, all) => (x.startsWith('--') ? [...acc, [x.slice(2), all[i + 1]]] : acc), []))
const BASE = a.base
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE) || /:3010$/.test(BASE)) throw new Error('dev localhost 만')
const cookie = readFileSync(a.cookie, 'utf8').trim()
const [cname, ...cr] = cookie.split('=')
const prep = JSON.parse(readFileSync(a.prep, 'utf8'))
const TK = { short: prep.talk.corrIds[1] }
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] })
let ok = true
try {
  for (const w of (process.env.ORDER ?? '360,390,412').split(',').map(Number)) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 892 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
    await ctx.addCookies([{ name: cname, value: cr.join('='), url: BASE }])
    await ctx.addInitScript(() => {
      window.__nodes = []
      const S = AudioBufferSourceNode.prototype
      const st = S.start, sp = S.stop
      S.start = function (...args) { const n = { dur: this.buffer?.duration ?? 0, t0: performance.now(), stops: 0, tEnd: 0, ended: false }; window.__nodes.push(n); this.__n = n; this.addEventListener('ended', () => { n.ended = true; n.tEnd = performance.now() }); return st.apply(this, args) }
      S.stop = function (...args) { if (this.__n) this.__n.stops++; return sp.apply(this, args) }
    })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/study/ai/talk/${prep.talk.chatId}`, { waitUntil: 'load' })
    await page.waitForSelector(`#cr_${TK.short}`, { timeout: 25000 })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(1200)
    const rb = page.locator('button[aria-label*="다시 듣기"]').last()
    await rb.scrollIntoViewIfNeeded()
    await rb.click()
    let real = false
    for (let k = 0; k < 50 && !real; k++) {
      await page.waitForTimeout(100)
      real = await page.evaluate(() => window.__nodes.some((n) => n.dur > 1))
    }
    if (!real) { console.log(`FAIL  ${w}: 실제 재생 노드(1초 이상)가 시작되지 않음`); ok = false; await ctx.close(); continue }
    const btn = page.locator(`#cr_${TK.short} button[aria-controls$="_xn"]`)
    if (!process.env.NOEXPAND) await btn.scrollIntoViewIfNeeded()
    const tClick = await page.evaluate(() => performance.now())
    if (!process.env.NOEXPAND) await btn.click()
    await page.waitForTimeout(150)
    const mid = await page.evaluate(() => ({ nodes: window.__nodes.map((n) => ({ ...n })), exp: document.querySelector('button[aria-controls$="_xn"][aria-expanded="true"]') !== null }))
    // 재생 큐(청크 여러 개)가 끝날 때까지: 모든 노드 ended 이고 마지막 시작 뒤 1.2초 조용할 때(최대 15초)
    for (let k = 0; k < 100; k++) {
      const quiet = await page.evaluate(() => window.__nodes.length > 0 && window.__nodes.every((n) => n.ended) && performance.now() - Math.max(...window.__nodes.map((n) => n.t0)) > 1200)
      if (quiet) break
      await page.waitForTimeout(150)
    }
    const end = await page.evaluate(() => window.__nodes.map((n) => ({ ...n })))
    const midNode = mid.nodes[0]
    const totalStops = end.reduce((x, n) => x + n.stops, 0)
    const lastEnd = Math.max(...end.map((n) => n.tEnd))
    const good = (process.env.NOEXPAND ? true : mid.exp) && !midNode.ended && totalStops === 0 && end.every((n) => n.ended) && lastEnd > tClick
    console.log(`${good ? 'PASS' : 'FAIL'}  ${w}×892 재생 중 펼침: 재생 큐 노드 ${end.length}개(${end.map((n) => n.dur.toFixed(2) + 's').join('+')}) · 펼침 클릭은 첫 노드 시작 ${Math.round(tClick - midNode.t0)}ms 뒤·첫 노드 종료 전(ended=${midNode.ended}) · 펼침 ${mid.exp} · stop() 합계 ${totalStops}회 · 전부 자연 종료 ${end.every((n) => n.ended)}`)
    console.log('   nodes(click 기준 ms):', JSON.stringify(end.map((n) => ({ dur: +n.dur.toFixed(2), start: Math.round(n.t0 - tClick), end: n.ended ? Math.round(n.tEnd - tClick) : null, stops: n.stops }))), 'mid:', JSON.stringify(mid.nodes.map((n) => ({ dur: +n.dur.toFixed(2), start: Math.round(n.t0 - tClick), ended: n.ended }))))
    if (!good) ok = false
    await ctx.close()
  }
} finally { await browser.close() }
process.exitCode = ok ? 0 : 1
