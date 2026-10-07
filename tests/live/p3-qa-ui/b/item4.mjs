/**
 * 항목 4 — 내 주제 삭제 시트 문구·접근성·스크롤, 360/390/412. QA3 전용, LLM 0.
 * X1: 상황 연결 없음. X2: 이 주제에만 있는 상황 + 다른 주제에도 있는 상황 + 긴 제목. X3: 실패(abort·500)·진행 중(지연) 상태.
 */
import {
  api, BASE, check, cleanupQa, cookieOf, data, dialogA11y, dialogButtons, dialogOf, launch, linksOf, mainScrollTop, mkScenario, mkTopic, note, openPage, overflowInfo, prisma, qaRowCounts, qaUser,
  QA2, QA3, seedHash, sheetBodyOverflow, sleep, SSDIR, summary, T_ROAD, toastWait, WIDTHS, j,
} from './lib.mjs'

const c3 = cookieOf(process.env.QA_COOKIE)
const u3 = await qaUser(QA3)
const u2 = await qaUser(QA2)
await cleanupQa(u3.id)
const h0 = await seedHash()
note('seedHash start ' + j(h0))
const delReqs = (reqs) => reqs.filter((r) => r.m === 'DELETE' && r.p.startsWith('/api/v1/topics/'))
const execBtn = (page, name) => dialogOf(page).getByRole('button', { name })
const openSheet = async (page, topicId) => {
  await page.goto(`${BASE}/settings/scenarios/topics/${topicId}`, { waitUntil: 'domcontentloaded' })
  const b = page.getByRole('button', { name: '주제 지우기', exact: true })
  await b.waitFor({ state: 'visible', timeout: 40000 })
  await b.scrollIntoViewIfNeeded()
  await sleep(300)
  const st0 = await mainScrollTop(page)
  await b.evaluate((e) => e.setAttribute('data-qa-opener', '1'))
  await b.click()
  await dialogOf(page).waitFor({ state: 'visible', timeout: 20000 })
  await execBtn(page, '주제 지우기').waitFor({ state: 'visible', timeout: 20000 })
  return { b, st0 }
}
const LONG = '긴제목시험'.repeat(8) // 40자·공백 없음(상한 40 — 줄바꿈 없이 가장 넓게)

const browser = await launch()
for (const [w, h] of WIDTHS) {
  const tag = `${w}px`
  const { ctx, page, reqs, errors } = await openPage(browser, w, h, c3)
  page.setDefaultTimeout(30000)
  try {
    // ═════ X1: 상황 연결 없음 ═════
    const X1T = `QA 연결없음 ${w}`
    const X1 = await mkTopic(c3, X1T)
    const pv1 = (await api(c3, 'GET', `/api/v1/topics/${X1}/removal`)).body?.data
    const { b: b1, st0: s1 } = await openSheet(page, X1)
    const t1 = (await dialogOf(page).innerText()).replace(/\s+/g, ' ')
    const a1 = await dialogA11y(page)
    const bt1 = await dialogButtons(page)
    const so1 = await sheetBodyOverflow(page)
    const ov1 = await overflowInfo(page, '[role=dialog]')
    const sOpen1 = await mainScrollTop(page)
    check(`4-X1 시트 문구 ↔ #172 delete(상황 0·연결 0·챌린지 없음): 「함께 지워져요」 없음·「다른 주제에도」 없음·진행 중 챌린지 없음 문구·「그대로 남아요 수업·단어 기록과 단어장」 [${tag}]`,
      pv1.delete.scenariosArchived.length === 0 && pv1.delete.scenariosUnlinked.length === 0 && pv1.activeChallenge === null && a1?.title === '주제를 지울까요?' && t1.includes('진행 중인 챌린지는 없어요. 지우면 되돌릴 수 없어요.') && !t1.includes('함께 지워져요') && !t1.includes('다른 주제에도 있는 상황') && t1.includes('그대로 남아요') && t1.includes('수업·단어 기록과 단어장') && !t1.includes('완료한 챌린지 기록'),
      t1.slice(0, 220))
    check(`4-X1 열 때 초점=시트 제목·aria-describedby 가 존재하는 안내 문단(「진행 중인 챌린지는 없어요…」)을 가리킴 [${tag}]`, a1?.activeIsTitle === true && a1?.descExists === true && a1?.descInDialog === true && (a1?.descText ?? '').startsWith('진행 중인 챌린지는 없어요'), j(a1))
    check(`4-X1 위험 버튼 ≥44px(실행·취소·닫기)·시트 본문·시트 안 가로 넘침 0 [${tag}]`, bt1.every((b) => b.h >= 44) && so1?.over === false && ov1.count === 0, j({ b: bt1.map((b) => `${b.text || b.aria || '✕'}:${b.h}`), so1, ov: ov1.count }))
    await page.screenshot({ path: `${SSDIR}/i4-x1-sheet-${w}.png` })
    // 취소 → 연 버튼 초점·scrollTop
    await execBtn(page, '취소').click()
    await dialogOf(page).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    const fb1 = await page.evaluate(() => document.activeElement?.getAttribute('data-qa-opener') === '1')
    const sAfter1 = await mainScrollTop(page)
    check(`4-X1 [취소] → 시트 닫힘·연 버튼 초점 복귀·main.scrollTop 열기→취소 차 0px(${s1}→${sOpen1}→${sAfter1}) [${tag}]`, (await dialogOf(page).count()) === 0 && fb1 && sOpen1 === s1 && sAfter1 === s1 && delReqs(reqs).length === 0, `fb=${fb1} delReqs=${delReqs(reqs).length}`)
    // Esc 도 확인
    await b1.click()
    await dialogOf(page).waitFor({ state: 'visible', timeout: 20000 })
    await execBtn(page, '주제 지우기').waitFor({ state: 'visible', timeout: 20000 })
    await page.keyboard.press('Escape')
    await dialogOf(page).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    const fb1b = await page.evaluate(() => document.activeElement?.getAttribute('data-qa-opener') === '1')
    check(`4-X1 Esc → 시트 닫힘·연 버튼 초점 복귀·scrollTop 차 0px [${tag}]`, (await dialogOf(page).count()) === 0 && fb1b && (await mainScrollTop(page)) === s1, `fb=${fb1b}`)

    // ═════ X2: 이 주제에만 있는 상황 + 다른 주제에도 있는 상황 + 긴 제목 ═════
    const X2T = `QA 상황연결 시험 ${w}`
    const X2 = await mkTopic(c3, X2T)
    const SA = await mkScenario(c3, LONG, [X2])
    const SB = await mkScenario(c3, 'QA 상황 둘(길 묻기도)', [X2, T_ROAD])
    const pv2 = (await api(c3, 'GET', `/api/v1/topics/${X2}/removal`)).body?.data
    await openSheet(page, X2)
    const t2 = (await dialogOf(page).innerText()).replace(/\s+/g, ' ')
    const so2 = await sheetBodyOverflow(page)
    const ov2 = await overflowInfo(page, '[role=dialog]')
    const a2 = await dialogA11y(page)
    const nA = pv2.delete.scenariosArchived.length
    const nU = pv2.delete.scenariosUnlinked.length
    check(`4-X2 「함께 지워져요」/「그대로 남아요」 목록이 #172 delete 와 일치(이 주제에만 ${nA}개+제목, 다른 주제에도 ${nU}개) [${tag}]`,
      nA === 1 && nU === 1 && pv2.delete.scenariosArchived[0].title === LONG && t2.includes('함께 지워져요') && t2.includes(`이 주제에만 있는 내 상황 ${nA}개`) && t2.includes(LONG) && t2.includes(`다른 주제에도 있는 상황 ${nU}개`) && t2.includes('이 주제와의 연결만 빠져요') && t2.indexOf('함께 지워져요') < t2.indexOf('그대로 남아요') && !t2.includes('QA 상황 둘(길 묻기도)'),
      t2.slice(0, 300))
    check(`4-X2 긴 상황 제목에서 시트 본문 가로 넘침 0 [${tag}]`, so2?.over === false && ov2.count === 0, j({ so2, ov: ov2.count, items: ov2.items }))
    check(`4-X2 describedby 존재 [${tag}]`, a2?.descExists === true && a2?.descInDialog === true, j(a2))
    // ── 진행 중(지연) 상태: 두 버튼 aria-disabled·aria-busy·닫기 막힘
    await page.route(/\/api\/v1\/topics\/[^/?]+\?ack=/, async (route) => {
      if (route.request().method() === 'DELETE') await sleep(2500)
      await route.continue()
    })
    reqs.length = 0
    await execBtn(page, '주제 지우기').click()
    await sleep(700)
    const busyBtns = await dialogButtons(page)
    const busyWrap = await page.evaluate(() => document.querySelector('[role=dialog] [aria-busy=true]') !== null)
    const x = busyBtns.find((b) => b.text === '지우는 중…')
    const cancelB = busyBtns.find((b) => b.text === '취소')
    const closeB = busyBtns.find((b) => (b.aria ?? '') === '닫기')
    await page.keyboard.press('Escape')
    await sleep(200)
    const stillEsc = (await dialogOf(page).count()) === 1
    await page.mouse.click(Math.floor(w / 2), 24) // 배경
    await sleep(200)
    const stillBackdrop = (await dialogOf(page).count()) === 1
    await dialogOf(page).getByRole('button', { name: '닫기' }).click({ force: true }).catch(() => {})
    await sleep(200)
    const stillX = (await dialogOf(page).count()) === 1
    await cancelB && (await execBtn(page, '취소').click({ force: true }).catch(() => {}))
    await sleep(200)
    const stillCancel = (await dialogOf(page).count()) === 1
    check(`4-X2 확인 중: 실행 글자 「지우는 중…」·두 버튼 aria-busy=true·aria-disabled=true·닫기 ✕ aria-disabled·시트 aria-busy [${tag}]`,
      !!x && x.busy === 'true' && x.disabled === 'true' && !!cancelB && cancelB.busy === 'true' && cancelB.disabled === 'true' && !!closeB && closeB.disabled === 'true' && busyWrap, j(busyBtns))
    check(`4-X2 확인 중 Esc·배경 탭·✕·[취소] 모두 시트를 못 닫음(dismissible=false) [${tag}]`, stillEsc && stillBackdrop && stillX && stillCancel, j({ stillEsc, stillBackdrop, stillX, stillCancel }))
    await page.waitForURL(/\/settings\/scenarios(\?|$)/, { timeout: 30000 })
    await page.unroute(/\/api\/v1\/topics\/[^/?]+\?ack=/)
    const dd = delReqs(reqs)
    const sa = await prisma.scenario.findUnique({ where: { id: SA } })
    const sb = await prisma.scenario.findUnique({ where: { id: SB } })
    check(`4-X2 지연 뒤 완료: 삭제 요청 1건 200·주제 삭제·이 주제에만 있던 상황 ARCHIVED·다른 상황 연결만 끊김(DB) [${tag}]`, dd.length === 1 && dd[0].status === 200 && (await prisma.conversationTopic.count({ where: { id: X2 } })) === 0 && sa?.status === 'ARCHIVED' && sb?.status === 'ACTIVE' && j(await linksOf(SB)) === j([T_ROAD]), j({ dd: dd.map((r) => [r.p, r.status]), sa: sa?.status, sb: sb?.status }))

    // ═════ X3: 실패 — abort(네트워크)·500 ═════
    const X3T = `QA 실패 시험 ${w}`
    const X3 = await mkTopic(c3, X3T)
    await openSheet(page, X3)
    const failRe = /\/api\/v1\/topics\/[^/?]+\?ack=/
    await page.route(failRe, (route) => (route.request().method() === 'DELETE' ? route.abort('failed') : route.continue()))
    await execBtn(page, '주제 지우기').click()
    const alertLoc = page.locator('[role=dialog] [role=alert]').first()
    await alertLoc.waitFor({ state: 'visible', timeout: 15000 })
    const abortText = (await alertLoc.innerText()).trim()
    note(`${tag} abort(요청이 서버에 닿지 않음) 알림: 「${abortText}」`)
    const abortFocus = await page.evaluate(() => document.activeElement?.getAttribute('role') === 'alert')
    const db1 = await prisma.conversationTopic.count({ where: { id: X3 } })
    const btnsAfterAbort = await dialogButtons(page)
    check(`4-X3 abort 실패: 시트 유지·알림(role=alert)·두 버튼 다시 활성·DB 변화 0 [${tag}]`, abortText.length > 0 && db1 === 1 && (await dialogOf(page).count()) === 1 && btnsAfterAbort.filter((b) => b.text === '주제 지우기' || b.text === '취소').every((b) => b.busy === null && b.disabled === null), j({ abortText, db1, btns: btnsAfterAbort.map((b) => [b.text, b.busy, b.disabled]) }))
    note(`${tag} abort 알림 초점=${abortFocus}`)
    await page.unroute(failRe)
    await page.route(failRe, (route) => (route.request().method() === 'DELETE' ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ data: { code: 'INTERNAL', message: '서버 내부 오류 SECRET-MSG-XYZ' } }) }) : route.continue()))
    await execBtn(page, '주제 지우기').click()
    await page.waitForFunction(() => /아무것도 지워지지 않았어요/.test(document.querySelector('[role=dialog] [role=alert]')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => {})
    const failText = (await alertLoc.innerText().catch(() => '')).trim()
    const dlgAll = (await dialogOf(page).innerText()).replace(/\s+/g, ' ')
    const db2 = await prisma.conversationTopic.count({ where: { id: X3 } })
    check(`4-X3 서버 500: 「지우지 못했어요. 아무것도 지워지지 않았어요. 다시 눌러 주세요.」·서버 메시지 비노출·DB 변화 0·초점=알림 [${tag}]`, failText === '지우지 못했어요. 아무것도 지워지지 않았어요. 다시 눌러 주세요.' && !dlgAll.includes('SECRET-MSG') && db2 === 1 && (await page.evaluate(() => document.activeElement?.getAttribute('role') === 'alert')), j({ failText, db2 }))
    await page.unroute(failRe)
    reqs.length = 0
    await execBtn(page, '주제 지우기').click()
    await page.waitForURL(/\/settings\/scenarios(\?|$)/, { timeout: 30000 })
    check(`4-X3 실패 뒤 같은 시트에서 다시 누르면 삭제(요청 1건 200)·DB 삭제 [${tag}]`, delReqs(reqs).length === 1 && delReqs(reqs)[0].status === 200 && (await prisma.conversationTopic.count({ where: { id: X3 } })) === 0, j(delReqs(reqs).map((r) => [r.p, r.status])))
    check(`4-* 페이지 오류 0 [${tag}]`, errors.length === 0, j(errors))
  } catch (e) {
    check(`4-* 시나리오 예외 없이 완주 [${tag}]`, false, String(e).split('\n')[0].slice(0, 400))
    try { await page.screenshot({ path: `${SSDIR}/i4-error-${w}.png` }) } catch {}
    note(`${tag} url=${page.url()}`)
  } finally {
    await ctx.close()
    await cleanupQa(u3.id)
  }
}
await browser.close()
const h1 = await seedHash()
check('4-* 시드 해시 시작=끝 불변', j(h0) === j(h1), `${h0.sha} → ${h1.sha}`)
note('cleanup QA3 ' + j(await cleanupQa(u3.id)) + ' counts ' + j(await qaRowCounts(u3.id)) + ' qa2 ' + j(await qaRowCounts(u2.id)))
summary('item4')
await prisma.$disconnect()
