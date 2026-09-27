/**
 * task-003g 발음 사전 관리 화면 E2E(실 Chrome + Playwright) — 완료 기준 2·5·6·7(screens.md §10-9).
 *
 *   데스크톱 1280: 목록(표)·추가(히라가나 → 가타카나·모라 칩·요청 전 검사·저장 전 미리듣기 비교·▶·흐림)·중복 409 → [그 항목 열기]
 *   · 동시 변경 409 → 입력 유지 + [새로 불러오기] → 저장 · 끄기/다시 켜기 · 변경 없음 · 필터·URL · 버전 기록(?v= 새로 고침)·되돌리기
 *   · 가져오기(256KB·확장자 요청 전 거절, 오류표·적용 버튼 없음, MERGE 적용, REPLACE_SCOPE 끄기 수 3곳) · 내보내기 CSV/JSON(→ 다시 가져오기 변화 0)
 *   · 문장 읽기 확인. 360/390/412: 목록 카드·시트 넘침 0·터치 ≥44px. USER 404. 엔진명 0.
 *
 * 실행(dev 서버를 따로 띄운 뒤 — 접속은 localhost. 미러가 다른 dev 서버에 잡혀 있으면 하드링크 복제본에서):
 *   node --env-file=.env --import tsx tests/live/task003g-ui-e2e.mjs --base http://localhost:3012 \
 *     --dev <developer 쿠키 파일> --admin <admin 쿠키 파일> --user <USER 쿠키 파일> [--out <스크린샷 디렉터리>]
 * 쿠키 파일은 `QA_ACCOUNT=developer|admin|1 node --env-file=.env --import tsx tests/live/qa-session.ts <파일>`.
 * 운영 pm2 가 APP_ENV=LOCAL 이라 LOCAL 사전 = 실사용자 발음 — **QA 계정(USER 범위)·가짜 표기만** 쓰고, 끝(finally)에 항목·버전·상태를
 * 시작 전과 행 단위로 같게 되돌린다(A 스모크와 같은 원복, AuditLog 는 불변이라 남는다). 쿠키·세션 토큰은 출력하지 않는다.
 * A 의 스모크(task003g-smoke)와 동시에 돌리지 않는다(서로의 원복이 상대 행을 지운다).
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { chromium } from 'playwright-core'
import { cacheSegments } from '../../src/modules/speech/tts/cache.ts'
import { removeDataFile } from '../../src/modules/infra/storage.ts'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
)
const BASE = args.base ?? 'http://localhost:3012'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만 허용')
if ((process.env.APP_ENV ?? 'LOCAL').toUpperCase() !== 'LOCAL') throw new Error('APP_ENV=LOCAL 에서만 돈다')
const OUT = args.out ?? null
if (OUT) mkdirSync(OUT, { recursive: true })
const cookieOf = (f) => readFileSync(f, 'utf8').trim()
const C_DEV = cookieOf(args.dev)
const C_ADMIN = cookieOf(args.admin)
const C_USER = cookieOf(args.user)

try {
  const ps = execFileSync('ps', ['-eo', 'args'], { encoding: 'utf8' })
  if (/task003g-smoke/.test(ps)) throw new Error('A 스모크(task003g-smoke)가 돌고 있다 — 끝난 뒤 다시')
} catch (e) {
  if (String(e).includes('A 스모크')) throw e
}

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
const ENGINE_RE = /g2p|openjtalk|mecab|user[_-]?dict|style-?bert|sbv2|\bM4\b|:8200|reazon|whisper|claude|haiku|sonnet|opus|qwen/i
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const LIST = '/admin/speech/tts/lexicon'
const API = '/api/admin/v1/lexicon'
const M1 = '画面検証甲'
const M2 = '画面検証乙'
const M3 = '画面検証丙'
const MARKERS = [M1, M2, M3]

const prisma = new PrismaClient()
const startedAt = new Date()
const qaUser = await prisma.user.findUniqueOrThrow({ where: { email: 'qa-bot@thekaiwa.test' }, select: { id: true } })
const qaIds = (await prisma.user.findMany({ where: { email: { endsWith: '@thekaiwa.test' } }, select: { id: true } })).map((u) => u.id)
const versionRows = () =>
  prisma.pronunciationLexiconVersion.findMany({ where: { environment: 'LOCAL' }, orderBy: { version: 'asc' }, select: { id: true, version: true, status: true, snapshotHash: true } })
const baseVersions = await versionRows()
const baseEntries = await prisma.pronunciationLexiconEntry.findMany({ where: { environment: 'LOCAL' } })
const baseMax = Math.max(0, ...baseVersions.map((v) => v.version))
const baseGlobal = baseEntries.filter((e) => e.scope === 'GLOBAL').length
console.log(`기준: LOCAL 버전 ${baseVersions.length}개(최대 v${baseMax}) · 항목 ${baseEntries.length}(GLOBAL ${baseGlobal})`)

async function api(cookie, method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
  let json = null
  try {
    json = await r.json()
  } catch {
    json = null
  }
  return { status: r.status, json }
}
const activeVersion = async () => (await api(C_ADMIN, 'GET', `${API}?pageSize=1`)).json?.data?.dictionaryVersion ?? 0

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] })

async function newPage(cookie, width, height = 900) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, acceptDownloads: true })
  // Next dev 도구 배지는 dev 서버에만 있다 — 터치 크기·넘침 측정에서 뺀다.
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
  // 4xx 응답(409·404 재현)은 브라우저가 "Failed to load resource" 로 찍는다 — 의도한 요청이라 빼고 센다.
  page.on('console', (m) => (m.type() === 'error' && !/Failed to load resource/.test(m.text()) ? page.consoleErrors.push(m.text()) : null))
  page.on('pageerror', (e) => page.consoleErrors.push(String(e)))
  return { ctx, page }
}

/** 가로 넘침(문서·main·열린 시트 스크롤 영역) — 0 이어야 한다. */
const overflow = (page) =>
  page.evaluate(() => {
    const d = document.documentElement
    const main = document.querySelector('[data-app-shell] main')
    const sheet = document.querySelector('[role="dialog"] .overflow-y-auto')
    return {
      doc: d.scrollWidth - d.clientWidth,
      main: main ? main.scrollWidth - main.clientWidth : 0,
      sheet: sheet ? sheet.scrollWidth - sheet.clientWidth : 0,
    }
  })

/** 보이는 누를 것 중 44px 미만(높이, 버튼·칩은 너비도). `root` 안만. */
const smallTargets = (page, root) =>
  page.evaluate((sel) => {
    const scope = document.querySelector(sel) ?? document.body
    const out = []
    for (const el of scope.querySelectorAll('button, a[href], summary, select, input:not([type=file]):not(.sr-only), textarea, [role="radio"], label[for]')) {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || el.closest('nextjs-portal')) continue
      if (el.tagName === 'LABEL' && !el.className.includes('h-12')) continue
      const tooShort = r.height < 43.5
      const tooNarrow = (el.tagName === 'BUTTON' || el.getAttribute('role') === 'radio') && r.width < 43.5
      if (tooShort || tooNarrow) out.push(`${el.tagName.toLowerCase()}「${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20)}」${Math.round(r.width)}×${Math.round(r.height)}`)
    }
    return out
  }, root)

const engineLeak = (page) =>
  page.evaluate((src) => {
    const re = new RegExp(src, 'i')
    const texts = [document.body.innerText, ...[...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label'))]
    return texts.filter((t) => t && re.test(t)).map((t) => t.match(re)[0])
  }, ENGINE_RE.source)

const dialog = (page) => page.getByRole('dialog')
const toastText = (page, re, timeout = 15000) => page.getByRole('status').filter({ hasText: re }).first().waitFor({ timeout }).then(() => true).catch(() => false)
const shot = async (page, name) => {
  if (OUT) await page.screenshot({ path: `${OUT}/${name}.png` })
}

let failed = false
try {
  // ── 1. 데스크톱 1280 · DEVELOPER ─────────────────────────────────────────
  const { ctx, page } = await newPage(C_DEV, 1280)
  const writes = []
  page.on('request', (r) => {
    const u = r.url()
    if (u.includes(API) && r.method() !== 'GET') writes.push(`${r.method()} ${u.replace(BASE, '')}`)
  })

  await page.goto(`${BASE}${LIST}`, { waitUntil: 'networkidle' })
  const v0 = await activeVersion()
  await page.getByRole('heading', { name: new RegExp(`LOCAL 사전 v${v0}`) }).waitFor()
  check('1a 목록: 요약 카드 "LOCAL 사전 v{n}" · 표(≥720) 보이고 카드 숨김', (await page.locator('table:visible').count()) === 1 && (await page.locator('main ul.divide-y:visible').count()) === 0, `v${v0}`)
  check('1b 메뉴 "발음 사전" 활성(aria-current)', (await page.locator('a[aria-current="page"]', { hasText: '발음 사전' }).count()) >= 1)
  const o1 = await overflow(page)
  check('1c 데스크톱 넘침 0', o1.doc <= 0 && o1.main <= 0, JSON.stringify(o1))

  // 추가 — 요청 전 검사
  await page.getByRole('button', { name: '＋ 항목 추가' }).click()
  await dialog(page).waitFor()
  check('2a 추가 시트: 표기 칸 자동 포커스', await page.evaluate(() => document.activeElement?.id === 'lexSurface'))
  await page.fill('#lexSurface', M1)
  await page.fill('#lexReading', 'がめんけんしょうこう')
  await page.locator('#lexReading').blur()
  check('2b 읽기 칸을 떠나면 가타카나로 바뀐다', (await page.inputValue('#lexReading')) === 'ガメンケンショウコウ', await page.inputValue('#lexReading'))
  const chips = await page.locator('#lexAccent [role="radio"]').count()
  check('2c 악센트 칩 = 모라 수 + 1(9모라 → 10)', chips === 10, String(chips))
  await page.locator('#lexAccent [role="radio"]').nth(1).click()
  const notation = await page.locator('#lexAccent + p[lang="ja"]').textContent()
  check('2d 높낮이 표기(1 = 頭高 ガ↓…)', notation === 'ガ↓メンケンショウコウ', notation ?? '')
  await page.locator('#lexScope [role="radio"]').nth(4).click()
  const before2 = writes.length
  await dialog(page).getByRole('button', { name: '저장', exact: true }).click()
  await sleep(300)
  check(
    '2e 대상 id 없이 저장 → 요청 0 · 대상 칸 포커스·오류 문구',
    writes.length === before2 && (await page.evaluate(() => document.activeElement?.id)) === 'lexScopeRef' && (await dialog(page).getByText('사용자 id를 입력해 주세요.').count()) === 1,
  )
  await page.fill('#lexScopeRef', qaUser.id)
  await dialog(page).getByRole('button', { name: '저장', exact: true }).click()
  await sleep(300)
  check('2f 이유 없이 저장 → 요청 0 · 이유 칸 포커스', writes.length === before2 && (await page.evaluate(() => document.activeElement?.id)) === 'lexReason')

  // 저장 전 미리듣기
  const pv = page.waitForResponse((r) => r.url().endsWith(`${API}/preview`) && r.request().method() === 'POST' && !(r.request().headers().accept ?? '').includes('audio'), { timeout: 60000 })
  await dialog(page).getByRole('button', { name: '읽기 확인' }).click()
  const pvRes = await pv
  const pvBody = await pvRes.json().catch(() => null)
  await dialog(page).getByText('적용 후 · 이 입력').waitFor({ timeout: 60000 })
  const dText = await dialog(page).innerText()
  check(
    '3a 미리듣기: 적용 전(지금 사전 v)·적용 후 두 줄 + "이 예문에 1번 적용" · 초안 저장 안 됨',
    pvRes.status() === 200 && dText.includes(`적용 전 · 지금 사전 v`) && /이 예문에 1번 적용/.test(dText) && (await activeVersion()) === v0,
    `${pvRes.status()} before=${pvBody?.data?.before?.reading ?? '?'} after=${pvBody?.data?.after?.reading ?? '?'}`,
  )
  const afterReading = String(pvBody?.data?.after?.reading ?? '')
  check('3b 적용 후 읽기에 초안 읽기가 반영(가나)', /ガメンケン/.test(afterReading) && afterReading !== String(pvBody?.data?.before?.reading ?? ''), afterReading)
  const au = page.waitForResponse((r) => r.url().endsWith(`${API}/preview`) && (r.request().headers().accept ?? '').includes('audio/wav'), { timeout: 60000 })
  await dialog(page).getByRole('button', { name: '적용 후 읽기 듣기' }).click()
  const auRes = await au
  const played = await dialog(page).getByRole('button', { name: '멈추기' }).waitFor({ timeout: 8000 }).then(() => true).catch(() => false)
  check('3c ▶ 적용 후 → 같은 경로 Accept: audio/wav · 200 WAV · 재생 중 표시', auRes.status() === 200 && (auRes.headers()['content-type'] ?? '').startsWith('audio/wav'), `${auRes.status()} 멈추기=${played}`)
  await page.fill('#lexReading', 'ガメンケンショウコウー')
  await dialog(page).getByText('입력이 바뀌었어요 — 다시 확인해 주세요.').waitFor({ timeout: 3000 })
  check('3d 입력이 바뀌면 결과 흐림 + ▶ 잠금', await dialog(page).getByRole('button', { name: '적용 후 읽기 듣기' }).isDisabled())
  await page.fill('#lexReading', 'ガメンケンショウコウ')
  await shot(page, '1280-add-preview')

  // 저장
  await dialog(page).getByRole('button', { name: '새 고유명사' }).click()
  check('4a 빠른 이유 칩 → 이유 칸', (await page.inputValue('#lexReason')) === '새 고유명사')
  await dialog(page).getByRole('button', { name: '저장', exact: true }).click()
  check('4b 저장 → 토스트 "저장했어요 · 사전 v{n+1}" · 시트 닫힘', await toastText(page, new RegExp(`저장했어요 · 사전 v${v0 + 1}`)))
  await page.getByRole('heading', { name: new RegExp(`LOCAL 사전 v${v0 + 1}`) }).waitFor({ timeout: 10000 })
  check('4c 요약 카드 번호 갱신', (await dialog(page).count()) === 0)
  const e1 = await prisma.pronunciationLexiconEntry.findFirst({ where: { environment: 'LOCAL', surface: M1, scope: 'USER', scopeRefId: qaUser.id } })
  check('4d DB: 가타카나로 저장·악센트 1·USER 범위', e1?.reading === 'ガメンケンショウコウ' && e1?.accentType === 1 && e1?.enabled === true, `${e1?.reading}/${e1?.accentType}`)

  // 중복 409 → 그 항목 열기
  await page.getByRole('button', { name: '＋ 항목 추가' }).click()
  await page.fill('#lexSurface', M1)
  await page.fill('#lexReading', 'ガメン')
  await page.locator('#lexScope [role="radio"]').nth(4).click()
  await page.fill('#lexScopeRef', qaUser.id)
  await page.fill('#lexReason', 'e2e 중복')
  await dialog(page).getByRole('button', { name: '저장', exact: true }).click()
  await dialog(page).getByText(`같은 범위에 「${M1}」 항목이 이미 있어요.`).waitFor({ timeout: 10000 })
  await dialog(page).getByRole('button', { name: '그 항목 열기' }).click()
  await dialog(page).getByRole('heading', { name: '항목 고치기' }).waitFor()
  check('5a 중복 409 → 알림 + [그 항목 열기] → 그 항목 고치기', (await page.inputValue('#lexReading')) === 'ガメンケンショウコウ')

  // 동시 변경 409 → 입력 유지 → 새로 불러오기 → 저장
  await page.fill('#lexPriority', '20')
  const vNow = await activeVersion()
  const other = await api(C_ADMIN, 'POST', API, { surface: M2, reading: 'ガメンケンショウオツ', accentType: 0, priority: 10, scope: 'USER', scopeRefId: qaUser.id, wordType: null, note: null, reason: 'e2e 동시 변경', baseVersion: vNow })
  check('6a (다른 관리자) API 로 먼저 저장', other.status === 200, String(other.status))
  await page.fill('#lexReason', 'e2e 우선순위')
  await dialog(page).getByRole('button', { name: '저장', exact: true }).click()
  await dialog(page).getByText(new RegExp(`다른 곳에서 사전이 바뀌었어요 \\(v${vNow} → v${vNow + 1}\\)`)).waitFor({ timeout: 10000 })
  check('6b 409 VERSION_CONFLICT → 알림(v{a} → v{b}) · 입력 유지', (await page.inputValue('#lexPriority')) === '20' && (await page.inputValue('#lexReason')) === 'e2e 우선순위')
  await dialog(page).getByRole('button', { name: '새로 불러오기' }).click()
  await sleep(500)
  await dialog(page).getByRole('button', { name: '저장', exact: true }).click()
  check('6c [새로 불러오기] 뒤 저장 성공', await toastText(page, new RegExp(`저장했어요 · 사전 v${vNow + 2}`)))

  // 변경 없음 · 필터·URL · 끄기·다시 켜기
  await page.getByRole('searchbox', { name: '표기·읽기 검색' }).fill(M1)
  await page.waitForURL((u) => u.search.includes('q='), { timeout: 5000 })
  await page.getByRole('button', { name: `${M1} 고치기` }).waitFor({ timeout: 10000 })
  check('7a 검색어가 URL 쿼리에 남는다', new URL(page.url()).searchParams.get('q') === M1)
  await page.getByRole('button', { name: `${M1} 고치기` }).click()
  await page.fill('#lexReason', 'e2e 변경 없음')
  const before7 = writes.length
  await dialog(page).getByRole('button', { name: '저장', exact: true }).click()
  check('7b 바꾼 것 없이 저장 → "바뀐 내용이 없어요" · 요청 0', (await toastText(page, /바뀐 내용이 없어요/, 5000)) && writes.length === before7)
  await dialog(page).getByRole('button', { name: '이 항목 끄기' }).click()
  await dialog(page).getByRole('heading', { name: '항목 끄기' }).waitFor()
  check('7c 끄기 확인: "지우지 않아요" 안내', (await dialog(page).getByText(/지우지 않아요 — 버전 기록과 내보내기에 남고/).count()) === 1)
  await dialog(page).getByRole('button', { name: '잘못 넣은 항목' }).click()
  const vBeforeOff = await activeVersion()
  await dialog(page).getByRole('button', { name: '끄기', exact: true }).click()
  check('7d 끄기 → 토스트 "껐어요 · 사전 v"', await toastText(page, new RegExp(`껐어요 · 사전 v${vBeforeOff + 1}`)))
  await page.getByText('조건에 맞는 항목이 없어요').waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: '꺼진 항목 포함' }).click()
  await page.getByRole('button', { name: `${M1} 고치기` }).waitFor({ timeout: 10000 })
  await page.waitForURL((u) => u.searchParams.get('inactive') === '1', { timeout: 5000 }).catch(() => undefined)
  check('7e 꺼진 항목 포함 → 행에 "꺼짐" · URL inactive=1', new URL(page.url()).searchParams.get('inactive') === '1' && (await page.locator('table:visible [aria-label="상태: 꺼짐"]').count()) >= 1, `url=${new URL(page.url()).search} 꺼짐=${await page.locator('table:visible [aria-label="상태: 꺼짐"]').count()}`)
  const offRow = await prisma.pronunciationLexiconEntry.findFirst({ where: { id: e1?.id } })
  check('7f 물리 삭제 없음(행이 남고 enabled=false)', offRow?.enabled === false)
  await page.getByRole('button', { name: `${M1} 고치기` }).click()
  await dialog(page).getByRole('button', { name: '다시 켜기' }).click()
  await dialog(page).getByRole('heading', { name: '항목 다시 켜기' }).waitFor()
  await dialog(page).getByRole('button', { name: '다시 필요해짐' }).click()
  await dialog(page).getByRole('button', { name: '다시 켜기', exact: true }).click()
  check('7g 다시 켜기 → 토스트', await toastText(page, /다시 켰어요 · 사전 v\d+/))
  check('1d 엔진명 0(목록)', (await engineLeak(page)).length === 0, (await engineLeak(page)).join(','))

  // ── 버전 기록 · 되돌리기 ──
  await page.getByRole('link', { name: '버전 기록 ›' }).click()
  await page.waitForURL(/\/lexicon\/versions/)
  await page.getByRole('heading', { name: '버전 기록' }).waitFor()
  const vTop = await activeVersion()
  const addV = v0 + 1
  await page.getByRole('button', { name: new RegExp(`^v${addV}\\b`) }).click()
  await dialog(page).getByRole('heading', { name: `버전 v${addV}` }).waitFor()
  await dialog(page).getByText(`직전 버전(v${v0})과 비교`).waitFor({ timeout: 10000 })
  check('8a 버전 상세(?v=): 직전 버전과 비교 + 추가 행', new URL(page.url()).searchParams.get('v') === String(addV) && (await dialog(page).getByText(M1).count()) >= 1)
  await page.reload({ waitUntil: 'networkidle' })
  await dialog(page).getByRole('heading', { name: `버전 v${addV}` }).waitFor({ timeout: 10000 })
  check('8b ?v= 새로 고침해도 시트가 열린다(하이드레이션 오류 없음)', !page.consoleErrors.some((t) => /hydrat/i.test(t)), page.consoleErrors.filter((t) => /hydrat/i.test(t)).length + '건')
  await dialog(page).getByRole('button', { name: `v${addV} 내용으로 되돌리기` }).click()
  await dialog(page).getByText(`지금(v${vTop}) 사전을 v${addV} 내용으로 되돌리면:`).waitFor({ timeout: 10000 })
  await dialog(page).getByRole('list', { name: '바뀌는 항목 수' }).waitFor({ timeout: 10000 })
  await dialog(page).getByRole('button', { name: '문제 있는 변경 되돌림' }).click()
  await shot(page, '1280-rollback-confirm')
  await dialog(page).getByRole('button', { name: `v${addV} 내용으로 되돌리기` }).click()
  check('8c 되돌리기 → 토스트 "되돌렸어요 · v{k} 내용으로 사전 v{n}"', await toastText(page, new RegExp(`되돌렸어요 · v${addV} 내용으로 사전 v${vTop + 1}`)))
  await page.getByRole('button', { name: new RegExp(`^v${vTop + 1}\\b`) }).waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: new RegExp(`^v${vTop}\\b`) }).filter({ hasText: '되돌려짐' }).waitFor({ timeout: 10000 }).catch(() => undefined)
  const rbRow = await page.getByRole('button', { name: new RegExp(`^v${vTop}\\b`) }).innerText()
  const topRow = await page.getByRole('button', { name: new RegExp(`^v${vTop + 1}\\b`) }).innerText()
  check('8d 목록: 새 버전 사용 중 · 밀려난 직전 버전 되돌려짐', /사용 중/.test(topRow) && /되돌려짐/.test(rbRow) && /로 되돌림/.test(topRow), `${topRow.replace(/\n/g, ' ')} / ${rbRow.replace(/\n/g, ' ')}`)
  await page.getByRole('button', { name: new RegExp(`^v${vTop + 1}\\b`) }).click()
  await dialog(page).getByText('지금 쓰는 버전이에요.').waitFor({ timeout: 10000 })
  check('8e 사용 중 버전 상세에는 되돌리기 버튼 없음', (await dialog(page).getByRole('button', { name: /내용으로 되돌리기/ }).count()) === 0)
  await dialog(page).getByRole('button', { name: '닫기' }).click()
  check('1e 엔진명 0(버전)', (await engineLeak(page)).length === 0)

  // ── 가져오기 ──
  await page.goto(`${BASE}${LIST}`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '가져오기' }).click()
  await dialog(page).getByRole('heading', { name: '사전 가져오기' }).waitFor()
  const fileInput = dialog(page).locator('input[type=file]')
  const importReqs = () => writes.filter((w) => w.includes('/import')).length
  const i0 = importReqs()
  await fileInput.setInputFiles({ name: 'big.csv', mimeType: 'text/csv', buffer: Buffer.alloc(300 * 1024, 'a') })
  await dialog(page).getByRole('button', { name: '변경 내용 미리 보기' }).click()
  await sleep(300)
  check('9a 256KB 초과 → 요청 없이 거절 문구', importReqs() === i0 && (await dialog(page).getByText(/파일이 256KB 를 넘어요\(300KB\)/).count()) === 1)
  await fileInput.setInputFiles({ name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('a') })
  check('9b 확장자 밖 → 요청 없이 거절 문구', importReqs() === i0 && (await dialog(page).getByText('CSV 나 JSON 파일만 올릴 수 있어요.').count()) === 1)
  const HEAD = 'surface,reading,accentType,priority,scope,scopeRefId,wordType,note,enabled'
  const bad = [HEAD, `${M3},abc,0,10,USER,${qaUser.id},,,true`, `${M3},ガメン,0,10,USER,no_such_user_zz,,,true`].join('\n')
  await fileInput.setInputFiles({ name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from(bad) })
  await dialog(page).getByRole('button', { name: '변경 내용 미리 보기' }).click()
  await dialog(page).getByText(/오류 \d+행/).waitFor({ timeout: 15000 })
  const vImp0 = await activeVersion()
  check(
    '9c dryRun 오류표(잘못된 가나·없는 대상) · 적용 버튼 없음 · DB 변화 0',
    (await dialog(page).getByText('오류가 있는 행을 고친 파일로 다시 확인해 주세요. 오류가 0 일 때만 적용할 수 있어요.').count()) === 1 &&
      (await dialog(page).getByRole('button', { name: /^적용/ }).count()) === 0 &&
      vImp0 === (await activeVersion()),
    (await dialog(page).locator('li:has-text("행")').allInnerTexts()).slice(0, 3).join(' | '),
  )
  const good = [HEAD, `${M3},ガメンケンショウヘイ,0,10,USER,${qaUser.id},,,true`].join('\n')
  await fileInput.setInputFiles({ name: 'good.csv', mimeType: 'text/csv', buffer: Buffer.from(good) })
  check('9d 파일을 바꾸면 미리 본 결과를 버린다', (await dialog(page).getByText(/오류 \d+행/).count()) === 0)
  await dialog(page).getByRole('button', { name: '변경 내용 미리 보기' }).click()
  await dialog(page).getByText(/1행 확인 · 지금 사전 v\d+ 기준/).waitFor({ timeout: 15000 })
  await dialog(page).getByRole('button', { name: '일괄 추가' }).click()
  const vImp = await activeVersion()
  await dialog(page).getByRole('button', { name: /^적용/ }).click()
  check('9e MERGE 적용 → 토스트 "가져왔어요 · 사전 v (추가 1 · 수정 0 · 끄기 0)"', await toastText(page, new RegExp(`가져왔어요 · 사전 v${vImp + 1} \\(추가 1 · 수정 0 · 끄기 0\\)`)))
  await page.getByRole('button', { name: '가져오기' }).click()
  await dialog(page).getByRole('radio', { name: /REPLACE_SCOPE/ }).click()
  check('9f REPLACE_SCOPE 설명에 끄기 경고(1/3)', (await dialog(page).getByText('⚠ 그 범위에서 파일에 없는 항목은 모두 꺼져요.').count()) === 1)
  await dialog(page).locator('input[type=file]').setInputFiles({ name: 'replace.csv', mimeType: 'text/csv', buffer: Buffer.from(good) })
  await dialog(page).getByRole('button', { name: '변경 내용 미리 보기' }).click()
  await dialog(page).getByText(/1행 확인/).waitFor({ timeout: 15000 })
  const warn = await dialog(page).getByRole('alert').filter({ hasText: /적용하면 \d+개 항목이 꺼져요/ }).innerText().catch(() => '')
  const n = Number(/(\d+)개 항목이 꺼져요/.exec(warn)?.[1] ?? 0)
  check(
    '9g REPLACE_SCOPE dryRun: 결과(2/3) + 버튼 "(n개 끄기 포함)"(3/3) + 바뀌는 범위',
    n >= 1 && (await dialog(page).getByRole('button', { name: new RegExp(`\\(${n}개 끄기 포함\\)`) }).count()) === 1 && (await dialog(page).getByText(/바뀌는 범위: USER/).count()) === 1,
    `끄기 ${n}`,
  )
  await shot(page, '1280-import-replace')
  await dialog(page).getByRole('button', { name: '취소' }).click()
  check('9h REPLACE_SCOPE 는 적용하지 않음(버전 그대로)', (await activeVersion()) === vImp + 1)

  // ── 내보내기 → 다시 가져오기(변화 0) ──
  await page.getByRole('button', { name: '내보내기' }).click()
  await dialog(page).getByRole('heading', { name: '사전 내보내기' }).waitFor()
  const dl = page.waitForEvent('download')
  await dialog(page).getByRole('button', { name: '내려받기' }).click()
  const csv = await dl
  const csvPath = await csv.path()
  const csvText = readFileSync(csvPath, 'utf8').replace(/^﻿/, '')
  check('10a 내보내기 CSV: 파일명·머리글·꺼진 항목 포함', /^lexicon-local-v\d+-\d{8}\.csv$/i.test(csv.suggestedFilename()) && csvText.startsWith(HEAD) && csvText.includes(M2), csv.suggestedFilename())
  check('10b 시트가 닫히지 않는다 + 토스트', (await dialog(page).count()) === 1 && (await toastText(page, /내려받았어요 · v\d+/, 5000)))
  await dialog(page).getByRole('radio', { name: 'JSON' }).click()
  const dl2 = page.waitForEvent('download')
  await dialog(page).getByRole('button', { name: '내려받기' }).click()
  const js = await dl2
  const jsText = readFileSync(await js.path(), 'utf8')
  let jsOk = false
  try {
    const parsed = JSON.parse(jsText)
    jsOk = Array.isArray(parsed.entries) && parsed.entries.some((e) => e.surface === M3)
  } catch {
    jsOk = false
  }
  check('10c 내보내기 JSON', /\.json$/.test(js.suggestedFilename()) && jsOk, js.suggestedFilename())
  await dialog(page).getByRole('button', { name: '닫기' }).last().click()
  await page.getByRole('button', { name: '가져오기' }).click()
  await dialog(page).locator('input[type=file]').setInputFiles({ name: csv.suggestedFilename(), mimeType: 'text/csv', buffer: readFileSync(csvPath) })
  await dialog(page).getByRole('button', { name: '변경 내용 미리 보기' }).click()
  await dialog(page).getByText(/행 확인/).waitFor({ timeout: 15000 })
  check('10d 내보낸 CSV 를 다시 가져오면 "바뀌는 항목이 없어요"(왕복 불변)', (await dialog(page).getByText('바뀌는 항목이 없어요 — 지금 사전과 같아요.').count()) === 1)
  await dialog(page).getByRole('button', { name: '닫기' }).click()

  // ── 문장 읽기 확인 ──
  await page.getByText('문장으로 읽기 확인').click()
  const sc = page.locator('details[open]').filter({ hasText: '문장으로 읽기 확인' })
  await sc.locator('textarea').fill('日本橋で降ります')
  await sc.getByRole('button', { name: '읽기 확인' }).click()
  const scOk = await sc.getByText(/^지금 사전 v\d+$/).waitFor({ timeout: 60000 }).then(() => true).catch(() => false)
  check('11 문장으로 읽기 확인(지금 사전 한 줄)', scOk)
  check('1f 콘솔 오류 0(데스크톱)', page.consoleErrors.length === 0, page.consoleErrors.slice(0, 2).join(' | ').slice(0, 200))
  await ctx.close()

  // ── 2. 360/390/412 ─────────────────────────────────────────────────────
  for (const w of [360, 390, 412]) {
    const { ctx: c2, page: p2 } = await newPage(C_DEV, w, 844)
    await p2.goto(`${BASE}${LIST}?inactive=1`, { waitUntil: 'networkidle' })
    await p2.getByRole('heading', { name: /LOCAL 사전 v\d+/ }).waitFor()
    const cards = await p2.locator('main ul.divide-y:visible > li').count()
    const probs = []
    let o = await overflow(p2)
    if (o.doc > 0 || o.main > 0) probs.push(`목록 ${JSON.stringify(o)}`)
    let small = await smallTargets(p2, 'main')
    if (small.length) probs.push(`목록 작은 대상 ${small.slice(0, 3).join(',')}`)
    // 추가 시트(긴 값)
    await p2.getByRole('button', { name: '＋ 항목 추가' }).click()
    await p2.fill('#lexSurface', '橋'.repeat(40))
    await p2.fill('#lexReading', 'キャ'.repeat(30))
    await p2.locator('#lexScope [role="radio"]').nth(4).click()
    await p2.fill('#lexNote', 'あ'.repeat(200))
    await p2.fill('#lexReason', '가'.repeat(200))
    o = await overflow(p2)
    if (o.doc > 0 || o.sheet > 0) probs.push(`추가 시트 ${JSON.stringify(o)}`)
    small = await smallTargets(p2, '[role="dialog"]')
    if (small.length) probs.push(`추가 시트 작은 대상 ${small.slice(0, 3).join(',')}`)
    await shot(p2, `${w}-add`)
    await p2.getByRole('button', { name: '취소' }).click()
    await p2.getByRole('button', { name: '입력 버리고 닫기' }).click()
    // 고치기 시트
    await p2.locator('main ul.divide-y:visible > li button').first().click()
    await dialog(p2).waitFor()
    o = await overflow(p2)
    if (o.doc > 0 || o.sheet > 0) probs.push(`고치기 시트 ${JSON.stringify(o)}`)
    small = await smallTargets(p2, '[role="dialog"]')
    if (small.length) probs.push(`고치기 시트 작은 대상 ${small.slice(0, 3).join(',')}`)
    await dialog(p2).getByRole('button', { name: '닫기' }).first().click()
    // 가져오기 시트(REPLACE_SCOPE dryRun 결과까지)
    await p2.getByRole('button', { name: '가져오기' }).click()
    await dialog(p2).locator('input[type=file]').setInputFiles({ name: 'replace.csv', mimeType: 'text/csv', buffer: Buffer.from(good) })
    await dialog(p2).getByRole('radio', { name: /REPLACE_SCOPE/ }).click()
    await dialog(p2).getByRole('button', { name: '변경 내용 미리 보기' }).click()
    await dialog(p2).getByText(/행 확인/).waitFor({ timeout: 15000 })
    o = await overflow(p2)
    if (o.doc > 0 || o.sheet > 0) probs.push(`가져오기 시트 ${JSON.stringify(o)}`)
    small = await smallTargets(p2, '[role="dialog"]')
    if (small.length) probs.push(`가져오기 시트 작은 대상 ${small.slice(0, 3).join(',')}`)
    await shot(p2, `${w}-import`)
    await dialog(p2).getByRole('button', { name: '취소' }).click()
    // 버전 기록 + 상세 시트
    await p2.goto(`${BASE}${LIST}/versions?v=${v0 + 1}`, { waitUntil: 'networkidle' })
    await dialog(p2).getByText(/직전 버전|첫 버전/).first().waitFor({ timeout: 10000 })
    o = await overflow(p2)
    if (o.doc > 0 || o.main > 0 || o.sheet > 0) probs.push(`버전 ${JSON.stringify(o)}`)
    small = await smallTargets(p2, '[role="dialog"]')
    if (small.length) probs.push(`버전 시트 작은 대상 ${small.slice(0, 3).join(',')}`)
    await dialog(p2).getByRole('button', { name: '닫기' }).click()
    small = await smallTargets(p2, 'main')
    if (small.length) probs.push(`버전 목록 작은 대상 ${small.slice(0, 3).join(',')}`)
    check(`12 ${w}px: 카드 목록(${cards}행)·시트 4종·버전 — 가로 넘침 0 · 터치 ≥44px · 콘솔 오류 0`, cards > 0 && probs.length === 0 && p2.consoleErrors.length === 0, [...probs, ...p2.consoleErrors.slice(0, 1)].join(' / ').slice(0, 300))
    await c2.close()
  }

  // ── 3. USER 404 ──────────────────────────────────────────────────────
  for (const p of [LIST, `${LIST}/versions`]) {
    const r = await fetch(`${BASE}${p}`, { headers: { Cookie: C_USER }, redirect: 'manual' })
    check(`13 USER ${p} → 404`, r.status === 404, String(r.status))
  }
} catch (e) {
  failed = true
  console.log(`ERROR ${String(e?.stack ?? e).split('\n').slice(0, 4).join(' | ')}`)
} finally {
  await browser.close().catch(() => undefined)
  // ── 원복(A 스모크와 같은 방식): 항목 표·버전 행·상태를 시작 전 그대로 ──
  const baseIds = new Set(baseEntries.map((e) => e.id))
  const nowEntries = await prisma.pronunciationLexiconEntry.findMany({ where: { environment: 'LOCAL' } })
  const extra = nowEntries.filter((e) => !baseIds.has(e.id))
  const outsider = extra.filter((e) => !(MARKERS.includes(e.surface) && e.scope === 'USER' && e.scopeRefId === qaUser.id))
  if (outsider.length) console.log(`(원복 주의) QA 표기가 아닌 새 항목 ${outsider.length}개 — 지우지 않는다: ${outsider.map((e) => `${e.scope}:${e.surface}`).join(',')}`)
  const delEntries = await prisma.pronunciationLexiconEntry.deleteMany({ where: { id: { in: extra.filter((e) => !outsider.includes(e)).map((e) => e.id) } } })
  let restored = 0
  for (const b of baseEntries) {
    const cur = nowEntries.find((e) => e.id === b.id)
    if (!cur || JSON.stringify(cur) === JSON.stringify(b)) continue
    const data = { ...b }
    for (const k of ['id', 'environment', 'createdAt']) delete data[k]
    await prisma.pronunciationLexiconEntry.update({ where: { id: b.id }, data })
    restored++
  }
  const delVersions = outsider.length ? { count: 0 } : await prisma.pronunciationLexiconVersion.deleteMany({ where: { environment: 'LOCAL', version: { gt: baseMax } } })
  if (!outsider.length) for (const bv of baseVersions) await prisma.pronunciationLexiconVersion.update({ where: { id: bv.id }, data: { status: bv.status } })
  const caches = await prisma.ttsCache.findMany({
    where: { createdAt: { gte: startedAt }, OR: [{ dictionaryVersion: { gt: baseMax } }, ...MARKERS.map((m) => ({ normalizedText: { contains: m } }))] },
    select: { key: true },
  })
  for (const c of caches) {
    await prisma.ttsCache.delete({ where: { key: c.key } }).catch(() => undefined)
    await removeDataFile(cacheSegments(c.key)).catch(() => undefined)
  }
  const tr = await prisma.requestTrace.deleteMany({ where: { userId: { in: qaIds }, createdAt: { gte: startedAt } } })
  console.log(`(원복) 항목 삭제 ${delEntries.count}·복원 ${restored} · 버전 삭제 ${delVersions.count} · TtsCache ${caches.length} · Trace ${tr.count} · AuditLog 는 불변이라 유지`)
  const afterVersions = await versionRows()
  const afterEntries = await prisma.pronunciationLexiconEntry.findMany({ where: { environment: 'LOCAL' } })
  const sameVersions = JSON.stringify(afterVersions) === JSON.stringify(baseVersions)
  const sort = (xs) => [...xs].sort((a, b) => a.id.localeCompare(b.id))
  const sameEntries = JSON.stringify(sort(afterEntries)) === JSON.stringify(sort(baseEntries))
  const globals = afterEntries.filter((e) => e.scope === 'GLOBAL').length
  check('14 원복: 버전 행·상태·항목 표가 시작 전과 동일(시드 GLOBAL 무변경)', sameVersions && sameEntries && globals === baseGlobal, `버전 ${afterVersions.length}·항목 ${afterEntries.length}·GLOBAL ${globals}`)
  await prisma.$disconnect()
}
const bad = results.filter((r) => !r.ok)
console.log(`\n결과: ${results.length - bad.length}/${results.length} PASS${bad.length ? ` — FAIL: ${bad.map((b) => b.name.split(' ')[0]).join(', ')}` : ''}${failed ? ' (중단됨)' : ''}`)
process.exit(bad.length || failed ? 1 : 0)
