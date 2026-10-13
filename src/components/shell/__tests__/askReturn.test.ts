import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  ASK_RETURN_KEY,
  ASK_RETURN_LABEL,
  ASK_RETURN_TTL_MS,
  askReturnHref,
  currentAskReturn,
  forgetAskReturn,
  isAskHref,
  parseAskReturn,
  rememberAskReturn,
  serializeAskReturn,
} from '../askReturn'
import { backLabelOf, CORRECTIONS_RETURN_KEY, currentBackHref, pickBackHref, serializeCorrectionsReturn } from '../correctionsReturn'
import { PLAN_RETURN_KEY, PLAN_RETURN_TTL_MS, serializePlanReturn } from '../planReturn'

// task-064 §25-8 B · §25-11 ⑭: 질문 방 근거 카드로 연 수업·평가·역할극의 ← 는 「질문으로」 — 교정 모음 기록(correctionsReturn.test.ts)과 같은 갈래.
const NOW = 1_790_000_000_000
const BACK = '/ask/chat_A1'
const SRC = '/study/today/talk/lesson_9'
const PLAN = '/plan?month=2026-09&day=2026-09-26&log=sl_1'
const CORR = '/drawer/corrections?focus=cr_1&n=50'

const g = globalThis as { window?: unknown }
afterEach(() => {
  delete g.window
})

function fakeSession(): Map<string, string> {
  const m = new Map<string, string>()
  g.window = {
    sessionStorage: {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    },
  }
  return m
}

test('정상: 질문 방이 적은 원본 경로와 지금 경로가 같으면 그 질문 방', () => {
  const raw = serializeAskReturn(BACK, SRC, NOW)
  assert.ok(raw)
  assert.deepEqual(parseAskReturn(raw, NOW), { back: BACK, src: SRC, at: NOW })
  assert.equal(askReturnHref(raw, SRC, NOW), BACK)
  assert.equal(askReturnHref(raw, `${SRC}/`, NOW), BACK)
  assert.equal(askReturnHref(raw, '/study/today/talk/lesson_8', NOW), null, '다른 수업')
  assert.equal(askReturnHref(raw, null, NOW), null)
})

test('TTL 2시간 · 시계 어긋남 60초', () => {
  assert.equal(ASK_RETURN_TTL_MS, PLAN_RETURN_TTL_MS)
  const raw = serializeAskReturn(BACK, SRC, NOW)
  assert.equal(askReturnHref(raw, SRC, NOW + ASK_RETURN_TTL_MS), BACK)
  assert.equal(askReturnHref(raw, SRC, NOW + ASK_RETURN_TTL_MS + 1), null)
  assert.equal(askReturnHref(raw, SRC, NOW - 30_000), BACK)
  assert.equal(askReturnHref(raw, SRC, NOW - 10 * 60_000), null)
})

test('깨진 값·다른 기록 모양은 null', () => {
  for (const raw of [null, '', '{', 'null', '[]', '42', JSON.stringify({ back: BACK, src: SRC, at: NOW })]) assert.equal(parseAskReturn(raw, NOW), null, String(raw))
  assert.equal(parseAskReturn(JSON.stringify({ v: 1, plan: BACK, src: SRC, at: NOW }), NOW), null)
  assert.equal(parseAskReturn(JSON.stringify({ v: 2, back: BACK, src: SRC, at: NOW }), NOW), null)
  assert.equal(parseAskReturn(JSON.stringify({ v: 1, back: BACK, src: SRC, at: 'x' }), NOW), null)
  assert.equal(parseAskReturn('x'.repeat(5000), NOW), null)
})

test('주소 거절: /ask/<id> 만(목록 /ask·쿼리·해시·// ·다른 경로·64자 넘는 id)', () => {
  assert.equal(isAskHref(BACK), true)
  assert.equal(isAskHref(`/ask/${'a'.repeat(64)}`), true)
  for (const bad of ['/ask', '/ask/', '/ask/a/b', '/ask/a?x=1', '/ask/a#x', '//evil.example/ask/a', 'https://evil.example/ask/a', '/ask/a b', `/ask/${'a'.repeat(65)}`, '/ask/a%2Fb', CORR, PLAN, '']) {
    assert.equal(isAskHref(bad), false, bad)
    assert.equal(serializeAskReturn(bad, SRC, NOW), null, bad)
    assert.equal(askReturnHref(JSON.stringify({ v: 1, back: bad, src: SRC, at: NOW }), SRC, NOW), null, `저장소를 고쳐도 거절: ${bad}`)
  }
  assert.equal(serializeAskReturn(BACK, '//evil.example/x', NOW), null)
  assert.equal(serializeAskReturn(BACK, `/study/today/talk/${'a'.repeat(400)}`, NOW), null)
  assert.equal(serializeAskReturn(BACK, SRC, Number.NaN), null)
})

test('⑩ task-066 §26-3 E — 탭 화면의 지금 대화 /ask?chat=<id> 도 허용, 그 밖 쿼리·해시·빈 값·경로 넘기기는 거절', () => {
  assert.equal(isAskHref('/ask?chat=abc'), true)
  assert.equal(isAskHref(`/ask?chat=${'a'.repeat(64)}`), true)
  const back = '/ask?chat=abc'
  assert.equal(askReturnHref(serializeAskReturn(back, SRC, NOW), SRC, NOW), back)
  for (const bad of ['/ask?chat=', '/ask?x=1', '/ask?chat=a&b=1', '/ask?chat=a#h', '/ask?chat=../x', '/ask?chat=a/b', '//x', '/ask?chat=a b', `/ask?chat=${'a'.repeat(65)}`, '/ask/?chat=a', '/askx?chat=a']) {
    assert.equal(isAskHref(bad), false, bad)
    assert.equal(serializeAskReturn(bad, SRC, NOW), null, bad)
  }
})

test('세 기록 고르기: 지금 경로에 맞는 것 중 at 이 가장 늦은 쪽 · 같으면 계획표 → 교정 모음 → 질문 방', () => {
  const plan = (at: number, src = SRC) => serializePlanReturn(PLAN, src, at)
  const corr = (at: number, src = SRC) => serializeCorrectionsReturn(CORR, src, at)
  const ask = (at: number, src = SRC) => serializeAskReturn(BACK, src, at)
  assert.equal(pickBackHref(null, null, SRC, NOW, ask(NOW)), BACK)
  assert.equal(pickBackHref(plan(NOW - 2), corr(NOW - 1), SRC, NOW, ask(NOW)), BACK, '질문 방에서 가장 나중에 열었다')
  assert.equal(pickBackHref(plan(NOW), corr(NOW - 1), SRC, NOW, ask(NOW - 2)), PLAN)
  assert.equal(pickBackHref(plan(NOW - 2), corr(NOW), SRC, NOW, ask(NOW - 1)), CORR)
  assert.equal(pickBackHref(null, corr(NOW), SRC, NOW, ask(NOW)), CORR, '같은 시각이면 교정 모음이 질문 방보다 먼저')
  assert.equal(pickBackHref(plan(NOW), null, SRC, NOW, ask(NOW)), PLAN, '같은 시각이면 계획표가 먼저')
  assert.equal(pickBackHref(plan(NOW - 1), null, SRC, NOW, ask(NOW, '/study/today/eval/e1')), PLAN, '질문 방 기록이 다른 경로')
  assert.equal(pickBackHref(null, null, SRC, NOW, ask(NOW - ASK_RETURN_TTL_MS - 1)), null, '오래됨')
  assert.equal(pickBackHref(null, null, SRC, NOW), null, '질문 방 인자를 넘기지 않는 기존 호출은 그대로')
})

test('← 이름: 질문 방 주소면 「질문으로」 · 계획표·교정 모음은 그대로', () => {
  assert.equal(ASK_RETURN_LABEL, '질문으로')
  assert.equal(backLabelOf(BACK), '질문으로')
  assert.equal(backLabelOf(PLAN), '계획표로')
  assert.equal(backLabelOf(CORR), '교정 모음으로')
})

test('저장소: 적기 → 지금 경로 ← → 질문 방에 돌아오면 지움 · 다른 기록과 키가 다르다', () => {
  assert.ok(new Set([ASK_RETURN_KEY, CORRECTIONS_RETURN_KEY, PLAN_RETURN_KEY]).size === 3)
  const m = fakeSession()
  rememberAskReturn(BACK, SRC, NOW)
  assert.equal(currentAskReturn(SRC, NOW), BACK)
  assert.equal(currentBackHref(SRC, NOW), BACK)
  rememberAskReturn('/drawer/words', SRC, NOW + 1)
  assert.equal(currentAskReturn(SRC, NOW), BACK, '잘못된 주소는 적지 않는다')
  m.set(PLAN_RETURN_KEY, serializePlanReturn(PLAN, SRC, NOW + 5000) as string)
  assert.equal(currentBackHref(SRC, NOW + 6000), PLAN)
  forgetAskReturn()
  assert.equal(m.has(ASK_RETURN_KEY), false)
  assert.equal(m.has(PLAN_RETURN_KEY), true)
})

test('저장소 예외·서버(window 없음): 조용히 null', () => {
  const boom = () => {
    throw new Error('blocked')
  }
  g.window = { sessionStorage: { getItem: boom, setItem: boom, removeItem: boom } }
  assert.doesNotThrow(() => rememberAskReturn(BACK, SRC, NOW))
  assert.doesNotThrow(() => forgetAskReturn())
  assert.equal(currentAskReturn(SRC, NOW), null)
  assert.equal(currentBackHref(SRC, NOW), null)
  delete g.window
  assert.equal(currentAskReturn(SRC, NOW), null)
})
