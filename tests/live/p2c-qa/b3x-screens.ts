/**
 * task-010d B3 화면 상태 확인(가이드 §3-G 결과 · §3-I 수업 종료 카드 · §3-J 회화 목록 뱃지 · §7 — Playwright 응답 가로채기, 운영 코드에 시험 분기 없음).
 * **실행은 QA 몫**(developer 는 작성만).
 *
 * - 결과 화면의 #29(`GET /api/v1/chats/:id`)·상황(#161·#162)·역할극 시작(#28)·회화 목록(#27)은 **고정 응답**. 그 밖 GET 은 서버로, GET 이 아닌 요청은
 *   200 빈 응답으로 막는다 — 브라우저발 DB 쓰기 0. 결과 화면이 여는 것만으로 쓰기 요청을 보내지 않는지도 센다(`writes` — 가로챈 GET 외 요청 수, D-9).
 * - 수업 종료 카드(`le-*`)는 QA 계정의 **끝낸 새 수업 id**(`--lesson`)가 있을 때만 — 수업은 서버에서 GET 으로 읽고, 상황 목록·상세만 고정 응답.
 * - 상태마다 360/390/412 × 892 로 열고 780 으로 줄여 다시 잰다: 가로 넘침 0 · 세로 스크롤 영역 ≤ 1(시트 열린 상태 ≤ 2) · 터치 44px ·
 *   엔진명·모델명·task/Phase 번호 0 · 일본어 `lang` 누락 0 · 기대 문구 · 하단 탭.
 *
 * 사용(미러에서 dev 서버, 운영 3010 금지): node --import tsx tests/live/task010d-b3-screens.ts --base http://localhost:3028 --user <쿠키 파일> [--lesson <끝낸 수업 id>] [--out <디렉터리>] [--only <상태 id 접두>]
 * 쿠키는 QA 테스트 계정의 세션 쿠키(권한 600 파일). 출력에 쿠키를 찍지 않는다. `SMOKE_ENV`(없으면 `APP_ENV`)가 PRODUCTION 이면 시작하지 않는다.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { chromium, type BrowserContext, type Page, type Route } from 'playwright-core'

const argv = process.argv.slice(2)
const arg = (k: string) => {
  const i = argv.indexOf(`--${k}`)
  return i >= 0 ? argv[i + 1] : undefined
}
if ((process.env.SMOKE_ENV ?? process.env.APP_ENV ?? '').toUpperCase() === 'PRODUCTION') throw new Error('PRODUCTION 환경에서는 실행하지 않는다')
const BASE = arg('base') ?? 'http://localhost:3028'
const baseUrl = new URL(BASE)
if (!/^(127\.0\.0\.1|localhost)$/.test(baseUrl.hostname) || baseUrl.protocol !== 'http:') throw new Error('BASE 는 http://localhost 만 허용')
if (Number(baseUrl.port) === 3010) throw new Error('운영 포트 3010 에서는 실행하지 않는다')
const cookie = readFileSync(arg('user') ?? '', 'utf8').trim()
const [cname, ...crest] = cookie.split('=')
const OUT = arg('out')
const ONLY = arg('only')
const LESSON_ID = arg('lesson')
if (LESSON_ID && !/^[A-Za-z0-9_-]{1,40}$/.test(LESSON_ID)) throw new Error('--lesson 은 id 모양만')
if (OUT) mkdirSync(OUT, { recursive: true })

type J = Record<string, unknown>
type Mock = { status: number; body: unknown; delayMs?: number }
const ok = (data: unknown, status = 200): Mock => ({ status, body: { success: true, data, message: null } })
const fail = (status: number, code: string, details: J = {}, message = '오류'): Mock => ({ status, body: { success: false, data: { code, details }, message } })
const slow = (m: Mock, delayMs: number): Mock => ({ ...m, delayMs })

// ── 고정 응답 재료 ────────────────────────────────────────────────────────────
const EX = [
  { id: 'k1', ja: 'アイスでお願いします', ko: '아이스로 부탁해요' },
  { id: 'k2', ja: 'Mサイズにしてください', ko: 'M 사이즈로 해 주세요' },
  { id: 'k3', ja: '温かいのはありますか', ko: '따뜻한 건 있어요?' },
  { id: 'k4', ja: 'これでお願いします', ko: '이걸로 부탁해요' },
]
const NEXT = { id: 'scn_next', title: '포장으로 바꾸기', titleJa: 'テイクアウトに変える', goalKo: '먹고 가려다 포장으로 바꿔요' }
const ended = (over: J = {}) => ({
  replayed: true, chatId: 'c_rp1', scenarioId: 'scn_cafe1', studyLogId: 'sl1', repetitionItemId: null, outcome: 'ACHIEVED', goalAchieved: true,
  tutorGoalAchieved: true, codeRulePassed: true, communicationSuccess: true, judged: true,
  expressions: { usedIds: ['k1', 'k2', 'k3'], missedIds: ['k4'], verifiedIds: ['k1', 'k2'], required: 2, total: 4 },
  turns: 5, hintsUsed: 1, selfCorrections: 1, pendingCorrections: 0, endedAt: '2026-10-06T03:00:00.000Z', next: NEXT, ...over,
})
const chat29 = (end: J | null, over: J = {}) =>
  ok({
    chat: {
      id: 'c_rp1', kind: 'TALK', title: '사이즈·온도 바꿔 주문하기', level: 'N5', running: false, reviewedAt: null, messageCount: 9,
      scenario: {
        id: 'scn_cafe1', title: '사이즈·온도 바꿔 주문하기', titleJa: 'サイズと温度を変えて注文する', roles: { learner: '손님', tutor: '점원' }, goalKo: '원하는 온도·크기로 음료를 주문해요',
        steps: [{ ko: '인사' }, { ko: '사이즈' }, { ko: '온도' }, { ko: '계산' }], keyExpressions: EX, requiredExpressions: 2, progress: { usedIds: ['k1', 'k2', 'k3'], stepIndex: null }, ended: end, lesson: null,
      },
      ...over,
    },
    messages: [], pendingProposals: 0, laterPending: 0, nextCursor: null,
  })
const scnDetail = (id: string, title: string) => ({
  id, title, titleJa: null, level: 'N5', difficulty: 2, isMine: false, roles: { learner: '손님', tutor: '점원' }, goalKo: '포장으로 바꿔요', stepCount: 2, expressionCount: 2, topics: [], recommended: true,
  description: null, goal: { communicativeGoalKo: '포장으로 바꿔요', successCriteria: ['포장이라고 말한다'] }, steps: [{ ko: '인사' }, { ko: '포장' }],
  keyExpressions: [{ id: 'p1', ja: 'テイクアウトで', ko: '포장으로' }, { id: 'p2', ja: 'ください', ko: '주세요' }], requiredExpressions: 2,
})
const listItem = (id: string, over: J = {}) => ({ id, kind: 'TALK', title: `대화 ${id}`, topic: null, level: 'N5', lastMessageAt: '2026-10-06T03:00:00.000Z', preview: 'こんにちは', messageCount: 4, reviewedAt: null, running: false, ...over })

const R = '/study/ai/talk/c_rp1/result'
interface State { id: string; path: string; tab: boolean; mocks: Record<string, Mock>; act?: (p: Page) => Promise<unknown>; expect?: string[]; absent?: string[]; sheet?: boolean; readOnly?: boolean }
const STATES: State[] = [
  { id: 'res-achieved', path: R, tab: false, readOnly: true, mocks: { 'chats/c_rp1': chat29(ended()) }, expect: ['역할극 결과', '목표를 달성했어요', 'サイズと温度を変えて注文する', '선생님 판단', '목표를 이뤘어요 ✓', '잘 통했어요 ✓', '3/4 · 2개 이상 ✓', '쓴 표현', '다음엔 이 표현도 써 보세요', '내 말 5번 · 힌트 1번 · 스스로 고침 1번', '다음 상황', '포장으로 바꾸기', '다시 해 보기', '시나리오로', '목표 달성으로 기록했어요.'], absent: ['채택을 기다리는', '대화 순서', '4단계'] },
  { id: 'res-almost', path: R, tab: false, readOnly: true, mocks: { 'chats/c_rp1': chat29(ended({ outcome: 'ALMOST', goalAchieved: false, codeRulePassed: false, expressions: { usedIds: ['k1'], missedIds: ['k2', 'k3', 'k4'], verifiedIds: ['k1'], required: 2, total: 4 } })) }, expect: ['거의 다 왔어요', '1/4 · 2개 이상 필요', '선생님은 목표를 이뤘다고 봤어요. 핵심 표현을 1개만 더 쓰면 달성이에요.', '‘아직’으로 기록했어요.'] },
  { id: 'res-notyet', path: R, tab: false, readOnly: true, mocks: { 'chats/c_rp1': chat29(ended({ outcome: 'NOT_YET', goalAchieved: false, tutorGoalAchieved: false, communicationSuccess: false, codeRulePassed: false, expressions: { usedIds: [], missedIds: ['k1', 'k2', 'k3', 'k4'], verifiedIds: [], required: 2, total: 4 } })) }, expect: ['아직 목표 전이에요', '아직이에요', '조금 막혔어요', '이번엔 핵심 표현을 쓰지 않았어요'], absent: ['쓴 표현'] },
  { id: 'res-unjudged', path: R, tab: false, readOnly: true, mocks: { 'chats/c_rp1': chat29(ended({ outcome: 'ALMOST', goalAchieved: false, judged: false, tutorGoalAchieved: null, communicationSuccess: null })) }, expect: ['판단 전에 마쳤어요', '—', '선생님이 마무리하기 전에 마쳐서 표현으로만 판단했어요.'] },
  { id: 'res-no-next', path: R, tab: false, readOnly: true, mocks: { 'chats/c_rp1': chat29(ended({ next: undefined })) }, expect: ['다른 상황 고르기', '다시 해 보기'], absent: ['포장으로 바꾸기'] },
  { id: 'res-pending', path: R, tab: false, readOnly: true, mocks: { 'chats/c_rp1': chat29(ended({ pendingCorrections: 2 })) }, expect: ['채택을 기다리는 교정 2개 · 대화에서 보기 ›'] },
  { id: 'res-loading', path: R, tab: false, readOnly: true, mocks: { 'chats/c_rp1': slow(chat29(ended()), 4000) }, expect: ['역할극 결과', '결과를 불러오는 중…'] },
  { id: 'res-error', path: R, tab: false, readOnly: true, mocks: { 'chats/c_rp1': fail(500, 'INTERNAL') }, expect: ['결과를 불러오지 못했어요.', '다시 시도'] },
  { id: 'res-404', path: R, tab: false, readOnly: true, mocks: { 'chats/c_rp1': fail(404, 'NOT_FOUND') }, expect: ['이 결과를 찾을 수 없어요.', '시나리오로'] },
  { id: 'res-404-plain', path: R, tab: false, readOnly: true, mocks: { 'chats/c_rp1': chat29(null, { scenario: undefined }) }, expect: ['이 결과를 찾을 수 없어요.'] },
  { id: 'res-notended', path: R, tab: false, readOnly: true, mocks: { 'chats/c_rp1': chat29(null) }, expect: ['아직 마치지 않은 역할극이에요.', '역할극으로 돌아가기'] },
  { id: 'res-next-sheet', path: R, tab: false, sheet: true, mocks: { 'chats/c_rp1': chat29(ended()), 'scenarios/scn_next': ok(scnDetail('scn_next', '포장으로 바꾸기')) }, act: (p) => p.getByRole('button', { name: '다음 상황', exact: true }).click(), expect: ['상황 역할극', '역할극 시작'] },
  { id: 'res-retry-fail', path: R, tab: false, mocks: { 'chats/c_rp1': chat29(ended({ outcome: 'NOT_YET', goalAchieved: false, tutorGoalAchieved: false })), 'chats:POST': fail(500, 'INTERNAL') }, act: (p) => p.getByRole('button', { name: '다시 해 보기' }).click(), expect: ['역할극을 시작하지 못했어요.'] },
  { id: 'list-badge', path: '/study/ai?tab=talk', tab: true, mocks: { chats: ok({ items: [listItem('c_rp1', { scenario: { id: 'scn_cafe1', ended: true } }), listItem('c_rp2', { scenario: { id: 'scn_cafe2', ended: false } }), listItem('c_n1')], nextCursor: null }) }, expect: ['역할극', '마침'] },
  { id: 'list-badge-none', path: '/study/ai?tab=talk', tab: true, mocks: { chats: ok({ items: [listItem('c_n1'), listItem('c_n2', { running: true })], nextCursor: null }) }, expect: ['답하는 중'], absent: ['마침'] },
  ...(LESSON_ID
    ? ([
        { id: 'le-card', path: `/study/today/talk/${LESSON_ID}`, tab: false, mocks: { scenarios: ok({ items: [{ ...scnDetail('scn_le', '카페에서 주문하기'), titleJa: 'カフェで注文する' }], nextCursor: null, recommendedIds: ['scn_le'] }), 'scenarios/scn_le': ok(scnDetail('scn_le', '카페에서 주문하기')) }, expect: ['배운 표현으로 바로 말해 보기', '상황 역할극 · 카페에서 주문하기', '선생님이 점원, 내가 손님이 돼요 · 약 5분.', '역할극 해 보기'] },
        { id: 'le-none', path: `/study/today/talk/${LESSON_ID}`, tab: false, mocks: { scenarios: ok({ items: [], nextCursor: null, recommendedIds: [] }) }, absent: ['배운 표현으로 바로 말해 보기'] },
        { id: 'le-fail', path: `/study/today/talk/${LESSON_ID}`, tab: false, mocks: { scenarios: fail(500, 'INTERNAL') }, absent: ['배운 표현으로 바로 말해 보기', '상황을 불러오지 못했어요'] },
        { id: 'le-sheet', path: `/study/today/talk/${LESSON_ID}`, tab: false, sheet: true, mocks: { scenarios: ok({ items: [scnDetail('scn_le', '카페에서 주문하기')], nextCursor: null, recommendedIds: ['scn_le'] }), 'scenarios/scn_le': ok(scnDetail('scn_le', '카페에서 주문하기')) }, act: (p) => p.getByRole('button', { name: '역할극 해 보기' }).click(), expect: ['오늘 수업 「', '」에서 이어서 해요.', '역할극 시작'] },
      ] satisfies State[])
    : []),
]

// ── 가로채기 ────────────────────────────────────────────────────────────────
let current: State | null = null
let writes: string[] = []
function keyOf(url: URL, method: string): string {
  const p = url.pathname.replace(/^\/api\/v1\//, '')
  return method === 'GET' ? p : `${p}:${method}`
}
async function handle(route: Route) {
  const req = route.request()
  const url = new URL(req.url())
  const method = req.method()
  const m = current ? current.mocks[keyOf(url, method)] : undefined
  if (method !== 'GET' && !/\/api\/v1\/text\/annotate$/.test(url.pathname)) writes.push(`${method} ${url.pathname}`)
  if (m) {
    if (m.delayMs) await new Promise((r) => setTimeout(r, m.delayMs))
    return route.fulfill({ status: m.status, contentType: 'application/json', body: JSON.stringify(m.body) }).catch(() => undefined)
  }
  // 상황·결과 대화·목록은 고정 응답만. 역할극 시작·마치기·상황 쓰기는 서버로 보내지 않는다(쓰기 0).
  if (/^\/api\/v1\/(scenarios|chats)/.test(url.pathname)) {
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify(fail(500, 'INTERNAL').body) })
  }
  if (method !== 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok({}).body) })
  return route.continue()
}

const ENGINE = /claude|whisper|reazon|style-?bert|haiku|sonnet|opus|qwen|task-?\d{2,}|phase\s?\d/i
async function measure(page: Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth
    const se = document.scrollingElement as HTMLElement
    const overflowX = Math.max(se.scrollWidth - vw, 0)
    const scrollers: string[] = []
    if (se.scrollHeight > window.innerHeight + 1) scrollers.push('document')
    document.querySelectorAll<HTMLElement>('*').forEach((el) => {
      const cs = getComputedStyle(el)
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0) scrollers.push(el.tagName.toLowerCase() + (el.id ? `#${el.id}` : ''))
    })
    const small: string[] = []
    document.querySelectorAll<HTMLElement>('a[href], button, [role="radio"]').forEach((el) => {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height || el.closest('.sr-only') || getComputedStyle(el).visibility === 'hidden') return
      const before = getComputedStyle(el, '::before')
      const hasHit = before.content !== 'none' && before.position === 'absolute'
      const hb = hasHit ? parseFloat(before.height) || 0 : 0
      const hw = hasHit ? parseFloat(before.width) || 0 : 0
      if (Math.max(r.height, hb) < 43.5 || Math.max(r.width, hw) < 43.5) {
        // 진단 추가: 실제 히트 테스트(0.25px 단위) — ::before inset 확장은 getComputedStyle 높이가 auto 라 위 계산이 못 본다
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2
        let up = 0, down = 0, left = 0, right = 0
        for (; up < 12; up += 0.25) { const t = document.elementFromPoint(cx, cy - r.height / 2 - up - 0.25); if (!(t && (t === el || el.contains(t)))) break }
        for (; down < 12; down += 0.25) { const t = document.elementFromPoint(cx, cy + r.height / 2 + down + 0.25); if (!(t && (t === el || el.contains(t)))) break }
        for (; left < 12; left += 0.25) { const t = document.elementFromPoint(cx - r.width / 2 - left - 0.25, cy); if (!(t && (t === el || el.contains(t)))) break }
        for (; right < 12; right += 0.25) { const t = document.elementFromPoint(cx + r.width / 2 + right + 0.25, cy); if (!(t && (t === el || el.contains(t)))) break }
        const effH = r.height + up + down, effW = r.width + left + right
        if (effH >= 43 && effW >= 43) return
        small.push(`hit=${Math.round(effW)}x${Math.round(effH)} ` + `${el.tagName.toLowerCase()}:${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 18)}(${Math.round(r.width)}x${Math.round(r.height)})`)
        return
      }
      if (false) small.push(`${el.tagName.toLowerCase()}:${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 18)}(${Math.round(r.width)}x${Math.round(r.height)})`)
    })
    const kana = new RegExp(`[${String.fromCodePoint(0x3040)}-${String.fromCodePoint(0x30ff)}]`)
    const jaMissing = [...document.querySelectorAll<HTMLElement>('body *')].filter((el) => el.children.length === 0 && kana.test(el.textContent ?? '') && !el.closest('[lang="ja"]') && !el.closest('input,textarea')).length
    const focus = document.activeElement?.tagName.toLowerCase() ?? ''
    return { overflowX, scrollers, small, text: document.body.innerText, tab: !!document.querySelector('nav[aria-label="주 메뉴"]'), jaMissing, focus }
  })
}

const results: { name: string; ok: boolean }[] = []
const check = (name: string, pass: boolean, detail = '') => {
  results.push({ name, ok: pass })
  if (!pass || process.env.VERBOSE) console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
  console.log(`재현 조건: Chrome ${browser.version()} headless · DSF 2.625 · isMobile · ko-KR · Asia/Seoul · reducedMotion=reduce · 고정 응답(가로채기)${LESSON_ID ? ' · 수업 종료 카드 포함' : ' · 수업 종료 카드 생략(--lesson 없음)'}`)
  try {
    for (const width of [360, 390, 412]) {
      const ctx: BrowserContext = await browser.newContext({ viewport: { width, height: 892 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
      await ctx.addCookies([{ name: cname, value: crest.join('='), url: BASE, httpOnly: true }])
      await ctx.route('**/api/**', handle)
      const page = await ctx.newPage()
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)))
      for (const st of STATES) {
        if (ONLY && !st.id.startsWith(ONLY)) continue
        current = st
        errors.length = 0
        writes = []
        await page.setViewportSize({ width, height: 892 })
        const slowMock = Object.values(st.mocks).some((x) => x.delayMs)
        await page.goto(`${BASE}${st.path}`, { waitUntil: slowMock ? 'domcontentloaded' : 'networkidle', timeout: 60000 }).catch(() => undefined)
        await page.waitForTimeout(slowMock && !st.act ? 1500 : 700)
        if (st.readOnly) {
          const m0 = await measure(page)
          if (st.id === 'res-achieved') check(`${st.id} @${width} 첫 초점 = 결과 제목`, m0.focus === 'h2', m0.focus)
          check(`${st.id} @${width} 여는 것만으로 쓰기 요청 0(D-9)`, writes.length === 0, writes.join(', '))
        }
        if (st.act) {
          await st.act(page).catch((e: Error) => errors.push(`act: ${e.message.slice(0, 80)}`))
          await page.waitForTimeout(slowMock ? 1500 : 700)
        }
        for (const h of [892, 780]) {
          await page.setViewportSize({ width, height: h })
          await page.waitForTimeout(120)
          const m = await measure(page)
          const tag = `${st.id} @${width}x${h}`
          check(`${tag} 가로 넘침 0`, m.overflowX === 0, `${m.overflowX}px`)
          check(`${tag} 스크롤 영역 ≤${st.sheet ? 2 : 1}`, m.scrollers.length <= (st.sheet ? 2 : 1), m.scrollers.join(','))
          check(`${tag} 터치 44`, m.small.length === 0, m.small.slice(0, 6).join(' · '))
          if (h === 892) {
            check(`${tag} 엔진명·번호 0`, !ENGINE.test(m.text), (m.text.match(ENGINE) ?? [''])[0])
            check(`${tag} 일본어 lang 누락 0`, m.jaMissing === 0, `${m.jaMissing}곳`)
            for (const e of st.expect ?? []) check(`${tag} 문구 "${e}"`, m.text.includes(e))
            for (const a of st.absent ?? []) check(`${tag} 없음 "${a}"`, !m.text.includes(a))
            check(`${tag} 하단 탭 ${st.tab ? '보임' : '숨김'}`, m.tab === st.tab)
            check(`${tag} 페이지 오류 0`, errors.length === 0, errors.join(' | '))
            if (OUT && width === 390) await page.screenshot({ path: `${OUT}/${st.id}-${width}.png` })
          }
        }
      }
      await ctx.close()
    }
  } finally {
    await browser.close()
  }
  const failN = results.filter((r) => !r.ok).length
  console.log(`\n합계 ${results.length} · PASS ${results.length - failN} · FAIL ${failN}`)
  process.exitCode = failN ? 1 : 0
}

void main()
