'use client'

/**
 * 역할극 결과 읽기(S9 — #29 `GET /api/v1/chats/:id` 의 `chat.scenario.ended`). **읽기만 한다** — 결과 화면을 여는 것만으로 기록이 생기지 않는다(D-9).
 * 마치기(#167)는 방 안 마치기 시트가 하고, 이 훅은 쓰기 요청을 보내지 않는다(`__tests__/resultLogic.test.ts` 정적 시험이 지킨다).
 * 메시지는 필요 없어 `limit=1`. `after` 를 붙이면 서버가 다음 상황(`ended.next`)을 빼므로 붙이지 않는다.
 */
import { useKeyedResource } from '@/components/plan/usePlanData'
import type { ChatDetail } from '@/types/chat'
import { resultStateOf, type ResultState } from './resultLogic'

const resultPath = (chatId: string) => `/api/v1/chats/${encodeURIComponent(chatId)}?limit=1`

export function useRolePlayResult(chatId: string): { state: ResultState; reload: () => void } {
  const r = useKeyedResource<ChatDetail>(chatId || null, resultPath)
  return { state: resultStateOf({ status: r.status, errStatus: r.errStatus, data: r.data }), reload: r.reload }
}
