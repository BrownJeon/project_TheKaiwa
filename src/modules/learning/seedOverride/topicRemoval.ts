/**
 * 주제 삭제 서비스·포트 연결(task-045 T3). 본체는 `topics/remove.ts` — topics/** 는 challenges 를 값 import 할 수 없어서(REV-121 L-5 경계)
 * 지연 전이(`settleExpiredTx`)를 여기서 꽂는다. ops.ts 는 이 파일을 import 하지 않는다(ops ↔ topicRemoval 순환 방지) — #176 라우트가
 * `restoreSeed(..., { removeTopic: removeUserTopicTx })` 로 주입한다(주입하지 않으면 ops 기본값 = 400 FEATURE_NOT_READY, 쓰기 0).
 *
 * - #172 `previewTopicRemoval` — 읽기 전용. 시드 또는 내 주제(남의 주제·없는 주제 404 `TOPIC_GONE`).
 * - #173 `removeUserTopic`   — 시드 id = 그 사용자 목록에서만 숨김(`hideSeed`, 진행 중 챌린지는 계속, `ack` 를 보지 않음) ·
 *                               내 주제 = 한 트랜잭션·사용자 행 잠금 → `removeUserTopicTxWith`.
 * - `removeUserTopicTx`        — `TopicRemovalPort` 구현(호출자 tx·잠금 안).
 */
import { ApiError, dates, prisma, type Tx } from '@/modules/infra'
import { TOPIC_REMOVAL_ACK_NONE, type TopicRemovalPreview, type TopicRemovalResult } from '@/types/topic'
import { settleExpiredTx } from '../challenges/settle'
import { isScenarioId as isRowId } from '../scenarios/shape'
import { readTopicRemovalImpact, removeUserTopicTxWith, toTopicRemovalPreview, type TopicRemovalTxDeps } from '../topics/remove'
import { topicGone } from '../topics/visible'
import { defaultSeedOverrideDeps, hideSeed, type SeedOverrideDeps, type TopicRemovalPort } from './ops'

export const defaultTopicRemovalTxDeps: TopicRemovalTxDeps = {
  now: () => new Date(),
  settleChallenges: (tx, userId, now) => settleExpiredTx(tx, userId, dates.todayKst(now), now),
}

/** 포트 만들기 — 시험은 시계·지연 전이를 바꿔 넣는다. */
export function makeTopicRemovalPort(over?: Partial<TopicRemovalTxDeps>): TopicRemovalPort {
  const d: TopicRemovalTxDeps = over ? { ...defaultTopicRemovalTxDeps, ...over } : defaultTopicRemovalTxDeps
  return (tx, userId, topicId, opts) => removeUserTopicTxWith(tx, userId, topicId, opts, d)
}

/** `TopicRemovalPort` 구현 — #176 `restoreSeed(..., { removeTopic: removeUserTopicTx })`. */
export const removeUserTopicTx: TopicRemovalPort = makeTopicRemovalPort()

/** #173 `?ack=` 해석 — 없으면 null(서버 판단과 다르므로 409 `IMPACT_CHANGED` + 사전 조회), `none` 또는 챌린지 id 꼴만. */
export function parseTopicRemovalAck(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (raw === TOPIC_REMOVAL_ACK_NONE || isRowId(raw)) return raw
  throw new ApiError('VALIDATION', '확인 값이 올바르지 않아요.', { field: 'ack', reason: 'invalid' })
}

/** #172 사전 조회(읽기 전용, 잠금 없음). */
export async function previewTopicRemoval(userId: string, topicId: string, over?: { db?: Tx; now?: () => Date }): Promise<TopicRemovalPreview> {
  if (!isRowId(topicId)) throw topicGone()
  const db = over?.db ?? prisma
  const now = over?.now?.() ?? new Date()
  return toTopicRemovalPreview(await readTopicRemovalImpact(db, userId, topicId, dates.todayKst(now)))
}

export type TopicRemovalServiceDeps = Pick<SeedOverrideDeps, 'db' | 'transaction' | 'lockUser' | 'now'> & Pick<TopicRemovalTxDeps, 'settleChallenges'>

/**
 * #173 주제 삭제. 시드인지는 잠금 전에 판정해도 된다(시드 행과 사용자 행은 서로 바뀌지 않는다) — 시드면 `hideSeed`(자기 트랜잭션·잠금, 멱등),
 * 내 주제면 한 트랜잭션에서 사용자 행을 잠그고 `removeUserTopicTxWith`(재조회·`ack`·삭제 전부 잠금 안).
 */
export async function removeUserTopic(userId: string, topicId: string, opts: { ack: string | null }, over?: Partial<TopicRemovalServiceDeps>): Promise<TopicRemovalResult> {
  const d: TopicRemovalServiceDeps = { ...defaultSeedOverrideDeps, settleChallenges: defaultTopicRemovalTxDeps.settleChallenges, ...over }
  if (!isRowId(topicId)) throw topicGone()
  const row = await d.db.conversationTopic.findFirst({ where: { id: topicId, OR: [{ userId: null }, { userId }] }, select: { id: true, userId: true } })
  if (!row) throw topicGone()
  if (row.userId === null) {
    await hideSeed(userId, 'TOPIC', topicId, { db: d.db, transaction: d.transaction, lockUser: d.lockUser, now: d.now })
    return { topicId, result: 'HIDDEN', challengeDeleted: false, deletedChallengeId: null, scenariosArchived: 0, scenariosUnlinked: 0, scenariosRelinked: 0, seedId: null }
  }
  return d.transaction(async (tx) => {
    await d.lockUser(tx, userId)
    return removeUserTopicTxWith(tx, userId, topicId, opts, { now: d.now, settleChallenges: d.settleChallenges })
  })
}
