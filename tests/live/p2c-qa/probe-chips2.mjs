import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
const [, , base, cookieFile] = process.argv
const [cname, ...crest] = readFileSync(cookieFile, 'utf8').trim().split('=')
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
await ctx.addCookies([{ name: cname, value: crest.join('='), url: base }])
const page = await ctx.newPage()
await page.goto(`${base}/study/ai?tab=scenario`, { waitUntil: 'networkidle' }); await page.waitForTimeout(900)
console.log(JSON.stringify(await page.evaluate(() => {
  const chip = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '카페 주문'); chip.scrollIntoView({block:'center'})
  const b0 = chip.getBoundingClientRect(); const cs = getComputedStyle(chip, '::before'); const b = chip.getBoundingClientRect()
  const nav = chip.parentElement; const nb = nav.getBoundingClientRect()
  const hits = []
  for (let dy = -6; dy <= 8; dy += 1) { const t = document.elementFromPoint(b.left + b.width / 2, b.bottom + dy); hits.push(`${dy}:${t === chip ? 'chip' : t ? t.tagName.toLowerCase() : 'null'}`) }
  return { before: { content: cs.content, position: cs.position, height: cs.height, top: cs.top, translate: cs.translate, transform: cs.transform, pe: cs.pointerEvents }, chip: [b.top, b.bottom], nav: [nb.top, nb.bottom], hits: hits.join(' ') }
}), null, 1))
await browser.close()
