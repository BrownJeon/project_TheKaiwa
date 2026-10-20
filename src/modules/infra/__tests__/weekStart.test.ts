/**
 * task-080 — 주 시작 정본 상수(36-10). 달력·성장·질문 탭 «이번 주»가 이 둘만 쓴다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WEEK_START_DOW, weekStartOf, toDbDate } from '../dates'

test('WEEK_START_DOW = 0 (일요일)', () => {
  assert.equal(WEEK_START_DOW, 0)
})

test('weekStartOf — 요일마다 그 주 일요일', () => {
  // 2026-10-18(일) ~ 2026-10-24(토)
  for (const d of ['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24']) {
    assert.equal(weekStartOf(d), '2026-10-18', d)
  }
  assert.equal(weekStartOf('2026-10-25'), '2026-10-25')
  assert.equal(weekStartOf('2026-10-17'), '2026-10-11')
})

test('weekStartOf — 달·연 경계', () => {
  assert.equal(weekStartOf('2026-10-01'), '2026-09-27')
  assert.equal(weekStartOf('2026-12-31'), '2026-12-27')
  assert.equal(weekStartOf('2027-01-02'), '2026-12-27')
  assert.equal(weekStartOf('2027-01-03'), '2027-01-03')
  assert.equal(weekStartOf('2024-02-29'), '2024-02-25')
})

test('weekStartOf — 결과는 늘 일요일이고 6일 안쪽', () => {
  let d = '2026-01-01'
  for (let i = 0; i < 400; i++) {
    const s = weekStartOf(d)
    assert.equal(toDbDate(s).getUTCDay(), WEEK_START_DOW, d)
    const gap = (toDbDate(d).getTime() - toDbDate(s).getTime()) / 86_400_000
    assert.ok(gap >= 0 && gap <= 6, d)
    const next = toDbDate(d)
    next.setUTCDate(next.getUTCDate() + 1)
    d = next.toISOString().slice(0, 10)
  }
})

test('weekStartOf — 잘못된 날짜는 던진다', () => {
  assert.throws(() => weekStartOf('2026-02-30'))
})
