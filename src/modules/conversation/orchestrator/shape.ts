/**
 * 턴 응답 후처리(순수) — LLM 응답(§67)을 저장·`done` 이벤트용으로 다듬는다.
 *
 * - CHAT·ASK: `correction` 은 항상 null(A2·A9 는 교정 금지 — api-contract #32).
 * - TALK: `correction.original` 이 **서버가 가진 이번 사용자 `text` 와 바이트 일치**할 때만 남긴다. 어긋나면 버리고
 *   `CORRECTION_ORIGINAL_MISMATCH` 경고(#32). `corrected === original` 은 오류 없음으로 보고 조용히 버린다.
 *   저장하는 `original` 은 모델 문자열이 아니라 서버 `text` 다(Leader 계획 — 모델 값을 그대로 쓰지 않는다).
 * - proposals: ADD_WORD 만, 같은 표현 중복 제거, 최대 2개.
 */
import type { TutorCorrection, TutorProposalDraft, TutorResponse } from '../structuredResponse/schemas'

export interface ShapedTurn {
  reply: TutorResponse['conversation']
  correction: (Omit<TutorCorrection, 'original'> & { original: string }) | null
  warning: 'CORRECTION_ORIGINAL_MISMATCH' | null
  proposals: TutorProposalDraft[]
  learning: TutorResponse['learning']
  speech: TutorResponse['speech']
  endOfTopic: boolean
}

export function shapeTurnResponse(kind: 'TALK' | 'CHAT' | 'ASK', text: string, data: TutorResponse): ShapedTurn {
  let correction: ShapedTurn['correction'] = null
  let warning: ShapedTurn['warning'] = null
  const c = data.correction
  if (kind === 'TALK' && c) {
    if (c.original !== text) warning = 'CORRECTION_ORIGINAL_MISMATCH'
    else if (c.corrected !== c.original) correction = { ...c, original: text }
  }
  const seen = new Set<string>()
  const proposals: TutorProposalDraft[] = []
  for (const p of data.proposals ?? []) {
    if (p.kind !== 'ADD_WORD' || !p.payload?.surface || seen.has(p.payload.surface)) continue
    seen.add(p.payload.surface)
    proposals.push(p)
    if (proposals.length === 2) break
  }
  return { reply: data.conversation, correction, warning, proposals, learning: data.learning, speech: data.speech, endOfTopic: data.endOfTopic === true }
}

/** SSE `error` 이벤트 문구 — 코드별 고정 문구(엔진·모델 이름이 섞일 수 없게 오류 원문을 쓰지 않는다). */
export function turnErrorMessage(code: string): string {
  switch (code) {
    case 'ENGINE_TIMEOUT':
      return '답이 늦어져 멈췄어요. 다시 받아 보세요.'
    case 'ENGINE_UNAVAILABLE':
      return '지금은 선생님이 답할 수 없어요. 잠시 후 다시 시도해 주세요.'
    case 'ENGINE_ERROR':
      return '답을 만들지 못했어요. 다시 받아 보세요.'
    case 'CONFLICT':
      return '대화가 바뀌어 답을 저장하지 못했어요.'
    default:
      return '답을 처리하지 못했어요. 다시 받아 보세요.'
  }
}

export function isRetryableTurnError(code: string): boolean {
  return code !== 'VALIDATION' && code !== 'NOT_FOUND' && code !== 'FEATURE_NOT_READY'
}
