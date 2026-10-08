/**
 * task-046 QA 기준선 — 하단 탭 이동 시 시각 상태 순서·점프·블록 높이·누름 반응 지연 측정 (LLM 호출 없음, 읽기 전용 화면 이동).
 * 원본: scratchpad flicker.mjs (프레임별 상태 서명). 이 파일은 그 방식을 확장했다(CLS hadRecentInput 포함 합산, 블록 트리 덤프,
 * pointerdown→활성 탭/주소/내용 변화 시각, 네트워크 구간).
 *
 * 실행: node measure.mjs <결과.json> <쿠키1파일> <쿠키2파일>   (BASE 기본 http://127.0.0.1:3062, ONLY="1:390:none,2:390:slow" 로 부분 실행)
 * 조건: Chrome(/usr/bin/google-chrome) headless, DSF 2.625, isMobile+hasTouch, ko-KR, Asia/Seoul. slow = 왕복 150ms·1.6Mbps(다운)/750kbps(업).
 *       시작 전 같은 5개 탭을 스로틀 없이 한 번씩 돌려 개발 서버 컴파일을 끝낸다(워밍업) — 그 결과는 버린다.
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
const require = createRequire('/home/brownjeon/x.js')
const { chromium } = require('playwright-core')

const BASE = process.env.BASE ?? 'http://127.0.0.1:3062'
const OUT = process.argv[2]
const COOKIE_FILES = { 1: process.argv[3], 2: process.argv[4] }
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null
const SIZES = [[390, 844], [360, 740], [412, 892]]
const NETS = ['none', 'slow']
const TABS = { 회화: '/study/ai', 오늘: '/study/today', 계획표: '/plan', 단어장: '/drawer', 질문: '/ask' }
const WARM = ['오늘', '계획표', '단어장', '질문', '회화']
const SEQ = ['오늘', '계획표', '단어장', '질문', '회화', '단어장', '오늘', '회화', '계획표', '오늘']

const initScript = () => {
  // Next 개발 서버의 하단 왼쪽 개발 표시(nextjs-portal)가 맨 왼쪽 탭(회화)을 가려 탭이 막힌다 — 측정 도구에서만 숨긴다(앱 코드 무관).
  window.addEventListener('load', () => { const st = document.createElement('style'); st.textContent = 'nextjs-portal{display:none!important}'; document.head.appendChild(st) })
  const LOAD_RE = /불러오는 중|불러오고 있|준비하는 중|찾는 중/
  const EMPTY_RE = /비어 있|없어요|없습니다|아직 .{0,12}(않|없)/
  const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h }
  const activeLabel = () => { const a = document.querySelector('nav[aria-label="주 메뉴"] a[aria-current=page]'); return a ? a.textContent.trim() : '' }
  const info = () => {
    const m = document.querySelector('main')
    const base = { p: location.pathname, a: activeLabel(), tb: !!document.querySelector('nav[aria-label="주 메뉴"]') }
    if (!m) return { ...base, main: false, h: 0, kids: 0, th: 0, L: false, S: false, B: false, E: [], C: [] }
    const txt = m.innerText
    const E = txt.split('\n').filter((l) => EMPTY_RE.test(l)).slice(0, 3).map((l) => l.trim().slice(0, 26))
    const C = [...m.querySelectorAll('button,a')].map((e) => (e.innerText || '').trim().replace(/\s+/g, ' ')).filter((x) => x && x.length <= 22).slice(0, 8)
    return { ...base, main: true, h: m.scrollHeight, kids: m.childElementCount, th: hash(txt), L: LOAD_RE.test(txt), S: !!m.querySelector('.animate-pulse'), B: !!m.querySelector('[aria-busy=true]'), E, C }
  }
  const dump = (root, maxDepth) => {
    const mr = root.getBoundingClientRect(); const sc = root.scrollTop
    const cls = (e) => (typeof e.className === 'string' ? e.className : '').split(/\s+/).filter(Boolean).slice(0, 3).join('.')
    const walk = (e, d) => {
      const r = e.getBoundingClientRect()
      const n = { s: e.tagName.toLowerCase() + (cls(e) ? '.' + cls(e) : ''), top: Math.round((r.top - mr.top + sc) * 10) / 10, h: Math.round(r.height * 10) / 10, w: Math.round(r.width) }
      if (!e.children.length) n.tx = (e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 18)
      else if (d < maxDepth) {
        const kids = []
        for (const c of e.children) {
          const cs = getComputedStyle(c); const cr = c.getBoundingClientRect()
          if (cs.display === 'none' || cs.position === 'fixed' || (cr.height === 0 && cr.width === 0)) continue
          kids.push(walk(c, d + 1))
        }
        const out = []
        for (const k of kids) {
          const p = out[out.length - 1]
          if (p && p.s === k.s && !!p.k === !!k.k) { p.n = (p.n || 1) + 1; p.hmin = Math.min(p.hmin ?? p.h, k.h); p.hmax = Math.max(p.hmax ?? p.h, k.h) } else out.push(k)
        }
        n.k = out
      }
      return n
    }
    return walk(root, 0)
  }
  window.__dump = () => { const m = document.querySelector('main'); return m ? dump(m, 5) : null }
  window.__start = (prefix, label) => {
    const rec = { down: null, downEpoch: null, states: [], last: '', lastChange: performance.now(), tAct: null, tPath: null, firstTarget: null, ls: [], raf: 0 }
    window.__rec = rec
    const onDown = () => { if (rec.down === null) { rec.down = performance.now(); rec.downEpoch = Date.now() } }
    document.addEventListener('pointerdown', onDown, true)
    const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) rec.ls.push([performance.now(), e.value, e.hadRecentInput]) })
    po.observe({ type: 'layout-shift', buffered: false })
    const tick = () => {
      const now = performance.now(); const s = info()
      const raw = JSON.stringify(s)
      if (raw !== rec.last) { rec.last = raw; rec.lastChange = now; rec.states.push({ t: now, ...s }) }
      if (rec.down !== null && rec.tAct === null && s.a === label) rec.tAct = now
      if (rec.down !== null && rec.tPath === null && s.p.startsWith(prefix)) rec.tPath = now
      if (rec.firstTarget === null && rec.down !== null && s.p.startsWith(prefix) && s.main) rec.firstTarget = { t: now, h: s.h, dump: window.__dump() }
      rec.raf = requestAnimationFrame(tick)
    }
    tick()
    window.__stop = () => {
      cancelAnimationFrame(rec.raf); po.disconnect(); document.removeEventListener('pointerdown', onDown, true)
      const s = info(); rec.final = { ...s, dump: window.__dump() }
      return rec
    }
  }
}

function cookieOf(file) { const [name, ...rest] = readFileSync(file, 'utf8').trim().split('='); return { name, value: rest.join('=') } }

async function transition(page, net, label, from, warm) {
  const map = new Map()
  const onReq = (r) => { const u = new URL(r.url()); const k = u.pathname.startsWith('/api/') ? 'api' : u.searchParams.has('_rsc') ? 'rsc' : u.pathname.startsWith('/_next/') ? 'next' : null; if (k) map.set(r, { k, u: u.pathname, m: r.method(), t0: Date.now(), t1: null }) }
  const onFin = (r) => { const o = map.get(r); if (o) o.t1 = Date.now() }
  page.on('request', onReq); page.on('requestfinished', onFin)
  await page.evaluate(([p, l]) => window.__start(p, l), [TABS[label], label])
  await page.locator('nav[aria-label="주 메뉴"] a', { hasText: label }).first().tap()
  await page.waitForFunction(() => { const r = window.__rec; const n = performance.now(); return r.down !== null && n - r.down > 600 && n - r.lastChange > (window.__stableMs || 700) }, null, { timeout: warm ? 45000 : 15000, polling: 100 }).catch(() => {})
  const r = await page.evaluate(() => window.__stop())
  page.off('request', onReq); page.off('requestfinished', onFin)
  const d = r.down ?? 0; const de = r.downEpoch ?? 0
  const rel = (t) => (t === null ? null : Math.round(t - d))
  return {
    label, from,
    states: r.states.map((s) => ({ ...s, t: Math.round(s.t - d) })),
    tAct: rel(r.tAct), tPath: rel(r.tPath), firstChangeAfterDown: (() => { const x = r.states.find((s) => s.t > d); return x ? Math.round(x.t - d) : null })(),
    stableAt: Math.round(r.lastChange - d),
    clsAll: Math.round(r.ls.reduce((a, [, v]) => a + v, 0) * 1000) / 1000,
    clsNoRecent: Math.round(r.ls.filter(([, , ri]) => !ri).reduce((a, [, v]) => a + v, 0) * 1000) / 1000,
    shifts: r.ls.map(([t, v, ri]) => [Math.round(t - d), Math.round(v * 1000) / 1000, ri]),
    firstTarget: r.firstTarget ? { t: rel(r.firstTarget.t), h: r.firstTarget.h, dump: r.firstTarget.dump } : null,
    final: r.final,
    net: [...map.values()].map((o) => ({ k: o.k, u: o.u, m: o.m, s: o.t0 - de, e: o.t1 === null ? null : o.t1 - de })),
    warm: !!warm,
  }
}

async function scenario(browser, acct, [w, h], net) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const ck = cookieOf(COOKIE_FILES[acct])
  await ctx.addCookies([{ name: ck.name, value: ck.value, url: BASE }])
  const page = await ctx.newPage()
  await page.addInitScript(initScript)
  const cdp = await ctx.newCDPSession(page)
  await page.goto(`${BASE}/study/ai`, { waitUntil: 'networkidle', timeout: 120000 })
  await page.waitForTimeout(1500)
  let cur = '회화'
  for (const l of WARM) { await transition(page, 'none', l, cur, true); cur = l }
  if (net === 'slow') await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
  const out = []
  for (const l of SEQ) { out.push(await transition(page, net, l, cur, false)); cur = l }
  const ua = await page.evaluate(() => navigator.userAgent)
  await ctx.close()
  return { ua, transitions: out }
}

const results = { meta: { base: BASE, started: new Date().toISOString(), seq: SEQ }, runs: {} }
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
results.meta.browser = browser.version()
for (const [w, h] of SIZES) for (const net of NETS) for (const acct of [1, 2]) {
  const key = `${acct}:${w}:${net}`
  if (ONLY && !ONLY.includes(key)) continue
  const t = Date.now()
  try { results.runs[key] = await scenario(browser, acct, [w, h], net); console.log(`done ${key} ${Math.round((Date.now() - t) / 1000)}s`) } catch (e) { results.runs[key] = { error: String(e).slice(0, 400) }; console.log(`ERROR ${key} ${String(e).slice(0, 200)}`) }
  writeFileSync(OUT, JSON.stringify(results))
}
await browser.close()
results.meta.finished = new Date().toISOString()
writeFileSync(OUT, JSON.stringify(results))
console.log('ALL DONE')
