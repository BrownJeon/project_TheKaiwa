/**
 * qa-045-ui-g 항목 2 — 주제 만들기 저장 뒤 도착 경로(힌트 m): 보관 초안(sessionStorage) 주입 → [이어서 고치기] → [주제만 저장] → S6 주소 `?o=m`·자리표시 3블록·표현 절 위치 차.
 * 응답 1.5초 지연은 저장 직후부터(GET 만). LLM 0 — 초안 보관값은 scratchpad qaui-c-snapshot.json(이전 QA 가 만든 것) 재사용. QA3 만. 세 폭 모두, 폭마다 만든 주제는 지운다.
 * 실행: cd $Q && QA_BASE=http://127.0.0.1:3060 QA_SNAPSHOT=$Q QA_COOKIE=<c3 쿠키 파일> node --env-file=.env <이 파일>
 */
import { readFileSync } from 'node:fs'
import { check, note, summary, launch, openPage, cookieOf, sleep, WIDTHS, BASE, QA3, qaUser, qaRowCounts, cleanupQa, seedHash, prisma, closeBrowser, SCRATCH } from '../e/lib.mjs'
import { tap } from '../e/ui.mjs'

const c3 = cookieOf(process.env.QA_COOKIE)
const SEED_SHA = 'e826f3ef09237a9c'
const STORE_KEY = 'kaiwa.topic.draft'
const NEW_PATH = '/settings/scenarios/topics/new'
const API_PATHS = ['/api/v1/topics', '/api/v1/scenarios', '/api/v1/seed-overrides', '/api/v1/challenges']
const SK = 'div.mx-auto.min-w-0 div[aria-hidden=true] > span.block'
const r1 = (n) => Math.round(n * 10) / 10

const u3 = await qaUser(QA3)
await cleanupQa(u3.id)
const h0 = await seedHash()
check('시작: 시드 해시 = e826f3ef09237a9c', h0.sha === SEED_SHA, h0.sha)
check('시작: QA3 행 0', Object.values(await qaRowCounts(u3.id)).every((n) => n === 0))

const SNAP0 = JSON.parse(JSON.parse(readFileSync(`${SCRATCH}/qaui-c-snapshot.json`, 'utf8')).raw)
SNAP0.userId = u3.id
SNAP0.savedTopicId = null
note(`보관 초안 키 ${Object.keys(SNAP0).join(',')} | 칸 ${SNAP0.draft?.chunks?.length}개 | 제목 ${SNAP0.draft?.title} | 상황 카드 ${SNAP0.scenarios?.length}`)

const browser = await launch()
try {
  for (const [W, H] of WIDTHS) {
    const { ctx, page, reqs } = await openPage(browser, W, H, c3)
    page.setDefaultTimeout(60_000)
    try {
      const raw = JSON.stringify({ ...SNAP0, savedAt: Date.now() })
      await page.goto(BASE + '/api/health', { waitUntil: 'domcontentloaded', timeout: 120_000 })
      await page.evaluate(([k, v]) => sessionStorage.setItem(k, v), [STORE_KEY, raw])
      await page.goto(BASE + NEW_PATH, { waitUntil: 'domcontentloaded', timeout: 120_000 })
      await page.getByRole('button', { name: '이어서 고치기' }).waitFor({ state: 'visible', timeout: 120_000 })
      await tap(page, page.getByRole('button', { name: '이어서 고치기' }))
      await page.getByRole('heading', { name: '주제 정보' }).waitFor({ state: 'visible' })
      await sleep(500)
      // 상황 카드가 있으면 모두 빼서 [주제만 저장] 이 되게 하지 않고, 있는 저장 단추를 그대로 쓴다.
      const saveBtn = page.getByRole('button', { name: /^(주제만 저장|주제와 상황 \d+개 저장)$/ })
      const nBtn = await saveBtn.count()
      note(`[${W}] 저장 단추 ${nBtn}개: ${nBtn ? await saveBtn.first().innerText() : '-'}`)
      check(`[${W}] 저장 단추 있음`, nBtn >= 1)
      // 저장 직후부터 GET 응답 지연
      await page.route((u) => API_PATHS.includes(u.pathname), async (r) => {
        if (r.request().method() !== 'GET') return r.continue()
        const resp = await r.fetch()
        await sleep(1500)
        await r.fulfill({ response: resp })
      })
      await saveBtn.first().scrollIntoViewIfNeeded()
      await sleep(300)
      const topTop = await page.evaluate(() => document.querySelector('main')?.scrollTop ?? -1)
      await tap(page, saveBtn.first(), { scroll: false })
      await page.waitForURL((u) => /\/settings\/scenarios\/topics\/[^/]+$/.test(u.pathname) && u.pathname !== NEW_PATH, { timeout: 30_000 })
      const urlNow = new URL(page.url())
      await page.waitForSelector(SK, { state: 'attached', timeout: 20_000 })
      await sleep(600)
      const L = await page.evaluate((SK) => {
        const main = document.querySelector('main')
        const spans = [...document.querySelectorAll(SK)].map((s) => { const r = s.getBoundingClientRect(); return [Math.round(r.height * 10) / 10, Math.round((r.top + main.scrollTop) * 10) / 10] })
        return { spans, scrollTop: main.scrollTop }
      }, SK)
      await page.waitForSelector('section[aria-labelledby=tp-chunks]', { timeout: 25_000 })
      await sleep(600)
      const R = await page.evaluate(() => {
        const main = document.querySelector('main')
        const kids = [...document.querySelector('div.mx-auto.min-w-0').children]
        const chunksSec = document.querySelector('section[aria-labelledby=tp-chunks]')
        const pos = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.height * 10) / 10, Math.round((r.top + main.scrollTop) * 10) / 10] }
        return { head: pos(kids[0]), chunks: pos(chunksSec), infoBox: kids.indexOf(chunksSec) > 1, scrollTop: main.scrollTop, txtRemove: /주제 지우기/.test(main.innerText), txtSeed: /기본 주제예요|내 버전이에요/.test(main.innerText), toast: [...document.querySelectorAll('[role=status],[role=alert]')].map((e) => (e.textContent ?? '').trim()).filter(Boolean).slice(0, 3) }
      })
      const post57 = reqs.filter((x) => x.m === 'POST' && x.p === '/api/v1/topics')
      const skChunks = L.spans[L.spans.length - 2]
      const headDiff = r1(R.head[0] - L.spans[0][0])
      const shift = r1(R.chunks[1] - skChunks[1])
      note(`[${W}] 저장 뒤 주소 ${urlNow.pathname.replace(/[a-z0-9]{20,}/, '<id>')}${urlNow.search} | #57 POST ${post57.map((x) => x.status).join(',')} | 자리표시 ${L.spans.length}블록 ${JSON.stringify(L.spans)} → 도착 head=${JSON.stringify(R.head)} chunks=${JSON.stringify(R.chunks)} | 머리 카드 차 ${headDiff} · 표현 절 이동 ${shift} (머리 차 제외 ${r1(shift - headDiff)}) | scrollTop 저장 전 ${topTop} → 자리표시 ${L.scrollTop} → 도착 ${R.scrollTop} | 토스트 ${JSON.stringify(R.toast)}`)
      check(`[${W}] 저장 성공 #57 201 1회`, post57.length === 1 && post57[0].status === 201, JSON.stringify(post57.map((x) => x.status)))
      check(`[${W}] 이동 주소에 ?o=m (다른 쿼리 없음)`, urlNow.search === '?o=m', urlNow.search)
      check(`[${W}] 자리표시 MINE 모양(3블록)`, L.spans.length === 3, `spans=${L.spans.length}`)
      check(`[${W}] 도착은 실제 MINE 화면(출처 상자 없음·[주제 지우기])`, !R.infoBox && R.txtRemove && !R.txtSeed, `infoBox=${R.infoBox} remove=${R.txtRemove} seedTxt=${R.txtSeed}`)
      check(`[${W}] 표현 절 위치 이동(머리 카드 차 제외) ≤8px`, Math.abs(shift - headDiff) <= 8, `이동 ${shift} − 머리차 ${headDiff} = ${r1(shift - headDiff)}${headDiff ? ' (머리 카드 줄 수 차이분은 별도)' : ''}`)
      check(`[${W}] 도착 화면 맨 위(main.scrollTop 0)에서 시작 — 저장 단추를 누른 때 scrollTop 은 ${topTop}`, L.scrollTop === 0 && R.scrollTop === 0, `저장 시 ${topTop} → 자리표시 ${L.scrollTop} → 도착 ${R.scrollTop}`)
    } finally {
      await ctx.close()
      const cf = await cleanupQa(u3.id)
      note(`[${W}] 정리 ${JSON.stringify(cf)}`)
    }
  }
} finally {
  await closeBrowser(browser)
  await cleanupQa(u3.id)
  const c31 = await qaRowCounts(u3.id)
  const h1 = await seedHash()
  check('종료: QA3 행 0', Object.values(c31).every((n) => n === 0), JSON.stringify(c31))
  check(`종료: 시드 해시 불변 ${h1.sha}`, h1.sha === SEED_SHA && h1.sha === h0.sha, `${h0.sha} → ${h1.sha}`)
  summary('qa-045-ui-g item2')
  await prisma.$disconnect()
  process.exit(0)
}
