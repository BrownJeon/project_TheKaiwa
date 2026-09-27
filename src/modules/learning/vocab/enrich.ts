/**
 * A10 단어 보강 실행(task-008 E8·F8, api-contract #41) — **저장하지 않는다**(draft 만 돌려주고 사용자가 확인한 뒤 다시 POST).
 *
 * 요청 객체(프롬프트·스키마·후검증)는 L2 `conversation.buildWordEnrichRequest` 가 만들고 **라우트가 값으로 넘긴다**
 * (module-dependency §4-4 — L3 는 L2 를 import 하지 않는다). 그래서 응답 타입도 conversation 의 `WordEnrichResponse` 를
 * import 하지 않고 같은 필드를 가진 로컬 구조 타입(`WordEnrichOutput`)으로 받는다.
 *
 * 캐시: 프로세스 메모리, 키 = (표현, 학습자 수준). 같은 표현을 다시 채우면 LLM 을 부르지 않는다. 상한을 넘으면 오래된 것부터 버린다.
 * 실패(타임아웃·계약 위반)는 캐시하지 않는다. blue/green 전환·재시작 시 비워져도 무해하다.
 */
import type { JlptLevel, PartOfSpeech } from '@prisma/client'
import { llm, type LlmJsonRequest } from '@/modules/engine'

export interface WordEnrichOutput {
  valid: boolean
  invalidReason: string | null
  reading: string | null
  meaning: string | null
  partOfSpeech: PartOfSpeech | null
  jlpt: JlptLevel | null
  example: string | null
  exampleKo: string | null
}

export interface WordDraft extends WordEnrichOutput {
  surface: string
}

const CACHE_MAX = 500
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, { at: number; draft: WordDraft }>()

function keyOf(surface: string, level: string | null): string {
  return JSON.stringify([surface, level ?? ''])
}

/** valid=false 면 사전 필드를 비운다(F8 — 화면은 `valid`·`invalidReason` 만 본다). */
export function toDraft(surface: string, out: WordEnrichOutput): WordDraft {
  if (!out.valid) {
    return { surface, valid: false, invalidReason: out.invalidReason ?? '일본어 표현으로 보기 어려워요.', reading: null, meaning: null, partOfSpeech: null, jlpt: null, example: null, exampleKo: null }
  }
  return {
    surface,
    valid: true,
    invalidReason: null,
    reading: out.reading,
    meaning: out.meaning,
    partOfSpeech: out.partOfSpeech,
    jlpt: out.jlpt,
    example: out.example,
    exampleKo: out.exampleKo,
  }
}

/** 메모리 캐시 조회(없거나 만료면 null). 테스트·라우트 모두 이 함수만 쓴다. */
export function cachedDraft(surface: string, level: string | null, now = Date.now()): WordDraft | null {
  const k = keyOf(surface, level)
  const hit = cache.get(k)
  if (!hit) return null
  if (now - hit.at > CACHE_TTL_MS) {
    cache.delete(k)
    return null
  }
  // 최근 사용 순서 유지(Map 삽입 순서 = LRU 근사).
  cache.delete(k)
  cache.set(k, hit)
  return hit.draft
}

export function rememberDraft(surface: string, level: string | null, draft: WordDraft, now = Date.now()): void {
  const k = keyOf(surface, level)
  cache.delete(k)
  cache.set(k, { at: now, draft })
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

export function enrichCacheSize(): number {
  return cache.size
}

/**
 * 보강 draft. `request` 는 라우트가 `buildWordEnrichRequest({surface, level})` 로 만든 값이며 `surface`·`level` 은 캐시 키로만 쓴다.
 * 엔진 오류(타임아웃·엔진 없음·계약 위반)는 그대로 던진다 — 라우트의 `withApi` 가 이름으로 504/422/502 에 매핑한다(엔진명 비노출).
 */
export async function enrichWord(input: { surface: string; level: string | null }, request: LlmJsonRequest<WordEnrichOutput>): Promise<{ draft: WordDraft; cached: boolean }> {
  const hit = cachedDraft(input.surface, input.level)
  if (hit) return { draft: hit, cached: true }
  const res = await llm.completeJson<WordEnrichOutput>(request)
  const draft = toDraft(input.surface, res.data)
  rememberDraft(input.surface, input.level, draft)
  return { draft, cached: false }
}
