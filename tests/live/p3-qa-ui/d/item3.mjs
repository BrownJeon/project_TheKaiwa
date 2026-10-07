/**
 * qa-045-ui-d 항목 3 — 수준 바꿈 표현 다시 받기(D4-A). #170 은 page.route 모의(LLM 호출 0). 요청 수·잠금·그만두기 800ms·도착·저장·실패 4종·M-2.
 * 실행: cd $HOME/.node-local/thekaiwa-qa045ui-d && QA_COOKIE=<c1 쿠키> node --env-file=.env <이 파일>
 */
import {
  applyEdit, backBtn, check, cleanupQa, closeBrowser, cookieOf, doubleTapEl, editorInputs, ids, launch, menuAction, mkTopic10, nonGet, note, openEdit, openPage, prisma, qaRowCounts, qaUser, QA1,
  readChunks, readTopic, saveBtn, seedHash, sleep, summary, tapEl, viewPath, WIDTHS,
} from './h.mjs'

const cookie = cookieOf(process.env.QA_COOKIE)
const u = await qaUser(QA1)
const seed0 = await seedHash()
const SENT = '서버메시지-표식-XYZ'
const DRAFTS = '**/api/v1/topics/drafts'
const browser = await launch()
const bodyText = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
const draftReqs = (reqs) => reqs.filter((r) => r.p === '/api/v1/topics/drafts')

const KJ = ['表現', '言葉', '文', '話', '人', '本', '道', '店', '朝', '夜', '春', '秋']
const KN = ['ひょうげん', 'ことば', 'ぶん', 'はなし', 'ひと', 'ほん', 'みち', 'みせ', 'あさ', 'よる', 'はる', 'あき']
const HG = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타']
const newChunks = (n) => Array.from({ length: n }, (_, i) => ({ chunkType: ['NAME', 'ACTION', 'FEELING', 'MODIFIER'][i % 4], textJa: `新しい${KJ[i]}`, reading: `あたらしい${KN[i]}`, meaningKo: `새 표현 ${HG[i]}` }))
const writes = (reqs, from = 0) => nonGet(reqs, from).filter((r) => r.p !== '/api/v1/topics/drafts')
const okBody = (title, level, desc) => JSON.stringify({ success: true, data: { draft: { title, titleJa: '自己紹介', level, description: desc, chunks: newChunks(12) }, warnings: [] } })
const errBody = (code, details) => JSON.stringify({ success: false, data: { code, details }, message: SENT })

/** 수준 칩 누르기(수준 라디오 그룹 안). */
const chip = (page, lv) => page.getByRole('radiogroup', { name: '수준' }).getByRole('radio', { name: lv, exact: true })
const statusBox = (page) => page.locator('[role=status]').filter({ hasText: '표현 다시 받기' })
/** 상자의 어느 겹이 보이는지(ask|busy|fail) + 보이는 겹 안 버튼 목록. */
const layerInfo = (page) =>
  page.evaluate(() => {
    const box = [...document.querySelectorAll('[role=status]')].find((e) => (e.textContent ?? '').includes('표현 다시 받기'))
    if (!box) return null
    const layers = [...box.children]
    const vis = layers.map((l) => getComputedStyle(l).visibility !== 'hidden')
    const idx = vis.indexOf(true)
    const L = layers[idx]
    return {
      layer: ['ask', 'busy', 'fail'][idx] ?? null,
      text: (L?.innerText ?? '').replace(/\s+/g, ' ').trim(),
      buttons: [...(L?.querySelectorAll('button') ?? [])].map((b) => ({ t: (b.textContent ?? '').trim(), h: Math.round(b.getBoundingClientRect().height), dis: b.getAttribute('aria-disabled') })),
      boxH: Math.round(box.getBoundingClientRect().height),
    }
  })
const lockState = (page) =>
  page.evaluate(() => ({
    titleRO: document.querySelector('#tp-title')?.hasAttribute('readonly'),
    titleJaRO: document.querySelector('#tp-titleJa')?.hasAttribute('readonly'),
    descRO: document.querySelector('#tp-description')?.hasAttribute('readonly'),
    menuDisabled: [...document.querySelectorAll('li button[aria-haspopup=dialog]')].map((b) => b.getAttribute('aria-disabled')),
    addDisabled: [...document.querySelectorAll('button')].find((b) => /표현 더하기/.test(b.textContent ?? ''))?.getAttribute('aria-disabled'),
    saveDisabled: [...document.querySelectorAll('button')].find((b) => /^저장$|저장하고 있어요/.test((b.textContent ?? '').trim()))?.getAttribute('aria-disabled'),
  }))
const chunkRows = (page) => page.locator('section[aria-labelledby=tp-chunks-h] li').count()
const levelOn = (page) => page.getByRole('radiogroup', { name: '수준' }).locator('[aria-checked=true]').innerText()

for (const [w, h] of WIDTHS) {
  const tag = `[${w}]`
  await cleanupQa(u.id)
  const pages = []
  try {
    // ═══ F1: 본선 — 묻기 → 받는 중 잠금 → 그만두기 800ms → 더블탭 1건 → 도착 → 저장 전 서버 쓰기 0 → 저장 → DB
    const f1 = await mkTopic10(cookie, `QA 재생성 ${w}`, 'N5')
    const base = await readChunks(f1.id)
    const topic0 = await readTopic(f1.id)
    const P = await openPage(browser, w, h, cookie)
    pages.push(P)
    const { page, reqs } = P
    let mode = 'ok' // ok → 3초 지연 후 새 표현 12개
    await page.route(DRAFTS, async (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}')
      await sleep(3000)
      try {
        await route.fulfill({ status: 200, contentType: 'application/json', body: okBody(body.title, body.level, '재생성된 설명(쓰이지 않아야 함)') })
      } catch {}
    })
    await openEdit(page, f1.id)
    await tapEl(page, chip(page, 'N4'))
    await sleep(250)
    const ask = await layerInfo(page)
    check(`${tag} F1 수준 칩 N4 → role=status 상자(묻기): 「수준을 바꿨어요 (N5 → N4)…」+[표현 다시 받기][지금 표현 두기]`, ask?.layer === 'ask' && /수준을 바꿨어요 \(N5 → N4\)\. 기본 표현도 새 수준에 맞게 다시 받을까요\?/.test(ask.text) && /받은 표현은 저장해야 바뀌어요/.test(ask.text) && ask.buttons.map((b) => b.t).join('|') === '표현 다시 받기|지금 표현 두기', JSON.stringify(ask)?.slice(0, 220))
    check(`${tag} F1 묻기 버튼 높이 ≥44px`, ask.buttons.every((b) => b.h >= 44), JSON.stringify(ask.buttons.map((b) => b.h)))
    const boxH = ask.boxH
    const r0 = reqs.length
    await tapEl(page, page.getByRole('button', { name: '표현 다시 받기', exact: true }))
    await sleep(300)
    const busy1 = await layerInfo(page)
    const lock = await lockState(page)
    check(`${tag} F1 받는 중: 상자 겹=busy·「선생님이 새 수준에 맞는 표현을 만들고 있어요」·[그만두기]만`, busy1?.layer === 'busy' && /선생님이 새 수준에 맞는 표현을 만들고 있어요/.test(busy1.text) && busy1.buttons.length === 1 && busy1.buttons[0].t === '그만두기', JSON.stringify(busy1)?.slice(0, 200))
    check(`${tag} F1 받는 중 상자 높이 불변(묻기 ${boxH} → ${busy1?.boxH})`, busy1?.boxH === boxH)
    check(`${tag} F1 받는 중 잠금: 이름·일본어 이름·설명 readonly·표현 ⋯ 전부 aria-disabled·[＋ 표현 더하기] aria-disabled·[저장] aria-disabled`, lock.titleRO && lock.titleJaRO && lock.descRO && lock.menuDisabled.length === 10 && lock.menuDisabled.every((x) => x === 'true') && lock.addDisabled === 'true' && lock.saveDisabled === 'true', JSON.stringify(lock))
    await tapEl(page, chip(page, 'N3'))
    await sleep(150)
    check(`${tag} F1 받는 중 수준 칩 누름 무시(N4 유지)`, (await levelOn(page)) === 'N4', await levelOn(page))
    check(`${tag} F1 시작 300ms 시점: [그만두기] aria-disabled(800ms 잠금)`, busy1.buttons[0].dis === 'true', String(busy1.buttons[0].dis))
    await tapEl(page, page.getByRole('button', { name: '그만두기', exact: true }))
    await sleep(250)
    check(`${tag} F1 800ms 안 [그만두기] 무시 → 아직 받는 중·요청 끊기지 않음`, (await layerInfo(page))?.layer === 'busy' && draftReqs(reqs.slice(r0)).length === 1 && draftReqs(reqs.slice(r0))[0].status !== 'FAILED', `status=${draftReqs(reqs.slice(r0))[0]?.status}`)
    await sleep(700)
    const lateCancel = (await layerInfo(page))?.buttons[0]
    check(`${tag} F1 800ms 뒤 [그만두기] aria-disabled 해제`, lateCancel?.dis === null, String(lateCancel?.dis))
    await tapEl(page, page.getByRole('button', { name: '그만두기', exact: true }))
    await sleep(500)
    const after = await layerInfo(page)
    const dr1 = draftReqs(reqs.slice(r0))
    check(`${tag} F1 [그만두기] → 요청 끊김(FAILED)·묻기로 복귀·표현·이름·수준 그대로`, dr1[0].status === 'FAILED' && after?.layer === 'ask' && (await chunkRows(page)) === 10 && (await page.locator('#tp-title').inputValue()) === `QA 재생성 ${w}` && (await levelOn(page)) === 'N4', `status=${dr1[0].status} layer=${after?.layer} rows=${await chunkRows(page)}`)
    const r1 = reqs.length
    await doubleTapEl(page, page.getByRole('button', { name: '표현 다시 받기', exact: true }))
    await sleep(500)
    check(`${tag} F1 더블탭 → #170 요청 정확히 1건`, draftReqs(reqs.slice(r1)).length === 1, `n=${draftReqs(reqs.slice(r1)).length}`)
    const body170 = JSON.parse(draftReqs(reqs.slice(r1))[0]?.body ?? '{}')
    check(`${tag} F1 요청 본문 = {title: 지금 이름, level: N4}`, JSON.stringify(Object.keys(body170).sort()) === '["level","title"]' && body170.level === 'N4' && body170.title === `QA 재생성 ${w}`, JSON.stringify(body170))
    await sleep(3500)
    // 도착
    const rowsNow = await chunkRows(page)
    const firstText = await page.locator('section[aria-labelledby=tp-chunks-h] li p[lang=ja]').first().innerText()
    check(`${tag} F1 도착 → 표현 목록만 새 표현 12개로 교체`, rowsNow === 12 && /新しい表現/.test(await bodyText(page)) && /新しい言葉/.test(await bodyText(page)), `rows=${rowsNow} first=${firstText}`)
    check(`${tag} F1 도착 → 이름·설명 그대로(모의 응답의 설명 안 씀)·수준 N4·상자 사라짐`, (await page.locator('#tp-title').inputValue()) === `QA 재생성 ${w}` && (await page.locator('#tp-description').inputValue()) === 'QA 주제 고치기 시험용' && (await levelOn(page)) === 'N4' && (await statusBox(page).count()) === 0)
    const foc = await page.evaluate(() => ({ role: document.activeElement?.getAttribute('role'), checked: document.activeElement?.getAttribute('aria-checked'), t: (document.activeElement?.textContent ?? '').trim() }))
    check(`${tag} F1 도착 뒤 초점 = 고른 수준 칩`, foc.role === 'radio' && foc.checked === 'true' && foc.t === 'N4', JSON.stringify(foc))
    const topicMid = await readTopic(f1.id)
    const midChunks = await readChunks(f1.id)
    check(`${tag} F1 저장 전 서버 쓰기 0(PATCH/POST 0)·DB 불변(수준 N5·옛 표현 10개 id 동일)`, writes(reqs, r0).length === 0 && topicMid.level === 'N5' && JSON.stringify(ids(midChunks)) === JSON.stringify(ids(base)) && topicMid.updatedAt.getTime() === topic0.updatedAt.getTime(), `nonGet=${writes(reqs, r0).length}`)
    const s0 = reqs.length
    await tapEl(page, saveBtn(page))
    await page.waitForURL((x) => x.pathname === viewPath(f1.id), { timeout: 15000 })
    await sleep(500)
    const pt = writes(reqs, s0)
    const pb = pt[0] ? JSON.parse(pt[0].body ?? '{}') : {}
    check(`${tag} F1 저장 → PATCH 1건(키 level·chunks)·chunks 12개·옛 id 하나도 없음(id 키 없음)`, pt.length === 1 && pt[0].m === 'PATCH' && JSON.stringify(Object.keys(pb).sort()) === '["chunks","level"]' && pb.chunks.length === 12 && pb.chunks.every((c) => !('id' in c)) && pb.level === 'N4', `n=${pt.length} keys=${Object.keys(pb)}`)
    const end = await readChunks(f1.id)
    const endTopic = await readTopic(f1.id)
    check(`${tag} F1 DB: 옛 표현 10개 전부 삭제·새 12행·수준 N4`, end.length === 12 && !end.some((c) => ids(base).includes(c.id)) && endTopic.level === 'N4' && end.every((c) => /^新しい/.test(c.textJa)), `rows=${end.length} level=${endTopic.level}`)
    await P.ctx.close()
    await prisma.conversationTopic.deleteMany({ where: { id: f1.id, userId: u.id } })

    // ═══ F2: 실패 시뮬(502·422·409 DRAFT_BUSY·429 retryAfterSec 3600)
    const f2 = await mkTopic10(cookie, `QA 재생성실패 ${w}`, 'N5')
    const Q = await openPage(browser, w, h, cookie)
    pages.push(Q)
    const sims = [
      { lv: 'N4', name: '502', status: 502, body: errBody('INTERNAL', {}), block: false },
      { lv: 'N4', name: '422 NOT_A_TOPIC', status: 422, body: errBody('UNPROCESSABLE', { reason: 'NOT_A_TOPIC' }), block: false },
      { lv: 'N4', name: '409 DRAFT_BUSY', status: 409, body: errBody('CONFLICT', { reason: 'DRAFT_BUSY' }), block: false },
      { lv: 'N4', name: '429 retryAfterSec 3600', status: 429, body: errBody('RATE_LIMITED', { reason: 'DAILY_LIMIT', retryAfterSec: 3600 }), block: true },
    ]
    let cur = sims[0]
    await Q.page.route(DRAFTS, (route) => route.fulfill({ status: cur.status, contentType: 'application/json', body: cur.body }))
    await openEdit(Q.page, f2.id)
    for (const s of sims) {
      cur = s
      if (s === sims[0]) {
        await tapEl(Q.page, chip(Q.page, s.lv))
        await sleep(200)
      }
      await tapEl(Q.page, Q.page.getByRole('button', { name: '표현 다시 받기', exact: true }))
      await sleep(600)
      const f = await layerInfo(Q.page)
      const t = await bodyText(Q.page)
      note(`${tag} F2 ${s.name} → 상자 겹=${f?.layer} 글=「${f?.text}」 버튼=${JSON.stringify(f?.buttons)}`)
      check(`${tag} F2 ${s.name}: 상자 안 오류 고정 문구(겹=fail)·[다시 받기]/[지금 표현 두기]·서버 message 표식 노출 0`, f?.layer === 'fail' && /표현을 받지 못했어요\. 지금 표현은 그대로 있어요\./.test(f.text) && f.buttons.map((b) => b.t).join('|') === '표현 다시 받기|지금 표현 두기' && !t.includes(SENT), f?.text?.slice(0, 120))
      check(`${tag} F2 ${s.name}: 버튼 ≥44px·표현 10개 그대로`, f.buttons.every((b) => b.h >= 44) && (await chunkRows(Q.page)) === 10, JSON.stringify(f.buttons.map((b) => b.h)))
      if (s.block) check(`${tag} F2 429 하루 한도: 시간 안내(약 1시간 뒤)·[표현 다시 받기] aria-disabled`, /약 1시간 뒤/.test(f.text) && f.buttons[0].dis === 'true', `dis=${f.buttons[0].dis}`)
      if (s.status === 409) check(`${tag} F2 409 DRAFT_BUSY 전용 안내 「다른 화면에서 주제 초안을 만드는 중이에요」`, /다른 화면에서 주제 초안을 만드는 중이에요/.test(f.text))
      if (s.status === 422) check(`${tag} F2 422 전용 안내 「이 글로는 주제를 만들기 어려워요」`, /이 글로는 주제를 만들기 어려워요/.test(f.text))
    }
    check(`${tag} F2 실패 4종 동안 서버 쓰기 0·DB 불변`, writes(Q.reqs).length === 0 && (await readChunks(f2.id)).length === 10 && (await readTopic(f2.id)).level === 'N5')
    await Q.ctx.close()
    await prisma.conversationTopic.deleteMany({ where: { id: f2.id, userId: u.id } })

    // ═══ F3: 열어 둔 [＋ 표현 더하기] 편집기가 있는 채 도착(M-2) — [바꾸기] 는 덮어쓰기가 아니라 추가
    const f3 = await mkTopic10(cookie, `QA 재생성추가 ${w}`, 'N5')
    const R = await openPage(browser, w, h, cookie)
    pages.push(R)
    await R.page.route(DRAFTS, async (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}')
      await sleep(1800)
      try {
        await route.fulfill({ status: 200, contentType: 'application/json', body: okBody(body.title, body.level, 'x') })
      } catch {}
    })
    await openEdit(R.page, f3.id)
    await R.page.getByRole('button', { name: '＋ 표현 더하기', exact: true }).tap()
    await sleep(250)
    const addBox = R.page.locator('section[aria-labelledby=tp-chunks-h] > div.rounded-xl')
    const ai = addBox.locator('input[type=text]')
    await ai.nth(0).fill('追加表現')
    await ai.nth(1).fill('ついかひょうげん')
    await ai.nth(2).fill('추가 표현')
    await tapEl(R.page, chip(R.page, 'N4'))
    await sleep(200)
    await tapEl(R.page, R.page.getByRole('button', { name: '표현 다시 받기', exact: true }))
    await sleep(300)
    await addBox.getByRole('button', { name: '바꾸기', exact: true }).tap({ force: true }).catch(() => {})
    await sleep(300)
    check(`${tag} F3 받는 중 열어 둔 편집기의 [바꾸기] 눌러도 표현 목록 안 바뀜(여전히 10개)`, (await chunkRows(R.page)) === 10, `rows=${await chunkRows(R.page)}`)
    await sleep(2200)
    check(`${tag} F3 도착 → 표현 12개로 교체·열어 둔 편집기 입력값 유지`, (await chunkRows(R.page)) === 12 && (await ai.nth(0).inputValue()) === '追加表現', `rows=${await chunkRows(R.page)}`)
    await addBox.getByRole('button', { name: '바꾸기', exact: true }).tap()
    await sleep(300)
    check(`${tag} F3 도착 뒤 [바꾸기] → 덮어쓰기 아닌 추가(표현 12 → 13개)`, (await chunkRows(R.page)) === 13 && /追加表現/.test(await bodyText(R.page)) && /新しい表現/.test(await bodyText(R.page)), `rows=${await chunkRows(R.page)}`)
    await R.ctx.close()
    await prisma.conversationTopic.deleteMany({ where: { id: f3.id, userId: u.id } })

    // ═══ F4: 받는 중 ← 허용(나가면 요청 중단) — 서버 변화 0
    const f4 = await mkTopic10(cookie, `QA 재생성나가기 ${w}`, 'N5')
    const S4 = await openPage(browser, w, h, cookie)
    pages.push(S4)
    await S4.page.route(DRAFTS, async (route) => {
      await sleep(4000)
      try {
        await route.fulfill({ status: 200, contentType: 'application/json', body: okBody('x', 'N4', 'x') })
      } catch {}
    })
    await openEdit(S4.page, f4.id)
    await tapEl(S4.page, chip(S4.page, 'N4'))
    await sleep(200)
    await tapEl(S4.page, S4.page.getByRole('button', { name: '표현 다시 받기', exact: true }))
    await sleep(400)
    await tapEl(S4.page, backBtn(S4.page))
    await S4.page.getByRole('dialog').waitFor({ state: 'visible', timeout: 5000 })
    await S4.page.getByRole('dialog').getByRole('button', { name: '나가기', exact: true }).tap()
    await S4.page.waitForURL((x) => x.pathname === viewPath(f4.id), { timeout: 10000 })
    await sleep(500)
    const d4 = draftReqs(S4.reqs)
    check(`${tag} F4 받는 중 ← 허용(시트→나가기) → S6·#170 요청 중단(FAILED)·서버 쓰기 0·DB 불변`, d4.length === 1 && d4[0].status === 'FAILED' && writes(S4.reqs).length === 0 && (await readTopic(f4.id)).level === 'N5' && (await readChunks(f4.id)).length === 10, `status=${d4[0]?.status}`)
    await S4.ctx.close()
    await prisma.conversationTopic.deleteMany({ where: { id: f4.id, userId: u.id } })
  } catch (e) {
    check(`${tag} 시나리오 예외 없음`, false, String(e).slice(0, 300))
  } finally {
    for (const p of pages) {
      check(`${tag} 페이지 오류 0`, p.errors.length === 0, p.errors.join(' / ').slice(0, 200))
      await p.ctx.close().catch(() => {})
    }
    note(`${tag} 정리 ${JSON.stringify(await cleanupQa(u.id))}`)
  }
}

await closeBrowser(browser)
const seed1 = await seedHash()
check('시드 해시 불변', seed1.sha === seed0.sha && seed1.sha === 'e826f3ef09237a9c', `${seed0.sha} → ${seed1.sha}`)
const left = await qaRowCounts(u.id)
check('QA1 task-045 행 0(정리)', left.topics + left.overrides + left.scenarios + left.challenges === 0, JSON.stringify(left))
summary('item3')
await prisma.$disconnect()
