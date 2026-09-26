import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeStreak } from '../attendance'

test('연속 출석: 오늘부터 끊김 없이 거꾸로 센다', () => {
  assert.equal(computeStreak(['2026-09-27', '2026-09-26', '2026-09-25', '2026-09-23'], '2026-09-27'), 3)
  assert.equal(computeStreak(['2026-09-26', '2026-09-25'], '2026-09-27'), 0, '오늘 출석 전이면 0')
  assert.equal(computeStreak([], '2026-09-27'), 0)
  assert.equal(computeStreak(['2026-10-01', '2026-09-30'], '2026-10-01'), 2, '월 경계')
})
