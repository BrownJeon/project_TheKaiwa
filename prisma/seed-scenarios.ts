/**
 * 시드 상황(Scenario·ScenarioTopic, task-010d A3a) — **안정 id upsert**. 상황 id 는 `RepetitionItem(SCENARIO).refId`·`Chat.scenarioId`·
 * `Lesson.scenarioId`·`LearningObservation.scenarioId` 가 가리키므로 시드를 다시 돌려도 **바뀌지 않아야 한다**(운영·개발 공유 DB).
 * 그래서 id 를 시드 `key` 에서 만든다(`scn_<key>`) — 지우고 새로 만들지 않는다.
 *
 * 입력 `prisma/seed-data/scenarios.json`(PE 작성) = 배열, 항목:
 *   { key, topics:[{key(=topics.json key), weight?}], title, titleJa?, description?, level, difficulty?, roles{learner,tutor},
 *     goal{communicativeGoalKo(또는 communicativeGoal_ko), successCriteria[]}, steps[{ko}], opening?{ja,ko}|null,
 *     keyExpressions[{id(고정), ja, reading?, ko, chunkType?, match?}], requiredExpressions?, constraints?{conditions?,branches?}, grammarPoints? }
 *   글 칸 정리·한도는 사용자 상황과 같다(`src/modules/learning/scenarios/shape.ts`, 한도 `src/types/scenario.ts`). 문제는 전부 모아 한 번에 던진다(쓰기 전).
 *
 * 매칭(순수 함수 `planSeedScenarios` — 단위 테스트가 직접 부른다): id 로 기존 행을 찾고, 바뀐 칸이 없으면 쓰지 않는다(`keep`).
 *   주제 연결은 topics.json key → 시드 주제(제목 → 일본어 제목 매칭, seed-topics 와 같은 규칙)로 풀어, 원하는 연결과 다르면 그 상황의 연결만 바꾼다.
 *   시드 데이터에서 빠진 시드 상황은 **지우지 않고 로그만**. 상태(ACTIVE·ARCHIVED)는 만들 때만 정하고 고치지 않는다(사람이 숨긴 시드를 되살리지 않음).
 * `SEED_DRY_RUN=1` 이면 계획만 출력하고 아무것도 쓰지 않는다.
 */
import { Prisma, type JlptLevel, type PrismaClient } from '@prisma/client'
import { completionRuleJson, constraintsJson, defaultRequiredExpressions, expressionsJson, goalJson, normalizeScenarioInput } from '../src/modules/learning/scenarios/shape'
import { planSeedTopics, type ExistingTopic, type SeedTopicInput } from './seed-topics'

const KEY = /^[a-z0-9][a-z0-9-]{0,35}$/
export const SEED_SCENARIO_ID_PREFIX = 'scn_'
export const seedScenarioId = (key: string) => `${SEED_SCENARIO_ID_PREFIX}${key}`

/** 쓰는 칸(시드 상황 1개). JSON 칸은 저장 모양 그대로. */
export interface SeedScenarioData {
  title: string
  titleJa: string | null
  description: string | null
  level: JlptLevel
  difficulty: number
  roles: Record<string, unknown>
  goal: Record<string, unknown>
  constraints: Record<string, unknown>
  keyExpressions: Record<string, unknown>[]
  completionRule: Record<string, unknown>
  grammarPoints: unknown[] | null
}

export interface ScenarioSeed {
  key: string
  id: string
  topics: { key: string; weight: number }[]
  data: SeedScenarioData
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** scenarios.json → 검사한 시드 목록. 문제가 하나라도 있으면 전부 모아 Error(쓰기 전). */
export function parseSeedScenarios(raw: unknown, topicKeys: ReadonlySet<string>): ScenarioSeed[] {
  const problems: string[] = []
  if (!Array.isArray(raw)) throw new Error('[seed] scenarios.json 은 배열이어야 합니다')
  const keys = new Set<string>()
  const out: ScenarioSeed[] = []
  raw.forEach((e, i) => {
    const at = (m: string) => problems.push(`scenarios[${i}]${isObj(e) && typeof e.key === 'string' ? `(${e.key})` : ''} ${m}`)
    if (!isObj(e)) return at('항목은 객체여야 합니다')
    const { key, topics, constraints, grammarPoints, completionRule, ...rest } = e
    if (typeof key !== 'string' || !KEY.test(key)) at('key 는 소문자·숫자·- 1~36자')
    else if (keys.has(key)) at(`key 중복: ${key}`)
    else keys.add(key as string)
    const links: { key: string; weight: number }[] = []
    if (!Array.isArray(topics) || topics.length === 0 || topics.length > 3) at('topics 는 1~3개')
    else
      topics.forEach((t, j) => {
        const tk = isObj(t) ? t.key : t
        const w = isObj(t) && t.weight !== undefined ? t.weight : 1
        if (typeof tk !== 'string' || !topicKeys.has(tk)) return at(`topics[${j}] 은 topics.json 의 key 여야 합니다: ${String(tk)}`)
        if (typeof w !== 'number' || !Number.isInteger(w) || w < 1 || w > 10) return at(`topics[${j}].weight 는 1~10 정수`)
        if (links.some((l) => l.key === tk)) return at(`topics[${j}] 중복: ${tk}`)
        links.push({ key: tk, weight: w })
      })
    if (rest.requiredExpressions === undefined && isObj(completionRule) && completionRule.requiredExpressions !== undefined) rest.requiredExpressions = completionRule.requiredExpressions
    const { value: v, problems: fieldProblems } = normalizeScenarioInput(rest, 'seed')
    for (const p of fieldProblems) at(`${p.field}: ${p.message}`)
    // exprSeq 는 사용자 상황의 표현 번호 고수위(shape.ts) — 시드는 고정 id 라 쓰지 않는다.
    if (constraints !== undefined && (!isObj(constraints) || 'steps' in constraints || 'opening' in constraints || 'exprSeq' in constraints)) at('constraints 는 객체이고 steps·opening 은 위 칸에 씁니다(exprSeq 는 넣지 않음)')
    if (grammarPoints !== undefined && (!Array.isArray(grammarPoints) || grammarPoints.length > 5)) at('grammarPoints 는 5개 이하 배열')
    if (fieldProblems.length || typeof key !== 'string' || !KEY.test(key)) return
    const exprs = v.keyExpressions!
    out.push({
      key,
      id: seedScenarioId(key),
      topics: links,
      data: {
        title: v.title!,
        titleJa: v.titleJa ?? null,
        description: v.description ?? null,
        level: v.level!,
        difficulty: v.difficulty ?? 2,
        roles: { learner: v.roles!.learner, tutor: v.roles!.tutor },
        goal: goalJson(v.goal!),
        constraints: constraintsJson(isObj(constraints) ? constraints : null, v.steps!, v.opening ?? null),
        keyExpressions: expressionsJson(exprs, exprs.map((x) => x.id!)),
        completionRule: completionRuleJson(null, v.requiredExpressions ?? defaultRequiredExpressions(exprs.length)),
        grammarPoints: Array.isArray(grammarPoints) ? grammarPoints : null,
      },
    })
  })
  if (problems.length) throw new Error(`[seed] scenarios.json 문제 ${problems.length}건:\n  ${problems.join('\n  ')}`)
  return out
}

export interface ExistingScenario {
  id: string
  userId: string | null
  isSeed: boolean
  title: string
  titleJa: string | null
  description: string | null
  level: string
  difficulty: number
  roles: unknown
  goal: unknown
  constraints: unknown
  keyExpressions: unknown
  completionRule: unknown
  grammarPoints: unknown
  topics: { topicId: string; weight: number }[]
}

export type PlanAction = 'keep' | 'update' | 'create'

export interface ScenarioPlan {
  key: string
  id: string
  title: string
  action: PlanAction
  changes: string[]
  data: SeedScenarioData
  /** 원하는 주제 연결(풀린 것만) · 바꿔야 하는가. */
  links: { topicId: string; weight: number }[]
  linksChanged: boolean
  /** DB 에 아직 없는 주제 key(드라이런에서 주제가 새로 만들어질 차례일 때). 실제 실행에서는 오류. */
  missingTopics: string[]
}

export interface SeedScenariosPlan {
  scenarios: ScenarioPlan[]
  /** 시드 데이터에서 빠진 기존 시드 상황 — 지우지 않는다(로그만). */
  orphans: { id: string; title: string }[]
}

/** 키 순서와 무관한 비교용 문자열. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (isObj(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`
  return JSON.stringify(v ?? null)
}

export function planSeedScenarios(seeds: readonly ScenarioSeed[], existing: readonly ExistingScenario[], topicIdByKey: ReadonlyMap<string, string | null>): SeedScenariosPlan {
  const byId = new Map(existing.map((e) => [e.id, e]))
  const scenarios = seeds.map((s): ScenarioPlan => {
    const hit = byId.get(s.id)
    if (hit && (!hit.isSeed || hit.userId !== null)) throw new Error(`[seed] 상황 id ${s.id} 가 시드가 아닌 행과 겹칩니다 — 사람이 확인하세요`)
    const missingTopics = s.topics.filter((t) => !topicIdByKey.get(t.key)).map((t) => t.key)
    const links = s.topics.flatMap((t) => {
      const topicId = topicIdByKey.get(t.key)
      return topicId ? [{ topicId, weight: t.weight }] : []
    })
    const linkKey = (xs: readonly { topicId: string; weight: number }[]) => stable([...xs].sort((a, b) => (a.topicId < b.topicId ? -1 : 1)))
    const linksChanged = linkKey(links) !== linkKey(hit?.topics ?? [])
    if (!hit) return { key: s.key, id: s.id, title: s.data.title, action: 'create', changes: [], data: s.data, links, linksChanged: links.length > 0, missingTopics }
    const cur: Record<string, unknown> = {
      title: hit.title, titleJa: hit.titleJa, description: hit.description, level: hit.level, difficulty: hit.difficulty, roles: hit.roles, goal: hit.goal,
      constraints: hit.constraints, keyExpressions: hit.keyExpressions, completionRule: hit.completionRule, grammarPoints: hit.grammarPoints,
    }
    const changes = (Object.keys(s.data) as (keyof SeedScenarioData)[]).filter((k) => stable(cur[k]) !== stable(s.data[k]))
    return { key: s.key, id: s.id, title: s.data.title, action: changes.length ? 'update' : 'keep', changes, data: s.data, links, linksChanged, missingTopics }
  })
  const wanted = new Set(seeds.map((s) => s.id))
  const orphans = existing.filter((e) => e.isSeed && e.userId === null && !wanted.has(e.id)).map((e) => ({ id: e.id, title: e.title }))
  return { scenarios, orphans }
}

export interface SeedScenariosSummary {
  scenarios: Record<PlanAction, number>
  linksChanged: number
  orphans: number
  writes: number
}

export function summarizeSeedScenariosPlan(plan: SeedScenariosPlan): SeedScenariosSummary {
  const n = (a: PlanAction) => plan.scenarios.filter((s) => s.action === a).length
  const scenarios = { keep: n('keep'), update: n('update'), create: n('create') }
  const linksChanged = plan.scenarios.filter((s) => s.linksChanged).length
  return { scenarios, linksChanged, orphans: plan.orphans.length, writes: scenarios.update + scenarios.create + linksChanged }
}

/** 시드 주제 key → DB 주제 id(제목 → 일본어 제목, seed-topics 와 같은 매칭). 새로 만들어질 차례면 null. */
export function resolveSeedTopicIds(topicSeeds: readonly SeedTopicInput[], existingTopics: readonly ExistingTopic[]): Map<string, string | null> {
  const plan = planSeedTopics(topicSeeds, existingTopics)
  return new Map(plan.topics.map((t) => [t.key, t.id]))
}

const toJson = (v: unknown) => v as Prisma.InputJsonValue

/** 계획 → (드라이런이 아니면) 상황마다 한 트랜잭션으로 create/update·연결 교체만. 삭제(상황)는 하지 않는다. */
export async function seedScenarios(prisma: PrismaClient, raw: unknown, topicSeeds: readonly SeedTopicInput[], opts: { dryRun?: boolean } = {}): Promise<SeedScenariosSummary> {
  const tag = opts.dryRun ? '[seed:dry-run]' : '[seed]'
  const seeds = parseSeedScenarios(raw, new Set(topicSeeds.map((t) => t.key)))
  const existingTopics = await prisma.conversationTopic.findMany({
    where: { isSeed: true, userId: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, title: true, titleJa: true, level: true, description: true, tags: true, chunks: { select: { id: true, chunkType: true, textJa: true, reading: true, meaningKo: true, order: true } } },
  })
  const topicIdByKey = resolveSeedTopicIds(topicSeeds, existingTopics)
  const existing = await prisma.scenario.findMany({
    where: { OR: [{ id: { in: seeds.map((s) => s.id) } }, { isSeed: true, userId: null }] },
    select: {
      id: true, userId: true, isSeed: true, title: true, titleJa: true, description: true, level: true, difficulty: true, roles: true, goal: true,
      constraints: true, keyExpressions: true, completionRule: true, grammarPoints: true, topics: { select: { topicId: true, weight: true } },
    },
  })
  const plan = planSeedScenarios(seeds, existing, topicIdByKey)
  const missing = plan.scenarios.filter((s) => s.missingTopics.length)
  for (const s of plan.scenarios) {
    if (s.action !== 'keep') console.log(`${tag} 상황 ${s.action} ${s.id} 「${s.title}」${s.changes.length ? ` 칸: ${s.changes.join(',')}` : ''}`)
    if (s.linksChanged) console.log(`${tag}   주제 연결 교체 ${s.id} → ${s.links.map((l) => `${l.topicId}(w${l.weight})`).join(', ') || '(없음)'}`)
    if (s.missingTopics.length) console.log(`${tag}   ⚠ DB 에 아직 없는 주제 key: ${s.missingTopics.join(', ')}`)
  }
  for (const o of plan.orphans) console.log(`${tag} ⚠ 시드에 없는 시드 상황(지우지 않음 — 사람이 판단) ${o.id} 「${o.title}」`)
  if (!opts.dryRun && missing.length) throw new Error(`[seed] 주제가 DB 에 없어 상황을 잇지 못합니다(주제 시드를 먼저): ${missing.map((s) => `${s.key}→${s.missingTopics.join('|')}`).join(', ')}`)
  if (!opts.dryRun) {
    for (const s of plan.scenarios) {
      if (s.action === 'keep' && !s.linksChanged) continue
      await prisma.$transaction(async (tx) => {
        const d = s.data
        const data = {
          title: d.title, titleJa: d.titleJa, description: d.description, level: d.level, difficulty: d.difficulty, roles: toJson(d.roles), goal: toJson(d.goal),
          constraints: toJson(d.constraints), keyExpressions: toJson(d.keyExpressions), completionRule: toJson(d.completionRule),
          grammarPoints: d.grammarPoints ? toJson(d.grammarPoints) : Prisma.DbNull,
        }
        if (s.action === 'create') await tx.scenario.create({ data: { id: s.id, userId: null, isSeed: true, status: 'ACTIVE', ...data } })
        else if (s.action === 'update') await tx.scenario.update({ where: { id: s.id }, data })
        if (s.linksChanged) {
          await tx.scenarioTopic.deleteMany({ where: { scenarioId: s.id } })
          if (s.links.length) await tx.scenarioTopic.createMany({ data: s.links.map((l) => ({ scenarioId: s.id, topicId: l.topicId, weight: l.weight })) })
        }
      })
    }
  }
  const sum = summarizeSeedScenariosPlan(plan)
  console.log(`${tag} 상황 ${seeds.length}개(유지 ${sum.scenarios.keep}·수정 ${sum.scenarios.update}·새 ${sum.scenarios.create}) · 연결 교체 ${sum.linksChanged} · 시드에 없는 시드 상황 ${sum.orphans}(지우지 않음) · ${opts.dryRun ? '쓰기 계획' : '쓴 단위'} ${sum.writes}건`)
  return sum
}
