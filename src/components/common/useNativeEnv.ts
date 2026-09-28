'use client'

/**
 * 앱(Capacitor WebView)인가 — 서버 렌더·수화 때는 `{native:false, ready:false}`, 그 뒤 클라이언트 값(screens §11-3 A).
 * 앱 전용 요소는 `ready && native` 일 때만 그린다(수화 불일치 0·웹 DOM 0). `useSyncExternalStore` 의 서버 스냅샷이
 * 수화 동안 쓰이고 곧바로 클라이언트 스냅샷으로 다시 그린다 — effect 안 setState 없이.
 */
import { useSyncExternalStore } from 'react'
import { canOpenAppSettings, isNativeApp } from '@/modules/infra/native'

const noopSubscribe = () => () => {}
const yes = () => true
const no = () => false

export function useNativeEnv(): { native: boolean; ready: boolean } {
  const ready = useSyncExternalStore(noopSubscribe, yes, no)
  const native = useSyncExternalStore(noopSubscribe, isNativeApp, no)
  return { native, ready }
}

/** [앱 설정 열기]를 그릴 수 있는가(플러그인 v1.1) — 같은 방식으로 수화 뒤에만 true. */
export function useCanOpenAppSettings(): boolean {
  return useSyncExternalStore(noopSubscribe, canOpenAppSettings, no)
}
