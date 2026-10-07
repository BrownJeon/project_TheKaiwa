'use client'

/**
 * 첫마디 일본어 제안(#178 `POST /api/v1/scenarios/openings/draft`, D5=A — screens.md §16-2 `OpeningField`·§16-4 `useOpeningDraft`).
 * 제안만(행 없음) — 받은 일본어는 편집 값에만 넣고 저장은 상황 저장(#163·#164·#175)이 한다. 읽기는 확인용이라 저장하지 않는다.
 * 요청 한 건의 규칙(한 번에 하나·시작 직후 취소 잠금·30초 상한)은 `openingFlight.ts`(순수 제어기, 시험 있음) — 이 훅은 그 상태를 React 에 잇기만 한다.
 */
import { useEffect, useState } from 'react'
import { apiPost } from '@/components/common/api'
import { createOpeningFlight, OPENING_IDLE, type OpeningFlight, type OpeningFlightState } from './openingFlight'

export { OPENING_CANCEL_LOCK_MS, OPENING_TIMEOUT_MS, type OpeningPhase } from './openingFlight'

export interface OpeningDraftModel extends OpeningFlightState {
  make: OpeningFlight['make']
  cancel: OpeningFlight['cancel']
  clear: OpeningFlight['clear']
}

export function useOpeningDraft(): OpeningDraftModel {
  const [state, setState] = useState<OpeningFlightState>(OPENING_IDLE)
  const [flight] = useState(() =>
    createOpeningFlight({
      post: (body, signal) => apiPost<unknown>('/api/v1/scenarios/openings/draft', body, { signal }),
      onState: setState,
    }),
  )

  useEffect(() => () => flight.dispose(), [flight])

  return { ...state, make: flight.make, cancel: flight.cancel, clear: flight.clear }
}
