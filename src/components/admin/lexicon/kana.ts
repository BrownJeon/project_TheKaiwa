/**
 * 발음 사전 화면의 가나·모라·입력 검증(screens.md §10-5). 순수 모듈 — 서버 규칙(`speech/tts/text`·`lexiconRules`)과
 * **같은 결과**를 내야 한다(다르면 화면은 통과시키고 서버가 거절하거나 그 반대가 된다). 대조는 `__tests__/kana.test.ts`.
 * 컴포넌트는 서버 모듈을 import 할 수 없어 식을 옮겨 적었다.
 */
import { LEXICON_LIMITS, LEXICON_PRODUCTION_CONFIRM, LEXICON_WORD_TYPES, type LexiconScopeName, type LexiconWordType } from '@/types/lexicon'

/** 서버 `normalizeReading` 과 같다: NFKC(반각 가나 → 전각) · 앞뒤 공백 제거 · 히라가나 → 가타카나. */
export function toKatakana(raw: string): string {
  return raw
    .normalize('NFKC')
    .trim()
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
}

/** 서버 `KATAKANA_READING` 과 같은 식. */
const KATAKANA_READING = /^[ァ-ヺー]+$/
const SMALL_KANA = new Set('ァィゥェォャュョヮヵヶ'.split(''))

export function isReading(s: string): boolean {
  return KATAKANA_READING.test(s)
}

/** 히라가나가 한 글자라도 있으면(저장 때 가타카나로 바뀐다는 안내용). */
export function hasHiragana(s: string): boolean {
  return /[ぁ-ゖ]/.test(s)
}

/**
 * 모라로 나눈다: 작은 가나는 앞 모라에 붙이고, 맨 앞 작은 가나는 다음 모라에 붙인다. ッ·ン·ー 는 각각 한 모라.
 * 모라 하나 = 작은 가나가 아닌 글자 하나라서 길이가 서버 `moraCount` 와 같다(작은 가나만 있는 문자열은 0).
 */
export function splitMoras(reading: string): string[] {
  const out: string[] = []
  let lead = ''
  for (const ch of reading) {
    if (SMALL_KANA.has(ch)) {
      if (out.length === 0) lead += ch
      else out[out.length - 1] += ch
    } else {
      out.push(lead + ch)
      lead = ''
    }
  }
  return out
}

export function moraCount(reading: string): number {
  return splitMoras(reading).length
}

/**
 * 높낮이 표기(↑ 올라감 · ↓ 내려감). n=0 平板 `m1↑m2…` · n=1 頭高 `m1↓m2…` · n≥2 `m1↑…mn↓…`(n = 모라 수면 끝에 ↓).
 * 한 모라 平板은 화살표가 없다. 범위 밖 n 은 빈 문자열(칩이 오류를 보인다).
 */
export function accentNotation(moras: readonly string[], n: number): string {
  if (moras.length === 0 || !Number.isInteger(n) || n < 0 || n > moras.length) return ''
  if (n === 0) return moras.length === 1 ? moras[0] : `${moras[0]}↑${moras.slice(1).join('')}`
  if (n === 1) return `${moras[0]}↓${moras.slice(1).join('')}`
  return `${moras[0]}↑${moras.slice(1, n).join('')}↓${moras.slice(n).join('')}`
}

/** 스크린리더용: 화살표를 말로. */
export function spokenAccent(s: string): string {
  return s.replace(/↑/g, ' 올라감 ').replace(/↓/g, ' 내려감 ').replace(/\s+/g, ' ').trim()
}

export function stripArrows(s: string): string {
  return s.replace(/[↑↓]/g, '')
}

/** 서버 `JAPANESE_CHAR` 와 같다(가나·한자·々〆). */
const JAPANESE_CHAR = /[ぁ-ゖァ-ヺー㐀-䶿一-鿿豈-﫿々〆]/
/** 서버 `BAD_SURFACE_CHAR` 와 같다 — 제어·서식(폭 없는 문자 포함)·줄/문단 구분·공백. */
const BAD_SURFACE_CHAR = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\s]/u
const SCOPE_REF_RE = /^[A-Za-z0-9_-]+$/

export function hasJapanese(s: string): boolean {
  return JAPANESE_CHAR.test(s)
}

export function hasHiddenChar(s: string): boolean {
  return BAD_SURFACE_CHAR.test(s)
}

const cp = (s: string) => Array.from(s).length

/** 서버 `normalizeSurface` 와 같다. */
export function normalizeSurface(raw: string): string {
  return raw.normalize('NFC').trim()
}

// ── 초안 · 검증 ─────────────────────────────────────────────────────────────

export interface LexiconDraft {
  surface: string
  /** 친 그대로(히라가나 가능). 보내기 전에 `toKatakana`. */
  reading: string
  accentType: number
  /** 입력 칸 글자 그대로(숫자 검증은 `validateDraft`). */
  priority: string
  scope: LexiconScopeName | null
  scopeRefId: string
  wordType: LexiconWordType | ''
  note: string
}

export type DraftField = 'surface' | 'reading' | 'accentType' | 'priority' | 'scope' | 'scopeRefId' | 'wordType' | 'note'

/** 코드는 서버 `LexiconFieldError.code` 와 같은 이름을 쓴다 — 서버 400 의 필드 오류도 같은 문구 표를 탄다. */
export interface FieldError {
  code: string
  /** 문구에 넣을 수(글자 수·모라 수). */
  n?: number
}

export type FieldErrors = Partial<Record<DraftField, FieldError>>

/** 칸 순서 = 화면 순서(첫 오류 칸 포커스). */
export const DRAFT_FIELD_ORDER: readonly DraftField[] = ['surface', 'reading', 'accentType', 'priority', 'wordType', 'scope', 'scopeRefId', 'note']

export function emptyDraft(): LexiconDraft {
  return { surface: '', reading: '', accentType: 0, priority: String(LEXICON_LIMITS.priorityDefault), scope: 'GLOBAL', scopeRefId: '', wordType: '', note: '' }
}

/** 빈 칸이면 기본값(서버와 같다), 정수가 아니면 null. */
export function priorityValue(raw: string): number | null {
  const s = raw.trim()
  if (s === '') return LEXICON_LIMITS.priorityDefault
  if (!/^-?\d{1,6}$/.test(s)) return null
  const n = Number(s)
  return n >= LEXICON_LIMITS.priorityMin && n <= LEXICON_LIMITS.priorityMax ? n : null
}

/**
 * 클라이언트 검증. `mode === 'edit'` 는 표기·범위·대상을 보내지 않으므로 검사하지 않는다.
 * 순서·조건은 서버 `parseEntryInput` 과 맞췄다(표기: 길이 → 숨은 문자 → 일본어 · 읽기: 변환 → 길이 → 가나 · 악센트는 읽기가 맞을 때만).
 */
export function validateDraft(d: LexiconDraft, mode: 'add' | 'edit'): FieldErrors {
  const e: FieldErrors = {}
  if (mode === 'add') {
    const s = normalizeSurface(d.surface)
    if (!s) e.surface = { code: 'REQUIRED' }
    else if (cp(s) > LEXICON_LIMITS.surfaceMax) e.surface = { code: 'TOO_LONG', n: cp(s) }
    else if (hasHiddenChar(s)) e.surface = { code: 'INVALID_CHARS' }
    else if (!hasJapanese(s)) e.surface = { code: 'NO_JAPANESE' }
  }

  const r = toKatakana(d.reading)
  let readingOk = false
  if (!r) e.reading = { code: 'REQUIRED' }
  else if (cp(r) > LEXICON_LIMITS.readingMax) e.reading = { code: 'TOO_LONG', n: cp(r) }
  else if (!isReading(r)) e.reading = { code: 'NOT_KANA' }
  else readingOk = true

  if (readingOk) {
    const max = moraCount(r)
    if (!Number.isInteger(d.accentType) || d.accentType < 0 || d.accentType > max) e.accentType = { code: 'OUT_OF_RANGE', n: max }
  }

  if (priorityValue(d.priority) === null) e.priority = { code: 'OUT_OF_RANGE' }

  if (d.wordType !== '' && !(LEXICON_WORD_TYPES as readonly string[]).includes(d.wordType)) e.wordType = { code: 'INVALID_ENUM' }

  if (mode === 'add') {
    if (!d.scope) e.scope = { code: 'REQUIRED' }
    else if (d.scope !== 'GLOBAL') {
      const ref = d.scopeRefId.trim()
      if (!ref) e.scopeRefId = { code: 'SCOPE_REF_REQUIRED' }
      else if (ref.length > LEXICON_LIMITS.scopeRefIdMax) e.scopeRefId = { code: 'TOO_LONG' }
      else if (!SCOPE_REF_RE.test(ref)) e.scopeRefId = { code: 'INVALID_FORMAT' }
    }
  }

  if (cp(cleanNote(d.note)) > LEXICON_LIMITS.noteMax) e.note = { code: 'TOO_LONG' }
  return e
}

/** 서버 `cleanNote` 와 같다(줄바꿈 → 공백 · 제어/서식 문자 제거 · 앞뒤 공백 제거). */
export function cleanNote(s: string): string {
  return s
    .replace(/\r\n?|\n/g, ' ')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .trim()
}

export function firstErrorField(errors: FieldErrors): DraftField | null {
  return DRAFT_FIELD_ORDER.find((f) => errors[f]) ?? null
}

/** 미리듣기 결과가 어떤 입력으로 나온 것인지(입력이 바뀌면 결과를 흐리게). */
export function draftKey(parts: readonly (string | number | null | undefined)[]): string {
  return parts.map((p) => (p === null || p === undefined ? '' : String(p))).join('␟')
}

/** 이유·확인 문구 공통 검사(요청 전). 확인 문구는 대소문자까지 정확히, 앞뒤 공백만 무시. */
/** 운영 쓰기 이유 최소 글자 수(서버 infra/reason REASON_MIN_PRODUCTION 과 같은 값). */
export const REASON_MIN_PRODUCTION = 10

export function validateWriteMeta(reason: string, confirm: string, needsConfirm: boolean): { reason?: FieldError; confirm?: FieldError } {
  const out: { reason?: FieldError; confirm?: FieldError } = {}
  const r = reason.trim()
  if (!r) out.reason = { code: 'REQUIRED' }
  else if (cp(r) > LEXICON_LIMITS.reasonMax) out.reason = { code: 'TOO_LONG', n: cp(r) }
  // 운영(확인 문구가 필요한 쓰기)은 이유 10자 이상(task-012c CX-3 · role-permission §7 ② — 서버도 같은 규칙으로 422 E_REASON).
  else if (needsConfirm && cp(r.replace(/\s+/g, ' ')) < REASON_MIN_PRODUCTION) out.reason = { code: 'TOO_SHORT', n: cp(r.replace(/\s+/g, ' ')) }
  if (needsConfirm && confirm.trim() !== LEXICON_PRODUCTION_CONFIRM) out.confirm = { code: 'MISMATCH' }
  return out
}
