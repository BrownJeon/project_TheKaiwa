'use client'

/**
 * 「내가 한 말」 한국어 뜻 훅(task-077 §34-4·§34-8) — 규칙·요청 수명주기는 `speakTranslation.ts`, 여기는 React 상태로 옮길 뿐이다.
 *  - 뜻 메모리(`Map<text, ko>`)는 수업 화면(`LessonStages`)이 `useSpeakTrCache` 로 들고 내려 준다 — 단계를 오가도 같은 글은 다시 묻지 않고,
 *    수업 화면을 떠나면 사라진다(저장 없음, L1).
 *  - 요청은 #185 `POST /api/v1/lessons/:id/speaking-translation {text}` 하나(본문에 다른 칸을 실으면 400).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiPost } from '@/components/common/api'
import type { LessonSpeakingTranslation } from '@/types/lesson'
import { createSpeakTranslator, speakTrView, type SpeakTrPlan, type SpeakTrState } from './speakTranslation'

export interface SpeakTrCache {
  map: ReadonlyMap<string, string>
  add: (text: string, ko: string) => void
}

/** 수업 화면 동안의 뜻 메모리. */
export function useSpeakTrCache(): SpeakTrCache {
  const [map, setMap] = useState<ReadonlyMap<string, string>>(() => new Map())
  const add = useCallback((text: string, ko: string) => {
    setMap((prev) => (prev.get(text) === ko ? prev : new Map(prev).set(text, ko)))
  }, [])
  return useMemo(() => ({ map, add }), [map, add])
}

/** #185 요청 함수 — 본문은 `{ text }` 하나. */
export function speakTrRequest(lessonId: string) {
  const path = `/api/v1/lessons/${encodeURIComponent(lessonId)}/speaking-translation`
  return (text: string, signal: AbortSignal) => apiPost<LessonSpeakingTranslation>(path, { text }, { signal })
}

export interface SpeakTrInput {
  lessonId: string
  /** 화면에 보이는 결과(없거나 건너뛰었으면 null) — `key` 는 결과 하나를 가리킨다(과제 · 시도 번호). */
  target: { key: string; text: string; plan: SpeakTrPlan } | null
  /** 말하는 중·확인 중 — 받는 중인 요청을 끊고 기다린다. */
  paused: boolean
  cache: SpeakTrCache
}

export function useSpeakTranslation({ lessonId, target, paused, cache }: SpeakTrInput): { state: SpeakTrState; retry: () => void } {
  const [cur, setCur] = useState<{ key: string | null; state: SpeakTrState }>({ key: null, state: { s: 'idle' } })
  const { add } = cache
  const [tr] = useState(() =>
    createSpeakTranslator({
      request: (text, signal) => speakTrRequest(lessonId)(text, signal),
      onState: (key, state) => setCur({ key, state }),
      onCache: (text, ko) => add(text, ko),
    }),
  )
  useEffect(() => () => tr.dispose(), [tr])

  const plan: SpeakTrPlan = target ? target.plan : { kind: 'skip' }
  const key = target?.key ?? ''
  const text = target?.text ?? ''
  const state = speakTrView(plan, text, cache.map, cur, key)
  const fetchTarget = target && plan.kind === 'fetch'
  const cached = cache.map.has(text)
  const idle = state.s === 'idle'

  useEffect(() => {
    tr.sync(fetchTarget ? { key, text } : null, { paused, cached, idle })
  }, [tr, fetchTarget, key, text, paused, cached, idle])

  const retry = useCallback(() => {
    if (fetchTarget) tr.retry({ key, text })
  }, [tr, fetchTarget, key, text])

  return { state, retry }
}
