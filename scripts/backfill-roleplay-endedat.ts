/**
 * 역할극 끝냄 표식 백필(task-048) — `Chat.endedAt` 칸이 생기기 전에 사용자가 [마치기]로 끝낸 역할극에 그 시각을 채운다.
 *
 *   node --import tsx scripts/backfill-roleplay-endedat.ts            # 기본 dry-run: 읽기만, 건수·표본 chat id 5개·시각 범위만 출력
 *   node --import tsx scripts/backfill-roleplay-endedat.ts --apply    # 비어 있는 행만 UPDATE(배치마다 트랜잭션 하나)
 *
 * - 대상: 역할극 대화(`kind=TALK`·`scenarioId` 있음·`endedAt` NULL) 중 끝낸 표식 관측(`SCENARIO_END_MARK` — 기록·조회와 같은 조건, 같은 사용자)이 있는 것.
 *   값 = 그 대화의 가장 이른 표식 관측 `occurredAt`(결과 읽기 `readScenarioRolePlayResult` 가 고르는 행과 같다).
 * - 멱등: UPDATE 조건에 `endedAt: null` 이 있어 이미 값이 있는 행은 건드리지 않는다. 다시 실행하면 대상 0.
 * - 출력에는 건수·chat id·시각만 — 대화 내용·제목·사용자 이름·연결 문자열은 출력하지 않는다. 운영 DB 데이터 쓰기라 `--apply` 는 사용자 확인 뒤에만.
 */
import type { PrismaClient } from '@prisma/client'
import { SCENARIO_END_MARK } from '@/modules/learning'

export const BACKFILL_BATCH = 100
export const BACKFILL_SAMPLE = 5

export type BackfillDb = Pick<PrismaClient, 'chat' | 'learningObservation' | '$transaction'>

export interface BackfillReport {
  apply: boolean
  /** 실행 전 — 비어 있는 역할극 대화 수 · 이미 채워진 역할극 대화 수. */
  before: { empty: number; filled: number }
  /** 비어 있는 행 중 끝낸 표식 관측이 있는 대화(= 채울 대상) 수. */
  matched: number
  /** 실제로 바꾼 행 수(dry-run 은 0). */
  updated: number
  sampleChatIds: string[]
  occurredAt: { min: string | null; max: string | null }
  /** 실행 뒤(dry-run 은 실행 전과 같다). */
  after: { empty: number; filled: number }
}

const ROLE_PLAY = { kind: 'TALK', scenarioId: { not: null } } as const
const EMPTY = { ...ROLE_PLAY, endedAt: null }

async function counts(db: BackfillDb): Promise<{ empty: number; filled: number }> {
  const [empty, filled] = await Promise.all([db.chat.count({ where: EMPTY }), db.chat.count({ where: { ...ROLE_PLAY, endedAt: { not: null } } })])
  return { empty, filled }
}

export async function runBackfill(db: BackfillDb, opts: { apply: boolean; batch?: number }): Promise<BackfillReport> {
  const batch = Math.max(1, Math.floor(opts.batch ?? BACKFILL_BATCH))
  const before = await counts(db)
  let cursor: string | null = null
  let matched = 0
  let updated = 0
  let min: Date | null = null
  let max: Date | null = null
  const sample: string[] = []
  for (;;) {
    const chats: { id: string; userId: string }[] = await db.chat.findMany({
      where: cursor ? { ...EMPTY, id: { gt: cursor } } : EMPTY,
      orderBy: { id: 'asc' },
      take: batch,
      select: { id: true, userId: true },
    })
    if (!chats.length) break
    cursor = chats[chats.length - 1].id
    const owner = new Map(chats.map((c) => [c.id, c.userId]))
    const obs = await db.learningObservation.findMany({
      where: { userId: { in: [...new Set(chats.map((c) => c.userId))] }, ...SCENARIO_END_MARK, refId: { in: chats.map((c) => c.id) } },
      select: { userId: true, refId: true, occurredAt: true },
    })
    const first = new Map<string, Date>()
    for (const o of obs) {
      if (!o.refId || owner.get(o.refId) !== o.userId) continue
      const prev = first.get(o.refId)
      if (!prev || o.occurredAt.getTime() < prev.getTime()) first.set(o.refId, o.occurredAt)
    }
    const fills = [...first].map(([chatId, endedAt]) => ({ chatId, userId: owner.get(chatId)!, endedAt }))
    matched += fills.length
    for (const f of fills) {
      if (sample.length < BACKFILL_SAMPLE) sample.push(f.chatId)
      if (!min || f.endedAt < min) min = f.endedAt
      if (!max || f.endedAt > max) max = f.endedAt
    }
    if (opts.apply && fills.length) {
      updated += await db.$transaction(async (tx) => {
        let n = 0
        for (const f of fills) n += (await tx.chat.updateMany({ where: { id: f.chatId, userId: f.userId, endedAt: null }, data: { endedAt: f.endedAt } })).count
        return n
      })
    }
    if (chats.length < batch) break
  }
  return {
    apply: opts.apply,
    before,
    matched,
    updated,
    sampleChatIds: sample,
    occurredAt: { min: min?.toISOString() ?? null, max: max?.toISOString() ?? null },
    after: opts.apply ? await counts(db) : before,
  }
}

export function formatReport(r: BackfillReport): string[] {
  return [
    `mode: ${r.apply ? 'APPLY' : 'DRY-RUN (no writes)'}`,
    `before: roleplay chats endedAt NULL=${r.before.empty}, filled=${r.before.filled}`,
    `matched (NULL with end observation): ${r.matched}`,
    `updated: ${r.updated}`,
    `sample chat ids: ${r.sampleChatIds.join(', ') || '-'}`,
    `occurredAt range: ${r.occurredAt.min ?? '-'} .. ${r.occurredAt.max ?? '-'}`,
    `after: roleplay chats endedAt NULL=${r.after.empty}, filled=${r.after.filled}`,
  ]
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const unknown = args.filter((a) => a !== '--apply')
  if (unknown.length) {
    console.error(`unknown argument(s): ${unknown.join(' ')} — use --apply or nothing`)
    process.exitCode = 2
    return
  }
  const { prisma } = await import('@/modules/infra')
  try {
    for (const line of formatReport(await runBackfill(prisma, { apply: args.includes('--apply') }))) console.log(line)
  } finally {
    await prisma.$disconnect()
  }
}

// 시험이 import 할 때는 실행하지 않는다(직접 실행할 때만).
if (process.argv[1]?.endsWith('backfill-roleplay-endedat.ts')) {
  main().catch((e: unknown) => {
    // 오류 메시지 본문은 접속 정보를 담을 수 있어 이름·코드만.
    const code = typeof (e as { code?: unknown })?.code === 'string' ? ` ${(e as { code: string }).code}` : ''
    console.error(`backfill failed: ${e instanceof Error ? e.name : 'Error'}${code}`)
    process.exitCode = 1
  })
}
