/**
 * 항목 3 (Claude 호출 0, 3폭) — S4 상황 카드·체크·S5 왕복·[하나 더](스텁)·순차 저장(#57→#163).
 * 보관 초안(SNAP_FILE: 정상 초안 + 자동 상황 카드 1장)을 주입해 「이어서 고치기」로 재개. #166 은 page.route 스텁(지연 502). #57·#163 은 실서버(QA4 행 → 끝에 cleanupQa).
 * 폭 선택: ONLY=360,390,412
 */
import {
  tapAt, BASE, NEW_PATH, STORE_KEY, SNAP_FILE, SSDIR, activeInfo, check, cleanupQa, closeBrowser, cookieOf, launch, mainScrollTop, mainText, note, openPage, overflowInfo,
  prisma, qaRowCounts, qaUser, QA4, seedHash, sleep, summary, j, docScrollMetrics,
} from './lib.mjs'
import { readFileSync } from 'node:fs'

const c4 = cookieOf(process.env.QA_COOKIE)
const u4 = await qaUser(QA4)
const SNAP0 = JSON.parse(JSON.parse(readFileSync(SNAP_FILE, 'utf8')).raw)
const H = { 360: 740, 390: 844, 412: 892 }
const WID = (process.env.ONLY ?? '360,390,412').split(',').map(Number)
const oneCard = () => JSON.stringify(SNAP0)
const twoCards = () => {
  const r = structuredClone(SNAP0)
  const c = structuredClone(r.scenarios[0])
  c.key = 'sc1'
  c.draft.title = '병원에서 약 받고 설명 듣기'
  c.draft.titleJa = '病院で薬をもらう'
  c.desc = '병원에서 약을 받으며 먹는 법을 묻는 상황'
  r.scenarios.push(c)
  return JSON.stringify(r)
}
await cleanupQa(u4.id)
const h0 = await seedHash()
note('seedHash start ' + j(h0))
const browser = await launch()
const d166 = (reqs) => reqs.filter((r) => r.m === 'POST' && r.p === '/api/v1/scenarios/drafts')
const d170 = (reqs) => reqs.filter((r) => r.m === 'POST' && r.p === '/api/v1/topics/drafts')
const p57 = (reqs) => reqs.filter((r) => r.m === 'POST' && r.p === '/api/v1/topics')
const p163 = (reqs) => reqs.filter((r) => r.m === 'POST' && r.p === '/api/v1/scenarios')
const CK0 = '#tp-sc-ck-sc0'
const CK1 = '#tp-sc-ck-sc1'

async function restore(w, raw, { slow166 = false } = {}) {
  const o = await openPage(browser, w, H[w], c4)
  const { page } = o
  page.setDefaultTimeout(60000)
  if (slow166)
    await page.route('**/api/v1/scenarios/drafts', async (route) => {
      await new Promise((r) => setTimeout(r, 2500))
      await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ success: false, data: { code: 'UPSTREAM' }, message: 'SC-MSG-XYZ' }) })
    })
  await page.goto(BASE + '/api/health', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [STORE_KEY, raw])
  await page.goto(BASE + NEW_PATH, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.getByRole('button', { name: '이어서 고치기' }).waitFor({ state: 'visible', timeout: 120000 })
  await tapAt(page, page.getByRole('button', { name: '이어서 고치기' }))
  await page.getByRole('heading', { name: '주제 정보' }).waitFor({ state: 'visible' })
  await sleep(500)
  return o
}
const metrics = (page, sel) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel)
    const r = el?.getBoundingClientRect()
    return r ? { y: Math.round(r.top * 10) / 10, h: Math.round(r.height * 10) / 10, w: Math.round(r.width * 10) / 10 } : null
  }, sel)
const saveBtn = (page) => page.getByRole('button', { name: /^(주제만 저장|주제와 상황 \d+개 저장|주제를 저장하고 있어요…|상황 \d+\/\d+ 저장 중…)$/ })

for (const w of WID) {
  const tag = `${w}px`
  // ───── 3-1: 1장 카드, 체크·S5 왕복·[하나 더]
  let o
  try {
    o = await restore(w, oneCard(), { slow166: true })
    const { page, reqs, errors } = o
    check(`3-재개(이어서 고치기)에서 #166 0·#170 0 [${tag}]`, d166(reqs).length === 0 && d170(reqs).length === 0, `166=${d166(reqs).length} 170=${d170(reqs).length}`)
    const ov = await overflowInfo(page)
    const ds = await docScrollMetrics(page)
    check(`3-S4 상황 카드 포함 가로 넘침 0·scrollWidth=clientWidth [${tag}]`, ov.count === 0 && ds.scrollWidth === ds.clientWidth, j({ ov: ov.count, items: ov.items }))
    const ck = page.locator(CK0)
    await ck.scrollIntoViewIfNeeded()
    await page.evaluate(() => { const m = document.querySelector('main'); m.scrollTop = Math.min(m.scrollTop + 120, m.scrollHeight) })
    await sleep(250)
    const name = await ck.getAttribute('aria-label')
    check(`3-카드 체크 접근성 이름 「1번째 상황 {제목} 이 상황도 저장」 [${tag}]`, name === '1번째 상황 병원에서 증상 말하고 진료받기 이 상황도 저장', `name=${name}`)
    const lab = await metrics(page, `label[for="tp-sc-ck-sc0"]`)
    const inp = await metrics(page, CK0)
    check(`3-카드 체크 라벨 행 눌림 영역 ≥44px(라벨 ${lab?.w}×${lab?.h}, input ${inp?.w}×${inp?.h}) [${tag}]`, !!lab && lab.h >= 43.5 && lab.w >= 43.5, j({ lab, inp }))
    // 라벨 글자 위(체크박스 밖)를 눌러도 토글되는지
    const lb = await page.locator('label[for="tp-sc-ck-sc0"]').boundingBox()
    const nBefore = await page.evaluate((s) => document.querySelector(s).checked, CK0)
    const sk0 = await mainScrollTop(page)
    const note0 = await mainText(page)
    const geoB = { card: await metrics(page, 'label[for="tp-sc-ck-sc0"]'), save: await saveBtn(page).boundingBox(), regen: await metrics(page, '#tp-regen') }
    await page.touchscreen.tap(lb.x + lb.width - 12, lb.y + lb.height / 2) // 라벨 오른쪽 끝(체크박스 밖 글자 쪽)
    await sleep(350)
    const off = await page.evaluate((s) => document.querySelector(s).checked, CK0)
    const sk1 = await mainScrollTop(page)
    const act1 = await activeInfo(page)
    const t1 = await mainText(page)
    const geoA = { card: await metrics(page, 'label[for="tp-sc-ck-sc0"]'), save: await saveBtn(page).boundingBox(), regen: await metrics(page, '#tp-regen') }
    check(`3-라벨 글자 눌러 체크 해제: 해제됨·main.scrollTop 차 0px(${sk0}→${sk1})·초점 체크박스 유지·「저장할 상황이 없어요.」·[주제만 저장] [${tag}]`, nBefore === true && off === false && sk1 === sk0 && act1?.id === 'tp-sc-ck-sc0' && t1.includes('저장할 상황이 없어요.') && t1.includes('주제만 저장'), `active=${j(act1)} pickTxt=${t1.match(/저장할 상황 \d+\/\d+/)?.[0]}`)
    check(`3-체크 토글 전후 줄 높이·위치 불변(라벨 y/h·저장 버튼 y·다시 만들기 y) [${tag}]`, j(geoB.card) === j(geoA.card) && Math.abs(geoB.save.y - geoA.save.y) < 0.5 && Math.abs(geoB.save.height - geoA.save.height) < 0.5 && j(geoB.regen) === j(geoA.regen), j({ geoB: { card: geoB.card, saveY: geoB.save.y, saveH: geoB.save.height, regen: geoB.regen }, geoA: { card: geoA.card, saveY: geoA.save.y, saveH: geoA.save.height, regen: geoA.regen } }))
    await page.touchscreen.tap(lb.x + lb.width - 12, lb.y + lb.height / 2)
    await sleep(350)
    const on = await page.evaluate((s) => document.querySelector(s).checked, CK0)
    const sk2 = await mainScrollTop(page)
    const t2 = await mainText(page)
    check(`3-다시 체크: 체크됨·scrollTop 차 0px(${sk0}→${sk2})·「주제를 먼저 저장하고…」·[주제와 상황 1개 저장] [${tag}]`, on === true && sk2 === sk0 && t2.includes('주제를 먼저 저장하고, 고른 상황을 하나씩 저장해요.') && t2.includes('주제와 상황 1개 저장'), `pick=${t2.match(/저장할 상황 \d+\/\d+/)?.[0]}`)
    // 체크박스 입력 자체 눌러도 토글(20px — 라벨이 받쳐 준다)
    const ib = await ck.boundingBox()
    await page.touchscreen.tap(ib.x + ib.width / 2, ib.y + ib.height / 2)
    await sleep(300)
    const off2 = await page.evaluate((s) => document.querySelector(s).checked, CK0)
    await page.touchscreen.tap(ib.x + ib.width / 2, ib.y + ib.height / 2)
    await sleep(300)
    check(`3-체크박스(${inp?.w}×${inp?.h}) 직접 탭도 토글(해제→체크 복귀) [${tag}]`, off2 === false && (await page.evaluate((s) => document.querySelector(s).checked, CK0)) === true)

    // ── S5 왕복: [고치기] → S5 → 네 가지 나가는 길
    const editBtn = page.locator('#tp-sc-edit-sc0')
    const exits = [
      ['완료', async () => { await tapAt(page, page.getByRole('button', { name: '완료', exact: true })) }],
      ['취소', async () => { await tapAt(page, page.getByRole('button', { name: '취소', exact: true })) }],
      ['← 주제 초안', async () => { await tapAt(page, page.locator('button[aria-label="주제 초안"], a[aria-label="주제 초안"]').first()) }],
      ['goBack', async () => { await page.goBack() }],
    ]
    for (const [label, doExit] of exits) {
      await editBtn.scrollIntoViewIfNeeded()
      await sleep(150)
      const sIn = await mainScrollTop(page)
      await tapAt(page, editBtn)
      await page.waitForURL(/step=sc0/, { timeout: 10000 })
      await sleep(500)
      const sEnter = await mainScrollTop(page)
      const h5 = await activeInfo(page)
      const t5 = await mainText(page)
      if (label === '완료') {
        const ob = await overflowInfo(page)
        check(`3-S5 도착: 머리 제목 「상황 초안」 초점·장소 칸 「새 주제」 고정 글·가로 넘침 0 [${tag}]`, h5?.tag === 'H2' && h5.txt === '상황 초안' && t5.includes('장소 · 병원 진료 (저장할 때 이 주제에 이어져요)') && ob.count === 0, `active=${j(h5)} overflow=${ob.count} sEnter=${sEnter}`)
        // 편집한 값이 [완료] 에서만 카드에 반영되는지: 첫 입력칸을 고친다
        const ti = page.locator('main input:visible').first()
        await ti.fill('병원 진료 상황 고침')
      }
      if (label === '취소') {
        const ti = page.locator('main input:visible').first()
        await ti.fill('취소로 사라질 제목')
      }
      await doExit()
      await sleep(700)
      const urlOk = !/step=sc0/.test(page.url()) && page.url().includes(NEW_PATH)
      const act = await activeInfo(page)
      const sOut = await mainScrollTop(page)
      const tt = await mainText(page)
      const titleNow = await page.locator('main p.text-\\[15px\\]').first().textContent().catch(() => '')
      const want = label === '완료' ? '병원 진료 상황 고침' : label === '취소' ? '병원 진료 상황 고침' : '병원 진료 상황 고침'
      check(`3-S5 나가기 [${label}] → S4 복귀·초점 카드 [고치기](${act?.id})·이탈 ${Math.abs(sOut - sIn)}px(전 ${sIn}→후 ${sOut}) [${tag}]`, urlOk && act?.id === 'tp-sc-edit-sc0', `url=${new URL(page.url()).pathname + new URL(page.url()).search} active=${j(act)} cardTitleHas고침=${tt.includes('병원 진료 상황 고침')} 취소제목=${tt.includes('취소로 사라질 제목')}`)
      note(`3-S5 [${label}] 이탈 px=${sOut - sIn} (S4 scrollTop ${sIn}→S5 ${sEnter}→복귀 ${sOut})`)
      if (label === '완료') check(`3-S5 [완료] 편집값이 카드에 반영(제목 「병원 진료 상황 고침」) [${tag}]`, tt.includes('병원 진료 상황 고침'), '')
      if (label === '취소') check(`3-S5 [취소] 편집값 버림(「취소로 사라질 제목」 없음) [${tag}]`, !tt.includes('취소로 사라질 제목'), '')
    }

    // ── [하나 더]: 표시·짧은 글 오류(요청 0)·유효 글 → #166 1건(지연 502 스텁)·진행 중 상태
    const more = page.getByRole('button', { name: '＋ 상황 하나 더 만들기' })
    check(`3-카드 1장일 때 [＋ 상황 하나 더 만들기] 보임 [${tag}]`, await more.isVisible())
    await more.scrollIntoViewIfNeeded()
    await tapAt(page, more)
    await sleep(250)
    const ta = page.locator('#tp-sc-more')
    await ta.fill('짧음')
    await tapAt(page, page.getByRole('button', { name: '상황 초안 만들기' }))
    await sleep(300)
    const errTxt = await page.locator('#tp-sc-more-err').textContent().catch(() => null)
    check(`3-[하나 더] 2자 입력 → 안내 오류 문구·#166 0건 [${tag}]`, !!errTxt && d166(reqs).length === 0, `err=${errTxt}`)
    const desc = '병원에서 약을 받으며 먹는 방법을 묻는 상황'
    await ta.fill(desc)
    const sBefore = await mainScrollTop(page)
    await tapAt(page, page.getByRole('button', { name: '상황 초안 만들기' }))
    await sleep(500)
    const busyT = await mainText(page)
    const genBox = await metrics(page, '#tp-sc-gen')
    const saveNoteBusy = busyT.includes('저장할 상황이 없어요.')
    check(`3-[하나 더] 유효 글 → #166 정확히 1건·본문 description 일치·자리 카드(≥132px) role=status [${tag}]`, d166(reqs).length === 1 && (JSON.parse(d166(reqs)[0].body ?? '{}').description === desc) && !!genBox && genBox.h >= 131.5, `body=${(d166(reqs)[0]?.body ?? '').slice(0, 200)} gen=${j(genBox)}`)
    // 진행 중: 저장 누르면 자리 카드로 초점·#57 0
    const sb = saveBtn(page)
    await sb.scrollIntoViewIfNeeded()
    await tapAt(page, sb)
    await sleep(300)
    const actHold = await activeInfo(page)
    const sbAttrs = await sb.evaluate((b) => ({ ad: b.getAttribute('aria-disabled'), desc: b.getAttribute('aria-describedby') }))
    const moreBusyBtn = page.getByRole('button', { name: '＋ 상황 하나 더 만들기' })
    const moreVisible = await moreBusyBtn.isVisible().catch(() => false)
    check(`3-자동/추가 요청 중 [저장] 막힘: aria-disabled·누르면 자리 카드(tp-sc-gen)로 초점·#57 0·「저장할 상황이 없어요」 안 보임 [${tag}]`, sbAttrs.ad === 'true' && actHold?.id === 'tp-sc-gen' && p57(reqs).length === 0 && !saveNoteBusy, `active=${j(actHold)} sb=${j(sbAttrs)} busyTxtHasNone=${saveNoteBusy}`)
    note(`3-요청 중 [하나 더](펼친 입력) 보임=${moreVisible}; moreBusy 안내 ${(await mainText(page)).includes('앞 상황 초안을 만드는 중이에요.')}`)
    await sleep(2800)
    const tAfter = await mainText(page)
    check(`3-스텁 502 → 실패 상자 고정 문구(서버 message 미노출)·[다시 만들기]·카드 1장 유지 [${tag}]`, !tAfter.includes('SC-MSG-XYZ') && /다시 만들기/.test(tAfter) && (await page.locator(CK0).count()) === 1, tAfter.slice(tAfter.indexOf('상황 초안'), tAfter.indexOf('상황 초안') + 160))
    check(`3-페이지 오류 0 [${tag}]`, errors.length === 0, errors.join('|'))
  } catch (e) {
    check(`3-스크립트 오류(3-1) [${tag}]`, false, String(e).slice(0, 400))
    try { await o?.page.screenshot({ path: `${SSDIR}/item3a-1-err-${w}.png` }) } catch {}
  } finally {
    await o?.ctx.close()
  }

  // ───── 3-2: 2장 카드 — [하나 더] 숨김, 체크 해제 상황은 안 보냄, 순차 저장(#57→#163)
  let o2
  try {
    o2 = await restore(w, twoCards())
    const { page, reqs } = o2
    const hidden = (await page.getByRole('button', { name: '＋ 상황 하나 더 만들기' }).count()) === 0
    const t = await mainText(page)
    check(`3-카드 2장: [하나 더] 숨김·「저장할 상황 2/2」·[주제와 상황 2개 저장] [${tag}]`, hidden && t.includes('저장할 상황 2/2') && t.includes('주제와 상황 2개 저장'), t.match(/저장할 상황 \d+\/\d+/)?.[0])
    const nm2 = await page.locator(CK1).getAttribute('aria-label')
    check(`3-둘째 카드 체크 이름에 「2번째 상황」·제목 [${tag}]`, nm2 === '2번째 상황 병원에서 약 받고 설명 듣기 이 상황도 저장', nm2)
    await page.locator(CK1).scrollIntoViewIfNeeded()
    const s0 = await mainScrollTop(page)
    const lb1 = await page.locator('label[for="tp-sc-ck-sc1"]').boundingBox()
    await page.touchscreen.tap(lb1.x + lb1.width - 12, lb1.y + lb1.height / 2)
    await sleep(300)
    const s1 = await mainScrollTop(page)
    const t1 = await mainText(page)
    check(`3-둘째 카드 체크 해제: 「저장할 상황 1/2」·[주제와 상황 1개 저장]·scrollTop 차 0px(${s0}→${s1}) [${tag}]`, t1.includes('저장할 상황 1/2') && t1.includes('주제와 상황 1개 저장') && s1 === s0, '')
    const mid = await qaRowCounts(u4.id)
    check(`3-저장 전 QA4 행 0 [${tag}]`, Object.values(mid).every((n) => n === 0), j(mid))
    // 기록기(저장 중 ←·버튼 글자)
    await page.evaluate(() => {
      window.__rec = []
      window.__t = setInterval(() => {
        const back = document.querySelector('button[aria-label="내 상황·주제"]')
        const sv = [...document.querySelectorAll('button')].find((b) => /주제만 저장|주제와 상황 \d+개 저장|저장하고 있어요|저장 중/.test(b.textContent ?? ''))
        window.__rec.push({ back: back ? (back.getAttribute('aria-disabled') ?? String(back.disabled)) : 'gone', save: sv ? (sv.textContent ?? '').trim() : 'gone' })
      }, 25)
    })
    const sb = saveBtn(page)
    await sb.scrollIntoViewIfNeeded()
    await sleep(200)
    const b = await sb.boundingBox()
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
    await sleep(40)
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
    await page.evaluate(() => { const el = [...document.querySelectorAll('button')].find((x) => /주제와 상황 \d+개 저장|저장하고 있어요|저장 중/.test(x.textContent ?? '')); el?.click(); el?.click() })
    await page.waitForURL((u) => /\/settings\/scenarios\/topics\/(?!new$)[^/]+$/.test(u.pathname), { timeout: 40000 })
    await sleep(900)
    const rec = await page.evaluate(() => { clearInterval(window.__t); const r = window.__rec ?? []; return [...new Set(r.map((x) => `${x.back}|${x.save}`))] })
    const a57 = p57(reqs)
    const a163 = p163(reqs)
    let b163 = null
    try { b163 = JSON.parse(a163[0]?.body ?? 'null') } catch {}
    const topicRows = await prisma.conversationTopic.findMany({ where: { userId: u4.id } })
    const scRows = await prisma.scenario.findMany({ where: { userId: u4.id }, include: { topics: true } })
    check(`3-저장: #57 정확히 1건(터치2+동기2)·#163 정확히 1건(체크한 첫 상황만)·본문 topicIds=[새 주제 id] [${tag}]`, a57.length === 1 && a163.length === 1 && !!b163 && Array.isArray(b163.topicIds) && b163.topicIds.length === 1 && b163.topicIds[0] === topicRows[0]?.id, `57=${a57.length}(${a57.map((x) => x.status)}) 163=${a163.length}(${a163.map((x) => x.status)}) topicIds=${j(b163?.topicIds)} title=${b163?.title}`)
    check(`3-저장 순서 #57 → #163(요청 시각) [${tag}]`, a57.length === 1 && a163.length === 1 && a57[0].t <= a163[0].t, `dt57=${a57[0]?.dt} t163-t57=${(a163[0]?.t ?? 0) - (a57[0]?.t ?? 0)}ms`)
    check(`3-DB: 주제 1·상황 1(체크한 것)·연결 1(→새 주제)·체크 해제 상황 없음 [${tag}]`, topicRows.length === 1 && scRows.length === 1 && scRows[0].title === '병원에서 증상 말하고 진료받기' && scRows[0].topics.length === 1 && scRows[0].topics[0].topicId === topicRows[0].id, `topics=${topicRows.length} sc=${scRows.map((s) => s.title)} links=${scRows[0]?.topics?.length}`)
    const toast = await page.evaluate(() => [...document.querySelectorAll('[role=status],[role=alert]')].map((e) => (e.textContent ?? '').trim()).filter(Boolean))
    const st = await mainScrollTop(page)
    const act = await activeInfo(page)
    check(`3-도착: 주제 보기(/topics/<id>)·main.scrollTop=0(${st})·머리 제목 초점·토스트 「주제를 저장했어요 · 상황 1개도 저장했어요」 [${tag}]`, st === 0 && /^H[12]$/.test(act?.tag ?? '') && toast.some((x) => x.includes('주제를 저장했어요 · 상황 1개도 저장했어요')), `active=${j(act)} toast=${j(toast)}`)
    const backStates = rec.filter((x) => x.startsWith('true|') || x.startsWith('false|') || /gone/.test(x))
    note(`3-저장 중 기록(back aria-disabled|저장 글자): ${j(rec)}`)
    check(`3-저장 중 ← 비활성(aria-disabled=true 또는 disabled)·「주제를 저장하고 있어요…」/「상황 1/1 저장 중…」 글자 [${tag}]`, rec.some((x) => /^true\|/.test(x) && /저장하고 있어요|저장 중/.test(x)), j(rec))
  } catch (e) {
    check(`3-스크립트 오류(3-2) [${tag}]`, false, String(e).slice(0, 400))
    try { await o2?.page.screenshot({ path: `${SSDIR}/item3a-2-err-${w}.png` }) } catch {}
  } finally {
    await o2?.ctx.close()
    const cl = await cleanupQa(u4.id)
    note(`정리 [${tag}]: ${j(cl)}`)
  }
}
const h1 = await seedHash()
check('3a-시드 해시 불변·QA4 행 0', j(h1) === j(h0) && Object.values(await qaRowCounts(u4.id)).every((n) => n === 0), `sha ${h0.sha}→${h1.sha}`)
await closeBrowser(browser)
summary('항목 3a (LLM 0)')
await prisma.$disconnect()
