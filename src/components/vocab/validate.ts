/**
 * 단어 폼의 검증·본문 만들기(screens.md §4-2 B·C, api-contract §2-9 검증). 순수 모듈.
 *
 * 길이는 **코드포인트**로 센다(`cpLength` — 서버와 같은 기준, 이모지를 2로 세지 않는다). `maxLength` 속성은 쓰지 않는다
 * (IME 조합 중 잘림). 카운터·출처·보관 여부는 폼에 없다(읽기 전용, §4-10).
 */
import { cpLength } from '@/components/common/format'
import type {
  CategoryCount,
  JlptLevel,
  PartOfSpeech,
  WordCreateBody,
  WordDetail,
  WordDraft,
  WordEntry,
  WordPatchBody,
  WordChunkFilter,
  WordStats,
} from '@/types/vocab'

export const WORD_LIMITS = {
  surface: 80,
  reading: 120,
  meaning: 200,
  category: 40,
  example: 2000,
  exampleKo: 2000,
  note: 500,
  search: 40,
} as const

export type WordField = 'surface' | 'reading' | 'meaning' | 'partOfSpeech' | 'jlpt' | 'category' | 'example' | 'exampleKo' | 'note'

/** 폼 값은 전부 문자열(선택 안 함 = ''). */
export interface WordFormValues {
  surface: string
  reading: string
  meaning: string
  partOfSpeech: PartOfSpeech
  jlpt: JlptLevel | ''
  category: string
  example: string
  exampleKo: string
  note: string
}

/** 첫 오류 필드로 포커스를 옮길 때의 순서(화면 위→아래). */
export const FIELD_ORDER: readonly WordField[] = ['surface', 'reading', 'meaning', 'partOfSpeech', 'jlpt', 'category', 'example', 'exampleKo', 'note']
export const EXTRA_FIELDS: readonly WordField[] = ['example', 'exampleKo', 'note']

export function emptyForm(surface = '', category = ''): WordFormValues {
  return { surface, reading: '', meaning: '', partOfSpeech: 'OTHER', jlpt: '', category, example: '', exampleKo: '', note: '' }
}

export function formFromWord(w: WordEntry): WordFormValues {
  return {
    surface: w.surface,
    reading: w.reading ?? '',
    meaning: w.meaning,
    partOfSpeech: w.partOfSpeech ?? 'OTHER',
    jlpt: w.jlpt ?? '',
    category: w.category ?? '',
    example: w.example ?? '',
    exampleKo: w.exampleKo ?? '',
    note: w.note ?? '',
  }
}

/** 초안(A10) → 폼. 표현은 사용자가 쓴 것을 그대로 둔다. */
export function formFromDraft(surface: string, draft: WordDraft, category: string): WordFormValues {
  return {
    surface,
    reading: draft.reading ?? '',
    meaning: draft.meaning ?? '',
    partOfSpeech: draft.partOfSpeech ?? 'OTHER',
    jlpt: draft.jlpt ?? '',
    category,
    example: draft.example ?? '',
    exampleKo: draft.exampleKo ?? '',
    note: '',
  }
}

/** 초안에 뜻이 비었는가(`valid:true` 인데 비는 경우 방어, §4-2 B). */
export function draftIsEmpty(d: WordDraft): boolean {
  return !d.meaning || !d.meaning.trim()
}

const MAX_MESSAGE: Record<Exclude<WordField, 'partOfSpeech' | 'jlpt'>, string> = {
  surface: '표현은 80자까지 쓸 수 있어요',
  reading: '읽기는 120자까지 쓸 수 있어요',
  meaning: '뜻은 200자까지 쓸 수 있어요',
  category: '분류는 40자까지 쓸 수 있어요',
  example: '예문은 2,000자까지 쓸 수 있어요',
  exampleKo: '예문 뜻은 2,000자까지 쓸 수 있어요',
  note: '메모는 500자까지 쓸 수 있어요',
}

export function validateSurface(surface: string): string | null {
  const n = cpLength(surface.trim())
  if (n < 1) return '표현을 적어 주세요'
  if (n > WORD_LIMITS.surface) return MAX_MESSAGE.surface
  return null
}

export function validateWord(v: WordFormValues): Partial<Record<WordField, string>> {
  const out: Partial<Record<WordField, string>> = {}
  const s = validateSurface(v.surface)
  if (s) out.surface = s
  if (cpLength(v.meaning.trim()) < 1) out.meaning = '뜻을 적어 주세요'
  for (const f of ['reading', 'meaning', 'category', 'example', 'exampleKo', 'note'] as const) {
    if (!out[f] && cpLength(v[f].trim()) > WORD_LIMITS[f]) out[f] = MAX_MESSAGE[f]
  }
  return out
}

export function firstErrorField(errors: Partial<Record<WordField, string>>): WordField | null {
  return FIELD_ORDER.find((f) => !!errors[f]) ?? null
}

/** #41 저장 본문 — 비어 있는 선택값은 보내지 않는다(`enrich` 없음). */
export function toCreateBody(v: WordFormValues): WordCreateBody {
  const body: WordCreateBody = { surface: v.surface.trim(), meaning: v.meaning.trim(), partOfSpeech: v.partOfSpeech }
  const opt = (k: 'reading' | 'example' | 'exampleKo' | 'note' | 'category') => {
    const t = v[k].trim()
    if (t) body[k] = t
  }
  opt('reading')
  opt('category')
  opt('example')
  opt('exampleKo')
  opt('note')
  if (v.jlpt) body.jlpt = v.jlpt
  return body
}

/**
 * #43 본문 — **바뀐 필드만**. 비운 선택값은 `null`(지운다), 필수값(표현·뜻)은 비울 수 없다(검증이 먼저 막는다).
 * 카운터·source·archived 는 폼에 없으므로 여기서도 나오지 않는다.
 */
export function diffPatch(before: WordEntry, after: WordFormValues): WordPatchBody {
  const body: WordPatchBody = {}
  const s = after.surface.trim()
  if (s !== before.surface) body.surface = s
  const m = after.meaning.trim()
  if (m !== before.meaning) body.meaning = m
  if (after.partOfSpeech !== (before.partOfSpeech ?? 'OTHER')) body.partOfSpeech = after.partOfSpeech
  const jlpt = after.jlpt || null
  if (jlpt !== (before.jlpt ?? null)) body.jlpt = jlpt
  for (const k of ['reading', 'category', 'example', 'exampleKo', 'note'] as const) {
    const next = after[k].trim() || null
    const prev = before[k] ?? null
    if (next !== prev) body[k] = next
  }
  return body
}

/** 서버 400 `details.field`(예: `word.meaning`)를 폼 필드에 맞춘다. */
export function fieldOf(raw: string | null): WordField | null {
  if (!raw) return null
  const last = raw.split('.').pop() ?? raw
  return FIELD_ORDER.find((f) => f === last) ?? null
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * #42 응답을 한 모양으로. 계약은 "`WordEntry` + `stats` + `corrections`"(평평한 객체)이고, 서버가 `{ word, stats, corrections }`
 * 로 감싸 보내도 같은 값이 되게 둘 다 받는다(통합 전 가정 — Developer 기록 참고).
 */
export function normalizeWordDetail(raw: unknown): WordDetail {
  const r = isRecord(raw) ? raw : {}
  const nested = isRecord(r.word) ? r.word : null
  const { stats: rawStats, corrections: rawCorr, ...rest } = r
  const word = (nested ?? rest) as unknown as WordEntry
  const stats = isRecord(rawStats) ? (rawStats as unknown as WordStats) : null
  const corrections = Array.isArray(rawCorr)
    ? rawCorr.filter((c): c is { id: string; chatId: string } => isRecord(c) && typeof c.id === 'string' && typeof c.chatId === 'string')
    : []
  return { word, stats, corrections }
}

/** #46 응답(배열) — `{ items }` 로 감싸 와도 받는다. */
export function normalizeCategories(raw: unknown): CategoryCount[] {
  const arr = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.items) ? raw.items : []
  return arr.filter((c): c is CategoryCount => isRecord(c) && typeof c.count === 'number')
}

export interface CategoryTotals {
  active: number
  archived: number
}

export function categoryTotals(items: readonly CategoryCount[] | null): CategoryTotals | null {
  if (!items) return null
  let active = 0
  let archived = 0
  for (const c of items) {
    active += c.count
    archived += c.archivedCount ?? 0
  }
  return { active, archived }
}

/** 칩으로 보일 분류(분류 없음 제외, 기준 개수 > 0) — #46 순서 그대로. */
export function visibleCategories(items: readonly CategoryCount[] | null, basis: 'active' | 'archived'): { category: string; n: number }[] {
  if (!items) return []
  const out: { category: string; n: number }[] = []
  for (const c of items) {
    if (c.category === null) continue
    const n = basis === 'active' ? c.count : (c.archivedCount ?? 0)
    if (n > 0) out.push({ category: c.category, n })
  }
  return out
}

export type WordsEmptyVariant = 'noWords' | 'allArchived' | 'noSearch' | 'noSearchChunk' | 'noChunk' | 'noCategory' | 'noArchived'

/**
 * 목록이 비었을 때 어떤 안내를 보일지(§4-2 A 표·§4-3). 조각을 고른 채 0이면(task-023) 조각 쪽 안내가 분류보다 먼저다 —
 * 조각·분류를 한쪽씩 푸는 버튼을 함께 주기 때문이다. 검색 중이면 검색 안내에 조각 조건 한 줄을 붙인다.
 */
export function emptyVariant(
  q: { q: string; category: string | null; archived: boolean; chunk?: WordChunkFilter | null },
  totals: CategoryTotals | null,
): WordsEmptyVariant {
  if (q.q) return q.chunk ? 'noSearchChunk' : 'noSearch'
  if (q.chunk) return 'noChunk'
  if (q.category !== null) return 'noCategory'
  if (q.archived) return 'noArchived'
  if (totals && totals.active === 0 && totals.archived > 0) return 'allArchived'
  return 'noWords'
}
