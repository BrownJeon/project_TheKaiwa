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
import { listen, type ListenerHandle } from './listen'

interface BrowserPlugin {
  open?: (options: { url: string }) => Promise<void>
  close?: () => Promise<void>
  /** Custom Tab 이 닫혔다(사용자가 닫았거나 `close()`). */
  addListener?: (event: 'browserFinished', handler: () => void) => ListenerHandle
}

interface AppPlugin {
  /** 앱 버전 — `version`=versionName, `build`=versionCode(문자열). APK 배너(#8)가 쓴다. */
  getInfo?: () => Promise<{ version?: string; build?: string }>
  /** 앱이 떠 있는 동안 도착한 딥링크(`appUrlOpen`) · 앱이 다시 앞으로 왔다(`resume`). */
  addListener?: (event: 'appUrlOpen' | 'resume', handler: (data: { url: string }) => void) => ListenerHandle
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

// ── 온디바이스 인식 플러그인(task-003f) ─────────────────────────────────
// 계약 정본: task-003f 이력서 "플러그인 JS 계약 v1"(developer A). 플러그인 `definitions.ts` 를 import 하지 않고
// 여기에 손으로 옮겨 적는다(module-dependency §6). 이름·필드에 엔진·모델 이름이 없다.

export type OnDevicePermission = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied'

export interface OnDeviceModelStatus {
  installed: boolean
  version?: string
  bytes?: number
  downloading?: boolean
  pendingVersion?: string
  pendingBytes?: number
  /** 계약 v1.1 — 기기 여유 공간(누르기 전에 부족을 보인다). */
  freeBytes?: number
}

export interface OnDeviceStartOptions {
  vad?: { silenceMs?: number; threshold?: number; minSpeechMs?: number; maxSegmentSec?: number }
  partial?: boolean
  endpoint?: 'manual' | 'auto'
  numThreads?: number
  decodingMethod?: 'greedy_search' | 'modified_beam_search'
  maxUtteranceSec?: number
  saveWav?: boolean
  audioSource?: 'MIC' | 'VOICE_RECOGNITION'
}

export interface OnDeviceSegment {
  segIdx: number
  text: string
  startMs: number
  endMs: number
}

export interface OnDeviceFinalPayload {
  sessionId: string
  text: string
  durationMs: number
  wavPath: string | null
  segments?: OnDeviceSegment[]
  timings?: { vadMs?: number; decodeMs?: number; loadMs?: number; sttMs?: number }
  reason?: 'stop' | 'endpoint' | 'max_length'
  modelVersion?: string
}

export interface OnDeviceDownloadProgress {
  version: string
  fileIndex: number
  fileCount: number
  received: number
  total: number
  totalReceived: number
  totalBytes: number
}

export interface OnDeviceDiagnostics {
  pluginVersion?: string
  abi?: string
  modelVersion?: string
  recognizerLoaded?: boolean
  numThreads?: number
  lastLoadMs?: number
  /** 플러그인이 기억하는 마지막 발화 길이·디코드 시간(WebView 가 다시 그려져 웹 쪽 기록이 없을 때). */
  lastUtteranceMs?: number
  lastDecodeMs?: number
  rssMb?: number
  javaHeapMb?: number
}

export interface OnDeviceEventMap {
  vad: { sessionId: string; state: 'SPEECH' | 'SILENCE'; atMs: number }
  level: { sessionId: string; db: number }
  partial: { sessionId: string; segIdx: number; text: string; startMs?: number; endMs?: number }
  final: OnDeviceFinalPayload
  error: { sessionId: string | null; code: string; message?: string }
  downloadProgress: OnDeviceDownloadProgress
}

export type OnDeviceListenerHandle = { remove: () => Promise<void> | void }

export interface OnDeviceSttPlugin {
  checkPermissions(): Promise<{ recordAudio: OnDevicePermission }>
  requestPermissions(): Promise<{ recordAudio: OnDevicePermission }>
  checkModel(o?: { verify?: boolean }): Promise<OnDeviceModelStatus>
  downloadModel(o: { manifestUrl: string; wifiOnly?: boolean; expectedVersion?: string; allowDowngrade?: boolean }): Promise<{ version: string; bytes: number; alreadyInstalled: boolean }>
  start(o?: OnDeviceStartOptions): Promise<{ sessionId: string; modelVersion?: string }>
  stop(): Promise<{ sessionId?: string; utterance?: OnDeviceFinalPayload }>
  cancel(): Promise<void>
  release(): Promise<void>
  addListener<K extends keyof OnDeviceEventMap>(event: K, fn: (data: OnDeviceEventMap[K]) => void): Promise<OnDeviceListenerHandle> | OnDeviceListenerHandle
  cancelDownload?(): Promise<void>
  deleteModel?(): Promise<void>
  preload?(o?: { numThreads?: number; decodingMethod?: 'greedy_search' | 'modified_beam_search' }): Promise<{ modelVersion?: string; loadMs?: number }>
  deleteWav?(o: { wavPath: string }): Promise<void>
  getDiagnostics?(): Promise<OnDeviceDiagnostics>
  /** 계약 v1.1 — 이 앱의 안드로이드 설정 화면(권한 영구 거절 뒤 [앱 설정 열기]). */
  openAppSettings?(): Promise<void>
}

/**
 * 다른 앱에서 공유받은 글(task-052) — `MainActivity` 가 등록하는 앱 내장 플러그인. 1.0.3(versionCode 4) 미만 APK 에는 없다.
 * 부르는 함수는 `./sharedText` 뿐이다. 응답은 네이티브가 주는 그대로라 거기서 형식을 다시 거른다.
 */
interface SharedTextPlugin {
  peek?: () => Promise<{ available?: unknown } | null | undefined>
  consume?: () => Promise<{ text?: unknown; truncated?: unknown } | null | undefined>
  addListener?: (event: 'sharedText', handler: () => void) => ListenerHandle
}

/** 이 중 하나라도 없으면 반쪽짜리 플러그인이다 — 녹음 UI 를 띄우지 않고 서버 인식으로 간다(§6). */
const ONDEVICE_REQUIRED = ['checkPermissions', 'requestPermissions', 'checkModel', 'downloadModel', 'start', 'stop', 'cancel', 'release', 'addListener'] as const

interface CapacitorBridge {
  isNativePlatform?: () => boolean
  /** 앱 전용 폴더 파일 → WebView 가 fetch 할 수 있는 같은 origin 주소(`/_capacitor_file_…`). */
  convertFileSrc?: (path: string) => string
  Plugins?: {
    Browser?: BrowserPlugin
    App?: AppPlugin
    Share?: SharePlugin
    Filesystem?: FilesystemPlugin
    SherpaStt?: Partial<OnDeviceSttPlugin>
    SharedText?: SharedTextPlugin
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

/**
 * 온디바이스 인식 플러그인 — 앱 + 필수 메서드가 다 있을 때만. 없으면 null(웹·플러그인 없는 APK → 서버 인식).
 * 이 함수만 `window.Capacitor.Plugins.SherpaStt` 를 읽는다(module-dependency §6 의 `getSherpaStt()`).
 * 부르는 곳은 speech 클라이언트 라우터(`@/modules/speech/stt/client`)와 모델 내려받기 카드뿐.
 */
export function getOnDeviceStt(): OnDeviceSttPlugin | null {
  if (!isNativeApp()) return null
  const p = getBridge()?.Plugins?.SherpaStt
  if (!p) return null
  for (const m of ONDEVICE_REQUIRED) if (typeof p[m] !== 'function') return null
  return p as OnDeviceSttPlugin
}

/** 플러그인 오류(reject 값)의 코드. Capacitor 는 `code` 필드에 싣는다. 없으면 'UNKNOWN'. */
export function nativeErrorCode(e: unknown): string {
  const c = (e as { code?: unknown } | null)?.code
  return typeof c === 'string' && /^[A-Z_]{2,40}$/.test(c) ? c : 'UNKNOWN'
}

/**
 * 플러그인이 앱 전용 폴더에 쓴 파일(녹음 wav)을 Blob 으로 — `convertFileSrc` 주소를 fetch 한다(VoiceVault task-039 선례).
 * 같은 origin 주소가 아니거나 `maxBytes` 를 넘으면 null(업로드하지 않는다).
 */
export async function readNativeFile(path: string, maxBytes: number): Promise<Blob | null> {
  const convert = getBridge()?.convertFileSrc
  if (typeof convert !== 'function' || typeof window === 'undefined') return null
  let url: URL
  try {
    url = new URL(convert(path), window.location.href)
  } catch {
    return null
  }
  if (url.origin !== window.location.origin) return null
  try {
    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (!res.ok) return null
    const blob = await res.blob()
    return blob.size > 0 && blob.size <= maxBytes ? blob : null
  } catch {
    return null
  }
}

/** 설치된 앱 버전(APK 배너 #8) — `name`=versionName, `code`=versionCode(`build`). 앱이 아니거나 값이 없으면 null. */
export async function getAppInfo(): Promise<{ name: string; code: number } | null> {
  if (!isNativeApp()) return null
  const getInfo = getBridge()?.Plugins?.App?.getInfo
  if (typeof getInfo !== 'function') return null
  try {
    const info = await getInfo()
    const code = typeof info?.build === 'string' && /^\d{1,9}$/.test(info.build) ? Number(info.build) : null
    const name = typeof info?.version === 'string' && /^\d{1,4}(\.\d{1,4}){0,3}$/.test(info.version) ? info.version : null
    return code !== null && code > 0 && name !== null ? { name, code } : null
  } catch {
    return null
  }
}

/** 앱이 다시 앞으로 왔을 때(권한·모델·버전 다시 확인). 앱이 아니면 아무것도 하지 않는다. */
export function onAppResume(fn: () => void): () => void {
  const app = getBridge()?.Plugins?.App
  if (!isNativeApp() || typeof app?.addListener !== 'function') return () => {}
  try {
    return listen(app.addListener('resume', () => fn()))
  } catch {
    return () => {}
  }
}

/** Custom Tab 이 닫혔을 때(앱 로그인 대기 풀기). */
export function onBrowserFinished(fn: () => void): () => void {
  const b = getBridge()?.Plugins?.Browser
  if (!isNativeApp() || typeof b?.addListener !== 'function') return () => {}
  try {
    return listen(b.addListener('browserFinished', () => fn()))
  } catch {
    return () => {}
  }
}

/** [앱 설정 열기] 를 그릴 수 있는가(플러그인 계약 v1.1 `openAppSettings`). */
export function canOpenAppSettings(): boolean {
  return isNativeApp() && typeof getBridge()?.Plugins?.SherpaStt?.openAppSettings === 'function'
}

/** 이 앱의 안드로이드 설정 화면을 연다. 못 열면 false(버튼을 숨기고 경로 문구로). */
export async function openAppSettings(): Promise<boolean> {
  const p = getBridge()?.Plugins?.SherpaStt
  if (!isNativeApp() || typeof p?.openAppSettings !== 'function') return false
  try {
    await p.openAppSettings()
    return true
  } catch {
    return false
  }
}
