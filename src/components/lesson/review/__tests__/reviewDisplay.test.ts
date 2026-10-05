/**
 * task-033 서브태스크 C(복습) — 복습 화면 일본어 표시 층(screens §15-11-4).
 * 서버 렌더(표시 설정 로드 전 = 층 없음)에서도 지켜야 하는 구조(칩 말줄임 없음·본문 lang="ja"·min-h-8)와, 변환 규칙을 화면이 만들지 않는다는
 * 원칙(`kanaToHangul`·`pronLine` 호출 0), 분석 요청이 컴포넌트당 한 묶음(`useAnnotations` 1회)인지를 소스로 확인한다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { NextReviewDetail, ReviewItem } from '@/types/review'
import NextReviewCard from '../NextReviewCard'
import ReviewItemsCard from '../ReviewItemsCard'
import { ReviewChips } from '../TeacherWhy'

const LESSON_DIR = join(process.cwd(), 'src/components/lesson')
const src = (rel: string) => readFileSync(join(LESSON_DIR, rel), 'utf8')

/** `JaText` 는 `<span lang="ja" class=…><span>본문</span></span>` 로 그린다(루비 없을 때 조각 하나). */
const jaSpan = (text: string) => new RegExp(`<span lang="ja"[^>]*><span>${text}</span></span>`)

const item = (id: string, textJa: string, priority: ReviewItem['priority'] = 'NORMAL'): ReviewItem => ({
  id,
  itemType: 'EXPRESSION',
  refType: 'TopicChunk',
  textJa,
  meaningKo: '뜻',
  priority,
  studiedCount: 1,
  wrongCount: 0,
  feedbackCount: 0,
})

test('ReviewChips: 칩은 말줄임(truncate) 없이 줄바꿈하고 높이는 내용 맞춤(min-h-8), 본문은 lang="ja"', () => {
  const html = renderToStaticMarkup(createElement(ReviewChips, { chips: [{ textJa: '注文をお願いします', focus: true }, { textJa: 'すみません', focus: false }], more: 2 }))
  assert.ok(!/truncate/.test(html), '칩에 truncate 가 남아 있다')
  assert.equal((html.match(/min-h-8/g) ?? []).length, 2)
  assert.ok(jaSpan('注文をお願いします').test(html))
  assert.ok(jaSpan('すみません').test(html))
  // 표시 설정 로드 전 — 히라가나·한글 층은 아직 없다(루비·`[` `]` 없음).
  assert.ok(!/<ruby|lang="ko"/.test(html))
})

test('ReviewChips: 집중 점은 칩 가운데에 두고 "외 N개" 칩은 h-8 그대로', () => {
  const html = renderToStaticMarkup(createElement(ReviewChips, { chips: [{ textJa: 'すみません', focus: true }], more: 3 }))
  // 점은 `h-[7px] w-[7px]` 인라인 span 이라 flex 컨테이너(blockify) 안에 있어야 크기가 적용된다.
  assert.ok(html.includes('class="flex self-center"'))
  assert.ok(/<li class="inline-flex h-8 items-center[^"]*">외 3개<\/li>/.test(html))
})

test('ReviewItemsCard: 접힘 여부와 무관하게 목록이 DOM 에 있고 본문은 block 일본어 + 종류 뱃지 기본 여백 mt-[5px]', () => {
  const html = renderToStaticMarkup(createElement(ReviewItemsCard, { lessonId: 'L1', items: [item('a', '注文します'), item('b', 'すみません', 'FOCUS')] }))
  assert.ok(/<span lang="ja" class="block text-\[17px\] leading-\[1\.5\] \[overflow-wrap:anywhere\]"><span>注文します<\/span><\/span>/.test(html))
  assert.ok(html.includes('mt-[5px]'))
  assert.ok(!html.includes('mt-2 inline-flex'), '표시 설정 로드 전에는 루비 예약 여백(mt-2)이 아니다')
  assert.ok(jaSpan('すみません').test(html))
})

test('NextReviewCard: 묶음 칩 본문이 JaText 로 그려지고 "외 N개"는 그대로', () => {
  const items = [item('a', '注文します', 'FOCUS'), item('b', 'すみません')]
  const next = {
    decidedBy: 'TUTOR',
    rationaleKo: '근거',
    groups: [{ days: 3, date: '2026-10-08', itemIds: ['a', 'b', 'zzz'] }],
  } as unknown as NextReviewDetail
  const html = renderToStaticMarkup(createElement(NextReviewCard, { state: 'ready', next, items, teacherName: '선생님' }))
  assert.ok(jaSpan('注文します').test(html))
  assert.ok(jaSpan('すみません').test(html))
  assert.ok(html.includes('외 1개'))
})

test('소스 규칙: 화면 4개 모두 kanaToHangul·pronLine 호출 0, 분석은 useAnnotations 1회(묶음)', () => {
  for (const rel of ['review/TeacherWhy.tsx', 'review/NextReviewCard.tsx', 'review/ReviewItemsCard.tsx', 'LessonEnd.tsx']) {
    const s = src(rel)
    assert.ok(!/kanaToHangul|pronLine/.test(s), `${rel}: 변환 규칙을 화면이 호출한다`)
    assert.equal((s.match(/useAnnotations\(/g) ?? []).length, 1, `${rel}: useAnnotations 는 한 번만`)
  }
  assert.ok(!/truncate/.test(src('review/TeacherWhy.tsx').split('export default function TeacherWhy')[0]), 'ReviewChips 에 truncate 가 남아 있다')
})
