/**
 * task-026 S2 — 내 말 번역 저장(턴 저장 트랜잭션)·`done.userTranslation`·재시도 API(#32t) 경계.
 * DB·LLM 없이: 저장은 `saveTurnTx` 에 가짜 tx, 재시도는 `translationDeps` 를 바꿔 끼운다.
 */
import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyError, type Tx } from '@/modules/infra'
import { LLM_TASKS, isLlmTask } from '@/modules/engine'
import { shapeTurnResponse } from '../orchestrator/shape'
import { saveTurnTx, startTurn, turnDeps } from '../orchestrator'
import { releaseTurnLock, tryAcquireTurnLock } from '../orchestrator/locks'
import type { TurnEvent } from '../orchestrator/stream'
import { retryUserTranslation, translationDeps } from '../chats/translation'
import { buildUserTranslationRequest } from '../prompts/userTranslation'
import type { TutorResponse } from '../structuredResponse/schemas'

const TEXT = '昨日映画を見に行きました。'
const reply = { replyJa: 'いいですね。', replyKo: '좋네요.' }
const base: TutorResponse = { conversation: reply, correction: null, learning: { grammarPoint: null, difficulty: 'N5' }, speech: { style: 'NEUTRAL' }, endOfTopic: false, proposals: [], userKo: '어제 영화를 보러 갔어요.' }

const codeOf = (code: string) => (e: unknown) => classifyError(e).code === code

test('shape: userTranslation 은 sanitizeUserKo 를 거친 값만 — 누락·빈 값·베끼기·한글 없음은 null, ASK 는 늘 null', () => {
  assert.equal(shapeTurnResponse('TALK', TEXT, base).userTranslation, '어제 영화를 보러 갔어요.')
  assert.equal(shapeTurnResponse('CHAT', TEXT, base).userTranslation, '어제 영화를 보러 갔어요.')
  assert.equal(shapeTurnResponse('ASK', TEXT, base).userTranslation, null)
  for (const userKo of [undefined, null, '', '   ', TEXT, 'Yesterday I went.', 12]) {
    assert.equal(shapeTurnResponse('TALK', TEXT, { ...base, userKo: userKo as string | null | undefined }).userTranslation, null, JSON.stringify(userKo))
  }
})

// ── 저장 트랜잭션 ────────────────────────────────────────────────────────────────

type Call = { op: string; args: Record<string, unknown> }
/** userTx = USER 행 번역 조건부 갱신 결과(0 = 이미 번역 있음), stored = 그때 다시 읽히는 저장값. */
function fakeTx(calls: Call[], opts: { userTx?: 0 | 1; stored?: string | null } = {}) {
  const rec = (op: string, ret: (args: Record<string, unknown>) => unknown) => async (args: Record<string, unknown>) => {
    calls.push({ op, args })
    return ret(args)
  }
  const isUser = (args: Record<string, unknown>) => (args.where as { id: string }).id === 'mu'
  return {
    $queryRaw: async () => {
      calls.push({ op: 'lockUser', args: {} })
      return [{ id: 'u1' }]
    },
    chatMessage: {
      updateMany: rec('chatMessage.updateMany', (args) => ({ count: isUser(args) ? (opts.userTx ?? 1) : 1 })),
      update: rec('chatMessage.update', () => ({})),
      findUnique: rec('chatMessage.findUnique', () => (opts.stored === undefined ? null : { translation: opts.stored })),
    },
    correction: { create: rec('correction.create', () => ({ id: 'cr1' })) },
    tutorProposal: { create: rec('tutorProposal.create', () => ({ id: 'p1' })) },
    chat: { updateMany: rec('chat.updateMany', () => ({ count: 1 })) },
  } as unknown as Tx
}

const accepted = {
  chatId: 'c1', kind: 'TALK' as const, level: null, userMessage: { id: 'mu', content: TEXT, createdAt: new Date(), inputSource: null },
  assistantMessageId: 'ma', pendingSince: new Date(), traceId: 't1', resumed: false,
}
const toolLog = { traceId: 't1', meta: { learning: base.learning, style: 'NEUTRAL' as const, endOfTopic: false, warning: null } } as unknown as Parameters<typeof saveTurnTx>[4]
const userOps = (calls: Call[]) => calls.filter((c) => c.op.startsWith('chatMessage.') && (c.args.where as { id: string }).id === 'mu')
const label = (c: Call) => (c.op.startsWith('chatMessage.') ? `${c.op}:${(c.args.where as { id: string }).id}` : c.op)
const KO = '어제 영화를 보러 갔어요.'
const withCorrection = () =>
  shapeTurnResponse('TALK', TEXT, {
    ...base,
    correction: { required: true, original: TEXT, corrected: '昨日映画を見に行った。', explanationKo: '반말', errorType: 'POLITENESS', severity: 'MINOR', chunkType: null, hintKo: null },
  })
const correctionExtras = { correction: { mode: 'FLUENCY' as const, deliver: 'LATER' as const, hintKo: null }, selfCheck: null }

test('saveTurnTx: 번역은 USER 행 translation 이 비었을 때만(updateMany where {id, translation:null}) — 강사 행 translation(replyKo)과 섞이지 않는다', async () => {
  const calls: Call[] = []
  const saved = await saveTurnTx(fakeTx(calls), 'u1', accepted, shapeTurnResponse('TALK', TEXT, base), toolLog)
  assert.deepEqual(calls.map(label), ['lockUser', 'chatMessage.updateMany:ma', 'chatMessage.updateMany:mu', 'chat.updateMany'])
  const assistant = calls[1].args as { where: { id: string }; data: { translation: string } }
  assert.equal(assistant.data.translation, '좋네요.')
  assert.deepEqual(calls[2].args, { where: { id: 'mu', translation: null }, data: { translation: KO } })
  assert.equal(saved.userTranslation, KO)
})

test('saveTurnTx(task-036, REV-108 L-2): 강사 행 DONE 갱신은 reading 을 null 로 명시해 쓴다 — LLM 이 읽기 줄을 안 만들므로 새 메시지의 ChatMessage.reading 은 null(옛 메시지 값은 안 건드림)', async () => {
  const calls: Call[] = []
  await saveTurnTx(fakeTx(calls), 'u1', accepted, shapeTurnResponse('TALK', TEXT, base), toolLog)
  const assistant = calls[1].args as { where: { id: string }; data: { status: string; content: string; reading: unknown } }
  assert.equal(assistant.where.id, 'ma', '강사 행(DONE 갱신) 호출을 본다')
  assert.equal(assistant.data.status, 'DONE')
  assert.equal(assistant.data.content, 'いいですね。')
  assert.equal(assistant.data.reading, null, 'undefined(키 누락)도 아닌 명시적 null')
})

test('saveTurnTx: 번역이 null 이면 USER 행 번역에 무접촉(조건부 갱신·재조회 0) — 반환 번역 null', async () => {
  const calls: Call[] = []
  const saved = await saveTurnTx(fakeTx(calls), 'u1', accepted, shapeTurnResponse('CHAT', TEXT, { ...base, userKo: TEXT }), toolLog)
  assert.equal(userOps(calls).length, 0)
  assert.equal(saved.userTranslation, null)
})

test('saveTurnTx(REV-092): 이미 번역이 있으면(재시도가 먼저 저장, count 0) 덮어쓰지 않고 저장값을 다시 읽어 돌려준다', async () => {
  const calls: Call[] = []
  const saved = await saveTurnTx(fakeTx(calls, { userTx: 0, stored: '재시도가 먼저 저장한 번역' }), 'u1', { ...accepted, resumed: true }, shapeTurnResponse('TALK', TEXT, base), toolLog)
  assert.deepEqual(userOps(calls).map(label), ['chatMessage.updateMany:mu', 'chatMessage.findUnique:mu'])
  assert.equal(saved.userTranslation, '재시도가 먼저 저장한 번역')
  // 행이 사라졌으면 null
  const gone = await saveTurnTx(fakeTx([], { userTx: 0 }), 'u1', accepted, shapeTurnResponse('TALK', TEXT, base), toolLog)
  assert.equal(gone.userTranslation, null)
})

test('saveTurnTx(REV-092): 교정 턴 — 번역 조건부 갱신(번역만)과 toolLog 갱신(별도 update)을 나누고, 순서는 A → 교정 행 → R 번역 → R toolLog → 관측', async () => {
  const calls: Call[] = []
  const observe = { recordCorrectionProposed: async () => void calls.push({ op: 'observe', args: {} }) }
  const saved = await saveTurnTx(fakeTx(calls), 'u1', accepted, withCorrection(), toolLog, correctionExtras, observe)
  assert.deepEqual(calls.map(label), ['lockUser', 'chatMessage.updateMany:ma', 'correction.create', 'chatMessage.updateMany:mu', 'chatMessage.update:mu', 'observe', 'chat.updateMany'])
  const [tr, meta] = userOps(calls)
  assert.deepEqual(tr.args, { where: { id: 'mu', translation: null }, data: { translation: KO } })
  assert.deepEqual(meta.args.where, { id: 'mu' }, 'toolLog 갱신에는 번역 조건이 없다')
  assert.deepEqual(Object.keys(meta.args.data as object), ['toolLog'])
  const tl = (meta.args.data as { toolLog: { correction: { id: string; deliver: string } } }).toolLog
  assert.equal(tl.correction.id, 'cr1')
  assert.equal(tl.correction.deliver, 'LATER')
  assert.equal(saved.userTranslation, KO)
})

test('saveTurnTx(REV-092): 교정 턴에서 번역이 건너뛰어져도(count 0) 교정 toolLog 는 반영되고, 반환 번역은 저장값', async () => {
  const calls: Call[] = []
  const saved = await saveTurnTx(fakeTx(calls, { userTx: 0, stored: '먼저 저장된 번역' }), 'u1', accepted, withCorrection(), toolLog, correctionExtras)
  assert.deepEqual(userOps(calls).map(label), ['chatMessage.updateMany:mu', 'chatMessage.findUnique:mu', 'chatMessage.update:mu'])
  const meta = userOps(calls)[2].args as { data: { toolLog: { correction: { id: string } } } }
  assert.equal(meta.data.toolLog.correction.id, 'cr1')
  assert.equal(saved.userTranslation, '먼저 저장된 번역')
  assert.equal(saved.correction?.id, 'cr1')
})

test('saveTurnTx: 교정 턴인데 번역 null — 번역 쿼리 0, toolLog 갱신 1회', async () => {
  const calls: Call[] = []
  const shaped = { ...withCorrection(), userTranslation: null }
  await saveTurnTx(fakeTx(calls), 'u1', accepted, shaped, toolLog, correctionExtras)
  assert.deepEqual(userOps(calls).map(label), ['chatMessage.update:mu'])
})

test('턴 done(REV-092): done.userTranslation 은 LLM 값이 아니라 저장 트랜잭션이 돌려준 저장값', async (t) => {
  t.after(() => mock.restoreAll())
  mock.method(turnDeps, 'precheckChat', async () => ({ kind: 'CHAT', level: 'N5' }))
  mock.method(turnDeps, 'buildLearnerHeader', async () => ({ level: 'N5' }))
  mock.method(turnDeps, 'loadRecentHistory', async () => [])
  mock.method(turnDeps, 'loadCorrectionMode', async () => 'FLUENCY' as const)
  mock.method(turnDeps, 'loadCoachPending', async () => null)
  mock.method(turnDeps, 'acceptTurn', async () => ({ ...accepted, kind: 'CHAT', level: 'N5', userMessage: { ...accepted.userMessage, inputSource: 'TEXT' } }))
  mock.method(turnDeps, 'saveTurn', (u: string, a: Parameters<typeof saveTurnTx>[2], s: Parameters<typeof saveTurnTx>[3], tl: Parameters<typeof saveTurnTx>[4]) =>
    saveTurnTx(fakeTx([], { userTx: 0, stored: '재시도가 먼저 저장한 번역' }), u, a, s, tl),
  )
  mock.method(turnDeps, 'completeJson', async () => ({ data: base, connectionKey: 'k', model: 'm', elapsedMs: 5, promptChars: 10, attempts: 1, warm: 'HIT', firstDeltaMs: 2, residualViolations: [], candidates: [base] }))
  const handle = await startTurn({ userId: 'u-026s2-done', chatId: 'c1', request: { resume: false, text: TEXT, inputSource: 'TEXT', utteranceId: null, clientTimings: null } })
  const events: TurnEvent[] = []
  await handle.subscribe((e) => events.push(e))
  await handle.done
  const done = events.find((e) => e.event === 'done')?.data as { userTranslation: string | null } | undefined
  assert.ok(done, events.map((e) => e.event).join(','))
  assert.equal(done.userTranslation, '재시도가 먼저 저장한 번역')
})

// ── 재시도 API(#32t) ────────────────────────────────────────────────────────────

type Row = { id: string; role: 'USER' | 'ASSISTANT'; content: string; translation: string | null }
function wire(t: import('node:test').TestContext, opts: { row?: Row | null; running?: boolean; complete?: () => Promise<{ data: { userKo: unknown } }>; save?: 'saved' | 'existing' | 'gone' } = {}) {
  const seen = { load: [] as string[][], complete: 0, saved: [] as string[], prompts: [] as string[] }
  t.mock.method(translationDeps, 'loadMessage', async (u: string, c: string, m: string) => {
    seen.load.push([u, c, m])
    return opts.row === undefined ? { id: m, role: 'USER', content: TEXT, translation: null } : opts.row
  })
  t.mock.method(translationDeps, 'hasPendingTurn', async () => opts.running === true)
  t.mock.method(translationDeps, 'learnerLevel', async () => 'N4')
  t.mock.method(translationDeps, 'complete', async (req: { system: string }) => {
    seen.complete++
    seen.prompts.push(req.system)
    return opts.complete ? opts.complete() : { data: { userKo: '어제 영화를 보러 갔어요.' } }
  })
  t.mock.method(translationDeps, 'saveIfEmpty', async (_u: string, _c: string, _m: string, tr: string) => {
    seen.saved.push(tr)
    if (opts.save === 'existing') return { existing: '먼저 저장된 번역' }
    if (opts.save === 'gone') return { gone: true }
    return { saved: true }
  })
  return seen
}

test('#32t 소유자: 남의 메시지·없는 메시지·이상한 id 는 404(LLM 호출 0)', async (t) => {
  const seen = wire(t, { row: null })
  await assert.rejects(retryUserTranslation('u2', 'c1', 'mu'), codeOf('NOT_FOUND'))
  assert.deepEqual(seen.load, [['u2', 'c1', 'mu']], '조회는 세션 사용자 id 로만')
  for (const [c, m] of [['', 'mu'], ['c1', ''], ['c1', 'x'.repeat(41)], ['c'.repeat(41), 'mu']]) {
    await assert.rejects(retryUserTranslation('u1', c, m), codeOf('NOT_FOUND'))
  }
  assert.equal(seen.complete, 0)
})

test('#32t 소유 조건(실제 조회·저장 코드): 조회·조건부 저장·재조회 모두 (id, chatId, 세션 userId) — 저장은 USER·번역 비었을 때만', async (t) => {
  const finds: { where: Record<string, unknown> }[] = []
  const updates: { where: Record<string, unknown>; data: Record<string, unknown> }[] = []
  const store = {
    findFirst: async (a: { where: Record<string, unknown> }) => {
      finds.push(a)
      return finds.length === 1 ? { id: 'mu', role: 'USER', content: TEXT, translation: null } : { translation: '먼저 저장된 번역' }
    },
    updateMany: async (a: { where: Record<string, unknown>; data: Record<string, unknown> }) => (updates.push(a), { count: 0 }),
  }
  t.mock.method(translationDeps, 'messages', () => store as never)
  t.mock.method(translationDeps, 'hasPendingTurn', async () => false)
  t.mock.method(translationDeps, 'learnerLevel', async () => 'N4')
  t.mock.method(translationDeps, 'complete', async () => ({ data: { userKo: '어제 영화를 보러 갔어요.' } }))
  assert.deepEqual(await retryUserTranslation('u1', 'c1', 'mu'), { messageId: 'mu', translation: '먼저 저장된 번역', cached: true })
  const owned = { id: 'mu', chatId: 'c1', userId: 'u1' }
  assert.equal(finds.length, 2)
  for (const f of finds) assert.deepEqual(f.where, owned)
  assert.deepEqual(updates.map((u) => u.where), [{ ...owned, role: 'USER', translation: null }])
  assert.deepEqual(updates[0].data, { translation: '어제 영화를 보러 갔어요.' })
})

test('#32t USER 메시지만 — 강사 말은 400(LLM 호출 0)', async (t) => {
  const seen = wire(t, { row: { id: 'ma', role: 'ASSISTANT', content: 'いいですね。', translation: null } })
  await assert.rejects(retryUserTranslation('u1', 'c1', 'ma'), (e: unknown) => classifyError(e).status === 400 && (classifyError(e).details as { reason?: string })?.reason === 'not_user_message')
  assert.equal(seen.complete, 0)
})

test('#32t 이미 번역이 있으면 LLM 없이 그대로(cached)', async (t) => {
  const seen = wire(t, { row: { id: 'mu', role: 'USER', content: TEXT, translation: '이미 있는 번역' } })
  assert.deepEqual(await retryUserTranslation('u1', 'c1', 'mu'), { messageId: 'mu', translation: '이미 있는 번역', cached: true })
  assert.equal(seen.complete, 0)
})

test('#32t 정상: LLM 1회 → 정리 → 조건부 저장 → 반환. 프롬프트에 학습자 수준', async (t) => {
  const seen = wire(t)
  assert.deepEqual(await retryUserTranslation('u1', 'c1', 'mu'), { messageId: 'mu', translation: '어제 영화를 보러 갔어요.', cached: false })
  assert.equal(seen.complete, 1)
  assert.deepEqual(seen.saved, ['어제 영화를 보러 갔어요.'])
  assert.match(seen.prompts[0], /N4/)
})

test('#32t 그사이 다른 경로가 먼저 저장했으면 그 값(덮어쓰지 않음), 행이 사라졌으면 404', async (t) => {
  wire(t, { save: 'existing' })
  assert.deepEqual(await retryUserTranslation('u1', 'c1', 'mu'), { messageId: 'mu', translation: '먼저 저장된 번역', cached: true })
  t.mock.restoreAll()
  wire(t, { save: 'gone' })
  await assert.rejects(retryUserTranslation('u1', 'c1', 'mu'), codeOf('NOT_FOUND'))
})

test('#32t 실패: 정리에서 버려지면 ENGINE_ERROR(502, 저장 0) · 엔진 타임아웃은 그 코드 그대로 · 둘 다 다시 시도 가능', async (t) => {
  for (const userKo of ['', TEXT, 'Yesterday I went to the movies.', '가'.repeat(2_001), null]) {
    t.mock.restoreAll()
    const seen = wire(t, { complete: async () => ({ data: { userKo } }) })
    await assert.rejects(retryUserTranslation('u1', 'c1', 'mu'), (e: unknown) => classifyError(e).code === 'ENGINE_ERROR' && classifyError(e).status === 502, JSON.stringify(userKo).slice(0, 20))
    assert.equal(seen.saved.length, 0)
  }
  t.mock.restoreAll()
  const timeout = Object.assign(new Error('timeout'), { name: 'ClaudeCliTimeoutError' })
  const seen = wire(t, { complete: async () => Promise.reject(timeout) })
  await assert.rejects(retryUserTranslation('u1', 'c1', 'mu'), (e: unknown) => classifyError(e).code === 'ENGINE_TIMEOUT')
  assert.equal(seen.saved.length, 0)
  // 실패 뒤에도 사용자 슬롯이 풀려 다음 요청이 막히지 않는다.
  t.mock.restoreAll()
  wire(t)
  assert.equal((await retryUserTranslation('u1', 'c1', 'mu')).cached, false)
})

test('#32t 그 방 턴 진행 중 409 · 같은 사용자 동시 2번째 409 BUSY(다른 사용자는 영향 없음)', async (t) => {
  wire(t, { running: true })
  await assert.rejects(retryUserTranslation('u1', 'c1', 'mu'), (e: unknown) => classifyError(e).code === 'CONFLICT' && (classifyError(e).details as { reason?: string })?.reason === 'TURN_RUNNING')
  t.mock.restoreAll()
  let release: () => void = () => {}
  const gate = new Promise<void>((r) => (release = r))
  wire(t, { complete: async () => (await gate, { data: { userKo: '어제 영화를 보러 갔어요.' } }) })
  const first = retryUserTranslation('u1', 'c1', 'mu')
  await new Promise((r) => setImmediate(r))
  await assert.rejects(retryUserTranslation('u1', 'c1', 'mu2'), (e: unknown) => classifyError(e).code === 'CONFLICT' && (classifyError(e).details as { reason?: string })?.reason === 'TRANSLATION_BUSY')
  const other = retryUserTranslation('u9', 'c9', 'mx')
  release()
  assert.equal((await first).cached, false)
  assert.equal((await other).cached, false)
})

test('#32t(REV-092) 수락 커밋 전 — 이 프로세스가 그 방 턴 락을 잡고 있으면 DB PENDING 이 없어도 409 TURN_RUNNING(LLM 0)', async (t) => {
  const lock = tryAcquireTurnLock('u-lock', 'c1')
  assert.ok(lock)
  t.after(() => releaseTurnLock(lock))
  const seen = wire(t)
  const turnRunning = (e: unknown) => classifyError(e).code === 'CONFLICT' && (classifyError(e).details as { reason?: string })?.reason === 'TURN_RUNNING'
  await assert.rejects(retryUserTranslation('u-lock', 'c1', 'mu'), turnRunning)
  assert.equal(seen.complete, 0)
  // 같은 사용자의 다른 방·다른 사용자의 같은 방 id 는 통과
  assert.equal((await retryUserTranslation('u-lock', 'c2', 'mu')).cached, false)
  assert.equal((await retryUserTranslation('u-other', 'c1', 'mu')).cached, false)
  assert.equal(seen.complete, 2)
  // 락 해제 뒤 같은 방도 통과
  releaseTurnLock(lock)
  assert.equal((await retryUserTranslation('u-lock', 'c1', 'mu')).cached, false)
})

test('#32t(REV-092) 이미 번역이 있으면 그 방 턴 락 중에도 cached 가 먼저(409 아님, LLM 0)', async (t) => {
  const lock = tryAcquireTurnLock('u-lock2', 'c1')
  assert.ok(lock)
  t.after(() => releaseTurnLock(lock))
  const seen = wire(t, { row: { id: 'mu', role: 'USER', content: TEXT, translation: '이미 있는 번역' } })
  assert.deepEqual(await retryUserTranslation('u-lock2', 'c1', 'mu'), { messageId: 'mu', translation: '이미 있는 번역', cached: true })
  assert.equal(seen.complete, 0)
})

test('#32t 엔진 태스크: userTranslation 키가 LLM_TASKS 에 있고 interactive·fast·15s, 요청 빌더의 task 와 같다', () => {
  assert.ok(isLlmTask('userTranslation'))
  assert.deepEqual(LLM_TASKS.userTranslation, { tier: 'fast', timeoutMs: 15_000, lane: 'interactive' })
  assert.equal(buildUserTranslationRequest({ text: TEXT, level: 'N4' }).task, 'userTranslation')
})
