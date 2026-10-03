/**
 * 오늘의 복습(task-010b) 화면 ↔ 서버 DTO — api-contract §2-13 #58 `review`·`guard`·`decisionPending`·`nextReview` ·
 * #60 `reviewItems`·`nextReview` · #62 `reviewDecisionJobId`·`nextReview` · #63 · #64 의 필드명 그대로(Leader 결정 ①~⑦, 전부 additive).
 * 서버 모듈을 import 하지 않는다(module-dependency §3 규칙 5) — 모양은 `learning/reviewSchedule/core.ts`·`repetition/review.ts` 를 옮겼다.
 */
import type { LessonStatus } from './lesson'

export type ReviewStatus = 'DUE' | 'DONE' | 'SKIPPED' | 'EXPIRED'
export type DecidedBy = 'TUTOR' | 'FALLBACK'
export type RepetitionPriority = 'NORMAL' | 'FOCUS'
export type RepetitionItemType = 'EXPRESSION' | 'CHUNK' | 'GRAMMAR' | 'SCENARIO' | 'WORD' | 'LESSON'

/* ── #58 ─────────────────────────────────────────────────────────── */

export interface ReviewPreviewItem {
  textJa: string
  priority: RepetitionPriority
}

export interface TodayReview {
  id: string
  status: ReviewStatus
  itemCount: number
  focusCount: number
  /** 우선순위(FOCUS 먼저) 순 ≤7 — 표기만(읽기·뜻 없음). */
  preview: ReviewPreviewItem[]
  decidedBy: DecidedBy
  tutorRationale: string | null
  decidedAt: string
  lessonId: string | null
  /** 연결된 복습 레슨 상태(★⑧ additive) — 없으면 `todayLessons` 에서 찾는다. */
  lessonStatus?: LessonStatus | null
  /** 끝낸 복습 레슨 점수(★⑧ additive). */
  score?: number | null
  stageDone: number | null
  /** 복습 레슨 생성 잡(#55) — 만드는 중일 때만. */
  jobId: string | null
}

export interface ReviewGuard {
  /** `insufficient`(지금 서버) · `cycle`·`stale`(예약). 화면은 `insufficient` 만 그리고 그 밖의 값은 숨긴다(§14-11 ⑥). */
  reason: string
  needed?: number
  studyDays?: { have: number; need: number }
  items?: { have: number; need: number }
}

/** #58 `nextReview` — 오늘 뒤 가장 이른 예정일 묶음. `decidedBy` 는 Leader ④ 선택값. */
export interface NextReviewSummary {
  date: string
  days: number
  itemCount: number
  decidedBy?: DecidedBy | null
}

/** #58 의 복습 칸(전부 선택 — 옛 응답·복습 계산 실패 degrade 에서도 화면이 깨지지 않게). */
export interface TodayReviewFields {
  review?: TodayReview | null
  guard?: ReviewGuard | null
  cycle?: { reviewEvery: number } | null
  decisionPending?: boolean
  decisionJobId?: string | null
  nextReview?: NextReviewSummary | null
}

/* ── #60 · #62 ───────────────────────────────────────────────────── */

export interface ReviewItem {
  id: string
  itemType: RepetitionItemType
  /** 원천 종류(TopicChunk·Expr·Grammar·Correction·WordEntry) — 화면은 `sourceLabel` 로만 바꿔 보인다. */
  refType: string
  source?: 'LESSON' | 'CORRECTION' | 'WORDS'
  textJa: string
  meaningKo: string | null
  priority: RepetitionPriority
  studiedCount: number
  wrongCount: number
  feedbackCount: number
}

export interface NextReviewGroup {
  /** 기준일(끝낸 날)에서 며칠 뒤. */
  days: number
  date: string
  itemIds: string[]
}

export interface NextReviewDetail {
  decidedBy: DecidedBy
  rationaleKo: string
  groups: NextReviewGroup[]
}

/* ── #63 · #64 ───────────────────────────────────────────────────── */

export interface StartReviewResult {
  lessonId: string
  jobId: string | null
  status: LessonStatus
  reused: boolean
}

export interface SkipReviewResult {
  id: string
  status: 'SKIPPED'
  resolvedAt: string
}
