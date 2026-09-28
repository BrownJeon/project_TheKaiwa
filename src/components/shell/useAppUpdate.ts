'use client'

/**
 * APK 업데이트 스토어 — 앱 전체 1개(screens §11-3 E). 웹에서는 아무것도 부르지 않는다(`getAppInfo()` 가 null 이면 끝).
 *
 *  - 첫 마운트(셸·로그인) 때 #8 을 1회, 앱이 다시 앞으로 오면(resume) 마지막 확인이 6시간 넘었을 때만 다시.
 *  - 판정은 **versionCode 정수로만**(Leader ③): 내 번호 < `minSupportedCode` = 강제(닫기 없음·모든 화면) · 내 번호 < `latestCode` = 권장.
 *  - 권장 띠 ✕ = 그날(KST) 동안 숨김(`localStorage`, 막히면 이번 실행만). 더 새 번호가 나오면 다시 보인다.
 *  - 강제 상태면 음성 라우터가 휴대폰 경로를 쓰지 않는다(`isAppUpdateRequired`, Leader ④).
 *  - #8 실패는 조용히 `hidden` — 띠 때문에 오류를 보이지 않는다.
 */
import { useSyncExternalStore } from 'react'
import { setClientAppVersion } from '@/components/common/api'
import { readStore, writeStore } from '@/components/common/storage'
import { todayKst } from '@/modules/infra/dates'
import { getAppInfo, onAppResume } from '@/modules/infra/native'

export type AppUpdateState = 'hidden' | 'recommended' | 'forced'

export interface AppUpdateLatest {
  name: string
  code: number
  notes: string | null
  url: string
  publishedAt: string | null
  bytes: number | null
}

export interface AppUpdateSnapshot {
  state: AppUpdateState
  mine: { name: string; code: number } | null
  latest: AppUpdateLatest | null
  dismissedToday: boolean
}

/** #8 응답 중 쓰는 부분. */
export interface AppVersionResponse {
  latest: string | null
  latestCode: number | null
  minSupportedCode: number | null
  url: string | null
  notes: string | null
  bytes?: number | null
  publishedAt: string | null
}

export const DISMISS_KEY = 'kaiwa.app.update.dismissed'
export const RECHECK_MS = 6 * 60 * 60 * 1000
const HIDDEN: AppUpdateSnapshot = { state: 'hidden', mine: null, latest: null, dismissedToday: false }

/** 받기 주소는 같은 출처의 `/app/download/` 만 연다(screens §11-2 G) — 아니면 같은 출처 기본 경로. */
export function safeDownloadUrl(raw: string | null | undefined, origin: string): string {
  const fallback = new URL('/app/download/latest.apk', origin).toString()
  if (!raw) return fallback
  try {
    const u = new URL(raw, origin)
    return u.origin === new URL(origin).origin && u.pathname.startsWith('/app/download/') ? u.toString() : fallback
  } catch {
    return fallback
  }
}

/** 순수 판정. `dismissed` = 저장된 닫기 기록. */
export function decideAppUpdate(
  mine: { name: string; code: number } | null,
  info: AppVersionResponse | null,
  dismissed: { code: number; day: string } | null,
  today: string,
  origin: string,
): AppUpdateSnapshot {
  if (!mine || !info || typeof info.latestCode !== 'number' || typeof info.latest !== 'string') return { ...HIDDEN, mine }
  const latest: AppUpdateLatest = {
    name: info.latest,
    code: info.latestCode,
    notes: typeof info.notes === 'string' && info.notes.trim() ? info.notes : null,
    url: safeDownloadUrl(info.url, origin),
    publishedAt: info.publishedAt ?? null,
    bytes: typeof info.bytes === 'number' && info.bytes > 0 ? info.bytes : null,
  }
  const forced = typeof info.minSupportedCode === 'number' && mine.code < info.minSupportedCode
  const behind = mine.code < info.latestCode
  const dismissedToday = !!dismissed && dismissed.day === today && dismissed.code >= latest.code
  return { state: forced ? 'forced' : behind ? 'recommended' : 'hidden', mine, latest, dismissedToday }
}

function readDismissed(): { code: number; day: string } | null {
  const raw = readStore('local', DISMISS_KEY)
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as { code?: unknown; day?: unknown }
    return typeof v.code === 'number' && typeof v.day === 'string' ? { code: v.code, day: v.day } : null
  } catch {
    return null
  }
}

async function fetchVersion(mine: { name: string; code: number }): Promise<AppVersionResponse | null> {
  try {
    const res = await fetch('/api/app/version', {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { 'X-Client-Platform': 'app', 'X-App-Version': mine.name, 'X-App-Build': String(mine.code) },
    })
    if (!res.ok) return null
    const body = (await res.json()) as { success?: boolean; data?: AppVersionResponse }
    return body.success === true && body.data ? body.data : null
  } catch {
    return null
  }
}

class AppUpdateStore {
  private snap: AppUpdateSnapshot = HIDDEN
  private readonly listeners = new Set<() => void>()
  private started = false
  private lastCheckAt = 0
  private info: AppVersionResponse | null = null
  private mine: { name: string; code: number } | null = null
  private memDismiss: { code: number; day: string } | null = null

  snapshot = (): AppUpdateSnapshot => this.snap
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    this.start()
    return () => this.listeners.delete(fn)
  }

  private publish(): void {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://localhost'
    this.snap = decideAppUpdate(this.mine, this.info, readDismissed() ?? this.memDismiss, todayKst(), origin)
    for (const fn of [...this.listeners]) fn()
  }

  private start(): void {
    if (this.started || typeof window === 'undefined') return
    this.started = true
    void this.check()
    onAppResume(() => {
      if (Date.now() - this.lastCheckAt > RECHECK_MS) void this.check()
      else this.publish()
    })
  }

  private async check(): Promise<void> {
    if (!this.mine) {
      this.mine = await getAppInfo()
      setClientAppVersion(this.mine)
    }
    if (!this.mine) return
    this.lastCheckAt = Date.now()
    this.info = await fetchVersion(this.mine)
    this.publish()
  }

  dismiss(): void {
    const latest = this.snap.latest
    if (!latest) return
    const v = { code: latest.code, day: todayKst() }
    this.memDismiss = v
    writeStore('local', DISMISS_KEY, JSON.stringify(v))
    this.publish()
  }

  isForced(): boolean {
    return this.snap.state === 'forced'
  }
}

const store = new AppUpdateStore()

export function useAppUpdate(): AppUpdateSnapshot & { dismiss: () => void } {
  const snap = useSyncExternalStore(store.subscribe, store.snapshot, () => HIDDEN)
  return { ...snap, dismiss: () => store.dismiss() }
}

/** 음성 라우터 입력 — 강제 업데이트 상태면 휴대폰 경로를 쓰지 않는다. */
export function isAppUpdateRequired(): boolean {
  return store.isForced()
}
