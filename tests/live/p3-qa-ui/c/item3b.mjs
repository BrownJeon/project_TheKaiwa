/**
 * 항목 3 (390, 실제 Claude 호출 3회: #170 1 + 자동 #166 1 + [하나 더] #166 1) — 새 초안 → 자동 상황 초안 1회 → 체크·재렌더·새로 고침에서 재요청 0 → [하나 더] → 순차 저장.
 */
import {
  tapAt, BASE, NEW_PATH, STORE_KEY, SSDIR, activeInfo, check, claudeCalls, cleanupQa, closeBrowser, cookieOf, docScrollMetrics, launch, mainScrollTop, mainText, note, openPage, overflowInfo,
  prisma, qaRowCounts, qaUser, QA4, seedHash, sleep, summary, j,
} from './lib.mjs'

const c4 = cookieOf(process.env.QA_COOKIE)
const u4 = await qaUser(QA4)
const W = 390
const Hh = 844
await cleanupQa(u4.id)
const h0 = await seedHash()
const call0 = claudeCalls()
note('seedHash start ' + j(h0) + ' claudeCalls start ' + j(call0))
const browser = await launch()
const o = await openPage(browser, W, Hh, c4)
const { page, reqs, errors } = o
page.setDefaultTimeout(90000)
const d166 = () => reqs.filter((r) => r.m === 'POST' && r.p === '/api/v1/scenarios/drafts')
const d170 = () => reqs.filter((r) => r.m === 'POST' && r.p === '/api/v1/topics/drafts')
const p57 = () => reqs.filter((r) => r.m === 'POST' && r.p === '/api/v1/topics')
const p163 = () => reqs.filter((r) => r.m === 'POST' && r.p === '/api/v1/scenarios')
const metrics = (sel) => page.evaluate((sel) => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r ? { y: Math.round(r.top * 10) / 10, h: Math.round(r.height * 10) / 10, w: Math.round(r.width * 10) / 10 } : null }, sel)
const saveBtn = () => page.getByRole('button', { name: /^(주제만 저장|주제와 상황 \d+개 저장|주제를 저장하고 있어요…|상황 \d+\/\d+ 저장 중…)$/ })
try {
  await page.goto(BASE + '/api/health', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.evaluate((k) => sessionStorage.removeItem(k), STORE_KEY)
  await page.goto(BASE + NEW_PATH, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.locator('#tp-ask').waitFor({ state: 'visible', timeout: 120000 })
  await page.locator('#tp-ask').fill('카페에서 주문하기')
  const t0 = Date.now()
  await tapAt(page, page.getByRole('button', { name: '초안 만들기' }))
  await page.getByRole('heading', { name: '초안이 왔어요' }).waitFor({ state: 'visible', timeout: 90000 })
  const tArrive = Date.now()
  const e170 = d170()[0]
  note(`#170 ${d170().length}건 status=${e170?.status} dt=${e170?.dt}ms 도착까지 ${tArrive - t0}ms`)
  check('3b-새 초안 도착(실제 Claude): #170 1건·200 [390px]', d170().length === 1 && e170?.status === 200, `status=${e170?.status}`)
  // 자동 #166 — 도착 직후 1회
  let tSeen = null
  for (let i = 0; i < 60; i++) {
    if (d166().length >= 1) { tSeen = Date.now(); break }
    await sleep(50)
  }
  check(`3b-도착 직후 #166 자동 정확히 1회(도착 후 ${tSeen ? tSeen - tArrive : '-'}ms 내 시작) [390px]`, tSeen !== null && d166().length === 1, `166=${d166().length}`)
  // 진행 중 상태
  await sleep(300)
  const gen = await metrics('#tp-sc-gen')
  const tBusy = await mainText(page)
  const moreBtn = page.getByRole('button', { name: '＋ 상황 하나 더 만들기' })
  const moreAd = await moreBtn.evaluate((b) => b.getAttribute('aria-disabled')).catch(() => 'none')
  const sb = saveBtn()
  await sb.scrollIntoViewIfNeeded()
  await sleep(200)
  await tapAt(page, sb)
  await sleep(400)
  const actHold = await activeInfo(page)
  const sbAd = await sb.evaluate((b) => b.getAttribute('aria-disabled')).catch(() => null)
  check(`3b-자동 요청 중: 자리 카드(≥132px) role=status·[하나 더] aria-disabled·[저장] 막힘+누르면 자리 카드 초점·#57 0·「저장할 상황이 없어요」 안 보임 [390px]`, !!gen && gen.h >= 131.5 && moreAd === 'true' && sbAd === 'true' && actHold?.id === 'tp-sc-gen' && p57().length === 0 && !tBusy.includes('저장할 상황이 없어요.'), `gen=${j(gen)} moreAd=${moreAd} sbAd=${sbAd} active=${j(actHold)}`)
  // 진행 중에도 위 칸 편집 가능
  const ti = page.getByLabel('주제 이름')
  const orig = await ti.inputValue()
  await ti.fill(orig + ' 편집')
  check(`3b-진행 중 위 칸 편집 가능(주제 이름 「${orig}」→「${await ti.inputValue()}」) [390px]`, (await ti.inputValue()) === orig + ' 편집')
  await page.locator('input[id^="tp-sc-ck-"]').first().waitFor({ state: 'attached', timeout: 90000 })
  const e166 = d166()[0]
  await sleep(500)
  note(`#166 자동 status=${e166?.status} dt=${e166?.dt}ms`)
  check(`3b-자동 #166 도착: 200·카드 1장·자리 카드 사라짐 [390px]`, e166?.status === 200 && (await page.locator('input[id^="tp-sc-ck-"]').count()) === 1 && (await page.locator('#tp-sc-gen').count()) === 0, `status=${e166?.status}`)
  const ckSel = 'input[id^="tp-sc-ck-"]'
  const ckId = await page.locator(ckSel).first().getAttribute('id')
  const ckName = await page.locator(ckSel).first().getAttribute('aria-label')
  const cardTitle = (ckName ?? '').replace(/^1번째 상황 /, '').replace(/ 이 상황도 저장$/, '')
  check(`3b-카드 체크 접근성 이름 「1번째 상황 {제목} 이 상황도 저장」(${ckName}) [390px]`, /^1번째 상황 .+ 이 상황도 저장$/.test(ckName ?? '') && cardTitle.length > 0, ckName)
  const labSel = `label[for="${ckId}"]`
  const lab = await metrics(labSel)
  const inp = await metrics(`#${ckId}`)
  check(`3b-카드 체크 라벨 행 눌림 영역 ≥44px(라벨 ${lab?.w}×${lab?.h}, input ${inp?.w}×${inp?.h}) [390px]`, !!lab && lab.h >= 43.5 && lab.w >= 43.5, j({ lab, inp }))
  // 재렌더 5종 후 #166 총 1건 유지
  await page.locator(ckSel).first().scrollIntoViewIfNeeded()
  await page.evaluate(() => { const m = document.querySelector('main'); m.scrollTop = Math.min(m.scrollTop + 100, m.scrollHeight) })
  await sleep(250)
  const lb = await page.locator(labSel).boundingBox()
  const s0 = await mainScrollTop(page)
  const g0 = { card: await metrics(labSel), save: (await saveBtn().boundingBox()).y, regen: await metrics('#tp-regen') }
  await page.touchscreen.tap(lb.x + lb.width - 12, lb.y + lb.height / 2)
  await sleep(300)
  const s1 = await mainScrollTop(page)
  const a1 = await activeInfo(page)
  const tt = await mainText(page)
  const g1 = { card: await metrics(labSel), save: (await saveBtn().boundingBox()).y, regen: await metrics('#tp-regen') }
  check(`3b-체크 해제(실제 초안): scrollTop 차 0px(${s0}→${s1})·초점 체크 유지·「저장할 상황이 없어요.」·줄 높이/위치 불변 [390px]`, s1 === s0 && a1?.id === ckId && tt.includes('저장할 상황이 없어요.') && j(g0.card) === j(g1.card) && g0.save === g1.save && j(g0.regen) === j(g1.regen), `active=${j(a1)} g0=${j(g0)} g1=${j(g1)}`)
  await page.touchscreen.tap(lb.x + lb.width - 12, lb.y + lb.height / 2)
  await sleep(300)
  check(`3b-다시 체크: scrollTop 차 0px·#166 아직 1건 [390px]`, (await mainScrollTop(page)) === s0 && d166().length === 1, `166=${d166().length}`)
  // 표현 ⋯ 메뉴 열기/닫기·설명 편집·S5 왕복 뒤에도 #166 1건
  const mb = page.locator('button[aria-label$="표현 메뉴"]').nth(3)
  await mb.scrollIntoViewIfNeeded()
  await tapAt(page, mb)
  await page.getByRole('dialog').waitFor({ state: 'visible' })
  await page.keyboard.press('Escape')
  await sleep(300)
  await page.getByLabel('설명').fill('설명을 고쳐 봐요')
  await sleep(600)
  const edBtn = page.locator('[id^="tp-sc-edit-"]').first()
  await edBtn.scrollIntoViewIfNeeded()
  const sIn = await mainScrollTop(page)
  await tapAt(page, edBtn)
  await page.waitForURL(/step=sc/, { timeout: 10000 })
  await sleep(500)
  const h5 = await activeInfo(page)
  const t5 = await mainText(page)
  check(`3b-S5(실제 초안): 머리 「상황 초안」 초점·장소 「새 주제」 고정 글(「장소 · ${orig} 편집 …」) [390px]`, h5?.txt === '상황 초안' && t5.includes(`장소 · ${orig} 편집 (저장할 때 이 주제에 이어져요)`), `active=${j(h5)}`)
  await tapAt(page, page.getByRole('button', { name: '취소', exact: true }))
  await sleep(700)
  const sOut = await mainScrollTop(page)
  const aOut = await activeInfo(page)
  check(`3b-S5 [취소] → S4·초점 카드 [고치기]·이탈 ${Math.abs(sOut - sIn)}px(${sIn}→${sOut})·#166 아직 1건 [390px]`, /^tp-sc-edit-/.test(aOut?.id ?? '') && d166().length === 1, `active=${j(aOut)} 166=${d166().length}`)
  // 새로 고침 → 이어서 고치기 → #166 0
  const n170 = d170().length
  const n166 = d166().length
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '이어서 고치기' }).waitFor({ state: 'visible', timeout: 60000 })
  await tapAt(page, page.getByRole('button', { name: '이어서 고치기' }))
  await page.getByRole('heading', { name: '주제 정보' }).waitFor({ state: 'visible' })
  await sleep(1500)
  const restoredTitle = await page.getByLabel('주제 이름').inputValue()
  check(`3b-새로 고침 → 이어서 고치기: 고친 제목 복원(「${restoredTitle}」)·카드 1장 복원·#166/#170 재요청 0 [390px]`, restoredTitle === orig + ' 편집' && (await page.locator(ckSel).count()) === 1 && d166().length === n166 && d170().length === n170, `166=${d166().length}(${n166}) 170=${d170().length}(${n170})`)
  // [하나 더]: 실제 호출 1회
  const more = page.getByRole('button', { name: '＋ 상황 하나 더 만들기' })
  await more.scrollIntoViewIfNeeded()
  await tapAt(page, more)
  await page.locator('#tp-sc-more').fill('카페 직원에게 메뉴를 추천해 달라고 부탁하는 상황')
  await tapAt(page, page.getByRole('button', { name: '상황 초안 만들기' }))
  await sleep(600)
  check(`3b-[하나 더] → #166 정확히 1건 추가(총 2)·자리 카드 [390px]`, d166().length === n166 + 1 && (await page.locator('#tp-sc-gen').count()) === 1, `166=${d166().length}`)
  await page.locator('input[id^="tp-sc-ck-"]').nth(1).waitFor({ state: 'attached', timeout: 90000 })
  await sleep(400)
  const e2 = d166()[d166().length - 1]
  note(`#166 하나 더 status=${e2?.status} dt=${e2?.dt}ms`)
  check(`3b-카드 2장·[하나 더] 숨김·「저장할 상황 2/2」 [390px]`, (await page.locator(ckSel).count()) === 2 && (await page.getByRole('button', { name: '＋ 상황 하나 더 만들기' }).count()) === 0 && (await mainText(page)).includes('저장할 상황 2/2') && e2?.status === 200, `status=${e2?.status}`)
  const name2 = await page.locator(ckSel).nth(1).getAttribute('aria-label')
  check(`3b-둘째 카드 체크 이름 「2번째 상황 …」 [390px]`, /^2번째 상황 .+ 이 상황도 저장$/.test(name2 ?? ''), name2)
  const t2c = (name2 ?? '').replace(/^2번째 상황 /, '').replace(/ 이 상황도 저장$/, '')
  // 둘째 해제 → 순차 저장
  const id2 = await page.locator(ckSel).nth(1).getAttribute('id')
  await page.locator(`label[for="${id2}"]`).scrollIntoViewIfNeeded()
  const lb2 = await page.locator(`label[for="${id2}"]`).boundingBox()
  await page.touchscreen.tap(lb2.x + lb2.width - 12, lb2.y + lb2.height / 2)
  await sleep(300)
  check(`3b-저장 전 DB: QA4 행 0(주제·상황 모두) [390px]`, Object.values(await qaRowCounts(u4.id)).every((n) => n === 0), j(await qaRowCounts(u4.id)))
  await page.evaluate(() => {
    window.__rec = []
    window.__t = setInterval(() => {
      const back = document.querySelector('button[aria-label="내 상황·주제"]')
      const sv = [...document.querySelectorAll('button')].find((b) => /주제만 저장|주제와 상황 \d+개 저장|저장하고 있어요|저장 중/.test(b.textContent ?? ''))
      window.__rec.push({ back: back ? (back.getAttribute('aria-disabled') ?? String(back.disabled)) : 'gone', save: sv ? (sv.textContent ?? '').trim() : 'gone' })
    }, 25)
  })
  const sbn = saveBtn()
  await sbn.scrollIntoViewIfNeeded()
  await sleep(200)
  const bb = await sbn.boundingBox()
  await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2)
  await sleep(40)
  await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2)
  await page.evaluate(() => { const el = [...document.querySelectorAll('button')].find((x) => /주제와 상황 \d+개 저장|저장하고 있어요|저장 중/.test(x.textContent ?? '')); el?.click(); el?.click() })
  await page.waitForURL((u) => /\/settings\/scenarios\/topics\/(?!new$)[^/]+$/.test(u.pathname), { timeout: 60000 })
  await sleep(900)
  const rec = await page.evaluate(() => { clearInterval(window.__t); return [...new Set((window.__rec ?? []).map((x) => `${x.back}|${x.save}`))] })
  const a57 = p57()
  const a163 = p163()
  let b57 = null
  let b163 = null
  try { b57 = JSON.parse(a57[0]?.body ?? 'null'); b163 = JSON.parse(a163[0]?.body ?? 'null') } catch {}
  const topicRows = await prisma.conversationTopic.findMany({ where: { userId: u4.id }, include: { chunks: true } })
  const scRows = await prisma.scenario.findMany({ where: { userId: u4.id }, include: { topics: true } })
  check(`3b-저장: #57 1건·#163 1건(체크한 첫 상황만, 체크 해제 「${t2c}」 안 보냄)·topicIds=[새 주제 id]·시간순 #57→#163 [390px]`, a57.length === 1 && a163.length === 1 && b163?.topicIds?.length === 1 && b163.topicIds[0] === topicRows[0]?.id && a57[0].t <= a163[0].t && b163.title !== t2c, `57=${a57.map((x) => x.status)} 163=${a163.map((x) => x.status)} 163title=${b163?.title}`)
  check(`3b-#57 본문 chunks[].id·order 없음·title=「${orig} 편집」·표현 ${b57?.chunks?.length}개 [390px]`, !!b57 && b57.title === orig + ' 편집' && b57.chunks.every((c) => !('id' in c) && !('order' in c)), `keys=${b57 ? [...new Set(b57.chunks.flatMap((c) => Object.keys(c)))].join(',') : ''}`)
  check(`3b-DB: 주제 1(표현 ${topicRows[0]?.chunks.length}=본문 ${b57?.chunks?.length})·상황 1·연결 1(→새 주제) [390px]`, topicRows.length === 1 && topicRows[0].chunks.length === b57?.chunks?.length && scRows.length === 1 && scRows[0].topics.length === 1 && scRows[0].topics[0].topicId === topicRows[0].id, `topics=${topicRows.length} sc=${scRows.map((s) => s.title)}`)
  const toast = await page.evaluate(() => [...document.querySelectorAll('[role=status],[role=alert]')].map((e) => (e.textContent ?? '').trim()).filter(Boolean))
  const st = await mainScrollTop(page)
  const act = await activeInfo(page)
  check(`3b-도착: 주제 보기·main.scrollTop=0(${st})·머리 제목 초점·토스트 「…주제를 저장했어요 · 상황 1개도 저장했어요」 [390px]`, st === 0 && /^H[12]$/.test(act?.tag ?? '') && toast.some((x) => x.includes('주제를 저장했어요 · 상황 1개도 저장했어요')), `active=${j(act)} toast=${j(toast)}`)
  note(`저장 중 기록: ${j(rec)}`)
  check(`3b-저장 중 ← 비활성·「주제를 저장하고 있어요…」→「상황 1/1 저장 중…」 [390px]`, rec.some((x) => /^true\|주제를 저장하고 있어요/.test(x)) && rec.some((x) => /^true\|상황 1\/1 저장 중/.test(x)), j(rec))
  check('3b-페이지 오류 0', errors.length === 0, errors.join('|'))
} catch (e) {
  check('3b-스크립트 오류', false, String(e).slice(0, 500))
  try { await page.screenshot({ path: `${SSDIR}/item3b-err.png` }) } catch {}
}
await o.ctx.close()
const call1 = claudeCalls()
note('claudeCalls end ' + j(call1))
const cl = await cleanupQa(u4.id)
const h1 = await seedHash()
check('3b-정리: QA4 행 0·시드 해시 불변', j(h1) === j(h0) && Object.values(await qaRowCounts(u4.id)).every((n) => n === 0), `cleanup=${j(cl)} sha ${h0.sha}→${h1.sha}`)
await closeBrowser(browser)
summary('항목 3b (390 실호출)')
await prisma.$disconnect()
