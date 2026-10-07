/**
 * 항목 1A — S3 입력 화면 레이아웃·검증(LLM 0), 360/390/412. QA4 전용. 요청 #170 이 한 건도 나가지 않음을 함께 본다.
 */
import { tapAt, BASE, NEW_PATH, activeInfo, check, closeBrowser, cookieOf, docScrollMetrics, launch, mainText, note, openPage, overflowInfo, sleep, smallTargets, summary, WIDTHS, SSDIR, j } from './lib.mjs'
import { prisma } from './lib.mjs'

const c4 = cookieOf(process.env.QA_COOKIE)
const browser = await launch()
for (const [w, h] of WIDTHS) {
  const tag = `${w}px`
  const { ctx, page, reqs, errors } = await openPage(browser, w, h, c4)
  page.setDefaultTimeout(60000)
  try {
    await page.goto(BASE + NEW_PATH, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.locator('#tp-ask').waitFor({ state: 'visible', timeout: 120000 })
    await sleep(500)
    const txt = await mainText(page)
    check(`1A-S3 머리·안내 문구 [${tag}]`, txt.includes('어떤 주제로 연습하고 싶어요?') && txt.includes('주제를 한 줄로 적어 주세요') && txt.includes('초안은 저장하기 전까지 어디에도 남지 않아요'), txt.slice(0, 160))
    const chips = await page.locator('main button').evaluateAll((bs) => bs.map((b) => (b.textContent ?? '').trim()))
    const EX = ['은행에서 계좌 만들기', '병원 진료 받기', '미용실 예약하기', '회사에서 회의하기']
    check(`1A-예시 칩 4개 정확히 [${tag}]`, EX.every((e) => chips.includes(e)) && chips.filter((c) => EX.includes(c)).length === 4, j(chips))
    const note0 = txt.match(/내 수준\((N\d)\)으로 골라 뒀어요/)
    const sel = await page.getByRole('radio', { checked: true }).first().innerText().catch(() => null)
    check(`1A-수준 기본값 = 프로필 수준(안내 「내 수준(N?)으로 골라 뒀어요」 + 선택 칩 일치) [${tag}]`, !!note0 && sel?.trim() === note0[1], `note=${note0?.[1]} selected=${sel}`)
    check(`1A-카운터 0/40 [${tag}]`, /0\/40/.test(txt))
    const fs = await page.locator('#tp-ask').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    check(`1A-입력 글자 ≥16px(iOS 확대·일본어 본문 원칙) [${tag}]`, fs >= 16, `fontSize=${fs}`)
    const ov = await overflowInfo(page)
    const ds = await docScrollMetrics(page)
    check(`1A-가로 넘침 0 (right>clientWidth 요소 0·문서 scrollWidth=clientWidth) [${tag}]`, ov.count === 0 && ds.scrollWidth === ds.clientWidth, j({ ov: ov.count, items: ov.items, ds }))
    check(`1A-페이지 레벨 세로 스크롤 0 (docScrollH ≤ innerH) [${tag}]`, ds.docScrollH <= ds.innerH + 1, j(ds))
    const small = await smallTargets(page)
    check(`1A-터치 44px 미만 요소 0 [${tag}]`, small.length === 0, j(small))
    const cta = await page.getByRole('button', { name: '초안 만들기', exact: true }).boundingBox()
    check(`1A-첫 화면(≈780px)에 주 CTA [초안 만들기] 노출 [${tag}]`, !!cta && cta.y + cta.height <= Math.min(h, 780), j(cta))
    // 2자 미만
    await page.locator('#tp-ask').fill('a')
    await sleep(150)
    const btn = page.getByRole('button', { name: '초안 만들기', exact: true })
    const dis = await btn.getAttribute('aria-disabled')
    await tapAt(page, btn)
    await sleep(500)
    const t1 = await mainText(page)
    check(`1A-1자: [초안 만들기] 막힘(aria-disabled)+이유 「주제를 2자 이상 적어 주세요.」+요청 0 [${tag}]`, dis === 'true' && t1.includes('주제를 2자 이상 적어 주세요.') && reqs.filter((r) => r.p.includes('/topics/drafts')).length === 0, `aria-disabled=${dis}`)
    // 공백만
    await page.locator('#tp-ask').fill('   ')
    await sleep(120)
    await tapAt(page, btn)
    await sleep(400)
    check(`1A-공백만: 막힘·요청 0 [${tag}]`, reqs.filter((r) => r.p.includes('/topics/drafts')).length === 0)
    // 41자
    await page.locator('#tp-ask').fill('가'.repeat(41))
    await sleep(150)
    const t2 = await mainText(page)
    await tapAt(page, btn)
    await sleep(500)
    const t3 = await mainText(page)
    check(`1A-41자: 카운터 41/40·막힘·「주제는 40자까지 적을 수 있어요.」·요청 0 [${tag}]`, /41\/40/.test(t2) && t3.includes('주제는 40자까지 적을 수 있어요.') && reqs.filter((r) => r.p.includes('/topics/drafts')).length === 0, t3.slice(0, 200))
    // 칩 → 입력 채움·카운터
    await tapAt(page, page.locator('main button', { hasText: '병원 진료 받기' }))
    await sleep(200)
    const v = await page.locator('#tp-ask').inputValue()
    const t4 = await mainText(page)
    check(`1A-칩 탭 → 입력 채움(「병원 진료 받기」)·카운터 8/40 [${tag}]`, v === '병원 진료 받기' && /8\/40/.test(t4), `value=${v}`)
    // 2자 경계(통과)
    await page.locator('#tp-ask').fill('ab')
    await sleep(150)
    const dis2 = await btn.getAttribute('aria-disabled')
    check(`1A-2자 경계: 막히지 않음(aria-disabled 없음) [${tag}]`, dis2 === null, `aria-disabled=${dis2}`)
    // 40자 경계
    await page.locator('#tp-ask').fill('나'.repeat(40))
    await sleep(150)
    const dis3 = await btn.getAttribute('aria-disabled')
    check(`1A-40자 경계: 막히지 않음 [${tag}]`, dis3 === null && /40\/40/.test(await mainText(page)), `aria-disabled=${dis3}`)
    check(`1A-요청 총 0건(#170) [${tag}]`, reqs.filter((r) => r.p.includes('/topics/drafts')).length === 0)
    check(`1A-페이지 오류 0 [${tag}]`, errors.length === 0, errors.join('|'))
    await page.screenshot({ path: `${SSDIR}/item1a-${w}.png` })
  } catch (e) {
    check(`1A-스크립트 오류 [${tag}]`, false, String(e).slice(0, 300))
  } finally {
    await ctx.close()
  }
}
await closeBrowser(browser)
summary('항목 1A')
await prisma.$disconnect()
