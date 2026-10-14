/**
 * task-068 — 단어 보이는 범위 · 사용자별 학습 상태(`UserWordState`) 공용 도우미. 단어를 읽는 모든 learning 모듈(단어장·세트·평가 재료·
 * 레슨 메모·복습 재료)이 같은 범위를 쓰도록 여기 한 곳에 둔다(api-contract §2-9 task-068 개정).
 *
 * - 보이는 단어 = 내 단어(`userId` = 나) + 공용 기본 단어(`userId` NULL · `source=SEED`). 기본 단어 행은 앱이 쓰지 않는다(시드 스크립트만).
 * - 학습 상태·보관은 `UserWordState` 가 정본이다. 행이 없으면 0·보관 안 함. `WordEntry` 의 같은 이름 칸은 이관 뒤 읽지도 쓰지도 않는다.
 */
import type { Prisma, VocabAnswer } from '@prisma/client'
import type { Tx } from '@/modules/infra'

/** 내 단어 + 기본 단어. 남의 단어는 이 조건으로 절대 걸리지 않는다. */
export function visibleWordWhere(userId: string): Prisma.WordEntryWhereInput {
  return { OR: [{ userId }, { userId: null, source: 'SEED' }] }
}

/** 내가 보관하지 않은 것(내 상태 행이 없거나 `archived=false`). 다른 사용자의 보관은 보지 않는다. */
export function notArchivedBy(userId: string): Prisma.WordEntryWhereInput {
  return { states: { none: { userId, archived: true } } }
}

/** 내가 보관한 것(#40 `archived=1` 목록). */
export function archivedBy(userId: string): Prisma.WordEntryWhereInput {
  return { states: { some: { userId, archived: true } } }
}

/** 세트 풀·평가 재료처럼 「보이고 내가 보관하지 않은」 단어. */
export function activeWordWhere(userId: string): Prisma.WordEntryWhereInput {
  return { AND: [visibleWordWhere(userId), notArchivedBy(userId)] }
}

export type WordStateRow = {
  correctCount: number
  wrongCount: number
  lastSeenAt: Date | null
  lastResult: VocabAnswer | null
  archived: boolean
  archivedAt: Date | null
}

export const EMPTY_WORD_STATE: Readonly<WordStateRow> = Object.freeze({
  correctCount: 0, wrongCount: 0, lastSeenAt: null, lastResult: null, archived: false, archivedAt: null,
})

const STATE_SELECT = { wordId: true, correctCount: true, wrongCount: true, lastSeenAt: true, lastResult: true, archived: true, archivedAt: true } as const

/** `id IN (…)` 한 번의 값 수 — 세트 풀(약 7.8천)을 SQL 한 문장에 싣지 않는다. */
const STATE_QUERY_CHUNK = 1_000

/** 내 상태 행 맵(단어 id → 상태). 행이 없는 단어는 맵에 없다(= `EMPTY_WORD_STATE`). */
export async function loadWordStates(db: Pick<Tx, 'userWordState'>, userId: string, wordIds: readonly string[]): Promise<Map<string, WordStateRow>> {
  const ids = [...new Set(wordIds)]
  const out = new Map<string, WordStateRow>()
  for (let i = 0; i < ids.length; i += STATE_QUERY_CHUNK) {
    const rows = await db.userWordState.findMany({ where: { userId, wordId: { in: ids.slice(i, i + STATE_QUERY_CHUNK) } }, select: STATE_SELECT })
    for (const { wordId, ...s } of rows) out.set(wordId, s)
  }
  return out
}

/**
 * 내가 보관하지 않은 단어의 내 상태 행 전부(단어 id → 상태). 풀의 id 를 `IN` 으로 보내지 않는다 — 상태 행은 본 적 있는 단어에만
 * 있으므로 `(userId, archived)` 색인 범위 한 번이 풀 전체 id 묶음 조회(1천 개씩 8번)보다 싸다. 행이 없는 단어 = 0·미보관.
 * 세트 풀(`vocab/sessions`)과 평가 재료(`evaluation/materials`)가 함께 쓴다.
 */
export async function loadActiveWordStates(db: Pick<Tx, 'userWordState'>, userId: string): Promise<Map<string, WordStateRow>> {
  const rows = await db.userWordState.findMany({ where: { userId, archived: false }, select: STATE_SELECT })
  return new Map(rows.map(({ wordId, ...s }) => [wordId, s]))
}

export type WordStateDelta = { correctIds: readonly string[]; wrongIds: readonly string[]; skippedIds: readonly string[] }

/**
 * 세트 끝내기 카운터(E5 — 맞힘·틀림은 +1, 건너뜀은 `lastSeenAt`·`lastResult` 만) → `UserWordState` 에만 쓴다.
 * 보이는 단어(내 단어·기본 단어)만 대상이다 — 그 사이 지워진 단어·남의 단어 id 는 조용히 빠진다(FK 오류·남의 상태 쓰기 방지).
 * 없는 상태 행은 먼저 기본값으로 만들고(중복 무시) 목록별로 한 번씩 갱신한다 — 예전 `wordEntry.updateMany` 세 번과 같은 결과
 * (같은 id 가 두 목록에 있으면 맞힘 → 틀림 → 건너뜀 순서로 차례로 반영, 한 목록 안의 중복은 한 번).
 */
export async function bumpWordStates(tx: Tx, userId: string, d: WordStateDelta, now: Date): Promise<void> {
  const all = [...new Set([...d.correctIds, ...d.wrongIds, ...d.skippedIds])]
  if (!all.length) return
  const visible = new Set<string>()
  for (let i = 0; i < all.length; i += STATE_QUERY_CHUNK) {
    const rows = await tx.wordEntry.findMany({ where: { AND: [{ id: { in: all.slice(i, i + STATE_QUERY_CHUNK) } }, visibleWordWhere(userId)] }, select: { id: true } })
    for (const r of rows) visible.add(r.id)
  }
  if (!visible.size) return
  await tx.userWordState.createMany({ data: [...visible].map((wordId) => ({ userId, wordId })), skipDuplicates: true })
  const pick = (ids: readonly string[]) => [...new Set(ids)].filter((id) => visible.has(id))
  const correct = pick(d.correctIds)
  const wrong = pick(d.wrongIds)
  const skipped = pick(d.skippedIds)
  if (correct.length) await tx.userWordState.updateMany({ where: { userId, wordId: { in: correct } }, data: { correctCount: { increment: 1 }, lastSeenAt: now, lastResult: 'CORRECT' } })
  if (wrong.length) await tx.userWordState.updateMany({ where: { userId, wordId: { in: wrong } }, data: { wrongCount: { increment: 1 }, lastSeenAt: now, lastResult: 'WRONG' } })
  if (skipped.length) await tx.userWordState.updateMany({ where: { userId, wordId: { in: skipped } }, data: { lastSeenAt: now, lastResult: 'SKIPPED' } })
}
