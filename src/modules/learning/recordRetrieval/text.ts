/**
 * 항목 글 만들기 — 모든 글은 **허용 칸 값만** 받아 여기서 한 줄로 정리한다(제어문자·줄바꿈 제거, 공백 접기).
 * 줄바꿈을 없애 두면 저장된 글이 프롬프트의 항목 경계를 흉내 낼 수 없다(경계 표지 이스케이프는 프롬프트 빌더 몫 — 계약 9항 ①).
 *
 * 300자 규칙: 항목 글은 **앞에서부터 중요한 조각 순**으로 잇고, 넘치면 마지막 조각을 글자 경계에서 자르고 `…` 를 붙인다
 * (`truncateCodePoints`). 그래서 잘려도 머리(종류·날짜·핵심 표현)는 남고 꼬리(설명·부가 수치)가 줄어든다.
 */
import { codePointLength, sanitizeText, truncateCodePoints } from '@/modules/infra'
import { RECORD_RETRIEVAL_LIMITS } from './types'

/** 한 줄 정리 — 제어문자·줄바꿈 제거, 연속 공백 1칸. */
export function oneLine(value: unknown): string {
  if (typeof value !== 'string') return ''
  return sanitizeText(value, { multiline: true }).replace(/\s+/g, ' ').trim()
}

/** 한 줄 정리 + `max` 코드포인트(넘치면 `…`). */
export function clip(value: unknown, max: number): string {
  return truncateCodePoints(oneLine(value), max)
}

export interface Clipped {
  text: string
  cut: boolean
}

/** 조각을 ` · ` 로 잇는다(빈 조각 제외). 전체가 `max` 를 넘으면 잘라 `cut=true`. */
export function joinParts(parts: readonly (string | null | undefined | false)[], max: number = RECORD_RETRIEVAL_LIMITS.itemChars): Clipped {
  const joined = oneLine(parts.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).join(' · '))
  if (codePointLength(joined) <= max) return { text: joined, cut: false }
  return { text: truncateCodePoints(joined, max), cut: true }
}

/** 라벨(≤60자). */
export function labelOf(value: unknown): string {
  return clip(value, RECORD_RETRIEVAL_LIMITS.labelChars)
}

/** 비교용 정규화 — NFKC(전각 영숫자 → 반각, 반각 가타카나 → 전각) + 소문자 + 공백 접기. */
export function foldForMatch(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * 검색어 정규화 — 외부에서 온 값(질문에서 뽑은 말)을 함수 인자로 쓰기 전 마지막 관문.
 * 문자열만, NFKC·한 줄·앞뒤 물결(〜·~)·따옴표 제거, 1~20자, 중복 제거, 최대 3개. `%`·`_` 만 있는 말은 버린다(LIKE 전 행 일치 방지는 escapeLike 가 별도로 한다).
 */
export function normalizeTerms(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const t of raw) {
    if (out.length >= RECORD_RETRIEVAL_LIMITS.terms) break
    if (typeof t !== 'string') continue
    let s = oneLine(t.normalize('NFKC'))
    s = s.replace(/^[〜~～'"“”‘’「」『』\s]+|[〜~～'"“”‘’「」『』\s]+$/g, '')
    if (!s || /^[%_\s]+$/.test(s)) continue
    s = Array.from(s).slice(0, RECORD_RETRIEVAL_LIMITS.termChars).join('')
    const key = foldForMatch(s)
    if (out.some((o) => foldForMatch(o) === key)) continue
    out.push(s)
  }
  return out
}

/** 글 안에 검색어 하나라도 있는지(NFKC·소문자 비교). 검색어가 없으면 참. */
export function matchesAnyTerm(fields: readonly (string | null | undefined)[], terms: readonly string[]): boolean {
  if (!terms.length) return true
  const hay = foldForMatch(fields.filter((f): f is string => typeof f === 'string').join(' '))
  return terms.some((t) => hay.includes(foldForMatch(t)))
}

const TYPE_KO: Record<string, string> = {
  GRAMMAR: '문법',
  PARTICLE: '조사',
  CONJUGATION: '활용',
  VOCABULARY: '어휘',
  POLITENESS: '존댓말',
  NATURALNESS: '자연스러움',
  WORD_ORDER: '어순',
  OTHER: '기타',
}

/** 교정 유형 한국어 이름(PRONUNCIATION 은 교정에 쓰지 않는다 — schema 주석). */
export function errorTypeKo(type: string): string {
  return TYPE_KO[type] ?? '기타'
}
