/**
 * 발화 행(`Utterance`) DB·엔진 조회 진입점 — 이 폴더의 기록·턴 검사·연결이 쓰는 호출을 한곳에 둔다.
 * 단위 테스트가 메서드를 바꿔 끼운다(Prisma 위임 객체는 node:test `mock.method` 로 바꿀 수 없다 — conversation `turnDeps` 와 같은 방식).
 */
import type { Prisma } from '@prisma/client'
import { prisma, withTransaction } from '@/modules/infra'
import { stt } from '@/modules/engine'
import { analysisDb } from '../analysis/db'
import { unclaimedUtteranceWhere } from './usage'

const TURN_SELECT = { id: true, chatId: true, chatMessageId: true, lessonId: true, evaluationItemId: true, createdAt: true, finalText: true } as const

export interface UtteranceLinkData {
  chatMessageId: string
  finalText?: string
  finalSource?: 'USER'
}

export const utteranceDb = {
  realtimeConnection: (ref: string) => stt.findRealtimeConnection(ref),
  /**
   * 분석 잡을 함께 넣는 경우(중첩 `jobs`) 같은 사용자의 대기 중 분석 잡 디바운스(task-012b D-B8 수정)를 **같은 트랜잭션**으로 —
   * 프로젝트 표준 `withTransaction`(READ COMMITTED·P2034 재시도, REV-033 L2).
   */
  create: async (data: Prisma.UtteranceUncheckedCreateInput): Promise<{ id: string }> => {
    if (!data.jobs) return prisma.utterance.create({ data, select: { id: true } })
    const now = data.createdAt instanceof Date ? data.createdAt : new Date()
    return withTransaction(async (tx) => {
      // 디바운스를 먼저 — 이 사용자의 대기 중 잡 행을 이 트랜잭션이 잠가 두어, 커밋 전 동시 claim(SKIP LOCKED)이 건너뛰게 한다(Codex C2 지적 1).
      await analysisDb.debounce(tx, data.userId, now)
      return tx.utterance.create({ data, select: { id: true } })
    })
  },
  remove: (id: string) => prisma.utterance.delete({ where: { id } }),
  findForTurn: (userId: string, id: string) => prisma.utterance.findFirst({ where: { id, userId }, select: TURN_SELECT }),
  /** 아직 어디에도(메시지·레슨·평가 문항) 쓰이지 않은 행만 연결한다(조건부, `usage.ts`) — 바뀐 행 수. */
  link: async (userId: string, id: string, data: UtteranceLinkData): Promise<number> =>
    (await prisma.utterance.updateMany({ where: unclaimedUtteranceWhere(userId, id, 'chatMessage'), data })).count,
}
