/**
 * 주제 삭제 본체(task-045 T3 — 계약 `docs/design/topic-scenario-manager.md` §4, #172 사전 조회 · #173 삭제 · #176 내 버전 되돌리기의 포트).
 *
 * 순서(호출자의 트랜잭션·사용자 행 잠금 안, 한 트랜잭션 — 어느 단계에서 실패해도 아무것도 지워지지 않는다):
 *   주제 재조회(내 것·시드 아님) → 기간 지난 진행 중 챌린지 지연 전이(완료로 남게) → 영향 재계산 → `ack` 검사(다르면 409 `IMPACT_CHANGED` + 새 사전 조회)
 *   → 진행 중(ACTIVE) 챌린지 행 삭제(끝난·완료 챌린지는 유지, FK SetNull 로 `topicId=null`, 화면은 저장된 `topicTitleSnap`)
 *   → `RESTORE`(#176 내 버전 되돌리기)만: 사본에 붙은 내 상황을 시드 주제로 되돌려 붙임(`loadRestoreRelinkPlan`)
 *   → 내 버전(사본)이면 override 를 숨김으로(`detachCopy` — `DELETE` 는 시드가 숨김으로 남고, `RESTORE` 는 호출자 restoreSeed 가 이어서 override 를 지운다)
 *   → 남은 내 상황 중 다른 주제 연결이 없는 ACTIVE 만 `ARCHIVED`(#165 의미 — 하드 삭제 안 함), 나머지는 연결만 끊김
 *   → 연결·기본 표현 삭제 → 주제 하드 삭제(`Chat`·`Lesson`·`Evaluation`·`VocabSession`·`Challenge` 의 `topicId` 는 FK SetNull).
 * `DELETE`(#173 지우기)는 내 버전을 지워도 내 상황을 숨긴 시드 주제에 되돌려 붙이지 않는다 — 붙이면 장소 없이 보이는 상황이 생긴다(T3-1b, Leader 결정).
 * 사전 조회(#172)는 같은 `readTopicRemovalImpact` 를 쓴다(지연 전이 대상 = 끝난 챌린지로 센다 — 삭제는 전이 뒤에 같은 계산을 한다). 두 갈래 영향을 모두 계산한다.
 *
 * topics/** 는 challenges 를 값 import 하지 않는다(REV-121 L-5 경계) — 지연 전이는 `TopicRemovalTxDeps.settleChallenges` 로 받는다
 * (실제 연결은 `seedOverride/topicRemoval.ts`).
 */
import { ApiError, dates, type Tx } from '@/modules/infra'
import {
  TOPIC_REMOVAL_ACK_NONE,
  type TopicRemovalMode,
  type TopicRemovalModeImpact,
  type TopicRemovalPreview,
  type TopicRemovalResult,
  type TopicRemovalScenarioRef,
} from '@/types/topic'
import { applyRestoreRelink, loadRestoreRelinkPlan, type RestoreRelinkPlan } from '../seedOverride/relink'
import { detachCopies, detachCopy, findOverrideByCopy } from '../seedOverride/store'
import { isChallengeInProgress, topicGone } from './visible'

export interface TopicRemovalImpact {
  topic: { id: string; title: string; isSeed: boolean }
  /** 이 주제가 시드의 내 버전이면 원래 시드 주제 id. */
  seedId: string | null
  activeChallenge: TopicRemovalPreview['activeChallenge']
  finishedChallenges: number
  /** `RESTORE` 때 시드 주제로 되돌려 붙일 계획(사본이 아니거나 시드 주제가 사라졌거나 붙은 내 상황이 없으면 null). */
  relinkPlan: RestoreRelinkPlan | null
  /** #173 지우기 — 되돌려 붙이지 않는다(`relinked` 는 빈 배열). */
  delete: ModeImpact
  /** #176 되돌리기 — 내 버전(사본)일 때만, 아니면 null. */
  restore: ModeImpact | null
  doneLessons: number
  chunks: number
}

export interface ModeImpact {
  archived: TopicRemovalScenarioRef[]
  unlinked: TopicRemovalScenarioRef[]
  relinked: TopicRemovalScenarioRef[]
}

export interface TopicRemovalTxDeps {
  now: () => Date
  /** 기간이 지난 진행 중 챌린지를 끝낸다(challenges `settleExpiredTx`) — 지우기 전에 완료로 남게 한다. */
  settleChallenges: (tx: Tx, userId: string, now: Date) => Promise<unknown>
}

/** 서버가 기대하는 `ack`. */
export function removalAckOf(i: Pick<TopicRemovalImpact, 'activeChallenge'>): string {
  return i.activeChallenge?.id ?? TOPIC_REMOVAL_ACK_NONE
}

/** 챌린지 며칠째(시작 전 0, 기간 길이를 넘지 않음). */
function dayOf(start: string, today: string, lengthDays: number): number {
  if (today < start) return 0
  return Math.min(dates.countDays(start, today), lengthDays)
}

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** 삭제 영향(읽기 전용). 시드 또는 내 주제만 — 아니면 404 `TOPIC_GONE`. `today` 는 KST 날짜. */
export async function readTopicRemovalImpact(db: Tx, userId: string, topicId: string, today: string): Promise<TopicRemovalImpact> {
  const topic = await db.conversationTopic.findFirst({ where: { id: topicId, OR: [{ userId: null }, { userId }] }, select: { id: true, title: true, userId: true } })
  if (!topic) throw topicGone()
  const isSeed = topic.userId === null
  const challenges = await db.challenge.findMany({
    where: { userId, topicId: topic.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, title: true, status: true, startDate: true, endDate: true, lengthDays: true, topicId: true },
  })
  // 기간이 지난 ACTIVE 는 지연 전이에서 완료가 된다 — 끝난 챌린지로 센다(가린 시드 예외와 같은 판정 `isChallengeInProgress`).
  const live = challenges.filter((c) => isChallengeInProgress(c, today))
  const active = live[0] ?? null
  const doneLessons = await db.lesson.count({ where: { userId, topicId: topic.id, status: 'DONE' } })
  const chunks = await db.topicChunk.count({ where: { topicId: topic.id } })
  const base = {
    topic: { id: topic.id, title: topic.title, isSeed },
    activeChallenge: active ? { id: active.id, title: active.title, day: dayOf(dates.fromDbDate(active.startDate), today, active.lengthDays), lengthDays: active.lengthDays } : null,
    finishedChallenges: challenges.length - live.length,
    doneLessons,
    chunks,
  }
  const none: ModeImpact = { archived: [], unlinked: [], relinked: [] }
  if (isSeed) return { ...base, seedId: null, relinkPlan: null, delete: none, restore: null }

  const seedId = (await findOverrideByCopy(db, userId, 'TOPIC', topic.id))?.seedId ?? null
  const mine = await db.scenario.findMany({ where: { userId, isSeed: false }, select: { id: true, title: true, status: true } })
  const onTopic = mine.length ? await db.scenarioTopic.findMany({ where: { topicId: topic.id, scenarioId: { in: mine.map((s) => s.id) } }, select: { scenarioId: true } }) : []
  const onIds = [...new Set(onTopic.map((l) => l.scenarioId))]
  const links = onIds.length ? await db.scenarioTopic.findMany({ where: { scenarioId: { in: onIds } }, select: { scenarioId: true, topicId: true } }) : []
  const hasOther = new Set(links.filter((l) => l.topicId !== topic.id).map((l) => l.scenarioId))
  const rows = new Map(mine.map((s) => [s.id, s]))
  // 보관된 상황은 목록에 없다 — 연결만 함께 사라진다(보관·연결 끊기 대상에서 뺀다).
  const refs = (ids: Iterable<string>): TopicRemovalScenarioRef[] =>
    [...ids].flatMap((id) => {
      const s = rows.get(id)
      return s && s.status === 'ACTIVE' ? [{ id: s.id, title: s.title }] : []
    }).sort(byId)
  // 되돌려 붙는 상황을 뺀 나머지에 일반 삭제 규칙(다른 연결 없음 → 보관, 있음 → 연결만 끊김). 한도를 넘어 시드에 못 붙는 상황은 다른 연결이 이미 있다.
  const split = (relinkedIds: ReadonlySet<string>): ModeImpact => {
    const rest = onIds.filter((id) => !relinkedIds.has(id))
    return { archived: refs(rest.filter((id) => !hasOther.has(id))), unlinked: refs(rest.filter((id) => hasOther.has(id))), relinked: refs(relinkedIds) }
  }
  const relinkPlan = seedId && onIds.length ? await loadRestoreRelinkPlan(db, userId, topic.id, seedId) : null
  return {
    ...base,
    seedId,
    relinkPlan,
    delete: split(new Set()),
    restore: seedId ? split(new Set(relinkPlan?.relinkedScenarioIds ?? [])) : null,
  }
}

const toModeDto = (m: ModeImpact): TopicRemovalModeImpact => ({ scenariosArchived: m.archived, scenariosUnlinked: m.unlinked, scenariosRelinked: m.relinked })

export function toTopicRemovalPreview(i: TopicRemovalImpact): TopicRemovalPreview {
  return {
    topicId: i.topic.id,
    title: i.topic.title,
    isSeed: i.topic.isSeed,
    isSeedCopy: i.seedId !== null,
    ack: removalAckOf(i),
    activeChallenge: i.activeChallenge,
    finishedChallenges: i.finishedChallenges,
    ...toModeDto(i.delete),
    delete: toModeDto(i.delete),
    restore: i.restore ? toModeDto(i.restore) : null,
    doneLessons: i.doneLessons,
    chunks: i.chunks,
  }
}

function impactChanged(i: TopicRemovalImpact): ApiError {
  return new ApiError('CONFLICT', '그 사이에 바뀐 내용이 있어요. 확인 내용을 다시 보고 지워 주세요.', { reason: 'IMPACT_CHANGED', preview: toTopicRemovalPreview(i) })
}

/**
 * 내 주제 삭제(계약 §4) — `TopicRemovalPort` 모양. **호출자의 트랜잭션·사용자 행 잠금 안**에서 부른다(다시 잠그지 않는다).
 * 시드 주제는 지우지 않는다(404 — 시드 숨김은 `hideSeed`). 실패하면 던져서 호출자 트랜잭션 전체를 되돌린다.
 * `mode` 기본값 `DELETE`(#173). `RESTORE` 는 restoreSeed(#176)만 넘긴다 — 사본이 아니면 되돌려 붙일 곳이 없어 `DELETE` 와 같다.
 */
export async function removeUserTopicTxWith(
  tx: Tx,
  userId: string,
  topicId: string,
  opts: { ack: string | null; mode?: TopicRemovalMode },
  deps: TopicRemovalTxDeps,
): Promise<TopicRemovalResult> {

  const own = await tx.conversationTopic.findFirst({ where: { id: topicId, userId, isSeed: false }, select: { id: true } })
  if (!own) throw topicGone()
  const now = deps.now()
  await deps.settleChallenges(tx, userId, now)
  const today = dates.todayKst(now)
  const i = await readTopicRemovalImpact(tx, userId, topicId, today)
  if (opts.ack !== removalAckOf(i)) throw impactChanged(i)

  let deletedChallengeId: string | null = null
  if (i.activeChallenge) {
    const del = await tx.challenge.deleteMany({ where: { id: i.activeChallenge.id, userId, topicId, status: 'ACTIVE' } })
    if (del.count !== 1) throw impactChanged(await readTopicRemovalImpact(tx, userId, topicId, today))
    deletedChallengeId = i.activeChallenge.id
  }
  // 사본이 아니면 되돌려 붙일 시드가 없다 — 실제로 적용한 갈래를 돌려준다.
  const mode: TopicRemovalMode = opts.mode === 'RESTORE' && i.restore ? 'RESTORE' : 'DELETE'
  const m = mode === 'RESTORE' && i.restore ? i.restore : i.delete
  if (i.seedId) {
    if (mode === 'RESTORE' && i.relinkPlan) await applyRestoreRelink(tx, i.relinkPlan, topicId, i.seedId)
    await detachCopy(tx, userId, 'TOPIC', topicId)
  }
  const archiveIds = m.archived.map((s) => s.id)
  if (archiveIds.length) {
    await tx.scenario.updateMany({ where: { id: { in: archiveIds }, userId, isSeed: false, status: 'ACTIVE' }, data: { status: 'ARCHIVED' } })
    // 보관한 상황이 시드 상황의 내 버전이면 그 override 를 숨김으로(고아를 남기지 않는다 — 계약 §4 불변식).
    await detachCopies(tx, userId, 'SCENARIO', archiveIds)
  }
  // Cascade 와 같은 결과를 명시적으로 — 연결·기본 표현을 먼저 지운다.
  await tx.scenarioTopic.deleteMany({ where: { topicId } })
  await tx.topicChunk.deleteMany({ where: { topicId } })
  const gone = await tx.conversationTopic.deleteMany({ where: { id: topicId, userId, isSeed: false } })
  if (gone.count !== 1) throw topicGone()
  return {
    topicId,
    result: 'REMOVED',
    mode,
    challengeDeleted: deletedChallengeId !== null,
    deletedChallengeId,
    scenariosArchived: archiveIds.length,
    scenariosUnlinked: m.unlinked.length,
    scenariosRelinked: m.relinked.length,
    seedId: i.seedId,
  }
}
