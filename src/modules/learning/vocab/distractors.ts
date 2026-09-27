/**
 * CHOICE 보기(E6) — 순수 함수. 보기 = 정답 뜻 + 오답 뜻 3개, 오답은 **사용자 단어의 뜻 문자열**에서 정답과 다른 것
 * (같은 품사 우선 → 모자라면 다른 품사). 보기 순서도 시드 난수로 섞는다(정답 위치 고정 금지 — 완료 기준 3).
 * 뜻 비교는 바이트 일치(`===`)다 — 화면에 보이는 문자열이 곧 채점 기준이라 서로 다른 보기는 서로 다른 문자열이어야 한다.
 */
import { shuffle, type Rng } from './setGenerator'

export interface MeaningSource {
  id: string
  meaning: string
  partOfSpeech: string
}

export const CHOICE_COUNT = 4

/** 서로 다른 뜻 문자열 수 — 4 미만이면 CHOICE 를 만들 수 없어 세트 전체를 FLIP 으로 강등한다(E6). */
export function distinctMeaningCount(sources: readonly MeaningSource[]): number {
  return new Set(sources.map((s) => s.meaning)).size
}

/** id 순으로 고정한 뒤 중복 뜻을 걷어 낸다(첫 등장만) — 난수 소비 순서를 DB 순서와 무관하게. */
function uniqueMeanings(sources: readonly MeaningSource[], exclude: ReadonlySet<string>): string[] {
  const seen = new Set<string>(exclude)
  const out: string[] = []
  for (const s of sources) {
    if (seen.has(s.meaning)) continue
    seen.add(s.meaning)
    out.push(s.meaning)
  }
  return out
}

/**
 * 한 카드의 보기 4개(셔플됨). 오답 후보가 3개보다 적으면 null(호출자가 FLIP 으로 강등) —
 * `distinctMeaningCount(sources) >= 4` 이고 정답 단어가 `sources` 안에 있으면 null 이 나오지 않는다.
 */
export function pickChoices(correct: { meaning: string; partOfSpeech: string }, sources: readonly MeaningSource[], rng: Rng): string[] | null {
  const sorted = sources.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const exclude = new Set([correct.meaning])
  const samePos = shuffle(uniqueMeanings(sorted.filter((s) => s.partOfSpeech === correct.partOfSpeech), exclude), rng)
  const picked = samePos.slice(0, CHOICE_COUNT - 1)
  if (picked.length < CHOICE_COUNT - 1) {
    const others = shuffle(uniqueMeanings(sorted, new Set([...exclude, ...picked])), rng)
    picked.push(...others.slice(0, CHOICE_COUNT - 1 - picked.length))
  }
  if (picked.length < CHOICE_COUNT - 1) return null
  return shuffle([correct.meaning, ...picked], rng)
}
