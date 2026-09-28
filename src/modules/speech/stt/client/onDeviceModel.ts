/**
 * 휴대폰 인식 파일(온디바이스 모델) 스토어 — 앱 전체 1개(screens §11-3 B). 브리지의 플러그인을 꺼내는 곳은 여기 하나다
 * (module-dependency §6 — 라우터·온디바이스 클라이언트는 이 스토어가 넘겨 준 플러그인만 쓴다).
 *
 * 라우터(`createRealtimeSttClient`)와 설정 카드가 **같은 스냅샷**을 본다 — 카드는 "준비됨"인데 누름이 서버로 가는 어긋남이 없게.
 * 규칙: 자동 다운로드 없음(마운트·resume·online 은 `checkModel` 확인만 — Leader ⑬) · Wi-Fi 전용 기본, 모바일 데이터 동의는 이번 실행만(저장 안 함) ·
 * 버전 문자열은 비교에만 쓰고 스냅샷에 싣지 않는다(엔진·모델 정보 비노출).
 */
import { getOnDeviceStt, nativeErrorCode, type OnDeviceDiagnostics, type OnDeviceDownloadProgress, type OnDeviceModelStatus, type OnDevicePermission, type OnDeviceSttPlugin } from '@/modules/infra/native'
import type { SttClientConfig } from './types'

export type ModelPhase = 'unsupported' | 'checking' | 'off' | 'absent' | 'needsConsent' | 'downloading' | 'verifying' | 'paused' | 'installed' | 'error'
export type ModelTransfer = 'none' | 'downloading' | 'verifying' | 'paused'
export type ModelErrorCode = 'INSUFFICIENT_STORAGE' | 'OFFLINE' | 'DOWNLOAD_FAILED' | 'SERVER' | 'APP_UPDATE_REQUIRED' | 'MODEL_CORRUPT' | 'UNKNOWN'

export interface ModelSnapshot {
  phase: ModelPhase
  /** 휴대폰 경로를 쓸 수 있는가(라우터 입력). */
  installed: boolean
  /** 받는 중·확인 중·멈춤 — 설치본이 있어도(새 버전) 따로 본다. */
  transfer: ModelTransfer
  /** 설치 버전 ≠ #19 model.version. */
  updateAvailable: boolean
  /** 설치본이 있으면서 새 버전을 받는 중·멈춤. */
  updating: boolean
  totalBytes: number | null
  receivedBytes: number
  /** 설치본 크기(메타 "170MB 사용 중"). */
  installedBytes: number | null
  etaSec: number | null
  slow: boolean
  /** 플러그인 거절 기준과 같은 필요 여유(totalBytes × 2.5). */
  requiredBytes: number | null
  /** 플러그인이 알려 주면(v1.1) — 누르기 전에 저장 공간 부족을 보인다. */
  freeBytes: number | null
  error: ModelErrorCode | null
  cellularConsent: boolean
  /** 확인·지우기 등 요청이 걸려 있다(카드 버튼 disabled). */
  busy: boolean
  /** 받기가 방금 끝났다(카드 안 role=status 1회). */
  justInstalled: boolean
  /** 모바일 데이터라 받기를 멈추고 동의를 기다린다(설치본이 있어도 — 새 버전). */
  needsConsent: boolean
  /** 서버에 배포본이 있다(#19 model.version·totalBytes). */
  served: boolean
}

const SPACE_FACTOR = 2.5
const CHECK_TIMEOUT_MS = 3_000
const SLOW_MS = 10_000
const ETA_WINDOW_MS = 5_000
const ETA_MIN_MS = 3_000

/** 최근 5초 평균 속도로 남은 시간(초). 시작 3초 전·속도 0 이면 null. 순수 함수. */
export function estimateEtaSec(samples: ReadonlyArray<{ at: number; bytes: number }>, total: number, startedAt: number, now: number): number | null {
  if (now - startedAt < ETA_MIN_MS || samples.length < 2) return null
  const recent = samples.filter((s) => now - s.at <= ETA_WINDOW_MS)
  if (recent.length < 2) return null
  const first = recent[0]
  const last = recent[recent.length - 1]
  const dt = (last.at - first.at) / 1000
  const db = last.bytes - first.bytes
  if (dt <= 0 || db <= 0) return null
  return Math.max(0, Math.ceil((total - last.bytes) / (db / dt)))
}

/** 받기 실패 코드 → 카드 오류(§11-8 ⓑ). 오류가 아닌 코드는 null(호출자가 따로 처리). */
export function downloadErrorCode(code: string): ModelErrorCode | null {
  switch (code) {
    case 'NETWORK_NOT_ALLOWED':
    case 'DOWNLOAD_CANCELLED':
    case 'DOWNLOAD_IN_PROGRESS':
      return null
    case 'INSUFFICIENT_STORAGE':
    case 'OFFLINE':
    case 'DOWNLOAD_FAILED':
    case 'APP_UPDATE_REQUIRED':
    case 'MODEL_CORRUPT':
      return code
    case 'MANIFEST_INVALID':
    case 'ORIGIN_NOT_ALLOWED':
    case 'DOWNGRADE_REFUSED':
      return 'SERVER'
    default:
      return 'UNKNOWN'
  }
}

type ModelConfig = SttClientConfig['onDevice']

interface Deps {
  getPlugin: () => OnDeviceSttPlugin | null
  now?: () => number
  origin?: () => string
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve('timeout'), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

export class OnDeviceModelStore {
  private readonly listeners = new Set<() => void>()
  private plugin: OnDeviceSttPlugin | null | undefined = undefined
  private config: ModelConfig | null = null
  private status: OnDeviceModelStatus | null = null
  private checked = false
  private snap: ModelSnapshot
  private progressHooked = false
  private samples: Array<{ at: number; bytes: number }> = []
  private startedAt = 0
  private lastProgressAt = 0
  private slowTimer: ReturnType<typeof setInterval> | null = null
  private transfer: ModelTransfer = 'none'
  private received = 0
  private consentPending = false
  private error: ModelErrorCode | null = null
  private cellular = false
  private busy = false
  private justInstalled = false
  private refreshing: Promise<void> | null = null

  constructor(private readonly deps: Deps) {
    this.snap = this.compute()
  }

  private now(): number {
    return this.deps.now ? this.deps.now() : Date.now()
  }

  /** 플러그인(첫 호출 때 한 번 확인). 없으면 null — 웹·플러그인 없는 셸. */
  getPlugin(): OnDeviceSttPlugin | null {
    if (this.plugin === undefined) this.plugin = this.deps.getPlugin()
    return this.plugin
  }

  snapshot(): ModelSnapshot {
    return this.snap
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private publish(): void {
    this.snap = this.compute()
    for (const fn of [...this.listeners]) {
      try {
        fn()
      } catch {
        // 구독자 오류가 스토어를 멈추지 않게
      }
    }
  }

  /** #19 `onDevice` 블록(화면이 받아 넘긴다). */
  setConfig(config: ModelConfig | null | undefined): void {
    this.config = config ?? null
    this.publish()
  }

  private compute(): ModelSnapshot {
    const plugin = this.plugin === undefined ? this.deps.getPlugin() : this.plugin
    const model = this.config?.model
    const totalBytes = typeof model?.totalBytes === 'number' && model.totalBytes > 0 ? model.totalBytes : null
    const served = !!model && typeof model.version === 'string' && totalBytes !== null
    const installed = this.status?.installed === true
    const updateAvailable = installed && served && typeof this.status?.version === 'string' && this.status.version !== model!.version
    const freeBytes = typeof this.status?.freeBytes === 'number' && this.status.freeBytes >= 0 ? this.status.freeBytes : null
    let phase: ModelPhase
    if (!plugin) phase = 'unsupported'
    else if (!this.checked) phase = 'checking'
    else if (installed) phase = 'installed'
    else if (this.transfer === 'downloading' || this.transfer === 'verifying') phase = this.transfer
    else if (this.error) phase = 'error'
    else if (this.transfer === 'paused') phase = 'paused'
    else if (this.consentPending) phase = 'needsConsent'
    else if (!served) phase = 'off'
    else phase = 'absent'
    return {
      phase,
      installed,
      transfer: this.transfer,
      updateAvailable,
      updating: installed && this.transfer !== 'none',
      totalBytes,
      receivedBytes: this.received,
      installedBytes: installed && typeof this.status?.bytes === 'number' ? this.status.bytes : null,
      etaSec: this.transfer === 'downloading' && totalBytes ? estimateEtaSec(this.samples, totalBytes, this.startedAt, this.now()) : null,
      slow: this.transfer === 'downloading' && this.lastProgressAt > 0 && this.now() - this.lastProgressAt >= SLOW_MS,
      requiredBytes: totalBytes ? Math.ceil(totalBytes * SPACE_FACTOR) : null,
      freeBytes,
      error: this.error,
      cellularConsent: this.cellular,
      busy: this.busy,
      justInstalled: this.justInstalled,
      needsConsent: this.consentPending,
      served,
    }
  }

  private hookProgress(p: OnDeviceSttPlugin): void {
    if (this.progressHooked) return
    this.progressHooked = true
    void Promise.resolve(
      p.addListener('downloadProgress', (d: OnDeviceDownloadProgress) => {
        if (typeof d?.totalReceived !== 'number') return
        const now = this.now()
        if (this.transfer === 'none' || this.transfer === 'paused') {
          // WebView 가 다시 그려진 뒤에도 진행 중인 받기를 다시 잡는다.
          this.transfer = 'downloading'
          this.startedAt = now
          this.samples = []
        }
        this.received = d.totalReceived
        this.lastProgressAt = now
        this.samples.push({ at: now, bytes: d.totalReceived })
        if (this.samples.length > 100) this.samples = this.samples.filter((s) => now - s.at <= ETA_WINDOW_MS)
        if (typeof d.totalBytes === 'number' && d.totalBytes > 0 && d.totalReceived >= d.totalBytes) this.transfer = 'verifying'
        this.publish()
      }),
    ).catch(() => {
      this.progressHooked = false
    })
  }

  /** 확인만(`checkModel`) — 받지 않는다. 3초 안에 답이 없으면 `absent` 처럼 보이고 누를 때 다시 확인. */
  refresh(opts: { verify?: boolean } = {}): Promise<void> {
    if (this.refreshing && !opts.verify) return this.refreshing
    const run = async () => {
      const p = this.getPlugin()
      if (!p) {
        this.checked = true
        this.publish()
        return
      }
      this.hookProgress(p)
      try {
        const r = await withTimeout(p.checkModel(opts.verify ? { verify: true } : undefined), opts.verify ? 30_000 : CHECK_TIMEOUT_MS)
        if (r !== 'timeout') {
          this.status = r
          if (r.downloading) {
            if (this.transfer === 'none') {
              this.transfer = 'downloading'
              this.startedAt = this.now()
            }
          } else if (this.transfer === 'downloading' || this.transfer === 'verifying') {
            // 확인해 보니 받는 중이 아니다(앱이 받기를 끝냈거나 멈췄다) — 조각이 남았으면 멈춤.
            this.transfer = (r.pendingBytes ?? 0) > 0 ? 'paused' : 'none'
          } else if (this.transfer === 'none' && (r.pendingBytes ?? 0) > 0) {
            this.transfer = 'paused'
            this.received = r.pendingBytes ?? 0
          }
        }
      } catch {
        // 확인 실패 — 이전 상태 유지
      }
      this.checked = true
      this.publish()
    }
    const p = run().finally(() => {
      if (this.refreshing === p) this.refreshing = null
    })
    this.refreshing = p
    return p
  }

  private manifestUrl(): string | null {
    const raw = this.config?.model?.manifestUrl
    if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return null
    const origin = this.deps.origin ? this.deps.origin() : typeof window !== 'undefined' ? window.location.origin : null
    return origin ? `${origin}${raw}` : null
  }

  /** 받기·이어받기·새 버전 받기. `allowCellular` = [데이터로 받기](이번 실행 동안 기억). */
  async download(opts: { allowCellular?: boolean } = {}): Promise<void> {
    const p = this.getPlugin()
    const url = this.manifestUrl()
    if (!p || !url || this.busy || this.transfer === 'downloading' || this.transfer === 'verifying') return
    if (opts.allowCellular) this.cellular = true
    this.hookProgress(p)
    this.error = null
    this.consentPending = false
    this.justInstalled = false
    this.transfer = 'downloading'
    this.startedAt = this.now()
    this.lastProgressAt = this.startedAt
    this.samples = []
    this.startSlowTimer()
    this.publish()
    const version = this.config?.model?.version
    try {
      await p.downloadModel({ manifestUrl: url, wifiOnly: !this.cellular, ...(typeof version === 'string' ? { expectedVersion: version } : {}) })
      this.transfer = 'none'
      this.received = 0
      this.justInstalled = true
      this.stopSlowTimer()
      await this.refresh()
      return
    } catch (e) {
      const code = nativeErrorCode(e)
      this.stopSlowTimer()
      if (code === 'DOWNLOAD_IN_PROGRESS') {
        await this.refresh()
        return
      }
      this.transfer = code === 'DOWNLOAD_CANCELLED' ? 'paused' : 'none'
      if (code === 'NETWORK_NOT_ALLOWED') this.consentPending = true
      this.error = downloadErrorCode(code)
      this.publish()
      await this.refresh()
    }
  }

  /** [나중에] — 모바일 데이터 안내를 닫는다. */
  declineCellular(): void {
    this.consentPending = false
    this.publish()
  }

  /** [일시정지] — 받던 조각은 남는다(다음 받기가 이어받는다). */
  async pause(): Promise<void> {
    const p = this.getPlugin()
    if (!p?.cancelDownload || this.transfer !== 'downloading') return
    try {
      await p.cancelDownload()
    } catch {
      // downloadModel 쪽 reject 로 상태가 정리된다
    }
  }

  /** [지우기]·[받은 것 지우기] — 설치본·미완성 전부. BUSY(녹음·받기 중)면 던진다(시트가 문구를 보인다). */
  async remove(): Promise<void> {
    const p = this.getPlugin()
    if (!p?.deleteModel) throw Object.assign(new Error('unsupported'), { code: 'UNSUPPORTED' })
    this.busy = true
    this.publish()
    try {
      await p.deleteModel()
      this.status = { installed: false }
      this.transfer = 'none'
      this.received = 0
      this.error = null
      this.justInstalled = false
    } finally {
      this.busy = false
      this.publish()
    }
    await this.refresh()
  }

  dismissError(): void {
    this.error = null
    this.publish()
  }

  /** 완료 안내를 한 번 보인 뒤 화면이 지운다. */
  ackInstalled(): void {
    if (!this.justInstalled) return
    this.justInstalled = false
    this.publish()
  }

  /** 라우터가 휴대폰 인식 실패를 알린다 — 파일 문제면 다시 확인(손상이면 카드 오류). */
  reportFailure(code: string): void {
    if (code === 'MODEL_MISSING') void this.refresh()
    else if (code === 'MODEL_CORRUPT') {
      void this.refresh({ verify: true }).then(() => {
        if (!this.status?.installed) {
          this.error = 'MODEL_CORRUPT'
          this.publish()
        }
      })
    }
  }

  /** 앱 마이크 권한(screens §11-3 D) — 플러그인이 없으면 null(호출자가 Permissions API 로). 상태는 저장하지 않고 늘 다시 묻는다. */
  async micPermission(): Promise<OnDevicePermission | null> {
    const p = this.getPlugin()
    if (!p) return null
    try {
      return (await p.checkPermissions()).recordAudio ?? null
    } catch {
      return null
    }
  }

  /** 안드로이드 권한 대화상자(첫 누름 = 권한만, §8-0 ③). */
  async requestMicPermission(): Promise<OnDevicePermission | null> {
    const p = this.getPlugin()
    if (!p) return null
    try {
      return (await p.requestPermissions()).recordAudio ?? null
    } catch {
      return null
    }
  }

  /** 관리자 진단 카드(§11-2 I)만. */
  async readDiagnostics(): Promise<OnDeviceDiagnostics | null> {
    const p = this.getPlugin()
    if (!p?.getDiagnostics) return null
    return p.getDiagnostics()
  }

  async preload(opts: { numThreads?: number } = {}): Promise<{ loadMs: number | null }> {
    const p = this.getPlugin()
    if (!p?.preload) return { loadMs: null }
    const r = await p.preload(opts.numThreads ? { numThreads: opts.numThreads } : undefined)
    return { loadMs: typeof r?.loadMs === 'number' ? r.loadMs : null }
  }

  private startSlowTimer(): void {
    this.stopSlowTimer()
    // 무진행 10초 판정·남은 시간은 시간이 흘러야 바뀐다 — 받는 동안만 1초마다 다시 계산한다.
    this.slowTimer = setInterval(() => this.publish(), 1_000)
  }

  private stopSlowTimer(): void {
    if (this.slowTimer) clearInterval(this.slowTimer)
    this.slowTimer = null
  }
}

let store: OnDeviceModelStore | null = null

/** 앱 전체 스토어(브리지의 플러그인). */
export function onDeviceModelStore(): OnDeviceModelStore {
  if (!store) store = new OnDeviceModelStore({ getPlugin: getOnDeviceStt })
  return store
}

/** 테스트 전용 — 가짜 플러그인으로 스토어를 바꿔 끼운다. */
export function setOnDeviceModelStoreForTest(s: OnDeviceModelStore | null): void {
  store = s
}
