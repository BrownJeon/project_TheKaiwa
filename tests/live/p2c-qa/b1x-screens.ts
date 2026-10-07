/**
 * task-010d B1 화면 상태 확인(가이드 §3-B·§3-C·§3-H·§7 — Playwright 응답 가로채기, 운영 코드에 시험 분기 없음). **실행은 QA 몫**(developer 는 작성만).
 *
 * - 상황 API(#161~#165)·초안(S3 `scenarios/drafts`)·역할극 시작(#28 `POST /chats`)·주제(#56)는 **전부 고정 응답**. 그 밖의 `/api/**` 는 GET 만 서버로 보내고
 *   GET 이 아닌 요청은 200 빈 응답으로 막는다 — 브라우저발 DB 쓰기 0. (서버 렌더 `getProfile` 의 빈 upsert 는 화면 밖이라 막을 수 없다.)
 * - 상태마다 360/390/412 × 892 로 열고 780 으로 줄여 다시 잰다: 가로 넘침 0 · 세로 스크롤 영역 ≤ 1(시트 안은 공용 Sheet 예외 — 시트가 열린 상태는 ≤ 2) ·
 *   터치 44px(`before:` 히트 포함) · 엔진명·모델명·task/Phase 번호 0 · 기대 문구 · 하단 탭(`/study/ai` 보임, 초안 화면 숨김).
 * - 못 보는 상태: `sh-textonly`(표시등 자막만 — 상태 스토어 폴링 경로를 가로채야 함) · `dr-generating-long`(15초) — QA 가 손으로 확인.
 *
 * 사용(미러에서 dev 서버, 운영 3010 금지): node --import tsx tests/live/task010d-b1-screens.ts --base http://localhost:3029 --user <쿠키 파일> [--out <디렉터리>] [--only <상태 id 접두>]
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
const BASE = arg('base') ?? 'http://localhost:3029'
const baseUrl = new URL(BASE)
if (!/^(127\.0\.0\.1|localhost)$/.test(baseUrl.hostname) || baseUrl.protocol !== 'http:') throw new Error('BASE 는 http://localhost 만 허용')
if (Number(baseUrl.port) === 3010) throw new Error('운영 포트 3010 에서는 실행하지 않는다')
const cookie = readFileSync(arg('user') ?? '', 'utf8').trim()
const [cname, ...crest] = cookie.split('=')
const OUT = arg('out')
const ONLY = arg('only')
if (OUT) mkdirSync(OUT, { recursive: true })

type J = Record<string, unknown>
type Mock = { status: number; body: unknown; delayMs?: number }
const ok = (data: unknown, status = 200): Mock => ({ status, body: { success: true, data, message: null } })
const fail = (status: number, code: string, details: J = {}, message = '오류'): Mock => ({ status, body: { success: false, data: { code, details }, message } })
const slow = (m: Mock, delayMs: number): Mock => ({ ...m, delayMs })

// ── 고정 응답 재료 ────────────────────────────────────────────────────────────
const CAFE = { id: 't_cafe', title: '카페 주문', titleJa: 'カフェで注文' }
const ROAD = { id: 't_road', title: '길 묻기', titleJa: '道を聞く' }
const SHOP = { id: 't_shop', title: '편의점', titleJa: 'コンビニ' }
const item = (id: string, over: J = {}) => ({
  id, title: `상황 ${id}`, titleJa: null, level: 'N5', difficulty: 2, isMine: false, roles: { learner: '손님', tutor: '점원' },
  goalKo: '원하는 온도·크기로 음료를 주문해요', stepCount: 4, expressionCount: 4, topics: [CAFE], recommended: false, ...over,
})
const ITEMS = [
  item('scn_mine1', { isMine: true, title: '편의점 계산', titleJa: 'コンビニの会計', topics: [SHOP], stepCount: 3 }),
  item('scn_cafe1', { title: '사이즈·온도 바꿔 주문하기', titleJa: 'サイズと温度を変えて注文する', recommended: true, recommendReason: 'RETRY_NOT_YET', last: { at: '2026-09-26T03:00:00.000Z', outcome: 'NOT_YET', usedCount: 1, totalCount: 4 } }),
  item('scn_cafe2', { title: '포장으로 바꾸기', difficulty: 3, last: { at: '2026-09-27T03:00:00.000Z', outcome: 'ACHIEVED', usedCount: 4, totalCount: 4 }, inProgressChatId: 'c_rp1' }),
  item('scn_road1', { title: '역까지 길 묻기', topics: [ROAD, CAFE], recommended: true, recommendReason: 'NEW_EASY' }),
  item('scn_loose', { title: '장소 없는 상황', topics: [], stepCount: 0, recommended: false }),
]
const LIST = (over: J = {}) => ok({ items: ITEMS, nextCursor: null, recommendedIds: ['scn_cafe1', 'scn_road1'], ...over })
const detail = (id: string, over: J = {}) => ({
  ...ITEMS.find((x) => x.id === id), description: null,
  goal: { communicativeGoalKo: '원하는 온도·크기로 음료를 주문해요', successCriteria: ['사이즈를 말한다', '온도를 말한다'] },
  steps: [{ ko: '인사하고 메뉴 고르기' }, { ko: '사이즈 말하기' }, { ko: '온도 바꾸기' }, { ko: '계산하기' }],
  keyExpressions: [
    { id: 'k1', ja: 'アイスでお願いします', ko: '아이스로 부탁해요' },
    { id: 'k2', ja: 'Mサイズにしてください', ko: 'M 사이즈로 해 주세요' },
    { id: 'k3', ja: '温かいのはありますか', ko: '따뜻한 건 있어요?' },
    { id: 'k4', ja: 'これでお願いします', ko: '이걸로 부탁해요' },
  ],
  requiredExpressions: 2, opening: { ja: 'いらっしゃいませ。ご注文は？', ko: '어서 오세요. 주문은요?' }, ...over,
})
const TOPICS = ok({ level: ['N5', 'N4'], items: [CAFE, ROAD, SHOP].map((t) => ({ ...t, level: 'N5', description: null, tags: [], isSeed: true, chunks: [], lessonCount: 0, lastLessonAt: null })) })
const DRAFT_RES = (over: J = {}) =>
  ok({
    draft: {
      title: '편의점 계산', titleJa: 'コンビニの会計', level: 'N5', difficulty: 2, roles: { learner: '손님', tutor: '점원' },
      goal: { communicativeGoalKo: '봉투와 포인트 카드를 묻고 답해요', successCriteria: ['봉투가 필요한지 답한다'] },
      steps: [{ ko: '인사' }, { ko: '봉투 묻기' }, { ko: '계산' }],
      keyExpressions: [{ ja: '袋をください', ko: '봉투 주세요' }, { ja: 'カードはありません', ko: '카드는 없어요' }],
      opening: { ja: 'いらっしゃいませ', ko: '어서 오세요' }, topicId: 't_shop', ...over,
    },
  })
const STORED = { v: 1, ask: { desc: '편의점에서 계산하기', topicId: null, level: 'N5' }, draft: { title: '편의점 계산', titleJa: '', level: 'N5', difficulty: 2, learner: '손님', tutor: '점원', goalKo: '목표', criteria: ['조건'], steps: ['인사', '계산'], expressions: [{ ja: '袋', ko: '봉투' }, { ja: 'はい', ko: '네' }], opening: null, topicIds: [], requiredExpressions: null }, edited: true, savedAt: 1 }

const fillAsk = async (p: Page) => {
  await p.locator('#dr-description').fill('편의점에서 계산하기')
  await p.getByRole('button', { name: '초안 만들기' }).click()
}
const S = '/study/ai?tab=scenario'
interface State { id: string; path: string; tab: boolean; mocks: Record<string, Mock>; store?: unknown; act?: (p: Page) => Promise<unknown>; expect?: string[]; absent?: string[]; sheet?: boolean }
const STATES: State[] = [
  { id: 'tab.talk', path: '/study/ai?tab=talk', tab: true, mocks: {}, expect: ['회화', '시나리오', '채팅'] },
  { id: 'tab.chat', path: '/study/ai?tab=chat', tab: true, mocks: {}, expect: ['＋ 새 채팅'] },
  { id: 'h-ok', path: S, tab: true, mocks: { scenarios: LIST() }, expect: ['＋ 내 상황 만들기', '추천 상황', '내 기록으로 골랐어요', '지난번엔 목표 전이었어요 · 다시 해 볼 때예요', '아직 안 해 본 쉬운 상황이에요', '전체', '내 상황 1', '카페 주문', '길 묻기', '다른 상황', '목표 달성 ✓', '이어서 할 수 있어요', '아직 목표 전 · 9월 26일', '처음 해 봐요'] },
  { id: 'h-reco-none', path: S, tab: true, mocks: { scenarios: LIST({ recommendedIds: [] }) }, absent: ['추천 상황'] },
  { id: 'h-place', path: S, tab: true, mocks: { scenarios: LIST({ recommendedIds: [] }) }, act: (p) => p.getByRole('radio', { name: '길 묻기' }).click(), expect: ['역까지 길 묻기'], absent: ['포장으로 바꾸기'] },
  { id: 'h-mine', path: S, tab: true, mocks: { scenarios: LIST({ recommendedIds: [] }) }, act: (p) => p.getByRole('radio', { name: '내 상황 1' }).click(), expect: ['편의점 계산'], absent: ['포장으로 바꾸기'] },
  { id: 'h-loading', path: S, tab: true, mocks: { scenarios: slow(LIST(), 4000) }, expect: ['상황을 불러오는 중…', '＋ 내 상황 만들기'] },
  { id: 'h-error', path: S, tab: true, mocks: { scenarios: fail(500, 'INTERNAL') }, expect: ['상황을 불러오지 못했어요.', '다시 시도'] },
  { id: 'h-empty', path: S, tab: true, mocks: { scenarios: ok({ items: [], nextCursor: null, recommendedIds: [] }) }, expect: ['아직 고를 수 있는 상황이 없어요'] },
  { id: 'h-deeplink', path: `${S}&sc=scn_cafe1`, tab: true, sheet: true, mocks: { scenarios: LIST(), 'scenarios/scn_cafe1': ok(detail('scn_cafe1')) }, expect: ['상황 역할극', '대화 순서', '4단계 · 선생님이 이 순서로 이끌어요', '핵심 표현 4개', '4개 중 2개 이상 쓰면 표현 조건을 채워요.', '지난번 9월 26일 · 아직 목표 전이에요 · 핵심 표현 1/4', '역할극 시작', '닫기'] },
  { id: 'h-deeplink-listfail', path: `${S}&sc=scn_cafe1`, tab: true, sheet: true, mocks: { scenarios: fail(500, 'INTERNAL'), 'scenarios/scn_cafe1': ok(detail('scn_cafe1')) }, expect: ['역할극 시작'] },
  { id: 'h-saved', path: `${S}&sc=scn_mine1&saved=1`, tab: true, sheet: true, mocks: { scenarios: LIST(), 'scenarios/scn_mine1': ok(detail('scn_mine1')) }, expect: ['내 상황에 저장했어요', '고치기', '지우기'] },
  { id: 'sh-resume', path: `${S}&sc=scn_cafe2`, tab: true, sheet: true, mocks: { scenarios: LIST(), 'scenarios/scn_cafe2': ok(detail('scn_cafe2')) }, expect: ['이어서 하기', '처음부터 새로', '하던 역할극이 있어요.'] },
  { id: 'sh-noopening', path: `${S}&sc=scn_cafe1`, tab: true, sheet: true, mocks: { scenarios: LIST(), 'scenarios/scn_cafe1': ok(detail('scn_cafe1', { opening: undefined })) }, expect: ['먼저 말을 걸어 보세요'] },
  { id: 'sh-delete', path: `${S}&sc=scn_mine1`, tab: true, sheet: true, mocks: { scenarios: LIST(), 'scenarios/scn_mine1': ok(detail('scn_mine1')) }, act: (p) => p.getByRole('button', { name: '지우기' }).first().click(), expect: ['이 상황을 지울까요?', '목록에서 사라져요.'] },
  { id: 'sh-delete-fail', path: `${S}&sc=scn_mine1`, tab: true, sheet: true, mocks: { scenarios: LIST(), 'scenarios/scn_mine1': ok(detail('scn_mine1')), 'scenarios/scn_mine1:DELETE': fail(500, 'INTERNAL') }, act: async (p) => { await p.getByRole('button', { name: '지우기' }).first().click(); await p.getByRole('group').getByRole('button', { name: '지우기' }).click() }, expect: ['지우지 못했어요. 다시 시도해 주세요.'] },
  { id: 'sh-404', path: `${S}&sc=scn_gone`, tab: true, sheet: true, mocks: { scenarios: LIST(), 'scenarios/scn_gone': fail(404, 'NOT_FOUND', { reason: 'ARCHIVED' }) }, expect: ['이 상황을 찾을 수 없어요', '다른 상황 고르기'] },
  { id: 'sh-error', path: `${S}&sc=scn_cafe1`, tab: true, sheet: true, mocks: { scenarios: LIST(), 'scenarios/scn_cafe1': fail(500, 'INTERNAL') }, expect: ['상황을 불러오지 못했어요.'] },
  { id: 'sh-start-fail', path: `${S}&sc=scn_cafe1`, tab: true, sheet: true, mocks: { scenarios: LIST(), 'scenarios/scn_cafe1': ok(detail('scn_cafe1')), 'chats:POST': fail(400, 'FEATURE_NOT_READY', {}, '상황 대화는 아직 준비 중이에요.') }, act: (p) => p.getByRole('button', { name: '역할극 시작' }).click(), expect: ['역할극을 시작하지 못했어요. 다시 눌러 주세요.'] },
  { id: 'sh-archived', path: `${S}&sc=scn_cafe1`, tab: true, sheet: true, mocks: { scenarios: LIST(), 'scenarios/scn_cafe1': ok(detail('scn_cafe1')), 'chats:POST': fail(409, 'CONFLICT', { reason: 'ARCHIVED' }) }, act: (p) => p.getByRole('button', { name: '역할극 시작' }).click(), expect: ['지금은 열 수 없는 상황이에요. 다른 상황을 골라 주세요.'] },
  { id: 'sh-rate', path: `${S}&sc=scn_cafe1`, tab: true, sheet: true, mocks: { scenarios: LIST(), 'scenarios/scn_cafe1': ok(detail('scn_cafe1')), 'chats:POST': fail(429, 'RATE_LIMITED') }, act: (p) => p.getByRole('button', { name: '역할극 시작' }).click(), expect: ['잠시 뒤 다시 눌러 주세요.'] },
  { id: 'dr-ask', path: '/study/ai/scenario/new', tab: false, mocks: { topics: TOPICS }, expect: ['내 상황 만들기', '어떤 상황을 연습하고 싶어요?', '이렇게 적어 볼 수 있어요', '장소 (선택)', '고르지 않음', '초안은 저장하기 전까지 어디에도 남지 않아요.', '0/300'] },
  { id: 'dr-ask-short', path: '/study/ai/scenario/new', tab: false, mocks: { topics: TOPICS }, act: async (p) => { await p.locator('#dr-description').fill('편의점'); await p.getByRole('button', { name: '초안 만들기' }).click() }, expect: ['상황을 조금 더 적어 주세요(5자 이상)'] },
  { id: 'dr-places-fail', path: '/study/ai/scenario/new', tab: false, mocks: { topics: fail(500, 'INTERNAL') }, expect: ['장소를 불러오지 못했어요 — 장소 없이 만들 수 있어요'] },
  { id: 'dr-generating', path: '/study/ai/scenario/new', tab: false, mocks: { topics: TOPICS, 'scenarios/drafts:POST': slow(DRAFT_RES(), 6000) }, act: fillAsk, expect: ['선생님이 초안을 만들고 있어요', '그만두기'] },
  { id: 'dr-gen-fail', path: '/study/ai/scenario/new', tab: false, mocks: { topics: TOPICS, 'scenarios/drafts:POST': fail(404, 'NOT_FOUND') }, act: fillAsk, expect: ['초안을 만들지 못했어요. 다시 시도해 주세요.', '편의점에서 계산하기'] },
  { id: 'dr-gen-422', path: '/study/ai/scenario/new', tab: false, mocks: { topics: TOPICS, 'scenarios/drafts:POST': fail(422, 'UNPROCESSABLE') }, act: fillAsk, expect: ['이 내용으로는 회화 상황을 만들기 어려워요.'] },
  { id: 'dr-gen-429', path: '/study/ai/scenario/new', tab: false, mocks: { topics: TOPICS, 'scenarios/drafts:POST': fail(429, 'RATE_LIMITED', { retryAfterSec: 30 }) }, act: fillAsk, expect: ['잠시 뒤 다시 눌러 주세요. (30초)'] },
  { id: 'dr-edit', path: '/study/ai/scenario/new', tab: false, mocks: { topics: TOPICS, 'scenarios/drafts:POST': DRAFT_RES() }, act: fillAsk, expect: ['선생님이 만든 초안이에요', '대화 순서', '이렇게 되면 성공이에요', '핵심 표현', '선생님 첫마디', '이 중 2개 이상 쓰면 표현 조건을 채워요.', '저장', '다시 만들기', '버리기'] },
  { id: 'dr-invalid', path: '/study/ai/scenario/new', tab: false, mocks: { topics: TOPICS, 'scenarios/drafts:POST': DRAFT_RES({ steps: [{ ko: '인사' }], title: '' }) }, act: async (p) => { await fillAsk(p); await p.getByRole('button', { name: '저장', exact: true }).click() }, expect: ['고칠 곳이 2군데 있어요', '제목을(를) 적어 주세요.', '대화 순서은(는) 2개 이상이어야 해요.'] },
  { id: 'dr-save-fail', path: '/study/ai/scenario/new', tab: false, mocks: { topics: TOPICS, 'scenarios/drafts:POST': DRAFT_RES(), 'scenarios:POST': fail(500, 'INTERNAL') }, act: async (p) => { await fillAsk(p); await p.getByRole('button', { name: '저장', exact: true }).click() }, expect: ['저장하지 못했어요. 고친 내용은 그대로 있어요. 다시 눌러 주세요.'] },
  { id: 'dr-save-limit', path: '/study/ai/scenario/new', tab: false, mocks: { topics: TOPICS, 'scenarios/drafts:POST': DRAFT_RES(), 'scenarios:POST': fail(409, 'CONFLICT', { reason: 'SCENARIO_LIMIT', limit: 50 }, '내 상황은 50개까지 둘 수 있어요. 안 쓰는 상황을 지운 뒤 다시 저장해 주세요.') }, act: async (p) => { await fillAsk(p); await p.getByRole('button', { name: '저장', exact: true }).click() }, expect: ['내 상황은 50개까지 둘 수 있어요.'] },
  { id: 'dr-save-400', path: '/study/ai/scenario/new', tab: false, mocks: { topics: TOPICS, 'scenarios/drafts:POST': DRAFT_RES(), 'scenarios:POST': fail(400, 'VALIDATION', { field: 'topicIds[0]', reason: 'not_found', problems: [{ field: 'topicIds[0]', reason: 'not_found', message: '고를 수 없는 장소예요. 다시 골라 주세요.' }] }) }, act: async (p) => { await fillAsk(p); await p.getByRole('button', { name: '저장', exact: true }).click() }, expect: ['고를 수 없는 장소예요. 다시 골라 주세요.', '고칠 곳이 1군데 있어요'] },
  { id: 'dr-regen-confirm', path: '/study/ai/scenario/new', tab: false, mocks: { topics: TOPICS, 'scenarios/drafts:POST': DRAFT_RES() }, act: async (p) => { await fillAsk(p); await p.locator('#dr-title').fill('바꾼 제목'); await p.getByRole('button', { name: '다시 만들기' }).click() }, expect: ['고친 내용이 사라지고 새 초안으로 바뀌어요.', '새로 만들기'] },
  { id: 'dr-discard', path: '/study/ai/scenario/new', tab: false, sheet: true, mocks: { topics: TOPICS, 'scenarios/drafts:POST': DRAFT_RES() }, act: async (p) => { await fillAsk(p); await p.getByRole('button', { name: '버리기' }).click() }, expect: ['초안을 버릴까요?', '저장하지 않은 초안은 되돌릴 수 없어요.', '계속 고치기'] },
  { id: 'dr-restore', path: '/study/ai/scenario/new', tab: false, store: STORED, mocks: { topics: TOPICS }, expect: ['고치던 초안이 있어요 · 편의점 계산', '이어서 고치기', '버리고 새로 만들기'] },
  { id: 'dr-edit-existing', path: '/study/ai/scenario/scn_mine1/edit', tab: false, mocks: { topics: TOPICS, 'scenarios/scn_mine1': ok(detail('scn_mine1')) }, expect: ['내 상황 고치기', '고친 내용은 다음 역할극부터 쓰여요. 지난 결과는 그대로예요.', '고치지 않고 나가기', '편의점'], absent: ['다시 만들기'] },
  { id: 'dr-edit-404', path: '/study/ai/scenario/scn_gone/edit', tab: false, mocks: { topics: TOPICS, 'scenarios/scn_gone': fail(404, 'NOT_FOUND') }, expect: ['이 상황은 고칠 수 없어요.', '시나리오로'] },
  { id: 'dr-edit-seed', path: '/study/ai/scenario/scn_cafe1/edit', tab: false, mocks: { topics: TOPICS, 'scenarios/scn_cafe1': ok(detail('scn_cafe1')) }, expect: ['이 상황은 고칠 수 없어요.'] },
]

// ── 가로채기 ────────────────────────────────────────────────────────────────
let current: State | null = null
function keyOf(url: URL, method: string): string {
  const p = url.pathname.replace(/^\/api\/v1\//, '')
  return method === 'GET' ? p : `${p}:${method}`
}
async function handle(route: Route) {
  const req = route.request()
  const url = new URL(req.url())
  const method = req.method()
  const m = current ? current.mocks[keyOf(url, method)] : undefined
  if (m) {
    if (m.delayMs) await new Promise((r) => setTimeout(r, m.delayMs))
    return route.fulfill({ status: m.status, contentType: 'application/json', body: JSON.stringify(m.body) }).catch(() => undefined)
  }
  // 상황·주제는 고정 응답만. 역할극 시작·상황 쓰기는 서버로 보내지 않는다(쓰기 0).
  if (/^\/api\/v1\/(scenarios|topics)/.test(url.pathname) || (url.pathname === '/api/v1/chats' && method !== 'GET')) {
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
      if (false) small.push(`${el.tagName.toLowerCase()}:${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 18)}(${Math.round(r.width)}x${Math.round(r.height)}${hb ? `/hit${Math.round(hb)}` : ''})`)
    })
    const kana = new RegExp(`[${String.fromCodePoint(0x3040)}-${String.fromCodePoint(0x30ff)}]`)
    const jaMissing = [...document.querySelectorAll<HTMLElement>('body *')].filter((el) => el.children.length === 0 && kana.test(el.textContent ?? '') && !el.closest('[lang="ja"]') && !el.closest('input,textarea')).length
    return { overflowX, scrollers, small, text: document.body.innerText, tab: !!document.querySelector('nav[aria-label="주 메뉴"]'), jaMissing }
  })
}

const results: { name: string; ok: boolean }[] = []
const check = (name: string, pass: boolean, detail = '') => {
  results.push({ name, ok: pass })
  if (!pass || process.env.VERBOSE) console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
  console.log(`재현 조건: Chrome ${browser.version()} headless · DSF 2.625 · isMobile · ko-KR · Asia/Seoul · reducedMotion=reduce · 고정 응답(가로채기)`)
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
        await page.setViewportSize({ width, height: 892 })
        await page.goto(`${BASE}/study/ai`, { waitUntil: 'commit' }).catch(() => undefined)
        await page.evaluate((store) => {
          try {
            sessionStorage.removeItem('kaiwa.scenario.draft')
            if (store) sessionStorage.setItem('kaiwa.scenario.draft', JSON.stringify(store))
          } catch {
            /* 저장소 없음 */
          }
        }, st.store ?? null)
        const slowMock = Object.values(st.mocks).some((x) => x.delayMs)
        await page.goto(`${BASE}${st.path}`, { waitUntil: slowMock ? 'domcontentloaded' : 'networkidle', timeout: 60000 }).catch(() => undefined)
        await page.waitForTimeout(slowMock && !st.act ? 1500 : 700)
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
