// qa-p2c-B 항목 F — 실제 화면 흐름(운영 빌드·고정 응답 아님·실제 LLM): 상황 홈 → 카드 → 시트 → 역할극 방 → 말 보내기 → 대답 연습 → 마치기 → 결과 → 다시 해 보기 → ?sc= 딥링크.
// 사용: NODE_PATH=$HOME/node_modules node tests/live/p2c-qa/b-ui-flow.mjs <base> <QA4 쿠키 파일> <width> [shotDir]
// 상황은 폭마다 다르다(360 카페 · 390 길 · 412 좋아하는 것) — 앞 폭이 남긴 "이어서 할 수 있어요" 시트와 섞이지 않게. 쓰기는 이 계정 4 의 대화·기록뿐(끝나고 final-cleanup).
import { readFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'
const [, , base, cookieFile, widthArg, shotDir] = process.argv
if (/:3010$/.test(base)) throw new Error('운영 포트 금지')
const W = Number(widthArg)
const H = Number(process.env.H ?? 780)
const [cname, ...crest] = readFileSync(cookieFile, 'utf8').trim().split('=')
const PLAN = {
  360: { title: '음료의 온도·크기 정해서 주문하기', lines: ['ラテをください。', 'ホットでお願いします。'] },
  390: { title: '역에서 출구 물어보기', lines: ['すみません、出口はどこですか。', 'まっすぐ行って、右ですね。'] },
  412: { title: '좋아하는 것 말하고 되묻기', lines: ['私は映画が好きです。', 'あなたは何が好きですか。'] },
}[W]
const SC_BY_W = { 360: 'scn_cafe-order-drink', 390: 'scn_directions-station-exit', 412: 'scn_self-intro-likes' }
if (shotDir) mkdirSync(shotDir, { recursive: true })
const ENGINE = /claude|whisper|reazon|style-?bert|haiku|sonnet|opus|qwen|model_id|speaker_id|task-?\d{2,}|phase\s?\d/i
let fail = 0
const log = (ok, msg) => { if (ok === false) fail++; console.log(`${ok === true ? 'PASS' : ok === false ? 'FAIL' : 'INFO'} [${W}] ${msg}`) }
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce', colorScheme: 'light' })
await ctx.addCookies([{ name: cname, value: crest.join('='), url: base }])
await ctx.addInitScript(() => { try { sessionStorage.setItem('kaiwa.talk.inputMode', 'text') } catch {} })
const page = await ctx.newPage()
const errors = []
const writes = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 160)}`) })
page.on('request', (r) => { if (r.url().includes('/api/') && r.method() !== 'GET') writes.push(`${r.method()} ${new URL(r.url()).pathname.replace(/c[a-z0-9]{20,}/g, ':id')}`) })

async function measure(tag) {
  const m = await page.evaluate(() => {
    const vw = window.innerWidth; const se = document.scrollingElement
    const scrollers = []
    if (se.scrollHeight > window.innerHeight + 1) scrollers.push('document')
    document.querySelectorAll('*').forEach((el) => { const cs = getComputedStyle(el); if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 40) scrollers.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}`) })
    const small = []
    document.querySelectorAll('a[href], button, [role="radio"], [role="tab"]').forEach((el) => {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height || el.closest('.sr-only') || getComputedStyle(el).visibility === 'hidden') return
      if (r.height >= 43.5 && r.width >= 43.5) return
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2
      const ext = (dx, dy) => { let k = 0; for (; k < 12; k += 0.25) { const t = document.elementFromPoint(cx + dx * (k + 0.25 + (dx ? r.width / 2 : 0)), cy + dy * (k + 0.25 + (dy ? r.height / 2 : 0))); if (!(t && (t === el || el.contains(t)))) break } return k }
      const up = ext(0, -1), down = ext(0, 1), left = ext(-1, 0), right = ext(1, 0)
      if (r.height + up + down >= 43 && r.width + left + right >= 43) return
      small.push(`${Math.round(r.width)}x${Math.round(r.height)}→hit ${Math.round(r.width + left + right)}x${Math.round(r.height + up + down)} ${el.tagName.toLowerCase()}:${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 14)}`)
    })
    const kana = /[぀-ヿ]/
    const jaMissing = [...document.querySelectorAll('body *')].filter((el) => el.children.length === 0 && kana.test(el.textContent ?? '') && !el.closest('[lang="ja"]') && !el.closest('input,textarea')).map((el) => `${(el.textContent ?? '').trim().slice(0, 16)} <${el.tagName.toLowerCase()} .${String(el.className).slice(0, 40)}> in <${el.parentElement?.tagName.toLowerCase()} .${String(el.parentElement?.className).slice(0, 50)}>${el.closest('.sr-only') ? ' [sr-only]' : ''}${el.closest('[aria-live]') ? ' [aria-live]' : ''}`)
    const ta = document.querySelector('textarea')
    const taInfo = ta ? `ta scrollH=${ta.scrollHeight} clientH=${ta.clientHeight} overflowY=${getComputedStyle(ta).overflowY} rows=${ta.rows}` : 'no-textarea'
    return { taInfo, overflowX: Math.max(se.scrollWidth - vw, 0), scrollers, small, jaMissing, text: document.body.innerText }
  })
  log(m.overflowX === 0, `${tag} 가로 넘침 ${m.overflowX}px`)
  log(m.scrollers.length <= 1, `${tag} 스크롤 영역 ${m.scrollers.join(',') || 0} (${m.taInfo})`)
  log(m.small.length === 0, `${tag} 터치 44(히트테스트) ${m.small.join(' · ') || '모두 ≥44'}`)
  log(!ENGINE.test(m.text), `${tag} 엔진명·번호 노출 0`)
  log(m.jaMissing.length === 0, `${tag} 일본어 lang 누락 ${m.jaMissing.join('|') || 0}`)
  return m
}
async function shot(name) { if (shotDir && W === 390) await page.screenshot({ path: `${shotDir}/${name}.png` }) }
async function step(name, fn) {
  try { return await fn() } catch (e) { log(false, `${name} — 예외: ${String(e.message).split('\n')[0].slice(0, 200)}`); return null }
}
const sendLine = async (text) => {
  await page.getByLabel('메시지 입력').fill(text)
  const t0 = Date.now()
  const resp = page.waitForResponse((r) => r.url().includes('/turns') && r.request().method() === 'POST', { timeout: 60000 })
  await page.getByRole('button', { name: '보내기' }).click()
  const r = await resp
  await r.finished().catch(() => undefined)
  await page.waitForTimeout(1500)
  return Date.now() - t0
}

// 1 홈
await step('S1 홈', async () => {
  await page.goto(`${base}/study/ai?tab=scenario`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const m = await measure('S1 상황 홈')
  const cards = await page.getByText(PLAN.title).count()
  log(cards >= 1, `S1 시드 상황 카드 「${PLAN.title}」 ${cards}개 · 홈 글자 ${m.text.replace(/\s+/g, ' ').slice(0, 120)}`)
  await shot('s1-home')
})
// 2 카드 → 시트
await step('S2 시트', async () => {
  await page.getByText(PLAN.title).first().click()
  const start = page.getByRole('button', { name: '역할극 시작' })
  await start.waitFor({ state: 'visible', timeout: 15000 })
  const bb = await start.boundingBox()
  log(bb && bb.height >= 44, `S2 [역할극 시작] 높이 ${bb && Math.round(bb.height)}px · 너비 ${bb && Math.round(bb.width)}px`)
  await measure('S2 상황 시트')
  await shot('s2-sheet')
  await start.click()
})
// 3 방
let chatId = null
await step('S3 방', async () => {
  await page.waitForURL(/\/study\/ai\/talk\/[a-z0-9]+$/, { timeout: 30000 })
  chatId = page.url().split('/').pop()
  await page.getByLabel('메시지 입력').waitFor({ state: 'visible', timeout: 20000 })
  await page.waitForTimeout(1200)
  const m = await measure('S3 역할극 방(첫 입장)')
  log(/[぀-ヿ]/.test(m.text), `S3 선생님 첫마디(일본어) 보임 · 방 글자 ${m.text.replace(/\s+/g, ' ').slice(0, 140)}`)
  await shot('s3-room')
})
// 4 말 보내기 1
await step('S4 첫 대답', async () => {
  const ms = await sendLine(PLAN.lines[0])
  log(ms < 40000, `S4 말 보내고 선생님 대답 끝까지 ${ms}ms`)
  await measure('S4 대답 받은 뒤')
  await shot('s4-after-turn')
})
// 5 대답 연습
await step('S5 대답 연습', async () => {
  const entry = page.getByRole('button', { name: /^대답 연습/ })
  await entry.first().click()
  const t0 = Date.now()
  const region = page.locator('[aria-label="대답 연습"]').first()
  await region.waitFor({ state: 'visible', timeout: 10000 })
  await page.waitForResponse((r) => r.url().includes('/reply-practice'), { timeout: 30000 }).catch(() => undefined)
  await page.waitForTimeout(900)
  const rt = await region.innerText()
  log(rt.length > 8, `S5 대답 연습 판 열림 ${Date.now() - t0}ms · 판 글자 ${rt.replace(/\s+/g, ' ').slice(0, 100)}`)
  await measure('S5 대답 연습 판')
  await shot('s5-practice')
  await page.getByRole('button', { name: '대답 연습 닫기' }).first().click().catch(() => undefined)
  await page.waitForTimeout(500)
})
// 6 말 보내기 2
await step('S6 두 번째 대답', async () => {
  const ms = await sendLine(PLAN.lines[1])
  log(ms < 40000, `S6 두 번째 말 → 대답 ${ms}ms`)
})
// 7 마치기 → 결과
await step('S7 마치기', async () => {
  await page.getByRole('button', { name: '마치기', exact: true }).first().click()
  const fin = page.getByRole('button', { name: '마치고 결과 보기' }).first()
  await fin.waitFor({ state: 'visible', timeout: 10000 })
  await measure('S7 마치기 시트')
  await shot('s7-end-sheet')
  const t0 = Date.now()
  await fin.click()
  await page.waitForURL(/\/result$/, { timeout: 90000 })
  await page.getByText(/목표|거의|아직/).first().waitFor({ timeout: 15000 }).catch(() => undefined)
  await page.waitForTimeout(1200)
  log(true, `S7 마치기 → 결과 화면 ${Date.now() - t0}ms(판정 포함)`)
})
// 8 결과 화면
await step('S8 결과', async () => {
  const m = await measure('S8 결과 화면')
  log(null, `S8 결과 글자 ${m.text.replace(/\s+/g, ' ').slice(0, 240)}`)
  const btn = page.getByRole('button', { name: '다시 해 보기' }).first()
  const bb = await btn.boundingBox()
  log(bb && bb.height >= 43.5, `S8 [다시 해 보기] 높이 ${bb && bb.height.toFixed(1)}px · 너비 ${bb && Math.round(bb.width)}px (qa-p2c-A 결함 #3: 25px 재현 여부)`)
  await shot('s8-result')
  await step('S9 다시 해 보기', async () => {
    const old = chatId
    await btn.click()
    await page.waitForURL((u) => /\/study\/ai\/talk\/[a-z0-9]+$/.test(u.pathname) && !u.pathname.endsWith(old), { timeout: 30000 })
    await page.getByLabel('메시지 입력').waitFor({ state: 'visible', timeout: 20000 })
    log(true, `S9 다시 해 보기 → 새 역할극 방(다른 대화 id) 열림`)
    await measure('S9 새 방(다시 해 보기 뒤)')
  })
})
// 10 ?sc= 딥링크(하이드레이션)
await step('S10 딥링크', async () => {
  errors.length = 0
  const p2 = await ctx.newPage()
  const errs = []
  p2.on('pageerror', (e) => errs.push(e.message.slice(0, 120)))
  p2.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)) })
  await p2.goto(`${base}/study/ai?tab=scenario&sc=${SC_BY_W[W]}`, { waitUntil: 'networkidle' })
  await p2.waitForTimeout(1500)
  const hyd = errs.filter((e) => /#418|#423|#425|[Hh]ydrat/.test(e))
  log(hyd.length === 0, `S10 ?sc= 딥링크 하이드레이션 오류 ${hyd.length}건 ${hyd.join(' | ')} (qa-p2c-A 결함 #2 재현 여부) · 시트 열림 ${await p2.getByRole('button', { name: /역할극 시작|이어서|처음부터/ }).count()}개`)
  await p2.close()
})
log(null, `쓰기 요청: ${writes.join(' · ')}`)
const uniq = [...new Set(errors)]
log(uniq.length === 0, `전 흐름 페이지·콘솔 오류 ${uniq.length}건 ${uniq.slice(0, 4).join(' | ')}`)
console.log(`RESULT fail=${fail}`)
await browser.close()
process.exitCode = fail ? 1 : 0
