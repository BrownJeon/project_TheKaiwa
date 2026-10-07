import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
const [, , base, cookieFile] = process.argv
const [cname, ...crest] = readFileSync(cookieFile, 'utf8').trim().split('=')
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
await ctx.addCookies([{ name: cname, value: crest.join('='), url: base }])
const page = await ctx.newPage()
await page.goto(`${base}/study/ai?tab=scenario`, { waitUntil: 'networkidle' }); await page.waitForTimeout(900)
const r = await page.evaluate(() => {
  const out = []
  const probe = (el, label) => {
    const b = el.getBoundingClientRect(); const cx = b.left + b.width / 2
    const at = (dy) => { const t = document.elementFromPoint(cx, b.bottom + dy); return t ? (t === el || el.contains(t) ? 'SELF' : `${t.tagName.toLowerCase()}${t.getAttribute('role') ? '[' + t.getAttribute('role') + ']' : ''}`) : 'null' }
    const par = el.parentElement; const pcs = getComputedStyle(par)
    out.push({ label, h: Math.round(b.height * 10) / 10, below1: at(1), below3: at(3), below6: at(6), parentH: Math.round(par.getBoundingClientRect().height), parentOverflow: `${pcs.overflowX}/${pcs.overflowY}`, parentClass: par.className.slice(0, 80) })
  }
  const chip = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '카페 주문'); if (chip) probe(chip, 'chip 카페 주문')
  const tab = [...document.querySelectorAll('button,a')].find((b) => (b.textContent || '').trim() === '시나리오'); if (tab) probe(tab, 'tab 시나리오')
  const all = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '전체'); if (all) probe(all, 'chip 전체')
  return out
})
console.log(JSON.stringify(r, null, 1))
await browser.close()
