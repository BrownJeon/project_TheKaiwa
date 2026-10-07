import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
const [, , cookieFile] = process.argv
const [cname, ...crest] = readFileSync(cookieFile, 'utf8').trim().split('=')
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 892 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
await ctx.addCookies([{ name: cname, value: crest.join('='), url: 'http://127.0.0.1:3033' }])
await ctx.route('**/api/v1/chats', (r) => (r.request().method() === 'POST' ? r.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ success: false, data: { code: 'RATE_LIMITED' }, message: 'x' }) }) : r.continue()))
const page = await ctx.newPage()
await page.goto('http://127.0.0.1:3033/study/ai?tab=scenario&sc=scn_self-intro-first-meeting', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
console.log(await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => /역할극|닫기|처음부터|이어서/.test(b.textContent)).map((b) => `${b.textContent.trim().slice(0, 14)}|disabled=${b.disabled}|aria-disabled=${b.getAttribute('aria-disabled')}`).join('\n')))
const btn = page.getByRole('button', { name: '역할극 시작' })
console.log('count', await btn.count())
await btn.click({ timeout: 8000 }).then(() => console.log('click ok')).catch((e) => console.log('click err', e.message.slice(0, 1500)))
await page.waitForTimeout(800)
console.log('text has 잠시 뒤:', (await page.evaluate(() => document.body.innerText)).includes('잠시 뒤 다시 눌러 주세요'))
await browser.close()
