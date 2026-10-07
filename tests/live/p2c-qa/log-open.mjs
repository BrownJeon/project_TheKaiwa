// qa-p2c-A E — 내 발화 기록(/settings/utterances) 실제 서버 응답(QA1 고정 행)으로 3폭 실측: 가로 넘침·히트테스트 44·라벨 줄 넘침·"더 보기×필터 변경" 경합.
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
const [, , base, cookieFile] = process.argv
if (/:3010$/.test(base)) throw new Error('운영 포트 금지')
const [cname, ...crest] = readFileSync(cookieFile, 'utf8').trim().split('=')
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
let fail = 0
const log = (ok, msg) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`) }
const measure = (page) => page.evaluate(() => {
  const se = document.scrollingElement; const vw = window.innerWidth
  const small = []
  document.querySelectorAll('a[href], button, [role="radio"], [role="tab"]').forEach((el) => {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height || el.closest('.sr-only')) return
    if (r.height >= 43.5 && r.width >= 43.5) return
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    let up = 0, down = 0
    for (; up < 12; up += 0.25) { const t = document.elementFromPoint(cx, cy - r.height / 2 - up - 0.25); if (!(t && (t === el || el.contains(t)))) break }
    for (; down < 12; down += 0.25) { const t = document.elementFromPoint(cx, cy + r.height / 2 + down + 0.25); if (!(t && (t === el || el.contains(t)))) break }
    if (r.height + up + down >= 43) return
    small.push(`hit=${Math.round(r.width)}x${Math.round(r.height + up + down)} ${(el.textContent || '').trim().slice(0, 14)}`)
  })
  const wide = [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > vw + 0.5 && getComputedStyle(el).position !== 'fixed').length
  return { overflowX: Math.max(se.scrollWidth - vw, 0), small, wide, text: document.body.innerText }
})
for (const width of [360, 390, 412]) {
  const ctx = await browser.newContext({ viewport: { width, height: 780 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
  await ctx.addCookies([{ name: cname, value: crest.join('='), url: base }])
  const page = await ctx.newPage()
  const errors = []; page.on('pageerror', (e) => errors.push(e.message.slice(0, 100)))
  await page.goto(`${base}/settings/utterances`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800)
  const m = await measure(page)
  log(m.overflowX === 0 && m.wide === 0, `@${width} 가로 넘침 ${m.overflowX}px · 틀 밖 요소 ${m.wide}`)
  log(m.small.length === 0, `@${width} 터치 44(히트테스트) ${m.small.join(' · ')}`)
  log(errors.length === 0, `@${width} 페이지 오류 0 ${errors.join('|')}`)
  const labels = ['보내지 않은 말', '연결된 대화 없음', '확인 필요']
  log(labels.every((l) => m.text.includes(l)), `@${width} 라벨 노출 ${labels.map((l) => `${l}:${m.text.includes(l)}`).join(' ')}`)
  // 라벨 줄 넘침: 라벨 요소의 scrollWidth > clientWidth (말줄임 없이 잘림) 검사
  const clip = await page.evaluate(() => [...document.querySelectorAll('*')].filter((el) => el.children.length === 0 && /보내지 않은 말|연결된 대화 없음/.test(el.textContent || '')).map((el) => ({ t: el.textContent.trim().slice(0, 12), sw: el.scrollWidth, cw: el.clientWidth, right: Math.round(el.getBoundingClientRect().right), vw: window.innerWidth })))
  log(clip.length > 0 && clip.every((c) => c.sw <= c.cw + 1 && c.right <= c.vw), `@${width} 라벨 잘림·넘침 0 ${JSON.stringify(clip)}`)
  if (width === 360) {
    const rowCount = () => page.evaluate(() => document.querySelectorAll('li').length)
    const before = await rowCount()
    console.log(`  [@360] 첫 쪽 li ${before} · 더 보기 버튼 ${await page.getByRole('button', { name: '더 보기' }).count()}`)
    // 경합: 더 보기를 누르자마자 필터(확인 필요)로 바꾼다 — 필터와 안 맞는 이전 쪽이 섞이면 안 된다
    await page.getByRole('button', { name: '더 보기' }).click().catch((e) => console.log('more click err', e.message.slice(0, 80)))
    await page.getByRole('radio', { name: /^확인 필요/ }).click({ delay: 0 }).catch(async () => { await page.getByText(/^확인 필요/).first().click() })
    await page.waitForTimeout(1500)
    const t = await page.evaluate(() => [...document.querySelectorAll('li')].map((li) => li.textContent.replace(/\s+/g, ' ').slice(0, 70)))
    const nonReview = t.filter((x) => !/들린 말 확인|확인 필요|다르게 들렸/.test(x) && /テスト発話|ありがとうございます/.test(x))
    log(nonReview.length === 0, `@360 더 보기 직후 필터 변경 → 확인 필요 목록만 (li ${t.length}, 필터 밖 의심 ${nonReview.length}) ${JSON.stringify(nonReview.slice(0, 2))}`)
    const back = await page.getByRole('radio', { name: /^전체/ }).click().catch(async () => { await page.getByText(/^전체/).first().click() })
    await page.waitForTimeout(1200)
    const all = await rowCount()
    log(all >= 20 && all <= 28, `@360 전체로 되돌리면 첫 쪽부터 다시(li ${all})`)
    void back
  }
  await ctx.close()
}
await browser.close()
console.log(`RESULT fail=${fail}`)
process.exitCode = fail ? 1 : 0
