'use client'

/**
 * 평가 한 건 읽기(#66) — 화면 갈래는 `evalView(status)` 가 정한다. 타인·없는 평가는 404 → `notFound`(같은 화면).
 * 다시 읽기 중에는 옛 값을 그대로 두어 화면이 깜빡이지 않게 한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import type { EvaluationDetail } from '@/types/evaluation'

export type EvalLoad = 'loading' | 'ready' | 'error' | 'notFound'

export interface UseEvaluation {
  load: EvalLoad
  data: EvaluationDetail | null
  reload: () => Promise<EvaluationDetail | null>
  set: (next: EvaluationDetail | ((prev: EvaluationDetail) => EvaluationDetail)) => void
}

export function useEvaluation(id: string): UseEvaluation {
  const [load, setLoad] = useState<EvalLoad>('loading')
  const [data, setData] = useState<EvaluationDetail | null>(null)
  const seq = useRef(0)

  const reload = useCallback(async () => {
    const my = ++seq.current
    try {
      const d = await apiGet<EvaluationDetail>(`/api/v1/evaluations/${encodeURIComponent(id)}`)
      if (my !== seq.current) return null
      setData(d)
      setLoad('ready')
      return d
    } catch (e) {
      if (my !== seq.current) return null
      const err = toErr(e)
      setLoad((prev) => (err.status === 404 ? 'notFound' : prev === 'ready' ? 'ready' : 'error'))
      if (err.status !== 404) throw e
      return null
    }
  }, [id])

  useEffect(() => {
    queueMicrotask(() => {
      reload().catch(() => undefined)
    })
  }, [reload])

  const set = useCallback((next: EvaluationDetail | ((prev: EvaluationDetail) => EvaluationDetail)) => {
    setData((prev) => (typeof next === 'function' ? (prev ? next(prev) : prev) : next))
  }, [])

  return { load, data, reload, set }
}
