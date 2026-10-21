/**
 * task-081 시험 공용 도우미 — 합성 대화 줄에 «규칙을 지키는 조각»을 붙인다(레슨·복습·상황 시험의 `validLessonResponse` 가 함께 쓴다).
 * 시험 데이터일 뿐 조각 분해의 정답이 아니다(문장부호 앞뒤로 NAME 한 덩어리) — 분해 품질은 `tests/prompts/lesson-pieces-live.ts` 눈가림 표가 본다.
 */
import type { LessonDialogueLine, LessonPieceOut } from '../structuredResponse/schemas'

/** 줄 ja → 「문장부호 아닌 글 한 덩어리(NAME) + 문장부호(null)」 반복. 이으면 원문과 정확히 같다. */
export function piecesFor(ja: string): LessonPieceOut[] {
  const out: LessonPieceOut[] = []
  for (const m of ja.matchAll(/([^。、？！]+)|([。、？！]+)/g)) {
    if (m[1]) out.push({ ja: m[1], type: 'NAME', ko: '뜻', slash: false })
    else out.push({ ja: m[2], type: null, ko: null, slash: false })
  }
  return out
}

/** `{speaker, ja, reading, ko}` 줄 목록에 `pieces` 를 붙인다(매개변수 문맥 타입이 speaker 리터럴을 'A'|'B' 로 좁힌다). */
export function withPieces(lines: Omit<LessonDialogueLine, 'pieces'>[]): LessonDialogueLine[] {
  return lines.map((l) => ({ ...l, pieces: piecesFor(l.ja) }))
}
