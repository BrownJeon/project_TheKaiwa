/**
 * task-010b REV-079 M-1·L-1·L-3·L-4 — 복습 칸이 새 수업(NEW)에 새지 않는지(선택 prop 없이 그린 DOM), 건너뛰기 상태 전이(가짜 타이머·가짜 요청),
 * 다음 복습 묶음의 "외 N개", 근거 문단 줄바꿈, 되돌리기 알림 영역 상시 마운트.
 */
import { afterEach, beforeEach, mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import type { LessonContent, LessonDto } from '@/types/lesson'
import type { NextReviewDetail, ReviewItem } from '@/types/review'
import LessonEnd from '../../LessonEnd'
import LessonGenScreen from '../../LessonGenScreen'
import { END, GEN, LESSON, U2, U3 } from '../../lessonCopy'
import { LessonHeader } from '../../parts'
import StageGrammar from '../../StageGrammar'
import StageQuiz from '../../StageQuiz'
import type { LessonPlayback } from '../../useLessonPlayback'
import type { UseLesson } from '../../useLesson'
import NextReviewCard from '../NextReviewCard'
import { RV_END, RV_GEN, RV_HOME, RV_LESSON } from '../reviewCopy'
import { skipFailureKind } from '../reviewLogic'
import { createSkipController, SKIP_UNDO_MS, type SkipControllerDeps } from '../skipController'
import TeacherWhy from '../TeacherWhy'
import UndoToast from '../UndoToast'

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

const CONTENT = {
  v: 1,
  title: 'カフェで注文',
  titleKo: '카페에서 주문',
  rolesKo: { A: '손님', B: '점원' },
  dialogue: [],
  segmentCount: 0,
  chunks: [
    { id: 'c1', textJa: 'すみません', reading: 'すみません', meaningKo: '실례합니다', chunkType: 'EXPRESSION', isNew: true },
    { id: 'c2', textJa: 'お願いします', reading: 'おねがいします', meaningKo: '부탁합니다', chunkType: 'EXPRESSION', isNew: false },
  ],
  grammar: [{ id: 'g1', pattern: '〜てもいいですか', explanationKo: '허락을 구해요', exampleJa: '座ってもいいですか', exampleReading: 'すわってもいいですか', exampleKo: '앉아도 될까요?' }],
  quiz: [{ id: 'q1', promptKo: '알맞은 말은?', promptJa: null, choices: ['すみません', 'はい', 'いいえ', 'どうも'], answer: 0, targetIds: ['c1'], explanationKo: '설명' }],
  application: [],
  speaking: [],
  nextPreview: { titleKo: '다음 수업', teaserKo: '이어서 해요' },
} as unknown as LessonContent

const lessonOf = (o: Partial<LessonDto> = {}): LessonDto & { content: LessonContent } => ({
  id: 'L1',
  kind: 'NEW',
  date: '2026-10-03',
  title: 'カフェで注文',
  titleKo: '카페에서 주문',
  level: 'N4',
  status: 'DONE',
  stageDone: 5,
  progress: { quiz: { answers: [0] } },
  score: 80,
  source: 'TOPIC',
  topic: { id: 't1', title: '카페 주문' },
  content: CONTENT,
  jobId: null,
  error: null,
  createdAt: '2026-10-03T00:00:00.000Z',
  updatedAt: '2026-10-03T00:00:00.000Z',
  completedAt: '2026-10-03T01:00:00.000Z',
  ...o,
}) as LessonDto & { content: LessonContent }

const PB = { textOnly: false, active: () => false, loading: () => false, lineOf: () => null, blocked: false, stop: () => {}, playLines: () => {}, playMine: () => {}, resume: () => {} } as unknown as LessonPlayback
const ST = { update: () => {} } as unknown as UseLesson
const ROUTER = { push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, forward: () => {}, refresh: () => {} }
const withRouter = (el: ReactElement) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: ROUTER as never }, el))

/** 복습에서만 나오는 문구 — NEW 기본 DOM 에 하나라도 있으면 회귀. */
const REVIEW_ONLY = [
  RV_LESSON.grammarIntro(1),
  RV_LESSON.exprTitle(2),
  RV_LESSON.exprNote,
  RV_LESSON.exprNoteNoAudio,
  RV_LESSON.quizNote,
  RV_LESSON.headerSr,
  RV_END.title,
  RV_END.recordNote,
  RV_END.nextTitle,
  RV_END.pendingTitle,
  RV_END.unknown,
  RV_END.backTodayNote,
  RV_GEN.title,
  RV_GEN.failTitle,
  RV_GEN.itemsNote,
]
const assertNoReview = (html: string, where: string) => {
  for (const s of REVIEW_ONLY) assert.ok(!html.includes(s), `${where}: 복습 문구가 NEW 에 샜다 — ${s}`)
  assert.ok(!html.includes(`>${RV_LESSON.focus}<`), `${where}: 집중 뱃지가 NEW 에 샜다`)
  assert.ok(!html.includes(`>${RV_LESSON.badge}<`), `${where}: 복습 뱃지가 NEW 에 샜다`)
}

/* ── M-1 ① NEW 기본값 회귀(선택 prop 없이) ─────────────────────────── */

test('StageGrammar — variant 를 안 주면 NEW 문구·뱃지 그대로, REVIEW 만 복습 문구', () => {
  const plain = renderToStaticMarkup(createElement(StageGrammar, { content: CONTENT, pb: PB, reading: false, footer: null }))
  assertNoReview(plain, 'StageGrammar')
  assert.ok(plain.includes(U2.desc(1)) && plain.includes(U2.exprTitle(2)) && plain.includes(U2.exprDescPlay))
  assert.ok(plain.includes(`>${U2.newExpr}<`))
  const rv = renderToStaticMarkup(createElement(StageGrammar, { content: CONTENT, pb: PB, reading: false, footer: null, variant: 'REVIEW', focusIds: new Set(['c1']) }))
  assert.ok(rv.includes(RV_LESSON.grammarIntro(1)) && rv.includes(RV_LESSON.exprTitle(2)) && rv.includes(`>${RV_LESSON.focus}<`))
})

test('StageQuiz — variant 를 안 주면 결과 카드 문구가 NEW 그대로', () => {
  const lesson = lessonOf()
  const plain = renderToStaticMarkup(createElement(StageQuiz, { lesson, st: ST, reviewing: true, footer: null }))
  assertNoReview(plain, 'StageQuiz')
  assert.ok(plain.includes(U3.sumNote))
  const rv = renderToStaticMarkup(createElement(StageQuiz, { lesson, st: ST, reviewing: true, footer: null, variant: 'REVIEW' }))
  assert.ok(rv.includes(RV_LESSON.quizNote) && !rv.includes(U3.sumNote))
})

test('LessonHeader — review 를 안 주면 sr 접두어만, 복습 뱃지 없음', () => {
  const html = renderToStaticMarkup(createElement(LessonHeader, { teacherName: '선생님', topic: '카페 주문', title: 'カフェで', onAnnounce: () => {} }))
  assertNoReview(html, 'LessonHeader')
  assert.ok(html.includes(LESSON.srPrefix('카페 주문')))
})

test('LessonEnd — NEW 수업은 review 를 안 줘도 다음 복습·[오늘로] 주 버튼 없이 지금과 같다', () => {
  const result = { correct: 1, total: 1, applicationDone: 0, usedIds: [], missedIds: [], nextPreview: { titleKo: '다음 수업', teaserKo: '이어서 해요' } }
  const html = withRouter(createElement(LessonEnd, { lesson: lessonOf(), result, onToast: () => {} }))
  assertNoReview(html, 'LessonEnd')
  assert.ok(html.includes(END.title) && html.includes(END.recorded) && html.includes(END.nextLesson) && html.includes(END.talk))
  const pasted = withRouter(createElement(LessonEnd, { lesson: lessonOf({ topic: null, source: 'TEXT' }), result, onToast: () => {} }))
  assertNoReview(pasted, 'LessonEnd(붙여넣기)')
  assert.ok(pasted.includes(END.otherText) && pasted.includes(END.pickTopic))
  const rv = withRouter(createElement(LessonEnd, { lesson: lessonOf({ kind: 'REVIEW', reviewItems: [], nextReview: null }), result, onToast: () => {} }))
  assert.ok(rv.includes(RV_END.title) && rv.includes(RV_END.nextTitle) && !rv.includes(END.nextLesson))
})

test('LessonGenScreen — NEW 수업 대기·실패는 순서 카드·다른 주제 그대로, 복습 문구 없음', () => {
  const wait = withRouter(createElement(LessonGenScreen, { lesson: lessonOf({ status: 'GENERATING', jobId: 'j1', content: null }), onSettled: () => {}, onToast: () => {} }))
  assertNoReview(wait, 'LessonGenScreen(대기)')
  assert.ok(wait.includes(GEN.hero) && wait.includes(GEN.orderTitle))
  const fail = withRouter(createElement(LessonGenScreen, { lesson: lessonOf({ status: 'FAILED', content: null }), onSettled: () => {}, onToast: () => {} }))
  assertNoReview(fail, 'LessonGenScreen(실패)')
  assert.ok(fail.includes(GEN.failTitle) && fail.includes(GEN.otherTopic) && fail.includes(GEN.retry))
  const rv = withRouter(createElement(LessonGenScreen, { lesson: lessonOf({ kind: 'REVIEW', status: 'GENERATING', jobId: 'j1', content: null }), onSettled: () => {}, onToast: () => {} }))
  assert.ok(rv.includes(RV_GEN.title))
})

/* ── M-1 ② 건너뛰기 상태 전이(skipController) ─────────────────────── */

const DUE = { id: 'rs_1', status: 'DUE' }
const flush = () => new Promise<void>((r) => setImmediate(r))

function harness(post: (id: string, leaving: boolean) => Promise<unknown> = async () => ({})) {
  const calls = { post: [] as { id: string; leaving: boolean }[], committed: 0, undone: 0, focus: [] as string[], flagged: [] as string[], cleared: 0 }
  let mounted = true
  const deps: SkipControllerDeps = {
    post: (id, leaving) => {
      calls.post.push({ id, leaving })
      return post(id, leaving)
    },
    failureKind: (e) => skipFailureKind(e as { status: number }),
    render: () => {},
    isMounted: () => mounted,
    onCommitted: () => void calls.committed++,
    onUndone: () => void calls.undone++,
    focus: (t) => void calls.focus.push(t),
    undoHasFocus: () => false,
    flagLeaveFailure: (id) => void calls.flagged.push(id),
    clearLeaveFailure: () => void calls.cleared++,
  }
  return { ctl: createSkipController(deps), calls, unmount: () => (mounted = false) }
}

beforeEach(() => mock.timers.enable({ apis: ['setTimeout'] }))
afterEach(() => mock.timers.reset())

test('건너뛰기 — 누르면 요청 없이 대기, 5초 뒤 #64 정확히 1회', async () => {
  const { ctl, calls } = harness()
  ctl.start(DUE)
  assert.equal(ctl.state.phase, 'pending')
  assert.deepEqual(calls.focus, ['undo'])
  mock.timers.tick(SKIP_UNDO_MS - 1)
  assert.equal(calls.post.length, 0)
  mock.timers.tick(1)
  await flush()
  assert.deepEqual(calls.post, [{ id: 'rs_1', leaving: false }])
  assert.equal(ctl.state.phase, 'sent')
  assert.equal(calls.committed, 1)
  mock.timers.tick(SKIP_UNDO_MS * 3)
  await flush()
  assert.equal(calls.post.length, 1)
})

test('건너뛰기 — 5초 안 되돌리기면 요청 0회', async () => {
  const { ctl, calls } = harness()
  ctl.start(DUE)
  mock.timers.tick(SKIP_UNDO_MS - 100)
  ctl.undo()
  assert.equal(ctl.state.phase, 'idle')
  assert.equal(calls.undone, 1)
  mock.timers.tick(SKIP_UNDO_MS * 2)
  await flush()
  assert.equal(calls.post.length, 0)
  assert.equal(calls.committed, 0)
})

test('건너뛰기 — 5초 안 떠나면 즉시 keepalive 1회, 숨김·pagehide·언마운트·5초 타이머가 겹쳐도 더 보내지 않음', async () => {
  const { ctl, calls, unmount } = harness()
  ctl.start(DUE)
  mock.timers.tick(1000)
  void ctl.commit(true)
  void ctl.commit(true)
  unmount()
  void ctl.commit(true)
  mock.timers.tick(SKIP_UNDO_MS * 2)
  await flush()
  assert.deepEqual(calls.post, [{ id: 'rs_1', leaving: true }])
  assert.equal(ctl.state.phase, 'sent')
  assert.equal(calls.committed, 0, '언마운트 뒤엔 재조회 콜백을 부르지 않는다')
})

test('건너뛰기 — 실패(503)는 failed + 건너뛰기 버튼 초점, 떠나며 실패한 경우만 다음 방문 플래그', async () => {
  const fail503 = async () => {
    throw { status: 503 }
  }
  const a = harness(fail503)
  a.ctl.start(DUE)
  mock.timers.tick(SKIP_UNDO_MS)
  await flush()
  assert.equal(a.ctl.state.phase, 'failed')
  assert.equal(a.ctl.state.reviewId, 'rs_1')
  assert.deepEqual(a.calls.focus, ['undo', 'skip'])
  assert.deepEqual(a.calls.flagged, [])

  const b = harness(fail503)
  b.ctl.start(DUE)
  void b.ctl.commit(true)
  await flush()
  assert.equal(b.ctl.state.phase, 'failed')
  assert.deepEqual(b.calls.flagged, ['rs_1'])

  // 실패 뒤 다시 누르면 새 대기 → 5초 뒤 다시 1회, 지난 실패 기록은 지운다.
  const before = b.calls.cleared
  b.ctl.start(DUE)
  assert.equal(b.ctl.state.phase, 'pending')
  assert.equal(b.calls.cleared, before + 1)
})

test('건너뛰기 — 409·404 는 조용히 idle + 재조회(실패 줄 없음)', async () => {
  const h = harness(async () => {
    throw { status: 409 }
  })
  h.ctl.start(DUE)
  mock.timers.tick(SKIP_UNDO_MS)
  await flush()
  assert.equal(h.ctl.state.phase, 'idle')
  assert.equal(h.calls.committed, 1)
  assert.deepEqual(h.calls.flagged, [])
})

test('건너뛰기 — 대기 중 다른 일정이 오면 보내지 않고 버림, DUE 아니면 시작 안 함', async () => {
  const h = harness()
  h.ctl.start({ id: 'rs_0', status: 'DONE' })
  assert.equal(h.ctl.state.phase, 'idle')
  h.ctl.start(DUE)
  h.ctl.reviewChanged('rs_1')
  assert.equal(h.ctl.state.phase, 'pending')
  h.ctl.reviewChanged('rs_2')
  assert.equal(h.ctl.state.phase, 'idle')
  void h.ctl.commit(true)
  mock.timers.tick(SKIP_UNDO_MS * 2)
  await flush()
  assert.equal(h.calls.post.length, 0)
})

/* ── L-1 · L-3 · L-4 ──────────────────────────────────────────────── */

const ri = (id: string, textJa: string): ReviewItem => ({ id, textJa, itemType: 'EXPRESSION', refType: 'TopicChunk', source: 'LESSON', meaningKo: null, priority: 'NORMAL', studiedCount: 1, wrongCount: 0, feedbackCount: 0 }) as ReviewItem

test('NextReviewCard — 묶음 칩이 개수보다 적으면 "외 N개", 개수는 서버 값 그대로', () => {
  const items = [ri('ri_1', 'すみません'), ri('ri_2', 'お願いします')]
  const next: NextReviewDetail = {
    decidedBy: 'TUTOR',
    rationaleKo: '근거',
    groups: [
      { days: 3, date: '2026-10-06', itemIds: ['ri_1', 'ri_gone', 'ri_gone2'] },
      { days: 5, date: '2026-10-08', itemIds: ['ri_2'] },
    ],
  }
  const html = renderToStaticMarkup(createElement(NextReviewCard, { state: 'ready', next, items, teacherName: '선생님' }))
  const t = text(html)
  assert.match(t, /· 3개/, '개수는 itemIds 길이(3)')
  assert.equal(html.split(`>${RV_HOME.chipsMore(2)}<`).length - 1, 1, '어긋난 묶음에만 "외 2개" 한 번')
  assert.ok(!html.includes(`>${RV_HOME.chipsMore(1)}<`) && !html.includes(`>${RV_HOME.chipsMore(0)}<`))
})

test('TeacherWhy — 근거 문단은 단어 단위 줄바꿈(break-keep) + 긴 조각 넘침 방지 유지', () => {
  const html = renderToStaticMarkup(createElement(TeacherWhy, { mode: 'TUTOR', text: '「お願いします」를 두 번 틀려서 3일 뒤에 다시 봐요.', who: '선생님', at: null }))
  const cls = /<p id="[^"]*" class="([^"]*)"/.exec(html)?.[1] ?? ''
  assert.ok(cls.includes('break-keep') && cls.includes('[overflow-wrap:anywhere]'), cls)
})

test('UndoToast — 알림 영역은 닫혀 있어도 하나 붙어 있고(비어 있음·sr-only·버튼 없음), 열리면 같은 자리에 문구만', () => {
  const props = { message: RV_HOME.undoMessage, actionLabel: RV_HOME.undo, onAction: () => {} }
  const closed = renderToStaticMarkup(createElement(UndoToast, { ...props, open: false }))
  assert.equal(closed.split('role="status"').length - 1, 1)
  assert.ok(closed.includes('sr-only') && closed.includes('pointer-events-none'))
  assert.ok(!closed.includes(RV_HOME.undoMessage) && !closed.includes('<button'))
  const open = renderToStaticMarkup(createElement(UndoToast, { ...props, open: true }))
  assert.equal(open.split('role="status"').length - 1, 1)
  assert.ok(open.includes(RV_HOME.undoMessage) && open.includes('<button') && !open.includes('sr-only'))
  // 같은 구조(div > p[role=status] 첫 자식) — 열고 닫아도 React 가 같은 노드를 재사용한다.
  const shape = (h: string) => h.replace(/ class="[^"]*"| style="[^"]*"/g, '').replace(/>[^<]*</g, '><').replace(/<button.*<\/button>/, '')
  assert.equal(shape(closed), shape(open))
})
