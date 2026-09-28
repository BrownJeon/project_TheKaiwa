import { ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { buildEvalGenRequest, computeEvalItemHash, EVAL_GEN_PROMPT_VERSION, type EvalGenItem } from '@/modules/conversation'
import { createEvaluation, listEvaluations, loadEvaluationMaterials, parseCreateEvaluationBody, parseEvaluationListQuery, type RecentEvalItem } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 과거 문항(DB 의 A6 원본) → 14일 중복 해시. 모양이 어긋난 옛 행은 건너뛴다(해시를 못 만들면 비교 대상도 아니다). */
function recentHashes(items: readonly RecentEvalItem[]): string[] {
  const out = new Set<string>()
  for (const it of items) {
    try {
      out.add(computeEvalItemHash(it as unknown as EvalGenItem))
    } catch {
      // 모양이 다른 행 — 무시
    }
  }
  return [...out]
}

/**
 * #65 평가 출제(A6 잡 60s) — `{kind:'WORDS'|'TALK', topicId?, level?}`. 라우트가 조합한다(module-dependency §4-4):
 *   learning 재료(레벨 기본 Profile.level·주제(시드/내 것, 아니면 404)·단어장 오답 우선 ≤15·최근 14일 문항) → 14일 해시(conversation `computeEvalItemHash`)
 *   → conversation `buildEvalGenRequest`(프롬프트·스키마·후검증·결정적 보정) → learning `createEvaluation`(점유 트랜잭션 + 백그라운드 잡).
 * 진행 중 평가가 있으면 409 `{reason:'IN_PROGRESS', evaluationId, status}`, 단어가 모자라면 400 `{reason:'NOT_ENOUGH_WORDS', have, need}`
 * (WORDS 6·TALK 4 — 재료 60% 규칙). 응답 `{evaluationId, jobId, status:'GENERATING'}` — jobId 로 #55 폴링, DONE 이면 #66. 사용자당 분당 10.
 */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  const userId = s.user.id
  rateLimit(`eval-create:${userId}`, 10)
  const input = parseCreateEvaluationBody(await readJsonObject(req, 4 * 1024))
  const m = await loadEvaluationMaterials(userId, input)
  const hashes = recentHashes(m.recentItems)
  const request = buildEvalGenRequest({
    todayKst: m.todayKst,
    kind: m.kind,
    level: m.level,
    topic: m.topic ? { title: m.topic.title, titleJa: m.topic.titleJa } : null,
    materials: m.words.map((w) => ({ surface: w.surface, reading: w.reading, meaning: w.meaning, wrongCount: w.wrongCount })),
    recentHashes: hashes,
  })
  const inputMeta = { kind: m.kind, level: m.level, topic: m.topic !== null, materials: m.words.length, wordCount: m.wordCount, recentHashes: hashes.length }
  return ok(await createEvaluation(userId, m, { request, promptVersion: EVAL_GEN_PROMPT_VERSION, inputMeta }))
})

/**
 * #69 평가 기록 — `?limit=1~50(기본 20)&cursor=&kind=`. 최근 것부터, 출제 실패 빈 행은 빼고 진행 중 평가는 넣는다(오늘 홈 카드 `limit=1`).
 * 항목 `{id, kind, level, status, topic, totalScore, grade, startedAt, deadlineAt, submittedAt, completedAt}` — 점수·등급은 DONE 만.
 */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  return ok(await listEvaluations(s.user.id, parseEvaluationListQuery(req.nextUrl.searchParams)), null, { headers: { 'Cache-Control': 'private, no-store' } })
})
