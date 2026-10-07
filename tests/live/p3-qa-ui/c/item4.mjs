/**
 * 항목 4 (Claude 호출 0) — partial·보관값(sessionStorage)·사용자 전환·로그아웃·손상 값·버리기.
 * PART=A: 내 상황 50 채움 → 주제 저장 후 상황 409 SCENARIO_LIMIT → partial 화면(3폭) + 390 이어서(새로 고침·재저장·주제 보기로)
 * PART=B: 네트워크 abort·400 스텁의 「이미 저장됐을 수 있어요」 한 줄, 보관 키 허용 목록, 사용자 전환(QA1 쿠키), 로그아웃, 손상 JSON·XSS, 버리기
 * 끝에 QA4 행(채움 50 포함) 전부 cleanupQa.
 */
import {
  tapAt, BASE, NEW_PATH, STORE_KEY, SNAP_FILE, SSDIR, activeInfo, check, cleanupQa, closeBrowser, cookieOf, launch, mainScrollTop, mainText, note, openPage, overflowInfo,
  prisma, qaRowCounts, qaUser, QA4, QA1, readStore, seedHash, sleep, summary, j,
} from './lib.mjs'
import { readFileSync } from 'node:fs'

const PART = process.env.PART ?? 'A'
const c4 = cookieOf(process.env.QA_COOKIE)
const c1 = process.env.QA_COOKIE1 ? cookieOf(process.env.QA_COOKIE1) : null
const u4 = await qaUser(QA4)
const SNAP0 = JSON.parse(JSON.parse(readFileSync(SNAP_FILE, 'utf8')).raw)
const H = { 360: 740, 390: 844, 412: 892 }
const twoCards = (mut) => {
  const r = structuredClone(SNAP0)
  const c = structuredClone(r.scenarios[0])
  c.key = 'sc1'
  c.draft.title = '병원에서 약 받고 설명 듣기'
  c.draft.titleJa = '病院で薬をもらう'
  c.desc = '병원에서 약을 받으며 먹는 법을 묻는 상황'
  r.scenarios.push(c)
  if (mut) mut(r)
  return JSON.stringify(r)
}
const ALLOWED_TOP = ['version', 'userId', 'ask', 'draft', 'warnings', 'arrivalTitle', 'edited', 'scenarios', 'savedTopicId', 'scAsked', 'savedAt']
const ALLOWED_SC = ['key', 'desc', 'draft', 'keep', 'savedId']
const FORBID = /token|bearer|cookie|authorization|thekaiwa_session|message|failure|SERVER-MSG|SC-MSG|내 상황이 50개|저장하지 못|응답을 받지 못|UPSTREAM|SCENARIO_LIMIT/i
const fill50 = () =>
  prisma.scenario.createMany({ data: Array.from({ length: 50 }, (_, i) => ({ userId: u4.id, title: `QA채움 ${i + 1}`, level: 'N5', roles: {}, goal: {}, keyExpressions: [], completionRule: {}, status: 'ACTIVE', createdAt: new Date(Date.now() - 5 * 86400e3) })) })
await cleanupQa(u4.id)
const h0 = await seedHash()
note('seedHash start ' + j(h0) + ' PART=' + PART)
const browser = await launch()
const p57 = (reqs) => reqs.filter((r) => r.m === 'POST' && r.p === '/api/v1/topics')
const p163 = (reqs) => reqs.filter((r) => r.m === 'POST' && r.p === '/api/v1/scenarios')
const anyLlm = (reqs) => reqs.filter((r) => r.m === 'POST' && /\/drafts$/.test(r.p))
const saveBtn = (page) => page.getByRole('button', { name: /^(주제만 저장|주제와 상황 \d+개 저장|상황 다시 저장)$/ })
const storeObj = async (page) => { try { return JSON.parse(await readStore(page)) } catch { return null } }

async function restore(w, raw, { before } = {}) {
  const o = await openPage(browser, w, H[w], c4)
  const { page } = o
  page.setDefaultTimeout(60000)
  if (before) await before(page)
  await page.goto(BASE + '/api/health', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [STORE_KEY, raw])
  await page.goto(BASE + NEW_PATH, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.getByRole('button', { name: '이어서 고치기' }).waitFor({ state: 'visible', timeout: 120000 })
  await tapAt(page, page.getByRole('button', { name: '이어서 고치기' }))
  await page.getByRole('heading', { name: '주제 정보' }).waitFor({ state: 'visible' })
  await sleep(500)
  return o
}
async function saveOnce(page) {
  const sb = saveBtn(page)
  await sb.scrollIntoViewIfNeeded()
  await sleep(200)
  await tapAt(page, sb)
}

if (PART === 'A') {
  for (const w of (process.env.ONLY ?? '360,390,412').split(',').map(Number)) {
    const tag = `${w}px`
    await cleanupQa(u4.id)
    await fill50()
    let o
    try {
      o = await restore(w, twoCards())
      const { page, reqs } = o
      const pre = await storeObj(page)
      await saveOnce(page)
      await page.locator('#tp-partial').waitFor({ state: 'visible', timeout: 40000 })
      await sleep(800)
      const a57 = p57(reqs)
      const a163 = p163(reqs)
      const t = await mainText(page)
      const act = await activeInfo(page)
      const retry = page.getByRole('button', { name: '상황 다시 저장' })
      const retryAttrs = await retry.evaluate((b) => ({ ad: b.getAttribute('aria-disabled'), desc: b.getAttribute('aria-describedby') }))
      const later = page.getByRole('button', { name: '주제 보기로' })
      const topicRows = await prisma.conversationTopic.findMany({ where: { userId: u4.id }, include: { chunks: true } })
      const scCount = await prisma.scenario.count({ where: { userId: u4.id } })
      const linkCount = await prisma.scenarioTopic.count({ where: { scenario: { userId: u4.id } } })
      check(`4A-저장: #57 1건 201 → #163 1건 409(SCENARIO_LIMIT, 응답 ${a163[0]?.resp?.includes('SCENARIO_LIMIT')})·둘째 상황은 안 보냄(멈춤) [${tag}]`, a57.length === 1 && a57[0].status === 201 && a163.length === 1 && a163[0].status === 409 && !!a163[0].resp?.includes('SCENARIO_LIMIT'), `57=${a57.map((x) => x.status)} 163=${a163.map((x) => x.status)} ${a163[0]?.resp?.slice(0, 120)}`)
      check(`4A-partial 화면: 「주제는 저장했어요」·「상황 2개는 저장하지 못했어요」·남은 상황 2줄·상한 이유 「내 상황이 50개…」·초점 #tp-partial(role=alert) [${tag}]`, t.includes('주제는 저장했어요') && t.includes('상황 2개는 저장하지 못했어요') && t.includes('병원에서 증상 말하고 진료받기') && t.includes('병원에서 약 받고 설명 듣기') && t.includes('내 상황이 50개라 더 저장할 수 없어요') && act?.id === 'tp-partial' && act?.role === 'alert', `active=${j(act)}`)
      check(`4A-[상황 다시 저장] aria-disabled(상한)·이유 연결(aria-describedby)·[주제 보기로] 있음·「이미 저장됐을 수 있어요」 없음(서버가 거절한 409) [${tag}]`, retryAttrs.ad === 'true' && !!retryAttrs.desc && (await later.count()) >= 1 && !t.includes('이미 저장됐을 수 있어요'), j(retryAttrs))
      check(`4A-DB: 주제 1행·표현 ${topicRows[0]?.chunks.length}행만 생김·상황은 채움 50 그대로(새 상황 0)·연결 0 [${tag}]`, topicRows.length === 1 && topicRows[0].chunks.length === 16 && scCount === 50 && linkCount === 0, `topics=${topicRows.length} chunks=${topicRows[0]?.chunks.length} scenarios=${scCount} links=${linkCount}`)
      const ov = await overflowInfo(page)
      check(`4A-partial 화면 가로 넘침 0 [${tag}]`, ov.count === 0, j(ov))
      const fieldsOff = await page.getByLabel('주제 이름').evaluate((el) => el.disabled || el.readOnly)
      check(`4A-partial 에서 주제 칸 잠김(읽기 전용/disabled) [${tag}]`, fieldsOff === true, `disabled/readOnly=${fieldsOff}`)
      const st = await storeObj(page)
      const raw = await readStore(page)
      const topKeys = st ? Object.keys(st).sort() : []
      const scKeys = st ? [...new Set(st.scenarios.flatMap((s) => Object.keys(s)))].sort() : []
      check(`4A-보관값: 최상위 키 ⊆ 허용 목록·scenarios 항목 키 ⊆ ${ALLOWED_SC.join(',')}·userId=QA4·savedTopicId=새 주제 id·토큰/서버 message/실패 문구 없음 [${tag}]`, !!st && topKeys.every((k) => ALLOWED_TOP.includes(k)) && scKeys.every((k) => ALLOWED_SC.includes(k)) && st.userId === u4.id && st.savedTopicId === topicRows[0]?.id && !FORBID.test(raw), `top=${topKeys.join(',')} sc=${scKeys.join(',')} forbidHit=${raw.match(FORBID)?.[0]} keysBefore=${pre ? Object.keys(pre).join(',') : ''}`)
      // 막힌 [상황 다시 저장] 탭 → 요청 0
      await retry.scrollIntoViewIfNeeded()
      await tapAt(page, retry)
      await sleep(900)
      check(`4A-막힌 [상황 다시 저장] 눌러도 #57/#163 추가 0·주제 행 1 유지 [${tag}]`, p57(reqs).length === 1 && p163(reqs).length === 1 && (await prisma.conversationTopic.count({ where: { userId: u4.id } })) === 1, `57=${p57(reqs).length} 163=${p163(reqs).length}`)
      check(`4A-LLM 요청(#170/#166) 0 [${tag}]`, anyLlm(reqs).length === 0, j(anyLlm(reqs).map((r) => r.p)))

      if (w === 390) {
        // 새로 고침 → 이어서 고치기: 주제를 다시 만들지 않음
        const n57 = p57(reqs).length
        await page.reload({ waitUntil: 'domcontentloaded' })
        await Promise.race([
          page.getByRole('button', { name: '이어서 고치기' }).waitFor({ state: 'visible', timeout: 60000 }),
          page.locator('#tp-partial').waitFor({ state: 'visible', timeout: 60000 }),
          page.getByRole('heading', { name: '주제 정보' }).waitFor({ state: 'visible', timeout: 60000 }),
        ])
        const hasCard = (await page.getByRole('button', { name: '이어서 고치기' }).count()) > 0
        if (hasCard) await tapAt(page, page.getByRole('button', { name: '이어서 고치기' }))
        await sleep(1500)
        const t1 = await mainText(page)
        note(`4A-새로 고침 뒤 첫 화면: 이어서 카드 ${hasCard ? '있음(탭함)' : '없음'} · partial 상자 ${(await page.locator('#tp-partial').count())} · 초점 ${j(await activeInfo(page))}`)
        const st1 = await storeObj(page)
        note(`4A-새로 고침→이어서 고치기 화면: ${t1.slice(0, 200)}`)
        check(`4A-새로 고침 뒤 이어 고치기: 보관 savedTopicId 유지·주제 다시 만들지 않음(#57 0)·LLM 0 [390px]`, st1?.savedTopicId === topicRows[0].id && p57(reqs).length === n57 && anyLlm(reqs).length === 0, `store.savedTopicId=${st1?.savedTopicId} 57=${p57(reqs).length}`)
        // 자리 하나 비우고 다시 저장 → 첫 상황 저장, 둘째는 다시 409 → partial(m=1), #57 여전히 1
        await prisma.scenario.deleteMany({ where: { userId: u4.id, title: 'QA채움 1' } })
        const sb2 = saveBtn(page)
        await sb2.scrollIntoViewIfNeeded()
        const lab2 = (await sb2.textContent()).trim()
        await tapAt(page, sb2)
        for (let i = 0; i < 120 && !(p163(reqs).filter((x) => x.status !== null).length >= 3); i++) await sleep(250)
        await sleep(1200)
        const t2 = await mainText(page)
        const scNow = await prisma.scenario.findMany({ where: { userId: u4.id, title: { not: { startsWith: 'QA채움' } } }, include: { topics: true } })
        check(`4A-자리 1개 비우고 [${lab2}] → #57 재호출 0(총 1)·#163 첫 상황 201·둘째 409 → partial 「상황 1개는 저장하지 못했어요」 [390px]`, p57(reqs).length === 1 && p163(reqs).length === 3 && p163(reqs).slice(1).map((x) => x.status).join(',') === '201,409' && t2.includes('상황 1개는 저장하지 못했어요') && t2.includes('병원에서 약 받고 설명 듣기'), `57=${p57(reqs).length} 163=${p163(reqs).map((x) => x.status)} partialTxt=${t2.slice(t2.indexOf('주제는 저장했어요'), t2.indexOf('주제는 저장했어요') + 120)}`)
        check(`4A-DB: 주제 여전히 1행·새 상황 1(연결 1→이 주제)·채움 49 [390px]`, (await prisma.conversationTopic.count({ where: { userId: u4.id } })) === 1 && scNow.length === 1 && scNow[0].title === '병원에서 증상 말하고 진료받기' && scNow[0].topics.length === 1 && scNow[0].topics[0].topicId === topicRows[0].id, `new=${scNow.map((s) => s.title)} links=${scNow[0]?.topics?.length}`)
        // [주제 보기로] → 확인 시트 → 이동 → 키 삭제 + 토스트
        await tapAt(page, page.getByRole('button', { name: '주제 보기로' }).first())
        await page.getByRole('dialog').waitFor({ state: 'visible' })
        const dtxt = (await page.getByRole('dialog').innerText()).replace(/\s+/g, ' ')
        await tapAt(page, page.getByRole('dialog').getByRole('button', { name: '주제 보기로' }))
        await page.waitForURL((u) => /\/settings\/scenarios\/topics\/(?!new$)[^/]+$/.test(u.pathname), { timeout: 30000 })
        await sleep(900)
        const keyAfter = await readStore(page)
        const toast = await page.evaluate(() => [...document.querySelectorAll('[role=status],[role=alert]')].map((e) => (e.textContent ?? '').trim()).filter(Boolean))
        check(`4A-[주제 보기로] 확인 시트(「저장하지 못한 상황 초안 1개는 사라져요」) → 주제 보기 이동·보관 키 삭제·토스트(상황 1개) [390px]`, dtxt.includes('저장하지 못한 상황 초안 1개는 사라져요') && keyAfter === null && toast.some((x) => x.includes('주제를 저장했어요 · 상황 1개도 저장했어요')), `key=${keyAfter} toast=${j(toast)} sheet=${dtxt.slice(0, 100)}`)
      }
    } catch (e) {
      check(`4A-스크립트 오류 [${tag}]`, false, String(e).slice(0, 500))
      try { await o?.page.screenshot({ path: `${SSDIR}/item4A-err-${w}.png` }) } catch {}
    } finally {
      await o?.ctx.close()
      note(`정리 [${tag}]: ${j(await cleanupQa(u4.id))}`)
    }
  }
}

if (PART === 'B') {
  const W = 390
  // B1 네트워크 abort / B2 400 스텁 → 「이미 저장됐을 수 있어요」
  for (const mode of ['abort', '400', '409']) {
    await cleanupQa(u4.id)
    let o
    try {
      o = await restore(W, twoCards(), {
        before: async (page) => {
          await page.route('**/api/v1/scenarios', async (route) => {
            if (route.request().method() !== 'POST') return route.continue()
            if (mode === 'abort') return route.abort('failed')
            if (mode === '400') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ success: false, data: { code: 'INVALID_INPUT', details: { problems: [{ field: 'title', reason: 'required' }] } }, message: 'SC-MSG-XYZ' }) })
            return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, data: { code: 'CONFLICT', details: { reason: 'SOMETHING_ELSE' } }, message: 'SC-MSG-XYZ' }) })
          })
        },
      })
      const { page, reqs } = o
      await saveOnce(page)
      await page.locator('#tp-partial').waitFor({ state: 'visible', timeout: 40000 })
      await sleep(700)
      const t = await mainText(page)
      const unsure = t.includes('이미 저장됐을 수 있어요')
      const raw = await readStore(page)
      check(`4B-#163 ${mode}: partial 화면·주제 1행·「응답을 받지 못한 상황은 이미 저장됐을 수 있어요」 ${mode === 'abort' ? '보임' : '안 보임'}·서버 message(SC-MSG-XYZ) 미노출 [390px]`, t.includes('주제는 저장했어요') && unsure === (mode === 'abort') && !t.includes('SC-MSG-XYZ') && (await prisma.conversationTopic.count({ where: { userId: u4.id } })) === 1, `unsure=${unsure} 163=${p163(reqs).map((x) => x.status)} partial=${t.slice(t.indexOf('주제는 저장했어요'), t.indexOf('주제는 저장했어요') + 200)}`)
      check(`4B-${mode} 뒤 보관값에 실패 문구·서버 message 없음 [390px]`, !!raw && !FORBID.test(raw), `hit=${raw?.match(FORBID)?.[0]}`)
      if (mode === 'abort') {
        const ov = await overflowInfo(page)
        check(`4B-abort partial 화면(unsure 한 줄 포함) 가로 넘침 0 [390px]`, ov.count === 0, j(ov))
      }
    } catch (e) {
      check(`4B-스크립트 오류(${mode})`, false, String(e).slice(0, 400))
      try { await o?.page.screenshot({ path: `${SSDIR}/item4B-${mode}-err.png` }) } catch {}
    } finally {
      await o?.ctx.close()
      await cleanupQa(u4.id)
    }
  }
  // B3 사용자 전환(같은 탭, 쿠키 QA4 → QA1)
  if (c1) {
    let o
    try {
      o = await restore(W, twoCards())
      const { page, ctx } = o
      const had = await readStore(page)
      await ctx.clearCookies()
      const eq = c1.indexOf('=')
      await ctx.addCookies([{ name: c1.slice(0, eq), value: c1.slice(eq + 1), url: BASE }])
      await page.goto(BASE + NEW_PATH, { waitUntil: 'domcontentloaded' })
      await page.locator('#tp-ask').waitFor({ state: 'visible', timeout: 60000 })
      await sleep(1500)
      const resume = await page.getByRole('button', { name: '이어서 고치기' }).count()
      const txt = await mainText(page)
      const key = await readStore(page)
      check(`4B-같은 탭에서 QA1 쿠키로 바꿔 들어오면: 「고치던 주제 초안」 카드·이어서 고치기 안 보임·남의 제목(「병원 진료」)·상황 안 보임·보관 키 삭제 [390px]`, !!had && resume === 0 && !txt.includes('병원 진료') && !txt.includes('고치던') && key === null, `had=${!!had} resume=${resume} key=${key === null ? 'null' : 'present'} text=${txt.slice(0, 100)}`)
    } catch (e) {
      check('4B-사용자 전환 스크립트 오류', false, String(e).slice(0, 400))
    } finally {
      await o?.ctx.close()
    }
  } else note('QA_COOKIE1 없음 — 사용자 전환 NOT_VERIFIED')
  // B4 로그아웃 → 키 삭제
  {
    let o
    try {
      o = await restore(W, twoCards())
      const { page } = o
      const had = await readStore(page)
      await page.goto(BASE + '/settings', { waitUntil: 'domcontentloaded' })
      const btn = page.getByRole('button', { name: '로그아웃', exact: true })
      await btn.scrollIntoViewIfNeeded()
      await tapAt(page, btn)
      await page.waitForURL(/\/login/, { timeout: 30000 })
      await sleep(500)
      const key = await readStore(page)
      check(`4B-로그아웃 → /login 이동 후 보관 키 삭제 [390px]`, !!had && key === null, `had=${!!had} key=${key === null ? 'null' : 'present'} url=${new URL(page.url()).pathname}`)
    } catch (e) {
      check('4B-로그아웃 스크립트 오류', false, String(e).slice(0, 400))
    } finally {
      await o?.ctx.close()
    }
  }
  // B5 손상 JSON·모양 어긋남·XSS
  {
    const o = await openPage(browser, W, H[W], c4)
    const { page, errors } = o
    page.setDefaultTimeout(60000)
    try {
      await page.goto(BASE + '/api/health', { waitUntil: 'domcontentloaded', timeout: 120000 })
      const cases = {
        truncated: `{"version":1,"userId":"${u4.id}","ask":{"title":"병원","level":"N5"`,
        badChunkKey: JSON.stringify({ ...SNAP0, draft: { ...SNAP0.draft, chunks: [{ key: 'zzz', chunkType: 'NAME', textJa: 'あ', reading: 'あ', meaningKo: '가' }] } }),
        arrayNotObject: '[1,2,3]',
        hugeTitle: JSON.stringify({ ...SNAP0, ask: { title: 'x'.repeat(5000), level: 'N5' } }),
      }
      for (const [name, raw] of Object.entries(cases)) {
        await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [STORE_KEY, raw])
        await page.goto(BASE + NEW_PATH, { waitUntil: 'domcontentloaded' })
        await page.locator('#tp-ask').waitFor({ state: 'visible', timeout: 60000 })
        await sleep(1200)
        const resume = await page.getByRole('button', { name: '이어서 고치기' }).count()
        const key = await readStore(page)
        check(`4B-손상 보관값(${name}) 주입: 화면 안 죽음(묻기 폼 보임)·이어서 카드 없음·키 폐기(null/빈) [390px]`, resume === 0 && (key === null || key === '') && errors.length === 0, `resume=${resume} key=${key === null ? 'null' : key.slice(0, 30)} errors=${errors.join('|')}`)
      }
      // XSS 리터럴 — 주제 이름·표현·상황 카드 제목
      const X = '<img src=x onerror="window.__xss=1">'
      const xraw = twoCards((r) => {
        r.draft.title = X.slice(0, 20)
        r.draft.description = X
        r.draft.chunks[0].textJa = X.slice(0, 18)
        r.draft.chunks[0].meaningKo = X
        r.scenarios[0].draft.title = X
        r.scenarios[1].draft.titleJa = X
      })
      await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [STORE_KEY, xraw])
      await page.goto(BASE + NEW_PATH, { waitUntil: 'domcontentloaded' })
      await page.getByRole('button', { name: '이어서 고치기' }).waitFor({ state: 'visible', timeout: 60000 })
      await tapAt(page, page.getByRole('button', { name: '이어서 고치기' }))
      await page.getByRole('heading', { name: '주제 정보' }).waitFor({ state: 'visible' })
      await sleep(1200)
      const xs = await page.evaluate(() => ({ imgs: document.querySelectorAll('main img').length, xss: window.__xss ?? null, hasLiteral: (document.querySelector('main')?.innerText ?? '').includes('<img src=x') }))
      check(`4B-XSS 리터럴(주제 이름·설명·표현·상황 카드): main img 요소 0·onerror 실행 안 됨·글자로 남음 [390px]`, xs.imgs === 0 && xs.xss === null && xs.hasLiteral, j(xs))
      check('4B-손상·XSS 주입 중 페이지 오류 0', errors.length === 0, errors.join('|'))
      await page.evaluate((k) => sessionStorage.removeItem(k), STORE_KEY)
    } catch (e) {
      check('4B-손상/XSS 스크립트 오류', false, String(e).slice(0, 400))
    }
    await o.ctx.close()
  }
  // B6 버리기 → 키 삭제 / 저장 성공 → 키 삭제(저장은 item2b·3b 에서 확인했으므로 여기선 버리기만)
  {
    let o
    try {
      o = await restore(W, twoCards())
      const { page } = o
      const had = await readStore(page)
      const dis = page.getByRole('button', { name: '버리기', exact: true })
      await dis.scrollIntoViewIfNeeded()
      await tapAt(page, dis)
      await page.getByRole('dialog').waitFor({ state: 'visible' })
      await tapAt(page, page.getByRole('dialog').getByRole('button', { name: '버리기', exact: true }))
      await page.waitForURL(/\/settings\/scenarios(\?|$)/, { timeout: 30000 })
      await sleep(600)
      const key = await readStore(page)
      check(`4B-[버리기] → 확인 시트 → 관리 화면 이동·보관 키 삭제·DB 행 0 [390px]`, !!had && key === null && Object.values(await qaRowCounts(u4.id)).every((n) => n === 0), `had=${!!had} key=${key === null ? 'null' : 'present'} url=${new URL(page.url()).pathname}`)
    } catch (e) {
      check('4B-버리기 스크립트 오류', false, String(e).slice(0, 400))
    } finally {
      await o?.ctx.close()
    }
  }
}
const cl = await cleanupQa(u4.id)
const h1 = await seedHash()
check(`4-정리(PART ${PART}): QA4 행 전부(채움 포함) 0·시드 해시 불변`, j(h1) === j(h0) && Object.values(await qaRowCounts(u4.id)).every((n) => n === 0), `cleanup=${j(cl)} sha ${h0.sha}→${h1.sha}`)
await closeBrowser(browser)
summary(`항목 4 PART ${PART}`)
await prisma.$disconnect()
