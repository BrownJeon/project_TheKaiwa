'use client'

/**
 * 단어장·오늘의 단어 공용 훅.
 *
 * 저장된 선택값(정렬·방식·분류·읽기)과 미디어 쿼리는 `useSyncExternalStore` 로 읽는다 — 서버 렌더는 기본값, 클라이언트는
 * 저장값으로 **하이드레이션 불일치 없이** 바뀐다. 저장소가 막힌 환경(사생활 모드·WebView 설정)에서도 이번 방문 동안은
 * 고른 값이 유지되도록 메모리 사본을 먼저 본다.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { apiGet, apiPost } from '@/components/common/api'
import { readStore, writeStore } from '@/components/common/storage'
import { isSeedPack, type SeedPack } from '@/types/seedPack'
import type { SeedPackResult } from '@/types/vocab'
import { seedLevelsFrom } from './labels'

export const VOCAB_KEYS = {
  wordsSort: 'kaiwa.words.sort',
  mode: 'kaiwa.vocab.mode',
  category: 'kaiwa.vocab.category',
  readingDefault: 'kaiwa.vocab.readingDefault',
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

/**
 * #46b 기본 단어 팩(단계 다섯 개, task-051 §19-4 D). 결과 문구·목록 갱신은 호출부가 한다(§4-5).
 * 상태 갱신 전에 들어온 두 번째 탭은 `inFlight` 로 막는다 — 화면 쪽 `if (seedingPack) return` 은 렌더 뒤에야 참이 된다.
 * 진행 중 두 번째 호출은 `null` 을 돌려준다(아무 일도 하지 않음).
 */
export function useSeedPack() {
  const [seedingPack, setSeedingPack] = useState<SeedPack | null>(null)
  const inFlight = useRef(false)
  const seed = useCallback(async (pack: SeedPack): Promise<SeedPackResult | null> => {
    if (inFlight.current || !isSeedPack(pack)) return null
    inFlight.current = true
    setSeedingPack(pack)
    try {
      return await apiPost<SeedPackResult>('/api/v1/words/seed-pack', { pack })
    } finally {
      inFlight.current = false
      setSeedingPack(null)
    }
  }, [])
  return { seed, seedingPack }
}

export interface SeedLevels {
  status: 'loading' | 'ready' | 'error'
  main: SeedPack | null
  goal: SeedPack | null
  retry: () => void
}

/**
 * 넣기 단계(§19-3) — #11 `GET /api/v1/settings/profile` 의 `level`(주)·`goalLevel`(보조). 마운트 때 한 번 읽는다
 * (설정에서 바꾸고 돌아오면 화면이 다시 마운트된다). 실패하면 `error` 이고 넣기 버튼을 그리지 않는다.
 */
export function useSeedLevels(): SeedLevels {
  const [state, setState] = useState<Omit<SeedLevels, 'retry'>>({ status: 'loading', main: null, goal: null })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let cancelled = false
    apiGet<unknown>('/api/v1/settings/profile').then(
      (raw) => {
        if (cancelled) return
        const { main, goal } = seedLevelsFrom(raw)
        setState(main === null ? { status: 'error', main: null, goal: null } : { status: 'ready', main, goal })
      },
      () => {
        if (!cancelled) setState({ status: 'error', main: null, goal: null })
      },
    )
    return () => {
      cancelled = true
    }
  }, [tick])
  const retry = useCallback(() => {
    setState({ status: 'loading', main: null, goal: null })
    setTick((t) => t + 1)
  }, [])
  return { ...state, retry }
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
