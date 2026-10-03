/**
 * task-021 키보드 공통 처리(IMP-0008 · 승인 데모 v1 R1~R7 · D1 A · D2 A) 화면 E2E — 실 Chrome + playwright-core 에뮬레이션.
 *
 *   ① 화면이 줄어드는 경로(모바일 Chrome `resizes-content` · 네이티브 IME 보정 뒤 앱): 입력 칸 포커스 뒤 뷰포트 높이를 키보드(320px)만큼 줄인다.
 *   ② 덮기만 하는 경로: 가짜 visualViewport 높이만 줄인다(뷰포트 그대로).
 *   A 단어장 검색 3폭 · B 설정 폼 3폭(16px 여유·열린 채 다른 칸) · C 새 채팅 시트 3폭+412×892(85%·D2 A) · D 단어 추가 시트 ·
 *   E 채팅방 입력 바 3폭+412×892(목록 맨 아래·main 헛 스크롤 0·토스트) · F 회화방 글자 모드(방 종류만 TALK 로 바꿔 렌더) ·
 *   G 붙여넣기 수업 칸 · V ② 경로(--kb-inset·시트·토스트·핀치 확대) · X 오탐(데스크톱 창 줄이기·지금 앱 WebView) ·
 *   Y 기준 높이 전이(REV-042 M1 — 포커스 없이 줄어든 분할 화면은 키보드 아님·포커스가 잠깐 빠졌다 돌아와도 열림 유지).
 *
 * **쓰기 0**: 브라우저의 `/api/**` GET·HEAD 외 요청은 전부 503 으로 막는다(출석 POST 등) — DB 를 바꾸지 않는다.
 * 채팅방(E·F·V)은 QA 계정의 기존 CHAT 방 중 메시지가 가장 많은 방을 채팅 목록 GET 으로 고른다(`--chat <id>` 로 지정 가능). 없으면 그 구간은 SKIP.
 * 실기기 대체가 아니다 — 키보드 애니메이션·삼성 키보드 추천 띠·실제 분할 화면은 사용자 S25+ 확인(F6) 몫.
 *
 * 실행(미러 `~/.node-local/thekaiwa` 에서, 운영 3010 이 아닌 포트로 dev 서버를 따로 띄운 뒤):
 *   QA_ACCOUNT=1 node --env-file=.env --import tsx tests/live/qa-session.ts <쿠키 파일>
 *   ./node_modules/.bin/next dev -H 127.0.0.1 -p 3021 &
 *   node tests/live/task021-ui-e2e.mjs --base http://127.0.0.1:3021 --cookie <쿠키 파일> [--out <스크린샷 디렉터리>] [--chat <채팅 id>]
 * `playwright-core` 는 워크스페이스 밖(`~/node_modules`), 브라우저는 `/usr/bin/google-chrome`(`--chrome` 로 바꿈). 쿠키는 출력하지 않는다 — 끝나면 지운다.
 * 2026-10-01 developer: 89/89(Y 추가 전) → Y 포함 결과는 task-021 Developer 기록.
 */
import { chromium } from 'playwright-core'
import { mkdirSync, readFileSync } from 'node:fs'

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []))
if (!args.cookie) throw new Error('--cookie <qa-session 파일> 필요')
const BASE = args.base ?? 'http://127.0.0.1:3021'
if (/:3010\b/.test(BASE)) throw new Error('3010 은 운영 포트 — dev 서버를 다른 포트로 띄운다')
const cookie = readFileSync(args.cookie, 'utf8').trim()
const OUT = args.out ?? '/tmp/task021-ui'
mkdirSync(OUT, { recursive: true })
const rooms = { chat: args.chat ?? (await pickChatRoom()) }
if (!rooms.chat) console.log('SKIP  QA 계정에 CHAT 방이 없음 — E·F·V(채팅방) 구간 건너뜀')

async function pickChatRoom() {
  const res = await fetch(`${BASE}/api/v1/chats?kind=CHAT&limit=50`, { headers: { cookie } })
  if (!res.ok) throw new Error(`채팅 목록 ${res.status} — 쿠키·서버 확인`)
  const items = (await res.json())?.data?.items ?? []
  return items.sort((a, b) => (b.messageCount ?? 0) - (a.messageCount ?? 0))[0]?.id ?? null
}
const K = 320
let pass = 0
let fail = 0
const check = (name, ok, detail = '') => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
const near = (a, b, tol = 1.5) => Math.abs(a - b) <= tol

const FAKE_VV = `(() => {
  const et = new EventTarget(); const st = { h: null, top: 0, scale: 1 };
  const fake = { get width() { return innerWidth }, get height() { return st.h ?? innerHeight }, get offsetTop() { return st.top },
    get offsetLeft() { return 0 }, get pageTop() { return st.top }, get pageLeft() { return 0 }, get scale() { return st.scale },
    addEventListener: et.addEventListener.bind(et), removeEventListener: et.removeEventListener.bind(et), dispatchEvent: et.dispatchEvent.bind(et) };
  Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => fake });
  window.__kb = (h, scale = 1) => { st.h = h; st.scale = scale; et.dispatchEvent(new Event('resize')) };
})()`

const browser = await chromium.launch({ executablePath: args.chrome ?? '/usr/bin/google-chrome', headless: true })
const writes = []

async function open(path, { width = 390, height = 780, mobile = true, fakeVV = false, stubTalk = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2, locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
  const [name, ...rest] = cookie.split('=')
  await ctx.addCookies([{ name, value: rest.join('='), url: BASE, httpOnly: true, sameSite: 'Lax' }])
  await ctx.route('**/api/**', async (route) => {
    const req = route.request()
    if (req.method() !== 'GET' && req.method() !== 'HEAD') {
      writes.push(`${req.method()} ${new URL(req.url()).pathname}`)
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'blocked in test' }) })
    }
    if (stubTalk && new URL(req.url()).pathname === `/api/v1/chats/${rooms.chat}`) {
      const res = await route.fetch()
      const j = await res.json()
      if (j?.data?.chat) j.data.chat.kind = 'TALK'
      return route.fulfill({ response: res, json: j })
    }
    return route.continue()
  })
  if (fakeVV) await ctx.addInitScript(FAKE_VV)
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' })
  return { ctx, page, errors, width, height }
}

const state = (page) =>
  page.evaluate(() => {
    const root = document.documentElement
    const tab = document.querySelector('[data-tabbar]')
    const shell = document.querySelector('[data-app-shell]')
    const main = document.querySelector('[data-app-shell] main')
    return {
      kb: root.dataset.kb ?? null,
      inset: getComputedStyle(root).getPropertyValue('--kb-inset').trim(),
      tab: tab ? getComputedStyle(tab).display !== 'none' : null,
      shellBottom: shell ? shell.getBoundingClientRect().bottom : null,
      mainBottom: main ? main.getBoundingClientRect().bottom : null,
      innerH: innerHeight,
      overflowX: document.documentElement.scrollWidth - innerWidth,
    }
  })
const rectOf = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom, height: r.height }
  }, sel)
const headerBottom = (page) =>
  page.evaluate(() => {
    const h = document.querySelector('[data-app-shell] main header')
    return h ? h.getBoundingClientRect().bottom : 0
  })
const dialogRect = (page) =>
  page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    if (!d) return null
    const r = d.getBoundingClientRect()
    const w = d.parentElement.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom, height: r.height, maxH: getComputedStyle(d).maxHeight, wrapBottom: w.bottom }
  })
const kbUp = async (page, w, h) => {
  await page.setViewportSize({ width: w, height: h - K })
  await page.waitForTimeout(600)
}
const kbDown = async (page, w, h) => {
  await page.setViewportSize({ width: w, height: h })
  await page.waitForTimeout(300)
}
const scrollMainTo = (page, sel, ratio) =>
  page.evaluate(
    ([s, r]) => {
      const el = document.querySelector(s)
      const main = document.querySelector('[data-app-shell] main')
      main.scrollTop += el.getBoundingClientRect().top - r * innerHeight
    },
    [sel, ratio],
  )

// ── A 단어장 검색(R6·D1) ─────────────────────────────────────────
for (const w of [360, 390, 412]) {
  const H = 780
  const { ctx, page, errors } = await open('/drawer/words', { width: w, height: H })
  const S = 'input[aria-label="단어 검색"]'
  await page.waitForSelector(S)
  await page.waitForTimeout(500)
  let s = await state(page)
  check(`A${w} 키보드 없음: 화면 그대로(탭 보임·셸=${H}·inset 0)`, s.kb === null && s.tab === true && near(s.shellBottom, H) && s.inset === '0px', JSON.stringify(s))
  await page.focus(S)
  await kbUp(page, w, H)
  s = await state(page)
  const r = await rectOf(page, S)
  check(`A${w} 키보드: data-kb·탭 숨김(D1 A)`, s.kb === 'open' && s.tab === false, JSON.stringify(s))
  check(`A${w} 검색창 제자리·목록 끝이 키보드 위`, r.bottom <= H - K && near(s.mainBottom, H - K), `input ${Math.round(r.top)}~${Math.round(r.bottom)} main ${s.mainBottom}`)
  check(`A${w} 가로 넘침 0`, s.overflowX <= 0)
  if (w === 390) await page.screenshot({ path: `${OUT}/A390-search-kb.png` })
  await kbDown(page, w, H) // 뒤로 제스처로 내림 — 포커스는 그대로
  s = await state(page)
  check(`A${w} 키보드 내림(포커스 유지): 탭 원위치`, s.kb === null && s.tab === true, JSON.stringify(s))
  check(`A${w} 콘솔 오류 0`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

// ── B 설정 폼(R5·D1) ───────────────────────────────────────────
for (const w of [360, 390, 412]) {
  const H = 780
  const { ctx, page, errors } = await open('/settings', { width: w, height: H })
  const S = '#teacherName'
  try {
    await page.waitForSelector(S, { timeout: 20000 })
  } catch {
    check(`B${w} 설정 화면 열림`, false, '입력 칸 못 찾음(다른 작업 중일 수 있음)')
    await ctx.close()
    continue
  }
  await page.waitForTimeout(500)
  await scrollMainTo(page, S, 0.72)
  await page.focus(S)
  await kbUp(page, w, H)
  const s = await state(page)
  const r = await rectOf(page, S)
  const hb = await headerBottom(page)
  check(`B${w} 키보드: 탭 숨김`, s.kb === 'open' && s.tab === false)
  check(`B${w} 선생님 이름 칸이 키보드 위 16px 이상·헤더 밑`, r.bottom + 16 <= H - K + 1 && r.top >= hb - 1, `칸 ${Math.round(r.top)}~${Math.round(r.bottom)} 보이는 끝 ${H - K} 헤더 ${Math.round(hb)}`)
  if (w === 390) await page.screenshot({ path: `${OUT}/B390-settings-kb.png` })
  await page.focus('#displayName')
  await page.waitForTimeout(500)
  const r2 = await rectOf(page, '#displayName')
  check(`B${w} 열린 채 다른 칸으로: 그 칸도 보임`, r2.bottom + 16 <= H - K + 1 && r2.top >= hb - 1, `칸 ${Math.round(r2.top)}~${Math.round(r2.bottom)}`)
  check(`B${w} 콘솔 오류 0`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

// ── C 새 채팅 시트(R4·D2 A) ────────────────────────────────────
for (const [w, H] of [[360, 780], [390, 780], [412, 780], [412, 892]]) {
  const { ctx, page, errors } = await open('/study/ai?tab=chat', { width: w, height: H })
  await page.getByRole('button', { name: '＋ 새 채팅' }).click()
  const S = 'input[placeholder="비워 두면 자동으로 정해져요"]'
  await page.waitForSelector(S)
  await page.waitForTimeout(300)
  let d = await dialogRect(page)
  check(`C${w}x${H} 키보드 없음: 시트 바닥·최대 85%`, near(d.bottom, H) && near(d.wrapBottom, H) && d.maxH === '85%', JSON.stringify(d))
  await page.focus(S)
  await kbUp(page, w, H)
  d = await dialogRect(page)
  const r = await rectOf(page, S)
  const btn = await page.evaluate(() => {
    const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) => x.textContent?.includes('시작하기'))
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { bottom: r.bottom, inBody: !!b.closest('.overflow-y-auto') }
  })
  check(`C${w}x${H} 키보드: 시트 통째로 키보드 위·최대 85%(남은 높이)`, near(d.bottom, H - K) && d.height <= (H - K) * 0.85 + 1, JSON.stringify(d))
  check(`C${w}x${H} 제목 칸 아래 16px 여유`, r.bottom + 16 <= d.bottom + 1, `칸 끝 ${Math.round(r.bottom)} 시트 끝 ${Math.round(d.bottom)}`)
  check(`C${w}x${H} [시작하기]는 시트 내용 안 제자리(D2 A)`, btn && btn.inBody, JSON.stringify(btn))
  if (w === 390) await page.screenshot({ path: `${OUT}/C390-newchat-kb.png` })
  check(`C${w}x${H} 콘솔 오류 0`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

// ── D 단어 추가 시트(R4) ───────────────────────────────────────
{
  const w = 390
  const H = 780
  const { ctx, page, errors } = await open('/drawer/words', { width: w, height: H })
  await page.getByRole('button', { name: '단어 추가' }).click()
  const S = 'input[placeholder^="예: 映画"]'
  await page.waitForSelector(S)
  await page.focus(S)
  await kbUp(page, w, H)
  const d = await dialogRect(page)
  const r = await rectOf(page, S)
  const s = await state(page)
  check('D390 단어 추가 시트: 키보드 위·표현 칸 16px 여유·뒤 탭 숨김', near(d.bottom, H - K) && r.bottom + 16 <= d.bottom + 1 && s.tab === false, `시트 ${JSON.stringify(d)} 칸 ${Math.round(r.bottom)}`)
  await page.screenshot({ path: `${OUT}/D390-wordadd-kb.png` })
  check('D390 콘솔 오류 0', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

// ── E 채팅방 입력 바(R2) ───────────────────────────────────────
const composerInfo = (page) =>
  page.evaluate(() => {
    const ta = document.querySelector('textarea[aria-label="메시지 입력"]')
    const bar = ta?.closest('form')?.parentElement
    if (!bar) return null
    const r = bar.getBoundingClientRect()
    let sc = ta.closest('[data-app-shell]').querySelector('main .overflow-y-auto')
    return {
      bottom: r.bottom,
      pb: getComputedStyle(bar).paddingBottom,
      mb: getComputedStyle(bar).marginBottom,
      listGap: sc ? Math.round(sc.scrollHeight - sc.scrollTop - sc.clientHeight) : null,
    }
  })
for (const [w, H] of [[360, 780], [390, 780], [412, 780], [412, 892]]) {
  if (!rooms.chat) break
  const { ctx, page, errors } = await open(`/study/ai/chat/${rooms.chat}`, { width: w, height: H })
  await page.waitForSelector('textarea[aria-label="메시지 입력"]', { timeout: 30000 })
  await page.waitForTimeout(800)
  let c = await composerInfo(page)
  check(`E${w}x${H} 키보드 없음: 입력 바 바닥`, near(c.bottom, H), JSON.stringify(c))
  const phantom = await page.evaluate(() => { const m = document.querySelector('[data-app-shell] main'); return m.scrollHeight - m.clientHeight })
  check(`E${w}x${H} 방 바깥 main 에 헛 스크롤 없음(sr-only 새는 것 수정)`, phantom <= 1, `${phantom}px`)
  await page.focus('textarea[aria-label="메시지 입력"]')
  await kbUp(page, w, H)
  c = await composerInfo(page)
  const s = await state(page)
  check(`E${w}x${H} 키보드: 입력 바가 키보드 바로 위·제스처 여백 0`, near(c.bottom, H - K) && c.pb === '8px' && c.mb === '0px' && s.kb === 'open', JSON.stringify(c))
  check(`E${w}x${H} 대화 목록 맨 아래 유지`, c.listGap !== null && c.listGap <= 2, `남은 ${c.listGap}px`)
  check(`E${w}x${H} 가로 넘침 0`, s.overflowX <= 0)
  if (w === 390) {
    await page.fill('textarea[aria-label="메시지 입력"]', 'あ'.repeat(1001))
    await page.$eval('button[aria-label^="1,000자까지"]', (b) => b.click())
    await page.waitForTimeout(300)
    const t = await rectOf(page, '[role="status"].fixed')
    check('E390 토스트가 키보드 위(R7)', t && t.bottom <= H - K - 80, JSON.stringify(t))
    await page.screenshot({ path: `${OUT}/E390-chat-kb.png` })
    await page.fill('textarea[aria-label="메시지 입력"]', '')
  }
  check(`E${w}x${H} 콘솔 오류 0`, errors.length === 0, errors.join(' | '))
  await ctx.close()
}

// ── F 회화방 글자 모드(R2, 사용자 재현 화면 — 방 종류만 가짜 TALK) ──────────
if (rooms.chat) {
  const w = 390
  const H = 780
  const { ctx, page, errors } = await open(`/study/ai/talk/${rooms.chat}`, { width: w, height: H, stubTalk: true })
  try {
    await page.waitForSelector('button[aria-label="글자로 입력하기"]', { timeout: 30000 })
    await page.waitForTimeout(1500)
    const kd = await page.$eval('button[aria-label="글자로 입력하기"]', (b) => b.getAttribute('aria-disabled'))
    console.log('talk keyboard aria-disabled =', kd, '| state =', await page.$eval('[data-talk-state]', (e) => e.getAttribute('data-talk-state')))
    await page.$eval('button[aria-label="글자로 입력하기"]', (b) => b.click())
    await page.waitForSelector('textarea[aria-label="메시지 입력"]', { timeout: 8000 })
    await page.focus('textarea[aria-label="메시지 입력"]')
    await kbUp(page, w, H)
    const c = await composerInfo(page)
    const s = await state(page)
    check('F390 회화방 글자 모드: 입력 바가 키보드 바로 위·목록 맨 아래', near(c.bottom, H - K) && c.pb === '8px' && s.kb === 'open' && c.listGap <= 2, JSON.stringify(c))
    await page.screenshot({ path: `${OUT}/F390-talk-text-kb.png` })
  } catch (e) {
    check('F390 회화방 글자 모드 열림', false, String(e).slice(0, 200))
  }
  check('F390 콘솔 오류 0', errors.length === 0, errors.join(' | ').slice(0, 300))
  await ctx.close()
}

// ── G 붙여넣기 수업(R5, 긴 글 칸) ───────────────────────────────
{
  const w = 390
  const H = 780
  const { ctx, page, errors } = await open('/study/today/talk/new/paste', { width: w, height: H })
  try {
    await page.waitForSelector('textarea', { timeout: 20000 })
    await scrollMainTo(page, 'textarea', 0.7)
    await page.focus('textarea')
    await kbUp(page, w, H)
    const r = await rectOf(page, 'textarea')
    const hb = await headerBottom(page)
    check('G390 붙여넣기 칸이 키보드 위 16px 이상', r.bottom + 16 <= H - K + 1 && r.top >= hb - 1, `칸 ${Math.round(r.top)}~${Math.round(r.bottom)} 헤더 ${Math.round(hb)}`)
    await page.screenshot({ path: `${OUT}/G390-paste-kb.png` })
  } catch (e) {
    check('G390 붙여넣기 화면 열림', false, String(e).slice(0, 200))
  }
  check('G390 콘솔 오류 0', errors.length === 0, errors.join(' | ').slice(0, 300))
  await ctx.close()
}

// ── ② 덮기만 하는 경로(가짜 visualViewport) ──────────────────────
if (rooms.chat) {
  const w = 390
  const H = 780
  const { ctx, page, errors } = await open(`/study/ai/chat/${rooms.chat}`, { width: w, height: H, fakeVV: true })
  await page.waitForSelector('textarea[aria-label="메시지 입력"]', { timeout: 30000 })
  await page.waitForTimeout(600)
  await page.focus('textarea[aria-label="메시지 입력"]')
  await page.evaluate((h) => window.__kb(h), H - K)
  await page.waitForTimeout(500)
  let s = await state(page)
  const c = await composerInfo(page)
  check('V390 ②: --kb-inset=320px·셸이 그만큼 줄고 입력 바가 키보드 위', s.inset === `${K}px` && near(s.shellBottom, H - K) && near(c.bottom, H - K) && c.mb === '0px', `${JSON.stringify(s)} ${JSON.stringify(c)}`)
  await page.fill('textarea[aria-label="메시지 입력"]', 'あ'.repeat(1001))
  await page.$eval('button[aria-label^="1,000자까지"]', (b) => b.click())
  await page.waitForTimeout(300)
  const t = await rectOf(page, '[role="status"].fixed')
  check('V390 ② 토스트가 키보드 위', t && t.bottom <= H - K - 80, JSON.stringify(t))
  await page.evaluate((h) => window.__kb(h, 2), H - K) // 두 손가락 확대로 줄어든 것
  await page.waitForTimeout(300)
  s = await state(page)
  check('V390 ② 두 손가락 확대는 키보드 아님', s.kb === null && s.inset === '0px', JSON.stringify(s))
  check('V390 콘솔 오류 0', errors.length === 0, errors.join(' | '))
  await ctx.close()
}
{
  const w = 390
  const H = 780
  const { ctx, page, errors } = await open('/study/ai?tab=chat', { width: w, height: H, fakeVV: true })
  await page.getByRole('button', { name: '＋ 새 채팅' }).click()
  const S = 'input[placeholder="비워 두면 자동으로 정해져요"]'
  await page.waitForSelector(S)
  await page.focus(S)
  await page.evaluate((h) => window.__kb(h), H - K)
  await page.waitForTimeout(500)
  const d = await dialogRect(page)
  const s = await state(page)
  check('V390 ② 시트가 키보드 위·최대 85%(남은 높이)·탭 숨김', near(d.bottom, H - K) && d.height <= (H - K) * 0.85 + 1 && s.tab === false, `${JSON.stringify(d)} ${JSON.stringify(s)}`)
  await page.screenshot({ path: `${OUT}/V390-sheet-overlay-kb.png` })
  check('V390 시트 콘솔 오류 0', errors.length === 0, errors.join(' | '))
  await ctx.close()
}

// ── 오탐 방지: 데스크톱(마우스) 창 줄이기 · 앱 WebView 지금(아무 신호 없음) ────────
{
  const w = 1280
  const H = 900
  const { ctx, page } = await open('/drawer/words', { width: w, height: H, mobile: false })
  await page.waitForSelector('input[aria-label="단어 검색"]')
  await page.focus('input[aria-label="단어 검색"]')
  await page.setViewportSize({ width: w, height: 500 })
  await page.waitForTimeout(400)
  const s = await state(page)
  check('X 데스크톱 창 줄이기는 키보드 아님(탭 유지)', s.kb === null && s.tab === true, JSON.stringify(s))
  await ctx.close()
}
{
  const w = 390
  const H = 780
  const { ctx, page } = await open('/drawer/words', { width: w, height: H })
  await page.waitForSelector('input[aria-label="단어 검색"]')
  await page.focus('input[aria-label="단어 검색"]')
  await page.waitForTimeout(400)
  const s = await state(page)
  check('X 포커스만 있고 화면 변화 없음(지금 앱 WebView): 아무것도 안 바뀜', s.kb === null && s.tab === true && s.inset === '0px' && near(s.shellBottom, H), JSON.stringify(s))
  await ctx.close()
}

// ── Y 기준 높이 전이(REV-042 M1) ────────────────────────────────────────
{
  const w = 390
  const H = 780
  // 에뮬레이션은 화면 방향을 뷰포트 비율로 정해, 높이가 폭보다 작아지면 orientationchange(= 기준 초기화)를 쏜다 — 실기기 키보드는 그러지 않으므로 세로를 유지하는 높이만 쓴다.
  const SPLIT = 640
  const S = 'input[aria-label="단어 검색"]'
  const { ctx, page, errors } = await open('/drawer/words', { width: w, height: H })
  await page.waitForSelector(S)
  await page.waitForTimeout(500)
  await page.setViewportSize({ width: w, height: SPLIT }) // 위아래 분할 화면 — 칸 포커스 없음
  await page.waitForTimeout(400)
  await page.focus(S)
  await page.waitForTimeout(400)
  let s = await state(page)
  check('Y390 포커스 없이 창이 줄어든 뒤(분할 화면) 칸 포커스: 키보드 아님(탭 유지)', s.kb === null && s.tab === true, JSON.stringify(s))
  await page.setViewportSize({ width: w, height: SPLIT - 220 }) // 그 창에서 키보드
  await page.waitForTimeout(600)
  s = await state(page)
  check('Y390 분할 화면에서 키보드가 올라오면 열림', s.kb === 'open' && s.tab === false, JSON.stringify(s))
  await ctx.close()
  check('Y390 분할 화면 콘솔 오류 0', errors.length === 0, errors.join(' | '))
}
{
  const w = 390
  const H = 780
  const S = 'input[aria-label="단어 검색"]'
  const { ctx, page, errors } = await open('/drawer/words', { width: w, height: H })
  await page.waitForSelector(S)
  await page.waitForTimeout(500)
  await page.focus(S)
  await kbUp(page, w, H)
  await page.evaluate(() => document.activeElement?.blur()) // 키보드가 떠 있는 채 포커스가 잠깐 빠짐(단추 등)
  await page.waitForTimeout(150)
  let s = await state(page)
  check('Y390 포커스가 빠지면 닫힘(탭 복귀)', s.kb === null && s.tab === true, JSON.stringify(s))
  await page.focus(S) // 1초 안에 다시 칸으로 — 키보드는 그대로
  await page.waitForTimeout(400)
  s = await state(page)
  check('Y390 곧바로 다시 칸으로 오면 열림 유지(내려가는 중의 창을 기준으로 삼지 않음)', s.kb === 'open' && s.tab === false, JSON.stringify(s))
  await ctx.close()
  check('Y390 재포커스 콘솔 오류 0', errors.length === 0, errors.join(' | '))
}

await browser.close()
console.log(`\n결과: PASS ${pass} · FAIL ${fail} · 막은 쓰기 요청 ${writes.length}건 (${[...new Set(writes)].join(', ')})`)
