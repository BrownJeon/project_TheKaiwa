/**
 * task-012c 콘솔 P2 화면 E2E(실 Chrome + Playwright) — 완료 기준 12(승인 데모 v2).
 *
 *   권한별 렌더(USER 404 · ADMIN Form·Raw JSON 탭 없음·비밀 참조 연결 없음 · DEVELOPER Raw JSON · SUPER 비밀 참조 연결) — 권한 없는 버튼은 DOM 0 ·
 *   Form ↔ Raw JSON 단일 초안(양방향) · Raw 문법 오류 → Form 잠금·검증 비활성 · 스키마 밖 키 → 줄 표시·제안 바꾸기 · 검증 오류 칸 ·
 *   적용 흐름(검증 → 요약 → 적용, 첫 적용 기준선 v1 + v2, 이유 필수) · 409 충돌 → [최신 값 기준으로 다시 비교](초안 유지) ·
 *   이력(버전 목록·기준선·상세 비교·되돌리기 = 새 버전 + 되돌려짐) · 감사(행 펼침 전 → 후) · 예비 순서 편집(요약까지 — 버리기) ·
 *   연결 상세 편집 모드·끄기 409(기본 연결) · 비밀 참조 시트(값 입력 칸 없음) · 운영 설정 대상 · 360/390/412/1280 가로 넘침 0 · 누를 것 ≥44px ·
 *   콘솔 오류 0. 운영(PRODUCTION) 확인 창은 QA 역할 토큰이 운영 프로세스에서 인정되지 않아 단위 테스트(flowView·configAccess·writeErrorView)로만 본다.
 *
 * 실행(격리 복제본의 dev 서버를 따로 띄운 뒤 — 접속은 127.0.0.1, APP_ENV=LOCAL 만):
 *   node --env-file=.env tests/live/task012c-ui-e2e.mjs --base http://127.0.0.1:3023 \
 *     --user <USER 쿠키> --admin <ADMIN 쿠키> --dev <DEVELOPER 쿠키> --super <SUPER_ADMIN 쿠키> [--out <스크린샷 디렉터리>]
 * 쿠키 파일은 `QA_ACCOUNT=1|admin|developer|super node --env-file=.env --import tsx tests/live/qa-session.ts <파일>`(권한 600, 출력하지 않는다).
 * DB(개발·운영 공유): **LOCAL 행만** 쓴다 — 시작 전 대상 행(연결 2·예비 순서 1)과 설정 버전 id 를 기록하고, 끝(finally)에 이 실행이 만든
 * ConfigurationVersion 만 id 로 지우고 대상 행의 관리 칸을 바이트 원복·대조한다. AuditLog 는 불변이라 남는다(QA 역할 계정 행).
 * 외부 호출 0(실행 검증 방법이 없는 키만 바꾼다 — 기능 테스트는 서버가 실행 없이 "일부만 확인"으로 답한다). task012c-smoke 와 동시에 돌리지 않는다.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { chromium } from 'playwright-core'

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []))
const BASE = args.base ?? 'http://127.0.0.1:3023'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만 허용')
if ((process.env.APP_ENV ?? 'LOCAL').toUpperCase() !== 'LOCAL') throw new Error('APP_ENV=LOCAL 에서만 돈다')
const OUT = args.out ?? null
if (OUT) mkdirSync(OUT, { recursive: true })
const cookieOf = (f) => readFileSync(f, 'utf8').trim()
const C = { user: cookieOf(args.user), admin: cookieOf(args.admin), dev: cookieOf(args.dev), super: cookieOf(args.super) }

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const API = '/api/admin/v1'

const prisma = new PrismaClient()
const ENV = 'LOCAL'
const ondevice = await prisma.engineConnection.findUniqueOrThrow({ where: { environment_key: { environment: ENV, key: 'reazon-ondevice' } } })
const gateway = await prisma.engineConnection.findUniqueOrThrow({ where: { environment_key: { environment: ENV, key: 'reazon-gateway' } } })
const policy = await prisma.engineFallbackPolicy.findUniqueOrThrow({ where: { environment_role: { environment: ENV, role: 'REALTIME_STT' } } })
const homeM4 = await prisma.engineConnection.findUnique({ where: { environment_key: { environment: ENV, key: 'home-m4-lan' } } })
const managed = (c) => JSON.stringify({ connection: c.connection, runtime: c.runtime, credentialRef: c.credentialRef, logLevel: c.logLevel, enabled: c.enabled })
const policyBytes = (p) => JSON.stringify({ primary: p.primaryConnectionId, fallbacks: p.fallbackConnectionIds, retryOnce: p.retryOnce, enabled: p.enabled })
const baseOn = managed(ondevice)
const baseGw = managed(gateway)
const basePolicy = policyBytes(policy)
const baseVersionIds = new Set((await prisma.configurationVersion.findMany({ where: { environment: ENV }, select: { id: true } })).map((v) => v.id))
const startedAt = new Date()
console.log(`기준: LOCAL 설정 버전 ${baseVersionIds.size}개 · 대상 연결 2 · 예비 순서 1`)

async function api(cookie, method, path, body) {
  const r = await fetch(`${BASE}${path}`, { method, headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' })
  let json = null
  try {
    json = await r.json()
  } catch {
    json = null
  }
  return { status: r.status, json }
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true })

async function newPage(cookie, width, height = 892) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  await ctx.addInitScript(() => {
    const hide = () => {
      const s = document.createElement('style')
      s.textContent = 'nextjs-portal{display:none!important}'
      document.head.appendChild(s)
    }
    if (document.head) hide()
    else document.addEventListener('DOMContentLoaded', hide)
  })
  const [name, ...rest] = cookie.split('=')
  await ctx.addCookies([{ name, value: rest.join('='), url: BASE, httpOnly: true, sameSite: 'Lax' }])
  const page = await ctx.newPage()
  page.consoleErrors = []
  page.on('console', (m) => (m.type() === 'error' && !/Failed to load resource/.test(m.text()) ? page.consoleErrors.push(m.text()) : null))
  page.on('pageerror', (e) => page.consoleErrors.push(String(e)))
  return { ctx, page }
}

const overflow = (page) =>
  page.evaluate(() => {
    const d = document.documentElement
    const main = document.querySelector('[data-app-shell] main')
    const sheet = document.querySelector('[role="dialog"] .overflow-y-auto')
    return { doc: d.scrollWidth - d.clientWidth, main: main ? main.scrollWidth - main.clientWidth : 0, sheet: sheet ? sheet.scrollWidth - sheet.clientWidth : 0 }
  })

/** 보이는 누를 것 중 44px 미만(높이, 버튼·라디오는 너비도). 본문·막대·열린 시트. */
const smallTargets = (page) =>
  page.evaluate(() => {
    const out = []
    const scopes = [document.querySelector('[data-app-shell] main'), document.querySelector('[role="region"][aria-label="적용 단계"]'), document.querySelector('[role="dialog"]')].filter(Boolean)
    for (const scope of scopes) {
      for (const el of scope.querySelectorAll('button, a[href], summary, select, input, textarea, [role="radio"], [role="switch"]')) {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || el.closest('nextjs-portal')) continue
        const tooShort = r.height < 43.5
        const tooNarrow = (el.tagName === 'BUTTON' || el.getAttribute('role') === 'radio') && r.width < 43.5
        if (tooShort || tooNarrow) out.push(`${el.tagName.toLowerCase()}「${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20)}」${Math.round(r.width)}×${Math.round(r.height)}`)
      }
    }
    return [...new Set(out)]
  })

const shot = async (page, name) => {
  if (OUT) await page.screenshot({ path: `${OUT}/${name}.png` })
}
const dialog = (page) => page.getByRole('dialog')
const bar = (page) => page.getByRole('region', { name: '적용 단계' })
const barBtn = (page, name) => bar(page).getByRole('button', { name, exact: true })
const toastHas = (page, re, timeout = 15000) => page.getByRole('status').filter({ hasText: re }).first().waitFor({ timeout }).then(() => true).catch(() => false)
const field = (page, key) => page.locator(`[data-field="${key}"]`)
const cfg = (target, tab) => `/admin/configuration?target=${target}${tab ? `&tab=${tab}` : ''}`
const tabRadio = (page, name) => page.getByRole('radiogroup', { name: '설정 보기' }).getByRole('radio', { name: new RegExp(`^${name}`) })
const versionsOf = (connId) => prisma.configurationVersion.findMany({ where: { environment: ENV, scope: 'ENGINE_CONNECTION', targetId: connId }, orderBy: { version: 'asc' } })

let failed = false
try {
  // ── 0. 권한 · 404 ───────────────────────────────────────────────────────
  for (const p of ['/admin/configuration', '/admin/history']) {
    const r = await fetch(`${BASE}${p}`, { headers: { Cookie: C.user }, redirect: 'manual' })
    check(`0a USER ${p} → 404(앱 공통)`, r.status === 404, String(r.status))
  }
  const anon = await fetch(`${BASE}/admin/history`, { redirect: 'manual' })
  check('0b 무세션 이력 → 로그인으로(307)', anon.status === 307 || anon.status === 302, String(anon.status))

  // ── 1. ADMIN · 390 · 탭·버튼 렌더링 0 ──────────────────────────────────────
  {
    const { ctx, page } = await newPage(C.admin, 390)
    await page.goto(`${BASE}${cfg('reazon-ondevice')}`, { waitUntil: 'networkidle' })
    const tabs = await page.getByRole('radiogroup', { name: '설정 보기' }).getByRole('radio').allTextContents()
    check('1a ADMIN 탭 = Effective·Form·Diff(Raw JSON 탭 DOM 없음)', JSON.stringify(tabs) === JSON.stringify(['Effective', 'Form', 'Diff']), tabs.join('|'))
    check('1b 기본 탭 = Form, 입력칸 있음', (await page.getByRole('radio', { name: 'Form', checked: true }).count()) === 1 && (await field(page, 'runtime.vad.threshold').locator('input').count()) === 1)
    check('1c 잠긴 키(manifestUrl·modelBytes)는 입력 DOM 없음', (await field(page, 'connection.manifestUrl').locator('input,textarea,select').count()) === 0 && (await field(page, 'connection.modelBytes').locator('input').count()) === 0)
    check('1d 바뀐 값이 없으면 적용 막대 없음', (await bar(page).count()) === 0)
    // 검증 오류 칸
    await field(page, 'runtime.vad.threshold').locator('input').fill('5')
    await barBtn(page, '검증').click()
    await page.getByText(/검증에서 1개를 고쳐야 해요/).waitFor({ timeout: 20000 })
    check('1e 범위 밖 값 → 칸 아래 오류 + "고칠 칸 1개"', (await field(page, 'runtime.vad.threshold').locator('[aria-invalid="true"]').count()) === 1 && (await bar(page).getByText(/고칠 칸 1개/).count()) === 1)
    await shot(page, '1e-admin-390-validate-error')
    // 원래대로 → 막대 사라짐
    await field(page, 'runtime.vad.threshold').getByRole('button', { name: '원래대로' }).click()
    await sleep(200)
    check('1f [원래대로] → 초안 0 · 막대 사라짐', (await bar(page).count()) === 0)
    // 운영 설정 대상
    await page.getByRole('radiogroup', { name: '대상 종류' }).getByRole('radio', { name: '운영 설정' }).click()
    await page.getByRole('radio', { name: '미리듣기 문장' }).waitFor()
    const jaArea = await page.locator('main textarea[lang="ja"]').first().waitFor({ timeout: 20000 }).then(() => true).catch(() => false)
    check('1g 운영 설정: 미리듣기 문장 = 여러 줄 입력(lang=ja) · 주소 scope=APP_SETTING', jaArea && /scope=APP_SETTING/.test(page.url()), page.url().replace(BASE, ''))
    await page.getByRole('radio', { name: '미리듣기 버전' }).click()
    await page.waitForLoadState('networkidle')
    await page.getByText('바꿀 수 없는 설정 1개').waitFor({ timeout: 15000 })
    check('1h 미리듣기 버전 = 자동 잠금(입력 없음)', (await page.locator('main [data-field="value"] input').count()) === 0)
    // 연결 상세(ADMIN): 사용 여부 스위치 · 설정 편집 · 비밀 참조 연결 없음
    if (homeM4) {
      await page.goto(`${BASE}/admin/connections/${homeM4.id}`, { waitUntil: 'networkidle' })
      check('1i ADMIN 연결 상세: 사용 여부 스위치·[설정 편집] 있음, [비밀 참조 연결] DOM 없음', (await page.getByRole('switch').count()) === 1 && (await page.getByRole('button', { name: '설정 편집' }).count()) === 1 && (await page.getByRole('button', { name: '비밀 참조 연결' }).count()) === 0)
    }
    await page.goto(`${BASE}/admin/llm`, { waitUntil: 'networkidle' })
    check('1j ADMIN 역할 페이지: [순서 편집] 있음', (await page.getByRole('button', { name: '순서 편집' }).count()) === 1)
    check('1k ADMIN 콘솔 오류 0', page.consoleErrors.length === 0, page.consoleErrors.slice(0, 2).join(' | '))
    await ctx.close()
  }

  // ── 2. DEVELOPER · 1280 · Form ↔ Raw JSON 단일 초안 ─────────────────────────
  {
    const { ctx, page } = await newPage(C.dev, 1280, 900)
    await page.goto(`${BASE}${cfg('reazon-ondevice')}`, { waitUntil: 'networkidle' })
    check('2a DEVELOPER 탭에 Raw JSON 있음', (await tabRadio(page, 'Raw JSON').count()) === 1)
    check('2b 메뉴 "이력"(도구) 보임', (await page.locator('aside a[href="/admin/history"]').count()) === 1)
    await field(page, 'runtime.vad.threshold').locator('input').fill('0.6')
    await tabRadio(page, 'Raw JSON').click()
    await page.getByRole('button', { name: 'JSON 편집' }).click()
    const ta = page.getByRole('textbox', { name: '설정 JSON' })
    const t1 = await ta.inputValue()
    check('2c Form 에서 바꾼 값이 Raw JSON 글에 보인다', /"threshold":\s*0\.6/.test(t1))
    // Raw 에서 한 칸 더 바꾸고 Form 으로
    const doc1 = JSON.parse(t1)
    doc1.runtime.vad = { ...(doc1.runtime.vad ?? {}), endpointSilenceMs: 650 }
    await ta.fill(JSON.stringify(doc1, null, 2))
    await sleep(600)
    await tabRadio(page, 'Form').click()
    const v2 = await field(page, 'runtime.vad.endpointSilenceMs').locator('input').inputValue()
    check('2d Raw JSON 에서 바꾼 값이 Form 칸·"바뀜"에 보인다', v2 === '650' && (await field(page, 'runtime.vad.endpointSilenceMs').getByText('바뀜').count()) === 1, v2)
    const tabNames = await page.getByRole('radiogroup', { name: '설정 보기' }).getByRole('radio').allTextContents()
    check('2e Diff 탭 숫자 = 바뀐 값 2', tabNames.includes('Diff 2'), tabNames.join('|'))
    // 문법 오류 → Form 잠금 · 검증 비활성
    await tabRadio(page, 'Raw JSON').click()
    const t2 = await ta.inputValue()
    await ta.fill(t2.replace(/,\n/, '\n'))
    await sleep(700)
    const synNote = await page.getByText(/JSON 문법 오류 — \d+행/).count()
    check('2f 문법 오류 → "JSON 문법 오류 — n행" · [검증] 비활성', synNote === 1 && (await barBtn(page, '검증').isDisabled()), String(synNote))
    await tabRadio(page, 'Form').click()
    await sleep(300)
    check('2g 문법 오류 중 Form 탭으로 못 감(Raw JSON 그대로)', (await tabRadio(page, 'Raw JSON').getAttribute('aria-checked')) === 'true')
    // 스키마 밖 키(오타) → 검증 → 줄 표시 · 제안
    const doc2 = JSON.parse(t2)
    doc2.runtime = Object.fromEntries(Object.entries(doc2.runtime).map(([k, v]) => [k === 'decodingMethod' ? 'decodingMethd' : k, v]))
    await ta.fill(JSON.stringify(doc2, null, 2))
    await sleep(600)
    await barBtn(page, '검증').click()
    const sug = page.getByRole('button', { name: /decodingMethd → decodingMethod 로 바꾸기/ })
    await sug.waitFor({ timeout: 20000 })
    const h1 = await page.getByText('unknownKey', { exact: true }).count()
    const h2 = await sug.count()
    const h3 = await page.locator('main [aria-hidden="true"] > span').filter({ hasText: '●' }).count()
    check('2h 스키마 밖 키 → unknownKey · 줄 번호(●) · 제안 버튼', h1 >= 1 && h2 === 1 && h3 >= 1, `rule ${h1} · 제안 ${h2} · 표시 줄 ${h3}`)
    await shot(page, '2h-dev-1280-raw-unknown')
    await sug.click()
    await sleep(500)
    check('2i 제안 바꾸기 → 글이 고쳐지고 스키마 밖 키 0', (await ta.inputValue()).includes('"decodingMethod"') && !(await ta.inputValue()).includes('decodingMethd'))
    // 초안 버리기
    await barBtn(page, '초안 버리기').click()
    await dialog(page).getByRole('button', { name: '버리기' }).click()
    await sleep(300)
    check('2j 초안 버리기 → 막대 없음·Diff 숫자 없음', (await bar(page).count()) === 0 && (await tabRadio(page, 'Diff').getAttribute('aria-checked')) !== null && (await tabRadio(page, 'Diff 2').count()) === 0)
    const o = await overflow(page)
    check('2k 1280 넘침 0', o.doc <= 0 && o.main <= 0, JSON.stringify(o))
    check('2l DEVELOPER 콘솔 오류 0', page.consoleErrors.length === 0, page.consoleErrors.slice(0, 2).join(' | '))
    await ctx.close()
  }

  // ── 3. ADMIN · 412 · 적용(첫 적용 = 기준선 v1 + v2) · 409 충돌 ──────────────────
  {
    const { ctx, page } = await newPage(C.admin, 412)
    await page.goto(`${BASE}${cfg('reazon-ondevice')}`, { waitUntil: 'networkidle' })
    check('3a 버전 없음 → "아직 설정 버전 없음 — 기준선 v1 이 함께 생겨요"', (await page.getByText(/아직 설정 버전 없음/).count()) === 1)
    await field(page, 'runtime.vad.threshold').locator('input').fill('0.6')
    await barBtn(page, '검증').click()
    await barBtn(page, '요약 보기').waitFor({ timeout: 20000 })
    check('3b 검증 통과(개발) → [요약 보기]·[기능 테스트]', (await barBtn(page, '기능 테스트').count()) === 1)
    // 기능 테스트: 이 키는 실행 검증 방법이 없다 → 일부만 확인(외부 호출 0)
    await barBtn(page, '기능 테스트').click()
    await page.getByText('일부만 확인').first().waitFor({ timeout: 30000 })
    check('3c 기능 테스트 → "일부만 확인"(확인 못 한 키) · 개발은 이어서 가능', (await barBtn(page, '변경 요약 보기').count()) === 1)
    await barBtn(page, '변경 요약 보기').click()
    await page.getByText('서버 변경 요약').waitFor({ timeout: 20000 })
    check('3d Diff 탭: 서버 변경 요약 · 키 1줄', (await page.locator('main ul li').filter({ hasText: 'runtime.vad.threshold' }).count()) >= 1)
    await barBtn(page, '적용…').click()
    await dialog(page).getByText(/처음 적용이에요/).waitFor()
    check('3e 적용 창: 첫 적용 기준선 안내 · PRODUCTION 입력 칸 없음(개발)', (await dialog(page).getByLabel('확인 문구').count()) === 0)
    await shot(page, '3e-admin-412-apply-sheet')
    const o1 = await overflow(page)
    check('3f 412 적용 창 넘침 0', o1.doc <= 0 && o1.sheet <= 0, JSON.stringify(o1))
    await dialog(page).getByRole('button', { name: '적용', exact: true }).click()
    check('3g 이유 없이 적용 → 이유 칸 오류(요청 전)', (await dialog(page).getByText('변경 이유를 적어 주세요.').count()) === 1)
    await dialog(page).getByRole('textbox').first().fill('UI E2E 시험 — 말소리 감지 기준')
    await dialog(page).getByRole('button', { name: '적용', exact: true }).click()
    const okToast = await toastHas(page, /적용했어요 · v2 \(기준선 v1 함께\)/)
    const vs = await versionsOf(ondevice.id)
    check('3h 적용 → 토스트 v2(기준선 v1) · DB 버전 v1 기준선 + v2 ACTIVE', okToast && vs.length === 2 && vs[0].version === 1 && vs[1].version === 2 && vs[1].status === 'ACTIVE', vs.map((v) => `v${v.version}:${v.status}`).join(','))
    await page.getByText(/적용했어요 · v2/).first().waitFor()
    check('3i 본문 안내 "적용했어요 · v2 — 기준선 v1" · 막대 없음', (await page.getByText(/그 전 값은 기준선 v1 로 함께 남겼어요/).count()) === 1 && (await bar(page).count()) === 0)
    // 409: 이 화면이 v2 를 보는 동안 다른 세션이 v3 을 적용
    await tabRadio(page, 'Form').click()
    await field(page, 'runtime.vad.threshold').locator('input').fill('0.7')
    const other = await api(C.dev, 'POST', `${API}/config/apply`, { scope: 'ENGINE_CONNECTION', targetId: ondevice.id, patch: { 'runtime.vad.endpointSilenceMs': 700 }, baseVersion: 2, reason: 'UI E2E 시험 — 다른 세션 적용' })
    check('3j (준비) 다른 세션이 v3 적용', other.status === 201, String(other.status))
    await barBtn(page, '검증').click()
    await barBtn(page, '요약 보기').waitFor({ timeout: 20000 })
    await barBtn(page, '요약 보기').click()
    await barBtn(page, '적용…').waitFor({ timeout: 20000 })
    await barBtn(page, '적용…').click()
    await dialog(page).getByRole('textbox').first().fill('UI E2E 시험 — 충돌 확인')
    await dialog(page).getByRole('button', { name: '적용', exact: true }).click()
    await dialog(page).getByText(/다른 곳에서 먼저 적용됐어요 — 지금 v3/).waitFor({ timeout: 20000 })
    check('3k 409 → "다른 곳에서 먼저 적용됐어요 — 지금 v3" · [최신 값 기준으로 다시 비교]·[초안 버리기] · 확정 버튼 숨김', (await dialog(page).getByRole('button', { name: '최신 값 기준으로 다시 비교' }).count()) === 1 && (await dialog(page).getByRole('button', { name: '적용', exact: true }).count()) === 0)
    await shot(page, '3k-admin-412-conflict')
    await dialog(page).getByRole('button', { name: '최신 값 기준으로 다시 비교' }).click()
    await page.getByText(/최신 값 기준으로 다시 불러왔어요/).waitFor({ timeout: 20000 })
    await tabRadio(page, 'Form').click()
    const kept = await field(page, 'runtime.vad.threshold').locator('input').inputValue().catch(() => null)
    check('3l 다시 비교 → 안내 + 초안 유지(0.7) · 지금 v3', kept === '0.7' && (await page.getByText(/지금 v3 사용 중/).count()) === 1, String(kept))
    await barBtn(page, '초안 버리기').click()
    await dialog(page).getByRole('button', { name: '버리기' }).click()
    check('3m ADMIN 콘솔 오류 0', page.consoleErrors.length === 0, page.consoleErrors.slice(0, 2).join(' | '))
    await ctx.close()
  }

  // ── 4. 이력 · ADMIN · 360 — 버전 목록·상세·되돌리기 · 감사 ────────────────────────
  {
    const { ctx, page } = await newPage(C.admin, 360)
    await page.goto(`${BASE}/admin/history`, { waitUntil: 'networkidle' })
    const rows = page.locator('main ul li button[aria-haspopup="dialog"]')
    await rows.first().waitFor({ timeout: 20000 })
    check('4a 버전 목록: v3·v2·v1(기준선) 줄', (await page.getByText('기준선 — 첫 적용 전 값').count()) >= 1 && (await rows.count()) >= 3)
    await page.locator('main ul li button').filter({ hasText: '기준선 — 첫 적용 전 값' }).first().click()
    await dialog(page).waitFor()
    await dialog(page).getByText(/첫 버전\(기준선\)이에요/).waitFor({ timeout: 15000 })
    check('4b 기준선 상세: 직전 비교 = "첫 버전(기준선)" 안내', true)
    await dialog(page).getByRole('radio', { name: '지금과' }).click()
    await dialog(page).getByText('지금 저장값과 비교').waitFor({ timeout: 15000 })
    check('4c 지금과 비교: 되돌리면 바뀌는 키(vad.threshold·endpointSilenceMs)', (await dialog(page).getByText('runtime.vad.threshold').count()) === 1)
    check('4d ADMIN(LOCAL)에게 [v1 내용으로 되돌리기] 버튼', (await dialog(page).getByRole('button', { name: 'v1 내용으로 되돌리기' }).count()) === 1)
    check('4e ADMIN 은 스냅샷 원문 없음(요약만)', (await dialog(page).getByText('스냅샷 전체 보기').count()) === 0)
    await dialog(page).getByRole('button', { name: 'v1 내용으로 되돌리기' }).click()
    await dialog(page).getByText(/설정을 v1 내용으로 되돌리면/).waitFor({ timeout: 15000 })
    await shot(page, '4e-admin-360-rollback')
    const o2 = await overflow(page)
    check('4f 360 되돌리기 창 넘침 0', o2.doc <= 0 && o2.sheet <= 0, JSON.stringify(o2))
    await dialog(page).getByRole('textbox').first().fill('UI E2E 시험 — 기준선으로 되돌림')
    await dialog(page).getByRole('button', { name: 'v1 내용으로 되돌리기' }).click()
    const rbToast = await toastHas(page, /되돌렸어요 · v1 내용으로 v4/)
    const vs = await versionsOf(ondevice.id)
    const st = vs.map((v) => `v${v.version}:${v.status}${v.restoredFromVersion ? `<-v${v.restoredFromVersion}` : ''}`).join(',')
    check('4g 되돌리기 → 새 v4(v1 로 되돌림) ACTIVE · 밀려난 v3 = ROLLED_BACK · v1 그대로', rbToast && vs.length === 4 && vs[3].status === 'ACTIVE' && vs[3].restoredFromVersion === 1 && vs[2].status === 'ROLLED_BACK' && vs[0].status === 'SUPERSEDED', st)
    const back = await prisma.engineConnection.findUniqueOrThrow({ where: { id: ondevice.id } })
    const vad = back.runtime?.vad ?? {}
    check('4h 되돌린 뒤 대상 행 = 기준선 값(endpointSilenceMs 500 · threshold 기본값 또는 없음)', vad.endpointSilenceMs === (ondevice.runtime?.vad?.endpointSilenceMs ?? 500) && (vad.threshold === undefined || vad.threshold !== 0.6), JSON.stringify(vad))
    await page.locator('main ul li').filter({ hasText: 'v1 로 되돌림' }).first().waitFor({ timeout: 15000 })
    check('4i 목록에 "v1 로 되돌림"·"되돌려짐" 표시', (await page.getByText('되돌려짐').count()) >= 1)
    // 감사
    await page.getByRole('radio', { name: '감사 기록' }).click()
    const ar = page.locator('main ul li > button[aria-expanded]')
    await ar.first().waitFor({ timeout: 20000 })
    const rb = page.locator('main ul li > button[aria-expanded]').filter({ hasText: '설정 되돌리기' }).first()
    check('4j 감사: 설정 되돌리기·설정 적용 행', (await rb.count()) === 1 && (await page.locator('main ul li > button').filter({ hasText: '설정 적용' }).count()) >= 1)
    await rb.click()
    check('4k 행 펼침: 키마다 전 → 후 한 줄(runtime.vad.threshold)', (await page.locator('main ul li').filter({ hasText: '설정 되돌리기' }).first().getByText('runtime.vad.threshold').count()) >= 1)
    check('4l ADMIN 은 [원문 JSON] 없음(DEVELOPER 이상)', (await page.getByText('원문 JSON').count()) === 0)
    await shot(page, '4l-admin-360-audit')
    const o3 = await overflow(page)
    check('4m 360 이력 넘침 0', o3.doc <= 0 && o3.main <= 0, JSON.stringify(o3))
    check('4n 이력 콘솔 오류 0', page.consoleErrors.length === 0, page.consoleErrors.slice(0, 2).join(' | '))
    await ctx.close()
  }

  // ── 5. 예비 순서 편집(요약까지) · 연결 상세 · 끄기 409 · 비밀 참조 시트 ───────────────────
  {
    const { ctx, page } = await newPage(C.dev, 390)
    await page.goto(`${BASE}/admin/speech/realtime`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: '순서 편집' }).click()
    await page.getByRole('list', { name: '예비 연결 순서(편집)' }).waitFor({ timeout: 20000 })
    const first = (await page.getByRole('list', { name: '예비 연결 순서(편집)' }).locator('li').first().textContent()) ?? ''
    await page.getByRole('list', { name: '예비 연결 순서(편집)' }).locator('li').nth(1).getByRole('button', { name: /위로/ }).click()
    const first2 = (await page.getByRole('list', { name: '예비 연결 순서(편집)' }).locator('li').first().textContent()) ?? ''
    check('5a 위로 → 기본 연결이 바뀐다', first !== first2)
    check('5b 맨 위 [위로]는 비활성, 2개면 [빼기] 있음', (await page.getByRole('list', { name: '예비 연결 순서(편집)' }).locator('li').first().getByRole('button', { name: /위로/ }).isDisabled()) && (await page.getByRole('button', { name: /빼기/ }).count()) === 2)
    await barBtn(page, '검증').click()
    await barBtn(page, '요약 보기').waitFor({ timeout: 20000 })
    await barBtn(page, '요약 보기').click()
    await page.getByText('primaryConnectionId').first().waitFor({ timeout: 20000 })
    check('5c 예비 순서 변경 요약: primaryConnectionId·fallbackConnectionIds · 엄격', (await page.getByText('fallbackConnectionIds').count()) >= 1 && (await page.locator('main').getByText('엄격').count()) >= 2)
    await shot(page, '5c-dev-390-fallback-diff')
    const o4 = await overflow(page)
    check('5d 390 예비 순서 편집 넘침 0', o4.doc <= 0 && o4.main <= 0, JSON.stringify(o4))
    const small = await smallTargets(page)
    check('5e 예비 순서 편집 누를 것 ≥44px', small.length === 0, small.slice(0, 4).join(', '))
    await page.getByRole('button', { name: '편집 끝내기' }).click()
    await dialog(page).getByRole('button', { name: '버리고 끝내기' }).click()
    await sleep(300)
    const pNow = await prisma.engineFallbackPolicy.findUniqueOrThrow({ where: { id: policy.id } })
    check('5f 끝내기(버림) → 쓰기 0 · 정책 그대로', policyBytes(pNow) === basePolicy && (await page.getByRole('button', { name: '순서 편집' }).count()) === 1)
    // 연결 상세 편집 모드
    await page.goto(`${BASE}/admin/connections/${gateway.id}`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: '설정 편집' }).click()
    await page.getByText(/편집 중/).first().waitFor({ timeout: 20000 })
    check('5g 편집 모드: 저장된 설정용 [상태 확인]·[기능 테스트] 패널 숨김', (await page.getByRole('button', { name: '상태 확인' }).count()) === 0)
    await page.getByRole('button', { name: '편집 끝내기' }).click()
    check('5h 바뀐 값 없이 끝내기 → 보기 모드', (await page.getByRole('button', { name: '설정 편집' }).count()) === 1)
    // 기본 연결 끄기 → 409
    await page.goto(`${BASE}/admin/connections/${ondevice.id}`, { waitUntil: 'networkidle' })
    await page.getByRole('switch').click()
    await dialog(page).getByText('연결 끄기').first().waitFor()
    await dialog(page).getByRole('textbox').first().fill('UI E2E 시험 — 기본 연결 끄기 거절 확인')
    await dialog(page).getByRole('button', { name: '끄기', exact: true }).click()
    await dialog(page).getByText(/기본 연결이라 끌 수 없어요/).waitFor({ timeout: 20000 })
    check('5i 기본 연결 끄기 → 409 안내 · [역할 페이지로]', (await dialog(page).getByRole('button', { name: '역할 페이지로' }).count()) === 1)
    await dialog(page).getByRole('button', { name: '취소' }).click()
    const onNow = await prisma.engineConnection.findUniqueOrThrow({ where: { id: ondevice.id } })
    check('5j 거절 뒤 연결 켜진 그대로', onNow.enabled === true)
    check('5k DEVELOPER 연결 상세에 [비밀 참조 연결] 없음', (await page.getByRole('button', { name: '비밀 참조 연결' }).count()) === 0)
    check('5l 콘솔 오류 0', page.consoleErrors.length === 0, page.consoleErrors.slice(0, 2).join(' | '))
    await ctx.close()
  }
  if (homeM4) {
    const { ctx, page } = await newPage(C.super, 390)
    await page.goto(`${BASE}/admin/connections/${homeM4.id}`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: '비밀 참조 연결' }).first().click()
    await dialog(page).getByText(/이 연결이 허용한 참조 중 서버에 있는 것/).waitFor({ timeout: 20000 })
    const inputs = await dialog(page).locator('input, textarea').count()
    check('6a SUPER 비밀 참조 시트: 값 입력 칸 없음(참조 이름 고르기만) · [연결 해제] 선택지', inputs === 0 && (await dialog(page).getByRole('radio', { name: /연결 해제/ }).count()) === 1, `inputs=${inputs}`)
    await shot(page, '6a-super-390-credential')
    const o5 = await overflow(page)
    check('6b 비밀 참조 시트 넘침 0', o5.doc <= 0 && o5.sheet <= 0, JSON.stringify(o5))
    const html = await dialog(page).innerHTML()
    check('6c 시트 HTML 에 비밀 값 모양 0(sk-·Bearer·긴 토큰)', !/sk-[A-Za-z0-9]{8,}|Bearer\s+[A-Za-z0-9._-]{10,}/.test(html))
    await dialog(page).getByRole('button', { name: '닫기', exact: true }).last().click()
    check('6d SUPER 콘솔 오류 0', page.consoleErrors.length === 0, page.consoleErrors.slice(0, 2).join(' | '))
    await ctx.close()
  }

  // ── 7. 폭별 넘침·누를 것(설정 Form·Diff·이력·역할 페이지) ─────────────────────────────
  for (const width of [360, 390, 412, 1280]) {
    const { ctx, page } = await newPage(C.dev, width)
    const issues = []
    for (const path of [cfg('claude-cli-local'), cfg('home-m4-lan', 'raw'), cfg('reazon-gateway', 'effective'), '/admin/history', '/admin/history?tab=audit', '/admin/llm']) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
      const o = await overflow(page)
      if (o.doc > 0 || o.main > 0) issues.push(`${path} ${JSON.stringify(o)}`)
      const small = await smallTargets(page)
      if (small.length) issues.push(`${path} 작은 대상 ${small.slice(0, 3).join(', ')}`)
    }
    check(`7 ${width}px: 넘침 0 · 누를 것 ≥44px(6화면)`, issues.length === 0, issues.slice(0, 3).join(' | '))
    check(`7 ${width}px: 콘솔 오류 0`, page.consoleErrors.length === 0, page.consoleErrors.slice(0, 2).join(' | '))
    await ctx.close()
  }
} catch (e) {
  failed = true
  console.error('E2E 중단:', e)
} finally {
  // ── 원복: 이 실행이 만든 LOCAL 설정 버전만 id 로 지우고, 대상 행 관리 칸을 시작 전 값으로 ────────────
  const created = (await prisma.configurationVersion.findMany({ where: { environment: ENV, createdAt: { gte: startedAt } }, select: { id: true } })).map((v) => v.id).filter((id) => !baseVersionIds.has(id))
  if (created.length) await prisma.configurationVersion.deleteMany({ where: { id: { in: created } } })
  const restore = async (row) => prisma.engineConnection.update({ where: { id: row.id }, data: { connection: row.connection, runtime: row.runtime, credentialRef: row.credentialRef, logLevel: row.logLevel, enabled: row.enabled, status: row.status, statusReason: row.statusReason } })
  await restore(ondevice)
  await restore(gateway)
  await prisma.engineFallbackPolicy.update({ where: { id: policy.id }, data: { primaryConnectionId: policy.primaryConnectionId, fallbackConnectionIds: policy.fallbackConnectionIds, retryOnce: policy.retryOnce, enabled: policy.enabled } })
  const a = await prisma.engineConnection.findUniqueOrThrow({ where: { id: ondevice.id } })
  const b = await prisma.engineConnection.findUniqueOrThrow({ where: { id: gateway.id } })
  const p = await prisma.engineFallbackPolicy.findUniqueOrThrow({ where: { id: policy.id } })
  const left = await prisma.configurationVersion.count({ where: { environment: ENV } })
  check('Z 원복: 대상 행 바이트 대조 · LOCAL 설정 버전 수 = 시작 전', managed(a) === baseOn && managed(b) === baseGw && policyBytes(p) === basePolicy && left === baseVersionIds.size, `지운 버전 ${created.length} · 남은 ${left}/${baseVersionIds.size}`)
  await browser.close()
  await prisma.$disconnect()
  const pass = results.filter((r) => r.ok).length
  console.log(`\n결과: ${pass}/${results.length} PASS${failed ? ' (중단됨)' : ''}`)
  process.exitCode = failed || pass !== results.length ? 1 : 0
}
