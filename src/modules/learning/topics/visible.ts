/**
 * 주제 재확인(task-045 T3 · Codex C1 ⓐⓑⓒ) — 새로 만드는 쓰기(챌린지 #156 · 주제 수업 #59 · 주제 단어 세트 #47)가
 * **사용자 행 잠금 안에서** 부른다. 주제 삭제(#173·#176)도 같은 잠금 아래 한 트랜잭션이라, 잠금 안에서 확인한 주제는 그 트랜잭션이
 * 끝날 때까지 지워지지 않는다(삭제가 먼저면 여기서 404, 생성이 먼저면 삭제가 생성 결과를 본다).
 * 잠금 밖에서 지워지는 경우(시드 로더 등)는 FK 위반(P2003)으로 드러나므로 `mapTopicGone` 으로 같은 404 로 바꾼다.
 *
 * topics/** 는 challenges 를 값 import 하지 않는다(REV-121 L-5 경계, task042 시험) — 진행 중 챌린지 예외는 Challenge 행을 직접 읽는다.
 */
import { ApiError, dates, type Tx } from '@/modules/infra'
import { isSeedVisibleFor } from '../seedOverride/visibility'

export function topicGone(): ApiError {
  return new ApiError('NOT_FOUND', '주제를 찾을 수 없어요.', { reason: 'TOPIC_GONE' })
}

export interface AssertTopicVisibleOptions {
  /** 이 사용자의 진행 중 챌린지(`isChallengeInProgress`) 주제면 가린 시드여도 허용(계약 §0 #9 "시드 숨김에서 진행 중 챌린지는 계속"). 새 챌린지 만들기는 쓰지 않는다. */
  allowActiveChallenge?: boolean
  /** 진행 중 판정 시각(기본 지금). */
  now?: Date
}

/**
 * "진행 중 챌린지" 판정 하나(REV-152a L-1) — `ACTIVE` 이고 지연 전이(`challenges/settle.ts` `settleExpiredTx`)가 지금 끝내지 않을 것.
 * settle 의 `expiredWhere`(ACTIVE ∧ (종료일 < 오늘 ∨ topicId null))의 여집합이라, 기간이 지났지만 아직 정산 전인 챌린지는 진행 중이 아니다.
 * 주제 삭제 사전 조회(#172, 정산 없이 읽음)·삭제(#173, 정산 뒤 읽음)의 `ack` 와 가린 시드 예외(`allowActiveChallenge`)가 같은 집합을 본다.
 */
export function isChallengeInProgress(ch: { status: string; endDate: Date; topicId: string | null }, todayKst: string): boolean {
  return ch.status === 'ACTIVE' && ch.topicId !== null && dates.fromDbDate(ch.endDate) >= todayKst
}

/**
 * 이미 읽은 주제 행(시드 또는 내 것)이 이 사용자에게 새로 시작할 수 있는 주제인가 — 내 주제는 언제나, 시드는 가리지 않았거나(override 없음)
 * `allowActiveChallenge` 이고 그 주제의 진행 중 챌린지(`isChallengeInProgress`)가 있을 때. 챌린지 조회는 가린 시드일 때만 한다. 잠금 안팎 어디서나 쓴다
 * (잠금 밖 = 새 시작 거절 · 잠금 안 = `assertTopicVisible`).
 */
export async function isTopicVisibleTo(db: Tx, userId: string, topic: { id: string; userId: string | null }, opts: AssertTopicVisibleOptions = {}): Promise<boolean> {
  // override 는 시드에만 생긴다 — 내 주제는 확인할 것이 없다.
  if (topic.userId !== null) return true
  if (await isSeedVisibleFor(db, userId, 'TOPIC', topic.id)) return true
  if (!opts.allowActiveChallenge) return false
  // 사용자당 ACTIVE 는 하나(activeKey 유일)라 findFirst 로 충분하다.
  const ch = await db.challenge.findFirst({ where: { userId, status: 'ACTIVE', topicId: topic.id }, select: { status: true, endDate: true, topicId: true } })
  return ch !== null && isChallengeInProgress(ch, dates.todayKst(opts.now ?? new Date()))
}

/** 존재·소유(시드 또는 내 것)·가림(시드 override)을 확인한다. 아니면 404 `TOPIC_GONE`. */
export async function assertTopicVisible(tx: Tx, userId: string, topicId: string, opts: AssertTopicVisibleOptions = {}): Promise<{ id: string; userId: string | null }> {
  const topic = await tx.conversationTopic.findFirst({ where: { id: topicId, OR: [{ userId: null }, { userId }] }, select: { id: true, userId: true } })
  if (!topic || !(await isTopicVisibleTo(tx, userId, topic, opts))) throw topicGone()
  return { id: topic.id, userId: topic.userId }
}

/**
 * 주제 FK 위반인가 — Prisma P2003 의 `meta.field_name`(MySQL 은 `<Model>_topicId_fkey (index)` 꼴)·`constraint` 에 `topicId` 가 있을 때만.
 * 다른 FK(사용자·세트 등) 위반은 주제와 무관하므로 그대로 둔다.
 */
export function isTopicFkViolation(e: unknown): boolean {
  const err = e as { code?: unknown; meta?: { field_name?: unknown; constraint?: unknown } } | null
  if (err?.code !== 'P2003') return false
  return /topicId/i.test(`${String(err.meta?.field_name ?? '')} ${String(err.meta?.constraint ?? '')}`)
}

/** `catch (e) { throw mapTopicGone(e) }` — 주제 FK 위반이면 404 `TOPIC_GONE`, 아니면 원래 오류. */
export function mapTopicGone(e: unknown): unknown {
  return isTopicFkViolation(e) ? topicGone() : e
}
