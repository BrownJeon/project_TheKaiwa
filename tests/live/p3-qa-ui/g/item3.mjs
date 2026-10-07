/**
 * qa-045-ui-g 항목 3 — ① S6·S7 오류 상자 [다시 시도] 최소 표시(≥500ms, 이전 ~30ms)·성공하면 기다리지 않음, ② 변형 화면 붙잡은 알림(role=alert) 같은 실패 연속 3회 재마운트·위치·초점 불변.
 * LLM 0(#177 은 page.route 모의 422 NOT_A_VARIANT). QA2(읽기 전용) 쿠키만, DB 쓰기 0. 시드 해시 시작·끝 단언.
 * 실행: cd $Q && QA_BASE=http://127.0.0.1:3060 QA_SNAPSHOT=$Q QA_COOKIE=<c2 쿠키 파일> node --env-file=.env <이 파일>   (QA_COOKIE 에 QA2 쿠키)
 * 재사용: ../e/lib.mjs · ../e/ui.mjs · ../f/item1.mjs 의 기록기 방식 · ../f/item2.mjs 의 선택자·모의(F4).
 */
import { api, data, check, note, summary, launch, openPage, cookieOf, sleep, WIDTHS, BASE, SEED_SC, QA2, qaUser, qaRowCounts, seedHash, prisma, closeBrowser } from '../e/lib.mjs'
import { errEnv, mockPost, tap } from '../e/ui.mjs'

const c2 = cookieOf(process.env.QA_COOKIE)
const SEED_SHA = 'e826f3ef09237a9c'
const DRAFTS = '**/api/v1/scenarios/*/variants/drafts'
const SUBMIT = '변형 초안 만들기'
const isTopics = (u) => u.pathname === '/api/v1/topics'
const API_PATHS = ['/api/v1/topics', '/api/v1/scenarios', '/api/v1/seed-overrides', '/api/v1/challenges']

const u2 = await qaUser(QA2)
const h0 = await seedHash()
const c20 = await qaRowCounts(u2.id)
check('시작: 시드 해시 = e826f3ef09237a9c', h0.sha === SEED_SHA, h0.sha)
check('시작: QA2 행 0', Object.values(c20).every((n) => n === 0), JSON.stringify(c20))
const seedId = (data(await api(c2, 'GET', '/api/v1/topics?level=all'))?.items ?? []).find((t) => t.isSeed && t.title === '자기소개').id

/** 페이지 안 기록기 — 클릭 시각(capture)·자리표시(role=status 불러오는 중 / aria-busy)·오류 상자(role=alert+단추)·내용(contentSel) 변화를 performance.now 로 */
const installRecorder = (page, contentSel) =>
  page.evaluate((contentSel) => {
    window.__log = []
    window.__tClick = null
    document.addEventListener('click', () => { if (window.__tClick === null) window.__tClick = performance.now() }, true)
    let last = ''
    const snap = () => {
      const main = document.querySelector('main')
      const skel = !!main.querySelector('[aria-busy="true"]') || [...main.querySelectorAll('[role=status]')].some((e) => /불러오는 중/.test(e.textContent))
      const err = !!main.querySelector('[role=alert] button')
      const content = !!document.querySelector(contentSel)
      return { skel, err, content }
    }
    const rec = () => {
      const s = snap()
      const k = JSON.stringify(s)
      if (k !== last) { last = k; window.__log.push([Math.round(performance.now()), s]) }
    }
    new MutationObserver(rec).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
    rec()
  }, contentSel)

function failStats(log, tClick) {
  const start = log.find(([t, s]) => t >= tClick - 1 && s.skel)
  const errBack = start ? log.find(([t, s]) => t > start[0] && s.err && !s.skel) : null
  return { seen: !!start, busyMs: start && errBack ? errBack[0] - start[0] : null, clickToErrMs: errBack ? Math.round(errBack[0] - tClick) : null }
}

async function retryCase(browser, W, H, label, path, contentSel) {
  const { ctx, page } = await openPage(browser, W, H, c2)
  page.setDefaultTimeout(60_000)
  let abortOn = true
  const respAt = []
  page.on('response', (res) => { const u = new URL(res.url()); if (API_PATHS.includes(u.pathname)) respAt.push(Date.now()) })
  await page.route(isTopics, (r) => (abortOn ? r.abort() : r.continue()))
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.waitForSelector('main [role=alert] button', { timeout: 20_000 })
  await sleep(700)
  const tap1 = async () => {
    const b = await page.locator('main [role=alert] button').first().boundingBox()
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
  }
  // (a) 다시 실패 — 최소 표시
  await installRecorder(page, contentSel)
  await tap1()
  await sleep(1800)
  const log = await page.evaluate(() => window.__log)
  const tClick = await page.evaluate(() => window.__tClick)
  const st = failStats(log, tClick)
  const errAgain = (await page.locator('main [role=alert]').first().innerText().catch(() => '')).includes('불러오지 못했어요')
  note(`[${W}] ${label} 다시 실패 로그 ${JSON.stringify(log)} tClick=${Math.round(tClick)} → ${JSON.stringify(st)}`)
  check(`[${W}] ${label}: 실패 시 자리표시 ≥500ms 보였다 같은 오류 상자로 복귀(이전 ~30ms)`, st.seen && st.busyMs !== null && st.busyMs >= 480 && errAgain, `busyMs=${st.busyMs} 클릭→오류 복귀=${st.clickToErrMs}ms errAgain=${errAgain}`)
  // (b) 성공 — 기다리지 않음: 내용이 마지막 API 응답 직후에 뜬다
  abortOn = false
  respAt.length = 0
  await installRecorder(page, contentSel).catch(() => {})
  await page.evaluate(() => { window.__log = []; window.__tClick = null })
  const tClickWall = Date.now()
  await tap1()
  await page.waitForSelector(contentSel, { timeout: 30_000 })
  await sleep(300)
  const log2 = await page.evaluate(() => ({ log: window.__log, origin: performance.timeOrigin, tClick: window.__tClick }))
  const contentAt = log2.log.find(([, s]) => s.content)
  const contentEpoch = contentAt ? log2.origin + contentAt[0] : null
  const lastResp = respAt.length ? Math.max(...respAt) : null
  const gap = contentEpoch !== null && lastResp !== null ? Math.round(contentEpoch - lastResp) : null
  const clickToContent = contentEpoch !== null ? Math.round(contentEpoch - tClickWall) : null
  note(`[${W}] ${label} 성공 로그 ${JSON.stringify(log2.log)} · API 응답 ${respAt.length}건 · 클릭→내용 ${clickToContent}ms · 마지막 응답→내용 ${gap}ms`)
  check(`[${W}] ${label}: 성공하면 기다리지 않음(마지막 API 응답 → 내용 ≤250ms)`, gap !== null && gap <= 250 && gap >= -150, `gap=${gap}ms 클릭→내용=${clickToContent}ms`)
  await ctx.close()
}

async function heldAlertCase(browser, W, H) {
  const { ctx, page } = await openPage(browser, W, H, c2)
  page.setDefaultTimeout(60_000)
  const st = await mockPost(page, DRAFTS, async () => ({ delay: 250, status: 422, json: errEnv('UNPROCESSABLE', { reason: 'NOT_A_VARIANT' }, 'SRV') }))
  await page.goto(`${BASE}/study/ai/scenario/${SEED_SC}/variant`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  await page.getByText('무엇을 바꿔 볼까요?').first().waitFor({ timeout: 90_000 })
  await sleep(300)
  await tap(page, page.locator('label:has(input[name="va-persona"][value="kind"])').first())
  const sb = page.locator('button', { hasText: SUBMIT }).first()
  await sb.evaluate((e) => e.setAttribute('data-qa', 'b'))
  // 알림 노드 변화 기록(추가·제거된 role=alert 노드)
  await page.evaluate(() => {
    window.__al = []
    const isAl = (n) => n.nodeType === 1 && (n.matches?.('[role=alert]') || n.querySelector?.('[role=alert]'))
    new MutationObserver((ms) => {
      for (const m of ms) {
        for (const n of m.removedNodes) if (isAl(n)) window.__al.push(['removed', Math.round(performance.now())])
        for (const n of m.addedNodes) if (isAl(n)) window.__al.push(['added', Math.round(performance.now())])
      }
    }).observe(document.body, { subtree: true, childList: true })
  })
  const alertInfo = () =>
    page.evaluate(() => {
      const rd = (n) => Math.round(n * 10) / 10
      const al = [...document.querySelectorAll('main [role=alert]')]
      const b = document.querySelector('[data-qa=b]').getBoundingClientRect()
      const a = al[0]?.getBoundingClientRect()
      const ae = document.activeElement
      return { n: al.length, marked: al.map((e) => e.hasAttribute('data-qa-a')), text: (al[0]?.textContent ?? '').trim().slice(0, 16), top: a ? rd(a.top) : null, h: a ? rd(a.height) : null, btnTop: rd(b.top), active: `${ae?.tagName}:${(ae?.textContent ?? '').trim().slice(0, 10)}:${ae?.id ?? ''}`, main: document.querySelector('main').scrollTop }
    })
  const marks = []
  for (let i = 1; i <= 3; i++) {
    await page.evaluate(() => (window.__al = []))
    if (i > 1) { await page.locator('[data-qa=b]').scrollIntoViewIfNeeded(); await sleep(200) } // 412 처럼 상자 뒤 단추가 화면 밖이면 먼저 가져온다(시험 도구 보정 — 상자 교체 측정은 그 뒤)
    const before = i > 1 ? await alertInfo() : null
    const tTap = await page.evaluate(() => performance.now())
    await tap(page, page.locator('[data-qa=b]'), { scroll: i === 1 })
    await sleep(120)
    const mid = i > 1 ? await alertInfo() : null // 다시 만드는 동안(실패 도착 전) — 상자는 그대로(표식 유지)
    await sleep(900)
    const after = await alertInfo()
    const ev = await page.evaluate(() => window.__al)
    marks.push({ i, before, mid, after, ev, tTap })
    note(`[${W}] 변형 실패 ${i}회차: 이전 ${JSON.stringify(before)} → 진행 중 ${JSON.stringify(mid)} → 도착 ${JSON.stringify(after)} · 알림 노드 변화 ${JSON.stringify(ev)} (탭 ${Math.round(tTap)})`)
    // 새 상자에 표식 — 다음 회차에서 같은 노드인지 가린다
    await page.evaluate(() => document.querySelector('main [role=alert]')?.setAttribute('data-qa-a', '1'))
    if (i === 1) check(`[${W}] 변형 1회차: 실패 상자 1개(NOT_A_VARIANT 글)`, after.n === 1 && after.text.length > 0, JSON.stringify(after))
    if (i > 1) {
      const remounted = after.n === 1 && after.marked[0] === false && ev.some((e) => e[0] === 'removed') && ev.some((e) => e[0] === 'added')
      const tRemoved = ev.find((e) => e[0] === 'removed')?.[1]
      check(`[${W}] 변형 ${i}회차: 같은 실패라도 알림 노드가 새로 만들어짐(removed+added, 표식 없는 새 노드)`, remounted, `n=${after.n} marked=${after.marked} ev=${JSON.stringify(ev)}`)
      check(`[${W}] 변형 ${i}회차: 다시 만드는 동안(탭 후 120ms) 상자 유지·실패 도착 때 교체(제거 시각 ≥ 탭+200ms)`, mid.n === 1 && mid.marked[0] === true && tRemoved !== undefined && tRemoved - tTap >= 200, `mid.n=${mid.n} mid.marked=${mid.marked} 제거까지 ${tRemoved !== undefined ? Math.round(tRemoved - tTap) : null}ms`)
      check(`[${W}] 변형 ${i}회차: 상자 top·높이·단추 top 불변(±0.5px)·main.scrollTop 불변`, Math.abs(after.top - before.top) <= 0.5 && Math.abs(after.h - before.h) <= 0.5 && Math.abs(after.btnTop - before.btnTop) <= 0.5 && after.main === before.main, `top ${before.top}→${after.top} h ${before.h}→${after.h} btn ${before.btnTop}→${after.btnTop} main ${before.main}→${after.main}`)
      check(`[${W}] 변형 ${i}회차: 초점 요소 불변`, after.active === before.active, `${before.active} → ${after.active}`)
    }
  }
  check(`[${W}] 변형: #177 모의 요청 3건(LLM 0)`, st.calls.length === 3, String(st.calls.length))
  await ctx.close()
}

const browser = await launch()
try {
  // 개발 서버 첫 컴파일 데우기
  {
    const { ctx, page } = await openPage(browser, 390, 844, c2)
    page.setDefaultTimeout(60_000)
    for (const p of [`/settings/scenarios/topics/${seedId}`, `/settings/scenarios/topics/${seedId}/edit`, `/study/ai/scenario/${SEED_SC}/variant`]) await page.goto(BASE + p, { waitUntil: 'networkidle' }).catch(() => {})
    await ctx.close()
  }
  const ONLY = process.env.ONLY ?? ''
  const WSEL = process.env.WIDX === undefined ? WIDTHS : [WIDTHS[Number(process.env.WIDX)]]
  for (const [W, H] of WSEL) {
    if (ONLY !== 'held') {
      await retryCase(browser, W, H, '① S6 [다시 시도]', `/settings/scenarios/topics/${seedId}`, 'section[aria-labelledby=tp-chunks]')
      await retryCase(browser, W, H, '① S7 [다시 시도]', `/settings/scenarios/topics/${seedId}/edit`, 'main input')
    }
    await heldAlertCase(browser, W, H)
  }
} finally {
  await closeBrowser(browser)
  const c21 = await qaRowCounts(u2.id)
  const h1 = await seedHash()
  check('종료: QA2 행 0', Object.values(c21).every((n) => n === 0), JSON.stringify(c21))
  check(`종료: 시드 해시 불변 ${h1.sha}`, h1.sha === SEED_SHA && h1.sha === h0.sha, `${h0.sha} → ${h1.sha}`)
  summary('qa-045-ui-g item3')
  await prisma.$disconnect()
  process.exit(0)
}
