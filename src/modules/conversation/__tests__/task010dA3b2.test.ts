/**
 * task-010d A3b-2 — #166 AI 상황 초안 · #169 대답 연습 · #27 목록 역할극 칸 · 태스크 등록. (#29 예열 생략은 `app/api/v1/chats/_lib/__tests__/chatDetail.test.ts` — speech 를 import 하는 라우트 조합이라 conversation 시험에 둘 수 없다.)
 * DB·엔진 0: 서비스는 가짜 deps, 모델 응답은 PE 픽스처(`tests/prompts/fixtures/{scenario-draft,reply-practice}.json`).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError } from '@/modules/infra'
import { isLlmTask, LLM_TASKS, type LlmJsonRequest, type LlmJsonResult, type TraceRecord } from '@/modules/engine'
import { endedScenarioRolePlayChatIds, normalizeScenarioInput, readScenarioRolePlayMaterial, SCENARIO_END_LOOKUP_MARGIN_MS, type ScenarioMaterialDb, type ScenarioRolePlayMaterial } from '@/modules/learning'
import { REPLY_PRACTICE_TASK } from '../prompts/replyPractice'
import { SCENARIO_DRAFT_TASK } from '../prompts/scenarioDraft'
import type { ReplyPracticeModel } from '../structuredResponse/replyPractice'
import type { ScenarioDraftResponse } from '../structuredResponse/scenarioDraft'
import { parseReplyPracticeBody, suggestReply, type PracticeMessageRow, type ReplyPracticeDeps } from '../chats/replyPractice'
import { draftScenario, parseScenarioDraftBody, type ScenarioDraftDeps } from '../chats/scenarioDraft'
import { rolePlayListBadges } from '../chats/rolePlay'

const U = 'cuser0000000000000000a3b2'
const CHAT_AT = new Date('2026-10-07T01:00:00Z')
const FIX = join(process.cwd(), 'tests/prompts/fixtures')
const DRAFT_FIX = JSON.parse(readFileSync(join(FIX, 'scenario-draft.json'), 'utf8')) as { modelResponses: Record<string, ScenarioDraftResponse> }
const REPLY_FIX = JSON.parse(readFileSync(join(FIX, 'reply-practice.json'), 'utf8')) as { modelResponses: Record<string, ReplyPracticeModel> }

async function rejects(p: Promise<unknown>, code: string, reason?: string, status?: number): Promise<ApiError> {
  try {
    await p
  } catch (e) {
    assert.ok(e instanceof ApiError, `ApiError 여야 함: ${String(e)}`)
    assert.equal(e.code, code)
    if (reason !== undefined) assert.equal(e.details?.reason, reason)
    if (status !== undefined) assert.equal({ ENGINE_ERROR: 502, ENGINE_TIMEOUT: 504, UNPROCESSABLE: 422 }[e.code as string], status)
    return e
  }
  assert.fail(`${code} 오류가 나야 함`)
}

function throwsApi(fn: () => unknown, field: string, reason: string): void {
  try {
    fn()
  } catch (e) {
    assert.ok(e instanceof ApiError)
    assert.equal(e.code, 'VALIDATION')
    assert.equal(e.details?.field, field)
    assert.equal(e.details?.reason, reason)
    return
  }
  assert.fail(`400 ${field}/${reason}`)
}

const llmResult = <T>(data: T): LlmJsonResult<T> => ({ data, connectionKey: 'conn', model: 'm', elapsedMs: 1, promptChars: 100, attempts: 1 })
const named = (name: string) => Object.assign(new Error('x'), { name })

// ── 태스크 등록 ─────────────────────────────────────────────────────────────

test('LLM_TASKS: scenarioDraft = balanced·40s·interactive · replyPractice = fast·12s·interactive · 둘 다 재시도 없음 · 빌더의 task 이름이 등록돼 있다', () => {
  assert.deepEqual(LLM_TASKS.scenarioDraft, { tier: 'balanced', timeoutMs: 40_000, lane: 'interactive' })
  assert.deepEqual(LLM_TASKS.replyPractice, { tier: 'fast', timeoutMs: 12_000, lane: 'interactive' })
  assert.ok(isLlmTask(SCENARIO_DRAFT_TASK) && isLlmTask(REPLY_PRACTICE_TASK))
})

// ── #169 대답 연습 ───────────────────────────────────────────────────────────

const SCENARIO_ROW = {
  id: 'scn_seed',
  title: '카페에서 주문하기',
  titleJa: 'カフェで注文する',
  level: 'N5',
  status: 'ACTIVE',
  roles: { learner: '손님', tutor: '점원' },
  goal: { communicativeGoalKo: '음료를 사이즈까지 정해 주문한다', successCriteria: ['음료 이름'] },
  constraints: { steps: [{ ko: '음료 말하기' }, { ko: '사이즈 말하기' }], opening: { ja: 'いらっしゃいませ。ご注文は？', ko: '어서 오세요' } },
  keyExpressions: [
    { id: 'e1', ja: 'アイスコーヒーをください', ko: '아이스커피 주세요', match: 'アイスコーヒー' },
    { id: 'e2', ja: 'Lサイズでお願いします', ko: 'L 사이즈로 부탁해요', match: 'Lサイズ' },
    { id: 'e3', ja: '持ち帰りでお願いします', ko: '포장으로 부탁해요', match: '持ち帰り' },
  ],
  completionRule: { requiredExpressions: 2 },
}

async function material(): Promise<ScenarioRolePlayMaterial> {
  const db = { scenario: { findFirst: async () => SCENARIO_ROW }, topicChunk: { findMany: async () => [] } } as unknown as ScenarioMaterialDb
  return (await readScenarioRolePlayMaterial(U, 'scn_seed', db))!
}

const at = (s: number) => new Date(CHAT_AT.getTime() + s * 1000)
/** 새것부터(desc) — 실제 `recentMessages` 와 같은 순서. */
function convo(): PracticeMessageRow[] {
  return [
    { id: 'm4', role: 'ASSISTANT', status: 'DONE', content: 'サイズはどうしますか？', createdAt: at(21) },
    { id: 'm3', role: 'USER', status: 'DONE', content: 'アイスコーヒーをください', createdAt: at(20) },
    { id: 'm2', role: 'ASSISTANT', status: 'FAILED', content: '', createdAt: at(15) },
    { id: 'm1', role: 'USER', status: 'DONE', content: 'こんにちは', createdAt: at(10) },
    { id: 'm0', role: 'ASSISTANT', status: 'DONE', content: 'いらっしゃいませ。ご注文は？', createdAt: at(0) },
  ]
}

function practiceWorld(over: Partial<ReplyPracticeDeps> & { rows?: PracticeMessageRow[]; chat?: Record<string, unknown> | null } = {}) {
  const calls: string[] = []
  const reqs: LlmJsonRequest<ReplyPracticeModel>[] = []
  const traces: TraceRecord[] = []
  const chat = over.chat === undefined ? { id: 'chat_rp', kind: 'TALK', level: 'N4', scenarioId: 'scn_seed', createdAt: CHAT_AT } : over.chat
  const deps: ReplyPracticeDeps = {
    readChat: async (userId, chatId) => (calls.push('chat'), userId === U && chat && chatId === chat.id ? (chat as never) : null),
    recentMessages: async () => (calls.push('messages'), (over.rows ?? convo()).map((r) => ({ ...r }))),
    turnLocked: () => false,
    isEnded: async (_u, c) => (calls.push(`ended:${c.createdAt.toISOString()}`), false),
    readMaterial: async () => (calls.push('material'), material()),
    learnerTexts: async () => (calls.push('texts'), ['アイスコーヒーをください']),
    learnerLevel: async () => (calls.push('profile'), 'N5'),
    complete: async (req) => (calls.push('llm'), reqs.push(req), llmResult(REPLY_FIX.modelResponses.good)),
    trace: async (t) => void traces.push(t),
    ...over,
  }
  return { deps, calls, reqs, traces }
}

test('#169 정상: 마지막 DONE 선생님 말에 대답 제안 — 저장 없음 · 수준 = 대화 수준 · 안 쓴 표현부터 · 그 말 앞 끝난 대화만 · 응답 = {messageId, ja, ko, 고르기 세트}', async () => {
  const w = practiceWorld()
  const r = await suggestReply(U, 'chat_rp', 'm4', w.deps)
  assert.equal(r.messageId, 'm4')
  assert.equal(r.ja, REPLY_FIX.modelResponses.good.ja)
  assert.ok(r.choices && r.choices.length === 3 && r.blank && typeof r.answerIndex === 'number')
  assert.equal(Array.from(r.ja).slice(r.blank.start, r.blank.end).join(''), r.choices[r.answerIndex!])
  assert.equal(w.reqs.length, 1)
  assert.equal(w.reqs[0].task, 'replyPractice')
  assert.ok(typeof w.reqs[0].traceId === 'string' && w.reqs[0].traceId.length > 0)
  const body = w.reqs[0].messages.map((m) => m.content).join('\n')
  assert.ok(body.includes('サイズはどうしますか'), '마지막 선생님 말')
  assert.ok(body.indexOf('Lサイズでお願いします') < body.indexOf('アイスコーヒーをください'), '아직 안 쓴 표현(e2)이 쓴 표현(e1)보다 앞')
  assert.ok(body.includes('N4'), '대화 수준(턴 헤더와 같은 값)')
  assert.ok(!w.calls.includes('profile'), '대화 수준이 있으면 프로필을 읽지 않는다')
  assert.ok(w.calls.includes(`ended:${CHAT_AT.toISOString()}`), '끝낸 표식 조회는 대화 생성 시각 하한')
  // 저장 경로가 deps 에 아예 없다 — 쓰기 0. Trace 는 수치·코드만.
  const t = JSON.stringify(w.traces)
  for (const text of ['サイズはどうしますか', 'アイスコーヒー', REPLY_FIX.modelResponses.good.ja, REPLY_FIX.modelResponses.good.hintKo]) assert.ok(!t.includes(text), `Trace 원문 없음: ${text}`)
  assert.equal(w.traces[0].refType, 'replyPractice')
  assert.equal(w.traces[0].steps[0].name, 'REPLY_PRACTICE')
})

test('#169 대화 수준이 없으면 프로필 수준', async () => {
  const w = practiceWorld({ chat: { id: 'chat_rp', kind: 'TALK', level: null, scenarioId: 'scn_seed', createdAt: CHAT_AT } })
  await suggestReply(U, 'chat_rp', 'm4', w.deps)
  assert.ok(w.calls.includes('profile'))
})

test('#169 404: 남의 대화·없는 대화·일반 TALK·CHAT·상황 행이 사라진 대화·형식 틀린 id — LLM 0', async () => {
  for (const [label, chat, chatId] of [
    ['남의/없는 대화', undefined, 'chat_other'],
    ['일반 TALK', { id: 'chat_rp', kind: 'TALK', level: 'N5', scenarioId: null, createdAt: CHAT_AT }, 'chat_rp'],
    ['CHAT', { id: 'chat_rp', kind: 'CHAT', level: 'N5', scenarioId: 'scn_seed', createdAt: CHAT_AT }, 'chat_rp'],
  ] as const) {
    const w = practiceWorld(chat ? { chat } : {})
    await rejects(suggestReply(U, chatId, 'm4', w.deps), 'NOT_FOUND')
    assert.ok(!w.calls.includes('llm'), label)
  }
  const gone = practiceWorld({ readMaterial: async () => null })
  await rejects(suggestReply(U, 'chat_rp', 'm4', gone.deps), 'NOT_FOUND')
  assert.ok(!gone.calls.includes('llm'))
  const bad = practiceWorld()
  await rejects(suggestReply(U, 'x'.repeat(41), 'm4', bad.deps), 'NOT_FOUND')
  assert.deepEqual(bad.calls, [], '형식 틀린 id 는 쿼리 전 404')
  await rejects(suggestReply('cuser_other', 'chat_rp', 'm4', practiceWorld().deps), 'NOT_FOUND')
})

test('#169 409 ENDED: 마친 역할극 — LLM 0', async () => {
  const w = practiceWorld({ isEnded: async () => true })
  await rejects(suggestReply(U, 'chat_rp', 'm4', w.deps), 'CONFLICT', 'ENDED')
  assert.ok(!w.calls.includes('llm'))
})

test('#169 409 TURN_RUNNING: 살아 있는 PENDING 선생님 행 · 수락 커밋 전 메모리 락 — 180초 넘은 죽은 PENDING 은 진행 중 아님(→ NOT_LATEST)', async () => {
  const live: PracticeMessageRow = { id: 'm5', role: 'ASSISTANT', status: 'PENDING', content: '', createdAt: new Date() }
  const w1 = practiceWorld({ rows: [live, ...convo()] })
  await rejects(suggestReply(U, 'chat_rp', 'm4', w1.deps), 'CONFLICT', 'TURN_RUNNING')
  const w2 = practiceWorld({ turnLocked: () => true })
  await rejects(suggestReply(U, 'chat_rp', 'm4', w2.deps), 'CONFLICT', 'TURN_RUNNING')
  const dead: PracticeMessageRow = { ...live, createdAt: new Date(Date.now() - 10 * 60_000) }
  const w3 = practiceWorld({ rows: [dead, ...convo()] })
  await rejects(suggestReply(U, 'chat_rp', 'm4', w3.deps), 'CONFLICT', 'NOT_LATEST')
  for (const w of [w1, w2, w3]) assert.ok(!w.calls.includes('llm'))
})

test('#169 409 NOT_LATEST: 마지막 메시지가 아닌 선생님 말 · 마지막이 학습자 말 · 마지막 선생님 말이 실패 · 없는 id — LLM 0', async () => {
  const cases: [string, PracticeMessageRow[] | undefined, string][] = [
    ['옛 선생님 말', undefined, 'm0'],
    ['마지막이 학습자 말', convo().slice(1), 'm3'],
    ['마지막 선생님 말 FAILED', [{ id: 'm9', role: 'ASSISTANT', status: 'FAILED', content: 'x', createdAt: at(30) }, ...convo()], 'm9'],
    ['없는 id', undefined, 'm_none'],
  ]
  for (const [label, rows, mid] of cases) {
    const w = practiceWorld(rows ? { rows } : {})
    await rejects(suggestReply(U, 'chat_rp', mid, w.deps), 'CONFLICT', 'NOT_LATEST')
    assert.ok(!w.calls.includes('llm'), label)
  }
})

test('#169 엔진 실패 → 5xx 한 갈래: 쓸 수 없는 응답(ok:false) 502 · 엔진 사용 불가(422) 도 502 · 시간 초과 504 · Trace 1행', async () => {
  const bad = practiceWorld({ complete: async () => llmResult({ ja: 'hello', ko: 'hello', blankText: '', distractors: ['a', 'b'], hintKo: '' }) })
  await rejects(suggestReply(U, 'chat_rp', 'm4', bad.deps), 'ENGINE_ERROR', 'PRACTICE_REJECTED', 502)
  assert.equal(bad.traces.length, 1)
  assert.equal(bad.traces[0].status, 'ERROR')
  const un = practiceWorld({ complete: async () => Promise.reject(named('NoEngineAvailableError')) })
  await rejects(suggestReply(U, 'chat_rp', 'm4', un.deps), 'ENGINE_ERROR', 'ENGINE_UNAVAILABLE', 502)
  const slow = practiceWorld({ complete: async () => Promise.reject(named('LlmTimeoutError')) })
  await assert.rejects(suggestReply(U, 'chat_rp', 'm4', slow.deps), (e: Error) => e.name === 'LlmTimeoutError')
  assert.equal(slow.traces[0].errorCode, 'ENGINE_TIMEOUT')
})

test('#169 같은 사용자 동시 2건 → 두 번째 409 PRACTICE_BUSY(LLM 1회) · 끝나면 다시 가능', async () => {
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  const w = practiceWorld({ complete: async (req) => (w.reqs.push(req), await gate, llmResult(REPLY_FIX.modelResponses.good)) })
  const first = suggestReply(U, 'chat_rp', 'm4', w.deps)
  await new Promise((r) => setTimeout(r, 5))
  await rejects(suggestReply(U, 'chat_rp', 'm4', w.deps), 'CONFLICT', 'PRACTICE_BUSY')
  release()
  await first
  assert.equal(w.reqs.length, 1)
  await suggestReply(U, 'chat_rp', 'm4', w.deps)
})

test('#169 본문: {messageId} 만 — 그 밖 키 400 unknown_key · 형식 틀린 id 400', () => {
  assert.deepEqual(parseReplyPracticeBody({ messageId: 'm4' }), { messageId: 'm4' })
  throwsApi(() => parseReplyPracticeBody({ messageId: 'm4', save: true }), 'save', 'unknown_key')
  throwsApi(() => parseReplyPracticeBody({}), 'messageId', 'id')
  throwsApi(() => parseReplyPracticeBody({ messageId: 'x'.repeat(41) }), 'messageId', 'id')
})

// ── #166 AI 상황 초안 ────────────────────────────────────────────────────────

function draftWorld(over: Partial<ScenarioDraftDeps> = {}, data: ScenarioDraftResponse = DRAFT_FIX.modelResponses['d01-cafe']) {
  const calls: string[] = []
  const reqs: Parameters<ScenarioDraftDeps['complete']>[0][] = []
  const traces: TraceRecord[] = []
  const deps: ScenarioDraftDeps = {
    readTopic: async (userId, topicId) => (calls.push(`topic:${topicId}`), userId === U && topicId === 'top_mine' ? { id: 'top_mine', title: '단골 카페', titleJa: 'カフェ' } : null),
    complete: async (req) => (calls.push('llm'), reqs.push(req), llmResult(data)),
    trace: async (t) => void traces.push(t),
    ...over,
  }
  return { deps, calls, reqs, traces }
}

const DESC = '회사 근처 카페에서 아이스커피를 사이즈까지 정해서 주문하고 싶어요'

test('#166 정상: 200 {draft} — 행 만들기 경로 없음 · 서버 #163 검사(normalizeScenarioInput create) 문제 0 · 수준·설명은 학습자 값 · 장소 고르면 topicIds', async () => {
  const w = draftWorld()
  const r = await draftScenario(U, { description: DESC, level: 'N5', topicId: 'top_mine' }, w.deps)
  assert.equal(r.draft.level, 'N5')
  assert.equal(r.draft.description, DESC)
  assert.deepEqual(r.draft.topicIds, ['top_mine'])
  assert.deepEqual(normalizeScenarioInput(r.draft as unknown as Record<string, unknown>, 'create').problems, [])
  assert.equal(w.reqs.length, 1)
  assert.equal(w.reqs[0].task, 'scenarioDraft')
  assert.equal('context' in w.reqs[0], false, '엔진에는 context 를 넘기지 않는다')
  assert.ok((w.reqs[0].system ?? '').includes('단골 카페'), '권한 확인한 장소 제목을 싣는다')
  const t = JSON.stringify(w.traces)
  for (const text of [DESC, r.draft.title, r.draft.goal.communicativeGoalKo, '단골 카페']) assert.ok(!t.includes(text), `Trace 원문 없음: ${text}`)
  assert.equal(w.traces[0].steps[0].shapeProblems, 0)
  assert.equal(w.traces[0].refType, 'scenarioDraft')
})

test('#166 장소 권한: 남의·없는 주제 → 400 topicId not_found · LLM 0 (모듈은 id 를 검증 없이 되돌려 주므로 서버가 먼저 막는다)', async () => {
  const w = draftWorld()
  try {
    await draftScenario(U, { description: DESC, level: 'N5', topicId: 'top_other' }, w.deps)
    assert.fail('400')
  } catch (e) {
    assert.ok(e instanceof ApiError)
    assert.equal(e.code, 'VALIDATION')
    assert.deepEqual([e.details?.field, e.details?.reason], ['topicId', 'not_found'])
  }
  assert.deepEqual(w.calls, ['topic:top_other'])
  const none = draftWorld()
  const r = await draftScenario(U, { description: DESC, level: 'N4', topicId: null }, none.deps)
  assert.equal(r.draft.topicIds, undefined)
  assert.deepEqual(none.calls, ['llm'], '장소가 없으면 주제를 읽지 않는다')
})

test('#166 거절: NOT_SITUATION·UNSAFE 는 같은 문구·같은 칸의 422(사유 비공개, Trace 에만 코드) · INVALID 502 · 엔진 사용 불가 502(화면이 422 를 "상황 아님"으로 읽음) · 시간 초과 504', async () => {
  const seen: { message: string; details: unknown }[] = []
  for (const status of ['NOT_SITUATION', 'UNSAFE'] as const) {
    const w = draftWorld({}, { status, draft: null } as unknown as ScenarioDraftResponse)
    const e = await rejects(draftScenario(U, { description: DESC, level: 'N5', topicId: null }, w.deps), 'UNPROCESSABLE', 'NOT_A_SCENARIO', 422)
    seen.push({ message: e.userMessage, details: e.details })
    assert.equal(w.traces[0].steps[0].draftStatus, status)
  }
  assert.deepEqual(seen[0], seen[1], '두 거절 사유는 학습자에게 구분되지 않는다')
  const inv = draftWorld({}, { status: 'OK', draft: null } as unknown as ScenarioDraftResponse)
  await rejects(draftScenario(U, { description: DESC, level: 'N5', topicId: null }, inv.deps), 'ENGINE_ERROR', 'DRAFT_INVALID', 502)
  const un = draftWorld({ complete: async () => Promise.reject(named('NoEngineAvailableError')) })
  await rejects(draftScenario(U, { description: DESC, level: 'N5', topicId: null }, un.deps), 'ENGINE_ERROR', 'ENGINE_UNAVAILABLE', 502)
  const slow = draftWorld({ complete: async () => Promise.reject(named('ClaudeCliTimeoutError')) })
  await assert.rejects(draftScenario(U, { description: DESC, level: 'N5', topicId: null }, slow.deps), (e: Error) => e.name === 'ClaudeCliTimeoutError')
  assert.equal(slow.traces[0].errorCode, 'ENGINE_TIMEOUT')
})

test('#166 본문 검사(LLM 전): 화이트리스트 밖 키 · 설명 없음/글 아님/5자 미만/300자 초과/꺾쇠/비밀 유사 · 수준 · topicId 형식 → 칸 400', () => {
  const ok = parseScenarioDraftBody({ description: `  ${DESC}  `, level: 'N3' })
  assert.deepEqual(ok, { description: DESC, level: 'N3', topicId: null })
  assert.equal(parseScenarioDraftBody({ description: DESC, level: 'N3', topicId: 'top_mine' }).topicId, 'top_mine')
  throwsApi(() => parseScenarioDraftBody({ description: DESC, level: 'N3', topicIds: ['x'] }), 'topicIds', 'unknown_key')
  throwsApi(() => parseScenarioDraftBody({ level: 'N3' }), 'description', 'required')
  throwsApi(() => parseScenarioDraftBody({ description: 5, level: 'N3' }), 'description', 'type')
  throwsApi(() => parseScenarioDraftBody({ description: '카페 ', level: 'N3' }), 'description', 'min_length')
  throwsApi(() => parseScenarioDraftBody({ description: '가'.repeat(301), level: 'N3' }), 'description', 'max_length')
  assert.equal(parseScenarioDraftBody({ description: '가'.repeat(300), level: 'N3' }).description.length, 300)
  throwsApi(() => parseScenarioDraftBody({ description: '카페에서 <b>주문</b>', level: 'N3' }), 'description', 'forbidden_char')
  throwsApi(() => parseScenarioDraftBody({ description: '카페 키 sk-abcdefghijklmnopqrstu 주문', level: 'N3' }), 'description', 'secret_like')
  throwsApi(() => parseScenarioDraftBody({ description: DESC, level: 'N6' }), 'level', 'enum')
  throwsApi(() => parseScenarioDraftBody({ description: DESC }), 'level', 'enum')
  throwsApi(() => parseScenarioDraftBody({ description: DESC, level: 'N3', topicId: '' }), 'topicId', 'id')
})

// ── #27 목록 역할극 칸 ───────────────────────────────────────────────────────

test('#27 역할극 칸: 한 쪽의 역할극 행만 모아 끝낸 표식을 한 번에 조회(행 수와 무관하게 1회) · 일반 대화 행은 칸 없음 · 역할극 행이 없으면 조회 0', async () => {
  const lookups: { id: string; createdAt: Date }[][] = []
  const lookup = async (_u: string, chats: { id: string; createdAt: Date }[]) => (lookups.push(chats), new Set(['c2']))
  const rows = [
    { id: 'c1', kind: 'TALK' as const, scenarioId: 'scn_a', createdAt: at(0) },
    { id: 'c2', kind: 'TALK' as const, scenarioId: 'scn_b', createdAt: at(-86_400) },
    { id: 'c3', kind: 'TALK' as const, scenarioId: null, createdAt: at(0) },
    { id: 'c4', kind: 'CHAT' as const, scenarioId: 'scn_a', createdAt: at(0) },
    ...Array.from({ length: 16 }, (_, i) => ({ id: `r${i}`, kind: 'TALK' as const, scenarioId: 'scn_c', createdAt: at(i) })),
  ]
  const badges = await rolePlayListBadges(U, rows, lookup)
  assert.equal(lookups.length, 1, '배치 1회')
  assert.equal(lookups[0].length, 18)
  assert.deepEqual(badges.get('c1'), { id: 'scn_a', ended: false })
  assert.deepEqual(badges.get('c2'), { id: 'scn_b', ended: true })
  assert.equal(badges.has('c3'), false)
  assert.equal(badges.has('c4'), false)
  const none: unknown[] = []
  assert.equal((await rolePlayListBadges(U, [rows[2], rows[3]], async (...a) => (none.push(a), new Set()))).size, 0)
  assert.equal(none.length, 0)
})

test('#27·#161 끝낸 표식 배치 조회(learning): findMany 1회 · 창 하한 = 생성 시각 최솟값 − 7일 · refId in · 생성 시각이 이상한 대화는 빼고 · 다 빠지면 조회 0', async () => {
  const seen: { where: Record<string, unknown> }[] = []
  const db = { learningObservation: { findMany: async (a: { where: Record<string, unknown> }) => (seen.push(a), [{ refId: 'c1' }]) } }
  const out = await endedScenarioRolePlayChatIds(
    U,
    [
      { id: 'c1', createdAt: at(0) },
      { id: 'c2', createdAt: at(-3600) },
      { id: 'c3', createdAt: new Date('nope') },
      { id: '', createdAt: at(0) },
    ],
    db as never,
  )
  assert.deepEqual([...out], ['c1'])
  assert.equal(seen.length, 1)
  assert.deepEqual(seen[0].where, { userId: U, occurredAt: { gte: new Date(at(-3600).getTime() - SCENARIO_END_LOOKUP_MARGIN_MS) }, kind: 'SCENARIO_COMPLETED', refType: 'Chat', refId: { in: ['c1', 'c2'] } })
  assert.equal((await endedScenarioRolePlayChatIds(U, [{ id: 'c3', createdAt: new Date('nope') }], db as never)).size, 0)
  assert.equal(seen.length, 1, '확인할 대화가 없으면 조회 0')
})
