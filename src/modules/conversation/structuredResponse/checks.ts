/**
 * 스키마로 표현하지 못하는 후검증 — 위반 문구 배열을 돌려주면 engine.llm.completeJson 이 1회 재시도한다.
 *
 * 원문 무수정(검증 세트 V1 — 실패는 CRITICAL, 정본 design-spec §8 "`correction.original` 바이트 일치"):
 *  - TALK·CHAT: `original` 은 이번 학습자 말과 **바이트 단위로 같아야** 한다(부분 인용 없음).
 *  - REVIEW: 여러 문장짜리 메시지에서 틀린 문장 하나를 짚을 수 있어야 하므로 **메시지 전체 또는 문장 하나 전체**
 *    (。！？!? · 줄바꿈 경계)와 같아야 한다. 문장 안의 임의 조각(예: 2글자)은 인정하지 않는다
 *    — 조각 인용을 허용하면 일본어에서는 거의 모든 두 글자가 원문에 있어 검사가 무력해진다(reviewer REV-004 Critical).
 *  - 앞뒤 공백을 걷어 내고 비교하지 않는다 — 모델이 고친 흔적을 숨기지 않기 위해서다.
 * 저장 시에는 라우트가 모델 값이 아니라 **서버가 가진 원문**을 `Correction.original` 에 넣는다(task-006) — 이 검사는 계약 위반 탐지용이다.
 */
import type { ChatReviewResponse, TutorResponse, WordEnrichResponse } from './schemas'

/** TALK·CHAT: 바이트 일치만. */
export function isExactOriginal(input: string, original: string): boolean {
  return original === input
}

/** 문장 경계(。！？!? 뒤·줄바꿈)로 나눈 문장들. 각 문장의 앞뒤 공백만 걷는다(문장 사이 공백 처리용). */
export function splitJaSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？!?])|\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** REVIEW: 메시지 전체 또는 문장 하나 전체와 바이트 일치. */
export function isVerbatimQuote(input: string, original: string): boolean {
  if (original === input) return true
  return splitJaSentences(input).includes(original)
}

/** 일본어 문장 수 — 。！？!? 로 끝나는 덩어리를 센다(끝 부호가 없는 마지막 덩어리도 1문장). */
export function countJaSentences(text: string): number {
  const parts = text.split(/(?<=[。！？!?])/).map((s) => s.trim()).filter(Boolean)
  return parts.length
}

/**
 * replyJa 문장 수: 프롬프트 목표는 2문장이지만 **재시도는 3문장 초과에서만** 건다. 실측(2026-09-27)에서 haiku 가 짧은 3문장을
 * 종종 써서 재시도가 붙으면 턴이 ~10s 로 늘었다(12s fail-fast 위협). 3문장은 TTS·화면에 무리가 없어 계약 위반으로 보지 않는다.
 */
export const REPLY_SENTENCE_HARD_CAP = 3

export function checkTalkResponse(input: string, data: TutorResponse, opts: { maxSentences?: number } = {}): string[] {
  const v: string[] = []
  const max = opts.maxSentences ?? REPLY_SENTENCE_HARD_CAP
  if (countJaSentences(data.conversation.replyJa) > max) v.push(`conversation.replyJa 는 ${max}문장 이내여야 한다`)
  const c = data.correction
  if (c) {
    if (!isExactOriginal(input, c.original)) {
      v.push('correction.original 은 [입력]의 학습자 말 전체를 한 글자도 바꾸지 않고 그대로 복사해야 한다(일부만 인용하거나 공백·문장부호를 바꾸지 않는다)')
    }
    if (c.corrected === c.original) v.push('correction.corrected 가 original 과 같다 — 오류가 없으면 correction 을 null 로 둔다')
  }
  return v
}

export function checkChatResponse(input: string, data: TutorResponse): string[] {
  const v = checkTalkResponse(input, { ...data, correction: null })
  if (data.correction !== null) v.push('CHAT 모드에서 correction 은 항상 null 이다')
  return v
}

export function checkChatReview(messages: { id: string; text: string }[], data: ChatReviewResponse): string[] {
  const v: string[] = []
  const byId = new Map(messages.map((m) => [m.id, m.text]))
  data.items.forEach((it, i) => {
    const text = byId.get(it.message_id)
    if (text === undefined) {
      v.push(`items[${i}].message_id '${it.message_id}' 는 입력에 없는 id 다 — 받은 id 를 그대로 써야 한다`)
      return
    }
    if (!isVerbatimQuote(text, it.original)) v.push(`items[${i}].original 은 해당 메시지 전체 또는 그 안의 문장 하나 전체를 한 글자도 바꾸지 않고 인용해야 한다`)
    if (it.corrected === it.original) v.push(`items[${i}].corrected 가 original 과 같다`)
  })
  return v
}

/**
 * A10 단어 보강(V9 계열) — 스키마가 표현 못 하는 두 가지만 본다: ① `valid` 와 나머지 필드의 일관성
 * ② `example` 이 `surface` 를 표기 그대로(한자·가나 변경 없이) 포함하는지.
 *
 * **활용형 예외를 둔다(2026-09-27 실측 결정, 최초에는 "예외 없음"으로 갔다가 뒤집음)**: 처음에는 `surface` 가
 * 사전형이든 활용형(예: 「行きました」)이든 리터럴 부분 일치만 보면 된다고 판단했다. 그런데 haiku 로 12건 실측 중
 * VERB `かける`(다의어 픽스처, w08)가 **재시도 1회 후에도 계속 드롭됐다**(위반율 1/12 ≈ 8% > 목표 5%). 원인은
 * 표기 이탈이 아니라 — 프롬프트로 "표기 그대로" 를 아무리 강조해도 모델이 자연스러움을 위해 예문을 활용형으로
 * 쓰기 때문이었다(`かける` 사전형 대신 `かけました`/`かけて` 등, `raw` 확인: 재시도 두 후보 모두 활용형).
 * VERB(食べる) 도 최초 실측에서 1회 재시도가 필요했던 항목이었다(정본형 대신 활용 시도가 먼저 나옴) — 이 카테고리
 * 전체가 구조적으로 걸린다는 뜻이다. 그래서 VERB·ADJ_I 는 **어간(표기에서 마지막 1글자를 뺀 나머지)**이
 * 리터럴로 들어 있으면 통과시킨다 — 일본어 활용은 어간을 보존하고 어미만 바꾸므로(1군 동사·い형용사는 항상,
 * カ변格·サ변格 같은 불규칙 동사·「いい」 같은 예외는 못 잡지만 드물다) 값싸고 결정적인 근사다. 그 밖의 품사
 * (NOUN·ADJ_NA·ADVERB·PARTICLE·EXPRESSION·OTHER)는 활용이 없으니 여전히 리터럴 전체 일치만 인정한다 —
 * 여기서 어간 근사를 쓰면 한자→가나 이탈(예: 「掛ける」로 바꿔치기) 같은 진짜 계약 위반을 놓친다.
 *
 * `reading` 이 히라가나·장음 부호(ー) 밖의 문자(가타카나·한자·로마자·공백)를 쓰면 위반 — 가타카나 외래어
 * (コーヒー 등)에서 모델이 원표기를 그대로 reading 에 넣는 이탈이 관찰돼 추가했다(정규화 함정, 재발 가능).
 * `invalidReason` 유무만 보고 그 밖의 필드(예: valid=false 인데 partOfSpeech 가 채워짐)는 **묻지 않는다** —
 * 그 값은 라우트가 버리므로 검사 비용 대비 재시도만 늘어난다(과도한 검사로 재시도가 잦아지지 않게).
 */
const WORD_ENRICH_READING_RE = /^[ぁ-ゖー]+$/
const WORD_ENRICH_CONJUGATABLE_POS = new Set<WordEnrichResponse['partOfSpeech']>(['VERB', 'ADJ_I'])

/** VERB·ADJ_I 는 어간(마지막 1글자를 뺀 나머지)까지만, 그 밖은 표기 전체가 리터럴로 들어 있어야 한다. */
function exampleCoversSurface(surface: string, example: string, partOfSpeech: WordEnrichResponse['partOfSpeech']): boolean {
  if (example.includes(surface)) return true
  if (partOfSpeech && WORD_ENRICH_CONJUGATABLE_POS.has(partOfSpeech) && surface.length >= 2) {
    return example.includes(surface.slice(0, -1))
  }
  return false
}

export function checkWordEnrich(surface: string, data: WordEnrichResponse): string[] {
  const v: string[] = []
  if (data.valid) {
    if (data.invalidReason !== null) v.push('valid=true 이면 invalidReason 은 null 이어야 한다')
    if (!data.reading) v.push('valid=true 이면 reading 이 있어야 한다')
    else if (!WORD_ENRICH_READING_RE.test(data.reading)) v.push('reading 은 히라가나와 장음 부호(ー)만 사용해야 한다 — 가타카나·한자·로마자·공백을 쓰지 않는다')
    if (!data.meaning) v.push('valid=true 이면 meaning 이 있어야 한다')
    if (!data.partOfSpeech) v.push('valid=true 이면 partOfSpeech 가 있어야 한다')
    if (!data.example) v.push('valid=true 이면 example 이 있어야 한다')
    else if (!exampleCoversSurface(surface, data.example, data.partOfSpeech)) {
      v.push(
        data.partOfSpeech && WORD_ENRICH_CONJUGATABLE_POS.has(data.partOfSpeech)
          ? 'example 은 [단어]를 그대로 또는 그 어간을 살린 활용형으로 포함해야 한다(한자·가나 표기 자체는 바꾸지 않는다)'
          : 'example 은 [단어]를 표기 그대로(한자·가나를 바꾸지 않고) 포함해야 한다',
      )
    }
    if (!data.exampleKo) v.push('valid=true 이면 exampleKo 가 있어야 한다')
  } else if (!data.invalidReason) {
    v.push('valid=false 이면 invalidReason 에 한국어로 이유를 적어야 한다')
  }
  return v
}
