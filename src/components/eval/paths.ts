/** 평가 화면 주소(screens.md §2 표 — `/study/today/eval/[evaluationId]`, 시작·기록은 데모 v1 의 두 하위 화면). 전부 하단 탭 숨김(집중 화면). */
import type { EvalKind } from '@/types/evaluation'

export const EVAL_HISTORY_PATH = '/study/today/eval/history'

export function evalPath(id: string): string {
  return `/study/today/eval/${encodeURIComponent(id)}`
}

export function startPath(kind: EvalKind): string {
  return `/study/today/eval/new?kind=${kind}`
}

/** 문제 만들기를 누른 시각(이 브라우저 세션 — 대기 화면 경과 표시용, 없으면 화면을 연 시각부터). */
export function genAtKey(id: string): string {
  return `kaiwa.eval.genAt.${id}`
}
