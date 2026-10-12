'use client'

/**
 * 보내는 범위 안내 관문(task-064 §25-5 I · 25-12 B 9) — 목록(첫 질문)·질문 방·되묻기 칩이 **이 훅 하나**로 확인한다.
 * 키는 `ASK_KEYS.scopeNotice`(localStorage, 기기별). 읽기 예외는 「안 본 것」(시트가 뜬다 — 안전한 쪽).
 *
 * `acknowledged`: 서버 렌더·첫 수화 = `null`(아직 모름 — 부르는 쪽은 `true` 가 아니면 시트를 띄운다), 그 뒤 `true|false`.
 * `ack()`: 「알겠어요, 보내기」 — 키를 쓰고, 저장이 막힌 기기에서도 이 페이지 동안은 다시 묻지 않는다.
 * 대기 중인 보내기(시트 뒤에 이을 글)는 부르는 화면이 하나만 든다 — 시트가 열린 동안 또 보내면 덮어쓴다.
 */
import { useCallback, useSyncExternalStore } from 'react'
import { readStore, writeStore } from '@/components/common/storage'
import { ASK_KEYS } from './logic'

export function scopeNoticeAcked(raw: string | null): boolean {
  return raw === '1'
}

export function readScopeNoticeAck(): boolean {
  return scopeNoticeAcked(readStore('local', ASK_KEYS.scopeNotice))
}

export function writeScopeNoticeAck(): void {
  writeStore('local', ASK_KEYS.scopeNotice, '1')
}

let ackedThisPage = false
const listeners = new Set<() => void>()

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  // 다른 탭에서 확인한 것도 따라간다.
  const onStorage = (e: StorageEvent) => {
    if (e.key === ASK_KEYS.scopeNotice) fn()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(fn)
    window.removeEventListener('storage', onStorage)
  }
}

const snapshot = (): boolean => ackedThisPage || readScopeNoticeAck()
const onServer = (): null => null

export function useScopeNoticeGate(): { acknowledged: boolean | null; ack(): void } {
  const acknowledged = useSyncExternalStore<boolean | null>(subscribe, snapshot, onServer)
  const ack = useCallback(() => {
    writeScopeNoticeAck()
    ackedThisPage = true
    for (const fn of listeners) fn()
  }, [])
  return { acknowledged, ack }
}
