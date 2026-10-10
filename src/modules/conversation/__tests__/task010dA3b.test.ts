/**
 * task-010d A3b-1 — conversation 쪽 역할극 배선 단위 테스트(DB·LLM 없음, 가짜 tx·의존):
 *  첫마디 저장(D-3) · 진행 값(D-4 — usedIds 코드 누적, stepIndex null) · #29 `chat.scenario` · 턴 수락의 끝낸 역할극 409(`acceptTurnTx`) ·
 *  #167 종료 흐름(잠금 밖 판정·재확인·TURN_RUNNING·NO_TURNS·재생·판정 실패 null·L-1 증거 대조 결과만 넘김·Trace 수치만) · 진행 중 후보 · L-7② 구조 고정.
 */
import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError, prisma, type Tx } from '@/modules/infra'
import type { LlmJsonRequest, LlmJsonResult, TraceRecord } from '@/modules/engine'
import { readScenarioRolePlayMaterial, SCENARIO_END_LOOKUP_MARGIN_MS, type ScenarioEndInput, type ScenarioEndResult, type ScenarioMaterialDb, type ScenarioRolePlayMaterial } from '@/modules/learning'
import { reviewChat } from '../review'
import {
  chatRolePlayView,
  createChatWithOpening,
  createRolePlayChat,
  finishRolePlay,
  listOpenRolePlayChats,
  openingToolLog,
  OPEN_ROLE_PLAY_MAX,
  OPEN_ROLE_PLAY_MAX_AGE_DAYS,
  rolePlayChatView,
  rolePlayProgress,
  ROLE_PLAY_OPENING_SOURCE,
  type RolePlayChatDeps,
  type RolePlayChatRowData,
  type RolePlayFinishDeps,
  type RolePlayOpening,
  type RolePlayViewDeps,
} from '../chats/rolePlay'
import { acceptTurnTx, startTurn, turnDeps } from '../orchestrator'
import type { TurnEvent } from '../orchestrator/stream'
import type { ChatRow } from '../chats'
import type { TutorResponse } from '../structuredResponse/schemas'
import type { ScenarioVerdictResponse } from '../structuredResponse/scenarioVerdict'

const U = 'cuser0000000000000000010d'
const CHAT_AT = new Date('2026-10-07T01:00:00Z')

function expectApi(code: string, reason?: string) {
  return (e: unknown) => {
    assert.ok(e instanceof ApiError, `ApiError 기대: ${String(e)}`)
    assert.equal(e.code, code)
    if (reason) assert.equal(e.details?.reason, reason)
    return true
  }
}

const SCENARIO_ROW = {
  id: 'scn_seed',
  userId: null,
  isSeed: true,
  status: 'ACTIVE',
  title: '사이즈 바꿔 주문하기',
  titleJa: 'サイズを変えて注文する',
  level: 'N5',
  roles: { learner: '손님', tutor: '점원' },
  goal: { communicativeGoal_ko: '음료 크기를 바꿔 주문하기', successCriteria: ['크기 말하기'] },
  constraints: { steps: [{ ko: '인사' }, { ko: '주문' }, { ko: '계산' }], opening: { ja: 'いらっしゃいませ。ご注文は？', ko: '어서 오세요. 주문은요?' } },
  keyExpressions: [
    { id: 'e1', ja: '〜にしてください', ko: '~로 해 주세요', match: 'にしてください' },
    { id: 'e2', ja: 'Lサイズ', ko: 'L 사이즈' },
  ],
  completionRule: { requiredExpressions: 1 },
}

async function material(row: Record<string, unknown> = SCENARIO_ROW): Promise<ScenarioRolePlayMaterial> {
  const db = { scenario: { findFirst: async () => ({ ...row }) }, topicChunk: { findMany: async () => [] } } as unknown as ScenarioMaterialDb
  const m = await readScenarioRolePlayMaterial(U, row.id as string, db)
  assert.ok(m)
  return m
}

// ── 첫마디(D-3) ─────────────────────────────────────────────────────────────

function chatRow(id: string, messageCount: number): ChatRow {
  return { id, kind: 'TALK', title: '사이즈 바꿔 주문하기', level: 'N5', lastMessageAt: CHAT_AT, preview: null, messageCount, reviewedAt: null, createdAt: CHAT_AT, topic: null }
}

function createDeps(opening: { ja: string; ko: string } | null) {
  const openings: (RolePlayOpening | null)[] = []
  const d: RolePlayChatDeps = {
    resolveStart: async () => ({ scenario: { id: 'scn_seed', title: '사이즈 바꿔 주문하기', titleJa: null, level: 'N5' }, lessonId: null, topic: null, topicSource: 'NONE' }),
    readMaterial: async () => ({ opening }),
    createChat: async (_data, o) => (openings.push(o), chatRow('chat_new', o ? 1 : 0)),
  }
  return { d, openings }
}

test('첫마디(D-3): 상황 opening 이 있으면 선생님 첫 메시지로 함께 저장(LLM 0) · 없으면 null · toolLog 는 표식·style 만(원문 없음)', async () => {
  const withOpening = createDeps({ ja: 'いらっしゃいませ。', ko: '어서 오세요.' })
  const dto = await createRolePlayChat(U, { kind: 'TALK', title: null, level: null, topicId: null, scenarioId: 'scn_seed', lessonId: null }, withOpening.d)
  assert.deepEqual(withOpening.openings, [{ ja: 'いらっしゃいませ。', ko: '어서 오세요.' }])
  assert.equal(dto.messageCount, 1)
  const none = createDeps(null)
  await createRolePlayChat(U, { kind: 'TALK', title: null, level: null, topicId: null, scenarioId: 'scn_seed', lessonId: null }, none.d)
  assert.deepEqual(none.openings, [null], '첫마디 없는 상황 — 학습자가 먼저(화면 RolePlayIntro)')
  assert.deepEqual(openingToolLog(), { source: ROLE_PLAY_OPENING_SOURCE, meta: { learning: null, style: 'NEUTRAL', endOfTopic: false, warning: null } })
})

function openingTx() {
  const log: { op: string; data: Record<string, unknown> }[] = []
  let txCount = 0
  const tx = {
    chat: {
      create: async (a: { data: Record<string, unknown> }) => (log.push({ op: 'chat.create', data: a.data }), { ...chatRow('chat_new', (a.data.messageCount as number) ?? 0), id: 'chat_new' }),
    },
    chatMessage: { create: async (a: { data: Record<string, unknown> }) => (log.push({ op: 'chatMessage.create', data: a.data }), { id: 'm_open' }) },
  }
  const run = async <T,>(fn: (t: Tx) => Promise<T>): Promise<T> => {
    txCount++
    return fn(tx as unknown as Tx)
  }
  return { log, run, txCount: () => txCount }
}

const ROW_DATA: RolePlayChatRowData = { userId: U, kind: 'TALK', title: '사이즈 바꿔 주문하기', topicId: null, scenarioId: 'scn_seed', lessonId: null, level: 'N5', lastMessageAt: CHAT_AT, createdAt: CHAT_AT }

test('첫마디 저장(D-3): Chat + 선생님 DONE 1행을 한 트랜잭션에 — 같은 대화·같은 시각·messageCount 1·미리보기 · 첫마디 없으면 Chat 만', async () => {
  const w = openingTx()
  await createChatWithOpening(ROW_DATA, { ja: 'いらっしゃいませ。', ko: '어서 오세요.' }, w.run)
  assert.equal(w.txCount(), 1, '한 트랜잭션')
  assert.deepEqual(w.log.map((l) => l.op), ['chat.create', 'chatMessage.create'])
  assert.deepEqual([w.log[0].data.messageCount, w.log[0].data.preview, w.log[0].data.scenarioId], [1, 'いらっしゃいませ。', 'scn_seed'])
  const m = w.log[1].data
  assert.deepEqual([m.chatId, m.userId, m.role, m.status, m.content, m.translation], ['chat_new', U, 'ASSISTANT', 'DONE', 'いらっしゃいませ。', '어서 오세요.'])
  assert.equal((m.createdAt as Date).getTime(), CHAT_AT.getTime())
  assert.deepEqual(m.toolLog, openingToolLog())
  assert.equal(m.inputSource, undefined, '선생님 메시지 — 학습자 입력 칸 없음')

  const n = openingTx()
  await createChatWithOpening(ROW_DATA, { ja: 'どうぞ。', ko: '' }, n.run)
  assert.equal(n.log[1].data.translation, null, '빈 번역은 null')
  const none = openingTx()
  await createChatWithOpening(ROW_DATA, null, none.run)
  assert.deepEqual(none.log.map((l) => l.op), ['chat.create'])
  assert.equal(none.log[0].data.messageCount, undefined, '첫마디 없으면 기본 0(스키마 기본값)')
})

// ── 진행 값(D-4) · #29 ─────────────────────────────────────────────────────────

test('진행 값: usedIds = 학습자 말 전체에서 코드가 확인한 표현(누적·목록 순서), stepIndex 는 늘 null(코드 신호 없음 — 추정 금지)', async () => {
  const m = await material()
  assert.deepEqual(rolePlayProgress(m, []), { usedIds: [], stepIndex: null })
  assert.deepEqual(rolePlayProgress(m, ['Lサイズで', 'こんにちは']), { usedIds: ['e2'], stepIndex: null })
  assert.deepEqual(rolePlayProgress(m, ['Lサイズで', 'アイスにしてください', 'はい']), { usedIds: ['e1', 'e2'], stepIndex: null }, '선생님 말은 넣지 않는다 — 학습자 말만')
})

function viewDeps(over: Partial<RolePlayViewDeps> = {}): RolePlayViewDeps & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    readMaterial: async () => (calls.push('material'), material()),
    learnerTexts: async () => (calls.push('texts'), ['アイスにしてください']),
    readResult: async () => (calls.push('result'), null),
    pendingCorrections: async () => (calls.push('pending'), 2),
    ...over,
  }
}

const END_RESULT: ScenarioEndResult = {
  replayed: false,
  chatId: 'chat_rp',
  scenarioId: 'scn_seed',
  studyLogId: 'log1',
  repetitionItemId: 'rep1',
  outcome: 'ACHIEVED',
  goalAchieved: true,
  tutorGoalAchieved: true,
  codeRulePassed: true,
  communicationSuccess: true,
  judged: true,
  expressions: { usedIds: ['e1'], missedIds: ['e2'], verifiedIds: ['e1'], required: 1, total: 2 },
  turns: 3,
  hintsUsed: 1,
  selfCorrections: 0,
}

test('#29 chat.scenario: 진행 중 → 상황 칸 + progress + ended null(교정 수 안 읽음) · 마친 대화 → ResultView(교정 대기 수·endedAt) · 상황 없음 → null', async () => {
  const ref = { id: 'chat_rp', createdAt: CHAT_AT, scenarioId: 'scn_seed', lessonId: null }
  const open = viewDeps()
  const v = await rolePlayChatView(U, ref, open)
  assert.ok(v)
  assert.deepEqual([v.id, v.title, v.goalKo, v.requiredExpressions, v.ended], ['scn_seed', '사이즈 바꿔 주문하기', '음료 크기를 바꿔 주문하기', 1, null])
  assert.deepEqual(v.steps, [{ ko: '인사' }, { ko: '주문' }, { ko: '계산' }])
  assert.deepEqual(v.keyExpressions.map((e) => e.id), ['e1', 'e2'])
  assert.deepEqual(v.progress, { usedIds: ['e1'], stepIndex: null })
  assert.ok(!open.calls.includes('pending'))

  const ended = viewDeps({ readResult: async () => ({ ...END_RESULT, replayed: true, endedAt: new Date('2026-10-07T01:20:00Z') }) })
  const e = await rolePlayChatView(U, ref, ended)
  assert.deepEqual([e?.ended?.outcome, e?.ended?.replayed, e?.ended?.pendingCorrections, e?.ended?.endedAt], ['ACHIEVED', true, 2, '2026-10-07T01:20:00.000Z'])
  assert.deepEqual(e?.ended?.expressions.usedIds, ['e1'])

  assert.equal(await rolePlayChatView(U, ref, viewDeps({ readMaterial: async () => null })), null)
})

test('#29 조합(chatRolePlayView): 대화는 (id, userId) 로만 찾는다 — 남의 대화·일반 TALK·CHAT·형식 틀린 id 는 null(상황 재료 읽기 0)', async () => {
  const wheres: unknown[] = []
  const rows = [
    { id: 'chat_rp', userId: U, kind: 'TALK', scenarioId: 'scn_seed', lessonId: 'les_1', createdAt: CHAT_AT },
    { id: 'chat_plain', userId: U, kind: 'TALK', scenarioId: null, lessonId: null, createdAt: CHAT_AT },
    { id: 'chat_text', userId: U, kind: 'CHAT', scenarioId: 'scn_seed', lessonId: null, createdAt: CHAT_AT },
  ]
  const db = {
    chat: {
      findFirst: async (a: { where: { id: string; userId: string } }) => (wheres.push(a.where), rows.find((r) => r.id === a.where.id && r.userId === a.where.userId) ?? null),
    },
  } as unknown as Pick<Tx, 'chat'>
  const vd = viewDeps()
  const v = await chatRolePlayView(U, 'chat_rp', vd, db)
  assert.deepEqual([v?.id, v?.lessonId], ['scn_seed', 'les_1'])
  assert.deepEqual(wheres[0], { id: 'chat_rp', userId: U }, '소유 조건이 조회 where 에 있다')
  vd.calls.length = 0
  assert.equal(await chatRolePlayView('cuser00000000000000other0', 'chat_rp', vd, db), null, '남의 대화')
  assert.equal(await chatRolePlayView(U, 'chat_plain', vd, db), null, '일반 TALK')
  assert.equal(await chatRolePlayView(U, 'chat_text', vd, db), null, 'CHAT 은 역할극이 아니다')
  const before = wheres.length
  assert.equal(await chatRolePlayView(U, 'x'.repeat(41), vd, db), null)
  assert.equal(wheres.length, before, '형식 틀린 id 는 쿼리 전 null')
  assert.deepEqual(vd.calls, [], '역할극이 아니면 상황 재료·학습자 말·결과를 읽지 않는다')
})

// ── 턴 수락: 끝낸 역할극 409 ────────────────────────────────────────────────────

function acceptTx(chat: Record<string, unknown>, ended: boolean) {
  const calls: { op: string; args?: unknown }[] = []
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?')
      calls.push({ op: sql.includes('`User`') ? 'lockUser' : 'lockChat', args: sql })
      return sql.includes('`User`') ? [{ id: values[0] }] : [chat]
    },
    learningObservation: { findFirst: async (args: unknown) => (calls.push({ op: 'obs.findFirst', args }), ended ? { id: 'obs1' } : null) },
    chatMessage: {
      findMany: async () => (calls.push({ op: 'msg.findMany' }), []),
      updateMany: async () => (calls.push({ op: 'msg.updateMany' }), { count: 0 }),
      create: async (args: { data: { role: string; content: string; createdAt: Date; inputSource?: string } }) => {
        calls.push({ op: `msg.create.${args.data.role}` })
        return { id: `m_${args.data.role}`, content: args.data.content, createdAt: args.data.createdAt, inputSource: args.data.inputSource ?? null }
      },
    },
    chat: { update: async () => (calls.push({ op: 'chat.update' }), {}) },
  }
  return { tx: tx as unknown as Tx, calls }
}

const TURN = { resume: false as const, text: 'アイスにしてください', inputSource: 'TEXT' as const, utteranceId: null, clientTimings: null }

test('턴 수락: 끝낸 역할극이면 잠금(사용자 → 대화) 뒤 409 ROLEPLAY_ENDED · 메시지 행 0 · 끝낸 표식 조회는 대화 생성 시각 하한', async () => {
  const chat = { id: 'chat_rp', userId: U, kind: 'TALK', level: 'N5', scenarioId: 'scn_seed', createdAt: CHAT_AT }
  const { tx, calls } = acceptTx(chat, true)
  await assert.rejects(acceptTurnTx(tx, U, 'chat_rp', TURN), expectApi('CONFLICT', 'ROLEPLAY_ENDED'))
  assert.deepEqual(calls.map((c) => c.op), ['lockUser', 'lockChat', 'obs.findFirst'])
  assert.ok(String(calls[1].args).includes('createdAt'))
  const where = (calls[2].args as { where: { occurredAt: { gte: Date }; refId: string; kind: string } }).where
  assert.deepEqual([where.refId, where.kind], ['chat_rp', 'SCENARIO_COMPLETED'])
  assert.equal(where.occurredAt.gte.getTime(), CHAT_AT.getTime() - SCENARIO_END_LOOKUP_MARGIN_MS)

  const open = acceptTx(chat, false)
  const a = await acceptTurnTx(open.tx, U, 'chat_rp', TURN)
  assert.equal(a.scenarioId, 'scn_seed')
  assert.ok(open.calls.some((c) => c.op === 'msg.create.USER') && open.calls.some((c) => c.op === 'msg.create.ASSISTANT'))

  const plain = acceptTx({ ...chat, scenarioId: null }, true)
  await acceptTurnTx(plain.tx, U, 'chat_rp', TURN)
  assert.ok(!plain.calls.some((c) => c.op === 'obs.findFirst'), '일반 TALK 는 끝낸 표식 조회 없음(턴 경로 쿼리 0 추가)')
})

// ── 턴: [상황] 헤더 · done.scenario(S7) ─────────────────────────────────────────

const TUTOR_REPLY = {
  speech: { style: 'CALM' },
  conversation: { replyJa: 'かしこまりました。サイズは？', replyKo: '알겠습니다. 사이즈는요?' },
  correction: null,
  learning: { grammarPoint: null, difficulty: 'N5' },
  endOfTopic: false,
  proposals: [],
  userKo: '아이스로 해 주세요.',
} as unknown as TutorResponse

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function runRolePlayTurn(o: { scenarioId: string | null; material?: () => Promise<ScenarioRolePlayMaterial | null>; texts?: () => Promise<string[]> }) {
  const seen = { req: null as LlmJsonRequest<TutorResponse> | null, events: [] as TurnEvent[], materialCalls: 0, textCalls: 0 }
  mock.method(turnDeps, 'precheckChat', async () => ({ kind: 'TALK', level: 'N5', scenarioId: o.scenarioId }))
  mock.method(turnDeps, 'buildLearnerHeader', async () => ({ level: 'N5' }))
  mock.method(turnDeps, 'loadRecentHistory', async () => [])
  mock.method(turnDeps, 'loadCorrectionMode', async () => 'FLUENCY')
  mock.method(turnDeps, 'loadCoachPending', async () => null)
  mock.method(turnDeps, 'loadRolePlayMaterial', async () => (seen.materialCalls++, o.material ? o.material() : material()))
  mock.method(turnDeps, 'loadRolePlayLearnerTexts', async () => (seen.textCalls++, o.texts ? o.texts() : ['アイスにしてください', 'Lサイズで']))
  mock.method(turnDeps, 'acceptTurn', async () => ({
    chatId: 'chat_rp',
    kind: 'TALK',
    level: 'N5',
    scenarioId: o.scenarioId,
    userMessage: { id: 'um_rp', content: 'Lサイズで', createdAt: new Date(), inputSource: 'TEXT' },
    assistantMessageId: 'am_rp',
    pendingSince: new Date(),
    traceId: 't_rp',
    resumed: false,
  }))
  mock.method(turnDeps, 'saveTurn', async () => ({ correction: null, proposals: [], selfCheck: null }))
  mock.method(turnDeps, 'completeJson', async (req: LlmJsonRequest<TutorResponse>) => {
    seen.req = req
    return { data: TUTOR_REPLY, connectionKey: 'k', model: 'm', elapsedMs: 5, promptChars: 10, attempts: 1, warm: 'HIT', firstDeltaMs: 2, residualViolations: [], candidates: [TUTOR_REPLY] }
  })
  try {
    const handle = await startTurn({
      userId: `u-010d-${Math.random().toString(36).slice(2, 8)}`,
      chatId: 'chat_rp',
      request: { resume: false, text: 'Lサイズで', inputSource: 'TEXT', utteranceId: null, clientTimings: null, coachRevealed: false },
    })
    await handle.subscribe((e) => seen.events.push(e))
    await handle.done
    await sleep(10)
  } finally {
    mock.restoreAll()
  }
  const done = seen.events.find((e) => e.event === 'done')?.data as Record<string, unknown> | undefined
  // `[상황]` 은 persona(--system-prompt)가 아니라 stdin 쪽(`system` + messages)에 붙는다(A1-PE talk.ts ④).
  const stdin = [seen.req?.system ?? '', ...(seen.req?.messages ?? []).map((m) => m.content)].join('\n')
  return { ...seen, done, stdin }
}

test('턴(역할극): 상황 재료 1회로 [상황] 헤더 + done.scenario 진행 값(코드 계산: 이 대화 학습자 말 누적, stepIndex null)', async (t) => {
  t.after(() => mock.restoreAll())
  const r = await runRolePlayTurn({ scenarioId: 'scn_seed' })
  assert.ok(r.done, 'done 이벤트')
  assert.deepEqual(r.done?.scenario, { usedIds: ['e1', 'e2'], stepIndex: null })
  assert.ok(r.stdin.includes('[상황]'), '역할극 경로 — [상황] 헤더')
  assert.deepEqual([r.materialCalls, r.textCalls], [1, 1], '재료는 턴당 1회(헤더·진행 값 공용), 학습자 말 1회')
})

test('턴(일반 TALK): 재료·학습자 말을 읽지 않고 done 에 scenario 칸 없음 · [상황] 없음', async (t) => {
  t.after(() => mock.restoreAll())
  const r = await runRolePlayTurn({ scenarioId: null })
  assert.ok(r.done)
  assert.equal('scenario' in (r.done ?? {}), false)
  assert.ok(!r.stdin.includes('[상황]'))
  assert.deepEqual([r.materialCalls, r.textCalls], [0, 0])
})

test('턴(역할극): 학습자 말 읽기 실패 → done.scenario 만 빠지고 턴은 끝까지 · 상황이 사라짐(재료 null) → 일반 TALK 처럼(헤더·진행 값 없음)', async (t) => {
  t.after(() => mock.restoreAll())
  const failTexts = await runRolePlayTurn({ scenarioId: 'scn_seed', texts: async () => Promise.reject(new Error('db down')) })
  assert.ok(failTexts.done, '턴은 계속')
  assert.equal('scenario' in (failTexts.done ?? {}), false)
  assert.ok(failTexts.stdin.includes('[상황]'))
  const gone = await runRolePlayTurn({ scenarioId: 'scn_gone', material: async () => null })
  assert.ok(gone.done)
  assert.equal('scenario' in (gone.done ?? {}), false)
  assert.ok(!gone.stdin.includes('[상황]'))
})

// ── #167 종료 흐름 ───────────────────────────────────────────────────────────

type Msg = { id: string; role: 'USER' | 'ASSISTANT'; content: string; status: 'DONE' | 'PENDING' | 'FAILED'; createdAt: Date; toolLog: unknown }

function finishWorld(opts: { messages?: Msg[]; ended?: boolean } = {}) {
  const t = (s: number) => new Date(CHAT_AT.getTime() + s * 1000)
  const messages: Msg[] = opts.messages ?? [
    { id: 'm0', role: 'ASSISTANT', content: 'いらっしゃいませ。ご注文は？', status: 'DONE', createdAt: t(0), toolLog: openingToolLog() },
    { id: 'm1', role: 'USER', content: 'アイスコーヒーをください', status: 'DONE', createdAt: t(10), toolLog: null },
    { id: 'm2', role: 'ASSISTANT', content: 'サイズはどうしますか？', status: 'DONE', createdAt: t(11), toolLog: { meta: { endOfTopic: false } } },
    { id: 'm3', role: 'USER', content: 'Mサイズにしてください', status: 'DONE', createdAt: t(20), toolLog: null },
    { id: 'm4', role: 'ASSISTANT', content: 'かしこまりました。', status: 'DONE', createdAt: t(21), toolLog: { meta: { endOfTopic: true } } },
  ]
  const state = { depth: 0, txCount: 0, beforeTx: [] as ((n: number) => void)[], ended: opts.ended ?? false, isEndedCalls: 0 }
  const chat = { id: 'chat_rp', userId: U, kind: 'TALK', scenarioId: 'scn_seed', lessonId: null, topicId: null, createdAt: CHAT_AT, endedAt: null as Date | null }
  const marks: { where: Record<string, unknown>; data: { endedAt: Date } }[] = []
  // 실제 DB 의 사용자 행 잠금처럼 트랜잭션을 하나씩(동시 종료 상태기계 시험 — task-048).
  let lock: Promise<unknown> = Promise.resolve()
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => (strings.join('?').includes('`User`') ? [{ id: values[0] }] : values[0] === chat.id ? [{ ...chat }] : []),
    chat: {
      updateMany: async (a: { where: { id: string; userId: string; endedAt: null }; data: { endedAt: Date } }) => {
        marks.push(a)
        const hit = a.where.id === chat.id && a.where.userId === chat.userId && a.where.endedAt === null && chat.endedAt === null
        if (hit) chat.endedAt = a.data.endedAt
        return { count: hit ? 1 : 0 }
      },
    },
    chatMessage: {
      findMany: async (a: { where: { role?: string; status?: string }; orderBy: { createdAt: 'asc' | 'desc' }[]; take: number }) => {
        let rows = messages.filter((m) => (!a.where.role || m.role === a.where.role) && (!a.where.status || m.status === a.where.status))
        rows = [...rows].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())
        if (a.orderBy?.[0]?.createdAt === 'desc') rows.reverse()
        return rows.slice(0, a.take).map((m) => ({ ...m }))
      },
      count: async () => messages.filter((m) => m.role === 'USER').length,
    },
    correction: { groupBy: async () => [{ status: 'PROPOSED', _count: { _all: 1 } }] },
  } as unknown as Tx
  const llmCalls: { depth: number; system: string; body: string }[] = []
  const ends: ScenarioEndInput[] = []
  const traces: TraceRecord[] = []
  let llm: (body: string) => Promise<LlmJsonResult<ScenarioVerdictResponse>> = async () => ({
    // 모델이 e2(Lサイズ)를 "썼다"고 주장하지만 학습자 말에 없다 → 증거 대조가 버려야 한다(L-1).
    data: { evidence: [{ id: 'e2', quote: 'Lサイズでお願いします' }], stepsReached: 3, communicationSuccess: true, goalAchieved: true },
    connectionKey: 'conn',
    model: 'm',
    elapsedMs: 1,
    promptChars: 10,
    attempts: 1,
  })
  const deps: RolePlayFinishDeps = {
    transaction: async (fn) => {
      const prev = lock
      let release = () => {}
      lock = new Promise<void>((r) => (release = r))
      await prev
      state.txCount++
      for (const f of state.beforeTx) f(state.txCount)
      state.depth++
      try {
        return await fn(tx)
      } finally {
        state.depth--
        release()
      }
    },
    readMaterial: async () => material(),
    learnerLevel: async () => 'N5',
    completeVerdict: async (req) => {
      const body = req.messages.map((m) => m.content).join('\n')
      llmCalls.push({ depth: state.depth, system: req.system ?? '', body })
      return llm(body)
    },
    isEnded: async () => (state.isEndedCalls++, state.ended),
    endRolePlay: async (_u, input) => {
      ends.push(input)
      if (state.ended) return { ...END_RESULT, replayed: true }
      state.ended = true
      return { ...END_RESULT, turns: input.turns }
    },
    readResult: async () => (state.ended ? { ...END_RESULT, replayed: true, endedAt: new Date('2026-10-07T01:30:00Z') } : null),
    pendingCorrections: async () => 1,
    trace: async (r) => {
      traces.push(r)
    },
    now: () => new Date('2026-10-07T01:25:00Z'),
  }
  return { deps, messages, state, llmCalls, ends, traces, setLlm: (f: typeof llm) => (llm = f), t, chat, marks }
}

test('종료: 판정 LLM 은 트랜잭션 밖(잠금 없음)에서 한 번 → 증거 대조 결과만 기록 tx 에 넘김(L-1) · 첫마디 포함 대화 · endedBy/endOfTopic', async () => {
  const w = finishWorld()
  const view = await finishRolePlay(U, 'chat_rp', w.deps)
  assert.equal(w.llmCalls.length, 1)
  assert.equal(w.llmCalls[0].depth, 0, '판정 호출 중에는 열린 트랜잭션(사용자 행 잠금)이 없다')
  assert.equal(w.state.txCount, 2, '스냅샷 tx + 기록 tx')
  assert.ok(w.llmCalls[0].body.includes('선생님: いらっしゃいませ'), '첫마디(서버 저장 선생님 말)도 판정 대화에 들어간다')
  assert.ok(w.llmCalls[0].body.includes('[종료] 선생님이 마무리했음'), '마지막 선생님 말이 endOfTopic 이면 TUTOR')
  assert.equal(w.ends.length, 1)
  const verdict = w.ends[0].verdict as { usedExpressionIds: string[]; missedExpressionIds: string[]; goalAchieved: boolean; rejectedClaims: { id: string }[] }
  assert.deepEqual(verdict.usedExpressionIds, ['e1'], '코드 확인(e1)만 — 모델이 주장한 e2 는 학습자 말에 없어 버려짐')
  assert.deepEqual(verdict.missedExpressionIds, ['e2'])
  assert.deepEqual(verdict.rejectedClaims.map((c) => c.id), ['e2'])
  assert.equal(w.ends[0].endOfTopic, true)
  assert.deepEqual([w.ends[0].turns, w.ends[0].learnerTexts.length], [2, 2], '첫마디는 학습자 말 수에 들지 않는다')
  assert.deepEqual([view.outcome, view.replayed, view.pendingCorrections, view.endedAt], ['ACHIEVED', false, 1, '2026-10-07T01:25:00.000Z'])
  // Trace: 수치·코드만, 학습자 말·인용 원문 없음
  assert.equal(w.traces.length, 1)
  const raw = JSON.stringify(w.traces[0])
  for (const s of ['アイスコーヒー', 'Mサイズ', 'Lサイズでお願いします', 'いらっしゃいませ']) assert.ok(!raw.includes(s), `Trace 에 원문 없음: ${s}`)
  const step = w.traces[0].steps.find((s) => s.name === 'SCENARIO_VERDICT')
  assert.deepEqual([step?.rejectedNoQuote, step?.stepsReached, step?.used], [1, 3, 1], 'stepsReached 는 단계 수(3)로 자른 값')
})

test('종료: 선생님 답 진행 중(살아 있는 PENDING) 409 TURN_RUNNING · 학습자 말 0 409 NO_TURNS — 둘 다 판정 LLM 0·기록 0', async () => {
  const w = finishWorld()
  w.messages.push({ id: 'm5', role: 'USER', content: 'ありがとう', status: 'DONE', createdAt: w.t(30), toolLog: null }, { id: 'm6', role: 'ASSISTANT', content: '', status: 'PENDING', createdAt: new Date(), toolLog: null })
  await assert.rejects(finishRolePlay(U, 'chat_rp', w.deps), expectApi('CONFLICT', 'TURN_RUNNING'))
  assert.deepEqual([w.llmCalls.length, w.ends.length], [0, 0])

  const empty = finishWorld({ messages: [{ id: 'm0', role: 'ASSISTANT', content: 'いらっしゃいませ。', status: 'DONE', createdAt: CHAT_AT, toolLog: openingToolLog() }] })
  await assert.rejects(finishRolePlay(U, 'chat_rp', empty.deps), expectApi('CONFLICT', 'NO_TURNS'))
  assert.deepEqual([empty.llmCalls.length, empty.ends.length], [0, 0], '첫마디만 있는 대화 = 0턴(D-7 그만두기는 #31)')
})

test('종료: 학습자 행은 있지만 판정에 넣을 학습자 말이 없으면 LLM 을 부르지 않고 verdict null 로 기록(NO_LEARNER_TEXT)', async () => {
  const w = finishWorld({
    messages: [
      { id: 'm0', role: 'ASSISTANT', content: 'いらっしゃいませ。', status: 'DONE', createdAt: CHAT_AT, toolLog: openingToolLog() },
      { id: 'm1', role: 'USER', content: '', status: 'DONE', createdAt: new Date(CHAT_AT.getTime() + 1000), toolLog: null },
    ],
  })
  const v = await finishRolePlay(U, 'chat_rp', w.deps)
  assert.deepEqual([w.llmCalls.length, w.ends.length, w.ends[0].verdict, w.ends[0].turns], [0, 1, null, 1])
  assert.equal(v.replayed, false)
  assert.equal(w.traces[0].steps.find((s) => s.name === 'SCENARIO_VERDICT')?.skipped, 'NO_LEARNER_TEXT')
})

test('종료: 이미 끝낸 대화 → 판정 없이 처음 결과(replayed) · 판정 실패·시간 초과 → verdict null 로 기록(코드 규칙만)', async () => {
  const done = finishWorld({ ended: true })
  const r = await finishRolePlay(U, 'chat_rp', done.deps)
  assert.deepEqual([r.replayed, r.endedAt, done.llmCalls.length, done.ends.length, done.traces.length], [true, '2026-10-07T01:30:00.000Z', 0, 0, 0])

  const fail = finishWorld()
  fail.setLlm(async () => {
    throw new ApiError('ENGINE_TIMEOUT', '시간 초과')
  })
  const v = await finishRolePlay(U, 'chat_rp', fail.deps)
  assert.equal(fail.ends[0].verdict, null, '판정 실패 → 판정 없음(달성으로 올리지 않음)')
  assert.equal(v.replayed, false)
  assert.equal(fail.traces[0].steps.find((s) => s.name === 'SCENARIO_VERDICT')?.errorCode, 'ENGINE_TIMEOUT')
})

test('종료: 판정 사이에 학습자 말이 늘면 처음부터 한 번 더(판정 2회) · 두 번째도 바뀌면 409 TURN_RUNNING(기록 0)', async () => {
  const once = finishWorld()
  once.state.beforeTx.push((n) => {
    if (n === 2) once.messages.push({ id: 'm9', role: 'USER', content: 'Lサイズにしてください', status: 'DONE', createdAt: once.t(40), toolLog: null })
  })
  await finishRolePlay(U, 'chat_rp', once.deps)
  assert.deepEqual([once.llmCalls.length, once.ends.length, once.ends[0].turns], [2, 1, 3], '다시 읽은 대화로 다시 판정해 기록')

  const twice = finishWorld()
  twice.state.beforeTx.push((n) => {
    if (n === 2 || n === 4) twice.messages.push({ id: `m${n}x`, role: 'USER', content: `はい${n}`, status: 'DONE', createdAt: twice.t(40 + n), toolLog: null })
  })
  await assert.rejects(finishRolePlay(U, 'chat_rp', twice.deps), expectApi('CONFLICT', 'TURN_RUNNING'))
  assert.equal(twice.ends.length, 0)

  // 판정 사이에 새 턴이 수락돼 선생님 답이 진행 중(살아 있는 PENDING)이면 기록 tx 의 재확인이 409 — 판정은 이미 1회 불렀어도 기록 0.
  const racing = finishWorld()
  racing.state.beforeTx.push((n) => {
    if (n === 2) racing.messages.push({ id: 'mP', role: 'ASSISTANT', content: '', status: 'PENDING', createdAt: new Date(), toolLog: null })
  })
  await assert.rejects(finishRolePlay(U, 'chat_rp', racing.deps), expectApi('CONFLICT', 'TURN_RUNNING'))
  assert.deepEqual([racing.llmCalls.length, racing.ends.length], [1, 0])
})

test('종료: 두 종료가 동시에 스냅샷을 통과해도(다른 요청이 그사이 기록) 기록 tx 의 learning 멱등 결과를 그대로 — replayed·처음 endedAt', async () => {
  const w = finishWorld()
  // 스냅샷(1번 tx) 뒤, 기록(2번 tx) 전에 다른 요청이 같은 대화를 끝냈다.
  w.state.beforeTx.push((n) => {
    if (n === 2) w.state.ended = true
  })
  const v = await finishRolePlay(U, 'chat_rp', w.deps)
  assert.deepEqual([w.llmCalls.length, w.ends.length], [1, 1], '판정은 이미 불렀고 기록 호출은 1회(learning 이 멱등으로 replayed)')
  assert.deepEqual([v.replayed, v.endedAt], [true, '2026-10-07T01:30:00.000Z'], 'endedAt 은 지금이 아니라 처음 기록 시각')
})

test('종료: 남의·없는 대화 404 · 형식 틀린 id 404(쿼리 전)', async () => {
  const w = finishWorld()
  await assert.rejects(finishRolePlay(U, 'chat_none', w.deps), expectApi('NOT_FOUND'))
  await assert.rejects(finishRolePlay('cuser00000000000000other0', 'chat_rp', w.deps), expectApi('NOT_FOUND'))
  const before = w.state.txCount
  await assert.rejects(finishRolePlay(U, '', w.deps), expectApi('NOT_FOUND'))
  assert.equal(w.state.txCount, before)
})

// ── 진행 중 후보(#161·#162 inProgressChatId) ──────────────────────────────────

test('진행 중 후보: 사용자·TALK·상황 in 조건, lastMessageAt 순, 상황마다 ≤3, 생성 시각 함께', async () => {
  const seen: unknown[] = []
  const rows = [
    ...Array.from({ length: 5 }, (_, i) => ({ id: `ca${i}`, scenarioId: 'scn_a', lastMessageAt: new Date(2026, 9, 7, 10 - i), createdAt: CHAT_AT })),
    { id: 'cb0', scenarioId: 'scn_b', lastMessageAt: null, createdAt: CHAT_AT },
  ]
  const db = { chat: { findMany: async (a: { take: number }) => (seen.push(a), rows.slice(0, a.take)) } } as unknown as Pick<Tx, 'chat'>
  const now = new Date('2026-10-07T12:00:00Z')
  const out = await listOpenRolePlayChats(U, ['scn_a', 'scn_b', 'scn_a', ''], db, now)
  const args = seen[0] as { where: unknown; take: number; orderBy: unknown }
  // 30일 넘게 말이 없던 역할극은 후보 아님(REV-140 L-4 — 카탈로그 끝낸 표식 창이 방치 대화로 늘지 않게).
  // 사용자가 마친 역할극(Chat.endedAt 있음)은 후보에서 바로 뺀다(task-048).
  assert.deepEqual(args.where, { userId: U, kind: 'TALK', scenarioId: { in: ['scn_a', 'scn_b'] }, endedAt: null, lastMessageAt: { gte: new Date(now.getTime() - OPEN_ROLE_PLAY_MAX_AGE_DAYS * 86_400_000) } })
  assert.equal(args.take, OPEN_ROLE_PLAY_MAX)
  assert.deepEqual(out.map((o) => o.chatId), ['ca0', 'ca1', 'ca2', 'cb0'])
  assert.equal(out[3].at.getTime(), CHAT_AT.getTime(), 'lastMessageAt 이 없으면 생성 시각')
  assert.ok(out.every((o) => o.createdAt instanceof Date))
  assert.deepEqual(await listOpenRolePlayChats(U, [], db), [])
})

test('진행 중 후보: 한 상황의 최근 대화가 많아도 다른 상황의 대화가 창에서 밀려나지 않는다(읽는 행 수는 상황 수와 무관)', async () => {
  // DB 처럼 take 를 지키는 가짜 — scn_a 대화 10개가 scn_b 대화보다 모두 최근.
  const rows = [
    ...Array.from({ length: 10 }, (_, i) => ({ id: `ca${i}`, scenarioId: 'scn_a', lastMessageAt: new Date(2026, 9, 7, 20 - i), createdAt: CHAT_AT })),
    { id: 'cb0', scenarioId: 'scn_b', lastMessageAt: new Date(2026, 9, 6, 9), createdAt: CHAT_AT },
  ]
  const db = { chat: { findMany: async (a: { take: number }) => rows.slice(0, a.take) } } as unknown as Pick<Tx, 'chat'>
  const out = await listOpenRolePlayChats(U, ['scn_a', 'scn_b'], db)
  assert.deepEqual(out.map((o) => o.chatId), ['ca0', 'ca1', 'ca2', 'cb0'], 'scn_b 의 진행 중 대화가 후보에 남는다')
})

// ── L-7② 구조 고정: 역할극 대화의 표현 점검·ADD_STUDY_LOG 이중 집계 경로 0 ──────────────

test('L-7②: 역할극은 TALK 만 · 표현 점검(A3)은 CHAT 만 · ADD_STUDY_LOG 를 만드는 곳은 점검 하나 → 역할극 대화의 이중 집계 경로가 없다', async () => {
  const d = createDeps(null)
  await assert.rejects(createRolePlayChat(U, { kind: 'CHAT', title: null, level: null, topicId: null, scenarioId: 'scn_seed', lessonId: null }, d.d), expectApi('VALIDATION'))
  const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
  assert.ok(src('src/modules/conversation/review/index.ts').includes("if (chat.kind !== 'CHAT') throw"), 'claimReview 가 CHAT 외 대화를 거절')
  const creators = ['src/modules/conversation/review/index.ts', 'src/modules/conversation/orchestrator/index.ts', 'src/modules/conversation/proposals/index.ts'].filter((p) =>
    /tutorProposal\.create\(\{[\s\S]{0,200}kind: 'ADD_STUDY_LOG'/.test(src(p)),
  )
  assert.deepEqual(creators, ['src/modules/conversation/review/index.ts'], 'ADD_STUDY_LOG 생성은 점검 경로뿐')
})

test('L-7②(행동): 역할극 대화(TALK)로 표현 점검 #33(reviewChat)을 부르면 잠금(사용자 → 대화) 뒤 400 kind — 잡·메시지 읽기 0', async (t) => {
  const calls: string[] = []
  const fakeTx = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      if (strings.join('?').includes('`User`')) {
        calls.push('lockUser')
        return [{ id: values[0] }]
      }
      calls.push('lockChat')
      return [{ id: 'chat_rp', userId: U, kind: 'TALK', level: 'N5', messageCount: 5, reviewedAt: null }]
    },
    chatMessage: { findMany: async () => (calls.push('msg.findMany'), []) },
    job: { findFirst: async () => (calls.push('job.findFirst'), null) },
  }
  // PrismaClient 의 $transaction 은 Proxy 뒤라 mock.method 가 메서드로 못 찾는다 — 직접 바꿔 끼우고 시험 끝에 되돌린다(DB 접속 0).
  const client = prisma as unknown as Record<string, unknown>
  const original = client.$transaction
  client.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn(fakeTx)
  t.after(() => {
    client.$transaction = original
  })
  await assert.rejects(reviewChat(U, 'chat_rp'), (e: unknown) => {
    assert.ok(e instanceof ApiError)
    assert.deepEqual([e.code, e.details?.reason], ['VALIDATION', 'kind'])
    return true
  })
  assert.deepEqual(calls, ['lockUser', 'lockChat'], '점검 잡·메시지를 읽기 전에 거절')
})

// ── A3b-2 하드닝(REV-140 L-3) ───────────────────────────────────────────────

test('종료(L-3): 기록 tx 는 tx2 에서 다시 읽은 재료(교정 수)로 기록한다 — 판정 사이 교정이 채택·추가돼도 tx1 의 낡은 값이 아니다', async () => {
  const w = finishWorld()
  const base = w.deps.transaction
  const fresh = { groupBy: async () => [{ status: 'PROPOSED', _count: { _all: 1 } }, { status: 'ACCEPTED', _count: { _all: 2 } }, { status: 'REJECTED', _count: { _all: 1 } }] }
  w.deps.transaction = <T,>(fn: (tx: Tx) => Promise<T>) => base<T>((tx) => fn(w.state.txCount >= 2 ? ({ ...(tx as object), correction: fresh } as unknown as Tx) : tx))
  const r = await finishRolePlay(U, 'chat_rp', w.deps)
  assert.equal(r.replayed, false)
  assert.equal(w.ends.length, 1)
  assert.deepEqual(w.ends[0].corrections, { proposed: 4, accepted: 2, ignored: 1 }, 'tx1 값은 proposed 1 · accepted 0')
})

// ── task-048: Chat.endedAt — 사용자 [마치기] 표식(잠근 행 우선, 관측은 2차 방어) ─────────────

const FINISH_NOW = '2026-10-07T01:25:00.000Z' // finishWorld deps.now
const OBS_AT = '2026-10-07T01:30:00.000Z' // finishWorld readResult(관측 시각)

test('task-048 ①: 처음 종료는 같은 tx 에서 Chat.endedAt = now(비어 있는 행만) · 응답 endedAt = 저장 값 · 다시 마치면 관측 판정 없이 replayed·같은 endedAt', async () => {
  const w = finishWorld()
  const first = await finishRolePlay(U, 'chat_rp', w.deps)
  assert.equal(first.replayed, false)
  assert.equal(w.marks.length, 1)
  assert.deepEqual(w.marks[0].where, { id: 'chat_rp', userId: U, endedAt: null }, '덮어쓰지 않는다(비어 있는 행만)')
  assert.equal(w.chat.endedAt?.toISOString(), FINISH_NOW, '관측 occurredAt 과 같은 now')
  assert.equal(first.endedAt, FINISH_NOW, '첫 응답 endedAt = 저장 값')
  const isEndedBefore = w.state.isEndedCalls
  const again = await finishRolePlay(U, 'chat_rp', w.deps)
  assert.deepEqual([again.replayed, again.endedAt], [true, FINISH_NOW], `재시도 응답도 저장 값(관측 시각 ${OBS_AT} 이 아니라)`)
  assert.equal(w.state.isEndedCalls, isEndedBefore, '잠근 행에 표식이 있으면 관측 판정을 부르지 않는다')
  assert.deepEqual([w.ends.length, w.llmCalls.length, w.marks.length], [1, 1, 1], '두 번째 종료는 기록·판정·표식 쓰기 0')
})

test('task-048 ②: 시계 어긋남 모의(Chat.createdAt = 표식 시각 + 2일·+8일, 7일 창 안·밖) — 턴 409 ROLEPLAY_ENDED(관측 조회 0)·두 번째 종료 replayed(기록·판정 0)', async () => {
  const day = 86_400_000
  const markedAt = new Date(FINISH_NOW)
  for (const skew of [2, 8]) {
    const createdAt = new Date(markedAt.getTime() + skew * day)
    // 관측 가짜는 "못 찾음" — 창 밖 어긋남에서 관측 기반 판정이 놓치는 상황. 그래도 끝남이어야 한다.
    const turn = acceptTx({ id: 'chat_rp', userId: U, kind: 'TALK', level: 'N5', scenarioId: 'scn_seed', createdAt, endedAt: markedAt }, false)
    await assert.rejects(acceptTurnTx(turn.tx, U, 'chat_rp', TURN), expectApi('CONFLICT', 'ROLEPLAY_ENDED'))
    assert.deepEqual(turn.calls.map((c) => c.op), ['lockUser', 'lockChat'], `+${skew}일: 관측 조회·메시지 행 0`)
    assert.ok(String(turn.calls[1].args).includes('endedAt'), '잠근 행에서 endedAt 을 같이 읽는다')

    const w = finishWorld()
    w.chat.createdAt = createdAt
    w.chat.endedAt = markedAt
    const seen: { endedAt?: Date | null }[] = []
    w.deps.readResult = async (_u, c) => (seen.push(c), { ...END_RESULT, replayed: true, endedAt: new Date(OBS_AT) })
    const r = await finishRolePlay(U, 'chat_rp', w.deps)
    assert.deepEqual([r.replayed, r.endedAt], [true, FINISH_NOW], `+${skew}일`)
    assert.deepEqual([w.ends.length, w.llmCalls.length, w.marks.length, w.state.isEndedCalls], [0, 0, 0, 0], `+${skew}일: 기록·판정·표식·관측 판정 0`)
    assert.equal(seen[0].endedAt?.getTime(), markedAt.getTime(), '결과 읽기에 표식 시각을 넘긴다(관측 창 하한)')
  }
})

test('task-048 ③: endedAt NULL 인 옛 행은 관측 기반 판정(2차 방어)으로 계속 — 턴 409·재종료 replayed(옛 행에 표식을 쓰지 않음) · 드라이버가 글로 준 endedAt 도 끝남', async () => {
  const legacy = acceptTx({ id: 'chat_rp', userId: U, kind: 'TALK', level: 'N5', scenarioId: 'scn_seed', createdAt: CHAT_AT, endedAt: null }, true)
  await assert.rejects(acceptTurnTx(legacy.tx, U, 'chat_rp', TURN), expectApi('CONFLICT', 'ROLEPLAY_ENDED'))
  assert.deepEqual(legacy.calls.map((c) => c.op), ['lockUser', 'lockChat', 'obs.findFirst'])
  const asText = acceptTx({ id: 'chat_rp', userId: U, kind: 'TALK', level: 'N5', scenarioId: 'scn_seed', createdAt: CHAT_AT, endedAt: FINISH_NOW }, false)
  await assert.rejects(acceptTurnTx(asText.tx, U, 'chat_rp', TURN), expectApi('CONFLICT', 'ROLEPLAY_ENDED'))
  assert.equal(asText.calls.some((c) => c.op === 'obs.findFirst'), false)
  const open = acceptTx({ id: 'chat_rp', userId: U, kind: 'TALK', level: 'N5', scenarioId: 'scn_seed', createdAt: CHAT_AT, endedAt: null }, false)
  assert.equal((await acceptTurnTx(open.tx, U, 'chat_rp', TURN)).scenarioId, 'scn_seed', '표식·관측 둘 다 없으면 턴을 받는다')

  const w = finishWorld({ ended: true })
  const r = await finishRolePlay(U, 'chat_rp', w.deps)
  assert.deepEqual([r.replayed, r.endedAt, w.state.isEndedCalls, w.ends.length, w.marks.length], [true, OBS_AT, 1, 0, 0], '옛 행: 관측 시각 · 지연 백필 없음')
})

test('task-048 ④: 동시 종료 상태기계 — 두 요청을 함께 보내도 처음 기록·표식은 1회, 두 응답의 endedAt 이 같다(저장 값) · 스냅샷 뒤 다른 요청이 표식을 쓰면 그 값', async () => {
  const w = finishWorld()
  const [a, b] = await Promise.all([finishRolePlay(U, 'chat_rp', w.deps), finishRolePlay(U, 'chat_rp', w.deps)])
  assert.deepEqual([a.replayed, b.replayed].sort(), [false, true])
  assert.deepEqual([a.endedAt, b.endedAt], [FINISH_NOW, FINISH_NOW])
  assert.equal(w.chat.endedAt?.toISOString(), FINISH_NOW)
  assert.equal(w.marks.length, 1, '표식 쓰기 1회')
  assert.equal(w.ends.filter((e) => !e.chatEndedAt).length, 1, '표식 없이 learning 을 부른 것은 처음 요청 하나(나머지는 잠근 행 표식을 넘겨 쓰지 않게)')

  const x = finishWorld()
  const other = new Date('2026-10-07T01:24:00Z')
  x.state.beforeTx.push((n) => {
    if (n === 2) {
      x.chat.endedAt = other
      x.state.ended = true
    }
  })
  const v = await finishRolePlay(U, 'chat_rp', x.deps)
  assert.deepEqual([v.replayed, v.endedAt, x.marks.length], [true, other.toISOString(), 0], '처음 기록한 요청의 저장 값 — 지금·관측 시각 아님')
  assert.equal(x.ends[0].chatEndedAt?.getTime(), other.getTime(), 'learning 에 잠근 행의 표식을 넘긴다')
})

test('task-048 #29: 결과 endedAt 은 Chat.endedAt 이 먼저 · 결과 읽기에 표식을 넘긴다 · 옛 행은 관측 시각', async () => {
  const markedAt = new Date(FINISH_NOW)
  const seen: { endedAt?: Date | null }[] = []
  const vd = viewDeps({ readResult: async (_u, c) => (seen.push(c), { ...END_RESULT, replayed: true, endedAt: new Date(OBS_AT) }) })
  const v = await rolePlayChatView(U, { id: 'chat_rp', createdAt: CHAT_AT, scenarioId: 'scn_seed', lessonId: null, endedAt: markedAt }, vd)
  assert.equal(v?.ended?.endedAt, FINISH_NOW)
  assert.equal(seen[0].endedAt?.getTime(), markedAt.getTime())
  const legacy = await rolePlayChatView(U, { id: 'chat_rp', createdAt: CHAT_AT, scenarioId: 'scn_seed', lessonId: null }, vd)
  assert.equal(legacy?.ended?.endedAt, OBS_AT)
  const selects: unknown[] = []
  const db = { chat: { findFirst: async (a: { select: unknown }) => (selects.push(a.select), { id: 'chat_rp', kind: 'TALK', scenarioId: 'scn_seed', lessonId: null, createdAt: CHAT_AT, endedAt: markedAt }) } } as unknown as Pick<Tx, 'chat'>
  const c = await chatRolePlayView(U, 'chat_rp', vd, db)
  assert.equal(c?.ended?.endedAt, FINISH_NOW)
  assert.equal((selects[0] as { endedAt?: boolean }).endedAt, true)
})
