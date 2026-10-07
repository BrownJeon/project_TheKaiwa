/** qa-045-ui-d — 앱 화면을 열기만 해도 나가는 쓰기(non-GET) 요청이 있는지(시험 필터 가설 확인). 읽기 전용. */
import { cookieOf, launch, openPage, sleep, BASE, prisma, closeBrowser } from './lib.mjs'
const b = await launch()
const p = await openPage(b, 390, 844, cookieOf(process.env.QA_COOKIE))
await p.page.goto(`${BASE}/settings/scenarios`, { waitUntil: 'domcontentloaded' })
await sleep(4000)
console.log('NONGET_ON_LOAD', JSON.stringify(p.reqs.filter((r) => r.m !== 'GET').map((r) => r.m + ' ' + r.p)))
await closeBrowser(b)
await prisma.$disconnect()
