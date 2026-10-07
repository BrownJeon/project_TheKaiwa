/**
 * qa-045-ui-a 항목 2 — S2 주제 탭 데이터 정합·부분 실패·자리표시 점프. 실행: SP=<scratchpad> node item2.mjs
 * 읽기 전용(쓰기 요청 0). 부분 실패·긴 제목·챌린지 뱃지는 `page.route` fixture(표시한 것만 fixture).
 */
import { api, BASE, check, launch, newCtx, overflowReport, SHOTS, sleep, summary, WIDTHS } from './lib.mjs'

const jt = await api('/api/v1/topics?level=all')
const topics = jt.json?.data?.items ?? jt.json?.items ?? []
const seedTopics = topics.filter((t) => t.isSeed)
const mineTopics = topics.filter((t) => !t.isSeed)
const scRes = await api('/api/v1/scenarios?limit=100')
const scItems = scRes.json?.data?.items ?? []
const scNext = scRes.json?.data?.nextCursor ?? null
const ov = await api('/api/v1/seed-overrides')
const ch = await api('/api/v1/challenges?status=ACTIVE&limit=1')
const scenarioCount = (id) => scItems.filter((s) => (s.topics ?? []).some((t) => t.id === id)).length
console.log('API', JSON.stringify({ topics: topics.length, seed: seedTopics.length, mine: mineTopics.length, scenarios: scItems.length, nextCursor: scNext, overrides: ov.json?.data?.items?.length, activeChallenges: ch.json?.data?.items?.length }))
check('2.api-baseline', seedTopics.length === 5 && mineTopics.length === 0 && (ov.json?.data?.items?.length ?? -1) === 0 && (ch.json?.data?.items?.length ?? -1) === 0 && scNext === null, `seed=${seedTopics.length} mine=${mineTopics.length} overrides=${ov.json?.data?.items?.length} activeChallenge=${ch.json?.data?.items?.length} scenarios=${scItems.length} nextCursor=${scNext}`)

const isTopicsList = (u) => u.pathname === '/api/v1/topics'
const isScen = (u) => u.pathname === '/api/v1/scenarios'
const isOv = (u) => u.pathname === '/api/v1/seed-overrides'
const isCh = (u) => u.pathname === '/api/v1/challenges'

const readRows = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('a[data-topic-id]')].map((a) => {
      const r = a.getBoundingClientRect()
      const t = a.querySelector('span.truncate')
      const cs = t ? getComputedStyle(t) : null
      const ja = a.querySelector('[lang="ja"]')
      const jacs = ja ? getComputedStyle(ja) : null
      return {
        id: a.dataset.topicId,
        h: Math.round(r.height * 10) / 10,
        left: Math.round(r.left),
        right: Math.round(r.right),
        title: t?.textContent ?? null,
        titleEllipsis: t ? cs.textOverflow === 'ellipsis' && cs.whiteSpace === 'nowrap' && cs.overflow === 'hidden' : null,
        titleClipped: t ? t.scrollWidth > t.clientWidth : null,
        jaEllipsis: ja ? jacs.textOverflow === 'ellipsis' && jacs.whiteSpace === 'nowrap' : null,
        jaClipped: ja ? ja.scrollWidth > ja.clientWidth : null,
        badges: [...a.querySelectorAll('span.flex-none.rounded-md')].map((b) => ({ t: b.textContent, fs: getComputedStyle(b).flexShrink, w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height), top: Math.round(b.getBoundingClientRect().top - r.top) })),
        meta: a.querySelector('span.flex-wrap')?.innerText ?? null,
        text: a.innerText,
      }
    }),
  )

async function openPage(ctx, query, setup) {
  const page = await ctx.newPage()
  page.setDefaultTimeout(60_000)
  const reqs = []
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (u.pathname.startsWith('/api/')) reqs.push(`${r.method()} ${u.pathname}${u.search}`)
  })
  if (setup) await setup(page)
  await page.goto(`${BASE}/settings/scenarios${query}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  page.__reqs = reqs
  return page
}

/** 페이지 안에서 상태 변화를 시간순 기록 — [다시 시도] 직후 자리표시·오류가 얼마나 보이는지 */
const installRecorder = (page) =>
  page.evaluate(() => {
    window.__log = []
    const t0 = performance.now()
    let last = ''
    const snap = () => {
      const main = document.querySelector('main')
      return {
        busy: !!main.querySelector('[aria-busy="true"]'),
        skel: [...main.querySelectorAll('[role=status]')].some((e) => /불러오는 중/.test(e.textContent)),
        err: main.innerText.includes('목록을 불러오지 못했어요'),
        rows: main.querySelectorAll('a[data-topic-id]').length,
      }
    }
    const rec = () => {
      const s = snap()
      const k = JSON.stringify(s)
      if (k !== last) {
        last = k
        window.__log.push([Math.round(performance.now() - t0), s])
      }
    }
    new MutationObserver(rec).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
    rec()
  })
const busyWindow = (log) => {
  const start = log.find(([, s]) => s.busy || s.skel)
  if (!start) return { seen: false, ms: 0 }
  const after = log.filter(([t]) => t > start[0]).find(([, s]) => !s.busy && !s.skel)
  return { seen: true, ms: after ? after[0] - start[0] : null }
}

const browser = await launch()
for (const vp of WIDTHS) {
  const tag = `${vp.w}`
  const ctx = await newCtx(browser, vp)

  // ── A. 실데이터 정합 ──────────────────────────────────────────
  {
    const page = await openPage(ctx, '?tab=topics')
    const rows = await readRows(page)
    const info = await page.evaluate(() => ({
      h2: [...document.querySelectorAll('main h2')].map((h) => h.textContent),
      radios: [...document.querySelectorAll('main [role=radio]')].map((r) => r.textContent?.trim()),
      dashed: [...document.querySelectorAll('main .border-dashed')].map((d) => ({ t: d.textContent, h: Math.round(d.getBoundingClientRect().height) })),
      hiddenBtn: !![...document.querySelectorAll('main button')].find((b) => /숨긴 기본 항목/.test(b.textContent)),
      sub: [...document.querySelectorAll('main p')].map((p) => p.textContent).find((t) => /내 주제 \d+\/30/.test(t)) ?? null,
      challengeText: /챌린지/.test(document.querySelector('main').innerText),
      createBtn: (() => { const a = [...document.querySelectorAll('main a')].find((x) => /주제 만들기/.test(x.textContent)); if (!a) return null; const r = a.getBoundingClientRect(); return { href: a.getAttribute('href'), h: Math.round(r.height), w: Math.round(r.width) } })(),
    }))
    console.log(`[${tag}] A rows`, JSON.stringify(rows.map((r) => ({ id: r.id.slice(-4), h: r.h, meta: r.meta, badges: r.badges.map((b) => b.t).join('/') }))))
    console.log(`[${tag}] A info`, JSON.stringify(info))
    check(`2.A.row-count=5@${tag}`, rows.length === 5, `rows=${rows.length}`)
    check(`2.A.titles-match-api@${tag}`, seedTopics.every((t) => rows.some((r) => r.id === t.id && r.title === t.title)), '')
    const metaOk = seedTopics.every((t) => {
      const r = rows.find((x) => x.id === t.id)
      return !!r && r.meta.replace(/\s+/g, ' ').trim() === `상황 ${scenarioCount(t.id)}개 · 기본 표현 ${t.chunks.length}개`
    })
    check(`2.A.meta=상황n개·표현m개 == #161/#56@${tag}`, metaOk, rows.map((r) => `${r.title}:${r.meta?.replace(/\s+/g, ' ')}`).join(' | '))
    check(`2.A.badges-seed(level+기본)@${tag}`, rows.every((r) => r.badges.length === 2 && r.badges[1].t === '기본' && /^N[1-5]$/.test(r.badges[0].t)), rows.map((r) => r.badges.map((b) => b.t).join('/')).join(' '))
    check(`2.A.badge-flex-none(shrink0)@${tag}`, rows.every((r) => r.badges.every((b) => b.fs === '0')), '')
    check(`2.A.row-height>=76(actual)@${tag}`, rows.every((r) => r.h >= 76), `min=${Math.min(...rows.map((r) => r.h))} max=${Math.max(...rows.map((r) => r.h))} heights=${rows.map((r) => r.h).join(',')}`)
    check(`2.A.title-ellipsis-css@${tag}`, rows.every((r) => r.titleEllipsis === true), '')
    check(`2.A.section-titles@${tag}`, info.h2.includes('내가 만든 주제 0개') && info.h2.includes('기본 주제 5개'), JSON.stringify(info.h2))
    check(`2.A.segmented-counts(주제5·상황10)@${tag}`, info.radios.includes('주제 5') && info.radios.includes(`상황 ${scItems.length}`), JSON.stringify(info.radios))
    check(`2.A.mine-empty-dashed-box@${tag}`, info.dashed.length === 1 && /아직 만든 주제가 없어요/.test(info.dashed[0].t), JSON.stringify(info.dashed))
    check(`2.A.mine-count-0/30@${tag}`, !!info.sub && /내 주제 0\/30/.test(info.sub), info.sub ?? 'null')
    check(`2.A.no-hidden-row@${tag}`, info.hiddenBtn === false)
    check(`2.A.no-challenge-badge(no active)@${tag}`, info.challengeText === false)
    check(`2.A.create-btn>=44@${tag}`, !!info.createBtn && info.createBtn.h >= 44, JSON.stringify(info.createBtn))
    // dev 서버는 reactStrictMode:true(next.config.ts:7) 라 마운트 효과가 2번 돈다 — 각 요청이 1 또는 2회(같은 횟수)면 재발 루프 없음. 운영 빌드 1회는 NOT_VERIFIED(빌드 미수행).
    const reqCounts = ['/api/v1/topics?level=all', '/api/v1/seed-overrides', '/api/v1/scenarios?limit=100', '/api/v1/challenges?status=ACTIVE&limit=1'].map((p) => page.__reqs.filter((q) => q === `GET ${p}`).length)
    check(`2.A.requests: 4 calls each ≤2 (dev StrictMode double mount), equal counts@${tag}`, reqCounts.every((c) => c >= 1 && c <= 2 && c === reqCounts[0]), `counts(#56,#179,#161,#155)=${reqCounts.join(',')}`)
    const ovr = await overflowReport(page)
    check(`2.A.no-hscroll@${tag}`, !ovr.docOverflowX && !ovr.mainOverflowX && ovr.overflowCount === 0, JSON.stringify({ doc: ovr.docScrollWidth, cw: ovr.clientWidth, mainSW: ovr.mainScrollW, mainCW: ovr.mainClientW, cnt: ovr.overflowCount, els: ovr.overflowEls }))
    check(`2.A.no-page-vscroll@${tag}`, ovr.pageVScroll === false, `docScrollH=${ovr.docScrollH} innerH=${ovr.innerHeight}`)
    if (vp.w === 390) await page.screenshot({ path: `${SHOTS}/item2-topics-390.png` })
    await page.close()
  }

  // ── B-0. fixture: 긴 제목·긴 일본어명·3자리 챌린지 뱃지 ─────────────────
  {
    const longKo = '아주 아주 긴 주제 이름을 일부러 길게 적어서 한 줄에 다 안 들어가게 만든 시험용 제목입니다'
    const longJa = '非常に長い日本語のタイトルをわざと長くして一行に収まらないようにしたテスト用の題名です'
    const page = await openPage(ctx, '?tab=topics', async (p) => {
      await p.route(isTopicsList, async (r) => {
        const resp = await r.fetch()
        const j = await resp.json()
        const items = j.data?.items ?? j.items
        items[0].title = longKo
        items[0].titleJa = longJa
        await r.fulfill({ response: resp, json: j })
      })
      await p.route(isCh, (r) => r.fulfill({ json: { success: true, data: { items: [{ id: 'qa-fixture-chal', status: 'ACTIVE', topic: { id: seedTopics[0].id, title: longKo }, stats: { dayIndex: 123 } }], nextCursor: null }, message: null } }))
    })
    const rows = await readRows(page)
    const r0 = rows.find((r) => r.id === seedTopics[0].id)
    const radios = await page.evaluate(() => [...document.querySelectorAll('main [role=radio]')].map((r) => ({ t: r.textContent?.trim(), clipped: r.scrollWidth > r.clientWidth })))
    console.log(`[${tag}] B0 fixture row`, JSON.stringify({ h: r0?.h, titleClipped: r0?.titleClipped, jaClipped: r0?.jaClipped, badges: r0?.badges, meta: r0?.meta?.replace(/\s+/g, ' '), right: r0?.right }))
    check(`2.B0.long-title-ellipsis[fixture]@${tag}`, !!r0 && r0.titleEllipsis === true && r0.titleClipped === true && r0.jaEllipsis === true && r0.jaClipped === true, `titleClipped=${r0?.titleClipped} jaClipped=${r0?.jaClipped}`)
    check(`2.B0.badges-not-shrunk-long-title[fixture]@${tag}`, !!r0 && r0.badges.length === 3 && r0.badges.every((b) => b.fs === '0' && b.h === 22) && r0.badges.slice(0, 2).every((b) => b.top < 40), JSON.stringify(r0?.badges))
    check(`2.B0.challenge-badge-123-text[fixture]@${tag}`, !!r0 && /챌린지 123일째/.test(r0.meta ?? ''), r0?.meta?.replace(/\s+/g, ' ') ?? '')
    check(`2.B0.row-inside-viewport[fixture]@${tag}`, !!r0 && r0.right <= vp.w - 16 + 1, `right=${r0?.right} viewport=${vp.w}`)
    check(`2.B0.segmented-no-clip[fixture]@${tag}`, radios.every((x) => !x.clipped), JSON.stringify(radios))
    const ovr = await overflowReport(page)
    check(`2.B0.no-hscroll[fixture]@${tag}`, !ovr.docOverflowX && !ovr.mainOverflowX && ovr.overflowCount === 0, JSON.stringify({ doc: ovr.docScrollWidth, cw: ovr.clientWidth, cnt: ovr.overflowCount, els: ovr.overflowEls }))
    if (vp.w === 360) await page.screenshot({ path: `${SHOTS}/item2-fixture-longtitle-360.png` })
    await page.close()
  }

  // ── B. 부분 실패 ──────────────────────────────────────────────
  {
    // B1 #155 만 abort
    let page = await openPage(ctx, '?tab=topics', (p) => p.route(isCh, (r) => r.abort()))
    let rows = await readRows(page)
    check(`2.B1.#155-abort: list visible, 상황 n개 kept, no badge@${tag}`, rows.length === 5 && rows.every((r) => /^상황 \d+개 · 기본 표현 \d+개$/.test(r.meta.replace(/\s+/g, ' '))) && !rows.some((r) => /챌린지/.test(r.text)), `rows=${rows.length} meta0=${rows[0]?.meta}`)
    check(`2.B1.#155-abort: no error box@${tag}`, (await page.locator('main [role=alert]').count()) === 0)
    await page.close()

    // B2 #161 만 abort
    page = await openPage(ctx, '?tab=topics', (p) => p.route(isScen, (r) => r.abort()))
    rows = await readRows(page)
    const radios2 = await page.evaluate(() => [...document.querySelectorAll('main [role=radio]')].map((r) => r.textContent?.trim()))
    check(`2.B2.#161-abort: list visible, only 기본 표현 n개@${tag}`, rows.length === 5 && rows.every((r) => /^기본 표현 \d+개$/.test(r.meta.replace(/\s+/g, ' '))) && !rows.some((r) => /상황 \d/.test(r.meta)), `rows=${rows.length} meta0=${rows[0]?.meta?.replace(/\s+/g, ' ')}`)
    check(`2.B2.#161-abort: tab label has no number(상황)@${tag}`, radios2.includes('상황') && radios2.includes('주제 5'), JSON.stringify(radios2))
    check(`2.B2.#161-abort: topics tab no error box@${tag}`, (await page.locator('main [role=alert]').count()) === 0)
    // 상황 탭 → 오류 상자 → 다시 시도
    await page.getByRole('radio', { name: '상황' }).tap()
    await page.waitForTimeout(500)
    check(`2.B2.#161-abort: scenarios tab ErrorBox@${tag}`, (await page.locator('main [role=alert]').count()) === 1 && (await page.locator('main [role=alert] button').innerText()) === '다시 시도')
    await installRecorder(page)
    await page.locator('main [role=alert] button').tap()
    await page.waitForTimeout(1600)
    const log2 = await page.evaluate(() => window.__log)
    const bw2 = busyWindow(log2)
    const errAfter = (await page.locator('main [role=alert] b').innerText().catch(() => '')) === '목록을 불러오지 못했어요'
    console.log(`[${tag}] B2 retry log`, JSON.stringify(log2))
    check(`2.B2.#161 retry: aria-busy placeholder >=0.5s@${tag}`, bw2.seen && bw2.ms !== null && bw2.ms >= 480, `visibleMs=${bw2.ms}`)
    check(`2.B2.#161 retry: same error again after failure@${tag}`, errAfter)
    await page.close()

    // B3 #155·#161 둘 다 abort
    page = await openPage(ctx, '?tab=topics', async (p) => {
      await p.route(isCh, (r) => r.abort())
      await p.route(isScen, (r) => r.abort())
    })
    rows = await readRows(page)
    check(`2.B3.both-abort: list visible, no badge, only 표현 n개@${tag}`, rows.length === 5 && rows.every((r) => /^기본 표현 \d+개$/.test(r.meta.replace(/\s+/g, ' '))) && !rows.some((r) => /챌린지/.test(r.text)))
    check(`2.B3.both-abort: no error box on topics tab@${tag}`, (await page.locator('main [role=alert]').count()) === 0)
    await page.close()

    // B4 #56 abort
    page = await openPage(ctx, '?tab=topics', (p) => p.route(isTopicsList, (r) => r.abort()))
    rows = await readRows(page)
    const txt4 = await page.locator('main').innerText()
    check(`2.B4.#56-abort: ErrorBox + no rows + no 'empty mine' claim@${tag}`, (await page.locator('main [role=alert]').count()) === 1 && rows.length === 0 && !/아직 만든 주제가 없어요/.test(txt4), `alerts=${await page.locator('main [role=alert]').count()} rows=${rows.length}`)
    await installRecorder(page)
    await page.locator('main [role=alert] button').tap()
    await page.waitForTimeout(1600)
    const log4 = await page.evaluate(() => window.__log)
    const bw4 = busyWindow(log4)
    console.log(`[${tag}] B4 retry log`, JSON.stringify(log4))
    const sawAriaBusy4 = log4.some(([, s]) => s.busy)
    check(`2.B4.#56 retry: placeholder shown >=0.5s@${tag}`, bw4.seen && bw4.ms !== null && bw4.ms >= 480, `placeholderVisibleMs=${bw4.ms} sawAriaBusyAttr=${sawAriaBusy4} (Skeleton uses role=status, aria-busy only on #161-retry wrapper)`)
    check(`2.B4.#56 retry: same ErrorBox again@${tag}`, (await page.locator('main [role=alert] b').innerText().catch(() => '')) === '목록을 불러오지 못했어요')
    // scenarios tab shows the same ErrorBox
    await page.getByRole('radio', { name: '상황' }).tap()
    await page.waitForTimeout(400)
    check(`2.B4.#56-abort: scenarios tab ErrorBox too@${tag}`, (await page.locator('main [role=alert]').count()) === 1)
    await page.close()

    // B5 #179 abort
    page = await openPage(ctx, '?tab=topics', (p) => p.route(isOv, (r) => r.abort()))
    rows = await readRows(page)
    const txt5 = await page.locator('main').innerText()
    check(`2.B5.#179-abort: ErrorBox, no rows (no wrong '내 주제' label)@${tag}`, (await page.locator('main [role=alert]').count()) === 1 && rows.length === 0 && !/내 주제(?!\s*\d+\/30)/.test(txt5.replace(/내 주제 \d+\/30/g, '')) && !/아직 만든 주제가 없어요/.test(txt5), `rows=${rows.length}`)
    await page.getByRole('radio', { name: '상황' }).tap()
    await page.waitForTimeout(400)
    check(`2.B5.#179-abort: scenarios tab ErrorBox too@${tag}`, (await page.locator('main [role=alert]').count()) === 1 && (await page.locator('main li').count()) === 0)
    if (vp.w === 390) await page.screenshot({ path: `${SHOTS}/item2-179-abort-390.png` })
    await page.close()
  }

  // ── C. 자리표시 높이 점프(응답 1.5초 지연) ─────────────────────────────
  for (const tab of ['topics', 'scenarios']) {
    const page = await ctx.newPage()
    page.setDefaultTimeout(60_000)
    await page.addInitScript(() => {
      window.__cls = 0
      window.__shifts = []
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push(Math.round(e.value * 1000) / 1000) }
      }).observe({ type: 'layout-shift', buffered: true })
    })
    await page.route(
      (u) => [isTopicsList, isScen, isOv, isCh].some((f) => f(u)),
      async (r) => {
        const resp = await r.fetch()
        await sleep(1500)
        await r.fulfill({ response: resp })
      },
    )
    await page.goto(`${BASE}/settings/scenarios?tab=${tab}`, { waitUntil: 'commit' })
    await page.waitForSelector('main [role=status]', { state: 'attached' })
    await page.waitForTimeout(600)
    const measure = () =>
      page.evaluate(() => {
        const main = document.querySelector('main')
        const mine = document.querySelector('#mg-mine')
        const seed = document.querySelector('#mg-seed')
        const top = (el) => (el ? Math.round((el.getBoundingClientRect().top + main.scrollTop) * 10) / 10 : null)
        const h = (el) => (el ? Math.round(el.getBoundingClientRect().height * 10) / 10 : null)
        const mineSec = mine?.closest('section')
        const seedSec = seed?.closest('section')
        const mineBox = mineSec ? [...mineSec.children].find((c) => c !== mine) : null
        const seedBlocks = seedSec ? [...seedSec.querySelectorAll('span.block, a[data-topic-id]')] : []
        const chipRow = document.querySelector('main [role=radiogroup][aria-label="상황 보기 범위"]')
        const firstCard = document.querySelector('main ul li')
        return {
          scrollHeight: main.scrollHeight,
          mineBox: h(mineBox),
          mineBoxKind: mineBox ? (mineBox.matches('.border-dashed') ? 'dashed' : mineBox.querySelector('[role=status]') ? 'skeleton' : 'list') : null,
          mineHeadTop: top(mine),
          seedHeadTop: top(seed),
          seedItemHeights: seedBlocks.map((e) => h(e)),
          chipRowH: h(chipRow),
          chipTop: top(chipRow),
          firstCardTop: top(firstCard),
          firstCardH: h(firstCard),
          cardCount: document.querySelectorAll('main ul li').length,
          skeleton: [...main.querySelectorAll('[role=status]')].some((e) => /불러오는 중/.test(e.textContent)),
          skelSpanHeights: [...main.querySelectorAll('div[aria-hidden=true] > span.block')].map((e) => h(e)),
        }
      })
    const L = await measure()
    await page.waitForSelector(tab === 'topics' ? 'a[data-topic-id]' : 'main ul li', { timeout: 15_000 })
    await page.waitForTimeout(600)
    const R = await measure()
    const cls = await page.evaluate(() => ({ cls: Math.round(window.__cls * 1000) / 1000, shifts: window.__shifts }))
    console.log(`[${tag}] C ${tab} L`, JSON.stringify(L))
    console.log(`[${tag}] C ${tab} R`, JSON.stringify(R))
    console.log(`[${tag}] C ${tab} CLS`, JSON.stringify(cls))
    if (tab === 'topics') {
      const seedShift = Math.abs((R.seedHeadTop ?? 0) - (L.seedHeadTop ?? 0))
      const mineBoxShift = Math.abs((R.mineBox ?? 0) - (L.mineBox ?? 0))
      const firstRowDiff = Math.abs((R.seedItemHeights[0] ?? 0) - (L.seedItemHeights[0] ?? 0))
      const rowDiffs = R.seedItemHeights.map((x, i) => Math.round(Math.abs(x - (L.seedItemHeights[Math.min(i, L.seedItemHeights.length - 1)] ?? 0)) * 10) / 10)
      check(`2.C.topics loading shows skeleton(not '아직 없어요')@${tag}`, L.skeleton === true && L.mineBoxKind === 'skeleton' && R.mineBoxKind === 'dashed', `L.kind=${L.mineBoxKind} R.kind=${R.mineBoxKind}`)
      check(`2.C.topics '기본 주제' heading jump <=8px@${tag}`, seedShift <= 8, `L.seedHeadTop=${L.seedHeadTop} R.seedHeadTop=${R.seedHeadTop} diff=${seedShift} (mine box L=${L.mineBox} R=${R.mineBox} diff=${mineBoxShift})`)
      check(`2.C.topics first row placeholder vs real <=8px@${tag}`, firstRowDiff <= 8, `L.placeholder=${L.seedItemHeights[0]} R.firstRow=${R.seedItemHeights[0]} diff=${firstRowDiff} allRowDiffs=${rowDiffs.join(',')}`)
      check(`2.C.topics scrollHeight L→R (info; 3 placeholders vs 5 rows)@${tag}`, true, `L=${L.scrollHeight} R=${R.scrollHeight} diff=${R.scrollHeight - L.scrollHeight}`)
      check(`2.C.topics CLS(info)@${tag}`, true, `cls=${cls.cls} shifts=${JSON.stringify(cls.shifts)}`)
    } else {
      check(`2.C.scenarios placeholder skeleton heights(info)@${tag}`, true, `L.skel=${JSON.stringify(L.skelSpanHeights)} R.chipRowH=${R.chipRowH} R.firstCardH=${R.firstCardH} R.cards=${R.cardCount} scrollHeight L=${L.scrollHeight} R=${R.scrollHeight} CLS=${cls.cls}`)
      const chipH = R.chipRowH
      check(`2.C.scenarios chip row 44 vs real<=8px@${tag}`, chipH !== null && Math.abs(chipH - 44) <= 8, `placeholder=44 real=${chipH}`)
      check(`2.C.scenarios(참고·항목2 범위 밖) first card placeholder 88 vs real<=8px@${tag}`, R.firstCardH !== null && Math.abs(R.firstCardH - 88) <= 8, `placeholder=88 real=${R.firstCardH} diff=${R.firstCardH === null ? 'n/a' : Math.round(Math.abs(R.firstCardH - 88) * 10) / 10} (nothing below moves except more cards)`)
    }
    await page.close()
  }
  await ctx.close()
}
await browser.close()
summary()
