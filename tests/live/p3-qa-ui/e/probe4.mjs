// qa-045-ui-e: 초안 편집 화면에서 main 이 따로 스크롤되는 원인·저장 막힘 때 BackBar 가려짐 여부(읽기 전용, #166·#178 목)
import { BASE, cookieOf, launch, openPage, sleep, j, prisma } from './lib.mjs'
import { env, tap, draftFromSeed, mockPost } from './ui.mjs'
const ck = cookieOf(process.env.QA_COOKIE2)
const browser = await launch()
for (const [w, h] of [[360, 740], [390, 844], [412, 892]]) {
  const { ctx, page } = await openPage(browser, w, h, ck)
  const { draft } = await draftFromSeed(ck, 'scn_cafe-order-drink', { title: 'QA-E probe' })
  delete draft.opening
  await mockPost(page, '**/api/v1/scenarios/drafts', () => ({ json: env({ draft, warnings: [] }) }))
  await page.goto(`${BASE}/study/ai/scenario/new`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#dr-description')
  await page.locator('#dr-description').fill('편의점에서 계산하기 연습')
  await tap(page, page.getByRole('button', { name: '초안 만들기', exact: true }))
  await page.waitForSelector('#dr-title')
  await sleep(300)
  const probe = (label) => page.evaluate((label) => {
    const main = document.querySelector('main')
    const inner = document.getElementById('dr-opening').closest('.overflow-y-auto')
    const root = inner.parentElement
    const bar = root.firstElementChild
    const r = (el) => { const b = el.getBoundingClientRect(); return { top: Math.round(b.top), h: Math.round(b.height) } }
    const m0 = main.scrollHeight
    inner.style.display = 'none'
    const m1 = main.scrollHeight
    inner.style.display = ''
    const mainChildren = [...main.children].map((c) => ({ tag: c.tagName, cls: String(c.className).slice(0, 50), h: Math.round(c.getBoundingClientRect().height) }))
    return { label, mainSH: m0, mainSHnoInner: m1, mainCH: main.clientHeight, mainTop: main.scrollTop, bar: r(bar), root: r(root), inner: r(inner), mainChildren }
  }, label)
  console.log(w, j(await probe('edit-initial')))
  // 저장 막힘(첫마디 koOnly) → focusProblem → scrollIntoView(center)
  await page.locator('#dr-openingKo').fill('어서 오세요')
  await tap(page, page.getByRole('button', { name: '저장', exact: true }))
  await sleep(600)
  console.log(w, j(await probe('after-blocked-save')))
  await ctx.close()
}
await browser.close()
await prisma.$disconnect()
