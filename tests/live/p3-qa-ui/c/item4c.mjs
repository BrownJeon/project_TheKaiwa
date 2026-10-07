/** 항목 4 보충 — 같은 탭 사용자 전환(QA4 쿠키 → QA1 쿠키): 입력칸 비어 있음·이어서 카드/상황 카드 없음·보관 키 삭제. LLM 0. */
import { tapAt, BASE, NEW_PATH, STORE_KEY, SNAP_FILE, check, cleanupQa, closeBrowser, cookieOf, launch, mainText, note, openPage, prisma, qaUser, QA4, readStore, sleep, summary, j } from './lib.mjs'
import { readFileSync } from 'node:fs'
const c4 = cookieOf(process.env.QA_COOKIE)
const c1 = cookieOf(process.env.QA_COOKIE1)
const u4 = await qaUser(QA4)
const raw = JSON.parse(readFileSync(SNAP_FILE, 'utf8')).raw
await cleanupQa(u4.id)
const browser = await launch()
const o = await openPage(browser, 390, 844, c4)
const { page, ctx, reqs } = o
page.setDefaultTimeout(60000)
await page.goto(BASE + '/api/health', { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [STORE_KEY, raw])
await page.goto(BASE + NEW_PATH, { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.getByRole('button', { name: '이어서 고치기' }).waitFor({ state: 'visible', timeout: 120000 })
const hadCard = (await page.getByRole('button', { name: '이어서 고치기' }).count()) === 1
await ctx.clearCookies()
const eq = c1.indexOf('=')
await ctx.addCookies([{ name: c1.slice(0, eq), value: c1.slice(eq + 1), url: BASE }])
const n0 = reqs.length
await page.goto(BASE + NEW_PATH, { waitUntil: 'domcontentloaded' })
await page.locator('#tp-ask').waitFor({ state: 'visible', timeout: 60000 })
await sleep(1500)
const resume = await page.getByRole('button', { name: '이어서 고치기' }).count()
const askVal = await page.locator('#tp-ask').inputValue()
const cards = await page.locator('input[id^="tp-sc-ck-"]').count()
const txt = await mainText(page)
const key = await readStore(page)
const me = await page.evaluate(() => fetch('/api/v1/me', { credentials: 'include' }).then((r) => r.status).catch(() => 'x'))
check('4C-QA4 에서 이어서 카드가 있었다(전제)', hadCard)
check('4C-같은 탭에서 QA1 쿠키로 들어오면: 이어서 고치기 카드 없음·묻기 입력칸 비어 있음·상황 카드 0·「고치던」 글 없음·보관 키 삭제(null) [390px]', resume === 0 && askVal === '' && cards === 0 && !txt.includes('고치던') && key === null, `resume=${resume} askVal=「${askVal}」 cards=${cards} key=${key === null ? 'null' : 'present'}`)
note(`요청: ${j(reqs.slice(n0).map((r) => r.m + ' ' + r.p))}`)
await o.ctx.close()
await closeBrowser(browser)
summary('항목 4C')
await prisma.$disconnect()
