/**
 * `SherpaStt` 플러그인 계약 v1.1 — 정본은 task-003f 이력서 "플러그인 JS 계약 v1"·"v1.1"(README §4 갱신본).
 *
 * **웹 번들은 이 파일을 import 하지 않는다.** 앱 코드는 `src/modules/infra/native/bridge.ts` 가
 * `window.Capacitor.Plugins.SherpaStt` 를 읽고 필요한 타입을 손으로 옮겨 적는다 — 같은 번들이 PC 브라우저에도
 * 나가고, 플러그인이 빠진 APK 에서도 화면이 죽지 않아야 하기 때문이다(module-dependency §6).
 * 이 파일이 바뀌면 bridge.ts 의 사본도 같이 바꾼다.
 */
import type { PermissionState, PluginListenerHandle } from '@capacitor/core'

export type SherpaSttErrorCode =
  // 세션
  | 'PERMISSION_DENIED'
  | 'MODEL_MISSING'
  | 'MODEL_CORRUPT'
  | 'AUDIO_INIT_FAILED'
  | 'DECODE_FAILED'
  | 'OOM'
  | 'ALREADY_STARTED'
  | 'INTERRUPTED'
  | 'INVALID_ARGUMENT'
  | 'BUSY'
  | 'UNAVAILABLE'
  // 모델 다운로드
  | 'NETWORK_NOT_ALLOWED'
  | 'OFFLINE'
  | 'ORIGIN_NOT_ALLOWED'
  | 'MANIFEST_INVALID'
  | 'APP_UPDATE_REQUIRED'
  | 'DOWNGRADE_REFUSED'
  | 'INSUFFICIENT_STORAGE'
  | 'DOWNLOAD_IN_PROGRESS'
  | 'DOWNLOAD_CANCELLED'
  | 'DOWNLOAD_FAILED'

export interface PermissionStatus {
  recordAudio: PermissionState
}

export interface CheckModelResult {
  installed: boolean
  version?: string
  bytes?: number
  downloading: boolean
  /** 앱 전용 저장소의 여유 바이트(v1.1) — 받기 전 `totalBytes × 2.5` 와 비교. */
  freeBytes: number
  /** 이어받을 수 있는 미완성 다운로드. */
  pendingVersion?: string
  pendingBytes?: number
}

export interface DownloadModelOptions {
  /** 앱 `server.url` 과 같은 origin 의 `https://…/models/<name>/manifest.json` 만. */
  manifestUrl: string
  /** 기본 true — 과금 네트워크면 `NETWORK_NOT_ALLOWED`(도중에 바뀌어도 멈춤, 조각은 남음). */
  wifiOnly?: boolean
  expectedVersion?: string
  /** 기본 false — 설치본보다 낮거나 같은 버전을 다시 받는 명시적 재설치. */
  allowDowngrade?: boolean
}

export interface DownloadModelResult {
  version: string
  bytes: number
  alreadyInstalled: boolean
}

export type DecodingMethod = 'greedy_search' | 'modified_beam_search'

export interface PreloadOptions {
  numThreads?: number
  decodingMethod?: DecodingMethod
}

export interface StartOptions {
  vad?: {
    /** 100~3000, 기본 500 */
    silenceMs?: number
    /** 0.05~0.95, 기본 0.5 */
    threshold?: number
    /** 50~2000, 기본 250 */
    minSpeechMs?: number
    /** 1~60, 기본 30 */
    maxSegmentSec?: number
  }
  /** 기본 true(`manual` 에서만 의미) */
  partial?: boolean
  /** 기본 'manual'(푸시투토크 — stop 때 final 1회). 'auto' 는 무음 끝점마다 final. */
  endpoint?: 'manual' | 'auto'
  /** 1~8, 기본 2 */
  numThreads?: number
  decodingMethod?: DecodingMethod
  /** 1~300, 기본 60 — 넘으면 final(reason 'max_length') 후 캡처 중단 */
  maxUtteranceSec?: number
  /** 기본 true — text 가 있을 때만 wav 를 남긴다 */
  saveWav?: boolean
  audioSource?: 'MIC' | 'VOICE_RECOGNITION'
}

export interface SegmentPayload {
  segIdx: number
  text: string
  startMs: number
  endMs: number
}

export interface FinalPayload {
  sessionId: string
  /** 구두점 없는 모델 출력 그대로(gateway 와 같음). */
  text: string
  durationMs: number
  /** 앱 전용 폴더의 16kHz mono PCM16 wav 절대경로. text 가 비면 null. `Capacitor.convertFileSrc` 로 읽는다. */
  wavPath: string | null
  segments: SegmentPayload[]
  timings: { vadMs: number; decodeMs: number; loadMs: number; sttMs: number }
  reason: 'stop' | 'endpoint' | 'max_length'
  modelVersion: string
}

export interface VadEvent {
  sessionId: string
  state: 'SPEECH' | 'SILENCE'
  atMs: number
}

export interface LevelEvent {
  sessionId: string
  /** dBFS, 바닥 -100, 소수 1자리 */
  db: number
}

export interface PartialEvent extends SegmentPayload {
  sessionId: string
}

export interface ErrorEvent {
  sessionId: string | null
  code: SherpaSttErrorCode
  message: string
}

export interface DownloadProgressEvent {
  version: string
  fileIndex: number
  fileCount: number
  received: number
  total: number
  totalReceived: number
  totalBytes: number
}

export interface Diagnostics {
  pluginVersion: string
  abi: string
  modelVersion?: string
  recognizerLoaded: boolean
  numThreads?: number
  lastLoadMs?: number
  /** 이번 프로세스의 마지막 (텍스트가 있던) 발화 길이·디코드 시간(v1.1). */
  lastUtteranceMs?: number
  lastDecodeMs?: number
  rssMb: number
  javaHeapMb: number
}

export interface SherpaSttPlugin {
  checkPermissions(): Promise<PermissionStatus>
  requestPermissions(): Promise<PermissionStatus>
  checkModel(options?: { verify?: boolean }): Promise<CheckModelResult>
  downloadModel(options: DownloadModelOptions): Promise<DownloadModelResult>
  cancelDownload(): Promise<void>
  /** 세션·다운로드·다른 삭제 중이면 `BUSY`. 삭제가 끝날 때까지 `start`·`downloadModel` 도 `BUSY`(REV-021). */
  deleteModel(): Promise<void>
  /** 세션 중에는 인식기를 바꾸지 않는다 — `BUSY`(Codex C2). 모델이 없으면 `MODEL_MISSING`. */
  preload(options?: PreloadOptions): Promise<{ modelVersion: string; loadMs: number }>
  /** 권한 없음 `PERMISSION_DENIED` · 모델 없음 `MODEL_MISSING` · 이미 세션 `ALREADY_STARTED` · 모델 삭제 중 `BUSY`. */
  start(options?: StartOptions): Promise<{ sessionId: string; modelVersion: string }>
  stop(): Promise<{ sessionId?: string; utterance?: FinalPayload }>
  cancel(): Promise<void>
  release(): Promise<void>
  deleteWav(options: { wavPath: string }): Promise<void>
  getDiagnostics(): Promise<Diagnostics>
  /** v1.1 — 앱 정보 화면(권한 켜기). 실패는 `UNAVAILABLE`. */
  openAppSettings(): Promise<void>

  addListener(event: 'vad', fn: (e: VadEvent) => void): Promise<PluginListenerHandle>
  addListener(event: 'level', fn: (e: LevelEvent) => void): Promise<PluginListenerHandle>
  addListener(event: 'partial', fn: (e: PartialEvent) => void): Promise<PluginListenerHandle>
  addListener(event: 'final', fn: (e: FinalPayload) => void): Promise<PluginListenerHandle>
  addListener(event: 'error', fn: (e: ErrorEvent) => void): Promise<PluginListenerHandle>
  addListener(event: 'downloadProgress', fn: (e: DownloadProgressEvent) => void): Promise<PluginListenerHandle>
  removeAllListeners(): Promise<void>
}
