'use client'

/**
 * 관리 화면(S2) 데이터 — 두 탭이 같은 값을 나눠 쓰는 훅 하나(탭을 바꿀 때 다시 읽지 않는다). 네 요청 병렬(`Promise.allSettled`):
 * #56 주제·#179 시드 사용자별 상태는 필수(하나라도 실패하면 화면 오류 — #179 없이는 내 버전을 「내 주제」로 잘못 보인다),
 * #161 상황·#155 진행 중 챌린지는 선택(실패하면 `scenarios`/`active` 만 null — 목록은 보이고 「상황 n개」·뱃지만 빠진다).
 * `refresh()` 는 지금 값을 둔 채 조용히 다시 읽는다(바꾼 뒤·되돌린 뒤 — 자리표시로 되돌리지 않음, R1). 늦은 응답은 순번으로 버린다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChallengeListResponse } from '@/types/challenge'
import type { Topic } from '@/types/lesson'
import type { ScenarioListItem } from '@/types/scenario'
import type { SeedOverrideItem } from '@/types/seedOverride'
import { getActiveChallenge, getManageScenarios, getManageTopics, getSeedOverrides } from './api'

export interface ManageData {
  topics: Topic[]
  overrides: SeedOverrideItem[]
  /** #161 이 실패했으면 null. */
  scenarios: ScenarioListItem[] | null
  /** #155 가 실패했으면 null(진행 중 챌린지가 없으면 빈 목록). */
  challenges: ChallengeListResponse | null
}

type State = { status: 'loading' | 'ready' | 'error'; data: ManageData | null }

export function useManageData() {
  const [state, setState] = useState<State>({ status: 'loading', data: null })
  const seq = useRef(0)

  const request = useCallback((silent: boolean) => {
    const id = ++seq.current
    void Promise.allSettled([getManageTopics(), getSeedOverrides(), getManageScenarios(), getActiveChallenge()]).then(([topics, overrides, scenarios, challenges]) => {
      if (id !== seq.current) return
      setState((s) => {
        if (topics.status === 'rejected' || overrides.status === 'rejected') return silent && s.data ? s : { status: 'error', data: null }
        const prev = silent ? s.data : null
        return {
          status: 'ready',
          data: {
            topics: topics.value,
            overrides: overrides.value,
            scenarios: scenarios.status === 'fulfilled' ? scenarios.value : (prev?.scenarios ?? null),
            challenges: challenges.status === 'fulfilled' ? challenges.value : (prev?.challenges ?? null),
          },
        }
      })
    })
  }, [])

  useEffect(() => {
    request(false)
  }, [request])

  /** 오류 상자의 [다시 시도] — 자리표시부터 다시. */
  const reload = useCallback(() => {
    setState({ status: 'loading', data: null })
    request(false)
  }, [request])
  const refresh = useCallback(() => request(true), [request])

  return { ...state, reload, refresh }
}
