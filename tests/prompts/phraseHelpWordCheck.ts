/**
 * task-072 PE(L4) — 단어 추가 시트 일본어 도우미: 후보 1순위의 모양을 가르는 순수 점검기(DB·LLM 없음).
 * 사람이 응답 원문을 읽고 하는 판정의 보조다(자동 분류는 휴리스틱 — 표의 최종 숫자는 사람이 읽고 맞춘 값을 쓴다).
 * 시험(`src/modules/conversation/__tests__/phraseHelpWord.test.ts`)과 라이브 하네스(`phrase-help-word-live.ts`)가 같이 쓴다.
 */

/** headword = 사전형 표제어(낱말 하나, 필요하면 する), collocation = 조사로 이은 연어·구, inflected = 말투·시제가 붙은 활용형, sentence = 끝맺음 부호 또는 정중체 문장. */
export type HeadShape = 'headword' | 'collocation' | 'inflected' | 'sentence'

const SENT_PUNCT = /[。！？!?]/
/** 정중체·종결형 꼬리 — 사전형이 아니다. */
/** (な형용사·명사 서술형 〜だ 는 단어장에 들어갈 수 있어 문장으로 세지 않는다 — 残念だ.) */
const POLITE_TAIL = /(ます|ません|ました|ませんでした|ましょう|です|でした|でしょう|ですか|ますか|ください|だった|である)$/
/** 활용·상태 꼬리(ている·ていた·ていない 등) — 낱말 하나의 사전형이 아니다. */
const INFLECTED_TAIL = /(ている|ていた|ていない|ていました|ております|てしまう|てしまった)$/
/** 조사(を·が·は·も)로 이은 구 — 단어장 표제어가 아니다(눈치→空気を読む 같은 관용구는 사람이 따로 본다). */
const PARTICLE = /[をがはも]/

export function classifyHead(ja: string): HeadShape {
  const t = ja.trim()
  if (SENT_PUNCT.test(t) || POLITE_TAIL.test(t)) return 'sentence'
  if (INFLECTED_TAIL.test(t)) return 'inflected'
  if (PARTICLE.test(t)) return 'collocation'
  return 'headword'
}

/** 외래어 질의는 가타카나로 써야 한다(공백·장음 허용). */
export function isKatakanaWord(ja: string): boolean {
  return /^[ァ-ヺー・\s]+$/u.test(ja.trim()) && /[ァ-ヺ]/u.test(ja)
}

/** 동사 사전형(う단 또는 する)·い형용사(い)로 끝나는가 — 활용형 의심만 가른다(명사·な형용사 어간은 어느 쪽이든 true). */
export function looksDictionaryForm(ja: string, kind: 'loan' | 'noun' | 'iadj' | 'verb' | 'kango'): boolean {
  const t = ja.trim()
  if (kind === 'verb') return /(う|く|ぐ|す|つ|ぬ|ぶ|む|る)$/u.test(t) && !/(ます|ません|ている|ていた|た|て)$/u.test(t)
  if (kind === 'iadj') return /い$/u.test(t)
  return true
}

/** 말투 꼬리표(`labelKo`)·이유(`whyKo`) 중 단어 모드에서 없어야 하는 칸을 가르는 도우미. */
export function hasStyleColumns(item: { labelKo?: string; whyKo?: string }): boolean {
  return item.labelKo !== undefined || item.whyKo !== undefined
}

/**
 * 정형 인사 질의(감사합니다·죄송합니다 …)의 서버 결과 분류 — 단어 모드에서 ます/です 꼬리 표현은 표제어가 아니라 모든 항목이 버려진다(`NOT_A_WORD`).
 * 합격 = 200 빈 목록(EMPTY_200) 또는 200 표제어(HEADWORD_200: ありがとう·こんにちは 처럼 사전형이 나온 경우). 불합격 = 오류 응답(502/504 …)이거나 문장형 ja 가 나간 경우.
 */
export type FormulaOutcome = 'EMPTY_200' | 'HEADWORD_200' | 'SENTENCE_200' | 'ERROR'
export function classifyFormulaOutcome(r: { http: number; items: Array<{ ja: string }> }): FormulaOutcome {
  if (r.http !== 200) return 'ERROR'
  if (r.items.length === 0) return 'EMPTY_200'
  return r.items.some((i) => classifyHead(i.ja) === 'sentence') ? 'SENTENCE_200' : 'HEADWORD_200'
}
export const formulaPasses = (o: FormulaOutcome): boolean => o === 'EMPTY_200' || o === 'HEADWORD_200'
