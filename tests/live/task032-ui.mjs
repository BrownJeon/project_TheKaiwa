/**
 * task-032 QA — 채팅방(실 Chrome, 360/390/412)에서 사전 항목(青か)이 후리가나·한글 줄에 반영되는지 DOM 으로 확인한다.
 * 채팅 GET 응답의 마지막 강사 말만 `赤か青か、どっちがいいですか？` 로 바꿔 보여 준다(DB 변경 없음). 사전은 관리자 API 로 LOCAL 에 青か 를 켰다가
 * 끝에 Rollback 으로 되돌린다. 사용: node tests/live/task032-ui.mjs --base http://127.0.0.1:3024 --user <쿠키> --admin <쿠키> --chat <chatId> [--out dir]
 */
import { readFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const a = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, all) => (x.startsWith('--') ? [...acc, [x.slice(2), all[i + 1]]] : acc), []))
const BASE = a.base
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw new Error('localhost 만')
const cu = readFileSync(a.user, 'utf8').trim()
const ca = readFileSync(a.admin, 'utf8').trim()
const CHAT = a.chat
if (a.out) mkdirSync(a.out, { recursive: true })
const L = '/api/admin/v1/lexicon'
const adm = async (m, p, b) => {
  const r = await fetch(BASE + p, { method: m, headers: { Cookie: ca, ...(b ? { 'Content-Type': 'application/json' } : {}) }, body: b ? JSON.stringify(b) : undefined })
  return { status: r.status, json: await r.json().catch(() => null) }
}
const ver = async () => (await adm('GET', `${L}?pageSize=1`)).json.data.dictionaryVersion
const v0 = await ver()
const add = await adm('POST', L, { surface: '青か', reading: 'アオカ', scope: 'GLOBAL', baseVersion: v0, reason: 'QA-032 화면 확인' })
console.log(`사전: v${v0} → 青か 추가 ${add.status}`)
const results = []
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
try {
  for (const w of [360, 390, 412]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 780 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce', colorScheme: 'light' })
    const [name, ...rest] = cu.split('=')
    await ctx.addCookies([{ name, value: rest.join('='), url: BASE }])
    const page = await ctx.newPage()
    await page.route(`**/api/v1/chats/${CHAT}?limit=50`, async (route) => {
      const res = await route.fetch()
      const j = await res.json()
      const msgs = j.data.messages
      for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === 'ASSISTANT') { msgs[i].content = '赤か青か、どっちがいいですか？'; msgs[i].reading = null; msgs[i].translation = null; break }
      await route.fulfill({ response: res, json: j })
    })
    const ann = []
    page.on('response', async (r) => { if (r.url().endsWith('/api/v1/text/annotate')) ann.push(r.status()) })
    await page.goto(`${BASE}/study/ai/chat/${CHAT}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('text=どっちがいいですか', { timeout: 15000 })
    await page.waitForSelector('ruby', { timeout: 15000 })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(800)
    const info = await page.evaluate(() => {
      const blocks = [...document.querySelectorAll('[lang="ja"]')].filter((e) => (e.textContent || '').includes('どっちがいい'))
      const el = blocks[blocks.length - 1]
      const bubble = el?.closest('div')?.parentElement
      const rubies = el ? [...el.querySelectorAll('ruby')].map((r) => (r.firstChild?.textContent ?? '') + '{' + (r.querySelector('rt')?.textContent ?? '') + '}') : []
      const hangul = [...document.querySelectorAll('p,div,span')].map((e) => e.textContent || '').filter((t) => /아까까 /.test(t)).map((t) => t.trim()).sort((x, y) => x.length - y.length)[0] ?? null
      const de = document.documentElement
      const over = [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > de.clientWidth + 0.5).length
      return { rubies, hangul, scrollW: de.scrollWidth, clientW: de.clientWidth, over, bodyText: bubble?.textContent?.slice(0, 120) ?? null }
    })
    results.push({ w, ann, ...info })
    console.log(`[${w}] annotate=${ann.join(',')} ruby=${info.rubies.join('')} hangul=${JSON.stringify(info.hangul)} scrollW=${info.scrollW}/clientW=${info.clientW} 넘침요소=${info.over}`)
    if (a.out && w === 390) await page.screenshot({ path: `${a.out}/chat-390.png` })
    await ctx.close()
  }
} finally {
  await browser.close()
  const v1 = await ver()
  const rb = await adm('POST', `${L}/versions/${v0}/rollback`, { baseVersion: v1, reason: 'QA-032 화면 확인 후 Rollback' })
  console.log(`사전 Rollback v${v0} → ${rb.status}`)
}
const ok = results.length === 3 && results.every((r) => r.rubies.join('').includes('青{あお}') && /아오까/.test(r.hangul ?? '') && r.scrollW <= r.clientW)
console.log(ok ? 'UI PASS' : 'UI FAIL')
process.exit(ok ? 0 : 1)
