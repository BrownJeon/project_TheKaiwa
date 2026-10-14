'use client'

/**
 * 단어장·오늘의 단어 공용 훅.
 *
 * 저장된 선택값(정렬·분류·읽기)과 미디어 쿼리는 `useSyncExternalStore` 로 읽는다 — 서버 렌더는 기본값, 클라이언트는
 * 저장값으로 **하이드레이션 불일치 없이** 바뀐다. 저장소가 막힌 환경(사생활 모드·WebView 설정)에서도 이번 방문 동안은
 * 고른 값이 유지되도록 메모리 사본을 먼저 본다.
 */
import { useCallback, useSyncExternalStore } from 'react'
import { readStore, writeStore } from '@/components/common/storage'

export const VOCAB_KEYS = {
  wordsSort: 'kaiwa.words.sort',
  /** task-059 로 폐기(푸는 방식 선택 없음) — 읽지도 쓰지 않는다. `TodayHome` 이 마운트 때 옛 값을 지우려고 키만 남긴다. */
  mode: 'kaiwa.vocab.mode',
  category: 'kaiwa.vocab.category',
  /** 덱 앞면 [읽기] = 히라가나(루비)만('on'|'off', task-060 전에는 한글 줄도 함께 켰다). */
  readingDefault: 'kaiwa.vocab.readingDefault',
  /** 덱 앞면 [한글] = 한글 표기 줄만('on'|'off', task-060). 비어 있으면 `readingDefault` 값을 이어받는다(`deck.hangulPrefOf`). */
  hangulDefault: 'kaiwa.vocab.hangulDefault',
  /** 세트를 만든 화면 → 덱: 강등 사유(한 번 읽고 지운다) */
  notice: (sessionId: string) => `kaiwa.vocab.notice.${sessionId}`,
  /** 덱 → 오늘 홈: 한 번 띄울 토스트 문구 */
  flash: 'kaiwa.vocab.flash',
  /** 오늘 카드·결과 [시작하기]·[한 세트 더] → 새 단어 대기 화면: 시작 값(task-044 E2, 60초) */
  topicStart: 'kaiwa.vocab.topicStart',
  /** 대기 화면 → 덱 첫 열기: #47 `generation`(출처·사유 — 한 번 읽고 지운다) */
  topicGen: (sessionId: string) => `kaiwa.vocab.topicGen.${sessionId}`,
  /** 대기 화면 빈 상태 [내 단어장으로 풀기] → 오늘 홈: 내 단어장 패널을 펼친 채(한 번) */
  openMine: 'kaiwa.vocab.openMine',
  /** 단어장 처음 한 번 안내 띠(task-068 J9)를 닫았는가 — 값 `'1'`. 이 기기에만 남는다. */
  baseBand: 'kaiwa.words.baseBand',
} as const

const memory = new Map<string, string | null>()
const listeners = new Set<() => void>()

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  const onStorage = () => cb()
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', onStorage)
  }
}

function readPref(key: string): string | null {
  return memory.has(key) ? (memory.get(key) ?? null) : readStore('local', key)
}

/**
 * 로컬 저장 선택값. `allowed` 에 없는 값(옛 값·손으로 고친 값)은 기본값으로 본다.
 * 반환 setter 에 null 을 주면 지운다.
 */
export function useStoredPref<T extends string>(key: string, fallback: T, allowed: readonly T[]): [T, (v: T | null) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => readPref(key),
    () => null,
  )
  const value = raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback
  const set = useCallback(
    (v: T | null) => {
      memory.set(key, v)
      writeStore('local', key, v)
      for (const l of listeners) l()
    },
    [key],
  )
  return [value, set]
}

/** 자유 문자열 선택값(분류 이름). 유효성은 호출부가 목록과 대조한다. */
export function useStoredString(key: string): [string | null, (v: string | null) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => readPref(key),
    () => null,
  )
  const set = useCallback(
    (v: string | null) => {
      memory.set(key, v)
      writeStore('local', key, v)
      for (const l of listeners) l()
    },
    [key],
  )
  return [raw, set]
}

const noopSubscribe = () => () => {}

/** 하이드레이션이 끝났는가 — 서버 렌더와 첫 클라이언트 렌더는 false. 쿼리로 여는 시트를 서버 HTML 과 어긋나지 않게 연다. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
}

export function useMediaQuery(query: string): boolean {
  const subscribeQuery = useCallback(
    (cb: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mq = window.matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribeQuery,
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    () => false,
  )
}

/** sessionStorage 의 한 번 쓰는 값 — 읽으면서 지운다. */
export function takeSession(key: string): string | null {
  const v = readStore('session', key)
  if (v !== null) writeStore('session', key, null)
  return v
}

export function putSession(key: string, value: string): void {
  writeStore('session', key, value)
}
