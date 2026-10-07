/**
 * qa-045-ui-e3 보조 — 변형 화면 [변형 초안 만들기] 한 번 탭 직후 초점·버튼 위치 이동(R6 「누른 버튼에 초점이 남는다」, 취소 잠금 더블탭 좌표). DB 쓰기 0, #177 모의만.
 * 실행: cd $Q && QA_BASE=http://127.0.0.1:3057 QA_SNAPSHOT=$Q QA_COOKIE=<c3 쿠키 파일> node --env-file=.env <이 파일>  (세 폭 모두 한 번에)
 */
import { check, note, summary, launch, openPage, cookieOf, sleep, WIDTHS, BASE, SEED_SC, prisma, closeBrowser } from '../e/lib.mjs'
import { env, draftFromSeed, mockPost, tap } from '../e/ui.mjs'

const cookie = cookieOf(process.env.QA_COOKIE)
const base = await draftFromSeed(cookie, SEED_SC)
const browser = await launch()
try {
  for (const [W, H] of WIDTHS) {
    const { ctx, page } = await openPage(browser, W, H, cookie)
    await mockPost(page, '**/api/v1/scenarios/*/variants/drafts', async () => ({ delay: 4000, json: env({ draft: base.draft, changedFields: ['title'], axes: { persona: 'kind', twist: 'none', flow: 'same', level: 'same' } }) }))
    await page.goto(`${BASE}/study/ai/scenario/${SEED_SC}/variant`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.getByText('무엇을 바꿔 볼까요?').first().waitFor({ timeout: 90000 })
    await sleep(300)
    await tap(page, page.locator('label:has(input[name="va-persona"][value="kind"])').first())
    const btn = page.locator('button', { hasText: '변형 초안 만들기' }).first()
    await btn.scrollIntoViewIfNeeded()
    await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => x.textContent.includes('변형 초안 만들기')).dataset.qa = 'orig' })
    const b0 = await page.evaluate(() => { const r = document.querySelector('[data-qa=orig]').getBoundingClientRect(); const i = document.querySelector('div.relative.min-h-0.flex-1.overflow-y-auto'); return { top: Math.round(r.top), h: Math.round(r.height), inner: i?.scrollTop ?? -1, vh: window.innerHeight } })
    await tap(page, btn, { scroll: false })
    await sleep(300)
    const g = await page.evaluate(() => { const b = document.querySelector('[data-qa=orig]'); const r = b.getBoundingClientRect(); const s = [...document.querySelectorAll('[role=status]')].find((e) => e.textContent.includes('변형 상황 초안')); const sr = s?.getBoundingClientRect(); const i = document.querySelector('div.relative.min-h-0.flex-1.overflow-y-auto'); return { text: b.textContent.trim(), focused: document.activeElement === b, aria: b.getAttribute('aria-disabled'), top: Math.round(r.top), statusBottom: sr ? Math.round(sr.bottom) : null, inner: i?.scrollTop ?? -1, active: document.activeElement?.tagName } })
    note(`[${W}] 만들기 시작 전 ${JSON.stringify(b0)} → 시작 300ms 뒤 ${JSON.stringify(g)} (버튼 이동 ${g.top - b0.top}px)`)
    check(`[${W}] 한 번 탭 뒤 같은 버튼이 [그만두기]로 바뀌고 초점 유지(R6)`, g.text === '그만두기' && g.focused === true, JSON.stringify(g))
    check(`[${W}] 만드는 중 표시가 버튼 위(statusBottom ≤ 버튼 top)`, g.statusBottom !== null && g.statusBottom <= g.top, JSON.stringify(g))
    note(`[${W}] 만드는 중 표시가 끼며 버튼이 ${g.top - b0.top}px 아래로 밀림(같은 좌표 두 번째 탭은 [그만두기]가 아니라 표시 상자에 닿음 — 시작 직후 더블탭 방어는 취소 잠금이 아니라 이동 때문에 이뤄진다 [추측])`)
    await sleep(900)
    // 잠금 해제 뒤 새 위치의 [그만두기] 탭 → 취소
    const nb = page.locator('[data-qa=orig]')
    await tap(page, nb, { scroll: false })
    await sleep(500)
    const idle = await page.evaluate(() => ({ text: document.querySelector('[data-qa=orig]')?.textContent?.trim(), status: [...document.querySelectorAll('[role=status]')].some((e) => e.textContent.includes('변형 상황 초안')) }))
    check(`[${W}] 잠금 뒤 [그만두기] 탭 → 취소(만들기 버튼 복귀)`, idle.text === '변형 초안 만들기' && !idle.status, JSON.stringify(idle))
    await ctx.close()
  }
} finally {
  await closeBrowser(browser)
  summary('probe-focus')
  await prisma.$disconnect()
  process.exit(0)
}
