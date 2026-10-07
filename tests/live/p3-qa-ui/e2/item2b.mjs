/**
 * qa-045-ui-e2 항목 2 보조 — 상황 시트 열기/닫기·[지우기] 확인 열기/취소 전후 main.scrollTop 차 0px·초점 복귀·44px 미만 터치 요소 목록(회화 탭·관리 화면, 세 폭).
 * 실제 API(QA2 행만, LLM 0). 실행: cd $Q && QA_SNAPSHOT=$Q QA_BASE=http://127.0.0.1:3056 QA_COOKIE2=<쿠키> node --env-file=.env <이 파일>
 */
import { BASE, WIDTHS, QA2, T_CAFE, api, data, toastWait, cookieOf, qaUser, seedHash, qaRowCounts, cleanupQa, prisma, launch, openPage, check, note, summary, sleep, j, mkScenario } from '../e/lib.mjs'
import { tap, dbl, smallTargets, overflow } from '../e/ui.mjs'

const ck = cookieOf(process.env.QA_COOKIE2)
const u = await qaUser(QA2)
const SEED_SHA = 'e826f3ef09237a9c'
const WSEL = (process.env.QA_WIDTHS ?? '').split(',').filter(Boolean).map(Number)
check('시작 시드 해시', (await seedHash()).sha === SEED_SHA)
const r0 = await qaRowCounts(u.id)
check('시작 QA2 행 0', Object.values(r0).every((v) => v === 0), j(r0))
const browser = await launch()

const mainInfo = (page) => page.evaluate(() => { const m = document.querySelector('main'); return { top: Math.round((m?.scrollTop ?? -1) * 10) / 10, sh: m?.scrollHeight ?? -1, ch: m?.clientHeight ?? -1 } })
const focusInfo = (page) => page.evaluate(() => { const a = document.activeElement; return { tag: a?.tagName, text: (a?.textContent ?? '').trim().slice(0, 40), label: a?.getAttribute?.('aria-label') ?? null, inDialog: !!a?.closest?.('[role=dialog]'), isBody: a === document.body } })
const dlg = (page) => page.locator('[role=dialog]')
const rowOf = (page, title) => page.locator('button, [role=button], a[href]', { hasText: title }).filter({ hasNot: page.locator('[role=dialog]') }).first()

async function runWidth(w, h) {
  const T = `[${w}]`
  const { ctx, page, reqs, errors } = await openPage(browser, w, h, ck)
  const title = `QA-E2 내 상황 ${w}`
  const idMine = await mkScenario(ck, title, [T_CAFE])
  check(`${T} 준비: 내 상황 생성`, !!idMine)
  for (const [base, tag] of [['/study/ai?tab=scenario', '회화 탭'], ['/settings/scenarios?tab=scenarios', '관리 화면']]) {
    await page.goto(`${BASE}${base}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector(`text=${title}`, { timeout: 30000 })
    await sleep(500)
    // 목록 화면 가로 넘침·44px 미만 터치 요소(목록)
    const ovL = await overflow(page)
    check(`${T} ${tag}: 목록 가로 넘침 0`, ovL.count === 0, j(ovL))
    const smL = await smallTargets(page, 'main')
    note(`${T} ${tag}: 목록 44px 미만 터치 요소 ${smL.length}개 ${j(smL.slice(0, 8))}`)

    for (const [rowTitle, origin] of [[title, '내 상황'], ['음료의 온도·크기 정해서 주문하기', '시드']]) {
      const row = rowOf(page, rowTitle)
      if (!(await row.count())) { note(`${T} ${tag}·${origin}: 행을 못 찾음(${rowTitle}) — NOT_VERIFIED`); continue }
      // 위로 약간 스크롤된 상태에서 시작(main 이 스크롤 가능한 만큼)
      await page.evaluate(() => { const m = document.querySelector('main'); if (m) m.scrollTop = Math.min(160, m.scrollHeight - m.clientHeight) })
      await sleep(150)
      await row.scrollIntoViewIfNeeded()
      const m0 = await mainInfo(page)
      await tap(page, row, { scroll: false })
      await page.waitForSelector('[role=dialog] a:has-text("고치기")', { timeout: 15000 })
      await sleep(500)
      const m1 = await mainInfo(page)
      const f1 = await focusInfo(page)
      check(`${T} ${tag}·${origin}: 시트 열기 전후 main.scrollTop 차 0px`, m1.top === m0.top, `before=${m0.top} open=${m1.top} (SH ${m0.sh}/CH ${m0.ch})`)
      check(`${T} ${tag}·${origin}: 시트가 열린 뒤 초점이 시트 안(body 아님)`, f1.inDialog && !f1.isBody, j(f1))
      const smS = await smallTargets(page, '[role=dialog]')
      note(`${T} ${tag}·${origin}: 시트 44px 미만 터치 요소 ${smS.length}개 ${j(smS)}`)
      const ovS = await overflow(page)
      check(`${T} ${tag}·${origin}: 시트 열린 채 가로 넘침 0`, ovS.count === 0, j(ovS))

      // [지우기](또는 기본으로 되돌리기) 확인 열기 → 취소: 스크롤·초점
      const act = dlg(page).getByRole('button', { name: '지우기', exact: true })
      if (await act.count()) {
        await tap(page, act)
        await sleep(350)
        const m2 = await mainInfo(page)
        const f2 = await focusInfo(page)
        check(`${T} ${tag}·${origin}: [지우기] 확인 열림 전후 main.scrollTop 차 0px`, m2.top === m0.top, `before=${m0.top} confirm=${m2.top}`)
        note(`${T} ${tag}·${origin}: 확인 열린 직후 초점 ${j(f2)}`)
        const cancel = dlg(page).locator('[role=group]').getByRole('button', { name: /취소|아니요|그만/ }).first()
        if (await cancel.count()) {
          await tap(page, cancel)
          await sleep(350)
          const m3 = await mainInfo(page)
          const f3 = await focusInfo(page)
          check(`${T} ${tag}·${origin}: 확인 취소 뒤 main.scrollTop 차 0px·시트 유지·확인 닫힘`, m3.top === m0.top && (await dlg(page).count()) === 1 && (await dlg(page).locator('[role=group]:has(h3)').count()) === 0, `top=${m3.top}`)
          check(`${T} ${tag}·${origin}: 확인 취소 뒤 초점 [지우기] 로 복귀(또는 시트 안)`, f3.inDialog && !f3.isBody, j(f3))
          note(`${T} ${tag}·${origin}: 취소 뒤 초점 ${j(f3)}`)
        } else note(`${T} ${tag}·${origin}: 확인의 취소 버튼을 못 찾음 — NOT_VERIFIED`)
      }

      // 닫기(닫기 버튼) → 주소 sc 제거·초점 = 열었던 행·main.scrollTop 불변
      const closeBtn = dlg(page).getByRole('button', { name: /닫기/ }).first()
      let closedBy = 'Escape'
      if (await closeBtn.count()) { await tap(page, closeBtn); closedBy = '닫기 버튼' } else await page.keyboard.press('Escape')
      await sleep(500)
      const m4 = await mainInfo(page)
      const f4 = await focusInfo(page)
      check(`${T} ${tag}·${origin}: 시트 닫힘(${closedBy})·주소 sc 제거`, (await dlg(page).count()) === 0 && !page.url().includes('sc='), page.url())
      check(`${T} ${tag}·${origin}: 닫은 뒤 main.scrollTop 차 0px`, m4.top === m0.top, `before=${m0.top} closed=${m4.top}`)
      check(`${T} ${tag}·${origin}: 닫은 뒤 초점이 열었던 행으로 복귀`, f4.text.includes(rowTitle.slice(0, 10)), j(f4))

      // 다시 열고 Escape 로 닫기
      await tap(page, row, { scroll: false })
      await page.waitForSelector('[role=dialog] a:has-text("고치기")', { timeout: 15000 })
      await sleep(300)
      await page.keyboard.press('Escape')
      await sleep(500)
      const m5 = await mainInfo(page)
      const f5 = await focusInfo(page)
      check(`${T} ${tag}·${origin}: Escape 로 닫기 → 시트 닫힘·scrollTop 차 0px`, (await dlg(page).count()) === 0 && m5.top === m0.top, `top=${m5.top} dialogs=${await dlg(page).count()}`)
      note(`${T} ${tag}·${origin}: Escape 닫은 뒤 초점 ${j(f5)}`)
    }
  }

  // ── 되돌리기 토스트(관리 화면) — 사본 시트의 [기본으로 되돌리기] ─────────────
  {
    const SEED_E = 'scn_cafe-order-takeout'
    const forkE = await api(ck, 'POST', `/api/v1/scenarios/${SEED_E}/fork`, {})
    const copyId = data(forkE)?.id
    check(`${T} 준비: 사본 생성(201)`, forkE.status === 201 && !!copyId, String(forkE.status))
    await page.goto(`${BASE}/settings/scenarios?tab=scenarios&sc=${copyId}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[role=dialog] a:has-text("고치기")', { timeout: 30000 })
    await sleep(300)
    await tap(page, dlg(page).getByRole('button', { name: '기본으로 되돌리기', exact: true }))
    await sleep(350)
    const n0 = reqs.filter((r) => r.p === '/api/v1/seed-overrides/restore').length
    await tap(page, page.locator('[role=dialog] [role=group]:has(h3) button').first())
    const tR = await toastWait(page, /되돌렸어요/)
    const rq = reqs.filter((r) => r.p === '/api/v1/seed-overrides/restore').slice(n0)
    check(`${T} 관리 화면 되돌리기: #176 1회 200·토스트 「기본 상황으로 되돌렸어요」`, rq.length === 1 && rq[0].status === 200 && tR.some((x) => x.includes('기본 상황으로 되돌렸어요')), j({ rq: rq.map((x) => x.status), tR }))
    const cp = await prisma.scenario.findUnique({ where: { id: copyId } })
    check(`${T} 되돌린 뒤 DB 사본 ARCHIVED·override 0`, cp?.status === 'ARCHIVED' && (await prisma.userSeedOverride.count({ where: { userId: u.id, seedId: SEED_E } })) === 0, cp?.status)
  }

  // ── 삭제 확인 더블탭 — 화면 오류 없음(두 번째는 alreadyArchived 200) ─────────
  {
    const id2 = await mkScenario(ck, `QA-E2 더블삭제 ${w}`, [T_CAFE])
    await page.goto(`${BASE}/study/ai?tab=scenario&sc=${id2}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[role=dialog] a:has-text("고치기")', { timeout: 30000 })
    await sleep(300)
    await tap(page, dlg(page).getByRole('button', { name: '지우기', exact: true }))
    await sleep(350)
    const nd = reqs.filter((r) => r.m === 'DELETE').length
    await dbl(page, '[role=dialog] [role=group]:has(h3) button', 80)
    const tD = await toastWait(page, /지웠어요/)
    await sleep(900)
    const dq = reqs.filter((r) => r.m === 'DELETE').slice(nd)
    const bodyTxt = await page.evaluate(() => document.body.innerText)
    const alerts = await page.evaluate(() => [...document.querySelectorAll('[role=alert]')].map((e) => (e.textContent ?? '').trim()).filter(Boolean))
    check(`${T} 삭제 확인 더블탭: 요청 ${dq.length}건 전부 200·토스트 「지웠어요」·오류 문구/alert 없음`, dq.length >= 1 && dq.every((x) => x.status === 200) && tD.some((x) => x.trim() === '지웠어요') && alerts.length === 0 && !/실패|오류|못했어요|다시 시도/.test(bodyTxt), j({ dq: dq.map((x) => x.status), tD, alerts }))
    const row2 = await prisma.scenario.findUnique({ where: { id: id2 } })
    check(`${T} 더블 삭제 뒤 DB ARCHIVED 1행`, row2?.status === 'ARCHIVED', row2?.status)
  }

  check(`${T} 페이지 오류 0`, errors.length === 0, errors.join(' | '))
  await ctx.close()
  note(`${T} 정리 ${j(await cleanupQa(u.id))}`)
}

for (const [w, h] of WIDTHS) {
  if (WSEL.length && !WSEL.includes(w)) continue
  await runWidth(w, h)
  await sleep(1200)
}
check('끝 시드 해시 동일', (await seedHash()).sha === SEED_SHA)
const r1 = await qaRowCounts(u.id)
check('끝 QA2 행 0', Object.values(r1).every((v) => v === 0), j(r1))
summary('e2-item2b')
await browser.close()
await prisma.$disconnect()
