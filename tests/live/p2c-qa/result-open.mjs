// qa-p2c-A — 끝낸 역할극 결과 화면·회화 목록을 실제 서버 응답(가로채기 없음)으로 열어 3폭×2높이를 잰다. 읽기 전용(쓰기 요청은 기록만, 막지 않음 — DB 대조는 counts.ts).
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
const [, , base, cookieFile, fixFile] = process.argv
if (/:3010$/.test(base)) throw new Error('운영 포트 금지')
const fx = JSON.parse(readFileSync(fixFile, 'utf8'))
const [cname, ...crest] = readFileSync(cookieFile, 'utf8').trim().split('=')
const ENGINE = /claude|whisper|reazon|style-?bert|haiku|sonnet|opus|qwen|task-?\d{2,}|phase\s?\d/i
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
let fail = 0
const log = (ok, msg) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}`) }
const pages = [
  { id: 'result', path: `/study/ai/talk/${fx.endedChat}/result` },
  { id: 'list-talk', path: '/study/ai?tab=talk' },
]
for (const width of [360, 390, 412]) {
  const ctx = await browser.newContext({ viewport: { width, height: 892 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
  await ctx.addCookies([{ name: cname, value: crest.join('='), url: base }])
  const page = await ctx.newPage()
  const errors = []; const writes = []; const reqs = []
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 100)))
  page.on('request', (r) => { if (r.url().includes('/api/')) { reqs.push(`${r.method()} ${new URL(r.url()).pathname.replace(/c[a-z0-9]{20,}/g, ':id')}`); if (r.method() !== 'GET') writes.push(`${r.method()} ${new URL(r.url()).pathname}`) } })
  for (const p of pages) {
    errors.length = 0; reqs.length = 0
    for (const h of [892, 780]) {
      await page.setViewportSize({ width, height: h })
      await page.goto(`${base}${p.path}`, { waitUntil: 'networkidle' }).catch(() => undefined)
      await page.waitForTimeout(900)
      const m = await page.evaluate(() => {
        const vw = window.innerWidth; const se = document.scrollingElement
        const scrollers = []
        if (se.scrollHeight > window.innerHeight + 1) scrollers.push('document')
        document.querySelectorAll('*').forEach((el) => { const cs = getComputedStyle(el); if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0) scrollers.push(el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '')) })
        const small = []
        document.querySelectorAll('a[href], button, [role="radio"]').forEach((el) => {
          const r = el.getBoundingClientRect(); if (!r.width || !r.height || el.closest('.sr-only') || getComputedStyle(el).visibility === 'hidden') return
          if (r.height >= 43.5 && r.width >= 43.5) return
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2
          let up = 0, down = 0, left = 0, right = 0
          for (; up < 12; up += 0.25) { const t = document.elementFromPoint(cx, cy - r.height / 2 - up - 0.25); if (!(t && (t === el || el.contains(t)))) break }
          for (; down < 12; down += 0.25) { const t = document.elementFromPoint(cx, cy + r.height / 2 + down + 0.25); if (!(t && (t === el || el.contains(t)))) break }
          for (; left < 12; left += 0.25) { const t = document.elementFromPoint(cx - r.width / 2 - left - 0.25, cy); if (!(t && (t === el || el.contains(t)))) break }
          for (; right < 12; right += 0.25) { const t = document.elementFromPoint(cx + r.width / 2 + right + 0.25, cy); if (!(t && (t === el || el.contains(t)))) break }
          if (r.height + up + down >= 43 && r.width + left + right >= 43) return
          small.push(`hit=${Math.round(r.width + left + right)}x${Math.round(r.height + up + down)} ${el.tagName.toLowerCase()}:${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 18)}`)
        })
        const kana = /[぀-ヿ]/
        const jaMissing = [...document.querySelectorAll('body *')].filter((el) => el.children.length === 0 && kana.test(el.textContent ?? '') && !el.closest('[lang="ja"]') && !el.closest('input,textarea')).map((el) => `${el.tagName.toLowerCase()}:${(el.textContent ?? '').slice(0, 18)}`)
        return { overflowX: Math.max(se.scrollWidth - vw, 0), scrollers, small, text: document.body.innerText, jaMissing, tab: !!document.querySelector('nav[aria-label="주 메뉴"]') }
      })
      const tag = `${p.id} @${width}x${h}`
      log(m.overflowX === 0, `${tag} 가로 넘침 ${m.overflowX}px`)
      log(m.scrollers.length <= 1, `${tag} 스크롤 영역 ${m.scrollers.join(',') || 0}`)
      log(m.small.length === 0, `${tag} 터치 44(히트테스트) ${m.small.join(' · ')}`)
      if (h === 892) {
        log(!ENGINE.test(m.text), `${tag} 엔진명·번호 0`)
        log(m.jaMissing.length === 0, `${tag} 일본어 lang 누락 ${m.jaMissing.join('|')}`)
        log(errors.length === 0, `${tag} 페이지 오류 0 ${errors.join(' | ')}`)
        if (width === 390) console.log(`  [${p.id} text390] ${m.text.replace(/\s+/g, ' ').slice(0, p.id === 'result' ? 700 : 500)}`)
      }
    }
    console.log(`  [${p.id} @${width} api] ${[...new Set(reqs)].join(' | ')}`)
  }
  console.log(`  [@${width} 쓰기 요청] ${[...new Set(writes)].join(' | ') || '없음'}`)
  await ctx.close()
}
await browser.close()
console.log(`RESULT fail=${fail}`)
process.exitCode = fail ? 1 : 0
