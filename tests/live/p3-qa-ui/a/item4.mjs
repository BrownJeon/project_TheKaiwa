/**
 * qa-045-ui-a 항목 4 — S6 주제 보기(읽기)·접근성·다크. 실행: SP=<scratchpad> node item4.mjs
 * 읽기 전용: [나에게서 숨기기] 는 시트를 열어 보고 [취소] 만 누른다(확인 버튼 탭 0).
 * fixture(표시한 것만 `page.route`): 긴 글·설명/일본어명 없음·챌린지 카드.
 */
import { readFileSync } from 'node:fs'
import { api, BASE, check, launch, newCtx, overflowReport, SHOTS, sleep, summary, WIDTHS } from './lib.mjs'

const other = JSON.parse(readFileSync(`${process.env.SP}/qaui-a-other.json`, 'utf8').trim().split('\n').pop())
const jt = await api('/api/v1/topics?level=all')
const topics = jt.json?.data?.items ?? []
const T = topics.find((t) => t.isSeed && t.title === '자기소개') ?? topics.find((t) => t.isSeed)
const scRes = await api('/api/v1/scenarios?limit=100')
const scItems = scRes.json?.data?.items ?? []
const scCount = scItems.filter((s) => (s.topics ?? []).some((t) => t.id === T.id)).length
console.log('topic', T.id, T.title, 'chunks', T.chunks.length, 'scenarios', scCount, 'otherUserTopic', other.id ? 'yes' : 'none')
const S6 = `/settings/scenarios/topics/${T.id}`
const ENGINE_RE = /claude|haiku|sonnet|opus|reazon|whisper|style-bert|\bAI\b/i
const isTopics = (u) => u.pathname === '/api/v1/topics'
const isScen = (u) => u.pathname === '/api/v1/scenarios'
const isOv = (u) => u.pathname === '/api/v1/seed-overrides'
const isCh = (u) => u.pathname === '/api/v1/challenges'

async function openPage(ctx, path, setup) {
  const page = await ctx.newPage()
  page.setDefaultTimeout(60_000)
  page.__errs = []
  page.__reqs = []
  page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/')) page.__reqs.push(`${r.method()} ${u.pathname}${u.search}`) })
  page.on('pageerror', (e) => page.__errs.push(String(e.message).slice(0, 160)))
  page.on('console', (m) => { if (m.type() === 'error') page.__errs.push(`console: ${m.text().slice(0, 140)}`) })
  if (setup) await setup(page)
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  return page
}

/** 화면에 보이는 모든 글(+aria-label·title·alt) — 엔진 문자열 검사용 */
const visibleText = (page) =>
  page.evaluate(() => {
    const attrs = [...document.querySelectorAll('[aria-label],[title],[alt]')].map((e) => [e.getAttribute('aria-label'), e.getAttribute('title'), e.getAttribute('alt')].filter(Boolean).join(' '))
    return `${document.body.innerText}\n${attrs.join('\n')}`
  })

const touchSmall = (page) =>
  page.evaluate(() => {
    const out = []
    for (const e of document.querySelectorAll('button,a,[role=button],[role=radio],input,select,textarea,summary')) {
      const r = e.getBoundingClientRect()
      const cs = getComputedStyle(e)
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue
      if (e.closest('[hidden],[aria-hidden=true]')) continue
      if (r.height < 44 - 0.01) out.push({ t: ((e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)), h: Math.round(r.height * 10) / 10, w: Math.round(r.width), tag: e.tagName.toLowerCase(), href: e.getAttribute('href')?.slice(0, 40) ?? null, top: Math.round(r.top) })
    }
    return out
  })

const contrastReport = (page) =>
  page.evaluate(() => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 1
    const x = cv.getContext('2d', { willReadFrequently: true })
    const rgba = (css) => { x.clearRect(0, 0, 1, 1); x.fillStyle = '#000'; x.fillStyle = css; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255] }
    const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1] }
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }
    const bgOf = (el) => {
      const layers = []
      for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c[3] > 0) { layers.push(c); if (c[3] >= 1) break } }
      let base = layers.length && layers[layers.length - 1][3] >= 1 ? layers.pop() : [255, 255, 255, 1]
      while (layers.length) base = over(layers.pop(), base)
      return base
    }
    const leaf = (re, root = document) => [...root.querySelectorAll('*')].find((e) => e.children.length === 0 && re.test(e.textContent || ''))
    const container = document.querySelector('div.mx-auto.min-w-0')
    const head = container?.querySelector('section')
    const chunks = document.querySelector('section[aria-labelledby=tp-chunks]')
    const sc = document.querySelector('section[aria-labelledby=tp-scenarios]')
    const samples = [
      ['BackBar 제목', document.querySelector('header h1')],
      ['머리 제목', head?.querySelector('h2')],
      ['머리 수준 뱃지', head?.querySelector('span.flex-none.rounded-md')],
      ['머리 일본어명', head?.querySelector('[lang=ja]')],
      ['머리 설명', head?.querySelector('p:not([lang])')],
      ['InfoBox 문구', leaf(/기본 주제예요|내 버전이에요/)],
      ['표현 절 제목', document.querySelector('#tp-chunks')],
      ['표현 종류 h3', chunks?.querySelector('h3')],
      ['표현 일본어', chunks?.querySelector('li p[lang=ja]')],
      ['표현 뜻', chunks ? [...chunks.querySelectorAll('li p')].find((p) => !p.hasAttribute('lang')) : null],
      ['[고치기] 링크', chunks ? [...chunks.querySelectorAll('a')].find((a) => /고치기/.test(a.textContent)) : null],
      ['상황 카드 제목', sc?.querySelector('li button .font-semibold, li button span')],
      ['＋ 이 주제로 상황 만들기', sc ? [...sc.querySelectorAll('a')].find((a) => /상황 만들기/.test(a.textContent)) : null],
      ['나에게서 숨기기', leaf(/^나에게서 숨기기$/)],
      ['숨기기 부제', leaf(/나에게만 숨겨지고/)],
    ]
    return samples.map(([label, el]) => {
      if (!el) return { label, missing: true }
      const cs = getComputedStyle(el)
      const bg = bgOf(el)
      const fg = rgba(cs.color)
      const f = fg[3] < 1 ? over(fg, bg) : fg
      const L1 = lum(f), L2 = lum(bg)
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
      return { label, ratio: Math.round(ratio * 100) / 100, fs: parseFloat(cs.fontSize), fg: f.slice(0, 3).map(Math.round).join(','), bg: bg.slice(0, 3).map(Math.round).join(',') }
    })
  })

const browser = await launch()
for (const vp of WIDTHS) {
  const tag = `${vp.w}`
  const ctx = await newCtx(browser, vp)

  // ── A. 시드 주제 S6 실데이터 ───────────────────────────────────
  {
    const page = await openPage(ctx, S6)
    const d = await page.evaluate((tid) => {
      const main = document.querySelector('main')
      const container = document.querySelector('div.mx-auto.min-w-0')
      const head = container.querySelector('section')
      const info = [...container.children].find((c) => /기본 주제예요/.test(c.textContent) && c !== head && !c.matches('section'))
      const chunks = document.querySelector('section[aria-labelledby=tp-chunks]')
      const sc = document.querySelector('section[aria-labelledby=tp-scenarios]')
      const rect = (e) => { const r = e.getBoundingClientRect(); return { h: Math.round(r.height * 10) / 10, top: Math.round(r.top + main.scrollTop), w: Math.round(r.width) } }
      const add = [...document.querySelectorAll('a')].find((a) => /이 주제로 상황 만들기/.test(a.textContent))
      const hide = [...document.querySelectorAll('button')].find((b) => /^나에게서 숨기기$/.test(b.textContent.trim()))
      const ja = [...document.querySelectorAll('[lang=ja]')].map((e) => ({ t: e.textContent.trim().slice(0, 12), fs: parseFloat(getComputedStyle(e).fontSize), kind: e.closest('section[aria-labelledby=tp-chunks]') ? (e.classList.contains('text-ink2') ? 'reading' : 'textJa') : e.closest('section[aria-labelledby=tp-scenarios]') ? 'scenario' : 'titleJa' }))
      return {
        title: head.querySelector('h2')?.textContent,
        badges: [...head.querySelectorAll('span.flex-none.rounded-md')].map((b) => b.textContent),
        titleJaTxt: head.querySelector('[lang=ja]')?.textContent ?? null,
        desc: head.querySelector('p:not([lang])')?.textContent ?? null,
        head: rect(head),
        infoText: info?.textContent.trim() ?? null,
        chunksHead: chunks.querySelector('h2')?.textContent,
        chunkLis: chunks.querySelectorAll('li').length,
        chunkInteractive: chunks.querySelectorAll('li button, li a, li input, li textarea, li select').length,
        editLink: (() => { const a = [...chunks.querySelectorAll('a')].find((x) => /고치기/.test(x.textContent)); return a ? { href: a.getAttribute('href'), h: Math.round(a.getBoundingClientRect().height), label: a.getAttribute('aria-label') } : null })(),
        scHead: sc.querySelector('h2')?.textContent,
        scCards: sc.querySelectorAll('ul li').length,
        addHref: add?.getAttribute('href') ?? null, addH: add ? Math.round(add.getBoundingClientRect().height) : null,
        hideBtn: hide ? { h: Math.round(hide.getBoundingClientRect().height), w: Math.round(hide.getBoundingClientRect().width), cls: hide.className.includes('text-bad') } : null,
        hideSub: [...document.querySelectorAll('p')].find((p) => /나에게만 숨겨지고/.test(p.textContent))?.textContent ?? null,
        ja,
        mainScrollH: main.scrollHeight,
      }
    }, T.id)
    console.log(`[${tag}] S6`, JSON.stringify({ title: d.title, badges: d.badges, head: d.head, chunksHead: d.chunksHead, chunkLis: d.chunkLis, scHead: d.scHead, scCards: d.scCards, addHref: d.addHref, edit: d.editLink, hide: d.hideBtn }))
    check(`4.A.head card: title+level+「기본」 badges+일본어명+설명@${tag}`, d.title === T.title && d.badges.length === 2 && d.badges[1] === '기본' && d.titleJaTxt === T.titleJa && d.desc === T.description, `title=${d.title} badges=${d.badges} ja=${d.titleJaTxt}`)
    check(`4.A.「기본 주제예요…」 info box text@${tag}`, d.infoText === '기본 주제예요. 고쳐서 저장하면 내 버전이 생기고, 내 목록에는 내 버전이 대신 보여요.', d.infoText ?? 'missing')
    check(`4.A.기본 표현 ${T.chunks.length}개 heading + ${T.chunks.length} read-only items@${tag}`, d.chunksHead === `기본 표현 ${T.chunks.length}개` && d.chunkLis === T.chunks.length && d.chunkInteractive === 0, `head=${d.chunksHead} li=${d.chunkLis} interactiveInList=${d.chunkInteractive}`)
    check(`4.A.「이 주제의 상황 n개」 == S2 「상황 n개」(${scCount}) == cards@${tag}`, d.scHead === `이 주제의 상황 ${scCount}개` && d.scCards === scCount, `head=${d.scHead} cards=${d.scCards}`)
    check(`4.A.[＋ 이 주제로 상황 만들기] href@${tag}`, d.addHref === `/study/ai/scenario/new?from=manage&topicId=${T.id}` && d.addH >= 44, `href=${d.addHref?.replace(T.id, '<id>')} h=${d.addH}`)
    check(`4.A.[고치기] link → /edit, h>=44, aria-label@${tag}`, !!d.editLink && d.editLink.href === `/settings/scenarios/topics/${T.id}/edit` && d.editLink.h >= 44 && !!d.editLink.label, JSON.stringify(d.editLink)?.replace(T.id, '<id>'))
    check(`4.A.[나에게서 숨기기] text button (text-bad) + 부제 「나에게만 숨겨지고, 다시 볼 수 있어요」@${tag}`, !!d.hideBtn && d.hideBtn.cls && d.hideBtn.h >= 44 && d.hideSub === '나에게만 숨겨지고, 다시 볼 수 있어요', JSON.stringify(d.hideBtn) + ' sub=' + d.hideSub)
    // 일본어 글자 크기
    const ja = d.ja
    const textJa = ja.filter((x) => x.kind === 'textJa')
    check(`4.A.표현 일본어(textJa) lang=ja font >=16px@${tag}`, textJa.length === T.chunks.length && textJa.every((x) => x.fs >= 16), `n=${textJa.length} min=${Math.min(...textJa.map((x) => x.fs))}`)
    const small = ja.filter((x) => x.fs < 16).reduce((m, x) => { m[x.kind] = `${x.fs}px`; return m }, {})
    check(`4.A.[info] lang=ja <16px kinds (titleJa 13px 는 REV-159 확정 예외)@${tag}`, true, JSON.stringify(small))
    const ov = await overflowReport(page)
    check(`4.A.no-hscroll@${tag}`, !ov.docOverflowX && !ov.mainOverflowX && ov.overflowCount === 0, JSON.stringify({ doc: ov.docScrollWidth, cw: ov.clientWidth, mainSW: ov.mainScrollW, mainCW: ov.mainClientW, cnt: ov.overflowCount, els: ov.overflowEls }))
    check(`4.A.no-page-vscroll@${tag}`, ov.pageVScroll === false, `docScrollH=${ov.docScrollH} innerH=${ov.innerHeight}`)
    const small44 = await touchSmall(page)
    console.log(`[${tag}] touch<44 (S6)`, JSON.stringify(small44))
    check(`4.A.touch targets <44px list (S6 page)@${tag}`, small44.length === 0, JSON.stringify(small44))
    const txt = await visibleText(page)
    check(`4.A.no 엔진·모델·「AI」 text (S6)@${tag}`, !ENGINE_RE.test(txt), (txt.match(ENGINE_RE) ?? ['-'])[0])
    check(`4.A.no page errors@${tag}`, page.__errs.length === 0, JSON.stringify(page.__errs.slice(0, 3)))
    if (vp.w === 390) await page.screenshot({ path: `${SHOTS}/item4-s6-light-390.png` })

    // ── B. [나에게서 숨기기] 시트: 열기 → [취소] 만 ─────────────────
    const hideBtn = page.getByRole('button', { name: '나에게서 숨기기', exact: true })
    await hideBtn.scrollIntoViewIfNeeded()
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^나에게서 숨기기$/.test(x.textContent.trim())); b.setAttribute('data-qa-opener', '1') })
    await page.waitForTimeout(200)
    const topBefore = await page.evaluate(() => document.querySelector('main').scrollTop)
    await hideBtn.tap()
    await page.waitForSelector('[role=dialog]', { timeout: 10_000 })
    await page.waitForFunction(() => { const dlg = document.querySelector('[role=dialog]'); return dlg && [...dlg.querySelectorAll('button')].some((b) => /^나에게서 숨기기$/.test(b.textContent.trim())) && !/확인하는 중/.test(dlg.innerText) }, null, { timeout: 15_000 }).catch(() => {})
    await page.waitForTimeout(300)
    const sheet = await page.evaluate(() => {
      const dlg = document.querySelector('[role=dialog]')
      const btns = [...dlg.querySelectorAll('button')].map((b) => ({ t: (b.getAttribute('aria-label') || b.textContent).trim().slice(0, 20), h: Math.round(b.getBoundingClientRect().height), disabled: b.getAttribute('aria-disabled') }))
      const desc = dlg.getAttribute('aria-describedby')
      return { title: dlg.querySelector('h2')?.textContent, text: dlg.innerText, btns, desc, descText: desc ? document.getElementById(desc)?.textContent?.slice(0, 40) : null, focus: document.activeElement?.tagName.toLowerCase(), topOpen: document.querySelector('main').scrollTop, h: Math.round(dlg.getBoundingClientRect().height) }
    })
    console.log(`[${tag}] hide sheet`, JSON.stringify({ title: sheet.title, btns: sheet.btns, desc: sheet.desc, descText: sheet.descText, h: sheet.h }))
    check(`4.B.hide sheet opens: title + loaded (확인 버튼 보임)@${tag}`, /숨길까요/.test(sheet.title ?? '') && sheet.btns.some((b) => b.t === '나에게서 숨기기') && sheet.btns.some((b) => b.t === '취소'), `title=${sheet.title} btns=${sheet.btns.map((b) => b.t)}`)
    check(`4.B.hide sheet buttons >=44@${tag}`, sheet.btns.every((b) => b.h >= 44), JSON.stringify(sheet.btns))
    check(`4.B.hide sheet [info] aria-describedby (REV-161 M-1 열린 항목)@${tag}`, true, `describedby=${sheet.desc ?? 'none'} → ${sheet.descText ?? '-'}`)
    check(`4.B.hide sheet open: scrollTop diff 0@${tag}`, sheet.topOpen === topBefore, `before=${topBefore} open=${sheet.topOpen}`)
    check(`4.B.hide sheet no 엔진/AI text@${tag}`, !ENGINE_RE.test(sheet.text), (sheet.text.match(ENGINE_RE) ?? ['-'])[0])
    const small44d = await touchSmall(page)
    check(`4.B.touch<44 (with sheet open)@${tag}`, small44d.filter((e) => e.t !== 'N').length === 0, JSON.stringify(small44d))
    if (vp.w === 390) await page.screenshot({ path: `${SHOTS}/item4-hide-sheet-390.png` })
    // 취소만
    await page.locator('[role=dialog]').getByRole('button', { name: '취소', exact: true }).tap()
    await page.waitForSelector('[role=dialog]', { state: 'detached', timeout: 10_000 })
    await page.waitForTimeout(400)
    const after = await page.evaluate(() => ({ top: document.querySelector('main').scrollTop, opener: document.activeElement?.hasAttribute('data-qa-opener') === true, url: location.pathname }))
    check(`4.B.cancel → closed, focus back to [나에게서 숨기기], scrollTop diff 0@${tag}`, after.opener && after.top === topBefore && after.url === S6, JSON.stringify(after))
    const ov2 = await api('/api/v1/seed-overrides')
    const tp2 = await api('/api/v1/topics?level=all')
    check(`4.B.nothing hidden (overrides 0, seed topics 5) after cancel@${tag}`, (ov2.json?.data?.items?.length ?? -1) === 0 && (tp2.json?.data?.items?.filter((t) => t.isSeed).length ?? -1) === 5, `overrides=${ov2.json?.data?.items?.length} seedTopics=${tp2.json?.data?.items?.filter((t) => t.isSeed).length}`)
    await page.close()
  }

  // ── C. 404(없는 id·남의 id·XSS 문자열) ────────────────────────
  {
    const cases = [
      ['nonexistent', '/settings/scenarios/topics/nonexistent-id-qa045'],
      ['other-user', `/settings/scenarios/topics/${other.id}`],
      ['xss-literal', '/settings/scenarios/topics/%3Cimg%20src%3Dx%20onerror%3Dwindow.__xss%3D1%3E'],
    ]
    for (const [name, path] of cases) {
      if (!other.id && name === 'other-user') { check(`4.C.404 ${name}@${tag}`, null, 'no other QA topic'); continue }
      const page = await openPage(ctx, path)
      const r = await page.evaluate(() => {
        const main = document.querySelector('main')
        const btn = [...main.querySelectorAll('a')].find((a) => /내 상황·주제로/.test(a.textContent))
        return { text: main.innerText, btn: btn ? { href: btn.getAttribute('href'), h: Math.round(btn.getBoundingClientRect().height) } : null, imgs: document.querySelectorAll('img[src="x"]').length, xss: window.__xss ?? null, tab: !!document.querySelector('nav[aria-label="주 메뉴"]') }
      })
      check(`4.C.404 ${name}: 「이 주제를 찾을 수 없어요」+안내+[내 상황·주제로]@${tag}`, /이 주제를 찾을 수 없어요/.test(r.text) && /지워졌거나 내 목록에서 숨긴 주제예요/.test(r.text) && r.btn?.href === '/settings/scenarios' && r.btn.h >= 44, `btn=${JSON.stringify(r.btn)}`)
      if (name === 'xss-literal') check(`4.C.404 xss literal: img[src=x] 0, handler not run, text only@${tag}`, r.imgs === 0 && r.xss === null, `imgs=${r.imgs} xss=${r.xss}`)
      check(`4.C.404 ${name}: no 엔진 text, tabbar hidden@${tag}`, !ENGINE_RE.test(r.text) && r.tab === false, '')
      if (name === 'nonexistent') { const ov = await overflowReport(page); check(`4.C.404 no-hscroll@${tag}`, !ov.docOverflowX && !ov.mainOverflowX && ov.overflowCount === 0, JSON.stringify({ cnt: ov.overflowCount })) }
      await page.close()
    }
  }

  // ── D. 자리표시 점프(응답 1.5초 지연) — 실데이터 / 설명·일본어명 없음 fixture ─────
  for (const variant of ['real', 'stripped']) {
    const page = await ctx.newPage()
    page.setDefaultTimeout(60_000)
    await page.addInitScript(() => {
      window.__cls = 0
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true })
    })
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
      return { skeleton: [...main.querySelectorAll('[role=status]')].some((e) => /불러오는 중/.test(e.textContent)), spans: spans.map((s) => { const r = s.getBoundingClientRect(); return [Math.round(r.height), Math.round(r.top + main.scrollTop)] }), scrollH: main.scrollHeight }
    })
    await page.waitForSelector('section[aria-labelledby=tp-chunks]', { timeout: 15_000 })
    await page.waitForTimeout(600)
    const R = await page.evaluate(() => {
      const main = document.querySelector('main')
      const container = document.querySelector('div.mx-auto.min-w-0')
      const kids = [...container.children]
      const pos = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.height * 10) / 10, Math.round((r.top + main.scrollTop) * 10) / 10] }
      return { head: pos(kids[0]), info: pos(kids[1]), chunks: pos(document.querySelector('section[aria-labelledby=tp-chunks]')), sc: pos(document.querySelector('section[aria-labelledby=tp-scenarios]')), scrollH: main.scrollHeight, cls: Math.round(window.__cls * 1000) / 1000 }
    })
    console.log(`[${tag}] D ${variant} L`, JSON.stringify(L))
    console.log(`[${tag}] D ${variant} R`, JSON.stringify(R))
    const [skHead, skInfo, skChunks, skSc] = L.spans
    const headDiff = Math.round((R.head[0] - skHead[0]) * 10) / 10
    const infoShift = Math.round((R.info[1] - skInfo[1]) * 10) / 10
    const chunksShift = Math.round((R.chunks[1] - skChunks[1]) * 10) / 10
    const scShift = Math.round((R.sc[1] - skSc[1]) * 10) / 10
    check(`4.D.${variant}: skeleton shown while loading, 4 blocks [104,64,240,120]@${tag}`, L.skeleton && JSON.stringify(L.spans.map((s) => s[0])) === '[104,64,240,120]', JSON.stringify(L.spans))
    check(`4.D.${variant}: [info] head card actual vs 104 / 출처 상자 위치 shift / 표현 절 shift@${tag}`, true, `headActual=${R.head[0]} (placeholder 104 → diff ${headDiff}) · infoBox top L=${skInfo[1]} R=${R.info[1]} shift=${infoShift} (actual h=${R.info[0]} vs 64) · chunks top L=${skChunks[1]} R=${R.chunks[1]} shift=${chunksShift} · scenarios top L=${skSc[1]} R=${R.sc[1]} shift=${scShift} · CLS=${R.cls}`)
    check(`4.D.${variant}: 첫 화면 점프(머리 카드 높이 차) <=8px (IMP-0027)@${tag}`, Math.abs(headDiff) <= 8, `headActual=${R.head[0]} placeholder=104 diff=${headDiff}`)
    check(`4.D.${variant}: 출처 상자 시작 위치 점프 <=8px@${tag}`, Math.abs(infoShift) <= 8, `shift=${infoShift}`)
    await page.close()
  }

  // ── E. fixture: 긴 글·긴 일본어·챌린지 카드 가로 넘침 ─────────────────
  {
    const longTitle = '가'.repeat(60)
    const longJa = 'あ'.repeat(70)
    const page = await openPage(ctx, S6, async (p) => {
      await p.route(isTopics, async (r) => {
        const resp = await r.fetch()
        const j = await resp.json()
        const items = j.data?.items ?? j.items
        const it = items.find((x) => x.id === T.id)
        it.title = longTitle
        it.titleJa = longJa
        it.description = '긴 설명 '.repeat(40).trim()
        it.chunks[0].textJa = longJa
        it.chunks[0].reading = 'ア'.repeat(80)
        it.chunks[0].meaningKo = '뜻'.repeat(100)
        await r.fulfill({ response: resp, json: j })
      })
      await p.route(isCh, (r) => r.fulfill({ json: { success: true, data: { items: [{ id: 'qa-fixture-chal', status: 'ACTIVE', title: '아주 긴 챌린지 제목 '.repeat(5).trim(), lengthDays: 7, topic: { id: T.id, title: longTitle }, stats: { dayIndex: 12 } }], nextCursor: null }, message: null } }))
    })
    const ov = await overflowReport(page)
    const ch = await page.evaluate(() => { const l = [...document.querySelectorAll('a')].find((a) => /챌린지 보기/.test(a.textContent)); const p = l?.parentElement; return { link: l ? { h: Math.round(l.getBoundingClientRect().height), right: Math.round(l.getBoundingClientRect().right), fs: getComputedStyle(l).flexShrink } : null, card: p ? Math.round(p.getBoundingClientRect().right) : null, cardText: p?.innerText.slice(0, 60) } })
    console.log(`[${tag}] E fixture`, JSON.stringify({ ov: { doc: ov.docScrollWidth, cw: ov.clientWidth, cnt: ov.overflowCount, els: ov.overflowEls }, ch }))
    check(`4.E.long title/ja/desc/chunk/challenge[fixture]: no-hscroll@${tag}`, !ov.docOverflowX && !ov.mainOverflowX && ov.overflowCount === 0, JSON.stringify({ doc: ov.docScrollWidth, cw: ov.clientWidth, mainSW: ov.mainScrollW, mainCW: ov.mainClientW, cnt: ov.overflowCount, els: ov.overflowEls }))
    check(`4.E.challenge card[fixture]: 「챌린지 보기 ›」 link visible, flex-none, >=44, inside viewport@${tag}`, !!ch.link && ch.link.fs === '0' && ch.link.h >= 44 && ch.link.right <= vp.w - 16 + 1, JSON.stringify(ch))
    if (vp.w === 360) await page.screenshot({ path: `${SHOTS}/item4-s6-fixture-long-360.png` })
    await page.close()
  }

  // ── F. S2 두 탭·설정 행·상황 시트 엔진 문자열 검사 ────────────────────
  {
    const outs = []
    for (const [name, path] of [['S2 topics', '/settings/scenarios'], ['S2 scenarios', '/settings/scenarios?tab=scenarios'], ['S2 scenario sheet', `/settings/scenarios?tab=scenarios&sc=${scItems[0].id}`]]) {
      const p = await openPage(ctx, path)
      if (name === 'S2 scenario sheet') await p.waitForFunction(() => /고치기/.test(document.querySelector('[role=dialog]')?.innerText ?? ''), null, { timeout: 15_000 }).catch(() => {})
      const t = await visibleText(p)
      outs.push([name, ENGINE_RE.test(t) ? (t.match(ENGINE_RE) ?? ['?'])[0] : null])
      await p.close()
    }
    const p = await openPage(ctx, '/settings')
    const rowTxt = await p.evaluate(() => document.querySelector('a[href="/settings/scenarios"]')?.closest('section')?.innerText ?? '')
    outs.push(['settings 회화 연습 row', ENGINE_RE.test(rowTxt) ? (rowTxt.match(ENGINE_RE) ?? ['?'])[0] : null])
    await p.close()
    check(`4.F.no 엔진·모델·「AI」 in S2 topics/scenarios/sheet/settings row@${tag}`, outs.every(([, m]) => m === null), JSON.stringify(outs))
  }
  await ctx.close()
}

// ── G. 다크(390) — 스크린샷 1장 + 대비 계산(라이트와 비교) ─────────────────
{
  const vp = WIDTHS[1]
  for (const dark of [false, true]) {
    const ctx = await newCtx(browser, vp, { dark })
    const page = await openPage(ctx, S6)
    const base = await page.evaluate(() => ({ bodyBg: getComputedStyle(document.body).backgroundColor, bodyColor: getComputedStyle(document.body).color, scheme: matchMedia('(prefers-color-scheme: dark)').matches, rootCS: getComputedStyle(document.documentElement).colorScheme, themeAttr: document.documentElement.getAttribute('data-theme') }))
    const rep = await contrastReport(page)
    console.log(`[390 ${dark ? 'dark' : 'light'}] base`, JSON.stringify(base))
    for (const r of rep) console.log(`[390 ${dark ? 'dark' : 'light'}] contrast`, JSON.stringify(r))
    const missing = rep.filter((r) => r.missing).map((r) => r.label)
    const low = rep.filter((r) => !r.missing && r.ratio < 4.5).map((r) => `${r.label}:${r.ratio}(${r.fs}px)`)
    if (dark) {
      const lumBg = (() => { const m = base.bodyBg.match(/\d+/g).map(Number); return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255 })()
      check('4.G.dark: prefers-color-scheme dark → body background actually dark (tokens inverted)', base.scheme === true && lumBg < 0.25, `bodyBg=${base.bodyBg} bodyColor=${base.bodyColor} scheme=${base.rootCS}`)
      await page.screenshot({ path: `${SHOTS}/item4-s6-dark-390.png` })
    }
    check(`4.G.${dark ? 'dark' : 'light'}: contrast >=4.5 on ${rep.length - missing.length} sampled texts`, low.length === 0 && missing.length === 0, `low=[${low.join(', ')}] missing=[${missing.join(', ')}] min=${Math.min(...rep.filter((r) => !r.missing).map((r) => r.ratio))}`)
    await ctx.close()
  }
}
await browser.close()
summary()
