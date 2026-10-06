import { ok, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { createChallenge, listChallenges, parseChallengeListQuery, parseCreateChallengeBody } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #155 챌린지 기록 `?status=ACTIVE|FINISHED|ALL&limit=&cursor=` — 진행 중 먼저, 끝난 것 `endedAt desc`. 자기 것만. 기간 지난 진행 중은 여기서 지연 전이. */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  const q = parseChallengeListQuery(req.nextUrl.searchParams)
  return ok(await listChallenges(s.user.id, q), null, { headers: { 'Cache-Control': 'private, no-store' } })
})

/**
 * #156 만들기 — 한 트랜잭션: 사용자 행 잠금 → 기간 지난 진행 중 지연 전이 → 진행 중 확인(409 ACTIVE_EXISTS) → 하루 20회(429) → `Challenge` 1행.
 * 주제는 시드 또는 내 주제만(아니면 404), 단어 장수가 주제 기본 표현 수를 넘으면 400 WORD_COUNT_OVER_POOL. 날짜는 서버 KST.
 */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  const input = parseCreateChallengeBody(await readJsonObject(req, 4 * 1024))
  return ok(await createChallenge(s.user.id, input))
})
