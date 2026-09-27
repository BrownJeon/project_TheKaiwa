/**
 * 단어장·오늘의 단어 화면의 클라이언트 DTO — api-contract §2-9(#40~#46b)·§2-10(#47~#54, task-008 F1~F9 개정) 응답 모양을
 * **그대로 옮긴** 타입이다. 서버 모듈(Prisma 타입)을 import 하지 않는다. enum 문자열은 `prisma/schema.prisma` 값과 같다.
 * 계약에 "선택"으로 적힌 필드나 상태에 따라 빠지는 필드는 `?` 로 둔다(화면은 없을 때를 늘 다룬다).
 */
import type { ChunkType, Paged, PartOfSpeech } from './chat'

export type { ChunkType, Paged, PartOfSpeech }

export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
export type WordSource = 'MANUAL' | 'CORRECTION' | 'LESSON' | 'EVALUATION' | 'TUTOR' | 'SEED'
export type VocabAnswer = 'CORRECT' | 'WRONG' | 'SKIPPED'
export type VocabMode = 'CHOICE' | 'FLIP'
export type VocabSessionStatus = 'IN_PROGRESS' | 'DONE' | 'ABANDONED'
export type WordSort = 'recent' | 'wrong' | 'surface'

/** 공통 `WordEntry`(§2-9) */
export interface WordEntry {
  id: string
  surface: string
  reading: string | null
  meaning: string
  partOfSpeech: PartOfSpeech
  chunkType?: ChunkType | null
  jlpt?: JlptLevel | null
  example?: string | null
  exampleKo?: string | null
  note?: string | null
  category: string | null
  source: WordSource
  sourceRefId?: string | null
  correctCount: number
  wrongCount: number
  lastSeenAt?: string | null
  lastResult?: VocabAnswer | null
  archived: boolean
  archivedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

/** #40 */
export interface WordListPage {
  items: WordEntry[]
  nextCursor: string | null
  total: number | null
}

/** #42 — `WordEntry` + stats + corrections */
export interface WordStats {
  attempts: number
  last7d: { correct: number; wrong: number }
  evalAppearances: number
}

export interface WordDetail {
  word: WordEntry
  stats: WordStats | null
  corrections: { id: string; chatId: string }[]
}

/** #46 항목. `archivedCount` 는 F6(보관 개수), `category:null` = 분류 없음 */
export interface CategoryCount {
  category: string | null
  count: number
  archivedCount?: number
}

/** #41 `enrich:true` 초안(A10). 전부 비어 있을 수 있다. `valid:false` 면 일본어 단어로 보기 어려운 입력(F8). */
export interface WordDraft {
  valid?: boolean
  invalidReason?: string | null
  reading?: string | null
  meaning?: string | null
  partOfSpeech?: PartOfSpeech | null
  jlpt?: JlptLevel | null
  example?: string | null
  exampleKo?: string | null
}

export interface WordEnrichResponse {
  draft: WordDraft
  saved: false
}

export interface WordSaveResponse {
  word: WordEntry
  saved: true
}

/** #41 저장 본문(선택값은 비면 보내지 않는다) */
export interface WordCreateBody {
  surface: string
  meaning: string
  partOfSpeech: PartOfSpeech
  reading?: string
  jlpt?: JlptLevel
  example?: string
  exampleKo?: string
  note?: string
  category?: string
}

/** #43 본문 — 바뀐 필드만, 비운 선택값은 null. 카운터·source 는 넣지 않는다. */
export type WordPatchBody = Partial<{
  surface: string
  meaning: string
  partOfSpeech: PartOfSpeech
  reading: string | null
  jlpt: JlptLevel | null
  example: string | null
  exampleKo: string | null
  note: string | null
  category: string | null
}>

/** #44 */
export interface WordDeleteResponse {
  deleted: boolean
  snapshotKept?: boolean
}

/** #45 — `archived`·`archivedAt`(서버가 WordEntry 전체를 줘도 같은 필드로 병합한다) */
export interface WordArchiveResponse extends Partial<WordEntry> {
  archived: boolean
  archivedAt?: string | null
}

/** #46b */
export interface SeedPackResult {
  added: number
  skipped: number
}

// ── 오늘의 단어 ───────────────────────────────────────────────────────────────────────────────

/** #47·#49 `session`. DONE 이면 개수·걸린 시간·보관·다시 풀기 원본이 붙는다(F4). */
export interface VocabSessionInfo {
  id: string
  date: string
  mode: VocabMode
  requestedCount: number
  cardCount: number
  status: VocabSessionStatus
  startedAt?: string
  downgraded?: boolean
  correctCount?: number
  wrongCount?: number
  skippedCount?: number
  durationSec?: number | null
  keptAt?: string | null
  replayOfId?: string | null
  finishedAt?: string | null
}

/**
 * #47·#49 카드. CHOICE 미답 카드는 정답(`answer`·`correctText`·`meaning`)이 **없다**(서버만 안다).
 * FLIP 카드는 자기 채점이라 `meaning`·`example`·`exampleKo` 가 처음부터 온다(F1).
 */
export interface VocabCard {
  order: number
  wordId: string | null
  surface: string
  reading: string | null
  choices?: string[] | null
  flagged: boolean
  answered: boolean
  answer?: VocabAnswer | null
  correctText?: string | null
  chosenText?: string | null
  example?: string | null
  exampleKo?: string | null
  meaning?: string | null
  answeredAt?: string | null
}

export type EmptyReason = 'NO_WORDS' | 'ALL_DONE_TODAY' | 'NO_WORDS_IN_CATEGORY'

/** #47·#53 */
export type CreateSessionResult =
  | { session: VocabSessionInfo; cards: VocabCard[]; empty?: undefined }
  | { session: null; empty: { reason: EmptyReason; cta?: string[] }; cards?: undefined }

/** #49 */
export interface SessionDetail {
  session: VocabSessionInfo
  cards: VocabCard[]
}

/** #50 본문 */
export type AttemptBody =
  | { order: number; chosenText: string; responseMs: number; flagged?: boolean }
  | { order: number; selfResult: 'CORRECT' | 'WRONG'; responseMs: number }
  | { order: number; skipped: true }
  | { order: number; flagged: boolean }

/** #50 응답(답) */
export interface AttemptResult {
  order: number
  answer: VocabAnswer
  correctText: string | null
  chosenText: string | null
  example?: string | null
  exampleKo?: string | null
  answeredAt?: string
  flagged?: boolean
}

/** #50 응답(표시 전용, F9) */
export interface FlagResult {
  order: number
  flagged: boolean
}

/** #51 */
export interface FinishResult {
  session: {
    id: string
    status: VocabSessionStatus
    correctCount: number
    wrongCount: number
    skippedCount: number
    durationSec: number | null
  }
  studyLogId: string | null
  wrongWords: { wordId: string | null; surface: string; correctText: string | null }[]
  flaggedCount: number
}

/** #48 항목(F3) */
export interface SessionSummary {
  id: string
  date: string
  mode: VocabMode
  cardCount: number
  answeredCount?: number
  correctCount: number
  wrongCount: number
  skippedCount: number
  status: VocabSessionStatus
  keptAt: string | null
  replayOfId: string | null
  durationSec?: number | null
  startedAt?: string
}

/** #54 */
export interface VocabStats {
  byCount: { cardCount: number; sessions: number; correct: number; wrong: number; skipped: number }[]
  daily: { date: string; correct: number; wrong: number }[]
  streakDays: number
}
