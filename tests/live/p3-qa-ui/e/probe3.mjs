// qa-045-ui-e: main 이 따로 스크롤되는지(main.scrollHeight>clientHeight) — 화면별 비교(읽기 전용)
import { BASE, cookieOf, launch, openPage, sleep, j, prisma } from './lib.mjs'
import { env, tap, draftFromSeed, mockPost } from './ui.mjs'
const ck = cookieOf(process.env.QA_COOKIE2)
const browser = await launch()
const { ctx, page } = await openPage(browser, 390, 844, ck)
const metrics = () => page.evaluate(() => {
  const main = document.querySelector('main')
  const mr = main.getBoundingClientRect()
  const out = []
  for (const el of main.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.height === 0 && r.width === 0) continue
    if (r.bottom > mr.bottom + 1) {
      // 조상 중 overflow 로 잘리는 요소(내부 스크롤러 안쪽)는 제외
      let p = el.parentElement, clipped = false
      while (p && p !== main) { const o = getComputedStyle(p).overflowY; if (/(auto|scroll|hidden)/.test(o)) { clipped = true; break } p = p.parentElement }
      if (!clipped) out.push({ tag: el.tagName, cls: String(el.className).slice(0, 60), bottom: Math.round(r.bottom), pos: getComputedStyle(el).position })
    }
  }
  return { mainSH: main.scrollHeight, mainCH: main.clientHeight, mainOv: getComputedStyle(main).overflowY, mainPadB: getComputedStyle(main).paddingBottom, n: out.length, items: out.slice(0, 6) }
})
for (const path of ['/study/ai?tab=scenario', '/settings/scenarios?tab=scenarios', '/study/ai/scenario/scn_cafe-order-drink/edit', '/study/ai/scenario/scn_cafe-order-drink/variant', '/study/ai/scenario/new']) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' })
  await sleep(2500)
  console.log(path, j(await metrics()))
}
await ctx.close()
await browser.close()
await prisma.$disconnect()
