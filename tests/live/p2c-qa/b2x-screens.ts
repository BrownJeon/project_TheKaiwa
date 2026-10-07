/**
 * task-010d B2 역할극 회화방 화면 상태 확인(가이드 §3-D 방 · §3-E 대답 연습 · §3-F 마치기 시트 · §7 — Playwright 응답 가로채기, 운영 코드에 시험 분기 없음).
 * **실행은 QA 몫**(developer 는 작성만).
 *
 * - 방 #29(`GET /api/v1/chats/c_rp1`)·턴 #32(`POST …/turns`, SSE 본문)·마치기 #167(`POST …/scenario/finish`)·대답 연습 #169(`POST …/reply-practice`)·
 *   그만두기 #31(`DELETE …`)은 **고정 응답**. 같은 열쇠에 응답 배열을 주면 부를 때마다 다음 것(마지막은 반복) — 거절 뒤 다시 읽기 확인용.
 *   그 밖 `scenarios|chats` 요청은 500, GET 이 아닌 그 밖 요청은 200 빈 응답으로 막는다(브라우저발 DB 쓰기 0). 그 밖 GET(말투 설정·표시 설정 등)은 서버로.
 * - 방을 여는 것만으로 마치기·대답 연습 요청이 나가지 않는지 센다(`writes`).
 * - 상태마다 360/390/412 × 892 로 열고 780 으로 줄여 다시 잰다: 가로 넘침 0 · 세로 스크롤 영역 ≤ 1(대답 연습 판·시트 열린 상태 ≤ 2) · 터치 44px ·
 *   엔진명·모델명·task/Phase 번호 0 · 일본어 `lang` 누락 0 · 기대 문구 · 하단 탭 숨김 · 푸시투토크 72px(대답 연습이 열려도 크기 불변).
 * - #169 는 서버에 아직 없을 수 있다(A3b-2) — 이 스크립트는 고정 응답만 쓰므로 서버 유무와 상관없다. `pr-404` 는 "아직 없는 API" 를 흉내 낸다.
 * - 자막만(`rp-textonly`)은 TTS 상태 표시등 응답을 고정해야 해서 이 스크립트 범위 밖(QA 수동 — TTS 끈 개발 서버).
 *
 * 사용(미러에서 dev 서버, 운영 3010 금지): node --import tsx tests/live/task010d-b2-screens.ts --base http://localhost:3029 --user <쿠키 파일> [--out <디렉터리>] [--only <상태 id 접두>]
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
type Mock = { status: number; body: unknown; delayMs?: number; sse?: string }
const ok = (data: unknown, status = 200): Mock => ({ status, body: { success: true, data, message: null } })
const fail = (status: number, code: string, details: J = {}, message = '오류'): Mock => ({ status, body: { success: false, data: { code, details }, message } })
const slow = (m: Mock, delayMs: number): Mock => ({ ...m, delayMs })
const sseEv = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

// ── 고정 응답 재료 ────────────────────────────────────────────────────────────
const CHAT = 'c_rp1'
const EX = [
  { id: 'k1', ja: 'アイスでお願いします', ko: '아이스로 부탁해요' },
  { id: 'k2', ja: 'Mサイズにしてください', ko: 'M 사이즈로 해 주세요' },
  { id: 'k3', ja: '温かいのはありますか', ko: '따뜻한 건 있어요?' },
  { id: 'k4', ja: 'これでお願いします', ko: '이걸로 부탁해요' },
]
const T0 = '2026-10-07T03:00:00.000Z'
const m = (id: string, role: 'USER' | 'ASSISTANT', content: string, translation: string | null = null) => ({ id, role, content, translation, status: 'DONE', createdAt: T0, corrections: [] })
const OPENING = [m('a0', 'ASSISTANT', 'いらっしゃいませ。ご注文はお決まりですか。', '어서 오세요. 주문 정하셨어요?')]
const MID = [...OPENING, m('u1', 'USER', 'アイスコーヒーをください'), m('a1', 'ASSISTANT', 'サイズはいかがなさいますか。', '사이즈는 어떻게 하시겠어요?'), m('u2', 'USER', 'Mサイズにしてください'), m('a2', 'ASSISTANT', 'かしこまりました。', '알겠습니다.')]
const ENDED = {
  replayed: true, chatId: CHAT, scenarioId: 'scn_cafe1', studyLogId: 'sl1', repetitionItemId: null, outcome: 'ACHIEVED', goalAchieved: true, tutorGoalAchieved: true, codeRulePassed: true,
  communicationSuccess: true, judged: true, expressions: { usedIds: ['k1', 'k2'], missedIds: ['k3', 'k4'], verifiedIds: ['k1', 'k2'], required: 2, total: 4 }, turns: 2, hintsUsed: 0,
  selfCorrections: 0, pendingCorrections: 0, endedAt: T0,
}
const chat29 = (messages: unknown[], sc: J = {}) =>
  ok({
    chat: {
      id: CHAT, kind: 'TALK', title: '사이즈·온도 바꿔 주문하기', level: 'N5', running: false, reviewedAt: null, messageCount: messages.length,
      scenario: {
        id: 'scn_cafe1', title: '사이즈·온도 바꿔 주문하기', titleJa: 'サイズと温度を変えて注文する', roles: { learner: '손님', tutor: '점원' }, goalKo: '원하는 온도·크기로 음료를 주문해요',
        steps: [{ ko: '인사' }, { ko: '사이즈' }, { ko: '온도' }, { ko: '계산' }], keyExpressions: EX, requiredExpressions: 2, progress: { usedIds: [], stepIndex: null }, ended: null, lesson: null, ...sc,
      },
    },
    messages, pendingProposals: 0, laterPending: 0, nextCursor: null,
  })
const PRACTICE = { messageId: 'a0', ja: 'アイスコーヒーをください', ko: '아이스커피 주세요', blank: { start: 0, end: 7 }, choices: ['ホットコーヒー', 'アイスコーヒー', 'ジュース'], answerIndex: 1, hintKo: '차가운 커피' }
const turnSse = (done: J): Mock => ({
  status: 200,
  body: null,
  sse: sseEv('accepted', { userMessageId: 'u9', assistantMessageId: 'a9' }) + sseEv('done', { userMessageId: 'u9', assistantMessageId: 'a9', conversation: { replyJa: 'かしこまりました。', replyKo: '알겠습니다.' }, audioCount: 0, ...done }),
})

const ROOM = `/study/ai/talk/${CHAT}`
const K29 = `chats/${CHAT}`
const KTURN = `chats/${CHAT}/turns:POST`
const KFIN = `chats/${CHAT}/scenario/finish:POST`
const KPR = `chats/${CHAT}/reply-practice:POST`
const KDEL = `chats/${CHAT}:DELETE`
const TEXT_MODE = { 'kaiwa.talk.inputMode': 'text' }

type Act = (p: Page) => Promise<unknown>
interface Probe { sel: string; attr: string; includes: string }
interface State { id: string; mocks: Record<string, Mock | Mock[]>; session?: Record<string, string>; act?: Act; expect?: string[]; absent?: string[]; probes?: Probe[]; panel?: boolean; sheet?: boolean; waitMs?: number }

const tap = (name: string | RegExp, exact = true): Act => (p) => p.getByRole('button', { name, exact }).first().click()
const seq = (...acts: Act[]): Act => async (p) => {
  for (const a of acts) {
    await a(p)
    await p.waitForTimeout(400)
  }
}
const openGoal: Act = (p) => p.locator('[aria-controls="rp-goal"]').click()
const openPractice: Act = (p) => p.getByRole('button', { name: /대답 연습/ }).first().click()
const typeAndSend = (text: string): Act => async (p) => {
  await p.getByRole('textbox', { name: '메시지 입력' }).fill(text)
  await p.getByRole('button', { name: '보내기' }).click()
}

const STATES: State[] = [
  // ── 방 ──
  { id: 'rp-open-first', mocks: { [K29]: chat29(OPENING) }, expect: ['점원 역', '마치기', '목표', '원하는 온도·크기로 음료를 주문해요', '4단계 · 표현 0/4', '선생님은 점원, 나는 손님이에요. 선생님이 먼저 말을 걸어요.', '대화 순서', '0/4 · 2개 이상 쓰면 돼요', '대답 연습', '무엇을 말할지 막히면 눌러요'], absent: ['●', '✓'] },
  { id: 'rp-open-me', mocks: { [K29]: chat29([]) }, expect: ['나는 손님이에요.', '먼저 말을 걸어 보세요', '이렇게 시작해 보세요:', 'アイスでお願いします'], absent: ['대답 연습', '선생님이 먼저 말을 걸어요.'] },
  { id: 'rp-fromlesson', mocks: { [K29]: chat29(OPENING, { lesson: { id: 'L1', title: '카페 표현' } }) }, expect: ['오늘 수업 「카페 표현」에서 이어져요.'] },
  { id: 'rp-mid', mocks: { [K29]: chat29(MID, { progress: { usedIds: ['k1', 'k2'], stepIndex: null } }) }, expect: ['4단계 · 표현 2/4', '대답 연습'], absent: ['대화 순서'] },
  { id: 'rp-goal-open', mocks: { [K29]: chat29(MID, { progress: { usedIds: ['k1', 'k2'], stepIndex: null } }) }, act: openGoal, expect: ['나 손님 · 선생님 점원', '대화 순서', '2/4 · 2개 이상 쓰면 돼요', '체크 보기', '✓'] },
  { id: 'rp-checks-off', session: { 'kaiwa.rp.checksHidden': '1' }, mocks: { [K29]: chat29(MID, { progress: { usedIds: ['k1', 'k2'], stepIndex: null } }) }, act: openGoal, expect: ['표현 4개', '2개 이상 · 쓴 표현은 끝나고 보여 드려요', '체크 숨김'], absent: ['✓'] },
  { id: 'rp-text', session: TEXT_MODE, mocks: { [K29]: chat29(OPENING) }, probes: [{ sel: 'textarea[aria-label="메시지 입력"]', attr: 'placeholder', includes: '손님으로 할 말을 일본어로 써 보세요 — 선생님이 역할로 대답해요' }] },
  { id: 'rp-menu', mocks: { [K29]: chat29(MID) }, sheet: true, act: tap('회화 메뉴'), expect: ['역할극은 늘 코치 방식으로 교정해요 — 힌트를 먼저 드려요.'] },
  { id: 'rp-teacher-end', session: TEXT_MODE, mocks: { [K29]: chat29(OPENING), [KTURN]: turnSse({ endOfTopic: true, scenario: { usedIds: ['k4'], stepIndex: null } }) }, act: typeAndSend('これでお願いします'), waitMs: 1500, expect: ['선생님이 목표를 이룬 것 같다고 해요.', '역할극을 마칠까요?', '마치고 결과 보기', '조금 더 하기', '4단계 · 표현 1/4'] },
  { id: 'rp-teacher-more', session: TEXT_MODE, mocks: { [K29]: chat29(OPENING), [KTURN]: turnSse({ endOfTopic: true }) }, act: seq(typeAndSend('これでお願いします'), (p) => p.waitForTimeout(1200), tap('조금 더 하기')), expect: ['이어서 말해 보세요 · 다 되면 위의 [마치기]를 눌러요'], absent: ['선생님이 목표를 이룬 것 같다고 해요.'] },
  { id: 'rp-ended-turn', session: TEXT_MODE, mocks: { [K29]: [chat29(OPENING), chat29(OPENING, { ended: ENDED })], [KTURN]: fail(409, 'CONFLICT', { reason: 'ROLEPLAY_ENDED' }) }, act: typeAndSend('すみません'), waitMs: 1500, expect: ['이미 마친 역할극이에요.', '이 역할극은 마쳤어요', '결과 보기', '다시 하기'], absent: ['다시 보내기'] },
  { id: 'rp-ended', mocks: { [K29]: chat29(MID, { ended: ENDED, progress: { usedIds: ['k1', 'k2'], stepIndex: null } }) }, expect: ['마침', '이 역할극은 마쳤어요', '더 말하려면 다시 해 보세요.', '결과 보기', '다시 하기'], absent: ['마치기', '대답 연습'] },
  { id: 'rp-loading', mocks: { [K29]: slow(chat29(OPENING), 4000) }, waitMs: 300, absent: ['점원 역'] },
  { id: 'rp-error', mocks: { [K29]: fail(500, 'INTERNAL') }, absent: ['점원 역', '마치기'] },
  { id: 'rp-404', mocks: { [K29]: fail(404, 'NOT_FOUND') }, expect: ['이 회화를 찾을 수 없어요.'] },
  // ── 마치기 시트 ──
  { id: 'es-confirm', mocks: { [K29]: chat29(MID, { progress: { usedIds: ['k1', 'k2'], stepIndex: null } }) }, sheet: true, act: tap('마치기'), expect: ['역할극을 마칠까요?', '마친 뒤에는 이 역할극에 더 말할 수 없어요.', '내 말 2번', '핵심 표현 2/4', '마치고 결과 보기', '계속하기'], absent: ['1/4단계', '2/4단계'] },
  { id: 'es-empty', mocks: { [K29]: chat29(OPENING) }, sheet: true, act: tap('마치기'), expect: ['아직 한 마디도 하지 않았어요', '지금 그만두면 결과와 기록이 남지 않아요.', '계속하기', '그만두기'] },
  { id: 'es-quit-fail', mocks: { [K29]: chat29(OPENING), [KDEL]: fail(500, 'INTERNAL') }, sheet: true, act: seq(tap('마치기'), tap('그만두기')), expect: ['그만두지 못했어요. 다시 눌러 주세요.', '그만두기'] },
  { id: 'es-busy', mocks: { [K29]: chat29(MID), [KFIN]: slow(ok(ENDED), 6000) }, sheet: true, act: seq(tap('마치기'), tap('마치고 결과 보기')), expect: ['선생님이 결과를 정리하고 있어요…', '보통 몇 초면 끝나요'] },
  { id: 'es-fail', mocks: { [K29]: chat29(MID), [KFIN]: fail(500, 'INTERNAL') }, sheet: true, act: seq(tap('마치기'), tap('마치고 결과 보기')), expect: ['결과를 기록하지 못했어요. 대화는 저장돼 있어요.', '다시 시도', '나중에 하기'] },
  { id: 'es-noturns', mocks: { [K29]: chat29(MID), [KFIN]: fail(409, 'CONFLICT', { reason: 'NO_TURNS' }) }, sheet: true, act: seq(tap('마치기'), tap('마치고 결과 보기')), expect: ['아직 한 마디도 하지 않았어요', '그만두기'] },
  { id: 'es-turnrunning', mocks: { [K29]: chat29(MID), [KFIN]: fail(409, 'CONFLICT', { reason: 'TURN_RUNNING' }) }, act: seq(tap('마치기'), tap('마치고 결과 보기')), expect: ['선생님 대답이 끝나면 마칠 수 있어요'], absent: ['역할극을 마칠까요?'] },
  // ── 대답 연습 ──
  { id: 'pr-entry', mocks: { [K29]: chat29(OPENING) }, expect: ['대답 연습', '무엇을 말할지 막히면 눌러요'] },
  { id: 'pr-choose', mocks: { [K29]: chat29(OPENING), [KPR]: ok(PRACTICE) }, panel: true, act: openPractice, expect: ['고르기', '말하기', '따라 하기', '빈칸에 들어갈 말을 골라 보세요', '아이스커피 주세요', 'ホットコーヒー', 'アイスコーヒー', 'ジュース'] },
  { id: 'pr-choose-wrong', mocks: { [K29]: chat29(OPENING), [KPR]: ok(PRACTICE) }, panel: true, act: seq(openPractice, tap('ホットコーヒー')), expect: ['다시 골라 보세요'] },
  { id: 'pr-choose-right', mocks: { [K29]: chat29(OPENING), [KPR]: ok(PRACTICE) }, panel: true, act: seq(openPractice, tap('アイスコーヒー')), expect: ['✓ 맞아요', '이제 이 문장을 말해 보세요 — 아래 버튼을 누른 채로.'], absent: ['입력창에 넣기'] },
  { id: 'pr-choose-text', session: TEXT_MODE, mocks: { [K29]: chat29(OPENING), [KPR]: ok(PRACTICE) }, panel: true, act: seq(openPractice, tap('アイスコーヒー'), tap('입력창에 넣기')), probes: [{ sel: 'textarea[aria-label="메시지 입력"]', attr: 'value', includes: 'アイスコーヒーをください' }], expect: ['무엇을 말할지 막히면 눌러요'] },
  { id: 'pr-say', session: { 'kaiwa.rp.practiceMode': 'say' }, mocks: { [K29]: chat29(OPENING), [KPR]: ok(PRACTICE) }, panel: true, act: openPractice, expect: ['이 뜻을 일본어로 말해 보세요', '힌트', '정답 보기', '아래 버튼을 누른 채로 말해요'] },
  { id: 'pr-say-hint', session: { 'kaiwa.rp.practiceMode': 'say' }, mocks: { [K29]: chat29(OPENING), [KPR]: ok(PRACTICE) }, panel: true, act: seq(openPractice, tap('힌트'), tap('정답 보기')), expect: ['차가운 커피', 'アイスコーヒーをください'] },
  { id: 'pr-repeat', session: { 'kaiwa.rp.practiceMode': 'repeat' }, mocks: { [K29]: chat29(OPENING), [KPR]: ok(PRACTICE) }, panel: true, act: openPractice, expect: ['듣고 따라 말해 보세요', '▶ 듣기', '아래 버튼을 누른 채로 따라 말해요'], absent: ['입력창에 넣기'] },
  { id: 'pr-noblank', mocks: { [K29]: chat29(OPENING), [KPR]: ok({ ...PRACTICE, blank: undefined }) }, panel: true, act: seq(openPractice, (p) => p.getByRole('radio', { name: '고르기' }).click()), expect: ['듣고 따라 말해 보세요', '이 말에는 고르기 연습이 없어요'] },
  { id: 'pr-loading', mocks: { [K29]: chat29(OPENING), [KPR]: slow(ok(PRACTICE), 9000) }, panel: true, act: seq(openPractice, (p) => p.waitForTimeout(5600)), expect: ['대답 예시를 만드는 중…', '조금만 기다려 주세요'] },
  { id: 'pr-error', mocks: { [K29]: chat29(OPENING), [KPR]: fail(500, 'INTERNAL') }, panel: true, act: openPractice, expect: ['대답 예시를 만들지 못했어요.', '다시 시도'] },
  { id: 'pr-404', mocks: { [K29]: chat29(OPENING), [KPR]: fail(404, 'NOT_FOUND') }, panel: true, act: openPractice, expect: ['대답 예시를 만들지 못했어요.', '다시 시도'] },
  { id: 'pr-rate', mocks: { [K29]: chat29(OPENING), [KPR]: fail(429, 'RATE_LIMITED', { retryAfterSec: 30 }) }, panel: true, act: openPractice, expect: ['초 뒤 다시 눌러 주세요.'] },
  { id: 'pr-busy', mocks: { [K29]: chat29(OPENING), [KPR]: fail(409, 'CONFLICT', { reason: 'TURN_RUNNING' }) }, panel: true, act: openPractice, expect: ['선생님 말이 끝나면 다시 눌러 주세요.'] },
  { id: 'pr-stale', mocks: { [K29]: chat29(OPENING), [KPR]: fail(409, 'CONFLICT', { reason: 'NOT_LATEST' }) }, act: openPractice, expect: ['새 말이 와서 연습을 닫았어요', '무엇을 말할지 막히면 눌러요'], absent: ['빈칸에 들어갈 말을 골라 보세요'] },
  { id: 'pr-kb', session: TEXT_MODE, mocks: { [K29]: chat29(OPENING), [KPR]: ok(PRACTICE) }, panel: true, act: seq(openPractice, (p) => p.evaluate(() => (document.documentElement.dataset.kb = 'open'))), expect: ['ください'], absent: ['빈칸에 들어갈 말을 골라 보세요', 'ホットコーヒー'] },
]

// ── 가로채기 ────────────────────────────────────────────────────────────────
let current: State | null = null
let writes: string[] = []
const calls = new Map<string, number>()
function keyOf(url: URL, method: string): string {
  const p = url.pathname.replace(/^\/api\/v1\//, '')
  return method === 'GET' ? p : `${p}:${method}`
}
function pick(k: string): Mock | undefined {
  const v = current?.mocks[k]
  if (!v) return undefined
  if (!Array.isArray(v)) return v
  const n = calls.get(k) ?? 0
  calls.set(k, n + 1)
  return v[Math.min(n, v.length - 1)]
}
async function handle(route: Route) {
  const req = route.request()
  const url = new URL(req.url())
  const method = req.method()
  if (method !== 'GET' && !/\/api\/v1\/text\/annotate$/.test(url.pathname)) writes.push(`${method} ${url.pathname}`)
  const mk = pick(keyOf(url, method))
  if (mk) {
    if (mk.delayMs) await new Promise((r) => setTimeout(r, mk.delayMs))
    if (mk.sse !== undefined) return route.fulfill({ status: mk.status, contentType: 'text/event-stream', body: mk.sse }).catch(() => undefined)
    return route.fulfill({ status: mk.status, contentType: 'application/json', body: JSON.stringify(mk.body) }).catch(() => undefined)
  }
  // 상황·대화는 고정 응답만. 고정 응답이 없는 쓰기(턴·마치기·연습·삭제 포함)는 서버로 보내지 않는다(쓰기 0).
  if (/^\/api\/v1\/(scenarios|chats|proposals|corrections)/.test(url.pathname)) {
    if (method === 'GET' && /^\/api\/v1\/(proposals|corrections)/.test(url.pathname)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok({ items: [], nextCursor: null }).body) })
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify(fail(500, 'INTERNAL').body) })
  }
  if (method !== 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok({}).body) })
  return route.continue()
}

const ENGINE = /claude|whisper|reazon|style-?bert|haiku|sonnet|opus|qwen|task-?\d{2,}|phase\s?\d/i
async function measure(page: Page, probes: Probe[]) {
  return page.evaluate((pr) => {
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
        // 진단 추가: 실제 히트 테스트 — 중심에서 위·아래·좌·우로 1px씩 가며 같은 버튼이 맞는 범위를 잰다
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2
        let up = 0, down = 0, left = 0, right = 0
        for (; up < 12; up += 0.25) { const t = document.elementFromPoint(cx, cy - r.height / 2 - up - 0.25); if (!(t && (t === el || el.contains(t)))) break }
        for (; down < 12; down += 0.25) { const t = document.elementFromPoint(cx, cy + r.height / 2 + down + 0.25); if (!(t && (t === el || el.contains(t)))) break }
        for (; left < 12; left += 0.25) { const t = document.elementFromPoint(cx - r.width / 2 - left - 0.25, cy); if (!(t && (t === el || el.contains(t)))) break }
        for (; right < 12; right += 0.25) { const t = document.elementFromPoint(cx + r.width / 2 + right + 0.25, cy); if (!(t && (t === el || el.contains(t)))) break }
        const effH = r.height + up + down, effW = r.width + left + right
        if (effH >= 43.5 && effW >= 43.5) return
        small.push(`hit=${Math.round(effW)}x${Math.round(effH)} ` + `${el.tagName.toLowerCase()}:${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 18)}(${Math.round(r.width)}x${Math.round(r.height)})`)
        return
      }
      if (false) small.push(`${el.tagName.toLowerCase()}:${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 18)}(${Math.round(r.width)}x${Math.round(r.height)})`)
    })
    const kana = new RegExp(`[${String.fromCodePoint(0x3040)}-${String.fromCodePoint(0x30ff)}]`)
    const jaNodes = [...document.querySelectorAll<HTMLElement>('body *')].filter((el) => el.children.length === 0 && kana.test(el.textContent ?? '') && !el.closest('[lang="ja"]') && !el.closest('input,textarea'))
    const jaMissing = jaNodes.length
    const jaTexts = jaNodes.map((el) => `${el.tagName.toLowerCase()}:${(el.textContent ?? '').slice(0, 24)}`)
    const ptt = document.querySelector<HTMLElement>('[aria-describedby="talk-status"]')?.getBoundingClientRect()
    const probe = pr.map((x) => {
      const el = document.querySelector<HTMLElement>(x.sel)
      const v = !el ? null : x.attr === 'value' ? (el as HTMLTextAreaElement).value : el.getAttribute(x.attr)
      return { ...x, value: v ?? '' }
    })
    return { jaTexts, overflowX, scrollers, small, text: document.body.innerText, tab: !!document.querySelector('nav[aria-label="주 메뉴"]'), jaMissing, ptt: ptt ? Math.round(ptt.height) : null, probe, roleplay: document.querySelector('[data-roleplay="on"]') !== null }
  }, probes)
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
      for (const st of STATES) {
        if (ONLY && !st.id.startsWith(ONLY)) continue
        // 상태마다 새 맥락 — sessionStorage(입력 방식·체크 숨김·연습 방식)를 상태별로 깨끗이 시작한다.
        const ctx: BrowserContext = await browser.newContext({ viewport: { width, height: 892 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
        await ctx.addCookies([{ name: cname, value: crest.join('='), url: BASE, httpOnly: true }])
        if (st.session) await ctx.addInitScript((kv: Record<string, string>) => Object.entries(kv).forEach(([k, v]) => sessionStorage.setItem(k, v)), st.session)
        await ctx.route('**/api/**', handle)
        const page = await ctx.newPage()
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)))
        current = st
        writes = []
        calls.clear()
        const slowMock = Object.values(st.mocks).some((x) => !Array.isArray(x) && x.delayMs)
        await page.goto(`${BASE}${ROOM}`, { waitUntil: slowMock ? 'domcontentloaded' : 'networkidle', timeout: 60000 }).catch(() => undefined)
        await page.waitForTimeout(st.waitMs && !st.act ? st.waitMs : 900)
        const opened = await measure(page, [])
        check(`${st.id} @${width} 방을 여는 것만으로 마치기·대답 연습 요청 0`, !writes.some((w) => /scenario\/finish|reply-practice/.test(w)), writes.join(', '))
        if (st.id.startsWith('rp-') && !['rp-loading', 'rp-error', 'rp-404'].includes(st.id)) check(`${st.id} @${width} data-roleplay`, opened.roleplay)
        if (st.act) {
          await st.act(page).catch((e: Error) => errors.push(`act: ${e.message.slice(0, 80)}`))
          await page.waitForTimeout(st.waitMs ?? 700)
        }
        for (const h of [892, 780]) {
          await page.setViewportSize({ width, height: h })
          await page.waitForTimeout(120)
          const mm = await measure(page, st.probes ?? [])
          const tag = `${st.id} @${width}x${h}`
          const allow = st.panel || st.sheet ? 2 : 1
          check(`${tag} 가로 넘침 0`, mm.overflowX === 0, `${mm.overflowX}px`)
          check(`${tag} 스크롤 영역 ≤${allow}`, mm.scrollers.length <= allow, mm.scrollers.join(','))
          check(`${tag} 터치 44`, mm.small.length === 0, mm.small.slice(0, 6).join(' · '))
          if (mm.ptt !== null) check(`${tag} 푸시투토크 72`, mm.ptt >= 64, `${mm.ptt}px`)
          if (h === 892) {
            check(`${tag} 엔진명·번호 0`, !ENGINE.test(mm.text), (mm.text.match(ENGINE) ?? [''])[0])
            check(`${tag} 일본어 lang 누락 0`, mm.jaMissing === 0, `${mm.jaMissing}곳 ${mm.jaTexts.join('|')}`)
            for (const e of st.expect ?? []) check(`${tag} 문구 "${e}"`, mm.text.includes(e))
            for (const a of st.absent ?? []) check(`${tag} 없음 "${a}"`, !mm.text.includes(a), mm.text.includes(a) ? `…${mm.text.slice(Math.max(0, mm.text.indexOf(a) - 24), mm.text.indexOf(a) + 24).replace(/\n/g, '⏎')}…` : '')
            for (const p of mm.probe) check(`${tag} ${p.sel}[${p.attr}] ⊇ "${p.includes}"`, p.value.includes(p.includes), p.value.slice(0, 40))
            check(`${tag} 하단 탭 숨김`, !mm.tab)
            check(`${tag} 페이지 오류 0`, errors.length === 0, errors.join(' | '))
            if (OUT && width === 390) await page.screenshot({ path: `${OUT}/${st.id}-${width}.png` })
          }
        }
        await ctx.close()
      }
    }
  } finally {
    await browser.close()
  }
  const failN = results.filter((r) => !r.ok).length
  console.log(`\n합계 ${results.length} · PASS ${results.length - failN} · FAIL ${failN}`)
  process.exitCode = failN ? 1 : 0
}

void main()
