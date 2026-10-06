'use client'

/**
 * 목록 바닥 따라가기 잠깐 멈춤(task-039 데모 v1 개발 메모 ⑧). 회화방 `MessageList` 는 내용이 늘면 바닥에 붙어 있던 경우 바닥으로
 * 내려가는데, 사용자가 카드 안 접이식 줄을 펼쳐 생긴 높이 변화까지 따라가면 방금 누른 줄이 위로 밀린다. 펼치는 쪽이 이 함수를
 * 부르면 바로 다음 한 번의 높이 증가는 따라가지 않는다. 목록 밖(표현 점검·모아 둔 교정 시트)에서는 null 이라 아무 일도 없다.
 */
import { createContext } from 'react'

export const FollowHoldContext = createContext<(() => void) | null>(null)

/** 펼침 직후 높이 증가를 기다리는 시간 — 이보다 늦은 증가(새 문장·새 메시지)는 평소처럼 따라간다. */
export const FOLLOW_HOLD_MS = 500

/**
 * 내용 높이가 늘었을 때 할 일. `hold` = 펼침이 만든 증가라 따라가지 않고(한 번만) 바닥 여부를 실제 위치로 다시 잰다 ·
 * `follow` = 바닥에 붙어 있었으니 바닥으로 · `none` = 위를 보고 있었으니 그대로.
 */
export function contentGrowthAction(now: number, holdUntil: number, atBottom: boolean): 'hold' | 'follow' | 'none' {
  if (now < holdUntil) return 'hold'
  return atBottom ? 'follow' : 'none'
}
