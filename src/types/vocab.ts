/**
 * 단어장·오늘의 단어 화면의 클라이언트 DTO — api-contract §2-9(#40~#46, task-068 개정)·§2-10(#47~#54, task-008 F1~F9 개정) 응답 모양을
 * **그대로 옮긴** 타입이다. 서버 모듈(Prisma 타입)을 import 하지 않는다. enum 문자열은 `prisma/schema.prisma` 값과 같다.
 * 계약에 "선택"으로 적힌 필드나 상태에 따라 빠지는 필드는 `?` 로 둔다(화면은 없을 때를 늘 다룬다).
 */
import type { ChunkType, Paged, PartOfSpeech } from './chat'
import type { ChallengeProgress } from './challenge'

export type { ChunkType, Paged, PartOfSpeech }

export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
export type WordSource = 'MANUAL' | 'CORRECTION' | 'LESSON' | 'EVALUATION' | 'TUTOR' | 'SEED'
export type VocabAnswer = 'CORRECT' | 'WRONG' | 'SKIPPED'
export type VocabMode = 'CHOICE' | 'FLIP'
export type VocabSessionStatus = 'IN_PROGRESS' | 'DONE' | 'ABANDONED'
export type WordSort = 'recent' | 'wrong' | 'surface'

/**
 * 단어 전용 조각 5유형(task-068 D4 B) — 교정·수업·주제·평가 DTO 의 `ChunkType`(4유형)은 넓히지 않는다(J12, screens.md §28-3 C).
 * 순서 = 칩·폼·시험 모두 이 순서.
 */
export type WordChunkType = ChunkType | 'EXPRESSION'
export const WORD_CHUNK_TYPES: readonly WordChunkType[] = ['NAME', 'ACTION', 'FEELING', 'MODIFIER', 'EXPRESSION']
/** #40 `chunkType` 조건 — 다섯 값 중 하나(task-068: `none` 폐지 — 서버가 400). 옛 이름을 별칭으로 남긴다. */
export type WordChunkFilter = WordChunkType

/** `BASE` = 공용 기본 단어(읽기 전용) · `MINE` = 요청한 사용자의 단어(task-068 §2-9 개정). */
export type WordOrigin = 'BASE' | 'MINE'
/** #40 `source` — 출처 분절(D10 A). */
export type WordListSource = 'all' | 'mine' | 'base'
export const WORD_LIST_SOURCES: readonly WordListSource[] = ['all', 'mine', 'base']

/** 단어 오류의 `details.code`(task-068 §2-9 개정 ③) — 403 기본 단어 수정·삭제 · 409 기본 단어와 같은 표기(·읽기). */
export type WordErrorCode = 'READ_ONLY' | 'BASE_DUPLICATE'
export const WORD_ERROR_CODE = { readOnly: 'READ_ONLY', baseDuplicate: 'BASE_DUPLICATE' } as const satisfies Record<string, WordErrorCode>

/**
 * 공통 `WordEntry`(§2-9). 상태 칸(`correctCount`…`archivedAt`)은 늘 **요청한 사용자의** 값(`UserWordState`, task-068).
 * `origin`·`readOnly` 는 서버가 늘 주지만 옛 응답에는 없을 수 있어 `?` — 둘 다 없으면 화면은 내 단어로 본다(§28-5 B).
 */
export interface WordEntry {
  id: string
  surface: string
  reading: string | null
  meaning: string
  partOfSpeech: PartOfSpeech
  chunkType?: WordChunkType | null
  jlpt?: JlptLevel | null
  example?: string | null
  exampleKo?: string | null
  note?: string | null
  category: string | null
  source: WordSource
  sourceRefId?: string | null
  origin?: WordOrigin
  readOnly?: boolean
  correctCount: number
  wrongCount: number
  lastSeenAt?: string | null
  lastResult?: VocabAnswer | null
  archived: boolean
  archivedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

/**
 * #40 쪽 번호 응답(task-068 — `cursor`·`nextCursor` 폐지). `page` 는 1부터(요청 값 그대로 — 쪽 수보다 크면 `items: []`),
 * `pages = max(1, ⌈total / limit⌉)`, `baseTotal` = 기본 단어 전체 수(조건·보관과 무관 — 안내 띠 숫자).
 */
export interface WordListPage {
  items: WordEntry[]
  total: number
  page: number
  pages: number
  limit: number
  baseTotal: number
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
  /** 선생님이 고른 조각(task-068 `wordEnrich@v2` — `valid:false` 면 null, 옛 캐시 초안이면 없음). */
  chunkType?: WordChunkType | null
  /** 서버가 남겨 두지만 화면은 쓰지 않는다(내 단어는 수준을 고르지 않는다 — §28-4 D). */
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

/** #41 저장 본문(선택값은 비면 보내지 않는다). task-068: `jlpt` 키는 서버가 거절(400) — 폼은 `chunkType` 을 늘 보낸다. */
export interface WordCreateBody {
  surface: string
  meaning: string
  partOfSpeech: PartOfSpeech
  chunkType?: WordChunkType
  reading?: string
  example?: string
  exampleKo?: string
  note?: string
  category?: string
}

/** #43 본문 — 바뀐 필드만, 비운 선택값은 null. 카운터·source·`jlpt` 는 넣지 않는다(task-068: `jlpt` 400, `chunkType: null` 400). */
export type WordPatchBody = Partial<{
  surface: string
  meaning: string
  partOfSpeech: PartOfSpeech
  chunkType: WordChunkType
  reading: string | null
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

// ── 오늘의 단어 ───────────────────────────────────────────────────────────────────────────────

/**
 * 세션의 `topic`(task-042 주제 단어 세트) — 주제 세트만, 내 단어장 세트면 null. 두 수는 그 세트 카드에서 센 값이라
 * 새로 고침·이어 풀기·다시 풀기 뒤에도 같다: `lessonCardCount` = 지난 수업 표현 카드 수, `aiCardCount` = AI 새 단어 카드 수.
 */
export interface VocabSessionTopic {
  id: string
  title: string
  lessonCardCount: number
  aiCardCount: number
}

/** #47 주제 세트 응답에만 — 새 단어를 만들었는지·폴백 사유(저장 안 함, 새로 고침 뒤에는 없다). */
export type TopicGenerationSource = 'AI' | 'MIXED' | 'TOPIC'
export type TopicGenerationReason = 'SHORT' | 'NEW_DONE' | 'TIMEOUT' | 'FAILED' | 'INVALID' | 'LIMIT' | 'SKIPPED'
export interface TopicGeneration {
  source: TopicGenerationSource
  generatedNow: boolean
  reason: TopicGenerationReason | null
}

/** #47 본문 — `topicId` 가 있으면 주제 세트(`category` 와 함께 보내지 않는다). `generate:false` = [주제 표현으로 바로 풀기]. */
export interface CreateSessionBody {
  count?: number
  mode?: VocabMode
  category?: string | null
  topicId?: string
  generate?: boolean
}

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
  topic?: VocabSessionTopic | null
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

/** `TOPIC_EMPTY`·`TOPIC_ALL_DONE_TODAY` 는 주제 세트(CTA `MY_WORDS` — 내 단어장으로 풀기). */
export type EmptyReason = 'NO_WORDS' | 'ALL_DONE_TODAY' | 'NO_WORDS_IN_CATEGORY' | 'TOPIC_EMPTY' | 'TOPIC_ALL_DONE_TODAY'

/** #47·#53. 409 는 `{sessionId}`(풀던 세트) 또는 `{reason:'GENERATING'}`(같은 사용자가 새 단어를 만드는 중). */
export type CreateSessionResult =
  | { session: VocabSessionInfo; cards: VocabCard[]; empty?: undefined; generation?: TopicGeneration }
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
    topic?: VocabSessionTopic | null
  }
  studyLogId: string | null
  /** `source` — `WORD` 단어장 카드 · `TOPIC` 주제 카드(`wordId` null → [단어장에 넣기]). */
  wrongWords: { wordId: string | null; surface: string; reading?: string | null; correctText: string | null; source?: 'WORD' | 'TOPIC' }[]
  flaggedCount: number
  /** 진행 중 챌린지의 그 주제 세트일 때만 값(그날 합계 `words.answered`·인정 장수 `need`·`goalMetNow` 토스트) — 그 밖은 null. */
  challenge?: ChallengeProgress | null
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
  topic?: VocabSessionTopic | null
}

/** #54 */
export interface VocabStats {
  byCount: { cardCount: number; sessions: number; correct: number; wrong: number; skipped: number }[]
  daily: { date: string; correct: number; wrong: number }[]
  streakDays: number
}
