/**
 * 기본 단어 원본 로더 — JLPT 5단계(task-051 설계 v2). 원본은 `prisma/seed-data/jlpt/{n5,n4,n3,n2,n1}.json`(CC BY-SA 4.0 파생, 출처는
 * 저장소 `SOURCES.md`). task-068 에서 사용자별 복사(#46b `addSeedPack`)는 폐지됐다 — 기본 단어는 공용 행이고 시드 스크립트
 * (`scripts/seed-base-words.ts` → `baseWordSeed.ts`)만 쓴다. 이 파일은 그 스크립트와 데이터 시험이 쓰는 형식 검사(`asSeedWords`)·로더만 남긴다.
 *
 * 지연 로딩: 단계 JSON 7천여 개를 서버 번들 하나에 정적으로 싣지 않도록 **단계마다 리터럴 경로 `import()` 한 줄** — 번들러가 단계별
 * 청크로 나누고, 실행 위치(cwd·미러 디렉토리)와 무관하게 같은 데이터를 읽는다. 경로를 변수로 만들면 번들러가 파일을 찾지 못한다.
 * 처음 로드 때 한 번 형식 검사 후 캐시한다.
 */
import type { ChunkType, PartOfSpeech } from '@prisma/client'
import { SEED_PACKS, type SeedPack } from '@/types/seedPack'
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
