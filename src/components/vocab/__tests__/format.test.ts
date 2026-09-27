import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accuracy, addDays, formatDuration, formatMonthDay, formatSessionDate, todayKey, weekDays } from '../format'

test('todayKey: KST 자정 경계', () => {
  assert.equal(todayKey(new Date('2026-09-26T14:59:00.000Z')), '2026-09-26')
  assert.equal(todayKey(new Date('2026-09-26T15:00:00.000Z')), '2026-09-27')
})

test('addDays: 월·연 경계', () => {
  assert.equal(addDays('2026-09-01', -1), '2026-08-31')
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2028-03-01', -1), '2028-02-29', '윤년')
  assert.equal(addDays('bad', 1), '')
})

test('formatSessionDate: 오늘·어제·M월 D일', () => {
  assert.equal(formatSessionDate('2026-09-27', '2026-09-27'), '오늘')
  assert.equal(formatSessionDate('2026-09-26', '2026-09-27'), '어제')
  assert.equal(formatSessionDate('2026-09-01', '2026-09-27'), '9월 1일')
  assert.equal(formatMonthDay('2026-10-05'), '10월 5일')
})

test('formatDuration', () => {
  assert.equal(formatDuration(45), '45초')
  assert.equal(formatDuration(156), '2분 36초')
  assert.equal(formatDuration(180), '3분')
  assert.equal(formatDuration(null), '')
  assert.equal(formatDuration(-1), '')
})

test('weekDays: 오늘이 맨 오른쪽, 요일은 KST 달력 기준', () => {
  const w = weekDays('2026-09-27')
  assert.equal(w.length, 7)
  assert.equal(w[6].date, '2026-09-27')
  assert.equal(w[6].weekday, '일')
  assert.equal(w[6].isToday, true)
  assert.equal(w[0].date, '2026-09-21')
  assert.equal(w[0].weekday, '월')
  assert.deepEqual(weekDays('nope'), [])
})

test('accuracy: 건너뜀 제외, 0 이면 null', () => {
  assert.equal(accuracy(84, 28), 75)
  assert.equal(accuracy(0, 0), null)
  assert.equal(accuracy(1, 2), 33)
})
