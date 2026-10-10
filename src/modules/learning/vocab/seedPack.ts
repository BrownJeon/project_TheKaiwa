/**
 * 기본 단어 팩(#46b) — JLPT 5단계(task-051 설계 v2). 원본은 `prisma/seed-data/jlpt/{n5,n4,n3,n2,n1}.json`(CC BY-SA 4.0 파생, 출처는
 * 저장소 `SOURCES.md`). OWNER 시드(`prisma/seed.ts`)는 지금도 `words-n5.json` 50개를 읽는다 — 이 모듈은 그 파일을 읽지 않는다.
 *
 * 지연 로딩: 단계 JSON 7천여 개를 서버 번들 하나에 정적으로 싣지 않도록 **단계마다 리터럴 경로 `import()` 한 줄** — 번들러가 단계별
 * 청크로 나누고, 실행 위치(cwd·미러 디렉토리)와 무관하게 같은 데이터를 읽는다(런타임 `fs` 읽기를 택하지 않은 이유는 task-008 과 같다).
 * 경로를 변수로 만들면 번들러가 파일을 찾지 못한다. 처음 로드 때 한 번 형식 검사 후 캐시한다.
 *
 * 건너뜀 규칙(Leader 결정 2026-10-10): 같은 표기이고 (읽기가 같거나 기존 단어의 읽기가 비어 있음) → `skipped`. 데이터 쪽 키는 (표기, 읽기) —
 * 단계 사이 같은 표기는 읽기가 다른 다른 단어다(明日 あした/あす). 표기만 보면 뒤 단계 단어를 잃는다.
 *
 * 사용자의 직접 행위(CTA)라 제안·채택 규칙 대상이 아니다. 사용자 행을 잠근 **한 트랜잭션** — 동시 두 번이 같은 단어를 두 번 넣지 않고,
 * 나눠 넣는 중 실패하면 전부 되돌아간다.
 */
import type { ChunkType, PartOfSpeech } from '@prisma/client'
import { ApiError, lockUserRow, withTransaction, type Tx } from '@/modules/infra'
import { SEED_PACKS, isSeedPack, seedPackCategory, type SeedPack } from '@/types/seedPack'
import { PARTS_OF_SPEECH, WORD_CHUNK_TYPES } from './words'

export { SEED_PACKS }
export type { SeedPack }

export interface SeedWord {
  surface: string
  reading: string
  meaning: string
  partOfSpeech: PartOfSpeech
  chunkType: ChunkType | null
  example: string
  exampleKo: string
}

/** `surface IN (…)` 한 번의 값 수·`createMany` 한 번의 행 수 — N1(약 3천 개)을 SQL 한 문장에 싣지 않는다. */
export const SEED_QUERY_CHUNK = 500
export const SEED_INSERT_CHUNK = 500
/** N1 전체를 넣는 트랜잭션(조회 7번·삽입 7번)이 원격 MariaDB 에서 기본 상한 15초에 걸리지 않게. 실측 전 값이다. */
const SEED_TX_TIMEOUT_MS = 30_000

export function asSeedWords(raw: unknown, label = ''): SeedWord[] {
  const where = label ? `시드 팩 형식 오류(${label})` : '시드 팩 형식 오류'
  if (!Array.isArray(raw)) throw new Error(`${where}: 배열이 아님`)
  return raw.map((w, i) => {
    const r = (w ?? {}) as Record<string, unknown>
    const str = (k: string) => {
      if (typeof r[k] !== 'string' || !(r[k] as string).trim()) throw new Error(`${where}: [${i}].${k}`)
      return r[k] as string
    }
    const pos = str('partOfSpeech')
    if (!(PARTS_OF_SPEECH as readonly string[]).includes(pos)) throw new Error(`${where}: [${i}].partOfSpeech`)
    const chunk = r.chunkType == null ? null : String(r.chunkType)
    if (chunk !== null && !(WORD_CHUNK_TYPES as readonly string[]).includes(chunk)) throw new Error(`${where}: [${i}].chunkType`)
    return {
      surface: str('surface'), reading: str('reading'), meaning: str('meaning'), partOfSpeech: pos as PartOfSpeech,
      chunkType: chunk as ChunkType | null, example: str('example'), exampleKo: str('exampleKo'),
    }
  })
}

/** 단계 → 원본 배열(검사 전). 시험은 데이터 파일 없이 가짜 로더를 `createSeedPackStore` 에 넣는다. */
export type SeedPackLoader = (pack: SeedPack) => Promise<unknown>

const JLPT_JSON: Record<SeedPack, () => Promise<{ default: unknown }>> = {
  N5: () => import('../../../../prisma/seed-data/jlpt/n5.json'),
  N4: () => import('../../../../prisma/seed-data/jlpt/n4.json'),
  N3: () => import('../../../../prisma/seed-data/jlpt/n3.json'),
  N2: () => import('../../../../prisma/seed-data/jlpt/n2.json'),
  N1: () => import('../../../../prisma/seed-data/jlpt/n1.json'),
}

export const loadJlptJson: SeedPackLoader = async (pack) => (await JLPT_JSON[pack]()).default

/** 단계별로 한 번만 로드·검사하고 같은 배열을 돌려준다. 로드가 실패하면 캐시하지 않아 다음 요청이 다시 시도한다. */
export function createSeedPackStore(load: SeedPackLoader): (pack: SeedPack) => Promise<readonly SeedWord[]> {
  const cache = new Map<SeedPack, Promise<readonly SeedWord[]>>()
  return (pack) => {
    const hit = cache.get(pack)
    if (hit) return hit
    const p: Promise<readonly SeedWord[]> = Promise.resolve()
      .then(() => load(pack))
      .then((raw) => Object.freeze(asSeedWords(raw, pack)))
    cache.set(pack, p)
    p.catch(() => {
      if (cache.get(pack) === p) cache.delete(pack)
    })
    return p
  }
}

export const seedPackWords = createSeedPackStore(loadJlptJson)

export function parseSeedPackBody(body: Record<string, unknown>): SeedPack {
  const extra = Object.keys(body).filter((k) => k !== 'pack')
  if (extra.length) throw new ApiError('VALIDATION', `넣을 수 없는 항목입니다: ${extra.join(', ')}`, { field: extra[0], reason: 'unknown_key' })
  if (!isSeedPack(body.pack)) {
    throw new ApiError('VALIDATION', `지원하지 않는 단어 팩입니다(${SEED_PACKS.join('·')} 중 하나).`, { field: 'pack', reason: SEED_PACKS.join('|') })
  }
  return body.pack
}

export interface ExistingWord {
  surface: string
  reading: string | null
}

/**
 * 넣을 단어 고르기(순수) — 같은 표기(JS `===`)인 기존 단어 중 읽기가 같거나 읽기가 비어 있는 것이 있으면 건너뛴다.
 * 팩 안에 같은 (표기, 읽기)가 두 번 있어도 한 번만 넣는다. DB 콜레이션이 같게 본 다른 글자(히라가나/가타카나·탁음)는 여기서 걸러진다.
 */
export function planSeedInsert(words: readonly SeedWord[], existing: readonly ExistingWord[]): SeedWord[] {
  const readingsBySurface = new Map<string, (string | null)[]>()
  for (const e of existing) {
    const list = readingsBySurface.get(e.surface)
    if (list) list.push(e.reading)
    else readingsBySurface.set(e.surface, [e.reading])
  }
  const taken = new Set<string>()
  const fresh: SeedWord[] = []
  for (const w of words) {
    if (readingsBySurface.get(w.surface)?.some((r) => !r?.trim() || r === w.reading)) continue
    const key = `${w.surface}\u0000${w.reading}`
    if (taken.has(key)) continue
    taken.add(key)
    fresh.push(w)
  }
  return fresh
}

function chunked<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/** #46b 쓰기 본체 — 호출자가 연 트랜잭션(사용자 행 잠금 뒤)에서 조회·삽입을 나눠 실행한다. 보관한 단어도 「있는 단어」로 센다. */
export async function insertSeedWords(tx: Tx, userId: string, pack: SeedPack, words: readonly SeedWord[]): Promise<{ added: number; skipped: number }> {
  const existing: ExistingWord[] = []
  for (const part of chunked([...new Set(words.map((w) => w.surface))], SEED_QUERY_CHUNK)) {
    existing.push(...(await tx.wordEntry.findMany({ where: { userId, surface: { in: part } }, select: { surface: true, reading: true } })))
  }
  const fresh = planSeedInsert(words, existing)
  const category = seedPackCategory(pack)
  for (const part of chunked(fresh, SEED_INSERT_CHUNK)) {
    await tx.wordEntry.createMany({
      data: part.map((w) => ({
        userId, surface: w.surface, reading: w.reading, meaning: w.meaning, partOfSpeech: w.partOfSpeech, chunkType: w.chunkType,
        jlpt: pack, example: w.example, exampleKo: w.exampleKo, category, source: 'SEED' as const,
      })),
    })
  }
  return { added: fresh.length, skipped: words.length - fresh.length }
}

/** #46b — `source=SEED, jlpt=단계, category=단계 표시 이름` 으로 복사. 건너뜀 규칙은 파일 머리말. */
export async function addSeedPack(userId: string, pack: SeedPack): Promise<{ added: number; skipped: number }> {
  const words = await seedPackWords(pack)
  return withTransaction(async (tx) => {
    await lockUserRow(tx, userId)
    return insertSeedWords(tx, userId, pack, words)
  }, { timeoutMs: SEED_TX_TIMEOUT_MS })
}
