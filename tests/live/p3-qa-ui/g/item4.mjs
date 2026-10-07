/**
 * qa-045-ui-g 항목 4 — 마무리 회귀 샘플: S2 두 탭·S6(MINE ?o=m·COPY ?o=c·SEED ?o=s)·S7·변형 선택 단계 세 폭 가로 넘침 0·44px 미만 터치 요소 목록·엔진/모델명 0건,
 * + 항목 1 보충: `?o=x`·`?o=M` 의 쿼리 값이 화면 글·마크업(script 제외)에 나오는지 엄격 재검사(item1 의 한 글자 표지 오탐 정리). LLM 0. QA3 행(주제 1·사본 1)은 끝에 모두 지운다.
 * 실행: cd $Q && QA_BASE=http://127.0.0.1:3060 QA_SNAPSHOT=$Q QA_COOKIE=<c3 쿠키 파일> node --env-file=.env <이 파일>
 * 재사용: ../e/lib.mjs · ../e/ui.mjs · ../f/item4.mjs 의 measure
 */
import { api, data, check, note, summary, launch, openPage, cookieOf, sleep, WIDTHS, BASE, SEED_SC, QA3, T_CAFE, qaUser, qaRowCounts, cleanupQa, seedHash, prisma, closeBrowser } from '../e/lib.mjs'
import { overflow, smallTargets } from '../e/ui.mjs'

const cookie = cookieOf(process.env.QA_COOKIE)
const SEED_SHA = 'e826f3ef09237a9c'
const ENGINE_RE = /claude|haiku|sonnet|opus|reazon|whisper|style-bert|model_id|speaker_id|qwen|ollama|sherpa/i
const visibleText = (page) => page.evaluate(() => `${document.body.innerText}\n${[...document.querySelectorAll('[aria-label],[title],[alt],[placeholder]')].map((e) => [e.getAttribute('aria-label'), e.getAttribute('title'), e.getAttribute('alt'), e.getAttribute('placeholder')].filter(Boolean).join(' ')).join('\n')}`)
const mainDims = (page) => page.evaluate(() => { const m = document.querySelector('main'); return { sw: m.scrollWidth, cw: m.clientWidth, docSW: document.documentElement.scrollWidth, pageV: document.documentElement.scrollHeight > innerHeight + 1 } })
const smallLog = []

async function measure(page, W, name) {
  const md = await mainDims(page)
  const ov = await overflow(page)
  const sm = await smallTargets(page)
  const txt = await visibleText(page)
  const eng = txt.match(ENGINE_RE)?.[0] ?? null
  smallLog.push({ W, name, sm })
  note(`[${W}] ${name}: main ${md.sw}/${md.cw} doc ${md.docSW} 페이지 세로 스크롤 ${md.pageV} 넘친 요소 ${ov.count} ${JSON.stringify(ov.items.slice(0, 2))} · 44px 미만 ${sm.length}건 ${JSON.stringify(sm.slice(0, 5))} · 엔진명 ${eng ?? '없음'}`)
  check(`[${W}] ${name}: 가로 넘침 0(main.scrollWidth ≤ clientWidth·넘친 요소 0)`, md.sw <= md.cw && md.docSW <= W && ov.count === 0, `main ${md.sw}/${md.cw} doc ${md.docSW} els ${ov.count} ${JSON.stringify(ov.items.slice(0, 2))}`)
  check(`[${W}] ${name}: 엔진·모델명 정규식 0건`, eng === null, String(eng))
}

const u = await qaUser(QA3)
await cleanupQa(u.id)
const h0 = await seedHash()
check('시작: 시드 해시 = e826f3ef09237a9c', h0.sha === SEED_SHA, h0.sha)
check('시작: QA3 행 0', Object.values(await qaRowCounts(u.id)).every((n) => n === 0))
const seed = (data(await api(cookie, 'GET', '/api/v1/topics?level=all'))?.items ?? []).find((t) => t.isSeed && t.title === '자기소개')
const chunks = seed.chunks.slice(0, 8).map((x) => ({ chunkType: x.chunkType, textJa: x.textJa, reading: x.reading, meaningKo: x.meaningKo }))
let rm = await api(cookie, 'POST', '/api/v1/topics', { title: 'QA 회귀 내 주제', titleJa: '自己紹介', level: 'N5', description: '회귀 샘플용 내 주제 설명이 두 줄 이상이 되도록 조금 길게 적은 문장이에요', chunks })
if (rm.status === 429) { note('429 — 62초 대기'); await sleep(62000); rm = await api(cookie, 'POST', '/api/v1/topics', { title: 'QA 회귀 내 주제', titleJa: '自己紹介', level: 'N5', description: '회귀 샘플용 내 주제 설명이 두 줄 이상이 되도록 조금 길게 적은 문장이에요', chunks }) }
const mineId = data(rm)?.topic?.id
check('준비: MINE #57 201', rm.status === 201 && !!mineId, JSON.stringify(rm.body).slice(0, 150))
let rf = await api(cookie, 'POST', `/api/v1/topics/${T_CAFE}/fork`, {})
if (rf.status === 429) { note('429 — 62초 대기'); await sleep(62000); rf = await api(cookie, 'POST', `/api/v1/topics/${T_CAFE}/fork`, {}) }
const copyId = data(rf)?.copyId
check('준비: COPY #174 fork 201', rf.status === 201 && !!copyId, JSON.stringify(rf.body).slice(0, 150))

const browser = await launch()
try {
  for (const [W, H] of WIDTHS) {
    const { ctx, page } = await openPage(browser, W, H, cookie)
    page.setDefaultTimeout(60000)
    const screens = [
      ['S2 주제 탭', '/settings/scenarios?tab=topics', 'a[data-topic-id]'],
      ['S2 상황 탭', '/settings/scenarios?tab=scenarios', 'main ul li'],
      ['S6 SEED ?o=s', `/settings/scenarios/topics/${seed.id}?o=s`, '#tp-chunks'],
      ['S6 MINE ?o=m', `/settings/scenarios/topics/${mineId}?o=m`, '#tp-chunks'],
      ['S6 COPY ?o=c', `/settings/scenarios/topics/${copyId}?o=c`, '#tp-chunks'],
      ['S7 주제 고치기(MINE)', `/settings/scenarios/topics/${mineId}/edit`, 'main input'],
      ['변형 선택 단계', `/study/ai/scenario/${SEED_SC}/variant`, 'text=무엇을 바꿔 볼까요?'],
    ]
    for (const [name, path, sel] of screens) {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 90000 })
      await page.waitForSelector(sel, { timeout: 45000 }).catch(() => {})
      await sleep(1000)
      await measure(page, W, name)
    }
    // ── 항목 1 보충: 엄격한 쿼리 값 출력 재검사 ──
    for (const [q, needle] of [['?o=x', 'o=x'], ['?o=M', 'o=M']]) {
      await page.goto(`${BASE}/settings/scenarios/topics/${seed.id}${q}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
      await page.waitForSelector('#tp-chunks', { timeout: 45000 }).catch(() => {})
      await sleep(800)
      const v = q.slice(3)
      const r = await page.evaluate(([needle, v]) => {
        const clone = document.body.cloneNode(true)
        clone.querySelectorAll('script').forEach((s) => s.remove())
        const html = clone.innerHTML
        let attrEq = 0
        let textEq = 0
        for (const e of clone.querySelectorAll('*')) {
          for (const a of e.attributes) if (a.value === v) attrEq++
          for (const n of e.childNodes) if (n.nodeType === 3 && n.textContent.trim() === v) textEq++
        }
        return { inText: document.body.innerText.includes(needle), inHtml: html.includes(needle), attrEq, textEq, seedBox: /기본 주제예요/.test(document.querySelector('main').innerText) }
      }, [needle, v])
      note(`[${W}] 쿼리 ${q} 엄격 검사: ${JSON.stringify(r)}`)
      check(`[${W}] ${q}: 쿼리 값이 화면 글·마크업(script 제외)에 0 — "${needle}" 문자열·값이 ${v} 인 속성·글 노드 0`, !r.inText && !r.inHtml && r.attrEq === 0 && r.textEq === 0 && r.seedBox, JSON.stringify(r))
    }
    await ctx.close()
  }
} finally {
  await closeBrowser(browser)
  const cf = await cleanupQa(u.id)
  const c1 = await qaRowCounts(u.id)
  const h1 = await seedHash()
  note(`정리 ${JSON.stringify(cf)} → QA3 행 ${JSON.stringify(c1)}`)
  const flat = smallLog.filter((x) => x.sm.length)
  note(`44px 미만 터치 요소 보유 화면 ${flat.length}곳: ${JSON.stringify(flat.map((x) => ({ W: x.W, name: x.name, sm: x.sm.map((s) => `${s.tag}:${s.text}:${s.h}x${s.w}`) })))}`)
  check('종료: QA3 행 0', Object.values(c1).every((n) => n === 0), JSON.stringify(c1))
  check(`종료: 시드 해시 불변 ${h1.sha}`, h1.sha === SEED_SHA && h1.sha === h0.sha, `${h0.sha} → ${h1.sha}`)
  summary('qa-045-ui-g item4')
  await prisma.$disconnect()
  process.exit(0)
}
