// 옛 교정(NULL) 카드 DOM 캡처 — 같은 방을 열어 `li#cr_*` 의 정규화 outerHTML 과 높이를 JSON 으로 저장한다(HEAD 서버·작업본 서버에서 각각 실행해 비교).
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
const a = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, all) => (x.startsWith('--') ? [...acc, [x.slice(2), all[i + 1]]] : acc), []))
const BASE = a.base
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE) || /:3010$/.test(BASE)) throw new Error('dev localhost 만')
const cookie = readFileSync(a.cookie, 'utf8').trim()
const [cname, ...cr] = cookie.split('=')
const prep = JSON.parse(readFileSync(a.prep, 'utf8'))
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const out = {}
try {
  for (const w of [360, 390, 412]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 892 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
    await ctx.addCookies([{ name: cname, value: cr.join('='), url: BASE }])
    const page = await ctx.newPage()
    await page.goto(`${BASE}/study/ai/chat/${prep.chatId}/review`, { waitUntil: 'load' })
    await page.waitForSelector(`#cr_${prep.ids[0]}`, { timeout: 25000 })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForSelector('ruby', { timeout: 15000 }).catch(() => undefined)
    await page.waitForTimeout(1200)
    out[w] = await page.evaluate((ids) => ids.map((id) => { const li = document.getElementById('cr_' + id); const r = li.getBoundingClientRect(); return { h: Math.round(r.height * 100) / 100, w: Math.round(r.width * 100) / 100, html: li.outerHTML.split(id).join('<ID>') } }), prep.ids)
    await ctx.close()
  }
} finally { await browser.close() }
writeFileSync(a.out, JSON.stringify(out), 'utf8')
console.log('saved', a.out, Object.keys(out).map((w) => out[w].map((c) => `${c.w}x${c.h}`).join('/')).join(' | '))
