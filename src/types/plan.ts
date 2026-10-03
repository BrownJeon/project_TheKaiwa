/**
 * 계획표 달력 화면의 클라이언트 DTO — api-contract §2-15 #70·#71·§2-16 #72·#73(task-012 구현 기준 additive 포함) 응답 모양을
 * **그대로 옮긴** 타입이다. 서버 모듈(Prisma 타입)을 import 하지 않는다. enum 문자열은 `prisma/schema.prisma` 값과 같다.
 */

export type StudyType = 'TALK' | 'CHAT' | 'WORDS' | 'LESSON' | 'REVIEW' | 'EVALUATION' | 'ASK'
export type LogOrigin = 'DIRECT' | 'ACCEPTED'
export type ReviewStatus = 'DUE' | 'DONE' | 'SKIPPED' | 'EXPIRED'

/** #70 `days[]` — 그 달의 모든 날(빈 날 포함, 날짜 오름차순). */
export interface CalendarDay {
  date: string
  attended: boolean
  /** 서버 고정 순서(TALK·CHAT·WORDS·LESSON·REVIEW·EVALUATION·ASK) — 화면은 칸 표시 순서로 다시 정렬한다. */
  types: StudyType[]
  minutes: number
  logCount: number
  hasEvaluation: boolean
  reviewDue: boolean
}

export interface CalendarSummary {
  attendedDays: number
  studyDays: number
  /** 오늘 기준 연속 출석일(지난 달을 봐도 현재 값). */
  streak: number
  /** 그 달 안의 최장 연속 출석일. */
  longestStreak: number
}

/** #70 `GET /api/v1/plan/calendar?month=YYYY-MM` */
export interface CalendarResponse {
  month: string
  /** 서버 KST 오늘. */
  today: string
  days: CalendarDay[]
  summary: CalendarSummary
}

/** #71·#72 로그 객체 */
export interface StudyLogItem {
  id: string
  date: string
  type: StudyType
  origin: LogOrigin
  summary: string
  result: unknown
  correctionsCount: number
  durationSec: number | null
  refId: string | null
  /** 원본이 지금도 이 사용자 소유로 있는가(refId 가 없으면 false). */
  refExists: boolean
  createdAt: string
}

export interface DayReview {
  id: string
  status: ReviewStatus
  lessonId: string | null
}

/** #71 `GET /api/v1/plan/day?date=YYYY-MM-DD` */
export interface DayResponse {
  date: string
  attended: boolean
  /** 작성 순(최대 200). */
  logs: StudyLogItem[]
  review: DayReview | null
}

/** #73 `DELETE /api/v1/study-logs/:id` */
export interface StudyLogDeleteResponse {
  deleted: true
  snapshotKept: true
}
