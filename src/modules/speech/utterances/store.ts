/**
 * 발화 행(`Utterance`) DB·엔진 조회 진입점 — 이 폴더의 기록·턴 검사·연결이 쓰는 호출을 한곳에 둔다.
 * 단위 테스트가 메서드를 바꿔 끼운다(Prisma 위임 객체는 node:test `mock.method` 로 바꿀 수 없다 — conversation `turnDeps` 와 같은 방식).
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/modules/infra'
import { stt } from '@/modules/engine'

const TURN_SELECT = { id: true, chatId: true, chatMessageId: true, createdAt: true, finalText: true } as const

export interface UtteranceLinkData {
  chatMessageId: string
  finalText?: string
  finalSource?: 'USER'
}

export const utteranceDb = {
  realtimeConnection: (ref: string) => stt.findRealtimeConnection(ref),
  create: (data: Prisma.UtteranceUncheckedCreateInput) => prisma.utterance.create({ data, select: { id: true } }),
  remove: (id: string) => prisma.utterance.delete({ where: { id } }),
  findForTurn: (userId: string, id: string) => prisma.utterance.findFirst({ where: { id, userId }, select: TURN_SELECT }),
  /** 아직 어느 메시지에도 붙지 않은 행만 연결한다(조건부) — 바뀐 행 수. */
  link: async (userId: string, id: string, data: UtteranceLinkData): Promise<number> =>
    (await prisma.utterance.updateMany({ where: { id, userId, chatMessageId: null }, data })).count,
}
