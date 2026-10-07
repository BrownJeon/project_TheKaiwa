'use client'

/**
 * 첫마디 일본어 제안(#178 `POST /api/v1/scenarios/openings/draft`, D5=A — screens.md §16-2 `OpeningField`·§16-4 `useOpeningDraft`).
 * 제안만(행 없음) — 받은 일본어는 편집 값에만 넣고 저장은 상황 저장(#163·#164·#175)이 한다. 읽기는 확인용이라 저장하지 않는다.
 * **요청은 한 번에 하나**: 409 `DRAFT_BUSY` 도 분·하루 한도를 쓰므로 만드는 중에는 다시 보내지 않는다(더블 탭 방지, ref 가드).
 * [그만두기] = abort(서버는 계속 돌아 곧바로 다시 누르면 409 — 문구는 `failure.ts`). 벽시계 상한 30초(서버 예산 25초 + 여유).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiPost, isAbort } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { scenarioFailure, type ScenarioFailure } from './failure'
import { openingDraftResult, openingRequestBody, type EditableDraft } from './logic'

export const OPENING_TIMEOUT_MS = 30_000

export type OpeningPhase = 'idle' | 'busy' | 'failed'

export interface OpeningDraftModel {
  phase: OpeningPhase
  failure: ScenarioFailure | null
  /** 마지막으로 받은 일본어를 서버가 줄였는지(`JA_TRUNCATED`). */
  truncated: boolean
  /** 지금 편집 값으로 요청 — 성공하면 `onResult(보낸 한국어, 결과)`. 요청 중이면 아무것도 하지 않는다. */
  make: (draft: EditableDraft, placeTitle: string | null, onResult: (sentKo: string, r: { ja: string; reading: string | null }) => void) => void
  cancel: () => void
  /** 한국어를 고치면 지난 실패·줄임 안내를 지운다. */
  clear: () => void
}

export function useOpeningDraft(): OpeningDraftModel {
  const [phase, setPhase] = useState<OpeningPhase>('idle')
  const [failure, setFailure] = useState<ScenarioFailure | null>(null)
  const [truncated, setTruncated] = useState(false)
  const req = useRef<{ ac: AbortController | null; timer: ReturnType<typeof setTimeout> | null; timedOut: boolean }>({ ac: null, timer: null, timedOut: false })

  const end = () => {
    if (req.current.timer) clearTimeout(req.current.timer)
    req.current = { ac: null, timer: null, timedOut: false }
  }

  useEffect(
    () => () => {
      req.current.ac?.abort()
      if (req.current.timer) clearTimeout(req.current.timer)
    },
    [],
  )

  const make = useCallback<OpeningDraftModel['make']>((draft, placeTitle, onResult) => {
    if (req.current.ac) return
    const body = openingRequestBody(draft, placeTitle)
    if (!body.ko) return
    const ac = new AbortController()
    req.current = { ac, timer: null, timedOut: false }
    req.current.timer = setTimeout(() => {
      req.current.timedOut = true
      ac.abort()
    }, OPENING_TIMEOUT_MS)
    setPhase('busy')
    setFailure(null)
    setTruncated(false)
    apiPost<unknown>('/api/v1/scenarios/openings/draft', body, { signal: ac.signal }).then(
      (raw) => {
        if (req.current.ac !== ac) return
        end()
        const r = openingDraftResult(raw)
        if (!r) {
          setFailure(scenarioFailure('openingDraft', { status: 502, message: '', code: null, details: {}, retryAfterSec: null }))
          setPhase('failed')
          return
        }
        setTruncated(r.truncated)
        setPhase('idle')
        onResult(body.ko, r)
      },
      (e: unknown) => {
        if (req.current.ac !== ac) return
        const timedOut = req.current.timedOut
        end()
        if (isAbort(e) && !timedOut) {
          setPhase('idle')
          return
        }
        const err = toErr(e)
        setFailure(scenarioFailure('openingDraft', timedOut ? { ...err, status: 504 } : err))
        setPhase('failed')
      },
    )
  }, [])

  const cancel = useCallback(() => {
    const ac = req.current.ac
    if (!ac) return
    end()
    ac.abort()
    setPhase('idle')
  }, [])

  const clear = useCallback(() => {
    if (req.current.ac) return
    setFailure(null)
    setTruncated(false)
    setPhase('idle')
  }, [])

  return { phase, failure, truncated, make, cancel, clear }
}
