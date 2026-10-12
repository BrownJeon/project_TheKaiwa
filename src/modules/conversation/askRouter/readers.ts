/**
 * ASK 기록 조회가 쓰는 L2 표 읽기 — `Correction`·`Chat` 은 conversation 소유라 learning(`recordRetrieval`)이 직접 읽지 않고
 * 이 읽기 함수를 값으로 받는다(domain-model §1, observations/corrections 와 같은 방식).
 *
 * 전송 범위(D2=(b) — 사용자가 승인한 동의 문구)에 맞춰 **칸부터 좁힌다**: 교정은 원래 문장·고친 문장·유형만(설명·추가 설명·대화 id 없음),
 * 역할극 방은 id·상황·시각만(제목·메시지 없음). 모든 쿼리는 세션 userId 로 거른다.
 */
import { escapeLike, prisma, type Tx } from '@/modules/infra'
import type { AcceptedCorrectionReader, RolePlayReader } from '@/modules/learning'

const TAKE_MAX = 20
const clampTake = (n: number) => Math.max(1, Math.min(TAKE_MAX, Math.floor(Number.isFinite(n) ? n : 1) || 1))
const timeRange = (from: Date | null, toExclusive: Date) => (from ? { gte: from, lt: toExclusive } : { lt: toExclusive })

export function createAskCorrectionReader(db: Pick<Tx, 'correction'>): AcceptedCorrectionReader {
  return async (userId, q) => {
    if (typeof userId !== 'string' || !userId) return []
    const terms = (q.terms ?? []).filter((t): t is string => typeof t === 'string' && t.length > 0).map(escapeLike)
    return db.correction.findMany({
      where: {
        userId,
        status: 'ACCEPTED',
        createdAt: timeRange(q.from, q.toExclusive),
        ...(terms.length ? { OR: terms.flatMap((t) => [{ original: { contains: t } }, { corrected: { contains: t } }]) } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: clampTake(q.take),
      select: { id: true, userId: true, status: true, original: true, corrected: true, errorType: true, createdAt: true },
    })
  }
}

export function createAskRolePlayReader(db: Pick<Tx, 'chat'>): RolePlayReader {
  return async (userId, q) => {
    if (typeof userId !== 'string' || !userId) return []
    const range = timeRange(q.from, q.toExclusive)
    const rows = await db.chat.findMany({
      where: { userId, kind: 'TALK', scenarioId: { not: null }, OR: [{ createdAt: range }, { endedAt: range }] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: clampTake(q.take),
      select: { id: true, userId: true, scenarioId: true, createdAt: true, endedAt: true },
    })
    return rows.map((r) => ({ chatId: r.id, userId: r.userId, scenarioId: r.scenarioId, createdAt: r.createdAt, endedAt: r.endedAt }))
  }
}

export const askCorrectionReader: AcceptedCorrectionReader = createAskCorrectionReader(prisma)
export const askRolePlayReader: RolePlayReader = createAskRolePlayReader(prisma)
