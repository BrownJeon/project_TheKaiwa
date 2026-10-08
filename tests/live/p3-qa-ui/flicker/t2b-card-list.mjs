/**
 * task-046 T2b — 회화·채팅 탭에서 「채택을 기다리는 교정」 카드와 목록이 따로 나타나는지 측정 (읽기 전용 화면 이동, LLM 없음).
 * 실행: node t2b-card-list.mjs <교정 카드가 있는 계정 쿠키> <교정이 없는 계정 쿠키> [결과.json]   (BASE 기본 http://127.0.0.1:3065)
 *   WIDTHS="360x740,390x844,412x892"  SCEN="none,card300,list300,card2000"  MODES="talk,chat,switch"
 *   mode talk   = /ask 에서 하단 탭 「회화」 를 눌러 이동(클라이언트 이동)
 *   mode chat   = /study/ai?tab=chat 으로 전체 로드(문서 시작부터 기록)
 *   mode switch = 회화 화면에서 「채팅」 분절을 눌러 전환(router.replace) — 카드·목록이 다시 마운트되는지/기다림이 되풀이되는지 본다
 * 시나리오: card300 = 교정 요청(#34)만 300ms 늦춤 · list300 = 목록 요청(#27)만 300ms 늦춤 · card2000 = 교정 요청 2000ms 늦춤(상한 1500ms 경로)
 * 프레임(requestAnimationFrame)마다 [자리표시(aria-busy) 유무, 교정 카드 유무, 실제 목록 유무, 목록 섹션 top] 이 바뀔 때만 기록한다.
 *   「중간 모양」 = 카드는 보이는데 목록은 아직 자리표시인 프레임(카드가 먼저) 또는 목록은 보이는데 카드가 아직 없다가 나중에 생기는 프레임(목록이 먼저).
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
const require = createRequire('/home/brownjeon/x.js')
const { chromium } = require('playwright-core')
const BASE = process.env.BASE ?? 'http://127.0.0.1:3065'
const [ckCard, ckNone] = [process.argv[2], process.argv[3]].map((f) => readFileSync(f, 'utf8').trim())
const OUT = process.argv[4]
const WIDTHS = (process.env.WIDTHS ?? '360x740,390x844,412x892').split(',').map((s) => s.split('x').map(Number))
const SCEN = (process.env.SCEN ?? 'none,card300,list300,card2000').split(',')
const MODES = (process.env.MODES ?? 'talk,chat,switch').split(',')
const DELAY = { none: [0, 0], card300: [300, 0], list300: [0, 300], card2000: [2000, 0] }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const recorder = () => {
  const CARD_RE = /채택을 기다리는 교정/
  window.__r = { on: false, t0: 0, rows: [], last: '', n: 0, raf: 0 }
  const sample = () => {
    const main = document.querySelector('main')
    if (!main || !location.pathname.startsWith('/study/ai')) return null  // 이동 전 화면(/ask)의 상태는 센 값에서 뺀다
    const mr = main.getBoundingClientRect()
    const top = (e) => (e ? Math.round((e.getBoundingClientRect().top - mr.top + main.scrollTop) * 10) / 10 : null)
    const secs = [...main.querySelectorAll('section')]
    const card = secs.find((s) => CARD_RE.test(s.textContent ?? '')) ?? null
    const list = secs.filter((s) => s !== card).pop() ?? null
    const skel = main.querySelector('[aria-busy="true"]')
    const empty = list && list.querySelector('.border-dashed')
    const rows = list && !skel ? list.querySelector('ul > li') : null
    const real = !skel && !!list && !!(empty || rows)
    const first = skel ? skel.firstElementChild?.nextElementSibling : empty ?? rows
    return { skel: !!skel, card: !!card, real, secTop: top(list), rowTop: top(first), cardTop: top(card), cardH: card ? Math.round(card.getBoundingClientRect().height * 10) / 10 : null }
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
    r.raf = requestAnimationFrame(tick)
  }
  window.__start = () => { const r = window.__r; r.on = true; r.t0 = performance.now(); r.rows = []; r.last = ''; r.raf = requestAnimationFrame(tick) }
  window.__stop = () => { const r = window.__r; r.on = false; cancelAnimationFrame(r.raf); return r.rows }
}

function summarize(rows) {
  const frames = rows.reduce((a, r) => a + r.n, 0)
  const cardEver = rows.some((r) => r.card)
  // 카드가 보이는 프레임에서 목록이 자리표시이면 「카드가 먼저」, 카드가 아직 없는데 실제 목록이 보이고 나중에 카드가 생기면 「목록이 먼저」.
  let cardFirst = 0
  let listFirst = 0
  const firstCard = rows.findIndex((r) => r.card)
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (r.card && r.skel) cardFirst += r.n
    if (r.real && !r.card && cardEver && firstCard > i) listFirst += r.n
  }
  const moves = []
  let prev = null
  for (const r of rows) {
    if (r.secTop === null) continue
    if (prev !== null && Math.abs(r.secTop - prev) > 0.5) moves.push(Math.round((r.secTop - prev) * 10) / 10)
    prev = r.secTop
  }
  const last = rows[rows.length - 1]
  const seq = rows.filter((r) => r.secTop !== null).map((r) => `${r.skel ? 'S' : '-'}${r.card ? 'C' : '-'}${r.real ? 'L' : '-'}@${r.secTop}(${r.t}ms,${r.n}f)`)
  return { frames, cardFirst, listFirst, moves, final: last ? { card: last.card, real: last.real, secTop: last.secTop, rowTop: last.rowTop, cardH: last.cardH } : null, seq }
}

async function run(browser, cookie, [w, h], scen, mode) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const i = cookie.indexOf('=')
  await ctx.addCookies([{ name: cookie.slice(0, i), value: cookie.slice(i + 1), url: BASE }])
  const page = await ctx.newPage()
  await page.addInitScript(recorder)
  await page.addInitScript(() => window.addEventListener('load', () => { const st = document.createElement('style'); st.textContent = 'nextjs-portal{display:none!important}'; document.head.appendChild(st) }))
  const [dCard, dList] = DELAY[scen]
  await page.route((u) => u.pathname === '/api/v1/corrections', async (route) => { if (dCard) await sleep(dCard); await route.continue() })
  await page.route((u) => u.pathname === '/api/v1/chats', async (route) => { if (dList) await sleep(dList); await route.continue() })
  const settleMs = Math.max(dCard, dList) + 1800
  const stable = async (ms) => {
    await page.waitForFunction((x) => { const r = window.__r; const n = performance.now(); return n - r.t0 > x }, ms, { timeout: 30000, polling: 100 }).catch(() => {})
  }
  let rows
  if (mode === 'chat') {
    await page.goto(`${BASE}/study/ai?tab=chat`, { waitUntil: 'commit' })
    await page.evaluate(() => window.__start())
    await stable(settleMs)
    rows = await page.evaluate(() => window.__stop())
  } else {
    await page.goto(`${BASE}/ask`, { waitUntil: 'load' })
    await sleep(1200)
    if (mode === 'talk') {
      await page.evaluate(() => window.__start())
      await page.locator('nav[aria-label="주 메뉴"] a', { hasText: '회화' }).first().tap()
      await stable(settleMs)
      rows = await page.evaluate(() => window.__stop())
    } else {
      // switch: 회화로 들어가 안정된 뒤 「채팅」 분절만 기록한다.
      await page.locator('nav[aria-label="주 메뉴"] a', { hasText: '회화' }).first().tap()
      await page.waitForSelector('[role=radio]', { timeout: 20000 })
      await sleep(settleMs + 600)
      await page.evaluate(() => window.__start())
      await page.locator('[role=radio]', { hasText: '채팅' }).first().tap()
      await stable(1500)
      rows = await page.evaluate(() => window.__stop())
    }
  }
  await ctx.close()
  return { rows, ...summarize(rows) }
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
// 워밍업(개발 서버 컴파일): 결과는 버린다.
await run(browser, ckCard, [390, 844], 'none', 'talk')
await run(browser, ckCard, [390, 844], 'none', 'chat')
const out = {}
for (const [w, h] of WIDTHS) for (const [acct, ck] of [['card', ckCard], ['none', ckNone]]) for (const mode of MODES) for (const scen of SCEN) {
  const key = `${w}|${acct}|${mode}|${scen}`
  try {
    const r = await run(browser, ck, [w, h], scen, mode)
    out[key] = r
    const { rows, seq, ...rest } = r
    console.log(key, JSON.stringify(rest), seq.slice(0, 8).join(' > '))
  } catch (e) {
    out[key] = { error: String(e).slice(0, 300) }
    console.log(key, 'ERROR', String(e).slice(0, 200))
  }
}
await browser.close()
if (OUT) writeFileSync(OUT, JSON.stringify(out))
console.log('ALL DONE')
