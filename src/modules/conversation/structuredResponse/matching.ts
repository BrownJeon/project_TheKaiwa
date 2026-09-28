/**
 * A4 레슨 — application·speaking 의 모범 답(modelAnswerJa)이 자기 목표 chunk 표현을 실제로 담고 있는지 보는
 * 정규화·매칭(2026-09-28 Leader 3차 결정 — task-010 UI E2E 스모크에서 speaking[0].targetIds 를 모범 답이 어느
 * 쪽도 담지 않아 화면에 "아직 안 쓴 표현"이 뜨는 사례 1건 관측).
 *
 * 정규화(NFKC → 가타카나→히라가나 → 소문자 → 공백·구두점 제거)는 서버 `learning/lessons/matching.ts` 의
 * `normalizeForMatch`/`kataToHira` 와 **문자 단위로 동일한 정규식**을 쓴다(옆에 그대로 복사) — 그러나 그 파일을
 * import 하지 **않는다**(module-dependency §3-1, conversation(L2) 은 learning(L3) 을 import 하지 않는다 — 6층
 * 경계, eslint `no-restricted-imports` 로도 막혀 있다). 동치성은 `__tests__/lessonMatching.test.ts` 의 골든
 * 케이스로 고정한다 — 서버 쪽 `matching.ts` 가 이 두 정규식을 바꾸면 그 파일도 같이 바꿔야 한다(재발 가능한 함정,
 * task 이력서에도 기록).
 *
 * 학습자의 자유 발화(서버 쪽이 보는 대상)와 달리 여기서 보는 건 **모델이 스스로 만든 모범 답**(정돈된 문장)이다 —
 * Leader 지시 범위가 "공백·구두점 제거·가타카나→히라가나"까지라, 서버의 `chunkForms`/`cores` 가 하는 활용형
 * 어간 근사·정중형 어미 제거는 재현하지 않는다. textJa 또는 reading 이 정규화한 모범 답에 부분 문자열로 있는지만
 * 본다(그 이상의 정교한 매칭이 필요해지면 Leader 재논의).
 */
export function kataToHira(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
}

const STRIP = /[\s　、。，．,.!！?？・「」『』（）()【】〔〕［］[\]〈〉《》…‥~〜～"'“”‘’:：;；-]/g

export function normalizeForLessonMatch(s: string): string {
  return kataToHira(s.normalize('NFKC')).toLowerCase().replace(STRIP, '')
}

/** 목표 chunk 의 textJa 또는 reading 중 하나라도 modelAnswerJa(정규화)에 부분 문자열로 있으면 true. */
export function chunkAppearsIn(modelAnswerJa: string, chunk: { textJa: string; reading: string }): boolean {
  const hay = normalizeForLessonMatch(modelAnswerJa)
  if (!hay) return false
  return hay.includes(normalizeForLessonMatch(chunk.textJa)) || hay.includes(normalizeForLessonMatch(chunk.reading))
}
