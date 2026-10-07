/**
 * qa-045-ui-f 보충 — 내 주제(MINE) S6 자리표시 점프(출처 안내 상자가 없는 주제). REV-168 Medium 후보의 실측 크기 기록. 응답 1.5초 지연. QA3 주제 1행 만들고 끝에 정리. LLM 0.
 * 실행: cd $Q && QA_BASE=http://127.0.0.1:3059 QA_SNAPSHOT=$Q QA_COOKIE=<c3 쿠키 파일> node --env-file=.env <이 파일>
 */
import { api, data, check, note, summary, launch, openPage, cookieOf, sleep, WIDTHS, BASE, QA3, qaUser, qaRowCounts, cleanupQa, seedHash, prisma, closeBrowser } from '../e/lib.mjs'

const cookie = cookieOf(process.env.QA_COOKIE)
const u = await qaUser(QA3)
await cleanupQa(u.id)
const h0 = await seedHash()
const seed = (data(await api(cookie, 'GET', '/api/v1/topics?level=all'))?.items ?? []).find((t) => t.isSeed && t.title === '자기소개')
const chunks = seed.chunks.slice(0, 8).map((x) => ({ chunkType: x.chunkType, textJa: x.textJa, reading: x.reading, meaningKo: x.meaningKo }))
const rs = await api(cookie, 'POST', '/api/v1/topics', { title: 'QA 내 주제 자리표시', titleJa: '自己紹介', level: 'N5', description: '내 주제 자리표시 점프를 재는 시험용 주제입니다 설명 두 줄', chunks })
const id = data(rs)?.topic?.id
check('준비: QA3 주제 201', rs.status === 201 && !!id, JSON.stringify(rs.body).slice(0, 150))
const browser = await launch()
try {
  for (const [W, H] of WIDTHS) {
    const { ctx, page } = await openPage(browser, W, H, cookie)
    page.setDefaultTimeout(60000)
    await page.route((x) => ['/api/v1/topics', '/api/v1/scenarios', '/api/v1/seed-overrides', '/api/v1/challenges'].includes(x.pathname), async (r) => { const resp = await r.fetch(); await sleep(1500); await r.fulfill({ response: resp }) })
    await page.goto(`${BASE}/settings/scenarios/topics/${id}`, { waitUntil: 'commit' })
    await page.waitForSelector('main [role=status]', { state: 'attached' })
    await sleep(600)
    const L = await page.evaluate(() => { const main = document.querySelector('main'); return [...document.querySelectorAll('div.mx-auto.min-w-0 div[aria-hidden=true] > span.block')].map((s) => { const r = s.getBoundingClientRect(); return [Math.round(r.height * 10) / 10, Math.round((r.top + main.scrollTop) * 10) / 10] }) })
    await page.waitForSelector('section[aria-labelledby=tp-chunks]', { timeout: 20000 })
    await sleep(600)
    const R = await page.evaluate(() => {
      const main = document.querySelector('main')
      const pos = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.height * 10) / 10, Math.round((r.top + main.scrollTop) * 10) / 10] }
      const kids = [...document.querySelector('div.mx-auto.min-w-0').children]
      return { head: pos(kids[0]), chunks: pos(document.querySelector('section[aria-labelledby=tp-chunks]')), sc: pos(document.querySelector('section[aria-labelledby=tp-scenarios]')), hasInfo: /기본 주제예요|내 버전이에요/.test(main.innerText), nKids: kids.length }
    })
    note(`[${W}] 내 주제 S6 자리표시 L=${JSON.stringify(L)} 도착 R=${JSON.stringify(R)} → 머리 카드 차 ${Math.round((R.head[0] - L[0][0]) * 10) / 10}, 표현 절 top ${L[2][1]}→${R.chunks[1]} (이동 ${Math.round((R.chunks[1] - L[2][1]) * 10) / 10}), 출처 상자 있음=${R.hasInfo}`)
    await ctx.close()
  }
} finally {
  await closeBrowser(browser)
  const cf = await cleanupQa(u.id)
  const c1 = await qaRowCounts(u.id)
  const h1 = await seedHash()
  check('종료: QA3 행 0·시드 해시 불변', Object.values(c1).every((n) => n === 0) && h1.sha === h0.sha && h1.sha === 'e826f3ef09237a9c', `${JSON.stringify(cf)} ${JSON.stringify(c1)} ${h1.sha}`)
  summary('item5-mine')
  await prisma.$disconnect()
  process.exit(0)
}
