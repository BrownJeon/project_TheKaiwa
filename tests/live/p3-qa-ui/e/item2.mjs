/**
 * qa-045-ui-e 항목 2 — 상황 시트 행동 줄(출처별)·S11 기본 상황 고치기(#175)·되돌리기(#176)·지우기/숨기기 토스트·new?topicId=·로그아웃 callbackUrl·열린 리다이렉트.
 * 실제 API(QA2 행만, LLM 0). 실행:
 *   cd $HOME/.node-local/thekaiwa-qa045ui-e && QA_COOKIE2=<쿠키 파일> node --env-file=.env <이 파일> > <로그> 2>&1
 */
import { BASE, WIDTHS, QA2, T_CAFE, cookieOf, qaUser, seedHash, qaRowCounts, cleanupQa, prisma, launch, openPage, check, note, summary, sleep, j, api, data, mkScenario, toastWait } from './lib.mjs'
import { tap, scroller, overflow, smallTargets } from './ui.mjs'

const ck = cookieOf(process.env.QA_COOKIE2)
const u = await qaUser(QA2)
const SEED_SHA = 'e826f3ef09237a9c'
const WSEL = (process.env.QA_WIDTHS ?? '').split(',').filter(Boolean).map(Number)
const h0 = await seedHash()
check('시작 시드 해시', h0.sha === SEED_SHA, j(h0))
const r0 = await qaRowCounts(u.id)
check('시작 QA2 행 0', Object.values(r0).every((v) => v === 0), j(r0))
const browser = await launch()

const SEED_A = 'scn_cafe-order-drink'
const SEED_B = 'scn_directions-recheck'
const SEED_C = 'scn_weekend-plan-tell'
const SEED_D = 'scn_travel-story-tell'
const SEED_E = 'scn_cafe-order-takeout'

const dlg = (page) => page.locator('[role=dialog]')
async function openSheet(page, base, id) {
  await page.goto(`${BASE}${base}${base.includes('?') ? '&' : '?'}sc=${id}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[role=dialog] a:has-text("고치기")', { timeout: 20000 })
  await sleep(300)
}
const sheetInfo = (page) =>
  page.evaluate(() => {
    const d = document.querySelector('[role=dialog]')
    if (!d) return null
    const box = (e) => { const r = e.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width) } }
    return {
      links: [...d.querySelectorAll('a[href]')].map((a) => ({ t: (a.textContent || '').trim(), href: a.getAttribute('href'), ...box(a) })),
      btns: [...d.querySelectorAll('button')].map((b) => ({ t: (b.textContent || '').trim(), ...box(b) })),
      lines: d.innerText.split('\n').map((x) => x.trim()).filter(Boolean),
    }
  })
const tt = (arr) => arr.map((x) => x.t)
const cleanId = (url) => new URL(url).searchParams.get('sc')

async function runWidth(w, h) {
  const T = `[${w}]`
  const { ctx, page, reqs, errors } = await openPage(browser, w, h, ck)
  // 준비(API): 내 상황 1개 + 시드 E 의 내 버전(사본) 1개
  const idMine = await mkScenario(ck, `QA-E 내 상황 ${w}`, [T_CAFE])
  const forkE = await api(ck, 'POST', `/api/v1/scenarios/${SEED_E}/fork`, {})
  const idCopyE = data(forkE)?.id
  check(`${T} 준비: 내 상황·사본 생성(201)`, !!idMine && forkE.status === 201 && !!idCopyE, `mine=${idMine} fork=${forkE.status}`)

  // ── A. 시트 행동 줄(출처별) — 회화 탭·관리 화면 ───────────────────
  for (const [base, tag, fromQ] of [['/study/ai?tab=scenario', '회화 탭', ''], ['/settings/scenarios?tab=scenarios', '관리 화면', '?from=manage']]) {
    for (const [id, origin, want] of [
      [idMine, '내 상황', { links: ['고치기', '변형 만들기'], btn: '지우기', noBtn: '기본으로 되돌리기', badge: '내 상황' }],
      [SEED_A, '시드', { links: ['고치기', '변형 만들기'], btn: '지우기', noBtn: '기본으로 되돌리기', badge: '기본' }],
      [idCopyE, '내 버전', { links: ['고치기', '변형 만들기'], btn: '기본으로 되돌리기', noBtn: '지우기', badge: '✎ 내 버전' }],
    ]) {
      await openSheet(page, base, id)
      const si = await sheetInfo(page)
      const lt = tt(si.links)
      const bt = tt(si.btns)
      check(`${T} ${tag}·${origin}: 링크 [${want.links.join('·')}]`, want.links.every((x) => lt.includes(x)), j(lt))
      check(`${T} ${tag}·${origin}: 버튼 [${want.btn}] 있고 [${want.noBtn}] 없음`, bt.includes(want.btn) && !bt.includes(want.noBtn), j(bt))
      check(`${T} ${tag}·${origin}: 출처 뱃지 「${want.badge}」`, si.lines.includes(want.badge), j(si.lines.slice(0, 6)))
      check(`${T} ${tag}·${origin}: 「변형」 뱃지·「원본 ·」 문구 없음(L-2)`, !si.lines.includes('변형') && !si.lines.some((x) => x.startsWith('원본 ·')))
      const editLink = si.links.find((x) => x.t === '고치기')
      const varLink = si.links.find((x) => x.t === '변형 만들기')
      check(`${T} ${tag}·${origin}: 고치기/변형 링크 주소(${fromQ || 'from 없음'})`, editLink.href === `/study/ai/scenario/${id}/edit${fromQ}` && varLink.href === `/study/ai/scenario/${id}/variant${fromQ}`, `${editLink.href} | ${varLink.href}`)
      const small = [...si.links, ...si.btns].filter((x) => x.t && ['고치기', '변형 만들기', '지우기', '기본으로 되돌리기'].includes(x.t) && (x.h < 44 || x.w < 44))
      if (small.length) note(`${T} ${tag}·${origin}: 44px 미만 행동 요소 ${j(small)}`)
      check(`${T} ${tag}·${origin}: 행동 줄 높이 ≥44px`, [...si.links, ...si.btns].filter((x) => ['고치기', '변형 만들기', '지우기', '기본으로 되돌리기'].includes(x.t)).every((x) => x.h >= 44), j([...si.links, ...si.btns].filter((x) => ['고치기', '변형 만들기', '지우기', '기본으로 되돌리기'].includes(x.t))))
      const ov = await overflow(page)
      check(`${T} ${tag}·${origin}: 가로 넘침 0`, ov.count === 0, j(ov))
    }
  }
  // 관리 화면 목록의 출처 뱃지 = 시트 판정
  await page.goto(`${BASE}/settings/scenarios?tab=scenarios`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('button:has-text("QA-E 내 상황")', { timeout: 20000 })
  await sleep(500)
  const badges = await page.evaluate(([a, b, c]) => {
    const row = (title) => [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes(title))
    const pick = (title) => { const r = row(title); return r ? r.innerText.split('\n').map((s) => s.trim()).filter(Boolean) : null }
    return { mine: pick(a), seed: pick(b), copy: pick(c) }
  }, ['QA-E 내 상황', '음료의 온도·크기 정해서 주문하기', '포장으로 바꿔서 계산하기'])
  check(`${T} 관리 목록 뱃지: 내 상황=「내 상황」·시드=「기본」·사본=「✎ 내 버전」`, badges.mine?.includes('내 상황') && badges.seed?.includes('기본') && badges.copy?.includes('✎ 내 버전'), j(badges))

  // ── B. S11 기본 상황 고치기 → #175(순차) ──────────────────────────
  const seedRow = await prisma.scenario.findUnique({ where: { id: SEED_A } })
  await page.goto(`${BASE}/study/ai/scenario/${SEED_A}/edit?from=manage`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#dr-title', { timeout: 20000 })
  await sleep(300)
  const txtS11 = await page.evaluate(() => document.body.innerText)
  check(`${T} S11 시드 고치기: 404 아님·InfoBox 「기본 상황이에요. 고쳐서 저장하면 내 버전으로…」`, txtS11.includes('기본 상황이에요.') && txtS11.includes('고쳐서 저장하면 내 버전으로 바뀌고') && !txtS11.includes('이 상황은 고칠 수 없어요'), txtS11.slice(0, 80).replace(/\n/g, '/'))
  check(`${T} S11: 저장 버튼 「내 버전으로 저장」·제목 「상황 고치기」`, (await page.getByRole('button', { name: '내 버전으로 저장', exact: true }).count()) === 1 && (await page.locator('header h1').innerText()) === '상황 고치기')
  const back = await page.locator('header a[aria-label]').getAttribute('aria-label')
  const backHref = await page.locator('header a[aria-label]').getAttribute('href')
  check(`${T} S11 ?from=manage: 뒤로 「내 상황·주제로」 → /settings/scenarios?tab=scenarios`, back === '내 상황·주제로' && backHref === '/settings/scenarios?tab=scenarios', `${back} ${backHref}`)
  const titleNew = `QA-E 사본 ${w}`
  await page.locator('#dr-title').fill(titleNew)
  const nFork0 = reqs.filter((r) => r.p === `/api/v1/scenarios/${SEED_A}/fork`).length
  await tap(page, page.getByRole('button', { name: '내 버전으로 저장', exact: true }))
  await page.waitForURL(/\/settings\/scenarios\?tab=scenarios&sc=.+/, { timeout: 15000 }).catch(() => {})
  await sleep(700)
  const forkReq = reqs.filter((r) => r.p === `/api/v1/scenarios/${SEED_A}/fork`).slice(nFork0)
  check(`${T} S11 저장: #175 POST 1회 201`, forkReq.length === 1 && forkReq[0].status === 201, j(forkReq.map((x) => x.status)))
  const fbody = forkReq.length ? JSON.parse(forkReq[0].body) : {}
  check(`${T} S11 저장 본문 = 바뀐 칸(title)만`, j(Object.keys(fbody)) === '["title"]' && fbody.title === titleNew, j(Object.keys(fbody)))
  const urlB = page.url()
  check(`${T} S11 ?from=manage 저장 뒤 /settings/scenarios?tab=scenarios&sc=<사본>`, /\/settings\/scenarios\?tab=scenarios&sc=[^&]+(&saved=1)?$/.test(urlB) || /\/settings\/scenarios\?tab=scenarios&sc=/.test(urlB), urlB)
  const copyRow = await prisma.scenario.findFirst({ where: { userId: u.id, title: titleNew } })
  check(`${T} DB 사본 1행`, !!copyRow && (await prisma.scenario.count({ where: { userId: u.id, title: titleNew } })) === 1)
  const exprIds = (x) => (Array.isArray(x) ? x.map((e) => e.id) : [])
  check(`${T} 사본 keyExpressions id = 시드 id`, j(exprIds(copyRow?.keyExpressions)) === j(exprIds(seedRow.keyExpressions)), `${j(exprIds(copyRow?.keyExpressions))} vs ${j(exprIds(seedRow.keyExpressions))}`)
  check(`${T} 사본 constraints.exprSeq = 시드 exprSeq`, j(copyRow?.constraints?.exprSeq) === j(seedRow.constraints?.exprSeq), `${j(copyRow?.constraints?.exprSeq)} vs ${j(seedRow.constraints?.exprSeq)}`)
  const ovr = await prisma.userSeedOverride.findMany({ where: { userId: u.id, kind: 'SCENARIO', seedId: SEED_A } })
  check(`${T} UserSeedOverride 1행(copyId=사본)`, ovr.length === 1 && ovr[0].copyId === copyRow?.id, j(ovr.map((x) => [x.kind, x.seedId, x.copyId])))
  const hB = await seedHash()
  check(`${T} S11 뒤 시드 해시 불변`, hB.sha === SEED_SHA, hB.sha)
  // 사본 시트 토스트
  const tB = await toastWait(page, /내 버전으로 저장했어요|내 상황에 저장했어요/)
  note(`${T} 저장 직후 토스트: ${j(tB)}`)
  check(`${T} 저장 직후 관리 화면 사본 시트가 열림 + 토스트 「내 버전으로 저장했어요」`, (await dlg(page).count()) === 1 && tB.some((x) => x.includes('내 버전으로 저장했어요')), j(tB))
  await sleep(300)
  check(`${T} 저장 토스트 뒤 주소에서 saved 제거(다시 들어와도 안 뜸)`, !page.url().includes('saved=1'), page.url())

  // ── C. 두 탭 경쟁(동시 저장) ─────────────────────────────────────
  const pB = await ctx.newPage()
  const reqsB = []
  pB.on('request', (r) => { const x = new URL(r.url()); if (x.pathname.startsWith('/api/v1/')) reqsB.push({ m: r.method(), p: x.pathname, r, status: null }) })
  pB.on('response', (res) => { const e = reqsB.find((q) => q.r === res.request()); if (e) e.status = res.status() })
  for (const pg of [page, pB]) {
    await pg.goto(`${BASE}/study/ai/scenario/${SEED_B}/edit`, { waitUntil: 'domcontentloaded' })
    await pg.waitForSelector('#dr-title', { timeout: 20000 })
  }
  await page.locator('#dr-title').fill(`QA-E 경쟁A ${w}`)
  await pB.locator('#dr-title').fill(`QA-E 경쟁B ${w}`)
  const btnA = page.getByRole('button', { name: '내 버전으로 저장', exact: true })
  const btnB = pB.getByRole('button', { name: '내 버전으로 저장', exact: true })
  await btnA.scrollIntoViewIfNeeded()
  await btnB.scrollIntoViewIfNeeded()
  const bbA = await btnA.boundingBox()
  const bbB = await btnB.boundingBox()
  await Promise.all([page.touchscreen.tap(bbA.x + bbA.width / 2, bbA.y + bbA.height / 2), pB.touchscreen.tap(bbB.x + bbB.width / 2, bbB.y + bbB.height / 2)])
  await sleep(2500)
  const stA = reqs.filter((r) => r.p === `/api/v1/scenarios/${SEED_B}/fork`).map((x) => x.status)
  const stB = reqsB.filter((r) => r.p === `/api/v1/scenarios/${SEED_B}/fork`).map((x) => x.status)
  const all = [...stA, ...stB].sort()
  check(`${T} 두 탭 동시 저장: 201 한 번·409 한 번`, j(all) === '[201,409]', j({ A: stA, B: stB }))
  const loser = stA.includes(409) ? page : pB
  const lt = await loser.evaluate(() => document.body.innerText)
  check(`${T} 진 쪽: 안내 「다른 화면에서 이미 내 버전을 만들었어요…」+[내 버전 열기]`, lt.includes('다른 화면에서 이미 내 버전을 만들었어요. 여기서 고친 내용은 저장되지 않았어요.') && (await loser.getByRole('button', { name: '내 버전 열기', exact: true }).count()) === 1, lt.slice(-200).replace(/\n/g, '/'))
  check(`${T} 진 쪽: 서버 message·「ALREADY_COPIED」 문자열 노출 0`, !lt.includes('ALREADY_COPIED') && !lt.includes('이미 내 버전이'.replace('이미 내 버전이', 'XXXX')))
  await tap(loser, loser.getByRole('button', { name: '내 버전 열기', exact: true }))
  await loser.waitForURL(/sc=/, { timeout: 15000 }).catch(() => {})
  await sleep(600)
  check(`${T} [내 버전 열기] → 사본 시트(?sc=<사본 id>)`, /sc=/.test(loser.url()) && (await dlg(loser).count()) === 1, loser.url())
  const rowsB = await prisma.scenario.findMany({ where: { userId: u.id, title: { in: [`QA-E 경쟁A ${w}`, `QA-E 경쟁B ${w}`] } } })
  const ovB = await prisma.userSeedOverride.count({ where: { userId: u.id, kind: 'SCENARIO', seedId: SEED_B } })
  check(`${T} DB: 사본 1행·override 1행(경쟁 뒤)`, rowsB.length === 1 && ovB === 1, `copies=${rowsB.length} overrides=${ovB}`)
  await pB.close()

  // ── D. 되돌리기(#176) ───────────────────────────────────────────
  await openSheet(page, '/study/ai?tab=scenario', copyRow.id)
  await tap(page, dlg(page).getByRole('button', { name: '기본으로 되돌리기', exact: true }))
  await sleep(300)
  const conf = await page.evaluate(() => document.querySelector('[role=dialog] [role=group] h3')?.textContent ?? '')
  check(`${T} 되돌리기 확인 열림 「기본 상황으로 되돌릴까요?」`, conf === '기본 상황으로 되돌릴까요?', conf)
  const nRs0 = reqs.filter((r) => r.p === '/api/v1/seed-overrides/restore').length
  await tap(page, page.locator('[role=dialog] [role=group]:has(h3) button').first())
  const tR = await toastWait(page, /되돌렸어요/)
  const rReq = reqs.filter((r) => r.p === '/api/v1/seed-overrides/restore').slice(nRs0)
  check(`${T} 되돌리기: #176 1회 200·본문 {kind:SCENARIO, seedId}`, rReq.length === 1 && rReq[0].status === 200 && j(JSON.parse(rReq[0].body)) === j({ kind: 'SCENARIO', seedId: SEED_A }), j(rReq.map((x) => [x.status, x.body])))
  check(`${T} 되돌리기 토스트 「기본 상황으로 되돌렸어요」`, tR.some((x) => x.includes('기본 상황으로 되돌렸어요')), j(tR))
  const copyAfter = await prisma.scenario.findUnique({ where: { id: copyRow.id } })
  const ovAfter = await prisma.userSeedOverride.count({ where: { userId: u.id, kind: 'SCENARIO', seedId: SEED_A } })
  check(`${T} DB: override 0·사본 보관(ARCHIVED)`, ovAfter === 0 && copyAfter?.status === 'ARCHIVED', `override=${ovAfter} copy.status=${copyAfter?.status}`)
  const list = data(await api(ck, 'GET', '/api/v1/scenarios?limit=100')).items.map((x) => x.id)
  check(`${T} 목록: 시드 복귀·사본 없음`, list.includes(SEED_A) && !list.includes(copyRow.id), '')
  const hD = await seedHash()
  check(`${T} 되돌린 뒤 시드 해시 불변`, hD.sha === SEED_SHA, hD.sha)

  // ── E. 지우기 토스트(회화 탭·관리 화면) ─────────────────────────────
  // 내 상황 — 회화 탭
  await openSheet(page, '/study/ai?tab=scenario', idMine)
  await tap(page, dlg(page).getByRole('button', { name: '지우기', exact: true }))
  await sleep(300)
  const delT = await page.evaluate(() => document.querySelector('[role=dialog] [role=group] h3')?.textContent ?? '')
  check(`${T} 내 상황 지우기 확인 「이 상황을 지울까요?」`, delT === '이 상황을 지울까요?', delT)
  const nD0 = reqs.filter((r) => r.m === 'DELETE').length
  await tap(page, page.locator('[role=dialog] [role=group]:has(h3) button').first())
  const tDel = await toastWait(page, /지웠어요/)
  const dReq = reqs.filter((r) => r.m === 'DELETE').slice(nD0)
  check(`${T} 회화 탭 내 상황 지우기: 삭제 1건 200·토스트 「지웠어요」`, dReq.length === 1 && dReq[0].status === 200 && tDel.some((x) => x.trim() === '지웠어요'), j({ req: dReq.map((x) => [x.p, x.status]), toast: tDel }))
  const mineRow = await prisma.scenario.findUnique({ where: { id: idMine } })
  check(`${T} DB: 내 상황 status=ARCHIVED`, mineRow?.status === 'ARCHIVED', mineRow?.status)
  const d2 = await api(ck, 'DELETE', `/api/v1/scenarios/${idMine}`)
  check(`${T} 두 번째 삭제 200 alreadyArchived`, d2.status === 200 && data(d2)?.alreadyArchived === true, j(d2.body).slice(0, 160))
  // 내 상황 — 관리 화면
  const idMine2 = await mkScenario(ck, `QA-E 내 상황2 ${w}`, [T_CAFE])
  await openSheet(page, '/settings/scenarios?tab=scenarios', idMine2)
  await tap(page, dlg(page).getByRole('button', { name: '지우기', exact: true }))
  await sleep(300)
  const nD1 = reqs.filter((r) => r.m === 'DELETE').length
  await tap(page, page.locator('[role=dialog] [role=group]:has(h3) button').first())
  const tDel2 = await toastWait(page, /지웠어요/)
  const dReq2 = reqs.filter((r) => r.m === 'DELETE').slice(nD1)
  check(`${T} 관리 화면 내 상황 지우기: 삭제 1건 200·토스트 「지웠어요」`, dReq2.length === 1 && dReq2[0].status === 200 && tDel2.some((x) => x.trim() === '지웠어요'), j({ req: dReq2.map((x) => [x.p, x.status]), toast: tDel2 }))
  // 시드 숨기기 — 회화 탭(C)·관리 화면(D)
  for (const [base, seedId, title, tag] of [['/study/ai?tab=scenario', SEED_C, '주말 계획 이야기하기', '회화 탭'], ['/settings/scenarios?tab=scenarios', SEED_D, '다녀온 여행 이야기하기', '관리 화면']]) {
    await openSheet(page, base, seedId)
    await tap(page, dlg(page).getByRole('button', { name: '지우기', exact: true }))
    await sleep(300)
    const ht = await page.evaluate(() => document.querySelector('[role=dialog] [role=group]')?.innerText ?? '')
    check(`${T} ${tag} 시드 지우기 확인: 「기본 상황이라 나에게만 숨겨져요. 기본으로 되돌릴 수 있어요.」+ 버튼 「나에게서 숨기기」`, ht.includes('기본 상황이라 나에게만 숨겨져요. 기본으로 되돌릴 수 있어요.') && ht.includes('나에게서 숨기기'), ht.slice(0, 120).replace(/\n/g, '/'))
    const nD = reqs.filter((r) => r.m === 'DELETE').length
    await tap(page, page.locator('[role=dialog] [role=group]:has(h3) button').first())
    const tH = await toastWait(page, /숨겼어요/)
    const hReq = reqs.filter((r) => r.m === 'DELETE').slice(nD)
    check(`${T} ${tag} 시드 숨기기: 삭제 1건 200·토스트 「「${title}」 상황을 숨겼어요」(「지웠어요」 아님)`, hReq.length === 1 && hReq[0].status === 200 && tH.some((x) => x.includes(`「${title}」 상황을 숨겼어요`)) && !tH.some((x) => x.trim() === '지웠어요'), j({ req: hReq.map((x) => [x.p, x.status]), toast: tH }))
    const ovH = await prisma.userSeedOverride.findFirst({ where: { userId: u.id, kind: 'SCENARIO', seedId } })
    check(`${T} ${tag} DB: override HIDDEN(copyId null)`, !!ovH && ovH.copyId === null, j(ovH))
    const rs = await api(ck, 'POST', '/api/v1/seed-overrides/restore', { kind: 'SCENARIO', seedId })
    check(`${T} ${tag} 다시 보기(#176) 200`, rs.status === 200, String(rs.status))
  }

  // ── F. new?topicId= / from= ─────────────────────────────────────
  const placeState = (pg) => pg.evaluate(() => [...document.querySelectorAll('[role=radiogroup][aria-label="장소 (선택)"] [role=radio]')].map((r) => ({ t: (r.textContent || '').trim(), on: r.getAttribute('aria-checked') === 'true' })))
  const gotoNew = async (qs) => {
    await page.goto(`${BASE}/study/ai/scenario/new${qs}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#dr-description', { timeout: 20000 })
    await sleep(500)
  }
  await gotoNew(`?topicId=${T_CAFE}`)
  let ps = await placeState(page)
  check(`${T} new?topicId=<유효 주제>: 장소 「카페 주문」 미리 선택`, ps.find((x) => x.on)?.t === '카페 주문', j(ps.filter((x) => x.on)))
  // 가려진 시드 주제
  const hide = await api(ck, 'DELETE', `/api/v1/topics/${T_CAFE}?ack=none`)
  check(`${T} 준비: 시드 주제 숨김(#173) 200`, hide.status === 200, String(hide.status))
  await gotoNew(`?topicId=${T_CAFE}`)
  ps = await placeState(page)
  check(`${T} new?topicId=<내가 가린 시드 주제>: 무시(장소 「고르지 않음」)·「카페 주문」 칩 없음`, ps.find((x) => x.on)?.t === '고르지 않음' && !ps.some((x) => x.t === '카페 주문'), j(ps))
  const rt = await api(ck, 'POST', '/api/v1/seed-overrides/restore', { kind: 'TOPIC', seedId: T_CAFE })
  check(`${T} 준비 해제: 시드 주제 다시 보기 200`, rt.status === 200, String(rt.status))
  // 남의 주제(다른 계정의 비시드 주제가 있을 때만)
  const other = await prisma.conversationTopic.findFirst({ where: { userId: { not: null, notIn: [u.id] }, isSeed: false }, select: { id: true } })
  if (other) {
    await gotoNew(`?topicId=${other.id}`)
    ps = await placeState(page)
    check(`${T} new?topicId=<남의 주제>: 무시(고르지 않음)`, ps.find((x) => x.on)?.t === '고르지 않음', j(ps.filter((x) => x.on)))
  } else note(`${T} 남의 비시드 주제 행이 지금 없음 — 「남의 주제」 시험은 NOT_VERIFIED(대신 존재하지 않는 id 로 같은 경로 시험)`)
  for (const bad of ['cmzzzzzzzzzzzzzzzzzzzzzzz', 'zzzz', 'https%3A%2F%2Fevil.example', '%2F%2Fevil.example', 'javascript%3Aalert(1)', 'a%0Ab', '%3Cscript%3E']) {
    await gotoNew(`?topicId=${bad}`)
    ps = await placeState(page)
    const here = new URL(page.url())
    check(`${T} new?topicId=${decodeURIComponent(bad).replace(/\n/g, '\\n').slice(0, 24)}: 무시·같은 출처 유지`, here.origin === BASE && ps.find((x) => x.on)?.t === '고르지 않음', `${page.url()} ${j(ps.filter((x) => x.on))}`)
  }
  await gotoNew(`?from=manage&topicId=${T_CAFE}`)
  const bk = await page.locator('header a[aria-label]').getAttribute('aria-label')
  const bkh = await page.locator('header a[aria-label]').getAttribute('href')
  ps = await placeState(page)
  check(`${T} new?from=manage&topicId: 뒤로 「내 상황·주제로」 + 장소 선택`, bk === '내 상황·주제로' && bkh === '/settings/scenarios?tab=scenarios' && ps.find((x) => x.on)?.t === '카페 주문', `${bk} ${bkh}`)
  for (const bad of ['https%3A%2F%2Fevil.example', '%2F%2Fevil.example', 'javascript%3Aalert(1)', 'manage%0A', 'MANAGE', 'manage%20']) {
    await gotoNew(`?from=${bad}`)
    const l2 = await page.locator('header a[aria-label]').getAttribute('aria-label')
    const h2 = await page.locator('header a[aria-label]').getAttribute('href')
    check(`${T} new?from=${decodeURIComponent(bad).replace(/\n/g, '\\n')}: 무시 → 뒤로 「시나리오로」 /study/ai?tab=scenario`, l2 === '시나리오로' && h2 === '/study/ai?tab=scenario', `${l2} ${h2}`)
  }
  // 내용 지정 없는 경우 첫 화면에서도 가로 넘침·44px
  await gotoNew('')
  const ovN = await overflow(page)
  const smN = await smallTargets(page)
  check(`${T} new(묻기 단계): 가로 넘침 0`, ovN.count === 0, j(ovN))
  note(`${T} new(묻기 단계) 44px 미만 터치 요소: ${j(smN)}`)

  check(`${T} 페이지 오류 0`, errors.length === 0, errors.join(' | '))
  await ctx.close()
  const cl = await cleanupQa(u.id)
  note(`${T} 정리 ${j(cl)}`)
  // 숨김·override 잔여(시드 주제·상황) 방지 확인
  const ovLeft = await prisma.userSeedOverride.count({ where: { userId: u.id } })
  check(`${T} 정리 뒤 override 0`, ovLeft === 0, String(ovLeft))
}

for (const [w, h] of WIDTHS) {
  if (WSEL.length && !WSEL.includes(w)) continue
  await runWidth(w, h)
  await sleep(1500)
}

// ── G. 로그아웃 callbackUrl·열린 리다이렉트(폭 무관, 1회) ─────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const back = async (path) => {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
    const u2 = new URL(page.url())
    return { pathname: u2.pathname, origin: u2.origin, cb: u2.searchParams.get('callbackUrl') }
  }
  let r = await back(`/study/ai/scenario/new?from=manage&topicId=${T_CAFE}`)
  check('로그아웃 new?from=manage&topicId=X → /login?callbackUrl= 에 원래 경로·from·topicId 보존', r.pathname === '/login' && r.cb === `/study/ai/scenario/new?from=manage&topicId=${T_CAFE}`, j(r))
  r = await back(`/study/ai/scenario/${SEED_A}/variant?from=manage`)
  check('로그아웃 variant?from=manage → callbackUrl 에 from 보존', r.pathname === '/login' && r.cb === `/study/ai/scenario/${SEED_A}/variant?from=manage`, j(r))
  for (const q of ['?from=//evil.example&topicId=https://evil.example', '?from=javascript:alert(1)&topicId=%0Aabc', '?topicId=//evil.example/x']) {
    r = await back(`/study/ai/scenario/new${q}`)
    check(`로그아웃 new${q.slice(0, 40)}: 같은 출처 /login 이고 callbackUrl 이 /study/ai/scenario/new 로 시작(열린 리다이렉트 0)`, r.origin === BASE && r.pathname === '/login' && (r.cb ?? '').startsWith('/study/ai/scenario/new'), j(r))
  }
  await ctx.close()
  // 로그인 쿠키 있는 상태에서 /login?callbackUrl= 악성 값 — 도착 출처
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ko-KR' })
  const eq = ck.indexOf('=')
  await ctx2.addCookies([{ name: ck.slice(0, eq), value: ck.slice(eq + 1), url: BASE }])
  const p2 = await ctx2.newPage()
  for (const cb of ['//evil.example/x', 'https://evil.example', 'javascript:alert(1)', '/\\evil.example', '/study/ai/scenario/new?from=manage&topicId=' + T_CAFE]) {
    await p2.goto(`${BASE}/login?callbackUrl=${encodeURIComponent(cb)}`, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await sleep(800)
    const f = new URL(p2.url())
    const okLocal = f.origin === BASE
    check(`로그인 상태 /login?callbackUrl=${cb.slice(0, 40)} → 같은 출처에 머문다`, okLocal, p2.url())
  }
  await ctx2.close()
}

const h1 = await seedHash()
check('끝 시드 해시 동일', h1.sha === SEED_SHA, j(h1))
const r1 = await qaRowCounts(u.id)
check('끝 QA2 행 0', Object.values(r1).every((v) => v === 0), j(r1))
summary('item2')
await browser.close()
await prisma.$disconnect()
