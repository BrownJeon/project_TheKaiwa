/**
 * 발음 사전 관리(task-003g, api-contract §7-2) — L0 조합: 권한·PRODUCTION 확인·입력 검증·대상 id 존재 확인·트랜잭션 + 감사·DTO.
 * 사전 데이터의 읽기·쓰기(잠금·버전·스냅샷)는 L4 `speech`(`lexiconStore`) 공개 함수만 쓴다(module-dependency §11 `admin/speech/lexicon`).
 *
 * 버전·감사(domain-model·16 §2.3): 사전은 자체 버전 테이블(`PronunciationLexiconVersion`)이 정본이라 **ConfigurationVersion 은 만들지 않는다**.
 * 변경 1건 = 새 ACTIVE 버전 1 + AuditLog 1(같은 트랜잭션). AuditLog.scope = null + action `lexicon.*`(Leader ⑯ — `ConfigScope` 에 LEXICON 을
 * 넣는 건 공유 DB db push 라 하지 않음), targetId `lexicon:v<새 버전>` 으로 버전과 1:1.
 * PRODUCTION(요청을 처리하는 프로세스의 APP_ENV — 사전은 환경별 행) 쓰기 = `config.apply.production`(SUPER_ADMIN) + 본문 `confirm:"PRODUCTION"`
 * (task-005b 콘솔에 확인 토큰 방식이 아직 없어 Leader ⑧ 대로 본문 문구).
 *
 * 오류(화면은 status 먼저, 같은 status 안은 `details.reason`): 400 VALIDATION(요청 모양 — baseVersion·쿼리·JSON) · 403(missing·
 * PRODUCTION_CONFIRMATION_REQUIRED) · 404 · 409 CONFLICT(VERSION_CONFLICT·E_LEXICON_DUPLICATE·ALREADY_ACTIVE·NO_CHANGE) ·
 * 422 UNPROCESSABLE(E_LEXICON_ENTRY_INVALID·E_IMPORT_*·E_PREVIEW_TEXT_TOO_LONG) · 422 ENGINE_UNAVAILABLE · 429 · 502/504.
 */
import { ApiError, codePointLength, dates, findAuditsByTargets, rateLimit, readFormDataCapped, recordAudit, sanitizeText, userBriefs, userExists, withTransaction, type AuditBrief } from '@/modules/infra'
import { lessonExists, topicExists } from '@/modules/learning'
import {
  afterLexiconCommit,
  collectScopeRefs,
  describeVoice,
  dryRunLexiconImport,
  exportLexicon,
  formatLexiconCsv,
  getLexiconEntry,
  getLexiconVersionDiff,
  immutableKeyErrors,
  lexiconFieldsOf,
  listLexiconEntries,
  listLexiconVersions,
  parseEntryInput,
  parseLexiconFile,
  planRows,
  previewLexiconAudio,
  previewLexiconReadings,
  scopeRefKey,
  writeLexicon,
  type ImportPlan,
  type LexiconListQuery,
  type LexiconOp,
  type LexiconPreviewAudio,
  type LexiconVersionRow,
  type LexiconWriteResult,
  type PlanItem,
  type RawEntryInput,
} from '@/modules/speech'
import type { AdminRole } from '@/types/admin'
import type {
  LexiconActorDto,
  LexiconEntryDto,
  LexiconEntryFields,
  LexiconFieldError,
  LexiconFormat,
  LexiconImportErrorDto,
  LexiconImportMode,
  LexiconImportResultDto,
  LexiconListDto,
  LexiconPreviewDto,
  LexiconRollbackResultDto,
  LexiconScopeName,
  LexiconVersionDetailDto,
  LexiconVersionDto,
  LexiconVersionListDto,
  LexiconWriteResultDto,
} from '@/types/lexicon'
import { LEXICON_CSV_COLUMNS, LEXICON_LIMITS, LEXICON_PRODUCTION_CONFIRM, LEXICON_SCOPES } from '@/types/lexicon'
import type { AdminActor } from '../permissions/guard'
import { assertCapability } from '../permissions/guard'

const AUDIT_PREFIX = 'lexicon.'
export const lexiconAuditTarget = (version: number) => `lexicon:v${version}`
const SCOPE_REF_RE = /^[A-Za-z0-9_-]{1,40}$/

// ── 공통 ───────────────────────────────────────────────────────────────

const invalid = (field: string, message: string, extra: Record<string, unknown> = {}) => new ApiError('VALIDATION', message, { field, ...extra })

/** 422 칸 오류 — `details.errors[{field, code, message}]` + `details.fields{field: code}`(첫 코드). */
export function fieldErrors(errors: readonly LexiconFieldError[], extra: Record<string, unknown> = {}): ApiError {
  const fields: Record<string, string> = {}
  for (const e of errors) if (!(e.field in fields)) fields[e.field] = e.code
  return new ApiError('UNPROCESSABLE', errors[0]?.message ?? '입력값을 확인해 주세요.', { reason: 'E_LEXICON_ENTRY_INVALID', errors, fields, ...extra })
}

export interface LexiconWriteMeta {
  baseVersion: number
  reason: string
  confirm: string | null
  /** 이유 칸 오류(항목 칸 오류와 함께 한 번에 돌려준다). */
  reasonErrors: LexiconFieldError[]
}

function parseBaseVersion(raw: unknown): number {
  const n = typeof raw === 'string' && /^\d{1,7}$/.test(raw.trim()) ? Number(raw.trim()) : raw
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 1_000_000) throw invalid('baseVersion', '기준 버전(baseVersion)이 필요합니다 — 목록을 다시 불러와 주세요.')
  return n
}

/** 쓰기 공통 본문: `baseVersion`(지금 ACTIVE 번호, 없으면 0 — 없거나 형식 오류면 400) · `reason`(1~200자, 칸 오류 E_REASON) · `confirm`. */
export function readWriteMeta(body: Record<string, unknown>): LexiconWriteMeta {
  const baseVersion = parseBaseVersion(body.baseVersion)
  const reason = typeof body.reason === 'string' ? sanitizeText(body.reason) : ''
  const reasonErrors: LexiconFieldError[] = []
  if (!reason) reasonErrors.push({ field: 'reason', code: 'E_REASON', message: '변경 이유를 입력해 주세요.' })
  else if (codePointLength(reason) > LEXICON_LIMITS.reasonMax) reasonErrors.push({ field: 'reason', code: 'E_REASON', message: `변경 이유는 ${LEXICON_LIMITS.reasonMax}자 이하여야 합니다.` })
  const confirm = typeof body.confirm === 'string' ? body.confirm : null
  return { baseVersion, reason, confirm, reasonErrors }
}

/**
 * PRODUCTION 보호(role-permission §6, 16 §2.3): 사전 변경은 발음 전체에 영향 → `voices.manage` 의 production-sensitive 동작으로 보고
 * `config.apply.production`(SUPER_ADMIN)을 추가 요구(부족하면 403 details.missing), 그리고 확인 문구 `confirm === "PRODUCTION"`(아니면 403).
 */
export function authorizeLexiconWrite(actor: AdminActor, meta: Pick<LexiconWriteMeta, 'confirm'>): void {
  assertCapability(actor, 'voices.manage', { targetEnvironment: actor.environment, productionSensitive: true })
  if (actor.environment === 'PRODUCTION' && meta.confirm !== LEXICON_PRODUCTION_CONFIRM) {
    throw new ApiError('FORBIDDEN', `운영(PRODUCTION) 사전 변경은 확인 문구 "${LEXICON_PRODUCTION_CONFIRM}" 를 입력해야 합니다.`, { reason: 'PRODUCTION_CONFIRMATION_REQUIRED' })
  }
}

/** 본문에서 항목 필드만(쓰기 메타·알 수 없는 키는 버린다). */
function pickEntryFields(body: Record<string, unknown>): RawEntryInput {
  const out: RawEntryInput = {}
  for (const k of LEXICON_CSV_COLUMNS) if (Object.prototype.hasOwnProperty.call(body, k) && body[k] !== undefined) out[k] = body[k]
  return out
}

async function refExists(scope: LexiconScopeName, id: string): Promise<boolean> {
  switch (scope) {
    case 'COURSE':
      return topicExists(id)
    case 'LESSON':
      return lessonExists(id)
    case 'VOICE':
      return (await describeVoice(id)) !== null
    case 'USER':
      return userExists(id)
    default:
      return false
  }
}

/** 존재하지 않는 대상의 `scopeRefKey` 집합. 20개씩 병렬 조회. */
async function missingRefsOf(pairs: readonly { scope: LexiconScopeName; scopeRefId: string }[]): Promise<Set<string>> {
  const missing = new Set<string>()
  for (let i = 0; i < pairs.length; i += 20) {
    const batch = pairs.slice(i, i + 20)
    const found = await Promise.all(batch.map((p) => refExists(p.scope, p.scopeRefId)))
    batch.forEach((p, j) => {
      if (!found[j]) missing.add(scopeRefKey(p.scope, p.scopeRefId))
    })
  }
  return missing
}

const REF_NOT_FOUND: LexiconFieldError = { field: 'scopeRefId', code: 'E_SCOPE_REF_NOT_FOUND', message: '대상(주제·레슨·목소리·사용자)을 찾을 수 없습니다.' }

function flattenImportErrors(plan: ImportPlan): { errors: LexiconImportErrorDto[]; errorsTruncated: number } {
  const all: LexiconImportErrorDto[] = []
  for (const r of plan.results) if (r.action === 'ERROR' && r.row !== null) for (const e of r.errors) all.push({ row: r.row, field: e.field === 'row' ? null : e.field, code: e.code })
  return { errors: all.slice(0, LEXICON_LIMITS.importErrorsMax), errorsTruncated: Math.max(0, all.length - LEXICON_LIMITS.importErrorsMax) }
}

/** speech 저장소 오류(이름) → 봉투 오류. */
function mapStoreError(e: unknown): never {
  const err = e as {
    name?: string
    baseVersion?: number
    currentVersion?: number
    existing?: LexiconEntryDto | null
    errors?: LexiconFieldError[]
    plan?: ImportPlan
    reason?: string
    version?: number
    integrity?: string
    issues?: unknown[]
  }
  switch (err?.name) {
    case 'LexiconVersionConflictError':
      throw new ApiError('CONFLICT', '그 사이 다른 곳에서 사전이 바뀌었어요. 목록을 새로 불러온 뒤 다시 시도해 주세요.', { reason: 'VERSION_CONFLICT', baseVersion: err.baseVersion ?? null, currentVersion: err.currentVersion ?? null })
    case 'LexiconEntryNotFoundError':
      throw new ApiError('NOT_FOUND', '사전 항목을 찾을 수 없습니다.')
    case 'LexiconVersionNotFoundError':
      throw new ApiError('NOT_FOUND', '사전 버전을 찾을 수 없습니다.')
    case 'LexiconDuplicateError':
      throw new ApiError('CONFLICT', '같은 표기·범위의 항목이 이미 있어요. 그 항목을 고쳐 주세요.', { reason: 'E_LEXICON_DUPLICATE', existing: err.existing ?? null, existingId: err.existing?.id ?? null })
    case 'LexiconEntryInvalidError':
      throw fieldErrors(err.errors ?? [])
    case 'LexiconImportInvalidError': {
      const plan = err.plan
      throw new ApiError('UNPROCESSABLE', '오류가 있는 행이 있어 가져오지 않았습니다. 미리 보기(dryRun)로 확인해 주세요.', {
        reason: 'E_IMPORT_HAS_ERRORS',
        counts: plan?.counts ?? null,
        ...(plan ? flattenImportErrors(plan) : { errors: [], errorsTruncated: 0 }),
      })
    }
    case 'LexiconSnapshotIntegrityError':
      // 409 가 아니라 422: 다시 불러와도 풀리지 않는 데이터 문제(동시 변경 충돌과 구분) — Codex C2.
      throw new ApiError('UNPROCESSABLE', `사전 버전 v${err.version} 기록이 손상돼 비교·되돌리기를 할 수 없어요.`, {
        reason: 'E_SNAPSHOT_INTEGRITY',
        version: err.version ?? null,
        integrity: err.integrity ?? null,
        issues: err.issues ?? [],
      })
    case 'LexiconRollbackRejectedError':
      throw new ApiError('CONFLICT', err.reason === 'NO_CHANGE' ? '지금 사전과 내용이 같아 되돌릴 것이 없어요.' : '이미 사용 중인 버전입니다.', { reason: err.reason ?? 'ALREADY_ACTIVE' })
  }
  throw e
}

interface AuditParts {
  action: string
  before: unknown
  after: unknown
}

/** 한 트랜잭션: 사전 쓰기(잠금·버전) + 감사 1행. 변경이 없으면 감사도 없다. 커밋 뒤 이 프로세스의 사전 캐시를 비운다. */
async function commit(actor: AdminActor, meta: LexiconWriteMeta, op: LexiconOp, missingRefs: ReadonlySet<string>, audit: (r: LexiconWriteResult) => AuditParts): Promise<LexiconWriteResult> {
  let result: LexiconWriteResult
  try {
    result = await withTransaction(
      async (tx) => {
        const r = await writeLexicon(tx, { environment: actor.environment, actorUserId: actor.id, baseVersion: meta.baseVersion, reason: meta.reason, missingRefs }, op)
        if (r.changed) {
          const a = audit(r)
          await recordAudit(
            { environment: actor.environment, actor: { id: actor.id, email: actor.email, role: actor.role }, action: a.action, scope: null, targetId: lexiconAuditTarget(r.version.version), before: a.before, after: a.after, reason: meta.reason, ip: actor.ip },
            tx,
          )
        }
        return r
      },
      { timeoutMs: 60_000, retries: 1 },
    )
  } catch (e) {
    mapStoreError(e)
  }
  if (result.changed) afterLexiconCommit()
  return result
}

const sample = (items: readonly PlanItem[]) => items.slice(0, 20).map((i) => ({ action: i.action, surface: (i.action === 'ADD' ? i.after : i.before).surface, scope: (i.action === 'ADD' ? i.after : i.before).scope }))
const versionRef = (v: { version: number; createdAt: Date }) => ({ version: v.version, createdAt: v.createdAt.toISOString() })

function writeDto(r: LexiconWriteResult): LexiconWriteResultDto {
  return { changed: r.changed, entry: r.entry, version: versionRef(r.version), previousVersion: r.changed ? r.previousVersion : null, ...(r.revived ? { revived: true } : {}) }
}

// ── 버전 DTO(작업자·감사) ───────────────────────────────────────────────

/** 감사 행은 같은 트랜잭션에서 버전 행 뒤에 쓰인다 — 버전보다 먼저 생긴 행(지운 QA 버전 번호의 옛 감사 등)은 이 버전의 것이 아니다. */
const AUDIT_SKEW_MS = 5_000

function restoredFromOf(after: unknown): number | null {
  const v = after && typeof after === 'object' ? (after as { restoredFrom?: unknown }).restoredFrom : null
  return typeof v === 'number' && Number.isInteger(v) ? v : null
}

async function versionDtos(actor: AdminActor, rows: readonly LexiconVersionRow[]): Promise<LexiconVersionDto[]> {
  const [audits, users] = await Promise.all([
    findAuditsByTargets(actor.environment, rows.map((v) => lexiconAuditTarget(v.version)), AUDIT_PREFIX),
    userBriefs(rows.map((v) => v.actorUserId).filter((x): x is string => !!x)),
  ])
  return rows.map((v) => {
    const found: AuditBrief | undefined = audits.get(lexiconAuditTarget(v.version))
    const audit = found && found.createdAt.getTime() >= v.createdAt.getTime() - AUDIT_SKEW_MS ? found : undefined
    const user = v.actorUserId ? users.get(v.actorUserId) : undefined
    const actorDto: LexiconActorDto | null = user
      ? { name: user.name ?? audit?.actorEmailSnap ?? null, role: user.role as AdminRole }
      : audit
        ? { name: audit.actorEmailSnap, role: (audit.actorRoleSnap as AdminRole | null) ?? null }
        : null
    return {
      version: v.version,
      status: v.status,
      createdAt: v.createdAt.toISOString(),
      actor: actorDto,
      changeSummary: v.changeSummary,
      entryCount: v.entryCount,
      enabledCount: v.enabledCount,
      snapshotHash: v.snapshotHash,
      integrity: v.integrity,
      reason: audit?.reason ?? null,
      action: audit?.action ?? null,
      restoredFrom: audit ? restoredFromOf(audit.after) : null,
    }
  })
}

// ── 목록·단건 ───────────────────────────────────────────────────────────

function parsePage(sp: URLSearchParams, def: number, max: number): { page: number; pageSize: number } {
  const pageRaw = sp.get('page') ?? '1'
  if (!/^\d{1,5}$/.test(pageRaw) || Number(pageRaw) < 1) throw invalid('page', 'page 는 1 이상의 정수여야 합니다.')
  const sizeRaw = sp.get('pageSize') ?? String(def)
  if (!/^\d{1,3}$/.test(sizeRaw) || Number(sizeRaw) < 1 || Number(sizeRaw) > max) throw invalid('pageSize', `pageSize 는 1~${max} 정수여야 합니다.`)
  return { page: Number(pageRaw), pageSize: Number(sizeRaw) }
}

export function parseLexiconListQuery(sp: URLSearchParams): LexiconListQuery {
  const q = (sp.get('q') ?? '').trim()
  if (codePointLength(q) > LEXICON_LIMITS.surfaceMax) throw invalid('q', `검색어는 ${LEXICON_LIMITS.surfaceMax}자 이하여야 합니다.`)
  const scopeRaw = (sp.get('scope') ?? '').trim().toUpperCase()
  if (scopeRaw && scopeRaw !== 'ALL' && !(LEXICON_SCOPES as readonly string[]).includes(scopeRaw)) throw invalid('scope', '범위 값이 올바르지 않습니다.')
  const scopeRefId = (sp.get('scopeRefId') ?? '').trim()
  if (scopeRefId && !SCOPE_REF_RE.test(scopeRefId)) throw invalid('scopeRefId', '대상 id 형식이 올바르지 않습니다.')
  const en = (sp.get('enabled') ?? 'all').trim().toLowerCase()
  let enabled: boolean | null
  if (en === '' || en === 'all') enabled = null
  else if (en === '1' || en === 'true') enabled = true
  else if (en === '0' || en === 'false') enabled = false
  else throw invalid('enabled', 'enabled 는 1·all(·0) 중 하나입니다.')
  const sortRaw = (sp.get('sort') ?? 'recent').trim()
  if (sortRaw !== 'recent' && sortRaw !== 'surface') throw invalid('sort', 'sort 는 recent·surface 중 하나입니다.')
  return {
    q: q || null,
    scope: scopeRaw && scopeRaw !== 'ALL' ? (scopeRaw as LexiconScopeName) : null,
    scopeRefId: scopeRefId || null,
    enabled,
    sort: sortRaw,
    ...parsePage(sp, LEXICON_LIMITS.pageSizeDefault, LEXICON_LIMITS.pageSizeMax),
  }
}

export async function listLexiconDtos(actor: AdminActor, sp: URLSearchParams): Promise<LexiconListDto> {
  const q = parseLexiconListQuery(sp)
  const r = await listLexiconEntries(actor.environment, q)
  const [active] = r.active ? await versionDtos(actor, [r.active]) : [null]
  return { environment: actor.environment, items: r.items, page: q.page, pageSize: q.pageSize, total: r.total, dictionaryVersion: r.dictionaryVersion, counts: r.counts, active }
}

export async function getLexiconEntryDto(actor: AdminActor, id: string): Promise<LexiconEntryDto> {
  const e = await getLexiconEntry(actor.environment, id)
  if (!e) throw new ApiError('NOT_FOUND', '사전 항목을 찾을 수 없습니다.')
  return e
}

// ── 추가·수정·비활성 ─────────────────────────────────────────────────────

export async function createLexiconEntry(actor: AdminActor, body: Record<string, unknown>): Promise<LexiconWriteResultDto> {
  const meta = readWriteMeta(body)
  authorizeLexiconWrite(actor, meta)
  const parsed = parseEntryInput(pickEntryFields(body), null)
  if (!parsed.value || meta.reasonErrors.length) throw fieldErrors([...parsed.errors, ...meta.reasonErrors])
  const value = parsed.value
  const missing = await missingRefsOf(value.scopeRefId ? [{ scope: value.scope, scopeRefId: value.scopeRefId }] : [])
  if (missing.size) throw fieldErrors([REF_NOT_FOUND])
  const r = await commit(actor, meta, { kind: 'CREATE', value }, missing, (w) => ({
    action: 'lexicon.create',
    before: { version: w.previousVersion, entry: w.revived && w.items[0] && w.items[0].action !== 'ADD' ? w.items[0].before : null },
    after: { version: w.version.version, entryId: w.entry?.id ?? null, entry: value, revived: w.revived },
  }))
  return writeDto(r)
}

export async function updateLexiconEntry(actor: AdminActor, id: string, body: Record<string, unknown>): Promise<LexiconWriteResultDto> {
  const meta = readWriteMeta(body)
  authorizeLexiconWrite(actor, meta)
  const patch = pickEntryFields(body)
  if (Object.keys(patch).length === 0) throw invalid('entry', '바꿀 값이 없습니다.')
  const current = await getLexiconEntry(actor.environment, id)
  if (!current) throw new ApiError('NOT_FOUND', '사전 항목을 찾을 수 없습니다.')
  const parsed = parseEntryInput(patch, lexiconFieldsOf(current))
  const keyErrors = parsed.value ? immutableKeyErrors(lexiconFieldsOf(current), parsed.value) : []
  if (!parsed.value || keyErrors.length || meta.reasonErrors.length) throw fieldErrors([...parsed.errors, ...keyErrors, ...meta.reasonErrors])
  const r = await commit(actor, meta, { kind: 'UPDATE', id, patch }, new Set(), (w) => {
    const item = w.items[0]
    return {
      action: 'lexicon.update',
      before: { version: w.previousVersion, entryId: id, entry: item && item.action !== 'ADD' ? item.before : null },
      after: { version: w.version.version, entryId: id, entry: item?.after ?? null },
    }
  })
  return writeDto(r)
}

export async function disableLexiconEntry(actor: AdminActor, id: string, body: Record<string, unknown>): Promise<LexiconWriteResultDto> {
  const meta = readWriteMeta(body)
  authorizeLexiconWrite(actor, meta)
  if (meta.reasonErrors.length) throw fieldErrors(meta.reasonErrors)
  const r = await commit(actor, meta, { kind: 'DISABLE', id }, new Set(), (w) => {
    const item = w.items[0]
    return {
      action: 'lexicon.disable',
      before: { version: w.previousVersion, entryId: id, entry: item && item.action !== 'ADD' ? item.before : null },
      after: { version: w.version.version, entryId: id, enabled: false },
    }
  })
  return writeDto(r)
}

// ── Import · Export ─────────────────────────────────────────────────────

/** multipart 본문 상한 — 파일(≤256KB) + 필드·경계 여유. 넘으면 422 E_IMPORT_TOO_LARGE. */
export const LEXICON_IMPORT_BODY_MAX = LEXICON_LIMITS.importMaxBytes + 32 * 1024

const importError = (reason: string, message: string, extra: Record<string, unknown> = {}) => new ApiError('UNPROCESSABLE', message, { reason, ...extra })

function formatOf(file: File, override: FormDataEntryValue | null): LexiconFormat | null {
  const f = typeof override === 'string' ? override.trim().toLowerCase() : ''
  if (f === 'csv' || f === 'json') return f
  const name = (file.name ?? '').toLowerCase()
  if (name.endsWith('.csv')) return 'csv'
  if (name.endsWith('.json')) return 'json'
  const type = (file.type ?? '').toLowerCase()
  if (type.includes('csv')) return 'csv'
  if (type.includes('json')) return 'json'
  return null
}

/**
 * Import — multipart `file`(+적용 때 `reason`·`baseVersion`·`confirm`, 선택 `format`), 쿼리 `mode`·`dryRun`.
 * 전부 아니면 전무: 오류 행이 1개라도 있으면 적용 거절(422 E_IMPORT_HAS_ERRORS). 변경이 있으면 새 버전 1 + AuditLog 1.
 */
export async function importLexicon(actor: AdminActor, req: Request, sp: URLSearchParams): Promise<LexiconImportResultDto> {
  const modeRaw = (sp.get('mode') ?? 'MERGE').trim().toUpperCase()
  if (modeRaw !== 'MERGE' && modeRaw !== 'REPLACE_SCOPE') throw invalid('mode', 'mode 는 MERGE·REPLACE_SCOPE 중 하나입니다.')
  const mode = modeRaw as LexiconImportMode
  const dr = (sp.get('dryRun') ?? '0').trim().toLowerCase()
  if (!['1', '0', 'true', 'false'].includes(dr)) throw invalid('dryRun', 'dryRun 은 1·0 중 하나입니다.')
  const dryRun = dr === '1' || dr === 'true'

  let form: FormData
  try {
    form = await readFormDataCapped(req, LEXICON_IMPORT_BODY_MAX)
  } catch (e) {
    if (e instanceof ApiError && e.details?.reason === 'TOO_LARGE') throw importError('E_IMPORT_TOO_LARGE', `파일은 ${LEXICON_LIMITS.importMaxBytes / 1024}KB 이하여야 합니다.`, { maxBytes: LEXICON_LIMITS.importMaxBytes })
    throw e
  }
  const file = form.get('file')
  if (!(file instanceof File)) throw invalid('file', '가져올 파일(file)이 필요합니다.')
  if (file.size > LEXICON_LIMITS.importMaxBytes) throw importError('E_IMPORT_TOO_LARGE', `파일은 ${LEXICON_LIMITS.importMaxBytes / 1024}KB 이하여야 합니다.`, { maxBytes: LEXICON_LIMITS.importMaxBytes, bytes: file.size })
  const format = formatOf(file, form.get('format'))
  if (!format) throw importError('E_IMPORT_FORMAT', 'CSV(.csv) 나 JSON(.json) 파일만 가져올 수 있습니다.')

  // 쓰기 권한·메타는 파일을 해석하기 전에 확인한다(dryRun 은 이유·기준 버전 불필요).
  const field = (k: string) => {
    const v = form.get(k)
    return typeof v === 'string' ? v : undefined
  }
  const meta = dryRun ? null : readWriteMeta({ baseVersion: field('baseVersion'), reason: field('reason'), confirm: field('confirm') })
  if (meta) {
    authorizeLexiconWrite(actor, meta)
    if (meta.reasonErrors.length) throw fieldErrors(meta.reasonErrors)
  }

  let content: string
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
  } catch {
    throw importError('E_IMPORT_FORMAT', 'UTF-8 로 읽을 수 없는 파일입니다.')
  }
  const parsed = parseLexiconFile(content, format)
  if (parsed.fileErrors.length) {
    const fe = parsed.fileErrors[0]
    throw importError(fe.code, fe.message, { errors: parsed.fileErrors, ...(parsed.rowCount !== undefined ? { rows: parsed.rowCount, maxRows: LEXICON_LIMITS.importMaxRows } : {}) })
  }
  const missing = await missingRefsOf(collectScopeRefs(parsed.rows))

  if (!meta) {
    const d = await dryRunLexiconImport(actor.environment, parsed.rows, mode, missing)
    return importDto({ dryRun, mode, format, baseVersion: d.activeVersion, rows: parsed.rows.length, warnings: parsed.warnings }, d.plan, false, null)
  }
  const r = await commit(actor, meta, { kind: 'IMPORT', rows: parsed.rows, mode }, missing, (w) => ({
    action: 'lexicon.import',
    before: { version: w.previousVersion },
    after: { version: w.version.version, mode, format, rows: parsed.rows.length, counts: w.importPlan?.counts ?? null, sample: sample(w.items) },
  }))
  if (!r.importPlan) throw new Error('import plan 누락')
  return importDto({ dryRun, mode, format, baseVersion: meta.baseVersion, rows: parsed.rows.length, warnings: parsed.warnings }, r.importPlan, r.changed, versionRef(r.version))
}

function importDto(
  base: Pick<LexiconImportResultDto, 'dryRun' | 'mode' | 'format' | 'baseVersion' | 'rows' | 'warnings'>,
  plan: ImportPlan,
  applied: boolean,
  version: LexiconImportResultDto['version'],
): LexiconImportResultDto {
  const changes = planRows(plan.items)
  return {
    ...base,
    counts: plan.counts,
    scopes: plan.scopes,
    changes: changes.slice(0, LEXICON_LIMITS.importChangesMax),
    changesTruncated: Math.max(0, changes.length - LEXICON_LIMITS.importChangesMax),
    ...flattenImportErrors(plan),
    applied,
    version,
  }
}

export interface LexiconExportFile {
  filename: string
  contentType: string
  body: string
  dictionaryVersion: number
  exportedAt: string
  consistent: boolean
}

export async function exportLexiconFile(actor: AdminActor, sp: URLSearchParams): Promise<LexiconExportFile> {
  const format = (sp.get('format') ?? 'csv').trim().toLowerCase()
  if (format !== 'csv' && format !== 'json') throw invalid('format', 'format 은 csv·json 중 하나입니다.')
  const data = await exportLexicon(actor.environment)
  const exportedAt = new Date().toISOString()
  const filename = `lexicon-${actor.environment.toLowerCase()}-v${data.dictionaryVersion}-${dates.todayKst().replace(/-/g, '')}.${format}`
  const body = format === 'csv' ? formatLexiconCsv(data.entries) : `${JSON.stringify({ dictionaryVersion: data.dictionaryVersion, environment: actor.environment, exportedAt, entries: data.entries }, null, 2)}\n`
  return { filename, contentType: format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8', body, dictionaryVersion: data.dictionaryVersion, exportedAt, consistent: data.consistent }
}

// ── 미리듣기 ────────────────────────────────────────────────────────────

interface PreviewRequest {
  text: string
  voiceId: string | null
  drafts: LexiconEntryFields[]
  compare: boolean
  side: 'before' | 'after' | null
}

export function parsePreviewBody(body: Record<string, unknown>): PreviewRequest {
  const text = typeof body.text === 'string' ? sanitizeText(body.text) : ''
  if (!text) throw invalid('text', '들어 볼 예문을 입력해 주세요.')
  if (codePointLength(text) > LEXICON_LIMITS.previewTextMax) throw invalid('text', `예문은 ${LEXICON_LIMITS.previewTextMax}자 이하여야 합니다.`)
  let voiceId: string | null = null
  if (body.voiceId !== undefined && body.voiceId !== null && body.voiceId !== '') {
    if (typeof body.voiceId !== 'string' || body.voiceId.length > 80) throw invalid('voiceId', '목소리 id 형식이 올바르지 않습니다.')
    voiceId = body.voiceId
  }
  const rawDrafts = body.draftEntries ?? []
  if (!Array.isArray(rawDrafts)) throw invalid('draftEntries', 'draftEntries 는 배열이어야 합니다.')
  if (rawDrafts.length > LEXICON_LIMITS.previewDraftsMax) throw invalid('draftEntries', `초안은 ${LEXICON_LIMITS.previewDraftsMax}개까지입니다.`)
  const drafts: LexiconEntryFields[] = []
  rawDrafts.forEach((d, index) => {
    if (!d || typeof d !== 'object' || Array.isArray(d)) throw invalid('draftEntries', '초안 항목은 객체여야 합니다.', { index })
    const p = parseEntryInput(pickEntryFields(d as Record<string, unknown>), null)
    if (!p.value) throw fieldErrors(p.errors, { index })
    drafts.push(p.value)
  })
  if (body.compare !== undefined && typeof body.compare !== 'boolean') throw invalid('compare', 'compare 는 true/false 입니다.')
  const side = body.side === undefined || body.side === null ? null : body.side
  if (side !== null && side !== 'before' && side !== 'after') throw invalid('side', 'side 는 before·after 중 하나입니다.')
  return { text, voiceId, drafts, compare: body.compare === true, side }
}

/** 예문 길이 초과는 speech 가 PreviewTextTooLongError 로 바꿔 올리므로(→ 422 E_PREVIEW_TEXT_TOO_LONG) 여기 없다(REV-017 L1). */
const PREVIEW_PROBLEM: Record<string, { field: string; message: string }> = {
  VOICE_NOT_AVAILABLE: { field: 'voiceId', message: '선택할 수 없는 목소리예요.' },
  TEXT_EMPTY: { field: 'text', message: '읽을 내용이 없어요.' },
}

/** speech·engine TTS 오류 → 봉투(엔진명·주소 없음, traceId 만). */
function mapPreviewError(e: unknown): never {
  const err = e as { name?: string; problem?: string; kind?: string; traceId?: unknown }
  const trace = typeof err?.traceId === 'string' ? { traceId: err.traceId } : {}
  if (err?.name === 'PreviewTextTooLongError') throw new ApiError('UNPROCESSABLE', '예문이 너무 길어요. 더 짧게 줄여 주세요.', { reason: 'E_PREVIEW_TEXT_TOO_LONG', ...trace })
  if (err?.name === 'TtsRequestError' && err.problem) {
    const m = PREVIEW_PROBLEM[err.problem] ?? { field: 'text', message: '요청을 처리할 수 없어요.' }
    throw invalid(m.field, m.message, { reason: err.problem })
  }
  if (err?.name === 'TtsUnavailableError') throw new ApiError('ENGINE_UNAVAILABLE', '목소리 서비스를 지금 쓸 수 없어요.', { reason: 'TTS_UNAVAILABLE', ...trace })
  if (err?.name === 'TtsEngineError') {
    if (err.kind === 'TIMEOUT') throw new ApiError('ENGINE_TIMEOUT', '목소리 서비스 응답이 늦어요. 잠시 후 다시 해 주세요.', trace)
    throw new ApiError('ENGINE_ERROR', '목소리 서비스에서 읽기 확인에 실패했어요.', trace)
  }
  throw e
}

/** 읽기 확인(JSON) — 관리자당 분당 10. 저장·버전·TtsCache 변화 0. */
export async function previewLexiconDto(actor: AdminActor, body: Record<string, unknown>): Promise<LexiconPreviewDto> {
  const p = parsePreviewBody(body)
  rateLimit(`lexicon-preview:${actor.id}`, LEXICON_LIMITS.previewPerMinute)
  try {
    return await previewLexiconReadings({ actorUserId: actor.id, text: p.text, voiceId: p.voiceId, drafts: p.drafts, compare: p.compare })
  } catch (e) {
    mapPreviewError(e)
  }
}

/** 소리(`Accept: audio/wav` + `side`) — 관리자당 분당 10(읽기 확인과 별도). 캐시·메모리 보관 없음. */
export async function previewLexiconWav(actor: AdminActor, body: Record<string, unknown>): Promise<LexiconPreviewAudio> {
  const p = parsePreviewBody(body)
  if (!p.side) throw invalid('side', '소리를 받으려면 side(before·after)가 필요합니다.')
  rateLimit(`lexicon-preview-audio:${actor.id}`, LEXICON_LIMITS.previewPerMinute)
  try {
    return await previewLexiconAudio({ actorUserId: actor.id, text: p.text, voiceId: p.voiceId, drafts: p.drafts, compare: p.side === 'after', side: p.side })
  } catch (e) {
    mapPreviewError(e)
  }
}

// ── 버전 · Rollback ─────────────────────────────────────────────────────

function parseVersionParam(raw: string): number {
  if (!/^\d{1,7}$/.test(raw) || Number(raw) < 1) throw invalid('version', '버전 번호가 올바르지 않습니다.')
  return Number(raw)
}

export async function listLexiconVersionDtos(actor: AdminActor, sp: URLSearchParams): Promise<LexiconVersionListDto> {
  const pg = parsePage(sp, LEXICON_LIMITS.versionPageSizeDefault, LEXICON_LIMITS.versionPageSizeMax)
  const r = await listLexiconVersions(actor.environment, pg)
  return { environment: actor.environment, items: await versionDtos(actor, r.items), page: pg.page, pageSize: pg.pageSize, total: r.total, activeVersion: r.activeVersion }
}

/** 버전 상세 — `compare=previous`(기본, 바로 앞 버전 → 이 버전) · `active`(지금 ACTIVE → 이 버전 = 되돌리면 생길 변화). rows ≤100. */
export async function getLexiconVersionDto(actor: AdminActor, versionParam: string, sp: URLSearchParams): Promise<LexiconVersionDetailDto> {
  const version = parseVersionParam(versionParam)
  const compare = (sp.get('compare') ?? 'previous').trim()
  if (compare !== 'previous' && compare !== 'active') throw invalid('compare', 'compare 는 previous·active 중 하나입니다.')
  let d: Awaited<ReturnType<typeof getLexiconVersionDiff>>
  try {
    d = await getLexiconVersionDiff(actor.environment, version, compare)
  } catch (e) {
    mapStoreError(e)
  }
  if (!d) throw new ApiError('NOT_FOUND', '사전 버전을 찾을 수 없습니다.')
  const [dto] = await versionDtos(actor, [d.row])
  return { ...dto, compare, against: d.against, counts: d.counts, rows: d.rows.slice(0, LEXICON_LIMITS.diffRowsMax), truncated: Math.max(0, d.rows.length - LEXICON_LIMITS.diffRowsMax) }
}

export async function rollbackLexicon(actor: AdminActor, versionParam: string, body: Record<string, unknown>): Promise<LexiconRollbackResultDto> {
  const targetVersion = parseVersionParam(versionParam)
  const meta = readWriteMeta(body)
  authorizeLexiconWrite(actor, meta)
  if (meta.reasonErrors.length) throw fieldErrors(meta.reasonErrors)
  const r = await commit(actor, meta, { kind: 'ROLLBACK', targetVersion }, new Set(), (w) => ({
    action: 'lexicon.rollback',
    before: { version: w.previousVersion },
    after: { version: w.version.version, restoredFrom: targetVersion, counts: w.counts, sample: sample(w.items) },
  }))
  return { version: versionRef(r.version), replaced: { version: r.previousVersion ?? 0, status: 'ROLLED_BACK' }, restoredFrom: targetVersion, counts: r.counts }
}
