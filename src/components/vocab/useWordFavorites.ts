'use client'

/**
 * 즐겨찾기 별 훅(task-074 §32-9) — 규칙은 `favorite.ts` 의 컨트롤러가 갖고, 이 훅은 요청 함수·React 상태·효과 전달만 잇는다.
 * 기록은 단어장 화면이 하나 갖고 목록 행과 열린 시트가 함께 본다.
 *
 * 컨트롤러는 효과 안에서 만들고 정리 때 `dispose()` 한다 — 개발 모드 StrictMode 는 효과를 한 번 껐다 켜므로 렌더 중에 만들면
 * 꺼진 컨트롤러가 남는다. 언마운트 뒤 도착한 응답은 상태·효과 0.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiPost } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import type { WordFavoriteResponse } from '@/types/vocab'
import { createFavoriteController, favoriteView, type FavEffect, type FavoriteController, type FavState, type FavView } from './favorite'

export interface WordFavorites {
  /** `shown` = 누른 순간 보인 값. 처리 중인 단어면 무시(요청 0). */
  press: (id: string, shown: boolean) => void
  /** 그릴 별 — 서버 값(`word.favorite`)은 반드시 이 함수를 거친다(`readAt` = 그 값을 읽기 시작한 시각). */
  view: (id: string, server: boolean | undefined, readAt: number) => FavView
  /** 지금 시각(목록·시트가 요청을 보내기 직전에 잡는다). */
  stamp: () => number
}

const now = () => performance.now()

export function sendFavorite(id: string, to: boolean): Promise<WordFavoriteResponse> {
  return apiPost<WordFavoriteResponse>(`/api/v1/words/${encodeURIComponent(id)}/${to ? 'favorite' : 'unfavorite'}`).catch((e: unknown) => {
    throw Object.assign(new Error('favorite'), { status: toErr(e).status })
  })
}

/**
 * 컨트롤러 한 벌의 수명(효과 하나) — 만들어 `slot` 에 두고, 돌려준 정리 함수가 `dispose()` 한다(그 뒤 도착한 응답은 상태·효과 0).
 * StrictMode 의 껐다 켜기에서 늦게 도는 옛 정리가 새 컨트롤러를 지우지 않게 자기 것일 때만 비운다.
 */
export function mountFavoriteController(slot: { current: FavoriteController | null }, deps: Parameters<typeof createFavoriteController>[0]): () => void {
  const c = createFavoriteController(deps)
  slot.current = c
  return () => {
    c.dispose()
    if (slot.current === c) slot.current = null
  }
}

/**
 * 상세 시트의 GET·저장·보관 요청(§32-5) — 별 시계를 요청을 보내기 **직전**에 찍는다. 응답을 깐 뒤 그 시각을 `readAt` 으로 남기는 것은 부르는 쪽이고,
 * 그러면 응답이 들고 온 옛 별 값은 그 뒤에 확정된 별 기록을 이기지 못한다(`favoriteView`).
 */
export function stampedSend<T>(stamp: () => number, send: () => Promise<T>): { readAt: number; res: Promise<T> } {
  const readAt = stamp()
  return { readAt, res: send() }
}

export function useWordFavorites(opts: { inFavoriteView: () => boolean; onEffect: (x: FavEffect) => void }): WordFavorites {
  const [state, setState] = useState<FavState>({})
  const ctrlRef = useRef<FavoriteController | null>(null)
  const optsRef = useRef(opts)
  useEffect(() => {
    optsRef.current = opts
  })

  useEffect(
    () =>
      mountFavoriteController(ctrlRef, {
        send: sendFavorite,
        now,
        inFavoriteView: () => optsRef.current.inFavoriteView(),
        onChange: setState,
        onEffect: (x) => optsRef.current.onEffect(x),
      }),
    [],
  )

  const press = useCallback((id: string, shown: boolean) => ctrlRef.current?.press(id, shown), [])
  const view = useCallback((id: string, server: boolean | undefined, readAt: number) => favoriteView(server, readAt, state[id]), [state])
  return { press, view, stamp: now }
}
