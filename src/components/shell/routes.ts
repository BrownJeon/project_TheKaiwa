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
] as const

export function isFocusRoute(pathname: string): boolean {
  return FOCUS_ROUTE_PREFIXES.some((p) => pathname.startsWith(p))
}
