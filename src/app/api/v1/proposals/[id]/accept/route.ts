import { ApiError, ok, readJsonObject, requireSession, withApi, withTransaction } from '@/modules/infra'
import { acceptProposal, setProposalResult } from '@/modules/conversation'
import { createWord, parseWordInput, recordAcceptedChatLog } from '@/modules/learning'
import { setProfileLevel } from '@/modules/preferences'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * #38 제안 채택 — **한 트랜잭션**: TutorProposal ACCEPTED(조건부 전이) + kind 별 결과 + `result`.
 *   ADD_WORD → WordEntry(source=TUTOR·sourceRefId=제안 id — 레슨 메모 제안(payload.source='LESSON', task-010 #62a)이면 source=LESSON·sourceRefId=레슨 id,
 *              내 단어와 같은 표현 409 `{existingId}` 면 전체 롤백, 기본 단어와 같은 (표기, 읽기)면 그 기본 단어 id 를 결과로 연결 — task-068 L4)
 *   ADD_STUDY_LOG → StudyLog(origin=ACCEPTED) + StatsSnapshot DAILY 증가
 *   SET_LEVEL → Profile.level(평가 레벨 올리기 제안, task-011 L5 — result `{level}`)
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
        const word = await createWord(userId, { ...input, source: p.source, sourceRefId: p.sourceRefId }, tx, { linkBaseDuplicate: true })
        result = { wordId: word.id }
      } else if (p.kind === 'SET_LEVEL') {
        const profile = await setProfileLevel(userId, p.level, tx)
        result = { level: profile.level }
      } else {
        const log = await recordAcceptedChatLog(userId, p.log, tx)
        result = { studyLogId: log.id }
      }
      await setProposalResult(userId, p.id, result, tx)
      return { proposal: { id: p.id, kind: p.kind, status: 'ACCEPTED' as const, result } }
    }),
  )
})
