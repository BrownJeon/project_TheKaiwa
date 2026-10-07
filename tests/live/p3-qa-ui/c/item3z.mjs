/** 항목 3 보충 — 새 초안 도착 흐름(#170 스텁·자동 #166 실호출 1회)에서 S5 [취소] 복귀 이탈 px 측정. 변수: 도착 직후 vs 설명 고침 뒤. */
import { tapAt, BASE, NEW_PATH, STORE_KEY, SNAP_FILE, check, claudeCalls, cleanupQa, closeBrowser, cookieOf, launch, mainScrollTop, note, openPage, prisma, qaUser, QA4, sleep, summary, j } from './lib.mjs'
import { readFileSync } from 'node:fs'
const c4 = cookieOf(process.env.QA_COOKIE)
const u4 = await qaUser(QA4)
const SNAP = JSON.parse(JSON.parse(readFileSync(SNAP_FILE, 'utf8')).raw)
await cleanupQa(u4.id)
note('claudeCalls start ' + j(claudeCalls().done))
const browser = await launch()
const o = await openPage(browser, 390, 844, c4)
const { page, reqs } = o
page.setDefaultTimeout(90000)
const d = SNAP.draft
await page.route('**/api/v1/topics/drafts', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { draft: { title: d.title, titleJa: d.titleJa, level: d.level, description: d.description, chunks: d.chunks.map((c) => ({ chunkType: c.chunkType, textJa: c.textJa, reading: c.reading, meaningKo: c.meaningKo })) }, warnings: [] } }) }))
await page.goto(BASE + '/api/health', { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.evaluate((k) => sessionStorage.removeItem(k), STORE_KEY)
await page.goto(BASE + NEW_PATH, { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.locator('#tp-ask').fill('병원 진료')
await tapAt(page, page.getByRole('button', { name: '초안 만들기' }))
await page.getByRole('heading', { name: '초안이 왔어요' }).waitFor({ state: 'visible', timeout: 60000 })
await page.locator('input[id^="tp-sc-ck-"]').first().waitFor({ state: 'attached', timeout: 90000 })
await sleep(800)
const calls166 = reqs.filter((r) => r.m === 'POST' && r.p === '/api/v1/scenarios/drafts')
note(`#166 ${calls166.length}건 status=${calls166[0]?.status} dt=${calls166[0]?.dt}`)
for (const label of ['도착 직후', '설명 고침 뒤']) {
  if (label === '설명 고침 뒤') { await page.getByLabel('설명').fill('설명을 고쳐 봐요'); await sleep(600) }
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
  note(`${label}(새 초안 흐름): S4 scrollTop ${sIn}→복귀 ${sOut} (이탈 ${sOut - sIn}px) · [고치기] 버튼 y ${Math.round(yIn)}→${Math.round(yOut)}`)
  check(`3z-${label}: 복귀 후 [고치기] 버튼 화면 안(y=${Math.round(yOut)})`, yOut > 52 && yOut < 800)
}
note('claudeCalls end ' + j(claudeCalls().done))
await o.ctx.close()
await cleanupQa(u4.id)
await closeBrowser(browser)
summary('항목 3z')
await prisma.$disconnect()
