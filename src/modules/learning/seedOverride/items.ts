/**
 * #179 관리 화면 목록(task-045 T1-3) — 이 사용자의 override 에 공유 시드 제목을 붙인다. 읽기 전용.
 * 제목은 `userId null`(공유 시드) 행에서만 읽는다 — override 의 seedId 가 무엇이든 다른 사용자의 행 제목은 나오지 않는다.
 */
import { prisma, type Tx } from '@/modules/infra'
import type { SeedKind, SeedOverrideItem } from '@/types/seedOverride'
import { listSeedOverrides } from './store'

export async function listSeedOverrideItems(userId: string, kind?: SeedKind, db: Tx = prisma): Promise<SeedOverrideItem[]> {
  const rows = await listSeedOverrides(db, userId, kind)
  const idsOf = (k: SeedKind) => [...new Set(rows.filter((r) => r.kind === k).map((r) => r.seedId))]
  const topicIds = idsOf('TOPIC')
  const scenarioIds = idsOf('SCENARIO')
  const topics = topicIds.length ? await db.conversationTopic.findMany({ where: { id: { in: topicIds }, userId: null }, select: { id: true, title: true } }) : []
  const scenarios = scenarioIds.length ? await db.scenario.findMany({ where: { id: { in: scenarioIds }, userId: null, isSeed: true }, select: { id: true, title: true } }) : []
  const titles = { TOPIC: new Map(topics.map((t) => [t.id, t.title])), SCENARIO: new Map(scenarios.map((s) => [s.id, s.title])) }
  return rows.map((r) => ({ ...r, seedTitle: titles[r.kind].get(r.seedId) ?? null }))
}
