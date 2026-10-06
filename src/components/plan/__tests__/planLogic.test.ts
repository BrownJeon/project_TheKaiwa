import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { CalendarDay, DayReview, StudyLogItem } from '@/types/plan'
import {
  arrowDelta,
  cellLabel,
  cellView,
  dayLabel,
  dayNav,
  dayStatusLine,
  deleteDetail,
  displaySummary,
  durationLabel,
  emptyDayKind,
  LESSON_SUMMARY_PREFIX,
  focusDate,
  linkState,
  logMeta,
  monthGrid,
  monthLabel,
  monthNote,
  needsUntimedNote,
  orderedTypes,
  parsePlanParams,
  planUrl,
  reviewLine,
  shiftMonth,
  sourceHref,
  summaryTiles,
  timeLabel,
  WEEK_HEADERS,
  weekdayOf,
} from '../logic'

const TODAY = '2026-09-28'

const day = (over: Partial<CalendarDay> = {}): CalendarDay => ({
  date: '2026-09-26', attended: true, types: [], minutes: 0, logCount: 0, hasEvaluation: false, reviewDue: false, ...over,
})
const log = (over: Partial<StudyLogItem> = {}): StudyLogItem => ({
  id: 'sl1', date: '2026-09-26', type: 'WORDS', origin: 'DIRECT', summary: '오늘의 단어 10장', result: null, correctionsCount: 0,
  durationSec: 156, refId: 'vs1', refExists: true, createdAt: '2026-09-26T11:40:00.000Z', ...over,
})

test('월 격자: 월요일 시작 — 앞 빈칸 수와 그 달 날짜 수(평년·윤년·월요일 1일)', () => {
  assert.deepEqual([...WEEK_HEADERS], ['월', '화', '수', '목', '금', '토', '일'])
  const sep = monthGrid('2026-09') // 9/1 화요일
  assert.equal(sep.leading, 1)
  assert.equal(sep.dates.length, 30)
  assert.equal(sep.dates[0], '2026-09-01')
  assert.equal(sep.dates.at(-1), '2026-09-30')
  assert.equal(monthGrid('2026-02').leading, 6) // 2/1 일요일 → 맨 끝 열
  assert.equal(monthGrid('2026-02').dates.length, 28)
  assert.equal(monthGrid('2024-02').dates.length, 29) // 윤년
  assert.equal(monthGrid('2024-02').leading, 3) // 2024-02-01 목요일
  assert.equal(monthGrid('2026-06').leading, 0) // 6/1 월요일
})

test('요일 계산은 기기 시간대와 무관(UTC 기준)', () => {
  const prev = process.env.TZ
  try {
    for (const tz of ['Asia/Seoul', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
      process.env.TZ = tz
      assert.equal(weekdayOf('2026-09-28'), 1, tz)
      assert.equal(monthGrid('2026-09').leading, 1, tz)
    }
  } finally {
    if (prev === undefined) delete process.env.TZ
    else process.env.TZ = prev
  }
})

test('월 이동·표기: 연도 경계', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12')
  assert.equal(shiftMonth('2026-12', 1), '2027-01')
  assert.equal(shiftMonth('2026-09', -13), '2025-08')
  assert.equal(monthLabel('2026-09'), '2026년 9월')
  assert.equal(dayLabel('2026-09-26'), '9월 26일 (토)')
})

test('주소 해석: 형식 오류·미래 달은 이번 달, 날짜는 그 달 안일 때만, 기록 id 는 날짜가 있을 때만', () => {
  assert.deepEqual(parsePlanParams(null, null, null, TODAY), { month: '2026-09', day: null, log: null })
  assert.deepEqual(parsePlanParams('2026-13', null, null, TODAY), { month: '2026-09', day: null, log: null })
  assert.deepEqual(parsePlanParams('2026-10', null, null, TODAY), { month: '2026-09', day: null, log: null })
  assert.deepEqual(parsePlanParams('1999-12', null, null, TODAY), { month: '2026-09', day: null, log: null })
  assert.deepEqual(parsePlanParams('2026-08', '2026-08-17', 'sl_1', TODAY), { month: '2026-08', day: '2026-08-17', log: 'sl_1' })
  assert.deepEqual(parsePlanParams('2026-08', '2026-09-01', 'sl_1', TODAY), { month: '2026-08', day: null, log: null })
  assert.deepEqual(parsePlanParams(null, '2026-07-02', null, TODAY), { month: '2026-07', day: '2026-07-02', log: null })
  assert.deepEqual(parsePlanParams('2026-02', '2026-02-30', null, TODAY).day, null)
  assert.equal(parsePlanParams('2026-09', '2026-09-26', '<script>', TODAY).log, null)
  assert.equal(planUrl('2026-09', '2026-09-26', 'sl1'), '/plan?month=2026-09&day=2026-09-26&log=sl1')
  assert.equal(planUrl('2026-09', null, 'sl1'), '/plan?month=2026-09')
})

test('날짜 칸: 평가 → 복습할 날 → 수·복·단·회·채 순서, 3개 넘으면 +N', () => {
  assert.deepEqual(orderedTypes(['TALK', 'WORDS', 'EVALUATION', 'LESSON']), ['EVALUATION', 'LESSON', 'WORDS', 'TALK'])
  const v = cellView(day({ types: ['TALK', 'WORDS', 'LESSON', 'REVIEW'], logCount: 4, minutes: 52 }), TODAY)
  assert.equal(v.kind, 'study')
  assert.deepEqual(v.marks, [{ kind: 'type', type: 'LESSON' }, { kind: 'type', type: 'REVIEW' }, { kind: 'type', type: 'WORDS' }, { kind: 'more', n: 1 }])
  const ev = cellView(day({ date: TODAY, types: ['WORDS', 'EVALUATION'], logCount: 2, hasEvaluation: true, reviewDue: true }), TODAY)
  assert.deepEqual(ev.marks, [{ kind: 'eval' }, { kind: 'due' }, { kind: 'type', type: 'WORDS' }])
  assert.equal(ev.isToday, true)
  const three = cellView(day({ types: ['WORDS', 'TALK', 'CHAT'], logCount: 3 }), TODAY)
  assert.equal(three.marks.length, 3)
  assert.ok(three.marks.every((m) => m.kind === 'type'))
})

test('날짜 칸: 출석만 = 동그라미, 빈 날, 미래는 복습할 날만 누름', () => {
  const att = cellView(day({ attended: true }), TODAY)
  assert.equal(att.kind, 'attended')
  assert.equal(att.attendedDot, true)
  assert.equal(att.marks.length, 0)
  const none = cellView(day({ attended: false }), TODAY)
  assert.equal(none.kind, 'none')
  assert.equal(none.attendedDot, false)
  assert.equal(none.interactive, true)
  const fut = cellView(day({ date: '2026-09-29', attended: false }), TODAY)
  assert.equal(fut.kind, 'future')
  assert.equal(fut.interactive, false)
  const due = cellView(day({ date: '2026-09-30', attended: false, reviewDue: true }), TODAY)
  assert.equal(due.interactive, true)
  assert.deepEqual(due.marks, [{ kind: 'due' }])
})

test('날짜 칸 화면 읽기 문구', () => {
  assert.equal(
    cellLabel(day({ types: ['TALK', 'WORDS', 'LESSON'], logCount: 3 }), TODAY),
    '9월 26일 토요일, 출석, 공부 3가지: 오늘의 회화, 오늘의 단어, AI 회화',
  )
  assert.equal(cellLabel(day({ date: TODAY, attended: true, reviewDue: true }), TODAY), '9월 28일 월요일, 오늘, 출석, 복습할 날')
  assert.equal(cellLabel(day({ date: '2026-09-30', attended: false, reviewDue: true }), TODAY), '9월 30일 수요일, 아직 오지 않은 날, 복습할 날')
  assert.equal(cellLabel(day({ attended: false }), TODAY), '9월 26일 토요일, 출석 안 함')
})

test('요약 3칸: 이번 달은 지금 연속, 지난 달은 그 달 최장 연속, 오류는 –', () => {
  const s = { attendedDays: 25, studyDays: 21, streak: 12, longestStreak: 14 }
  assert.deepEqual(summaryTiles(s, '2026-09', TODAY), [
    { value: '25일', label: '이번 달 출석' },
    { value: '21일', label: '이번 달 공부' },
    { value: '12일', label: '지금 연속 출석' },
  ])
  assert.deepEqual(summaryTiles(s, '2026-08', TODAY).map((t) => `${t.value}/${t.label}`), ['25일/8월 출석', '21일/8월 공부', '14일/8월 최장 연속'])
  assert.deepEqual(summaryTiles(null, '2026-08', TODAY).map((t) => t.value), ['–', '–', '–'])
})

test('빈 달 안내: 이번 달 = 처음 안내, 지난 달 = 한 줄, 기록 있으면 없음', () => {
  assert.deepEqual(monthNote([day({ attended: true })], '2026-09', TODAY), { kind: 'first' })
  assert.deepEqual(monthNote([day({ date: '2026-07-01', attended: false })], '2026-07', TODAY), { kind: 'empty', text: '7월에는 공부 기록이 없어요.' })
  assert.equal(monthNote([day({ logCount: 1, types: ['WORDS'] })], '2026-09', TODAY), null)
})

test('초점 시작점·방향키', () => {
  assert.equal(focusDate('2026-09', TODAY, null), TODAY)
  assert.equal(focusDate('2026-09', TODAY, '2026-09-12'), '2026-09-12')
  assert.equal(focusDate('2026-09', TODAY, '2026-09-30'), TODAY) // 미래 날은 시작점이 아니다
  assert.equal(focusDate('2026-08', TODAY, null), '2026-08-01')
  assert.equal(arrowDelta('ArrowUp'), -7)
  assert.equal(arrowDelta('ArrowRight'), 1)
  assert.equal(arrowDelta('Enter'), null)
})

test('시트 ‹ ›: 같은 달 안, 다음 날은 오늘까지', () => {
  const first = dayNav('2026-09-01', TODAY)
  assert.equal(first.canPrev, false)
  assert.equal(first.whyPrev, '이 달의 첫날이에요')
  const t = dayNav(TODAY, TODAY)
  assert.equal(t.canNext, false)
  assert.equal(t.whyNext, '다음 날은 아직 오지 않았어요')
  const last = dayNav('2026-08-31', TODAY)
  assert.equal(last.canNext, false)
  assert.equal(last.whyNext, '이 달의 마지막 날이에요')
  assert.equal(dayNav('2026-09-26', TODAY).next, '2026-09-27')
})

test('하루 머리 줄: 공부 시간은 잰 기록만 합한 뒤 분 반올림, 회화·채팅 안내', () => {
  const logs = [log({ durationSec: 156 }), log({ id: 'sl2', type: 'TALK', durationSec: null }), log({ id: 'sl3', type: 'LESSON', durationSec: 1224 })]
  assert.equal(dayStatusLine(logs), '기록 3개 · 공부 시간 23분')
  assert.equal(dayStatusLine([log({ type: 'CHAT', durationSec: null })]), '기록 1개')
  assert.equal(dayStatusLine([]), '')
  assert.equal(needsUntimedNote(logs), true)
  assert.equal(needsUntimedNote([log()]), false)
  assert.equal(emptyDayKind(TODAY, TODAY, true), 'today')
  assert.equal(emptyDayKind('2026-09-23', TODAY, true), 'attended')
  assert.equal(emptyDayKind('2026-09-19', TODAY, false), 'none')
})

test('그날 복습 한 줄', () => {
  const rv = (status: DayReview['status']): DayReview => ({ id: 'rv1', status, lessonId: null })
  assert.equal(reviewLine(null, TODAY, TODAY, []), null)
  assert.deepEqual(reviewLine(rv('DUE'), TODAY, TODAY, []), { tone: 'due', title: '오늘 복습할 차례예요', sub: '선생님이 지난 수업 기록을 보고 정한 날이에요.', action: 'primary' })
  assert.equal(reviewLine(rv('DUE'), '2026-09-20', TODAY, [])?.action, 'ghost')
  assert.equal(reviewLine(rv('DUE'), '2026-09-30', TODAY, [])?.action, null)
  assert.equal(reviewLine(rv('DONE'), '2026-09-18', TODAY, [log({ type: 'REVIEW' })]), null) // 목록의 복습 기록으로 대신
  assert.equal(reviewLine(rv('DONE'), '2026-09-18', TODAY, [])?.title, '이날 복습을 끝냈어요')
  assert.equal(reviewLine(rv('EXPIRED'), '2026-09-05', TODAY, [])?.title, '이날 복습은 지나갔어요')
})

test('기록 한 줄: KST 시각·걸린 시간·메시지·교정', () => {
  assert.equal(timeLabel('2026-09-26T11:40:00.000Z'), '오후 8:40')
  assert.equal(timeLabel('2026-09-25T15:05:00.000Z'), '오전 12:05')
  assert.equal(timeLabel('2026-09-26T03:00:00.000Z'), '오후 12:00')
  assert.equal(durationLabel(156), '2분 36초')
  assert.equal(durationLabel(45), '45초')
  assert.equal(durationLabel(120), '2분')
  assert.equal(durationLabel(1180), '20분')
  assert.deepEqual(logMeta(log()), ['2분 36초'])
  assert.deepEqual(logMeta(log({ type: 'TALK', durationSec: null, result: { turns: 12 }, correctionsCount: 3 })), ['메시지 12개', '교정 3건'])
  assert.deepEqual(logMeta(log({ type: 'CHAT', durationSec: null, result: null })), [])
})

test('복습 수업 요약 표기: 오늘의 회화 「…」 → 복습 「…」(저장값은 그대로)', () => {
  assert.equal(LESSON_SUMMARY_PREFIX, '오늘의 회화 「', '서버 lessons/lifecycle 요약 형식과 같은 접두')
  assert.equal(displaySummary({ type: 'REVIEW', summary: `${LESSON_SUMMARY_PREFIX}카페 주문」 · 문제 5/5` }), '복습 「카페 주문」 · 문제 5/5')
  assert.equal(displaySummary({ type: 'LESSON', summary: `${LESSON_SUMMARY_PREFIX}카페 주문」 · 문제 4/5` }), `${LESSON_SUMMARY_PREFIX}카페 주문」 · 문제 4/5`)
  assert.equal(displaySummary({ type: 'REVIEW', summary: '다른 요약' }), '다른 요약')
})

test('원본 링크: 종류별 경로, 원본 삭제됨, 원본 없음(질문·refId 없음)', () => {
  assert.equal(sourceHref(log()), '/study/today/words/vs1')
  assert.equal(sourceHref(log({ type: 'REVIEW', refId: 'ls1' })), '/study/today/talk/ls1')
  assert.equal(sourceHref(log({ type: 'EVALUATION', refId: 'ev1' })), '/study/today/eval/ev1')
  assert.equal(sourceHref(log({ type: 'TALK', refId: 'c1' })), '/study/ai/talk/c1')
  assert.equal(sourceHref(log({ type: 'CHAT', refId: 'c/2' })), '/study/ai/chat/c%2F2')
  assert.equal(linkState(log({ refExists: false })), 'gone')
  assert.equal(sourceHref(log({ refExists: false })), null)
  assert.equal(linkState(log({ type: 'ASK', refId: 'c3' })), 'none')
  assert.equal(linkState(log({ refId: null, refExists: false })), 'none')
})

test('지우기 확인: 그날 마지막 기록이면 공부 일수 안내 한 문장을 더한다', () => {
  assert.equal(deleteDetail({ type: 'WORDS' }, false, '2026-09', TODAY), '단어 세트 결과는 그대로 남아요. 지운 기록은 되돌릴 수 없어요.')
  assert.equal(
    deleteDetail({ type: 'CHAT' }, true, '2026-08', TODAY),
    '채팅 내용과 교정은 그대로 남아요. 이날 남은 기록이 없어서 달력의 ‘8월 공부’ 일수는 하루 줄어요. 지운 기록은 되돌릴 수 없어요.',
  )
  assert.match(deleteDetail({ type: 'LESSON' }, true, '2026-09', TODAY), /‘이번 달 공부’/)
})

test('챌린지 칸(task-043): 달성·일부·놓침 칩은 맨 앞(3개 안에 셈) · 기간 띠 · 그만둠은 띠·칩 없음 · 챌린지 없는 칸은 그대로', () => {
  const met = cellView(day({ types: ['WORDS', 'LESSON', 'TALK'], logCount: 3, challenge: { challengeId: 'c', dayIndex: 3, state: 'MET' } }), TODAY)
  assert.deepEqual(met.marks, [{ kind: 'ch', state: 'MET' }, { kind: 'type', type: 'LESSON' }, { kind: 'type', type: 'WORDS' }, { kind: 'more', n: 1 }])
  assert.equal(met.band, true)
  assert.ok(met.label.endsWith(', 챌린지 3일째 달성'))
  const today = cellView(day({ date: TODAY, challenge: { challengeId: 'c', dayIndex: 4, state: 'TODAY' } }), TODAY)
  assert.deepEqual(today.marks, [])
  assert.equal(today.band, true)
  assert.ok(today.label.endsWith('챌린지 4일째 오늘, 진행 중'))
  const up = cellView(day({ date: '2026-09-30', attended: false, challenge: { challengeId: 'c', dayIndex: 6, state: 'UPCOMING' } }), TODAY)
  assert.equal(up.band, true)
  assert.equal(up.interactive, false)
  const stop = cellView(day({ challenge: { challengeId: 'c', dayIndex: 7, state: 'STOPPED' } }), TODAY)
  assert.equal(stop.band, false)
  assert.deepEqual(stop.marks, [])
  assert.ok(stop.label.endsWith('챌린지 7일째 그만둠'))
  const plain = cellView(day({ types: ['WORDS'], logCount: 1 }), TODAY)
  assert.equal(plain.band, false)
  assert.ok(!plain.label.includes('챌린지'))
})
