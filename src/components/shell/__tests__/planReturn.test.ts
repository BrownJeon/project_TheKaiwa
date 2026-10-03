import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  currentPlanReturn,
  forgetPlanReturn,
  isPlanHref,
  parsePlanReturn,
  PLAN_RETURN_KEY,
  PLAN_RETURN_TTL_MS,
  planReturnHref,
  rememberPlanReturn,
  samePath,
  serializePlanReturn,
} from '../planReturn'
import { planUrl, sourceHref } from '@/components/plan/logic'

const NOW = 1_790_000_000_000
const PLAN = planUrl('2026-09', '2026-09-26', 'sl_1')
const SRC = sourceHref({ type: 'CHAT', refId: 'chat1', refExists: true }) as string

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

test('정상: 계획표가 적은 원본 경로와 지금 경로가 같으면 계획표 주소(같은 달·날·기록)', () => {
  assert.equal(PLAN, '/plan?month=2026-09&day=2026-09-26&log=sl_1')
  assert.equal(SRC, '/study/ai/chat/chat1')
  const raw = serializePlanReturn(PLAN, SRC, NOW)
  assert.ok(raw)
  assert.deepEqual(parsePlanReturn(raw, NOW), { plan: PLAN, src: SRC, at: NOW })
  assert.equal(planReturnHref(raw, SRC, NOW), PLAN)
  assert.equal(planReturnHref(raw, `${SRC}/`, NOW), PLAN, '끝 / 차이는 같은 경로')
  const enc = serializePlanReturn(PLAN, '/study/today/words/a%2Db', NOW)
  assert.equal(planReturnHref(enc, '/study/today/words/a-b', NOW), PLAN, '퍼센트 인코딩 차이는 같은 경로')
})

test('경로 불일치: 원본에서 다른 화면으로 옮겨 가면 원래 자리(null)', () => {
  const raw = serializePlanReturn(PLAN, SRC, NOW)
  assert.equal(planReturnHref(raw, `${SRC}/review`, NOW), null, '하위 화면(점검 결과)은 원래 ←')
  assert.equal(planReturnHref(raw, '/study/ai/chat/chat2', NOW), null, '다른 채팅방')
  assert.equal(planReturnHref(raw, '/study/today', NOW), null)
  assert.equal(planReturnHref(raw, null, NOW), null)
  assert.equal(planReturnHref(raw, '', NOW), null)
  assert.equal(samePath('/a/b', '/a/bc'), false)
})

test('오래된 기록·미래 시각은 쓰지 않는다', () => {
  const raw = serializePlanReturn(PLAN, SRC, NOW)
  assert.equal(planReturnHref(raw, SRC, NOW + PLAN_RETURN_TTL_MS), PLAN, '경계 안')
  assert.equal(planReturnHref(raw, SRC, NOW + PLAN_RETURN_TTL_MS + 1), null, '경계 밖')
  assert.equal(planReturnHref(raw, SRC, NOW - 30_000), PLAN, '시계 조금 어긋남은 허용')
  assert.equal(planReturnHref(raw, SRC, NOW - 10 * 60_000), null, '먼 미래 시각')
})

test('깨진 값: JSON 오류·형식 오류·없는 값은 null', () => {
  for (const raw of [null, '', '{', 'null', '[]', '"x"', '42', JSON.stringify({ plan: PLAN, src: SRC, at: NOW })]) {
    assert.equal(parsePlanReturn(raw, NOW), null, String(raw))
  }
  assert.equal(parsePlanReturn(JSON.stringify({ v: 1, plan: PLAN, src: SRC, at: 'x' }), NOW), null, 'at 문자열')
  assert.equal(parsePlanReturn(JSON.stringify({ v: 1, plan: PLAN, src: 42, at: NOW }), NOW), null, 'src 숫자')
  assert.equal(parsePlanReturn('x'.repeat(5000), NOW), null, '지나치게 긴 값')
})

test('주소 거절: /plan 으로 시작하는 앱 내부 주소만(다른 사이트로 보내지 않음)', () => {
  assert.equal(isPlanHref('/plan'), true)
  assert.equal(isPlanHref(PLAN), true)
  for (const bad of [
    'https://evil.example/plan',
    '//evil.example/plan',
    '/\\evil.example',
    '/planx',
    '/plan/../admin',
    '/plan?next=https://evil.example',
    '/plan?x=<script>',
    'javascript:alert(1)',
    '/study/today',
    ` ${PLAN}`,
    `${PLAN}#x`,
    '',
  ]) {
    assert.equal(isPlanHref(bad), false, bad)
    assert.equal(serializePlanReturn(bad, SRC, NOW), null, `적지 않음: ${bad}`)
    const forged = JSON.stringify({ v: 1, plan: bad, src: SRC, at: NOW })
    assert.equal(planReturnHref(forged, SRC, NOW), null, `저장소를 고쳐도 거절: ${bad}`)
  }
  assert.equal(serializePlanReturn(PLAN, '//evil.example/x', NOW), null, '원본 경로도 앱 내부만')
  assert.equal(serializePlanReturn(PLAN, 'study/ai', NOW), null)
})

test('저장소: 적기 → 읽기 → 계획표에 돌아오면 지움', () => {
  const m = fakeSession()
  rememberPlanReturn(PLAN, SRC, NOW)
  assert.ok(m.has(PLAN_RETURN_KEY))
  assert.equal(currentPlanReturn(SRC, NOW), PLAN)
  assert.equal(currentPlanReturn('/study/today', NOW), null)
  rememberPlanReturn('https://evil.example/', SRC, NOW + 1)
  assert.equal(currentPlanReturn(SRC, NOW), PLAN, '잘못된 주소는 적지 않고 이전 값 유지')
  forgetPlanReturn()
  assert.equal(m.has(PLAN_RETURN_KEY), false)
  assert.equal(currentPlanReturn(SRC, NOW), null)
})

test('저장소 접근 예외: 조용히 무시하고 원래 ←(null)', () => {
  g.window = {
    get sessionStorage(): never {
      throw new Error('SecurityError')
    },
  }
  assert.doesNotThrow(() => rememberPlanReturn(PLAN, SRC, NOW))
  assert.doesNotThrow(() => forgetPlanReturn())
  assert.equal(currentPlanReturn(SRC, NOW), null)

  const boom = () => {
    throw new Error('QuotaExceededError')
  }
  g.window = { sessionStorage: { getItem: boom, setItem: boom, removeItem: boom } }
  assert.doesNotThrow(() => rememberPlanReturn(PLAN, SRC, NOW))
  assert.doesNotThrow(() => forgetPlanReturn())
  assert.equal(currentPlanReturn(SRC, NOW), null)

  delete g.window
  assert.doesNotThrow(() => rememberPlanReturn(PLAN, SRC, NOW), '서버(window 없음)')
  assert.equal(currentPlanReturn(SRC, NOW), null)
})
