'use client'

/**
 * 생성 잡 지켜보기(#55) — 화면이 보이는 동안만 확인하고, 가려지면 멈췄다가 다시 보이면 바로 한 번 확인한다.
 * 간격은 `delays`(마지막 값을 반복). `DONE`·`FAILED` 가 되면 `onSettled` 한 번. 네트워크 실패는 `offline` 으로 알리고 계속 확인한다.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { apiGet } from '@/components/common/api'
import { toErr } from '@/components/common/errors'

interface JobView {
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED'
  stage: string | null
}

export function useJobWatch(jobId: string | null, o: { delays: number[]; onSettled: (status: 'DONE' | 'FAILED') => void }): { stage: string | null; offline: boolean } {
  const [stage, setStage] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const settledRef = useRef(o.onSettled)
  useLayoutEffect(() => {
    settledRef.current = o.onSettled
  })
  const delaysKey = o.delays.join(',')

  useEffect(() => {
    if (!jobId) return
    const delays = delaysKey.split(',').map(Number)
    let timer: ReturnType<typeof setTimeout> | null = null
    let n = 0
    let stopped = false
    let inFlight = false
    const schedule = () => {
      if (stopped || document.visibilityState === 'hidden') return
      timer = setTimeout(check, delays[Math.min(n, delays.length - 1)])
      n++
    }
    const check = async () => {
      timer = null
      if (stopped || inFlight) return
      inFlight = true
      try {
        const j = await apiGet<JobView>(`/api/v1/jobs/${encodeURIComponent(jobId)}`)
        if (stopped) return
        setOffline(false)
        setStage(j.stage)
        if (j.status === 'DONE' || j.status === 'FAILED') {
          stopped = true
          settledRef.current(j.status)
          return
        }
      } catch (e) {
        if (stopped) return
        const err = toErr(e)
        if (err.status === 404) {
          stopped = true
          settledRef.current('FAILED')
          return
        }
        setOffline(err.status === 0)
      } finally {
        inFlight = false
      }
      schedule()
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        if (timer) clearTimeout(timer)
        void check()
      } else if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }
    schedule()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [jobId, delaysKey])

  return { stage, offline }
}
