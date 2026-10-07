import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
const [, , base, cookieFile, chat] = process.argv
const [cname, ...crest] = readFileSync(cookieFile, 'utf8').trim().split('=')
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
await ctx.addCookies([{ name: cname, value: crest.join('='), url: base }])
const page = await ctx.newPage()
await page.goto(`${base}/study/ai/talk/${chat}/result`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000)
console.log(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('main a, main button, a, button')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => `${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 14)}=${e.tagName.toLowerCase()} ${Math.round(e.getBoundingClientRect().width)}x${(Math.round(e.getBoundingClientRect().height * 10) / 10)}`)), null, 0))
await browser.close()
