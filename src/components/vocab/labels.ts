/**
 * 단어장·오늘의 단어의 한국어 라벨·문구 표(screens.md §4-8·§5-8). 순수 모듈.
 *
 * **오류 문구는 서버 `message` 가 아니라 이 표에서 고른다**(400 VALIDATION 만 예외) — 서버 기본 문구에는 구현 용어가
 * 섞일 수 있다(task-006 D8). 엔진·모델명·traceId 는 어디에도 없다. "AI"·엔진 대신 "선생님"으로 쓴다.
 */
import { isSeedPack, SEED_PACK_COUNT, SEED_PACK_LABEL, type SeedPack } from '@/types/seedPack'
import type { ChunkType, JlptLevel, PartOfSpeech, SeedPackResult, VocabAnswer, VocabMode, WordChunkFilter, WordSource } from '@/types/vocab'

export interface ErrorLike {
  status: number
  message?: string
}

// ── 라벨 ⓔ ──────────────────────────────────────────────────────────────────────────────────

/** 단어장 정렬 분절 — 화면(`WordsScreen`)과 로딩 자리표시(`WordsSkeleton`)가 같이 읽는다. 큰 화면 모듈을 자리표시가 끌어오지 않도록 이 표에 둔다(task-046 REV-171 L-6). */
export const WORD_SORT_OPTIONS = [
  { value: 'recent', label: '최근 추가' },
  { value: 'wrong', label: '많이 틀린' },
  { value: 'surface', label: '가나다순' },
] as const

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

// ── 수준 이름(task-051 §19-2) — 이름·개수는 `@/types/seedPack` 에서만 읽는다 ─────────────────────────────

/** 「초보자 (N5)」 — `WordEntry.jlpt` 와 기본 단어 팩 단계는 같은 다섯 값이다. */
export function levelLabel(l: JlptLevel): string {
  return SEED_PACK_LABEL[l]
}

/** 「초보자」 — 표시 이름에서 끝의 ` (N5)` 를 뗀 이름. 설정 두 줄 분절 위쪽 글자·도움말에만 쓴다. */
export function levelName(l: JlptLevel): string {
  const full = SEED_PACK_LABEL[l]
  const tail = ` (${l})`
  return full.endsWith(tail) ? full.slice(0, -tail.length) : full
}

export function fmtCount(n: number): string {
  return n.toLocaleString('ko-KR')
}

/** 다섯 단계 기본 단어 합계(출처 시트) — 생성 파일 값의 합. */
export function seedPackTotal(): number {
  return JLPT_LEVELS.reduce((sum, l) => sum + SEED_PACK_COUNT[l], 0)
}

/**
 * 단어 상세의 분류 뱃지 글(§19-4 E) — 분류가 수준 뱃지 글과 같으면(팩 단어) 그리지 않는다(null).
 * 기존 행의 분류(예: 옛 팩 이름)는 받은 글자 그대로 둔다.
 */
export function categoryBadgeText(category: string | null | undefined, jlpt: JlptLevel | null | undefined): string | null {
  if (!category) return null
  return jlpt && category === levelLabel(jlpt) ? null : category
}

/** 설정 「지금 수준」 도움말(§19-4 F-1). */
export function levelHelpText(): string {
  return `선생님 대화와 기본 단어 넣기가 이 수준을 따라요. 이름은 JLPT 급수와 같아요 — ${levelName('N1')}은 가장 높은 급수(N1)예요.`
}

/** 기본 단어 넣기 문구(§19-4 A·B·C). `p` 는 단계, 개수는 생성 파일 값. */
export const SEED_COPY = {
  busy: '넣는 중…',
  mainBtn: (p: SeedPack) => `${levelLabel(p)} 단어 ${fmtCount(SEED_PACK_COUNT[p])}개 넣기`,
  goalBtn: (p: SeedPack) => `목표 수준 ${levelLabel(p)} 단어 ${fmtCount(SEED_PACK_COUNT[p])}개 넣기`,
  sheetMain: (p: SeedPack) => `${levelLabel(p)} 기본 단어 ${fmtCount(SEED_PACK_COUNT[p])}개 한 번에 넣기 ›`,
  sheetGoal: (p: SeedPack) => `목표 수준 ${levelLabel(p)} 단어 ${fmtCount(SEED_PACK_COUNT[p])}개 한 번에 넣기 ›`,
  emptyBody: (p: SeedPack) =>
    `${levelLabel(p)} 기본 단어 ${fmtCount(SEED_PACK_COUNT[p])}개로 바로 시작하거나, 아는 단어를 직접 넣어 보세요. 채팅에서 채택한 표현도 여기에 모여요.`,
  emptyBodyNoLevel: '아는 단어를 직접 넣어 보세요. 채팅에서 채택한 표현도 여기에 모여요.',
  todayBody: (p: SeedPack) => `오늘의 단어는 내 단어장에서 골라요. ${levelLabel(p)} 기본 단어로 바로 시작해 볼까요?`,
  todayBodyNoLevel: '오늘의 단어는 내 단어장에서 골라요.',
  levelRetry: '수준을 불러오지 못했어요 · 다시 시도 ›',
} as const

/**
 * #11 프로필 응답에서 넣기 단계를 고른다(§19-3). 지금 수준이 다섯 값이 아니면 둘 다 null(넣기 버튼 숨김).
 * 목표 수준은 정해 두었고 지금 수준과 다를 때만 — 지금보다 낮아도 「다름」 하나로 판단한다.
 */
export function seedLevelsFrom(profile: unknown): { main: SeedPack | null; goal: SeedPack | null } {
  const p = profile && typeof profile === 'object' ? (profile as { level?: unknown; goalLevel?: unknown }) : {}
  const main = isSeedPack(p.level) ? p.level : null
  if (main === null) return { main: null, goal: null }
  const goal = isSeedPack(p.goalLevel) && p.goalLevel !== main ? p.goalLevel : null
  return { main, goal }
}

export const SOURCE_SENTENCE: Record<WordSource, string> = {
  MANUAL: '직접 넣은 단어예요',
  CORRECTION: '채팅 교정에서 채택한 표현이에요',
  SEED: '기본 단어 팩에서 넣었어요',
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

/** 넣기 결과 토스트(§19-4 D). 건너뛴 수는 서버 값 그대로. */
export function seedResultText(pack: SeedPack, r: SeedPackResult): string {
  const name = levelLabel(pack)
  if (r.added <= 0) return `${name} 단어가 이미 모두 들어 있어요`
  if (r.skipped > 0) return `${name} 단어 ${fmtCount(r.added)}개를 넣었어요 · 이미 있는 ${fmtCount(r.skipped)}개는 건너뛰었어요`
  return `${name} 단어 ${fmtCount(r.added)}개를 넣었어요`
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

/** 오늘 카드 "풀던 세트" 몸통의 안내 줄 — 지금 카드와 챌린지 주제 카드(`TopicWordsCard`)가 같은 줄을 쓴다. */
export const IN_PROGRESS_NOTE = {
  saved: '답한 카드는 저장돼 있어요.',
  past: '지난 날 시작한 세트예요. 끝내면 그날 기록으로 남아요.',
} as const

/** 풀던 세트 안내 줄. 세트는 시작한 날로 세므로 지난 날 시작한 세트면 그날 기록으로 남는다고 알린다(`today` 를 모르면 생략). */
export function inProgressNotes(sessionDate: string, today: string): string[] {
  return today && sessionDate !== today ? [IN_PROGRESS_NOTE.saved, IN_PROGRESS_NOTE.past] : [IN_PROGRESS_NOTE.saved]
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
