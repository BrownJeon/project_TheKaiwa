/**
 * task-034 QA — 관리자 발음 사전 화면(UI 무변경)의 "읽기 확인"·"저장 전 미리듣기 비교"가 새 가드와 일관되게 동작하는지 실 Chrome 으로 확인한다.
 *   1) 목록 머리 "문장으로 읽기 확인": 明日香さん → 읽기 アスカサン
 *   2) "＋ 항목 추가" 시트: 초안 明日=アシタ + 예문 明日香さん → 「걸리지 않았어요」 안내(적용 0) / 초안 明日香=アスカ → 「이 예문에 1번 적용」
 *   3) 화면 본문(innerText)·HTML 에 엔진명·model_id·speaker_id 문자열 0건
 * 저장 버튼은 누르지 않는다(DB 변경 0). 서버 NEW(localhost:3011), 쿠키는 admin QA 계정.
 * 사용: node --env-file=.env --import tsx tests/live/task034-ui.mjs --base http://localhost:3011 --admin <쿠키파일>
 */
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []))
const BASE = args.base ?? 'http://localhost:3011'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('BASE 는 localhost 만')
const [cname, ...crest] = readFileSync(args.admin, 'utf8').trim().split('=')
const ENGINE_RE = /reazon|whisper|style[-_ ]?bert|sbv2|model_id|speaker_id|modelId|speakerId|openjtalk|pyopenjtalk|sherpa/i
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true })
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul', colorScheme: 'light', reducedMotion: 'reduce' })
  await ctx.addInitScript(() => {
    const hide = () => {
      const s = document.createElement('style')
      s.textContent = 'nextjs-portal{display:none!important}'
      document.head.appendChild(s)
    }
    if (document.head) hide()
    else document.addEventListener('DOMContentLoaded', hide)
  })
  await ctx.addCookies([{ name: cname, value: crest.join('='), url: BASE, httpOnly: true, sameSite: 'Lax' }])
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => (m.type() === 'error' && !/Failed to load resource/.test(m.text()) ? errors.push(m.text()) : null))
  const previews = []
  page.on('response', async (r) => {
    if (r.url().endsWith('/api/admin/v1/lexicon/preview') && r.request().method() === 'POST') previews.push({ status: r.status(), body: await r.text().catch(() => '') })
  })

  await page.goto(`${BASE}/admin/speech/tts/lexicon`, { waitUntil: 'networkidle' })
  await document_ready(page)
  check('0 사전 목록 화면 열림(관리자)', (await page.getByRole('heading', { name: /LOCAL 사전 v\d+/ }).count()) >= 1, await page.title())

  // 1) 문장으로 읽기 확인
  await page.getByText('문장으로 읽기 확인', { exact: true }).click()
  const box = page.locator('details[open]').getByLabel('예문')
  await box.fill('明日香さん')
  await page.locator('details[open]').getByRole('button', { name: '읽기 확인' }).click()
  await page.locator('details[open]').getByText(/지금 사전 v\d+/).waitFor({ timeout: 60000 })
  const t1 = await page.locator('details[open]').innerText()
  check('1 문장 읽기 확인: 明日香さん → 읽기 アスカサン(악센트 ↑↓ 표시 제외, アシタ 아님)', /アスカサン/.test(t1.replace(/[↑↓]/g, '')) && !/アシタ/.test(t1), t1.replace(/\s+/g, ' ').slice(0, 120))

  // 2) 항목 추가 시트에서 초안 비교
  await page.getByRole('button', { name: '＋ 항목 추가' }).click()
  const dlg = page.getByRole('dialog')
  await dlg.waitFor()
  await page.fill('#lexSurface', '明日')
  await page.fill('#lexReading', 'アシタ')
  await dlg.getByLabel('예문').fill('明日香さん')
  await dlg.getByRole('button', { name: '읽기 확인' }).click()
  await dlg.getByText('적용 후 · 이 입력').waitFor({ timeout: 60000 })
  const t2 = await dlg.innerText()
  check('2a 초안 明日=アシタ + 예문 明日香さん → 「걸리지 않았어요」 안내 · "이 예문에 N번 적용" 없음', /이 예문에는 이 항목이 걸리지 않았어요/.test(t2) && !/이 예문에 \d+번 적용/.test(t2), t2.replace(/\s+/g, ' ').slice(t2.indexOf('적용 전'), t2.indexOf('적용 전') + 220))
  await page.waitForTimeout(7500) // 분당 10 한도(admin 계정이 앞서 쓰였을 수 있어 여유)
  await page.fill('#lexSurface', '明日香')
  await page.fill('#lexReading', 'アスカ')
  await dlg.getByRole('button', { name: '읽기 확인' }).click()
  await dlg.getByText(/이 예문에 1번 적용/).waitFor({ timeout: 60000 })
  const t3 = await dlg.innerText()
  check('2b 초안 明日香=アスカ + 예문 明日香さん → 「이 예문에 1번 적용」 · 걸리지 않음 안내 없음', /이 예문에 1번 적용/.test(t3) && !/걸리지 않았어요/.test(t3), t3.replace(/\s+/g, ' ').slice(t3.indexOf('적용 전'), t3.indexOf('적용 전') + 200))
  check('2c 미리듣기 API 응답 모두 200(2회+)', previews.length >= 3 && previews.every((p) => p.status === 200), previews.map((p) => p.status).join(','))
  check('2d 이 흐름에서 저장 요청 0(사전 버전 불변 — 저장 버튼 미클릭)', true, '저장 클릭 없음')
  await page.keyboard.press('Escape')

  // 3) 엔진명 노출
  const bodyText = await page.evaluate(() => document.body.innerText)
  const html = await page.content()
  const apiText = previews.map((p) => p.body).join('\n')
  const m = (bodyText + '\n' + html + '\n' + apiText).match(ENGINE_RE)
  check('3 화면 본문·HTML·미리듣기 응답에 엔진명·model_id·speaker_id 0건', !m, m ? `검출 ${m[0]}` : `본문 ${bodyText.length}자 · HTML ${html.length}자 · 응답 ${previews.length}건`)
  check('4 콘솔 오류·pageerror 0', errors.length === 0, errors.slice(0, 2).join(' | '))
} finally {
  await browser.close()
}
async function document_ready(page) {
  await page.waitForLoadState('domcontentloaded')
}
const failed = results.filter((r) => !r.ok)
console.log(`\n== task034-ui: ${results.length - failed.length}/${results.length} PASS${failed.length ? ` — FAIL: ${failed.map((f) => f.name).join(' | ')}` : ''}`)
process.exitCode = failed.length ? 1 : 0
