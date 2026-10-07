/**
 * 항목 3 — 진행 중 챌린지와 409 IMPACT_CHANGED(핵심), 360/390/412. QA3 전용, LLM 0.
 * 3A: 챌린지 없음 상태로 시트를 연 채 DB 로 ACTIVE 챌린지 삽입 → 확인 → 409 → 시트 다시 그림·삭제 요청 수(409 1 + 200 1)·자동 재시도 0.
 * 3B: 완료·종료 챌린지가 연결된 주제를 지움 → 행 보존·topicId null·챌린지 화면(삭제됨 표기 없음·「같은 주제로 한 번 더」/[다시 도전] 없음).
 * 3C: 이미 지워진 주제의 시트에서 확인 → 404 안내, 더블탭 요청 1건.
 */
import {
  api, BASE, check, cleanupQa, cookieOf, data, dialogA11y, dialogButtons, dialogOf, insertChallenge, launch, linksOf, mkScenario, mkTopic, note, openPage, overflowInfo, prisma, qaRowCounts, qaUser,
  QA2, QA3, seedHash, sheetBodyOverflow, sleep, SSDIR, summary, T_CAFE, T_ROAD, toastWait, WIDTHS, j,
} from './lib.mjs'

const c3 = cookieOf(process.env.QA_COOKIE)
const u3 = await qaUser(QA3)
const u2 = await qaUser(QA2)
await cleanupQa(u3.id)
const h0 = await seedHash()
note('seedHash start ' + j(h0))
const delReqs = (reqs) => reqs.filter((r) => r.m === 'DELETE' && r.p.startsWith('/api/v1/topics/'))
const execBtn = (page, name) => dialogOf(page).getByRole('button', { name })
const mine = (id) => ({ id, title: null, level: 'N5' })

const browser = await launch()
for (const [w, h] of WIDTHS) {
  const tag = `${w}px`
  const { ctx, page, reqs, errors } = await openPage(browser, w, h, c3)
  page.setDefaultTimeout(30000)
  try {
    // ═════ 3A. 409 IMPACT_CHANGED ═════
    const MT = `QA 409 시험 ${w}`
    const M = await mkTopic(c3, MT)
    const S1 = await mkScenario(c3, 'QA 상황 하나(이 주제에만)', [M])
    const S2 = await mkScenario(c3, 'QA 상황 둘(길 묻기도)', [M, T_ROAD])
    check(`3A-준비: 내 주제·상황 2개(하나는 이 주제에만, 하나는 길 묻기도) [${tag}]`, !!M && !!S1 && !!S2 && j(await linksOf(S1)) === j([M]) && j(await linksOf(S2)) === j([M, T_ROAD].sort()), `M=${!!M}`)
    await page.goto(`${BASE}/settings/scenarios/topics/${M}`, { waitUntil: 'domcontentloaded' })
    const rmBtn = page.getByRole('button', { name: '주제 지우기', exact: true })
    await rmBtn.waitFor({ state: 'visible', timeout: 40000 })
    await rmBtn.scrollIntoViewIfNeeded()
    await rmBtn.click()
    await dialogOf(page).waitFor({ state: 'visible', timeout: 20000 })
    await execBtn(page, '주제 지우기').waitFor({ state: 'visible', timeout: 20000 })
    const t1 = (await dialogOf(page).innerText()).replace(/\s+/g, ' ')
    check(`3A-시트(챌린지 없음 상태): 경고 상자 없음·「진행 중인 챌린지는 없어요」·실행 글자 「주제 지우기」 [${tag}]`, t1.includes('진행 중인 챌린지는 없어요. 지우면 되돌릴 수 없어요.') && !t1.includes('진행 중인 챌린지가 있어요') && !t1.includes('챌린지까지 지우기') && t1.includes('이 주제에만 있는 내 상황 1개') && t1.includes('다른 주제에도 있는 상황 1개'), t1.slice(0, 220))
    const before = { topic: await prisma.conversationTopic.count({ where: { id: M } }), sc: await prisma.scenario.count({ where: { id: { in: [S1, S2] }, status: 'ACTIVE' } }), ch: await prisma.challenge.count({ where: { userId: u3.id } }) }
    // ── 시트를 연 채 다른 곳에서 진행 중 챌린지 시작(DB 직접 삽입)
    const chRow = await insertChallenge(u3.id, { id: M, title: MT, level: 'N5' }, 'ACTIVE', { title: `QA 진행 챌린지 ${w}` })
    reqs.length = 0
    await execBtn(page, '주제 지우기').click()
    await page.locator('[role=dialog] [role=alert]').first().waitFor({ state: 'visible', timeout: 20000 })
    await execBtn(page, '챌린지까지 지우기').waitFor({ state: 'visible', timeout: 10000 })
    await sleep(1800) // 자동 재전송이 있다면 이 사이에 나간다
    const t2 = (await dialogOf(page).innerText()).replace(/\s+/g, ' ')
    const a2 = await dialogA11y(page)
    const focusRole = await page.evaluate(() => ({ role: document.activeElement?.getAttribute('role'), text: (document.activeElement?.textContent ?? '').trim().slice(0, 40) }))
    const b2 = await dialogButtons(page)
    const so2 = await sheetBodyOverflow(page)
    const dels1 = delReqs(reqs)
    note(`${tag} 409 뒤 시트: ${t2.slice(0, 380)}`)
    note(`${tag} 409 뒤 요청: ${j(reqs.filter((r) => r.m !== 'GET' || r.p.includes('removal')).map((r) => [r.m, r.p, r.status]))}`)
    check(`3A-409 → 시트가 새 미리보기로 다시 그려짐: 맨 위 알림·「진행 중인 챌린지가 있어요」 경고·챌린지 줄·버튼 「챌린지까지 지우기」 [${tag}]`,
      t2.includes('확인하는 사이에 바뀐 내용이 있어요. 아래 내용을 다시 확인하고 눌러 주세요.') && t2.includes('진행 중인 챌린지가 있어요') && t2.includes(`「QA 진행 챌린지 ${w}」 챌린지를`) && t2.includes('지우면 이 챌린지도 함께 지워지고, 되돌릴 수 없어요.') && t2.includes('함께 지워져요') && t2.includes('진행 중인 챌린지') && !t2.includes('진행 중인 챌린지는 없어요') && b2.some((b) => b.text === '챌린지까지 지우기') && !b2.some((b) => b.text === '주제 지우기'),
      t2.slice(0, 260))
    check(`3A-409 뒤 초점=맨 위 알림 줄·describedby=경고 상자(존재) [${tag}]`, focusRole.role === 'alert' && focusRole.text.startsWith('확인하는 사이에') && a2?.descExists === true && (a2?.descText ?? '').includes('진행 중인 챌린지가 있어요'), j({ focusRole, desc: a2?.descText }))
    check(`3A-삭제 요청 1건만(409) — 자동 재전송 0 [${tag}]`, dels1.length === 1 && dels1[0].p === `/api/v1/topics/${M}?ack=none` && dels1[0].status === 409, j(dels1.map((r) => [r.p, r.status])))
    const after1 = { topic: await prisma.conversationTopic.count({ where: { id: M } }), sc: await prisma.scenario.count({ where: { id: { in: [S1, S2] }, status: 'ACTIVE' } }), ch: await prisma.challenge.count({ where: { userId: u3.id } }), link2: j(await linksOf(S2)) }
    check(`3A-409 뒤 DB 에 아무것도 지워지지 않음(주제·상황 2·챌린지 행 수 그대로) [${tag}]`, before.topic === 1 && after1.topic === 1 && before.sc === 2 && after1.sc === 2 && before.ch === 0 && after1.ch === 1 && after1.link2 === j([M, T_ROAD].sort()), j({ before, after1 }))
    check(`3A-409 뒤 시트 버튼 ≥44·본문 가로 넘침 0 [${tag}]`, b2.every((b) => b.h >= 44) && so2?.over === false, j({ b: b2.map((b) => `${b.text}:${b.h}`), so2 }))
    const pvNow = (await api(c3, 'GET', `/api/v1/topics/${M}/removal`)).body?.data
    check(`3A-시트 내용 ↔ #172 현재 값(activeChallenge=삽입한 챌린지·ack=챌린지 id) [${tag}]`, pvNow?.activeChallenge?.id === chRow.id && pvNow?.ack === chRow.id && pvNow.delete.scenariosArchived.length === 1 && pvNow.delete.scenariosUnlinked.length === 1, j({ ac: pvNow?.activeChallenge, ack: pvNow?.ack === chRow.id }))
    await page.screenshot({ path: `${SSDIR}/i3-409-sheet-${w}.png` })
    // ── 다시 눌러야 삭제
    reqs.length = 0
    await execBtn(page, '챌린지까지 지우기').click()
    await page.waitForURL(/\/settings\/scenarios(\?|$)/, { timeout: 30000 })
    const tt = await toastWait(page, /주제를 지웠어요/)
    const dels2 = delReqs(reqs)
    note(`${tag} 3A 토스트 ${j(tt)} 요청 ${j(dels2.map((r) => [r.p, r.status]))}`)
    check(`3A-다시 눌러 삭제: 요청 1건 `+'`?ack=<챌린지 id>`'+` 200 → 관리 화면·토스트(상황 1개·진행 중인 챌린지도 지웠어요) [${tag}]`,
      dels2.length === 1 && dels2[0].p === `/api/v1/topics/${M}?ack=${chRow.id}` && dels2[0].status === 200 && tt.some((x) => x === `「${MT}」 주제를 지웠어요 · 상황 1개도 함께 지웠어요 · 진행 중인 챌린지도 지웠어요`),
      `del=${j(dels2.map((r) => [r.p, r.status]))} toast=${j(tt)}`)
    const s1 = await prisma.scenario.findUnique({ where: { id: S1 } })
    const s2 = await prisma.scenario.findUnique({ where: { id: S2 } })
    check(`3A-DB: 주제 삭제·챌린지 행 삭제·이 주제에만 있던 상황 ARCHIVED·다른 상황 ACTIVE+연결만 끊김 [${tag}]`,
      (await prisma.conversationTopic.count({ where: { id: M } })) === 0 && (await prisma.challenge.count({ where: { id: chRow.id } })) === 0 && s1?.status === 'ARCHIVED' && s2?.status === 'ACTIVE' && j(await linksOf(S2)) === j([T_ROAD]),
      `s1=${s1?.status} s2=${s2?.status}:${j(await linksOf(S2))}`)
    await cleanupQa(u3.id)

    // ═════ 3B. 완료·종료 챌린지 기록 ═════
    const NT = `QA 기록 시험 ${w}`
    const N = await mkTopic(c3, NT)
    const cDone = await insertChallenge(u3.id, { id: N, title: NT, level: 'N5' }, 'COMPLETED', { title: `QA 완료 챌린지 ${w}` })
    const cEnded = await insertChallenge(u3.id, { id: N, title: NT, level: 'N5' }, 'ENDED', { title: `QA 그만둔 챌린지 ${w}` })
    const cCtrl = await insertChallenge(u3.id, { id: T_CAFE, title: '카페 주문', level: 'N5' }, 'COMPLETED', { title: `QA 대조 완료 ${w}` })
    const snapBefore = await prisma.challenge.findMany({ where: { id: { in: [cDone.id, cEnded.id] } }, orderBy: { id: 'asc' } })
    await page.goto(`${BASE}/settings/scenarios/topics/${N}`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: '주제 지우기', exact: true }).waitFor({ state: 'visible', timeout: 40000 })
    await page.getByRole('button', { name: '주제 지우기', exact: true }).click()
    await dialogOf(page).waitFor({ state: 'visible', timeout: 20000 })
    await execBtn(page, '주제 지우기').waitFor({ state: 'visible', timeout: 20000 })
    const tb = (await dialogOf(page).innerText()).replace(/\s+/g, ' ')
    const pvB = (await api(c3, 'GET', `/api/v1/topics/${N}/removal`)).body?.data
    check(`3B-시트: 끝난 챌린지 ${pvB?.finishedChallenges}개 → 「완료한 챌린지 기록은 그대로 남아요」·경고 상자 없음 [${tag}]`, pvB?.finishedChallenges === 2 && pvB?.activeChallenge === null && tb.includes('완료한 챌린지 기록은 그대로 남아요') && !tb.includes('진행 중인 챌린지가 있어요'), tb.slice(0, 200))
    reqs.length = 0
    await execBtn(page, '주제 지우기').click()
    await page.waitForURL(/\/settings\/scenarios(\?|$)/, { timeout: 30000 })
    const tB = await toastWait(page, /주제를 지웠어요/)
    check(`3B-삭제 200·토스트 「주제를 지웠어요」(상황·챌린지 덧말 없음) [${tag}]`, delReqs(reqs).length === 1 && delReqs(reqs)[0].status === 200 && tB.some((x) => x === `「${NT}」 주제를 지웠어요`), j({ d: delReqs(reqs).map((r) => [r.p, r.status]), tB }))
    const snapAfter = await prisma.challenge.findMany({ where: { id: { in: [cDone.id, cEnded.id] } }, orderBy: { id: 'asc' } })
    const same = snapBefore.length === 2 && snapAfter.length === 2 && snapAfter.every((a, i) => a.topicId === null && a.status === snapBefore[i].status && a.title === snapBefore[i].title && a.topicTitleSnap === snapBefore[i].topicTitleSnap && j(a.result) === j(snapBefore[i].result))
    check(`3B-DB: 완료·종료 챌린지 행이 남고 topicId=null(상태·결과·제목·주제 이름 스냅샷 불변) [${tag}]`, same, j(snapAfter.map((a) => [a.status, a.topicId, a.topicTitleSnap])))
    for (const [label, row] of [['완료', cDone], ['종료', cEnded]]) {
      await page.goto(`${BASE}/plan/challenge/${row.id}`, { waitUntil: 'domcontentloaded' })
      await page.locator('main').getByText(row.title).first().waitFor({ state: 'visible', timeout: 40000 })
      await sleep(600)
      const txt = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
      const links = await page.evaluate(() => [...document.querySelectorAll('main a')].map((a) => ({ href: a.getAttribute('href'), text: (a.textContent ?? '').trim() })))
      const ov = await overflowInfo(page, 'main')
      note(`${tag} ${label} 챌린지 화면: ${txt.slice(0, 260)} links=${j(links.map((l) => l.text + '→' + l.href))}`)
      check(`3B-${label} 챌린지 화면: 저장된 주제 이름 그대로·「삭제됨」 없음·「같은 주제로 한 번 더」 없음·[다시 도전] 링크 없음 [${tag}]`,
        (label === '완료' ? txt.includes(NT) : txt.includes(row.title)) && txt.includes(row.title) && !txt.includes('삭제됨') && !txt.includes('같은 주제로 한 번 더') && !links.some((l) => (l.href ?? '').includes('again=') || l.text.includes('다시 도전')) && !txt.includes('다시 도전'),
        `hasTopicName=${txt.includes(NT)} hasTitle=${txt.includes(row.title)} again=${links.some((l) => (l.href ?? '').includes('again='))}`)
      if (label === '완료') {
        check(`3B-완료 챌린지 화면: 「다음 주제로 넘어가 보세요.」+[다른 주제로] 링크 [${tag}]`, txt.includes('다음 주제로 넘어가 보세요.') && links.some((l) => l.text.includes('다른 주제로') && (l.href ?? '').includes('/plan/challenge/new')), j(links.map((l) => l.text)))
      }
      check(`3B-${label} 챌린지 화면 가로 넘침 0 [${tag}]`, ov.count === 0, j(ov))
    }
    await page.goto(`${BASE}/plan/challenge/${cCtrl.id}`, { waitUntil: 'domcontentloaded' })
    await page.locator('main').getByText(cCtrl.title).first().waitFor({ state: 'visible', timeout: 40000 })
    await sleep(600)
    const txtC = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
    const linksC = await page.evaluate(() => [...document.querySelectorAll('main a')].map((a) => ({ href: a.getAttribute('href'), text: (a.textContent ?? '').trim() })))
    check(`3B-대조(주제가 있는 완료 챌린지): 「같은 주제로 한 번 더」·[다시 도전] 링크가 있다 [${tag}]`, txtC.includes('같은 주제로 한 번 더') && linksC.some((l) => (l.href ?? '').includes('again=')), `txt=${txtC.includes('같은 주제로 한 번 더')} links=${j(linksC.map((l) => l.text))}`)
    await page.goto(`${BASE}/plan/challenges`, { waitUntil: 'domcontentloaded' })
    await page.locator('main').getByText(cDone.title).first().waitFor({ state: 'visible', timeout: 40000 }).catch(() => {})
    await sleep(500)
    const listTxt = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
    check(`3B-챌린지 기록 목록: 두 행의 제목이 그대로 보이고 「삭제됨」 없음 [${tag}]`, listTxt.includes(cDone.title) && listTxt.includes(cEnded.title) && !listTxt.includes('삭제됨'), listTxt.slice(0, 160))
    await cleanupQa(u3.id)

    // ═════ 3C. 이미 지워진 주제 → 404, 더블탭 ═════
    const PT = `QA 404 시험 ${w}`
    const P = await mkTopic(c3, PT)
    await page.goto(`${BASE}/settings/scenarios/topics/${P}`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: '주제 지우기', exact: true }).waitFor({ state: 'visible', timeout: 40000 })
    await page.getByRole('button', { name: '주제 지우기', exact: true }).click()
    await dialogOf(page).waitFor({ state: 'visible', timeout: 20000 })
    await execBtn(page, '주제 지우기').waitFor({ state: 'visible', timeout: 20000 })
    const apiDel = await api(c3, 'DELETE', `/api/v1/topics/${P}?ack=none`) // 다른 탭에서 이미 지움
    reqs.length = 0
    await execBtn(page, '주제 지우기').click()
    await page.waitForURL(/\/settings\/scenarios(\?|$)/, { timeout: 30000 })
    const t404 = await toastWait(page, /이미 지워졌어요/)
    check(`3C-이미 지워진 주제: 삭제 요청 1건 404 → 시트 닫고 관리 화면 + 토스트 「이 주제는 이미 지워졌어요.」 [${tag}]`, apiDel.status === 200 && delReqs(reqs).length === 1 && delReqs(reqs)[0].status === 404 && (await dialogOf(page).count()) === 0 && t404.some((x) => x === '이 주제는 이미 지워졌어요.'), j({ pre: apiDel.status, d: delReqs(reqs).map((r) => [r.p, r.status]), t404 }))
    const QT = `QA 더블탭 ${w}`
    const Qd = await mkTopic(c3, QT)
    await page.goto(`${BASE}/settings/scenarios/topics/${Qd}`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: '주제 지우기', exact: true }).waitFor({ state: 'visible', timeout: 40000 })
    await page.getByRole('button', { name: '주제 지우기', exact: true }).click()
    await dialogOf(page).waitFor({ state: 'visible', timeout: 20000 })
    await execBtn(page, '주제 지우기').waitFor({ state: 'visible', timeout: 20000 })
    reqs.length = 0
    await execBtn(page, '주제 지우기').dblclick()
    await page.waitForURL(/\/settings\/scenarios(\?|$)/, { timeout: 30000 })
    await sleep(800)
    check(`3C-더블탭 [주제 지우기]: 삭제 요청 1건 200·주제 삭제 [${tag}]`, delReqs(reqs).length === 1 && delReqs(reqs)[0].status === 200 && (await prisma.conversationTopic.count({ where: { id: Qd } })) === 0, j(delReqs(reqs).map((r) => [r.p, r.status])))
    check(`3-* 페이지 오류 0 [${tag}]`, errors.length === 0, j(errors))
  } catch (e) {
    check(`3-* 시나리오 예외 없이 완주 [${tag}]`, false, String(e).split('\n')[0].slice(0, 400))
    try { await page.screenshot({ path: `${SSDIR}/i3-error-${w}.png` }) } catch {}
    note(`${tag} url=${page.url()}`)
  } finally {
    await ctx.close()
    await cleanupQa(u3.id)
  }
}
await browser.close()
const h1 = await seedHash()
check('3-* 시드 해시 시작=끝 불변', j(h0) === j(h1), `${h0.sha} → ${h1.sha}`)
note('cleanup QA3 ' + j(await cleanupQa(u3.id)) + ' counts ' + j(await qaRowCounts(u3.id)) + ' qa2 ' + j(await qaRowCounts(u2.id)))
summary('item3')
await prisma.$disconnect()
