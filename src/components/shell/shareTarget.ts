/**
 * 다른 앱에서 「공유」로 받은 글을 붙여넣기 화면으로 옮기는 규칙(screens §20-3·20-5, task-052).
 * 네이티브 import 없음·`'use client'` 없음 — 서버 컴포넌트(로그인·붙여넣기 `page.tsx`)와 셸 `ShareReceiver` 가 함께 쓴다.
 * 주소에는 공유 **표시**(`from=share`)만 싣는다. 본문은 붙여넣기 화면이 브리지에서 직접 한 번만 꺼낸다.
 */

export const SHARE_PASTE_PATH = '/study/today/talk/new/paste'
export const SHARE_PASTE_HREF = `${SHARE_PASTE_PATH}?from=share`
export const SHARE_LOGIN_HREF = `/login?callbackUrl=${encodeURIComponent(SHARE_PASTE_HREF)}`
/** 이미 붙여넣기 화면에 있을 때 셸이 화면에 보내는 신호(본문 없음). */
export const SHARE_EVENT = 'kaiwa:shared-text'
export const SHARE_LOGIN_NOTE = '공유한 글은 로그인하면 붙여넣기 화면에 넣어 드려요.'

/** 기준 출처 — 상대 주소만 같은 출처로 읽힌다(`//다른곳/…`·절대 주소는 거짓). */
const BASE = 'http://kaiwa.invalid'

/** 로그인 화면의 `callbackUrl` 이 「공유한 글 붙여넣기」인가. 파싱 실패·`null` → false. */
export function isShareCallback(raw: string | null | undefined): boolean {
  if (!raw) return false
  try {
    const u = new URL(raw, BASE)
    return u.origin === BASE && u.pathname === SHARE_PASTE_PATH && u.searchParams.get('from') === 'share'
  } catch {
    return false
  }
}

/**
 * 공유가 보관돼 있을 때 지금 주소에서 할 일.
 * - `signal`: 이미 붙여넣기 화면 → 이동 없이 화면에 신호만(그 자리에서 채움)
 * - `stay`: 아무것도 하지 않음(붙여넣기 화면이 마운트하며 직접 받는 중 · 초대코드 가입 중 · 로그인 화면이 이미 안내 중)
 * - `login`: 로그인 화면 → `callbackUrl` 을 공유 붙여넣기로 바꿈
 * - `go`: 그 밖 어느 화면이든 붙여넣기 화면으로 이동
 */
export type ShareAction = 'signal' | 'stay' | 'login' | 'go'

export function decideShareAction(pathname: string, search: string): ShareAction {
  const q = new URLSearchParams(search)
  if (pathname === SHARE_PASTE_PATH) return q.get('from') === 'share' ? 'stay' : 'signal'
  if (pathname === '/invite') return 'stay'
  if (pathname === '/login') return isShareCallback(q.get('callbackUrl')) ? 'stay' : 'login'
  return 'go'
}
