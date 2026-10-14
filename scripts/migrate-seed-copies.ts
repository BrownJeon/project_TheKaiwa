/**
 * 기본 단어 사본 이관(task-068, 감사 A 수정) — 사용자 소유 `source=SEED` 사본을 공용 기본 단어(`userId` NULL·`seedKey`)로 옮긴다.
 * 짝 맞춤·상태 합산·고친 사본 정책은 순수 함수 `src/modules/learning/vocab/seedCopyMigration.ts` 머리말.
 *
 *   node --import tsx scripts/migrate-seed-copies.ts [plan]                    # 기본: 읽기만 — 짝·합칠 상태·고친 사본·참조 건수·기대값 대조
 *   CONFIRM_MIGRATE_SEED_COPIES=yes node --import tsx scripts/migrate-seed-copies.ts state --apply     # ① 사본 기록을 기본 단어 UserWordState 에 합산
 *   CONFIRM_MIGRATE_SEED_COPIES=yes node --import tsx scripts/migrate-seed-copies.ts repoint --apply   # ② 참조 단어 id → 기본 단어 id
 *   CONFIRM_MIGRATE_SEED_COPIES=yes node --import tsx scripts/migrate-seed-copies.ts delete-copies --apply --confirm-delete  # ③ 검증된 사본만 삭제
 *
 * - 단계마다 `--apply`(+환경변수) 없이는 계획만 출력한다. `plan` 은 `--apply` 를 줘도 쓰지 않는다. ③은 `--confirm-delete` 도 따로 요구한다.
 * - ① 은 사본마다 (옛 칸 + 사본 id 상태 + 대상 상태)를 대상에 합치고, 같은 트랜잭션에서 사본 옛 칸을 0 으로 되돌리고 사본 id 상태 행을 지운다
 *   (= 「이미 이관됨」 표지 — 다시 실행해도 더하지 않는다). 대상 쓰기는 upsert(행이 없으면 만들고, 있으면 맞힘·틀림을 increment).
 * - 순서 ①→②→③. 사본을 ② 전에 지우면 FK `SetNull` 로 기록 연결이 끊긴다 — ③은 남은 참조가 있는 사본을 거절한다.
 * - ② 대상: `VocabAttempt.wordId`(세션 소유자 조건)·`EvaluationItem.wordId`(평가 소유자 조건)·`Correction.savedWordId`(userId) +
 *   `RepetitionItem(refType='WordEntry').refId`(userId, FK 없음 — 같은 (사용자, 기본 단어) 반복 항목이 이미 있으면 유일 제약 때문에 옮기지 않고
 *   그 사본은 ③에서 거절된다). `LearningObservation`(append-only, 원본 삭제 뒤 dangling 허용 설계)은 고치지 않고 건수만 보고한다.
 * - ③ 은 참조 0 · 표지 확인 · 고치지 않은 사본(`edited` 아님)만 지운다. 고친 사본은 건너뛰고 개수만 — 우회 옵션은 없다.
 *   「고치지 않음」 = (a) 짝 기본 단어 내용 또는 (b) 옛 OWNER 시드(`<cwd>/prisma/seed-data/words-n5.json`) 사본 모양과 같음. (b) 로만 같은 사본은
 *   `seed-origin` 으로 따로 센다. 파일을 못 읽으면 (b) 없이 판정한다(더 많이 막는 쪽 — 출력의 `old OWNER seed file` 줄이 rows=0).
 * - 짝 없는 사본·같은 기본 단어에 겹친 사본은 어떤 단계에서도 건드리지 않는다(보고만). 쓰기는 사용자 단위·조각 트랜잭션.
 * - 출력은 개수뿐 — 단어 내용·사용자/행 id·연결 문자열은 출력하지 않는다. 쓰기 단계는 dry-run 확인 뒤 사용자 승인으로만.
 * - 읽고 쓰기 사이의 틈(감사 REV-068A-6): 실행 중에 사용자가 단어를 풀면 그 사이 기록이 반영되지 않을 수 있다 — 사용하지 않는 시간에 돌린다.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Prisma, PrismaClient } from '@prisma/client'
import {
  CONTENT_FIELDS, EMPTY_OLD_SEED, ZERO_STATE, copySideState, decideState, deleteDecision, indexOldOwnerSeed, isDefaultState, isEditedCopy, matchSeedCopies,
  mergeStates, pickState, statePending, type ContentField, type CopyMatchPlan, type CopyPair, type OldSeedIndex, type SeedCopyRow, type WordStateValues,
} from '@/modules/learning/vocab/seedCopyMigration'

export const CONFIRM_ENV = 'CONFIRM_MIGRATE_SEED_COPIES'
export const IN_CHUNK = 500
export const PAIR_BATCH = 100

/** 이관 전 기대값(2026-10-14 Leader 실측: 실사용자 사본 678행) — plan 출력 끝에서 대조한다. */
export const PRE_MIGRATION_EXPECTED = { copies: 678, matched: 678, unmatched: 0, duplicate: 0, ambiguousBaseKeys: 0, edited: 0 } as const
/**
 * 대조용 추정치(관문 아님) — 옛 OWNER 사본 50행 중 기본 단어와 내용은 다르지만 옛 시드 그대로인 짝 수. 시드 파일(words-n5.json·팩 JSON)로
 * 계산한 값이고, 시험이 실제 JSON 으로 이 값을 고정한다.
 */
export const PRE_MIGRATION_INFO = { seedOrigin: 35 } as const

export type MigrateStep = 'plan' | 'state' | 'repoint' | 'delete-copies'
export type MigrateDb = Pick<PrismaClient, 'wordEntry' | 'userWordState' | 'vocabAttempt' | 'evaluationItem' | 'correction' | 'repetitionItem' | 'learningObservation' | '$transaction'>

interface RefCount { attempts: number; evalItems: number; corrections: number; repetition: number }

interface Loaded {
  base: number
  copies: number
  users: number
  oldSeed: MigrateSummary['oldSeed']
  match: CopyMatchPlan
  targets: Map<string, WordStateValues>
  refs: Map<string, RefCount>
  /** (사용자, 기본 단어) 반복 항목이 이미 있어 옮길 수 없는 사본 id. */
  repetitionConflict: Set<string>
  observations: number
}

export interface MigrateSummary {
  base: number
  copies: number
  users: number
  matched: number
  unmatched: number
  duplicate: number
  ambiguousBaseKeys: number
  /** pending = state 단계가 할 일이 있는 짝. legacyRows = 옛 칸이 기본값이 아닌 사본, copyStateRows = 합친 뒤 지울 사본 id 상태 행. */
  state: { pending: number; create: number; merge: number; clearOnly: number; noneNeeded: number; legacyRows: number; copyStateRows: number }
  /** (a) 짝 기본 단어와도 (b) 옛 OWNER 시드 사본 모양과도 내용이 다른 사본(= delete-copies 가 지우지 않는다). byField 는 (a) 대비 칸별 개수. */
  edited: { total: number; byField: Record<ContentField, number> }
  /** (a) 와는 다르지만 (b) 와 같은 사본 — 안 고친 것(삭제 가능). byField 는 (a) 대비 칸별 개수. */
  seedOrigin: { total: number; byField: Record<ContentField, number> }
  /** (b) 기준 파일: 줄 수 · 쓸 수 있는 키 · 표기가 겹쳐 쓰지 않는 키. */
  oldSeed: { rows: number; usable: number; ambiguousKeys: number }
  refs: { attempts: number; evalItems: number; corrections: number; repetition: number; repetitionConflict: number; copiesWithRefs: number }
  observationsReportOnly: number
  deletable: number
  refused: { refsLeft: number; statePending: number; edited: number }
}

export interface MigrateReport {
  step: MigrateStep
  apply: boolean
  before: MigrateSummary
  written: { stateUpserted: number; legacyCleared: number; copyStatesDeleted: number; attempts: number; evalItems: number; corrections: number; repetition: number; deleted: number }
  after: MigrateSummary | null
}

const STATE_SELECT = { correctCount: true, lastSeenAt: true, wrongCount: true, lastResult: true, archived: true, archivedAt: true } as const
const CONTENT_SELECT = { meaning: true, partOfSpeech: true, example: true, exampleKo: true, note: true } as const
/** 사본 옛 칸을 되돌리는 값 = 「이미 이관됨」 표지. `delete-copies` 의 삭제 where 도 같은 값을 요구한다. */
const LEGACY_CLEARED = pickState(ZERO_STATE)
const pk = (userId: string, wordId: string) => `${userId}\u0000${wordId}`
const zeroRefs = (): RefCount => ({ attempts: 0, evalItems: 0, corrections: 0, repetition: 0 })
const refTotal = (r: RefCount | undefined) => (r ? r.attempts + r.evalItems + r.corrections + r.repetition : 0)
const time = (d: Date | null) => (d ? d.getTime() : null)

function chunked<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

function byUser<T extends { userId: string }>(list: readonly T[]): T[][] {
  const m = new Map<string, T[]>()
  for (const x of list) {
    const l = m.get(x.userId)
    if (l) l.push(x)
    else m.set(x.userId, [x])
  }
  return [...m.values()]
}

async function load(db: MigrateDb, oldSeed: OldSeedIndex): Promise<Loaded> {
  const base = await db.wordEntry.findMany({ where: { userId: null, seedKey: { not: null } }, select: { id: true, surface: true, reading: true, ...CONTENT_SELECT } })
  const copies = (await db.wordEntry.findMany({
    where: { userId: { not: null }, source: 'SEED', seedKey: null },
    select: { id: true, userId: true, surface: true, reading: true, ...CONTENT_SELECT, ...STATE_SELECT },
  })) as SeedCopyRow[]
  const owner = new Map(copies.map((c) => [c.id, c.userId]))
  const copyStates = new Map<string, WordStateValues>()
  for (const part of chunked([...owner.keys()], IN_CHUNK)) {
    for (const s of await db.userWordState.findMany({ where: { wordId: { in: part } }, select: { userId: true, wordId: true, ...STATE_SELECT } })) {
      if (owner.get(s.wordId) === s.userId) copyStates.set(s.wordId, pickState(s))
    }
  }
  const match = matchSeedCopies(base, copies, copyStates, oldSeed)

  const targets = new Map<string, WordStateValues>()
  for (const group of byUser(match.pairs)) {
    const userId = group[0].userId
    for (const part of chunked(group.map((p) => p.baseId), IN_CHUNK)) {
      for (const s of await db.userWordState.findMany({ where: { userId, wordId: { in: part } }, select: { wordId: true, ...STATE_SELECT } })) {
        targets.set(pk(userId, s.wordId), pickState(s))
      }
    }
  }

  // 참조 수는 사용자 조건 없이 센다 — 다른 사용자 행이 사본을 가리키면 옮기지 않고 남아 삭제를 막는다.
  const refs = new Map<string, RefCount>()
  const bump = (id: string | null, k: keyof RefCount) => {
    if (!id) return
    const r = refs.get(id) ?? zeroRefs()
    r[k]++
    refs.set(id, r)
  }
  const pairIds = match.pairs.map((p) => p.copyId)
  const repetitionOwners: { userId: string; refId: string }[] = []
  for (const part of chunked(pairIds, IN_CHUNK)) {
    for (const a of await db.vocabAttempt.findMany({ where: { wordId: { in: part } }, select: { wordId: true } })) bump(a.wordId, 'attempts')
    for (const e of await db.evaluationItem.findMany({ where: { wordId: { in: part } }, select: { wordId: true } })) bump(e.wordId, 'evalItems')
    for (const c of await db.correction.findMany({ where: { savedWordId: { in: part } }, select: { savedWordId: true } })) bump(c.savedWordId, 'corrections')
    for (const r of await db.repetitionItem.findMany({ where: { refType: 'WordEntry', refId: { in: part } }, select: { userId: true, refId: true } })) {
      bump(r.refId, 'repetition')
      repetitionOwners.push(r)
    }
  }
  const repetitionConflict = new Set<string>()
  const pairByCopy = new Map(match.pairs.map((p) => [p.copyId, p]))
  const existingRep = new Set<string>()
  for (const part of chunked([...new Set(match.pairs.map((p) => p.baseId))], IN_CHUNK)) {
    for (const r of await db.repetitionItem.findMany({ where: { refType: 'WordEntry', refId: { in: part } }, select: { userId: true, refId: true } })) existingRep.add(pk(r.userId, r.refId))
  }
  for (const r of repetitionOwners) {
    const p = pairByCopy.get(r.refId)
    if (p && (r.userId !== p.userId || existingRep.has(pk(p.userId, p.baseId)))) repetitionConflict.add(p.copyId)
  }

  let observations = 0
  for (const part of chunked([...owner.keys()], IN_CHUNK)) {
    observations += await db.learningObservation.count({ where: { OR: [{ wordId: { in: part } }, { refType: 'WordEntry', refId: { in: part } }] } })
  }
  return {
    base: base.length, copies: copies.length, users: new Set(copies.map((c) => c.userId)).size,
    oldSeed: { rows: oldSeed.rows, usable: oldSeed.byKey.size, ambiguousKeys: oldSeed.ambiguousKeys },
    match, targets, refs, repetitionConflict, observations,
  }
}

function summarize(l: Loaded): MigrateSummary {
  const state = { pending: 0, create: 0, merge: 0, clearOnly: 0, noneNeeded: 0, legacyRows: 0, copyStateRows: 0 }
  const zeroByField = () => Object.fromEntries(CONTENT_FIELDS.map((f) => [f, 0])) as Record<ContentField, number>
  const edited = { total: 0, byField: zeroByField() }
  const seedOrigin = { total: 0, byField: zeroByField() }
  const refs = { attempts: 0, evalItems: 0, corrections: 0, repetition: 0, repetitionConflict: l.repetitionConflict.size, copiesWithRefs: 0 }
  const refused = { refsLeft: 0, statePending: 0, edited: 0 }
  let deletable = 0
  for (const p of l.match.pairs) {
    const d = decideState(p, l.targets.get(pk(p.userId, p.baseId)))
    if (d === 'none-needed') state.noneNeeded++
    else {
      state.pending++
      if (d === 'create') state.create++
      else if (d === 'merge') state.merge++
      else state.clearOnly++
    }
    if (!isDefaultState(p.legacy)) state.legacyRows++
    if (p.copyState) state.copyStateRows++
    const bucket = isEditedCopy(p) ? edited : p.seedOrigin ? seedOrigin : null
    if (bucket) {
      bucket.total++
      for (const f of p.diff) bucket.byField[f]++
    }
    const r = l.refs.get(p.copyId)
    if (r) {
      refs.attempts += r.attempts
      refs.evalItems += r.evalItems
      refs.corrections += r.corrections
      refs.repetition += r.repetition
      if (refTotal(r) > 0) refs.copiesWithRefs++
    }
    const del = deleteDecision(p, refTotal(r))
    if (del.ok) deletable++
    else if (del.reason === 'refs-left') refused.refsLeft++
    else if (del.reason === 'state-pending') refused.statePending++
    else refused.edited++
  }
  return {
    base: l.base, copies: l.copies, users: l.users, matched: l.match.pairs.length, unmatched: l.match.unmatched.length, duplicate: l.match.duplicate.length,
    ambiguousBaseKeys: l.match.ambiguousBaseKeys, state, edited, seedOrigin, oldSeed: l.oldSeed, refs, observationsReportOnly: l.observations, deletable, refused,
  }
}

type Written = MigrateReport['written']

async function applyState(db: MigrateDb, l: Loaded): Promise<Pick<Written, 'stateUpserted' | 'legacyCleared' | 'copyStatesDeleted'>> {
  const out = { stateUpserted: 0, legacyCleared: 0, copyStatesDeleted: 0 }
  for (const group of byUser(l.match.pairs.filter(statePending))) {
    const userId = group[0].userId
    for (const batch of chunked(group, PAIR_BATCH)) {
      // 한 조각 = 한 트랜잭션: 대상에 더하기 + 표지 정리(옛 칸 0·사본 상태 행 삭제)가 함께 커밋되거나 함께 되돌아간다.
      const ops: { key: keyof typeof out; op: Prisma.PrismaPromise<unknown> }[] = []
      for (const p of batch) {
        const target = l.targets.get(pk(userId, p.baseId))
        const d = decideState(p, target)
        if (d !== 'create' && d !== 'merge') continue
        const side = copySideState(p.legacy, p.copyState)
        const merged = mergeStates(target, p.legacy, p.copyState)
        const seenChanged = !target || time(merged.lastSeenAt) !== time(target.lastSeenAt) || merged.lastResult !== target.lastResult
        ops.push({
          key: 'stateUpserted',
          op: db.userWordState.upsert({
            where: { userId_wordId: { userId, wordId: p.baseId } },
            create: { userId, wordId: p.baseId, ...side },
            // 맞힘·틀림은 increment — 읽은 뒤 대상이 늘어도 그 몫을 덮지 않는다. 보관은 대상 값을 그대로 둔다.
            update: {
              correctCount: { increment: side.correctCount },
              wrongCount: { increment: side.wrongCount },
              ...(seenChanged ? { lastSeenAt: merged.lastSeenAt, lastResult: merged.lastResult } : {}),
            },
          }),
        })
      }
      const legacyIds = batch.filter((p) => !isDefaultState(p.legacy)).map((p) => p.copyId)
      if (legacyIds.length) {
        ops.push({ key: 'legacyCleared', op: db.wordEntry.updateMany({ where: { id: { in: legacyIds }, userId, source: 'SEED', seedKey: null }, data: LEGACY_CLEARED }) })
      }
      const copyStateIds = batch.filter((p) => p.copyState !== null).map((p) => p.copyId)
      if (copyStateIds.length) {
        ops.push({ key: 'copyStatesDeleted', op: db.userWordState.deleteMany({ where: { userId, wordId: { in: copyStateIds } } }) })
      }
      if (!ops.length) continue
      const results = await db.$transaction(ops.map((o) => o.op))
      results.forEach((res, i) => {
        const k = ops[i].key
        out[k] += k === 'stateUpserted' ? 1 : (res as { count: number }).count
      })
    }
  }
  return out
}

async function applyRepoint(db: MigrateDb, l: Loaded): Promise<Pick<Written, 'attempts' | 'evalItems' | 'corrections' | 'repetition'>> {
  const out = { attempts: 0, evalItems: 0, corrections: 0, repetition: 0 }
  const todo = l.match.pairs.filter((p) => refTotal(l.refs.get(p.copyId)) > 0)
  for (const group of byUser(todo)) {
    for (const batch of chunked(group, PAIR_BATCH)) {
      const ops: { key: keyof typeof out; op: Prisma.PrismaPromise<{ count: number }> }[] = []
      for (const p of batch) {
        const r = l.refs.get(p.copyId) as RefCount
        // VocabAttempt·EvaluationItem 에는 userId 칸이 없어 소유 관계(세션·평가)로 사용자를 건다.
        if (r.attempts) ops.push({ key: 'attempts', op: db.vocabAttempt.updateMany({ where: { wordId: p.copyId, session: { userId: p.userId } }, data: { wordId: p.baseId } }) })
        if (r.evalItems) ops.push({ key: 'evalItems', op: db.evaluationItem.updateMany({ where: { wordId: p.copyId, evaluation: { userId: p.userId } }, data: { wordId: p.baseId } }) })
        if (r.corrections) ops.push({ key: 'corrections', op: db.correction.updateMany({ where: { savedWordId: p.copyId, userId: p.userId }, data: { savedWordId: p.baseId } }) })
        if (r.repetition && !l.repetitionConflict.has(p.copyId)) {
          ops.push({ key: 'repetition', op: db.repetitionItem.updateMany({ where: { userId: p.userId, refType: 'WordEntry', refId: p.copyId }, data: { refId: p.baseId } }) })
        }
      }
      const results = await db.$transaction(ops.map((o) => o.op))
      results.forEach((res, i) => (out[ops[i].key] += res.count))
    }
  }
  return out
}

async function applyDelete(db: MigrateDb, l: Loaded): Promise<number> {
  const ok: CopyPair[] = l.match.pairs.filter((p) => deleteDecision(p, refTotal(l.refs.get(p.copyId))).ok)
  let deleted = 0
  for (const group of byUser(ok)) {
    const userId = group[0].userId
    const results = await db.$transaction(
      chunked(group, IN_CHUNK).map((part) => db.wordEntry.deleteMany({
        // 사본 조건 + 「이미 이관됨」 표지(옛 칸 기본값)를 쓰는 순간에 다시 확인한다.
        where: { id: { in: part.map((p) => p.copyId) }, userId, source: 'SEED', seedKey: null, ...LEGACY_CLEARED },
      })),
    )
    deleted += results.reduce((n, r) => n + r.count, 0)
  }
  return deleted
}

export interface MigrateOptions { step: MigrateStep; apply: boolean; confirm: boolean; confirmDelete: boolean; oldSeed?: OldSeedIndex }

export async function runMigration(db: MigrateDb, opts: MigrateOptions): Promise<MigrateReport> {
  const oldSeed = opts.oldSeed ?? EMPTY_OLD_SEED
  const loaded = await load(db, oldSeed)
  const report: MigrateReport = {
    step: opts.step, apply: false, before: summarize(loaded),
    written: { stateUpserted: 0, legacyCleared: 0, copyStatesDeleted: 0, attempts: 0, evalItems: 0, corrections: 0, repetition: 0, deleted: 0 }, after: null,
  }
  if (opts.step === 'plan' || !opts.apply) return report
  if (!opts.confirm) throw new Error(`${opts.step} --apply 는 ${CONFIRM_ENV}=yes 가 있어야 한다 — 쓰기 0`)
  if (opts.step === 'delete-copies' && !opts.confirmDelete) throw new Error('delete-copies --apply 는 --confirm-delete 도 있어야 한다 — 쓰기 0')
  report.apply = true
  if (opts.step === 'state') Object.assign(report.written, await applyState(db, loaded))
  else if (opts.step === 'repoint') Object.assign(report.written, await applyRepoint(db, loaded))
  else report.written.deleted = await applyDelete(db, loaded)
  report.after = summarize(await load(db, oldSeed))
  return report
}

/** 관문 = `expected` 6항목(하나라도 다르면 DIFF). seed-origin 은 대조용 추정치라 관문에 넣지 않고 끝에 따로 보인다. */
export function expectationLine(
  s: MigrateSummary,
  expected: typeof PRE_MIGRATION_EXPECTED = PRE_MIGRATION_EXPECTED,
  info: typeof PRE_MIGRATION_INFO = PRE_MIGRATION_INFO,
): string {
  const actual = { copies: s.copies, matched: s.matched, unmatched: s.unmatched, duplicate: s.duplicate, ambiguousBaseKeys: s.ambiguousBaseKeys, edited: s.edited.total }
  const keys = Object.keys(expected) as (keyof typeof expected)[]
  const parts = keys.map((k) => `${k} ${actual[k]}/${expected[k]}${actual[k] === expected[k] ? '' : ' DIFF'}`)
  const allOk = keys.every((k) => actual[k] === expected[k])
  const so = s.seedOrigin.total
  const infoPart = `info (not gated): seed-origin (differs from base word, same as old seed) ${so}/≈${info.seedOrigin}${so === info.seedOrigin ? '' : ' — differs from estimate, report it'}`
  return `  expect (pre-migration 2026-10-14, actual/expected): ${parts.join(' · ')} → ${allOk ? 'ALL OK' : 'DIFF — stop and report before any --apply'} · ${infoPart}`
}

const byFieldText = (m: Record<ContentField, number>) => CONTENT_FIELDS.map((f) => `${f}=${m[f]}`).join(' · ')

const fmt = (s: MigrateSummary) => [
  `  base words=${s.base} · seed copies=${s.copies} (users ${s.users}) · matched=${s.matched} · unmatched=${s.unmatched} (untouched) · duplicate=${s.duplicate} (untouched) · ambiguous base keys=${s.ambiguousBaseKeys}`,
  `  old OWNER seed file: rows=${s.oldSeed.rows} · usable keys=${s.oldSeed.usable} · ambiguous keys (base-word check only)=${s.oldSeed.ambiguousKeys}${s.oldSeed.rows === 0 ? ' — MISSING/UNREADABLE: old-seed check not applied' : ''}`,
  `  EDITED copies (differ from paired base word AND from old OWNER seed copy — delete-copies NEVER deletes these)=${s.edited.total} · by field vs base word: ${byFieldText(s.edited.byField)}`,
  `  seed-origin copies (differ from base word but same as old OWNER seed copy — not edited, deletable)=${s.seedOrigin.total} · by field vs base word: ${byFieldText(s.seedOrigin.byField)}`,
  `  state merge into base-word UserWordState: pending=${s.state.pending} (create=${s.state.create} · merge=${s.state.merge} · clear-only=${s.state.clearOnly}) · none-needed=${s.state.noneNeeded} · copies with legacy counters=${s.state.legacyRows} · copy-id UserWordState rows to merge+delete=${s.state.copyStateRows}`,
  `  refs to copies: VocabAttempt=${s.refs.attempts} · EvaluationItem=${s.refs.evalItems} · Correction=${s.refs.corrections} · RepetitionItem=${s.refs.repetition} (conflict ${s.refs.repetitionConflict}) · copies with refs=${s.refs.copiesWithRefs}`,
  `  LearningObservation refs (report only, not changed)=${s.observationsReportOnly}`,
  `  delete-copies would delete=${s.deletable} · skip: refs-left=${s.refused.refsLeft} · state-pending=${s.refused.statePending} · edited=${s.refused.edited}`,
]

export function formatMigrateReport(r: MigrateReport): string[] {
  const w = r.written
  return [
    `step: ${r.step} · mode: ${r.apply ? 'APPLY' : 'PLAN (no writes)'}`,
    'before:',
    ...fmt(r.before),
    ...(r.step === 'plan' ? [expectationLine(r.before)] : []),
    ...(r.apply
      ? [`written: state upserted=${w.stateUpserted} · legacy counters cleared=${w.legacyCleared} · copy states deleted=${w.copyStatesDeleted} · VocabAttempt=${w.attempts} · EvaluationItem=${w.evalItems} · Correction=${w.corrections} · RepetitionItem=${w.repetition} · copies deleted=${w.deleted}`]
      : []),
    ...(r.after ? ['after:', ...fmt(r.after)] : []),
  ]
}

export function parseMigrateArgs(args: readonly string[]): { step: MigrateStep; apply: boolean; confirmDelete: boolean } {
  const steps: readonly MigrateStep[] = ['plan', 'state', 'repoint', 'delete-copies']
  const positional = args.filter((a) => !a.startsWith('--'))
  const flags = args.filter((a) => a.startsWith('--'))
  const badFlags = flags.filter((f) => f !== '--apply' && f !== '--confirm-delete')
  if (badFlags.length || positional.length > 1 || (positional[0] && !(steps as readonly string[]).includes(positional[0]))) {
    throw new Error(`usage: migrate-seed-copies.ts [${steps.join('|')}] [--apply] [--confirm-delete]`)
  }
  const step = (positional[0] ?? 'plan') as MigrateStep
  const confirmDelete = flags.includes('--confirm-delete')
  if (confirmDelete && step !== 'delete-copies') throw new Error('--confirm-delete is only for delete-copies')
  return { step, apply: flags.includes('--apply'), confirmDelete }
}

/** (b) 기준 — 옛 OWNER 시드 원본(`<root>/prisma/seed-data/words-n5.json`). 못 읽으면 빈 기준((a) 만으로 판정 — 더 많이 막는 쪽). */
export function loadOldOwnerSeed(root: string): OldSeedIndex {
  try {
    return indexOldOwnerSeed(JSON.parse(readFileSync(join(root, 'prisma', 'seed-data', 'words-n5.json'), 'utf8')))
  } catch {
    return EMPTY_OLD_SEED
  }
}

async function main(): Promise<void> {
  let parsed: ReturnType<typeof parseMigrateArgs>
  try {
    parsed = parseMigrateArgs(process.argv.slice(2))
  } catch (e) {
    console.error((e as Error).message)
    process.exitCode = 2
    return
  }
  const confirm = process.env[CONFIRM_ENV] === 'yes'
  if (parsed.apply && parsed.step !== 'plan' && !confirm) {
    console.error(`${parsed.step} --apply requires ${CONFIRM_ENV}=yes (user approval) — nothing written`)
    process.exitCode = 2
    return
  }
  if (parsed.apply && parsed.step === 'delete-copies' && !parsed.confirmDelete) {
    console.error('delete-copies --apply requires --confirm-delete (separate approval) — nothing written')
    process.exitCode = 2
    return
  }
  const oldSeed = loadOldOwnerSeed(process.cwd())
  const { prisma } = await import('@/modules/infra')
  try {
    for (const line of formatMigrateReport(await runMigration(prisma, { ...parsed, confirm, oldSeed }))) console.log(line)
  } finally {
    await prisma.$disconnect()
  }
}

if (process.argv[1]?.endsWith('migrate-seed-copies.ts')) {
  main().catch((e: unknown) => {
    // 오류 본문은 접속 정보를 담을 수 있어 이름·코드만.
    const code = typeof (e as { code?: unknown })?.code === 'string' ? ` ${(e as { code: string }).code}` : ''
    console.error(`migrate-seed-copies failed: ${e instanceof Error ? e.name : 'Error'}${code}`)
    process.exitCode = 1
  })
}
