/**
 * 집중 화면(회화방·채팅방·단어 덱) — 하단 탭을 숨기고, 권장 업데이트 띠도 숨긴다(screens §11-3 E). 두 곳이 같은 목록을 쓴다.
 */
export const FOCUS_ROUTE_PREFIXES = ['/study/ai/chat/', '/study/ai/talk/', '/study/today/words/'] as const

export function isFocusRoute(pathname: string): boolean {
  return FOCUS_ROUTE_PREFIXES.some((p) => pathname.startsWith(p))
}
