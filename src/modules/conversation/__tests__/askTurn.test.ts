/**
 * task-064 dev-S2a — ASK 턴 파이프라인(orchestrator/ask.ts + index.ts ASK 분기). 공유 NAS DB·실제 LLM 없이 `turnDeps`·`askTurnDeps` 를 바꿔 끼운다.
 */
import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, type Tx } from '@/modules/infra'
import type { ExternalRecordItem, RecordSourceRef, RetrievalResult } from '@/modules/learning'
import { acceptTurnTx, startTurn, turnDeps } from '../orchestrator'
import {
  ASK_DEFAULT_TITLE,
  ASK_SCOPE_SENTENCES,
  askAllowedProposals,
  askAnswerPreview,
  askMetaFromToolLog,
  askPrevFrom,
  askScopeDates,
  askTurnDeps,
  finalizeAnswerMd,
  loadAskHistory,
  loadAskPrev,
  saveAskTurnTx,
  withScopeGuard,
  type AskToolLog,
  type AskTurnOutput,
} from '../orchestrator/ask'
import { currentTurnLock } from '../orchestrator/locks'
import type { TurnEvent } from '../orchestrator/stream'
import type { TurnRequest } from '../chats/validate'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const NOW = new Date('2026-10-12T03:00:00Z')

type Item = ExternalRecordItem
function result(intent: RetrievalResult['intent'], items: { key: string; type: Item['type']; id: string | null; label: string; text: string }[], functionsCalled: RetrievalResult['meta']['functionsCalled'], scopeKey: 'THIS_WEEK' | 'LAST_30D' | 'ALL' = 'ALL'): RetrievalResult {
  const sourceMap: Record<string, RecordSourceRef> = Object.create(null)
  for (const i of items) sourceMap[i.key] = { type: i.type, id: i.id, date: '2026-10-08', label: i.label }
  return {
    intent,
    items: items.map((i) => ({ key: i.key, type: i.type, dateKst: '2026-10-08', label: i.label, text: i.text }) as Item),
    sourceMap,
    meta: { count: items.length, functionsCalled, truncated: false, scopeKey, elapsedMs: 1 },
  }
}

interface Setup {
  kind?: 'ASK' | 'CHAT'
  prev?: { needsScope: boolean; prevUserText: string | null }
  retrieval?: RetrievalResult
  llm?: (req: Record<string, unknown>) => Promise<unknown>
  history?: { role: 'user' | 'assistant'; content: string }[]
  budgetMs?: number
}

function setup(o: Setup = {}) {
  const calls = { llm: [] as Record<string, unknown>[], retrieve: [] as unknown[][], save: [] as { out: AskTurnOutput; toolLog: AskToolLog }[], failed: [] as string[], traces: [] as Record<string, unknown>[] }
  mock.method(turnDeps, 'precheckChat', async () => ({ kind: o.kind ?? 'ASK', level: 'N4' }))
  mock.method(turnDeps, 'buildLearnerHeader', async () => ({ level: 'N4' }))
  mock.method(turnDeps, 'loadRecentHistory', async () => [])
  const accept = mock.method(turnDeps, 'acceptTurn', async (_u: string, chatId: string, req: TurnRequest) => ({
    chatId,
    kind: o.kind ?? 'ASK',
    level: 'N4',
    scenarioId: null,
    userMessage: { id: 'mu', content: req.resume ? '내가 틀린 거 정리해 줘' : req.text, createdAt: NOW, inputSource: 'TEXT' },
    assistantMessageId: 'ma',
    pendingSince: new Date(NOW.getTime() + 1),
    traceId: 'tr1',
    resumed: req.resume,
  }))
  mock.method(askTurnDeps, 'buildLearnerHeader', async () => ({ displayName: '브라운', level: 'N4' }))
  mock.method(askTurnDeps, 'loadAskHistory', async () => o.history ?? [])
  mock.method(askTurnDeps, 'loadAskPrev', async () => o.prev ?? { needsScope: false, prevUserText: null })
  mock.method(askTurnDeps, 'retrieveAskRecords', async (...args: unknown[]) => {
    calls.retrieve.push(args)
    return o.retrieval ?? result('GENERAL', [], [])
  })
  mock.method(askTurnDeps, 'completeJson', async (req: Record<string, unknown>) => {
    calls.llm.push(req)
    const data = o.llm ? await o.llm(req) : { needsScope: null, answerMd: '**핵심**: 설명이에요.', sourceKeys: [], confidence: 'HIGH', proposals: [] }
    return { data, model: 'tier-model', connectionKey: 'conn', attempts: 1, promptChars: 1234, warm: null }
  })
  mock.method(askTurnDeps, 'saveAskTurn', async (_u: string, _a: unknown, out: AskTurnOutput, toolLog: AskToolLog) => {
    calls.save.push({ out, toolLog })
    return { proposals: out.proposals.map((p, i) => ({ id: `p${i}`, kind: p.kind, payload: p.payload, status: 'PROPOSED' as const, messageId: 'ma' })) }
  })
  mock.method(askTurnDeps, 'markFailed', async (_a: unknown, code: string) => {
    calls.failed.push(code)
  })
  mock.method(askTurnDeps, 'recordTrace', async (t: Record<string, unknown>) => {
    calls.traces.push(t)
  })
  mock.method(askTurnDeps, 'todayKst', () => '2026-10-12')
  if (o.budgetMs !== undefined) mock.method(askTurnDeps, 'budgetMs', () => o.budgetMs as number)
  return { calls, accept }
}

async function run(userId: string, request: TurnRequest, listener?: (e: TurnEvent) => void) {
  const h = await startTurn({ userId, chatId: 'c1', request })
  const events: TurnEvent[] = []
  await h.subscribe((e) => {
    events.push(e)
    listener?.(e)
  })
  await h.done
  await sleep(5)
  return { h, events }
}

const text = (t: string, extra: Record<string, unknown> = {}): TurnRequest => ({ resume: false, text: t, inputSource: 'TEXT', utteranceId: null, clientTimings: null, ...extra }) as TurnRequest
const stages = (ev: TurnEvent[]) => ev.map((e) => (e.event === 'status' ? `status:${(e.data as { stage: string }).stage}` : e.event))
const doneData = (ev: TurnEvent[]) => ev.find((e) => e.event === 'done')?.data as Record<string, unknown> & { conversation: Record<string, unknown> }
const userMsg = (req: Record<string, unknown>) => {
  const m = req.messages as { role: string; content: string }[]
  return m[m.length - 1].content
}

// ── ① 정상 턴 · ⑤ 근거 키 재검증 · ⑥ 제안 재검증 ─────────────────────────────

test('① 기록 질문(EXPRESSION, 질문의 기간): 단계 순서·done 모양·toolLog.ask·근거는 서버가 키로 풀고 다른 type·안 실린 키는 버림·제안은 허용 종류만', async (t) => {
  t.after(() => mock.restoreAll())
  const QUESTION = '지난주에 교정받은 표현 정리해 줘'
  const RECORD_TEXT = '昨日映画を見に行きました → 見に行った'
  const { calls } = setup({
    retrieval: result(
      'EXPRESSION',
      [
        { key: 'S1', type: 'CORRECTION', id: 'cr1', label: '조사 교정', text: RECORD_TEXT },
        { key: 'S2', type: 'REVIEW', id: null, label: '복습 대기', text: '복습 3개' },
      ],
      ['getRecentCorrections', 'findExpressions'],
      'LAST_30D',
    ),
    llm: async () => ({
      needsScope: null,
      answerMd: '- **지난주 교정**: 「見に行った」로 고쳤어요.\n\n> 映画を見に行きました。\n영화를 보러 갔어요.',
      sourceKeys: ['S1', 'S2', 'S9'],
      confidence: 'HIGH',
      proposals: [
        { kind: 'ADD_WORD', payload: { surface: '映画', reading: 'えいが', meaning: '영화' } },
        { kind: 'ADD_TOPIC', payload: { title: '영화' } },
        { kind: 'SCHEDULE_REVIEW', payload: { days: 3 } },
      ],
    }),
  })
  const { events } = await run('u-ask-1', text(QUESTION))
  assert.deepEqual(stages(events), ['accepted', 'status:PROMPT', 'status:LLM', 'status:PARSE', 'done'])
  const d = doneData(events)
  assert.equal(d.correction, null)
  assert.equal(d.audioCount, 0)
  assert.equal(d.traceId, 'tr1')
  assert.equal(d.conversation.replyKo, null)
  assert.match(d.conversation.answerMd as string, /지난주 교정/)
  assert.deepEqual(d.conversation.sources, [{ type: 'CORRECTION', id: 'cr1', date: '2026-10-08', label: '조사 교정' }], 'REVIEW(이 의도에서 부르지 않은 함수의 type)·S9(안 실린 키)는 버린다')
  assert.equal(d.conversation.confidence, 'HIGH')
  assert.equal(d.conversation.needsScope, null)
  assert.deepEqual(d.conversation.records, { intent: 'EXPRESSION', count: 2 })
  const proposals = d.proposals as { kind: string }[]
  assert.deepEqual(proposals.map((p) => p.kind), ['ADD_WORD'], 'ADD_TOPIC·SCHEDULE_REVIEW 는 서버가 내지 않는다')

  // 프롬프트: 질문의 기간(QUESTION) + 날짜, 조회 항목은 경계 안, traceId 전달, 소프트 검사·취소 신호 연결 없음(서버 예산 신호만)
  assert.equal(calls.llm.length, 1)
  const req = calls.llm[0]
  assert.equal(req.traceId, 'tr1')
  assert.ok(!req.softExtraCheck)
  assert.match(userMsg(req), /질문에서 읽은 범위/)
  assert.match(userMsg(req), /2026-09-13~2026-10-12/)
  assert.match(userMsg(req), /<<<기록자료-시작>>>/)
  // 조회 호출: 세션 userId, 분류 결과, 질문 글
  assert.equal(calls.retrieve[0][0], 'u-ask-1')
  assert.equal(calls.retrieve[0][2], QUESTION)

  // 저장: toolLog.ask = done 의 구조화 칸, 질문·기록 본문 없음
  assert.equal(calls.save.length, 1)
  const { toolLog, out } = calls.save[0]
  assert.deepEqual(toolLog.ask, { sources: d.conversation.sources, confidence: 'HIGH', needsScope: null, records: { intent: 'EXPRESSION', count: 2 } })
  assert.equal(toolLog.model, 'tier-model')
  assert.equal(toolLog.shortCircuit, null)
  assert.equal(toolLog.scopeSource, 'QUESTION')
  const logJson = JSON.stringify(toolLog)
  assert.ok(!logJson.includes(QUESTION) && !logJson.includes(RECORD_TEXT) && !logJson.includes(out.answerMd), 'toolLog 에 질문·조회 본문·답 본문 없음')
  const traceJson = JSON.stringify(calls.traces)
  assert.ok(!traceJson.includes(QUESTION) && !traceJson.includes(RECORD_TEXT) && !traceJson.includes('見に行った'), 'Trace 에 원문 없음')
  assert.equal(currentTurnLock('u-ask-1'), null, '락 해제')
})

test('② GENERAL: 조회가 무언가를 돌려줘도 근거 []·records.count 0, 프롬프트에 기록 구역 없음', async (t) => {
  t.after(() => mock.restoreAll())
  const { calls } = setup({
    retrieval: result('GENERAL', [{ key: 'S1', type: 'CORRECTION', id: 'cr1', label: '교정', text: '本文' }], []),
    llm: async () => ({ needsScope: null, answerMd: '「は」는 주제, 「が」는 주어예요.', sourceKeys: ['S1'], confidence: 'HIGH', proposals: [] }),
  })
  const { events } = await run('u-ask-2', text('「は」와 「が」의 차이가 뭐예요?'))
  const d = doneData(events)
  assert.deepEqual(d.conversation.sources, [])
  assert.deepEqual(d.conversation.records, { intent: 'GENERAL', count: 0 })
  assert.ok(!userMsg(calls.llm[0]).includes('<<<기록자료-시작>>>'))
})

test('③ 기록 의도 + 0건: records.count 0 (화면 「못 찾았어요」 신호), 프롬프트에 0건 안내', async (t) => {
  t.after(() => mock.restoreAll())
  const { calls } = setup({ retrieval: result('EXPRESSION', [], ['getRecentCorrections', 'findExpressions']) })
  const { events } = await run('u-ask-3', text('내가 저번에 쓰던 표현 뭐였지?'))
  assert.deepEqual(doneData(events).conversation.records, { intent: 'EXPRESSION', count: 0 })
  assert.match(userMsg(calls.llm[0]), /0건/)
  assert.match(userMsg(calls.llm[0]), /기본 범위/)
})

// ── 되묻기: 규칙 단락(LLM 0) · 칩 답 · scope 무시 ──────────────────────────────

test('④-a 규칙 되묻기(Leader 결정): 조회·LLM 0건, PROMPT 뒤 바로 done, 고정 문장·고정 칩·MEDIUM·records.count 0, toolLog shortCircuit', async (t) => {
  t.after(() => mock.restoreAll())
  const { calls } = setup()
  const { events } = await run('u-ask-4a', text('내가 틀린 거 정리해 줘'))
  assert.deepEqual(stages(events), ['accepted', 'status:PROMPT', 'done'])
  assert.equal(calls.llm.length, 0)
  assert.equal(calls.retrieve.length, 0)
  const c = doneData(events).conversation
  assert.equal(c.answerMd, ASK_SCOPE_SENTENCES.EXPRESSION)
  assert.deepEqual(c.needsScope, {
    prompt: ASK_SCOPE_SENTENCES.EXPRESSION,
    options: [
      { key: 'THIS_WEEK', label: '이번 주' },
      { key: 'LAST_30D', label: '지난 30일' },
      { key: 'ALL', label: '전체 기간' },
    ],
  })
  assert.equal(c.confidence, 'MEDIUM')
  assert.deepEqual(c.sources, [])
  assert.deepEqual(c.records, { intent: 'EXPRESSION', count: 0 })
  assert.deepEqual(doneData(events).proposals, [])
  const tl = calls.save[0].toolLog
  assert.equal(tl.shortCircuit, 'NEEDS_SCOPE')
  assert.equal(tl.model, null)
  assert.equal(tl.llmMs, null)
  assert.deepEqual(askMetaFromToolLog(tl)?.needsScope?.prompt, ASK_SCOPE_SENTENCES.EXPRESSION)
})

test('④-b PROGRESS 되묻기 문장, 칩 답 다음 턴은 정상 LLM 경로(직전 질문의 의도 + 칩 범위, 출처 CHIP), 모델이 또 되물으면 재시도 위반', async (t) => {
  t.after(() => mock.restoreAll())
  setup()
  const first = await run('u-ask-4b', text('공부 얼마나 했어?'))
  assert.equal(doneData(first.events).conversation.answerMd, ASK_SCOPE_SENTENCES.PROGRESS)
  mock.restoreAll()

  const PREV = '내가 틀린 거 정리해 줘'
  let violations: string[] = []
  const { calls } = setup({
    prev: { needsScope: true, prevUserText: PREV },
    retrieval: result('EXPRESSION', [{ key: 'S1', type: 'CORRECTION', id: 'cr1', label: '교정', text: '本文' }], ['getRecentCorrections', 'findExpressions'], 'THIS_WEEK'),
    llm: async (req) => {
      const check = req.extraCheck as (d: unknown, i?: unknown) => string[]
      violations = check({ needsScope: { prompt: '어느 기간이요?' }, answerMd: '기간을 알려 주세요.', sourceKeys: [], confidence: 'LOW', proposals: [] })
      return { needsScope: null, answerMd: '이번 주에는 교정이 하나 있었어요.', sourceKeys: ['S1'], confidence: 'HIGH', proposals: [] }
    },
  })
  const { events } = await run('u-ask-4b', text('이번 주', { scope: { key: 'THIS_WEEK' } }))
  assert.deepEqual(stages(events), ['accepted', 'status:PROMPT', 'status:LLM', 'status:PARSE', 'done'])
  const c = calls.retrieve[0][1] as { intent: string; scope: { key: string } }
  assert.equal(c.intent, 'EXPRESSION', '칩 글자가 아니라 직전 질문의 의도')
  assert.equal(c.scope.key, 'THIS_WEEK')
  assert.equal(calls.retrieve[0][2], PREV, '검색어는 직전 질문 글에서')
  assert.match(userMsg(calls.llm[0]), /학습자가 고른 범위/)
  assert.match(userMsg(calls.llm[0]), /2026-10-12~2026-10-18/)
  assert.ok(violations.some((v) => v.includes('needsScope 는 null')), '범위가 정해진 턴에서 모델 되묻기 = 재시도 위반')
  assert.equal(calls.save[0].toolLog.scopeSource, 'CHIP')
})

test('④-c 직전 답이 되묻지 않았으면 요청 scope 는 무시(기본 범위 DEFAULT)', async (t) => {
  t.after(() => mock.restoreAll())
  const { calls } = setup({ prev: { needsScope: false, prevUserText: null }, retrieval: result('EXPRESSION', [], ['getRecentCorrections', 'findExpressions']) })
  await run('u-ask-4c', text('내가 저번에 쓰던 표현 뭐였지?', { scope: { key: 'THIS_WEEK' } }))
  const c = calls.retrieve[0][1] as { scope: unknown }
  assert.equal(c.scope, null)
  assert.match(userMsg(calls.llm[0]), /기본 범위/)
  assert.equal(calls.save[0].toolLog.scopeSource, 'DEFAULT')
})

test('④-d askPrevFrom: DONE 강사 답의 toolLog.ask.needsScope 일 때만 true', () => {
  const ask = (needsScope: unknown) => ({ ask: { sources: [], confidence: 'MEDIUM', needsScope, records: { intent: 'EXPRESSION', count: 0 } } })
  const user = { role: 'USER' as const, status: 'DONE', content: '틀린 거 정리', toolLog: null }
  assert.deepEqual(askPrevFrom([{ role: 'ASSISTANT', status: 'DONE', content: 'x', toolLog: ask({ prompt: 'p', options: [] }) }, user]), { needsScope: true, prevUserText: '틀린 거 정리' })
  assert.equal(askPrevFrom([{ role: 'ASSISTANT', status: 'DONE', content: 'x', toolLog: ask(null) }, user]).needsScope, false)
  assert.equal(askPrevFrom([{ role: 'ASSISTANT', status: 'FAILED', content: '', toolLog: ask({ prompt: 'p' }) }, user]).needsScope, false)
  assert.equal(askPrevFrom([user]).needsScope, false)
  assert.equal(askPrevFrom([]).needsScope, false)
})

// ── ⑦ 살균 ───────────────────────────────────────────────────────────────────

test('⑦ answerMd 살균: <script>·onerror·javascript:·data:·iframe·마크다운 링크/이미지·URL 이 저장값·done 에서 사라짐', async (t) => {
  t.after(() => mock.restoreAll())
  const DIRTY = [
    '설명이에요 <script>alert(1)</script> 끝.',
    '<img src=x onerror="alert(1)"> 그림',
    '[여기](javascript:alert(1)) 를 누르세요',
    '![a](data:image/png;base64,AAAA)',
    '<iframe src="https://evil.example"></iframe>',
    '참고 https://evil.example/x 와 data:text/html,hi',
  ].join('\n\n')
  const { calls } = setup({ llm: async () => ({ needsScope: null, answerMd: DIRTY, sourceKeys: [], confidence: 'MEDIUM', proposals: [] }) })
  const { events } = await run('u-ask-7', text('「は」와 「が」의 차이가 뭐예요?'))
  const saved = calls.save[0].out.answerMd
  for (const s of [saved, doneData(events).conversation.answerMd as string]) {
    for (const bad of ['<script', 'onerror', 'javascript:', 'data:', '<iframe', '](', '![', 'https://', 'evil.example']) assert.ok(!s.includes(bad), `${bad} 남음`)
    assert.match(s, /설명이에요/)
  }
  assert.equal(finalizeAnswerMd('<b>굵게</b> [링크](https://x.y) 끝'), '굵게 링크 끝')
  assert.throws(() => finalizeAnswerMd('<script></script>'), (e: unknown) => e instanceof ApiError && e.code === 'ENGINE_ERROR')
  assert.throws(() => finalizeAnswerMd('가'.repeat(4001)), (e: unknown) => e instanceof ApiError)
})

// ── ⑧ 이 방의 이력만 ─────────────────────────────────────────────────────────

test('⑧ 이력 창은 이 방(chatId)·이 사용자·DONE 만 읽는다 — 다른 방 0', async () => {
  const rows = [
    { chatId: 'c1', userId: 'u1', role: 'USER', content: '이 방 질문', status: 'DONE' },
    { chatId: 'c2', userId: 'u1', role: 'USER', content: '다른 회화 대화', status: 'DONE' },
    { chatId: 'c1', userId: 'u2', role: 'USER', content: '남의 글', status: 'DONE' },
  ]
  let where: Record<string, unknown> = {}
  const db = {
    chatMessage: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        where = args.where
        return rows.filter((r) => r.chatId === args.where.chatId && r.userId === args.where.userId && r.status === args.where.status).reverse()
      },
    },
  } as unknown as Pick<Tx, 'chatMessage'>
  const win = await loadAskHistory('u1', 'c1', { id: 'mu', createdAt: NOW }, db)
  assert.equal(where.chatId, 'c1')
  assert.equal(where.userId, 'u1')
  assert.equal(where.status, 'DONE')
  assert.deepEqual(win.map((m) => m.content), ['이 방 질문'])
})

test('⑧ 직전 되묻기 판정(loadAskPrev)도 이 방(chatId)·이 사용자 행만 읽는다 — 같은 방 id 의 타인 강사 답·다른 방 답은 읽히지 않는다 (S-5/M8d)', async () => {
  const asked = { ask: { sources: [], confidence: 'MEDIUM', needsScope: { prompt: '어느 기간?', options: [] }, records: { intent: 'EXPRESSION', count: 0 } } }
  const at = (n: number) => new Date(NOW.getTime() - 1000 * (100 - n))
  const row = (chatId: string, userId: string, n: number, role: 'USER' | 'ASSISTANT', content: string, toolLog: unknown = null) => ({ chatId, userId, role, status: 'DONE', content, toolLog, createdAt: at(n) })
  const rows = [
    row('c1', 'u1', 1, 'USER', '내가 틀린 거 정리해 줘'),
    row('c1', 'u1', 2, 'ASSISTANT', '어느 기간을 볼까요?', asked),
    // 같은 방 id 에 다른 사용자의 되묻기(더 최근) — 소유 조건이 없으면 이것이 「직전 두 행」이 된다.
    row('c1', 'u2', 3, 'USER', '남의 질문'),
    row('c1', 'u2', 4, 'ASSISTANT', '남의 되묻기', asked),
    // 같은 사용자의 다른 방에서 가장 최근의 되묻기 — 방 조건이 없으면 u3 의 c1 은 비어 있어도 이것이 읽힌다.
    row('c9', 'u3', 5, 'USER', '다른 방 질문'),
    row('c9', 'u3', 6, 'ASSISTANT', '다른 방 되묻기', asked),
  ]
  const wheres: Record<string, unknown>[] = []
  const db = {
    chatMessage: {
      findMany: async (args: { where: Record<string, unknown>; take: number }) => {
        wheres.push(args.where)
        // 조건에 적힌 칸만 거른다(칸이 빠지면 거르지 않는다) — 날짜 앞뒤 조건(OR)은 모든 행이 이미 이전이라 생략.
        return rows
          .filter((r) => (args.where.chatId === undefined || r.chatId === args.where.chatId) && (args.where.userId === undefined || r.userId === args.where.userId))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, args.take)
          .map(({ role, status, content, toolLog }) => ({ role, status, content, toolLog }))
      },
    },
  } as unknown as Pick<Tx, 'chatMessage'>
  const before = { id: 'mu', createdAt: NOW }

  assert.deepEqual(await loadAskPrev('u1', 'c1', before, db), { needsScope: true, prevUserText: '내가 틀린 거 정리해 줘' }, '자기 행만 — 타인의 더 최근 되묻기가 섞이면 prevUserText 가 「남의 질문」이 된다')
  assert.deepEqual(await loadAskPrev('u3', 'c1', before, db), { needsScope: false, prevUserText: null }, 'u3 은 c1 에 행이 없다 — 다른 방(c9)의 되묻기를 읽으면 안 된다')
  assert.deepEqual(await loadAskPrev('u1', 'c-none', before, db), { needsScope: false, prevUserText: null })
  assert.deepEqual(await loadAskPrev('u9', 'c1', before, db), { needsScope: false, prevUserText: null }, '행이 없는 사용자 — 같은 방의 타인 되묻기를 읽으면 안 된다')
  assert.equal(wheres[0].chatId, 'c1')
  assert.equal(wheres[0].userId, 'u1')
})

// ── ⑨ 실패 ───────────────────────────────────────────────────────────────────

test('⑨-a LLM 시간 초과·엔진 불가: 강사 FAILED, error 1회(retryable), 사용자 행은 남김(저장 0), 로그에 원문 없음', async (t) => {
  t.after(() => mock.restoreAll())
  const QUESTION = '「は」와 「が」의 비밀 질문'
  const logs: string[] = []
  mock.method(console, 'error', (...a: unknown[]) => logs.push(a.map(String).join(' ')))
  mock.method(console, 'warn', (...a: unknown[]) => logs.push(a.map(String).join(' ')))
  const { calls } = setup({ llm: async () => Promise.reject(new ApiError('ENGINE_TIMEOUT', `늦음 ${QUESTION}`)) })
  const { events } = await run('u-ask-9a', text(QUESTION))
  const errors = events.filter((e) => e.event === 'error')
  assert.equal(errors.length, 1)
  assert.deepEqual({ ...(errors[0].data as object), message: undefined }, { code: 'ENGINE_TIMEOUT', message: undefined, traceId: 'tr1', retryable: true })
  assert.deepEqual(calls.failed, ['ENGINE_TIMEOUT'])
  assert.equal(calls.save.length, 0)
  assert.ok(!logs.join('\n').includes(QUESTION))
  assert.equal(calls.traces[0].status, 'ERROR')
  assert.equal(currentTurnLock('u-ask-9a'), null)
})

test('⑨-b 서버 예산 초과: LLM 을 끊고 ENGINE_TIMEOUT', async (t) => {
  t.after(() => mock.restoreAll())
  let aborted = false
  const { calls } = setup({
    budgetMs: 20,
    llm: (req) =>
      new Promise((_r, reject) => {
        ;(req.signal as AbortSignal).addEventListener('abort', () => {
          aborted = true
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        })
      }),
  })
  const { events } = await run('u-ask-9b', text('「は」와 「が」의 차이'))
  assert.equal(aborted, true)
  assert.equal((events.find((e) => e.event === 'error')?.data as { code: string }).code, 'ENGINE_TIMEOUT')
  assert.deepEqual(calls.failed, ['ENGINE_TIMEOUT'])
})

test('⑨-c 파싱 실패(재시도 뒤에도 계약 위반 → JsonSchemaError)·정리 불가(답 없음) → ENGINE_ERROR, 저장 0, error 1회', async (t) => {
  t.after(() => mock.restoreAll())
  mock.method(console, 'error', () => {})
  const a = setup({ llm: async () => Promise.reject(Object.assign(new Error('위반 원문'), { name: 'JsonSchemaError' })) })
  const r1 = await run('u-ask-9c', text('「は」의 뜻'))
  assert.deepEqual(a.calls.failed, ['ENGINE_ERROR'])
  assert.equal(r1.events.filter((e) => e.event === 'error').length, 1)
  mock.restoreAll()
  const b = setup({ llm: async () => ({ needsScope: null, answerMd: '', sourceKeys: [], confidence: 'HIGH', proposals: [] }) })
  await run('u-ask-9c', text('「は」의 뜻'))
  assert.deepEqual(b.calls.failed, ['ENGINE_ERROR'])
  assert.equal(b.calls.save.length, 0)
})

// ── ⑩ 끊김 내성 ──────────────────────────────────────────────────────────────

test('⑩ 구독자가 없거나 구독자가 던져도(연결 끊김) 서버는 저장까지 끝낸다', async (t) => {
  t.after(() => mock.restoreAll())
  const { calls } = setup({ llm: async () => (await sleep(20), { needsScope: null, answerMd: '답이에요.', sourceKeys: [], confidence: 'HIGH', proposals: [] }) })
  const h = await startTurn({ userId: 'u-ask-10', chatId: 'c1', request: text('「は」의 뜻') })
  await h.done // 아무도 구독하지 않음
  assert.equal(calls.save.length, 1)
  mock.restoreAll()
  const b = setup({ llm: async () => (await sleep(20), { needsScope: null, answerMd: '답이에요.', sourceKeys: [], confidence: 'HIGH', proposals: [] }) })
  const h2 = await startTurn({ userId: 'u-ask-10', chatId: 'c1', request: text('「は」의 뜻') })
  void h2.subscribe(() => {
    throw new Error('socket closed')
  })
  await h2.done
  assert.equal(b.calls.save.length, 1)
})

// ── ⑪ 요청 검증·소유자·회귀 ──────────────────────────────────────────────────

test('⑪-a ASK 에 음성 입력·발화 id → 수락 전 VALIDATION(수락 0·LLM 0·락 해제)', async (t) => {
  t.after(() => mock.restoreAll())
  const { calls, accept } = setup()
  for (const req of [text('질문', { inputSource: 'REALTIME_STT', utteranceId: 'ut1' }), text('질문', { utteranceId: 'ut1' })]) {
    await assert.rejects(startTurn({ userId: 'u-ask-11a', chatId: 'c1', request: req }), (e: unknown) => e instanceof ApiError && e.code === 'VALIDATION')
  }
  assert.equal(accept.mock.callCount(), 0)
  assert.equal(calls.llm.length, 0)
  assert.equal(currentTurnLock('u-ask-11a'), null)
})

function acceptTx(chat: { userId: string; kind: string }) {
  const ops: { op: string; args: unknown }[] = []
  let raw = 0
  const tx = {
    $queryRaw: async () => (++raw === 1 ? [{ id: 'u1' }] : [{ id: 'c1', userId: chat.userId, kind: chat.kind, level: null, scenarioId: null, createdAt: NOW, endedAt: null }]),
    chatMessage: {
      findMany: async () => [],
      create: async (args: { data: { role: string } }) => (ops.push({ op: 'create', args }), args.data.role === 'USER' ? { id: 'mu', content: 'q', createdAt: NOW, inputSource: 'TEXT' } : { id: 'ma' }),
      updateMany: async () => ({ count: 0 }),
    },
    chat: { update: async (args: unknown) => (ops.push({ op: 'chat.update', args }), {}) },
  } as unknown as Tx
  return { tx, ops }
}

test('⑪-b acceptTurnTx(ASK): 남의 방 404 · 음성 입력 VALIDATION(행 0) · 글자 질문은 수락하고 미리보기 = 질문 ≤60자', async () => {
  const other = acceptTx({ userId: 'u-other', kind: 'ASK' })
  await assert.rejects(acceptTurnTx(other.tx, 'u1', 'c1', text('질문')), (e: unknown) => e instanceof ApiError && e.code === 'NOT_FOUND')
  const voice = acceptTx({ userId: 'u1', kind: 'ASK' })
  await assert.rejects(acceptTurnTx(voice.tx, 'u1', 'c1', text('질문', { inputSource: 'REALTIME_STT', utteranceId: 'ut1' })), (e: unknown) => e instanceof ApiError && e.code === 'VALIDATION')
  assert.equal(voice.ops.length, 0)
  const ok = acceptTx({ userId: 'u1', kind: 'ASK' })
  const long = '가'.repeat(100)
  const a = await acceptTurnTx(ok.tx, 'u1', 'c1', text(long))
  assert.equal(a.kind, 'ASK')
  const preview = ((ok.ops.find((o) => o.op === 'chat.update')?.args as { data: { preview: string } }).data.preview)
  assert.ok(Array.from(preview).length <= 60)
  // 회귀: CHAT 은 기존 미리보기(≤120)
  const chat = acceptTx({ userId: 'u1', kind: 'CHAT' })
  await acceptTurnTx(chat.tx, 'u1', 'c1', text(long))
  assert.equal(((chat.ops.find((o) => o.op === 'chat.update')?.args as { data: { preview: string } }).data.preview), long)
})

test('⑪-c 회귀: CHAT 방은 기존 경로(LLM 선행 시작) — ASK 의존은 부르지 않는다', async (t) => {
  t.after(() => mock.restoreAll())
  const { calls } = setup({ kind: 'CHAT' })
  mock.method(turnDeps, 'loadCorrectionMode', async () => 'FLUENCY' as const)
  mock.method(turnDeps, 'loadCoachPending', async () => null)
  const chatLlm = mock.method(turnDeps, 'completeJson', async () => {
    throw new ApiError('ENGINE_UNAVAILABLE', 'x')
  })
  const { events } = await run('u-ask-11c', text('こんにちは'))
  assert.equal(chatLlm.mock.callCount(), 1)
  assert.equal(calls.llm.length, 0)
  assert.equal(calls.retrieve.length, 0)
  assert.equal((events.find((e) => e.event === 'error')?.data as { code: string }).code, 'ENGINE_UNAVAILABLE')
})

// ── 저장 트랜잭션 ────────────────────────────────────────────────────────────

function saveTx(o: { title: string; doneCount?: number }) {
  const ops: { op: string; args: Record<string, unknown> }[] = []
  const rec = (op: string, ret: unknown) => async (args: Record<string, unknown>) => (ops.push({ op, args }), ret)
  const tx = {
    $queryRaw: async () => (ops.push({ op: 'lockUser', args: {} }), [{ id: 'u1' }]),
    chatMessage: { updateMany: rec('msg.updateMany', { count: o.doneCount ?? 1 }), findFirst: rec('msg.findFirst', { content: '  첫 질문은\n이것입니다 아주 긴 질문이라 서른 글자를 넘어가게 씁니다' }) },
    tutorProposal: { create: rec('proposal.create', { id: 'p1' }) },
    chat: { findFirst: rec('chat.findFirst', { title: o.title }), updateMany: rec('chat.updateMany', { count: 1 }) },
  } as unknown as Tx
  return { tx, ops }
}
const accepted = { chatId: 'c1', level: null, userMessage: { id: 'mu', content: '이번 질문', createdAt: NOW }, assistantMessageId: 'ma', pendingSince: new Date(NOW.getTime() + 1), traceId: 'tr1', resumed: false }
const output: AskTurnOutput = {
  answerMd: '- **핵심**: 「は」는 주제를 나타내요. 길게 이어지는 설명이 여기 있어서 육십 글자를 넘어가도록 충분히 길게 씁니다.\n\n둘째 문단',
  meta: { sources: [], confidence: 'HIGH', needsScope: null, records: { intent: 'GENERAL', count: 0 } },
  proposals: [{ kind: 'ADD_WORD', payload: { surface: '映画', reading: 'えいが', meaning: '영화' } }],
}
const tl = { traceId: 'tr1', ask: output.meta } as unknown as AskToolLog

test('저장 tx: 사용자 잠금 → 조건부 DONE(answerMd·translation null·toolLog.ask) → 제안 PROPOSED → 미리보기(답 첫 줄 평문 ≤60) → 기본 제목이면 첫 질문 30자(조건부)', async () => {
  const { tx, ops } = saveTx({ title: ASK_DEFAULT_TITLE })
  const saved = await saveAskTurnTx(tx, 'u1', accepted, output, tl)
  assert.deepEqual(ops.map((o) => o.op), ['lockUser', 'msg.updateMany', 'proposal.create', 'chat.findFirst', 'chat.updateMany', 'msg.findFirst', 'chat.updateMany'])
  const done = ops[1].args as { where: Record<string, unknown>; data: Record<string, unknown> }
  assert.deepEqual(done.where, { id: 'ma', status: 'PENDING', createdAt: accepted.pendingSince })
  assert.equal(done.data.status, 'DONE')
  assert.equal(done.data.content, output.answerMd)
  assert.equal(done.data.translation, null)
  assert.deepEqual((done.data.toolLog as { ask: unknown }).ask, output.meta)
  assert.deepEqual((ops[2].args as { data: Record<string, unknown> }).data.kind, 'ADD_WORD')
  assert.equal((ops[2].args as { data: Record<string, unknown> }).data.messageId, 'ma')
  const preview = (ops[4].args as { data: { preview: string } }).data.preview
  assert.ok(preview.startsWith('핵심: 「は」는 주제를'))
  assert.ok(Array.from(preview).length <= 60 && !preview.includes('**') && !preview.startsWith('-'))
  const titleUp = ops[6].args as { where: Record<string, unknown>; data: { title: string } }
  assert.equal(titleUp.where.title, ASK_DEFAULT_TITLE, '조건부 — 사용자가 바꾼 제목은 덮지 않는다')
  assert.ok(titleUp.data.title.startsWith('첫 질문은 이것입니다') && Array.from(titleUp.data.title).length <= 30 && !titleUp.data.title.includes('\n'))
  assert.equal(saved.proposals[0].status, 'PROPOSED')
})

test('저장 tx: 제목이 기본값이 아니면 제목을 건드리지 않는다 · 정리된 PENDING 이면 CONFLICT', async () => {
  const named = saveTx({ title: '내가 지은 제목' })
  await saveAskTurnTx(named.tx, 'u1', accepted, output, tl)
  assert.equal(named.ops.filter((o) => o.op === 'chat.updateMany').length, 1)
  assert.equal(named.ops.filter((o) => o.op === 'msg.findFirst').length, 0)
  const gone = saveTx({ title: ASK_DEFAULT_TITLE, doneCount: 0 })
  await assert.rejects(saveAskTurnTx(gone.tx, 'u1', accepted, output, tl), (e: unknown) => e instanceof ApiError && e.code === 'CONFLICT')
  assert.equal(gone.ops.filter((o) => o.op === 'proposal.create').length, 0)
})

// ── 순수 도구 ────────────────────────────────────────────────────────────────

test('askAllowedProposals: 3a 허용 종류·페이로드 모양만, 최대 3', () => {
  const out = askAllowedProposals([
    { kind: 'ADD_TOPIC', payload: { title: 'x', level: 'N2' } },
    { kind: 'SCHEDULE_REVIEW', payload: {} },
    { kind: 'ADD_WORD', payload: { surface: '', reading: '', meaning: '뜻' } },
    { kind: 'ADD_WORD', payload: { surface: '映画', reading: '', meaning: '영화' } },
    { kind: 'SET_LEVEL', payload: { level: 'N0' } },
    { kind: 'SET_LEVEL', payload: { level: 'N3' } },
    { kind: 'ADD_STUDY_LOG', payload: { summaryKo: '조사 정리' } },
    { kind: 'ADD_WORD', payload: { surface: '本', reading: 'ほん', meaning: '책' } },
    'junk',
  ])
  assert.deepEqual(out.map((p) => p.kind), ['ADD_WORD', 'SET_LEVEL', 'ADD_STUDY_LOG'])
  assert.deepEqual(out[1].payload, { level: 'N3' })
})

test('미리보기·범위 날짜·되묻기 가드·toolLog 읽기', () => {
  assert.equal(askAnswerPreview('\n\n> 映画を見ました。\n뜻', '질문'), '映画を見ました。')
  assert.equal(askAnswerPreview('**   **', '질문 글'), '질문 글')
  assert.deepEqual(askScopeDates('THIS_WEEK', '2026-10-15'), { fromKst: '2026-10-12', toKst: '2026-10-18' })
  assert.deepEqual(askScopeDates('LAST_30D', '2026-10-12'), { fromKst: '2026-09-13', toKst: '2026-10-12' })
  assert.deepEqual(askScopeDates('ALL', '2026-10-12'), { fromKst: null, toKst: null })
  const base = { task: 'ask', messages: [], extraCheck: () => ['기존'] } as unknown as Parameters<typeof withScopeGuard>[0]
  assert.equal(withScopeGuard(base, { key: 'ALL', source: 'DEFAULT' }), base)
  const g = withScopeGuard(base, { key: 'THIS_WEEK', source: 'QUESTION' })
  assert.deepEqual(g.extraCheck!({ needsScope: null } as never), ['기존'])
  assert.equal(g.extraCheck!({ needsScope: { prompt: 'p' } } as never).length, 2)
  assert.equal(askMetaFromToolLog({ traceId: 't' }), null)
  assert.equal(askMetaFromToolLog({ ask: { sources: [], confidence: 'SURE', needsScope: null, records: { intent: 'GENERAL', count: 0 } } }), null)
  const m = askMetaFromToolLog({ ask: { sources: [{ type: 'WORD', id: 'w', date: '2026-10-01', label: 'x' }, { type: 'LESSON', id: null, date: '2026-10-01', label: 'L' }], confidence: 'LOW', needsScope: { prompt: 'p' }, records: { intent: 'MIXED', count: 2 } } })
  assert.deepEqual(m?.sources, [{ type: 'LESSON', id: null, date: '2026-10-01', label: 'L' }])
  assert.equal(m?.needsScope?.options.length, 3)
})

test('끊김 복구(resumePending): ASK 방이면 수락(재실행) 뒤 ASK 경로로 다시 돈다 — 요청 scope 없음', async (t) => {
  t.after(() => mock.restoreAll())
  const { calls, accept } = setup()
  const { events } = await run('u-ask-resume', { resume: true })
  assert.equal(accept.mock.callCount(), 1)
  assert.equal((accept.mock.calls[0].arguments[2] as TurnRequest).resume, true)
  assert.deepEqual(stages(events), ['accepted', 'status:PROMPT', 'done'], '저장된 질문(내가 틀린 거 정리해 줘) → 규칙 되묻기')
  assert.equal(calls.save.length, 1)
})
