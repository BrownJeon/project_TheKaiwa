// qa-045-ui-e: 저장 막힘(focusProblem scrollIntoView center) 때 main 이 따로 스크롤돼 BackBar 가 가려지는지 — Playwright 자동 스크롤 없이 손으로 스크롤 후 터치 탭
import { BASE, cookieOf, launch, openPage, sleep, j, prisma } from './lib.mjs'
import { env, draftFromSeed, mockPost } from './ui.mjs'
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
  const gen = page.getByRole('button', { name: '초안 만들기', exact: true })
  const gb = await gen.boundingBox()
  await page.touchscreen.tap(gb.x + gb.width / 2, gb.y + gb.height / 2)
  await page.waitForSelector('#dr-title')
  await sleep(300)
  const st = () => page.evaluate(() => {
    const main = document.querySelector('main')
    const inner = document.getElementById('dr-opening').closest('.overflow-y-auto')
    const bar = inner.parentElement.firstElementChild
    return { mainTop: main.scrollTop, barTop: Math.round(bar.getBoundingClientRect().top), innerTop: Math.round(inner.scrollTop), innerMax: inner.scrollHeight - inner.clientHeight }
  })
  const escapees = await page.evaluate(() => {
    const inner = document.getElementById('dr-opening').closest('.overflow-y-auto')
    return [...inner.querySelectorAll('*')].filter((e) => ['absolute', 'fixed'].includes(getComputedStyle(e).position) && !inner.contains(e.offsetParent)).slice(0, 6).map((e) => ({ tag: e.tagName, cls: String(e.className).slice(0, 40), top: Math.round(e.getBoundingClientRect().top), pos: getComputedStyle(e).position }))
  })
  console.log(w, 'initial', j(await st()), 'escapees', j(escapees))
  await page.locator('#dr-openingKo').fill('어서 오세요') // fill 은 초점 때문에 자동 스크롤할 수 있다
  console.log(w, 'after fill', j(await st()))
  // 손으로 스크롤: 저장 버튼이 보이게
  await page.evaluate(() => { const i = document.getElementById('dr-opening').closest('.overflow-y-auto'); i.scrollTop = i.scrollHeight })
  console.log(w, 'manual scroll to bottom', j(await st()))
  const sb = page.getByRole('button', { name: '저장', exact: true })
  const b = await sb.boundingBox()
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
  await sleep(600)
  console.log(w, 'after blocked-save tap', j(await st()), 'focus', await page.evaluate(() => document.activeElement?.id))
  await ctx.close()
}
await browser.close()
await prisma.$disconnect()
