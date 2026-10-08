import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isPlainClick, nextPressed, PRESS_TIMEOUT_MS, tabIsOn } from '../tabPress'

// task-046(IMP-0027): 서버 응답이 오기 전에도 눌린 탭이 바로 켜진다 — 눌림 상태 전이는 순수 함수라 여기서 닫는다.
const PLAIN = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }

test('isPlainClick — 왼쪽 버튼 단순 클릭만, 수정 키·가운데 버튼은 이 화면의 이동이 아님', () => {
  assert.equal(isPlainClick(PLAIN), true)
  for (const k of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const) assert.equal(isPlainClick({ ...PLAIN, [k]: true }), false, k)
  assert.equal(isPlainClick({ ...PLAIN, button: 1 }), false)
})

test('nextPressed — 다른 탭을 누르면 그 탭, 이미 활성인 탭을 누르면 풀림, 수정 키 클릭은 그대로', () => {
  assert.equal(nextPressed(null, '/study/today', false, true), '/study/today')
  assert.equal(nextPressed('/study/today', '/plan', false, true), '/plan', '빠르게 다른 탭을 누르면 마지막 탭')
  assert.equal(nextPressed('/study/today', '/study/ai', true, true), null, '가던 중 지금 탭을 다시 누르면 지금 탭이 켜져야 한다')
  assert.equal(nextPressed(null, '/study/ai', true, true), null, '이미 활성인 탭을 눌러도 깨지지 않는다')
  assert.equal(nextPressed('/plan', '/ask', false, false), '/plan', '새 탭 클릭은 눌림을 바꾸지 않는다')
  assert.equal(nextPressed(null, '/ask', false, false), null)
})

test('tabIsOn — 눌린 탭이 있으면 그 탭만 켜지고(한 번에 하나), 없으면 실제 활성 탭', () => {
  assert.equal(tabIsOn(true, null, '/study/ai'), true)
  assert.equal(tabIsOn(false, null, '/plan'), false)
  // 회화가 활성인데 계획표를 누른 순간: 계획표 켜짐, 회화 꺼짐
  assert.equal(tabIsOn(true, '/plan', '/study/ai'), false)
  assert.equal(tabIsOn(false, '/plan', '/plan'), true)
  assert.equal(tabIsOn(false, '/plan', '/ask'), false)
})

test('PRESS_TIMEOUT_MS — 경로가 안 바뀌는 눌림이 영영 남지 않게 몇 초 안에 거둔다', () => {
  assert.ok(PRESS_TIMEOUT_MS >= 3000 && PRESS_TIMEOUT_MS <= 15000)
})

const tabBar = readFileSync(join(__dirname, '..', 'TabBar.tsx'), 'utf8')
const code = tabBar.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')

test('TabBar — aria-current 는 실제 경로로만(눌림은 data-pending 모양만), prefetch 를 강제하지 않는다, 훅은 조기 return 앞', () => {
  assert.match(code, /aria-current=\{active \? 'page' : undefined\}/)
  assert.match(code, /data-pending=\{pressed === t\.href \? 'true' : undefined\}/)
  assert.ok(!/prefetch/.test(code), '오늘 탭 API 는 복습 판단 잡을 만든다 — prefetch 금지')
  assert.ok(code.indexOf('useEffect(') < code.indexOf('if (isFocusRoute(pathname)) return null'), '훅은 조기 return 앞에서 호출')
  assert.match(code, /className=\{`[^`]*\$\{\s*on \?/, '켜진 모양은 눌림을 반영한 on')
})
