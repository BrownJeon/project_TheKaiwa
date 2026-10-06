import { ok, rateLimit, requireSession, withApi } from '@/modules/infra'
import { finishRolePlay } from '@/modules/conversation'
import { nextScenarioFor } from '../../../_lib/rolePlay'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// 판정 LLM 20s + 잠금 tx 두 번 — 플랫폼 상한이 있는 배포에서도 끊기지 않게(자체 호스팅 next start 는 상한 없음).
export const maxDuration = 60

type Ctx = { params: Promise<{ id: string }> }

/**
 * #167 상황 역할극 마치기(task-010d A3b-1, 가이드 S8) — 학습자 직접 행위라 결과를 바로 기록한다(StudyLog DIRECT + DAILY + 반복 항목 + 관측, 한 트랜잭션).
 * 판정 LLM 은 잠금 밖에서 부르고(실패·시간 초과면 판정 없이 코드 규칙만 — "거의" 이하), 기록은 다시 잠근 뒤 재확인한다(conversation `finishRolePlay` 머리말).
 * 응답 = ResultView(`RolePlayResultView`) + `next?`(코드 추천). 여러 번 불러도 기록은 한 번(`replayed:true`).
 * 오류: 401 · 남의·없는 대화 404 · 역할극 아님 400 · 학습자 말 0 409 `NO_TURNS` · 선생님 답 진행 중 409 `TURN_RUNNING` · 분당 상한 429.
 */
export const POST = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  rateLimit(`scenario-finish:${s.user.id}`, 10)
  const result = await finishRolePlay(s.user.id, id)
  const next = await nextScenarioFor(s.user.id, result.scenarioId)
  return ok({ ...result, ...(next ? { next } : {}) })
})
