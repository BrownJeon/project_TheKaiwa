/**
 * 발음 사전 Import/Export 형식(task-003g, 16 §2.5) — CSV(UTF-8, 헤더 `surface,reading,accentType,priority,scope,scopeRefId,wordType,note,enabled`)
 * 와 같은 키의 JSON. 순수 함수(파일 시스템·DB 없음).
 *
 * CSV 인젝션 방어: Export 는 `= + - @ 탭 CR '` 로 시작하는 셀 앞에 `'` 를 붙인다(스프레드시트가 수식으로 해석하지 않게).
 * Import 는 **`'` 뒤에 그 문자들이 오는 셀만** 앞의 `'` 하나를 떼어 되돌린다 → Export → Import 가 값 그대로(왕복 불변).
 * Export 앞에는 UTF-8 BOM 을 붙이고(엑셀이 일본어를 바르게 연다) Import 는 BOM 을 떼어 낸다.
 */
import type { LexiconEntryFields, LexiconFieldError, LexiconFormat } from '@/types/lexicon'
import { LEXICON_CSV_COLUMNS, LEXICON_LIMITS } from '@/types/lexicon'
import type { ImportRowInput } from './lexiconRules'

const BOM = '﻿'
const DANGEROUS_START = /^[=+\-@\t\r']/
const ESCAPED = /^'[=+\-@\t\r']/

export function escapeCsvCell(v: string): string {
  const s = DANGEROUS_START.test(v) ? `'${v}` : v
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function unescapeCsvCell(v: string): string {
  return ESCAPED.test(v) ? v.slice(1) : v
}

export function formatLexiconCsv(entries: readonly LexiconEntryFields[]): string {
  const lines = [LEXICON_CSV_COLUMNS.join(',')]
  for (const e of entries) {
    const cells = [e.surface, e.reading, String(e.accentType), String(e.priority), e.scope, e.scopeRefId ?? '', e.wordType ?? '', e.note ?? '', e.enabled ? 'true' : 'false']
    lines.push(cells.map(escapeCsvCell).join(','))
  }
  return `${BOM}${lines.join('\r\n')}\r\n`
}

export interface CsvRecord {
  /** 파일의 시작 줄 번호(1부터 — 따옴표 안 줄바꿈이 있으면 그 레코드의 첫 줄). */
  line: number
  cells: string[]
}

/** RFC 4180(따옴표·`""`·따옴표 안 줄바꿈·CRLF/LF). 닫히지 않은 따옴표는 null(파일 오류). 완전히 빈 줄은 건너뛴다. */
export function parseCsv(text: string): CsvRecord[] | null {
  const src = text.startsWith(BOM) ? text.slice(1) : text
  const out: CsvRecord[] = []
  let cells: string[] = []
  let cell = ''
  let quoted = false
  let line = 1
  let recordLine = 1
  let touched = false
  const endRecord = () => {
    cells.push(cell)
    if (touched || cells.length > 1 || cells[0] !== '') out.push({ line: recordLine, cells })
    cells = []
    cell = ''
    touched = false
  }
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else {
        if (c === '\n') line++
        cell += c
      }
      continue
    }
    if (c === '"' && cell === '') {
      quoted = true
      touched = true
    } else if (c === ',') {
      cells.push(cell)
      cell = ''
      touched = true
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && src[i + 1] === '\n') i++
      endRecord()
      line++
      recordLine = line
    } else cell += c
  }
  if (quoted) return null
  if (cell !== '' || cells.length || touched) endRecord()
  return out
}

export interface ParsedLexiconFile {
  rows: ImportRowInput[]
  warnings: string[]
  /** 파일 전체가 거부되는 오류(코드 E_IMPORT_FORMAT·E_IMPORT_HEADER·E_IMPORT_TOO_MANY_ROWS). 있으면 rows 는 비어 있다. */
  fileErrors: LexiconFieldError[]
  /** 행 수 초과일 때 실제 데이터 행 수. */
  rowCount?: number
}

const fileError = (code: string, message: string): ParsedLexiconFile => ({ rows: [], warnings: [], fileErrors: [{ field: 'file', code, message }] })
const tooMany = (n: number) => ({ ...fileError('E_IMPORT_TOO_MANY_ROWS', `한 번에 ${LEXICON_LIMITS.importMaxRows}행까지 가져올 수 있습니다.`), rowCount: n })

function parseCsvFile(text: string): ParsedLexiconFile {
  const records = parseCsv(text)
  if (!records) return fileError('E_IMPORT_FORMAT', 'CSV 따옴표가 닫히지 않았습니다.')
  if (records.length === 0) return fileError('E_IMPORT_FORMAT', '파일이 비어 있습니다.')
  const header = records[0].cells.map((h) => h.trim())
  const warnings: string[] = []
  const columns: (string | null)[] = header.map((h) => {
    const canon = LEXICON_CSV_COLUMNS.find((c) => c.toLowerCase() === h.toLowerCase())
    if (!canon) {
      if (h) warnings.push(`UNKNOWN_COLUMN:${h.slice(0, 40)}`)
      return null
    }
    return canon
  })
  const dup = columns.filter((c, i) => c && columns.indexOf(c) !== i)
  if (dup.length) return fileError('E_IMPORT_HEADER', `같은 열이 두 번 있습니다: ${dup[0]}`)
  if (!columns.includes('surface') || !columns.includes('reading')) return fileError('E_IMPORT_HEADER', '머리글에 surface·reading 열이 있어야 합니다.')
  const data = records.slice(1)
  if (data.length > LEXICON_LIMITS.importMaxRows) return tooMany(data.length)
  if (data.length === 0) return fileError('E_IMPORT_FORMAT', '가져올 데이터 행이 없습니다.')
  const rows: ImportRowInput[] = data.map((rec, idx) => {
    const raw: Record<string, unknown> = {}
    columns.forEach((c, i) => {
      if (c) raw[c] = unescapeCsvCell(rec.cells[i] ?? '')
    })
    const errors: LexiconFieldError[] = rec.cells.length > header.length ? [{ field: 'row', code: 'E_ROW_FORMAT', message: `${rec.line}번째 줄: 칸 수가 머리글보다 많습니다.` }] : []
    return { row: idx + 1, raw, errors }
  })
  return { rows, warnings, fileErrors: [] }
}

function parseJsonFile(text: string): ParsedLexiconFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text.startsWith(BOM) ? text.slice(1) : text)
  } catch {
    return fileError('E_IMPORT_FORMAT', 'JSON 형식이 올바르지 않습니다.')
  }
  const list = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' && Array.isArray((parsed as { entries?: unknown }).entries) ? (parsed as { entries: unknown[] }).entries : null
  if (!list) return fileError('E_IMPORT_FORMAT', 'JSON 은 항목 배열 또는 {entries:[…]} 이어야 합니다.')
  if (list.length > LEXICON_LIMITS.importMaxRows) return tooMany(list.length)
  if (list.length === 0) return fileError('E_IMPORT_FORMAT', '가져올 항목이 없습니다.')
  const unknown = new Set<string>()
  const rows: ImportRowInput[] = list.map((item, idx) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { row: idx + 1, raw: {}, errors: [{ field: 'row', code: 'E_ROW_FORMAT', message: '항목은 객체여야 합니다.' }] }
    const raw: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
      if ((LEXICON_CSV_COLUMNS as readonly string[]).includes(k)) raw[k] = v
      else unknown.add(k.slice(0, 40))
    }
    return { row: idx + 1, raw, errors: [] }
  })
  return { rows, warnings: [...unknown].slice(0, 20).map((k) => `UNKNOWN_KEY:${k}`), fileErrors: [] }
}

/** 바이트 상한(256KB)은 호출자가 먼저 확인한다(본문 읽기 단계). */
export function parseLexiconFile(content: string, format: LexiconFormat): ParsedLexiconFile {
  return format === 'csv' ? parseCsvFile(content) : parseJsonFile(content)
}
