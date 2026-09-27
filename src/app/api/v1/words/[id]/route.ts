import { ok, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { listCorrectionRefsByWord } from '@/modules/conversation'
import { deleteWord, getWordDetail, parseWordPatch, updateWord } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** #42 단어 상세 — learning(단어·풀이 통계) + conversation(이 단어를 만든 교정 참조)을 라우트가 조합. 남의 단어 404. */
export const GET = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const detail = await getWordDetail(s.user.id, id)
  return ok({ ...detail, corrections: await listCorrectionRefsByWord(s.user.id, id) })
})

/** #43 부분 수정 — 카운터·출처·보관 상태는 400, 표현이 바뀌면 중복 409 `{existingId}`. */
export const PATCH = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const patch = parseWordPatch(await readJsonObject(req))
  return ok(await updateWord(s.user.id, id, patch))
})

/** #44 삭제 — 세트 카드·교정·평가 문항 참조는 SetNull + `*Snap` 유지, 집계 스냅샷 불변. */
export const DELETE = withApi<Ctx>(async (_req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  return ok(await deleteWord(s.user.id, id))
})
