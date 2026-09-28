import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, dates, decodeCursor, encodeCursor } from '@/modules/infra'
import { computeStreak } from '../attendance'
import { buildCalendar, longestRun, parseCalendarMonth, parseDayDate, type CalendarLogGroup } from '../studyLog/calendar'
import { deleteStudyLog, groupRefIds, parseStudyLogQuery, serializeLogs, toStudyLogDto, REF_SOURCE, STUDY_TYPES, type LogRow } from '../studyLog/logs'

const code = (c: string, field?: string) => (e: unknown) => e instanceof ApiError && e.code === c && (field === undefined || (e.details as { field?: string } | undefined)?.field === field)
const sp = (q: Record<string, string>) => new URLSearchParams(q)
const g = (date: string, type: CalendarLogGroup['type'], count: number, durationSec = 0): CalendarLogGroup => ({ date, type, count, durationSec })

test('달력: 윤년 2월 — 29일 전부(빈 날 포함), 1/31·3/1 기록·출석·복습은 제외(월 경계)', () => {
  const cal = buildCalendar({
    month: '2024-02',
    today: '2026-09-28',
    logGroups: [g('2024-01-31', 'WORDS', 2, 300), g('2024-02-01', 'TALK', 1), g('2024-02-29', 'LESSON', 1, 90), g('2024-03-01', 'CHAT', 5, 600)],
    attendedDates: ['2024-01-31', '2024-02-01', '2024-02-29', '2024-03-01'],
    reviewDueDates: ['2024-01-31', '2024-02-10', '2024-03-01'],
    streak: 0,
  })
  assert.equal(cal.days.length, 29)
  assert.equal(cal.days[0].date, '2024-02-01')
  assert.equal(cal.days.at(-1)?.date, '2024-02-29')
  assert.deepEqual(cal.days.map((d) => d.date), dates.eachDateInRange('2024-02-01', '2024-02-29'), '날짜 오름차순·빠짐 없음')
  assert.equal(cal.summary.attendedDays, 2)
  assert.equal(cal.summary.studyDays, 2)
  assert.deepEqual(cal.days.filter((d) => d.reviewDue).map((d) => d.date), ['2024-02-10'])
  assert.equal(cal.days.reduce((n, d) => n + d.logCount, 0), 2, '1/31·3/1 기록은 세지 않는다')
  const empty = cal.days[4]
  assert.deepEqual(empty, { date: '2024-02-05', attended: false, types: [], minutes: 0, logCount: 0, hasEvaluation: false, reviewDue: false })
})

test('달력: 평년 2월 28일 · 12월→다음 해 1월 경계 · 30일 달', () => {
  assert.equal(buildCalendar({ month: '2026-02', today: '2026-09-28', logGroups: [], attendedDates: [], reviewDueDates: [], streak: 0 }).days.length, 28)
  const dec = buildCalendar({ month: '2026-12', today: '2026-12-31', logGroups: [g('2026-12-31', 'WORDS', 1, 60), g('2027-01-01', 'WORDS', 1, 60)], attendedDates: ['2026-12-31', '2027-01-01'], reviewDueDates: [], streak: 1 })
  assert.equal(dec.days.length, 31)
  assert.equal(dec.days.at(-1)?.logCount, 1)
  assert.equal(dec.summary.attendedDays, 1)
  assert.equal(buildCalendar({ month: '2026-09', today: '2026-09-28', logGroups: [], attendedDates: [], reviewDueDates: [], streak: 0 }).days.length, 30)
})

test('달력: minutes = 그날 durationSec 합을 분 반올림(기록별 반올림 아님), 값 없는 기록은 0', () => {
  const cal = buildCalendar({
    month: '2026-09',
    today: '2026-09-28',
    logGroups: [g('2026-09-26', 'WORDS', 1, 156), g('2026-09-26', 'TALK', 2, 60), g('2026-09-26', 'LESSON', 1, 0), g('2026-09-27', 'CHAT', 1, 20), g('2026-09-28', 'WORDS', 3, 29 + 29 + 29)],
    attendedDates: [],
    reviewDueDates: [],
    streak: 0,
  })
  const day = (d: string) => cal.days.find((x) => x.date === d)
  assert.equal(day('2026-09-26')?.minutes, 4, '156+60=216초 → 3.6 → 4분')
  assert.equal(day('2026-09-26')?.logCount, 4)
  assert.equal(day('2026-09-27')?.minutes, 0, '20초 → 0분')
  assert.equal(day('2026-09-28')?.minutes, 1, '29초×3=87초 → 1분(기록별 반올림이면 0)')
  assert.equal(day('2026-09-28')?.logCount, 3)
})

test('달력: types 는 중복 없이 고정 순서, hasEvaluation = EVALUATION 기록 유무, 0건 묶음은 무시', () => {
  const cal = buildCalendar({
    month: '2026-09',
    today: '2026-09-28',
    logGroups: [g('2026-09-10', 'ASK', 1), g('2026-09-10', 'EVALUATION', 1), g('2026-09-10', 'WORDS', 2), g('2026-09-10', 'TALK', 1), g('2026-09-11', 'LESSON', 0)],
    attendedDates: ['2026-09-10'],
    reviewDueDates: [],
    streak: 0,
  })
  const d10 = cal.days.find((d) => d.date === '2026-09-10')
  assert.deepEqual(d10?.types, ['TALK', 'WORDS', 'EVALUATION', 'ASK'])
  assert.equal(d10?.hasEvaluation, true)
  const d11 = cal.days.find((d) => d.date === '2026-09-11')
  assert.deepEqual(d11?.types, [])
  assert.equal(d11?.logCount, 0)
  assert.equal(cal.summary.studyDays, 1)
})

test('달력 요약: 출석만 한 날은 studyDays 에 안 들어가고, streak 은 오늘 기준 값 그대로, longestStreak 은 그 달 안', () => {
  const cal = buildCalendar({
    month: '2026-09',
    today: '2026-10-02',
    logGroups: [g('2026-09-02', 'WORDS', 1)],
    attendedDates: ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-10', '2026-09-28', '2026-09-29', '2026-09-30'],
    reviewDueDates: [],
    streak: 5,
  })
  assert.equal(cal.today, '2026-10-02')
  assert.deepEqual(cal.summary, { attendedDays: 7, studyDays: 1, streak: 5, longestStreak: 3 })
  assert.equal(longestRun([]), 0)
  assert.equal(longestRun([true, true, false, true, true, true, false]), 3)
  // streak 원천(#25·#26 과 같은 계산) — 월 경계를 넘어 이어진다.
  assert.equal(computeStreak(['2026-10-02', '2026-10-01', '2026-09-30', '2026-09-29', '2026-09-28', '2026-09-26'], '2026-10-02'), 5)
})

test('KST 경계: UTC 15:00 에 날짜·달이 바뀐다 — month 생략 시 서버 KST 이번 달', () => {
  const before = dates.todayKst(new Date('2026-09-30T14:59:59.999Z'))
  const after = dates.todayKst(new Date('2026-09-30T15:00:00.000Z'))
  assert.equal(before, '2026-09-30')
  assert.equal(after, '2026-10-01')
  assert.equal(parseCalendarMonth(null, before), '2026-09')
  assert.equal(parseCalendarMonth('', after), '2026-10')
  assert.equal(parseCalendarMonth('2026-12', after), '2026-12')
  assert.equal(dates.fromDbDate(dates.toDbDate('2026-10-01')), '2026-10-01', '@db.Date 왕복은 UTC 자정')
})

test('month·date 검증 400', () => {
  for (const bad of ['2026-13', '2026-9', '2026-00', '26-09', '1999-12', '2101-01', '2026-09-01']) assert.throws(() => parseCalendarMonth(bad), code('VALIDATION', 'month'), bad)
  for (const bad of [null, '', '2026-02-30', '2026-9-1', '1999-12-31', 'x']) assert.throws(() => parseDayDate(bad), code('VALIDATION', 'date'), String(bad))
  assert.equal(parseDayDate('2024-02-29'), '2024-02-29')
})

test('#72 쿼리: 기본 구간 = 오늘 포함 92일, 92일 초과·뒤집힘·잘못된 type·limit·cursor 는 400', () => {
  const q = parseStudyLogQuery(sp({}), '2026-09-28')
  assert.equal(q.to, '2026-09-28')
  assert.equal(dates.countDays(q.from, q.to), 92)
  assert.equal(q.limit, 20)
  assert.equal(q.type, null)
  assert.equal(q.cursor, null)
  const onlyTo = parseStudyLogQuery(sp({ to: '2026-03-01' }), '2026-09-28')
  assert.equal(dates.countDays(onlyTo.from, onlyTo.to), 92)
  assert.deepEqual(parseStudyLogQuery(sp({ from: '2026-07-01', to: '2026-09-30', type: 'LESSON', limit: '100' }), '2026-09-28'), { from: '2026-07-01', to: '2026-09-30', type: 'LESSON', limit: 100, cursor: null })
  assert.throws(() => parseStudyLogQuery(sp({ from: '2026-06-29', to: '2026-09-29' }), '2026-09-28'), code('VALIDATION', 'from'), '93일')
  assert.throws(() => parseStudyLogQuery(sp({ from: '2026-06-01' }), '2026-09-28'), code('VALIDATION', 'from'), 'from 만 주면 to=오늘 → 초과')
  assert.throws(() => parseStudyLogQuery(sp({ from: '2026-09-10', to: '2026-09-01' }), '2026-09-28'), code('VALIDATION', 'from'))
  assert.throws(() => parseStudyLogQuery(sp({ to: '2026-02-30' })), code('VALIDATION', 'to'))
  assert.throws(() => parseStudyLogQuery(sp({ type: 'words' })), code('VALIDATION', 'type'))
  assert.throws(() => parseStudyLogQuery(sp({ limit: '0' })), code('VALIDATION', 'limit'))
  assert.throws(() => parseStudyLogQuery(sp({ limit: '101' })), code('VALIDATION', 'limit'))
  assert.throws(() => parseStudyLogQuery(sp({ cursor: 'garbage' })), code('VALIDATION', 'cursor'))
  assert.throws(() => parseStudyLogQuery(sp({ cursor: encodeCursor({ t: '2026-09-01T00:00:00.000Z', id: 'x' }) })), code('VALIDATION', 'cursor'), '날짜 키 없는 커서')
  const cur = encodeCursor({ d: '2026-09-26', t: '2026-09-26T03:00:00.000Z', id: 'sl1' })
  assert.deepEqual(parseStudyLogQuery(sp({ cursor: cur }), '2026-09-28').cursor, { d: '2026-09-26', t: '2026-09-26T03:00:00.000Z', id: 'sl1' })
  assert.equal(decodeCursor(cur, (v): v is Record<string, unknown> => !!v)?.d, '2026-09-26')
})

const row = (over: Partial<LogRow>): LogRow => ({
  id: 'sl', date: dates.toDbDate('2026-09-26'), type: 'WORDS', origin: 'DIRECT', summary: 's', result: null, correctionsCount: 0, durationSec: null, refId: null, createdAt: new Date('2026-09-26T01:00:00.000Z'), ...over,
})

test('원본 참조: 종류별 묶음(중복 제거)·대화 3종은 CHAT·refExists 판정·로그 객체 모양', () => {
  assert.deepEqual(STUDY_TYPES.map((t) => REF_SOURCE[t]), ['CHAT', 'CHAT', 'VOCAB_SESSION', 'LESSON', 'LESSON', 'EVALUATION', 'CHAT'])
  const rows = [row({ id: 'a', type: 'WORDS', refId: 'vs1' }), row({ id: 'b', type: 'WORDS', refId: 'vs1' }), row({ id: 'c', type: 'REVIEW', refId: 'l1' }), row({ id: 'd', type: 'ASK', refId: 'c1' }), row({ id: 'e', type: 'TALK', refId: null })]
  assert.deepEqual(groupRefIds(rows), { VOCAB_SESSION: ['vs1'], LESSON: ['l1'], EVALUATION: [], CHAT: ['c1'] })
  const exists = { VOCAB_SESSION: new Set(['vs1']), LESSON: new Set<string>(), EVALUATION: new Set<string>(), CHAT: new Set(['c1']) }
  assert.deepEqual(rows.map((r) => toStudyLogDto(r, exists).refExists), [true, true, false, true, false])
  const dto = toStudyLogDto(row({ id: 'x', refId: 'vs1', durationSec: 156, result: { correct: 7 } }), exists)
  assert.deepEqual(Object.keys(dto).sort(), ['correctionsCount', 'createdAt', 'date', 'durationSec', 'id', 'origin', 'refExists', 'refId', 'result', 'summary', 'type'])
  assert.equal(dto.date, '2026-09-26')
  assert.equal(dto.createdAt, '2026-09-26T01:00:00.000Z')
})

test('빈 로그는 원본 조회 없이 [] · 잘못된 id 삭제는 DB 없이 404', async () => {
  let called = 0
  assert.deepEqual(await serializeLogs('u', [], { ownedChatIds: async () => { called++; return new Set() } }), [])
  assert.equal(called, 0)
  await assert.rejects(deleteStudyLog('u', ''), code('NOT_FOUND'))
  await assert.rejects(deleteStudyLog('u', 'x'.repeat(41)), code('NOT_FOUND'))
})
