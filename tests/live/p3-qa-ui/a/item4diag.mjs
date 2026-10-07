/** qa-045-ui-a 항목 4 진단 — fixture 긴 글에서 main.scrollWidth 가 커지는 원인 요소 찾기(읽기 전용). 변형: unspaced(공백 없는 긴 글)·spaced(공백 있는 긴 글) */
import { api, BASE, launch, newCtx, WIDTHS } from './lib.mjs'
const jt = await api('/api/v1/topics?level=all')
const T = (jt.json?.data?.items ?? []).find((t) => t.isSeed && t.title === '자기소개')
const browser = await launch()
for (const variant of ['unspaced', 'spaced']) {
  for (const vp of [WIDTHS[0]]) {
    const ctx = await newCtx(browser, vp)
    const page = await ctx.newPage()
    await page.route((u) => u.pathname === '/api/v1/topics', async (r) => {
      const resp = await r.fetch(); const j = await resp.json(); const items = j.data?.items ?? j.items; const it = items.find((x) => x.id === T.id)
      const sp = variant === 'spaced'
      it.title = sp ? '아주 아주 긴 주제 이름 '.repeat(5).trim() : '가'.repeat(60)
      it.titleJa = 'あ'.repeat(70)
      it.description = '긴 설명 '.repeat(40).trim()
      it.chunks[0].textJa = 'あ'.repeat(70)
      it.chunks[0].reading = 'ア'.repeat(80)
      it.chunks[0].meaningKo = sp ? '아주 긴 뜻 '.repeat(15).trim() : '뜻'.repeat(100)
      await r.fulfill({ response: resp, json: j })
    })
    await page.goto(`${BASE}/settings/scenarios/topics/${T.id}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    const r = await page.evaluate(() => {
      const main = document.querySelector('main')
      const out = []
      for (const e of main.querySelectorAll('*')) {
        if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0) {
          const cs = getComputedStyle(e)
          out.push({ tag: e.tagName.toLowerCase(), cls: (e.className || '').toString().slice(0, 60), sw: e.scrollWidth, cw: e.clientWidth, ov: cs.overflowX, wb: cs.wordBreak, ow: cs.overflowWrap, text: (e.textContent || '').trim().slice(0, 14) })
        }
      }
      const leaf = [...main.querySelectorAll('p,h2,h3,span,li')].filter((e) => e.children.length === 0 && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible').map((e) => ({ tag: e.tagName.toLowerCase(), cls: (e.className || '').toString().slice(0, 50), lang: e.getAttribute('lang'), sw: e.scrollWidth, cw: e.clientWidth, wb: getComputedStyle(e).wordBreak, ow: getComputedStyle(e).overflowWrap, text: (e.textContent || '').trim().slice(0, 6) }))
      return { mainSW: main.scrollWidth, mainCW: main.clientWidth, leaf }
    })
    console.log(variant, vp.w, JSON.stringify(r))
    await ctx.close()
  }
}
await browser.close()
