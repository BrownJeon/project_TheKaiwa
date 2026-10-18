import { ApiError, ok, parseLimit, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { buildWordEnrichRequest } from '@/modules/conversation'
import { assertEnrichSurfaceFree, createWord, enrichWord, isBlankMeaning, listWords, parseEnrichSurface, parseWordInput, parseWordListQuery } from '@/modules/learning'
import { getProfile } from '@/modules/preferences'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #40 단어 목록(task-068) — 내 단어 + 공용 기본 단어, 출처(`source`)·검색·분류·조각·나의 보관함·나의 즐겨찾기(`favorite=1`, task-074 — `0`·없음은 조건 없음)·정렬 3종 AND, 쪽 번호(`page`·`limit`).
 * `{items, total, page, pages, limit, baseTotal}`. 항목마다 나의 `archived`·`favorite`·`favoritedAt`. 잘못된 쿼리 값·`cursor`·`chunkType=none` 은 400.
 */
export const GET = withApi(async (req) => {
  const s = await requireSession()
  const q = req.nextUrl.searchParams
  return ok(await listWords(s.user.id, parseWordListQuery(q, parseLimit(q.get('limit'), 20, 100))))
})

/**
 * #41 단어 추가. `enrich:true` + 뜻 없음 → A10 보강 **draft 만**(저장 안 함, F8 비일본어는 `valid:false`), 사용자당 분당 20회.
 * 요청(프롬프트·스키마)은 conversation 이 만들고 learning 이 실행한다(L3 는 L2 를 import 하지 않는다 — 라우트가 값으로 넘김).
 * 보강 전에 내 단어(409 `{existingId}`)·기본 단어(409 `BASE_DUPLICATE`, 표기만) 중복을 먼저 본다 — 중복이면 LLM 을 부르지 않는다.
 * 그 밖에는 완전한 본문을 즉시 저장(`source=MANUAL`, `jlpt` 키는 400 — task-068). 기본 단어와 같은 (표기, 읽기)면 409 `BASE_DUPLICATE`.
 */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  const userId = s.user.id
  const { enrich, ...rest } = await readJsonObject(req)
  if (enrich !== undefined && typeof enrich !== 'boolean') throw new ApiError('VALIDATION', 'enrich 는 true/false 여야 합니다.', { field: 'enrich', reason: 'boolean' })
  if (enrich === true && isBlankMeaning(rest.meaning)) {
    const surface = parseEnrichSurface(rest)
    rateLimit(`enrich:${userId}`, 20)
    await assertEnrichSurfaceFree(userId, surface)
    const { level } = await getProfile(userId)
    const { draft } = await enrichWord({ surface, level }, buildWordEnrichRequest({ surface, level }))
    return ok({ draft, saved: false })
  }
  const word = await createWord(userId, { ...parseWordInput(rest, '', { jlpt: false }), source: 'MANUAL' })
  return ok({ word, saved: true })
})
