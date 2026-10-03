/**
 * 단어장·오늘의 단어의 한국어 라벨·문구 표(screens.md §4-8·§5-8). 순수 모듈.
 *
 * **오류 문구는 서버 `message` 가 아니라 이 표에서 고른다**(400 VALIDATION 만 예외) — 서버 기본 문구에는 구현 용어가
 * 섞일 수 있다(task-006 D8). 엔진·모델명·traceId 는 어디에도 없다. "AI"·엔진 대신 "선생님"으로 쓴다.
 */
import type { ChunkType, JlptLevel, PartOfSpeech, SeedPackResult, VocabAnswer, VocabMode, WordChunkFilter, WordSource } from '@/types/vocab'

export interface ErrorLike {
  status: number
  message?: string
}

// ── 라벨 ⓔ ──────────────────────────────────────────────────────────────────────────────────

export const POS_OPTIONS: readonly { value: PartOfSpeech; label: string }[] = [
  { value: 'NOUN', label: '명사' },
  { value: 'VERB', label: '동사' },
  { value: 'ADJ_I', label: 'い형용사' },
  { value: 'ADJ_NA', label: 'な형용사' },
  { value: 'ADVERB', label: '부사' },
  { value: 'PARTICLE', label: '조사' },
  { value: 'EXPRESSION', label: '표현' },
  { value: 'OTHER', label: '기타' },
]

export const POS_LABEL: Record<PartOfSpeech, string> = Object.fromEntries(POS_OPTIONS.map((o) => [o.value, o.label])) as Record<
  PartOfSpeech,
  string
>

export const JLPT_LEVELS: readonly JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

export const SOURCE_SENTENCE: Record<WordSource, string> = {
  MANUAL: '직접 넣은 단어예요',
  CORRECTION: '채팅 교정에서 채택한 표현이에요',
  SEED: '기본 단어(N5) 팩에서 넣었어요',
  TUTOR: '선생님 제안을 채택한 단어예요',
  LESSON: '레슨에서 넣은 단어예요',
  EVALUATION: '평가에서 넣은 단어예요',
}

/** 조각 라벨 — 상세 뱃지·목록 행 뱃지(task-023: 목록의 출처 뱃지를 이 뱃지로 바꿨다, 조각이 없으면 뱃지 없음). */
export const CHUNK_LABEL: Record<ChunkType, string> = {
  NAME: '이름 조각',
  ACTION: '액션 조각',
  FEELING: '느낌 조각',
  MODIFIER: '꾸밈 조각',
}

/**
 * 단어장 조각 줄 칩(task-023). 칩 글자는 짧게 두고, 화면 읽기는 `sr` 를 이어 읽어 "액션 조각"처럼 들린다.
 * 순서는 이름·액션·느낌·꾸밈·없음(없음 = 조각이 정해지지 않은 단어, #40 `chunkType=none`).
 */
export const CHUNK_FILTER_ALL = { label: '전체', sr: ' (모든 조각)' } as const
export const CHUNK_FILTER_CHIPS: readonly { value: WordChunkFilter; label: string; sr: string }[] = [
  { value: 'NAME', label: '이름', sr: ' 조각' },
  { value: 'ACTION', label: '액션', sr: ' 조각' },
  { value: 'FEELING', label: '느낌', sr: ' 조각' },
  { value: 'MODIFIER', label: '꾸밈', sr: ' 조각' },
  { value: 'none', label: '없음', sr: ' (조각이 정해지지 않은 단어)' },
]

/** 조건 문구에 쓰는 조각 이름 — "액션 조각" / "조각 없음". */
export function chunkFilterName(v: WordChunkFilter): string {
  return v === 'none' ? '조각 없음' : CHUNK_LABEL[v]
}

export const RESULT_LABEL: Record<VocabAnswer, string> = { CORRECT: '맞힘', WRONG: '틀림', SKIPPED: '건너뜀' }
export const RESULT_TONE: Record<VocabAnswer, 'good' | 'bad' | 'neutral'> = { CORRECT: 'good', WRONG: 'bad', SKIPPED: 'neutral' }

export const MODE_LABEL: Record<VocabMode, string> = { CHOICE: '4지선다', FLIP: '뒤집기 카드' }

// ── 공통 ────────────────────────────────────────────────────────────────────────────────────

export const NETWORK_ERROR = '연결하지 못했어요. 네트워크를 확인해 주세요.'
export const GENERIC_ERROR = '처리하지 못했어요. 다시 시도해 주세요.'
export const WORD_NOT_FOUND = '단어를 찾을 수 없어요. 삭제되었을 수 있어요.'

/** 버튼 동작(수정·보관·삭제·기본 단어 등)의 봉투 오류. 400 만 서버 문구. */
export function actionErrorText(e: ErrorLike): string {
  if (e.status === 400 && e.message) return e.message
  if (e.status === 0) return NETWORK_ERROR
  if (e.status === 404) return WORD_NOT_FOUND
  return GENERIC_ERROR
}

// ── 단어장 ⓐ·ⓑ·ⓓ ────────────────────────────────────────────────────────────────────────────

export function listErrorText(e: ErrorLike): string {
  return e.status === 0 ? NETWORK_ERROR : '단어장을 불러오지 못했어요.'
}

/** 목록 머리의 걸린 조건(task-023) — "N5 기초 · 느낌 조각". 분류·조각 모두 없으면 null. */
export function listConditionText(f: { category: string | null; chunk?: WordChunkFilter | null }): string | null {
  const parts: string[] = []
  if (f.category !== null) parts.push(f.category)
  if (f.chunk) parts.push(chunkFilterName(f.chunk))
  return parts.length ? parts.join(' · ') : null
}

/** 조각을 고른 채 결과가 0일 때의 제목·본문(task-023 데모 `list-empty`·`list-search-empty`). 검색 제목은 화면이 그린다(lang 표시). */
export function chunkEmptyText(f: { q: string; category: string | null; chunk: WordChunkFilter; archived: boolean }): { title: string | null; body: string | null } {
  const name = chunkFilterName(f.chunk)
  if (f.q) return { title: null, body: `${name}${f.category !== null ? ` · ${f.category}` : ''} 안에서 찾았어요.` }
  if (f.category !== null) return { title: `‘${f.category}’에 ${name} 단어가 없어요`, body: '분류와 조각을 함께 고르면 둘 다 맞는 단어만 보여요.' }
  return { title: f.archived ? `보관한 단어 중 ${name} 단어가 없어요` : `${name} 단어가 없어요`, body: null }
}

export const DRAFT_INVALID = '일본어 단어로 보기 어려워요. 표현을 확인해 주세요.'
export const DUPLICATE_TEXT = '단어장에 같은 표현이 이미 있어요'

/** [뜻 채우기] 오류(ⓑ). 409 는 화면이 [그 단어 보기]로 따로 그린다. */
export function enrichErrorText(e: ErrorLike, retryAfterSec?: number | null): string {
  switch (e.status) {
    case 0:
      return NETWORK_ERROR
    case 400:
      return e.message || GENERIC_ERROR
    case 409:
      return DUPLICATE_TEXT
    case 422:
      return '지금은 뜻을 채울 수 없어요. 직접 입력해 주세요.'
    case 429:
      return `뜻 채우기를 너무 자주 눌렀어요. ${Math.max(1, retryAfterSec ?? 1)}초 뒤에 다시 해 주세요.`
    case 502:
      return '뜻을 채우지 못했어요. 다시 시도하거나 직접 입력해 주세요.'
    case 504:
      return '시간이 오래 걸려 멈췄어요. 다시 시도하거나 직접 입력해 주세요.'
    default:
      return GENERIC_ERROR
  }
}

export function seedResultText(r: SeedPackResult): string {
  if (r.added <= 0) return '기본 단어가 이미 모두 들어 있어요'
  if (r.skipped > 0) return `기본 단어 ${r.added}개를 넣었어요 · 이미 있는 ${r.skipped}개는 건너뛰었어요`
  return `기본 단어 ${r.added}개를 넣었어요`
}

// ── 오늘 홈 ⓐ ───────────────────────────────────────────────────────────────────────────────

export function homeLoadErrorText(e: ErrorLike): string {
  return e.status === 0 ? NETWORK_ERROR : '오늘의 단어를 불러오지 못했어요.'
}

export function startErrorText(e: ErrorLike): string {
  if (e.status === 400 && e.message) return e.message
  if (e.status === 0) return NETWORK_ERROR
  return '세트를 만들지 못했어요. 다시 시도해 주세요.'
}

// ── 덱 ⓑ ────────────────────────────────────────────────────────────────────────────────────

export const HINT = {
  answerFirst: '먼저 답을 골라 주세요',
  selfFirst: '알았어요·몰랐어요를 먼저 골라 주세요',
  firstCard: '첫 카드예요',
  noReading: '이 카드는 읽기가 따로 없어요',
  flagged: '다시 볼 카드로 표시했어요',
  unflagged: '표시를 뺐어요',
  flagFailed: '표시를 저장하지 못했어요',
  saveFailed: '저장하지 못했어요. 다시 눌러 주세요',
  finishFailed: '결과를 저장하지 못했어요. 다시 시도해 주세요.',
} as const

export const FLASH = {
  left: '풀던 세트는 저장했어요. 이어서 풀 수 있어요.',
  closed: '답한 카드가 없어서 기록 없이 세트를 닫았어요.',
  finishFirst: '풀던 세트를 먼저 끝내 주세요',
  alreadyDone: '이미 끝난 세트예요. 결과를 보여 드릴게요.',
} as const

/** 카드 결과 띠(뒷면). FLIP 은 자기 채점이라 "알았어요/몰랐어요". */
export function resultBand(answer: VocabAnswer, mode: VocabMode): { text: string; tone: 'good' | 'bad' | 'neutral' } {
  if (answer === 'SKIPPED') return { text: '건너뛴 카드', tone: 'neutral' }
  if (mode === 'FLIP') return answer === 'CORRECT' ? { text: '✓ 알았어요', tone: 'good' } : { text: '✗ 몰랐어요', tone: 'bad' }
  return answer === 'CORRECT' ? { text: '✓ 맞았어요', tone: 'good' } : { text: '✗ 틀렸어요', tone: 'bad' }
}

/** FLIP 답한 카드(이전 카드 보기)의 한 줄 */
export function flipRecordedText(answer: VocabAnswer): string {
  const word = answer === 'SKIPPED' ? '건너뛴 카드' : answer === 'CORRECT' ? '알았어요' : '몰랐어요'
  return `${word}로 기록했어요`
}
