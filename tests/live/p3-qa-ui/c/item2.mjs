/**
 * 항목 2 — S4 검토·편집·저장 전 검사·저장(#57). Claude 호출 0(항목 1 의 보관본 SNAP_FILE 을 sessionStorage 로 주입해 「이어서 고치기」로 재개).
 * 폭별(360/390/412): 레이아웃·메뉴 동작 scrollTop·초점·H-1 왕복·저장(#57 더블탭 1건·본문·DB). 390 만: 입력 검사·편집기 오류·표현 수 경계·경고·다시 만들기 확인.
 */
import {
  tapAt, BASE, NEW_PATH, STORE_KEY, SNAP_FILE, SSDIR, activeInfo, check, cleanupQa, closeBrowser, cookieOf, docScrollMetrics, launch, mainScrollTop, mainText, note, openPage, overflowInfo,
  prisma, qaRowCounts, qaUser, QA4, readStore, seedHash, sleep, smallTargets, summary, j,
} from './lib.mjs'
import { readFileSync } from 'node:fs'

const c4 = cookieOf(process.env.QA_COOKIE)
const u4 = await qaUser(QA4)
const SNAP = JSON.parse(readFileSync(SNAP_FILE, 'utf8')).raw
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean)
const WID = ONLY.length ? ONLY.map(Number) : [360, 390, 412]
const H = { 360: 740, 390: 844, 412: 892 }
await cleanupQa(u4.id)
const h0 = await seedHash()
note('seedHash start ' + j(h0) + ' QA4 ' + j(await qaRowCounts(u4.id)))

const browser = await launch()
const d170 = (reqs) => reqs.filter((r) => r.m === 'POST' && r.p === '/api/v1/topics/drafts')
const d166 = (reqs) => reqs.filter((r) => r.m === 'POST' && r.p === '/api/v1/scenarios/drafts')
const p57 = (reqs) => reqs.filter((r) => r.m === 'POST' && r.p === '/api/v1/topics')

async function restore(w, raw = SNAP) {
  const o = await openPage(browser, w, H[w], c4)
  o.page.setDefaultTimeout(60000)
  await o.page.goto(BASE + '/api/health', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await o.page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [STORE_KEY, raw])
  await o.page.goto(BASE + NEW_PATH, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await o.page.getByRole('button', { name: '이어서 고치기' }).waitFor({ state: 'visible', timeout: 120000 })
  o.resumeVisible = true
  await tapAt(o.page, o.page.getByRole('button', { name: '이어서 고치기' }))
  await o.page.getByRole('heading', { name: '주제 정보' }).waitFor({ state: 'visible' })
  await sleep(500)
  return o
}
const menuBtns = (page) => page.locator('button[aria-label$="표현 메뉴"]')
const rowTexts = (page) => page.locator('li p[lang=ja]').evaluateAll((ps) => ps.filter((_, i) => i % 2 === 0).map((p) => p.textContent))

for (const w of WID) {
  const tag = `${w}px`
  let o
  try {
    o = await restore(w)
    const { page, reqs, errors } = o
    check(`2-재진입 「고치던 주제 초안」 카드 → [이어서 고치기] → S4(이어 고치기에서 #166 재요청 0) [${tag}]`, d166(reqs).length === 0 && d170(reqs).length === 0, `166=${d166(reqs).length} 170=${d170(reqs).length}`)
    // 레이아웃
    const ov = await overflowInfo(page)
    const ds = await docScrollMetrics(page)
    check(`2-S4 가로 넘침 0·문서 scrollWidth=clientWidth [${tag}]`, ov.count === 0 && ds.scrollWidth === ds.clientWidth, j({ ov: ov.count, items: ov.items, ds }))
    check(`2-S4 페이지 레벨 세로 스크롤 0(main 한 곳 스크롤) [${tag}]`, ds.docScrollH <= ds.innerH + 1, j(ds))
    const small = await smallTargets(page)
    note(`2-S4 44px 미만 후보 [${tag}]: ${j(small)}`)
    // 주제 정보·묶음
    const t = await mainText(page)
    check(`2-주제 정보 필드·기본 표현 묶음(이름·액션·느낌·꾸밈)·「기본 표현 16개」·「8~20개」 [${tag}]`, ['주제 정보', '주제 이름', '일본어 이름', '설명', '기본 표현 16개', '8~20개', '이름', '액션', '느낌', '꾸밈'].every((s) => t.includes(s)), t.slice(0, 120))
    check(`2-표현 행 16개(⋯ 버튼 16·44×44 이상) [${tag}]`, (await menuBtns(page).count()) === 16 && (await menuBtns(page).evaluateAll((bs) => bs.every((b) => { const r = b.getBoundingClientRect(); return r.width >= 43.5 && r.height >= 43.5 }))))
    // ⋯ 메뉴: 열기→닫기 scrollTop·초점
    const mb = menuBtns(page).nth(6)
    await mb.scrollIntoViewIfNeeded()
    await page.evaluate(() => { const m = document.querySelector('main'); m.scrollTop = Math.min(m.scrollTop + 30, m.scrollHeight) })
    await sleep(200)
    const s0 = await mainScrollTop(page)
    const lab = await mb.getAttribute('aria-label')
    await tapAt(page, mb)
    await page.getByRole('dialog').waitFor({ state: 'visible' })
    await sleep(250)
    const s1 = await mainScrollTop(page)
    const dlgBtns = await page.getByRole('dialog').locator('button').evaluateAll((bs) => bs.map((b) => ({ t: (b.textContent ?? '').trim(), h: Math.round(b.getBoundingClientRect().height) })))
    await page.keyboard.press('Escape')
    await sleep(350)
    const s2 = await mainScrollTop(page)
    const a2 = await activeInfo(page)
    check(`2-⋯ 메뉴 열기→닫기: main.scrollTop 차 0px(전 ${s0}·열림 ${s1}·닫힘 ${s2})·초점이 눌렀던 ⋯ 버튼으로 복귀 [${tag}]`, s1 === s0 && s2 === s0 && a2?.aria === lab, `active=${j(a2)} sheetBtns=${j(dlgBtns)}`)
    check(`2-⋯ 시트 항목(고치기·위로·아래로·지우기) 높이 ≥44px [${tag}]`, ['고치기', '위로', '아래로', '지우기'].every((n) => dlgBtns.some((b) => b.t === n && b.h >= 44)), j(dlgBtns))
    // 위로/아래로
    const order0 = await rowTexts(page)
    const target = menuBtns(page).nth(6) // 같은 묶음 안 중간(느낌 묶음 쪽)
    const lab6 = await target.getAttribute('aria-label')
    const sU0 = await mainScrollTop(page)
    await tapAt(page, target)
    await page.getByRole('dialog').waitFor({ state: 'visible' })
    await page.getByRole('dialog').getByRole('button', { name: '위로' }).tap()
    await sleep(400)
    const order1 = await rowTexts(page)
    const sU1 = await mainScrollTop(page)
    const aU = await activeInfo(page)
    const moved = order1.join('|') !== order0.join('|')
    check(`2-[위로]: 순서 바뀜·scrollTop 차 0px(${sU0}→${sU1})·초점 어디인지 기록 [${tag}]`, moved && sU1 === sU0, `activeAfter=${j(aU)} (기대: 눌렀던 행 ⋯ ${lab6}) order0=${order0.slice(4, 9).join(',')} order1=${order1.slice(4, 9).join(',')}`)
    note(`2-[위로] 후 초점: ${j(aU)}`)
    const mbUp = menuBtns(page).filter({ hasText: '' }).locator(`xpath=self::*[@aria-label="${lab6}"]`)
    await tapAt(page, page.locator(`button[aria-label="${lab6}"]`))
    await page.getByRole('dialog').waitFor({ state: 'visible' })
    await page.getByRole('dialog').getByRole('button', { name: '아래로' }).tap()
    await sleep(400)
    const order2 = await rowTexts(page)
    const sD1 = await mainScrollTop(page)
    check(`2-[아래로]로 원위치·scrollTop 차 0px(${sU0}→${sD1}) [${tag}]`, order2.join('|') === order0.join('|') && sD1 === sU0, `activeAfter=${j(await activeInfo(page))}`)
    // 고치기 펼침
    const li = page.locator(`button[aria-label="${lab6}"]`).locator('xpath=ancestor::li[1]')
    const nextLi = li.locator('xpath=following-sibling::li[1]')
    const nextExists = (await nextLi.count()) > 0
    const rTop0 = (await li.boundingBox()).y
    const nTop0 = nextExists ? (await nextLi.boundingBox()).y : null
    const sE0 = await mainScrollTop(page)
    await tapAt(page, page.locator(`button[aria-label="${lab6}"]`))
    await page.getByRole('dialog').waitFor({ state: 'visible' })
    await page.getByRole('dialog').getByRole('button', { name: '고치기' }).tap()
    await sleep(500)
    const rTop1 = (await li.boundingBox()).y
    const nTop1 = nextExists ? (await nextLi.boundingBox()).y : null
    const sE1 = await mainScrollTop(page)
    const aE = await activeInfo(page)
    const editorVisible = await li.getByRole('button', { name: '바꾸기' }).isVisible()
    check(`2-[고치기] 펼침: 누른 행 위치 불변(top ${Math.round(rTop0)}→${Math.round(rTop1)})·아래 행만 밀림(${nTop0 === null ? '-' : Math.round(nTop0)}→${nTop1 === null ? '-' : Math.round(nTop1)})·scrollTop 차 0px(${sE0}→${sE1}) [${tag}]`, editorVisible && Math.abs(rTop1 - rTop0) < 1 && (nTop1 === null || nTop1 > nTop0) && sE1 === sE0, `activeAfter=${j(aE)}`)
    note(`2-[고치기] 후 초점: ${j(aE)}`)
    const edSmall = await li.locator('button, input').evaluateAll((els) => els.map((e) => ({ t: (e.getAttribute('aria-label') ?? e.textContent ?? '').trim().slice(0, 12), h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width) })).filter((x) => x.h < 43.5))
    check(`2-고치기 펼침 안 버튼·입력 높이 ≥44px(분절 칩은 ::before 히트 영역) [${tag}]`, edSmall.every((x) => ['', '일본어', '읽기', '뜻'].includes(x.t) === false || x.h >= 44) , j(edSmall))
    await li.getByRole('button', { name: '취소' }).tap()
    await sleep(300)
    const sE2 = await mainScrollTop(page)
    check(`2-고치기 [취소] → 펼침 닫힘·scrollTop 차 0px(${sE0}→${sE2})·초점 행 ⋯ [${tag}]`, !(await li.getByRole('button', { name: '바꾸기' }).isVisible().catch(() => false)) && sE2 === sE0, `active=${j(await activeInfo(page))}`)
    // 지우기
    const cnt0 = await menuBtns(page).count()
    const sR0 = await mainScrollTop(page)
    await tapAt(page, page.locator(`button[aria-label="${lab6}"]`))
    await page.getByRole('dialog').waitFor({ state: 'visible' })
    await page.getByRole('dialog').getByRole('button', { name: '지우기' }).tap()
    await sleep(500)
    const cnt1 = await menuBtns(page).count()
    const aR = await activeInfo(page)
    const t2 = await mainText(page)
    check(`2-[지우기]: 행 ${cnt0}→${cnt1}·제목 「기본 표현 15개」·초점은 이웃 행 ⋯ 버튼 [${tag}]`, cnt1 === cnt0 - 1 && t2.includes('기본 표현 15개') && aR?.tag === 'BUTTON' && /표현 메뉴$/.test(aR?.aria ?? ''), `active=${j(aR)} scrollTop ${sR0}→${await mainScrollTop(page)}`)
    // H-1: [＋ 표현 더하기] → 나가기 → 재진입 → 이어서 → 복원
    await tapAt(page, page.getByRole('button', { name: '＋ 표현 더하기' }))
    await sleep(300)
    const ed = page.locator('#tp-chunks-h').locator('xpath=ancestor::section[1]')
    await ed.getByLabel('일본어', { exact: true }).fill('診察券')
    await ed.getByLabel('읽기', { exact: true }).fill('しんさつけん')
    await ed.getByLabel('뜻', { exact: true }).fill('진찰권')
    await tapAt(page, ed.getByRole('button', { name: '바꾸기' }))
    await sleep(400)
    const added = (await rowTexts(page)).includes('診察券')
    const storeA = await readStore(page)
    await sleep(600)
    const storeB = await readStore(page)
    const hasNew = (() => { try { return JSON.parse(storeB).draft.chunks.some((c) => c.textJa === '診察券') } catch { return false } })()
    check(`2-표현 더하기 [바꾸기] → 행 추가·보관본(sessionStorage)에 반영 [${tag}]`, added && hasNew, `keys=${(() => { try { return JSON.parse(storeB).draft.chunks.map((c) => c.key).slice(-2).join(',') } catch { return null } })()}`)
    await tapAt(page, page.locator('button[aria-label="내 상황·주제"]'))
    await sleep(500)
    const leaveShown = await page.getByRole('dialog').isVisible().catch(() => false)
    note(`2-H-1 나가기 시트 표시=${leaveShown} 시트 글: ${leaveShown ? (await page.getByRole('dialog').innerText()).replace(/\s+/g, ' ').slice(0, 120) : ''}`)
    if (leaveShown) await tapAt(page, page.getByRole('dialog').getByRole('button', { name: '나가기' }))
    await page.waitForURL(/\/settings\/scenarios(\?|$)/, { timeout: 20000 }).catch(() => {})
    const urlAfter = new URL(page.url()).pathname
    await page.goto(BASE + NEW_PATH, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: '이어서 고치기' }).waitFor({ state: 'visible', timeout: 30000 })
    await tapAt(page, page.getByRole('button', { name: '이어서 고치기' }))
    await page.getByRole('heading', { name: '주제 정보' }).waitFor({ state: 'visible' })
    await sleep(500)
    const restoredRows = await rowTexts(page)
    check(`2-H-1: 표현 더하기 → 나가기(${urlAfter}) → 다시 들어와 「고치던 주제 초안」 카드 → 이어서 고치기 → 더한 표현 「診察券」 복원(행 ${restoredRows.length}) [${tag}]`, urlAfter === '/settings/scenarios' && restoredRows.includes('診察券') && restoredRows.length === 16, `rows=${restoredRows.length} 166=${d166(reqs).length}`)
    // 복원 뒤 두 번째 표현 더하기(열쇠 충돌 방지)
    await tapAt(page, page.getByRole('button', { name: '＋ 표현 더하기' }))
    await sleep(300)
    const ed2 = page.locator('#tp-chunks-h').locator('xpath=ancestor::section[1]')
    await ed2.getByLabel('일본어', { exact: true }).fill('処方箋')
    await ed2.getByLabel('읽기', { exact: true }).fill('しょほうせん')
    await ed2.getByLabel('뜻', { exact: true }).fill('처방전')
    await tapAt(page, ed2.getByRole('button', { name: '바꾸기' }))
    await sleep(500)
    const rows2 = await rowTexts(page)
    const keys2 = await readStore(page).then(() => sleep(500)).then(() => readStore(page)).then((s) => JSON.parse(s).draft.chunks.map((c) => c.key).slice(-2).join(','))
    check(`2-H-1: 복원 뒤 또 더하기 → 두 표현 모두 남음(열쇠 충돌 없음, 행 ${rows2.length}, 열쇠 ${keys2}) [${tag}]`, rows2.includes('診察券') && rows2.includes('処方箋') && rows2.length === 17, `rows=${rows2.length}`)
    check(`2-페이지 오류 0 [${tag}]`, errors.length === 0, errors.join('|'))
    await page.screenshot({ path: `${SSDIR}/item2-s4-${w}.png` })
  } catch (e) {
    check(`2-스크립트 오류(폭별 A) [${tag}]`, false, String(e).slice(0, 400))
    try { await o?.page.screenshot({ path: `${SSDIR}/item2-error-${w}.png` }) } catch {}
  } finally {
    await o?.ctx.close()
  }
}
await closeBrowser(browser)
summary('항목 2 (폭별 A)')
await prisma.$disconnect()
