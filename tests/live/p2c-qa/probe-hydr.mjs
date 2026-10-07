import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
const [, , url, cookieFile, out, w = '390', h = '892'] = process.argv
const [cname, ...crest] = readFileSync(cookieFile, 'utf8').trim().split('=')
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
await ctx.addCookies([{ name: cname, value: crest.join('='), url: new URL(url).origin }])
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 1500)))
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE.ERROR', m.text().slice(0, 1800)) })
await page.goto(url, { waitUntil: 'networkidle' }).catch((e) => console.log('goto err', e.message.slice(0, 100)))
await page.waitForTimeout(2500)
console.log('text=', (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 500))
await page.screenshot({ path: out })
await browser.close()
