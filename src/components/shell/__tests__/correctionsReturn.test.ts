import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  backLabelOf,
  CORRECTIONS_HREF_MAX,
  CORRECTIONS_RETURN_KEY,
  CORRECTIONS_RETURN_LABEL,
  CORRECTIONS_RETURN_TTL_MS,
  correctionsReturnHref,
  currentBackHref,
  currentCorrectionsReturn,
  forgetCorrectionsReturn,
  isCorrectionsHref,
  parseCorrectionsReturn,
  pickBackHref,
  rememberCorrectionsReturn,
  serializeCorrectionsReturn,
} from '../correctionsReturn'
import { PLAN_RETURN_KEY, PLAN_RETURN_LABEL, PLAN_RETURN_TTL_MS, serializePlanReturn } from '../planReturn'

// task-055 D5 A(screens.md §21-6 B): 교정 모음에서 연 원래 대화의 ← 는 「교정 모음으로」 — 계획표 기록(planReturn.test.ts)과 같은 갈래로 시험한다.
const NOW = 1_790_000_000_000
const BACK = '/drawer/corrections?errorType=PARTICLE&chunkType=ACTION&q=%E3%81%AB%20%EC%A1%B0%EC%82%AC&focus=cr_1&n=40'
const SRC = '/study/ai/talk/chat1'
const PLAN = '/plan?month=2026-09&day=2026-09-26&log=sl_1'

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

test('정상: 교정 모음이 적은 원본 경로와 지금 경로가 같으면 교정 모음 주소(같은 조건·그 카드)', () => {
  const raw = serializeCorrectionsReturn(BACK, SRC, NOW)
  assert.ok(raw)
  assert.deepEqual(parseCorrectionsReturn(raw, NOW), { back: BACK, src: SRC, at: NOW })
  assert.equal(correctionsReturnHref(raw, SRC, NOW), BACK)
  assert.equal(correctionsReturnHref(raw, `${SRC}/`, NOW), BACK, '끝 / 차이는 같은 경로')
  const review = '/study/ai/chat/c%2D1/review'
  assert.equal(correctionsReturnHref(serializeCorrectionsReturn(BACK, review, NOW), '/study/ai/chat/c-1/review', NOW), BACK, '퍼센트 인코딩 차이는 같은 경로')
  assert.equal(correctionsReturnHref(serializeCorrectionsReturn('/drawer/corrections', SRC, NOW), SRC, NOW), '/drawer/corrections', '쿼리 없는 주소')
})

test('경로 불일치: 원본에서 다른 화면으로 옮겨 가면 원래 자리(null)', () => {
  const raw = serializeCorrectionsReturn(BACK, SRC, NOW)
  assert.equal(correctionsReturnHref(raw, '/study/ai/talk/chat2', NOW), null, '다른 회화방')
  assert.equal(correctionsReturnHref(raw, `${SRC}/x`, NOW), null)
  assert.equal(correctionsReturnHref(raw, '/drawer/corrections', NOW), null)
  assert.equal(correctionsReturnHref(raw, null, NOW), null)
  assert.equal(correctionsReturnHref(raw, '', NOW), null)
})

test('오래된 기록·미래 시각은 쓰지 않는다(TTL 은 계획표와 같은 2시간)', () => {
  assert.equal(CORRECTIONS_RETURN_TTL_MS, PLAN_RETURN_TTL_MS)
  const raw = serializeCorrectionsReturn(BACK, SRC, NOW)
  assert.equal(correctionsReturnHref(raw, SRC, NOW + CORRECTIONS_RETURN_TTL_MS), BACK, '경계 안')
  assert.equal(correctionsReturnHref(raw, SRC, NOW + CORRECTIONS_RETURN_TTL_MS + 1), null, '경계 밖')
  assert.equal(correctionsReturnHref(raw, SRC, NOW - 30_000), BACK, '시계 조금 어긋남은 허용')
  assert.equal(correctionsReturnHref(raw, SRC, NOW - 10 * 60_000), null, '먼 미래 시각')
})

test('깨진 값: JSON 오류·형식 오류·없는 값·다른 키 모양은 null', () => {
  for (const raw of [null, '', '{', 'null', '[]', '"x"', '42', JSON.stringify({ back: BACK, src: SRC, at: NOW })]) {
    assert.equal(parseCorrectionsReturn(raw, NOW), null, String(raw))
  }
  assert.equal(parseCorrectionsReturn(JSON.stringify({ v: 1, back: BACK, src: SRC, at: 'x' }), NOW), null, 'at 문자열')
  assert.equal(parseCorrectionsReturn(JSON.stringify({ v: 1, back: BACK, src: 42, at: NOW }), NOW), null, 'src 숫자')
  assert.equal(parseCorrectionsReturn(JSON.stringify({ v: 1, plan: BACK, src: SRC, at: NOW }), NOW), null, '계획표 모양(plan 키)은 교정 기록이 아니다')
  assert.equal(parseCorrectionsReturn(JSON.stringify({ v: 2, back: BACK, src: SRC, at: NOW }), NOW), null, '버전 다름')
  assert.equal(parseCorrectionsReturn('x'.repeat(5000), NOW), null, '지나치게 긴 값')
})

test('주소 거절: /drawer/corrections 와 그 쿼리만(다른 사이트·다른 경로·+·해시·700자 초과)', () => {
  assert.equal(isCorrectionsHref('/drawer/corrections'), true)
  assert.equal(isCorrectionsHref(BACK), true)
  // 가장 긴 실제 주소: 유형·조각 + 일본어 40자 검색어(코드포인트마다 9자) + focus 64자 + n.
  const long = `/drawer/corrections?errorType=PRONUNCIATION&chunkType=MODIFIER&q=${'%E3%81%82'.repeat(40)}&focus=${'a'.repeat(64)}&n=50`
  assert.ok(long.length > 300 && long.length <= CORRECTIONS_HREF_MAX, String(long.length))
  assert.equal(isCorrectionsHref(long), true, '긴 일본어 검색어(퍼센트 인코딩)도 700자 안이면 받는다')
  for (const bad of [
    'https://evil.example/drawer/corrections',
    '//evil.example/drawer/corrections',
    '/\\evil.example',
    '/drawer/correctionsx',
    '/drawer/corrections/',
    '/drawer/corrections/../admin',
    '/drawer/words',
    '/drawer/corrections?q=a+b',
    '/drawer/corrections?next=https://evil.example',
    '/drawer/corrections?x=<script>',
    "/drawer/corrections?q=it's",
    'javascript:alert(1)',
    PLAN,
    ` ${BACK}`,
    `${BACK}#x`,
    `/drawer/corrections?q=${'a'.repeat(CORRECTIONS_HREF_MAX)}`,
    '',
  ]) {
    assert.equal(isCorrectionsHref(bad), false, bad)
    assert.equal(serializeCorrectionsReturn(bad, SRC, NOW), null, `적지 않음: ${bad}`)
    const forged = JSON.stringify({ v: 1, back: bad, src: SRC, at: NOW })
    assert.equal(correctionsReturnHref(forged, SRC, NOW), null, `저장소를 고쳐도 거절: ${bad}`)
  }
  assert.equal(serializeCorrectionsReturn(BACK, '//evil.example/x', NOW), null, '원본 경로도 앱 내부만')
  assert.equal(serializeCorrectionsReturn(BACK, 'study/ai', NOW), null)
  assert.equal(serializeCorrectionsReturn(BACK, `/study/ai/talk/${'a'.repeat(400)}`, NOW), null, '원본 경로 300자 초과')
  assert.equal(serializeCorrectionsReturn(BACK, SRC, Number.NaN), null)
})

test('두 기록 고르기: 하나만 맞으면 그것, 둘 다 맞으면 at 이 늦은 쪽, 없으면 null', () => {
  const plan = (at: number, src = SRC) => serializePlanReturn(PLAN, src, at)
  const corr = (at: number, src = SRC) => serializeCorrectionsReturn(BACK, src, at)
  assert.equal(pickBackHref(null, null, SRC, NOW), null)
  assert.equal(pickBackHref(plan(NOW), null, SRC, NOW), PLAN)
  assert.equal(pickBackHref(null, corr(NOW), SRC, NOW), BACK)
  assert.equal(pickBackHref(plan(NOW - 1000), corr(NOW), SRC, NOW), BACK, '교정 모음에서 나중에 열었다')
  assert.equal(pickBackHref(plan(NOW), corr(NOW - 1000), SRC, NOW), PLAN, '계획표에서 나중에 열었다')
  assert.equal(pickBackHref(plan(NOW), corr(NOW), SRC, NOW), PLAN, '같은 시각이면 계획표(드문 경우 — 기존 동작 유지)')
  assert.equal(pickBackHref(plan(NOW, '/study/ai/talk/other'), corr(NOW - 1000), SRC, NOW), BACK, '계획표 기록이 다른 경로면 교정 모음')
  assert.equal(pickBackHref(plan(NOW - 1000), corr(NOW, '/study/ai/talk/other'), SRC, NOW), PLAN, '교정 기록이 다른 경로면 계획표')
  assert.equal(pickBackHref(plan(NOW - PLAN_RETURN_TTL_MS - 5), corr(NOW - PLAN_RETURN_TTL_MS - 1), SRC, NOW), null, '둘 다 오래됨')
  assert.equal(pickBackHref(plan(NOW - PLAN_RETURN_TTL_MS - 5), corr(NOW - 1000), SRC, NOW), BACK, '늦은 쪽이 아니라 유효한 쪽')
  assert.equal(pickBackHref('{', '{', SRC, NOW), null, '둘 다 깨짐')
})

test('← 이름: 계획표 주소면 「계획표로」, 교정 모음 주소면 「교정 모음으로」', () => {
  assert.equal(CORRECTIONS_RETURN_LABEL, '교정 모음으로')
  assert.equal(backLabelOf(PLAN), PLAN_RETURN_LABEL)
  assert.equal(backLabelOf('/plan'), '계획표로')
  assert.equal(backLabelOf(BACK), '교정 모음으로')
  assert.equal(backLabelOf('/drawer/corrections'), '교정 모음으로')
})

test('저장소: 적기 → 읽기 → 교정 모음에 돌아오면 지움 · 계획표 기록과 키가 다르다', () => {
  assert.notEqual(CORRECTIONS_RETURN_KEY, PLAN_RETURN_KEY)
  const m = fakeSession()
  rememberCorrectionsReturn(BACK, SRC, NOW)
  assert.ok(m.has(CORRECTIONS_RETURN_KEY))
  assert.equal(currentCorrectionsReturn(SRC, NOW), BACK)
  assert.equal(currentBackHref(SRC, NOW), BACK)
  assert.equal(currentBackHref('/study/today', NOW), null)
  rememberCorrectionsReturn('https://evil.example/', SRC, NOW + 1)
  assert.equal(currentCorrectionsReturn(SRC, NOW), BACK, '잘못된 주소는 적지 않고 이전 값 유지')

  m.set(PLAN_RETURN_KEY, serializePlanReturn(PLAN, SRC, NOW + 5000) as string)
  assert.equal(currentBackHref(SRC, NOW + 6000), PLAN, '같은 방을 계획표에서 나중에 열면 계획표로')
  rememberCorrectionsReturn(BACK, SRC, NOW + 7000)
  assert.equal(currentBackHref(SRC, NOW + 8000), BACK, '다시 교정 모음에서 열면 교정 모음으로')

  forgetCorrectionsReturn()
  assert.equal(m.has(CORRECTIONS_RETURN_KEY), false)
  assert.equal(m.has(PLAN_RETURN_KEY), true, '교정 기록만 지운다')
  assert.equal(currentCorrectionsReturn(SRC, NOW), null)
  assert.equal(currentBackHref(SRC, NOW + 8000), PLAN)
})

test('저장소 접근 예외: 조용히 무시하고 원래 ←(null)', () => {
  g.window = {
    get sessionStorage(): never {
      throw new Error('SecurityError')
    },
  }
  assert.doesNotThrow(() => rememberCorrectionsReturn(BACK, SRC, NOW))
  assert.doesNotThrow(() => forgetCorrectionsReturn())
  assert.equal(currentCorrectionsReturn(SRC, NOW), null)
  assert.equal(currentBackHref(SRC, NOW), null)

  const boom = () => {
    throw new Error('QuotaExceededError')
  }
  g.window = { sessionStorage: { getItem: boom, setItem: boom, removeItem: boom } }
  assert.doesNotThrow(() => rememberCorrectionsReturn(BACK, SRC, NOW))
  assert.doesNotThrow(() => forgetCorrectionsReturn())
  assert.equal(currentBackHref(SRC, NOW), null)

  delete g.window
  assert.doesNotThrow(() => rememberCorrectionsReturn(BACK, SRC, NOW), '서버(window 없음)')
  assert.equal(currentBackHref(SRC, NOW), null)
})

// 소비처(BackBar·TalkRoomHeader)는 훅만 부른다 — 훅이 두 기록을 함께 보고, 스냅샷은 문자열/null, 서버 스냅샷은 null 이어야 한다(§21-6 B 3).
test('usePlanReturn: 두 기록을 함께 읽고 스냅샷은 문자열(객체 아님) · 서버 스냅샷 null · 소비처는 그대로', () => {
  const strip = (s: string) => s.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')
  const shell = join(__dirname, '..')
  const hook = strip(readFileSync(join(shell, 'usePlanReturn.ts'), 'utf8'))
  assert.match(hook, /export function usePlanReturn\(fallbackHref: string, fallbackLabel: string\): \{ href: string; label: string \}/)
  assert.match(hook, /useCallback\(\(\) => currentBackHref\(pathname\), \[pathname\]\)/)
  assert.match(hook, /const onServer = \(\) => null/)
  assert.match(hook, /useSyncExternalStore\(noopSubscribe, read, onServer\)/)
  assert.match(hook, /label: backLabelOf\(back\)/)
  assert.match(strip(readFileSync(join(shell, 'BackBar.tsx'), 'utf8')), /usePlanReturn\(backHref, backLabel\)/)
  assert.match(strip(readFileSync(join(shell, '..', 'talk', 'TalkRoomHeader.tsx'), 'utf8')), /usePlanReturn\(/)
})
