/**
 * 시드 가시성 도구(task-045 T1 — 목록·시작 필터는 T1-2 가 연결). 계약 §2:
 * 사용자 U 에게 보이는 시드 = **U 의 override(kind, seedId) 행이 없는 시드**(숨김·사본·고아 모두 원본을 가린다).
 * 보이는 내 행 = `userId=U` 전부(사본 포함). id 로 직접 읽기(지난 기록)는 막지 않는다 — 이 도구는 목록·새 시작에만 쓴다.
 *
 * 사용 예(T1-2):
 *   const hidden = await hiddenSeedIds(tx, userId, 'TOPIC')
 *   prisma.conversationTopic.findMany({ where: { level: { in: levels }, ...visibleRowsWhere(userId, hidden) } })
 *   상황은 시드 조건에 isSeed 가 더 붙는다: { OR: [{ ...visibleSeedWhere(hidden), isSeed: true }, { userId }] }
 */
import type { Tx } from '@/modules/infra'
import type { SeedKind } from '@/types/seedOverride'
import { findOverride, liveCopyIds, listOverrideRows } from './store'

/** 이 사용자 목록에서 가려지는 시드 id(override 가 있는 시드 전부). 사용자·종류로 거른다 — 다른 사용자의 override 는 영향이 없다. */
export async function hiddenSeedIds(db: Tx, userId: string, kind: SeedKind): Promise<string[]> {
  return (await listOverrideRows(db, userId, kind)).map((r) => r.seedId)
}

/** 시드 쪽 where 조각 — `userId null` 이면서 가려진 id 가 아님. 가려진 것이 없으면 조건을 붙이지 않는다. */
export function visibleSeedWhere(hidden: readonly string[]): { userId: null; id?: { notIn: string[] } } {
  return hidden.length ? { userId: null, id: { notIn: [...hidden] } } : { userId: null }
}

/** 보이는 시드 + 내 행 where 조각(목록 쿼리에 펼쳐 넣는다). */
export function visibleRowsWhere(userId: string, hidden: readonly string[]): { OR: [ReturnType<typeof visibleSeedWhere>, { userId: string }] } {
  return { OR: [visibleSeedWhere(hidden), { userId }] }
}

/**
 * 단건 판정 — 그 id 가 이 사용자에게 가려진 시드가 아니면 true. 시드가 아닌 id 는 override 가 생길 수 없으므로 늘 true
 * (행의 존재·소유 검사는 호출자 몫이다). 새로 시작하는 경로(역할극 시작·챌린지 만들기·수업 생성)가 잠금 안에서 부른다.
 */
export async function isSeedVisibleFor(db: Tx, userId: string, kind: SeedKind, id: string): Promise<boolean> {
  return (await findOverride(db, userId, kind, id)) === null
}

/**
 * 장소(주제) 연결 해석(계약 §2 · §8 ①, T1 결정): 시드 상황은 시드 주제에 붙어 있다. 사용자가 그 주제를 사본으로 바꿨으면
 * **읽을 때** 시드 주제 id 를 그 사용자의 살아 있는 사본 id 로 바꿔 보인다(저장 변경 없음). 숨김·고아 override 는 바꾸지 않는다
 * (가려진 시드 주제는 그대로 남고, 보일지는 호출자가 `hiddenSeedIds` 로 정한다). 돌려주는 Map 에는 바뀌는 id 만 들어 있다.
 */
export async function resolvePlaceTopicIds(db: Tx, userId: string, topicIds: readonly string[]): Promise<Map<string, string>> {
  const want = new Set(topicIds)
  if (!want.size) return new Map()
  const rows = (await listOverrideRows(db, userId, 'TOPIC')).filter((r) => want.has(r.seedId) && r.copyId !== null)
  if (!rows.length) return new Map()
  const live = await liveCopyIds(db, userId, 'TOPIC', rows.map((r) => r.copyId as string))
  return new Map(rows.filter((r) => live.has(r.copyId as string)).map((r) => [r.seedId, r.copyId as string]))
}

export async function resolvePlaceTopicId(db: Tx, userId: string, topicId: string): Promise<string> {
  return (await resolvePlaceTopicIds(db, userId, [topicId])).get(topicId) ?? topicId
}

/**
 * 목록·새 시작 한 번에 쓰는 사용자별 시드 가시성(T1-2). override 조회 **1회**(두 종류 함께) + 주제 사본이 있을 때만 사본 생존 조회 1회 —
 * override 가 없는 사용자(= 기존 사용자 전부)는 조회 1회만 늘고 결과는 빈 집합이다.
 */
export interface SeedVisibility {
  /** 가려진 시드 주제 id(숨김·사본·고아 전부 — 계약 §2). */
  hiddenTopics: ReadonlySet<string>
  /** 가려진 시드 상황 id. */
  hiddenScenarios: ReadonlySet<string>
  /** 시드 주제 → 살아 있는 사본 주제 id(장소 표시·장소 필터 치환). */
  topicCopies: ReadonlyMap<string, string>
}

export async function loadSeedVisibility(db: Tx, userId: string): Promise<SeedVisibility> {
  const rows = await listOverrideRows(db, userId)
  const hiddenTopics = new Set<string>()
  const hiddenScenarios = new Set<string>()
  for (const r of rows) {
    if (r.kind === 'TOPIC') hiddenTopics.add(r.seedId)
    else if (r.kind === 'SCENARIO') hiddenScenarios.add(r.seedId)
  }
  const copies = rows.filter((r) => r.kind === 'TOPIC' && r.copyId !== null)
  const live = copies.length ? await liveCopyIds(db, userId, 'TOPIC', copies.map((r) => r.copyId as string)) : new Set<string>()
  return { hiddenTopics, hiddenScenarios, topicCopies: new Map(copies.filter((r) => live.has(r.copyId as string)).map((r) => [r.seedId, r.copyId as string])) }
}

/** 이 사용자에게 보일 장소 id — 사본이 있으면 사본 id, 가려졌는데 살아 있는 사본이 없으면 null(보이지 않음), 그 밖은 그대로. */
export function placeTopicId(v: SeedVisibility, topicId: string): string | null {
  const copy = v.topicCopies.get(topicId)
  if (copy) return copy
  return v.hiddenTopics.has(topicId) ? null : topicId
}

/** 장소 필터 id 의 역매핑 — 사본 id 로 거르면 원래 시드 주제에 붙은 연결도 포함한다(시드 주제 id 또는 null). */
export function seedTopicOfCopy(v: SeedVisibility, copyTopicId: string): string | null {
  for (const [seed, copy] of v.topicCopies) if (copy === copyTopicId) return seed
  return null
}

/**
 * 상황↔주제 연결을 이 사용자의 장소로 바꿔 읽는다(저장 변경 없음): 가려진 시드 주제(사본 없음)는 빼고, 사본이 있는 시드 주제는 사본 id 로 바꾼다.
 * 한 상황에 같은 장소가 둘이 되면(시드 연결 + 사본 연결) weight 가 큰 쪽 하나만 남긴다. `from` = 원래 저장된 주제 id(시드 정렬용).
 */
export function mapPlaceLinks<L extends { scenarioId: string; topicId: string; weight: number }>(links: readonly L[], v: SeedVisibility): (L & { from: string })[] {
  const out = new Map<string, L & { from: string }>()
  for (const l of links) {
    const place = placeTopicId(v, l.topicId)
    if (place === null) continue
    const key = `${l.scenarioId}|${place}`
    const prev = out.get(key)
    if (!prev || l.weight > prev.weight) out.set(key, { ...l, topicId: place, from: l.topicId })
  }
  return [...out.values()]
}
