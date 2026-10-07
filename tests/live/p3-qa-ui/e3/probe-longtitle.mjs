/**
 * qa-045-ui-e3 보조 — 최대 길이(40자) 챌린지 제목이 안내 상자 <p> 안에서 줄바꿈 못 하고 뷰포트 밖으로 나가는지, 글자 단위(Range) 실측.
 * (item4 의 요소 rect 검사는 글이 박스를 넘쳐도 요소 rect 는 그대로라 놓친다.) QA3 DB 행만 만들고 지운다. LLM 0.
 * 실행: cd $Q && QA_BASE=http://127.0.0.1:3057 QA_SNAPSHOT=$Q QA_COOKIE=<c3 쿠키 파일> node --env-file=.env <이 파일>  (세 폭 모두)
 */
import { check, note, summary, launch, openPage, cookieOf, sleep, WIDTHS, BASE, QA3, qaUser, qaRowCounts, cleanupQa, seedHash, prisma, closeBrowser, insertChallenge, T_CAFE, T_ROAD } from '../e/lib.mjs'

const cookie = cookieOf(process.env.QA_COOKIE)
const LONG = '가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자'.slice(0, 40)
const SPACED = '가나다라마바 사아자차카타 파하가나다라 마바사아자차 카타파하가나'
const textOverflow = () =>
  [...document.querySelectorAll('main *')]
    .flatMap((el) => {
      const cw = document.documentElement.clientWidth
      const out = []
      for (const n of el.childNodes) {
        if (n.nodeType !== 3 || !(n.textContent ?? '').trim()) continue
        if (el.closest('.sr-only')) continue
        const r = document.createRange()
        r.selectNodeContents(n)
        for (const q of r.getClientRects()) if (q.right > cw + 0.5 || q.left < -0.5) out.push({ tag: el.tagName, txt: n.textContent.trim().slice(0, 30), left: Math.round(q.left), right: Math.round(q.right), boxRight: Math.round(el.getBoundingClientRect().right), cw })
      }
      return out
    })
    .slice(0, 6)

const u = await qaUser(QA3)
await cleanupQa(u.id)
const h0 = await seedHash()
const act = await insertChallenge(u.id, { id: T_ROAD, title: '길 묻기', level: 'N5' }, 'ACTIVE', { title: LONG })
const done = await insertChallenge(u.id, { id: T_CAFE, title: '카페 주문', level: 'N5' }, 'COMPLETED', { title: 'QA 완료 긴제목 시험' })
const browser = await launch()
try {
  for (const [W, H] of WIDTHS) {
    const { ctx, page } = await openPage(browser, W, H, cookie)
    for (const [label, title] of [['무공백 40자', LONG], ['공백 있는 40자(대조)', SPACED]]) {
      await prisma.challenge.update({ where: { id: act.id }, data: { title } })
      for (const [name, path] of [['완료 결과 화면(지금은 「…」 상자)', `/plan/challenge/${done.id}`], ['진행 중 챌린지 화면', `/plan/challenge/${act.id}`], ['계획표', '/plan'], ['챌린지 기록 목록', '/plan/challenges']]) {
        await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 90000 })
        await page.locator('main').getByText(title.slice(0, 6)).first().waitFor({ state: 'visible', timeout: 40000 }).catch(() => {})
        await sleep(600)
        const o = await page.evaluate(textOverflow)
        const m = await page.evaluate(() => { const m = document.querySelector('main'); return { mainSW: m.scrollWidth, mainCW: m.clientWidth, docSW: document.documentElement.scrollWidth } })
        note(`[${W}] ${label} · ${name}: 글자 뷰포트 밖 ${o.length}건 ${JSON.stringify(o.slice(0, 2))} | main ${m.mainSW}/${m.mainCW} doc ${m.docSW}`)
        const expectOk = label.startsWith('공백')
        check(`[${W}] ${label} · ${name}: 글자가 뷰포트 안(우측 ≤ clientWidth)`, o.length === 0, expectOk ? '대조군' : JSON.stringify(o.slice(0, 2)))
      }
    }
    await ctx.close()
  }
} finally {
  await closeBrowser(browser)
  await cleanupQa(u.id)
  const c1 = await qaRowCounts(u.id)
  const h1 = await seedHash()
  check('종료 QA3 행 0·시드 해시 불변', Object.values(c1).every((n) => n === 0) && h1.sha === h0.sha && h1.sha === 'e826f3ef09237a9c', JSON.stringify(c1) + ' ' + h1.sha)
  summary('probe-longtitle')
  await prisma.$disconnect()
  process.exit(0)
}
