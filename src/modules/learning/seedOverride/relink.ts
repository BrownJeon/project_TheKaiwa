/**
 * "기본으로 되돌리기"(#176 주제 사본) 때 내 상황 연결을 사본 주제 → 원래 시드 주제로 돌려 옮기는 계산(task-045 T1-2, Leader 결정).
 * fork 가 시드 → 사본으로 옮긴 것의 역이고, 사본을 만든 뒤 사본 주제로 새로 저장한 내 상황도 같은 규칙으로 시드 주제에 붙인다.
 * 그 결과 사본 주제에는 내 상황 연결이 남지 않으므로 삭제 규칙(§4)이 내 상황을 보관(ARCHIVED)하지 않는다 — 되돌리기는 주제 삭제가 아니라 기본으로의 복귀다.
 * #172 삭제 사전 조회(T3)가 같은 계산을 쓰도록 읽기(`loadRestoreRelinkPlan`)·순수 계획(`planRestoreRelink`)·쓰기(`applyRestoreRelink`)를 나눴다.
 */
import type { Tx } from '@/modules/infra'
import { SCENARIO_LIMITS } from '@/types/scenario'

export interface ScenarioTopicLink {
  scenarioId: string
  topicId: string
  weight: number
}

export interface RestoreRelinkPlan {
  /** 사본 주제 연결을 끊을 상황(사본에 붙어 있던 내 상황 전부). */
  unlink: string[]
  /** 시드 주제로 새로 이을 연결 — 이미 시드 주제에 붙은 상황은 빠진다(중복 연결 유니크). */
  link: { scenarioId: string; weight: number }[]
  /** 시드 주제에 (다시) 붙게 되는 상황 — `link` + 이미 붙어 있던 것. */
  relinkedScenarioIds: string[]
}

/**
 * 순수 계산. `links` = 사본 주제에 붙은 내 상황들의 **현재 연결 전부**(사본·시드·다른 주제 포함 — 중복·한도 판정 재료).
 * 사본 연결 하나를 시드 연결 하나로 바꾸므로 상황의 연결 수는 늘지 않는다(이미 시드에 붙어 있으면 하나 준다). 한도(`topicsMax`)를 이미 넘은
 * 예전 행이면 시드 연결을 더하지 않고 사본 연결만 끊는다 — 저장 검사(`topicsMax`)를 넘는 행을 새로 만들지 않는다.
 */
export function planRestoreRelink(links: readonly ScenarioTopicLink[], copyTopicId: string, seedTopicId: string): RestoreRelinkPlan {
  const byScenario = new Map<string, ScenarioTopicLink[]>()
  for (const l of links) byScenario.set(l.scenarioId, [...(byScenario.get(l.scenarioId) ?? []), l])
  const plan: RestoreRelinkPlan = { unlink: [], link: [], relinkedScenarioIds: [] }
  for (const [scenarioId, own] of [...byScenario].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const onCopy = own.filter((l) => l.topicId === copyTopicId)
    if (!onCopy.length) continue
    plan.unlink.push(scenarioId)
    if (own.some((l) => l.topicId === seedTopicId)) {
      plan.relinkedScenarioIds.push(scenarioId)
      continue
    }
    const others = new Set(own.filter((l) => l.topicId !== copyTopicId).map((l) => l.topicId))
    if (others.size + 1 > SCENARIO_LIMITS.topicsMax) continue
    plan.link.push({ scenarioId, weight: Math.max(...onCopy.map((l) => l.weight)) })
    plan.relinkedScenarioIds.push(scenarioId)
  }
  return plan
}

/** 계획 읽기(쓰기 없음) — 사본 주제에 붙은 이 사용자 소유 상황(보관 포함)만 본다. 시드 주제가 사라졌으면 옮길 곳이 없어 null. */
export async function loadRestoreRelinkPlan(db: Tx, userId: string, copyTopicId: string, seedTopicId: string): Promise<RestoreRelinkPlan | null> {
  const mine = (await db.scenario.findMany({ where: { userId, isSeed: false }, select: { id: true } })).map((s) => s.id)
  if (!mine.length) return null
  const onCopy = await db.scenarioTopic.findMany({ where: { topicId: copyTopicId, scenarioId: { in: mine } }, select: { scenarioId: true } })
  if (!onCopy.length) return null
  if (!(await db.conversationTopic.findFirst({ where: { id: seedTopicId, userId: null }, select: { id: true } }))) return null
  const links = await db.scenarioTopic.findMany({ where: { scenarioId: { in: [...new Set(onCopy.map((l) => l.scenarioId))] } }, select: { scenarioId: true, topicId: true, weight: true } })
  return planRestoreRelink(links, copyTopicId, seedTopicId)
}

/** 계획 적용 — 호출자 tx·사용자 잠금 안. 끊는 where 에 사본 주제 id 를 함께 걸어 다른 주제 연결에는 닿지 않는다. */
export async function applyRestoreRelink(tx: Tx, plan: RestoreRelinkPlan, copyTopicId: string, seedTopicId: string): Promise<void> {
  if (plan.unlink.length) await tx.scenarioTopic.deleteMany({ where: { topicId: copyTopicId, scenarioId: { in: plan.unlink } } })
  if (plan.link.length) await tx.scenarioTopic.createMany({ data: plan.link.map((l) => ({ scenarioId: l.scenarioId, topicId: seedTopicId, weight: l.weight })) })
}
