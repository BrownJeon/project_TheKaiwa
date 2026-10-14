/**
 * 기본 단어 시드(task-068) — 공용 읽기 전용 기본 단어(`WordEntry.userId` NULL·`source=SEED`·`seedKey`)를 넣는다. 계획은 순수 함수
 * `src/modules/learning/vocab/baseWordSeed.ts`(팩 N5~N1 ∪ 옛 words-n5.json 추가분, 조각 재분류 `chunk-reclass.json`).
 *
 *   node --import tsx scripts/seed-base-words.ts                 # 기본 dry-run: DB 를 열지 않는다. 총 행 수·추가분·유형별 개수만
 *   node --import tsx scripts/seed-base-words.ts --check-db      # 읽기 전용: 이미 있는 seedKey 수·빠진 수·drift 수(개수만)
 *   CONFIRM_SEED_BASE_WORDS=yes node --import tsx scripts/seed-base-words.ts --apply    # 없는 seedKey 만 넣기(멱등)
 *   CONFIRM_SEED_BASE_WORDS=yes node --import tsx scripts/seed-base-words.ts --update   # 이미 있는 행의 내용만 시드 값으로(표기·읽기가 같은 행만)
 *
 * - 미러 루트(`~/.node-local/thekaiwa`)에서 실행한다(NFS noexec). 시드 파일은 `<cwd>/prisma/seed-data` 에서 읽는다.
 * - `--apply`: `createMany({ skipDuplicates: true })`(MySQL `INSERT IGNORE`)를 1,000행 조각으로, 조각 전부를 **한 트랜잭션**에 —
 *   공유 NAS MariaDB 의 커밋 지연(task-063) 때문에 커밋은 한 번. seedKey 유일 인덱스가 다시 실행해도 같은 행을 두 번 넣지 않게 한다.
 * - `--update`: 같은 seedKey 인데 표기·읽기가 달라진 행(drift — 팩 JSON 순서가 바뀐 경우)은 **건드리지 않고** 개수만 보고한다.
 *   쓰기 조건에 `userId: null` 이 있어 사용자 행은 어떤 경우에도 바뀌지 않는다.
 * - 출력은 개수와 옛 50개에서 더한 공개 시드 단어뿐 — 사용자 데이터·연결 문자열은 출력하지 않는다. 쓰기 모드는 사용자 승인 뒤에만.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PrismaClient } from '@prisma/client'
import { SEED_PACKS, type SeedPack } from '@/types/seedPack'
import { CHUNK_TYPES_ALL, planBaseWords, type BaseWordPlan, type BaseWordRow } from '@/modules/learning/vocab/baseWordSeed'

export const SEED_WRITE_CHUNK = 1000
export const SEED_UPDATE_BATCH = 200
export const CONFIRM_ENV = 'CONFIRM_SEED_BASE_WORDS'

export type SeedMode = 'dry-run' | 'check-db' | 'apply' | 'update'
export type SeedBaseWordsDb = Pick<PrismaClient, 'wordEntry' | '$transaction'>

const CONTENT_KEYS = ['meaning', 'partOfSpeech', 'chunkType', 'jlpt', 'example', 'exampleKo', 'category'] as const
type ContentKey = (typeof CONTENT_KEYS)[number]
type DbRow = Pick<BaseWordRow, 'surface' | ContentKey> & { seedKey: string | null; userId: string | null; reading: string | null }

export interface DbSnapshot {
  /** seedKey 가 있는 행 전체. */
  seedRows: number
  /** seedKey 가 있는데 userId 도 있는 행(있으면 안 됨 — 손대지 않고 보고만). */
  ownedSeedKeyRows: number
  /** 계획 행 중 DB 에 같은 seedKey 가 있는 수 / 없는 수. */
  present: number
  missing: number
  /** DB 에는 있는데 계획에 없는 seedKey 수. */
  unknown: number
  /** 같은 seedKey 인데 표기·읽기(바이트)가 다른 수. */
  drift: number
  /** 표기·읽기는 같고 내용 칸이 다른 수(= `--update` 가 바꿀 수). */
  contentDiff: number
}

export interface SeedReport {
  mode: SeedMode
  plan: { total: number; packCount: Record<SeedPack, number>; legacyCount: number; legacyAdded: BaseWordPlan['legacyAdded']; reclassified: BaseWordPlan['reclassified']; byChunk: BaseWordPlan['byChunk'] }
  before: DbSnapshot | null
  inserted: number
  updated: number
  after: DbSnapshot | null
}

const sameContent = (a: DbRow, b: BaseWordRow) => CONTENT_KEYS.every((k) => (a[k] ?? null) === (b[k] ?? null))

async function snapshot(db: SeedBaseWordsDb, plan: BaseWordPlan): Promise<{ snap: DbSnapshot; rows: Map<string, DbRow> }> {
  const found = (await db.wordEntry.findMany({
    where: { seedKey: { not: null } },
    select: { seedKey: true, userId: true, surface: true, reading: true, meaning: true, partOfSpeech: true, chunkType: true, jlpt: true, example: true, exampleKo: true, category: true },
  })) as DbRow[]
  const rows = new Map<string, DbRow>()
  let ownedSeedKeyRows = 0
  for (const r of found) {
    if (r.userId !== null) ownedSeedKeyRows++
    else rows.set(r.seedKey as string, r)
  }
  const planned = new Set(plan.rows.map((r) => r.seedKey))
  let present = 0
  let drift = 0
  let contentDiff = 0
  for (const p of plan.rows) {
    const r = rows.get(p.seedKey)
    if (!r) continue
    present++
    if (r.surface !== p.surface || r.reading !== p.reading) drift++
    else if (!sameContent(r, p)) contentDiff++
  }
  const unknown = [...rows.keys()].filter((k) => !planned.has(k)).length
  return { snap: { seedRows: found.length, ownedSeedKeyRows, present, missing: plan.rows.length - present, unknown, drift, contentDiff }, rows }
}

function chunked<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

export async function runSeedBaseWords(db: SeedBaseWordsDb | null, plan: BaseWordPlan, opts: { mode: SeedMode; confirm: boolean; chunk?: number }): Promise<SeedReport> {
  const report: SeedReport = {
    mode: opts.mode,
    plan: { total: plan.rows.length, packCount: plan.packCount, legacyCount: plan.legacyCount, legacyAdded: plan.legacyAdded, reclassified: plan.reclassified, byChunk: plan.byChunk },
    before: null,
    inserted: 0,
    updated: 0,
    after: null,
  }
  if (opts.mode === 'dry-run') return report
  if (!db) throw new Error('DB 모드에는 db 가 필요하다')
  if ((opts.mode === 'apply' || opts.mode === 'update') && !opts.confirm) throw new Error(`${opts.mode} 는 ${CONFIRM_ENV}=yes 가 있어야 한다 — 쓰기 0`)
  const before = await snapshot(db, plan)
  report.before = before.snap
  if (opts.mode === 'check-db') return report

  if (opts.mode === 'apply') {
    const size = Math.max(1, Math.floor(opts.chunk ?? SEED_WRITE_CHUNK))
    const results = await db.$transaction(chunked(plan.rows, size).map((part) => db.wordEntry.createMany({ data: part, skipDuplicates: true })))
    report.inserted = results.reduce((n, r) => n + r.count, 0)
  } else {
    const targets = plan.rows.filter((p) => {
      const r = before.rows.get(p.seedKey)
      return r && r.surface === p.surface && r.reading === p.reading && !sameContent(r, p)
    })
    for (const batch of chunked(targets, SEED_UPDATE_BATCH)) {
      const results = await db.$transaction(
        batch.map((p) =>
          db.wordEntry.updateMany({
            where: { seedKey: p.seedKey, userId: null },
            data: { meaning: p.meaning, partOfSpeech: p.partOfSpeech, chunkType: p.chunkType, jlpt: p.jlpt, example: p.example, exampleKo: p.exampleKo, category: p.category },
          }),
        ),
      )
      report.updated += results.reduce((n, r) => n + r.count, 0)
    }
  }
  report.after = (await snapshot(db, plan)).snap
  return report
}

const fmtSnap = (s: DbSnapshot) =>
  `seedKey rows=${s.seedRows} (owned=${s.ownedSeedKeyRows}) · planned present=${s.present} missing=${s.missing} · unknown=${s.unknown} · drift=${s.drift} · contentDiff=${s.contentDiff}`

export function formatSeedReport(r: SeedReport): string[] {
  const lines = [
    `mode: ${r.mode.toUpperCase()}${r.mode === 'dry-run' || r.mode === 'check-db' ? ' (no writes)' : ''}`,
    `plan: total=${r.plan.total} = packs ${SEED_PACKS.map((p) => `${p} ${r.plan.packCount[p]}`).join(' · ')} + legacy added ${r.plan.legacyAdded.length} (of ${r.plan.legacyCount})`,
    ...r.plan.legacyAdded.map((a) => `  legacy added: ${a.seedKey} ${a.surface}(${a.reading})`),
    `reclassified (empty chunk → rule): ${CHUNK_TYPES_ALL.map((t) => `${t} ${r.plan.reclassified[t]}`).join(' · ')}`,
    `final by chunk: ${CHUNK_TYPES_ALL.map((t) => `${t} ${r.plan.byChunk[t]}`).join(' · ')} · empty 0`,
  ]
  if (r.before) lines.push(`before: ${fmtSnap(r.before)}`)
  if (r.mode === 'apply') lines.push(`inserted: ${r.inserted}`)
  if (r.mode === 'update') lines.push(`updated: ${r.updated}`)
  if (r.after) lines.push(`after: ${fmtSnap(r.after)}`)
  return lines
}

export function parseSeedArgs(args: readonly string[]): SeedMode {
  const flags: Record<string, SeedMode> = { '--check-db': 'check-db', '--apply': 'apply', '--update': 'update' }
  const unknown = args.filter((a) => !(a in flags))
  if (unknown.length) throw new Error(`unknown argument(s): ${unknown.join(' ')} — use --check-db | --apply | --update or nothing`)
  if (args.length > 1) throw new Error('mode flags are exclusive — pass one of --check-db | --apply | --update')
  return args.length ? flags[args[0]] : 'dry-run'
}

export function loadBaseWordPlan(root: string): BaseWordPlan {
  const dir = join(root, 'prisma', 'seed-data')
  if (!existsSync(join(dir, 'jlpt', 'n5.json'))) throw new Error(`seed data not found under ${dir} — run from the mirror root`)
  const read = (...p: string[]) => JSON.parse(readFileSync(join(dir, ...p), 'utf8')) as unknown
  const packs = Object.fromEntries(SEED_PACKS.map((p) => [p, read('jlpt', `${p.toLowerCase()}.json`)])) as Record<SeedPack, unknown>
  return planBaseWords({ packs, legacy: read('words-n5.json'), reclass: read('chunk-reclass.json') })
}

async function main(): Promise<void> {
  let mode: SeedMode
  try {
    mode = parseSeedArgs(process.argv.slice(2))
  } catch (e) {
    console.error((e as Error).message)
    process.exitCode = 2
    return
  }
  const confirm = process.env[CONFIRM_ENV] === 'yes'
  if ((mode === 'apply' || mode === 'update') && !confirm) {
    console.error(`--${mode} requires ${CONFIRM_ENV}=yes (user approval) — nothing written`)
    process.exitCode = 2
    return
  }
  let plan: BaseWordPlan
  try {
    plan = loadBaseWordPlan(process.cwd())
  } catch (e) {
    // 계획 오류는 시드 파일 내용만 담는다(접속 정보 없음).
    console.error(`plan failed: ${(e as Error).message}`)
    process.exitCode = 1
    return
  }
  if (mode === 'dry-run') {
    for (const line of formatSeedReport(await runSeedBaseWords(null, plan, { mode, confirm }))) console.log(line)
    return
  }
  const { prisma } = await import('@/modules/infra')
  try {
    for (const line of formatSeedReport(await runSeedBaseWords(prisma, plan, { mode, confirm }))) console.log(line)
  } finally {
    await prisma.$disconnect()
  }
}

if (process.argv[1]?.endsWith('seed-base-words.ts')) {
  main().catch((e: unknown) => {
    // 오류 본문은 접속 정보를 담을 수 있어 이름·코드만.
    const code = typeof (e as { code?: unknown })?.code === 'string' ? ` ${(e as { code: string }).code}` : ''
    console.error(`seed-base-words failed: ${e instanceof Error ? e.name : 'Error'}${code}`)
    process.exitCode = 1
  })
}
