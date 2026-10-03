/**
 * 오늘의 복습(task-010b) 순수 판정 — screens §14-2·§14-3·§14-5. DOM·API 를 모른다(단위 테스트 `__tests__/review.test.ts`).
 *  - `deriveReviewCard`·`reviewPlacement`: 오늘 홈 카드 16상태와 자리(위·아래·곧 열려요·없음)
 *  - `sortReviewItems`·`itemTypeLabel`·`sourceLabel`·`countLabel`·`studiedLabel`·`focusIdsOf`: ① 이번 복습 항목
 *  - `splitJaQuotes`: 근거 문장의 「…」 조각 나누기(HTML 주입 없이 `lang="ja"` 를 달기 위해)
 *  - `formatDue`·`decidedAtLabel`·`nextReviewLine`: 날짜·시각 표기(서버 `date`·`days` 를 그대로 — 화면이 다시 계산하지 않는다)
 *  - `reviewGenPhase`·`groupsSorted`: 복습 수업 대기 문구·다음 복습 묶음
 */
import { formatClock, kstDateKey } from '@/components/common/format'
import { formatMonthDay, weekdayOf } from '@/components/vocab/format'
import type { LessonStatus, TodayLessons } from '@/types/lesson'
import type { NextReviewGroup, NextReviewSummary, ReviewGuard, ReviewItem, TodayReview } from '@/types/review'
import { correctFromScore, genPhase } from '../logic'
import { ITEM_TYPE_LABEL, RV_GEN, RV_HOME, RV_LESSON, SOURCE_LABEL } from './reviewCopy'

/* ── 건너뛰기 로컬 상태(§14-2 C) ─────────────────────────────────── */

/** `sent` = #64 성공 뒤 #58 이 아직 DUE 를 돌려주는 사이(다시 읽기 전) — 카드가 잠깐 "복습 있음"으로 되돌아가 보이지 않게 건너뜀을 유지한다. */
export type SkipPhase = 'idle' | 'pending' | 'sending' | 'sent' | 'failed'

export interface SkipState {
  phase: SkipPhase
  reviewId: string | null
}

export const SKIP_IDLE: SkipState = { phase: 'idle', reviewId: null }

/* ── 홈 카드 ─────────────────────────────────────────────────────── */

export type ReviewCard =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'skipped'; review: TodayReview }
  | { kind: 'guard'; guard: ReviewGuard }
  | { kind: 'gen'; review: TodayReview; jobId: string | null }
  | { kind: 'genfail'; review: TodayReview }
  | { kind: 'progress'; review: TodayReview; lessonId: string; stageDone: number }
  | { kind: 'ready'; review: TodayReview; lessonId: string }
  | { kind: 'due'; review: TodayReview }
  | { kind: 'dueFallback'; review: TodayReview }
  | { kind: 'done'; review: TodayReview; next: NextReviewSummary | null; correct: number | null }
  | { kind: 'donePending'; review: TodayReview; correct: number | null }
  | { kind: 'skippedServer'; review: TodayReview }
  | { kind: 'pending' }
  | { kind: 'rest'; next: NextReviewSummary }
  | { kind: 'hidden' }

export type ReviewCardKind = ReviewCard['kind']
export type ReviewPlacement = 'above' | 'below' | 'soon' | 'none'

/** 복습 레슨 상태·점수 — #58 `review.lessonStatus`·`score`(★⑧)가 먼저, 없으면 `todayLessons` 에서 같은 id 를 찾는다. */
export function reviewLessonOf(review: TodayReview, today: TodayLessons): { status: LessonStatus | null; score: number | null } {
  const found = review.lessonId ? (today.todayLessons ?? []).find((l) => l.id === review.lessonId) : undefined
  return {
    status: review.lessonStatus ?? found?.status ?? null,
    score: typeof review.score === 'number' ? review.score : typeof found?.score === 'number' ? found.score : null,
  }
}

/** 표에서 위 줄이 이긴다(screens §14-2 A 1~16). 로컬 건너뛰기(pending·sending)는 서버가 아직 DUE 여도 이긴다. */
export function deriveReviewCard(state: 'loading' | 'error' | 'ready', today: TodayLessons | null, skip: SkipState = SKIP_IDLE): ReviewCard {
  if (state === 'loading') return { kind: 'loading' }
  if (state === 'error' || !today) return { kind: 'error' }
  const review = today.review ?? null
  if (review && skip.reviewId === review.id && (skip.phase === 'pending' || skip.phase === 'sending' || (skip.phase === 'sent' && review.status === 'DUE'))) {
    return { kind: 'skipped', review }
  }
  const guard = today.guard ?? null
  if (guard?.reason === 'insufficient') return { kind: 'guard', guard }
  if (review) {
    if (review.status === 'DUE') {
      if (review.lessonId) {
        const lesson = reviewLessonOf(review, today)
        if (review.jobId || lesson.status === 'GENERATING') return { kind: 'gen', review, jobId: review.jobId }
        if (lesson.status === 'FAILED') return { kind: 'genfail', review }
        const stageDone = Math.max(0, review.stageDone ?? 0)
        if (lesson.status === 'READY' && stageDone === 0) return { kind: 'ready', review, lessonId: review.lessonId }
        // IN_PROGRESS·READY(진행 있음)·상태를 모름 → 하던 복습(수업 경로가 실제 상태를 그린다).
        return { kind: 'progress', review, lessonId: review.lessonId, stageDone: Math.min(5, stageDone) }
      }
      return isTutorReview(review) ? { kind: 'due', review } : { kind: 'dueFallback', review }
    }
    if (review.status === 'DONE') {
      const { score } = reviewLessonOf(review, today)
      const correct = score === null ? null : correctFromScore(score)
      return today.decisionPending ? { kind: 'donePending', review, correct } : { kind: 'done', review, next: today.nextReview ?? null, correct }
    }
    if (review.status === 'SKIPPED') return { kind: 'skippedServer', review }
    return { kind: 'hidden' }
  }
  if (today.decisionPending) return { kind: 'pending' }
  if (today.nextReview) return { kind: 'rest', next: today.nextReview }
  return { kind: 'hidden' }
}

/** 강사 근거로 보일 수 있는가 — 판단 주체가 TUTOR 이고 근거 문장이 있을 때만. 없으면 기본 규칙 상자(데모 `whyBox` 와 같은 규칙). */
export function isTutorReview(review: Pick<TodayReview, 'decidedBy' | 'tutorRationale'>): boolean {
  return review.decidedBy === 'TUTOR' && !!review.tutorRationale?.trim()
}

/** 카드 자리(a=A): 할 일이 있을 때만 오늘의 회화 위, 판단 대기·완료·없음·건너뜀은 아래, 가드는 맨 아래 "곧 열려요"(d=B). */
export function reviewPlacement(card: ReviewCard): ReviewPlacement {
  switch (card.kind) {
    case 'gen':
    case 'genfail':
    case 'progress':
    case 'ready':
    case 'due':
    case 'dueFallback':
      return 'above'
    case 'skipped':
    case 'done':
    case 'donePending':
    case 'skippedServer':
    case 'pending':
    case 'rest':
      return 'below'
    case 'guard':
      return 'soon'
    default:
      return 'none'
  }
}

/** 판단 대기를 #58 재조회로 지켜볼 상태(§14-3 `useDecisionWatch`). */
export function watchesDecision(card: ReviewCard): boolean {
  return card.kind === 'pending' || card.kind === 'donePending'
}

/* ── 요청 실패 분기(#63·#64) ──────────────────────────────────────── */

/** #64 실패: 409·404 = 이미 처리됐거나 시작된 복습(문구 없이 #58 다시) · 그 밖(0·429·5xx) = 카드 실패 줄. */
export function skipFailureKind(err: { status: number }): 'stale' | 'failed' {
  return err.status === 409 || err.status === 404 ? 'stale' : 'failed'
}

/** #63 실패 토스트(§14-2 A 카드 버튼 동작). `reload` 면 #58 을 다시 읽는다. */
export function startReviewErrorText(err: { status: number }): { text: string; reload: boolean } {
  if (err.status === 409 || err.status === 404) return { text: RV_HOME.startChanged, reload: true }
  if (err.status === 429) return { text: RV_HOME.startRateLimited, reload: false }
  if (err.status === 0) return { text: RV_HOME.startOffline, reload: false }
  return { text: RV_HOME.startFailed, reload: false }
}

/* ── 날짜·시각 ───────────────────────────────────────────────────── */

/** `10월 3일(토)` — 서버 날짜 키 그대로, 요일만 붙인다. */
export function formatDue(date: string): string {
  const md = formatMonthDay(date)
  if (!md) return ''
  const wd = weekdayOf(date)
  return wd ? `${md}(${wd})` : md
}

/** 근거 메타줄 시각 — 오늘이면 `오늘 09:12`, 아니면 `10월 2일`, 값이 없거나 잘못되면 null(그 부분을 뺀다). */
export function decidedAtLabel(iso: string | null | undefined, todayKey: string): string | null {
  if (!iso) return null
  const key = kstDateKey(iso)
  if (!key) return null
  return key === todayKey ? `오늘 ${formatClock(iso)}` : formatMonthDay(key)
}

/** 홈 완료 카드 "다음 복습" 상자 한 줄. `decidedBy` 가 없으면 중립 문구, FALLBACK 이면 아래 줄을 더 둔다. */
export function nextReviewLine(next: NextReviewSummary): { text: string; note: string | null } {
  const due = formatDue(next.date)
  if (next.decidedBy === 'TUTOR') return { text: RV_HOME.nextTutor(due, next.days), note: null }
  if (next.decidedBy === 'FALLBACK') return { text: RV_HOME.nextNeutral(due, next.days), note: RV_HOME.nextFallbackNote }
  return { text: RV_HOME.nextNeutral(due, next.days), note: null }
}

/* ── 근거 문장 ───────────────────────────────────────────────────── */

export interface QuotePart {
  text: string
  ja: boolean
}

/** 「…」 조각만 일본어로 표시한다(React 노드로 감싸기 위해 — HTML 주입 없음). 빈 조각은 버린다. */
export function splitJaQuotes(s: string): QuotePart[] {
  return s
    .split(/(「[^」]*」)/)
    .filter((t) => t.length > 0)
    .map((t) => ({ text: t, ja: t.startsWith('「') && t.endsWith('」') }))
}

/* ── ① 이번 복습 항목 ─────────────────────────────────────────────── */

/** FOCUS 먼저 → (교정+틀림) 큰 순 → 공부 횟수 작은 순 → 원래 순서. 원본 배열은 바꾸지 않는다. */
export function sortReviewItems<T extends Pick<ReviewItem, 'priority' | 'feedbackCount' | 'wrongCount' | 'studiedCount'>>(items: readonly T[]): T[] {
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => {
      const fa = a.it.priority === 'FOCUS' ? 0 : 1
      const fb = b.it.priority === 'FOCUS' ? 0 : 1
      if (fa !== fb) return fa - fb
      const ma = a.it.feedbackCount + a.it.wrongCount
      const mb = b.it.feedbackCount + b.it.wrongCount
      if (ma !== mb) return mb - ma
      if (a.it.studiedCount !== b.it.studiedCount) return a.it.studiedCount - b.it.studiedCount
      return a.i - b.i
    })
    .map((x) => x.it)
}

export function itemTypeLabel(itemType: string): string {
  return ITEM_TYPE_LABEL[itemType] ?? ''
}

/** 출처 3종 라벨 — 모르는 값은 null(그 부분을 뺀다). 원값(`refType`)은 화면에 내지 않는다. */
export function sourceLabel(refType: string): string | null {
  return SOURCE_LABEL[refType] ?? null
}

/** 3줄 앞 횟수: 교정 > 틀림 > 틀린 적 없음. `bad` 면 `bad` 색 semibold. */
export function countLabel(it: Pick<ReviewItem, 'feedbackCount' | 'wrongCount'>): { text: string; bad: boolean } {
  if (it.feedbackCount > 0) return { text: RV_LESSON.feedback(it.feedbackCount), bad: true }
  if (it.wrongCount > 0) return { text: RV_LESSON.wrong(it.wrongCount), bad: true }
  return { text: RV_LESSON.neverWrong, bad: false }
}

export function studiedLabel(studiedCount: number): string {
  return studiedCount > 0 ? RV_LESSON.studied(studiedCount) : RV_LESSON.firstReview
}

export function focusIdsOf(items: readonly Pick<ReviewItem, 'id' | 'priority'>[]): Set<string> {
  return new Set(items.filter((x) => x.priority === 'FOCUS').map((x) => x.id))
}

/* ── 복습 수업 대기·다음 복습 ─────────────────────────────────────── */

/** 앞 두 구간(15초·45초 전)만 복습 문구로 바꾸고 나머지(마무리·오래 걸림)는 `genPhase` 에 맡긴다. */
export function reviewGenPhase(elapsedSec: number, stage: string | null): string {
  if (stage !== 'SAVE' && elapsedSec < 45) return elapsedSec < 15 ? RV_GEN.phaseItems : RV_GEN.phaseMix
  return genPhase(elapsedSec, stage)
}

/** 묶음을 `days` 오름차순으로(원본 유지). */
export function groupsSorted(groups: readonly NextReviewGroup[]): NextReviewGroup[] {
  return [...groups].sort((a, b) => a.days - b.days)
}
