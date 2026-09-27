/**
 * 기본 단어 팩(#46b, task-008 E1) — 원본은 `prisma/seed-data/words-n5.json` **하나**(OWNER 시드 `prisma/seed.ts` 와 같은 파일).
 *
 * 정적 import 인 이유: 번들러(Next dev/build)가 JSON 을 서버 청크에 넣으므로 실행 위치(cwd·미러 디렉토리)와 무관하게
 * 같은 데이터를 읽는다. 런타임 `fs` 읽기는 cwd 가 `prisma/` 를 담고 있다는 가정이 필요해 택하지 않았다.
 *
 * 사용자의 직접 행위(CTA)라 제안·채택 규칙 대상이 아니다. 같은 표현(JS 바이트 일치)이 이미 있으면 건너뛴다.
 * 사용자 행을 잠가 동시 실행 두 번이 같은 단어를 두 번 넣지 않게 한다.
 */
import type { ChunkType, PartOfSpeech } from '@prisma/client'
import { ApiError, lockUserRow, withTransaction } from '@/modules/infra'
import wordsN5 from '../../../../prisma/seed-data/words-n5.json'
import { PARTS_OF_SPEECH, WORD_CHUNK_TYPES } from './words'

export const SEED_PACKS = ['N5'] as const
export type SeedPack = (typeof SEED_PACKS)[number]

export interface SeedWord {
  surface: string
  reading: string
  meaning: string
  partOfSpeech: PartOfSpeech
  chunkType: ChunkType | null
  example: string
  exampleKo: string
}

const PACK_META: Record<SeedPack, { category: string; jlpt: 'N5' }> = { N5: { category: 'N5 기초', jlpt: 'N5' } }

function asSeedWords(raw: unknown): SeedWord[] {
  if (!Array.isArray(raw)) throw new Error('시드 팩 형식 오류: 배열이 아님')
  return raw.map((w, i) => {
    const r = w as Record<string, unknown>
    const str = (k: string) => {
      if (typeof r[k] !== 'string' || !(r[k] as string).trim()) throw new Error(`시드 팩 형식 오류: [${i}].${k}`)
      return r[k] as string
    }
    const pos = str('partOfSpeech')
    if (!(PARTS_OF_SPEECH as readonly string[]).includes(pos)) throw new Error(`시드 팩 형식 오류: [${i}].partOfSpeech`)
    const chunk = r.chunkType == null ? null : String(r.chunkType)
    if (chunk !== null && !(WORD_CHUNK_TYPES as readonly string[]).includes(chunk)) throw new Error(`시드 팩 형식 오류: [${i}].chunkType`)
    return {
      surface: str('surface'), reading: str('reading'), meaning: str('meaning'), partOfSpeech: pos as PartOfSpeech,
      chunkType: chunk as ChunkType | null, example: str('example'), exampleKo: str('exampleKo'),
    }
  })
}

const PACKS: Record<SeedPack, SeedWord[]> = { N5: asSeedWords(wordsN5) }

export function seedPackWords(pack: SeedPack): readonly SeedWord[] {
  return PACKS[pack]
}

export function parseSeedPackBody(body: Record<string, unknown>): SeedPack {
  const extra = Object.keys(body).filter((k) => k !== 'pack')
  if (extra.length) throw new ApiError('VALIDATION', `넣을 수 없는 항목입니다: ${extra.join(', ')}`, { field: extra[0], reason: 'unknown_key' })
  if (typeof body.pack !== 'string' || !(SEED_PACKS as readonly string[]).includes(body.pack)) {
    throw new ApiError('VALIDATION', '지원하지 않는 단어 팩입니다.', { field: 'pack', reason: SEED_PACKS.join('|') })
  }
  return body.pack as SeedPack
}

/** #46b — `source=SEED, category, jlpt` 로 복사. 이미 있는 표현(바이트 일치)은 `skipped`. */
export async function addSeedPack(userId: string, pack: SeedPack): Promise<{ added: number; skipped: number }> {
  const words = PACKS[pack]
  const meta = PACK_META[pack]
  return withTransaction(async (tx) => {
    await lockUserRow(tx, userId)
    // DB 콜레이션은 히라가나/가타카나·탁음을 같게 보므로 후보만 좁히고 최종 판정은 JS `===`.
    const candidates = await tx.wordEntry.findMany({ where: { userId, surface: { in: words.map((w) => w.surface) } }, select: { surface: true } })
    const have = new Set(candidates.map((c) => c.surface))
    const fresh = words.filter((w) => !have.has(w.surface))
    if (fresh.length) {
      await tx.wordEntry.createMany({
        data: fresh.map((w) => ({
          userId, surface: w.surface, reading: w.reading, meaning: w.meaning, partOfSpeech: w.partOfSpeech, chunkType: w.chunkType,
          jlpt: meta.jlpt, example: w.example, exampleKo: w.exampleKo, category: meta.category, source: 'SEED' as const,
        })),
      })
    }
    return { added: fresh.length, skipped: words.length - fresh.length }
  })
}
