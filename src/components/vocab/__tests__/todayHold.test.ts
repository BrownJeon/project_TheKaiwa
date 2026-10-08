import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TODAY_HOLD_MS, todayRevealed, type TodaySettled } from '../todayHold'

// task-046(IMP-0027, T3): 오늘 탭 첫 화면은 요청 4곳이 모두 끝난 뒤(또는 상한이 지나면) 한 번에 보인다.
const ALL: TodaySettled = { home: true, lessons: true, challenge: true, evaluation: true }

test('상한은 1500ms — 회화 탭 목록의 상한과 같은 값', () => {
  assert.equal(TODAY_HOLD_MS, 1500)
})

test('네 곳이 모두 끝나야 보인다 — 하나라도 안 끝났으면 보이지 않는다(상한 전)', () => {
  assert.equal(todayRevealed(ALL, false), true)
  for (const k of Object.keys(ALL) as (keyof TodaySettled)[]) {
    assert.equal(todayRevealed({ ...ALL, [k]: false }, false), false, `${k} 가 안 끝났는데 보임`)
  }
  assert.equal(todayRevealed({ home: false, lessons: false, challenge: false, evaluation: false }, false), false)
})

test('상한이 지나면 아직 안 온 곳이 있어도 보인다(그 카드는 몸통 자리표시로 남는다)', () => {
  assert.equal(todayRevealed({ home: false, lessons: false, challenge: false, evaluation: false }, true), true)
  assert.equal(todayRevealed({ ...ALL, lessons: false }, true), true)
})

test('「끝남」은 성공·실패를 가리지 않는다 — 호출한 쪽이 loading 이 아닌 상태를 true 로 넘기므로 한 요청의 실패가 나머지를 막지 않는다', () => {
  // TodayHome 은 `loadState !== 'loading'`(ready·error 모두) 같은 식으로 넘긴다 — 형식은 소스 검사로 고정.
  assert.equal(todayRevealed({ ...ALL }, false), true)
})
