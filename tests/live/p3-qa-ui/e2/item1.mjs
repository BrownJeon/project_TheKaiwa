/**
 * qa-045-ui-e2 항목 1 — 237d721(편집기 안쪽 스크롤 상자 relative) 재확인.
 *  (a) 저장 막힘 뒤 main.scrollTop 0·BackBar top 0·main.scrollHeight==clientHeight·초점 #dr-opening·이유 문구 가시(새 상황 / S11 기본 상황 고치기 / 변형 검토)
 *  (b) R6: 안쪽 스크롤 중간 위치에서 [일본어로 만들기]·[다시 만들기](모의 #178 2초) 전후 scrollTop 차 0px·초점 유지, 맨 아래에서의 감소폭 = scrollHeight 변화 대조.
 * #166·#177·#178 은 page.route 목(LLM 0). 저장 요청은 모두 막혀야 하므로 서버에 행이 생기면 안 된다(끝에 QA2 행 0 단언).
 * 실행: cd $Q && QA_SNAPSHOT=$Q QA_BASE=http://127.0.0.1:3056 QA_COOKIE2=<쿠키> QA_SCRATCH=<scratch> node --env-file=.env <이 파일>
 */
import { BASE, WIDTHS, QA2, cookieOf, qaUser, seedHash, qaRowCounts, cleanupQa, prisma, launch, openPage, check, note, summary, sleep, j } from '../e/lib.mjs'
import { env, tap, draftFromSeed, mockPost, pageText } from '../e/ui.mjs'

const ck = cookieOf(process.env.QA_COOKIE2)
const u = await qaUser(QA2)
const SEED_SHA = 'e826f3ef09237a9c'
const SEED = 'scn_cafe-order-drink'
const KO = '어서 오세요, 무엇을 드릴까요?'
const JA = 'いらっしゃいませ。ご注文をどうぞ。'
const RD = 'いらっしゃいませ。ごちゅうもんをどうぞ。'
const WSEL = (process.env.QA_WIDTHS ?? '').split(',').filter(Boolean).map(Number)

check('시작 시드 해시', (await seedHash()).sha === SEED_SHA)
const r0 = await qaRowCounts(u.id)
check('시작 QA2 행 0', Object.values(r0).every((v) => v === 0), j(r0))
const browser = await launch()

const FS = 'fieldset:has(#dr-openingKo)'
const fsText = (page) => page.locator(FS).innerText()
const active = (page) => page.evaluate(() => document.activeElement?.id ?? document.activeElement?.tagName)
const waitFs = async (page, pat, ms = 6000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if (pat.test(await fsText(page))) return true
    await sleep(100)
  }
  return false
}

/** main·안쪽 스크롤 상자·BackBar·초점·이유 문구 한 번에. */
const snap = (page) =>
  page.evaluate(() => {
    const op = document.getElementById('dr-opening')
    const inner = op?.closest('.overflow-y-auto')
    const main = document.querySelector('main')
    const bar = inner?.parentElement?.firstElementChild
    const err = document.getElementById('dr-opening-err')
    const er = err?.getBoundingClientRect()
    const br = op?.getBoundingClientRect()
    return {
      mainTop: main?.scrollTop ?? -1,
      mainSH: main?.scrollHeight ?? -1,
      mainCH: main?.clientHeight ?? -1,
      barTop: bar ? Math.round(bar.getBoundingClientRect().top) : null,
      innerTop: inner ? Math.round(inner.scrollTop * 10) / 10 : null,
      innerSH: inner?.scrollHeight ?? null,
      innerCH: inner?.clientHeight ?? null,
      innerPos: inner ? getComputedStyle(inner).position : null,
      btnY: br ? Math.round(br.top) : null,
      focus: document.activeElement?.id ?? document.activeElement?.tagName,
      errText: (err?.textContent ?? '').trim().slice(0, 70),
      errTop: er ? Math.round(er.top) : null,
      errVisible: er ? er.height > 0 && er.top >= 0 && er.bottom <= window.innerHeight : false,
      innerH: window.innerHeight,
    }
  })
const fmt = (s) => `mainTop=${s.mainTop} mainSH/CH=${s.mainSH}/${s.mainCH} barTop=${s.barTop} inner(top=${s.innerTop} SH=${s.innerSH} CH=${s.innerCH} pos=${s.innerPos}) focus=${s.focus} errTop=${s.errTop}`

/** 저장 막힘 뒤 측정 + 단언. extraReq: 서버에 새 요청이 없어야 하는지 판정용 카운터. */
async function blockCheck(page, T, label, saveLocator, wantReason, countWrites) {
  const w0 = countWrites()
  await tap(page, saveLocator)
  await sleep(700)
  const s = await snap(page)
  note(`${T} ${label} 저장 막힘 뒤: ${fmt(s)}`)
  check(`${T} ${label}: 저장 막힘 뒤 main.scrollTop 0`, s.mainTop === 0, fmt(s))
  check(`${T} ${label}: main.scrollHeight == clientHeight(바깥 main 이 스크롤 안 됨)`, s.mainSH === s.mainCH, `SH=${s.mainSH} CH=${s.mainCH}`)
  check(`${T} ${label}: BackBar top 0(화면 안)`, s.barTop === 0, `barTop=${s.barTop}`)
  check(`${T} ${label}: 안쪽 스크롤 상자 position=relative`, s.innerPos === 'relative', `pos=${s.innerPos}`)
  check(`${T} ${label}: 초점 #dr-opening`, s.focus === 'dr-opening', s.focus)
  check(`${T} ${label}: 이유 문구가 화면 안에 보임(「${wantReason.slice(0, 14)}…」)`, s.errText.includes(wantReason) && s.errVisible, `errText=${s.errText} errTop=${s.errTop} vh=${s.innerH}`)
  check(`${T} ${label}: 저장 막힘 → 쓰기 요청 0`, countWrites() === w0, `+${countWrites() - w0}`)
  return s
}

/**
 * R6 — 안쪽 스크롤 위치에서 [일본어로 만들기]/[일본어 다시 만들기] → 결과 도착(matched) 전후 비교.
 * pos: {off:n} = 바닥에서 n px 위(버튼이 보이면 실제 터치 탭) · 'mid' = scrollTop=(max/2) 진짜 중간(버튼이 화면 밖일 수 있어 버튼에 초점을 둔 뒤 click() — 키보드 활성과 같은 경로) · 'bottom' = 맨 아래.
 */
async function r6(page, T, tag, pos) {
  const label = typeof pos === 'object' ? `off${pos.off}` : pos
  const pre = await page.evaluate((pos) => {
    const op = document.getElementById('dr-opening')
    const inner = op.closest('.overflow-y-auto')
    const max = inner.scrollHeight - inner.clientHeight
    const target = pos === 'mid' ? Math.floor(max / 2) : pos === 'bottom' ? max : Math.max(0, max - pos.off)
    inner.scrollTop = target
    return { max, target, actual: Math.round(inner.scrollTop) }
  }, pos)
  await sleep(200)
  const s0 = await snap(page)
  const half = await page.evaluate(() => { const r = document.getElementById('dr-opening').getBoundingClientRect(); return r.height / 2 })
  const vis = s0.btnY !== null && s0.btnY >= 56 && s0.btnY + half < s0.innerH - 4
  note(`${T} R6 ${tag}[${label}] 준비: max=${pre.max} 목표=${pre.target} 실제=${pre.actual} 버튼 viewport y=${s0.btnY} 보임=${vis}`)
  if (pos !== 'bottom' && pos !== 'mid') check(`${T} R6 ${tag}[${label}]: 맨 아래가 아님(top<max−4)·버튼이 화면 안(탭 가능)`, s0.innerTop < pre.max - 4 && vis, fmt(s0))
  if (pos === 'mid') check(`${T} R6 ${tag}[mid]: 진짜 중간(top≈max/2, 맨 아래 아님)`, Math.abs(s0.innerTop - pre.target) <= 1 && s0.innerTop < pre.max - 4, `top=${s0.innerTop} target=${pre.target} max=${pre.max}`)
  if (pos === 'bottom' && !vis) {
    check(`${T} R6 ${tag}[bottom] 버튼이 화면 안(탭 가능)`, false, fmt(s0))
    return null
  }
  if (pos === 'mid' || !vis) {
    await page.evaluate(() => { const b = document.getElementById('dr-opening'); b.focus({ preventScroll: true }); b.click() })
  } else {
    await tap(page, '#dr-opening', { scroll: false })
  }
  const ok = await waitFs(page, /선생님이 이렇게 말해요/, 9000)
  await sleep(250)
  const s1 = await snap(page)
  const d = Math.round((s1.innerTop - s0.innerTop) * 10) / 10
  const clamp = Math.min(s0.innerTop, s1.innerSH - s1.innerCH)
  note(`${T} R6 ${tag}[${label}] 전후: top ${s0.innerTop}→${s1.innerTop}(Δ${d}) SH ${s0.innerSH}→${s1.innerSH}(Δ${s1.innerSH - s0.innerSH}) CH ${s0.innerCH}→${s1.innerCH} 버튼 y ${s0.btnY}→${s1.btnY} main ${s0.mainTop}→${s1.mainTop} focus ${s1.focus}`)
  if (pos !== 'bottom') {
    check(`${T} R6 ${tag}[${label}]: 결과 도착 + 안쪽 scrollTop 차 0px + 초점 #dr-opening + main 0`, ok && d === 0 && s1.focus === 'dr-opening' && s1.mainTop === 0, `ok=${ok} Δ=${d} focus=${s1.focus} main=${s1.mainTop}`)
  } else {
    // 바닥: 감소는 scrollHeight 가 줄어 브라우저가 한계로 보정한 것이어야 한다(top1 == min(top0, SH1−CH1))
    check(`${T} R6 ${tag}[bottom]: 결과 도착·초점 유지·main 0`, ok && s1.focus === 'dr-opening' && s1.mainTop === 0, `ok=${ok} focus=${s1.focus} main=${s1.mainTop}`)
    check(`${T} R6 ${tag}[bottom]: scrollTop 변화(Δ${d})가 한계 보정과 일치(top1==min(top0, SH1−CH1)=${clamp}, ΔSH=${s1.innerSH - s0.innerSH})`, Math.abs(s1.innerTop - clamp) <= 1, `top0=${s0.innerTop} top1=${s1.innerTop} expect=${clamp} dSH=${s1.innerSH - s0.innerSH}`)
  }
  return { s0, s1, d }
}

async function runWidth(w, h) {
  const T = `[${w}]`
  const { ctx, page, reqs, errors } = await openPage(browser, w, h, ck)
  const M = { delay: 2000 }
  let seq = 0
  await mockPost(page, '**/api/v1/scenarios/openings/draft', () => ({ delay: M.delay, json: env({ ja: JA, reading: RD, warnings: [] }) }))
  const writes = () => reqs.filter((r) => r.m !== 'GET' && /\/api\/v1\/scenarios/.test(r.p) && !/openings\/draft|\/drafts|variants/.test(r.p)).length

  // ── A. 새 상황 ───────────────────────────────────────────────
  {
    const { draft } = await draftFromSeed(ck, SEED, { title: `QA-E2 새 ${w}` })
    delete draft.opening
    await mockPost(page, '**/api/v1/scenarios/drafts', () => ({ delay: 300, json: env({ draft, warnings: [] }) }))
    await page.goto(`${BASE}/study/ai/scenario/new`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#dr-description', { timeout: 30000 })
    await page.locator('#dr-description').fill('편의점에서 계산하기 연습하고 싶어요')
    await tap(page, page.getByRole('button', { name: '초안 만들기', exact: true }))
    await page.waitForSelector('#dr-title', { timeout: 15000 })
    const sA0 = await snap(page)
    note(`${T} A 새 상황 초안 단계: ${fmt(sA0)}`)
    const save = page.getByRole('button', { name: '저장', exact: true })

    await page.locator('#dr-openingKo').fill(KO)
    M.delay = 2000
    await r6(page, T, 'A 첫 만들기(koOnly)', { off: 150 })
    for (const pos of [{ off: 60 }, { off: 150 }, { off: 250 }, 'mid']) {
      await page.locator('#dr-openingKo').fill(KO + ' ' + '!'.repeat(++seq))
      await r6(page, T, 'A 다시 만들기(stale)', pos)
    }

    // 저장 막힘: stale 상태에서 [저장]
    await page.locator('#dr-openingKo').fill(KO + ' 감사합니다. 또 오세요.')
    await blockCheck(page, T, 'A 새 상황(stale)', save, '저장하려면 일본어 첫마디를 다시 만들어 주세요.', writes)
    // 안쪽 스크롤을 위로 올린 뒤 한 번 더(초점이 이미 버튼에 있어도 BackBar 가 안 밀리는지)
    await page.evaluate(() => { const i = document.getElementById('dr-opening').closest('.overflow-y-auto'); i.scrollTop = 0 })
    await sleep(150)
    await blockCheck(page, T, 'A 새 상황(stale·위에서 다시)', save, '저장하려면 일본어 첫마디를 다시 만들어 주세요.', writes)
    // 바닥에서(감소폭 = scrollHeight 변화 대조): 막힘 뒤(오류 줄이 남은 상태)에서 stale 다시 만들기
    M.delay = 1200
    await page.locator('#dr-openingKo').fill(KO + ' ' + '!'.repeat(++seq))
    await r6(page, T, 'A 다시 만들기(막힘 직후)', 'bottom')
    await page.locator('#dr-openingKo').fill(KO + ' ' + '!'.repeat(++seq))
    await r6(page, T, 'A 다시 만들기(오류 줄 없음)', 'bottom')
    check(`${T} A: 새 상황 화면 쓰기 요청 총 0(모든 저장이 막힘)`, writes() === 0, `writes=${writes()}`)
  }

  // ── B. S11 기본 상황 고치기 ──────────────────────────────────
  {
    await page.goto(`${BASE}/study/ai/scenario/${SEED}/edit`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#dr-openingKo', { timeout: 30000 })
    await sleep(400)
    const save = page.getByRole('button', { name: '내 버전으로 저장', exact: true })
    const sB0 = await snap(page)
    note(`${T} B S11 처음: ${fmt(sB0)} 시드 ko="${await page.locator('#dr-openingKo').inputValue()}"`)
    const ko0 = await page.locator('#dr-openingKo').inputValue()
    M.delay = 2000
    for (const pos of [{ off: 150 }, 'mid']) {
      await page.locator('#dr-openingKo').fill(ko0 + ' ' + '!'.repeat(++seq))
      await r6(page, T, 'B S11 다시 만들기', pos)
    }
    await page.locator('#dr-openingKo').fill(ko0 + ' ' + '!'.repeat(++seq))
    await blockCheck(page, T, 'B S11(stale)', save, '저장하려면 일본어 첫마디를 다시 만들어 주세요.', writes)
    await page.locator('#dr-openingKo').fill(ko0 + ' ' + '!'.repeat(++seq))
    await r6(page, T, 'B S11 다시 만들기(막힘 직후)', 'bottom')
    check(`${T} B: S11 화면 쓰기 요청 총 0`, writes() === 0, `writes=${writes()} reqs=${j(reqs.filter((r) => r.m !== 'GET').map((r) => r.m + ' ' + r.p))}`)
  }

  // ── C. 변형 검토 ──────────────────────────────────────────────
  {
    const { draft } = await draftFromSeed(ck, SEED, { title: `QA-E2 변형 ${w}` })
    draft.goal = { ...draft.goal, communicativeGoalKo: draft.goal.communicativeGoalKo + ' (까다로운 점원)' }
    const m177 = await mockPost(page, '**/api/v1/scenarios/*/variants/drafts', () => ({ delay: 400, json: env({ draft, changedFields: ['title', 'goal'], axes: { persona: 'picky', twist: 'none', flow: 'same', level: 'same' } }) }))
    await page.goto(`${BASE}/study/ai/scenario/${SEED}/variant`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('input[name="va-persona"]', { state: 'attached', timeout: 30000 })
    await sleep(300)
    await tap(page, 'label:has(input[name="va-persona"][value="picky"])')
    await tap(page, page.getByRole('button', { name: '변형 초안 만들기', exact: true }))
    const gotReview = await page.waitForSelector('#dr-openingKo', { timeout: 15000 }).then(() => true).catch(() => false)
    check(`${T} C 변형 검토 화면 도착(모의 #177 1건)`, gotReview && m177.calls.length === 1, `calls=${m177.calls.length}`)
    if (gotReview) {
      const ko0 = await page.locator('#dr-openingKo').inputValue()
      const save = page.getByRole('button', { name: '새 상황으로 저장', exact: true })
      M.delay = 2000
      for (const pos of [{ off: 150 }, 'mid']) {
        await page.locator('#dr-openingKo').fill(ko0 + ' ' + '!'.repeat(++seq))
        await r6(page, T, 'C 변형 다시 만들기', pos)
      }
      await page.locator('#dr-openingKo').fill(ko0 + ' ' + '!'.repeat(++seq))
      await blockCheck(page, T, 'C 변형(stale)', save, '저장하려면 일본어 첫마디를 다시 만들어 주세요.', writes)
      await page.locator('#dr-openingKo').fill(ko0 + ' ' + '!'.repeat(++seq))
      await r6(page, T, 'C 변형 다시 만들기(막힘 직후)', 'bottom')
    }
  }

  check(`${T} 페이지 오류 0`, errors.length === 0, errors.join(' | '))
  await ctx.close()
  const cl = await cleanupQa(u.id)
  note(`${T} 정리 ${j(cl)}`)
}

for (const [w, h] of WIDTHS) {
  if (WSEL.length && !WSEL.includes(w)) continue
  await runWidth(w, h)
  await sleep(1200)
}
check('끝 시드 해시 동일', (await seedHash()).sha === SEED_SHA)
const r1 = await qaRowCounts(u.id)
check('끝 QA2 행 0', Object.values(r1).every((v) => v === 0), j(r1))
summary('e2-item1')
await browser.close()
await prisma.$disconnect()
