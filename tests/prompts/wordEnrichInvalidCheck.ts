/**
 * task-073 W-3 — 뜻 채우기(`wordEnrich`)가 valid=false 일 때 내려주는 `invalidReason` 의 **말투 점검기**.
 * 라이브 하네스(`word-enrich-invalid-live.ts`)와 단위 시험(`wordEnrichInvalid.test.ts`)이 같은 규칙을 쓴다.
 *
 * 무엇을 막나: 선생님 설명 칸에 **틀릴 수 있는 추측을 단정으로** 내보내는 것
 *   (실제 사례 2026-10-15: 입력 `インペクト`(올바른 건 インパクト — 음성 오인식) → 「일본어 단어가 아닙니다. 영어 단어 'inspect'의 오타로 보입니다.」).
 * 이 점검기는 의미를 이해하지 못한다 — 정규식으로 **표면 표현**만 잡는다. 후보를 말했는지·그 후보가 맞는지는 사람이 표에서 본다.
 */

export interface AssertiveRule {
  id: 'negation' | 'typo' | 'wrong' | 'nonexistent' | 'formal-end'
  re: RegExp
  desc: string
}

/** 단정 표현 — 하나라도 걸리면 위반(hard). */
export const ASSERTIVE_RULES: readonly AssertiveRule[] = [
  { id: 'negation', re: /아닙니다|아니에요|아니예요|아니네요|아니다|아님/, desc: '「~가 아닙니다/아니에요」 류 부정 단정' },
  { id: 'typo', re: /오타/, desc: '「오타」 지목 — 오타라는 추측을 단정/암시' },
  { id: 'wrong', re: /틀렸|틀린|잘못(?:된|됐|입|이에요|이예요|쓴)/, desc: '「틀렸어요/잘못된」 류 판정 단정' },
  { id: 'nonexistent', re: /존재하지 않|없는 (?:단어|말|표현)|없는 일본어/, desc: '「존재하지 않는/없는 단어」 류 단정' },
  // 문장 끝이 합쇼체 평서문(…입니다·…습니다·…합니다·…보입니다). 질문 「~걸까요?」·부드러운 「~어요/~예요」는 해당 없음.
  { id: 'formal-end', re: /니다[.!。]?\s*$/, desc: '문장 끝이 합쇼체 평서(단정형 「~입니다/~습니다」)' },
]

export interface ReasonReport {
  /** 걸린 단정 규칙 id (없으면 빈 배열 = 통과) */
  assertive: string[]
  /** 문장 수(마침표·물음표·느낌표·「。」 기준) */
  sentences: number
  hasHangul: boolean
  /** 「혹시 … ?」 후보 질문이 몇 번 나왔나 */
  candidateQuestions: number
  /** 이유에 들어 있는 로마자 단어 중 입력 표기에 없는 것(원어를 짐작해 적었을 가능성 — 사람이 확인) */
  latinGuess: string[]
  length: number
}

export function sentenceCount(text: string): number {
  return text
    .split(/[.!?。！？]+(?:\s+|$)/)
    .map((s) => s.trim())
    .filter(Boolean).length
}

export function analyzeReason(surface: string, reason: string | null | undefined): ReasonReport {
  const text = (reason ?? '').trim()
  const assertive = ASSERTIVE_RULES.filter((r) => r.re.test(text)).map((r) => r.id)
  const surfaceLower = surface.toLowerCase()
  const latin = (text.match(/[A-Za-z]{3,}/g) ?? []).map((w) => w.toLowerCase()).filter((w) => !surfaceLower.includes(w))
  return {
    assertive,
    sentences: sentenceCount(text),
    hasHangul: /[가-힣]/.test(text),
    candidateQuestions: (text.match(/혹시/g) ?? []).length,
    latinGuess: [...new Set(latin)],
    length: text.length,
  }
}

/** 이 이유가 W-3 규칙을 지켰나(hard 항목만): 단정 0 · 한국어 · 비어 있지 않음 · 한 문장 · 후보 질문 ≤ 1. */
export function reasonProblems(surface: string, reason: string | null | undefined): string[] {
  const r = analyzeReason(surface, reason)
  const out: string[] = []
  if (!reason?.trim()) out.push('이유가 비어 있다')
  if (r.assertive.length) out.push(`단정 표현(${r.assertive.join(',')})`)
  if (!r.hasHangul) out.push('한국어가 아니다')
  if (r.sentences > 1) out.push(`${r.sentences}문장`)
  if (r.candidateQuestions > 1) out.push('후보 질문이 2번 이상')
  return out
}
