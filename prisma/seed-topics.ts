/**
 * 시드 주제·조각 — **안정 id upsert**(task-010 후속). 주제 조각 id 는 `RepetitionItem(refType='TopicChunk').refId` 가 가리키므로
 * 시드를 다시 돌려도 **이미 있는 행의 id 는 바뀌지 않아야 한다**(운영·개발 공유 DB). 그래서 지우고 새로 만들지 않는다.
 *
 * 매칭(순수 함수 `planSeedTopics` — 단위 테스트가 직접 부른다):
 *   주제: 시드 주제(isSeed·userId null) 중 **제목 일치** → 없으면 **일본어 제목 일치**(제목만 고쳐도 같은 행). 없으면 새로 만든다.
 *   조각: 그 주제의 기존 조각 중 ① **표기(textJa) 일치** → ② 남은 것 중 **같은 순서(order)** → 없으면 새로 만든다.
 *         (순서만 바뀌면 ①로 제자리, 표기 오타 수정은 ②로 제자리, 중간 삽입은 새 행.)
 *   시드 데이터에서 빠진 주제·조각은 **지우지 않고 로그만** — 삭제는 사람이 판단한다(반복 학습 항목이 가리킬 수 있다).
 * 바뀐 칸이 없으면 쓰지 않는다(`keep`). `SEED_DRY_RUN=1` 이면 계획만 출력하고 아무것도 쓰지 않는다.
 */
import type { ChunkType, JlptLevel, PrismaClient } from '@prisma/client'

export interface SeedChunkInput {
  chunkType: string
  textJa: string
  reading: string
  meaningKo: string
}

export interface SeedTopicInput {
  key: string
  title: string
  titleJa: string
  level: string
  description: string
  tags: string[]
  chunks: SeedChunkInput[]
}

export interface ExistingChunk {
  id: string
  chunkType: string
  textJa: string
  reading: string | null
  meaningKo: string
  order: number
}

export interface ExistingTopic {
  id: string
  title: string
  titleJa: string | null
  level: string
  description: string | null
  tags: unknown
  chunks: ExistingChunk[]
}

export type PlanAction = 'keep' | 'update' | 'create'

export interface ChunkPlan {
  action: PlanAction
  /** 기존 행 id(create 면 null) — **바뀌지 않는다**. */
  id: string | null
  order: number
  matchedBy: 'textJa' | 'order' | null
  /** 바뀌는 칸 이름(update 일 때). */
  changes: string[]
  data: { chunkType: string; textJa: string; reading: string; meaningKo: string; order: number }
}

export interface TopicPlan {
  key: string
  title: string
  action: PlanAction
  id: string | null
  matchedBy: 'title' | 'titleJa' | null
  changes: string[]
  data: { title: string; titleJa: string; level: string; description: string; tags: string[] }
  chunks: ChunkPlan[]
  /** 시드 데이터에서 빠진 기존 조각 — 지우지 않는다(로그만). */
  orphanChunks: { id: string; order: number; textJa: string }[]
}

export interface SeedTopicsPlan {
  topics: TopicPlan[]
  /** 시드 데이터에서 빠진 기존 시드 주제 — 지우지 않는다(로그만). */
  orphanTopics: { id: string; title: string }[]
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

function diff(cur: Record<string, unknown>, next: Record<string, unknown>): string[] {
  return Object.keys(next).filter((k) => !same(cur[k], next[k]))
}

export function planSeedChunks(seed: readonly SeedChunkInput[], existing: readonly ExistingChunk[]): { chunks: ChunkPlan[]; orphans: ExistingChunk[] } {
  const pool = [...existing].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  const used = new Set<string>()
  const matched: (ExistingChunk | null)[] = seed.map(() => null)
  const by: ('textJa' | 'order' | null)[] = seed.map(() => null)
  seed.forEach((c, i) => {
    const hit = pool.find((e) => !used.has(e.id) && e.textJa === c.textJa)
    if (hit) {
      matched[i] = hit
      by[i] = 'textJa'
      used.add(hit.id)
    }
  })
  seed.forEach((_, i) => {
    if (matched[i]) return
    const hit = pool.find((e) => !used.has(e.id) && e.order === i)
    if (hit) {
      matched[i] = hit
      by[i] = 'order'
      used.add(hit.id)
    }
  })
  const chunks: ChunkPlan[] = seed.map((c, i) => {
    const data = { chunkType: c.chunkType, textJa: c.textJa, reading: c.reading, meaningKo: c.meaningKo, order: i }
    const e = matched[i]
    if (!e) return { action: 'create', id: null, order: i, matchedBy: null, changes: [], data }
    const changes = diff({ chunkType: e.chunkType, textJa: e.textJa, reading: e.reading, meaningKo: e.meaningKo, order: e.order }, data)
    return { action: changes.length ? 'update' : 'keep', id: e.id, order: i, matchedBy: by[i], changes, data }
  })
  return { chunks, orphans: pool.filter((e) => !used.has(e.id)) }
}

export function planSeedTopics(seeds: readonly SeedTopicInput[], existing: readonly ExistingTopic[]): SeedTopicsPlan {
  const used = new Set<string>()
  const pick = (f: (e: ExistingTopic) => boolean) => existing.find((e) => !used.has(e.id) && f(e)) ?? null
  const matches: { hit: ExistingTopic | null; by: 'title' | 'titleJa' | null }[] = seeds.map((s) => {
    const hit = pick((e) => e.title === s.title)
    if (hit) used.add(hit.id)
    return { hit, by: hit ? 'title' : null }
  })
  seeds.forEach((s, i) => {
    if (matches[i].hit) return
    const hit = pick((e) => !!e.titleJa && e.titleJa === s.titleJa)
    if (hit) {
      used.add(hit.id)
      matches[i] = { hit, by: 'titleJa' }
    }
  })
  const topics: TopicPlan[] = seeds.map((s, i) => {
    const data = { title: s.title, titleJa: s.titleJa, level: s.level, description: s.description, tags: s.tags }
    const { hit, by } = matches[i]
    const chunkPlan = planSeedChunks(s.chunks, hit?.chunks ?? [])
    const orphanChunks = chunkPlan.orphans.map((o) => ({ id: o.id, order: o.order, textJa: o.textJa }))
    if (!hit) return { key: s.key, title: s.title, action: 'create', id: null, matchedBy: null, changes: [], data, chunks: chunkPlan.chunks, orphanChunks }
    const changes = diff({ title: hit.title, titleJa: hit.titleJa, level: hit.level, description: hit.description, tags: hit.tags }, data)
    return { key: s.key, title: s.title, action: changes.length ? 'update' : 'keep', id: hit.id, matchedBy: by, changes, data, chunks: chunkPlan.chunks, orphanChunks }
  })
  return { topics, orphanTopics: existing.filter((e) => !used.has(e.id)).map((e) => ({ id: e.id, title: e.title })) }
}

export interface SeedTopicsSummary {
  topics: Record<PlanAction, number>
  chunks: Record<PlanAction, number>
  orphanTopics: number
  orphanChunks: number
  /** 쓰기가 필요한 행 수(create + update). 0 이면 DB 가 시드와 같다. */
  writes: number
}

export function summarizeSeedTopicsPlan(plan: SeedTopicsPlan): SeedTopicsSummary {
  const count = (xs: { action: PlanAction }[]) => ({ keep: xs.filter((x) => x.action === 'keep').length, update: xs.filter((x) => x.action === 'update').length, create: xs.filter((x) => x.action === 'create').length })
  const topics = count(plan.topics)
  const chunks = count(plan.topics.flatMap((t) => t.chunks))
  return {
    topics,
    chunks,
    orphanTopics: plan.orphanTopics.length,
    orphanChunks: plan.topics.reduce((n, t) => n + t.orphanChunks.length, 0),
    writes: topics.update + topics.create + chunks.update + chunks.create,
  }
}

function logPlan(plan: SeedTopicsPlan, dryRun: boolean): void {
  const tag = dryRun ? '[seed:dry-run]' : '[seed]'
  for (const t of plan.topics) {
    if (t.action !== 'keep') console.log(`${tag} 주제 ${t.action} ${t.id ?? '(새 행)'} 「${t.title}」${t.changes.length ? ` 칸: ${t.changes.join(',')}` : ''}${t.matchedBy === 'titleJa' ? ' (일본어 제목으로 매칭)' : ''}`)
    for (const c of t.chunks) if (c.action !== 'keep') console.log(`${tag}   조각 ${c.action} ${c.id ?? '(새 행)'} #${c.order} ${c.data.textJa}${c.changes.length ? ` 칸: ${c.changes.join(',')}` : ''}${c.matchedBy ? ` (${c.matchedBy} 매칭)` : ''}`)
    for (const o of t.orphanChunks) console.log(`${tag}   ⚠ 시드에 없는 조각(지우지 않음 — 사람이 판단) ${o.id} #${o.order} ${o.textJa} — 주제 「${t.title}」`)
  }
  for (const o of plan.orphanTopics) console.log(`${tag} ⚠ 시드에 없는 시드 주제(지우지 않음 — 사람이 판단) ${o.id} 「${o.title}」`)
}

/** 계획 → (드라이런이 아니면) 주제마다 한 트랜잭션으로 update/create 만. 삭제는 하지 않는다. */
export async function seedTopics(prisma: PrismaClient, seeds: readonly SeedTopicInput[], opts: { dryRun?: boolean } = {}): Promise<SeedTopicsSummary> {
  const existing = await prisma.conversationTopic.findMany({
    where: { isSeed: true, userId: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, title: true, titleJa: true, level: true, description: true, tags: true, chunks: { select: { id: true, chunkType: true, textJa: true, reading: true, meaningKo: true, order: true } } },
  })
  const plan = planSeedTopics(seeds, existing)
  const summary = summarizeSeedTopicsPlan(plan)
  logPlan(plan, !!opts.dryRun)
  if (!opts.dryRun) {
    for (const t of plan.topics) {
      if (t.action === 'keep' && t.chunks.every((c) => c.action === 'keep')) continue
      await prisma.$transaction(async (tx) => {
        const topicData = { ...t.data, level: t.data.level as JlptLevel }
        let topicId = t.id
        if (t.action === 'create') topicId = (await tx.conversationTopic.create({ data: { ...topicData, isSeed: true }, select: { id: true } })).id
        else if (t.action === 'update') await tx.conversationTopic.update({ where: { id: t.id! }, data: topicData })
        for (const c of t.chunks) {
          const chunkData = { ...c.data, chunkType: c.data.chunkType as ChunkType }
          if (c.action === 'create') await tx.topicChunk.create({ data: { topicId: topicId!, ...chunkData } })
          else if (c.action === 'update') await tx.topicChunk.update({ where: { id: c.id! }, data: chunkData })
        }
      })
    }
  }
  const s = summary
  console.log(
    `${opts.dryRun ? '[seed:dry-run]' : '[seed]'} 주제 ${seeds.length}개(유지 ${s.topics.keep}·수정 ${s.topics.update}·새 ${s.topics.create}) · 조각 ${seeds.reduce((n, t) => n + t.chunks.length, 0)}개(유지 ${s.chunks.keep}·수정 ${s.chunks.update}·새 ${s.chunks.create}) · 시드에 없는 주제 ${s.orphanTopics}·조각 ${s.orphanChunks}(지우지 않음) · ${opts.dryRun ? '쓰기 계획' : '쓴 행'} ${s.writes}건`,
  )
  return summary
}
