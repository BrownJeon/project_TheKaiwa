/**
 * 계획표 달력 화면의 클라이언트 DTO — api-contract §2-15 #70·#71·§2-16 #72·#73(task-012 구현 기준 additive 포함) 응답 모양을
 * **그대로 옮긴** 타입이다. 서버 모듈(Prisma 타입)을 import 하지 않는다. enum 문자열은 `prisma/schema.prisma` 값과 같다.
 * task-041(additive): #70 `days[].challenge?`·`summary.challenge?` · #71 `challenge?` — 챌린지 날·진행 중일 때만 키가 있다.
 */
import type { CalendarChallengeDay, CalendarChallengeSummary, DayChallenge } from './challenge'

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
  /** 그 달에 걸친 챌린지 날만(겹치면 그만둔 날보다 진행·기록된 날, 그다음 나중에 만든 챌린지). */
  challenge?: CalendarChallengeDay
}

export interface CalendarSummary {
  attendedDays: number
  studyDays: number
  /** 오늘 기준 연속 출석일(지난 달을 봐도 현재 값). */
  streak: number
  /** 그 달 안의 최장 연속 출석일. */
  longestStreak: number
  /** 진행 중 챌린지(지난 달을 봐도 현재 값) — "수행 연속"은 출석 연속과 다르다. */
  challenge?: CalendarChallengeSummary
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
  /** 그날이 챌린지 날이면 "챌린지 n일째 — 달성/일부/놓침" 줄 재료. */
  challenge?: DayChallenge
}

/** #73 `DELETE /api/v1/study-logs/:id` */
export interface StudyLogDeleteResponse {
  deleted: true
  snapshotKept: true
}

// ── task-080 #78 `GET /api/v1/plan/growth?weeks=4|8|12` — 성장 탭(docs/screens.md §36-7 모양 그대로, 서버·화면 공용) ──

/** #78 요청 `weeks` 값 집합(생략 = 4). */
export type GrowthWeeks = 4 | 8 | 12
export const GROWTH_WEEKS: readonly GrowthWeeks[] = [4, 8, 12]

/** 공부결과 축(축 순서 고정 — `GROWTH_AXES`). 값은 Prisma `SkillAxis` 와 같다. */
export type GrowthAxis = 'VOCAB_RECALL' | 'GRAMMAR_PARTICLE' | 'LISTEN_RESPOND' | 'SENTENCE_PRODUCTION' | 'CONVERSATION_MAINTAIN'
export const GROWTH_AXES: readonly GrowthAxis[] = ['VOCAB_RECALL', 'GRAMMAR_PARTICLE', 'LISTEN_RESPOND', 'SENTENCE_PRODUCTION', 'CONVERSATION_MAINTAIN']

export interface GrowthRange {
  weeks: GrowthWeeks
  /** 첫 주 일요일(KST). */
  from: string
  /** = today. */
  to: string
  /** 서버 KST 오늘. */
  today: string
  /** 주 시작 요일(0 = 일요일). */
  weekStartsOn: 0
}

export interface GrowthSummary {
  /** 오늘 기준 연속 출석일(#25·#70 과 같은 계산). */
  streak: number
  /** 전체 기간 가장 긴 연속 출석일. */
  longestStreak: number
  /** `days` 중 공부한 날(kinds > 0) 수. */
  studyDays: number
  /** 이번 주 일요일~오늘 중 공부한 날 수. */
  thisWeekStudyDays: number
}

export interface GrowthDay {
  date: string
  /** 그날 `Attendance` 행이 있다. */
  attended: boolean
  /** 그날 0 보다 큰 공부 종류 수 0~6(단어·수업·복습·대화·평가·교정 채택). */
  kinds: number
}

export interface GrowthWeek {
  /** 그 주 일요일. */
  weekStart: string
  /** 그 주 토요일이 `since` 보다 앞(`since=null` 이면 늘 true) — «기록 전». */
  before: boolean
  attendedDays: number
  studyDays: number
  words: { sessions: number; correct: number; wrong: number }
  lessons: number
  reviews: number
  /** 음성 회화·역할극 말 수(DAILY `talkTurns`). */
  talkTurns: number
  /** 글자 채팅 말 수(DAILY `chatTurns`). */
  chatTurns: number
  correctionsAccepted: number
}

export interface GrowthSkill {
  axis: GrowthAxis
  /** false = 이 축을 기록하는 공부가 아직 없다(«기록 전») — 숫자 0·stage/trend null·spark []. */
  recorded: boolean
  /** CONVERSATION_MAINTAIN 만 SESSION(끝낸 역할극 수). */
  unit: 'OBSERVATION' | 'SESSION'
  /** 판정된 관측 수 = success + partial + fail(넘김·불확실 제외). */
  n: number
  success: number
  partial: number
  fail: number
  skipped: number
  /** 기간 안 판정된 관측이 1건 이상인 날 수. */
  obsDays: number
  min: number
  minDays: number | null
  enough: boolean
  /**
   * 한쪽 증거 편향(C 규칙, screens.md §36-17-2 L11): enough 이고 판정된 관측의 90% 이상이 교정(제안·재사용)에서 왔다.
   * true 면 stage·trend null·spark []. recorded=false 또는 !enough 면 늘 false.
   */
  oneSided: boolean
  /** 0 시작 단계 · 1 익히는 중 · 2 자리 잡는 중 · 3 안정적 — null ⇔ !enough 또는 oneSided. */
  stage: 0 | 1 | 2 | 3 | null
  trend: 'UP' | 'DOWN' | 'FLAT' | null
  /** 주마다 맞힌 비율(0~1, 소수 셋째 자리) — 그 주 n ≥ 5 인 주만, 오래된 순. */
  spark: number[]
}

export interface GrowthEvaluation {
  id: string
  kind: 'WORDS' | 'TALK'
  level: string
  totalScore: number
  grade: string
  rubric: { accuracy: number; vocabulary: number; grammar: number; naturalness: number; assembly: number }
  /** 채점을 끝낸 KST 날짜. */
  date: string
  /** 스냅샷 `createdAt`(ISO). */
  completedAt: string
}

/** #78 응답 — `errorTrend` 는 보내지 않는다(Leader 결정 2). */
export interface GrowthResponse {
  range: GrowthRange
  /** 이 사용자의 가장 이른 기록 날짜(출석·DAILY 중 이른 쪽) — 없으면 null. */
  since: string | null
  summary: GrowthSummary
  /** from~to 모든 날, 오름차순. */
  days: GrowthDay[]
  /** 길이 = range.weeks, 오름차순. */
  weeks: GrowthWeek[]
  /** 길이 5, `GROWTH_AXES` 순서. */
  skills: GrowthSkill[]
  /** 기간 안 평가(날짜 오름차순, 같은 날은 만든 순). */
  evaluations: GrowthEvaluation[]
  /** 전체 기간 평가 스냅샷 1건 이상. */
  hasEvaluations: boolean
}
