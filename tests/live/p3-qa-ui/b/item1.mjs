/**
 * 항목 1 — 기본 주제·상황 숨기기/다시 보기(시드 id), 360/390/412. QA3(쓰기)·QA2(읽기 전용). LLM 0.
 * 흐름(폭마다): 시드 주제 S6 [나에게서 숨기기] 시트 → 확인 → 토스트(「숨겼어요」) → 숨긴 기본 항목 줄 → 시트(Esc·초점·scrollTop) → [다시 보기].
 *              시드 상황(관리 화면 시트) [지우기]→숨기기 확인 → 토스트 → 숨긴 항목 다시 보기. 회화 탭 `/study/ai?tab=scenario` 에서도 같은 숨기기 → 토스트(복구는 API).
 */
import {
  api, check, cleanupQa, cookieOf, data, details, dialogA11y, dialogButtons, dialogOf, docScrollMetrics, launch, mainScrollTop, note, openPage, overflowInfo, prisma, qaRowCounts, qaUser,
  QA2, QA3, SEED_SC, seedHash, sheetBodyOverflow, sleep, SSDIR, summary, T_CAFE, toastText, WIDTHS, BASE, j,
} from './lib.mjs'

const c3 = cookieOf(process.env.QA_COOKIE)
const c2 = cookieOf(process.env.QA_COOKIE2)
const u3 = await qaUser(QA3)
const u2 = await qaUser(QA2)

await cleanupQa(u3.id)
const h0 = await seedHash()
note('seedHash start ' + j(h0))
const base2 = {
  topics: (data(await api(c2, 'GET', '/api/v1/topics?level=all'))?.items ?? []).map((x) => x.id).sort(),
  scenarios: (data(await api(c2, 'GET', '/api/v1/scenarios?limit=100'))?.items ?? []).map((x) => x.id).sort(),
}
const topicTitle = (data(await api(c3, 'GET', '/api/v1/topics?level=all'))?.items ?? []).find((x) => x.id === T_CAFE)?.title
const scTitle = (data(await api(c3, 'GET', `/api/v1/scenarios/${SEED_SC}`)))?.title
note(`topicTitle=${topicTitle} scTitle=${scTitle} QA2 base topics=${base2.topics.length} scenarios=${base2.scenarios.length}`)

const browser = await launch()
const delReqs = (reqs, pre) => reqs.filter((r) => r.m === 'DELETE' && r.p.startsWith(pre))
const overrideCount = () => prisma.userSeedOverride.count({ where: { userId: u3.id } })

async function waitDialog(page) {
  await dialogOf(page).waitFor({ state: 'visible', timeout: 20000 })
}
async function waitExecReady(page, name) {
  // 확인하는 중… 이 끝나 실행 버튼 글자가 name 이 될 때까지
  await dialogOf(page).getByRole('button', { name }).waitFor({ state: 'visible', timeout: 20000 })
}

for (const [w, h] of WIDTHS) {
  const tag = `${w}px`
  const { ctx, page, reqs, errors } = await openPage(browser, w, h, c3)
  page.setDefaultTimeout(30000)
  try {
    // ───────── A. 시드 주제 숨기기 ─────────
    const pv = data(await api(c3, 'GET', `/api/v1/topics/${T_CAFE}/removal`))
    await page.goto(`${BASE}/settings/scenarios/topics/${T_CAFE}`, { waitUntil: 'domcontentloaded' })
    const hideBtn = page.getByRole('button', { name: /나에게서 숨기기/ })
    await hideBtn.waitFor({ state: 'visible', timeout: 40000 })
    await hideBtn.scrollIntoViewIfNeeded()
    await sleep(300)
    const st0 = await mainScrollTop(page)
    await hideBtn.evaluate((e) => e.setAttribute('data-qa-opener', '1'))
    await hideBtn.click()
    await waitDialog(page)
    await waitExecReady(page, '나에게서 숨기기')
    const dtxt = (await dialogOf(page).innerText()).replace(/\s+/g, ' ')
    const a11y = await dialogA11y(page)
    const btns = await dialogButtons(page)
    note(`${tag} 시트 본문: ${dtxt.slice(0, 260)}`)
    check(`1-A 숨기기 시트 제목·본문이 #172(hide: 챌린지 없음) 값과 일치 [${tag}]`,
      a11y?.title === '이 주제를 숨길까요?' && dtxt.includes('나에게만 숨겨져요. 다른 사람에게는 그대로 보여요.') && pv.activeChallenge === null && !dtxt.includes('진행 중인 챌린지') && !dtxt.includes('함께 지워져요') && dtxt.includes('수업·단어 기록과 단어장') && pv.finishedChallenges === 0 && !dtxt.includes('완료한 챌린지 기록'),
      `title=${a11y?.title} activeChallenge=${pv.activeChallenge} finished=${pv.finishedChallenges}`)
    check(`1-A 열 때 초점=시트 제목·aria-describedby 가 존재하는 안내 문단을 가리킴 [${tag}]`, a11y?.activeIsTitle === true && a11y?.descExists === true && a11y?.descInDialog === true && (a11y?.descText ?? '').startsWith('나에게만 숨겨져요'), j(a11y))
    const exec = btns.find((b) => b.text === '나에게서 숨기기')
    const cancel = btns.find((b) => b.text === '취소')
    check(`1-A 시트 버튼 높이 ≥44(실행·취소·닫기) [${tag}]`, !!exec && !!cancel && exec.h >= 44 && cancel.h >= 44 && btns.every((b) => b.h >= 44), j(btns.map((b) => `${b.text}:${b.h}`)))
    const so = await sheetBodyOverflow(page)
    const ov = await overflowInfo(page, '[role=dialog]')
    check(`1-A 시트 본문 가로 넘침 0 [${tag}]`, so?.over === false && ov.count === 0, j({ so, ov: ov.count, items: ov.items }))
    await page.screenshot({ path: `${SSDIR}/i1-hide-sheet-${w}.png` })
    const stOpen = await mainScrollTop(page)
    // Esc → 닫힘·초점 복귀·scrollTop
    await page.keyboard.press('Escape')
    await dialogOf(page).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    const focusBack = await page.evaluate(() => document.activeElement?.getAttribute('data-qa-opener') === '1')
    const stEsc = await mainScrollTop(page)
    check(`1-A Esc 로 닫힘·연 버튼으로 초점 복귀·scrollTop 차 0px [${tag}]`, (await dialogOf(page).count()) === 0 && focusBack && stOpen === st0 && stEsc === st0, `st0=${st0} open=${stOpen} esc=${stEsc} focusBack=${focusBack}`)
    check(`1-A 열고 닫기(취소)만으로 서버 삭제 요청 0 [${tag}]`, delReqs(reqs, '/api/v1/topics/').length === 0, j(reqs.filter((r) => r.m !== 'GET').map((r) => r.m + ' ' + r.p)))
    // 다시 열고 확인
    await hideBtn.click()
    await waitDialog(page)
    await waitExecReady(page, '나에게서 숨기기')
    await dialogOf(page).getByRole('button', { name: '나에게서 숨기기' }).click()
    await page.waitForURL(/\/settings\/scenarios(\?|$)/, { timeout: 30000 })
    // 토스트
    let toast = []
    for (let i = 0; i < 20 && !toast.some((t) => t.includes('숨겼어요')); i++) {
      await sleep(150)
      toast = await toastText(page)
    }
    note(`${tag} 토스트: ${j(toast)}`)
    check(`1-A 확인 → /settings/scenarios 이동 + 토스트 「숨겼어요」(「지웠어요」 아님) [${tag}]`, new URL(page.url()).pathname === '/settings/scenarios' && toast.some((t) => t === `「${topicTitle}」 주제를 숨겼어요`) && !toast.some((t) => t.includes('지웠어요')), `url=${page.url()} toast=${j(toast)}`)
    const dels = delReqs(reqs, '/api/v1/topics/')
    check(`1-A 삭제 요청 1건·ack=none·200 [${tag}]`, dels.length === 1 && dels[0].p === `/api/v1/topics/${T_CAFE}?ack=none` && dels[0].status === 200, j(dels))
    // 목록에서 사라짐 + 숨긴 항목 줄
    const hiddenRow = page.getByRole('button', { name: /숨긴 기본 항목 1개/ })
    await hiddenRow.waitFor({ state: 'visible', timeout: 20000 })
    const listed = await page.evaluate((t) => [...document.querySelectorAll('main a')].some((a) => (a.textContent ?? '').includes(t)), topicTitle)
    const apiTopics = (data(await api(c3, 'GET', '/api/v1/topics?level=all'))?.items ?? []).map((x) => x.id)
    check(`1-A 주제 목록에서 사라지고 「숨긴 기본 항목 1개」 줄이 버튼으로 나타남 [${tag}]`, !listed && !apiTopics.includes(T_CAFE) && (await hiddenRow.evaluate((e) => e.tagName)) === 'BUTTON', `listedInUI=${listed} apiHas=${apiTopics.includes(T_CAFE)}`)
    // 다른 사용자(QA2) 분리
    const t2 = (data(await api(c2, 'GET', '/api/v1/topics?level=all'))?.items ?? []).map((x) => x.id).sort()
    check(`1-A 사용자 간 분리: QA2 의 주제 목록 그대로 [${tag}]`, j(t2) === j(base2.topics), `qa2=${t2.length} base=${base2.topics.length}`)
    // 숨긴 항목 시트 열기
    await hiddenRow.scrollIntoViewIfNeeded()
    await sleep(300)
    const hs0 = await mainScrollTop(page)
    await hiddenRow.evaluate((e) => e.setAttribute('data-qa-opener', '1'))
    await hiddenRow.click()
    await waitDialog(page)
    const hrow = dialogOf(page).getByRole('button', { name: new RegExp(`「${topicTitle}」 다시 보기`) })
    await hrow.waitFor({ state: 'visible', timeout: 10000 })
    const hbtns = await dialogButtons(page)
    const hsOpen = await mainScrollTop(page)
    const hso = await sheetBodyOverflow(page)
    const hov = await overflowInfo(page, '[role=dialog]')
    const ha = await dialogA11y(page)
    const showBtn = hbtns.find((b) => (b.aria ?? '').includes('다시 보기'))
    check(`1-A 숨긴 항목 시트: 제목·행(주제 뱃지·이름)·초점=제목 [${tag}]`, ha?.title === '숨긴 기본 항목' && ha?.activeIsTitle === true && (await dialogOf(page).innerText()).includes(topicTitle), j(ha))
    check(`1-A [다시 보기] 높이 ≥44px [${tag}]`, !!showBtn && showBtn.h >= 44, j(hbtns.map((b) => `${b.aria ?? b.text}:${b.h}`)))
    check(`1-A 숨긴 항목 시트 열 때 scrollTop 차 0px·가로 넘침 0 [${tag}]`, hsOpen === hs0 && hso?.over === false && hov.count === 0, `before=${hs0} open=${hsOpen} so=${j(hso)} ov=${hov.count}`)
    await page.keyboard.press('Escape')
    await dialogOf(page).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    const hFocus = await page.evaluate(() => document.activeElement?.getAttribute('data-qa-opener') === '1')
    const hsEsc = await mainScrollTop(page)
    check(`1-A 숨긴 항목 시트 Esc 닫힘·연 버튼 초점 복귀·scrollTop 차 0px [${tag}]`, (await dialogOf(page).count()) === 0 && hFocus && hsEsc === hs0, `focusBack=${hFocus} before=${hs0} esc=${hsEsc}`)
    // 다시 열고 [다시 보기]
    await hiddenRow.click()
    await waitDialog(page)
    const hrow2 = dialogOf(page).getByRole('button', { name: new RegExp(`「${topicTitle}」 다시 보기`) })
    await hrow2.waitFor({ state: 'visible', timeout: 10000 })
    await hrow2.click()
    await dialogOf(page).getByRole('button', { name: '다시 보이게 했어요' }).waitFor({ state: 'visible', timeout: 15000 })
    const so2 = await api(c3, 'GET', '/api/v1/seed-overrides')
    check(`1-A [다시 보기] → 「다시 보이게 했어요」·override 0행 [${tag}]`, (data(so2)?.items ?? []).length === 0 && (await overrideCount()) === 0, `items=${(data(so2)?.items ?? []).length}`)
    await dialogOf(page).getByRole('button', { name: '닫기' }).click()
    await dialogOf(page).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    let toast2 = []
    for (let i = 0; i < 20 && !toast2.some((t) => t.includes('다시 보이게')); i++) {
      await sleep(150)
      toast2 = await toastText(page)
    }
    await sleep(400)
    const listed2 = await page.evaluate((t) => [...document.querySelectorAll('main a')].some((a) => (a.textContent ?? '').includes(t)), topicTitle)
    const hiddenGone = (await page.getByRole('button', { name: /숨긴 기본 항목/ }).count()) === 0
    check(`1-A 닫으면 토스트 「다시 보이게 했어요」·주제 목록 복귀·숨긴 항목 줄 사라짐 [${tag}]`, toast2.some((t) => t === '다시 보이게 했어요') && listed2 && hiddenGone, `toast=${j(toast2)} listed=${listed2} hiddenRowGone=${hiddenGone}`)

    // ───────── B. 시드 상황 숨기기 — 관리 화면 상황 탭 ─────────
    await page.goto(`${BASE}/settings/scenarios?tab=scenarios`, { waitUntil: 'domcontentloaded' })
    const card = page.locator('main button', { hasText: scTitle }).first()
    await card.waitFor({ state: 'visible', timeout: 40000 })
    await card.scrollIntoViewIfNeeded()
    await card.click()
    await waitDialog(page)
    const delOpen = dialogOf(page).getByRole('button', { name: '지우기', exact: true })
    await delOpen.waitFor({ state: 'visible', timeout: 20000 })
    await delOpen.evaluate((e) => e.setAttribute('data-qa-opener', '1'))
    await delOpen.click()
    const grp = dialogOf(page).getByRole('group', { name: '이 상황을 지울까요?' })
    await grp.waitFor({ state: 'visible', timeout: 5000 })
    const gtxt = (await grp.innerText()).replace(/\s+/g, ' ')
    check(`1-B 상황 시트 [지우기] → 「기본 상황이라 나에게만 숨겨져요…」 확인 [${tag}]`, gtxt.includes('기본 상황이라 나에게만 숨겨져요. 기본으로 되돌릴 수 있어요.') && gtxt.includes('나에게서 숨기기'), gtxt.slice(0, 200))
    const gbtns = await dialogButtons(page)
    check(`1-B 확인 줄 버튼 높이 ≥44 [${tag}]`, gbtns.filter((b) => b.text === '나에게서 숨기기' || b.text === '취소').every((b) => b.h >= 44), j(gbtns.map((b) => `${b.text}:${b.h}`)))
    const sc2 = await dialogOf(page).getByRole('button', { name: '나에게서 숨기기' }).evaluate((e) => e.getBoundingClientRect().height)
    await dialogOf(page).getByRole('button', { name: '나에게서 숨기기' }).click()
    await dialogOf(page).waitFor({ state: 'detached', timeout: 20000 })
    let toast3 = []
    for (let i = 0; i < 20 && !toast3.some((t) => t.includes('숨겼어요')); i++) {
      await sleep(150)
      toast3 = await toastText(page)
    }
    note(`${tag} 상황 토스트(관리): ${j(toast3)}`)
    const sdel = delReqs(reqs, '/api/v1/scenarios/')
    check(`1-B 관리 화면: 토스트 「…상황을 숨겼어요」(「지웠어요」 아님)·#165 DELETE 1건 200 [${tag}]`, toast3.some((t) => t === `「${scTitle}」 상황을 숨겼어요`) && !toast3.some((t) => t.includes('지웠어요')) && sdel.length === 1 && sdel[0].p === `/api/v1/scenarios/${SEED_SC}` && sdel[0].status === 200, `toast=${j(toast3)} del=${j(sdel)} btnH=${sc2}`)
    const sApi = (data(await api(c3, 'GET', '/api/v1/scenarios?limit=100'))?.items ?? []).map((x) => x.id)
    const s2 = (data(await api(c2, 'GET', '/api/v1/scenarios?limit=100'))?.items ?? []).map((x) => x.id).sort()
    check(`1-B 사용자 간 분리: QA3 목록에서 빠지고 QA2 상황 목록 그대로 [${tag}]`, !sApi.includes(SEED_SC) && j(s2) === j(base2.scenarios), `qa3has=${sApi.includes(SEED_SC)} qa2=${s2.length} base=${base2.scenarios.length}`)
    // 숨긴 항목에서 다시 보기
    const hRow2 = page.getByRole('button', { name: /숨긴 기본 항목 1개/ })
    await hRow2.waitFor({ state: 'visible', timeout: 20000 })
    await hRow2.click()
    await waitDialog(page)
    const sRow = dialogOf(page).getByRole('button', { name: new RegExp(`「${scTitle}」 다시 보기`) })
    await sRow.waitFor({ state: 'visible', timeout: 10000 })
    const rowText = (await dialogOf(page).innerText()).replace(/\s+/g, ' ')
    check(`1-B 숨긴 항목 시트에 「상황」 뱃지+이름 행 [${tag}]`, rowText.includes('상황') && rowText.includes(scTitle), rowText.slice(0, 120))
    await sRow.click()
    await dialogOf(page).getByRole('button', { name: '다시 보이게 했어요' }).waitFor({ state: 'visible', timeout: 15000 })
    await dialogOf(page).getByRole('button', { name: '닫기' }).click()
    await dialogOf(page).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    await sleep(800)
    const sBack = (data(await api(c3, 'GET', '/api/v1/scenarios?limit=100'))?.items ?? []).map((x) => x.id)
    check(`1-B 다시 보기 → 상황 목록 복귀·override 0행 [${tag}]`, sBack.includes(SEED_SC) && (await overrideCount()) === 0, `back=${sBack.includes(SEED_SC)} overrides=${await overrideCount()}`)

    // ───────── C. 회화 탭 /study/ai?tab=scenario 에서 숨기기 ─────────
    reqs.length = 0
    await page.goto(`${BASE}/study/ai?tab=scenario`, { waitUntil: 'domcontentloaded' })
    const card2 = page.locator('main button', { hasText: scTitle }).first()
    await card2.waitFor({ state: 'visible', timeout: 40000 })
    await card2.scrollIntoViewIfNeeded()
    await card2.click()
    await waitDialog(page)
    const del2 = dialogOf(page).getByRole('button', { name: '지우기', exact: true })
    await del2.waitFor({ state: 'visible', timeout: 20000 })
    await del2.click()
    await dialogOf(page).getByRole('group', { name: '이 상황을 지울까요?' }).waitFor({ state: 'visible', timeout: 5000 })
    const g2 = (await dialogOf(page).getByRole('group', { name: '이 상황을 지울까요?' }).innerText()).replace(/\s+/g, ' ')
    await dialogOf(page).getByRole('button', { name: '나에게서 숨기기' }).click()
    await dialogOf(page).waitFor({ state: 'detached', timeout: 20000 })
    let toast4 = []
    for (let i = 0; i < 20 && !toast4.some((t) => t.includes('숨겼어요')); i++) {
      await sleep(150)
      toast4 = await toastText(page)
    }
    note(`${tag} 상황 토스트(회화 탭): ${j(toast4)}`)
    const sdel2 = delReqs(reqs, '/api/v1/scenarios/')
    check(`1-C 회화 탭: 확인 문구 일치 + 토스트 「…상황을 숨겼어요」(「지웠어요」 아님)·DELETE 1건 200 [${tag}]`, g2.includes('기본 상황이라 나에게만 숨겨져요') && toast4.some((t) => t === `「${scTitle}」 상황을 숨겼어요`) && !toast4.some((t) => t.includes('지웠어요')) && sdel2.length === 1 && sdel2[0].status === 200, `g2=${g2.slice(0, 80)} toast=${j(toast4)} del=${j(sdel2)}`)
    await sleep(600)
    const stillListed = await page.evaluate((t) => [...document.querySelectorAll('main button')].some((b) => (b.textContent ?? '').includes(t)), scTitle)
    check(`1-C 회화 탭 목록에서 해당 상황 사라짐 [${tag}]`, !stillListed, `stillListed=${stillListed}`)
    // 복구(API) — 다음 폭을 위해
    const rr = await api(c3, 'POST', '/api/v1/seed-overrides/restore', { kind: 'SCENARIO', seedId: SEED_SC })
    check(`1-C 복구(API #176) 200 후 override 0행 [${tag}]`, rr.status === 200 && (await overrideCount()) === 0, `status=${rr.status}`)
    check(`1-* 페이지 오류(pageerror) 0 [${tag}]`, errors.length === 0, j(errors))
  } catch (e) {
    check(`1-* 시나리오 예외 없이 완주 [${tag}]`, false, String(e).split('\n')[0].slice(0, 300))
    try { await page.screenshot({ path: `${SSDIR}/i1-error-${w}.png` }) } catch {}
    note(`${tag} url=${page.url()}`)
    // 상태 정리 — 다음 폭을 위해 override 전부 지움(QA3)
    await prisma.userSeedOverride.deleteMany({ where: { userId: u3.id } })
  } finally {
    await ctx.close()
  }
}

await browser.close()
const h1 = await seedHash()
check('1-* 시드 해시 시작=끝 불변', j(h0) === j(h1), `${h0.sha} → ${h1.sha}`)
const cl = await cleanupQa(u3.id)
note('cleanup QA3 ' + j(cl) + ' counts ' + j(await qaRowCounts(u3.id)) + ' qa2 ' + j(await qaRowCounts(u2.id)))
summary('item1')
await prisma.$disconnect()
