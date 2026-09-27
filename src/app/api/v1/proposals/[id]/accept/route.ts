import { ApiError, ok, readJsonObject, requireSession, withApi, withTransaction } from '@/modules/infra'
import { acceptProposal, setProposalResult } from '@/modules/conversation'
import { createWord, parseWordInput, recordAcceptedChatLog } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #38 제안 채택 — **한 트랜잭션**: TutorProposal ACCEPTED(조건부 전이) + kind 별 결과 + `result`.
 *   ADD_WORD → WordEntry(source=TUTOR, 같은 표현 409 `{existingId}` 면 전체 롤백)
 *   ADD_STUDY_LOG → StudyLog(origin=ACCEPTED) + StatsSnapshot DAILY 증가
 * 그 밖의 kind 는 400 FEATURE_NOT_READY, 30일 지난 제안 409 `{status:'EXPIRED'}`, 이미 처리 409 `{status}`.
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const { id } = await ctx.params
  const body = await readJsonObject(req)
  const extra = Object.keys(body).filter((k) => k !== 'payloadOverride')
  if (extra.length) throw new ApiError('VALIDATION', `넣을 수 없는 항목입니다: ${extra.join(', ')}`, { field: extra[0], reason: 'unknown_key' })
  const userId = s.user.id
  return ok(
    await withTransaction(async (tx) => {
      const p = await acceptProposal(userId, id, body.payloadOverride, tx)
      let result: Record<string, string>
      if (p.kind === 'ADD_WORD') {
        const input = parseWordInput(p.word, 'payloadOverride.')
        const word = await createWord(userId, { ...input, source: 'TUTOR', sourceRefId: p.id }, tx)
        result = { wordId: word.id }
      } else {
        const log = await recordAcceptedChatLog(userId, p.log, tx)
        result = { studyLogId: log.id }
      }
      await setProposalResult(userId, p.id, result, tx)
      return { proposal: { id: p.id, kind: p.kind, status: 'ACCEPTED' as const, result } }
    }),
  )
})
