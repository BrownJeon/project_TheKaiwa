/**
 * task-010d A3b-2 — #29 대화 조회 조합(`_lib/chatDetail.ts`): 마친 역할극은 예열하지 않는다(B3 서버 요청 ②). DB·엔진 0(가짜 deps).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chatDetailResponse, shouldPrewarmTalk, type ChatDetailDeps } from '../chatDetail'

const U = 'cuser0000000000000000a3b2'
const CHAT_AT = new Date('2026-10-07T01:00:00Z')
const at = (s: number) => new Date(CHAT_AT.getTime() + s * 1000)

// ── #29 마친 역할극 예열 생략 ────────────────────────────────────────────────

function detailWorld(o: { kind?: 'TALK' | 'CHAT'; rolePlay?: 'none' | 'open' | 'ended' } = {}) {
  const calls: string[] = []
  const ended = o.rolePlay === 'ended'
  const deps: ChatDetailDeps = {
    detail: async () => ({
      chat: { id: 'chat_rp', kind: o.kind ?? 'TALK', title: 't', level: 'N5', running: false, reviewedAt: null, messageCount: 1 },
      messages: [{ id: 'u1', role: 'USER', content: 'x', reading: null, translation: null, inputSource: 'TEXT', status: 'DONE', createdAt: at(1).toISOString(), corrections: [] }],
      pendingProposals: 0,
      nextCursor: null,
    }),
    prewarm: async () => void calls.push('prewarm'),
    utterances: async () => new Map([['u1', { utteranceId: 'utt1', audioAvailable: true }]]),
    rolePlay: async () =>
      o.rolePlay === 'open' || ended
        ? ({ id: 'scn_seed', title: 't', titleJa: null, roles: { learner: 'a', tutor: 'b' }, goalKo: 'g', steps: [], keyExpressions: [], requiredExpressions: 1, progress: { usedIds: [], stepIndex: null }, ended: ended ? ({ outcome: 'ACHIEVED' } as never) : null, lessonId: null } as never)
        : null,
    lessonRef: async () => (calls.push('lesson'), null),
    next: async () => (calls.push('next'), { id: 'scn_next', title: 'n', titleJa: null, goalKo: 'g' }),
  }
  return { deps, calls }
}

test('#29 예열: TALK 첫 조회만 · 마친 역할극(결과 화면) 은 예열 0 · 진행 중 역할극·일반 TALK 는 예열 · 폴링(after)·CHAT 은 예열 0 · 응답 모양 그대로(scenario·utteranceId·next)', async () => {
  const endedW = detailWorld({ rolePlay: 'ended' })
  const r = await chatDetailResponse(U, 'chat_rp', { after: null, cursor: null, limit: 1 }, endedW.deps)
  assert.ok(!endedW.calls.includes('prewarm'), '마친 역할극은 예열하지 않는다')
  assert.deepEqual((r.chat as { scenario?: { ended?: { next?: unknown } } }).scenario?.ended?.next, { id: 'scn_next', title: 'n', titleJa: null, goalKo: 'g' })
  assert.equal((r.messages[0] as { utteranceId?: string }).utteranceId, 'utt1')
  for (const [rolePlay, expected] of [['open', true], ['none', true]] as const) {
    const w = detailWorld({ rolePlay })
    await chatDetailResponse(U, 'chat_rp', { after: null, cursor: null, limit: 50 }, w.deps)
    assert.equal(w.calls.includes('prewarm'), expected, rolePlay)
  }
  const poll = detailWorld({ rolePlay: 'open' })
  await chatDetailResponse(U, 'chat_rp', { after: 'u0', cursor: null, limit: 50 }, poll.deps)
  assert.deepEqual(poll.calls, [], '폴링: 예열·수업·다음 상황 0')
  const chat = detailWorld({ kind: 'CHAT' })
  await chatDetailResponse(U, 'chat_rp', { after: null, cursor: null, limit: 50 }, chat.deps)
  assert.ok(!chat.calls.includes('prewarm'))
  assert.equal(shouldPrewarmTalk(null, 'TALK', { ended: { outcome: 'NOT_YET' } }), false)
  assert.equal(shouldPrewarmTalk(null, 'TALK', { ended: null }), true)
})
