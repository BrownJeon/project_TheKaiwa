/**
 * 항목 2 보충 — 360px 「고치기 [취소]」 scrollTop +32px 재현·원인 분리(LLM 0). 폭·행 번호 바꿔 반복.
 * 각 행마다: [고치기] 열기→[취소] 전후 main.scrollTop, ⋯ 버튼이 취소 직전 화면(main 가시 영역)에 완전히 보였는지, 초점 복귀 후 이동량.
 */
import { tapAt, BASE, NEW_PATH, STORE_KEY, SNAP_FILE, activeInfo, check, cleanupQa, closeBrowser, cookieOf, launch, mainScrollTop, note, openPage, prisma, qaUser, QA4, sleep, summary, j } from './lib.mjs'
import { readFileSync } from 'node:fs'

const c4 = cookieOf(process.env.QA_COOKIE)
const u4 = await qaUser(QA4)
const SNAP = JSON.parse(readFileSync(SNAP_FILE, 'utf8')).raw
const WID = (process.env.ONLY ?? '360').split(',').map(Number)
const ROWS = (process.env.ROWS ?? '2,6,10,14').split(',').map(Number)
const H = { 360: 740, 390: 844, 412: 892 }
await cleanupQa(u4.id)
const browser = await launch()
for (const w of WID) {
  const o = await openPage(browser, w, H[w], c4)
  const { page } = o
  page.setDefaultTimeout(60000)
  await page.goto(BASE + '/api/health', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [STORE_KEY, SNAP])
  await page.goto(BASE + NEW_PATH, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.getByRole('button', { name: '이어서 고치기' }).waitFor({ state: 'visible', timeout: 120000 })
  await tapAt(page, page.getByRole('button', { name: '이어서 고치기' }))
  await page.getByRole('heading', { name: '주제 정보' }).waitFor({ state: 'visible' })
  await sleep(500)
  const menu = page.locator('button[aria-label$="표현 메뉴"]')
  for (const idx of ROWS) {
    const mb = menu.nth(idx)
    await mb.scrollIntoViewIfNeeded()
    await sleep(200)
    const lab = await mb.getAttribute('aria-label')
    await tapAt(page, mb)
    await page.getByRole('dialog').waitFor({ state: 'visible' })
    await page.getByRole('dialog').getByRole('button', { name: '고치기' }).tap()
    await sleep(500)
    // 사용자가 [취소]를 누르려면 먼저 그 버튼이 보여야 한다 — Playwright 의 자동 스크롤이 측정을 오염시키지 않게 먼저 직접 보이게 한다.
    await page.locator(`button[aria-label="${lab}"]`).locator('xpath=ancestor::li[1]').getByRole('button', { name: '취소' }).scrollIntoViewIfNeeded()
    await sleep(300)
    const sOpen = await mainScrollTop(page)
    // 취소 직전 ⋯ 버튼이 main 가시 영역 안에 있나(위·아래 여백 + 하단 고정 요소와 겹침)
    const geo = await page.evaluate((lab) => {
      const b = document.querySelector(`button[aria-label="${lab}"]`)
      const m = document.querySelector('main')
      const br = b.getBoundingClientRect()
      const mr = m.getBoundingClientRect()
      const cx = br.left + br.width / 2
      const cy = br.top + br.height / 2
      const topEl = document.elementFromPoint(cx, Math.min(cy, window.innerHeight - 1))
      return { bTop: Math.round(br.top), bBot: Math.round(br.bottom), mTop: Math.round(mr.top), mBot: Math.round(mr.bottom), innerH: window.innerHeight, hitIsButton: topEl === b || b.contains(topEl), hit: topEl ? topEl.tagName + ':' + String(topEl.className).slice(0, 40) : null }
    }, lab)
    const li = page.locator(`button[aria-label="${lab}"]`).locator('xpath=ancestor::li[1]')
    const cancel = li.getByRole('button', { name: '취소' })
    const cb = await cancel.boundingBox()
    await cancel.tap()
    await sleep(400)
    const sAfter = await mainScrollTop(page)
    const act = await activeInfo(page)
    note(`행${idx} [${w}px] 열림 scrollTop=${sOpen} → 취소 후 ${sAfter} (차 ${sAfter - sOpen}) 취소버튼 y=${cb ? Math.round(cb.y) : '-'} geo=${j(geo)} 초점=${act?.id}`)
    check(`2x-고치기 [취소] 후 scrollTop 차 0px 행${idx} [${w}px]`, sAfter === sOpen, `차 ${sAfter - sOpen}`)
  }
  await o.ctx.close()
}
await closeBrowser(browser)
summary('항목 2x')
await prisma.$disconnect()
