/**
 * 발화 한 개는 한 곳에만 쓰인다 — 채팅 메시지(`chatMessageId`)·레슨 말하기(`lessonId`)·평가 문항(`evaluationItemId`) 중 하나(Codex C2-2).
 * 연결은 전부 이 조건을 붙인 **조건부 `updateMany`** 로 한다(사전 검사 + 최종 원자 갱신 두 겹). 경합에서 진 쪽은 count 0.
 * 대화방에서 녹음한 발화(`chatId` 있음)는 채팅 턴에만 쓸 수 있어 레슨·평가 연결은 `chatId IS NULL` 도 요구한다.
 * 조건 목록을 각 연결 함수가 손으로 나열하다 한 곳만 빠뜨리는 일을 막으려고 한곳에 둔다.
 */
import type { Prisma } from '@prisma/client'

export type UtteranceUse = 'chatMessage' | 'lesson' | 'evaluationItem'

export function unclaimedUtteranceWhere(userId: string, id: string, use: UtteranceUse): Prisma.UtteranceWhereInput {
  return { id, userId, chatMessageId: null, lessonId: null, evaluationItemId: null, ...(use === 'chatMessage' ? {} : { chatId: null }) }
}
