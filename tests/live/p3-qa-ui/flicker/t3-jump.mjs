/**
 * task-046 T3 — 오늘·계획표 탭 이동의 프레임 표본(rAF) 측정: 시각 상태 수 · 첫 화면 블록 위치 점프 · 마지막 블록 높이 변화 · CLS ·
 * 보이는 「불러오는 중」 프레임 · 자리표시 동안 눌리는 버튼(가짜 CTA) 프레임. 읽기 전용(화면 이동만, LLM 호출 없음).
 * `measure.mjs` 와 같은 조건(Chrome headless · DSF 2.625 · 왕복 150ms 스로틀)을 쓰되, 오늘 탭의 「겹친 자리표시」 구조를 블록으로 읽도록 따로 만들었다.
 *
 * 실행: node t3-jump.mjs <결과.json> <계정라벨=쿠키파일> [...]   (BASE 기본 http://127.0.0.1:3064, ONLY="라벨:390:slow,…" 로 부분 실행, REPEAT 기본 3)
 * 시퀀스(반복): 회화→오늘, 오늘→계획표, 계획표→오늘, 오늘→질문, 질문→계획표. 시작 전 5개 탭을 한 번씩 돌려 개발 서버 컴파일을 끝낸다(워밍업, 결과 버림).
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
const require = createRequire('/home/brownjeon/x.js')
const { chromium } = require('playwright-core')

const BASE = process.env.BASE ?? 'http://127.0.0.1:3064'
const OUT = process.argv[2]
const ACCOUNTS = Object.fromEntries(process.argv.slice(3).map((a) => { const i = a.indexOf('='); return [a.slice(0, i), readFileSync(a.slice(i + 1), 'utf8').trim()] }))
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null
const REPEAT = Number(process.env.REPEAT ?? 3)
const SIZES = [[390, 844], [360, 740], [412, 892]]
const NETS = ['none', 'slow']
const PATH = { 회화: '/study/ai', 오늘: '/study/today', 계획표: '/plan', 단어장: '/drawer/words', 질문: '/ask' }
const WARM = ['오늘', '계획표', '단어장', '질문', '회화']
const SEQ = []
for (let i = 0; i < REPEAT; i++) SEQ.push(['회화', '오늘'], ['오늘', '계획표'], ['계획표', '오늘'], ['오늘', '질문'], ['질문', '계획표'])

const initScript = () => {
  window.addEventListener('load', () => { const st = document.createElement('style'); st.textContent = 'nextjs-portal{display:none!important}'; document.head.appendChild(st) })
  const LOAD_RE = /불러오는 중|불러오고 있/
  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h }
  const visibleEl = (e) => { const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' }
  /** 보이는 글자(sr-only·visibility:hidden·display:none 제외) */
  const visibleText = (root) => {
    const out = []
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement
      if (!el || el.closest('.sr-only') || !visibleEl(el)) continue
      const t = n.textContent.trim()
      if (t) out.push(t)
    }
    return out.join(' ')
  }
  const blocksOf = (main, path) => {
    const body = main.querySelector(':scope > div.px-4')
    if (!body) return { blocks: [], skeleton: false, body: null }
    const mr = main.getBoundingClientRect()
    const rect = (e) => { const r = e.getBoundingClientRect(); return [Math.round((r.top - mr.top + main.scrollTop) * 10) / 10, Math.round(r.height * 10) / 10] }
    let els
    let skeleton = false
    if (path.startsWith('/study/today')) {
      const overlay = body.querySelector(':scope > div.absolute')
      skeleton = !!overlay || !!body.querySelector(':scope > [aria-busy=true]')
      if (overlay) els = [...overlay.querySelectorAll('section')]
      else if (body.querySelector(':scope > [aria-busy=true]')) els = [...body.querySelectorAll(':scope > [aria-busy=true] section')]
      else {
        // 변경 후: 본문 > (진짜 카드를 감싼 div) > 카드들 · 변경 전(기준선): 본문 > 카드들(div.scroll-mt-16 · section)
        const direct = body.querySelector(':scope > div.scroll-mt-16')
        const wrap = direct ? body : [...body.children].find((e) => e.tagName === 'DIV' && !/absolute|fixed|sr-only|pointer-events/.test(e.className))
        els = wrap ? [...wrap.children].filter((e) => visibleEl(e) && !/fixed|sr-only|pointer-events/.test(e.className) && /^(SECTION|A|DIV)$/.test(e.tagName)) : []
      }
    } else {
      els = [...body.children].filter((e) => visibleEl(e) && !/fixed|sr-only|pointer-events/.test(e.className) && (e.tagName === 'SECTION' || e.tagName === 'DIV'))
      skeleton = !!main.querySelector('[aria-busy=true]')
    }
    return { blocks: els.map(rect), skeleton, body: rect(body) }
  }
  const info = () => {
    const m = document.querySelector('main')
    const p = location.pathname
    if (!m) return { p, main: false }
    const b = blocksOf(m, p)
    const vt = visibleText(m)
    const header = m.querySelector('header h1')
    // 눌리는 버튼·링크: 앱바 밖, inert 밖, 보이는 것
    const ctas = [...m.querySelectorAll('button,a')].filter((e) => !e.closest('header') && !e.closest('[inert]') && visibleEl(e) && !e.closest('[aria-hidden=true]')).map((e) => (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 14)).filter(Boolean)
    return { p, main: true, title: header ? header.textContent.trim() : '', sh: m.scrollHeight, blocks: b.blocks, skeleton: b.skeleton, load: LOAD_RE.test(vt), th: hash(vt), ctas }
  }
  window.__start = (prefix) => {
    const rec = { down: null, states: [], last: '', lastChange: performance.now(), firstTarget: null, ls: [], raf: 0 }
    window.__rec = rec
    const onDown = () => { if (rec.down === null) rec.down = performance.now() }
    document.addEventListener('pointerdown', onDown, true)
    const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) rec.ls.push([performance.now(), e.value]) })
    po.observe({ type: 'layout-shift', buffered: false })
    const tick = () => {
      const now = performance.now(); const s = info()
      const sig = JSON.stringify([s.p, s.skeleton, s.blocks, s.load, s.th, s.main])
      if (sig !== rec.last) { rec.last = sig; rec.lastChange = now; rec.states.push({ t: now, ...s }) }
      if (rec.firstTarget === null && rec.down !== null && s.p.startsWith(prefix) && s.main && s.blocks.length) rec.firstTarget = { t: now, ...s }
      rec.raf = requestAnimationFrame(tick)
    }
    tick()
    window.__stop = () => { cancelAnimationFrame(rec.raf); po.disconnect(); document.removeEventListener('pointerdown', onDown, true); rec.final = info(); return rec }
  }
}

async function transition(page, label, from) {
  await page.evaluate((p) => window.__start(p), PATH[label])
  await page.locator('nav[aria-label="주 메뉴"] a', { hasText: label }).first().tap()
  await page.waitForFunction(() => { const r = window.__rec; const n = performance.now(); return r.down !== null && n - r.down > 600 && n - r.lastChange > 700 }, null, { timeout: 20000, polling: 100 }).catch(() => {})
  const r = await page.evaluate(() => window.__stop())
  const d = r.down ?? 0
  const post = r.states.filter((s) => s.t >= d).map((s) => ({ ...s, t: Math.round(s.t - d) }))
  return {
    label, from, stableAt: Math.round(r.lastChange - d),
    states: post.map((s) => ({ t: s.t, p: s.p, sk: s.skeleton, load: s.load, ctas: s.ctas, blocks: s.blocks, sh: s.sh })),
    first: r.firstTarget ? { t: Math.round(r.firstTarget.t - d), sk: r.firstTarget.skeleton, blocks: r.firstTarget.blocks, sh: r.firstTarget.sh } : null,
    final: { blocks: r.final.blocks, sh: r.final.sh, skeleton: r.final.skeleton },
    cls: Math.round(r.ls.reduce((a, [, v]) => a + v, 0) * 1000) / 1000,
  }
}

async function scenario(browser, cookie, [w, h], net) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  await ctx.addCookies(cookie.split('; ').map((kv) => { const i = kv.indexOf('='); return { name: kv.slice(0, i), value: kv.slice(i + 1), url: BASE } }))
  const page = await ctx.newPage()
  await page.addInitScript(initScript)
  const cdp = await ctx.newCDPSession(page)
  await page.goto(`${BASE}/study/ai`, { waitUntil: 'networkidle', timeout: 120000 })
  await page.waitForTimeout(1500)
  let cur = '회화'
  for (const l of WARM) { await transition(page, l, cur); cur = l }
  if (net === 'slow') await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
  const out = []
  for (const [from, to] of SEQ) {
    // 출발 탭으로 먼저 간다(스로틀 중이라 안정까지 기다린다) — 출발 화면이 이미 안정이면 이동 없음.
    if (cur !== from) { await transition(page, from, cur); cur = from }
    out.push(await transition(page, to, from)); cur = to
  }
  await ctx.close()
  return out
}

const results = { meta: { base: BASE, started: new Date().toISOString(), seq: SEQ.length }, runs: {} }
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
for (const [w, h] of SIZES) for (const net of NETS) for (const acct of Object.keys(ACCOUNTS)) {
  const key = `${acct}:${w}:${net}`
  if (ONLY && !ONLY.includes(key)) continue
  const t = Date.now()
  try { results.runs[key] = await scenario(browser, ACCOUNTS[acct], [w, h], net); console.log(`done ${key} ${Math.round((Date.now() - t) / 1000)}s`) } catch (e) { results.runs[key] = { error: String(e).slice(0, 400) }; console.log(`ERROR ${key} ${String(e).slice(0, 200)}`) }
  writeFileSync(OUT, JSON.stringify(results))
}
await browser.close()
console.log('ALL DONE')
