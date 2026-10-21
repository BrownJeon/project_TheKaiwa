import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TodayLessonItem, TodayLessons } from '@/types/lesson'
import type { ReviewItem, TodayReview } from '@/types/review'
import { deriveLessonCard, genPhase } from '../../logic'
import { ITEM_TYPE_LABEL, RV_END, RV_GEN, RV_HOME, RV_LESSON, RV_SOON } from '../reviewCopy'
import {
  countLabel,
  decidedAtLabel,
  deriveReviewCard,
  focusIdsOf,
  formatDue,
  groupsSorted,
  isTutorReview,
  itemTypeLabel,
  nextReviewLine,
  reviewGenPhase,
  reviewPlacement,
  skipFailureKind,
  sortReviewItems,
  sourceLabel,
  splitJaQuotes,
  startReviewErrorText,
  studiedLabel,
  watchesDecision,
  type ReviewCard,
  type SkipState,
} from '../reviewLogic'

const rv = (over: Partial<TodayReview> = {}): TodayReview => ({
  id: 'rs1',
  status: 'DUE',
  itemCount: 9,
  focusCount: 2,
  preview: [
    { textJa: 'お願いします', priority: 'FOCUS' },
    { textJa: '〜で', priority: 'NORMAL' },
  ],
  decidedBy: 'TUTOR',
  tutorRationale: '「お願いします」를 두 번 틀렸어요.',
  decidedAt: '2026-10-03T00:12:00.000Z',
  lessonId: null,
  lessonStatus: null,
  score: null,
  stageDone: null,
  jobId: null,
  ...over,
})
const lessonItem = (over: Partial<TodayLessonItem> = {}): TodayLessonItem => ({
  id: 'l1', kind: 'NEW', status: 'DONE', title: 'x', titleKo: null, stageDone: 5, topic: { id: 't1', title: '카페 주문' }, score: 80, jobId: null, speaking: null, ...over,
})
const day = (over: Partial<TodayLessons> = {}): TodayLessons => ({
  mode: 'NEW', date: '2026-10-03', todayLessons: [], resume: null, recommendation: null,
  review: null, guard: null, decisionPending: false, nextReview: null, ...over,
})
const IDLE: SkipState = { phase: 'idle', reviewId: null }
const kind = (c: ReviewCard) => c.kind

test('홈 복습 카드 16상태 — 표의 위 줄이 이기고 자리가 정해진다', () => {
  // 1·2 로딩·오류 → 그리지 않음
  assert.equal(kind(deriveReviewCard('loading', null)), 'loading')
  assert.equal(kind(deriveReviewCard('error', day({ review: rv() }))), 'error')
  assert.equal(reviewPlacement(deriveReviewCard('loading', null)), 'none')
  assert.equal(reviewPlacement(deriveReviewCard('error', null)), 'none')
  // 3 로컬 건너뜀(pending·sending)이 서버 DUE 를 이긴다 · 다른 일정 id 면 무시
  assert.equal(kind(deriveReviewCard('ready', day({ review: rv() }), { phase: 'pending', reviewId: 'rs1' })), 'skipped')
  assert.equal(kind(deriveReviewCard('ready', day({ review: rv() }), { phase: 'sending', reviewId: 'rs1' })), 'skipped')
  assert.equal(kind(deriveReviewCard('ready', day({ review: rv() }), { phase: 'sent', reviewId: 'rs1' })), 'skipped')
  assert.equal(kind(deriveReviewCard('ready', day({ review: rv({ status: 'SKIPPED' }) }), { phase: 'sent', reviewId: 'rs1' })), 'skippedServer')
  assert.equal(kind(deriveReviewCard('ready', day({ review: rv() }), { phase: 'pending', reviewId: 'other' })), 'due')
  assert.equal(kind(deriveReviewCard('ready', day({ review: rv() }), { phase: 'failed', reviewId: 'rs1' })), 'due')
  assert.equal(reviewPlacement(deriveReviewCard('ready', day({ review: rv() }), { phase: 'pending', reviewId: 'rs1' })), 'below')
  // 4 가드(insufficient) → 곧 열려요 · cycle/stale/모르는 값 → 숨김(16)
  const g = deriveReviewCard('ready', day({ guard: { reason: 'insufficient', studyDays: { have: 1, need: 2 }, items: { have: 0, need: 2 } } }))
  assert.equal(kind(g), 'guard')
  assert.equal(reviewPlacement(g), 'soon')
  for (const reason of ['cycle', 'stale', 'weird']) {
    const h = deriveReviewCard('ready', day({ guard: { reason } }))
    assert.equal(kind(h), 'hidden')
    assert.equal(reviewPlacement(h), 'none')
  }
  // 5 만드는 중(jobId 또는 레슨 GENERATING)
  const gen = deriveReviewCard('ready', day({ review: rv({ lessonId: 'L9', lessonStatus: 'GENERATING', jobId: 'j1' }) }))
  assert.deepEqual([gen.kind, gen.kind === 'gen' ? gen.jobId : null], ['gen', 'j1'])
  assert.equal(reviewPlacement(gen), 'above')
  // 6 만들기 실패 — review.lessonStatus 가 없으면 todayLessons 에서 찾는다(★⑧)
  assert.equal(kind(deriveReviewCard('ready', day({ review: rv({ lessonId: 'L9', lessonStatus: 'FAILED' }) }))), 'genfail')
  const viaList = day({ review: rv({ lessonId: 'L9', lessonStatus: undefined }), todayLessons: [lessonItem({ id: 'L9', kind: 'REVIEW', status: 'FAILED' })] })
  assert.equal(kind(deriveReviewCard('ready', viaList)), 'genfail')
  // 7 하던 복습(IN_PROGRESS · READY+진행 · 상태 모름) · 8 준비됨(READY && 0)
  const prog = deriveReviewCard('ready', day({ review: rv({ lessonId: 'L9', lessonStatus: 'IN_PROGRESS', stageDone: 2 }) }))
  assert.deepEqual(prog.kind === 'progress' ? [prog.lessonId, prog.stageDone] : null, ['L9', 2])
  assert.equal(kind(deriveReviewCard('ready', day({ review: rv({ lessonId: 'L9', lessonStatus: 'READY', stageDone: 1 }) }))), 'progress')
  assert.equal(kind(deriveReviewCard('ready', day({ review: rv({ lessonId: 'L9', lessonStatus: null, stageDone: null }) }))), 'progress')
  const ready = deriveReviewCard('ready', day({ review: rv({ lessonId: 'L9', lessonStatus: 'READY', stageDone: 0 }) }))
  assert.equal(kind(ready), 'ready')
  assert.equal(reviewPlacement(ready), 'above')
  // 9·10 복습 있음 — TUTOR(근거 있음) / FALLBACK(또는 근거 없음)
  assert.equal(kind(deriveReviewCard('ready', day({ review: rv() }))), 'due')
  assert.equal(kind(deriveReviewCard('ready', day({ review: rv({ decidedBy: 'FALLBACK' }) }))), 'dueFallback')
  assert.equal(kind(deriveReviewCard('ready', day({ review: rv({ tutorRationale: '  ' }) }))), 'dueFallback')
  assert.equal(reviewPlacement(deriveReviewCard('ready', day({ review: rv({ decidedBy: 'FALLBACK' }) }))), 'above')
  // 11·12 완료 / 완료+판단 대기 — 점수가 있든 없든 같은 카드(task-081: 점수 표시 없음)
  const next = { date: '2026-10-06', days: 3, itemCount: 5, decidedBy: 'TUTOR' as const }
  const done = deriveReviewCard('ready', day({ review: rv({ status: 'DONE', lessonId: 'L9', score: 80 }), nextReview: next }))
  assert.equal(done.kind === 'done' ? done.next?.days : null, 3)
  assert.ok(!('correct' in done), '점수는 카드에 싣지 않는다(task-081)')
  assert.equal(reviewPlacement(done), 'below')
  const doneNoScore = deriveReviewCard('ready', day({ review: rv({ status: 'DONE', lessonId: 'L9', score: undefined }), todayLessons: [lessonItem({ id: 'L9', kind: 'REVIEW', score: 60 })] }))
  assert.equal(kind(doneNoScore), 'done')
  const doneUnknown = deriveReviewCard('ready', day({ review: rv({ status: 'DONE', lessonId: 'L9', score: null }) }))
  assert.equal(kind(doneUnknown), 'done')
  const dp = deriveReviewCard('ready', day({ review: rv({ status: 'DONE' }), decisionPending: true }))
  assert.equal(kind(dp), 'donePending')
  assert.equal(watchesDecision(dp), true)
  // 13 서버 건너뜀 · EXPIRED → 숨김
  assert.equal(kind(deriveReviewCard('ready', day({ review: rv({ status: 'SKIPPED' }) }))), 'skippedServer')
  assert.equal(kind(deriveReviewCard('ready', day({ review: rv({ status: 'EXPIRED' }) }))), 'hidden')
  // 14 판단 대기 · 15 오늘은 없음 · 16 아무것도 없음
  const pend = deriveReviewCard('ready', day({ decisionPending: true, nextReview: next }))
  assert.equal(kind(pend), 'pending')
  assert.equal(watchesDecision(pend), true)
  assert.equal(reviewPlacement(pend), 'below')
  const rest = deriveReviewCard('ready', day({ nextReview: next }))
  assert.equal(kind(rest), 'rest')
  assert.equal(reviewPlacement(rest), 'below')
  assert.equal(watchesDecision(rest), false)
  assert.equal(kind(deriveReviewCard('ready', day())), 'hidden')
  // 옛 응답(복습 칸 없음) · 복습 계산 실패 degrade → 숨김, 오류 문구 없음
  const old: TodayLessons = { mode: 'NEW', date: '2026-10-03', todayLessons: [], resume: null, recommendation: null }
  assert.equal(kind(deriveReviewCard('ready', old, IDLE)), 'hidden')
})

test('오늘의 회화 카드는 새 수업(NEW)만 본다 — 복습 레슨이 만들어지는 중·하던 중·끝나도 자기 상태 그대로', () => {
  const base = { mode: 'BOTH' as const, date: '2026-10-03', resume: null, recommendation: null }
  assert.equal(deriveLessonCard('ready', { ...base, todayLessons: [lessonItem({ id: 'R1', kind: 'REVIEW', status: 'GENERATING', jobId: 'j' })] }).kind, 'start')
  assert.equal(deriveLessonCard('ready', { ...base, todayLessons: [lessonItem({ id: 'R1', kind: 'REVIEW', status: 'IN_PROGRESS', stageDone: 2 })] }).kind, 'start')
  assert.equal(deriveLessonCard('ready', { ...base, todayLessons: [lessonItem({ id: 'R1', kind: 'REVIEW', status: 'FAILED' }), lessonItem()] }).kind, 'done')
  const both = deriveLessonCard('ready', { ...base, todayLessons: [lessonItem({ id: 'R1', kind: 'REVIEW', status: 'GENERATING' }), lessonItem({ id: 'N1', status: 'IN_PROGRESS', stageDone: 3 })] })
  assert.deepEqual(both.kind === 'progress' ? [both.lessonId, both.stageDone] : null, ['N1', 3])
})

test('날짜·시각 표기 — 서버 날짜 그대로, 요일만 붙인다', () => {
  assert.equal(formatDue('2026-10-03'), '10월 3일(토)')
  assert.equal(formatDue('bad'), '')
  assert.equal(decidedAtLabel('2026-10-03T00:12:00.000Z', '2026-10-03'), '오늘 09:12')
  assert.equal(decidedAtLabel('2026-10-01T23:00:00.000Z', '2026-10-03'), '10월 2일')
  assert.equal(decidedAtLabel(null, '2026-10-03'), null)
  assert.equal(decidedAtLabel('nope', '2026-10-03'), null)
  // ⑦ — TUTOR 는 데모 v1 문구, FALLBACK 은 아래 줄, 값 없으면 중립
  assert.deepEqual(nextReviewLine({ date: '2026-10-06', days: 3, itemCount: 5, decidedBy: 'TUTOR' }), { text: '10월 6일(화) · 선생님이 3일 뒤로 정했어요', note: null })
  assert.deepEqual(nextReviewLine({ date: '2026-10-06', days: 3, itemCount: 5, decidedBy: 'FALLBACK' }), { text: '10월 6일(화) · 3일 뒤', note: '이번엔 지난 간격대로 정했어요' })
  assert.deepEqual(nextReviewLine({ date: '2026-10-06', days: 3, itemCount: 5 }), { text: '10월 6일(화) · 3일 뒤', note: null })
  assert.equal(RV_HOME.restBody(formatDue('2026-10-06'), 3, 5), '다음 복습 · 10월 6일(화), 3일 뒤 · 5개 항목')
})

test('근거 문장 「…」 조각 나누기 · TUTOR 판정', () => {
  assert.deepEqual(splitJaQuotes('「お願いします」를 두 번, 「〜で」도'), [
    { text: '「お願いします」', ja: true },
    { text: '를 두 번, ', ja: false },
    { text: '「〜で」', ja: true },
    { text: '도', ja: false },
  ])
  assert.deepEqual(splitJaQuotes('따옴표 없음'), [{ text: '따옴표 없음', ja: false }])
  assert.deepEqual(splitJaQuotes(''), [])
  assert.deepEqual(splitJaQuotes('「닫힘 없음'), [{ text: '「닫힘 없음', ja: false }])
  assert.equal(isTutorReview({ decidedBy: 'TUTOR', tutorRationale: 'x' }), true)
  assert.equal(isTutorReview({ decidedBy: 'TUTOR', tutorRationale: null }), false)
  assert.equal(isTutorReview({ decidedBy: 'FALLBACK', tutorRationale: 'x' }), false)
  assert.equal(RV_HOME.judgedBy('선생님'), '선생님 판단')
  assert.equal(RV_HOME.judgedBy('하나'), '하나 선생님 판단')
})

const item = (over: Partial<ReviewItem>): ReviewItem => ({
  id: 'x', itemType: 'EXPRESSION', refType: 'TopicChunk', textJa: 'あ', meaningKo: null, priority: 'NORMAL', studiedCount: 1, wrongCount: 0, feedbackCount: 0, ...over,
})

test('① 항목 정렬·라벨 — FOCUS → 교정+틀림 → 공부 적은 순 → 원래 순서, 원값은 라벨로만', () => {
  const list = [
    item({ id: 'a' }),
    item({ id: 'b', wrongCount: 2 }),
    item({ id: 'c', priority: 'FOCUS', feedbackCount: 1 }),
    item({ id: 'd', studiedCount: 0 }),
    item({ id: 'e', priority: 'FOCUS', wrongCount: 3 }),
    item({ id: 'f' }),
  ]
  assert.deepEqual(sortReviewItems(list).map((x) => x.id), ['e', 'c', 'b', 'd', 'a', 'f'])
  assert.deepEqual(list.map((x) => x.id), ['a', 'b', 'c', 'd', 'e', 'f'])
  assert.deepEqual(['EXPRESSION', 'CHUNK', 'GRAMMAR', 'WORD', 'SCENARIO', 'LESSON', 'X'].map(itemTypeLabel), ['표현', '표현', '문형', '단어', '상황', '수업', ''])
  assert.deepEqual(['TopicChunk', 'Expr', 'Grammar', 'Correction', 'WordEntry', 'Other'].map(sourceLabel), ['수업', '수업', '수업', '회화 교정', '단어 세트', null])
  assert.deepEqual(countLabel({ feedbackCount: 2, wrongCount: 5 }), { text: '교정 2번', bad: true })
  assert.deepEqual(countLabel({ feedbackCount: 0, wrongCount: 1 }), { text: '틀림 1번', bad: true })
  assert.deepEqual(countLabel({ feedbackCount: 0, wrongCount: 0 }), { text: '틀린 적 없음', bad: false })
  assert.equal(studiedLabel(0), '처음 복습해요')
  assert.equal(studiedLabel(3), '공부 3번')
  assert.deepEqual([...focusIdsOf(list)].sort(), ['c', 'e'])
  assert.equal(RV_LESSON.fromSource('회화 교정'), '회화 교정에서')
  assert.equal(Object.keys(ITEM_TYPE_LABEL).length, 6)
})

test('복습 수업 대기 문구 · 다음 복습 묶음 순서', () => {
  assert.equal(reviewGenPhase(3, null), RV_GEN.phaseItems)
  assert.equal(reviewGenPhase(20, 'WRITE'), RV_GEN.phaseMix)
  // 45초 뒤 문구는 오늘의 회화 `genPhase` 그대로(task-081 에서 문구가 바뀌는 쪽은 ④ 갈래 소유 — 여기선 위임만 고정).
  assert.equal(reviewGenPhase(50, null), genPhase(50, null))
  assert.equal(reviewGenPhase(10, 'SAVE'), '마지막으로 확인하고 있어요')
  assert.equal(reviewGenPhase(130, null), '조금 오래 걸리고 있어요. 조금만 더 기다려 주세요.')
  const groups = [
    { days: 7, date: '2026-10-10', itemIds: ['a'] },
    { days: 3, date: '2026-10-06', itemIds: ['b', 'c'] },
    { days: 5, date: '2026-10-08', itemIds: ['d'] },
  ]
  assert.deepEqual(groupsSorted(groups).map((g) => g.days), [3, 5, 7])
  assert.deepEqual(groups.map((g) => g.days), [7, 3, 5])
})

test('#63·#64 실패 분기 · 가드 막대 문구', () => {
  assert.equal(skipFailureKind({ status: 409 }), 'stale')
  assert.equal(skipFailureKind({ status: 404 }), 'stale')
  for (const status of [0, 429, 500, 503, -1]) assert.equal(skipFailureKind({ status }), 'failed')
  assert.deepEqual(startReviewErrorText({ status: 409 }), { text: RV_HOME.startChanged, reload: true })
  assert.deepEqual(startReviewErrorText({ status: 404 }), { text: RV_HOME.startChanged, reload: true })
  assert.deepEqual(startReviewErrorText({ status: 429 }), { text: '잠시 후 다시 눌러 주세요.', reload: false })
  assert.deepEqual(startReviewErrorText({ status: 0 }), { text: '연결하지 못했어요. 네트워크를 확인해 주세요.', reload: false })
  assert.deepEqual(startReviewErrorText({ status: 500 }), { text: '복습 수업을 만들지 못했어요. 다시 눌러 주세요.', reload: false })
  assert.equal(RV_SOON.meterNum(1, 2, '일', false), '1/2일')
  assert.equal(RV_SOON.meterNum(2, 2, '일', true), '✓ 2/2일')
  assert.equal(RV_SOON.meterAria('공부한 날', 1, 2, '일', false), '공부한 날, 2일 중 1일')
  assert.equal(RV_SOON.meterAria('복습할 재료', 2, 2, '개', true), '복습할 재료, 2개 중 2개, 채웠어요')
})

test('화면 문구에 엔진명·판단 주체 원값·잡 종류가 없다', () => {
  const banned = /claude|haiku|sonnet|opus|qwen|reazon|whisper|style-bert|sherpa|zipformer|onnx|엔진|모델|TUTOR|FALLBACK|REVIEW_DECISION|REVIEW_GEN|Phase|task-/i
  const strings: string[] = []
  const collect = (o: Record<string, unknown>) => {
    for (const v of Object.values(o)) {
      if (typeof v === 'string') strings.push(v)
      else if (typeof v === 'function') strings.push(String((v as (...a: unknown[]) => unknown)(1, 2, '일', true)))
    }
  }
  for (const o of [RV_HOME, RV_SOON, RV_GEN, RV_LESSON, RV_END]) collect(o as unknown as Record<string, unknown>)
  assert.ok(strings.length > 60)
  for (const s of strings) assert.ok(!banned.test(s), s)
})
