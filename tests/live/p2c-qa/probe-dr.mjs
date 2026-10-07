import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
const [, , cookieFile] = process.argv
const [cname, ...crest] = readFileSync(cookieFile, 'utf8').trim().split('=')
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 892 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
await ctx.addCookies([{ name: cname, value: crest.join('='), url: 'http://127.0.0.1:3033' }])
await ctx.route('**/api/v1/scenarios/drafts', (r) => r.fulfill({ status: 500, body: '{}' }))
const page = await ctx.newPage()
await page.goto('http://127.0.0.1:3033/study/ai/scenario/new', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.locator('#dr-description').fill('편의점')
const btns = await page.evaluate(() => [...document.querySelectorAll('button')].map((b) => `${b.textContent.trim().slice(0, 14)}|disabled=${b.disabled}|aria-disabled=${b.getAttribute('aria-disabled')}|role=${b.getAttribute('role')}`))
console.log(btns.join('\n'))
await browser.close()
