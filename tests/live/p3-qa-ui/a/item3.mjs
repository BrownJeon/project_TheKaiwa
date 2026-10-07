/**
 * qa-045-ui-a 항목 3 — S2 탭·상황 시트·스크롤·초점·딥링크. 실행: SP=<scratchpad> node item3.mjs
 * 읽기 전용(쓰기 요청 0). 시트의 [지우기]·[나에게서 숨기기]·[변형 만들기] 는 누르지 않는다(보기만).
 */
import { api, BASE, check, launch, newCtx, overflowReport, SHOTS, summary, WIDTHS } from './lib.mjs'

const scRes = await api('/api/v1/scenarios?limit=100')
const scItems = scRes.json?.data?.items ?? []
const seedSc = scItems.find((s) => !s.isMine)
console.log('seed scenario for deeplink:', seedSc?.id, 'count', scItems.length)
const LIST_REQ = ['GET /api/v1/topics?level=all', 'GET /api/v1/scenarios?limit=100', 'GET /api/v1/challenges?status=ACTIVE&limit=1']

const snap = (page) =>
  page.evaluate(() => {
    const a = document.activeElement
    return {
      top: document.querySelector('main')?.scrollTop ?? -1,
      search: location.search,
      hist: history.length,
      active: a ? { tag: a.tagName.toLowerCase(), role: a.getAttribute('role'), text: (a.textContent || '').trim().slice(0, 30), checked: a.getAttribute('aria-checked'), opener: a.hasAttribute('data-qa-opener') } : null,
      radios: [...document.querySelectorAll('main [role=radiogroup]')].map((g) => [...g.querySelectorAll('[role=radio]')].map((r) => `${(r.textContent || '').trim()}:${r.getAttribute('aria-checked')}`)),
      dialog: !!document.querySelector('[role=dialog]'),
    }
  })
const setTop = (page, n) => page.evaluate((v) => { document.querySelector('main').scrollTop = v }, n)

async function openPage(ctx, query) {
  const page = await ctx.newPage()
  page.setDefaultTimeout(60_000)
  page.__reqs = []
  page.__errs = []
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (u.pathname.startsWith('/api/')) page.__reqs.push(`${r.method()} ${u.pathname}${u.search}`)
  })
  page.on('console', (m) => {
    if (m.type() === 'error' || /hydrat|418|#4\d\d/i.test(m.text())) page.__errs.push(`console.${m.type()}: ${m.text().slice(0, 160)}`)
  })
  page.on('pageerror', (e) => page.__errs.push(`pageerror: ${String(e.message).slice(0, 160)}`))
  await page.goto(`${BASE}/settings/scenarios${query}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  return page
}
const listReqSince = (page, from) => page.__reqs.slice(from).filter((q) => LIST_REQ.includes(q))

const browser = await launch()
for (const vp of WIDTHS) {
  const tag = `${vp.w}`
  const ctx = await newCtx(browser, vp)

  // ── 3.1 분절 전환 ────────────────────────────────────────────
  {
    const page = await openPage(ctx, '?tab=topics')
    for (const startTop of [0, 12]) {
      await setTop(page, startTop)
      await page.waitForTimeout(150)
      for (const [to, label] of [['scenarios', /^상황/], ['topics', /^주제/]]) {
        const before = await snap(page)
        const n0 = page.__reqs.length
        await page.getByRole('radio', { name: label }).tap()
        await page.waitForTimeout(700)
        const after = await snap(page)
        const dTop = after.top - before.top
        const tg = `${before.top === startTop ? '' : '(start≠'+startTop+')'}`
        check(`3.1.tab→${to} scrollTop diff 0 (start ${startTop})@${tag}`, dTop === 0, `before=${before.top} after=${after.top} diff=${dTop}${tg}`)
        check(`3.1.tab→${to} focus stays on segment button (start ${startTop})@${tag}`, !!after.active && after.active.role === 'radio' && after.active.checked === 'true' && label.test(after.active.text), JSON.stringify(after.active))
        check(`3.1.tab→${to} ?tab synced (topics=기본이라 주소에서 뺌 — manageHref), history.length unchanged (start ${startTop})@${tag}`, (to === 'topics' ? after.search === '' : after.search === '?tab=scenarios') && after.hist === before.hist, `search=${after.search} hist ${before.hist}→${after.hist}`)
        check(`3.1.tab→${to} no list re-requests (start ${startTop})@${tag}`, listReqSince(page, n0).length === 0, `new api: ${JSON.stringify(page.__reqs.slice(n0))}`)
      }
    }
    await page.close()
  }

  // ── 3.2 상황 칩 ─────────────────────────────────────────────
  {
    const page = await openPage(ctx, '?tab=scenarios')
    const chip = (name) => page.locator('main [role=radiogroup][aria-label="상황 보기 범위"] [role=radio]', { hasText: name })
    for (const startTop of [0, 100]) {
      for (const [name, expectCards] of [['기본', 10], ['전체', 10], ['내가 만든', 0], ['전체', 10]]) {
        await setTop(page, startTop)
        await page.waitForTimeout(150)
        const before = await snap(page)
        const n0 = page.__reqs.length
        await chip(name).first().tap()
        await page.waitForTimeout(400)
        const after = await snap(page)
        const cards = await page.locator('main ul li').count()
        const scrollable = await page.evaluate(() => { const m = document.querySelector('main'); return m.scrollHeight - m.clientHeight })
        const dTop = after.top - before.top
        const clamp = name === '내가 만든' && startTop > 0
        // 내가 만든 0건 → 목록이 비어 내용이 짧아지면 브라우저가 scrollTop 을 한계로 줄인다(코드가 움직인 것이 아님) — 참고로만 기록
        if (clamp) check(`3.2.chip ${name} scrollTop (start ${startTop}) [info: content shrinks → browser clamp]@${tag}`, true, `before=${before.top} after=${after.top} maxScroll=${scrollable}`)
        else check(`3.2.chip ${name} scrollTop diff 0 (start ${startTop})@${tag}`, dTop === 0, `before=${before.top} after=${after.top}`)
        check(`3.2.chip ${name} focus stays on chip (start ${startTop})@${tag}`, !!after.active && after.active.role === 'radio' && after.active.text.startsWith(name), JSON.stringify(after.active))
        check(`3.2.chip ${name} cards=${expectCards} + no list re-request (start ${startTop})@${tag}`, cards === expectCards && listReqSince(page, n0).length === 0, `cards=${cards} newReqs=${JSON.stringify(page.__reqs.slice(n0))}`)
        if (name === '내가 만든' && startTop === 0) {
          const empty = await page.evaluate(() => [...document.querySelectorAll('main .border-dashed')].map((d) => d.textContent))
          check(`3.2.chip 내가 만든 empty box text@${tag}`, empty.length === 1 && /아직 만든 상황이 없어요/.test(empty[0]), JSON.stringify(empty))
        }
      }
    }
    const ov = await overflowReport(page)
    check(`3.2.scenarios tab no-hscroll@${tag}`, !ov.docOverflowX && !ov.mainOverflowX && ov.overflowCount === 0, JSON.stringify({ doc: ov.docScrollWidth, cw: ov.clientWidth, mainSW: ov.mainScrollW, mainCW: ov.mainClientW, cnt: ov.overflowCount, els: ov.overflowEls }))
    check(`3.2.scenarios tab no page vscroll@${tag}`, ov.pageVScroll === false, `docScrollH=${ov.docScrollH} innerH=${ov.innerHeight}`)
    if (vp.w === 390) await page.screenshot({ path: `${SHOTS}/item3-scenarios-390.png` })
    await page.close()
  }

  // ── 3.3 상황 시트 열고 닫기 ──────────────────────────────────
  {
    const page = await openPage(ctx, '?tab=scenarios')
    const pickCard = (idx) =>
      page.evaluate((i) => {
        const main = document.querySelector('main')
        document.querySelectorAll('[data-qa-opener]').forEach((e) => e.removeAttribute('data-qa-opener'))
        const btns = [...main.querySelectorAll('ul li button, ul li a')].filter((b) => { const r = b.getBoundingClientRect(); return r.top > 70 && r.bottom < innerHeight - 20 })
        const b = btns[i]
        if (!b) return null
        b.setAttribute('data-qa-opener', '1')
        const r = b.getBoundingClientRect()
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + Math.min(r.height / 2, 40)), tag: b.tagName.toLowerCase(), text: (b.textContent || '').trim().slice(0, 30) }
      }, idx)
    let first = true
    for (const startTop of [0, 300]) {
      for (const closeBy of ['Esc', 'X', 'backdrop']) {
        await setTop(page, startTop)
        await page.waitForTimeout(200)
        const card = await pickCard(0)
        if (!card) { check(`3.3.sheet open (start ${startTop}, close by ${closeBy})@${tag}`, false, 'no visible card'); continue }
        const before = await snap(page)
        const n0 = page.__reqs.length
        await page.touchscreen.tap(card.x, card.y)
        await page.waitForSelector('[role=dialog]', { timeout: 10_000 })
        await page.waitForTimeout(250)
        const mid = await snap(page)
        // 상세 로드 대기(고치기 보이면 끝)
        await page.waitForFunction(() => /고치기/.test(document.querySelector('[role=dialog]')?.innerText ?? ''), null, { timeout: 15_000 }).catch(() => {})
        await page.waitForTimeout(200)
        const loaded = await snap(page)
        check(`3.3.sheet open scrollTop diff 0 (start ${startTop}, close by ${closeBy})@${tag}`, mid.top - before.top === 0 && loaded.top - before.top === 0, `before=${before.top} open=${mid.top} loaded=${loaded.top}`)
        check(`3.3.sheet open → ?sc= added, replace (hist same) (start ${startTop}, ${closeBy})@${tag}`, /[?&]sc=/.test(mid.search) && /tab=scenarios/.test(mid.search) && mid.hist === before.hist, `search=${mid.search} hist ${before.hist}→${mid.hist}`)
        check(`3.3.sheet open no list re-request (start ${startTop}, ${closeBy})@${tag}`, listReqSince(page, n0).length === 0, `api during open: ${JSON.stringify(page.__reqs.slice(n0))}`)
        if (first) {
          first = false
          const sh = await page.evaluate(() => {
            const d = document.querySelector('[role=dialog]')
            const txt = d.innerText
            const acts = [...d.querySelectorAll('a,button')].map((e) => ({ t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 20), h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width) }))
            const own = [...d.querySelectorAll('*')].filter((e) => e.children.length === 0 && (e.textContent || '').trim() === '변형').length
            const dr = d.getBoundingClientRect()
            return { txt, acts, ownVariantBadge: own, origin: /원본/.test(txt), dialogH: Math.round(dr.height), vh: innerHeight, badge: [...d.querySelectorAll('span')].map((e) => e.textContent.trim()).filter((t) => /^(기본|내 상황|✎ 내 버전)$/.test(t)) }
          })
          console.log(`[${tag}] seed sheet`, JSON.stringify({ acts: sh.acts, badge: sh.badge, dialogH: sh.dialogH, vh: sh.vh, ownVariantBadge: sh.ownVariantBadge, origin: sh.origin }))
          const hasEdit = sh.acts.some((a) => a.t === '고치기'), hasVar = sh.acts.some((a) => a.t === '변형 만들기'), hasDel = sh.acts.some((a) => a.t === '지우기')
          check(`3.3.seed sheet action row = 고치기·변형 만들기·지우기@${tag}`, hasEdit && hasVar && hasDel, JSON.stringify(sh.acts.map((a) => a.t)))
          check(`3.3.seed sheet: no 「변형」 badge, no 「원본」 text (L-2)@${tag}`, sh.ownVariantBadge === 0 && sh.origin === false, `variantBadge=${sh.ownVariantBadge} 원본=${sh.origin} badges=${JSON.stringify(sh.badge)}`)
          check(`3.3.seed sheet actions touch >=44@${tag}`, sh.acts.filter((a) => ['고치기', '변형 만들기', '지우기'].includes(a.t)).every((a) => a.h >= 44), JSON.stringify(sh.acts.filter((a) => ['고치기', '변형 만들기', '지우기'].includes(a.t))))
          check(`3.3.sheet in viewport (≤85% height)@${tag}`, sh.dialogH <= sh.vh * 0.85 + 1, `dialogH=${sh.dialogH} vh=${sh.vh}`)
          if (vp.w === 390) await page.screenshot({ path: `${SHOTS}/item3-seed-sheet-390.png` })
        }
        // 닫기
        if (closeBy === 'Esc') await page.keyboard.press('Escape')
        else if (closeBy === 'X') await page.locator('[role=dialog] button[aria-label="닫기"]').tap()
        else await page.touchscreen.tap(Math.round(vp.w / 2), 30)
        await page.waitForSelector('[role=dialog]', { state: 'detached', timeout: 10_000 })
        await page.waitForTimeout(400)
        const closed = await snap(page)
        check(`3.3.sheet close(${closeBy}) scrollTop diff 0 (start ${startTop})@${tag}`, closed.top - before.top === 0, `before=${before.top} closed=${closed.top}`)
        check(`3.3.sheet close(${closeBy}) focus back to opener card (start ${startTop})@${tag}`, !!closed.active && closed.active.opener === true, JSON.stringify(closed.active))
        check(`3.3.sheet close(${closeBy}) URL back to ?tab=scenarios (start ${startTop})@${tag}`, closed.search === '?tab=scenarios' && closed.hist === before.hist, `search=${closed.search} hist ${before.hist}→${closed.hist}`)
      }
    }
    // 키보드 열기(Enter) → Esc: 초점 복귀(탭이 초점을 주지 않는 환경 대비)
    await setTop(page, 0)
    const kb = await page.evaluate(() => { const b = document.querySelector('main ul li button, main ul li a'); b.setAttribute('data-qa-opener', '1'); b.focus(); return document.activeElement === b })
    await page.keyboard.press('Enter')
    await page.waitForSelector('[role=dialog]', { timeout: 10_000 })
    await page.waitForTimeout(300)
    const dlgFocus = await page.evaluate(() => ({ inDialog: !!document.activeElement?.closest('[role=dialog]'), tag: document.activeElement?.tagName.toLowerCase(), text: (document.activeElement?.textContent || '').trim().slice(0, 20) }))
    check(`3.3.keyboard open: focus moves into dialog title@${tag}`, kb && dlgFocus.inDialog && dlgFocus.tag === 'h2', JSON.stringify(dlgFocus))
    await page.keyboard.press('Escape')
    await page.waitForSelector('[role=dialog]', { state: 'detached' })
    await page.waitForTimeout(300)
    const kbClosed = await snap(page)
    check(`3.3.keyboard Esc: focus back to opener@${tag}`, kbClosed.active?.opener === true, JSON.stringify(kbClosed.active))
    check(`3.3.no page errors during tab/sheet flows@${tag}`, page.__errs.length === 0, JSON.stringify(page.__errs.slice(0, 4)))
    await page.close()
  }

  // ── 3.4 딥링크 ──────────────────────────────────────────────
  if (seedSc) {
    // (a) ?tab=scenarios&sc=<id>
    let page = await openPage(ctx, `?tab=scenarios&sc=${encodeURIComponent(seedSc.id)}`)
    await page.waitForSelector('[role=dialog]', { timeout: 15_000 }).catch(() => {})
    await page.waitForFunction(() => /고치기/.test(document.querySelector('[role=dialog]')?.innerText ?? ''), null, { timeout: 15_000 }).catch(() => {})
    let s = await snap(page)
    const title = await page.evaluate(() => document.querySelector('[role=dialog] h2')?.textContent ?? null)
    check(`3.4.deeplink ?tab=scenarios&sc=<seed id> opens sheet@${tag}`, s.dialog === true && /tab=scenarios/.test(s.search) && s.radios[0]?.includes('상황 10:true'), `dialog=${s.dialog} search=${s.search.replace(seedSc.id, '<id>')} radios=${JSON.stringify(s.radios[0])} title=${title}`)
    check(`3.4.deeplink: no hydration/console errors (React #418)@${tag}`, page.__errs.length === 0, JSON.stringify(page.__errs.slice(0, 4)))
    await page.keyboard.press('Escape')
    await page.waitForSelector('[role=dialog]', { state: 'detached' })
    await page.waitForTimeout(400)
    s = await snap(page)
    check(`3.4.deeplink close → URL ?tab=scenarios@${tag}`, s.search === '?tab=scenarios', `search=${s.search}`)
    await page.close()
    // (b) ?tab=topics&sc=<id> → 상황 탭
    page = await openPage(ctx, `?tab=topics&sc=${encodeURIComponent(seedSc.id)}`)
    await page.waitForSelector('[role=dialog]', { timeout: 15_000 }).catch(() => {})
    s = await snap(page)
    check(`3.4.deeplink ?tab=topics&sc=<id> → scenarios tab + sheet@${tag}`, s.dialog === true && s.radios[0]?.includes('상황 10:true'), `dialog=${s.dialog} radios=${JSON.stringify(s.radios[0])}`)
    await page.close()
    // (c) 모양이 틀린 sc 는 무시
    for (const bad of ['x%20y', '%3Cscript%3E', 'a'.repeat(200)]) {
      page = await openPage(ctx, `?tab=scenarios&sc=${bad}`)
      await page.waitForTimeout(500)
      s = await snap(page)
      check(`3.4.deeplink bad sc ignored (${bad.slice(0, 12)})@${tag}`, s.dialog === false, `dialog=${s.dialog} search=${s.search.slice(0, 40)}`)
      await page.close()
    }
  } else check('3.4.deeplink', null, 'no seed scenario id')
  await ctx.close()
}
await browser.close()
summary()
