'use client'

/**
 * 상황 상세(S2 = #162) — 시트를 열 때 읽는다. 계획표·챌린지와 같은 `useKeyedResource`(요청 키와 함께 보관, 늦은 응답 버림).
 * `errStatus` 404 = 없는 상황·지운 상황·남의 상황(시트 `sh-404`·초안 `dr-edit-404`). 결과 화면·수업 종료 카드(B3)도 이 훅을 쓴다.
 */
import { useKeyedResource } from '@/components/plan/usePlanData'
import type { ScenarioDetail } from '@/types/scenario'

const detailPath = (id: string) => `/api/v1/scenarios/${encodeURIComponent(id)}`

export function useScenarioDetail(id: string | null) {
  return useKeyedResource<ScenarioDetail>(id, detailPath)
}
