/**
 * 항목 2 — 내 버전 만들기(#174) → 기본으로 되돌리기(restore #176)·내 버전 지우기(copyDelete #173), 360/390/412. QA3 전용, LLM 0.
 * 준비(API): 시드 주제 fork → 사본 C, 내 상황 A(C 에만)·B(C + 길 묻기 시드 주제). 화면: S6(사본) 안내·버튼 2개 → 시트 본문 ↔ #172 → 확인 → DB 대조.
 */
import {
  api, BASE, check, cleanupQa, cookieOf, data, details, dialogA11y, dialogButtons, dialogOf, launch, mainScrollTop, note, openPage, overflowInfo, prisma, qaRowCounts, qaUser,
  QA2, QA3, SEED_SC, seedHash, sheetBodyOverflow, sleep, SSDIR, summary, T_CAFE, T_ROAD, toastText, WIDTHS, j,
} from './lib.mjs'

const c3 = cookieOf(process.env.QA_COOKIE)
const u3 = await qaUser(QA3)
const u2 = await qaUser(QA2)
await cleanupQa(u3.id)
const h0 = await seedHash()
note('seedHash start ' + j(h0))
const base = data(await api(c3, 'GET', `/api/v1/scenarios/${SEED_SC}`))
const topicTitle = (data(await api(c3, 'GET', '/api/v1/topics?level=all'))?.items ?? []).find((x) => x.id === T_CAFE)?.title

const mkScenario = async (title, topicIds) => {
  const r = await api(c3, 'POST', '/api/v1/scenarios', {
    title, titleJa: base.titleJa, description: 'QA 상황', level: base.level, difficulty: base.difficulty, roles: base.roles,
    goal: { communicativeGoalKo: base.goal.communicativeGoalKo, successCriteria: base.goal.successCriteria },
    steps: base.steps.map((s) => ({ ko: s.ko })), keyExpressions: base.keyExpressions.map((e) => ({ ja: e.ja, reading: e.reading, ko: e.ko })),
    requiredExpressions: base.requiredExpressions, ...(base.opening ? { opening: base.opening } : {}), topicIds,
  })
  if (r.status !== 201) note('mkScenario FAIL ' + r.status + ' ' + j(r.body).slice(0, 250))
  return data(r)?.id
}
const prep = async (suffix) => {
  const fk = await api(c3, 'POST', `/api/v1/topics/${T_CAFE}/fork`, {})
  if (fk.status !== 201) note('fork FAIL ' + fk.status + ' ' + j(fk.body).slice(0, 250))
  const C = data(fk)?.copyId
  const A = await mkScenario(`QA 상황 A${suffix}(사본에만)`, [C])
  const B = await mkScenario(`QA 상황 B${suffix}(사본+길 묻기)`, [C, T_ROAD])
  return { C, A, B }
}
const links = async (id) => (await prisma.scenarioTopic.findMany({ where: { scenarioId: id } })).map((x) => x.topicId).sort()
const overrides = () => prisma.userSeedOverride.findMany({ where: { userId: u3.id } })
const reqsOf = (reqs, m, pre) => reqs.filter((r) => r.m === m && r.p.startsWith(pre))
const toastWait = async (page, pat) => {
  let t = []
  for (let i = 0; i < 24 && !t.some((x) => pat.test(x)); i++) {
    await sleep(150)
    t = await toastText(page)
  }
  return t
}

const browser = await launch()
for (const [w, h] of WIDTHS) {
  const tag = `${w}px`
  const { ctx, page, reqs, errors } = await openPage(browser, w, h, c3)
  page.setDefaultTimeout(30000)
  try {
    // ═════ 1) 되돌리기(restore) ═════
    const { C, A, B } = await prep('r')
    check(`2-준비(restore): 사본·내 상황 2개·연결 [${tag}]`, !!C && !!A && !!B && j(await links(A)) === j([C]) && j(await links(B)) === j([C, T_ROAD].sort()), `C=${!!C} A=${!!A} B=${!!B}`)
    const pv = data(await api(c3, 'GET', `/api/v1/topics/${C}/removal`))
    note(`${tag} restore preview: relinked=${j(pv.restore?.scenariosRelinked?.map((x) => x.title))} active=${j(pv.activeChallenge)} finished=${pv.finishedChallenges}`)
    await page.goto(`${BASE}/settings/scenarios/topics/${C}`, { waitUntil: 'domcontentloaded' })
    const revertBtn = page.getByRole('button', { name: '기본으로 되돌리기' })
    await revertBtn.waitFor({ state: 'visible', timeout: 40000 })
    const copyBtn = page.getByRole('button', { name: /내 버전 지우기/ })
    await copyBtn.waitFor({ state: 'visible', timeout: 10000 })
    const bodyTxt = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
    const hs = await page.evaluate(() => {
      const hb = (re) => [...document.querySelectorAll('main button')].filter((b) => re.test(b.textContent ?? '')).map((b) => Math.round(b.getBoundingClientRect().height * 10) / 10)
      return { revert: hb(/^기본으로 되돌리기$/), copyDel: hb(/내 버전 지우기/) }
    })
    check(`2-S6(사본): 「✎ 내 버전이에요 · …에 만들었어요」 안내 + [기본으로 되돌리기]·[내 버전 지우기] 두 버튼 [${tag}]`,
      /✎ 내 버전이에요 · \d+월 \d+일에 만들었어요/.test(bodyTxt) && (await revertBtn.count()) === 1 && (await copyBtn.count()) === 1 && bodyTxt.includes('내 버전을 지우면 기본 주제도 내 목록에서 숨겨져요'), `copyInfo=${/✎ 내 버전이에요/.test(bodyTxt)} heights=${j(hs)}`)
    check(`2-S6(사본) 두 버튼 높이 ≥44px [${tag}]`, hs.revert.every((x) => x >= 44) && hs.copyDel.every((x) => x >= 44) && hs.revert.length >= 1 && hs.copyDel.length >= 1, j(hs))
    const ovS6 = await overflowInfo(page, 'main')
    check(`2-S6(사본) 가로 넘침 0 [${tag}]`, ovS6.count === 0, j(ovS6))
    await revertBtn.scrollIntoViewIfNeeded()
    await sleep(300)
    const st0 = await mainScrollTop(page)
    await revertBtn.evaluate((e) => e.setAttribute('data-qa-opener', '1'))
    await revertBtn.click()
    await dialogOf(page).waitFor({ state: 'visible', timeout: 20000 })
    await dialogOf(page).getByRole('button', { name: '기본으로 되돌리기' }).waitFor({ state: 'visible', timeout: 20000 })
    const dtxt = (await dialogOf(page).innerText()).replace(/\s+/g, ' ')
    const a11y = await dialogA11y(page)
    const dbtns = await dialogButtons(page)
    const so = await sheetBodyOverflow(page)
    const nRel = pv.restore.scenariosRelinked.length
    const relTitles = pv.restore.scenariosRelinked.map((x) => x.title).join(' · ')
    note(`${tag} 되돌리기 시트: ${dtxt.slice(0, 330)}`)
    check(`2-되돌리기 시트 본문 ↔ #172 restore(내 상황 ${nRel}개 기본 주제에 다시 이어짐·챌린지 없음) [${tag}]`,
      a11y?.title === '기본으로 되돌릴까요?' && dtxt.includes('내가 고친 이름·설명·수준·기본 표현이 기본 내용으로 바뀌어요.') && dtxt.includes('진행 중인 챌린지는 없어요.') && dtxt.includes(`내 상황 ${nRel}개는 기본 주제에 다시 이어져요`) && dtxt.includes(relTitles) && dtxt.includes('기본 주제로 되돌아가요') && !dtxt.includes('함께 지워져요') && dtxt.includes('수업·단어 기록과 단어장') && pv.activeChallenge === null && nRel === 2,
      `title=${a11y?.title} nRel=${nRel} titles=${relTitles}`)
    check(`2-되돌리기 시트 초점=제목·describedby 존재(첫머리 안내 문단) [${tag}]`, a11y?.activeIsTitle === true && a11y?.descExists === true && a11y?.descInDialog === true && (a11y?.descText ?? '').startsWith('내가 고친 이름'), j(a11y))
    check(`2-되돌리기 시트 버튼 ≥44px·가로 넘침 0 [${tag}]`, dbtns.every((b) => b.h >= 44) && so?.over === false, j({ b: dbtns.map((b) => `${b.text}:${b.h}`), so }))
    await page.screenshot({ path: `${SSDIR}/i2-restore-sheet-${w}.png` })
    const stOpen = await mainScrollTop(page)
    await page.keyboard.press('Escape')
    await dialogOf(page).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    const fb = await page.evaluate(() => document.activeElement?.getAttribute('data-qa-opener') === '1')
    check(`2-되돌리기 시트 Esc·초점 복귀·scrollTop 차 0px [${tag}]`, (await dialogOf(page).count()) === 0 && fb && stOpen === st0 && (await mainScrollTop(page)) === st0, `st0=${st0} open=${stOpen} fb=${fb}`)
    // 확인
    await revertBtn.click()
    await dialogOf(page).getByRole('button', { name: '기본으로 되돌리기' }).waitFor({ state: 'visible', timeout: 20000 })
    reqs.length = 0
    await dialogOf(page).getByRole('button', { name: '기본으로 되돌리기' }).click()
    await page.waitForURL(new RegExp(`/settings/scenarios/topics/${T_CAFE}`), { timeout: 30000 })
    const headFocus = await page.waitForFunction((t) => document.activeElement?.tagName === 'H2' && (document.activeElement.textContent ?? '').includes(t), topicTitle, { timeout: 15000 }).then(() => true).catch(() => false)
    const tt = await toastWait(page, /기본으로 되돌렸어요/)
    note(`${tag} 되돌린 뒤 토스트 ${j(tt)} head초점=${headFocus} url=${page.url()}`)
    const rres = reqsOf(reqs, 'POST', '/api/v1/seed-overrides/restore')
    check(`2-되돌리기 확인 → 시드 S6 이동·머리 제목 초점·토스트·#176 요청 1건 200 [${tag}]`,
      new URL(page.url()).pathname === `/settings/scenarios/topics/${T_CAFE}` && headFocus && tt.some((x) => x === `「${pv.title}」 주제를 기본으로 되돌렸어요`) && rres.length === 1 && rres[0].status === 200 && JSON.parse(rres[0].body).kind === 'TOPIC' && JSON.parse(rres[0].body).seedId === T_CAFE,
      `url=${page.url()} head=${headFocus} toast=${j(tt)} req=${j(rres.map((r) => [r.p, r.body, r.status]))}`)
    // DB 대조
    const aRow = await prisma.scenario.findUnique({ where: { id: A } })
    const bRow = await prisma.scenario.findUnique({ where: { id: B } })
    const ovs = await overrides()
    check(`2-DB(restore): 사본·조각 삭제·override 0·내 상황 2개 시드 주제에 붙음·보관 0 [${tag}]`,
      (await prisma.conversationTopic.count({ where: { id: C } })) === 0 && (await prisma.topicChunk.count({ where: { topicId: C } })) === 0 && ovs.length === 0 && aRow?.status === 'ACTIVE' && bRow?.status === 'ACTIVE' && j(await links(A)) === j([T_CAFE]) && j(await links(B)) === j([T_CAFE, T_ROAD].sort()),
      `override=${ovs.length} A=${aRow?.status}:${j(await links(A))} B=${bRow?.status}:${j(await links(B))}`)
    // 새로 고침 후 토스트 재노출 없음
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /나에게서 숨기기/ }).waitFor({ state: 'visible', timeout: 30000 })
    await sleep(900)
    const tAfter = await toastText(page)
    check(`2-새로 고침 뒤 되돌리기 토스트 재노출 없음 [${tag}]`, tAfter.length === 0, j(tAfter))
    await cleanupQa(u3.id)

    // ═════ 2) 내 버전 지우기(copyDelete) ═════
    const p2 = await prep('d')
    const C2 = p2.C, A2 = p2.A, B2 = p2.B
    check(`2-준비(copyDelete): 사본·내 상황 2개·연결 [${tag}]`, !!C2 && !!A2 && !!B2 && j(await links(A2)) === j([C2]) && j(await links(B2)) === j([C2, T_ROAD].sort()), `C=${!!C2}`)
    const pv2 = data(await api(c3, 'GET', `/api/v1/topics/${C2}/removal`))
    await page.goto(`${BASE}/settings/scenarios/topics/${C2}`, { waitUntil: 'domcontentloaded' })
    const cd = page.getByRole('button', { name: /내 버전 지우기/ })
    await cd.waitFor({ state: 'visible', timeout: 40000 })
    await cd.scrollIntoViewIfNeeded()
    await sleep(300)
    const cst0 = await mainScrollTop(page)
    await cd.evaluate((e) => e.setAttribute('data-qa-opener', '1'))
    await cd.click()
    await dialogOf(page).waitFor({ state: 'visible', timeout: 20000 })
    await dialogOf(page).getByRole('button', { name: '내 버전 지우기' }).waitFor({ state: 'visible', timeout: 20000 })
    const ctxt = (await dialogOf(page).innerText()).replace(/\s+/g, ' ')
    const ca11y = await dialogA11y(page)
    const cbtns = await dialogButtons(page)
    const cso = await sheetBodyOverflow(page)
    const goneT = pv2.delete.scenariosArchived.map((x) => x.title).join(' · ')
    const nArch = pv2.delete.scenariosArchived.length
    const nUnl = pv2.delete.scenariosUnlinked.length
    note(`${tag} 내 버전 지우기 시트: ${ctxt.slice(0, 380)}`)
    check(`2-내 버전 지우기 시트 본문 ↔ #172 delete(함께 지워질 상황 ${nArch}개·연결만 빠질 상황 ${nUnl}개) [${tag}]`,
      ca11y?.title === '내 버전을 지울까요?' && ctxt.includes('내가 고친 주제가 지워지고, 기본 주제도 내 목록에서 숨겨져요.') && ctxt.includes('「숨긴 기본 항목」에서 기본 주제를 다시 볼 수 있어요.') && ctxt.includes('진행 중인 챌린지는 없어요. 지우면 되돌릴 수 없어요.') &&
        ctxt.includes(`이 주제에만 있는 내 상황 ${nArch}개`) && ctxt.includes(goneT) && ctxt.includes(`다른 주제에도 있는 상황 ${nUnl}개`) && ctxt.includes('이 주제와의 연결만 빠져요') && nArch === 1 && nUnl === 1 && !ctxt.includes('기본 주제로 되돌아가요'),
      `title=${ca11y?.title} arch=${nArch}(${goneT}) unl=${nUnl}`)
    check(`2-내 버전 지우기 시트 초점=제목·describedby 존재·버튼 ≥44px·넘침 0 [${tag}]`, ca11y?.activeIsTitle === true && ca11y?.descExists === true && ca11y?.descInDialog === true && cbtns.every((b) => b.h >= 44) && cso?.over === false, j({ a: ca11y, b: cbtns.map((b) => `${b.text}:${b.h}`), cso }))
    const cstOpen = await mainScrollTop(page)
    await page.keyboard.press('Escape')
    await dialogOf(page).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    const cfb = await page.evaluate(() => document.activeElement?.getAttribute('data-qa-opener') === '1')
    check(`2-내 버전 지우기 시트 Esc·초점 복귀·scrollTop 차 0px [${tag}]`, (await dialogOf(page).count()) === 0 && cfb && cstOpen === cst0 && (await mainScrollTop(page)) === cst0, `st0=${cst0} open=${cstOpen} fb=${cfb}`)
    await cd.click()
    await dialogOf(page).getByRole('button', { name: '내 버전 지우기' }).waitFor({ state: 'visible', timeout: 20000 })
    reqs.length = 0
    await dialogOf(page).getByRole('button', { name: '내 버전 지우기' }).click()
    await page.waitForURL(/\/settings\/scenarios(\?|$)/, { timeout: 30000 })
    const t2 = await toastWait(page, /내 버전을 지웠어요/)
    note(`${tag} copyDelete 토스트 ${j(t2)}`)
    const dres = reqsOf(reqs, 'DELETE', '/api/v1/topics/')
    check(`2-내 버전 지우기 확인 → 관리 화면·토스트 「내 버전을 지웠어요 · 기본 주제는 숨긴 기본 항목에 있어요」·삭제 요청 1건 200 [${tag}]`,
      new URL(page.url()).pathname === '/settings/scenarios' && t2.some((x) => x === `「${pv2.title}」 내 버전을 지웠어요 · 기본 주제는 숨긴 기본 항목에 있어요`) && dres.length === 1 && dres[0].p === `/api/v1/topics/${C2}?ack=none` && dres[0].status === 200,
      `url=${page.url()} toast=${j(t2)} del=${j(dres.map((r) => [r.p, r.status]))}`)
    // DB 대조
    const ov2 = await overrides()
    const a2 = await prisma.scenario.findUnique({ where: { id: A2 } })
    const b2 = await prisma.scenario.findUnique({ where: { id: B2 } })
    check(`2-DB(copyDelete): 사본·조각 삭제·override copyId=null(HIDDEN 유지) [${tag}]`,
      (await prisma.conversationTopic.count({ where: { id: C2 } })) === 0 && (await prisma.topicChunk.count({ where: { topicId: C2 } })) === 0 && ov2.length === 1 && ov2[0].kind === 'TOPIC' && ov2[0].seedId === T_CAFE && ov2[0].copyId === null,
      `override=${j(ov2.map((o) => [o.kind, o.seedId === T_CAFE, o.copyId]))}`)
    check(`2-DB(copyDelete): 사본에만 붙은 상황 ARCHIVED·다른 주제도 있던 상황 ACTIVE+연결만 끊김(길 묻기만 남음) — 시트 문구 개수와 일치 [${tag}]`,
      a2?.status === 'ARCHIVED' && b2?.status === 'ACTIVE' && j(await links(B2)) === j([T_ROAD]) && (await links(A2)).length === 0 && nArch === 1 && nUnl === 1,
      `A=${a2?.status}:${j(await links(A2))} B=${b2?.status}:${j(await links(B2))}`)
    // 시드는 숨김 유지(숨긴 항목에 있음)
    const hid = page.getByRole('button', { name: /숨긴 기본 항목 1개/ })
    await hid.waitFor({ state: 'visible', timeout: 20000 })
    const apiT = (data(await api(c3, 'GET', '/api/v1/topics?level=all'))?.items ?? []).map((x) => x.id)
    await hid.click()
    await dialogOf(page).waitFor({ state: 'visible', timeout: 10000 })
    const inHidden = (await dialogOf(page).innerText()).includes(topicTitle)
    await page.keyboard.press('Escape')
    check(`2-시드는 숨김 유지: 주제 목록에 없고 「숨긴 기본 항목」에 있음 [${tag}]`, !apiT.includes(T_CAFE) && inHidden, `apiHas=${apiT.includes(T_CAFE)} inHiddenSheet=${inHidden}`)
    check(`2-* 페이지 오류 0 [${tag}]`, errors.length === 0, j(errors))
  } catch (e) {
    check(`2-* 시나리오 예외 없이 완주 [${tag}]`, false, String(e).split('\n')[0].slice(0, 300))
    try { await page.screenshot({ path: `${SSDIR}/i2-error-${w}.png` }) } catch {}
    note(`${tag} url=${page.url()}`)
  } finally {
    await ctx.close()
    await cleanupQa(u3.id)
  }
}
await browser.close()
const h1 = await seedHash()
check('2-* 시드 해시 시작=끝 불변', j(h0) === j(h1), `${h0.sha} → ${h1.sha}`)
note('cleanup QA3 ' + j(await cleanupQa(u3.id)) + ' counts ' + j(await qaRowCounts(u3.id)) + ' qa2 ' + j(await qaRowCounts(u2.id)))
summary('item2')
await prisma.$disconnect()
