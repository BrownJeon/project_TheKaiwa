import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cpLength, formatClock, formatDateDivider, formatListTime, kstDateKey, withinGroupGap } from '../format'

// 2026-09-27(일) 14:00 KST = 05:00Z
const NOW = new Date('2026-09-27T05:00:00.000Z')

test('kstDateKey: UTC 자정 전후를 KST 날짜로', () => {
  assert.equal(kstDateKey('2026-09-26T14:59:00.000Z'), '2026-09-26')
  assert.equal(kstDateKey('2026-09-26T15:00:00.000Z'), '2026-09-27')
  assert.equal(kstDateKey('not-a-date'), '')
})

test('formatListTime: 오늘·어제·올해·그 외', () => {
  assert.equal(formatListTime('2026-09-27T00:05:00.000Z', NOW), '09:05')
  assert.equal(formatListTime('2026-09-26T15:00:00.000Z', NOW), '00:00', 'KST 자정은 오늘')
  assert.equal(formatListTime('2026-09-26T14:59:00.000Z', NOW), '어제')
  assert.equal(formatListTime('2026-03-01T03:00:00.000Z', NOW), '3월 1일')
  assert.equal(formatListTime('2025-12-31T16:00:00.000Z', NOW), '1월 1일', 'KST 로는 2026년')
  assert.equal(formatListTime('2025-12-31T14:00:00.000Z', NOW), '2025.12.31')
  assert.equal(formatListTime(null, NOW), '')
})

test('formatDateDivider·formatClock', () => {
  assert.equal(formatDateDivider('2026-09-27T05:00:00.000Z', NOW), '9월 27일 (일)')
  assert.equal(formatDateDivider('2025-09-27T05:00:00.000Z', NOW), '2025년 9월 27일 (토)')
  assert.equal(formatClock('2026-09-27T14:03:00.000Z'), '23:03')
  assert.equal(formatClock('2026-09-26T15:07:00.000Z'), '00:07')
})

test('cpLength: 이모지·결합 없는 서로게이트 쌍을 1자로', () => {
  assert.equal(cpLength('今日は😀楽しかった🎉'), 10)
  assert.equal('今日は😀楽しかった🎉'.length, 12)
  assert.equal(cpLength(''), 0)
})

test('withinGroupGap: 5분 이내만 한 묶음', () => {
  assert.equal(withinGroupGap('2026-09-27T05:00:00.000Z', '2026-09-27T05:05:00.000Z'), true)
  assert.equal(withinGroupGap('2026-09-27T05:00:00.000Z', '2026-09-27T05:05:01.000Z'), false)
})
