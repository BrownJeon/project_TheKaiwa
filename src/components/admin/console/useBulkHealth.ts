'use client'

/**
 * 여러 연결의 상태 확인(#95)을 **순서대로** 돌린다(screens.md §6-2 D·H) — CLI spawn·M4 부하 때문에 병렬 금지.
 * 새 API 없이 #95 를 N번 부른다. 끝나면 토스트로 결과를 알린다 — `run()` 이 끝난 뒤 호출부가 목록을 다시 읽는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiPost } from '@/components/common/api'
import { useConsoleToast } from './ConsoleProvider'

export interface BulkState {
  done: number
  total: number
  failed: number
}

export function useBulkHealth() {
  const toast = useConsoleToast()
  const [bulk, setBulk] = useState<BulkState | null>(null)
  const aliveRef = useRef(true)
  const runningRef = useRef(false)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  const run = useCallback(
    async (ids: string[]): Promise<void> => {
      if (runningRef.current || ids.length === 0) return
      runningRef.current = true
      let failed = 0
      setBulk({ done: 0, total: ids.length, failed: 0 })
      for (let i = 0; i < ids.length; i++) {
        if (!aliveRef.current) break
        try {
          await apiPost(`/api/admin/v1/engine-connections/${encodeURIComponent(ids[i])}/health`, {})
        } catch {
          // 꺼진 서비스는 200(UNAVAILABLE)으로 온다 — 여기로 오는 것은 실행 자체를 못 한 경우(403·429·500·네트워크)뿐이다.
          failed += 1
        }
        if (aliveRef.current) setBulk({ done: i + 1, total: ids.length, failed })
      }
      runningRef.current = false
      if (!aliveRef.current) return
      setBulk(null)
      toast(failed > 0 ? `${failed}개는 실행하지 못했어요` : `${ids.length}개 연결을 확인했어요`)
    },
    [toast],
  )

  return { bulk, run }
}
