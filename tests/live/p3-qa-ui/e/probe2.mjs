// qa-045-ui-e: 초안 편집 화면 스크롤 구조 진단(읽기 전용 — #166 은 목, 저장 없음)
import { BASE, WIDTHS, cookieOf, launch, openPage, sleep, j, prisma } from './lib.mjs'
import { env, tap, draftFromSeed, mockPost } from './ui.mjs'
const ck = cookieOf(process.env.QA_COOKIE2)
const browser = await launch()
for (const [w, h] of WIDTHS) {
  const { ctx, page } = await openPage(browser, w, h, ck)
  const { draft } = await draftFromSeed(ck, 'scn_cafe-order-drink', { title: 'QA-E probe' })
  delete draft.opening
  await mockPost(page, '**/api/v1/scenarios/drafts', () => ({ json: env({ draft, warnings: [] }) }))
  await mockPost(page, '**/api/v1/scenarios/openings/draft', () => ({ delay: 1200, json: env({ ja: 'いらっしゃいませ。ご注文をどうぞ。', reading: 'いらっしゃいませ。ごちゅうもんをどうぞ。', warnings: [] }) }))
  await page.goto(`${BASE}/study/ai/scenario/new`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#dr-description')
  await page.locator('#dr-description').fill('편의점에서 계산하기 연습')
  await tap(page, page.getByRole('button', { name: '초안 만들기', exact: true }))
  await page.waitForSelector('#dr-title')
  await sleep(300)
  const m = () => page.evaluate(() => {
    const main = document.querySelector('main')
    const inner = document.getElementById('dr-opening')?.closest('.overflow-y-auto')
    const bb = document.querySelector('header, [data-backbar]') ?? main?.firstElementChild
    const btn = document.getElementById('dr-opening').getBoundingClientRect()
    return { mainOv: getComputedStyle(main).overflowY, mainSH: main.scrollHeight, mainCH: main.clientHeight, mainTop: main.scrollTop, docSH: document.documentElement.scrollHeight, innerH: window.innerHeight, innerSH: inner.scrollHeight, innerCH: inner.clientHeight, innerTop: Math.round(inner.scrollTop), btnY: Math.round(btn.top), firstChildTop: Math.round(bb.getBoundingClientRect().top) }
  })
  console.log(w, 'initial', j(await m()))
  await page.locator('#dr-opening').scrollIntoViewIfNeeded()
  console.log(w, 'after scrollIntoView', j(await m()))
  await page.locator('#dr-openingKo').fill('어서 오세요')
  console.log(w, 'koOnly', j(await m()))
  await page.evaluate(() => { const i = document.getElementById('dr-opening').closest('.overflow-y-auto'); i.scrollTop = i.scrollHeight - i.clientHeight - 150 })
  console.log(w, 'headroom150', j(await m()))
  await tap(page, '#dr-opening', { scroll: false })
  await sleep(500)
  console.log(w, 'busy', j(await m()))
  await sleep(1500)
  console.log(w, 'matched', j(await m()))
  await ctx.close()
}
await browser.close()
await prisma.$disconnect()
