/**
 * 발음 사전 저장소(task-003g) — L4 `speech` 가 소유한 `PronunciationLexiconEntry`·`PronunciationLexiconVersion` 의 조회와 쓰기.
 * 권한·PRODUCTION 확인·감사(AuditLog)·대상 id 존재 확인은 L0 `admin/speech/lexicon` 이 조합한다(이 파일은 권한을 모른다).
 *
 * 쓰기 규칙(domain-model §5, 16 §2.3):
 *   한 트랜잭션 = 잠금 → `baseVersion` 확인(불일치 409) → 항목 변경 → 직전 ACTIVE 를 SUPERSEDED(Rollback 이면 ROLLED_BACK = **밀려난 직전 ACTIVE**,
 *   복원 대상 버전 상태는 그대로) → 새 버전(ACTIVE, 번호 = 환경 최대 + 1, 스냅샷 = 그 환경의 **모든** 항목(꺼진 것 포함) + note,
 *   snapshotHash = 활성 항목 해시). 물리 삭제 없음(비활성 = enabled=false). 변경이 없는 요청은 버전을 만들지 않는다(Rollback 은 409 NO_CHANGE).
 *   저장 1번 = 버전 1개(묶음 게시 없음 — 초안 칸이 엔티티에 없다).
 *
 * 잠금: 환경의 **가장 오래된 버전 행**(번호 최소 — 삭제 경로가 없어 바뀌지 않는다)을 `SELECT … FOR UPDATE` 로 잡는다. 모든 쓰기가 같은 행을
 * 기다리므로 두 관리자(또는 blue/green 두 프로세스)의 쓰기가 직렬화되고, 잠금 뒤의 일반 SELECT 는 READ COMMITTED 라 앞 쓰기가 커밋한
 * ACTIVE·최대 번호를 본다 → 번호 충돌·ACTIVE 2행이 생기지 않는다. 버전 행이 하나도 없는 환경(첫 쓰기)은 잠글 행이 없으므로
 * `@@unique([environment, version])` 이 마지막 방어선이다(동시 첫 쓰기 중 하나는 P2002 → 409).
 */
import type { Environment, Prisma } from '@prisma/client'
import { escapeLike, maskText, prisma, type Tx } from '@/modules/infra'
import type {
  LexiconDiffCountsDto,
  LexiconDiffRowDto,
  LexiconEntryDto,
  LexiconEntryFields,
  LexiconFieldError,
  LexiconImportMode,
  LexiconScopeName,
  LexiconSnapshotIntegrity,
  LexiconSnapshotIssueDto,
  LexiconSnapshotRowDto,
  LexiconVersionStatus,
} from '@/types/lexicon'
import { clearLexiconCache, snapshotHash } from './lexicon'
import {
  applyPlan,
  countPlan,
  diffRows,
  fieldsOf,
  parseEntryInput,
  planCreate,
  planDisable,
  planImport,
  planRollback,
  planUpdate,
  readSnapshotStrict,
  refNotFound,
  rollbackSummary,
  scopeRefKey,
  searchReading,
  sortEntries,
  summarize,
  toSnapshot,
  type ImportPlan,
  type ImportRowInput,
  type LexiconEntryRow,
  type PlanCounts,
  type PlanItem,
  type RawEntryInput,
} from './lexiconRules'
import { moraCount } from './text'

// ── 오류(admin 이 이름으로 봉투 코드로 바꾼다) ────────────────────────────────

export class LexiconVersionConflictError extends Error {
  constructor(
    readonly baseVersion: number,
    readonly currentVersion: number,
  ) {
    super(`사전 버전 충돌(기준 ${baseVersion}, 현재 ${currentVersion})`)
    this.name = 'LexiconVersionConflictError'
  }
}

export class LexiconEntryNotFoundError extends Error {
  constructor() {
    super('사전 항목 없음')
    this.name = 'LexiconEntryNotFoundError'
  }
}

export class LexiconVersionNotFoundError extends Error {
  constructor() {
    super('사전 버전 없음')
    this.name = 'LexiconVersionNotFoundError'
  }
}

export class LexiconDuplicateError extends Error {
  constructor(readonly existing: LexiconEntryDto | null) {
    super('같은 표기·범위의 활성 항목이 있음')
    this.name = 'LexiconDuplicateError'
  }
}

export class LexiconEntryInvalidError extends Error {
  constructor(readonly errors: LexiconFieldError[]) {
    super('사전 항목 검증 실패')
    this.name = 'LexiconEntryInvalidError'
  }
}

export class LexiconImportInvalidError extends Error {
  constructor(readonly plan: ImportPlan) {
    super('가져오기 오류 행 있음')
    this.name = 'LexiconImportInvalidError'
  }
}

/** 버전 스냅샷 손상(Codex C2) — 되돌리기·diff 를 거절한다(→ 422 E_SNAPSHOT_INTEGRITY). 행을 조용히 버리고 진행하지 않는다. */
export class LexiconSnapshotIntegrityError extends Error {
  constructor(
    readonly version: number,
    readonly integrity: Exclude<LexiconSnapshotIntegrity, 'OK'>,
    readonly issues: LexiconSnapshotIssueDto[],
  ) {
    super(`사전 버전 v${version} 스냅샷 손상(${integrity})`)
    this.name = 'LexiconSnapshotIntegrityError'
  }
}

/** Rollback 대상이 지금 ACTIVE(ALREADY_ACTIVE) 이거나 되돌려도 항목 표가 같다(NO_CHANGE). */
export class LexiconRollbackRejectedError extends Error {
  constructor(readonly reason: 'ALREADY_ACTIVE' | 'NO_CHANGE') {
    super(`되돌림 거절(${reason})`)
    this.name = 'LexiconRollbackRejectedError'
  }
}

// ── 조회 ───────────────────────────────────────────────────────────────

const ENTRY_SELECT = {
  id: true,
  surface: true,
  reading: true,
  accentType: true,
  priority: true,
  scope: true,
  scopeRefId: true,
  wordType: true,
  note: true,
  enabled: true,
  createdAt: true,
  updatedAt: true,
} as const

type EntrySelected = Prisma.PronunciationLexiconEntryGetPayload<{ select: typeof ENTRY_SELECT }>

function rowOf(r: EntrySelected): LexiconEntryRow {
  return {
    id: r.id,
    surface: r.surface,
    reading: r.reading,
    accentType: r.accentType,
    priority: r.priority,
    scope: r.scope,
    scopeRefId: r.scopeRefId,
    wordType: (r.wordType as LexiconEntryFields['wordType']) ?? null,
    note: r.note,
    enabled: r.enabled,
  }
}

export function toEntryDto(r: EntrySelected): LexiconEntryDto {
  return { ...rowOf(r), moraCount: moraCount(r.reading), createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() }
}

export interface LexiconVersionRow {
  version: number
  status: LexiconVersionStatus
  changeSummary: string | null
  /** Rollback 으로 만든 버전이면 복원한 원본 번호(task-018 ③), 아니면 null. */
  rollbackOf: number | null
  actorUserId: string | null
  createdAt: Date
  snapshotHash: string
  entryCount: number
  enabledCount: number
  integrity: LexiconSnapshotIntegrity
}

const VERSION_SELECT = { version: true, status: true, changeSummary: true, rollbackOf: true, actorUserId: true, createdAt: true, snapshotHash: true, snapshot: true } as const
type VersionSelected = Prisma.PronunciationLexiconVersionGetPayload<{ select: typeof VERSION_SELECT }>

export interface CheckedSnapshot {
  integrity: LexiconSnapshotIntegrity
  /** 멀쩡한 행(정렬). integrity 가 OK 일 때만 전체 스냅샷과 같다. */
  rows: LexiconSnapshotRowDto[]
  total: number
  issues: LexiconSnapshotIssueDto[]
}

/**
 * 스냅샷 무결성 판정(Codex C2): 엄격 읽기(모양·쓰기 규칙·정규형·키 중복) → 멀쩡하면 활성 항목 해시를 `lexicon.snapshotHash`(생성 때와 같은 함수)로
 * 다시 계산해 저장값과 비교. 해시는 활성 항목의 (범위·대상·표기·읽기·악센트·우선순위·종류)만 덮는다 — 꺼진 행·메모 변조는 ①②③ 검사로만 잡힌다.
 */
export function checkSnapshot(raw: unknown, storedHash: string): CheckedSnapshot {
  const s = readSnapshotStrict(raw)
  if (s.malformed.length) return { integrity: 'MALFORMED', rows: s.rows, total: s.total, issues: [...s.malformed, ...s.invalid].slice(0, 50) }
  if (s.invalid.length) return { integrity: 'INVALID_ENTRIES', rows: s.rows, total: s.total, issues: s.invalid.slice(0, 50) }
  const hash = snapshotHash(s.rows.map((r) => ({ ...r, note: r.note ?? null })))
  return hash === storedHash ? { integrity: 'OK', rows: s.rows, total: s.total, issues: [] } : { integrity: 'MISMATCH', rows: s.rows, total: s.total, issues: [] }
}

function assertIntact(version: number, c: CheckedSnapshot): LexiconSnapshotRowDto[] {
  if (c.integrity !== 'OK') throw new LexiconSnapshotIntegrityError(version, c.integrity, c.issues)
  return c.rows
}

function versionRowOf(v: VersionSelected): LexiconVersionRow {
  const c = checkSnapshot(v.snapshot, v.snapshotHash)
  return {
    version: v.version,
    status: v.status,
    changeSummary: v.changeSummary,
    rollbackOf: v.rollbackOf,
    actorUserId: v.actorUserId,
    createdAt: v.createdAt,
    snapshotHash: v.snapshotHash,
    entryCount: c.total,
    enabledCount: c.rows.filter((e) => e.enabled).length,
    integrity: c.integrity,
  }
}

export async function activeLexiconVersion(environment: Environment, db: Tx | typeof prisma = prisma): Promise<number> {
  const row = await db.pronunciationLexiconVersion.findFirst({ where: { environment, status: 'ACTIVE' }, orderBy: { version: 'desc' }, select: { version: true } })
  return row?.version ?? 0
}

export interface LexiconListQuery {
  q?: string | null
  scope?: LexiconScopeName | null
  scopeRefId?: string | null
  /** true = 활성만 · false = 꺼진 것만 · null = 전부. */
  enabled?: boolean | null
  sort?: 'recent' | 'surface'
  page: number
  pageSize: number
}

export interface LexiconListResult {
  items: LexiconEntryDto[]
  total: number
  dictionaryVersion: number
  counts: { enabled: number; disabled: number }
  active: LexiconVersionRow | null
}

/** 목록 — 검색어는 표기 부분 일치 + (히라가나 → 가타카나로 바꾼) 읽기 부분 일치. counts·active 는 필터와 무관한 사전 전체. */
export async function listLexiconEntries(environment: Environment, q: LexiconListQuery): Promise<LexiconListResult> {
  const text = q.q?.trim() ? q.q.trim() : null
  const where: Prisma.PronunciationLexiconEntryWhereInput = {
    environment,
    ...(q.scope ? { scope: q.scope } : {}),
    ...(q.scopeRefId ? { scopeRefId: q.scopeRefId } : {}),
    ...(q.enabled === true || q.enabled === false ? { enabled: q.enabled } : {}),
    ...(text ? { OR: [{ surface: { contains: escapeLike(text) } }, { reading: { contains: escapeLike(searchReading(text)) } }] } : {}),
  }
  const orderBy: Prisma.PronunciationLexiconEntryOrderByWithRelationInput[] = q.sort === 'surface' ? [{ surface: 'asc' }, { id: 'asc' }] : [{ updatedAt: 'desc' }, { id: 'asc' }]
  const [rows, total, groups, active] = await Promise.all([
    prisma.pronunciationLexiconEntry.findMany({ where, orderBy, skip: (q.page - 1) * q.pageSize, take: q.pageSize, select: ENTRY_SELECT }),
    prisma.pronunciationLexiconEntry.count({ where }),
    prisma.pronunciationLexiconEntry.groupBy({ by: ['enabled'], where: { environment }, _count: { _all: true } }),
    prisma.pronunciationLexiconVersion.findFirst({ where: { environment, status: 'ACTIVE' }, orderBy: { version: 'desc' }, select: VERSION_SELECT }),
  ])
  const counts = { enabled: 0, disabled: 0 }
  for (const g of groups) counts[g.enabled ? 'enabled' : 'disabled'] += g._count._all
  return { items: rows.map(toEntryDto), total, dictionaryVersion: active?.version ?? 0, counts, active: active ? versionRowOf(active) : null }
}

export async function getLexiconEntry(environment: Environment, id: string): Promise<LexiconEntryDto | null> {
  if (!id || id.length > 40) return null
  const r = await prisma.pronunciationLexiconEntry.findFirst({ where: { id, environment }, select: ENTRY_SELECT })
  return r ? toEntryDto(r) : null
}

/** 버전 목록(번호 내림차순, 쪽 번호). 항목 수·켜진 수는 스냅샷으로 계산(쪽 크기 ≤50). */
export async function listLexiconVersions(environment: Environment, opts: { page: number; pageSize: number }): Promise<{ items: LexiconVersionRow[]; total: number; activeVersion: number }> {
  const [rows, total, activeVersion] = await Promise.all([
    prisma.pronunciationLexiconVersion.findMany({ where: { environment }, orderBy: { version: 'desc' }, skip: (opts.page - 1) * opts.pageSize, take: opts.pageSize, select: VERSION_SELECT }),
    prisma.pronunciationLexiconVersion.count({ where: { environment } }),
    activeLexiconVersion(environment),
  ])
  return { items: rows.map(versionRowOf), total, activeVersion }
}

export interface LexiconVersionDiff {
  row: LexiconVersionRow
  against: number | null
  counts: LexiconDiffCountsDto
  rows: LexiconDiffRowDto[]
}

/**
 * 버전 상세 diff — `compare=previous`: 바로 앞 번호 버전 스냅샷 → 이 버전(첫 버전은 전부 ADDED) / `compare=active`: **지금 항목 표** → 이 버전
 * (= 이 버전으로 되돌리면 생길 변화 — Rollback 계획이 비교하는 것과 같은 기준, against = 지금 ACTIVE 번호). 스냅샷 전체는 내려보내지 않는다.
 * 비교에 쓰는 스냅샷이 손상이면 그럴듯한 diff 대신 `LexiconSnapshotIntegrityError`(어느 버전인지 포함).
 */
export async function getLexiconVersionDiff(environment: Environment, version: number, compare: 'previous' | 'active', db: Tx | typeof prisma = prisma): Promise<LexiconVersionDiff | null> {
  const row = await db.pronunciationLexiconVersion.findUnique({ where: { environment_version: { environment, version } }, select: VERSION_SELECT })
  if (!row) return null
  const to = assertIntact(version, checkSnapshot(row.snapshot, row.snapshotHash))
  let from: LexiconSnapshotRowDto[] = []
  let against: number | null = null
  if (compare === 'previous') {
    const base = await db.pronunciationLexiconVersion.findFirst({ where: { environment, version: { lt: version } }, orderBy: { version: 'desc' }, select: { version: true, snapshot: true, snapshotHash: true } })
    if (base) {
      from = assertIntact(base.version, checkSnapshot(base.snapshot, base.snapshotHash))
      against = base.version
    }
  } else {
    const [entries, active] = await Promise.all([db.pronunciationLexiconEntry.findMany({ where: { environment }, select: ENTRY_SELECT }), activeLexiconVersion(environment, db)])
    from = sortEntries(entries.map((e) => fieldsOf(rowOf(e))))
    against = active || null
  }
  return { row: versionRowOf(row), against, ...diffRows(from, to) }
}

/**
 * Export 데이터 — 항목 표(= ACTIVE 스냅샷과 같은 내용 + 메모)를 결정적 순서로. 항목 표를 쓰는 이유: 시드 v1 스냅샷에는 메모가 없어
 * 스냅샷으로 내보내면 다시 가져올 때 메모가 지워지는 "변경" 이 생긴다(왕복 불변 위반). `consistent` = 항목 표의 활성 해시 == ACTIVE snapshotHash.
 */
export async function exportLexicon(environment: Environment): Promise<{ dictionaryVersion: number; entries: LexiconEntryFields[]; consistent: boolean }> {
  const [rows, active] = await Promise.all([
    prisma.pronunciationLexiconEntry.findMany({ where: { environment }, select: ENTRY_SELECT }),
    prisma.pronunciationLexiconVersion.findFirst({ where: { environment, status: 'ACTIVE' }, orderBy: { version: 'desc' }, select: { version: true, snapshotHash: true } }),
  ])
  const entries = sortEntries(rows.map((r) => fieldsOf(rowOf(r))))
  return { dictionaryVersion: active?.version ?? 0, entries, consistent: (active?.snapshotHash ?? snapshotHash([])) === snapshotHash(entries) }
}

/** Import 미리보기(dryRun) — 잠금·쓰기 없이 지금 항목 표로 계획만 계산한다. 적용 요청은 여기서 받은 `activeVersion` 을 baseVersion 으로 보낸다. */
export async function dryRunLexiconImport(environment: Environment, rows: readonly ImportRowInput[], mode: LexiconImportMode, missingRefs: ReadonlySet<string>): Promise<{ plan: ImportPlan; activeVersion: number }> {
  const [existing, activeVersion] = await Promise.all([prisma.pronunciationLexiconEntry.findMany({ where: { environment }, select: ENTRY_SELECT }), activeLexiconVersion(environment)])
  return { plan: planImport(existing.map(rowOf), rows, mode, missingRefs), activeVersion }
}

// ── 쓰기 ───────────────────────────────────────────────────────────────

export interface LexiconWriteContext {
  environment: Environment
  actorUserId: string
  /** 클라이언트가 본 ACTIVE 번호(없으면 0). 다르면 409. */
  baseVersion: number
  /** 변경 이유(Rollback 의 changeSummary "v7 로 되돌림: {이유}" 에 쓴다). */
  reason: string
  /** 존재하지 않는 대상(`scopeRefKey`) — admin 이 트랜잭션 전에 조회해 넘긴다. */
  missingRefs?: ReadonlySet<string>
}

export type LexiconOp =
  | { kind: 'CREATE'; value: LexiconEntryFields }
  | { kind: 'UPDATE'; id: string; patch: RawEntryInput }
  | { kind: 'DISABLE'; id: string }
  | { kind: 'IMPORT'; rows: ImportRowInput[]; mode: LexiconImportMode }
  | { kind: 'ROLLBACK'; targetVersion: number }

export interface LexiconWriteResult {
  changed: boolean
  /** 처리 뒤 ACTIVE(새로 만들었으면 그 행). */
  version: { version: number; createdAt: Date }
  previousVersion: number | null
  entry: LexiconEntryDto | null
  revived: boolean
  items: PlanItem[]
  counts: PlanCounts
  importPlan: ImportPlan | null
  restoredFrom: number | null
  changeSummary: string | null
}

async function lockAndRead(tx: Tx, environment: Environment): Promise<{ active: { version: number; createdAt: Date } | null; max: number }> {
  await tx.$queryRaw`SELECT id FROM PronunciationLexiconVersion WHERE environment = ${environment} ORDER BY version ASC LIMIT 1 FOR UPDATE`
  const [active, max] = await Promise.all([
    tx.pronunciationLexiconVersion.findFirst({ where: { environment, status: 'ACTIVE' }, orderBy: { version: 'desc' }, select: { version: true, createdAt: true } }),
    tx.pronunciationLexiconVersion.aggregate({ where: { environment }, _max: { version: true } }),
  ])
  return { active, max: max._max.version ?? 0 }
}

function assertRef(v: LexiconEntryFields, missing: ReadonlySet<string> | undefined): void {
  if (v.scopeRefId && missing?.has(scopeRefKey(v.scope, v.scopeRefId))) throw new LexiconEntryInvalidError([refNotFound()])
}

const KEY_FIELDS = ['surface', 'scope', 'scopeRefId'] as const

/** 수정은 키(표기·범위·대상)를 바꾸지 않는다 — 바꾸려면 끄고 새로 추가(화면 규칙과 같다, 항목 이력이 키로 이어지게). */
export function immutableKeyErrors(before: LexiconEntryFields, next: LexiconEntryFields): LexiconFieldError[] {
  return KEY_FIELDS.filter((k) => before[k] !== next[k]).map((k) => ({ field: k, code: 'E_IMMUTABLE', message: '표기·범위·대상은 바꿀 수 없습니다 — 끄고 새로 추가해 주세요.' }))
}

const dataOf = (f: LexiconEntryFields) => ({ surface: f.surface, reading: f.reading, accentType: f.accentType, priority: f.priority, scope: f.scope, scopeRefId: f.scopeRefId, wordType: f.wordType, note: f.note, enabled: f.enabled })

function isUniqueViolation(e: unknown): boolean {
  return (e as { code?: string })?.code === 'P2002'
}

/**
 * 사전 쓰기 1건(트랜잭션 안에서 호출 — 감사 행은 호출자가 같은 tx 로 남긴다). 커밋 뒤 `afterLexiconCommit()` 을 불러 메모리 캐시를 비운다.
 */
export async function writeLexicon(tx: Tx, ctx: LexiconWriteContext, op: LexiconOp): Promise<LexiconWriteResult> {
  const { environment } = ctx
  const { active, max } = await lockAndRead(tx, environment)
  const activeVersion = active?.version ?? 0
  if (ctx.baseVersion !== activeVersion) throw new LexiconVersionConflictError(ctx.baseVersion, activeVersion)

  const rows = (await tx.pronunciationLexiconEntry.findMany({ where: { environment }, select: ENTRY_SELECT })).map(rowOf)
  const byId = new Map(rows.map((r) => [r.id, r]))
  let items: PlanItem[] = []
  let revived = false
  let focusId: string | null = null
  let importPlan: ImportPlan | null = null
  let label = ''

  switch (op.kind) {
    case 'CREATE': {
      assertRef(op.value, ctx.missingRefs)
      const plan = planCreate(rows, op.value)
      if (plan.kind === 'DUPLICATE') {
        const existing = await tx.pronunciationLexiconEntry.findUnique({ where: { id: plan.id }, select: ENTRY_SELECT })
        throw new LexiconDuplicateError(existing ? toEntryDto(existing) : null)
      }
      revived = plan.kind === 'REVIVE'
      items = [plan.item]
      label = revived ? '되살림' : '추가'
      break
    }
    case 'UPDATE': {
      const target = byId.get(op.id)
      if (!target) throw new LexiconEntryNotFoundError()
      const parsed = parseEntryInput(op.patch, fieldsOf(target))
      if (!parsed.value) throw new LexiconEntryInvalidError(parsed.errors)
      const keyErrors = immutableKeyErrors(fieldsOf(target), parsed.value)
      if (keyErrors.length) throw new LexiconEntryInvalidError(keyErrors)
      const plan = planUpdate(target, parsed.value)
      focusId = target.id
      if (plan.kind === 'CHANGE') items = [plan.item]
      label = '수정'
      break
    }
    case 'DISABLE': {
      const target = byId.get(op.id)
      if (!target) throw new LexiconEntryNotFoundError()
      focusId = target.id
      const item = planDisable(target)
      if (item) items = [item]
      label = '비활성'
      break
    }
    case 'IMPORT': {
      importPlan = planImport(rows, op.rows, op.mode, ctx.missingRefs)
      if (importPlan.counts.error > 0) throw new LexiconImportInvalidError(importPlan)
      items = importPlan.items
      label = `가져오기(${op.mode})`
      break
    }
    case 'ROLLBACK': {
      if (op.targetVersion === activeVersion) throw new LexiconRollbackRejectedError('ALREADY_ACTIVE')
      const target = await tx.pronunciationLexiconVersion.findUnique({ where: { environment_version: { environment, version: op.targetVersion } }, select: { snapshot: true, snapshotHash: true } })
      if (!target) throw new LexiconVersionNotFoundError()
      // 손상된 스냅샷으로 되돌리면 빠진 키의 정상 항목이 "대상에 없음" 으로 꺼진다 — 해시·규칙이 맞을 때만 진행(Codex C2).
      items = planRollback(rows, assertIntact(op.targetVersion, checkSnapshot(target.snapshot, target.snapshotHash)))
      if (items.length === 0) throw new LexiconRollbackRejectedError('NO_CHANGE')
      break
    }
  }

  const counts = countPlan(items)
  if (items.length === 0) {
    const entry = focusId ? await tx.pronunciationLexiconEntry.findUnique({ where: { id: focusId }, select: ENTRY_SELECT }) : null
    return {
      changed: false,
      version: { version: activeVersion, createdAt: active?.createdAt ?? new Date(0) },
      previousVersion: null,
      entry: entry ? toEntryDto(entry) : null,
      revived: false,
      items,
      counts,
      importPlan,
      restoredFrom: null,
      changeSummary: null,
    }
  }

  try {
    const adds = items.filter((i): i is Extract<PlanItem, { action: 'ADD' }> => i.action === 'ADD')
    if (op.kind === 'CREATE' && adds.length === 1) {
      const created = await tx.pronunciationLexiconEntry.create({ data: { environment, ...dataOf(adds[0].after) }, select: { id: true } })
      focusId = created.id
    } else {
      for (let i = 0; i < adds.length; i += 500) {
        await tx.pronunciationLexiconEntry.createMany({ data: adds.slice(i, i + 500).map((a) => ({ environment, ...dataOf(a.after) })) })
      }
    }
    for (const i of items) {
      if (i.action === 'ADD') continue
      await tx.pronunciationLexiconEntry.update({ where: { id: i.id }, data: dataOf(i.after) })
      if (op.kind === 'CREATE') focusId = i.id
    }

    const after = applyPlan(rows, items)
    const changeSummary = op.kind === 'ROLLBACK' ? rollbackSummary(op.targetVersion, maskText(ctx.reason)) : summarize(label, items, after)
    await tx.pronunciationLexiconVersion.updateMany({ where: { environment, status: 'ACTIVE' }, data: { status: op.kind === 'ROLLBACK' ? 'ROLLED_BACK' : 'SUPERSEDED' } })
    const created = await tx.pronunciationLexiconVersion.create({
      data: {
        environment,
        version: max + 1,
        snapshotHash: snapshotHash(after),
        snapshot: toSnapshot(after) as unknown as Prisma.InputJsonValue,
        changeSummary,
        rollbackOf: op.kind === 'ROLLBACK' ? op.targetVersion : null,
        actorUserId: ctx.actorUserId,
        status: 'ACTIVE',
      },
      select: { version: true, createdAt: true },
    })
    const entry = focusId ? await tx.pronunciationLexiconEntry.findUnique({ where: { id: focusId }, select: ENTRY_SELECT }) : null
    return {
      changed: true,
      version: created,
      previousVersion: activeVersion || null,
      entry: entry ? toEntryDto(entry) : null,
      revived,
      items,
      counts,
      importPlan,
      restoredFrom: op.kind === 'ROLLBACK' ? op.targetVersion : null,
      changeSummary,
    }
  } catch (e) {
    if (isUniqueViolation(e)) throw new LexiconVersionConflictError(ctx.baseVersion, activeVersion)
    throw e
  }
}

/** 커밋 뒤에 부른다 — 이 프로세스의 ACTIVE 사전 캐시(30초)를 비워 다음 합성부터 새 버전을 쓰게 한다. 다른 프로세스는 최대 30초 뒤 반영. */
export function afterLexiconCommit(): void {
  clearLexiconCache()
}
