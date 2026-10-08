/**
 * 하단 탭 「눌림」 상태 전이(task-046 IMP-0027) — 서버 컴포넌트 응답이 오기 전에도 눌린 탭을 바로 활성처럼 보인다.
 * 눌림은 **눈에 보이는 표시뿐**이다: `aria-current="page"` 는 경로가 실제로 바뀐 뒤에만 옮겨가서 읽기 도구가 잘못된 현재 위치를 읽지 않는다.
 */

/** 눌린 뒤 경로가 바뀌지 않으면(오프라인·서버 무응답) 표시를 거둔다 — 눌린 탭이 영영 켜진 채 남지 않게. */
export const PRESS_TIMEOUT_MS = 8000

export type PressEvent = { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }

/** 새 창·새 탭으로 여는 클릭(수정 키·가운데 버튼)은 이 화면의 이동이 아니다. */
export function isPlainClick(e: PressEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
}

/**
 * 탭을 눌렀을 때의 다음 눌림 값(눌린 탭의 href, 없으면 null).
 * 이미 활성인 탭을 누르면 눌림을 풀어 둔다(다른 탭으로 가던 중 지금 탭을 다시 누르면 그 이동을 접는 것이므로 지금 탭이 켜져야 한다).
 */
export function nextPressed(prev: string | null, href: string, active: boolean, plain: boolean): string | null {
  if (!plain) return prev
  return active ? null : href
}

/** 한 탭이 켜진 모양인가 — 눌린 탭이 있으면 그 탭만, 없으면 실제 활성 탭. 한 번에 하나만 켜져 경로가 바뀌는 순간 모양이 다시 바뀌지 않는다. */
export function tabIsOn(active: boolean, pressed: string | null, href: string): boolean {
  return pressed === null ? active : pressed === href
}
