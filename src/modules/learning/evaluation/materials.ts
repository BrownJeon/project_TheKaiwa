/**
 * A6 출제 재료(api-contract #65, task-011 L2) — 코드가 고른다: 보관하지 않은 단어장 단어(task-068: 내 단어 + 공용 기본 단어, 보관·
 * 맞힘/틀림은 나의 `UserWordState`)에서 **오답 우선** 가중 비복원 샘플링 ≤15개
 * (오늘의 단어와 같은 가중식 `weightOf`, 최근 14일 평가에 이미 나온 표기는 가중 ×0.1 — 14일 중복 해시 위반→재시도를 줄인다).
 * 재료 비율 ≥60% 가 A6 후검증이라, 그 비율을 채울 수 없는 단어 수면 출제 전에 400 `NOT_ENOUGH_WORDS {have, need}`.
 * 가중에는 오늘의 단어 세트와 같은 **수준 상한**(평가 수준·목표 수준 중 어려운 쪽 — `ceilingOf`)이 들어 있어, 천장보다 어려운 단어는 거의 안 뽑힌다.
 *
 * 14일 중복 해시는 conversation 의 `computeEvalItemHash` 가 계산한다(L3 는 L2 를 import 하지 않는다) — 여기서는 최근 14일 문항을
 * A6 원본 모양(`kind·prompt·expected·wordSurface·chunkType`)으로 되살려 돌려주고, 라우트가 해시로 바꿔 요청에 싣는다(module-dependency §4-4).
 */
import type { EvalItemKind, EvalKind, JlptLevel } from '@prisma/client'
import { ApiError, dates, prisma, type Tx } from '@/modules/infra'
import { getProfile } from '@/modules/preferences'
import { isTopicVisibleTo, topicGone } from '../topics/visible'
import type { LevelReader } from '../vocab/sessions'
import { ceilingOf, createRng, LEVEL_FACTOR_FLOOR, levelFactor, sampleWeighted, weightOf, type LevelCode, type Rng, type WeightInput } from '../vocab/setGenerator'
import { activeWordWhere, EMPTY_WORD_STATE, loadActiveWordStates } from '../vocab/wordState'
import type { CreateEvaluationInput } from './validate'

export const EVAL_MATERIALS_MAX = 15
export const EVAL_RECENT_DAYS = 14
/** 재료 비율 60% × 문항 수(WORDS 10 → 6, TALK 6 → 4) — 이보다 적으면 후검증을 통과할 수 없다. */
export const EVAL_MATERIAL_MIN: Record<EvalKind, number> = { WORDS: 6, TALK: 4 }
const RECENT_WEIGHT = 0.1

export interface EvalMaterialWord extends WeightInput {
  id: string
  surface: string
  reading: string | null
  meaning: string
  /** 단어의 JLPT 단계 — 수준 상한 가중에만 쓴다(프롬프트로는 나가지 않는다). 없으면(직접 입력한 단어 등) 계수 1. */
  jlpt?: LevelCode | null
}

/**
 * 가중 샘플링 후 오답 많은 순(같으면 뽑힌 순) — 프롬프트가 "오답이 많을수록 먼저" 라고 읽는다.
 * `ceiling` 을 주면 오늘의 단어 세트와 같은 방식으로 수준 상한 계수(`levelFactor`)를 곱한다(task-068: 풀이 N1 3천 개를 품은 기본 단어까지 커져
 * 상한 없이는 N5 학습자의 재료에 N1 이 4할 섞였다). 주지 않거나 후보에 `jlpt` 가 없으면 계산·난수 소비가 변경 전과 같다.
 */
export function pickEvalMaterials(
  pool: readonly EvalMaterialWord[],
  recentSurfaces: ReadonlySet<string>,
  rng: Rng,
  now: Date,
  max = EVAL_MATERIALS_MAX,
  ceiling?: LevelCode | null,
): EvalMaterialWord[] {
  const sorted = pool.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const weights = sorted.map((w) => {
    const base = weightOf(w, now) * (recentSurfaces.has(w.surface) ? RECENT_WEIGHT : 1)
    return ceiling ? base * Math.max(levelFactor(w.jlpt, ceiling), LEVEL_FACTOR_FLOOR) : base
  })
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
 * REV-150 M1, 진행 중 챌린지 예외 없음). 단어가 모자라면 400 NOT_ENOUGH_WORDS. `db`·`pick`·`readProfile` 은 시험용(기본 prisma·
 * `pickEvalMaterials`·`getProfile`) — `pick` 은 풀이 자르기 없이 통째로 들어가는지·천장이 무엇으로 넘어가는지 시험이 엿보는 자리다.
 */
export async function loadEvaluationMaterials(
  userId: string,
  input: CreateEvaluationInput,
  now = new Date(),
  db: Tx = prisma,
  pick: typeof pickEvalMaterials = pickEvalMaterials,
  readProfile: LevelReader = getProfile,
): Promise<EvaluationMaterials> {
  // 프로필은 한 번만 읽는다 — 수준(level 을 안 줬을 때)과 목표 수준(천장)이 같은 읽기를 쓴다. level 을 준 요청은 천장 때문에만 읽으므로
  // 주제·단어 수 검사(404·400)를 지난 뒤로 미룬다 — 그 검사에서 끝나는 요청에 읽기를 더하지 않는다.
  let profile: ReturnType<LevelReader> | undefined
  const profileOnce = () => (profile ??= readProfile(userId))
  const level = input.level ?? ((await profileOnce()).level as JlptLevel)
  let topic: EvaluationMaterials['topic'] = null
  if (input.topicId) {
    const t = await db.conversationTopic.findFirst({ where: { id: input.topicId, OR: [{ userId: null }, { userId }] }, select: { id: true, title: true, titleJa: true, userId: true } })
    if (!t || !(await isTopicVisibleTo(db, userId, t))) throw topicGone()
    topic = { id: t.id, title: t.title, titleJa: t.titleJa }
  }
  // task-068: 재료 = 내 단어 + 공용 기본 단어(≈7.8천) 중 내가 보관 안 한 것 **전체**. 길이 상한을 두지 않는다 — 예전 `POOL_MAX=2,000` 자르기는
  // 풀이 내 단어뿐일 때만 무해했고, 기본 단어가 들어온 뒤로는 오답 없는 내 새 단어를 풀에서 밀어냈다(REV-068B-1). 5칸 SELECT(`jlpt` 는 수준 상한 가중용) 라 읽기·가중
  // 샘플링은 수십 ms 이하. 「많이 틀린 순」은 나의 UserWordState 값이라 `pickEvalMaterials` 의 가중(`weightOf`)·마지막 오답 내림차순 정렬이 맡는다.
  const [rows, states] = await Promise.all([
    db.wordEntry.findMany({ where: activeWordWhere(userId), select: { id: true, surface: true, reading: true, meaning: true, jlpt: true } }),
    loadActiveWordStates(db, userId),
  ])
  const pool = rows.map((w): EvalMaterialWord => {
    const s = states.get(w.id) ?? EMPTY_WORD_STATE
    return { ...w, correctCount: s.correctCount, wrongCount: s.wrongCount, lastSeenAt: s.lastSeenAt }
  })
  const need = EVAL_MATERIAL_MIN[input.kind]
  if (pool.length < need) {
    throw new ApiError('VALIDATION', `단어장에 단어가 ${need}개 이상 있어야 평가를 만들 수 있어요.`, { field: 'kind', reason: 'NOT_ENOUGH_WORDS', have: pool.length, need })
  }
  const since = new Date(now.getTime() - EVAL_RECENT_DAYS * 86_400_000)
  const [recent, goalLevel] = await Promise.all([
    db.evaluationItem.findMany({
      where: { evaluation: { userId, startedAt: { gte: since } } },
      select: { kind: true, prompt: true, expected: true, wordSurfaceSnap: true, chunkType: true },
      take: 500,
    }),
    // 천장은 부가 가중이다 — 목표 수준을 못 읽어도(level 을 준 요청) 평가는 만든다. 그때는 평가 수준만으로 천장을 잡는다.
    profileOnce().then((p) => p.goalLevel, () => null),
  ])
  const recentItems: RecentEvalItem[] = recent.map((r) => ({ kind: r.kind, prompt: r.prompt, expected: r.expected, wordSurface: r.wordSurfaceSnap, chunkType: r.chunkType }))
  const recentSurfaces = new Set(recentItems.flatMap((r) => (r.wordSurface ? [r.wordSurface] : [])))
  const rng = createRng(`${userId}|${now.getTime()}`)
  // 천장 = 평가 수준과 목표 수준 중 어려운 쪽(오늘의 단어 세트 `levelCeilingFor` 와 같은 규칙) — 그보다 어려운 단어는 가중이 줄어 거의 안 뽑힌다.
  const ceiling = ceilingOf(level, goalLevel)
  return { input, kind: input.kind, level, topic, words: pick(pool, recentSurfaces, rng, now, EVAL_MATERIALS_MAX, ceiling), wordCount: pool.length, recentItems, todayKst: dates.todayKst(now) }
}
