/**
 * 라우트 조합 헬퍼(task-012b-2 D-2, REV-132 M-2·L-2) — #66 `items[].voiced` 를 평가 문항(learning DTO)과 발화 대조(speech)로 만든다.
 * learning 은 speech 를 import 하지 않으므로 라우트가 잇는다. 판정은 순수 함수로 두고 발화 대조만 주입받아(`lookup`) 단위 테스트가 그대로 부른다.
 *
 *  - 음성 출처(`REALTIME_STT`·`SERVER_STT`) 답 → true.
 *  - 글자(`TEXT`) 답 → 말로 답할 수 있는 문항이면 붙은 녹음과 대조한다. 학습자가 #21a 로 직접 고친 글이 채점에 쓰이면 답은 TEXT 로 남아
 *    글자로 쓴 답과 같아 보이기 때문(D-B7) — 결과 화면의 "말로 답함 · 내가 고친 말로 채점했어요" 가 이 값에 기댄다.
 *  - 대조가 실패해도 #66 은 실패하지 않는다: 표시용 부가 정보라 `voiced` 칸을 통째로 빼고(옛 응답과 같은 모양 — 화면은 글자로 답함으로 본다)
 *    경고 한 줄만 남긴다(오류 이름만 — 답 글·사용자·문항 id 는 남기지 않는다).
 */

/**
 * 말로 답할 수 있는 문항 — 녹음이 붙을 수 있는 종류만 대조한다(고르기·읽기 입력·조립은 녹음이 붙지 않는다).
 * learning 의 `SUBJECTIVE_ITEM_KINDS`(음성 답 검증·채점 기준, index 로 공개되지 않음)와 같은 값이어야 한다 — 이 `_lib` 를 import 0 의
 * 순수 모듈로 두려고 따로 적고, 시험이 두 집합이 같음을 단언한다(한쪽만 바뀌면 실패, REV-135 L-A).
 */
export const VOICE_ANSWER_KINDS: ReadonlySet<string> = new Set(['LISTEN_RESPOND', 'SITUATION_RESPOND', 'CORRECTION_SPOT'])

export interface VoicedItemInput {
  id: string
  kind: string
  inputSource: string | null
  answerText: string | null
}

export interface VoicedLookupInput {
  evaluationItemId: string
  answerText: string
}

/** speech `voicedEvaluationItems` 모양 — 사용자 범위에서 답과 붙은 녹음의 글이 같은 문항 id 집합. */
export type VoicedLookup = (userId: string, items: VoicedLookupInput[]) => Promise<ReadonlySet<string>>

export function isVoiceInput(inputSource: string | null): boolean {
  return inputSource === 'REALTIME_STT' || inputSource === 'SERVER_STT'
}

/** 녹음과 대조할 답 — 말로 답할 수 있는 문항의 글자 답만(빈 답 제외). */
export function voicedLookupInputs(items: readonly VoicedItemInput[]): VoicedLookupInput[] {
  return items.flatMap((it) =>
    it.inputSource === 'TEXT' && VOICE_ANSWER_KINDS.has(it.kind) && it.answerText ? [{ evaluationItemId: it.id, answerText: it.answerText }] : [],
  )
}

export function markVoiced<T extends VoicedItemInput>(items: readonly T[], matched: ReadonlySet<string>): (T & { voiced: boolean })[] {
  return items.map((it) => ({ ...it, voiced: isVoiceInput(it.inputSource) || matched.has(it.id) }))
}

export async function withVoiced<T extends VoicedItemInput>(
  userId: string,
  items: readonly T[],
  lookup: VoicedLookup,
  warn: (line: string) => void = (line) => console.warn(line),
): Promise<T[] | (T & { voiced: boolean })[]> {
  const inputs = voicedLookupInputs(items)
  let matched: ReadonlySet<string> = new Set()
  if (inputs.length > 0) {
    try {
      matched = await lookup(userId, inputs)
    } catch (e) {
      warn(`[evaluations] #66 voiced 대조 실패 — voiced 칸 없이 응답: ${e instanceof Error ? e.name : 'unknown'}`)
      return [...items]
    }
  }
  return markVoiced(items, matched)
}
