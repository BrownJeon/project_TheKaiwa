import { ok, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { listCorrectionRefsByWord } from '@/modules/conversation'
import { deleteWord, getWordDetail, parseWordPatch, updateWord } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #42 단어 상세 — learning(단어·나의 풀이 통계) + conversation(이 단어를 만든 나의 교정 참조)을 라우트가 조합.
 * 기본 단어는 누구에게나(읽기 전용), 남의 단어 404. `stats`·`corrections` 는 요청한 사용자의 기록만(task-068).
 */
export const GET = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const detail = await getWordDetail(s.user.id, id)
  return ok({ ...detail, corrections: await listCorrectionRefsByWord(s.user.id, id) })
})

/**
 * #43 부분 수정 — 내 단어만. 카운터·출처·보관·즐겨찾기 상태(`favorite`·`favoritedAt` — #182/#183 으로만 바꾼다, task-074)·`jlpt` 는 400 `read_only`,
 * `chunkType: null` 400, 표현이 바뀌면 중복 409 `{existingId}`, 기본 단어와 같아지면 409 `BASE_DUPLICATE`. 기본 단어 id 는 403 `READ_ONLY`(task-068).
 * 응답은 수정 뒤 단어 + 나의 상태(보관·즐겨찾기 그대로).
 */
export const PATCH = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const patch = parseWordPatch(await readJsonObject(req))
  return ok(await updateWord(s.user.id, id, patch))
})

/** #44 삭제 — 내 단어만(기본 단어 403 `READ_ONLY`). 세트 카드·교정·평가 문항 참조는 SetNull + `*Snap` 유지, 집계 스냅샷 불변. */
export const DELETE = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  return ok(await deleteWord(s.user.id, id))
})
