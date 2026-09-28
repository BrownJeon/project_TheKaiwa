/**
 * task-003f 앱 전용 화면 E2E(실 Chrome + Playwright, 가짜 `window.Capacitor`) — 완료 기준 2·7·8(screens §11-7 ⑨·§11-9).
 *
 *   웹 회귀(가짜 없음): 설정·로그인·회화방에 앱 요소 DOM 0, `/api/app/version` 요청 0.
 *   앱 모드(360·390·412): 휴대폰에서 알아듣기 카드 상태(absent·needsConsent·downloading·paused·installed·새 버전·오류 4종) · 방식 설명 ·
 *   마이크 테스트 경로 한 줄·휴대폰 경로 인식(업로드 없음) · 권한 rationale·denied(+[앱 설정 열기]) · 업데이트 띠 권장/강제·시트·앱 버전 줄 ·
 *   로그인 대기·닫힘·마무리(PKCE: 시작 URL 에 challenge, 교환 URL 에 verifier) · 회화방 메뉴 "알아듣는 곳" · 관리자 진단 카드(USER 0) ·
 *   가로 넘침 0 · 화면 글자 엔진명 0.
 *
 * 실행(dev 서버를 따로 — `SPEECH_MODELS_DIR=<NFS>/speech/models next dev -H 127.0.0.1 -p 3011`):
 *   node --env-file=.env --import tsx tests/live/task003f-ui-e2e.mjs --base http://127.0.0.1:3011 --user <USER 쿠키> --admin <ADMIN 쿠키> [--out <스크린샷 디렉터리>]
 * DB 에 쓰는 것: QA 계정 TALK 방 1개(끝에 삭제). 쿠키·코드·verifier 는 출력하지 않는다.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []))
const BASE = args.base ?? 'http://127.0.0.1:3011'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만 허용')
const OUT = args.out ?? null
if (OUT) mkdirSync(OUT, { recursive: true })
const C_USER = readFileSync(args.user, 'utf8').trim()
const C_ADMIN = readFileSync(args.admin, 'utf8').trim()
const FAKE = join(dirname(fileURLToPath(import.meta.url)), 'fake-capacitor.js')

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ENGINE_RE = /reazon|sherpa|zipformer|onnx|int8|whisper|style-?bert|ondevice-ja|manifest|gateway|connectionKey/i

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true })

async function context({ width = 390, height = 844, cookie = C_USER, app = true, init = {}, version = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  if (cookie) {
    const [name, ...rest] = cookie.split('=')
    await ctx.addCookies([{ name, value: rest.join('='), url: BASE, httpOnly: true, sameSite: 'Lax' }])
  }
  if (app) {
    await ctx.addInitScript({ content: `window.__FAKE_CAP_INIT = ${JSON.stringify(init)}` })
    await ctx.addInitScript({ path: FAKE })
  }
  const versionCalls = []
  await ctx.route('**/api/app/version', async (route) => {
    versionCalls.push(route.request().headers())
    if (!version) return route.continue()
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: version, message: null }) })
  })
  return { ctx, versionCalls }
}

async function shot(page, name) {
  if (OUT) await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false })
}
async function noOverflow(page) {
  return page.evaluate(() => {
    const main = document.querySelector('[data-app-shell] main') ?? document.scrollingElement
    return document.documentElement.scrollWidth <= window.innerWidth + 1 && (main ? main.scrollWidth <= main.clientWidth + 1 : true)
  })
}
async function visibleText(page) {
  return page.evaluate(() => document.body.innerText)
}
const calls = (page) => page.evaluate(() => window.__fakeCap.calls)
const card = (page) => page.locator('#ondevice-card')

const rel = (o) => ({ latest: '1.1.0', latestCode: 2, minSupported: '1.0.0', minSupportedCode: 1, url: `${BASE}/app/download/latest.apk`, notes: '휴대폰 인식 개선\n로그인 안정화', sha256: 'a'.repeat(64), bytes: 31_457_280, publishedAt: '2026-09-28T00:00:00.000Z', updateAvailable: true, reinstallRequired: true, updateRequired: false, ...o })

try {
  // ── 1. 웹 회귀 ─────────────────────────────────────────────────────────
  {
    const { ctx, versionCalls } = await context({ app: false })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/settings`)
    await page.getByRole('radiogroup', { name: '음성 인식 방식' }).waitFor()
    await sleep(800)
    const counts = await page.evaluate(() => ({
      card: document.querySelectorAll('#ondevice-card').length,
      banner: document.querySelectorAll('[data-app-update]').length,
      diag: document.querySelectorAll('[data-ondevice-diagnostics]').length,
      version: document.body.innerText.includes('앱 버전'),
    }))
    check('웹 1 설정: 카드·띠·진단·앱 버전 줄 DOM 0', counts.card === 0 && counts.banner === 0 && counts.diag === 0 && !counts.version, JSON.stringify(counts))
    const text = await visibleText(page)
    check('웹 2 경로 한 줄 = 서버 · 방식 설명 웹 문구(빠르게 = 웹에서는 서버)', text.includes('지금은 서버에서 알아들어요.') && text.includes('웹에서는 서버에서 알아들어요(앱에서는 휴대폰에서)') && text.includes('앱에서만 쓸 수 있어요'))
    check('웹 3 #8 요청 0', versionCalls.length === 0)
    await shot(page, 'web-settings-390')
    await page.context().clearCookies()
    await page.goto(`${BASE}/login`)
    await sleep(500)
    const lt = await visibleText(page)
    check('웹 4 로그인: 앱 안내 줄·대기 요소 없음, 링크 그대로', !lt.includes('앱에서는 Chrome 창') && (await page.locator('[data-app-login]').count()) === 0 && (await page.locator('a[href^="/api/auth/google"]').count()) === 1)
    await ctx.close()
  }

  // ── 2. 앱 모드 — 카드 상태 3폭 ──────────────────────────────────────────
  for (const width of [360, 390, 412]) {
    const { ctx, versionCalls } = await context({ width, init: { model: 'absent' }, version: rel({ latestCode: 1, latest: '1.0.0' }) })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/settings`)
    await card(page).waitFor({ timeout: 15000 })
    await page.getByText('휴대폰에 받기 (약 170MB)').waitFor()
    const t = await visibleText(page)
    check(`앱 ${width} absent: 크기(#19 totalBytes)·받기 전 안내·알아 두세요`, t.includes('약 170MB · Wi-Fi 에서 받아요') && t.includes('받기 전에도 회화는 서버에서 알아들어요.') && t.includes('30일 뒤 자동 삭제'))
    check(`앱 ${width} 경로 한 줄 = 파일 없음 + 위에서 받을 수 있어요`, t.includes('휴대폰 인식 파일을 받으면 휴대폰에서 알아들어요 — 위에서 받을 수 있어요.'))
    check(`앱 ${width} 방식 설명: 오프라인 비활성(파일 받은 뒤)`, t.includes('휴대폰 인식 파일을 받은 뒤 고를 수 있어요') && (await page.getByRole('radio', { name: /오프라인/ }).isDisabled()))
    check(`앱 ${width} 가로 넘침 0(absent)`, await noOverflow(page))
    check(`앱 ${width} #8 은 앱에서 1회·번호 헤더`, versionCalls.length >= 1 && versionCalls[0]['x-app-build'] === '1')
    await shot(page, `app-card-absent-${width}`)

    // 모바일 데이터 → 동의
    await page.evaluate(() => window.__fakeCap.set({ network: 'metered', manualProgress: true }))
    await page.getByText('휴대폰에 받기 (약 170MB)').click()
    await page.getByText('지금은 Wi-Fi 가 아니에요.').waitFor()
    check(`앱 ${width} needsConsent: 데이터로 받기·나중에`, (await page.getByRole('button', { name: '데이터로 받기' }).count()) === 1 && (await page.getByRole('button', { name: '나중에' }).count()) === 1)
    await shot(page, `app-card-consent-${width}`)
    await page.getByRole('button', { name: '데이터로 받기' }).click()
    await page.waitForFunction(() => window.__fakeCap.get().downloading)
    await page.evaluate(() => window.__fakeCap.progress(0.5))
    await page.getByRole('progressbar', { name: '휴대폰 인식 파일 받기' }).waitFor()
    const pv = await page.getByRole('progressbar').getAttribute('aria-valuenow')
    const dl = (await calls(page)).filter((c) => c.name === 'downloadModel')
    check(`앱 ${width} downloading: 진행률 50%·데이터 동의 뒤 wifiOnly=false·같은 origin 절대 manifest URL`, pv === '50' && dl.at(-1)?.arg.wifiOnly === false && dl.at(-1)?.arg.manifestUrl === `${BASE}/models/ondevice-ja-v1/manifest.json`, `now=${pv}`)
    check(`앱 ${width} 가로 넘침 0(downloading)`, await noOverflow(page))
    await shot(page, `app-card-downloading-${width}`)
    await page.getByRole('button', { name: '일시정지' }).click()
    await page.getByRole('button', { name: '이어받기' }).waitFor()
    check(`앱 ${width} paused: 이어받기·받은 것 지우기`, (await page.getByText('받은 것 지우기').count()) === 1 && (await card(page).innerText()).includes('멈춤'))
    await shot(page, `app-card-paused-${width}`)
    await page.evaluate(() => window.__fakeCap.set({ manualProgress: false }))
    await page.getByRole('button', { name: '이어받기' }).click()
    await page.getByText('준비됐어요. 이제 휴대폰에서 알아들어요.').waitFor({ timeout: 10000 })
    const ti = await visibleText(page)
    check(`앱 ${width} installed: 완료 안내·경로 줄·지우기·경로 한 줄 = 휴대폰`, ti.includes('휴대폰에 받아 두었어요. 회화와 마이크 테스트에서 휴대폰으로 알아들어요.') && ti.includes('지금은 휴대폰에서 알아들어요.') && (await page.getByRole('button', { name: '지우기' }).count()) === 1)
    check(`앱 ${width} 가로 넘침 0(installed)`, await noOverflow(page))
    await shot(page, `app-card-installed-${width}`)
    await ctx.close()
  }

  // ── 3. 앱 — 새 버전·오류·지우기·휴대폰 경로 인식 ───────────────────────────
  {
    const { ctx } = await context({ init: { model: 'outdated' } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/settings`)
    await page.getByRole('button', { name: '새 버전 받기' }).waitFor({ timeout: 15000 })
    check('앱 새 버전: 안내 상자·지금 버전으로 계속', (await visibleText(page)).includes('받는 동안에도 지금 버전으로 알아들어요.'))
    await shot(page, 'app-card-outdated-390')
    await ctx.close()
  }
  for (const [code, text, button] of [
    ['INSUFFICIENT_STORAGE', '휴대폰 저장 공간이 부족해요.', '다시 받기'],
    ['DOWNLOAD_FAILED', '파일을 다 받지 못했어요.', '이어받기'],
    ['MANIFEST_INVALID', '지금은 파일을 받을 수 없어요.', '다시 시도'],
    ['APP_UPDATE_REQUIRED', '새 앱에서만 받을 수 있는 버전이에요.', '설치 방법'],
  ]) {
    const { ctx } = await context({ width: 360, init: { model: 'absent', failNext: code } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/settings`)
    await page.getByText('휴대폰에 받기 (약 170MB)').click()
    await page.getByText(text).waitFor({ timeout: 10000 })
    const alert = card(page).getByRole('alert')
    const at = await alert.innerText()
    check(`앱 오류 ${code}: 1줄·2줄·버튼 1개·뱃지 문제 있음`, at.includes(text) && at.includes(button) && (await card(page).innerText()).includes('문제 있음') && !ENGINE_RE.test(at))
    await shot(page, `app-card-error-${code}-360`)
    await ctx.close()
  }
  {
    const { ctx } = await context({ init: { model: 'installed' } })
    const page = await ctx.newPage()
    const uploads = []
    page.on('request', (r) => {
      if (r.url().includes('/api/v1/speech/utterances')) uploads.push(r.url())
    })
    await page.goto(`${BASE}/settings`)
    await page.getByText('지금은 휴대폰에서 알아들어요.').waitFor({ timeout: 15000 })
    const btn = page.getByRole('button', { name: '누르고 있는 동안 말하기' })
    await btn.scrollIntoViewIfNeeded()
    const box = await btn.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await sleep(1400)
    await page.mouse.up()
    // 자리표시 문장(예: こんにちは)이 사라지고 알아들은 말이 그 자리에 온다.
    await page.getByText('여기에 알아들은 말이 나와요', { exact: false }).waitFor({ state: 'detached', timeout: 8000 })
    await page.locator('p[lang="ja"]', { hasText: 'こんにちは' }).first().waitFor({ timeout: 8000 })
    const all = await calls(page)
    const cs = all.map((c) => c.name)
    const startArg = all.find((c) => c.name === 'start')?.arg
    check('앱 마이크 테스트 휴대폰 경로: start→stop, 알아들은 말 표시, 업로드 없음(MIC_TEST)', cs.includes('start') && cs.includes('stop') && uploads.length === 0 && startArg?.saveWav === false, `calls=${cs.join(',')} uploads=${uploads.length} saveWav=${startArg?.saveWav}`)
    await shot(page, 'app-mictest-ondevice-390')
    // 지우기 → 서버 경로
    await page.getByRole('button', { name: '지우기' }).click()
    await page.getByRole('dialog', { name: '휴대폰 인식 파일 지우기' }).waitFor()
    await shot(page, 'app-card-delete-sheet-390')
    await page.getByRole('dialog').getByRole('button', { name: '지우기' }).click()
    await page.getByText('휴대폰에 받기 (약 170MB)').waitFor({ timeout: 8000 })
    check('앱 지우기 → absent·경로 한 줄 서버', (await visibleText(page)).includes('휴대폰 인식 파일을 받으면 휴대폰에서 알아들어요'))
    await ctx.close()
  }

  // ── 4. 앱 — 권한 ────────────────────────────────────────────────────────
  {
    const { ctx } = await context({ init: { model: 'installed', perm: 'rationale' } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/settings`)
    await page.getByText('말을 알아들으려면 마이크가 필요해요. 누르면 다시 물어봐요.').waitFor({ timeout: 15000 })
    check('앱 권한 rationale: 누르기 전 이유 한 줄', true)
    await shot(page, 'app-perm-rationale-390')
    await ctx.close()
  }
  {
    const { ctx } = await context({ width: 360, init: { model: 'installed', perm: 'denied' } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/settings`)
    await page.getByText('마이크 사용이 막혀 있어요.').waitFor({ timeout: 15000 })
    const t = await visibleText(page)
    check('앱 권한 denied: 앱 문구 + [앱 설정 열기]', t.includes('앱 설정 → 권한 → 마이크') && (await page.getByRole('button', { name: '앱 설정 열기' }).count()) === 1)
    await page.getByRole('button', { name: '앱 설정 열기' }).click()
    await sleep(200)
    check('앱 권한 denied: 버튼 → openAppSettings 호출', (await calls(page)).some((c) => c.name === 'openAppSettings'))
    await page.evaluate(() => {
      window.__fakeCap.set({ perm: 'granted' })
      window.__fakeCap.emit('resume')
    })
    await page.getByText('마이크 사용이 막혀 있어요.').waitFor({ state: 'detached', timeout: 5000 })
    check('앱 권한: 돌아와 허용이면 띠가 사라진다(녹음 시작 없음)', !(await calls(page)).some((c) => c.name === 'start'))
    await shot(page, 'app-perm-denied-360')
    await ctx.close()
  }

  // ── 5. 앱 — 업데이트 띠·시트·앱 버전 줄 ─────────────────────────────────
  for (const width of [360, 412]) {
    const { ctx } = await context({ width, init: { model: 'absent' }, version: rel() })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/study/today`)
    const band = page.locator('[data-app-update="recommended"]')
    await band.waitFor({ timeout: 15000 })
    check(`앱 ${width} 권장 띠: v1.1.0·받기·오늘은 그만 보기`, (await band.innerText()).includes('새 앱 버전이 있어요 · v1.1.0') && (await band.getByRole('button', { name: '오늘은 그만 보기' }).count()) === 1)
    check(`앱 ${width} 가로 넘침 0(권장 띠)`, await noOverflow(page))
    await shot(page, `app-banner-recommended-${width}`)
    await band.getByRole('button', { name: /새 앱 버전이 있어요/ }).click()
    const sheet = page.getByRole('dialog', { name: '앱 업데이트' })
    await sheet.waitFor()
    const st = await sheet.innerText()
    check(`앱 ${width} 설치 시트: v1.0.0 → v1.1.0·9월 28일·약 31MB·바뀐 점·4단계`, st.includes('v1.0.0 → v1.1.0') && st.includes('9월 28일 올라온 버전') && st.includes('약 31MB') && st.includes('로그인 안정화') && st.includes('출처를 알 수 없는 앱'))
    await shot(page, `app-update-sheet-${width}`)
    await sheet.getByRole('button', { name: '업데이트 받기' }).click()
    await sleep(200)
    const open = (await calls(page)).filter((c) => c.name === 'Browser.open').at(-1)
    check(`앱 ${width} 업데이트 받기 = Custom Tabs 로 같은 출처 /app/download`, open?.arg?.download === true)
    await sheet.getByRole('button', { name: '나중에' }).click()
    await band.getByRole('button', { name: '오늘은 그만 보기' }).click()
    await sleep(200)
    check(`앱 ${width} ✕ → 그날 숨김`, (await page.locator('[data-app-update]').count()) === 0)
    await page.goto(`${BASE}/settings`)
    await page.getByText('1.0.0 · 새 버전 1.1.0 ›').waitFor({ timeout: 15000 })
    check(`앱 ${width} 설정 앱 버전 줄(닫은 뒤에도 시트로)`, true)
    await ctx.close()
  }
  {
    const { ctx } = await context({ width: 390, height: 780, init: { model: 'installed' }, version: rel({ minSupportedCode: 2, updateRequired: true }) })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/settings`)
    const forced = page.locator('[data-app-update="forced"]')
    await forced.waitFor({ timeout: 15000 })
    const ft = await forced.innerText()
    check('앱 강제 띠: 닫기 없음·v1.0.0 문구·업데이트', ft.includes('앱을 업데이트해 주세요') && ft.includes('이 버전(v1.0.0)') && (await forced.getByRole('button', { name: '오늘은 그만 보기' }).count()) === 0)
    await page.getByText('앱을 업데이트하면 휴대폰에서 알아들어요.', { exact: false }).first().waitFor({ timeout: 8000 })
    check('앱 강제 → 휴대폰 경로 끔(UPDATE_REQUIRED 경로 줄)', (await visibleText(page)).includes('지금은 서버에서 알아들어요. 앱을 업데이트하면 휴대폰에서 알아들어요.'))
    await shot(page, 'app-banner-forced-390x780')
    const ctx2 = await context({ cookie: null, init: {}, version: rel({ minSupportedCode: 2 }) })
    const lp = await ctx2.ctx.newPage()
    await lp.goto(`${BASE}/login`)
    await lp.locator('[data-app-update="forced"]').waitFor({ timeout: 15000 })
    check('앱 강제 띠: 로그인 화면에도', true)
    await shot(lp, 'app-login-forced-390')
    await ctx2.ctx.close()
    await ctx.close()
  }

  // ── 6. 앱 — 로그인 대기·닫힘·마무리(PKCE) ─────────────────────────────────
  {
    const { ctx } = await context({ cookie: null, width: 360, init: {}, version: rel({ latestCode: 1, latest: '1.0.0' }) })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/login`)
    await page.getByText('앱에서는 Chrome 창에서 로그인한 뒤 자동으로 돌아와요.').waitFor({ timeout: 15000 })
    await page.getByText('Google로 계속하기').click()
    await page.locator('[data-app-login="waiting"]').waitFor({ timeout: 8000 })
    const open = (await calls(page)).filter((c) => c.name === 'Browser.open').at(-1)
    check('앱 로그인: Custom Tab 시작 URL = platform=app + challenge(43자)', open?.arg?.path === '/api/auth/google' && open.arg.platform === 'app' && open.arg.hasChallenge === true)
    check('앱 로그인 대기 카드·다시 열기', (await visibleText(page)).includes('Chrome 창에서 로그인하고 있어요') && (await page.getByRole('button', { name: 'Chrome 창 다시 열기' }).count()) === 1)
    await shot(page, 'app-login-waiting-360')
    await page.getByRole('button', { name: 'Chrome 창 다시 열기' }).click()
    await sleep(200)
    const opens = (await calls(page)).filter((c) => c.name === 'Browser.open')
    check('앱 로그인: 다시 열기 = 같은 주소(PKCE verifier 유지)', opens.length === 2 && JSON.stringify(opens[0].arg) === JSON.stringify(opens[1].arg))
    await page.evaluate(() => window.__fakeCap.emit('browserFinished'))
    await page.getByText('로그인 창이 닫혔어요. 다시 눌러 주세요.').waitFor({ timeout: 5000 })
    check('앱 로그인: 창 닫힘 1.5초 → 닫힘 안내', true)
    await shot(page, 'app-login-closed-360')
    await page.getByText('Google로 계속하기').click()
    await page.locator('[data-app-login="waiting"]').waitFor()
    // 교환 요청은 가로채 URL 만 본다 — dev 서버의 실패 302 는 OAUTH_CALLBACK_BASE(운영 도메인)로 가므로 따라가지 않는다(서버 판정은 스모크 D3~D8).
    let exchange = null
    await page.route('**/api/auth/app-exchange**', (route) => {
      exchange = new URL(route.request().url())
      return route.fulfill({ status: 302, headers: { Location: `${BASE}/login?oauth_error=app_code_invalid` } })
    })
    await page.evaluate(() => window.__fakeCap.emit('appUrlOpen', `thekaiwa://auth/callback?code=${'ab'.repeat(32)}`))
    await page.waitForURL(/oauth_error=app_code_invalid/, { timeout: 10000 })
    check('앱 로그인 마무리: 교환 URL = code + verifier(43자) 동시, closeExternal', !!exchange && /^[0-9a-f]{64}$/.test(exchange.searchParams.get('code') ?? '') && /^[A-Za-z0-9_-]{43}$/.test(exchange.searchParams.get('verifier') ?? '') && (await calls(page).catch(() => [])).length >= 0)
    await page.getByText('로그인을 마무리하지 못했어요. 다시 눌러 주세요.').waitFor()
    check('앱 로그인: DB 에 없는 코드 → app_code_invalid 해요체 문구', true)
    await shot(page, 'app-login-invalid-360')
    await ctx.close()
  }

  // ── 7. 앱 — 회화방 메뉴 줄 · 진단 카드 ───────────────────────────────────
  let talkId = null
  {
    const r = await fetch(`${BASE}/api/v1/chats`, { method: 'POST', headers: { Cookie: C_USER, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'TALK', title: 'E2E 003f' }) })
    const j = await r.json()
    talkId = j.data?.id ?? j.data?.chat?.id ?? null
  }
  try {
    if (!talkId) throw new Error('TALK 방을 만들지 못했다')
    const { ctx } = await context({ init: { model: 'absent' } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/study/ai/talk/${talkId}`)
    await page.getByRole('button', { name: '회화 메뉴' }).click()
    await page.getByText('알아듣는 곳').waitFor({ timeout: 8000 })
    const mt = await page.getByRole('dialog').innerText()
    check('앱 회화방 메뉴: 알아듣는 곳 = 서버에서·이유(파일 받기 전)·설정 링크', mt.includes('서버에서') && mt.includes('휴대폰 인식 파일을 받기 전이에요') && mt.includes('음성 인식 설정 ›') && !ENGINE_RE.test(mt))
    await shot(page, 'app-talk-menu-390')
    await ctx.close()
    const web = await context({ app: false })
    const wp = await web.ctx.newPage()
    await wp.goto(`${BASE}/study/ai/talk/${talkId}`)
    await wp.getByRole('button', { name: '회화 메뉴' }).click()
    await wp.getByRole('dialog').waitFor()
    await sleep(300)
    check('웹 회화방 메뉴: "알아듣는 곳" 없음', !(await wp.getByRole('dialog').innerText()).includes('알아듣는 곳'))
    await web.ctx.close()
  } finally {
    if (talkId) await fetch(`${BASE}/api/v1/chats/${talkId}`, { method: 'DELETE', headers: { Cookie: C_USER } })
  }
  {
    const user = await context({ init: { model: 'installed' } })
    const up = await user.ctx.newPage()
    await up.goto(`${BASE}/settings`)
    await card(up).waitFor({ timeout: 15000 })
    await sleep(500)
    check('USER 진단 카드 DOM 0', (await up.locator('[data-ondevice-diagnostics]').count()) === 0)
    await user.ctx.close()
    const admin = await context({ cookie: C_ADMIN, init: { model: 'installed', diag: { rssMb: 640 } } })
    const ap = await admin.ctx.newPage()
    await ap.goto(`${BASE}/settings`)
    await ap.locator('[data-ondevice-diagnostics]').waitFor({ timeout: 15000 })
    const dt = await ap.locator('[data-ondevice-diagnostics]').innerText()
    check('관리자 진단 카드: 인식기·불러오기·메모리 기준 초과(640MB)·플러그인·abi', dt.includes('불러오기 시간') && dt.includes('앱 640MB') && dt.includes('기준 초과') && dt.includes('플러그인 0.1.0') && dt.includes('arm64-v8a'))
    await ap.getByRole('button', { name: '미리 불러오기' }).click()
    await sleep(400)
    check('관리자 진단: 미리 불러오기 → preload 호출·불러오기 시간 갱신', (await calls(ap)).some((c) => c.name === 'preload') && (await ap.locator('[data-ondevice-diagnostics]').innerText()).includes('0.95초'))
    await shot(ap, 'app-diagnostics-admin-390')
    await admin.ctx.close()
  }

  // ── 8. 화면 글자 엔진명 0(앱 모드 설정) ───────────────────────────────────
  {
    const { ctx } = await context({ init: { model: 'installed' }, version: rel() })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/settings`)
    await card(page).waitFor({ timeout: 15000 })
    await sleep(500)
    const t = await visibleText(page)
    check('앱 설정 화면 글자에 엔진·모델 이름·manifest 0', !ENGINE_RE.test(t), (t.match(ENGINE_RE) ?? [''])[0])
    await ctx.close()
  }
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n== task-003f UI E2E: ${results.length - failed.length}/${results.length} PASS${failed.length ? ` · FAIL ${failed.map((f) => f.name).join(' | ')}` : ''}`)
process.exitCode = failed.length ? 1 : 0
