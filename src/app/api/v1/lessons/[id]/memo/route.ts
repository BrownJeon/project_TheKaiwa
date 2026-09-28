import { ok, rateLimit, readJsonObject, requireSession, withApi, withTransaction } from '@/modules/infra'
import { buildWordEnrichRequest, createLessonWordProposals, getProposalsByIds, type ProposalDto } from '@/modules/conversation'
import {
  enrichWord, lockLessonForWrite, memoDraftFromEnrich, parseMemoBody, planLessonMemo, saveLessonMemo, MEMO_PER_LESSON_MAX,
  type MemoPlanEntry, type MemoProcessed, type MemoSkipReason, type MemoWordDraft,
} from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** A10 보강을 한 번에 몇 개씩 돌릴지(대화 턴과 같은 CLI 큐를 쓰므로 한꺼번에 몰지 않는다). */
const ENRICH_CONCURRENCY = 3

type Skipped = { surface: string; reason: MemoSkipReason; wordId?: string }

/**
 * #62a 들린 단어 메모 → 단어 제안(task-010 L3). 라우트가 조합한다:
 *   learning 계획(소유·상태·한도·단어장 바이트 일치·레슨 조각 뜻) → 조각에 없는 단어만 A10 보강(conversation 요청 → learning 실행, 저장 안 함)
 *   → **한 트랜잭션**: 레슨 잠금(사용자 → 레슨) → conversation 이 `TutorProposal(ADD_WORD, PROPOSED, payload.source='LESSON')` 생성
 *     (같은 표현의 처리 전 제안이 있으면 그것) → learning 이 `progress.listen.memo`·`listen.proposed` 기록.
 * 채택 전에는 단어장(WordEntry)에 행이 없다 — 채택(#38)하면 `WordEntry(source=LESSON, sourceRefId=레슨 id)`.
 * 응답 `{proposals: ProposalDto[], skipped: [{surface, reason, wordId?}], memo: {count, limit}}`(count = 저장된 메모 단어 수). 사용자당 분당 10.
 */
export const POST = withApi<Ctx>(async (req, ctx) => {
  const s = await requireSession()
  const userId = s.user.id
  const { id } = await ctx.params
  rateLimit(`lesson-memo:${userId}`, 10)
  const words = parseMemoBody(await readJsonObject(req, 8 * 1024))
  const plan = await planLessonMemo(userId, id, words)

  const skipped: Skipped[] = []
  const drafts: { entry: MemoPlanEntry; draft: MemoWordDraft }[] = []
  const knownProposalIds: string[] = []
  const enrichQueue: Extract<MemoPlanEntry, { action: 'ENRICH' }>[] = []
  for (const e of plan.entries) {
    if (e.action === 'SKIP') skipped.push({ surface: e.memo, reason: e.reason, ...(e.wordId ? { wordId: e.wordId } : {}) })
    else if (e.action === 'KNOWN') {
      if (e.prior.result === 'PROPOSED' && e.prior.proposalId) knownProposalIds.push(e.prior.proposalId)
      else skipped.push({ surface: e.memo, reason: 'IN_WORDBOOK', ...(e.prior.wordId ? { wordId: e.prior.wordId } : {}) })
    } else if (e.action === 'PROPOSE') drafts.push({ entry: e, draft: e.draft })
    else enrichQueue.push(e)
  }
  const notJapanese = new Set<MemoPlanEntry>()
  for (let i = 0; i < enrichQueue.length; i += ENRICH_CONCURRENCY) {
    const batch = enrichQueue.slice(i, i + ENRICH_CONCURRENCY)
    const settled = await Promise.allSettled(batch.map((e) => enrichWord({ surface: e.surface, level: plan.level }, buildWordEnrichRequest({ surface: e.surface, level: plan.level }))))
    settled.forEach((r, k) => {
      const e = batch[k]
      if (r.status === 'rejected') {
        skipped.push({ surface: e.memo, reason: 'ENRICH_FAILED' })
        return
      }
      const d = memoDraftFromEnrich(e, plan.lessonId, r.value.draft)
      if (d) drafts.push({ entry: e, draft: d })
      else {
        notJapanese.add(e)
        skipped.push({ surface: e.memo, reason: 'NOT_JAPANESE' })
      }
    })
  }

  // 메모 초안에 넣을 단어 = 한도 안에 든 일본어 단어(단어장에 있는 것 포함). 보강 실패(ENRICH_FAILED)는 초안에만 남아 다시 보낼 수 있다.
  const memoAdds = plan.entries
    .filter((e) => (e.action === 'SKIP' ? e.reason === 'IN_WORDBOOK' : !notJapanese.has(e)))
    .map((e) => ({ segment: e.segment, ja: e.memo }))
  const inWordbook: MemoProcessed[] = plan.entries.flatMap((e) =>
    e.action === 'SKIP' && e.reason === 'IN_WORDBOOK' ? [{ ja: e.memo, segment: e.segment, result: 'IN_WORDBOOK' as const, proposalId: null, wordId: e.wordId ?? null }] : [],
  )

  const created = await withTransaction(async (tx) => {
    const h = await lockLessonForWrite(tx, userId, id)
    const made = await createLessonWordProposals(userId, drafts.map((d) => d.draft), tx)
    const processed: MemoProcessed[] = [
      ...made.map((m, i) => ({ ja: drafts[i].entry.memo, segment: drafts[i].entry.segment, result: 'PROPOSED' as const, proposalId: m.proposal.id, wordId: null })),
      ...inWordbook,
    ]
    const saved = await saveLessonMemo(tx, h, { drafts: memoAdds, processed })
    return { made, memoCount: saved.memoCount }
  })

  const proposals: ProposalDto[] = []
  const seen = new Set<string>()
  for (const p of [...created.made.map((c) => c.proposal), ...(await getProposalsByIds(userId, knownProposalIds))]) {
    if (seen.has(p.id)) continue
    seen.add(p.id)
    proposals.push(p)
  }
  return ok({ proposals, skipped, memo: { count: created.memoCount, limit: MEMO_PER_LESSON_MAX } })
})
