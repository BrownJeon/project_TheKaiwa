/**
 * 집중 화면(회화방·채팅방·단어 덱·오늘의 회화 수업) — 하단 탭을 숨기고, 권장 업데이트 띠도 숨긴다(screens §11-3 E). 두 곳이 같은 목록을 쓴다.
 * 챌린지 하위 화면(만들기·상세·기록, task-043 D2)도 탭을 숨기고 ← 로 돌아간다(`/plan` 자체는 탭이 보인다).
 */
export const FOCUS_ROUTE_PREFIXES = [
  '/study/ai/chat/',
  '/study/ai/talk/',
  '/study/today/words/',
  '/study/today/talk/',
  '/study/today/eval/',
  '/plan/challenge/',
  '/plan/challenges',
  '/study/ai/scenario/',
  '/settings/scenarios',
  // 질문은 넣지 않는다 — 지난 질문도 탭 화면 `/ask?chat=<id>` 에서 열고 옛 `/ask/<id>` 는 서버가 그리로 보낸다(task-067 §27-7 C).
] as const

export function isFocusRoute(pathname: string): boolean {
  return FOCUS_ROUTE_PREFIXES.some((p) => pathname.startsWith(p))
}
