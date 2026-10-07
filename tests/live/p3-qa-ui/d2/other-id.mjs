/** qa-045-ui-d2 보충 — 남의 주제 id 로 열기(읽기 전용). 다른 **QA 계정**의 비시드 주제 행이 지금 DB 에 있을 때만 검증하고 없으면 NOT_VERIFIED. 실사용자 행은 조회하지 않는다. */
import { api, BASE, check, closeBrowser, cookieOf, launch, note, openPage, prisma, qaUser, QA1, summary } from '../d/h.mjs'
const cookie = cookieOf(process.env.QA_COOKIE)
const u = await qaUser(QA1)
const other = await prisma.conversationTopic.findFirst({ where: { userId: { not: null, notIn: [u.id] }, user: { email: { endsWith: '@thekaiwa.test' } } }, select: { id: true, userId: true } })
if (!other) {
  note('NOT_VERIFIED: 다른 QA 계정의 비시드 주제 행이 지금 DB 에 없음(레인 규칙상 다른 계정 행을 만들지 않는다)')
} else {
  const r = await api(cookie, 'GET', `/api/v1/topics/${other.id}`)
  check('남의 주제 id GET /api/v1/topics/:id → 404(존재 숨김)', r.status === 404, `status=${r.status}`)
  const browser = await launch()
  const P = await openPage(browser, 390, 844, cookie)
  P.page.setDefaultTimeout(15000)
  await P.page.goto(`${BASE}/settings/scenarios/topics/${other.id}/edit`, { waitUntil: 'domcontentloaded' })
  await P.page.waitForFunction(() => /찾을 수 없어요|#tp-title/.test(document.body.innerText) || !!document.querySelector('#tp-title'), null, { timeout: 15000 }).catch(() => {})
  await new Promise((r) => setTimeout(r, 600))
  const txt = await P.page.evaluate(() => ({ t: document.body.innerText.replace(/\s+/g, ' ').slice(0, 120), inputs: document.querySelectorAll('#tp-title').length }))
  check('남의 주제 id 고치기 화면 → 「이 주제를 찾을 수 없어요」·입력칸 0', /이 주제를 찾을 수 없어요/.test(txt.t) && txt.inputs === 0, JSON.stringify(txt))
  await closeBrowser(browser)
}
summary('d2-other-id')
await prisma.$disconnect()
