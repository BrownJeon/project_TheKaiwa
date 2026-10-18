/**
 * 챌린지(task-040 설계 `docs/design/challenge.md` §9, 구현 task-041) 화면 ↔ 서버 DTO — #155~#159 응답과 #62·#70·#71 의 `challenge?` 칸.
 * 서버 모듈을 import 하지 않는다. 서버(`learning/challenges`)도 이 타입을 그대로 쓴다(응답 모양의 단일 출처). enum 문자열은 `prisma/schema.prisma` 값과 같다.
 */
import type { JlptLevel } from './lesson'

export type ChallengeStatus = 'ACTIVE' | 'COMPLETED' | 'ENDED'
/** 하루 표시 상태(저장 안 함 — 계산값, 끝난 챌린지는 `result.days[]` 에 얼림). */
export type ChallengeDayState = 'UPCOMING' | 'TODAY' | 'MET' | 'PARTIAL' | 'MISSED' | 'STOPPED'
export type ChallengeLength = 7 | 14 | 30
export type ChallengeWordCount = 5 | 10 | 15
/** COMPLETED 는 null · ENDED 는 USER(#159) | TOPIC_REMOVED(주제가 끊김 — 1단계 도달 불가). */
export type ChallengeEndReason = 'USER' | 'TOPIC_REMOVED'

/** 만들 때 얼린 하루 목표. `words:false` 면 `wordCount`·`wordsMinAnswered` = null. `countSkipped` 는 1단계 늘 false. */
export interface ChallengeDailyGoal {
  lesson: boolean
  words: boolean
  wordCount: number | null
  /** 인정 장수 = ceil(4 × wordCount / 5) — 5·10·15 → 4·8·12. 그날 주제 세트들의 (맞힘+틀림) 합계가 이 값 이상이면 단어 과제 인정. */
  wordsMinAnswered: number | null
  countSkipped: boolean
  ruleVersion: number
}

export interface ChallengeStats {
  /** n일째(시작 전 0). 끝난 챌린지는 COMPLETED = N, ENDED = 그만둔 날의 n. */
  dayIndex: number
  elapsedDays: number
  metDays: number
  /** 0~1(소수 둘째 자리). 지난 날 0 이면 null("—"). */
  rate: number | null
  /** 수행 연속(오늘 유예) — 진행 중일 때만, 끝난 챌린지는 null. */
  streak: number | null
  longestStreak: number
  todayMet: boolean
}

export interface ChallengeSummary {
  id: string
  title: string
  /** `id` = null 이면 주제가 지워짐(`exists:false`). 제목은 만들 때 얼린 스냅샷. */
  topic: { id: string | null; title: string; exists: boolean }
  level: JlptLevel
  lengthDays: number
  startDate: string
  endDate: string
  status: ChallengeStatus
  dailyGoal: ChallengeDailyGoal
  stats: ChallengeStats
  endedAt: string | null
}

/** 그날 인정된 수업 — 점수 추이는 그날 가장 많이 맞힌 수업(동점이면 나중 것), `lessonId` 도 같은 수업. */
export interface ChallengeDayLesson {
  done: number
  quizCorrect: number
  quizTotal: number
  lessonId: string | null
  refExists: boolean
}

/** 그날 주제 세트 합계. `sets` = 답한 카드(맞힘+틀림) ≥ 1 인 세트만. `need`·`ok` 는 단어 과제가 꺼져 있으면 null. `sessionId` = 그날 가장 많이 푼 세트. */
export interface ChallengeDayWords {
  sets: number
  correct: number
  wrong: number
  skipped: number
  cardCount: number
  answered: number
  need: number | null
  ok: boolean | null
  sessionId: string | null
  refExists: boolean
}

export interface ChallengeDay {
  date: string
  dayIndex: number
  state: ChallengeDayState
  goalMetAt: string | null
  lesson: ChallengeDayLesson | null
  words: ChallengeDayWords | null
}

/** #157 만 — 이 주제의 지금 상태(챌린지 전 공부 포함). 익힘 = correctCount ≥ 2 && correctCount > wrongCount · 공부 = studiedCount ≥ 1. */
export interface ChallengeTopicProgress {
  chunkTotal: number
  chunkStudied: number
  chunkMastered: number
  lessonExprCount: number
  lessonsDone: number
  aiWordTotal: number
  aiWordStudied: number
  aiWordMastered: number
}

export interface ChallengeTotals {
  lessonsDone: number
  /** 답한 카드 ≥ 1 인 세트만. */
  wordSets: number
  wordsCorrect: number
}

/** `Challenge.result` — 끝날 때 한 번 쓰고 이후 불변. `days[].quiz` = [맞힘, 문항] · `days[].words` = [맞힘, 틀림, 건너뜀, 카드 수, 세트 수]. */
export interface ChallengeResultDay {
  date: string
  state: ChallengeDayState
  quiz: [number, number] | null
  words: [number, number, number, number, number] | null
}

export interface ChallengeResult {
  ruleVersion: number
  endReason: ChallengeEndReason | null
  metDays: number
  partialDays: number
  missedDays: number
  stoppedDays: number
  elapsedDays: number
  rate: number | null
  longestStreak: number
  lessonsDone: number
  wordSets: number
  wordsCorrect: number
  days: ChallengeResultDay[]
}

export type ChallengeWordsTaskState = 'TODO' | 'IN_PROGRESS' | 'SHORT' | 'DONE'
export type ChallengeLessonTaskState = 'TODO' | 'GENERATING' | 'READY' | 'IN_PROGRESS' | 'CONTINUE' | 'DONE' | 'FAILED'

export interface ChallengeWordsTask {
  kind: 'WORDS'
  state: ChallengeWordsTaskState
  sessionId: string | null
  wordCount: number | null
  minAnswered: number | null
  /** 그날 끝낸 주제 세트 합계(풀고 있는 세트는 안 들어 있음). */
  answered: number
  sets: number
}

export interface ChallengeLessonTask {
  kind: 'LESSON'
  /** GENERATING 은 생성 잡이 살아 있을 때만 — 죽은 잡이면 표시만 FAILED. CONTINUE = 어제 이전에 만든 챌린지 주제 수업을 이어서. */
  state: ChallengeLessonTaskState
  lessonId: string | null
  jobId: string | null
}

export type ChallengeTask = ChallengeWordsTask | ChallengeLessonTask

/** 오늘 할 일(순서 = 화면 순서: 단어 → 회화). 꺼진 과제는 `tasks` 에 없다. 풀 크기는 싣지 않는다. */
export interface ChallengeTodayTasks {
  date: string
  dayIndex: number
  topic: { id: string; title: string } | null
  tasks: ChallengeTask[]
  goalMet: boolean
}

export interface ChallengeDetail extends ChallengeSummary {
  days: ChallengeDay[]
  topicProgress: ChallengeTopicProgress | null
  totals: ChallengeTotals
  today: ChallengeTodayTasks | null
  result: ChallengeResult | null
}

export interface ChallengeResultBrief {
  lengthDays: number
  metDays: number
  elapsedDays: number
  rate: number | null
  longestStreak: number
  endReason: ChallengeEndReason | null
}

/** #158 */
export interface ChallengeTodayResponse {
  challenge: ChallengeSummary | null
  /** 진행 중이고 기간 안일 때만(내일 시작이면 null). */
  today: ChallengeTodayTasks | null
  /** `endedAt` 이 어제 00:00 KST 이후인 끝난 챌린지 1개(진행 중 챌린지가 있어도 실린다 — [다시 도전] 노출은 화면이 정한다). */
  recentlyEnded: { id: string; status: 'COMPLETED' | 'ENDED'; title: string; endedAt: string; result: ChallengeResultBrief } | null
}

/** #155 */
export interface ChallengeListResponse {
  items: ChallengeSummary[]
  nextCursor: string | null
}

/** #156 요청 */
export interface CreateChallengeBody {
  topicId: string
  lengthDays: ChallengeLength
  start: 'TODAY' | 'TOMORROW'
  dailyGoal: { lesson: boolean; words: boolean; wordCount?: ChallengeWordCount }
  title?: string
  /** task-076 챌린지 난이도 — 생략하면 주제 난이도. 만들 때 얼린다. */
  level?: JlptLevel
}

/** #62·#51 응답의 `challenge` — 값이 나오는 조건 밖은 전부 null(설계서 §5-4). `words` 는 세트일 때만. */
export interface ChallengeProgress {
  challengeId: string
  /** 그 공부가 세어진 날(세트 = 시작한 날, 수업 = 끝낸 날) — 어제일 수 있다("어제 목표도 채웠어요"). */
  date: string
  dayIndex: number
  goalMet: boolean
  /** 이 공부가 그날을 달성으로 바꾼 바로 그 공부일 때만 true(토스트 1번). */
  goalMetNow: boolean
  words: { answered: number; need: number } | null
}

/** #70 `days[].challenge` */
export interface CalendarChallengeDay {
  challengeId: string
  dayIndex: number
  state: ChallengeDayState
}

/** #70 `summary.challenge` — 진행 중 챌린지가 있을 때만. */
export interface CalendarChallengeSummary {
  id: string
  metDays: number
  elapsedDays: number
  streak: number | null
}

/** #71 `challenge` */
export interface DayChallenge {
  challengeId: string
  title: string
  dayIndex: number
  state: ChallengeDayState
  lesson: { quizCorrect: number; quizTotal: number } | null
  /**
   * `need` = 그 챌린지가 만들 때 얼린 인정 장수(`dailyGoal.wordsMinAnswered` = ceil(4n/5)) — 하루 시트 "단어 n/need장"의 분모.
   * 단어 과제를 끈 챌린지면 `ok` 와 함께 null(주제 세트를 풀었으면 맞힘·틀림은 보인다).
   */
  words: { correct: number; wrong: number; skipped: number; cardCount: number; ok: boolean | null; need: number | null } | null
}
