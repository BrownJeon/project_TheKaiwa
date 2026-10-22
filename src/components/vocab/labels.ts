/**
 * 단어장·오늘의 단어의 한국어 라벨·문구 표(screens.md §4-8·§5-8). 순수 모듈.
 *
 * **오류 문구는 서버 `message` 가 아니라 이 표에서 고른다**(400 VALIDATION 만 예외) — 서버 기본 문구에는 구현 용어가
 * 섞일 수 있다(task-006 D8). 엔진·모델명·traceId 는 어디에도 없다. "AI"·엔진 대신 "선생님"으로 쓴다.
 */
import { isLevelCategory, LEVEL_CATEGORY_NAMES, SEED_PACK_COUNT, SEED_PACK_LABEL } from '@/types/seedPack'
import type {
  JlptLevel,
  PartOfSpeech,
  VocabAnswer,
  VocabMode,
  WordChunkFilter,
  WordChunkType,
  WordOrigin,
  WordSource,
} from '@/types/vocab'
import type { WordSourceView } from './logic'

export interface ErrorLike {
  status: number
  message?: string
  /** 봉투 `error.details`(`toErr` 가 채움) — 403 기본 단어 `code: 'READ_ONLY'` 를 가른다(task-068). */
  details?: Record<string, unknown>
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
 * 난이도 이름 분류(task-068 D3 B, screens.md §28-2 C) — 다섯 수준 이름 + 옛 `N5 기초`, 바이트 일치. 정본은 서버와 같이 쓰는 잎 파일
 * `@/types/seedPack`(서버 #46 이 이 이름들을 `category: null` 로 접는다). 화면도 칩·뱃지에서 한 번 더 거른다(옛 응답·다른 경로 방어, T9).
 */
export { isLevelCategory, LEVEL_CATEGORY_NAMES }

/**
 * 단어 상세의 분류 뱃지 글(§19-4 E · task-068 §28-2 C) — 난이도 이름 분류면 **늘** 그리지 않는다(null, 옛 「N5 기초」 포함).
 * 그 밖의 분류는 받은 글자 그대로. `jlpt` 는 옛 호출부와 맞추려고 받기만 한다.
 */
export function categoryBadgeText(category: string | null | undefined, jlpt?: JlptLevel | null): string | null {
  void jlpt
  if (!category) return null
  return isLevelCategory(category) ? null : category
}

/** 설정 「지금 수준」 도움말(§19-4 F-1 · task-068 §28-6 D — 넣기 버튼이 없어져 「오늘의 단어」로). */
export function levelHelpText(): string {
  return `선생님 대화와 오늘의 단어가 이 수준을 따라요. 이름은 JLPT 급수와 같아요 — ${levelName('N1')}은 가장 높은 급수(N1)예요.`
}

/**
 * 오늘의 단어 준비 카드 한 줄(task-068 J13 · §28-2 D). task-076 P10(D6 A): `challengeLevel` 이 오면 내 단어장 세트 가중 기준이 챌린지 난이도라
 * 「지금 수준 … 가장 많이」가 틀린 말이 된다 → 챌린지 문장. 챌린지 난이도를 넘길지는 `topicLogic.mineSetChallengeLevel` 한 곳이 정한다.
 */
export function todayLevelLine(l: JlptLevel, challengeLevel?: JlptLevel | null): string {
  if (challengeLevel) return `챌린지 난이도(${levelLabel(challengeLevel)})까지의 단어가 주로 나와요.`
  return `지금 수준(${levelLabel(l)}) 단어가 가장 많이 나와요.`
}

export const SOURCE_SENTENCE: Record<WordSource, string> = {
  MANUAL: '내가 넣은 단어예요',
  CORRECTION: '채팅 교정에서 채택한 표현이에요',
  SEED: '기본 단어 팩에서 넣었어요',
  TUTOR: '선생님 제안을 채택한 단어예요',
  LESSON: '레슨에서 넣은 단어예요',
  EVALUATION: '평가에서 넣은 단어예요',
}

/** 출처 뱃지(task-068 D10 표시 A) — 목록 행은 「내 단어」만, 상세는 둘 다. */
export const ORIGIN_BADGE: Record<WordOrigin, string> = { MINE: '내 단어', BASE: '기본 단어' }

/** 기본 단어 상세의 출처 문장(§28-5 B·D) — 「추가한 날」 줄은 없다. */
export const BASE_SOURCE_SENTENCE = '기본 단어예요 · 내용은 고칠 수 없고 보관(숨기기)만 할 수 있어요. 맞힘 · 틀림 기록은 나에게만 쌓여요.'
/** 내 단어 출처 문장 뒤에 붙는다 — 「내가 넣은 단어예요 · 나만 봐요」. */
export const MINE_SOURCE_SUFFIX = ' · 나만 봐요'

/** 기본 단어 상세의 단추 하나(D6 A) · 보관 토스트(데모 원문 — 내 단어 토스트는 지금 문구 그대로). */
export const BASE_ARCHIVE_BTN = '보관 — 목록 · 오늘의 단어에서 숨기기'
export const BASE_UNARCHIVE_BTN = '보관 풀기 — 다시 보이기'
export const BASE_ARCHIVED_TOAST = '보관했어요 · 목록과 오늘의 단어에서 숨겨요(나에게만)'
export const BASE_UNARCHIVED_TOAST = '보관을 풀었어요 · 다시 보여요'
/** 403 `details.code='READ_ONLY'`(기본 단어 수정·삭제 — 화면은 단추를 그리지 않아 보통 나오지 않는다, §28-10 ⑧). */
export const READ_ONLY_TEXT = '기본 단어는 고치거나 지울 수 없어요'

/**
 * 조각 라벨 — 상세 뱃지·목록 행 뱃지(task-023: 목록의 출처 뱃지를 이 뱃지로 바꿨다, 조각이 없으면 뱃지 없음).
 * task-068: 단어 전용 5유형(「표현」 추가). 교정·수업 쪽 4유형 라벨은 `chat/labels` 에 따로 있다(J12).
 */
export const CHUNK_LABEL: Record<WordChunkType, string> = {
  NAME: '이름 조각',
  ACTION: '액션 조각',
  FEELING: '느낌 조각',
  MODIFIER: '꾸밈 조각',
  EXPRESSION: '표현 조각',
}

/** 조각 칩 글자(필터 칩·폼 고르기 칩 공용). */
export const CHUNK_CHIP_LABEL: Record<WordChunkType, string> = {
  NAME: '이름',
  ACTION: '액션',
  FEELING: '느낌',
  MODIFIER: '꾸밈',
  EXPRESSION: '표현',
}

/** 폼에서 조각을 고르면 보이는 뜻 한 줄(§28-3 A) — 선생님 초안 프롬프트와 같은 뜻. `ex` 는 `lang="ja"` 로 그린다. */
export const CHUNK_DEF: Record<WordChunkType, { def: string; ex: string }> = {
  NAME: { def: '사람 · 물건 · 곳 · 때를 가리키는 말(명사 · 대명사)', ex: '友達 · 映画 · どこ' },
  ACTION: { def: '하는 일 · 움직임(동사, 〜する 명사)', ex: '会う · 勉強 · 行く' },
  FEELING: { def: '마음 · 상태 · 평가(형용사 · 감정)', ex: '楽しい · 好き · 安心' },
  MODIFIER: { def: '다른 말에 붙어 때 · 곳 · 정도를 더하는 말(부사 · 조사구)', ex: 'とても · 毎日 · その' },
  EXPRESSION: { def: '문장 밖에서 통째로 쓰는 말(인사 · 대답 · 감탄 · 이음말)', ex: 'はじめまして · なるほど · でも' },
}

/** 폼 조각 칸(§28-4 F) — 이름 · 고르기 전 안내 · 안 고르고 저장 · 선생님 초안이 고름. */
export const CHUNK_FIELD_LABEL = '조각'
export const CHUNK_PICK_HINT = '단어장에서 이 조각으로 거를 수 있어요. 고르면 뜻이 보여요.'
export const CHUNK_PICK_REQUIRED = '조각을 골라 주세요'
export const CHUNK_PICK_DRAFT = '선생님이 고른 조각이에요 · 바꿀 수 있어요'

/**
 * 단어장 조각 줄 칩(task-023 · task-068). 칩 글자는 짧게 두고, 화면 읽기는 `sr` 를 이어 읽어 "액션 조각"처럼 들린다.
 * 순서는 이름·액션·느낌·꾸밈·표현(task-068: 「없음」 폐지 — #40 `chunkType=none` 은 400).
 * 채택 교정 모음은 앞 4개만 쓴다(`ChunkChips variant="corrections"`, J12).
 */
export const CHUNK_FILTER_ALL = { label: '전체', sr: ' (모든 조각)' } as const
export const CHUNK_FILTER_CHIPS: readonly { value: WordChunkFilter; label: string; sr: string }[] = [
  { value: 'NAME', label: '이름', sr: ' 조각' },
  { value: 'ACTION', label: '액션', sr: ' 조각' },
  { value: 'FEELING', label: '느낌', sr: ' 조각' },
  { value: 'MODIFIER', label: '꾸밈', sr: ' 조각' },
  { value: 'EXPRESSION', label: '표현', sr: ' 조각' },
]

/** 조건 문구에 쓰는 조각 이름 — "액션 조각" · "표현 조각". */
export function chunkFilterName(v: WordChunkFilter): string {
  return CHUNK_LABEL[v]
}

export const RESULT_LABEL: Record<VocabAnswer, string> = { CORRECT: '맞힘', WRONG: '틀림', SKIPPED: '건너뜀' }
export const RESULT_TONE: Record<VocabAnswer, 'good' | 'bad' | 'neutral'> = { CORRECT: 'good', WRONG: 'bad', SKIPPED: 'neutral' }

export const MODE_LABEL: Record<VocabMode, string> = { CHOICE: '4지선다', FLIP: '뒤집기 카드' }

// ── 공통 ────────────────────────────────────────────────────────────────────────────────────

export const NETWORK_ERROR = '연결하지 못했어요. 네트워크를 확인해 주세요.'
export const GENERIC_ERROR = '처리하지 못했어요. 다시 시도해 주세요.'
export const WORD_NOT_FOUND = '단어를 찾을 수 없어요. 삭제되었을 수 있어요.'

/**
 * 버튼 동작(수정·보관·삭제 등)의 봉투 오류. 400 만 서버 문구.
 * 403 은 `details.code='READ_ONLY'`(기본 단어 — task-068)일 때만 전용 문구 — 이 함수를 쓰는 다른 화면(회화·역할극)의 403 문구는 그대로 둔다.
 */
export function actionErrorText(e: ErrorLike): string {
  if (e.status === 400 && e.message) return e.message
  if (e.status === 0) return NETWORK_ERROR
  if (e.status === 403 && e.details?.code === 'READ_ONLY') return READ_ONLY_TEXT
  if (e.status === 404) return WORD_NOT_FOUND
  return GENERIC_ERROR
}

// ── 단어장 ⓐ·ⓑ·ⓓ ────────────────────────────────────────────────────────────────────────────

export function listErrorText(e: ErrorLike): string {
  return e.status === 0 ? NETWORK_ERROR : '단어장을 불러오지 못했어요.'
}

/**
 * 즐겨찾기 문구(task-074 §32-8 — 승인 데모 문구 표 그대로). 실패·오프라인·404 는 공통 문구(`favoriteErrorText`).
 * 429·성공 토스트·행동형 이름·「[저장]을 눌러야」 줄은 만들지 않는다.
 */
export const FAVORITE_COPY = {
  star: '즐겨찾기',
  sourceLabel: '즐겨찾기',
  lead: (n: number) => `즐겨찾기 ${fmtCount(n)}개`,
  condition: '즐겨찾기',
  noneTitle: '즐겨찾기한 단어가 없어요',
  noneBody: '단어 줄의 별을 누르면 여기에 모여요.',
  noneBtn: '모든 단어 보기',
  matchTitle: '조건에 맞는 즐겨찾기가 없어요',
  matchBody: (c: string) => `${c} 안에서 즐겨찾기만 찾았어요.`,
  matchBtn: '즐겨찾기 조건 풀기',
  removedToast: '즐겨찾기에서 뺐어요',
} as const

/** 출처 분절(task-068 D10 A · §28-2 B · task-074 D1 D 4번째 칸 「즐겨찾기」) — 화면·자리표시가 같이 읽는다. 저장하지 않는다(D2). */
export const WORD_SOURCE_ARIA = '출처'
export const WORD_SOURCE_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'mine', label: '내 단어' },
  { value: 'base', label: '기본 단어' },
  { value: 'favorite', label: FAVORITE_COPY.sourceLabel },
] as const satisfies readonly { value: WordSourceView; label: string }[]

/** 목록 머리 줄 앞말(§28-2 F · §32-4) — 출처별 · 보관함 · 즐겨찾기. 검색은 화면이 그린다(lang 표시). `n` 은 쉼표를 넣는다. */
export function listLeadText(lead: 'all' | 'mine' | 'base' | 'archived' | 'favorite', n: number): string {
  const c = fmtCount(n)
  if (lead === 'favorite') return FAVORITE_COPY.lead(n)
  if (lead === 'archived') return `보관한 단어 ${c}개`
  if (lead === 'mine') return `내 단어 ${c}개`
  if (lead === 'base') return `기본 단어 ${c}개`
  return `단어 ${c}개`
}

/** 보관함 안내(§28-2 A — task-068 로 뒤 문장 추가). */
export const ARCHIVE_NOTE = '보관한 단어는 오늘의 단어에 나오지 않아요. 숨긴 기본 단어는 나에게만 숨겨져요.'

/**
 * 7개씩 쪽(task-068 §28-1 H). 인자 `p`·`n` 은 **1부터 센 화면 숫자**(쪽 상태의 0부터 값에 +1 해서 넘긴다). 숫자는 쉼표(`fmtCount`).
 */
export const WORDS_PAGE_COPY = {
  pagerAria: '단어 목록 쪽',
  prev: '이전',
  next: '다음',
  label: (p: number, n: number) => `${fmtCount(p)} / ${fmtCount(n)}`,
  total: (t: number) => `모두 ${fmtCount(t)}개`,
  busy: '불러오는 중…',
  centerAria: (p: number, n: number) => `${fmtCount(p)} / ${fmtCount(n)} — 쪽으로 이동`,
  sr: (p: number, n: number, t: number) => `${fmtCount(n)}쪽 중 ${fmtCount(p)}쪽 · 모두 ${fmtCount(t)}개`,
  pagingSr: (p: number) => `${fmtCount(p)}쪽을 불러오고 있어요`,
  firstSr: '단어장을 불러오고 있어요',
  pageError: '이 쪽을 불러오지 못했어요',
  pageErrorBody: '연결을 확인하고 다시 시도해 주세요.',
  retry: '다시 시도',
  jumpTitle: '쪽으로 이동',
  jumpNow: (p: number, n: number) => `지금 ${fmtCount(p)}쪽 · 모두 ${fmtCount(n)}쪽`,
  jumpLabel: '쪽 번호',
  jumpPlaceholder: (n: number) => `1–${fmtCount(n)}`,
  jumpError: (n: number) => `1부터 ${fmtCount(n)} 사이 숫자를 적어 주세요`,
  jumpFirst: '처음 쪽',
  jumpLast: '마지막 쪽',
  jumpGo: '이동',
  pageSuffix: (p: number) => `${fmtCount(p)}쪽`,
} as const

/** 처음 한 번 안내 띠(task-068 J9 · §28-6 C). 숫자는 서버 `baseTotal` — 고정하지 않는다. */
export const BASE_BAND = {
  title: (n: number) => `기본 단어 ${fmtCount(n)}개가 들어 있어요`,
  body: '내용은 고칠 수 없고 보관(숨기기)만 할 수 있어요. 필요한 단어는 ＋ 추가로 직접 넣으세요 — 내 단어는 나만 봐요.',
  close: '안내 닫기',
} as const

/** 빈 화면 문구(task-068 §28-6 B·E — 넣기 버튼을 지우고, 옛 넣기 문구 표의 남는 두 문장을 옮겼다). */
export const WORDS_EMPTY_COPY = {
  noWordsBody: '아는 단어를 직접 넣어 보세요. 채팅에서 채택한 표현도 여기에 모여요.',
  todayEmptyBody: '오늘의 단어는 내 단어장에서 골라요.',
  addBtn: '단어 직접 추가',
  noMineTitle: '아직 내가 넣은 단어가 없어요',
  noMineBody: '기본 단어에 없는 표현을 직접 넣으면 여기에 모여요. 내 단어는 나만 봐요.',
} as const

/** 단어 저장 토스트(§28-4 F — task-068 로 바뀜). */
export const WORD_SAVED_TOAST = '단어장에 넣었어요 · 내 단어는 나만 봐요'

/**
 * 목록 머리의 걸린 조건(task-023) — "N5 기초 · 느낌 조각". 분류·조각 모두 없으면 null.
 * task-074 §32-4: 앞말이 보관함·검색인데 즐겨찾기 칸이면 맨 앞에 「즐겨찾기」(앞말이 이미 즐겨찾기면 다시 넣지 않는다). 순서 = 즐겨찾기 → 분류 → 조각.
 */
export function listConditionText(f: {
  category: string | null
  chunk?: WordChunkFilter | null
  source?: WordSourceView
  archived?: boolean
  q?: string
}): string | null {
  const parts: string[] = []
  if (f.source === 'favorite' && (f.archived || !!f.q)) parts.push(FAVORITE_COPY.condition)
  if (f.category !== null) parts.push(f.category)
  if (f.chunk) parts.push(chunkFilterName(f.chunk))
  return parts.length ? parts.join(' · ') : null
}

/**
 * 즐겨찾기 칸 빈 결과 본문의 조건 조각(§32-4 `noFavoriteMatch`) — 「‘q’ 검색」 · 「보관함」 · 분류 · 조각 이름 순. `ja` 조각은 화면이 `lang="ja"` 로 감싼다.
 * 이어 붙인 글 = `FAVORITE_COPY.matchBody(조각들을 ' · ' 로 이은 글)`.
 */
export function favoriteMatchParts(f: { q: string; archived: boolean; category: string | null; chunk: WordChunkFilter | null }): { pre: string; ja?: string; post: string }[] {
  const parts: { pre: string; ja?: string; post: string }[] = []
  if (f.q) parts.push({ pre: '‘', ja: f.q, post: '’ 검색' })
  if (f.archived) parts.push({ pre: '보관함', post: '' })
  if (f.category !== null) parts.push({ pre: f.category, post: '' })
  if (f.chunk) parts.push({ pre: chunkFilterName(f.chunk), post: '' })
  return parts
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
/** 409 `details.code='BASE_DUPLICATE'`(task-068 D9 A · §28-4 E) — 기본 단어와 같은 표기(·읽기). [그 단어 보기]는 지금 중복 안내와 같다. */
export const BASE_DUPLICATE_TEXT = '기본 단어에 이미 있어요'
export const BASE_DUPLICATE_HINT = '기본 단어는 모두 단어장에 들어 있어요. 같은 표기 · 읽기는 내 단어로 다시 넣지 않아요.'
export const OPEN_EXISTING_WORD = '그 단어 보기'

/**
 * 단어 추가 시트의 말로 쓰기(task-069) — 수업 ④ 「말로 쓰기」와 같은 말투. 인식기가 일본어 고정이라 표현·예문 칸에만 붙는다.
 */
export const WORD_MIC_COPY = {
  byVoice: '말로 쓰기',
  byText: '글자로 쓰기',
  field: { surface: '표현', example: '예문' },
  voiceBox: '여기에 알아들은 말이 나와요',
  // 인식기는 일본어 전용이라 한국어·영어식 발음은 엉뚱하게 받아 적힌다 — 일본어 발음으로 말하라는 안내(예시는 표현 칸만)와, 들어간 직후의 확인 안내.
  // 표현 칸 안내는 [앞, 일본어 예시, 뒤] — 예시만 `lang="ja"` 로 감싸려고 나눠 둔다(한국어 문장 속 평문이면 일본어 글꼴·낭독이 한국어 기준으로 잡힌다). 이어 붙인 모습이 보이는 문구다.
  hint: {
    surface: ['일본어 발음으로 말해 주세요 (예: ', 'インパクト', '). 칸에 들어간 뒤 고칠 수 있어요.'],
    example: '일본어 발음으로 말해 주세요. 예문 끝에 이어 붙고, 칸에 들어간 뒤 고칠 수 있어요.',
  },
  checkNotice: '잘못 알아들었을 수 있어요. 확인하고 고쳐 주세요.',
} as const

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

/** 객관식으로 답한 카드 아래 기록 한 줄(task-084) — 카드 띠(「✓ 맞았어요」「✗ 틀렸어요」)와 같은 말이라 틀림에 「몰랐어요」가 붙지 않는다. */
export function choiceRecordedText(answer: 'CORRECT' | 'WRONG'): string {
  return `${answer === 'CORRECT' ? '맞았어요' : '틀렸어요'}로 기록했어요`
}

/**
 * FLIP 답한 카드(답한 직후·이전 카드 보기)의 기록 한 줄. `chosenText` 가 있으면 객관식으로 답한 카드 — 건너뜀은 `chosenText` 가 없어 늘 건너뜀 문구다.
 */
export function flipRecordedText(answer: VocabAnswer, chosenText?: string | null): string {
  if (answer === 'SKIPPED') return '건너뛴 카드로 기록했어요'
  if (chosenText != null) return choiceRecordedText(answer)
  return `${answer === 'CORRECT' ? '알았어요' : '몰랐어요'}로 기록했어요`
}
