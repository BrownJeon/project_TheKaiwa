/**
 * qa-045-ui-e 화면 공용 — 터치 탭·스크롤러 측정·목 응답(page.route)·시드 상세 → 초안 변환. LLM 호출 0(#166·#177·#178 은 모두 목).
 * 실행 환경은 lib.mjs 머리 주석 참고(dev 127.0.0.1:3055, QA 계정 2 만).
 */
import { api, data, sleep } from './lib.mjs'

export const env = (d, message = null) => ({ success: true, data: d, message })
export const errEnv = (code, details, message) => ({ success: false, data: { code, details }, message })
export const SRV_MSG = '서버원문-SECRET-MSG 을(를) 확인하세요'

/** 실제 터치 탭(보조 기술 속성 aria-disabled 도 Playwright 가 막지 않도록 좌표 탭). 요소를 화면 안으로 먼저 가져온다. */
export async function tap(page, sel, { scroll = true } = {}) {
  const h = typeof sel === 'string' ? page.locator(sel).first() : sel
  if (scroll) await h.scrollIntoViewIfNeeded()
  const b = await h.boundingBox()
  if (!b) throw new Error('tap: boundingBox 없음 ' + sel)
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
}

/** sel 요소의 가장 가까운 세로 스크롤 조상의 scrollTop(`main` 이 아닐 수 있다 — 초안 화면은 자체 스크롤 한 곳). */
export const scroller = (page, sel) =>
  page.evaluate((sel) => {
    let el = document.querySelector(sel)
    while (el) {
      const cs = getComputedStyle(el)
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight) return { top: Math.round(el.scrollTop * 10) / 10, tag: el.tagName, max: el.scrollHeight - el.clientHeight, cls: String(el.className).slice(0, 40) }
      el = el.parentElement
    }
    return { top: -1, tag: null, max: 0, cls: '' }
  }, sel)
export const mainTop = (page) => page.evaluate(() => document.querySelector('main')?.scrollTop ?? -1)

/** 시드 상황 상세(#162) → #166/#177 초안 모양(`ScenarioInput`). 표현 id 는 뺀다. */
export async function draftFromSeed(cookie, seedId, patch = {}) {
  const d = data(await api(cookie, 'GET', `/api/v1/scenarios/${seedId}`))
  const base = {
    title: d.title,
    titleJa: d.titleJa ?? null,
    description: d.description ?? null,
    level: d.level,
    difficulty: d.difficulty,
    roles: d.roles,
    goal: { communicativeGoalKo: d.goal.communicativeGoalKo, successCriteria: [...d.goal.successCriteria] },
    steps: d.steps.map((s) => ({ ko: s.ko })),
    keyExpressions: d.keyExpressions.map((e) => ({ ja: e.ja, ko: e.ko, ...(e.reading ? { reading: e.reading } : {}) })),
    topicIds: d.topics.map((t) => t.id),
    ...(d.opening ? { opening: d.opening } : {}),
  }
  return { detail: d, draft: { ...base, ...patch } }
}

/** page.route 로 가로챌 목 JSON 응답(POST 만). 다른 메서드는 통과. 지연(delay)은 ms. */
export async function mockPost(page, glob, handler) {
  const state = { calls: [] }
  await page.route(glob, async (route) => {
    const req = route.request()
    if (req.method() !== 'POST') return route.continue()
    const body = req.postData()
    const call = { t: Date.now(), body, aborted: false }
    state.calls.push(call)
    const r = await handler(body, call, state)
    try {
      if (r.delay) await sleep(r.delay)
      if (r.abort) return await route.abort('failed')
      await route.fulfill({ status: r.status ?? 200, contentType: 'application/json', body: JSON.stringify(r.json) })
    } catch {
      call.aborted = true
    }
  })
  return state
}

export const pageText = (page) => page.evaluate(() => document.body.innerText)
export const visibleText = (page, sel) => page.locator(sel).first().innerText().catch(() => '')

/** 가로 넘침(문서 clientWidth 초과 우측·좌측 음수 요소) 수 + 목록(상위 5). */
export const overflow = (page) =>
  page.evaluate(() => {
    const cw = document.documentElement.clientWidth
    const bad = []
    for (const el of document.body.querySelectorAll('*')) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      if (el.closest('.sr-only') || el.closest('nextjs-portal')) continue
      const hs = el.parentElement?.closest('.overflow-x-auto')
      if (hs) continue // 가로로 밀어 보는 칩 줄(의도된 가로 스크롤) 안쪽은 제외
      if (r.right > cw + 0.5 || r.left < -0.5) bad.push({ tag: el.tagName, cls: String(el.className).slice(0, 40), l: Math.round(r.left), r: Math.round(r.right), t: (el.textContent ?? '').trim().slice(0, 20) })
    }
    return { cw, docScrollW: document.documentElement.scrollWidth, count: bad.length, items: bad.slice(0, 5) }
  })

/** 터치 대상 44px 미만 목록(보이는 button·a·[role=radio]·[role=checkbox]·input 등). 높이·너비 중 하나라도 44 미만이면 기록. */
export const smallTargets = (page, rootSel = 'body') =>
  page.evaluate((rootSel) => {
    const root = document.querySelector(rootSel) ?? document.body
    const out = []
    for (const el of root.querySelectorAll('button, a[href], [role=radio], [role=checkbox], [role=tab], input:not([type=hidden]), select, textarea, summary')) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      if (el.closest('nextjs-portal') || el.closest('.sr-only')) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      // 가상 터치 영역(::before 로 늘린 칩 등)은 요소 자체 높이가 작아도 44px 로 친다 — 자세히는 hit 영역 측정
      const before = getComputedStyle(el, '::before')
      const beforeH = parseFloat(before.height) || 0
      const eff = Math.max(r.height, before.content !== 'none' && before.position === 'absolute' ? beforeH : 0)
      if (eff < 44 - 0.5 || r.width < 44 - 0.5) out.push({ tag: el.tagName, text: ((el.getAttribute('aria-label') ?? el.textContent) || '').trim().slice(0, 24), h: Math.round(r.height * 10) / 10, effH: Math.round(eff * 10) / 10, w: Math.round(r.width * 10) / 10 })
    }
    return out
  }, rootSel)

/** 같은 좌표를 90ms 간격으로 두 번 탭(진짜 더블 탭 — 한 번 계산한 좌표). */
export async function dbl(page, sel, gap = 90) {
  const h = page.locator(sel).first()
  await h.scrollIntoViewIfNeeded()
  const b = await h.boundingBox()
  const x = b.x + b.width / 2
  const y = b.y + b.height / 2
  await page.touchscreen.tap(x, y)
  await sleep(gap)
  await page.touchscreen.tap(x, y)
}
