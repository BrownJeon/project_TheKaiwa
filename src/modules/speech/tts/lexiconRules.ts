/**
 * 발음 사전 관리 규칙(task-003g) — **순수 함수만**(DB·네트워크 없음). 입력 검증(정본 16 §2.2 L-4 + 표기 규칙), 항목 키, 스냅샷 모양,
 * 추가/수정/비활성·Import·Rollback 의 변경 계획(plan), 버전 diff 를 계산한다. 쓰기(트랜잭션·잠금·버전 행)는 `lexiconStore`.
 *
 * 키 = (scope, scopeRefId, working 표기) — 매칭(`lexicon.selectEntries`)과 같은 좌표계(`toWorkingText`: 전각 영숫자 → ASCII)로 비교해
 * "매칭에서는 같은 표기인데 DB 에서는 다른 행" 이 생기지 않게 한다. DB unique(environment, scope, scopeRefId, surface)는 scopeRefId 가
 * NULL(GLOBAL)이면 중복을 막지 못하므로(MariaDB 는 NULL 을 서로 다른 값으로 본다) 중복 검사는 여기서 한다(잠금 안에서 호출).
 *
 * 검증(Leader 판정 ⑦ — 정본 우선): 읽기 = 가타카나·長音符(ー)만 1~60자(NFKC 로 반각 가나만 전각으로 바꾸고, **히라가나는 거부** — 화면이
 * 보내기 전에 바꾼다), 악센트 0~모라 수, 우선순위 0~1000. 표기는 1~40자·공백/제어/보이지 않는 문자 없음·일본어 문자(가나·한자) 1개 이상
 * (`E_SURFACE_NOT_JA`·`E_SURFACE_CHARS` 채택 — 라틴 약어는 정규화기 약어표가 맡는다).
 */
import type {
  LexiconCsvColumn,
  LexiconDiffCountsDto,
  LexiconDiffRowDto,
  LexiconEntryFields,
  LexiconFieldError,
  LexiconImportMode,
  LexiconScopeName,
  LexiconSnapshotRowDto,
  LexiconWordType,
} from '@/types/lexicon'
import { LEXICON_LIMITS, LEXICON_SCOPES, LEXICON_WORD_TYPES } from '@/types/lexicon'
import { KATAKANA_READING, moraCount, toWorkingText } from './text'

export interface LexiconEntryRow extends LexiconEntryFields {
  id: string
}

export type RawEntryInput = Record<string, unknown>

// ── 정규화 ──────────────────────────────────────────────────────────────

/** 저장용 읽기 — 앞뒤 공백 제거 + NFKC(반각 가나 → 전각). 히라가나는 바꾸지 않는다(정본: 가타카나만 → 검증에서 거부). */
export function normalizeReading(raw: string): string {
  return raw.normalize('NFKC').trim()
}

/** 검색어용 — 히라가나를 가타카나로 바꿔 읽기(가타카나 저장값)에도 걸리게 한다(Leader ⑤). */
export function searchReading(raw: string): string {
  return normalizeReading(raw).replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60))
}

export function normalizeSurface(raw: string): string {
  return raw.normalize('NFC').trim()
}

const JAPANESE_CHAR = /[ぁ-ゖァ-ヺー㐀-䶿一-鿿豈-﫿々〆]/
const BAD_SURFACE_CHAR = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\s]/u
const SCOPE_REF_RE = /^[A-Za-z0-9_-]+$/
const cp = (s: string) => [...s].length

function err(field: LexiconFieldError['field'], code: string, message: string): LexiconFieldError {
  return { field, code, message }
}

function present(raw: RawEntryInput, k: string): boolean {
  return Object.prototype.hasOwnProperty.call(raw, k) && raw[k] !== undefined
}

function blank(v: unknown): boolean {
  return v === null || (typeof v === 'string' && v.trim() === '')
}

function intOf(v: unknown): number | 'NaN' {
  if (typeof v === 'number') return Number.isInteger(v) ? v : 'NaN'
  if (typeof v === 'string' && /^-?\d{1,6}$/.test(v.trim())) return Number(v.trim())
  return 'NaN'
}

function boolOf(v: unknown): boolean | 'NaN' {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number' && (v === 0 || v === 1)) return v === 1
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === 'true' || s === '1' || s === 'yes') return true
    if (s === 'false' || s === '0' || s === 'no') return false
  }
  return 'NaN'
}

/** 메모 — 제어문자 제거·줄바꿈은 공백으로·앞뒤 공백 제거. */
function cleanNote(s: string): string {
  return s
    .replace(/\r\n?|\n/g, ' ')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .trim()
}

export interface ParsedEntry {
  value: LexiconEntryFields | null
  errors: LexiconFieldError[]
}

/**
 * 입력 1건 → 항목 값. `base` 가 있으면(수정·Import 갱신) **들어온 키만** 덮어쓰고, 없으면(추가) 빠진 키는 기본값.
 * 빈 문자열·null 은 "기본값"(accentType 0·priority 10·scope GLOBAL·scopeRefId/wordType/note null·enabled true)이다 — 키가 **없는** 것
 * (undefined·키 자체 없음)과 구분한다: 없는 키는 base 값 유지. CSV 파서는 짧은 행의 뒤쪽 칸을 키로 만들지 않는다(REV-017).
 * CSV 는 모든 값이 문자열이라 숫자·불리언 문자열도 받는다.
 */
export function parseEntryInput(raw: RawEntryInput, base: LexiconEntryFields | null = null): ParsedEntry {
  const errors: LexiconFieldError[] = []
  const has = (k: LexiconCsvColumn) => present(raw, k)

  let surface = base?.surface ?? ''
  if (has('surface') || !base) {
    const v = raw.surface
    if (typeof v !== 'string' || normalizeSurface(v) === '') errors.push(err('surface', 'E_SURFACE', '표기를 입력해 주세요.'))
    else {
      surface = normalizeSurface(v)
      if (cp(surface) > LEXICON_LIMITS.surfaceMax) errors.push(err('surface', 'E_SURFACE', `표기는 ${LEXICON_LIMITS.surfaceMax}자 이하여야 합니다.`))
      else if (BAD_SURFACE_CHAR.test(surface)) errors.push(err('surface', 'E_SURFACE_CHARS', '표기에 공백·제어·보이지 않는 문자를 쓸 수 없습니다.'))
      else if (!JAPANESE_CHAR.test(surface)) errors.push(err('surface', 'E_SURFACE_NOT_JA', '표기에 일본어 문자(가나·한자)가 하나 이상 있어야 합니다.'))
    }
  }

  let reading = base?.reading ?? ''
  let readingOk = !!base
  if (has('reading') || !base) {
    const v = raw.reading
    readingOk = false
    if (typeof v !== 'string' || normalizeReading(v) === '') errors.push(err('reading', 'E_READING', '읽기를 입력해 주세요.'))
    else {
      reading = normalizeReading(v)
      if (cp(reading) > LEXICON_LIMITS.readingMax) errors.push(err('reading', 'E_READING', `읽기는 ${LEXICON_LIMITS.readingMax}자 이하여야 합니다.`))
      else if (!KATAKANA_READING.test(reading)) errors.push(err('reading', 'E_READING', '읽기는 가타카나와 장음 기호(ー)만 쓸 수 있습니다.'))
      else readingOk = true
    }
  }

  let accentType = base?.accentType ?? 0
  let accentParsed = true
  if (has('accentType')) {
    const v = raw.accentType
    if (blank(v)) accentType = 0
    else {
      const n = intOf(v)
      if (n === 'NaN') {
        accentParsed = false
        errors.push(err('accentType', 'E_ACCENT', '악센트는 0 이상의 정수여야 합니다.'))
      } else accentType = n
    }
  }
  if (readingOk && accentParsed) {
    const max = moraCount(reading)
    if (accentType < 0 || accentType > max) errors.push(err('accentType', 'E_ACCENT', `악센트는 0~${max}(읽기의 모라 수) 사이여야 합니다.`))
  }

  let priority = base?.priority ?? LEXICON_LIMITS.priorityDefault
  if (has('priority')) {
    const v = raw.priority
    if (blank(v)) priority = LEXICON_LIMITS.priorityDefault
    else {
      const n = intOf(v)
      if (n === 'NaN' || n < LEXICON_LIMITS.priorityMin || n > LEXICON_LIMITS.priorityMax) errors.push(err('priority', 'E_PRIORITY', `우선순위는 ${LEXICON_LIMITS.priorityMin}~${LEXICON_LIMITS.priorityMax} 정수여야 합니다.`))
      else priority = n
    }
  }

  let scope: LexiconScopeName = base?.scope ?? 'GLOBAL'
  let scopeOk = true
  if (has('scope')) {
    const v = raw.scope
    if (blank(v)) scope = 'GLOBAL'
    else if (typeof v === 'string' && (LEXICON_SCOPES as readonly string[]).includes(v.trim().toUpperCase())) scope = v.trim().toUpperCase() as LexiconScopeName
    else {
      scopeOk = false
      errors.push(err('scope', 'E_SCOPE', `범위는 ${LEXICON_SCOPES.join('·')} 중 하나여야 합니다.`))
    }
  }

  let scopeRefId: string | null = base?.scopeRefId ?? null
  let refFormatOk = true
  if (has('scopeRefId')) {
    const v = raw.scopeRefId
    if (blank(v)) scopeRefId = null
    else if (typeof v === 'string' && v.trim().length <= LEXICON_LIMITS.scopeRefIdMax && SCOPE_REF_RE.test(v.trim())) scopeRefId = v.trim()
    else {
      refFormatOk = false
      errors.push(err('scopeRefId', 'E_SCOPE_REF', `대상 id 는 영문·숫자·_- 로 된 ${LEXICON_LIMITS.scopeRefIdMax}자 이하여야 합니다.`))
    }
  }
  if (scopeOk && refFormatOk) {
    if (scope === 'GLOBAL' && scopeRefId !== null) errors.push(err('scopeRefId', 'E_SCOPE_REF', '전체(GLOBAL) 범위에는 대상 id 를 넣지 않습니다.'))
    if (scope !== 'GLOBAL' && scopeRefId === null) errors.push(err('scopeRefId', 'E_SCOPE_REF', `${scope} 범위에는 대상 id 가 필요합니다.`))
  }

  let wordType: LexiconWordType | null = base?.wordType ?? null
  if (has('wordType')) {
    const v = raw.wordType
    if (blank(v)) wordType = null
    else if (typeof v === 'string' && (LEXICON_WORD_TYPES as readonly string[]).includes(v.trim().toUpperCase())) wordType = v.trim().toUpperCase() as LexiconWordType
    else errors.push(err('wordType', 'E_WORD_TYPE', `종류는 ${LEXICON_WORD_TYPES.join('·')} 중 하나여야 합니다.`))
  }

  let note: string | null = base?.note ?? null
  if (has('note')) {
    const v = raw.note
    if (blank(v)) note = null
    else if (typeof v !== 'string') errors.push(err('note', 'E_NOTE', '메모는 문자열이어야 합니다.'))
    else {
      const c = cleanNote(v)
      if (cp(c) > LEXICON_LIMITS.noteMax) errors.push(err('note', 'E_NOTE', `메모는 ${LEXICON_LIMITS.noteMax}자 이하여야 합니다.`))
      else note = c === '' ? null : c
    }
  }

  let enabled = base?.enabled ?? true
  if (has('enabled')) {
    const v = raw.enabled
    if (blank(v)) enabled = true
    else {
      const b = boolOf(v)
      if (b === 'NaN') errors.push(err('enabled', 'E_ENABLED', '사용 여부는 true/false 여야 합니다.'))
      else enabled = b
    }
  }

  if (errors.length) return { value: null, errors }
  return { value: { surface, reading, accentType, priority, scope, scopeRefId, wordType, note, enabled }, errors }
}

// ── 키·비교·스냅샷 ─────────────────────────────────────────────────────

export function entryKey(e: Pick<LexiconEntryFields, 'scope' | 'scopeRefId' | 'surface'>): string {
  return `${e.scope}\u0001${e.scopeRefId ?? ''}\u0001${toWorkingText(e.surface)}`
}

export function scopeRefKey(scope: LexiconScopeName, scopeRefId: string): string {
  return `${scope}:${scopeRefId}`
}

/** 값 비교. 한쪽 note 가 undefined(옛 스냅샷)면 note 는 비교하지 않는다. */
export function sameFields(a: LexiconSnapshotRowDto, b: LexiconSnapshotRowDto): boolean {
  return (
    a.surface === b.surface &&
    a.reading === b.reading &&
    a.accentType === b.accentType &&
    a.priority === b.priority &&
    a.scope === b.scope &&
    a.scopeRefId === b.scopeRefId &&
    a.wordType === b.wordType &&
    (a.note === undefined || b.note === undefined || a.note === b.note) &&
    a.enabled === b.enabled
  )
}

export function fieldsOf(e: LexiconEntryFields): LexiconEntryFields {
  return { surface: e.surface, reading: e.reading, accentType: e.accentType, priority: e.priority, scope: e.scope, scopeRefId: e.scopeRefId, wordType: e.wordType, note: e.note, enabled: e.enabled }
}

const SCOPE_ORDER: Record<LexiconScopeName, number> = { GLOBAL: 0, COURSE: 1, LESSON: 2, VOICE: 3, USER: 4 }
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** 결정적 정렬 — 범위(넓은 것부터) → 대상 id → 표기. 스냅샷·Export·diff 가 같은 순서를 쓴다. */
export function sortEntries<T extends Pick<LexiconEntryFields, 'scope' | 'scopeRefId' | 'surface'>>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope] || cmp(a.scopeRefId ?? '', b.scopeRefId ?? '') || cmp(a.surface, b.surface))
}

/** 버전 스냅샷 1행(domain-model 필드 + note — Rollback 이 메모까지 되돌리도록 덧붙인다. snapshotHash 에는 note 가 들어가지 않는다). */
export interface SnapshotEntry {
  surface: string
  reading: string
  accentType: number
  wordType: string | null
  priority: number
  scope: LexiconScopeName
  scopeRefId: string | null
  enabled: boolean
  note: string | null
}

export function toSnapshot(list: readonly LexiconEntryFields[]): SnapshotEntry[] {
  return sortEntries(list).map((e) => ({ surface: e.surface, reading: e.reading, accentType: e.accentType, wordType: e.wordType, priority: e.priority, scope: e.scope, scopeRefId: e.scopeRefId, enabled: e.enabled, note: e.note }))
}

/**
 * 저장된 스냅샷(Json) → 항목 값. 형식이 깨진 행은 버린다. 시드 v1 처럼 `note` 키가 없는 스냅샷은 `note: undefined`
 * (Rollback 이 현재 메모를 유지하고, diff 가 메모를 비교하지 않도록 구분한다).
 */
export function readSnapshot(raw: unknown): LexiconSnapshotRowDto[] {
  if (!Array.isArray(raw)) return []
  const out: LexiconSnapshotRowDto[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue
    const o = r as Record<string, unknown>
    if (typeof o.surface !== 'string' || typeof o.reading !== 'string' || typeof o.scope !== 'string' || !(o.scope in SCOPE_ORDER)) continue
    out.push({
      surface: o.surface,
      reading: o.reading,
      accentType: typeof o.accentType === 'number' ? o.accentType : 0,
      priority: typeof o.priority === 'number' ? o.priority : LEXICON_LIMITS.priorityDefault,
      scope: o.scope as LexiconScopeName,
      scopeRefId: typeof o.scopeRefId === 'string' ? o.scopeRefId : null,
      wordType: typeof o.wordType === 'string' && (LEXICON_WORD_TYPES as readonly string[]).includes(o.wordType) ? (o.wordType as LexiconWordType) : null,
      ...('note' in o ? { note: typeof o.note === 'string' ? o.note : null } : {}),
      enabled: o.enabled !== false,
    })
  }
  return sortEntries(out)
}

/** 스냅샷 한 행의 문제(행 번호는 배열 index, 0부터). */
export interface SnapshotIssue {
  index: number
  surface: string | null
  codes: string[]
}

export interface StrictSnapshot {
  /** 모양·규칙을 통과한 행만(정렬됨). */
  rows: LexiconSnapshotRowDto[]
  /** 배열 원소 수(손상 행 포함). */
  total: number
  /** MALFORMED = 배열 아님·필드 타입/누락 · INVALID_ENTRIES = 타입은 맞지만 쓰기 규칙 위반·정규형 아님·키 중복. 빈 배열이면 문제 없음. */
  malformed: SnapshotIssue[]
  invalid: SnapshotIssue[]
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)
const strOrNull = (v: unknown): v is string | null => v === null || typeof v === 'string'

/**
 * 스냅샷 엄격 읽기(Codex C2) — `readSnapshot` 처럼 조용히 버리지 않고 문제 행을 보고한다. Rollback·버전 diff·목록 무결성 표시가 쓴다.
 * 행마다 ① 모양: surface·reading 문자열, accentType·priority 정수, scope 5종, scopeRefId·wordType 키가 있고 문자열|null, enabled 불리언,
 * note 는 없거나 문자열|null ② 규칙: 지금의 쓰기 검증(`parseEntryInput`)을 통과하고 정규화해도 값이 그대로(정규형) ③ 키 중복 없음.
 * 해시 대조는 저장소(`lexiconStore`)가 `lexicon.snapshotHash` 로 한다(이 파일은 순수).
 */
export function readSnapshotStrict(raw: unknown): StrictSnapshot {
  const malformed: SnapshotIssue[] = []
  const invalid: SnapshotIssue[] = []
  if (!Array.isArray(raw)) return { rows: [], total: 0, malformed: [{ index: -1, surface: null, codes: ['E_SNAPSHOT_SHAPE'] }], invalid }
  const rows: LexiconSnapshotRowDto[] = []
  const keys = new Set<string>()
  raw.forEach((r, index) => {
    const o = r && typeof r === 'object' && !Array.isArray(r) ? (r as Record<string, unknown>) : null
    const surface = o && typeof o.surface === 'string' ? o.surface : null
    const shapeOk =
      !!o &&
      typeof o.surface === 'string' &&
      typeof o.reading === 'string' &&
      isInt(o.accentType) &&
      isInt(o.priority) &&
      typeof o.scope === 'string' &&
      o.scope in SCOPE_ORDER &&
      'scopeRefId' in o &&
      strOrNull(o.scopeRefId) &&
      'wordType' in o &&
      strOrNull(o.wordType) &&
      typeof o.enabled === 'boolean' &&
      (!('note' in o) || strOrNull(o.note))
    if (!o || !shapeOk) {
      malformed.push({ index, surface, codes: ['E_SNAPSHOT_ROW'] })
      return
    }
    const row: LexiconSnapshotRowDto = {
      surface: o.surface as string,
      reading: o.reading as string,
      accentType: o.accentType as number,
      priority: o.priority as number,
      scope: o.scope as LexiconScopeName,
      scopeRefId: o.scopeRefId as string | null,
      wordType: o.wordType as LexiconWordType | null,
      ...('note' in o ? { note: o.note as string | null } : {}),
      enabled: o.enabled as boolean,
    }
    const parsed = parseEntryInput({ ...row, note: row.note ?? null }, null)
    if (!parsed.value) {
      invalid.push({ index, surface, codes: [...new Set(parsed.errors.map((e) => e.code))] })
      return
    }
    if (!sameFields(parsed.value, { ...row, note: row.note ?? null })) {
      invalid.push({ index, surface, codes: ['E_NOT_CANONICAL'] })
      return
    }
    const key = entryKey(row)
    if (keys.has(key)) {
      invalid.push({ index, surface, codes: ['E_DUPLICATE_KEY'] })
      return
    }
    keys.add(key)
    rows.push(row)
  })
  return { rows: sortEntries(rows), total: raw.length, malformed, invalid }
}

// ── 변경 계획 ───────────────────────────────────────────────────────────

export type PlanItem =
  | { action: 'ADD'; row: number | null; after: LexiconEntryFields }
  | { action: 'UPDATE'; row: number | null; id: string; before: LexiconEntryFields; after: LexiconEntryFields }
  | { action: 'DISABLE'; row: number | null; id: string; before: LexiconEntryFields; after: LexiconEntryFields }

export interface PlanCounts {
  add: number
  update: number
  disable: number
}

export function countPlan(items: readonly PlanItem[]): PlanCounts {
  const c = { add: 0, update: 0, disable: 0 }
  for (const i of items) c[i.action === 'ADD' ? 'add' : i.action === 'UPDATE' ? 'update' : 'disable']++
  return c
}

function indexByKey(existing: readonly LexiconEntryRow[]): Map<string, LexiconEntryRow> {
  const m = new Map<string, LexiconEntryRow>()
  for (const e of existing) m.set(entryKey(e), e)
  return m
}

export type CreatePlan = { kind: 'ADD'; item: PlanItem } | { kind: 'REVIVE'; item: PlanItem } | { kind: 'DUPLICATE'; id: string }

/** 추가: 같은 키가 활성이면 중복(409), 꺼져 있으면 그 행을 되살려 값을 덮는다(물리 행을 늘리지 않는다). */
export function planCreate(existing: readonly LexiconEntryRow[], value: LexiconEntryFields): CreatePlan {
  const hit = indexByKey(existing).get(entryKey(value))
  const after = { ...value, enabled: true }
  if (!hit) return { kind: 'ADD', item: { action: 'ADD', row: null, after } }
  if (hit.enabled) return { kind: 'DUPLICATE', id: hit.id }
  return { kind: 'REVIVE', item: { action: 'UPDATE', row: null, id: hit.id, before: fieldsOf(hit), after } }
}

export type UpdatePlan = { kind: 'NOOP' } | { kind: 'CHANGE'; item: PlanItem }

/** 수정(키 = 표기·범위·대상은 바꾸지 않는다 — 호출자가 E_IMMUTABLE 로 막는다). 같은 값이면 NOOP. */
export function planUpdate(target: LexiconEntryRow, next: LexiconEntryFields): UpdatePlan {
  const before = fieldsOf(target)
  if (sameFields(before, next)) return { kind: 'NOOP' }
  return { kind: 'CHANGE', item: { action: !next.enabled && before.enabled ? 'DISABLE' : 'UPDATE', row: null, id: target.id, before, after: next } }
}

export function planDisable(target: LexiconEntryRow): PlanItem | null {
  if (!target.enabled) return null
  const before = fieldsOf(target)
  return { action: 'DISABLE', row: null, id: target.id, before, after: { ...before, enabled: false } }
}

export interface ImportRowInput {
  /** 1부터(데이터 행). */
  row: number
  raw: RawEntryInput
  /** 파서가 이미 찾은 행 오류(칸 수 초과 등). */
  errors?: LexiconFieldError[]
}

export interface ImportRowResult {
  row: number | null
  action: 'ADD' | 'UPDATE' | 'DISABLE' | 'UNCHANGED' | 'ERROR'
  surface: string | null
  scope: LexiconScopeName | null
  scopeRefId: string | null
  before: LexiconEntryFields | null
  after: LexiconEntryFields | null
  errors: LexiconFieldError[]
}

export interface ImportPlan {
  results: ImportRowResult[]
  items: PlanItem[]
  counts: PlanCounts & { unchanged: number; error: number }
  /** 파일에 나온 (scope, scopeRefId) 묶음과 그 묶음에서 끄는 수(REPLACE_SCOPE). */
  scopes: { scope: LexiconScopeName; scopeRefId: string | null; disable: number }[]
}

/** 파싱만 한 행(기존 항목 없이)에서 대상 id 를 모은다 — 존재 확인용. */
export function collectScopeRefs(rows: readonly ImportRowInput[]): { scope: LexiconScopeName; scopeRefId: string }[] {
  const seen = new Map<string, { scope: LexiconScopeName; scopeRefId: string }>()
  for (const r of rows) {
    const p = parseEntryInput(r.raw, null)
    if (p.value && p.value.scopeRefId) seen.set(scopeRefKey(p.value.scope, p.value.scopeRefId), { scope: p.value.scope, scopeRefId: p.value.scopeRefId })
  }
  return [...seen.values()]
}

export const refNotFound = (): LexiconFieldError => err('scopeRefId', 'E_SCOPE_REF_NOT_FOUND', '대상(주제·레슨·목소리·사용자)을 찾을 수 없습니다.')

/**
 * Import 계획. MERGE = 파일의 행을 추가·갱신만. REPLACE_SCOPE = 추가로, 파일에 나온 (scope, scopeRefId) 묶음 안에서
 * **파일에 없는 활성 항목을 비활성**(물리 삭제 없음). 빠진 열·칸·키는 기존 값 유지(갱신)·기본값(추가). 같은 키가 파일에 두 번이면 뒤 행 오류.
 * 꺼진 항목과 같은 키의 행에 `enabled` 값이 없으면 **꺼진 채로** 다른 값만 갱신한다 — 일괄 가져오기가 파일이 말하지 않은 켜기를 하지 않게
 * (되살리려면 `enabled=true` 를 적는다. 단건 추가(POST)의 되살림은 화면에서 한 항목을 명시적으로 추가하는 행위라 다르다).
 * `missingRefs` = 존재하지 않는 대상(`scopeRefKey`) — 호출자가 미리 조회해 넘긴다(이 함수는 순수).
 */
export function planImport(existing: readonly LexiconEntryRow[], rows: readonly ImportRowInput[], mode: LexiconImportMode, missingRefs: ReadonlySet<string> = new Set()): ImportPlan {
  const byKey = indexByKey(existing)
  const results: ImportRowResult[] = []
  const items: PlanItem[] = []
  const seen = new Set<string>()
  const pairs = new Map<string, { scope: LexiconScopeName; scopeRefId: string | null; disable: number }>()
  const counts = { add: 0, update: 0, disable: 0, unchanged: 0, error: 0 }
  const fail = (r: ImportRowInput, errors: LexiconFieldError[], v?: { surface?: unknown; scope?: LexiconScopeName; scopeRefId?: string | null }) => {
    counts.error++
    results.push({ row: r.row, action: 'ERROR', surface: typeof v?.surface === 'string' ? v.surface.slice(0, 40) : null, scope: v?.scope ?? null, scopeRefId: v?.scopeRefId ?? null, before: null, after: null, errors })
  }

  for (const r of rows) {
    if (r.errors?.length) {
      fail(r, r.errors, { surface: r.raw.surface })
      continue
    }
    const pre = parseEntryInput(r.raw, null)
    if (!pre.value) {
      fail(r, pre.errors, { surface: r.raw.surface })
      continue
    }
    const key = entryKey(pre.value)
    const at = { surface: pre.value.surface, scope: pre.value.scope, scopeRefId: pre.value.scopeRefId }
    if (pre.value.scopeRefId && missingRefs.has(scopeRefKey(pre.value.scope, pre.value.scopeRefId))) {
      fail(r, [refNotFound()], at)
      continue
    }
    if (seen.has(key)) {
      fail(r, [err('row', 'E_DUPLICATE_IN_FILE', '같은 표기·범위가 파일 안에 이미 있습니다(앞 행만 봅니다).')], at)
      continue
    }
    seen.add(key)
    const pairKey = `${pre.value.scope}\u0001${pre.value.scopeRefId ?? ''}`
    if (!pairs.has(pairKey)) pairs.set(pairKey, { scope: pre.value.scope, scopeRefId: pre.value.scopeRefId, disable: 0 })
    const hit = byKey.get(key)
    if (!hit) {
      counts.add++
      items.push({ action: 'ADD', row: r.row, after: pre.value })
      results.push({ row: r.row, action: 'ADD', ...at, before: null, after: pre.value, errors: [] })
      continue
    }
    const full = parseEntryInput(r.raw, fieldsOf(hit))
    if (!full.value) {
      fail(r, full.errors, at)
      continue
    }
    const before = fieldsOf(hit)
    if (sameFields(before, full.value)) {
      counts.unchanged++
      results.push({ row: r.row, action: 'UNCHANGED', ...at, before, after: full.value, errors: [] })
      continue
    }
    const action = !full.value.enabled && before.enabled ? 'DISABLE' : 'UPDATE'
    counts[action === 'DISABLE' ? 'disable' : 'update']++
    items.push({ action, row: r.row, id: hit.id, before, after: full.value })
    results.push({ row: r.row, action, ...at, before, after: full.value, errors: [] })
  }

  if (mode === 'REPLACE_SCOPE') {
    for (const e of sortEntries(existing)) {
      const pair = pairs.get(`${e.scope}\u0001${e.scopeRefId ?? ''}`)
      if (!e.enabled || seen.has(entryKey(e)) || !pair) continue
      const before = fieldsOf(e)
      const after = { ...before, enabled: false }
      counts.disable++
      pair.disable++
      items.push({ action: 'DISABLE', row: null, id: e.id, before, after })
      results.push({ row: null, action: 'DISABLE', surface: e.surface, scope: e.scope, scopeRefId: e.scopeRefId, before, after, errors: [] })
    }
  }
  return { results, items, counts, scopes: [...pairs.values()] }
}

/**
 * Rollback 계획 — 항목 표를 대상 스냅샷과 같게 만든다. 스냅샷의 키: 없으면 추가, 값이 다르면 갱신(스냅샷에 note 가 없으면 현재 메모 유지).
 * 스냅샷에 없는 키의 활성 항목은 비활성. 결과 표의 활성 항목 해시는 대상 버전의 snapshotHash 와 같다.
 */
export function planRollback(existing: readonly LexiconEntryRow[], target: readonly LexiconSnapshotRowDto[]): PlanItem[] {
  const byKey = indexByKey(existing)
  const targetKeys = new Set<string>()
  const items: PlanItem[] = []
  for (const t of target) {
    const key = entryKey(t)
    if (targetKeys.has(key)) continue
    targetKeys.add(key)
    const hit = byKey.get(key)
    const after: LexiconEntryFields = { ...t, note: t.note === undefined ? (hit?.note ?? null) : t.note }
    if (!hit) items.push({ action: 'ADD', row: null, after })
    else if (!sameFields(fieldsOf(hit), after)) items.push({ action: !after.enabled && hit.enabled ? 'DISABLE' : 'UPDATE', row: null, id: hit.id, before: fieldsOf(hit), after })
  }
  for (const e of sortEntries(existing)) {
    if (!e.enabled || targetKeys.has(entryKey(e))) continue
    items.push({ action: 'DISABLE', row: null, id: e.id, before: fieldsOf(e), after: { ...fieldsOf(e), enabled: false } })
  }
  return items
}

/** 계획을 적용한 뒤의 항목 값 목록(스냅샷 계산용 — DB 에 쓰기 전에 메모리에서 만든다). */
export function applyPlan(existing: readonly LexiconEntryRow[], items: readonly PlanItem[]): LexiconEntryFields[] {
  const byId = new Map(existing.map((e) => [e.id, fieldsOf(e)]))
  const added: LexiconEntryFields[] = []
  for (const i of items) {
    if (i.action === 'ADD') added.push(i.after)
    else byId.set(i.id, i.after)
  }
  return [...byId.values(), ...added]
}

// ── diff · 요약 ─────────────────────────────────────────────────────────

function diffKind(before: LexiconSnapshotRowDto | null, after: LexiconSnapshotRowDto | null): LexiconDiffRowDto['kind'] {
  if (!before) return 'ADDED'
  if (!after || (before.enabled && !after.enabled)) return 'DISABLED'
  if (!before.enabled && after.enabled) return 'ENABLED'
  return 'CHANGED'
}

/**
 * `from`(기준) → `to` 로 가는 변화 행. 기준에만 있는 활성 키는 DISABLED(되돌리면 꺼진다 — after=null), 꺼진 키만 있던 것은 행 없음.
 * 옛 스냅샷(note 없음)과 비교할 때 메모는 비교하지 않는다.
 */
export function diffRows(from: readonly LexiconSnapshotRowDto[], to: readonly LexiconSnapshotRowDto[]): { counts: LexiconDiffCountsDto; rows: LexiconDiffRowDto[] } {
  const f = new Map(from.map((e) => [entryKey(e), e]))
  const t = new Map(to.map((e) => [entryKey(e), e]))
  const rows: LexiconDiffRowDto[] = []
  for (const e of sortEntries(to)) {
    const b = f.get(entryKey(e)) ?? null
    if (b && sameFields(b, e)) continue
    if (!b && !e.enabled) continue
    rows.push({ kind: diffKind(b, e), surface: e.surface, scope: e.scope, scopeRefId: e.scopeRefId, before: b, after: e })
  }
  for (const e of sortEntries(from)) {
    if (t.has(entryKey(e)) || !e.enabled) continue
    rows.push({ kind: 'DISABLED', surface: e.surface, scope: e.scope, scopeRefId: e.scopeRefId, before: e, after: null })
  }
  const counts = { added: 0, changed: 0, disabled: 0, enabled: 0 }
  for (const r of rows) counts[r.kind === 'ADDED' ? 'added' : r.kind === 'CHANGED' ? 'changed' : r.kind === 'DISABLED' ? 'disabled' : 'enabled']++
  return { counts, rows }
}

/** 계획 항목 → diff 행(가져오기 결과 `changes`). */
export function planRows(items: readonly PlanItem[]): LexiconDiffRowDto[] {
  return items.map((i) => {
    const before = i.action === 'ADD' ? null : i.before
    const e = i.action === 'ADD' ? i.after : i.before
    return { kind: diffKind(before, i.after), surface: e.surface, scope: e.scope, scopeRefId: e.scopeRefId, before, after: i.after, row: i.row }
  })
}

/** changeSummary(≤300자) — 사람이 읽는 한 줄. 표기는 앞 3개까지만. */
export function summarize(label: string, items: readonly PlanItem[], after: readonly LexiconEntryFields[]): string {
  const c = countPlan(items)
  const names = items
    .slice(0, 3)
    .map((i) => `「${(i.action === 'ADD' ? i.after : i.before).surface}」`)
    .join('')
  const more = items.length > 3 ? ` 외 ${items.length - 3}` : ''
  const enabled = after.filter((e) => e.enabled).length
  const text = `${label} 추가 ${c.add}·수정 ${c.update}·비활성 ${c.disable}${names ? ` ${names}${more}` : ''} (활성 ${enabled}/전체 ${after.length})`
  return [...text].slice(0, 300).join('')
}

/** 되돌림 요약(Leader ⑮): "v7 로 되돌림: {이유}"(≤300자). */
export function rollbackSummary(targetVersion: number, reason: string): string {
  return [...`v${targetVersion} 로 되돌림: ${reason}`].slice(0, 300).join('')
}
