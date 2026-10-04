/**
 * 텍스트 분석 역할 파사드(task-026 S1) — L4 `speech/reading` 은 이것만 부른다. 어댑터·엔진명은 이 아래(`adapters/text`)에만.
 *
 *   annotate(texts, {timeoutMs}) : 문장별 형태소 배열(표기·루비 조각·발음 가나·구절 경계). 칸마다 검증 실패면 null.
 *                                  분석기 불가·설정 문제는 TextAnalyzerError(kind) — 호출자가 빈 결과로 degrade 한다.
 * 엔진 레지스트리·Fallback 정책 밖 내부 서비스 하나라 대상 선택이 없다(관리자 콘솔 연결 관리는 후속).
 */
import { annotateHttp, type TextAnalyzerError, type TextSegment } from '../adapters/text/annotateHttp'

export { TextAnalyzerError, TEXT_MAX_ITEMS, TEXT_MAX_CHARS } from '../adapters/text/annotateHttp'
export type { TextSegment, TextBoundary, TextFailureKind } from '../adapters/text/annotateHttp'

export function isTextAnalyzerError(e: unknown): e is TextAnalyzerError {
  return (e as { name?: string })?.name === 'TextAnalyzerError'
}

export function annotate(texts: readonly string[], opts: { timeoutMs: number }): Promise<Array<TextSegment[] | null>> {
  return annotateHttp(texts, opts)
}
