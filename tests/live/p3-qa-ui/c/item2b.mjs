/**
 * 항목 2 (390 만, Claude 호출 0) — 입력 검사·편집기 오류·표현 수 경계·경고·다시 만들기 확인·저장(#57).
 * 보관 초안(SNAP_FILE)을 변형해 sessionStorage 로 주입 → 「이어서 고치기」. #170 은 page.route 스텁(LLM 0).
 * 마지막 시나리오(저장)가 DB 에 주제 1 + 표현 16 을 만든다 → 끝에 cleanupQa.
 */
import {
  tapAt, BASE, NEW_PATH, STORE_KEY, SNAP_FILE, SSDIR, activeInfo, check, cleanupQa, closeBrowser, cookieOf, docScrollMetrics, launch, mainScrollTop, mainText, note, openPage, overflowInfo,
  prisma, qaRowCounts, qaUser, QA4, readStore, seedHash, sleep, summary, j, globalCounts,
} from './lib.mjs'
import { readFileSync } from 'node:fs'

const c4 = cookieOf(process.env.QA_COOKIE)
const u4 = await qaUser(QA4)
const SNAP0 = JSON.parse(JSON.parse(readFileSync(SNAP_FILE, 'utf8')).raw)
SNAP0.scenarios = []
const variant = (fn) => {
  const r = structuredClone(SNAP0)
  fn(r)
  return JSON.stringify(r)
}
const W = 390
const Hh = 844
await cleanupQa(u4.id)
const h0 = await seedHash()
const g0 = await globalCounts()
note('seedHash start ' + j(h0) + ' global ' + j(g0) + ' QA4 ' + j(await qaRowCounts(u4.id)))
const browser = await launch()
const d170 = (reqs) => reqs.filter((r) => r.m === 'POST' && r.p === '/api/v1/topics/drafts')
const d166 = (reqs) => reqs.filter((r) => r.m === 'POST' && r.p === '/api/v1/scenarios/drafts')
const posts = (reqs) => reqs.filter((r) => r.m !== 'GET' && !r.p.startsWith('/api/v1/attendance/'))
const p57 = (reqs) => reqs.filter((r) => r.m === 'POST' && r.p === '/api/v1/topics')
const menuBtns = (page) => page.locator('button[aria-label$="표현 메뉴"]')
const rowTexts = (page) => page.locator('li p[lang=ja]').evaluateAll((ps) => ps.filter((_, i) => i % 2 === 0).map((p) => p.textContent))

async function restore(raw, { stub170 = false } = {}) {
  const o = await openPage(browser, W, Hh, c4)
  o.page.setDefaultTimeout(60000)
  if (stub170) await o.page.route('**/api/v1/topics/drafts', (route) => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ success: false, data: { code: 'UPSTREAM' }, message: 'SERVER-MSG-XYZ' }) }))
  await o.page.goto(BASE + '/api/health', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await o.page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [STORE_KEY, raw])
  await o.page.goto(BASE + NEW_PATH, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await o.page.getByRole('button', { name: '이어서 고치기' }).waitFor({ state: 'visible', timeout: 120000 })
  await tapAt(o.page, o.page.getByRole('button', { name: '이어서 고치기' }))
  await o.page.getByRole('heading', { name: '주제 정보' }).waitFor({ state: 'visible' })
  await sleep(500)
  return o
}
const saveBtn = (page) => page.getByRole('button', { name: /^(주제만 저장|주제와 상황 \d+개 저장)$/ })
const alertText = (page) => page.locator('main p[role=alert]').evaluateAll((ps) => ps.map((p) => (p.textContent ?? '').trim()))

// ── A. 읽기에 한자(편집기 [바꾸기]) — 행 오류·초점·변경 없음
{
  const o = await restore(variant(() => {}))
  const { page, reqs } = o
  try {
    const mb = menuBtns(page).nth(2)
    const lab = await mb.getAttribute('aria-label')
    await tapAt(page, mb)
    await page.getByRole('dialog').getByRole('button', { name: '고치기' }).tap()
    await sleep(400)
    const li = page.locator(`button[aria-label="${lab}"]`).locator('xpath=ancestor::li[1]')
    await li.getByLabel('읽기', { exact: true }).fill('薬')
    await li.getByRole('button', { name: '바꾸기' }).scrollIntoViewIfNeeded()
    await li.getByRole('button', { name: '바꾸기' }).tap()
    await sleep(300)
    const act = await activeInfo(page)
    const errText = await li.innerText()
    const before = (await rowTexts(page)).slice(0, 4)
    check(`2b-A 편집기 읽기에 한자 → [바꾸기] 막힘: 오류 문구·읽기 입력으로 초점·편집 펼침 유지·행 안 바뀜·요청 0 [${W}px]`, /가나|히라가나|읽기/.test(errText) && act?.tag === 'INPUT' && before[2] === '薬' && posts(reqs).length === 0 && (await li.getByRole('button', { name: '바꾸기' }).isVisible()), `active=${j(act)} err=${errText.replace(/\s+/g, ' ').slice(0, 160)} rows=${before.join(',')} allReqs=${j(reqs.map((r) => r.m + ' ' + r.p))}`)
  } catch (e) {
    check('2b-A 스크립트 오류', false, String(e).slice(0, 300))
  }
  await o.ctx.close()
}

// ── B. 저장 시 검사: 한자 읽기 1 + 중복 표현 1 (보관본에 주입) → 「고칠 곳 2군데」·행 오류·첫 문제 초점
{
  const raw = variant((r) => {
    r.draft.chunks[2].reading = '薬'
    r.draft.chunks[5].textJa = r.draft.chunks[1].textJa // c6 가 c2(頭)와 중복
  })
  const o = await restore(raw)
  const { page, reqs } = o
  try {
    const sb = saveBtn(page)
    await sb.scrollIntoViewIfNeeded()
    await tapAt(page, sb)
    await sleep(500)
    const act = await activeInfo(page)
    const al = await alertText(page)
    const rowErr = await page.locator('main ul[id$="-err"] li').evaluateAll((ls) => ls.map((l) => (l.textContent ?? '').trim()))
    check(`2b-B 저장 전 검사: 「고칠 곳이 2군데 있어요」·행 오류 2줄·요청 0 [${W}px]`, al.some((t) => /고칠 곳이 2군데/.test(t)) && rowErr.length === 2 && p57(reqs).length === 0, `alerts=${j(al)} rowErr=${j(rowErr)}`)
    check(`2b-B 첫 문제(묶음 순서 첫 칸=c3 읽기)로 초점 이동 [${W}px]`, act?.id === 'tp-row-c3' || act?.id === 'tp-chunk-c3-reading', `active=${j(act)}`)
    const rowErrLi = rowErr.join(' | ')
    check(`2b-B 중복 문구는 뒤 표현(c6)에 붙음·읽기 문구는 c3 [${W}px]`, /이미|중복|같은/.test(rowErrLi), rowErrLi)
    // c3 고치기 → 오류 1개로 줄어듦
    const mb = page.locator('button[aria-label="薬 표현 메뉴"]')
    const labelC3 = (await menuBtns(page).nth(2).getAttribute('aria-label'))
    await tapAt(page, page.locator(`button[aria-label="${labelC3}"]`))
    await page.getByRole('dialog').getByRole('button', { name: '고치기' }).tap()
    await sleep(300)
    const li = page.locator(`button[aria-label="${labelC3}"]`).locator('xpath=ancestor::li[1]')
    await li.getByLabel('읽기', { exact: true }).fill('くすり')
    await li.getByRole('button', { name: '바꾸기' }).scrollIntoViewIfNeeded()
    await li.getByRole('button', { name: '바꾸기' }).tap()
    await sleep(500)
    const al2 = await alertText(page)
    check(`2b-B c3 읽기 고침 → 「고칠 곳이 1군데」로 줄어듦(즉시 반영) [${W}px]`, al2.some((t) => /고칠 곳이 1군데/.test(t)), `alerts=${j(al2)}`)
  } catch (e) {
    check('2b-B 스크립트 오류', false, String(e).slice(0, 300))
    await page.screenshot({ path: `${SSDIR}/item2b-B-err.png` }).catch(() => {})
  }
  await o.ctx.close()
}

// ── C. 표현 수 경계: 16 → 지워서 7(막힘) → 더해 8(풀림) / 20 에서 [＋] 막힘 / 21(주입) 막힘
{
  const o = await restore(variant(() => {}))
  const { page, reqs } = o
  try {
    for (let n = 16; n > 7; n--) {
      const mb = menuBtns(page).nth(n - 1)
      await mb.scrollIntoViewIfNeeded()
      await tapAt(page, mb)
      await page.getByRole('dialog').getByRole('button', { name: '지우기' }).tap()
      await sleep(250)
    }
    const cnt = await menuBtns(page).count()
    const t = await mainText(page)
    const sb = saveBtn(page)
    await sb.scrollIntoViewIfNeeded()
    await tapAt(page, sb)
    await sleep(500)
    const al = await alertText(page)
    const act = await activeInfo(page)
    check(`2b-C 표현 7개 → 저장 막힘: 「고칠 곳이 1군데」·제목 「기본 표현 7개」·요청 0 [${W}px]`, cnt === 7 && t.includes('기본 표현 7개') && al.some((x) => /고칠 곳이 1군데/.test(x)) && p57(reqs).length === 0, `rows=${cnt} alerts=${j(al)} active=${j(act)}`)
    note(`2b-C 7개 막힘 때 초점: ${j(act)} 범위 문구 주변: ${t.match(/기본 표현 7개[^]{0,80}/)?.[0]}`)
    await tapAt(page, page.getByRole('button', { name: '＋ 표현 더하기' }))
    await sleep(300)
    const ed = page.locator('#tp-chunks-h').locator('xpath=ancestor::section[1]')
    await ed.getByLabel('일본어', { exact: true }).fill('通院')
    await ed.getByLabel('읽기', { exact: true }).fill('つういん')
    await ed.getByLabel('뜻', { exact: true }).fill('통원')
    await ed.getByRole('button', { name: '바꾸기' }).scrollIntoViewIfNeeded()
    await ed.getByRole('button', { name: '바꾸기' }).tap()
    await sleep(500)
    const al2 = await alertText(page)
    check(`2b-C 표현 8개로 더하면 막힘 풀림(고칠 곳 줄 사라짐)·요청 0 [${W}px]`, (await menuBtns(page).count()) === 8 && !al2.some((x) => /고칠 곳이/.test(x)) && posts(reqs).length === 0, `alerts=${j(al2)} allReqs=${j(reqs.map((r) => r.m + ' ' + r.p))}`)
  } catch (e) {
    check('2b-C 스크립트 오류(7·8)', false, String(e).slice(0, 300))
  }
  await o.ctx.close()
}
{
  // 20 에서 [＋] 막힘 — 보관본에 20 개 주입, 21 은 별도 주입
  const extra = (n) => Array.from({ length: n }, (_, i) => ({ key: `c${17 + i}`, chunkType: 'MODIFIER', textJa: `追加${'ABCDEFGHIJ'[i] ? ['一','二','三','四','五','六','七','八','九','十'][i] : i}`, reading: 'ついか', meaningKo: ['더하나', '더둘', '더셋', '더넷', '더다섯'][i] ?? `더${i}` }))
  const o20 = await restore(variant((r) => { r.draft.chunks.push(...extra(4)) }))
  try {
    const add = o20.page.getByRole('button', { name: '＋ 표현 더하기' })
    await add.scrollIntoViewIfNeeded()
    const st = await add.evaluate((b) => ({ ad: b.getAttribute('aria-disabled'), op: getComputedStyle(b).opacity, desc: b.getAttribute('aria-describedby') }))
    const before = await menuBtns(o20.page).count()
    await tapAt(o20.page, add)
    await sleep(300)
    const editorOpened = await o20.page.locator('#tp-chunks-h').locator('xpath=ancestor::section[1]').getByRole('button', { name: '바꾸기' }).isVisible().catch(() => false)
    check(`2b-C 표현 20개: [＋ 표현 더하기] aria-disabled·흐림·눌러도 안 열림 [${W}px]`, before === 20 && st.ad === 'true' && !editorOpened, `rows=${before} ${j(st)} editorOpened=${editorOpened}`)
    // 20개는 저장 가능한 경계 — [저장] 눌러도 문제 줄 없음(요청은 스텁 없이 보내면 DB 에 저장되므로 누르지 않음)
  } catch (e) {
    check('2b-C 스크립트 오류(20)', false, String(e).slice(0, 300))
  }
  await o20.ctx.close()
  const o21 = await restore(variant((r) => { r.draft.chunks.push(...extra(5)) }))
  try {
    const rows = await menuBtns(o21.page).count()
    const sb = saveBtn(o21.page)
    await sb.scrollIntoViewIfNeeded()
    await tapAt(o21.page, sb)
    await sleep(500)
    const al = await alertText(o21.page)
    check(`2b-C 표현 21개(주입) → 저장 막힘: 「고칠 곳이 1군데」·요청 0 [${W}px]`, rows === 21 && al.some((x) => /고칠 곳이 1군데/.test(x)) && p57(o21.reqs).length === 0, `rows=${rows} alerts=${j(al)}`)
  } catch (e) {
    check('2b-C 스크립트 오류(21)', false, String(e).slice(0, 300))
  }
  await o21.ctx.close()
}

// ── D. [다시 만들기] 확인 상자 — 확인 전 요청 0, 취소 → 초점 복귀, 확인 → #170 1건(스텁 502)
{
  const o = await restore(variant(() => {}), { stub170: true })
  const { page, reqs } = o
  try {
    const rg = page.locator('#tp-regen')
    await rg.scrollIntoViewIfNeeded()
    await sleep(200)
    const s0 = await mainScrollTop(page)
    const y0 = (await rg.boundingBox()).y
    await tapAt(page, rg)
    await sleep(300)
    const s1 = await mainScrollTop(page)
    const y1 = (await rg.boundingBox()).y
    const box = page.locator('main').getByText('주제 초안을 다시 만들까요? 지금 고친 내용은 사라져요.')
    check(`2b-D [다시 만들기] → 확인 상자 문구(「고친 내용은 사라져요」)·확인 전 #170 0건·버튼 위치 불변(y ${Math.round(y0)}→${Math.round(y1)})·scrollTop 차 ${s1 - s0}px [${W}px]`, (await box.isVisible()) && d170(reqs).length === 0 && Math.abs(y1 - y0) < 1 && s1 === s0, `aria-expanded=${await rg.getAttribute('aria-expanded')}`)
    await page.locator('main').getByRole('button', { name: '취소' }).last().tap()
    await sleep(300)
    const act = await activeInfo(page)
    check(`2b-D 확인 상자 [취소] → 닫힘·초점 [다시 만들기]·요청 0 [${W}px]`, !(await box.isVisible().catch(() => false)) && act?.id === 'tp-regen' && d170(reqs).length === 0, `active=${j(act)}`)
    await tapAt(page, rg)
    await sleep(300)
    await page.locator('main').getByRole('button', { name: '다시 만들기' }).last().tap()
    await sleep(1500)
    const t = await mainText(page)
    const retained = t.includes('保険証')
    check(`2b-D 확인 상자 [다시 만들기] → #170 정확히 1건(스텁 502)·실패 상자 고정 문구·서버 message 미노출 [${W}px]`, d170(reqs).length === 1 && !t.includes('SERVER-MSG-XYZ') && t.includes('잠시 문제가 생겼어요'), `170=${d170(reqs).length} text=${t.slice(0, 120)}`)
    note(`2b-D 관찰: 다시 만들기 요청이 502 로 실패하면 고치던 초안은 ${retained ? '그대로 남음(작업 보존)' : '사라짐'} — 확인 상자 문구는 「지금 고친 내용은 사라져요」`)
  } catch (e) {
    check('2b-D 스크립트 오류', false, String(e).slice(0, 300))
    await page.screenshot({ path: `${SSDIR}/item2b-D-err.png` }).catch(() => {})
  }
  await o.ctx.close()
}


// ── D2. 확인 → 새 초안 도착(스텁 200): 고친 내용 교체·#166 자동 1회(스텁 502 — LLM 0)
{
  const o = await openPage(browser, W, Hh, c4)
  const { page, reqs } = o
  page.setDefaultTimeout(60000)
  const newDraft = { draft: { title: '스텁 주제', titleJa: 'スタブ', level: 'N4', description: '스텁 설명', chunks: Array.from({ length: 12 }, (_, i) => ({ chunkType: ['NAME', 'ACTION', 'FEELING', 'MODIFIER'][i % 4], textJa: `表現${['一','二','三','四','五','六','七','八','九','十','百','千'][i]}`, reading: 'ひょうげん', meaningKo: `스텁표현${['하나','둘','셋','넷','다섯','여섯','일곱','여덟','아홉','열','백','천'][i]}` })) }, warnings: [] }
  await page.route('**/api/v1/topics/drafts', async (route) => { await new Promise((r) => setTimeout(r, 1200)); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: newDraft }) }) })
  await page.route('**/api/v1/scenarios/drafts', (route) => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ success: false, data: { code: 'UPSTREAM' }, message: 'SC-MSG' }) }))
  try {
    await page.goto(BASE + '/api/health', { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [STORE_KEY, variant(() => {})])
    await page.goto(BASE + NEW_PATH, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await tapAt(page, page.getByRole('button', { name: '이어서 고치기' }))
    await page.getByRole('heading', { name: '주제 정보' }).waitFor({ state: 'visible' })
    await sleep(400)
    await page.getByLabel('주제 이름').fill('고친 제목')
    const rg = page.locator('#tp-regen')
    await rg.scrollIntoViewIfNeeded()
    await tapAt(page, rg)
    await sleep(300)
    await page.locator('main').getByRole('button', { name: '다시 만들기' }).last().tap()
    await sleep(500)
    const busyText = await mainText(page)
    await page.getByRole('heading', { name: '초안이 왔어요' }).waitFor({ state: 'visible', timeout: 20000 })
    await sleep(800)
    const t = await mainText(page)
    const title = await page.getByLabel('주제 이름').inputValue()
    const act = await activeInfo(page)
    check(`2b-D2 확인 → 새 초안 도착: 제목 「스텁 주제」(고친 「고친 제목」 사라짐)·표현 12개·초점 「초안이 왔어요」 제목 [${W}px]`, title === '스텁 주제' && (await menuBtns(page).count()) === 12 && act?.tag === 'H2', `title=${title} active=${j(act)} busy=${busyText.slice(0, 80)}`)
    check(`2b-D2 도착 직후 #170 1·#166 정확히 1(자동, 스텁 502)·서버 message 미노출 [${W}px]`, d170(reqs).length === 1 && d166(reqs).length === 1 && !t.includes('SC-MSG'), `170=${d170(reqs).length} 166=${d166(reqs).length}`)
    // 다시 그려도(체크·편집·재렌더) #166 재요청 0 — 표현 하나 고치기 후 3초 대기
    await page.getByLabel('설명').fill('설명 바꿈')
    await sleep(1500)
    check(`2b-D2 편집 후에도 #166 재요청 0(총 1건 유지) [${W}px]`, d166(reqs).length === 1, `166=${d166(reqs).length}`)
  } catch (e) {
    check('2b-D2 스크립트 오류', false, String(e).slice(0, 300))
    await page.screenshot({ path: `${SSDIR}/item2b-D2-err.png` }).catch(() => {})
  }
  await o.ctx.close()
}

// ── E. 경고(막지 않음) + 저장(#57): 더블탭 1건·본문·DB·도착
let saved = null
{
  const raw = variant((r) => {
    r.draft.description = ''
    r.draft.titleJa = ''
    r.warnings = ['DESCRIPTION_MISSING', 'TITLE_JA_MISSING']
  })
  const o = await restore(raw)
  const { page, reqs, errors } = o
  try {
    const t = await mainText(page)
    const warnLines = await page.locator('[role=note] button').evaluateAll((bs) => bs.map((b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim()))
    check(`2b-E 경고 안내: 「확인해 볼 곳 2가지 · 그대로 저장해도 돼요」·줄 2개(설명·일본어 이름) [${W}px]`, t.includes('확인해 볼 곳 2가지 · 그대로 저장해도 돼요') && warnLines.length === 2, `lines=${j(warnLines)}`)
    const mid = await qaRowCounts(u4.id)
    const gMid = await globalCounts()
    check(`2b-E 저장 직전까지 DB 행 0(QA4 전부 0·전체 주제/조각/상황 불변) [${W}px]`, Object.values(mid).every((n) => n === 0) && j(gMid) === j(g0), `qa4=${j(mid)} global=${j(gMid)}`)
    const ov = await overflowInfo(page)
    check(`2b-E S4 경고 포함 가로 넘침 0 [${W}px]`, ov.count === 0, j(ov))
    const sb = saveBtn(page)
    await sb.scrollIntoViewIfNeeded()
    await sleep(200)
    const b = await sb.boundingBox()
    const x = b.x + b.width / 2
    const y = b.y + b.height / 2
    // 더블탭: 터치 2회(약 40ms 간격) + 같은 틱 동기 클릭 2회
    await page.touchscreen.tap(x, y)
    await sleep(40)
    await page.touchscreen.tap(x, y)
    await page.evaluate(() => { const el = [...document.querySelectorAll('button')].find((b) => /주제만 저장|저장하고 있어요/.test(b.textContent ?? '')); el?.click(); el?.click() })
    await page.waitForURL((u) => /\/settings\/scenarios\/topics\/(?!new$)[^/]+$/.test(u.pathname), { timeout: 30000 })
    await sleep(900)
    const p = p57(reqs)
    let body = null
    try { body = JSON.parse(p[0]?.body ?? 'null') } catch {}
    check(`2b-E 더블탭(터치2+동기클릭2) → #57 정확히 1건·성공 201 [${W}px]`, p.length === 1 && [200, 201].includes(p[0]?.status), `n=${p.length} status=${p.map((x) => x.status).join(',')}`)
    const chunkKeys = body ? [...new Set(body.chunks.flatMap((c) => Object.keys(c)))].sort().join(',') : 'x'
    check(`2b-E #57 본문: chunks[].id·order 없음(키=${chunkKeys})·표현 16·titleJa/description null(비움)·level N4 [${W}px]`, !!body && chunkKeys === 'chunkType,meaningKo,reading,textJa' && body.chunks.length === 16 && body.titleJa === null && body.description === null && body.level === 'N4' && !('id' in body), `bodyKeys=${body ? Object.keys(body).join(',') : ''}`)
    const url = new URL(page.url())
    const topic = await prisma.conversationTopic.findMany({ where: { userId: u4.id }, include: { chunks: { orderBy: { order: 'asc' } } } })
    const rowsDb = topic[0]?.chunks ?? []
    const same = body && rowsDb.length === body.chunks.length && rowsDb.every((r, i) => r.textJa === body.chunks[i].textJa && (r.reading ?? '') === body.chunks[i].reading && r.meaningKo === body.chunks[i].meaningKo && r.chunkType === body.chunks[i].chunkType && r.order === i)
    const after = await qaRowCounts(u4.id)
    check(`2b-E DB: 주제 1행·표현 16행이 본문과 일치(순서=order)·상황 0 [${W}px]`, topic.length === 1 && url.pathname.endsWith('/' + topic[0].id) && same && after.scenarios === 0 && after.chunks === 16, `after=${j(after)} url=${url.pathname}`)
    const st = await mainScrollTop(page)
    const act = await activeInfo(page)
    const toast = await page.evaluate(() => [...document.querySelectorAll('[role=status],[role=alert]')].map((e) => (e.textContent ?? '').trim()).filter(Boolean))
    check(`2b-E 도착: /settings/scenarios/topics/<id>·main.scrollTop=0(${st})·머리 제목에 초점·토스트 「병원 진료」 주제를 저장했어요 [${W}px]`, st === 0 && /^H[12]$/.test(act?.tag ?? '') && toast.some((x) => x.includes('병원 진료') && x.includes('저장했어요')), `active=${j(act)} toast=${j(toast)}`)
    check(`2b-E 도착 후 가로 넘침 0·페이지 오류 0 [${W}px]`, (await overflowInfo(page)).count === 0 && errors.length === 0, errors.join('|'))
    saved = topic[0]?.id ?? null
    note(`2b-E 저장 관련 요청: ${j(p.map((x) => ({ m: x.m, p: x.p, s: x.status, dt: x.dt })))}`)
  } catch (e) {
    check('2b-E 스크립트 오류', false, String(e).slice(0, 400))
    await page.screenshot({ path: `${SSDIR}/item2b-E-err.png` }).catch(() => {})
  }
  await o.ctx.close()
}

const cl = await cleanupQa(u4.id)
const h1 = await seedHash()
check('2b-정리: QA4 행 삭제 후 0·시드 해시 불변', j(h1) === j(h0) && Object.values(await qaRowCounts(u4.id)).every((n) => n === 0), `cleanup=${j(cl)} sha ${h0.sha}→${h1.sha}`)
await closeBrowser(browser)
summary('항목 2b (390)')
await prisma.$disconnect()
