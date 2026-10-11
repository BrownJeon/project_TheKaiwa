/**
 * 다른 앱(카카오톡 등)에서 「공유」로 보낸 글 받기 — task-052. 네이티브 `SharedText` 플러그인의 웹 쪽 유일 경로.
 *
 * 네이티브(`MainActivity`)가 공유 글을 **메모리에만** 들고 있다가 `consumeSharedText()` 한 번에 넘기고 비운다(두 번째는 null).
 * 30분이 지나면 네이티브가 버린다. 앞 10,000자(코드포인트)까지만 받고 넘으면 `truncated: true`.
 * `text` 가 빈 문자열이면 글 없이(또는 공백뿐인 글로) 공유된 것이다 — 그래도 peek 은 true 다(화면은 붙여넣기 화면 + 토스트, 데모 D5-A).
 * 이 모듈은 import 만으로는 아무것도 하지 않는다(루트 레이아웃·SSR 에서 불려도 안전) — `window` 는 함수가 불릴 때만 본다.
 *
 * 화면 쪽 흐름: `onSharedText`(앱이 떠 있을 때 새 공유 신호)·`peekSharedText`(마운트·resume 때 있는지만)로 붙여넣기 화면에 옮기고,
 * 그 화면이 `consumeSharedText` 로 꺼낸다. 본문은 신호·peek 에 실리지 않는다 — URL·로그·저장소에도 싣지 않는다.
 *
 * 앱이 아니거나(PC·모바일 브라우저) 이 플러그인이 없는 APK(1.0.2 이하)면 전부 아무 일도 하지 않는다(false · null · 빈 해제 함수).
 * 플러그인 호출이 실패해도 던지지 않고 false/null 로 돌려준다 — 공유는 부가 경로라 화면을 멈추지 않는다.
 */
import { getBridge, isNativeApp } from './bridge'
import { listen } from './listen'

/** 네이티브 `SharedTextHolder.MAX_CODE_POINTS` 와 같은 수 — 예전·다른 구현이 더 길게 줘도 여기서 한 번 더 자른다. */
export const SHARED_TEXT_MAX_CODE_POINTS = 10_000

export interface SharedTextPayload {
  text: string
  truncated: boolean
}

function sharedTextPlugin() {
  if (!isNativeApp()) return null
  return getBridge()?.Plugins?.SharedText ?? null
}

function clipCodePoints(s: string, max: number): string {
  if (s.length <= max) return s
  let i = 0
  for (let n = 0; n < max && i < s.length; n++) i += (s.codePointAt(i) ?? 0) > 0xffff ? 2 : 1
  return s.slice(0, i)
}

/** 꺼내 갈 공유 글이 있는가(본문은 주지 않고 비우지도 않는다). */
export async function peekSharedText(): Promise<boolean> {
  const p = sharedTextPlugin()
  if (typeof p?.peek !== 'function') return false
  try {
    const r = await p.peek()
    return r?.available === true
  } catch {
    return false
  }
}

/** 공유 글을 **한 번만** 꺼낸다(네이티브가 비운다). 없음·만료·앱 아님·실패면 null. */
export async function consumeSharedText(): Promise<SharedTextPayload | null> {
  const p = sharedTextPlugin()
  if (typeof p?.consume !== 'function') return null
  let r: { text?: unknown; truncated?: unknown } | null | undefined
  try {
    r = await p.consume()
  } catch {
    return null
  }
  if (!r || typeof r.text !== 'string') return null
  if (r.text.trim() === '') return { text: '', truncated: false }
  const text = clipCodePoints(r.text, SHARED_TEXT_MAX_CODE_POINTS)
  return { text, truncated: r.truncated === true || text.length !== r.text.length }
}

/** 앱이 떠 있는 채 새 공유가 도착했다는 신호(본문 없음). 해제 함수를 돌려준다. */
export function onSharedText(cb: () => void): () => void {
  const p = sharedTextPlugin()
  if (typeof p?.addListener !== 'function') return () => {}
  try {
    return listen(p.addListener('sharedText', () => cb()))
  } catch {
    return () => {}
  }
}
