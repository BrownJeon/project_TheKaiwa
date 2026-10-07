/**
 * qa-045-ui-g 항목 1 — S6 자리표시 점프: 출처 3종(MINE·COPY·SEED) × 진입 2종(관리 화면 행 탭 ?o= 힌트 / 직접 주소) × 3폭.
 * + 진행 중 챌린지(자리표시에 없음 — 크기만 기록) + 잘못된 힌트(?o=s 로 MINE, ?o=m 으로 SEED, 허용 값 외·중복·스크립트·긴 문자열 → 쿼리 값 화면 출력 0).
 * 응답 1.5초 지연(page.route). LLM 0. QA3 만 쓴다(주제 MINE 1·사본 COPY 1·챌린지 1 → 끝에 전부 지움).
 * 실행: cd $Q && QA_BASE=http://127.0.0.1:3060 QA_SNAPSHOT=$Q QA_COOKIE=<c3 쿠키 파일> node --env-file=.env <이 파일>
 * 재사용: ../e/lib.mjs · ../e/ui.mjs (수정 없음). 이전 값(qa-045-ui-f): MINE 표현 절 283.5→208.5(−75, 360·390)·187.5(−96, 412).
 */
import { api, data, check, note, summary, launch, openPage, cookieOf, sleep, WIDTHS, BASE, QA3, T_CAFE, qaUser, qaRowCounts, cleanupQa, seedHash, insertChallenge, prisma, closeBrowser } from '../e/lib.mjs'
import { tap } from '../e/ui.mjs'

const c3 = cookieOf(process.env.QA_COOKIE)
const SEED_SHA = 'e826f3ef09237a9c'
const API_PATHS = ['/api/v1/topics', '/api/v1/scenarios', '/api/v1/seed-overrides', '/api/v1/challenges']
const SK = 'div.mx-auto.min-w-0 div[aria-hidden=true] > span.block'
const r1 = (n) => Math.round(n * 10) / 10

const u3 = await qaUser(QA3)
await cleanupQa(u3.id)
const h0 = await seedHash()
check('시작: 시드 해시 = e826f3ef09237a9c', h0.sha === SEED_SHA, h0.sha)
check('시작: QA3 행 0', Object.values(await qaRowCounts(u3.id)).every((n) => n === 0))

// ── 준비: MINE(#57)·COPY(#174 fork)·SEED(자기소개) ────────────────────────
const topicsList = data(await api(c3, 'GET', '/api/v1/topics?level=all'))?.items ?? []
const seedIntro = topicsList.find((t) => t.isSeed && t.title === '자기소개')
const chunks = seedIntro.chunks.slice(0, 8).map((x) => ({ chunkType: x.chunkType, textJa: x.textJa, reading: x.reading, meaningKo: x.meaningKo }))
const DESC = '내 주제 자리표시 점프를 재는 시험용 주제로 설명이 두 줄 이상이에요'
let rm = await api(c3, 'POST', '/api/v1/topics', { title: 'QA 내 주제 자리표시', titleJa: '自己紹介', level: 'N5', description: DESC, chunks })
if (rm.status === 429) { note('429 — 62초 대기'); await sleep(62000); rm = await api(c3, 'POST', '/api/v1/topics', { title: 'QA 내 주제 자리표시', titleJa: '自己紹介', level: 'N5', description: DESC, chunks }) }
const mineId = data(rm)?.topic?.id
check('준비: MINE #57 201', rm.status === 201 && !!mineId, JSON.stringify(rm.body).slice(0, 160))
let rf = await api(c3, 'POST', `/api/v1/topics/${T_CAFE}/fork`, {})
if (rf.status === 429) { note('429 — 62초 대기'); await sleep(62000); rf = await api(c3, 'POST', `/api/v1/topics/${T_CAFE}/fork`, {}) }
const copyId = data(rf)?.copyId
check('준비: COPY #174 fork 201', rf.status === 201 && !!copyId, JSON.stringify(rf.body).slice(0, 160))
const seedId = seedIntro.id
const ORIG = { MINE: { id: mineId, hint: 'm' }, COPY: { id: copyId, hint: 'c' }, SEED: { id: seedId, hint: 's' } }
note(`ids MINE=${mineId} COPY=${copyId} SEED=${seedId} (SEED=자기소개, COPY 원본=T_CAFE)`)

const delayRoute = (page) =>
  page.route((u) => API_PATHS.includes(u.pathname), async (r) => {
    const resp = await r.fetch()
    await sleep(1500)
    await r.fulfill({ response: resp })
  })

const browser = await launch()

/** 한 번 측정. entry='row'(S2 행 탭)|'direct'(직접 주소). query 는 직접 주소에 붙일 문자열(예: '?o=s'). 반환: 측정 객체. */
async function measure(W, H, { entry, id, query = '', marker = null }) {
  const { ctx, page } = await openPage(browser, W, H, c3)
  page.setDefaultTimeout(60_000)
  let dialogs = 0
  page.on('dialog', (d) => { dialogs++; d.dismiss().catch(() => {}) })
  let href = null
  try {
    if (entry === 'row') {
      await page.goto(`${BASE}/settings/scenarios?tab=topics`, { waitUntil: 'networkidle' })
      const row = page.locator(`main a[data-topic-id="${id}"]`).first()
      await row.waitFor({ state: 'attached', timeout: 20_000 })
      href = await row.getAttribute('href')
      await delayRoute(page)
      await tap(page, row)
    } else {
      await delayRoute(page)
      await page.goto(`${BASE}/settings/scenarios/topics/${id}${query}`, { waitUntil: 'commit' })
    }
    await page.waitForSelector(SK, { state: 'attached', timeout: 20_000 })
    await sleep(600)
    const L = await page.evaluate((SK) => {
      const main = document.querySelector('main')
      const spans = [...document.querySelectorAll(SK)].map((s) => { const r = s.getBoundingClientRect(); return [Math.round(r.height * 10) / 10, Math.round((r.top + main.scrollTop) * 10) / 10] })
      return { skeleton: [...main.querySelectorAll('[role=status]')].some((e) => /불러오는 중/.test(e.textContent)), spans }
    }, SK)
    await page.waitForSelector('section[aria-labelledby=tp-chunks]', { timeout: 25_000 })
    await sleep(600)
    const R = await page.evaluate(() => {
      const main = document.querySelector('main')
      const kids = [...document.querySelector('div.mx-auto.min-w-0').children]
      const chunksSec = document.querySelector('section[aria-labelledby=tp-chunks]')
      const pos = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.height * 10) / 10, Math.round((r.top + main.scrollTop) * 10) / 10] }
      const txt = main.innerText
      const clone = document.body.cloneNode(true)
      clone.querySelectorAll('script').forEach((s) => s.remove())
      return {
        head: pos(kids[0]),
        chunks: pos(chunksSec),
        sc: pos(document.querySelector('section[aria-labelledby=tp-scenarios]')),
        infoBox: kids.indexOf(chunksSec) > 1,
        txtSeed: /기본 주제예요/.test(txt),
        txtCopy: /내 버전이에요/.test(txt),
        txtRemove: /주제 지우기/.test(txt),
        txtChallenge: /챌린지/.test(txt),
        bodyText: document.body.innerText,
        html: clone.innerHTML,
        url: location.pathname + location.search,
      }
    })
    const out = { entry, W, href, url: R.url, nSpans: L.spans.length, skeleton: L.skeleton, L: L.spans, R, dialogs }
    const [skHead, , ] = L.spans
    const skChunks = L.spans[L.spans.length - 2]
    out.headDiff = r1(R.head[0] - skHead[0])
    out.chunksShift = r1(R.chunks[1] - skChunks[1])
    out.residual = r1(out.chunksShift - out.headDiff)
    out.skChunksTop = skChunks[1]
    out.markerInText = marker ? R.bodyText.includes(marker) : false
    out.markerInHtml = marker ? R.html.includes(marker) : false
    out.html = undefined
    out.R.html = undefined
    out.R.bodyText = undefined
    return out
  } finally {
    await ctx.close()
  }
}

try {
  // 개발 서버 첫 컴파일 데우기(측정 아님)
  {
    const { ctx, page } = await openPage(browser, 390, 844, c3)
    page.setDefaultTimeout(60_000)
    for (const p of ['/settings/scenarios?tab=topics', `/settings/scenarios/topics/${seedId}`, `/settings/scenarios/topics/${mineId}`]) await page.goto(BASE + p, { waitUntil: 'networkidle' }).catch(() => {})
    await ctx.close()
  }
  const table = []
  for (const [W, H] of WIDTHS) {
    // ── A. 정상 힌트(행 탭) / 직접 주소 ─────────────────────────
    for (const entry of ['row', 'direct']) {
      for (const o of ['MINE', 'COPY', 'SEED']) {
        const m = await measure(W, H, { entry, id: ORIG[o].id })
        table.push({ W, entry, o, ...m })
        note(`[${W}] ${entry} ${o}: href=${m.href} url=${m.url} 자리표시 ${m.nSpans}블록 L=${JSON.stringify(m.L)} 도착 head=${JSON.stringify(m.R.head)} chunks=${JSON.stringify(m.R.chunks)} 출처상자=${m.R.infoBox} | 머리 카드 차 ${m.headDiff} · 표현 절 이동 ${m.chunksShift} (머리 차 제외 ${m.residual})`)
        if (entry === 'row') {
          check(`[${W}] ① 행 ${o}: 링크에 ?o=${ORIG[o].hint}`, !!m.href && m.href.endsWith(`?o=${ORIG[o].hint}`), String(m.href))
          check(`[${W}] ① 행 ${o}: 표현 절 이동(머리 카드 차 제외) ≤8px`, Math.abs(m.residual) <= 8, `이동 ${m.chunksShift} − 머리차 ${m.headDiff} = ${m.residual} (표현 절 top ${m.skChunksTop}→${m.R.chunks[1]})`)
          check(`[${W}] ① 행 ${o}: 자리표시 블록 수 = ${o === 'MINE' ? 3 : 4}·도착 출처 상자 ${o === 'MINE' ? '없음' : '있음'}`, m.nSpans === (o === 'MINE' ? 3 : 4) && m.R.infoBox === (o !== 'MINE'), `spans=${m.nSpans} infoBox=${m.R.infoBox}`)
        } else {
          // 직접 주소 — 힌트 없음 = SEED 모양(4블록). MINE·COPY 는 알려진 한계(크기 기록)
          check(`[${W}] ② 직접 ${o}: 자리표시는 힌트 없는 기본 모양(4블록)`, m.nSpans === 4, `spans=${m.nSpans}`)
          if (o === 'SEED') check(`[${W}] ② 직접 SEED: 표현 절 이동(머리 카드 차 제외) ≤8px`, Math.abs(m.residual) <= 8, `이동 ${m.chunksShift} − 머리차 ${m.headDiff} = ${m.residual}`)
          else note(`[${W}] ② 직접 ${o}: 알려진 한계 — 표현 절 이동 ${m.chunksShift}px (머리 차 ${m.headDiff} 포함, 제외 ${m.residual})`)
        }
      }
    }
    // ── B. 잘못된 힌트 ────────────────────────────────────
    const wrong = await measure(W, H, { entry: 'direct', id: mineId, query: '?o=s' })
    check(`[${W}] B1 MINE+?o=s: 자리표시는 SEED 모양(4블록)·도착은 실제 MINE 화면(출처 상자 없음·[주제 지우기]·기본/내버전 문구 없음)`, wrong.nSpans === 4 && !wrong.R.infoBox && wrong.R.txtRemove && !wrong.R.txtSeed && !wrong.R.txtCopy, `spans=${wrong.nSpans} infoBox=${wrong.R.infoBox} remove=${wrong.R.txtRemove} seedTxt=${wrong.R.txtSeed} copyTxt=${wrong.R.txtCopy} 표현 절 이동 ${wrong.chunksShift}`)
    const wrong2 = await measure(W, H, { entry: 'direct', id: seedId, query: '?o=m' })
    check(`[${W}] B2 SEED+?o=m: 자리표시 3블록·도착은 실제 SEED 화면(출처 상자 「기본 주제예요」 있음)`, wrong2.nSpans === 3 && wrong2.R.infoBox && wrong2.R.txtSeed, `spans=${wrong2.nSpans} infoBox=${wrong2.R.infoBox} seedTxt=${wrong2.R.txtSeed} 표현 절 이동 ${wrong2.chunksShift}`)
    const bad = [
      ['?o=x', 'x'],
      ['?o=m&o=s', null],
      ['?o=M', 'M'],
      ['?o=', null],
      [`?o=${encodeURIComponent('<script>alert(1)</script>ZZINJ')}`, 'ZZINJ'],
      [`?o=${'ZZLONG'.repeat(500)}`, 'ZZLONG'],
      [`?o=${encodeURIComponent('<img src=x onerror=alert(2)>ZZIMG')}`, 'ZZIMG'],
    ]
    for (const [q, mk] of bad) {
      const m = await measure(W, H, { entry: 'direct', id: seedId, query: q, marker: mk })
      const label = q.length > 40 ? q.slice(0, 30) + `…(${q.length}자)` : q
      check(`[${W}] B3 ${label}: 무시(기본 모양 4블록)·쿼리 값 화면·마크업 출력 0·대화상자 0`, m.nSpans === 4 && !m.markerInText && !m.markerInHtml && m.dialogs === 0 && m.R.txtSeed, `spans=${m.nSpans} inText=${m.markerInText} inHtml=${m.markerInHtml} dialogs=${m.dialogs} seedTxt=${m.R.txtSeed}`)
    }
    // ── C. 진행 중 챌린지가 있는 MINE(행 탭) — 자리표시에 챌린지 줄이 없어 밀리는 크기(참고) ──
    const ch = await insertChallenge(u3.id, { id: mineId, title: 'QA 내 주제 자리표시', level: 'N5' }, 'ACTIVE', { title: 'QA 자리표시 챌린지' })
    try {
      const mc = await measure(W, H, { entry: 'row', id: mineId })
      note(`[${W}] C 챌린지 있는 MINE(행 탭): 자리표시 ${mc.nSpans}블록·표현 절 top ${mc.skChunksTop}→${mc.R.chunks[1]} 이동 ${mc.chunksShift}(머리 차 ${mc.headDiff}, 제외 ${mc.residual}) 화면 「챌린지」 글 ${mc.R.txtChallenge}`)
      table.push({ W, entry: 'row+challenge', o: 'MINE', chunksShift: mc.chunksShift, residual: mc.residual, headDiff: mc.headDiff })
    } finally {
      await prisma.challenge.deleteMany({ where: { id: ch.id, userId: u3.id } })
    }
  }
  console.log('TABLE ' + JSON.stringify(table.map((t) => ({ W: t.W, e: t.entry, o: t.o, headDiff: t.headDiff, shift: t.chunksShift, resid: t.residual, skTop: t.skChunksTop, arr: t.R?.chunks?.[1], n: t.nSpans }))))
} finally {
  await closeBrowser(browser)
  const cf = await cleanupQa(u3.id)
  const c31 = await qaRowCounts(u3.id)
  const h1 = await seedHash()
  note(`정리 ${JSON.stringify(cf)} → QA3 행 ${JSON.stringify(c31)}`)
  check('종료: QA3 행 0', Object.values(c31).every((n) => n === 0), JSON.stringify(c31))
  check(`종료: 시드 해시 불변 ${h1.sha}`, h1.sha === SEED_SHA && h1.sha === h0.sha, `${h0.sha} → ${h1.sha}`)
  summary('qa-045-ui-g item1')
  await prisma.$disconnect()
  process.exit(0)
}
