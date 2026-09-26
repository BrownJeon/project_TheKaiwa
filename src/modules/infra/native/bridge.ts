/**
 * Capacitor 런타임 브리지 — **네이티브 기능을 만지는 유일한 경로**(설계안 §12).
 *
 * `GoogleLoginButton.tsx` 가 예고한 그 래퍼다: *"Phase 7 에서 `src/lib/native/*` 래퍼가
 * 생기면 이 감지 로직을 그쪽으로 옮긴다."*
 *
 * ── `@capacitor/*` 를 import 하지 않는다 ────────────────────────────────────
 * 패키지는 이제 설치돼 있지만(Phase 7), 여기서는 **런타임이 WebView 에 주입하는
 * `window.Capacitor` 전역만** 본다. 이유가 둘이다.
 *   ① 이 앱은 `server.url` 로 **운영 웹을 그대로 로드**한다 — 같은 번들이 폰과 PC 브라우저에
 *      함께 나간다. 네이티브 전용 모듈을 import 하면 **웹 사용자도 그 코드를 받는다.**
 *   ② 플러그인이 빠진 APK 에서도 화면이 죽지 않아야 한다. 전역을 보면 "없으면 없는 대로"가
 *      자연스럽고, import 하면 모듈 최상위에서 터진다.
 *
 * 그래서 **모든 함수가 "브리지가 없으면 조용히 아무 일도 안 한다"** 를 지킨다.
 */

interface BrowserPlugin {
  open?: (options: { url: string }) => Promise<void>
  close?: () => Promise<void>
}

interface AppPlugin {
  /** 앱이 떠 있는 동안 도착한 딥링크. */
  addListener?: (
    event: 'appUrlOpen',
    handler: (data: { url: string }) => void,
  ) => Promise<{ remove: () => Promise<void> }> | { remove: () => void }
  /** **앱이 꺼져 있다가 딥링크로 깨어난 경우** 그 주소. 리스너보다 먼저 일어난다. */
  getLaunchUrl?: () => Promise<{ url: string } | null | undefined>
}

/** 네이티브 공유 시트. `files` 는 **파일 URI** 다(브라우저의 `File` 객체가 아니다). */
interface SharePlugin {
  share?: (options: {
    title?: string
    text?: string
    url?: string
    files?: string[]
    dialogTitle?: string
  }) => Promise<unknown>
}

/** 공유 전에 파일을 기기에 내려놓는다 — 네이티브 공유는 URI 로만 받는다. */
interface FilesystemPlugin {
  writeFile?: (options: {
    path: string
    data: string
    directory?: string
    recursive?: boolean
  }) => Promise<{ uri: string }>
}

interface CapacitorBridge {
  isNativePlatform?: () => boolean
  Plugins?: {
    Browser?: BrowserPlugin
    App?: AppPlugin
    Share?: SharePlugin
    Filesystem?: FilesystemPlugin
  }
}

export function getBridge(): CapacitorBridge | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor ?? null
}

export function isNativeApp(): boolean {
  return getBridge()?.isNativePlatform?.() === true
}

/** Custom Tabs 로 연다. 플러그인이 없으면 `false` — 호출부가 일반 네비게이션으로 폴백한다. */
export async function openExternal(url: string): Promise<boolean> {
  const open = getBridge()?.Plugins?.Browser?.open
  if (typeof open !== 'function') return false
  try {
    await open({ url })
    return true
  } catch {
    return false
  }
}

/** 로그인이 끝나면 위에 떠 있는 Custom Tab 을 닫는다. 실패해도 무시한다(부가 동작). */
export async function closeExternal(): Promise<void> {
  const close = getBridge()?.Plugins?.Browser?.close
  if (typeof close !== 'function') return
  try {
    await close()
  } catch {
    // 이미 닫혔거나 플러그인이 없다 — 사용자가 할 일이 없으므로 조용히 넘어간다.
  }
}

/**
 * 네이티브 공유에 필요한 **두 플러그인을 함께** 꺼낸다 — 하나라도 없으면 `null`.
 *
 * **둘을 따로 꺼내지 않는 이유**: 공유는 `writeFile` 로 파일을 내려놓은 뒤 그 URI 를
 * `share` 에 넘기는 **2단 동작**이다. 하나만 있는 상태를 "네이티브 가능"으로 판정하면
 * 파일만 쓰고 공유 시트가 안 뜨거나, 존재하지 않는 URI 를 넘기게 된다 — 어느 쪽도
 * 사용자에게는 "눌렀는데 아무 일도 안 일어남"으로 보인다. 폴백(웹 공유·다운로드)으로
 * 갈라지려면 **둘 다 있는지**가 한 번에 판정돼야 한다.
 *
 * 호출부는 `null` 을 받으면 웹 폴백으로 간다 — 여기서 던지지 않는다.
 */
export function getNativeShare(): { share: SharePlugin; fs: FilesystemPlugin } | null {
  if (!isNativeApp()) return null
  const plugins = getBridge()?.Plugins
  const share = plugins?.Share
  const fs = plugins?.Filesystem
  if (typeof share?.share !== 'function' || typeof fs?.writeFile !== 'function') return null
  return { share, fs }
}

/**
 * 딥링크에서 **로그인 코드**를 꺼낸다. `thekaiwa://auth/callback?code=<64자 hex>`.
 *
 * `new URL('thekaiwa://auth/callback')` 에서 `auth` 는 **host** 로 파싱되고 pathname 은
 * `/callback` 이 된다(커스텀 스킴은 특수 스킴이 아니라서다) — 그래서 둘 다 본다.
 *
 * 형식을 여기서 한 번 거른다: 서버(`consumeAppAuthCode`)가 최종 판정을 하지만, 엉뚱한
 * 주소로 `/api/auth/app-exchange` 에 다녀오면 **로그인 화면이 오류 배너와 함께 다시 뜨는**
 * 혼란스러운 왕복이 생긴다. 코드가 아닌 딥링크(공유·알림 등 앞으로 생길 것들)는 그냥 무시한다.
 */
export function authCodeFromDeepLink(rawUrl: string): string | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  const isAuthCallback = url.host === 'auth' || url.pathname.includes('auth/callback')
  if (!isAuthCallback) return null
  const code = url.searchParams.get('code')
  if (code === null || !/^[0-9a-f]{64}$/i.test(code)) return null
  return code
}

/** 딥링크에 실려 온 오류(사용자가 구글에서 취소한 경우 등). */
export function authErrorFromDeepLink(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).searchParams.get('error')
  } catch {
    return null
  }
}

/**
 * 딥링크 구독 + **콜드 스타트 보정**.
 *
 * ⚠️ 리스너만 달면 놓치는 경우가 있다: 앱이 **꺼져 있을 때** 딥링크로 깨어나면, WebView 가
 * 웹을 받아 이 코드가 실행되기 **전에** 이미 `appUrlOpen` 이 지나간다. 그래서 `getLaunchUrl()`
 * 로 "깨운 주소"를 한 번 더 확인한다. 둘 다 같은 주소를 줄 수 있으므로 **호출부가 한 번만
 * 쓰도록** 처리해야 한다 — 코드는 1회용이라 두 번째 교환은 반드시 실패한다.
 *
 * @returns 구독 해제 함수. 브리지가 없으면 아무것도 안 하는 함수.
 */
export function onAuthDeepLink(handler: (url: string) => void): () => void {
  const app = getBridge()?.Plugins?.App
  if (!app) return () => {}

  let disposed = false
  let remove: (() => void) | null = null

  if (typeof app.addListener === 'function') {
    const result = app.addListener('appUrlOpen', (data) => {
      if (!disposed && typeof data?.url === 'string') handler(data.url)
    })
    void Promise.resolve(result).then((h) => {
      if (disposed) void h?.remove()
      else remove = () => void h?.remove()
    })
  }

  if (typeof app.getLaunchUrl === 'function') {
    void Promise.resolve(app.getLaunchUrl())
      .then((launch) => {
        if (!disposed && launch && typeof launch.url === 'string') handler(launch.url)
      })
      .catch(() => {})
  }

  return () => {
    disposed = true
    remove?.()
  }
}
