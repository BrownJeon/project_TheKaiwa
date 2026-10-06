/**
 * task-041 — 챌린지 지표(순수 `metrics.ts`) = 설계서 `docs/design/challenge.md` §6-4 **확인 표 1~14** 를 그대로 픽스처로.
 * 기호: ✓ MET · ◐ PARTIAL · ✕ MISSED · 오 TODAY · · UPCOMING · 그 STOPPED. 기준 챌린지 = §1-3 "카페 주문 7일"(10/03~10/09,
 * 수업 1 + 단어 목표 10장 → 인정 8장). 픽스처 시각은 `now ≥ 마지막 스냅샷 createdAt + 1ms`(진행 중 closeAt = now, 비교가 createdAt < closeAt — Info ③).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CHALLENGE_RULE_VERSION, closeAtOf, computeChallengeMetrics, freezeChallengeResult, freezeDailyGoal, readChallengeResult, readChallengeSnaps, readDailyGoal,
  wordsMinAnsweredOf, type ChallengeSnaps, type LessonSnap, type MetricChallenge, type VocabSnap,
} from '../challenges/metrics'
import { kst } from './challengeFakeDb'

const T = 'topic-cafe'
let n = 0
const L = (date: string, at: string, quizCorrect = 4, extra: Partial<LessonSnap> = {}): LessonSnap => {
  n++
  return { id: `sl${String(n).padStart(4, '0')}`, refId: `lesson${n}`, createdAt: kst(at), kind: 'NEW', topicId: T, date, quizCorrect, quizTotal: 5, ...extra }
}
const V = (date: string, at: string, c: number, w: number, s: number, extra: Partial<VocabSnap> = {}): VocabSnap => {
  n++
  return { id: `sv${String(n).padStart(4, '0')}`, refId: `session${n}`, createdAt: kst(at), topicId: T, date, correct: c, wrong: w, skipped: s, cardCount: c + w + s, ...extra }
}
const snaps = (...xs: (LessonSnap | VocabSnap)[]): ChallengeSnaps => ({
  lessons: xs.filter((x): x is LessonSnap => 'quizTotal' in x),
  vocab: xs.filter((x): x is VocabSnap => 'skipped' in x),
})
const GOAL_BOTH = freezeDailyGoal({ lesson: true, words: true, wordCount: 10 })
const GOAL_WORDS = freezeDailyGoal({ lesson: false, words: true, wordCount: 10 })
const cafe = (over: Partial<MetricChallenge> = {}): MetricChallenge => ({ status: 'ACTIVE', startDate: '2026-10-03', endDate: '2026-10-09', endedAt: null, topicId: T, dailyGoal: GOAL_BOTH, ...over })

const SYM: Record<string, string> = { MET: '✓', PARTIAL: '◐', MISSED: '✕', TODAY: '오', UPCOMING: '·', STOPPED: '그' }
const strip = (m: { days: { state: string }[] }) => m.days.map((d) => SYM[d.state]).join('')
const head = (m: ReturnType<typeof computeChallengeMetrics>) => [m.elapsedDays, m.metDays, m.rate]
const runs = (m: ReturnType<typeof computeChallengeMetrics>) => [m.streak, m.longestStreak]

/** §1-3 기준 3일(10/03 ✓ 문제 4/5 + 7·2·1 · 10/04 ✓ 5/5 + 8·2·0 · 10/05 ◐ 6·3·1, 수업 없음). */
function base(): (LessonSnap | VocabSnap)[] {
  return [
    V('2026-10-03', '2026-10-03 19:00', 7, 2, 1), L('2026-10-03', '2026-10-03 20:00', 4),
    V('2026-10-04', '2026-10-04 19:00', 8, 2, 0), L('2026-10-04', '2026-10-04 20:00', 5),
    V('2026-10-05', '2026-10-05 19:00', 6, 3, 1),
  ]
}

test('wordsMinAnswered = ceil(4n/5) — n=1..30 전수, 5·10·15 → 4·8·12', () => {
  for (let i = 1; i <= 30; i++) assert.equal(wordsMinAnsweredOf(i), Math.ceil((4 * i) / 5), `n=${i}`)
  assert.deepEqual([5, 10, 15].map(wordsMinAnsweredOf), [4, 8, 12])
  assert.deepEqual(freezeDailyGoal({ lesson: true, words: false, wordCount: 10 }), { lesson: true, words: false, wordCount: null, wordsMinAnswered: null, countSkipped: false, ruleVersion: CHALLENGE_RULE_VERSION })
})

test('확인 표 1 — 진행 중 오늘 아침: ✓✓◐오··· · 3·2·0.67 · 연속 0·최장 2 · 누적 2·3·21', () => {
  const m = computeChallengeMetrics(cafe(), snaps(...base()), '2026-10-06', kst('2026-10-06 09:00'))
  assert.equal(strip(m), '✓✓◐오···')
  assert.deepEqual(head(m), [3, 2, 0.67])
  assert.deepEqual(runs(m), [0, 2])
  assert.deepEqual(m.totals, { lessonsDone: 2, wordSets: 3, wordsCorrect: 21 })
  assert.equal(m.dayIndex, 4)
  assert.equal(m.todayMet, false)
  // 점수 추이 = 그날 인정 수업의 문제 n/5, 단어 = 그날 합계
  assert.deepEqual([m.days[0].lesson?.quizCorrect, m.days[1].lesson?.quizCorrect, m.days[2].lesson], [4, 5, null])
  assert.deepEqual(m.days[2].words && { a: m.days[2].words.answered, need: m.days[2].words.need, ok: m.days[2].words.ok, sets: m.days[2].words.sets }, { a: 9, need: 8, ok: true, sets: 1 })
})

test('확인 표 2 — 1 + 오늘 세트(8·2)·수업: ✓✓◐✓··· · 4·3·0.75 · 연속 1·최장 2 · 누적 3·4·29', () => {
  const m = computeChallengeMetrics(cafe(), snaps(...base(), V('2026-10-06', '2026-10-06 10:00', 8, 2, 0), L('2026-10-06', '2026-10-06 11:00', 3)), '2026-10-06', kst('2026-10-06 11:01'))
  assert.equal(strip(m), '✓✓◐✓···')
  assert.deepEqual(head(m), [4, 3, 0.75])
  assert.deepEqual(runs(m), [1, 2])
  assert.deepEqual(m.totals, { lessonsDone: 3, wordSets: 4, wordsCorrect: 29 })
  assert.equal(m.todayMet, true)
})

test('확인 표 3 — 오늘 유예(U8 = A): 오늘(미달)은 분모에 넣지 않는다 — 옵션 B 의 0.5 가 아니다', () => {
  const m = computeChallengeMetrics(cafe(), snaps(...base()), '2026-10-06', kst('2026-10-06 09:00'))
  assert.equal(m.elapsedDays, 3)
  assert.notEqual(m.rate, 0.5)
})

test('확인 표 4 — 1·2일째 달성, 3일째 아침: ✓✓오···· · 2·2·1.0 · 연속 2', () => {
  const m = computeChallengeMetrics(cafe(), snaps(...base().slice(0, 4)), '2026-10-05', kst('2026-10-05 08:00'))
  assert.equal(strip(m), '✓✓오····')
  assert.deepEqual(head(m), [2, 2, 1])
  assert.deepEqual(runs(m), [2, 2])
})

function sixDays(): (LessonSnap | VocabSnap)[] {
  const out = base()
  for (const d of ['2026-10-06', '2026-10-07', '2026-10-08']) out.push(V(d, `${d} 10:00`, 8, 2, 0), L(d, `${d} 11:00`, 4))
  return out
}

test('확인 표 5 — 마지막 날도 오늘 유예: 아침 ✓✓◐✓✓✓오 6·5·0.83(3·3) / 밤 ✓✓◐✓✓✓✓ 7·6·0.86(4·4)', () => {
  const morning = computeChallengeMetrics(cafe(), snaps(...sixDays()), '2026-10-09', kst('2026-10-09 08:00'))
  assert.equal(strip(morning), '✓✓◐✓✓✓오')
  assert.deepEqual(head(morning), [6, 5, 0.83])
  assert.deepEqual(runs(morning), [3, 3])
  const night = computeChallengeMetrics(cafe(), snaps(...sixDays(), V('2026-10-09', '2026-10-09 21:00', 9, 1, 0), L('2026-10-09', '2026-10-09 22:00', 5)), '2026-10-09', kst('2026-10-09 22:01'))
  assert.equal(strip(night), '✓✓◐✓✓✓✓')
  assert.deepEqual(head(night), [7, 6, 0.86])
  assert.deepEqual(runs(night), [4, 4])
})

test('확인 표 6 — 마지막 날 23:50 시작·다음 날 00:10 끝낸 세트는 마감 뒤라 제외 · 전이 직전 ACTIVE = COMPLETED', () => {
  const s = snaps(...sixDays(), L('2026-10-09', '2026-10-09 20:00', 4), V('2026-10-09', '2026-10-10 00:10', 8, 2, 0))
  const active = computeChallengeMetrics(cafe(), s, '2026-10-10', kst('2026-10-10 09:00'))
  const endedAt = kst('2026-10-10 00:00')
  const completed = computeChallengeMetrics(cafe({ status: 'COMPLETED', endedAt }), s, '2026-10-10', kst('2026-10-15 12:00'))
  for (const m of [active, completed]) {
    assert.equal(strip(m), '✓✓◐✓✓✓◐')
    assert.deepEqual(head(m), [7, 5, 0.71])
    assert.deepEqual(runs(m), [null, 3])
  }
  assert.equal(closeAtOf(cafe(), '2026-10-10', kst('2026-10-10 09:00')).getTime(), endedAt.getTime())
  assert.deepEqual(freezeChallengeResult(active, GOAL_BOTH, null), freezeChallengeResult(completed, GOAL_BOTH, null))
})

test('확인 표 7 — 자기소개 COMPLETED ✓✓✓◐✓✓✕ · 7·5·0.71 · 최장 3 (전이 직전 ACTIVE 와 같음)', () => {
  const intro = (over: Partial<MetricChallenge> = {}) => cafe({ startDate: '2026-09-20', endDate: '2026-09-26', ...over })
  const xs: (LessonSnap | VocabSnap)[] = []
  for (const d of ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-24', '2026-09-25']) xs.push(V(d, `${d} 10:00`, 8, 2, 0), L(d, `${d} 11:00`, 4))
  xs.push(L('2026-09-23', '2026-09-23 11:00', 3))
  const s = snaps(...xs)
  const completed = computeChallengeMetrics(intro({ status: 'COMPLETED', endedAt: kst('2026-09-27 00:00') }), s, '2026-09-27', kst('2026-10-06 09:00'))
  const active = computeChallengeMetrics(intro(), s, '2026-10-06', kst('2026-10-06 09:00'))
  for (const m of [completed, active]) {
    assert.equal(strip(m), '✓✓✓◐✓✓✕')
    assert.deepEqual(head(m), [7, 5, 0.71])
    assert.deepEqual(runs(m), [null, 3])
  }
  assert.equal(completed.dayIndex, 7)
})

/** 길 묻기 14일(09/05~09/18) — ✓ ✓ ✕ ✓ ◐ 뒤 6일째(09/10) 15:00 에 그만둠. */
function road(extra: (LessonSnap | VocabSnap)[] = [], day6: (LessonSnap | VocabSnap)[] = [V('2026-09-10', '2026-09-10 10:00', 3, 1, 0)]) {
  const ch = cafe({ status: 'ENDED', startDate: '2026-09-05', endDate: '2026-09-18', endedAt: kst('2026-09-10 15:00') })
  const xs: (LessonSnap | VocabSnap)[] = []
  for (const d of ['2026-09-05', '2026-09-06', '2026-09-08']) xs.push(V(d, `${d} 10:00`, 8, 2, 0), L(d, `${d} 11:00`, 4))
  xs.push(L('2026-09-09', '2026-09-09 11:00', 2))
  return { ch, s: snaps(...xs, ...day6, ...extra) }
}

test('확인 표 8a·8b·8c — 길 묻기 ENDED: 그만둔 당일 계산 = 나중 계산, 뒤 날은 전부 그만둠(예정 0칸), 그만둔 뒤 공부는 세지 않음', () => {
  const { ch, s } = road()
  const sameDay = computeChallengeMetrics(ch, s, '2026-09-10', kst('2026-09-10 15:00'))
  assert.equal(strip(sameDay), '✓✓✕✓◐그그그그그그그그그')
  assert.deepEqual(head(sameDay), [5, 3, 0.6])
  assert.deepEqual(runs(sameDay), [null, 2])
  assert.equal(sameDay.days.filter((d) => d.state === 'UPCOMING').length, 0)
  const later = computeChallengeMetrics(ch, s, '2026-10-06', kst('2026-10-06 09:00'))
  assert.deepEqual(freezeChallengeResult(later, GOAL_BOTH, 'USER'), freezeChallengeResult(sameDay, GOAL_BOTH, 'USER'))
  const after = road([L('2026-09-10', '2026-09-10 20:00', 5), V('2026-09-10', '2026-09-10 21:00', 9, 1, 0)])
  const m8c = computeChallengeMetrics(after.ch, after.s, '2026-09-10', kst('2026-09-10 23:00'))
  assert.deepEqual(freezeChallengeResult(m8c, GOAL_BOTH, 'USER'), freezeChallengeResult(sameDay, GOAL_BOTH, 'USER'))
  assert.equal(sameDay.dayIndex, 6)
})

test('확인 표 8d — 6일째 오전에 둘 다 끝내고 15:00 그만둠: ✓✓✕✓◐✓그… · 6·4·0.67 · 최장 2', () => {
  const { ch, s } = road([], [V('2026-09-10', '2026-09-10 09:00', 8, 2, 0), L('2026-09-10', '2026-09-10 10:00', 4)])
  const m = computeChallengeMetrics(ch, s, '2026-09-10', kst('2026-09-10 15:00'))
  assert.equal(strip(m), '✓✓✕✓◐✓그그그그그그그그')
  assert.deepEqual(head(m), [6, 4, 0.67])
  assert.deepEqual(runs(m), [null, 2])
})

test('확인 표 9 — goalMetNow 는 완료 순서 기준: 4장(10:00) + 4장(10:30) → 첫째 거짓·둘째 참', () => {
  const lesson = L('2026-10-06', '2026-10-06 09:00', 4)
  const a = V('2026-10-06', '2026-10-06 10:00', 3, 1, 6)
  const b = V('2026-10-06', '2026-10-06 10:30', 3, 1, 4)
  const m = computeChallengeMetrics(cafe(), snaps(...base(), lesson, a, b), '2026-10-06', kst('2026-10-06 10:31'))
  const today = m.days[3]
  assert.equal(today.state, 'MET')
  assert.deepEqual(today.metBy, { kind: 'VOCAB_SESSION', refId: b.refId })
  assert.notDeepEqual(today.metBy, { kind: 'VOCAB_SESSION', refId: a.refId })
  assert.equal(today.goalMetAt?.getTime(), b.createdAt.getTime())
  // 단어만 챌린지에서도 같다(수업 없이 합산이 바꾼 세트)
  const w = computeChallengeMetrics(cafe({ dailyGoal: GOAL_WORDS }), snaps(a, b), '2026-10-06', kst('2026-10-06 10:31'))
  assert.equal(w.days[3].metBy?.refId, b.refId)
})

test('두 세트 날 — 20장 중 맞힘 6·틀림 2·건너뜀 12(푼 8장) + 수업 → ✓ · 75% · 누적 세트 5', () => {
  const m = computeChallengeMetrics(cafe(), snaps(...base(), V('2026-10-06', '2026-10-06 10:00', 3, 1, 6), V('2026-10-06', '2026-10-06 10:30', 3, 1, 6), L('2026-10-06', '2026-10-06 11:00', 4)), '2026-10-06', kst('2026-10-06 11:01'))
  const w = m.days[3].words!
  assert.deepEqual([w.sets, w.correct, w.wrong, w.skipped, w.cardCount, w.answered, w.ok], [2, 6, 2, 12, 20, 8, true])
  assert.equal(m.days[3].state, 'MET')
  assert.equal(m.rate, 0.75)
  assert.equal(m.totals.wordSets, 5)
})

test('확인 표 10 — 첫날 아침 / 내일 시작(ACTIVE) / 내일 시작인데 오늘 그만둠 → rate null', () => {
  const first = computeChallengeMetrics(cafe({ startDate: '2026-10-06', endDate: '2026-10-12' }), snaps(), '2026-10-06', kst('2026-10-06 08:00'))
  assert.equal(strip(first), '오······')
  assert.deepEqual([...head(first), first.streak], [0, 0, null, 0])
  const tomorrow = computeChallengeMetrics(cafe({ startDate: '2026-10-07', endDate: '2026-10-13' }), snaps(), '2026-10-06', kst('2026-10-06 08:00'))
  assert.equal(strip(tomorrow), '·······')
  assert.deepEqual([...head(tomorrow), tomorrow.streak, tomorrow.dayIndex], [0, 0, null, 0, 0])
  const quit = computeChallengeMetrics(cafe({ status: 'ENDED', startDate: '2026-10-07', endDate: '2026-10-13', endedAt: kst('2026-10-06 09:00') }), snaps(), '2026-10-06', kst('2026-10-06 09:00'))
  assert.equal(strip(quit), '그그그그그그그')
  assert.deepEqual([...head(quit), quit.streak, quit.dayIndex], [0, 0, null, null, 0])
})

test('확인 표 11a~11e — 단어 과제 = 목표 장수 기준 그날 합산(다시 풀기 포함·건너뜀 제외)', () => {
  const words = cafe({ dailyGoal: GOAL_WORDS })
  const today = (xs: VocabSnap[]) => computeChallengeMetrics(words, snaps(...xs), '2026-10-06', kst('2026-10-06 23:00')).days[3]
  const a = V('2026-10-06', '2026-10-06 10:00', 3, 1, 6)
  assert.equal(today([a]).state, 'TODAY') // 11a 10장 세트 4장 → 미달("4장 더")
  assert.deepEqual([today([a]).words?.answered, today([a]).words?.need], [4, 8])
  assert.equal(today([a, V('2026-10-06', '2026-10-06 10:30', 3, 1, 4)]).state, 'MET') // 11b + 8장 세트 4장 → 합산 인정
  assert.equal(today([V('2026-10-06', '2026-10-06 10:00', 3, 1, 1)]).state, 'TODAY') // 11c 5장 세트 4장(목표 10) → 미달
  assert.equal(today([V('2026-10-06', '2026-10-06 10:00', 4, 1, 0), V('2026-10-06', '2026-10-06 10:10', 4, 1, 0)]).state, 'MET') // 11d 5장 + 다시 풀기 5장
  assert.equal(today([V('2026-10-06', '2026-10-06 10:00', 5, 2, 3)]).state, 'TODAY') // 11e 맞힘 5·틀림 2·건너뜀 3 → 7
})

test('확인 표 12 — 소급 달성: 3일째 15:00 수업 + 23:50 시작·00:10 끝낸 세트(6·3·1, date=10/05) → 어제 ◐ → ✓, 연속 0 → 3, 맞힌 카드 21', () => {
  const pre = base().slice(0, 4)
  const lesson3 = L('2026-10-05', '2026-10-05 15:00', 4)
  const late = V('2026-10-05', '2026-10-06 00:10', 6, 3, 1)
  const a = computeChallengeMetrics(cafe(), snaps(...pre, lesson3), '2026-10-05', kst('2026-10-05 23:55'))
  assert.equal(strip(a), '✓✓오····')
  assert.deepEqual([...head(a), ...runs(a)], [2, 2, 1, 2, 2])
  const b = computeChallengeMetrics(cafe(), snaps(...pre, lesson3), '2026-10-06', kst('2026-10-06 00:05'))
  assert.equal(strip(b), '✓✓◐오···')
  assert.deepEqual([...head(b), ...runs(b)], [3, 2, 0.67, 0, 2])
  const c = computeChallengeMetrics(cafe(), snaps(...pre, lesson3, late), '2026-10-06', kst('2026-10-06 00:11'))
  assert.equal(strip(c), '✓✓✓오···')
  assert.deepEqual([...head(c), ...runs(c)], [3, 3, 1, 3, 3])
  assert.deepEqual(c.totals, { lessonsDone: 3, wordSets: 3, wordsCorrect: 21 })
  assert.deepEqual(c.days[2].metBy, { kind: 'VOCAB_SESSION', refId: late.refId })
})

test('확인 표 13 — 건너뛰기만 한 세트는 "한 것" 아님: ✓✓✕오··· · 누적 세트 2·맞힌 카드 15', () => {
  const xs = base()
  xs[4] = V('2026-10-05', '2026-10-05 19:00', 0, 0, 10)
  const m = computeChallengeMetrics(cafe(), snaps(...xs), '2026-10-06', kst('2026-10-06 09:00'))
  assert.equal(strip(m), '✓✓✕오···')
  assert.deepEqual([...head(m), ...runs(m)], [3, 2, 0.67, 0, 2])
  assert.deepEqual(m.totals, { lessonsDone: 2, wordSets: 2, wordsCorrect: 15 })
  assert.deepEqual([m.days[2].words?.sets, m.days[2].words?.answered, m.days[2].words?.skipped], [0, 0, 10])
})

test('확인 표 14 — topicId=null 챌린지는 붙여넣기 수업·내 단어장 세트를 세지 않는다: ✕✕✕오··· · 3·0·0', () => {
  const m = computeChallengeMetrics(cafe({ topicId: null }), snaps(L('2026-10-03', '2026-10-03 10:00', 5, { topicId: null }), V('2026-10-03', '2026-10-03 11:00', 9, 1, 0, { topicId: null })), '2026-10-06', kst('2026-10-06 09:00'))
  assert.equal(strip(m), '✕✕✕오···')
  assert.deepEqual([...head(m), ...runs(m)], [3, 0, 0, 0, 0])
})

test('세지 않는 것 — 복습 수업·다른 주제·기간 밖 스냅샷 · 수업 = 끝낸 날 / 세트 = 시작한 날(자정 경계 23:59·00:01)', () => {
  const xs = [
    L('2026-10-03', '2026-10-03 10:00', 5, { kind: 'REVIEW' }),
    V('2026-10-03', '2026-10-03 11:00', 9, 1, 0, { topicId: 'other' }),
    L('2026-10-02', '2026-10-02 23:59', 5), // 시작 전날
    V('2026-10-03', '2026-10-03 23:59', 8, 2, 0), // 10/03 시작·끝
    L('2026-10-04', '2026-10-04 00:01', 4), // 10/03 밤에 하다 10/04 00:01 에 끝낸 수업 = 10/04
  ]
  const m = computeChallengeMetrics(cafe(), snaps(...xs), '2026-10-04', kst('2026-10-04 09:00'))
  assert.equal(m.days[0].lesson, null)
  assert.equal(m.days[0].words?.answered, 10)
  assert.equal(m.days[0].state, 'PARTIAL')
  assert.equal(m.days[1].lesson?.done, 1)
  assert.equal(m.totals.lessonsDone, 1)
})

test('하루 목표·규칙 버전은 만들 때 얼린 값으로 계산한다 — 코드 기본값이 바뀌어도 진행 중 수치 불변', () => {
  const frozen = { ...GOAL_BOTH, wordsMinAnswered: 9 } // 옛 규칙으로 만든 챌린지라고 가정
  const xs = [V('2026-10-03', '2026-10-03 10:00', 6, 2, 2), L('2026-10-03', '2026-10-03 11:00', 4)]
  const m = computeChallengeMetrics(cafe({ dailyGoal: frozen }), snaps(...xs), '2026-10-04', kst('2026-10-04 09:00'))
  assert.equal(m.days[0].state, 'PARTIAL') // 합계 8 < 얼린 9
  assert.equal(computeChallengeMetrics(cafe(), snaps(...xs), '2026-10-04', kst('2026-10-04 09:00')).days[0].state, 'MET')
  assert.equal(readDailyGoal({ ...frozen })?.wordsMinAnswered, 9)
})

test('방어 파싱 — 스냅샷 data 형태가 어긋나면 0 · dailyGoal/result 형태 이상은 null', () => {
  const s = readChallengeSnaps([
    { id: 'a', kind: 'VOCAB_SESSION', periodKey: 'vs1', data: { correct: 'x', wrong: -1, skipped: 2.7, topicId: T }, createdAt: kst('2026-10-03 10:00') },
    { id: 'b', kind: 'LESSON', periodKey: 'ls1', data: null, createdAt: kst('2026-10-03 23:30') },
    { id: 'c', kind: 'DAILY', periodKey: '2026-10-03', data: {}, createdAt: kst('2026-10-03 23:30') },
  ])
  assert.deepEqual([s.vocab[0].correct, s.vocab[0].wrong, s.vocab[0].skipped, s.vocab[0].date], [0, 0, 2, '2026-10-03'])
  assert.deepEqual([s.lessons[0].topicId, s.lessons[0].kind, s.lessons[0].date], [null, '', '2026-10-03'])
  assert.equal(s.lessons.length + s.vocab.length, 2)
  assert.equal(readDailyGoal({ lesson: false, words: false, ruleVersion: 1 }), null)
  assert.equal(readDailyGoal({ lesson: true, words: true, wordCount: 10, ruleVersion: 1 }), null)
  assert.equal(readDailyGoal('x'), null)
  assert.equal(readChallengeResult({ days: [] }), null)
  const m = computeChallengeMetrics(cafe(), snaps(...base()), '2026-10-06', kst('2026-10-06 09:00'))
  const r = freezeChallengeResult(m, GOAL_BOTH, null)
  assert.deepEqual(readChallengeResult(JSON.parse(JSON.stringify(r))), r)
  assert.equal(r.days.length, 7)
  assert.deepEqual(r.days[0], { date: '2026-10-03', state: 'MET', quiz: [4, 5], words: [7, 2, 1, 10, 1] })
})
