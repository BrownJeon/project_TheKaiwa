'use client'

/**
 * 주제 보기(S6) 데이터 — 주제 상세 API 가 없어 관리 화면과 같은 네 요청을 병렬로 읽고(`Promise.allSettled`) id 로 고른다(screens.md §16-0 #3·§16-4).
 * #56 주제·#179 시드 사용자별 상태는 필수(없으면 내 버전을 「내 주제」로 잘못 보인다 — 화면 오류), #161 상황·#155 진행 중 챌린지는 선택(실패하면 그 절만).
 * 「이 주제의 상황」은 #161 전체에서 `topics[].id` 로 거른다(관리 화면 「상황 n개」와 같은 셈 — 같은 값이 두 화면에 다르게 보이지 않게).
 * 값은 받은 id 에 묶어 둔다 — 되돌리기 뒤 시드 id 로 옮겨 가면 옛 주제 값을 보이지 않고 자리표시부터(`forId` 로 판정, 효과 안에서 상태를 지우지 않는다).
 * `refresh()` 는 지금 값을 둔 채 조용히 다시 읽는다(R1). 늦은 응답은 순번으로 버린다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChallengeListResponse } from '@/types/challenge'
import type { Topic } from '@/types/lesson'
import type { ScenarioListItem } from '@/types/scenario'
import type { SeedOverrideItem } from '@/types/seedOverride'
import { getActiveChallenge, getManageScenarios, getManageTopics, getSeedOverrides } from './api'
import { buildTopicDetail, type TopicDetailView } from './logic'

interface Raw {
  topics: Topic[]
  overrides: SeedOverrideItem[]
  scenarios: ScenarioListItem[] | null
  challenges: ChallengeListResponse | null
}

type State = { forId: string | null; status: 'loading' | 'ready' | 'error'; raw: Raw | null }

export type TopicDetailStatus = 'loading' | 'ready' | 'error' | 'notFound'

export function useTopicDetail(id: string) {
  const [state, setState] = useState<State>({ forId: null, status: 'loading', raw: null })
  const seq = useRef(0)

  const request = useCallback((forId: string, silent: boolean) => {
    const my = ++seq.current
    void Promise.allSettled([getManageTopics(), getSeedOverrides(), getManageScenarios(), getActiveChallenge()]).then(([topics, overrides, scenarios, challenges]) => {
      if (my !== seq.current) return
      setState((s) => {
        const keep = silent && s.forId === forId ? s.raw : null
        if (topics.status === 'rejected' || overrides.status === 'rejected') return keep ? s : { forId, status: 'error', raw: null }
        return {
          forId,
          status: 'ready',
          raw: {
            topics: topics.value,
            overrides: overrides.value,
            scenarios: scenarios.status === 'fulfilled' ? scenarios.value : (keep?.scenarios ?? null),
            challenges: challenges.status === 'fulfilled' ? challenges.value : (keep?.challenges ?? null),
          },
        }
      })
    })
  }, [])

  useEffect(() => {
    request(id, false)
  }, [id, request])

  const current = state.forId === id ? state : null
  const raw = current?.raw ?? null
  const view = useMemo<TopicDetailView | null>(() => (raw ? buildTopicDetail(id, raw) : null), [raw, id])
  const status: TopicDetailStatus = !current || current.status === 'loading' ? 'loading' : current.status === 'error' ? 'error' : view ? 'ready' : 'notFound'

  /** 오류 상자의 [다시 시도] — 자리표시부터. */
  const reload = useCallback(() => {
    setState({ forId: null, status: 'loading', raw: null })
    request(id, false)
  }, [id, request])
  const refresh = useCallback(() => request(id, true), [id, request])
  return { status, view, reload, refresh }
}
