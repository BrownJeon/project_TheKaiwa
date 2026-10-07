/** 항목 3 보충 — S5→S4 복귀 스크롤 이탈 197px(실호출 390 [취소]) 원인 분리(LLM 0): 사전 단계별로 이탈 px 측정. */
import { tapAt, BASE, NEW_PATH, STORE_KEY, SNAP_FILE, check, cleanupQa, closeBrowser, cookieOf, launch, mainScrollTop, note, openPage, prisma, qaUser, QA4, sleep, summary, j } from './lib.mjs'
import { readFileSync } from 'node:fs'
const c4 = cookieOf(process.env.QA_COOKIE)
const u4 = await qaUser(QA4)
const SNAP = JSON.parse(readFileSync(SNAP_FILE, 'utf8')).raw
await cleanupQa(u4.id)
const browser = await launch()
const cases = [
  ['기준(사전 단계 없음)', async () => {}],
  ['설명 칸을 짧은 글로 고침', async (p) => { await p.getByLabel('설명').fill('설명을 고쳐 봐요'); await sleep(600) }],
  ['⋯ 메뉴 열기/닫기 + 설명 고침', async (p) => { const mb = p.locator('button[aria-label$="표현 메뉴"]').nth(3); await mb.scrollIntoViewIfNeeded(); await tapAt(p, mb); await p.getByRole('dialog').waitFor({ state: 'visible' }); await p.keyboard.press('Escape'); await sleep(300); await p.getByLabel('설명').fill('설명을 고쳐 봐요'); await sleep(600) }],
]
for (const [name, pre] of cases) {
  const o = await openPage(browser, 390, 844, c4)
  const { page } = o
  page.setDefaultTimeout(60000)
  await page.goto(BASE + '/api/health', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [STORE_KEY, SNAP])
  await page.goto(BASE + NEW_PATH, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await tapAt(page, page.getByRole('button', { name: '이어서 고치기' }))
  await page.getByRole('heading', { name: '주제 정보' }).waitFor({ state: 'visible' })
  await sleep(500)
  await pre(page)
  const eb = page.locator('[id^="tp-sc-edit-"]').first()
  await eb.scrollIntoViewIfNeeded()
  await sleep(200)
  const sIn = await mainScrollTop(page)
  const yIn = (await eb.boundingBox()).y
  await tapAt(page, eb)
  await page.waitForURL(/step=sc/, { timeout: 10000 })
  await sleep(500)
  await tapAt(page, page.getByRole('button', { name: '취소', exact: true }))
  await sleep(800)
  const sOut = await mainScrollTop(page)
  const yOut = (await page.locator('[id^="tp-sc-edit-"]').first().boundingBox()).y
  note(`${name}: S4 scrollTop ${sIn}→복귀 ${sOut} (이탈 ${sOut - sIn}px) · [고치기] 버튼 화면 y ${Math.round(yIn)}→${Math.round(yOut)}`)
  check(`3y-${name}: 복귀 후 [고치기] 버튼이 화면 안에 보임(y=${Math.round(yOut)})`, yOut > 52 && yOut < 800)
  await o.ctx.close()
}
await closeBrowser(browser)
summary('항목 3y')
await prisma.$disconnect()
