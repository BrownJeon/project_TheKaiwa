import { ApiError, ok, readJsonObject, requireSession, withApi, withTransaction } from '@/modules/infra'
import { acceptCorrection, setCorrectionSavedWord } from '@/modules/conversation'
import { createWord, errorPatternFor, parseWordInput, recordCorrectionAccepted, recordErrorStat } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #35 교정 채택 — **한 트랜잭션**: Correction ACCEPTED(조건부 전이) + (선택) WordEntry(source=CORRECTION) + `savedWordId`
 * + LearnerErrorStat +1 + DAILY `corrections.accepted` +1. 같은 표현이 단어장에 있으면 409 `{existingId}` 로 전체 롤백.
 * StudyLog 는 만들지 않는다(대화 종료 시 ADD_STUDY_LOG 제안으로). `Correction.original` 은 어디서도 갱신하지 않는다.
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const body = await readJsonObject(req)
  const extra = Object.keys(body).filter((k) => k !== 'addWord')
  if (extra.length) throw new ApiError('VALIDATION', `넣을 수 없는 항목입니다: ${extra.join(', ')}`, { field: extra[0], reason: 'unknown_key' })
  const addWord = body.addWord == null ? null : parseWordInput(body.addWord, 'addWord.')
  const userId = s.user.id
  return ok(
    await withTransaction(async (tx) => {
      const c = await acceptCorrection(userId, id, tx)
      const word = addWord ? await createWord(userId, { ...addWord, source: 'CORRECTION', sourceRefId: c.id }, tx) : null
      if (word) await setCorrectionSavedWord(userId, c.id, word.id, tx)
      await recordErrorStat(userId, c.errorType, errorPatternFor(c.chunkType), tx)
      await recordCorrectionAccepted(userId, tx)
      return {
        correction: { id: c.id, status: 'ACCEPTED' as const, resolvedAt: c.resolvedAt, savedWordId: word?.id ?? null },
        word: word ? { id: word.id, surface: word.surface } : null,
      }
    }),
  )
})
