import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { GrowthDay } from '@/types/plan'
import {
  barLabelShown,
  barPick,
  barScale,
  countLineOf,
  evalPick,
  evalSrOf,
  fewNoteOf,
  growthUrl,
  isLate,
  leadingBefore,
  mdOf,
  metricValue,
  niceStep,
  parseGrowthWeeks,
  progressOf,
  rangeText,
  readLineOf,
  rowShapeOf,
  selectedWeekOf,
  showEvalNoneBody,
  showSpark,
  slOf,
  stripCellState,
  stripColumnsOf,
  stripCounts,
  stepWeek,
  stripRowsOf,
  summaryTilesOf,
  syncWeekPick,
  waitLineOf,
  weekEndLabel,
  weekKeyOf,
} from '../growthLogic'
import { emptyFixture, evaluation, fewFixture, normalFixture, oneSidedFixture, richFixture, skill, TODAY } from './growthFixtures'

// task-080 화면 계산(screens.md §36-6 D·E). 판정 값(enough·stage·trend)은 서버 몫이라 여기서는 고르기·글·경계만 본다.

test('주소 ?weeks= — 4|8|12 만, 그 밖·없음은 4. 기본값(4)은 주소에 쓰지 않는다', () => {
  assert.equal(parseGrowthWeeks('8'), 8)
  assert.equal(parseGrowthWeeks('12'), 12)
  assert.equal(parseGrowthWeeks('4'), 4)
  for (const v of [null, undefined, '', '5', '0', '-4', 'abc', '8.5', '16']) assert.equal(parseGrowthWeeks(v), 4, String(v))
  assert.equal(growthUrl(4), '/plan/growth')
  assert.equal(growthUrl(8), '/plan/growth?weeks=8')
  assert.equal(growthUrl(12), '/plan/growth?weeks=12')
})

test('날짜 글 — md(앞 0 없음)·sl·지난 주 끝(같은 달 D일 / 달 넘김 M월 D일)', () => {
  assert.equal(mdOf('2026-10-04'), '10월 4일')
  assert.equal(slOf('2026-09-07'), '9/7')
  assert.equal(weekEndLabel('2026-10-04'), '10일')
  assert.equal(weekEndLabel('2026-09-27'), '10월 3일')
})

test('기간 줄 — 늦게 시작이면 꼬리, 아니면 없음, since=null 이면 없음', () => {
  const few = fewFixture()
  assert.equal(few.range.from, '2026-09-27')
  assert.equal(rangeText(few.range, few.since), '9월 27일(일)~오늘 · 주는 일요일에 시작해요 · 기록은 10월 8일부터라 그 전 칸은 비어 보여요')
  const normal = normalFixture()
  assert.equal(rangeText(normal.range, normal.since), '9월 27일(일)~오늘 · 주는 일요일에 시작해요')
  assert.equal(rangeText(few.range, null), '9월 27일(일)~오늘 · 주는 일요일에 시작해요')
  assert.equal(isLate('2026-09-27', '2026-09-27'), false, '같은 날은 늦지 않다')
  assert.equal(isLate('2026-09-28', '2026-09-27'), true)
})

test('숫자 카드 — 늦게 시작이면 «시작한 지 N일 중», 아니면 «M월 D일(일)부터», 이번 주 보조 글(일요일이면 «오늘(일요일)부터»)', () => {
  const few = summaryTilesOf(fewFixture())
  assert.deepEqual(
    few.map((t) => [t.label, t.value, t.sub]),
    [
      ['연속 출석', 3, '가장 길게 3일'],
      ['공부한 날', 9, '시작한 지 13일 중'],
      ['이번 주', 2, '일요일~화요일'],
    ],
  )
  assert.equal(summaryTilesOf(normalFixture())[1].sub, '9월 27일(일)부터')
  const sun = fewFixture()
  assert.equal(summaryTilesOf({ ...sun, range: { ...sun.range, today: '2026-10-18' } })[2].sub, '오늘(일요일)부터')
  assert.equal(summaryTilesOf({ ...sun, range: { ...sun.range, today: '2026-10-24' } })[2].sub, '일요일~토요일')
})

test('체크내역 칸 상태 — 먼저 맞는 것: 미래 → 기록 전 → 3·2·1단 → 출석만 → 안 함', () => {
  const day = (kinds: number, attended = true): GrowthDay => ({ date: 'x', attended, kinds })
  const since = '2026-10-08'
  assert.equal(stripCellState('2026-10-21', TODAY, since, day(3)), 'future', '오늘 뒤는 공부가 있어도 미래')
  assert.equal(stripCellState('2026-10-07', TODAY, since, day(2)), 'pre', '시작 전은 값이 있어도 기록 전')
  assert.equal(stripCellState('2026-10-08', TODAY, since, day(6)), 'k3', '3가지 이상')
  assert.equal(stripCellState('2026-10-08', TODAY, since, day(3)), 'k3')
  assert.equal(stripCellState('2026-10-09', TODAY, since, day(2)), 'k2')
  assert.equal(stripCellState('2026-10-09', TODAY, since, day(1)), 'k1', '공부가 있으면 출석보다 먼저')
  assert.equal(stripCellState('2026-10-09', TODAY, since, day(0)), 'att')
  assert.equal(stripCellState('2026-10-09', TODAY, since, day(0, false)), 'none')
  assert.equal(stripCellState(TODAY, TODAY, since, undefined), 'none', '응답에 없는 날 = 안 함')
  // since=null(기록 0): 오늘 칸만 «안 함», 그 앞은 비움
  assert.equal(stripCellState(TODAY, TODAY, null, day(0, false)), 'none')
  assert.equal(stripCellState('2026-10-19', TODAY, null, day(0, false)), 'pre')
})

test('체크내역 열 — 주 시작 일요일, 칸 7개 일~토, 라벨(날짜·달 바뀜), 숨김 요약 수·표(최근 주가 위)', () => {
  const few = fewFixture()
  const cols = stripColumnsOf(few)
  assert.deepEqual(
    cols.map((c) => c.weekStart),
    ['2026-09-27', '2026-10-04', '2026-10-11', '2026-10-18'],
  )
  assert.equal(cols[0].cells[0].date, '2026-09-27')
  assert.equal(cols[0].cells[6].date, '2026-10-03')
  assert.deepEqual(
    cols.map((c) => [c.sl, c.month]),
    [
      ['9/27', '9월'],
      ['10/4', '10월'],
      ['10/11', null],
      ['10/18', null],
    ],
  )
  assert.deepEqual(
    cols[3].cells.map((c) => c.state),
    ['k2', 'att', 'k1', 'future', 'future', 'future', 'future'],
    '이번 주: 일(2가지)·월(출석만)·화(1가지)·남은 날 미래',
  )
  assert.deepEqual(stripCounts(cols), { studied: 9, attendOnly: 1 })
  const rows = stripRowsOf(cols, few.weeks)
  assert.deepEqual(rows[0], { week: '10/18 주 · 이번 주', studied: '일(2) 화(1)', attendOnly: '월' })
  assert.deepEqual(rows[1], { week: '10/11 주', studied: '월(2) 화(1) 목(3) 금(1)', attendOnly: '–' })
  assert.deepEqual(rows[3], { week: '9/27 주', studied: '기록 전', attendOnly: '' }, '그 주 전체가 기록 전')
  const rich = stripColumnsOf(richFixture())
  assert.deepEqual(
    rich.filter((c) => c.month).map((c) => c.month),
    ['8월', '9월', '10월'],
    '12주 — 첫 열과 달이 바뀌는 열에만 달',
  )
})

test('주마다 공부량 값 — 지표 매핑(대화 = 음성 + 글자), 기록 전 주는 null', () => {
  const few = fewFixture()
  const [pre, w1, w2, w3] = few.weeks
  assert.equal(metricValue(pre, 'days'), null)
  assert.equal(metricValue(pre, 'turns'), null)
  assert.equal(metricValue(w1, 'days'), 3)
  assert.equal(metricValue(w2, 'days'), 4)
  assert.equal(metricValue(w3, 'days'), 2)
  assert.equal(metricValue(w2, 'words'), 4)
  assert.equal(metricValue(w2, 'lessons'), 2)
  assert.equal(metricValue(w2, 'reviews'), 1)
  assert.equal(metricValue(w2, 'turns'), 24)
  assert.equal(metricValue(w2, 'corr'), 6)
})

test('막대 눈금 — 간격 ≤5→1·≤10→2·≤25→5·≤50→10·그 밖 20, 위 끝은 눈금 배수, 모두 0·기록 전이면 1', () => {
  assert.deepEqual([5, 6, 10, 11, 25, 26, 50, 51].map(niceStep), [1, 2, 2, 5, 5, 10, 10, 20])
  assert.deepEqual(barScale([null, 3, 4, 2]), { step: 1, max: 4 })
  assert.deepEqual(barScale([null, null]), { step: 1, max: 1 })
  assert.deepEqual(barScale([0, 0]), { step: 1, max: 1 })
  assert.deepEqual(barScale([61, 14]), { step: 20, max: 80 })
  assert.deepEqual(barScale([7]), { step: 2, max: 8 })
  assert.equal(leadingBefore([null, null, 3, null]), 2)
  assert.equal(leadingBefore([1, 2]), 0)
  assert.equal(leadingBefore([null, null]), 2)
})

test('막대 x 라벨 — 4주 모두 · 8주 둘에 하나 · 12주 셋에 하나(마지막에서 거꾸로)', () => {
  const shown = (n: number) => Array.from({ length: n }, (_, j) => j).filter((j) => barLabelShown(j, n))
  assert.deepEqual(shown(4), [0, 1, 2, 3])
  assert.deepEqual(shown(8), [1, 3, 5, 7])
  assert.deepEqual(shown(12), [2, 5, 8, 11])
})

test('막대 누르기 — floor((x − padL) / slot) 번째 주, 기간 밖은 null', () => {
  assert.equal(barPick(26, 26, 68, 4), 0)
  assert.equal(barPick(93.9, 26, 68, 4), 0)
  assert.equal(barPick(94, 26, 68, 4), 1)
  assert.equal(barPick(297, 26, 68, 4), 3)
  assert.equal(barPick(10, 26, 68, 4), null)
  assert.equal(barPick(26 + 68 * 4, 26, 68, 4), null)
})

test('읽기 줄 — 이번 주 / 지난 주(같은 달·달 넘김) / 기록 전, 낭독은 «일요일부터 … 토요일까지»', () => {
  const a = readLineOf('2026-10-18', true, TODAY, 'days', 2)
  assert.deepEqual(a.visible, ['이번 주 10월 18일(일)~오늘(화) · ', { b: '공부한 날 2일' }])
  assert.equal(a.sr, '이번 주, 10월 18일 일요일부터 오늘 화요일까지, 공부한 날 2일')
  const b = readLineOf('2026-10-04', false, TODAY, 'words', 3)
  assert.deepEqual(b.visible, ['10월 4일(일)~10일(토) · ', { b: '단어 3세트' }])
  assert.equal(b.sr, '10월 4일 일요일부터 10일 토요일까지, 단어 3세트')
  const c = readLineOf('2026-09-27', false, TODAY, 'turns', 14)
  assert.deepEqual(c.visible, ['9월 27일(일)~10월 3일(토) · ', { b: '대화 14번' }])
  const d = readLineOf('2026-09-27', false, TODAY, 'corr', null)
  assert.deepEqual(d.visible, ['9월 27일(일)~10월 3일(토) · 기록을 시작하기 전이에요'])
  assert.equal(d.sr, '9월 27일 일요일부터 10월 3일 토요일까지, 기록을 시작하기 전이에요')
})

test('적음 안내 — 단계가 보이는 축 0개(끝 절 없이)·1개(이름·조사)·2개 이상(없음)·since=null(없음)', () => {
  const few = fewFixture()
  assert.deepEqual(fewNoteOf(few), ['기록 13일째예요. 능력 단계는 기록이 모이는 대로 하나씩 보여요', ' — 지금은 ', { b: '어휘 회상' }, '이 먼저 보이기 시작했어요.'])
  const zero = { ...few, skills: few.skills.map((s) => ({ ...s, enough: false, stage: null })) }
  assert.deepEqual(fewNoteOf(zero), ['기록 13일째예요. 능력 단계는 기록이 모이는 대로 하나씩 보여요.'])
  const grammarOnly = { ...zero, skills: zero.skills.map((s) => (s.axis === 'GRAMMAR_PARTICLE' ? { ...s, enough: true, stage: 1 as const } : s)) }
  assert.deepEqual(fewNoteOf(grammarOnly)?.slice(1), [' — 지금은 ', { b: '문형·조사' }, '가 먼저 보이기 시작했어요.'])
  assert.equal(fewNoteOf(normalFixture()), null, '두 축 이상이면 안내 없음')
  assert.equal(fewNoteOf(emptyFixture()), null, '기록 0(since=null)이면 안내 없음')
  const notRecorded = { ...zero, skills: zero.skills.map((s) => (s.axis === 'LISTEN_RESPOND' ? { ...s, enough: true, stage: 2 as const } : s)) }
  assert.equal(fewNoteOf(notRecorded)?.length, 1, '기록 전(recorded=false) 축은 세지 않는다')
  const today = { ...few, since: TODAY }
  assert.match(String(fewNoteOf(today)?.[0]), /^기록 1일째예요/)
})

test('단계 전 줄 — 건수 부족 / 건수는 되는데 날짜 부족 / 역할극 수, 진행선 비율', () => {
  const a = skill('GRAMMAR_PARTICLE', { n: 14, obsDays: 4 })
  assert.equal(waitLineOf(a), '관측 14건 · 20건이 되면 단계가 보여요')
  assert.equal(progressOf(a), 0.7)
  const b = skill('SENTENCE_PRODUCTION', { n: 25, obsDays: 2 })
  assert.equal(waitLineOf(b), '관측 25건 · 3일에 걸쳐 모이면 단계가 보여요(지금 2일)')
  assert.equal(progressOf(b), 2 / 3)
  const c = skill('CONVERSATION_MAINTAIN', { n: 4 })
  assert.equal(waitLineOf(c), '끝낸 역할극 4번 · 5번이 되면 단계가 보여요')
  assert.equal(progressOf(c), 0.8)
  assert.equal(progressOf(skill('VOCAB_RECALL', { n: 40, obsDays: 1 })), 1 / 3)
  assert.equal(progressOf(skill('CONVERSATION_MAINTAIN', { n: 9 })), 1, '넘쳐도 1')
})

test('숫자 줄 — 일부·넘김이 0 이면 뺀다, 넘김은 괄호 밖(L3), 역할극은 목표 달성 수', () => {
  assert.equal(countLineOf(skill('VOCAB_RECALL', { n: 90, success: 70, fail: 20 })), '관측 90건(맞힘 70 · 틀림 20)')
  assert.equal(countLineOf(skill('VOCAB_RECALL', { n: 96, success: 70, partial: 4, fail: 22, skipped: 6 })), '관측 96건(맞힘 70 · 일부 4 · 틀림 22) · 넘김 6')
  assert.equal(countLineOf(skill('VOCAB_RECALL', { n: 90, success: 70, fail: 20, skipped: 6 })), '관측 90건(맞힘 70 · 틀림 20) · 넘김 6')
  assert.equal(countLineOf(skill('CONVERSATION_MAINTAIN', { n: 7, success: 4, partial: 2, fail: 1 })), '끝낸 역할극 7번(목표 달성 4)')
})

test('작은 추이선 — 8주 이상 · 단계가 보이는 축 · 점 4개 이상일 때만', () => {
  const s = skill('VOCAB_RECALL', { enough: true, stage: 2, spark: [0.7, 0.72, 0.74, 0.8] })
  assert.equal(showSpark(8, s), true)
  assert.equal(showSpark(12, s), true)
  assert.equal(showSpark(4, s), false, '4주')
  assert.equal(showSpark(8, { ...s, spark: [0.7, 0.72, 0.74] }), false, '점 3개')
  assert.equal(showSpark(8, { ...s, enough: false, stage: null }), false, '단계 전')
  assert.equal(showSpark(8, { ...s, recorded: false }), false, '기록 전')
})

test('AI 평가 고르기 — 종류 회화 → 단어 순, 고른 종류 유지/없으면 첫째, 마지막 = 최근, 2개 이상이면 첫째 = 이 기간 처음', () => {
  const evs = richFixture().evaluations
  const a = evalPick(evs, null)
  assert.deepEqual(a.kinds, ['TALK', 'WORDS'])
  assert.equal(a.kind, 'TALK')
  assert.equal(a.list.length, 4)
  assert.equal(a.last?.date, '2026-10-17')
  assert.equal(a.first?.date, '2026-08-10')
  const b = evalPick(evs, 'WORDS')
  assert.equal(b.kind, 'WORDS')
  assert.equal(b.last?.totalScore, 76)
  const wordsOnly = evs.filter((e) => e.kind === 'WORDS')
  assert.equal(evalPick(wordsOnly, 'TALK').kind, 'WORDS', '고른 종류가 새 기간에 없으면 첫째')
  const one = evalPick([evaluation('2026-10-06', 'TALK', 62, 'FAIR', [3, 3, 2, 3, 4])], null)
  assert.equal(one.first, null, '한 번이면 «처음» 없음')
  assert.equal(evalPick([], null).kind, null)
})

test('AI 평가 숨김 글·12주 둘째 줄', () => {
  const a = evalPick(richFixture().evaluations, null)
  assert.equal(
    evalSrOf('TALK', a.last!, a.first),
    '회화 평가 최근 10월 17일 82점: 정확성 4점, 어휘 4점, 문법 3점, 자연스러움 4점, 조각 조립 5점. 이 기간 처음 8월 10일 58점: 정확성 3점, 어휘 3점, 문법 2점, 자연스러움 2점, 조각 조립 3점. 5점 만점.',
  )
  const one = evaluation('2026-10-06', 'TALK', 62, 'FAIR', [3, 3, 2, 3, 4])
  assert.equal(evalSrOf('TALK', one, null), '회화 평가 최근 10월 6일 62점: 정확성 3점, 어휘 3점, 문법 2점, 자연스러움 3점, 조각 조립 4점. 5점 만점.')
  assert.equal(showEvalNoneBody(4), true)
  assert.equal(showEvalNoneBody(8), true)
  assert.equal(showEvalNoneBody(12), false, '12주(최대)면 «기간을 늘리면…» 은 거짓 안내')
})

test('줄 모양 순서(36-4) — 기록 전 → 표본 부족 → 한쪽 증거 → 단계 → 그 밖(서버 어긋남) 표본 부족', () => {
  const g = (o: Parameters<typeof skill>[1]) => rowShapeOf(skill('GRAMMAR_PARTICLE', o))
  assert.equal(rowShapeOf(skill('LISTEN_RESPOND', { enough: true, oneSided: true, stage: 2 })), 'none', '기록 전이 맨 먼저')
  assert.equal(g({ n: 3, enough: false, oneSided: true }), 'wait', '표본 부족이 한쪽 증거보다 먼저(진행선 유지)')
  assert.equal(g({ n: 119, obsDays: 3, enough: true, oneSided: true, stage: null }), 'oneSided')
  assert.equal(g({ n: 119, enough: true, oneSided: true, stage: 1 }), 'oneSided', '한쪽 증거가 단계보다 먼저')
  assert.equal(g({ n: 48, enough: true, oneSided: false, stage: 1 }), 'stage')
  assert.equal(g({ n: 48, enough: true, oneSided: false, stage: 0 }), 'stage', '0 단계도 단계 줄')
  assert.equal(g({ n: 48, enough: true, oneSided: false, stage: null }), 'wait', '서버 어긋남은 표본 부족 줄')
  assert.equal(g({ n: 5, enough: false, stage: 2 }), 'wait', 'enough 가 아니면 stage 값이 있어도 표본 부족')
})

test('적음 안내 센 기준 = 단계가 보이는 축(L12·36-6 E) — 한쪽 증거 축은 enough 여도 세지 않는다', () => {
  const one = oneSidedFixture()
  assert.deepEqual(fewNoteOf(one), ['기록 13일째예요. 능력 단계는 기록이 모이는 대로 하나씩 보여요', ' — 지금은 ', { b: '어휘 회상' }, '이 먼저 보이기 시작했어요.'])
  const onlyOneSided = { ...one, skills: one.skills.map((s) => (s.axis === 'VOCAB_RECALL' ? { ...s, enough: false, stage: null } : s)) }
  assert.deepEqual(fewNoteOf(onlyOneSided), ['기록 13일째예요. 능력 단계는 기록이 모이는 대로 하나씩 보여요.'], '보이는 축 0개 — 한쪽 증거 축 이름을 끝 절에 쓰지 않는다')
  const twoStages = { ...one, skills: one.skills.map((s) => (s.axis === 'SENTENCE_PRODUCTION' ? { ...s, enough: true, stage: 0 as const } : s)) }
  assert.equal(fewNoteOf(twoStages), null, '단계 줄이 둘이면 안내 없음')
})

test('고른 주(36-6 D·감사 L1) — 기간을 바꾸면 이번 주, 4→8→4·4→8→12→4 왕복도 이번 주, 기간 밖·음수는 이번 주', () => {
  const k4 = weekKeyOf(fewFixture(4).weeks)
  const k8 = weekKeyOf(fewFixture(8).weeks)
  const k12 = weekKeyOf(richFixture(12).weeks)
  assert.deepEqual([k4, k8, k12], ['4|2026-09-27', '8|2026-08-30', '12|2026-08-02'])
  let p = { key: k4, j: null as number | null }
  assert.equal(selectedWeekOf(p, 4), 3, '기본 = 이번 주')
  p = { key: k4, j: 2 }
  assert.equal(syncWeekPick(p, k4), p, '같은 기간이면 그대로(같은 객체)')
  assert.equal(selectedWeekOf(p, 4), 2)
  p = syncWeekPick(p, k8)
  assert.equal(selectedWeekOf(p, 8), 7, '4 → 8')
  p = syncWeekPick(p, k4)
  assert.equal(selectedWeekOf(p, 4), 3, '4 → 8 → 4 왕복도 이번 주(지난 주를 되살리지 않음)')
  p = syncWeekPick({ key: k4, j: 1 }, k8)
  p = syncWeekPick({ ...p, j: 5 }, k12)
  p = syncWeekPick(p, k4)
  assert.equal(selectedWeekOf(p, 4), 3, '4 → 8 → 12 → 4')
  assert.equal(selectedWeekOf({ key: k4, j: -1 }, 4), 3, '음수는 이번 주(weeks[-1] 방지)')
  assert.equal(selectedWeekOf({ key: k4, j: 4 }, 4), 3)
})

test('‹ › 한 칸 이동 — 끝 칸에서는 null(아무 일 없음)', () => {
  assert.equal(stepWeek(0, -1, 4), null)
  assert.equal(stepWeek(3, 1, 4), null)
  assert.equal(stepWeek(1, -1, 4), 0)
  assert.equal(stepWeek(2, 1, 4), 3)
  assert.equal(stepWeek(0, 1, 1), null)
})
