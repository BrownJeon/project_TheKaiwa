/** qa-045-ui-a 항목 1 — S1 설정 행·진입·하단 탭. 실행: SP=<scratchpad> node item1.mjs */
import { api, BASE, check, launch, newCtx, overflowReport, SHOTS, summary, tabbarPresent, WIDTHS } from './lib.mjs'

const topics = await api('/api/v1/topics?level=all')
const seedTopicId = topics.json?.data?.items?.find((t) => t.isSeed)?.id ?? topics.json?.items?.find((t) => t.isSeed)?.id
console.log('seedTopicId', seedTopicId ? 'ok' : 'MISSING', 'topics status', topics.status)
const browser = await launch()
for (const vp of WIDTHS) {
  const tag = `${vp.w}`
  const ctx = await newCtx(browser, vp)
  const page = await ctx.newPage()
  page.setDefaultTimeout(90_000)
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  // 1) /settings 첫 화면 행 위치
  const g = await page.evaluate(() => {
    const row = document.querySelector('a[href="/settings/scenarios"]')
    if (!row) return null
    const r = row.getBoundingClientRect()
    const main = document.querySelector('main')
    // 계정 카드 = '로그인 계정' 문구를 가진 section
    const acct = [...document.querySelectorAll('section')].find((s) => s.textContent?.includes('로그인 계정'))
    const ar = acct?.getBoundingClientRect()
    const rowSection = row.closest('section')?.getBoundingClientRect()
    const tab = document.querySelector('nav[aria-label="주 메뉴"]')?.getBoundingClientRect()
    const h3 = row.closest('section')?.querySelector('h3')?.textContent
    const sub = acct?.nextElementSibling === row.closest('section')
    return {
      top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), width: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right),
      acctBottom: ar ? Math.round(ar.bottom) : null, sectionTop: rowSection ? Math.round(rowSection.top) : null,
      tabTop: tab ? Math.round(tab.top) : null, innerHeight, mainScrollTop: main?.scrollTop ?? -1,
      adjacentSibling: sub, sectionHeading: h3, text: row.textContent,
    }
  })
  console.log(`[${tag}] S1 row`, JSON.stringify(g))
  check(`1.row-exists@${tag}`, !!g)
  if (g) {
    check(`1.row-below-account-adjacent@${tag}`, g.adjacentSibling === true && g.sectionTop !== null && g.acctBottom !== null && g.sectionTop - g.acctBottom <= 24, `acctBottom=${g.acctBottom} sectionTop=${g.sectionTop} rowTop=${g.top} adjacentSibling=${g.adjacentSibling}`)
    check(`1.row-within-780@${tag}`, g.bottom <= 780, `rowBottom=${g.bottom} (actual viewport h=${g.innerHeight}, tabTop=${g.tabTop}, mainScrollTop=${g.mainScrollTop})`)
    check(`1.row-above-tabbar-in-viewport@${tag}`, g.tabTop === null ? g.bottom <= g.innerHeight : g.bottom <= g.tabTop, `rowBottom=${g.bottom} tabTop=${g.tabTop} innerH=${g.innerHeight}`)
    check(`1.row-height>=56@${tag}`, g.height >= 56, `height=${g.height} width=${g.width}`)
    check(`1.row-touch>=44@${tag}`, g.height >= 44 && g.width >= 44, `${g.width}x${g.height}`)
    check(`1.row-text@${tag}`, /내 상황·주제 관리/.test(g.text) && /주제를 적으면 선생님이 상황 초안을 만들어요/.test(g.text), g.text?.slice(0, 80))
  }
  check(`1.settings-tabbar-present@${tag}`, (await tabbarPresent(page)) === true)
  const ov0 = await overflowReport(page)
  check(`1.settings-no-hscroll@${tag}`, !ov0.docOverflowX && !ov0.mainOverflowX && ov0.overflowCount === 0, JSON.stringify({ doc: ov0.docScrollWidth, cw: ov0.clientWidth, mainSW: ov0.mainScrollW, mainCW: ov0.mainClientW, cnt: ov0.overflowCount, els: ov0.overflowEls }))
  if (vp.w === 390) await page.screenshot({ path: `${SHOTS}/item1-settings-390.png` })
  // 2) 탭 → 관리 화면
  await page.locator('a[href="/settings/scenarios"]').tap()
  await page.waitForURL(/\/settings\/scenarios(\?|$)/)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
  check(`1.tap-goes-to-scenarios@${tag}`, new URL(page.url()).pathname === '/settings/scenarios', page.url().replace(BASE, ''))
  check(`1.scenarios-tabbar-hidden@${tag}`, (await tabbarPresent(page)) === false)
  const ov1 = await overflowReport(page)
  check(`1.scenarios-no-hscroll@${tag}`, !ov1.docOverflowX && !ov1.mainOverflowX && ov1.overflowCount === 0, JSON.stringify({ doc: ov1.docScrollWidth, cw: ov1.clientWidth, mainSW: ov1.mainScrollW, mainCW: ov1.mainClientW, cnt: ov1.overflowCount, els: ov1.overflowEls }))
  check(`1.scenarios-no-page-vscroll@${tag}`, ov1.pageVScroll === false, `docScrollH=${ov1.docScrollH} innerH=${ov1.innerHeight}`)
  const back = await page.evaluate(() => {
    const a = document.querySelector('header a[aria-label]')
    if (!a) return null
    const r = a.getBoundingClientRect()
    return { href: a.getAttribute('href'), label: a.getAttribute('aria-label'), w: Math.round(r.width), h: Math.round(r.height) }
  })
  console.log(`[${tag}] back`, JSON.stringify(back))
  check(`1.back-target>=44@${tag}`, !!back && back.w >= 44 && back.h >= 44, JSON.stringify(back))
  await page.locator('header a[aria-label]').first().tap()
  await page.waitForURL((u) => u.pathname === '/settings')
  await page.waitForLoadState('networkidle')
  check(`1.back-returns-settings@${tag}`, new URL(page.url()).pathname === '/settings', `${page.url().replace(BASE, '')} href=${back?.href}`)
  check(`1.settings-tabbar-present-after-back@${tag}`, (await tabbarPresent(page)) === true)
  // 3) 하위 경로 하단 탭 숨김
  const subs = ['/settings/scenarios?tab=topics', '/settings/scenarios?tab=scenarios&sc=scn_self-intro-first-meeting', `/settings/scenarios/topics/${seedTopicId}`, '/settings/scenarios/topics/new']
  for (const s of subs) {
    await page.goto(`${BASE}${s}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    check(`1.hidden-tabbar ${s.replace(seedTopicId ?? '', '<id>')}@${tag}`, (await tabbarPresent(page)) === false)
  }
  // 업데이트 띠(앱 전용)는 웹에서 DOM 0 — 참고만
  await ctx.close()
}
await browser.close()
summary()
