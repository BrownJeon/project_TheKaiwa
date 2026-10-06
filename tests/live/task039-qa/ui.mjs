/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * task-039 QA 화면 검증 — 실 Chrome(headless, playwright-core) × 360/390/412 × (780·892) + 다크 390 + reduced-motion 두 값.
 * 대상: 표현 점검 결과(`/study/ai/chat/:id/review`) · 회화방 인라인 카드 · 모아 둔 교정 시트. 데이터는 `ui-prep.ts` 가 만든 합성 방(추가 설명 짧은 값·200자·null·XSS 리터럴).
 * 재현 조건(출력 첫 줄에도 찍음): Chrome 버전·DSF 2.625·isMobile·locale ko-KR·tz Asia/Seoul·document.fonts.ready 대기·네트워크 fixture 없음(실 dev 서버)·애니메이션은 시나리오별 reducedMotion 지정.
 * 사용: node tests/live/task039-qa/ui.mjs --base http://127.0.0.1:3030 --cookie <쿠키> --prep <ui-prep json> [--shots /tmp/qa-artifacts/TheKaiwa/task-039]
 */
import { readFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const a = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, all) => (x.startsWith('--') ? [...acc, [x.slice(2), all[i + 1]]] : acc), []))
const BASE = a.base
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE) || /:3010$/.test(BASE)) throw new Error('dev localhost 만')
const cookie = readFileSync(a.cookie, 'utf8').trim()
const [cname, ...crest] = cookie.split('=')
const cval = crest.join('=')
const prep = JSON.parse(readFileSync(a.prep, 'utf8'))
const SHOTS = a.shots
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
const note = (s) => console.log(`  · ${s}`)

const SHORT = 'い형용사 과거: 寒い→寒かった'
const rv = prep.review
const tk = prep.talk
// ui-prep 의 계획과 같은 순서: 리뷰 방 = [SHORT, LONG, null, XSS]; 회화방 = corrIds[0..3] = [XSS(LATER), SHORT(NOW), null(NOW), LONG(NOW)] (prep 최신판)
const RV = { short: rv.corrIds[0], long: rv.corrIds[1], none: rv.corrIds[2], xss: rv.corrIds[3] }
const TK = { xss: tk.corrIds[0], short: tk.corrIds[1], none: tk.corrIds[2], long: tk.corrIds[3] }

const chromeVersion = await (async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
  const v = b.version()
  await b.close()
  return v
})()
console.log(`재현 조건: Chrome ${chromeVersion} headless · DSF 2.625 · isMobile·hasTouch · locale ko-KR · tz Asia/Seoul · fonts.ready 대기 · 네트워크 fixture 없음(실 dev 서버 ${BASE}) · reducedMotion=reduce(기본)/no-preference(별도) · 라이트(기본)/다크(390×892)`)

/** 페이지 안에서 쓰는 도구들(문자열로 주입) */
const TOOLS = `
window.__qa = {
  overflow() {
    const de = document.documentElement
    const over = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > de.clientWidth + 0.5 && getComputedStyle(e).position !== 'fixed' })
    return { n: over.length, sample: over.slice(0, 3).map((e) => e.tagName + '.' + String(e.className).slice(0, 50)), scrollW: de.scrollWidth, clientW: de.clientWidth, pageV: de.scrollHeight - window.innerHeight }
  },
  card(id, probeScroll) {
    const li = document.getElementById('cr_' + id)
    if (!li) return { found: false }
    const btn = li.querySelector('button[aria-controls$="_xn"]')
    const head = document.getElementById('cr_' + id + '_head')
    const box = document.getElementById('cr_' + id + '_xn')
    const lr = li.getBoundingClientRect()
    const out = { found: true, hasBtn: !!btn, hasHead: !!head, hasBox: !!box, liW: Math.round(lr.width), liRight: Math.round(lr.right), rubies: li.querySelectorAll('ruby').length }
    if (btn) {
      if (probeScroll) btn.scrollIntoView({ block: 'center', behavior: 'instant' })
      const br = btn.getBoundingClientRect()
      const cs = getComputedStyle(btn)
      const probe = document.elementFromPoint(br.right - 4, br.top + br.height / 2)
      out.btn = { h: Math.round(br.height * 10) / 10, w: Math.round(br.width), expanded: btn.getAttribute('aria-expanded'), controls: btn.getAttribute('aria-controls'), describedby: btn.getAttribute('aria-describedby'), describedExists: !!(btn.getAttribute('aria-describedby') && document.getElementById(btn.getAttribute('aria-describedby'))), label: btn.textContent.replace(/\\s+/g, ' ').trim(), fullWidthHit: !!probe && (probe === btn || btn.contains(probe)), insetLeft: Math.round(br.left - lr.left), insetRight: Math.round(lr.right - br.right), fontPx: cs.fontSize, type: btn.getAttribute('type') }
    }
    if (box) out.box = { hidden: box.hidden, h: Math.round(box.getBoundingClientRect().height), text: box.textContent.replace(/\\s+/g, ' ').trim(), scrollW: box.scrollWidth, clientW: box.clientWidth, animName: getComputedStyle(box).animationName, animDur: getComputedStyle(box).animationDuration, color: getComputedStyle(box).color, borderLeft: getComputedStyle(box).borderLeftColor, fontPx: getComputedStyle(box).fontSize, wordBreak: getComputedStyle(box).wordBreak }
    return out
  },
  boxAudit(id) {
    const box = document.getElementById('cr_' + id + '_xn')
    if (!box) return null
    const KANA_KANJI = /[\\u3040-\\u30ff\\u31f0-\\u31ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uff66-\\uff9f]/
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT)
    let n, jaOutside = [], jaInside = 0, mixedJa = 0
    const chars = []
    while ((n = walker.nextNode())) {
      const el = n.parentElement
      const lang = el.closest('[lang]')?.getAttribute('lang') ?? ''
      const isJa = lang === 'ja'
      if (!isJa && KANA_KANJI.test(n.data)) jaOutside.push(n.data.slice(0, 20))
      if (isJa) { jaInside++; if (/[\\uac00-\\ud7a3]/.test(n.data)) mixedJa++ }
      for (let i = 0; i < n.length; i++) {
        const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1)
        const rc = r.getClientRects()[0]
        if (!rc) continue
        chars.push({ ch: n.data[i], top: Math.round(rc.top), isJa, wb: getComputedStyle(el).wordBreak })
      }
    }
    const breaks = { koMid: [], jaMid: [], mixedMid: [], atSpace: 0 }
    for (let i = 1; i < chars.length; i++) {
      if (chars[i].top <= chars[i - 1].top + 4) continue
      const p = chars[i - 1], c = chars[i]
      if (/\\s/.test(p.ch) || /\\s/.test(c.ch)) { breaks.atSpace++; continue }
      const pk = /[\\uac00-\\ud7a3]/.test(p.ch), ck = /[\\uac00-\\ud7a3]/.test(c.ch)
      const pair = p.ch + '|' + c.ch
      if (pk && ck) breaks.koMid.push(pair)
      else if (p.isJa && c.isJa) breaks.jaMid.push(pair)
      else breaks.mixedMid.push(pair)
    }
    return {
      rubies: box.querySelectorAll('ruby,rt').length,
      hangulLine: [...box.querySelectorAll('p,span')].filter((e) => /^\\[[^\\]]*[\\uac00-\\ud7a3][^\\]]*\\]$/.test(e.textContent.trim())).length,
      jaOutside, jaSpans: box.querySelectorAll('[lang="ja"]').length, mixedJa,
      imgs: box.querySelectorAll('img,script,b,iframe').length, xssFlag: window.__xss ?? null,
      lines: new Set(chars.map((c) => c.top)).size, breaks: { koMid: breaks.koMid, jaMid: breaks.jaMid.length, mixedMid: breaks.mixedMid, atSpace: breaks.atSpace },
    }
  },
  scroller(el) {
    let p = el.parentElement
    while (p) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p; p = p.parentElement }
    return document.scrollingElement
  },
}`

async function open(browser, { w, h, scheme = 'light', motion = 'reduce' }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: motion, colorScheme: scheme })
  await ctx.addCookies([{ name: cname, value: cval, url: BASE }])
  await ctx.addInitScript(TOOLS)
  const page = await ctx.newPage()
  const errors = []
  const bad = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200)))
  page.on('pageerror', (e) => errors.push(`pageerror ${String(e).slice(0, 200)}`))
  page.on('response', (r) => r.status() >= 500 && bad.push(`${r.status()} ${r.url().replace(BASE, '')}`))
  return { ctx, page, errors, bad }
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForSelector('ruby', { timeout: 15000 }).catch(() => undefined)
  await page.waitForTimeout(900)
}

async function cardChecks(page, tag, ids, wantTexts) {
  // ① 접힘 상태
  for (const [name, id] of Object.entries(ids)) {
    const c = await page.evaluate((i) => window.__qa.card(i, true), id)
    check(`${tag} ${name} 카드 표시`, c.found, '')
    if (!c.found) continue
    if (name === 'none') {
      check(`${tag} none(NULL) 카드: 줄·머리줄 id·상자 모두 없음(옛 교정과 같은 마크업)`, !c.hasBtn && !c.hasHead && !c.hasBox, `btn=${c.hasBtn} head=${c.hasHead} box=${c.hasBox}`)
      continue
    }
    check(`${tag} ${name} 접힘 시작: 버튼 이름 '시험 문법 더 보기'·aria-expanded=false·상자 hidden`, c.hasBtn && c.btn.label.includes('시험 문법 더 보기') && c.btn.expanded === 'false' && c.box?.hidden === true, `label=${c.btn?.label} exp=${c.btn?.expanded} hidden=${c.box?.hidden}`)
    check(`${tag} ${name} aria-controls→상자 id·aria-describedby→머리줄 존재`, c.btn.controls === `cr_${id}_xn` && c.hasBox && c.btn.describedExists, `controls=${c.btn.controls} describedExists=${c.btn.describedExists}`)
    check(`${tag} ${name} 버튼 높이 ≥44px`, c.btn.h >= 44, `h=${c.btn.h}`)
    check(`${tag} ${name} 카드 폭 전체가 눌림(버튼 폭=카드 안쪽 폭·오른쪽 끝 점이 버튼)`, c.btn.fullWidthHit && Math.abs(c.btn.insetLeft - c.btn.insetRight) <= 1 && c.btn.w >= c.liW - 40, `btnW=${c.btn.w} liW=${c.liW} inset L/R=${c.btn.insetLeft}/${c.btn.insetRight} hit=${c.btn.fullWidthHit}`)
  }
}

async function expandAudit(page, tag, ids, wants, w) {
  for (const name of ['short', 'long', 'xss']) {
    const id = ids[name]
    const sel = `#cr_${id} button[aria-controls$="_xn"]`
    const btn = page.locator(sel)
    if ((await btn.count()) === 0) { check(`${tag} ${name} 펼침 검사`, false, '버튼 없음'); continue }
    await btn.scrollIntoViewIfNeeded()
    await btn.click()
    await page.waitForTimeout(450)
    const c = await page.evaluate((i) => window.__qa.card(i), id)
    check(`${tag} ${name} 클릭 → aria-expanded=true·상자 보임·이름 '시험 문법 접기'`, c.btn.expanded === 'true' && c.box.hidden === false && c.box.h > 0 && c.btn.label.includes('시험 문법 접기'), `exp=${c.btn.expanded} boxH=${c.box.h} label=${c.btn.label}`)
    check(`${tag} ${name} 상자 글 = 저장값 그대로(자르지 않음)`, c.box.text === wants[name].replace(/\s+/g, ' ').trim() || (name === 'xss' && c.box.text.includes('<img src=x onerror=')), `len=${[...c.box.text].length} want=${[...wants[name]].length}`)
    check(`${tag} ${name} 상자 가로 넘침 0(scrollW≤clientW)`, c.box.scrollW <= c.box.clientW + 1, `scrollW=${c.box.scrollW} clientW=${c.box.clientW}`)
    const au = await page.evaluate((i) => window.__qa.boxAudit(i), id)
    check(`${tag} ${name} 상자 안 루비·한글 줄 0(히라가나·한글 표시가 켜져 있어도)`, au.rubies === 0 && au.hangulLine === 0, `ruby=${au.rubies} hangulLine=${au.hangulLine} · 카드 안 루비(상자 밖 일본어)=${c.rubies}`)
    check(`${tag} ${name} 「」 밖 일본어 구간도 lang="ja"`, au.jaOutside.length === 0, `밖 일본어 ${JSON.stringify(au.jaOutside)} ja span ${au.jaSpans}`)
    check(`${tag} ${name} lang=ja 조각 안에 한글 없음(한국어가 든 「」 제외 — 알려진 L-9 별도)`, au.mixedJa === 0, `한글 든 ja 노드 ${au.mixedJa}`)
    if (name === 'xss') {
      check(`${tag} xss 리터럴: img·script·b 요소 0·window.__xss 미실행·글자로 보임`, au.imgs === 0 && au.xssFlag === null && c.box.text.includes('<img src=x'), `요소 ${au.imgs} xss=${au.xssFlag}`)
    }
    note(`${tag} ${name} 줄 ${au.lines}개 · 어절 한가운데 줄바꿈: 한글끼리 ${au.breaks.koMid.length}${au.breaks.koMid.length ? ' ' + JSON.stringify(au.breaks.koMid.slice(0, 4)) : ''} · 한글↔일본어 경계(공백 없음) ${au.breaks.mixedMid.length}${au.breaks.mixedMid.length ? ' ' + JSON.stringify(au.breaks.mixedMid.slice(0, 4)) : ''} · 일본어끼리 ${au.breaks.jaMid} · 공백에서 ${au.breaks.atSpace}`)
    check(`${tag} ${name} 한국어 어절 한가운데서 줄이 끊기지 않음(한글끼리 0)`, au.breaks.koMid.length === 0, `${JSON.stringify(au.breaks.koMid.slice(0, 5))}`)
    // 접기
    await btn.click()
    await page.waitForTimeout(250)
    const c2 = await page.evaluate((i) => window.__qa.card(i), id)
    check(`${tag} ${name} 다시 클릭 → 접힘(aria-expanded=false·hidden)`, c2.btn.expanded === 'false' && c2.box.hidden === true, '')
  }
  // 키보드: Tab 으로 첫 버튼까지 → Enter 펼침 → Space 접힘, 포커스 링
  await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0) })
  let reached = null
  for (let k = 0; k < 120; k++) {
    await page.keyboard.press('Tab')
    reached = await page.evaluate(() => {
      const e = document.activeElement
      if (!e || e.tagName !== 'BUTTON' || !(e.getAttribute('aria-controls') || '').endsWith('_xn')) return null
      const cs = getComputedStyle(e)
      return { controls: e.getAttribute('aria-controls'), outlineStyle: cs.outlineStyle, outlineW: cs.outlineWidth, outlineColor: cs.outlineColor, outlineOffset: cs.outlineOffset, fv: e.matches(':focus-visible') }
    })
    if (reached) break
  }
  check(`${tag} 키보드 Tab 으로 '시험 문법' 버튼에 닿음`, !!reached, `tab ${reached ? '도달' : '실패'}`)
  if (reached) {
    check(`${tag} 포커스 링 보임(:focus-visible·outline 2px 이상·none 아님)`, reached.fv && reached.outlineStyle !== 'none' && parseFloat(reached.outlineW) >= 2, `style=${reached.outlineStyle} w=${reached.outlineW} color=${reached.outlineColor} offset=${reached.outlineOffset}`)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(350)
    let st = await page.evaluate(() => ({ exp: document.activeElement?.getAttribute('aria-expanded'), focusKept: document.activeElement?.tagName === 'BUTTON' }))
    check(`${tag} Enter → 펼침(aria-expanded=true)·포커스 유지`, st.exp === 'true' && st.focusKept, `exp=${st.exp}`)
    await page.keyboard.press('Space')
    await page.waitForTimeout(350)
    st = await page.evaluate(() => ({ exp: document.activeElement?.getAttribute('aria-expanded') }))
    check(`${tag} Space → 접힘(aria-expanded=false)`, st.exp === 'false', `exp=${st.exp}`)
  }
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] })
const WANT = {
  review: { short: SHORT, long: null, xss: null },
}
try {
  const sizes = []
  for (const w of [360, 390, 412]) for (const h of [780, 892]) sizes.push([w, h, 'light'])
  sizes.push([390, 892, 'dark'])
  // 기대 글(저장값) — prep 결과의 DB 값을 직접 읽는다(화면 글 = 저장값 대조의 정답)
  const dbVals = await (async () => {
    const r = await fetch(`${BASE}/api/v1/corrections?chatId=${rv.chatId}&limit=100`, { headers: { Cookie: cookie } })
    const j = await r.json()
    const m = Object.fromEntries(j.data.items.map((x) => [x.id, x.extraNoteKo]))
    const r2 = await fetch(`${BASE}/api/v1/corrections?chatId=${tk.chatId}&limit=100`, { headers: { Cookie: cookie } })
    const j2 = await r2.json()
    return { rv: m, tk: Object.fromEntries(j2.data.items.map((x) => [x.id, x.extraNoteKo])) }
  })()
  check('#34 목록이 합성 값을 그대로 돌려줌(리뷰 방 SHORT·LONG 200자·null·XSS)', dbVals.rv[RV.short] === SHORT && dbVals.rv[RV.none] === null && [...dbVals.rv[RV.long]].length === 200 && dbVals.rv[RV.xss].includes('<img src=x'), `long=${[...dbVals.rv[RV.long]].length}자`)
  const wantRv = { short: dbVals.rv[RV.short], long: dbVals.rv[RV.long], xss: dbVals.rv[RV.xss] }
  const wantTk = { short: dbVals.tk[TK.short], long: dbVals.tk[TK.long], xss: dbVals.tk[TK.xss] }

  for (const [w, h, scheme] of sizes) {
    // ── 표현 점검 결과 ──
    {
      const { ctx, page, errors, bad } = await open(browser, { w, h, scheme })
      const tag = `REVIEW ${w}×${h} ${scheme}`
      await page.goto(`${BASE}/study/ai/chat/${rv.chatId}/review`, { waitUntil: 'load' })
      await page.waitForSelector(`#cr_${RV.short}`, { timeout: 20000 }).catch(() => undefined)
      await settle(page)
      const ov = await page.evaluate(() => window.__qa.overflow())
      check(`${tag} 가로 넘침 0·페이지 레벨 세로 스크롤 0(접힘)`, ov.n === 0 && ov.scrollW <= ov.clientW && ov.pageV <= 1, `over=${ov.n} ${ov.sample.join('|')} scrollW=${ov.scrollW}/${ov.clientW} pageV=${ov.pageV}`)
      await cardChecks(page, tag, RV, wantRv)
      if (SHOTS && w === 390 && h === 892) await page.screenshot({ path: `${SHOTS}/review-390-${scheme}-closed.png` })
      await expandAudit(page, tag, RV, wantRv, w)
      // 긴 값 펼친 채로 넘침 확인 + 스크린샷
      await page.locator(`#cr_${RV.long} button[aria-controls$="_xn"]`).click()
      await page.waitForTimeout(400)
      const ov2 = await page.evaluate(() => window.__qa.overflow())
      check(`${tag} 긴 값 펼침 상태 가로 넘침 0·페이지 레벨 세로 스크롤 0`, ov2.n === 0 && ov2.scrollW <= ov2.clientW && ov2.pageV <= 1, `over=${ov2.n} ${ov2.sample.join('|')} pageV=${ov2.pageV}`)
      const lg = await page.evaluate((i) => window.__qa.card(i), RV.long)
      note(`${tag} 긴 값(200자) 펼친 상자 높이 ${lg.box.h}px · 폰트 ${lg.box.fontPx} · word-break ${lg.box.wordBreak} · color ${lg.box.color} · border ${lg.box.borderLeft}`)
      if (SHOTS && w === 390 && h === 892) await page.screenshot({ path: `${SHOTS}/review-390-${scheme}-long-open.png` })
      // 엔진명 문자열·콘솔 오류
      const eng = await page.evaluate(() => (document.body.innerHTML.match(/reazon|whisper|style-?bert|model_id|speaker_id|claude|haiku|sonnet/gi) || []).length)
      check(`${tag} 엔진·모델명 문자열 0·콘솔/페이지 오류 0·5xx 0`, eng === 0 && errors.length === 0 && bad.length === 0, `engine=${eng} errors=${errors.length}${errors.length ? ' ' + errors.slice(0, 2).join(' / ') : ''} 5xx=${bad.join(',') || 0}`)
      if (scheme === 'dark') {
        const col = await page.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, fg: getComputedStyle(document.body).color }))
        note(`다크 body bg=${col.bg} fg=${col.fg}`)
        results.__darkBg = col.bg
      }
      await ctx.close()
    }
  }
  // ── reduced-motion 두 값(390×892, 리뷰 화면) ──
  for (const motion of ['reduce', 'no-preference']) {
    const { ctx, page } = await open(browser, { w: 390, h: 892, motion })
    await page.goto(`${BASE}/study/ai/chat/${rv.chatId}/review`, { waitUntil: 'load' })
    await page.waitForSelector(`#cr_${RV.short}`, { timeout: 20000 }).catch(() => undefined)
    await settle(page)
    await page.locator(`#cr_${RV.short} button[aria-controls$="_xn"]`).click()
    await page.waitForTimeout(60)
    const c = await page.evaluate((i) => window.__qa.card(i), RV.short)
    if (motion === 'reduce') check('reduced-motion=reduce: 펼친 상자 애니메이션 없음(animation-name none)', c.box.animName === 'none', `animName=${c.box.animName} dur=${c.box.animDur}`)
    else check('reduced-motion=no-preference: 160ms 페이드 애니메이션 있음(extra-note-in)', c.box.animName.includes('extra-note-in') && c.box.animDur === '0.16s', `animName=${c.box.animName} dur=${c.box.animDur}`)
    await ctx.close()
  }
  // ── 다크 토큰 반전 ──
  {
    const light = await open(browser, { w: 390, h: 892, scheme: 'light' })
    await light.page.goto(`${BASE}/study/ai/chat/${rv.chatId}/review`, { waitUntil: 'load' })
    await light.page.waitForSelector(`#cr_${RV.short}`, { timeout: 20000 }).catch(() => undefined)
    await settle(light.page)
    await light.page.locator(`#cr_${RV.short} button[aria-controls$="_xn"]`).click()
    await light.page.waitForTimeout(400)
    const lc = await light.page.evaluate((i) => ({ card: window.__qa.card(i), bg: getComputedStyle(document.body).backgroundColor }), RV.short)
    await light.ctx.close()
    const dark = await open(browser, { w: 390, h: 892, scheme: 'dark' })
    await dark.page.goto(`${BASE}/study/ai/chat/${rv.chatId}/review`, { waitUntil: 'load' })
    await dark.page.waitForSelector(`#cr_${RV.short}`, { timeout: 20000 }).catch(() => undefined)
    await settle(dark.page)
    await dark.page.locator(`#cr_${RV.short} button[aria-controls$="_xn"]`).click()
    await dark.page.waitForTimeout(400)
    const dc = await dark.page.evaluate((i) => ({ card: window.__qa.card(i), bg: getComputedStyle(document.body).backgroundColor }), RV.short)
    const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]) }
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
    check('다크: 배경·글자·왼쪽 선 토큰이 라이트와 다르게 반전(계산값)', lc.bg !== dc.bg && lc.card.box.color !== dc.card.box.color && lc.card.box.borderLeft !== dc.card.box.borderLeft, `bg ${lc.bg}→${dc.bg} · 글자 ${lc.card.box.color}→${dc.card.box.color} · 선 ${lc.card.box.borderLeft}→${dc.card.box.borderLeft}`)
    const rl = ratio(lc.card.box.color, lc.bg), rd = ratio(dc.card.box.color, dc.bg)
    note(`상자 글자/배경 대비 라이트 ${rl.toFixed(2)}:1 · 다크 ${rd.toFixed(2)}:1`)
    check('다크·라이트 모두 상자 글자 대비 ≥ 4.5:1', rl >= 4.5 && rd >= 4.5, `light ${rl.toFixed(2)} dark ${rd.toFixed(2)}`)
    if (SHOTS) await dark.page.screenshot({ path: `${SHOTS}/review-390-dark-short-open.png` })
    await dark.ctx.close()
  }

  // ── 회화방 ──
  for (const [w, h, scheme] of sizes) {
    const { ctx, page, errors, bad } = await open(browser, { w, h, scheme })
    const tag = `TALK ${w}×${h} ${scheme}`
    await page.goto(`${BASE}/study/ai/talk/${tk.chatId}`, { waitUntil: 'load' })
    await page.waitForSelector(`#cr_${TK.short}`, { timeout: 25000 }).catch(() => undefined)
    await settle(page)
    const inline = { short: TK.short, long: TK.long, none: TK.none }
    const ov = await page.evaluate(() => window.__qa.overflow())
    check(`${tag} 가로 넘침 0·페이지 레벨 세로 스크롤 0`, ov.n === 0 && ov.scrollW <= ov.clientW && ov.pageV <= 1, `over=${ov.n} ${ov.sample.join('|')} scrollW=${ov.scrollW}/${ov.clientW} pageV=${ov.pageV}`)
    await cardChecks(page, tag, inline, wantTk)
    const laterInline = await page.evaluate((i) => !!document.getElementById('cr_' + i), TK.xss)
    check(`${tag} LATER(모아 둔) 교정은 대화 속에 카드가 없음`, laterInline === false, `inline=${laterInline}`)
    if (SHOTS && w === 390 && h === 892) await page.screenshot({ path: `${SHOTS}/talk-390-${scheme}-closed.png` })
    // 인라인 펼침(short·long)
    for (const name of ['short', 'long']) {
      const id = inline[name]
      const btn = page.locator(`#cr_${id} button[aria-controls$="_xn"]`)
      await btn.scrollIntoViewIfNeeded()
      await btn.click()
      await page.waitForTimeout(500)
      const c = await page.evaluate((i) => window.__qa.card(i), id)
      const au = await page.evaluate((i) => window.__qa.boxAudit(i), id)
      check(`${tag} 회화방 ${name} 펼침: aria-expanded=true·글=저장값·루비/한글 줄 0·「」 밖 ja 누락 0`, c.btn.expanded === 'true' && c.box.text === wantTk[name].replace(/\s+/g, ' ').trim() && au.rubies === 0 && au.hangulLine === 0 && au.jaOutside.length === 0, `exp=${c.btn.expanded} ruby=${au.rubies} jaOutside=${au.jaOutside.length} len=${[...c.box.text].length}`)
      check(`${tag} 회화방 ${name} 어절 한가운데 줄바꿈 0(한글끼리)·상자 가로 넘침 0`, au.breaks.koMid.length === 0 && c.box.scrollW <= c.box.clientW + 1, `koMid=${JSON.stringify(au.breaks.koMid.slice(0, 3))} mixed=${au.breaks.mixedMid.length}`)
    }
    const ov3 = await page.evaluate(() => window.__qa.overflow())
    check(`${tag} 펼친 뒤에도 가로 넘침 0·페이지 레벨 세로 스크롤 0`, ov3.n === 0 && ov3.pageV <= 1, `over=${ov3.n} pageV=${ov3.pageV}`)
    if (SHOTS && w === 390 && h === 892) await page.screenshot({ path: `${SHOTS}/talk-390-${scheme}-open.png` })
    // 모아 둔 교정 시트
    const chip = page.locator('button[aria-label*="모아 둔 교정"]').first()
    check(`${tag} '모아 둔 교정 N개' 칩 있음`, (await chip.count()) > 0, '')
    if ((await chip.count()) > 0) {
      await chip.click()
      await page.waitForSelector(`#cr_${TK.xss}`, { timeout: 15000 }).catch(() => undefined)
      await page.waitForTimeout(600)
      const sc = await page.evaluate((i) => window.__qa.card(i), TK.xss)
      check(`${tag} 시트 카드: 버튼 있음·접힘 시작·높이 ≥44px·aria-expanded=false`, sc.found && sc.hasBtn && sc.btn.expanded === 'false' && sc.btn.h >= 44, `found=${sc.found} h=${sc.btn?.h} exp=${sc.btn?.expanded}`)
      const ovs = await page.evaluate(() => window.__qa.overflow())
      check(`${tag} 시트 열린 상태 가로 넘침 0`, ovs.n === 0 && ovs.scrollW <= ovs.clientW, `over=${ovs.n} ${ovs.sample.join('|')}`)
      await page.locator(`#cr_${TK.xss} button[aria-controls$="_xn"]`).click()
      await page.waitForTimeout(450)
      const sx = await page.evaluate((i) => ({ c: window.__qa.card(i), au: window.__qa.boxAudit(i) }), TK.xss)
      check(`${tag} 시트 XSS 리터럴: 요소 0·미실행·글자로 보임·상자 넘침 0`, sx.au.imgs === 0 && sx.au.xssFlag === null && sx.c.box.text.includes('<img src=x') && sx.c.box.scrollW <= sx.c.box.clientW + 1, `요소=${sx.au.imgs} xss=${sx.au.xssFlag}`)
      if (SHOTS && w === 390 && h === 892) await page.screenshot({ path: `${SHOTS}/talk-390-${scheme}-sheet-open.png` })
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }
    const eng = await page.evaluate(() => (document.body.innerHTML.match(/reazon|whisper|style-?bert|model_id|speaker_id|claude|haiku|sonnet/gi) || []).length)
    check(`${tag} 엔진·모델명 문자열 0·콘솔/페이지 오류 0·5xx 0`, eng === 0 && errors.length === 0 && bad.length === 0, `engine=${eng} errors=${errors.length}${errors.length ? ' ' + errors.slice(0, 3).join(' / ') : ''} 5xx=${bad.join(',') || 0}`)
    await ctx.close()
  }

  // ── 회화방 스크롤 따라가기(390×780) ──
  {
    const { ctx, page } = await open(browser, { w: 390, h: 780, motion: 'no-preference' })
    await page.goto(`${BASE}/study/ai/talk/${tk.chatId}`, { waitUntil: 'load' })
    await page.waitForSelector(`#cr_${TK.long}`, { timeout: 25000 }).catch(() => undefined)
    await settle(page)
    const measure = async (label, id, scrollTo) => {
      const info = await page.evaluate(([i, mode]) => {
        const li = document.getElementById('cr_' + i)
        const sc = window.__qa.scroller(li)
        if (mode === 'bottom') sc.scrollTop = sc.scrollHeight
        else if (mode === 'middle') { const btn = li.querySelector('button[aria-controls$="_xn"]'); const r = btn.getBoundingClientRect(); const cr = sc.getBoundingClientRect(); sc.scrollTop += r.top - (cr.top + cr.height * 0.4) }
        return { max: sc.scrollHeight - sc.clientHeight, top: sc.scrollTop, tag: sc.tagName + '.' + String(sc.className).slice(0, 30) }
      }, [id, scrollTo])
      await page.waitForTimeout(500)
      const before = await page.evaluate((i) => {
        const li = document.getElementById('cr_' + i)
        const sc = window.__qa.scroller(li)
        const btn = li.querySelector('button[aria-controls$="_xn"]')
        const br = btn.getBoundingClientRect(), cr = sc.getBoundingClientRect()
        return { st: sc.scrollTop, max: sc.scrollHeight - sc.clientHeight, btnTop: br.top, cTop: cr.top, cBottom: cr.bottom, distBottom: sc.scrollHeight - sc.clientHeight - sc.scrollTop }
      }, id)
      await page.locator(`#cr_${id} button[aria-controls$="_xn"]`).click()
      const samples = []
      for (const ms of [60, 200, 520, 900]) {
        await page.waitForTimeout(ms === 60 ? 60 : ms - (samples.length ? [60, 200, 520, 900][samples.length - 1] : 0))
        samples.push(await page.evaluate((i) => {
          const li = document.getElementById('cr_' + i)
          const sc = window.__qa.scroller(li)
          const btn = li.querySelector('button[aria-controls$="_xn"]')
          const box = document.getElementById('cr_' + i + '_xn')
          const br = btn.getBoundingClientRect(), bx = box.getBoundingClientRect(), cr = sc.getBoundingClientRect()
          return { st: sc.scrollTop, btnTop: Math.round(br.top), boxBottom: Math.round(bx.bottom), cBottom: Math.round(cr.bottom), cTop: Math.round(cr.top) }
        }, id))
      }
      const fin = samples.at(-1)
      const need = Math.max(0, Math.round(fin.boxBottom - fin.cBottom))
      note(`스크롤 ${label}: 시작 위치 바닥까지 ${Math.round(before.distBottom)}px · scrollTop ${Math.round(before.st)}→${Math.round(fin.st)}(Δ${Math.round(fin.st - before.st)}) · 눌린 줄 top ${Math.round(before.btnTop)}→${fin.btnTop}(Δ${Math.round(fin.btnTop - before.btnTop)}) · 상자 bottom ${fin.boxBottom} / 목록 bottom ${fin.cBottom} · 샘플 ${JSON.stringify(samples.map((s) => [s.st, s.btnTop]))}`)
      return { before, samples, fin, boxVisible: fin.boxBottom <= fin.cBottom + 2, btnVisible: fin.btnTop >= fin.cTop - 1 && fin.btnTop < fin.cBottom, jump: Math.abs(fin.btnTop - before.btnTop) }
    }
    // (a) 바닥에서 마지막 카드(LONG) 펼침
    const a1 = await measure('바닥·긴 값', TK.long, 'bottom')
    check('스크롤(a) 바닥 근처 긴 카드 펼침: 펼친 상자가 보이고 누른 줄이 화면 안에 남음', a1.boxVisible && a1.btnVisible, `boxVisible=${a1.boxVisible} btnVisible=${a1.btnVisible}`)
    // 접고 (b) 중간 위치에서 SHORT 펼침 — 상자가 이미 화면 안이면 스크롤 이동 0이어야 함
    await page.locator(`#cr_${TK.long} button[aria-controls$="_xn"]`).click()
    await page.waitForTimeout(300)
    const b1 = await measure('중간·짧은 값', TK.short, 'middle')
    check('스크롤(b) 중간 위치에서 펼침: 상자가 이미 화면 안이면 눌린 줄이 움직이지 않음(Δtop ≤ 2px)', b1.boxVisible && b1.jump <= 2, `jump=${b1.jump}px boxVisible=${b1.boxVisible}`)
    await ctx.close()
  }

  // ── 재생 중 펼침(다시 듣기 → 펼침 → 재생 유지) ──
  {
    const { ctx, page } = await open(browser, { w: 390, h: 892, motion: 'reduce' })
    await page.addInitScript(() => {
      window.__audio = { plays: 0, pauses: 0, ended: 0, els: [] }
      const op = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function (...args) { window.__audio.plays++; window.__audio.els.push(this); this.addEventListener('pause', () => window.__audio.pauses++); this.addEventListener('ended', () => window.__audio.ended++); return op.apply(this, args) }
    })
    await page.goto(`${BASE}/study/ai/talk/${tk.chatId}`, { waitUntil: 'load' })
    await page.waitForSelector(`#cr_${TK.short}`, { timeout: 25000 }).catch(() => undefined)
    await settle(page)
    const rb = page.locator('button[aria-label*="다시 듣기"]').last()
    check('재생 중 펼침 준비: 선생님 말풍선 ▶ 다시 듣기 버튼 있음', (await rb.count()) > 0, '')
    if ((await rb.count()) > 0) {
      await rb.scrollIntoViewIfNeeded()
      await rb.click()
      let playing = false
      for (let k = 0; k < 30; k++) {
        await page.waitForTimeout(150)
        playing = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /멈춤/.test(b.getAttribute('aria-label') || '') || /■\s*멈춤/.test(b.textContent || '')))
        if (playing) break
      }
      if (!playing) note('다시 듣기 재생이 시작되지 않음(합성·로드 실패 가능) — 재생 중 펼침은 확인 못 함')
      else {
        const btn = page.locator(`#cr_${TK.short} button[aria-controls$="_xn"]`)
        await btn.scrollIntoViewIfNeeded().catch(() => undefined)
        const preAudio = await page.evaluate(() => ({ plays: window.__audio.plays, paused: window.__audio.els.at(-1)?.paused }))
        await btn.click()
        await page.waitForTimeout(250)
        const post = await page.evaluate(() => ({ plays: window.__audio.plays, pauses: window.__audio.pauses, ended: window.__audio.ended, paused: window.__audio.els.at(-1)?.paused, t: window.__audio.els.at(-1)?.currentTime, stillStop: [...document.querySelectorAll('button')].some((b) => /멈춤/.test(b.getAttribute('aria-label') || '') || /■\s*멈춤/.test(b.textContent || '')) }))
        const exp = await page.evaluate((i) => document.querySelector(`#cr_${i} button[aria-controls$="_xn"]`)?.getAttribute('aria-expanded'), TK.short)
        check('말하는(재생) 중 펼쳐도 재생이 끊기지 않음(pause 이벤트 0·ended 전이면 계속 재생·[■ 멈춤] 유지)', exp === 'true' && post.pauses === 0 && (post.stillStop || post.ended > 0), `pre.paused=${preAudio.paused} post: pauses=${post.pauses} ended=${post.ended} paused=${post.paused} t=${post.t} stillStop=${post.stillStop} exp=${exp}`)
        note('녹음 중 펼침은 마이크 입력 경로라 이 환경에서 확인 못 함(실기기 항목)')
      }
    }
    await ctx.close()
  }
} finally {
  await browser.close()
}
const fail = results.filter((r) => !r.ok)
console.log(`\n결과: PASS ${results.length - fail.length} / ${results.length}${fail.length ? ` · FAIL ${fail.length}: ${fail.map((f) => f.name).join(' ; ')}` : ''}`)
process.exitCode = fail.length ? 1 : 0
