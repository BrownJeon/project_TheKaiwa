import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
const [, , base, cookieFile, chat, dir] = process.argv
const [cname, ...crest] = readFileSync(cookieFile, 'utf8').trim().split('=')
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
for (const w of [360, 412]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 780 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
  await ctx.addCookies([{ name: cname, value: crest.join('='), url: base }])
  const page = await ctx.newPage()
  for (const [id, path] of [['result', `/study/ai/talk/${chat}/result`], ['ended-room', `/study/ai/talk/${chat}`]]) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000)
    const m = await page.evaluate(() => ({ ox: document.scrollingElement.scrollWidth - innerWidth, h: document.scrollingElement.scrollHeight }))
    console.log(`${id}@${w}: overflowX=${m.ox} docH=${m.h}`)
    if (w === 360) await page.screenshot({ path: `${dir}/${id}-360.png` })
  }
  await ctx.close()
}
await browser.close()
