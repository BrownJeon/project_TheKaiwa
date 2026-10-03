import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { NextReviewDetail, ReviewItem } from '@/types/review'
import { LESSON } from '../../lessonCopy'
import { LessonHeader } from '../../parts'
import NextReviewCard from '../NextReviewCard'
import { RV_END, RV_GEN, RV_LESSON } from '../reviewCopy'
import ReviewGenItems from '../ReviewGenItems'
import ReviewItemsCard from '../ReviewItemsCard'
import { initialNextReviewPhase, nextReviewState } from '../useNextReview'

const BANNED = /claude|haiku|sonnet|opus|qwen|reazon|whisper|style-bert|sherpa|zipformer|onnx|엔진|모델|TUTOR|FALLBACK|REVIEW_DECISION|REVIEW_GEN|TopicChunk|WordEntry|Correction|ri_|Phase|task-/

const item = (o: Partial<ReviewItem> & { id: string; textJa: string }): ReviewItem => ({
  itemType: 'EXPRESSION',
  refType: 'TopicChunk',
  source: 'LESSON',
  meaningKo: null,
  priority: 'NORMAL',
  studiedCount: 1,
  wrongCount: 0,
  feedbackCount: 0,
  ...o,
})

const ITEMS: ReviewItem[] = [
  item({ id: 'ri_1', textJa: 'すみません', meaningKo: '실례합니다' }),
  item({ id: 'ri_2', textJa: 'お願いします', priority: 'FOCUS', wrongCount: 2, studiedCount: 3 }),
  item({ id: 'ri_3', textJa: '〜てもいいですか', itemType: 'GRAMMAR', refType: 'Correction', priority: 'FOCUS', feedbackCount: 1, studiedCount: 0 }),
  item({ id: 'ri_4', textJa: 'レシート', itemType: 'WORD', refType: 'WordEntry' }),
  item({ id: 'ri_5', textJa: '持ち帰り', refType: 'Unknown' }),
]

const TUTOR: NextReviewDetail = {
  decidedBy: 'TUTOR',
  rationaleKo: '「お願いします」를 두 번 틀려서 3일 뒤에 다시 봐요.',
  groups: [
    { days: 5, date: '2026-10-08', itemIds: ['ri_1', 'ri_4'] },
    { days: 3, date: '2026-10-06', itemIds: ['ri_2', 'ri_3', 'ri_gone'] },
  ],
}

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

test('다음 복습 상태 — 시작 단계·표시 상태', () => {
  assert.equal(initialNextReviewPhase(TUTOR, null), 'settled')
  assert.equal(initialNextReviewPhase(null, { jobId: 'j1', nextReview: null }), 'pending')
  assert.equal(initialNextReviewPhase(null, { jobId: null, nextReview: null }), 'settled')
  assert.equal(initialNextReviewPhase(null, null), 'pending')
  assert.equal(nextReviewState(TUTOR, 'pending'), 'ready')
  assert.equal(nextReviewState(null, 'pending'), 'pending')
  assert.equal(nextReviewState(null, 'settled'), 'unknown')
})

test('NextReviewCard — 대기·선생님 판단·지난 간격·모름', () => {
  const pending = renderToStaticMarkup(createElement(NextReviewCard, { state: 'pending', next: null, items: ITEMS, teacherName: '선생님' }))
  assert.ok(pending.includes(RV_END.pendingTitle) && pending.includes('role="status"'))

  const ready = renderToStaticMarkup(createElement(NextReviewCard, { state: 'ready', next: TUTOR, items: ITEMS, teacherName: '하나' }))
  const t = text(ready)
  assert.ok(t.includes(RV_END.tutorTitle(3)), '가장 가까운 묶음 days')
  assert.ok(t.includes('10월 6일(화)부터, 항목마다 3~7일 간격이에요.'))
  assert.ok(t.indexOf('3일 뒤') < t.indexOf('5일 뒤'), '묶음 오름차순')
  assert.ok(t.includes('10월 6일(화) · 3개'), '개수는 서버 itemIds 그대로')
  assert.equal((ready.match(/집중/g) ?? []).length, 2, 'FOCUS 2개만 뱃지')
  assert.ok(ready.includes('lang="ja"'))
  assert.ok(t.includes('두 번 틀려서'), '근거 문장은 텍스트로')
  assert.doesNotMatch(ready, BANNED)

  const one = text(renderToStaticMarkup(createElement(NextReviewCard, { state: 'ready', next: { ...TUTOR, groups: [TUTOR.groups[1]] }, items: ITEMS, teacherName: '선생님' })))
  assert.ok(one.includes(RV_END.tutorOneBody('10월 6일(화)')))

  const fb = renderToStaticMarkup(createElement(NextReviewCard, { state: 'ready', next: { ...TUTOR, decidedBy: 'FALLBACK', rationaleKo: '' }, items: ITEMS, teacherName: '선생님' }))
  const ft = text(fb)
  assert.ok(ft.includes(RV_END.fallbackTitle(3)) && ft.includes(RV_END.fallbackNote))
  assert.ok(!ft.includes('5일 뒤') && !ft.includes('자세히'), '묶음·근거 없음')
  assert.doesNotMatch(fb, BANNED)

  for (const v of [
    { state: 'unknown' as const, next: null },
    { state: 'ready' as const, next: { ...TUTOR, groups: [] } },
  ]) {
    const u = text(renderToStaticMarkup(createElement(NextReviewCard, { ...v, items: ITEMS, teacherName: '선생님' })))
    assert.ok(u.includes(RV_END.unknown))
  }
})

test('ReviewItemsCard — 정렬·라벨·처음 복습·출처 3종·원값 없음', () => {
  const html = renderToStaticMarkup(createElement(ReviewItemsCard, { lessonId: 'L1', items: ITEMS }))
  const t = text(html)
  assert.ok(t.includes(RV_LESSON.itemsTitle(5)) && t.includes(RV_LESSON.itemsFocus(2).trim()))
  assert.ok(html.includes('aria-expanded="true"') && html.includes('aria-controls='))
  assert.ok(t.indexOf('〜てもいいですか') < t.indexOf('すみません') && t.indexOf('お願いします') < t.indexOf('すみません'))
  assert.ok(t.includes('교정 1번') && t.includes('틀림 2번') && t.includes('틀린 적 없음'))
  assert.ok(t.includes(RV_LESSON.firstReview) && t.includes('공부 3번'))
  assert.ok(t.includes('회화 교정에서') && t.includes('단어 세트에서') && t.includes('수업에서'))
  assert.ok(t.includes('표현') && t.includes('문형') && t.includes('단어'))
  assert.ok(t.includes('실례합니다'))
  assert.ok(!t.includes('Unknown'), '모르는 출처는 뺀다')
  assert.ok(t.includes(RV_LESSON.focusNote.trim()))
  assert.doesNotMatch(html, BANNED)

  const noFocus = text(renderToStaticMarkup(createElement(ReviewItemsCard, { lessonId: 'L1', items: ITEMS.filter((x) => x.priority !== 'FOCUS') })))
  assert.ok(!noFocus.includes('집중'))
})

test('ReviewGenItems — 항목 칩 전부·집중 sr', () => {
  const many = Array.from({ length: 10 }, (_, i) => item({ id: `ri_${i}`, textJa: `表現${i}`, priority: i === 9 ? 'FOCUS' : 'NORMAL' }))
  const html = renderToStaticMarkup(createElement(ReviewGenItems, { items: many }))
  assert.ok(text(html).includes(RV_GEN.itemsTitle(10)))
  assert.equal((html.match(/<li /g) ?? []).length, 10, '7개 제한 없음')
  assert.ok(text(html).indexOf('表現9') < text(html).indexOf('表現0'), '집중 먼저')
  assert.doesNotMatch(html, BANNED)
})

test('LessonHeader — 복습 뱃지는 review 일 때만, NEW 는 지금과 같다', () => {
  const props = { teacherName: '선생님', topic: '카페 주문', title: 'カフェで', onAnnounce: () => {} }
  const plain = renderToStaticMarkup(createElement(LessonHeader, props))
  assert.ok(plain.includes(LESSON.srPrefix('카페 주문')))
  assert.ok(!plain.includes(RV_LESSON.badge + '<'))
  const rv = renderToStaticMarkup(createElement(LessonHeader, { ...props, review: true }))
  assert.ok(rv.includes(`>${RV_LESSON.badge}<`) && rv.includes(RV_LESSON.headerSr))
  assert.ok(!rv.includes(LESSON.srPrefix('카페 주문')))
})
