/**
 * 오늘의 회화(task-010) 화면 ↔ 서버 DTO — api-contract §2-12 #56 · §2-13 #58~#62·#62a~#62c 의 필드명 그대로.
 * 서버 모듈을 import 하지 않는다(컴포넌트는 서버 코드를 끌어오지 않는다 — module-dependency §3 규칙 5).
 */
import type { ChallengeProgress } from './challenge'
import type { ChunkType, ProposalDto } from './chat'
import type { NextReviewDetail, ReviewItem, TodayReviewFields } from './review'

export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
export type LessonStatus = 'GENERATING' | 'READY' | 'IN_PROGRESS' | 'DONE' | 'FAILED'
export type LessonKind = 'NEW' | 'REVIEW'

/* ── #56 ─────────────────────────────────────────────────────────── */

export interface TopicChunk {
  id: string
  chunkType: ChunkType
  textJa: string
  reading: string | null
  meaningKo: string
  order: number
}

export interface Topic {
  id: string
  title: string
  titleJa: string | null
  level: JlptLevel
  description: string | null
  tags: string[]
  isSeed: boolean
  chunks: TopicChunk[]
  lessonCount: number
  lastLessonAt: string | null
  lastLessonTitle?: string | null
}

export interface TopicList {
  items: Topic[]
  level: JlptLevel[]
}

/* ── #58 ─────────────────────────────────────────────────────────── */

export interface NextPreview {
  titleKo: string
  teaserKo: string
}

export interface TodayLessonItem {
  id: string
  kind: LessonKind
  status: LessonStatus
  title: string
  titleKo: string | null
  stageDone: number
  topic: { id: string; title: string } | null
  /** 상황 수업(task-010d A2)이면 그 상황 id — additive(옛 응답에는 없다). */
  scenarioId?: string | null
  score: number | null
  jobId: string | null
  speaking?: { used: number; total: number } | null
}

export interface LessonRecommendation {
  topicId: string
  topicTitle: string
  level: JlptLevel
  /** CHALLENGE(task-041) = 진행 중 챌린지 주제 — 오늘 그 주제 새 수업을 아직 안 끝냈을 때 최우선. */
  reason: 'CONTINUE' | 'NEXT_TOPIC' | 'START' | 'CHALLENGE'
  nextPreview: NextPreview | null
}

/** #58 — 복습 칸(`review`·`guard`·`decisionPending`·`nextReview`, task-010b)은 `TodayReviewFields`(전부 선택). */
export interface TodayLessons extends TodayReviewFields {
  mode: 'NEW' | 'REVIEW' | 'BOTH'
  date: string
  todayLessons: TodayLessonItem[]
  resume: { id: string; title: string; titleKo: string | null; stageDone: number; date: string } | null
  recommendation: LessonRecommendation | null
}

/* ── #59 ─────────────────────────────────────────────────────────── */

export interface CreateLessonResult {
  lessonId: string
  jobId: string | null
  status: LessonStatus
  reused: boolean
}

/* ── #60 ─────────────────────────────────────────────────────────── */

export interface DialogueLine {
  speaker: 'A' | 'B'
  ja: string
  reading: string
  ko: string
  segment: number
}

export interface LessonChunk {
  id: string
  textJa: string
  reading: string
  meaningKo: string
  chunkType: ChunkType
  isNew: boolean
}

export interface LessonGrammar {
  id: string
  pattern: string
  explanationKo: string
  exampleJa: string
  exampleReading: string
  exampleKo: string
}

export interface LessonQuiz {
  id: string
  promptKo: string | null
  promptJa: string | null
  choices: string[]
  answer: number
  targetIds: string[]
  explanationKo: string
}

export interface LessonApplication {
  id: string
  promptKo: string
  hintJa: string | null
  modelAnswerJa: string
  modelReading: string
  modelKo: string
  targetIds: string[]
}

export interface LessonSpeaking {
  id: string
  promptKo: string
  targetIds: string[]
  modelAnswerJa: string
  modelReading: string
  modelKo: string
}

export interface LessonContent {
  v: 1
  title: string
  titleKo: string
  rolesKo: { A: string; B: string }
  dialogue: DialogueLine[]
  segmentCount: number
  chunks: LessonChunk[]
  grammar: LessonGrammar[]
  quiz: LessonQuiz[]
  application: LessonApplication[]
  speaking: LessonSpeaking[]
  nextPreview: NextPreview
}

export interface MemoDraft {
  segment: number
  ja: string
}

export interface MemoProcessed {
  ja: string
  segment: number
  result: 'PROPOSED' | 'IN_WORDBOOK'
  proposalId: string | null
  wordId: string | null
}

export interface SpeakingEntry {
  itemId: string
  text: string
  matchedIds: string[]
  missedIds: string[]
  utteranceId: string | null
  at: string
}

export interface LessonProgress {
  listen?: { segmentsDone?: number[]; played?: { slow?: number[]; normal?: number[] }; memo?: MemoDraft[]; proposed?: MemoProcessed[] }
  quiz?: { answers: (number | null)[] }
  application?: { answers: (string | null)[] }
  speaking?: SpeakingEntry[]
}

export interface LessonDto {
  id: string
  kind: LessonKind
  date: string
  title: string
  titleKo: string | null
  level: JlptLevel
  status: LessonStatus
  stageDone: number
  progress: LessonProgress
  score: number | null
  source: 'TOPIC' | 'TEXT'
  topic: { id: string; title: string } | null
  /** 상황 수업(task-010d A2 — #59 `{scenarioId}`)이면 그 상황 id, 아니면 null — additive(옛 응답에는 없다). 수업 종료 카드 `le-scenario-lesson` 이 읽는다. */
  scenarioId?: string | null
  content: LessonContent | null
  jobId: string | null
  error: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  /** 복습 레슨이면 그 일정 id(#63 다시 만들기) — task-010b additive. */
  reviewScheduleId?: string | null
  /** 복습 레슨의 이번 항목(#60, 모든 status — ★②). 새 수업·#61 응답이면 없음/null. */
  reviewItems?: ReviewItem[] | null
  /** 끝낸 복습 레슨의 다음 복습(#60, Leader ⑤). 판단 대기면 null. */
  nextReview?: NextReviewDetail | null
}

/** #61 본문의 progress — 클라이언트 칸만. */
export interface ProgressPatch {
  listen?: { segmentsDone?: number[]; played?: { slow?: number[]; normal?: number[] }; memo?: MemoDraft[] }
  quiz?: { answers: (number | null)[] }
  application?: { answers: (string | null)[] }
}

/* ── #62 ─────────────────────────────────────────────────────────── */

export interface CompleteResult {
  lesson: { id: string; status: 'DONE'; score: number; stageDone: number; completedAt: string }
  studyLogId: string
  /** 강사 복습 판단 잡(#55) — 복습 레슨일 때만(task-010b additive). */
  reviewDecisionJobId?: string | null
  /** #60 `nextReview` 와 같은 모양(★⑤). 판단 대기면 null. */
  nextReview?: NextReviewDetail | null
  /** 진행 중 챌린지 과제로 세어졌을 때만 값(task-041, additive) — 복습·붙여넣기·다른 주제·기간 밖·계산 실패는 null. `words` 는 수업이라 늘 null. */
  challenge?: ChallengeProgress | null
  result: {
    score: number
    quiz: { correct: number; total: number; answered: number }
    applicationDone: number
    expressions: { usedIds: string[]; missedIds: string[] }
    nextPreview: NextPreview | null
  }
}

/* ── #62a·#62b·#62c ────────────────────────────────────────────────── */

export type MemoSkipReason = 'IN_WORDBOOK' | 'DUPLICATE' | 'LIMIT' | 'NOT_JAPANESE' | 'ENRICH_FAILED'

export interface MemoResult {
  proposals: ProposalDto[]
  skipped: { surface: string; reason: string; wordId?: string }[]
  memo: { count: number; limit: number }
}

export interface SpeakingResult {
  itemId: string
  used: boolean
  matchedIds: string[]
  missedIds: string[]
  unknownIds: string[]
  modelAnswer: { ja: string; reading: string; ko: string } | null
  utteranceId: string | null
  hasAudio: boolean
}

export type AudioKind = 'dialogue' | 'grammar' | 'application' | 'speaking' | 'chunk'
export type AudioPace = 'slow' | 'normal'

export interface LessonAudioResult {
  clips: { url: string; durationMs: number | null; pauseBeforeMs: number; cached: boolean }[]
}
