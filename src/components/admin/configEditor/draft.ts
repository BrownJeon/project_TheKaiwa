/**
 * 설정 편집 초안(task-012c, 데모 v2 "Form·Raw JSON 은 초안 하나") — 순수 모듈. 단위 테스트 대상.
 *
 * - 칸 모델(`FieldModel`) = 서버 편집 정책(#102 `edit.keys` · #123b) + Effective 값·출처. 화면 잠금은 서버 잠금 → env 가 덮음(SHADOW) →
 *   운영에서 실행 검증 방법 없음(NOVERIFY) 순서.
 * - 초안 = 평면 patch(점 표기 키 → 값) + 스키마 밖 키(`unknown` — Raw JSON 에서 넣은 것, 검증에서 걸러진다). Form 칸 기준값은 저장값,
 *   저장값이 없는 키는 Effective 값(바꾸지 않은 칸을 저장값으로 새로 쓰지 않는다).
 * - Raw JSON 문서 ↔ 평면 키 대응은 서버 #110·#111 과 같다: ENGINE_CONNECTION 은 `connection`·`runtime` 객체 + 맨 위 `credentialRef`(→
 *   `connection.credentialRef`)·`logLevel`(→ `logging.level`)·`enabled`, 그 밖 scope 는 문서 키 = 평면 키. `x-` 로 시작하는 마디는 보존만(초안 밖).
 */
import type {
  AppSettingDto,
  ConfigEditScopeName,
  ConfigKeyPolicyDto,
  ConfigSourceName,
  ConfigVerifiable,
  EditabilityName,
  EffectiveConfigDto,
  SchemaKeyDto,
} from '@/types/admin'
import { type AppSettingMeta, CLIENT_LOCK_WHY, fieldLabel, type FieldLock, LOCK_WHY_FALLBACK } from './configCopy'

export interface FieldModel {
  key: string
  type: SchemaKeyDto['type']
  label: string
  /** 칸 이름이 설명을 잘랐을 때 도움말로 보일 원문 설명. */
  help: string | null
  editability: EditabilityName
  strict: boolean
  /** 화면 잠금(null = 입력칸). SECRET_REF 의 CREDENTIAL_ONLY 는 전용 행(비밀 참조 연결)으로 그린다. */
  lock: FieldLock | null
  lockWhy: string | null
  verifiable: ConfigVerifiable
  min?: number
  max?: number
  enum?: readonly (string | number)[]
  maxLength?: number
  nullable?: boolean
  /** 저장값(관리 층). 없으면 undefined. */
  stored: unknown
  hasStored: boolean
  /** 지금 실제 값(Effective). 모르면 저장값. */
  effective: unknown
  source: ConfigSourceName | null
  secret: boolean
  multiline?: boolean
  ja?: boolean
  voice?: boolean
}

export function fieldLock(p: Pick<ConfigKeyPolicyDto, 'lock' | 'shadowedByEnv' | 'verifiable'>, production: boolean): FieldLock | null {
  if (p.lock) return p.lock
  if (p.shadowedByEnv) return 'SHADOW'
  if (production && p.verifiable === 'NO') return 'NOVERIFY'
  return null
}

function lockWhyOf(lock: FieldLock | null, serverMessage: string | null): string | null {
  if (!lock) return null
  if (lock === 'SHADOW' || lock === 'NOVERIFY') return CLIENT_LOCK_WHY[lock]
  return serverMessage || LOCK_WHY_FALLBACK[lock]
}

/** 연결·예비 순서(#102 `edit.keys` + `keys`) → 칸 모델. `edit` 이 없으면 빈 목록(편집 정책을 모르면 칸을 열지 않는다). */
export function fieldsFromEffective(eff: EffectiveConfigDto, production: boolean): FieldModel[] {
  if (!eff.edit) return []
  const byKey = new Map(eff.keys.map((k) => [k.key, k]))
  return eff.edit.keys.map((p) => {
    const e = byKey.get(p.key)
    const lock = fieldLock(p, production)
    const { label, rest } = fieldLabel(p.description, p.key)
    const hasStored = Object.prototype.hasOwnProperty.call(p, 'stored') && p.stored !== undefined
    return {
      key: p.key,
      type: p.type,
      label,
      help: rest,
      editability: p.editability,
      strict: p.strict,
      lock,
      lockWhy: lockWhyOf(lock, p.lockMessage),
      verifiable: p.verifiable,
      ...(p.min !== undefined ? { min: p.min } : {}),
      ...(p.max !== undefined ? { max: p.max } : {}),
      ...(p.enum ? { enum: p.enum } : {}),
      ...(p.maxLength !== undefined ? { maxLength: p.maxLength } : {}),
      ...(p.nullable ? { nullable: true } : {}),
      stored: p.stored,
      hasStored,
      effective: e ? e.value : p.stored,
      source: e ? e.source : hasStored ? 'CONNECTION_PROFILE' : null,
      secret: p.type === 'SECRET_REF' || Boolean(e?.secret),
    }
  })
}

/** 운영 설정 한 키(#123b) → 칸 모델 하나(편집 키 `value`). */
export function fieldFromAppSetting(dto: AppSettingDto, meta: AppSettingMeta | null, production: boolean): FieldModel {
  const lock = fieldLock({ lock: dto.lock, shadowedByEnv: false, verifiable: dto.verifiable }, production)
  return {
    key: 'value',
    type: dto.type,
    label: meta?.label ?? dto.key,
    help: dto.description || null,
    editability: dto.editability,
    strict: false,
    lock,
    lockWhy: lockWhyOf(lock, dto.lockMessage),
    verifiable: dto.verifiable,
    stored: dto.value,
    hasStored: true,
    effective: dto.value,
    source: dto.exists ? 'DATABASE' : 'DEFAULT',
    secret: false,
    ...(meta?.multiline ? { multiline: true } : {}),
    ...(meta?.ja ? { ja: true } : {}),
    ...(meta?.voice ? { voice: true } : {}),
  }
}

/** 입력칸이 아닌 행(잠금) — 단, 비밀 참조의 CREDENTIAL_ONLY 는 전용 행이라 입력 쪽에 둔다. */
export function isLockedRow(f: Pick<FieldModel, 'lock' | 'secret'>): boolean {
  return f.lock !== null && !(f.secret && f.lock === 'CREDENTIAL_ONLY')
}

// ── 값 비교·초안 ───────────────────────────────────────────────────────────

function stable(v: unknown): string {
  if (v === undefined) return 'undefined'
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  const o = v as Record<string, unknown>
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
    .join(',')}}`
}

export function sameValue(a: unknown, b: unknown): boolean {
  return stable(a) === stable(b)
}

export interface Draft {
  /** 스키마 안 키 → 새 값. */
  patch: Record<string, unknown>
  /** 스키마 밖 키(Raw JSON 에서 넣은 것) — 검증에서 `unknownKey` 로 걸러진다. */
  unknown: Record<string, unknown>
}

export const EMPTY_DRAFT: Draft = { patch: {}, unknown: {} }

export function baselineOf(f: Pick<FieldModel, 'hasStored' | 'stored' | 'effective'>): unknown {
  return f.hasStored ? f.stored : f.effective
}

/** 칸 값 바꾸기 — 기준값과 같아지면 초안에서 뺀다. */
export function setDraftValue(d: Draft, f: Pick<FieldModel, 'key' | 'hasStored' | 'stored' | 'effective'>, value: unknown): Draft {
  const patch = { ...d.patch }
  if (sameValue(value, baselineOf(f))) delete patch[f.key]
  else patch[f.key] = value
  return { patch, unknown: d.unknown }
}

export function resetDraftKey(d: Draft, key: string): Draft {
  const patch = { ...d.patch }
  const unknown = { ...d.unknown }
  delete patch[key]
  delete unknown[key]
  return { patch, unknown }
}

export function draftCount(d: Draft): number {
  return Object.keys(d.patch).length + Object.keys(d.unknown).length
}

export function hasDraftKey(d: Draft, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(d.patch, key)
}

export function draftValue(d: Draft, f: Pick<FieldModel, 'key' | 'hasStored' | 'stored' | 'effective'>): unknown {
  return hasDraftKey(d, f.key) ? d.patch[f.key] : baselineOf(f)
}

/** 서버로 보내는 patch(#104·#105·#106·#107) — 스키마 밖 키도 실어 서버가 `unknownKey`·제안을 돌려주게 한다. */
export function requestPatch(d: Draft): Record<string, unknown> {
  return { ...d.patch, ...d.unknown }
}

/**
 * 입력 글자 → 값. 숫자 칸은 숫자로 읽히면 숫자, 비우면 null(서버가 nullable 여부로 판정), 아니면 글자 그대로(서버가 `type` 오류).
 * JSON 칸은 JSON 으로 읽히면 그 값, 아니면 글자 그대로.
 */
export function coerceInput(type: SchemaKeyDto['type'], raw: string): unknown {
  if (type === 'INTEGER' || type === 'NUMBER') {
    const s = raw.trim()
    if (s === '') return null
    const n = Number(s)
    return Number.isFinite(n) && /^-?\d*(\.\d+)?(e-?\d+)?$/i.test(s) ? n : raw
  }
  if (type === 'JSON') {
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }
  return raw
}

/** 칸에 넣을 글자(값 → 입력 글자). */
export function inputText(type: SchemaKeyDto['type'], v: unknown): string {
  if (v === null || v === undefined) return ''
  if (type === 'JSON' || (typeof v === 'object' && v !== null)) return JSON.stringify(v)
  return String(v)
}

// ── Raw JSON 문서 ↔ 평면 키 ──────────────────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const MAX_DEPTH = 6

/** 경로 마디로 쓰면 `Object.prototype` 을 건드리는 이름 — Raw JSON 에서 오면 거절하고, 경로 쓰기에서도 건너뛴다(REV-047 L-1). */
const BLOCKED_SEGMENTS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype'])
const isBlockedSegment = (seg: string) => BLOCKED_SEGMENTS.has(seg)

function ownChild(o: Record<string, unknown>, seg: string): unknown {
  return Object.prototype.hasOwnProperty.call(o, seg) ? o[seg] : undefined
}

/** 문서 안 경로에 값 쓰기(소유 속성만 따라간다). 막힌 마디가 있으면 쓰지 않고 false. */
function setPath(root: Record<string, unknown>, path: readonly string[], value: unknown): boolean {
  if (path.length === 0 || path.some(isBlockedSegment)) return false
  let cur = root
  for (const seg of path.slice(0, -1)) {
    const next = ownChild(cur, seg)
    if (isObj(next)) cur = next
    else {
      const made: Record<string, unknown> = {}
      cur[seg] = made
      cur = made
    }
  }
  cur[path[path.length - 1]] = value
  return true
}

/** 경로의 값 지우기 — 그 때문에 빈 객체가 된 부모도 지운다(맨 위 마디는 남긴다: 연결 문서의 connection·runtime 은 객체여야 한다). */
function deletePath(root: Record<string, unknown>, path: readonly string[]): void {
  if (path.length === 0 || path.some(isBlockedSegment)) return
  const chain: Record<string, unknown>[] = [root]
  for (const seg of path.slice(0, -1)) {
    const next = ownChild(chain[chain.length - 1], seg)
    if (!isObj(next)) return
    chain.push(next)
  }
  delete chain[chain.length - 1][path[path.length - 1]]
  for (let i = chain.length - 1; i >= 2; i--) {
    if (Object.keys(chain[i]).length > 0) break
    delete chain[i - 1][path[i - 1]]
  }
}

/** 문서 어디든 막힌 이름의 키가 있으면 그 경로(점 표기, 최대 20개). */
function blockedPaths(o: unknown, prefix = '', out: string[] = [], depth = 0): string[] {
  if (out.length >= 20 || depth > 32) return out
  if (Array.isArray(o)) {
    o.forEach((v, i) => blockedPaths(v, prefix ? `${prefix}.${i}` : String(i), out, depth + 1))
    return out
  }
  if (!isObj(o)) return out
  for (const k of Object.keys(o)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (isBlockedSegment(k)) out.push(p)
    else blockedPaths(o[k], p, out, depth + 1)
    if (out.length >= 20) break
  }
  return out
}

function walk(prefix: string, o: Record<string, unknown>, out: Record<string, unknown>, depth: number): void {
  for (const [seg, v] of Object.entries(o)) {
    if (seg.startsWith('x-') || isBlockedSegment(seg)) continue
    const k = prefix ? `${prefix}.${seg}` : seg
    if (isObj(v) && depth < MAX_DEPTH) walk(k, v, out, depth + 1)
    else out[k] = v
  }
}

/** 문서 → 평면 키(서버 #111 `patchFromRaw` 와 같은 대응). */
export function flatFromDoc(scope: ConfigEditScopeName, doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (scope !== 'ENGINE_CONNECTION') {
    for (const [k, v] of Object.entries(doc)) if (!k.startsWith('x-') && !isBlockedSegment(k)) out[k] = v
    return out
  }
  for (const [k, v] of Object.entries(doc)) {
    if (k.startsWith('x-') || isBlockedSegment(k)) continue
    if (k === 'connection' || k === 'runtime') {
      if (isObj(v)) {
        const o = { ...v }
        if (k === 'connection') delete o.credentialRef
        walk(k, o, out, 0)
      } else out[k] = v
    } else if (k === 'credentialRef') out['connection.credentialRef'] = v
    else if (k === 'logLevel') out['logging.level'] = v
    else out[k] = v
  }
  return out
}

/** 평면 키 → 문서 안 경로. */
export function docPath(scope: ConfigEditScopeName, key: string): string[] {
  if (scope === 'ENGINE_CONNECTION') {
    if (key === 'connection.credentialRef') return ['credentialRef']
    if (key === 'logging.level') return ['logLevel']
  }
  return scope === 'ENGINE_CONNECTION' ? key.split('.') : [key]
}

function cloneJson<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T)
}

/** 저장값 문서에 초안을 겹친 문서(원본 불변). */
export function docWithDraft(scope: ConfigEditScopeName, base: Record<string, unknown>, d: Draft): Record<string, unknown> {
  const doc = cloneJson(base)
  for (const [k, v] of Object.entries(requestPatch(d))) setPath(doc, docPath(scope, k), cloneJson(v))
  return doc
}

export function docText(doc: Record<string, unknown>): string {
  return JSON.stringify(doc, null, 2)
}

/** 가림 값(`***`)이 든 문서는 Raw JSON 편집을 열지 않는다 — 되돌려 보내면 가림 글자가 저장값이 된다. */
export function hasMaskedValue(v: unknown): boolean {
  if (v === '***') return true
  if (Array.isArray(v)) return v.some(hasMaskedValue)
  if (isObj(v)) return Object.values(v).some(hasMaskedValue)
  return false
}

export type RawParse =
  | { ok: false; line: number; column: number }
  /** `blocked` = 쓸 수 없는 이름(__proto__·constructor·prototype)의 키 경로 — 초안에 넣지 않고 화면 오류로 보인다. */
  | { ok: true; doc: Record<string, unknown>; draft: Draft; missing: string[]; blocked: string[] }

/** JSON.parse 오류 문구에서 줄·칸(V8: "… at position N (line L column C)" 또는 "… at position N"). */
export function syntaxPosition(text: string, message: string): { line: number; column: number } {
  const lc = /line (\d+) column (\d+)/.exec(message)
  if (lc) return { line: Number(lc[1]), column: Number(lc[2]) }
  const pos = /position (\d+)/.exec(message)
  if (pos) {
    const before = text.slice(0, Number(pos[1])).split('\n')
    return { line: before.length, column: before[before.length - 1].length + 1 }
  }
  return { line: 1, column: 1 }
}

/**
 * Raw 글 → 초안. 기준은 **저장값**(서버 #111 과 같다 — 문서에 적힌 키는 저장값으로 쓰인다). 스키마 밖 키는 `unknown`,
 * 저장값에 있던 키를 문서에서 지웠으면 `missing`(서버는 400 required — 행 저장소라 키 삭제 적용은 없다).
 */
export function parseRawText(text: string, scope: ConfigEditScopeName, storedFlat: Readonly<Record<string, unknown>>, knownKeys: readonly string[]): RawParse {
  let obj: unknown
  try {
    obj = JSON.parse(text)
  } catch (e) {
    return { ok: false, ...syntaxPosition(text, (e as Error).message) }
  }
  if (!isObj(obj)) return { ok: false, line: 1, column: 1 }
  const flat = flatFromDoc(scope, obj)
  const known = new Set(knownKeys)
  const patch: Record<string, unknown> = {}
  const unknown: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(flat)) {
    const stored = Object.prototype.hasOwnProperty.call(storedFlat, k)
    // 저장 문서에 늘 있는 칸(연결 종류에 따라 스키마 밖인 credentialRef 등)은 그대로면 변경이 아니다.
    if (stored && sameValue(v, storedFlat[k])) continue
    if (!known.has(k)) unknown[k] = v
    else patch[k] = v
  }
  const missing = Object.keys(storedFlat).filter((k) => !Object.prototype.hasOwnProperty.call(flat, k))
  return { ok: true, doc: obj, draft: { patch, unknown }, missing, blocked: blockedPaths(obj) }
}

/** 되돌리기(원래대로) 표시 — `rawTextWithField` 의 값 자리에 넣는다. */
export const RESET_VALUE: unique symbol = Symbol('reset')

/**
 * Raw JSON 편집 중 Form 칸 하나를 바꾸면 그 값을 Raw 글에 넣는다(REV-047 M-1 — 초안 하나). 사용자가 Raw 에서 고친 다른 내용은 그대로 둔다
 * (들여쓰기만 2칸으로 다시 쓴다). 규칙은 Form 초안과 같다: 기준값(저장값 → 없으면 Effective)과 같아지거나 되돌리면 저장값이 있는 키는
 * 저장값으로, 없는 키는 문서에서 지운다 — 그래서 `parseRawText(결과)` 의 초안 = Form 이 만든 초안. 글이 JSON 객체가 아니면 null(문법 오류).
 */
export function rawTextWithField(
  text: string,
  scope: ConfigEditScopeName,
  f: Pick<FieldModel, 'key' | 'hasStored' | 'stored' | 'effective'>,
  value: unknown,
): string | null {
  let doc: unknown
  try {
    doc = JSON.parse(text)
  } catch {
    return null
  }
  if (!isObj(doc)) return null
  const path = docPath(scope, f.key)
  if (path.some(isBlockedSegment)) return null
  if (value !== RESET_VALUE && !sameValue(value, baselineOf(f))) setPath(doc, path, cloneJson(value))
  else if (f.hasStored) setPath(doc, path, cloneJson(f.stored))
  else deletePath(doc, path)
  return docText(doc)
}

export type ApplyPayload = { kind: 'raw'; text: string } | { kind: 'patch'; patch: Record<string, unknown>; rawIgnored: boolean }

/**
 * 적용 본문 고르기(REV-047 M-1) — 확인한 변경 요약의 후보(`requestPatch(draft)`)와 같은 변경만 보낸다. Raw JSON 편집 글이 지금 초안과 같은
 * 변경을 뜻하면 그 글 그대로(#111, 감사 config.raw_apply), 아니면(읽기 전 글·문법 오류·지운 저장 키·어긋남) 초안 patch(#107)로 보내고
 * `rawIgnored` 로 화면이 알리게 한다.
 */
export function applyPayload(o: {
  draft: Draft
  rawText: string | null
  scope: ConfigEditScopeName
  storedFlat: Readonly<Record<string, unknown>>
  knownKeys: readonly string[]
}): ApplyPayload {
  const patch = requestPatch(o.draft)
  if (o.rawText === null) return { kind: 'patch', patch, rawIgnored: false }
  const r = parseRawText(o.rawText, o.scope, o.storedFlat, o.knownKeys)
  if (r.ok && r.missing.length === 0 && r.blocked.length === 0 && sameValue(requestPatch(r.draft), patch)) return { kind: 'raw', text: o.rawText }
  return { kind: 'patch', patch, rawIgnored: true }
}

/** 오류 키가 있는 줄(1부터). 문서 경로의 마지막 마디 `"leaf":` 를 찾는다 — 없으면 0. */
export function rawLineOf(text: string, scope: ConfigEditScopeName, key: string): number {
  const path = docPath(scope, key)
  const leaf = `"${path[path.length - 1]}"`
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) if (lines[i].includes(`${leaf}:`) || lines[i].includes(`${leaf} :`)) return i + 1
  return 0
}

/** 제안 키로 바꾸기(Raw JSON 의 "혹시 이 키?"): 같은 부모 안의 마지막 마디 이름만 바꾼다. */
export function renameRawKey(text: string, scope: ConfigEditScopeName, from: string, to: string): string {
  const a = docPath(scope, from)
  const b = docPath(scope, to)
  const line = rawLineOf(text, scope, from)
  if (!line) return text
  const lines = text.split('\n')
  lines[line - 1] = lines[line - 1].replace(`"${a[a.length - 1]}"`, `"${b[b.length - 1]}"`)
  return lines.join('\n')
}

/** #93 Form 본문 — 평면 patch 를 `connection`·`runtime` 객체와 `enabled` 로. 그 밖 키가 있으면 null(#107 로 보낸다). */
export function connectionFormBody(patch: Readonly<Record<string, unknown>>): { connection?: Record<string, unknown>; runtime?: Record<string, unknown>; enabled?: unknown } | null {
  const out: { connection?: Record<string, unknown>; runtime?: Record<string, unknown>; enabled?: unknown } = {}
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'enabled') {
      out.enabled = v
      continue
    }
    const [head, ...rest] = k.split('.')
    if ((head !== 'connection' && head !== 'runtime') || rest.length === 0 || k === 'connection.credentialRef') return null
    // 막힌 마디가 든 키는 #107 로 보내 서버가 unknownKey 로 거절하게 한다(여기서 객체를 만들지 않는다).
    if (rest.some(isBlockedSegment)) return null
    const root: Record<string, unknown> = head === 'connection' ? (out.connection ??= {}) : (out.runtime ??= {})
    setPath(root, rest, v)
  }
  return out
}
