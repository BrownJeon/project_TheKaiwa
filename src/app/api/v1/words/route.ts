import { ApiError, ok, parseLimit, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { buildWordEnrichRequest } from '@/modules/conversation'
import { createWord, enrichWord, findWordIdBySurface, isBlankMeaning, listWords, parseEnrichSurface, parseWordInput, parseWordListQuery } from '@/modules/learning'
import { getProfile } from '@/modules/preferences'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #40 단어 목록 — 검색·카테고리·조각(`chunkType`, task-023)·보관함·정렬 3종을 AND 로, `{items, nextCursor, total}`. 잘못된 쿼리 값은 400. */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  const q = req.nextUrl.searchParams
  return ok(await listWords(s.user.id, parseWordListQuery(q, parseLimit(q.get('limit'), 20, 100))))
})

/**
 * #41 단어 추가. `enrich:true` + 뜻 없음 → A10 보강 **draft 만**(저장 안 함, F8 비일본어는 `valid:false`), 사용자당 분당 20회.
 * 요청(프롬프트·스키마)은 conversation 이 만들고 learning 이 실행한다(L3 는 L2 를 import 하지 않는다 — 라우트가 값으로 넘김).
 * 그 밖에는 완전한 본문을 즉시 저장(`source=MANUAL`). 같은 표현이면 409 `{existingId}`.
 */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  const userId = s.user.id
  const { enrich, ...rest } = await readJsonObject(req)
  if (enrich !== undefined && typeof enrich !== 'boolean') throw new ApiError('VALIDATION', 'enrich 는 true/false 여야 합니다.', { field: 'enrich', reason: 'boolean' })
  if (enrich === true && isBlankMeaning(rest.meaning)) {
    const surface = parseEnrichSurface(rest)
    rateLimit(`enrich:${userId}`, 20)
    const existingId = await findWordIdBySurface(userId, surface)
    if (existingId) throw new ApiError('CONFLICT', '단어장에 같은 표현이 이미 있어요.', { existingId })
    const { level } = await getProfile(userId)
    const { draft } = await enrichWord({ surface, level }, buildWordEnrichRequest({ surface, level }))
    return ok({ draft, saved: false })
  }
  const word = await createWord(userId, { ...parseWordInput(rest), source: 'MANUAL' })
  return ok({ word, saved: true })
})
