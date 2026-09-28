/**
 * 앱 로그인(Custom Tabs → `thekaiwa://auth/callback?code=` → `/api/auth/app-exchange`)의 WebView 쪽 PKCE — task-003f C1-1.
 *
 * 로그인 시작 때 verifier(32바이트 랜덤, base64url 43자)를 만들어 **WebView 메모리 + sessionStorage**(Custom Tab 에서 돌아올 때
 * WebView 가 다시 그려져도 남게)에 두고, 서버에는 `challenge = S256(verifier)` 만 보낸다. 딥링크로 돌아오면 verifier 를 **꺼내면서 지운다**
 * (1회용·10분). 세션 토큰이 아니다 — 60초짜리 코드와 짝이 맞을 때만 의미가 있고, 코드가 소각되면 쓸모가 없다.
 * sessionStorage 는 앱 프로세스가 죽으면 사라진다(그때는 로그인을 다시 누르면 된다 — 로그인 화면이 안내).
 */
import { buildGoogleAuthHref } from '../auth/oauth/next-path'
import { isNativeApp, openExternal } from './bridge'

const STORAGE_KEY = 'thekaiwa_app_login'
export const APP_LOGIN_TTL_MS = 10 * 60 * 1000
const VERIFIER = /^[A-Za-z0-9_-]{43}$/

let memory: { verifier: string; at: number } | null = null

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** RFC 7636 S256 쌍. Web Crypto 가 없으면(비보안 컨텍스트) 던진다. */
export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const raw = new Uint8Array(32)
  crypto.getRandomValues(raw)
  const verifier = b64url(raw)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return { verifier, challenge: b64url(new Uint8Array(digest)) }
}

function save(verifier: string, now: number): void {
  memory = { verifier, at: now }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory))
  } catch {
    // 저장소가 막혀 있어도 메모리 값으로 대부분 돌아온다
  }
}

/** 돌아온 딥링크와 짝지을 verifier — **꺼내면서 지운다**(두 번째 호출은 null). 10분 지났으면 null. */
export function takeAppLoginVerifier(now = Date.now()): string | null {
  let entry = memory
  memory = null
  try {
    if (!entry) {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      const parsed = raw ? (JSON.parse(raw) as { verifier?: unknown; at?: unknown }) : null
      if (parsed && typeof parsed.verifier === 'string' && typeof parsed.at === 'number') entry = { verifier: parsed.verifier, at: parsed.at }
    }
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // 저장소 접근 실패 — 메모리 값만 본다
  }
  if (!entry || !VERIFIER.test(entry.verifier) || now - entry.at > APP_LOGIN_TTL_MS || now < entry.at) return null
  return entry.verifier
}

/**
 * 앱 로그인 준비 — PKCE 쌍을 만들어 verifier 를 보관하고 Custom Tab 으로 열 주소(challenge 포함)를 돌려준다.
 * 앱이 아니거나 Web Crypto 가 없으면 null. [Chrome 창 다시 열기]는 **같은 주소·같은 verifier** 를 다시 쓴다(screens §11-3 F).
 */
export async function prepareAppLogin(callbackUrl: string | null): Promise<string | null> {
  if (!isNativeApp()) return null
  let pair: { verifier: string; challenge: string }
  try {
    pair = await createPkcePair()
  } catch {
    return null
  }
  save(pair.verifier, Date.now())
  return new URL(buildGoogleAuthHref(callbackUrl, 'app', pair.challenge), window.location.origin).toString()
}

/** Custom Tab 으로 연다. Browser 플러그인이 없으면 false(WebView 안 구글 OAuth 는 구글이 거부한다). */
export function openAppLogin(href: string): Promise<boolean> {
  return openExternal(href)
}

/** 딥링크 코드 + verifier → 교환 주소(같은 출처). `next` 는 서버가 다시 `sanitizeNextPath` 한다. */
export function appExchangeUrl(origin: string, code: string, verifier: string, next: string | null): string {
  const target = new URL('/api/auth/app-exchange', origin)
  target.searchParams.set('code', code)
  target.searchParams.set('verifier', verifier)
  if (next) target.searchParams.set('next', next)
  return target.toString()
}
