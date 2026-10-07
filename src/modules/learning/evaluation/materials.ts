/**
 * A6 출제 재료(api-contract #65, task-011 L2) — 코드가 고른다: 보관하지 않은 단어장 단어에서 **오답 우선** 가중 비복원 샘플링 ≤15개
 * (오늘의 단어와 같은 가중식 `weightOf`, 최근 14일 평가에 이미 나온 표기는 가중 ×0.1 — 14일 중복 해시 위반→재시도를 줄인다).
 * 재료 비율 ≥60% 가 A6 후검증이라, 그 비율을 채울 수 없는 단어 수면 출제 전에 400 `NOT_ENOUGH_WORDS {have, need}`.
 *
 * 14일 중복 해시는 conversation 의 `computeEvalItemHash` 가 계산한다(L3 는 L2 를 import 하지 않는다) — 여기서는 최근 14일 문항을
 * A6 원본 모양(`kind·prompt·expected·wordSurface·chunkType`)으로 되살려 돌려주고, 라우트가 해시로 바꿔 요청에 싣는다(module-dependency §4-4).
 */
import type { EvalItemKind, EvalKind, JlptLevel } from '@prisma/client'
import { ApiError, dates, prisma, type Tx } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'
import { isTopicVisibleTo, topicGone } from '../topics/visible'
import { createRng, sampleWeighted, weightOf, type Rng, type WeightInput } from '../vocab/setGenerator'
import type { CreateEvaluationInput } from './validate'

export const EVAL_MATERIALS_MAX = 15
export const EVAL_RECENT_DAYS = 14
/** 재료 비율 60% × 문항 수(WORDS 10 → 6, TALK 6 → 4) — 이보다 적으면 후검증을 통과할 수 없다. */
export const EVAL_MATERIAL_MIN: Record<EvalKind, number> = { WORDS: 6, TALK: 4 }
const RECENT_WEIGHT = 0.1
const POOL_MAX = 2_000

export interface EvalMaterialWord extends WeightInput {
  id: string
  surface: string
  reading: string | null
  meaning: string
}

/** 가중 샘플링 후 오답 많은 순(같으면 뽑힌 순) — 프롬프트가 "오답이 많을수록 먼저" 라고 읽는다. */
export function pickEvalMaterials(pool: readonly EvalMaterialWord[], recentSurfaces: ReadonlySet<string>, rng: Rng, now: Date, max = EVAL_MATERIALS_MAX): EvalMaterialWord[] {
  const sorted = pool.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const weights = sorted.map((w) => weightOf(w, now) * (recentSurfaces.has(w.surface) ? RECENT_WEIGHT : 1))
  const picked = sampleWeighted(sorted, weights, Math.min(max, sorted.length), rng)
  return picked.map((w, i) => ({ w, i })).sort((x, y) => y.w.wrongCount - x.w.wrongCount || x.i - y.i).map((x) => x.w)
}

/** 과거 문항(A6 원본 모양) — 라우트가 `computeEvalItemHash` 로 해시를 만든다. */
export interface RecentEvalItem {
  kind: EvalItemKind
  prompt: unknown
  expected: unknown
  wordSurface: string | null
  chunkType: string | null
}

export interface EvaluationMaterials {
  input: CreateEvaluationInput
  kind: EvalKind
  level: JlptLevel
  topic: { id: string; title: string; titleJa: string | null } | null
  /** 오답 우선으로 고른 재료(≤15). */
  words: EvalMaterialWord[]
  /** 보관하지 않은 단어 수. */
  wordCount: number
  recentItems: RecentEvalItem[]
  todayKst: string
}

/**
 * #65 재료 — 읽기 전용(점유 전). 주제는 시드 또는 내 것(아니면 404 `TOPIC_GONE`), 이 사용자가 가린 시드도 같은 404(task-045 §2 새 시작 차단 ·
 * REV-150 M1, 진행 중 챌린지 예외 없음). 단어가 모자라면 400 NOT_ENOUGH_WORDS. `db` 는 시험용(기본 prisma).
 */
export async function loadEvaluationMaterials(userId: string, input: CreateEvaluationInput, now = new Date(), db: Tx = prisma): Promise<EvaluationMaterials> {
  const level = input.level ?? ((await getProfile(userId)).level as JlptLevel)
  let topic: EvaluationMaterials['topic'] = null
  if (input.topicId) {
    const t = await db.conversationTopic.findFirst({ where: { id: input.topicId, OR: [{ userId: null }, { userId }] }, select: { id: true, title: true, titleJa: true, userId: true } })
    if (!t || !(await isTopicVisibleTo(db, userId, t))) throw topicGone()
    topic = { id: t.id, title: t.title, titleJa: t.titleJa }
  }
  const pool = await db.wordEntry.findMany({
    where: { userId, archived: false },
    orderBy: [{ wrongCount: 'desc' }, { id: 'asc' }],
    take: POOL_MAX,
    select: { id: true, surface: true, reading: true, meaning: true, correctCount: true, wrongCount: true, lastSeenAt: true },
  })
  const need = EVAL_MATERIAL_MIN[input.kind]
  if (pool.length < need) {
    throw new ApiError('VALIDATION', `단어장에 단어가 ${need}개 이상 있어야 평가를 만들 수 있어요.`, { field: 'kind', reason: 'NOT_ENOUGH_WORDS', have: pool.length, need })
  }
  const since = new Date(now.getTime() - EVAL_RECENT_DAYS * 86_400_000)
  const recent = await db.evaluationItem.findMany({
    where: { evaluation: { userId, startedAt: { gte: since } } },
    select: { kind: true, prompt: true, expected: true, wordSurfaceSnap: true, chunkType: true },
    take: 500,
  })
  const recentItems: RecentEvalItem[] = recent.map((r) => ({ kind: r.kind, prompt: r.prompt, expected: r.expected, wordSurface: r.wordSurfaceSnap, chunkType: r.chunkType }))
  const recentSurfaces = new Set(recentItems.flatMap((r) => (r.wordSurface ? [r.wordSurface] : [])))
  const rng = createRng(`${userId}|${now.getTime()}`)
  return { input, kind: input.kind, level, topic, words: pickEvalMaterials(pool, recentSurfaces, rng, now), wordCount: pool.length, recentItems, todayKst: dates.todayKst(now) }
}
