/**
 * 기본 단어(task-068) 시드 계획 — **순수 함수**(DB·파일 접근 없음). 실행기는 `scripts/seed-base-words.ts`.
 *
 * 기본 단어 = 단계 팩 N5~N1(`prisma/seed-data/jlpt/*.json`) ∪ 옛 `words-n5.json` 중 (표기, 읽기)가 팩에 **바이트로** 없는 행
 * (Leader 확정 ②, 합쳐서 하나도 잃지 않게). 공용 읽기 전용 행이라 `userId` NULL·`source=SEED`·고정 키 `seedKey`.
 *
 * - `seedKey` = `<단계>-<그 단계 JSON 의 1부터 순번 4자리>`(`N5-0001`). 옛 50개에서 더한 행은 `N5X-<words-n5.json 순번>` —
 *   N5 팩이 나중에 늘어도 키가 겹치지 않는다. 키는 JSON 순서에 묶이므로 **팩 JSON 의 순서를 바꾸거나 중간에 끼워 넣지 않는다**(끝에 덧붙이기만).
 *   실행기 `--check-db` 가 같은 키의 표기·읽기가 달라진 행(drift)을 센다.
 * - 조각이 빈 행은 `chunk-reclass.json` 규칙(D4 ★B: 표현 122·꾸밈 64·이름 11·느낌 3)으로 채운다 — 결과에 빈 조각 0. 규칙의 `expected`
 *   개수와 다르면 실패한다(시드 JSON 이 바뀌면 규칙을 다시 본다).
 * - DB 콜레이션은 히라가나/가타카나·탁음을 같게 보므로 짝 맞춤·중복 검사는 여기(JS `===`)에서 한다.
 * - 칸 길이(VarChar)를 넘는 행은 실패 — 실행기의 `createMany({ skipDuplicates })`(MySQL `INSERT IGNORE`)가 잘라 넣지 않게.
 */
import type { ChunkType, JlptLevel, PartOfSpeech } from '@prisma/client'
import { SEED_PACKS, seedPackCategory, type SeedPack } from '@/types/seedPack'
import { asSeedWords, type SeedWord } from './seedPack'

export const CHUNK_TYPES_ALL = ['NAME', 'ACTION', 'FEELING', 'MODIFIER', 'EXPRESSION'] as const satisfies readonly ChunkType[]
export const LEGACY_SEED_PREFIX = 'N5X'
/** schema.prisma `WordEntry` 칸 길이. */
export const BASE_WORD_LIMITS = { seedKey: 40, surface: 80, reading: 120, meaning: 200, category: 40 } as const

export interface BaseWordRow {
  seedKey: string
  userId: null
  source: 'SEED'
  surface: string
  reading: string
  meaning: string
  partOfSpeech: PartOfSpeech
  chunkType: ChunkType
  jlpt: JlptLevel
  example: string
  exampleKo: string
  category: string
}

export interface ChunkReclassRules {
  /** 목록 순서가 우선순위(앞 유형 목록에 있으면 그 유형). */
  bySurface: [ChunkType, ReadonlySet<string>][]
  byPartOfSpeech: Partial<Record<PartOfSpeech, ChunkType>>
  expected: Partial<Record<ChunkType, number>> | null
}

const isChunkType = (v: unknown): v is ChunkType => typeof v === 'string' && (CHUNK_TYPES_ALL as readonly string[]).includes(v)

export function parseChunkReclassRules(raw: unknown): ChunkReclassRules {
  const r = (raw ?? {}) as Record<string, unknown>
  const bad = (what: string): never => {
    throw new Error(`조각 재분류 규칙 형식 오류: ${what}`)
  }
  const bySurfaceRaw = r.bySurface
  if (!bySurfaceRaw || typeof bySurfaceRaw !== 'object') bad('bySurface')
  const bySurface: [ChunkType, ReadonlySet<string>][] = []
  const seen = new Set<string>()
  for (const [k, list] of Object.entries(bySurfaceRaw as Record<string, unknown>)) {
    if (!isChunkType(k) || !Array.isArray(list) || list.some((s) => typeof s !== 'string' || !s)) bad(`bySurface.${k}`)
    for (const s of list as string[]) {
      if (seen.has(s)) bad(`bySurface 중복 표기 ${s}`)
      seen.add(s)
    }
    bySurface.push([k as ChunkType, new Set(list as string[])])
  }
  const byPos = r.byPartOfSpeech
  if (!byPos || typeof byPos !== 'object') bad('byPartOfSpeech')
  for (const v of Object.values(byPos as Record<string, unknown>)) if (!isChunkType(v)) bad('byPartOfSpeech 값')
  let expected: ChunkReclassRules['expected'] = null
  if (r.expected != null) {
    if (typeof r.expected !== 'object') bad('expected')
    expected = {}
    for (const [k, n] of Object.entries(r.expected as Record<string, unknown>)) {
      if (!isChunkType(k) || typeof n !== 'number' || !Number.isInteger(n) || n < 0) bad(`expected.${k}`)
      expected[k as ChunkType] = n as number
    }
  }
  return { bySurface, byPartOfSpeech: byPos as ChunkReclassRules['byPartOfSpeech'], expected }
}

/** 조각이 빈 단어 1개의 배정. 어느 규칙에도 안 걸리면 던진다(조용히 기본값을 주지 않는다). */
export function reclassifyChunk(w: Pick<SeedWord, 'surface' | 'partOfSpeech'>, rules: ChunkReclassRules): ChunkType {
  for (const [type, set] of rules.bySurface) if (set.has(w.surface)) return type
  const byPos = rules.byPartOfSpeech[w.partOfSpeech]
  if (byPos) return byPos
  throw new Error(`조각 재분류 규칙 없음: 품사 ${w.partOfSpeech}`)
}

export interface BaseWordSeedInput {
  /** 단계 → 팩 JSON 원본(검사 전). */
  packs: Record<SeedPack, unknown>
  /** 옛 `words-n5.json` 원본. */
  legacy: unknown
  /** `chunk-reclass.json` 원본. */
  reclass: unknown
}

export interface BaseWordPlan {
  rows: BaseWordRow[]
  packCount: Record<SeedPack, number>
  legacyCount: number
  /** 옛 50개 중 팩에 (표기, 읽기)가 없어 더한 행(공개 시드 데이터 — 출력해도 된다). */
  legacyAdded: { seedKey: string; surface: string; reading: string }[]
  /** 조각이 빈 행을 규칙으로 채운 개수(유형별). */
  reclassified: Record<ChunkType, number>
  /** 최종 행의 유형별 개수. */
  byChunk: Record<ChunkType, number>
}

const zeroByChunk = (): Record<ChunkType, number> => ({ NAME: 0, ACTION: 0, FEELING: 0, MODIFIER: 0, EXPRESSION: 0 })
const wordKey = (surface: string, reading: string) => `${surface}\u0000${reading}`
const pad4 = (n: number) => String(n).padStart(4, '0')

function checkLimits(row: BaseWordRow): void {
  for (const k of ['seedKey', 'surface', 'reading', 'meaning', 'category'] as const) {
    // 칸 길이는 MariaDB 문자 수 = 코드포인트 수.
    if ([...row[k]].length > BASE_WORD_LIMITS[k]) throw new Error(`기본 단어 칸 길이 초과: ${row.seedKey}.${k}`)
  }
}

export function planBaseWords(input: BaseWordSeedInput): BaseWordPlan {
  const rules = parseChunkReclassRules(input.reclass)
  const rows: BaseWordRow[] = []
  const reclassified = zeroByChunk()
  const keys = new Map<string, string>()
  const packCount = {} as Record<SeedPack, number>

  const push = (w: SeedWord, seedKey: string, jlpt: JlptLevel, category: string) => {
    const key = wordKey(w.surface, w.reading)
    const dup = keys.get(key)
    if (dup) throw new Error(`기본 단어 (표기, 읽기) 중복: ${dup} · ${seedKey}`)
    keys.set(key, seedKey)
    let chunkType = w.chunkType
    if (chunkType === null) {
      chunkType = reclassifyChunk(w, rules)
      reclassified[chunkType]++
    }
    const row: BaseWordRow = {
      seedKey, userId: null, source: 'SEED', surface: w.surface, reading: w.reading, meaning: w.meaning, partOfSpeech: w.partOfSpeech,
      chunkType, jlpt, example: w.example, exampleKo: w.exampleKo, category,
    }
    checkLimits(row)
    rows.push(row)
  }

  for (const pack of SEED_PACKS) {
    const words = asSeedWords(input.packs[pack], pack)
    packCount[pack] = words.length
    words.forEach((w, i) => push(w, `${pack}-${pad4(i + 1)}`, pack, seedPackCategory(pack)))
  }

  const legacy = asSeedWords(input.legacy, 'words-n5.json')
  const legacyAdded: BaseWordPlan['legacyAdded'] = []
  legacy.forEach((w, i) => {
    if (keys.has(wordKey(w.surface, w.reading))) return
    const seedKey = `${LEGACY_SEED_PREFIX}-${pad4(i + 1)}`
    // 옛 행의 분류 「N5 기초」 대신 N5 팩 분류 — 난이도 이름 칩은 D3 에서 빠지고, 기본 단어끼리 분류가 갈리지 않게.
    push(w, seedKey, 'N5', seedPackCategory('N5'))
    legacyAdded.push({ seedKey, surface: w.surface, reading: w.reading })
  })

  if (rules.expected) {
    for (const t of CHUNK_TYPES_ALL) {
      const want = rules.expected[t] ?? 0
      if (reclassified[t] !== want) throw new Error(`조각 재분류 개수가 규칙의 expected 와 다름: ${t} ${reclassified[t]} ≠ ${want}`)
    }
  }
  const byChunk = zeroByChunk()
  for (const r of rows) byChunk[r.chunkType]++
  return { rows, packCount, legacyCount: legacy.length, legacyAdded, reclassified, byChunk }
}
