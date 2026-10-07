/**
 * 항목 3 보충 — 360px S5 [완료] 가 안 먹은 현상 재현·원인 분리(LLM 0). 폭 ONLY, 반복 N.
 * 각 시도: S5 로 들어가 제목 고침 → [완료] 가 화면에 보이게 한 뒤 중심 좌표의 elementFromPoint·가림 요소·탭 후 URL 기록.
 */
import { tapAt, BASE, NEW_PATH, STORE_KEY, SNAP_FILE, activeInfo, check, cleanupQa, closeBrowser, cookieOf, launch, mainScrollTop, note, openPage, prisma, qaUser, QA4, sleep, summary, j } from './lib.mjs'
import { readFileSync } from 'node:fs'

const c4 = cookieOf(process.env.QA_COOKIE)
const u4 = await qaUser(QA4)
const SNAP = JSON.parse(readFileSync(SNAP_FILE, 'utf8')).raw
const WID = (process.env.ONLY ?? '360').split(',').map(Number)
const N = Number(process.env.N ?? 3)
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
  for (let i = 1; i <= N; i++) {
    const edit = page.locator('#tp-sc-edit-sc0')
    await edit.scrollIntoViewIfNeeded()
    await tapAt(page, edit)
    await page.waitForURL(/step=sc0/, { timeout: 10000 })
    await sleep(600)
    await page.locator('main input:visible').first().fill(`고침${i}`)
    const done = page.getByRole('button', { name: '완료', exact: true })
    await done.scrollIntoViewIfNeeded()
    await sleep(300)
    const geo = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => (x.textContent ?? '').trim() === '완료')
      const r = b.getBoundingClientRect()
      const m = document.querySelector('main')
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const el = document.elementFromPoint(cx, cy)
      return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), innerH: window.innerHeight, mainScroll: m.scrollTop, mainMax: m.scrollHeight - m.clientHeight, hit: el ? el.tagName + '#' + el.id + '.' + String(el.className).slice(0, 60) : null, hitIsDone: el === b || b.contains(el) }
    })
    const before = new URL(page.url()).search
    await tapAt(page, done)
    await sleep(1500)
    const after = new URL(page.url()).search
    note(`시도${i} [${w}px] geo=${j(geo)} URL ${before} → ${after} 초점=${j(await activeInfo(page))}`)
    check(`3x-[완료] 탭이 S4 로 돌아감 시도${i} [${w}px]`, !/step=sc0/.test(after), `hitIsDone=${geo.hitIsDone}`)
    if (/step=sc0/.test(after)) {
      // 재시도: 한 번 더 탭 (원인이 일시 지연인지 가림인지)
      await tapAt(page, done)
      await sleep(1500)
      note(`  재탭 후 URL=${new URL(page.url()).search}`)
      if (/step=sc0/.test(page.url())) await page.goBack()
      await sleep(800)
    }
  }
  await o.ctx.close()
}
await closeBrowser(browser)
summary('항목 3x')
await prisma.$disconnect()
