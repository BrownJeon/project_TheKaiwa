/**
 * 기존 사용자 기본 단어 사본 → 공용 기본 단어 이관(task-068 Leader 확정 ⑤, 감사 A 수정) — **순수 계획 함수**. 실행기는 `scripts/migrate-seed-copies.ts`.
 *
 * 사본 = 사용자 소유(`userId` 있음)·`source=SEED`·`seedKey` 없음(옛 #46b 버튼·OWNER 시드가 복사한 행). 기본 단어 = `userId` NULL·`seedKey` 있음.
 * 짝 맞춤은 (표기, 읽기) **바이트 일치**(JS `===`) — DB 콜레이션은 히라가나/가타카나·탁음을 같게 보므로 SQL 비교로 짝을 맞추지 않는다.
 *
 * 상태 정책(REV-068A-1 — 버리지 않고 합산). 한 사본의 기록은 세 곳에 흩어질 수 있다:
 *   ① 사본 행의 옛 칸(옛 코드가 쌓은 값) ② 사본 id 의 UserWordState(새 코드 배포 뒤 사본을 푼 기록 — 0 에서 시작)
 *   ③ 대상(사용자, 기본 단어) UserWordState(새 코드에서 기본 단어를 푼 기록 — 0 에서 시작).
 *   세 출처는 서로 다른 풀이를 센다(새 코드는 옛 칸을 읽지도 쓰지도 않고 행을 0 에서 만든다) → 더해도 이중 집계가 아니다.
 * - 맞힘·틀림 = 합. 마지막 본 시각 = 가장 늦은 값, 마지막 결과는 그 출처의 값(같은 시각이면 ③ > ② > ①).
 * - 보관 = ③ 이 있으면 ③ 의 값(새 코드에서 사용자가 지금 보고 고른 상태), 없으면 ② 가 있으면 ②, 없으면 ①(`archivedAt` 함께).
 * - 「이미 이관됨」 표지 = ① 이 기본값이고 ② 가 없음. `state` 는 한 트랜잭션에서 ③ 에 더한 뒤 ① 을 0/null/false 로 되돌리고 ② 를 지운다
 *   → 다시 실행해도 더하지 않고, `delete-copies` 는 이 표지로 「상태가 대상에 있음」을 확인한다.
 * - 사본 쪽(① + ②)이 기본값이면 대상 행을 만들지 않는다(행 없음 = 기본값) — 표지만 정리한다.
 *
 * 사용자가 고친 사본(REV-068A-2, edited 판정 수정): 옛 코드는 SEED 사본의 뜻·품사·예문·메모 수정을 막지 않았다. 「고쳤는가」는
 * **사본이 만들어질 때 받은 내용**과 비교한다. 비교 칸(뜻·품사·예문·번역·메모)이 다음 중 하나와 모두 같으면 안 고친 것(삭제 가능):
 *   (a) 짝 기본 단어의 지금 내용 — #46b 팩 사본은 팩 JSON 을 그대로 받았고 기본 단어도 같은 JSON 에서 만든다.
 *   (b) 옛 `prisma/seed.ts` OWNER 단계가 `words-n5.json` 의 같은 (표기, 읽기) 줄로 만든 모양(`oldOwnerSeedCopy`) — 두 시드 파일이 같은
 *       단어를 다르게 적어(예문·번역·뜻) 옛 OWNER 사본은 (a) 와 달라도 사용자가 고친 것이 아니다.
 * 둘 다와 다르면 `edited` — `delete-copies` 는 지우지 않고 개수만 보고한다(우회 옵션 없음). `state`·`repoint` 는 그대로 진행한다.
 * (a) 와는 다르고 (b) 와 같은 사본은 `seedOrigin` 으로 따로 센다(보고용 — 판정 완화가 얼마나 일어났는지 보이게).
 * (b) 는 옛 파일에서 그 표기가 한 줄뿐일 때만 쓴다 — 표기가 두 줄 이상이면 그 표기의 키는 모두 (a) 로만 판정(옛 코드는 표기만으로 건너뛰어
 * 어느 줄이 사본을 만들었는지 키로 정해지지 않는다; 같은 (표기, 읽기) 두 줄도 여기에 포함).
 * 비교에서 뺀 칸: `chunkType`·`category`·`jlpt`(기본 단어는 재분류·이름 정리로 달라지는 것이 정상), `surface`·`reading`(짝 기준).
 * 빈 문자열·공백뿐인 값은 null 과 같게 본다(정보가 없으므로). 비교는 모두 바이트 일치(JS `===`).
 *
 * 한 사용자의 두 사본이 같은 기본 단어에 짝지어지면(`duplicate`) 어느 것도 옮기지 않는다(합치는 규칙을 정하지 않았다 — 보고만).
 */
import type { PartOfSpeech, VocabAnswer } from '@prisma/client'

export interface WordStateValues {
  correctCount: number
  wrongCount: number
  lastSeenAt: Date | null
  lastResult: VocabAnswer | null
  archived: boolean
  archivedAt: Date | null
}

/** 사용자가 옛 코드에서 고칠 수 있었던 내용 칸 중 이관 비교 대상. */
export interface WordContent {
  meaning: string
  partOfSpeech: PartOfSpeech
  example: string | null
  exampleKo: string | null
  note: string | null
}

export const CONTENT_FIELDS = ['meaning', 'partOfSpeech', 'example', 'exampleKo', 'note'] as const
export type ContentField = (typeof CONTENT_FIELDS)[number]

export interface BaseWordRow extends WordContent {
  id: string
  surface: string
  reading: string | null
}

export interface SeedCopyRow extends WordStateValues, WordContent {
  id: string
  userId: string
  surface: string
  reading: string | null
}

/** 옛 `prisma/seed.ts` OWNER 단계가 `words-n5.json` 한 줄로 만든 `WordEntry` 모양(e22fd7e~bcc04e2 모든 판이 같은 매핑). */
export interface OldOwnerSeedCopy extends WordContent {
  surface: string
  reading: string | null
  chunkType: string | null
  jlpt: 'N5'
  category: 'N5 기초'
  source: 'SEED'
}

/** (b) 기준 — 바이트 (표기, 읽기) → 옛 사본 모양. 모호한 표기의 키는 들어 있지 않다. */
export interface OldSeedIndex {
  byKey: ReadonlyMap<string, OldOwnerSeedCopy>
  /** 파일의 줄 수(형식이 다른 줄 포함). */
  rows: number
  /** 표기가 두 줄 이상이라 (b) 를 쓰지 않는 (표기, 읽기) 키 수. */
  ambiguousKeys: number
}

export interface CopyPair {
  copyId: string
  userId: string
  baseId: string
  /** ① 사본 행의 옛 칸. */
  legacy: WordStateValues
  /** ② 사본 id 의 UserWordState(없으면 null). */
  copyState: WordStateValues | null
  /** (a) 짝 기본 단어와 다른 내용 칸. */
  diff: ContentField[]
  /** `diff` 가 있지만 (b) 옛 OWNER 시드 사본 모양과 같다 — 안 고친 것. */
  seedOrigin: boolean
}

export interface CopyMatchPlan {
  pairs: CopyPair[]
  /** 기본 단어에 (표기, 읽기)가 없는 사본 id — 절대 건드리지 않는다. */
  unmatched: string[]
  /** 같은 사용자의 다른 사본과 같은 기본 단어에 짝지어진 사본 id — 옮기지 않는다. */
  duplicate: string[]
  /** 기본 단어 안에서 (표기, 읽기)가 겹친 키 수(0 이어야 한다 — 겹친 키에 짝지어지는 사본은 unmatched). */
  ambiguousBaseKeys: number
}

export const wordPairKey = (surface: string, reading: string | null) => `${surface}\u0000${reading ?? ''}`

export const ZERO_STATE: Readonly<WordStateValues> = Object.freeze({ correctCount: 0, wrongCount: 0, lastSeenAt: null, lastResult: null, archived: false, archivedAt: null })

export const pickState = (s: WordStateValues): WordStateValues => ({
  correctCount: s.correctCount, wrongCount: s.wrongCount, lastSeenAt: s.lastSeenAt, lastResult: s.lastResult, archived: s.archived, archivedAt: s.archivedAt,
})

export function isDefaultState(s: WordStateValues): boolean {
  return s.correctCount === 0 && s.wrongCount === 0 && s.lastSeenAt === null && s.lastResult === null && !s.archived && s.archivedAt === null
}

const time = (d: Date | null) => (d ? d.getTime() : null)
const blankToNull = (v: string | null) => (v === null || v.trim() === '' ? null : v)

/** 사본 내용이 기준(기본 단어·옛 시드)과 다른 칸. */
export function contentDiff(copy: WordContent, ref: WordContent): ContentField[] {
  return CONTENT_FIELDS.filter((f) => (f === 'meaning' || f === 'partOfSpeech' ? copy[f] !== ref[f] : blankToNull(copy[f]) !== blankToNull(ref[f])))
}

const record = (w: unknown): Record<string, unknown> | null => (w !== null && typeof w === 'object' && !Array.isArray(w) ? (w as Record<string, unknown>) : null)

/**
 * 옛 OWNER 단계의 `wordEntry.create` 매핑 그대로:
 * `{ surface, reading, meaning, partOfSpeech, chunkType: chunkType ?? null, jlpt: 'N5', example, exampleKo, category: 'N5 기초', source: 'SEED' }`.
 * `note` 는 넣지 않았다 → 칸 기본값 null(파일 줄에 note 가 있어도). 빠진 선택 칸(undefined)은 Prisma 가 넣지 않아 null.
 * 그 create 가 실패했을 줄(필수 칸이 문자열이 아님·선택 칸이 문자열/null 이 아님)은 사본을 만들지 못했으므로 null.
 */
export function oldOwnerSeedCopy(w: unknown): OldOwnerSeedCopy | null {
  const r = record(w)
  if (!r) return null
  const req = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : undefined)
  const opt = (k: string) => (r[k] === undefined || r[k] === null ? null : typeof r[k] === 'string' ? (r[k] as string) : undefined)
  const surface = req('surface')
  const meaning = req('meaning')
  const partOfSpeech = req('partOfSpeech')
  const reading = opt('reading')
  const chunkType = opt('chunkType')
  const example = opt('example')
  const exampleKo = opt('exampleKo')
  if (surface === undefined || meaning === undefined || partOfSpeech === undefined) return null
  if (reading === undefined || chunkType === undefined || example === undefined || exampleKo === undefined) return null
  return { surface, reading, meaning, partOfSpeech: partOfSpeech as PartOfSpeech, chunkType, jlpt: 'N5', example, exampleKo, note: null, category: 'N5 기초', source: 'SEED' }
}

export const EMPTY_OLD_SEED: OldSeedIndex = Object.freeze({ byKey: new Map<string, OldOwnerSeedCopy>(), rows: 0, ambiguousKeys: 0 })

/** 옛 `words-n5.json` 원본 → (b) 기준. 표기가 두 줄 이상인 키는 모두 뺀다(머리말). 형식이 다른 줄도 표기가 문자열이면 표기 수에 센다. */
export function indexOldOwnerSeed(raw: unknown): OldSeedIndex {
  if (!Array.isArray(raw)) throw new Error('old seed: not an array')
  const surfaceCount = new Map<string, number>()
  for (const w of raw) {
    const s = record(w)?.surface
    if (typeof s === 'string') surfaceCount.set(s, (surfaceCount.get(s) ?? 0) + 1)
  }
  const byKey = new Map<string, OldOwnerSeedCopy>()
  const ambiguous = new Set<string>()
  for (const w of raw) {
    const c = oldOwnerSeedCopy(w)
    if (!c) continue
    const k = wordPairKey(c.surface, c.reading)
    if ((surfaceCount.get(c.surface) ?? 0) > 1) ambiguous.add(k)
    else byKey.set(k, c)
  }
  return { byKey, rows: raw.length, ambiguousKeys: ambiguous.size }
}

/** 지우면 안 되는 사본 — (a) 기본 단어와도 (b) 옛 시드 사본 모양과도 내용이 다르다. */
export const isEditedCopy = (p: Pick<CopyPair, 'diff' | 'seedOrigin'>): boolean => p.diff.length > 0 && !p.seedOrigin

/**
 * 사본 ↔ 기본 단어 짝 맞춤. `copyStates` = 사본 id → 그 사본 소유자의 UserWordState. `oldSeed` = (b) 기준(없으면 (a) 만으로 판정).
 */
export function matchSeedCopies(
  base: readonly BaseWordRow[],
  copies: readonly SeedCopyRow[],
  copyStates: ReadonlyMap<string, WordStateValues> = new Map(),
  oldSeed: OldSeedIndex = EMPTY_OLD_SEED,
): CopyMatchPlan {
  const byKey = new Map<string, BaseWordRow | null>()
  let ambiguousBaseKeys = 0
  for (const b of base) {
    const k = wordPairKey(b.surface, b.reading)
    if (byKey.has(k)) {
      if (byKey.get(k) !== null) ambiguousBaseKeys++
      byKey.set(k, null)
    } else byKey.set(k, b)
  }
  const unmatched: string[] = []
  const candidates: CopyPair[] = []
  for (const c of copies) {
    const k = wordPairKey(c.surface, c.reading)
    const b = byKey.get(k)
    if (!b) {
      unmatched.push(c.id)
      continue
    }
    const diff = contentDiff(c, b)
    const oldShape = oldSeed.byKey.get(k)
    const sameAsOldSeed = oldShape !== undefined && contentDiff(c, oldShape).length === 0
    const seedOrigin = diff.length > 0 && sameAsOldSeed
    const cs = copyStates.get(c.id)
    candidates.push({ copyId: c.id, userId: c.userId, baseId: b.id, legacy: pickState(c), copyState: cs ? pickState(cs) : null, diff, seedOrigin })
  }
  const seen = new Map<string, number>()
  for (const p of candidates) seen.set(`${p.userId}\u0000${p.baseId}`, (seen.get(`${p.userId}\u0000${p.baseId}`) ?? 0) + 1)
  const pairs: CopyPair[] = []
  const duplicate: string[] = []
  for (const p of candidates) {
    if ((seen.get(`${p.userId}\u0000${p.baseId}`) ?? 0) > 1) duplicate.push(p.copyId)
    else pairs.push(p)
  }
  return { pairs, unmatched, duplicate, ambiguousBaseKeys }
}

/** 앞에 둔 출처가 같은 시각에서 이긴다. 시각이 모두 없으면 앞에서부터 첫 결과. */
function latestSeen(sources: readonly WordStateValues[]): Pick<WordStateValues, 'lastSeenAt' | 'lastResult'> {
  let best: WordStateValues | null = null
  for (const s of sources) {
    const t = time(s.lastSeenAt)
    if (t !== null && (best === null || t > (time(best.lastSeenAt) as number))) best = s
  }
  if (best) return { lastSeenAt: best.lastSeenAt, lastResult: best.lastResult }
  return { lastSeenAt: null, lastResult: sources.find((s) => s.lastResult !== null)?.lastResult ?? null }
}

/** 사본 쪽 기록(① 옛 칸 + ② 사본 상태) — 대상에 더할 값. 보관은 ② 가 있으면 ②. */
export function copySideState(legacy: WordStateValues, copyState: WordStateValues | null): WordStateValues {
  if (!copyState) return pickState(legacy)
  return {
    correctCount: legacy.correctCount + copyState.correctCount,
    wrongCount: legacy.wrongCount + copyState.wrongCount,
    ...latestSeen([copyState, legacy]),
    archived: copyState.archived,
    archivedAt: copyState.archivedAt,
  }
}

/** 이관 뒤 대상(사용자, 기본 단어)이 가질 값 — ① + ② + ③ 합산 규칙(머리말). */
export function mergeStates(target: WordStateValues | undefined, legacy: WordStateValues, copyState: WordStateValues | null): WordStateValues {
  const side = copySideState(legacy, copyState)
  if (!target) return side
  return {
    correctCount: target.correctCount + side.correctCount,
    wrongCount: target.wrongCount + side.wrongCount,
    ...latestSeen([target, ...(copyState ? [copyState] : []), legacy]),
    archived: target.archived,
    archivedAt: target.archivedAt,
  }
}

/** 이 사본에 `state` 단계가 할 일이 남았나 — 「이미 이관됨」 표지(옛 칸 기본값 + 사본 상태 행 없음)의 반대. */
export const statePending = (p: CopyPair): boolean => !isDefaultState(p.legacy) || p.copyState !== null

/**
 * - `none-needed`: 할 일 없음(이미 이관됐거나 처음부터 기본값).
 * - `clear-only`: 사본 쪽이 기본값 — 대상 행은 만들지·바꾸지 않고 표지(옛 칸·사본 상태 행)만 정리.
 * - `create`: 대상 행이 없다 — 사본 쪽 값으로 만든다. `merge`: 대상 행에 더한다(보관은 대상 값 유지).
 */
export type StateDecision = 'none-needed' | 'clear-only' | 'create' | 'merge'

export function decideState(pair: CopyPair, target: WordStateValues | undefined): StateDecision {
  if (!statePending(pair)) return 'none-needed'
  if (isDefaultState(copySideState(pair.legacy, pair.copyState))) return 'clear-only'
  return target ? 'merge' : 'create'
}

export type DeleteRefusal = 'refs-left' | 'state-pending' | 'edited'

/**
 * 사본을 지워도 되는가 — 남은 참조 0 · 상태가 대상에 있음(표지) · 고치지 않은 사본일 때만.
 * `refsLeft` = 사본 id 를 가리키는 VocabAttempt·EvaluationItem·Correction·RepetitionItem(WordEntry) 행 수(사용자 무관 전부).
 */
export function deleteDecision(pair: CopyPair, refsLeft: number): { ok: true } | { ok: false; reason: DeleteRefusal } {
  if (refsLeft > 0) return { ok: false, reason: 'refs-left' }
  if (statePending(pair)) return { ok: false, reason: 'state-pending' }
  if (isEditedCopy(pair)) return { ok: false, reason: 'edited' }
  return { ok: true }
}
