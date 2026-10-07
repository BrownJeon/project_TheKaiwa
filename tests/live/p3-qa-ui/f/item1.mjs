/**
 * qa-045-ui-f 항목 1 — QA-A Low 4건 재측정(HEAD 30a9a94 의 f189dec 수정). LLM 호출 0, QA2 읽기 전용(GET·화면만) + QA3 는 API #57 로 만든 긴 한글 주제 1개(끝에 지움).
 * 실행: cd $Q && QA_BASE=http://127.0.0.1:3059 QA_SNAPSHOT=$Q QA_COOKIE=<c3 쿠키 파일> QA_COOKIE2=<c2 쿠키 파일> node --env-file=.env <이 파일>
 * 재사용: ../e/lib.mjs(launch·openPage·check·seedHash·cleanupQa) · ../e/ui.mjs(overflow)
 */
import { api, data, check, note, summary, launch, cookieOf, sleep, WIDTHS, BASE, QA2, QA3, qaUser, qaRowCounts, cleanupQa, seedHash, prisma, closeBrowser } from '../e/lib.mjs'
import { overflow } from '../e/ui.mjs'

const c2 = cookieOf(process.env.QA_COOKIE2)
const c3 = cookieOf(process.env.QA_COOKIE)
const SEED_SHA = 'e826f3ef09237a9c'
const isTopics = (u) => u.pathname === '/api/v1/topics'
const isScen = (u) => u.pathname === '/api/v1/scenarios'
const isOv = (u) => u.pathname === '/api/v1/seed-overrides'
const isCh = (u) => u.pathname === '/api/v1/challenges'

async function ctxFor(browser, w, h, cookie) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
  const eq = cookie.indexOf('=')
  await ctx.addCookies([{ name: cookie.slice(0, eq), value: cookie.slice(eq + 1), url: BASE }])
  return ctx
}

/** 페이지 안 기록기 — 클릭 시각(capture)·자리표시(aria-busy / 불러오는 중 status)·오류 상자 변화를 performance.now 로 */
const installRecorder = (page) =>
  page.evaluate(() => {
    window.__log = []
    window.__tClick = null
    document.addEventListener('click', () => { if (window.__tClick === null) window.__tClick = performance.now() }, true)
    let last = ''
    const snap = () => {
      const main = document.querySelector('main')
      return { busy: !!main.querySelector('[aria-busy="true"]'), skel: [...main.querySelectorAll('[role=status]')].some((e) => /불러오는 중/.test(e.textContent)), err: main.innerText.includes('목록을 불러오지 못했어요') }
    }
    const rec = () => {
      const s = snap()
      const k = JSON.stringify(s)
      if (k !== last) { last = k; window.__log.push([Math.round(performance.now()), s]) }
    }
    new MutationObserver(rec).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
    rec()
  })
function retryStats(log, tClick) {
  const start = log.find(([t, s]) => t >= tClick - 1 && (s.busy || s.skel))
  const errBack = start ? log.find(([t, s]) => t > start[0] && s.err && !s.busy && !s.skel) : null
  return { seen: !!start, busyMs: start && errBack ? errBack[0] - start[0] : null, clickToErrMs: errBack && tClick ? Math.round(errBack[0] - tClick) : null, n: log.length }
}

async function gotoManage(ctx, query, setup) {
  const page = await ctx.newPage()
  page.setDefaultTimeout(60_000)
  if (setup) await setup(page)
  await page.goto(`${BASE}/settings/scenarios${query}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  return page
}

const u2 = await qaUser(QA2)
const u3 = await qaUser(QA3)
const h0 = await seedHash()
const c20 = await qaRowCounts(u2.id)
const c30 = await qaRowCounts(u3.id)
note(`시작 시드 해시 ${h0.sha} ${JSON.stringify(h0)} | QA2 행 ${JSON.stringify(c20)} | QA3 행 ${JSON.stringify(c30)}`)
check('시작: 시드 해시 = e826f3ef09237a9c', h0.sha === SEED_SHA, h0.sha)
check('시작: QA2·QA3 행 0', Object.values(c20).every((n) => n === 0) && Object.values(c30).every((n) => n === 0), JSON.stringify([c20, c30]))

// ── 준비: QA3 긴 한글 주제(API #57) ─────────────────────────────────────
const HG = '가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허고노도로모보소오조초코토포호구누두루무부수우주추쿠투푸후'
const KO30 = (i) => HG.slice(i * 3, i * 3 + 30) // 표현마다 다른 공백 없는 한글 30자(같은 뜻 중복은 #57 이 거부)
const intro = (data(await api(c3, 'GET', '/api/v1/topics?level=all'))?.items ?? []).find((t) => t.isSeed && t.title === '자기소개')
const seedChunks = intro.chunks.slice(0, 8)
const longChunks = seedChunks.map((x, i) => ({ chunkType: x.chunkType, textJa: x.textJa, reading: x.reading, meaningKo: KO30(i) }))
const longDesc = '설명이길어서공백이하나도없는한글문장입니다'.repeat(6).slice(0, 100)
const longTitle = '긴제목한글공백없이이십자채우기시험'.slice(0, 20)
let rs = await api(c3, 'POST', '/api/v1/topics', { title: longTitle, titleJa: '自己紹介自己紹介自己紹介自己紹介'.slice(0, 20), level: 'N5', description: longDesc, chunks: longChunks })
if (rs.status === 429) { note('429 — 62초 대기'); await sleep(62000); rs = await api(c3, 'POST', '/api/v1/topics', { title: longTitle, titleJa: '自己紹介', level: 'N5', description: longDesc, chunks: longChunks }) }
const longId = data(rs)?.topic?.id
note(`QA3 긴 한글 주제 #57 status=${rs.status} id=${longId} desc=${longDesc.length}자 meaningKo=${longChunks.map((c) => c.meaningKo.length).join(',')}`)
check('준비: #57 로 긴 한글 주제 생성(201)', rs.status === 201 && !!longId, JSON.stringify(rs.body).slice(0, 200))

const T = (data(await api(c2, 'GET', '/api/v1/topics?level=all'))?.items ?? []).find((t) => t.isSeed && t.title === '자기소개')
const S6 = `/settings/scenarios/topics/${T.id}`

const browser = await launch()
try {
  for (const [W, H] of WIDTHS) {
    const ctx = await ctxFor(browser, W, H, c2)

    // ── ① [다시 시도] 최소 표시(#56 만·#179 만·#161 참고) ───────────────
    for (const [label, matcher, tabSetup] of [['#56 만 abort', isTopics, null], ['#179 만 abort', isOv, null], ['#161 만 abort(상황 탭)', isScen, 'scenarios']]) {
      const page = await gotoManage(ctx, '?tab=topics', (p) => p.route(matcher, (r) => r.abort()))
      if (tabSetup) {
        await page.getByRole('radio', { name: '상황' }).tap()
        await page.waitForTimeout(500)
      }
      const alerts = await page.locator('main [role=alert]').count()
      check(`[${W}] ① ${label}: 오류 상자 [다시 시도] 표시`, alerts === 1 && (await page.locator('main [role=alert] button').innerText()) === '다시 시도', `alerts=${alerts}`)
      await installRecorder(page)
      const btn = page.locator('main [role=alert] button').first()
      const b = await btn.boundingBox()
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
      await page.waitForTimeout(1800)
      const log = await page.evaluate(() => window.__log)
      const tClick = await page.evaluate(() => window.__tClick)
      const st = retryStats(log, tClick)
      const errAgain = (await page.locator('main [role=alert] b').innerText().catch(() => '')) === '목록을 불러오지 못했어요'
      note(`[${W}] ① ${label} 로그 ${JSON.stringify(log)} tClick=${Math.round(tClick)} → ${JSON.stringify(st)}`)
      check(`[${W}] ① ${label}: 자리표시 ≥500ms(이전 ~30ms)`, st.seen && st.busyMs !== null && st.busyMs >= 480, `busyMs=${st.busyMs} 클릭→오류 복귀=${st.clickToErrMs}ms`)
      check(`[${W}] ① ${label}: 다시 실패하면 같은 오류 상자`, errAgain)
      await page.close()
    }

    // ── ② S6 자리표시 점프(응답 1.5초 지연) ─────────────────────────────
    for (const variant of ['real', 'stripped']) {
      const page = await ctx.newPage()
      page.setDefaultTimeout(60_000)
      await page.route((u) => [isTopics, isScen, isOv, isCh].some((f) => f(u)), async (r) => {
        const resp = await r.fetch()
        await sleep(1500)
        if (variant === 'stripped' && isTopics(new URL(r.request().url()))) {
          const j = await resp.json()
          const items = j.data?.items ?? j.items
          const it = items.find((x) => x.id === T.id)
          delete it.description
          it.titleJa = null
          await r.fulfill({ response: resp, json: j })
        } else await r.fulfill({ response: resp })
      })
      await page.goto(`${BASE}${S6}`, { waitUntil: 'commit' })
      await page.waitForSelector('main [role=status]', { state: 'attached' })
      await page.waitForTimeout(600)
      const L = await page.evaluate(() => {
        const main = document.querySelector('main')
        const spans = [...document.querySelectorAll('div.mx-auto.min-w-0 div[aria-hidden=true] > span.block')]
        return { skeleton: [...main.querySelectorAll('[role=status]')].some((e) => /불러오는 중/.test(e.textContent)), spans: spans.map((s) => { const r = s.getBoundingClientRect(); return [Math.round(r.height * 10) / 10, Math.round((r.top + main.scrollTop) * 10) / 10] }), scrollH: main.scrollHeight }
      })
      await page.waitForSelector('section[aria-labelledby=tp-chunks]', { timeout: 20_000 })
      await page.waitForTimeout(600)
      const R = await page.evaluate(() => {
        const main = document.querySelector('main')
        const container = document.querySelector('div.mx-auto.min-w-0')
        const kids = [...container.children]
        const pos = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.height * 10) / 10, Math.round((r.top + main.scrollTop) * 10) / 10] }
        return { head: pos(kids[0]), info: pos(kids[1]), chunks: pos(document.querySelector('section[aria-labelledby=tp-chunks]')), sc: pos(document.querySelector('section[aria-labelledby=tp-scenarios]')), scrollH: main.scrollHeight, nKids: kids.length }
      })
      note(`[${W}] ② ${variant} L=${JSON.stringify(L)} R=${JSON.stringify(R)}`)
      const [skHead, skInfo, skChunks, skSc] = L.spans
      const headDiff = Math.round((R.head[0] - skHead[0]) * 10) / 10
      const infoShift = Math.round((R.info[1] - skInfo[1]) * 10) / 10
      const chunksShift = Math.round((R.chunks[1] - skChunks[1]) * 10) / 10
      const scShift = Math.round((R.sc[1] - skSc[1]) * 10) / 10
      check(`[${W}] ② ${variant}: 자리표시 보임·4블록`, L.skeleton && L.spans.length === 4, JSON.stringify(L.spans))
      const gate = variant === 'real'
      const msg = `머리 카드 실제 ${R.head[0]} vs 자리표시 ${skHead[0]} (차 ${headDiff}) · 출처 상자 top ${skInfo[1]}→${R.info[1]} (이동 ${infoShift}) · 표현 절 top ${skChunks[1]}→${R.chunks[1]} (이동 ${chunksShift}) · 상황 절 top ${skSc[1]}→${R.sc[1]} (이동 ${scShift}, 표현 개수 의존 — 참고) · main.scrollHeight ${L.scrollH}→${R.scrollH}`
      if (gate) {
        check(`[${W}] ② real: 머리 카드 높이 차 ≤8px(이전 +22.5)`, Math.abs(headDiff) <= 8, msg)
        check(`[${W}] ② real: 출처 상자 위치 이동 ≤8px(이전 +26.5)`, Math.abs(infoShift) <= 8, `이동 ${infoShift}`)
        check(`[${W}] ② real: 표현 절 위치 이동 ≤8px(이전 +35.5)`, Math.abs(chunksShift) <= 8, `이동 ${chunksShift}`)
        note(`[${W}] ② real 상황 절 이동 ${scShift}px(참고 — 표현 절이 자리표시 240 과 다른 만큼)`)
      } else note(`[${W}] ② stripped(일본어명·설명 없음, 줄어드는 방향 — 크기만 기록): ${msg}`)
      await page.close()
    }

    // ── ③ 상황 탭 자리표시(1.5초 지연) ─────────────────────────────────
    {
      const page = await ctx.newPage()
      page.setDefaultTimeout(60_000)
      await page.route((u) => [isTopics, isScen, isOv, isCh].some((f) => f(u)), async (r) => {
        const resp = await r.fetch()
        await sleep(1500)
        await r.fulfill({ response: resp })
      })
      await page.goto(`${BASE}/settings/scenarios?tab=scenarios`, { waitUntil: 'commit' })
      await page.waitForSelector('main [role=status]', { state: 'attached' })
      await page.waitForTimeout(600)
      const L = await page.evaluate(() => {
        const main = document.querySelector('main')
        const h = (e) => Math.round(e.getBoundingClientRect().height * 10) / 10
        const t = (e) => Math.round((e.getBoundingClientRect().top + main.scrollTop) * 10) / 10
        const sp = [...main.querySelectorAll('div[aria-hidden=true] > span.block')]
        return { skeleton: [...main.querySelectorAll('[role=status]')].some((e) => /불러오는 중/.test(e.textContent)), hs: sp.map(h), tops: sp.map(t), scrollH: main.scrollHeight }
      })
      await page.waitForSelector('main ul li', { timeout: 20_000 })
      await page.waitForTimeout(600)
      const R = await page.evaluate(() => {
        const main = document.querySelector('main')
        const lis = [...main.querySelectorAll('ul li')]
        const chip = main.querySelector('[role=radiogroup][aria-label="상황 보기 범위"]')
        const t = (e) => Math.round((e.getBoundingClientRect().top + main.scrollTop) * 10) / 10
        return { cardHs: lis.map((e) => Math.round(e.getBoundingClientRect().height * 10) / 10), firstTop: t(lis[0]), chipH: Math.round(chip.getBoundingClientRect().height * 10) / 10, scrollH: main.scrollHeight }
      })
      note(`[${W}] ③ L=${JSON.stringify(L)} R=${JSON.stringify({ n: R.cardHs.length, cardHs: R.cardHs, firstTop: R.firstTop, chipH: R.chipH, scrollH: R.scrollH })}`)
      const skCard = L.hs[1]
      const jump = Math.round(Math.abs(R.cardHs[0] - skCard) * 10) / 10
      check(`[${W}] ③ 자리표시 보임(칩 44 + 카드 칸)`, L.skeleton && L.hs[0] === 44, JSON.stringify(L.hs))
      check(`[${W}] ③ 첫 카드 실제 vs 자리표시 점프 ≤8px(이전 88 vs 121 = 33)`, jump <= 8, `자리표시 ${skCard} 실제 ${R.cardHs[0]} 차 ${jump}; 카드 높이 분포 ${[...new Set(R.cardHs)].join('/')}`)
      check(`[${W}] ③ 칩 줄 높이 44 ±8`, Math.abs(R.chipH - 44) <= 8, `chip=${R.chipH}`)
      await page.close()
    }
    await ctx.close()

    // ── ④ 긴 한글 가로 넘침(QA3 주제 S6·S2 목록·S7) ──────────────────────
    {
      const c = await ctxFor(browser, W, H, c3)
      for (const [name, path] of [['S6 주제 보기', `/settings/scenarios/topics/${longId}`], ['S2 내 주제 목록', '/settings/scenarios?tab=topics'], ['S7 주제 고치기', `/settings/scenarios/topics/${longId}/edit`]]) {
        const page = await c.newPage()
        page.setDefaultTimeout(60_000)
        await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
        await page.locator('main').getByText(longTitle.slice(0, 5), { exact: false }).first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
        if (name.startsWith('S7')) await page.waitForSelector('input,textarea', { timeout: 40_000 }).catch(() => {})
        await page.waitForTimeout(1000)
        const m = await page.evaluate(() => {
          const main = document.querySelector('main')
          const inner = [...document.querySelectorAll('main .overflow-y-auto, main')].map((e) => e.scrollWidth + '/' + e.clientWidth)
          const cw = document.documentElement.clientWidth
          const texts = []
          for (const el of main.querySelectorAll('*')) for (const n of el.childNodes) {
            if (n.nodeType !== 3 || !(n.textContent ?? '').trim()) continue
            const r = document.createRange()
            r.selectNodeContents(n)
            for (const q of r.getClientRects()) if (q.right > cw + 0.5 || q.left < -0.5) texts.push({ tag: el.tagName, txt: n.textContent.trim().slice(0, 14), right: Math.round(q.right) })
          }
          const vals = [...main.querySelectorAll('input,textarea')].map((e) => ({ id: e.id || e.getAttribute('name') || e.tagName, len: (e.value ?? '').length, sw: e.scrollWidth, cw: e.clientWidth }))
          return { mainSW: main.scrollWidth, mainCW: main.clientWidth, docSW: document.documentElement.scrollWidth, inner, textsOut: texts.slice(0, 4), nIn: vals.length, longest: vals.reduce((a, v) => (v.len > a ? v.len : a), 0) }
        })
        const ov = await overflow(page)
        note(`[${W}] ④ ${name}: ${JSON.stringify(m)} overflowEls=${JSON.stringify(ov.items)}`)
        check(`[${W}] ④ ${name}: main.scrollWidth ≤ clientWidth(이전 1227)`, m.mainSW <= m.mainCW && m.docSW <= W, `main ${m.mainSW}/${m.mainCW} doc ${m.docSW}`)
        check(`[${W}] ④ ${name}: 글자 우측 ≤ 뷰포트(Range 실측)·넘친 요소 0`, m.textsOut.length === 0 && ov.count === 0, JSON.stringify({ textsOut: m.textsOut, ov: ov.items }))
        if (name.startsWith('S7')) note(`[${W}] ④ S7 입력칸 ${m.nIn}개·가장 긴 값 ${m.longest}자`)
        await page.close()
      }
      await c.close()
    }
  }
} finally {
  await closeBrowser(browser)
  const cf = await cleanupQa(u3.id)
  const c31 = await qaRowCounts(u3.id)
  const c21 = await qaRowCounts(u2.id)
  const h1 = await seedHash()
  note(`정리 ${JSON.stringify(cf)} → QA3 행 ${JSON.stringify(c31)} QA2 행 ${JSON.stringify(c21)}`)
  check('종료: QA3·QA2 행 0', Object.values(c31).every((n) => n === 0) && Object.values(c21).every((n) => n === 0), JSON.stringify([c31, c21]))
  check(`종료: 시드 해시 불변 ${h1.sha}`, h1.sha === SEED_SHA, `${h0.sha} → ${h1.sha}`)
  summary('qa-045-ui-f item1')
  await prisma.$disconnect()
  process.exit(0)
}
