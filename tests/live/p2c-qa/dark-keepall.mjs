// qa-p2c-A D — 다크 테마 토큰 반전(계산값)·한국어 어절 중간 줄바꿈(word-break) 점검. 실제 서버 응답(고정 행), 읽기 전용.
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
const [, , base, cookieFile, fixFile, shotDir] = process.argv
if (/:3010$/.test(base)) throw new Error('운영 포트 금지')
const fx = JSON.parse(readFileSync(fixFile, 'utf8'))
const [cname, ...crest] = readFileSync(cookieFile, 'utf8').trim().split('=')
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const paths = [['result', `/study/ai/talk/${fx.endedChat}/result`], ['scn-home', '/study/ai?tab=scenario'], ['scn-new', '/study/ai/scenario/new']]
let fail = 0
const log = (ok, msg) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`) }
const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]) }
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce', colorScheme: scheme })
  await ctx.addCookies([{ name: cname, value: crest.join('='), url: base }])
  const page = await ctx.newPage()
  for (const [id, path] of paths) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(700)
    const r = await page.evaluate(() => {
      const bodyBg = getComputedStyle(document.body).backgroundColor
      const bodyFg = getComputedStyle(document.body).color
      // 대비: 글자 있는 잎 요소의 (색, 실효 배경) — 배경은 가장 가까운 불투명 조상
      const eff = (el) => { for (let p = el; p; p = p.parentElement) { const c = getComputedStyle(p).backgroundColor; const m = c.match(/[\d.]+/g).map(Number); if ((m[3] ?? 1) > 0.5) return c } return 'rgb(255,255,255)' }
      const rows = [...document.querySelectorAll('body *')].filter((el) => el.children.length === 0 && (el.textContent || '').trim().length > 1 && el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== 'hidden').map((el) => ({ fg: getComputedStyle(el).color, bg: eff(el), t: el.textContent.trim().slice(0, 14) }))
      const hangul = /[가-힣]/
      const mid = [...document.querySelectorAll('body *')].filter((el) => el.children.length === 0 && (el.textContent.match(/[가-힣]/g) || []).length >= 12 && el.getBoundingClientRect().height > 30 && !['keep-all'].includes(getComputedStyle(el).wordBreak)).map((el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 40)}:${el.textContent.trim().slice(0, 16)}|wb=${getComputedStyle(el).wordBreak}|ow=${getComputedStyle(el).overflowWrap}`)
      void hangul
      return { bodyBg, bodyFg, rows, mid, theme: document.documentElement.dataset.theme ?? null }
    })
    const L = (c) => lum(c)
    const lowContrast = r.rows.filter((x) => { const a = L(x.fg), b = L(x.bg); const cr = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); return cr < 3 }).slice(0, 4).map((x) => `${x.t}(${x.fg}/${x.bg})`)
    if (scheme === 'dark') log(L(r.bodyBg) < 0.2 && L(r.bodyFg) > 0.5, `dark ${id} 토큰 반전: body bg ${r.bodyBg} fg ${r.bodyFg}`)
    else log(L(r.bodyBg) > 0.5 && L(r.bodyFg) < 0.2, `light ${id} body bg ${r.bodyBg} fg ${r.bodyFg}`)
    log(lowContrast.length === 0, `${scheme} ${id} 글자 대비<3 ${lowContrast.length}곳 ${lowContrast.join(' ')}`)
    if (scheme === 'light') log(r.mid.length === 0, `${id} 한국어 긴 글 word-break keep-all 아닌 곳 ${r.mid.length} ${r.mid.slice(0, 3).join(' ; ')}`)
    if (scheme === 'dark' && id === 'result' && shotDir) await page.screenshot({ path: `${shotDir}/result-dark-360.png` })
  }
  await ctx.close()
}
await browser.close()
console.log(`RESULT fail=${fail}`)
process.exitCode = fail ? 1 : 0
