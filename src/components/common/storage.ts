/**
 * 브라우저 저장소 접근(채팅·단어장·오늘의 단어 공용, task-008 F10 에서 `chat/` 에서 옮김) — **전부 try/catch**. 사생활 모드·저장소 차단·WebView 설정에 따라 접근 자체가
 * 예외를 던진다. 여기 값은 편의(초안·읽기 기본값·안내 닫음)라 실패해도 기본값으로 동작해야 한다.
 */

type Kind = 'local' | 'session'

function store(kind: Kind): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function readStore(kind: Kind, key: string): string | null {
  try {
    return store(kind)?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function writeStore(kind: Kind, key: string, value: string | null): void {
  try {
    const s = store(kind)
    if (!s) return
    if (value === null) s.removeItem(key)
    else s.setItem(key, value)
  } catch {
    /* 저장 실패는 무시 — 편의 기능이다 */
  }
}
