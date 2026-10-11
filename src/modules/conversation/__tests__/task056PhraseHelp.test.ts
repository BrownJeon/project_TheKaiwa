/**
 * task-056 #180 회화방 일본어 도우미 — 실행 서비스(`helpPhrase`)·본문 400(`readPhraseHelpBody`) 단위 시험(DB·LLM 없음, 가짜 deps).
 * 프롬프트 모듈 자체(지시문·스키마·보정)는 `phraseHelp.test.ts`(prompt-engineer) 몫 — 여기서는 서비스의 판정 순서·맥락 조립·결과 매핑·Trace·쓰기 0 을 본다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError, classifyError, toErrorResponse } from '@/modules/infra'
import { isLlmTask, LLM_TASKS, type LlmJsonRequest, type LlmJsonResult, type TraceRecord } from '@/modules/engine'
import { PHRASE_HELP_TASK } from '../prompts/phraseHelp'
import type { PhraseHelpResponse } from '../structuredResponse/phraseHelp'
import { createPhraseHelpDeps, helpPhrase, phraseHelpScene, readPhraseHelpBody, type PhraseHelpDeps } from '../chats/phraseHelp'
import * as conversation from '../index'

const U = 'cuser0000000000000000p056'
const CHAT_AT = new Date('2026-10-11T01:00:00Z')
const Q = '커피 한 잔 주문하고 싶어요'

const GOOD: PhraseHelpResponse = {
  status: 'OK',
  items: [
    { ja: 'コーヒーを一つお願いします。', ko: '커피 한 잔 부탁드려요.', labelKo: '정중하게', whyKo: '주문할 때 가장 흔히 쓰는 말이에요.' },
    { ja: 'コーヒーください。', ko: '커피 주세요.', labelKo: '편하게', whyKo: null },
  ],
}

const llmResult = <T>(data: T): LlmJsonResult<T> => ({ data, connectionKey: 'conn', model: 'm', elapsedMs: 1, promptChars: 100, attempts: 1 })
const named = (name: string) => Object.assign(new Error('x'), { name })

type ChatFake = { id: string; kind: 'TALK' | 'CHAT'; level: string | null; scenarioId: string | null; createdAt: Date; endedAt: Date | null }
const talk = (over: Partial<ChatFake> = {}): ChatFake => ({ id: 'chat_ph', kind: 'TALK', level: 'N4', scenarioId: null, createdAt: CHAT_AT, endedAt: null, ...over })
const MATERIAL = { roles: { learner: '손님', tutor: '점원' }, goal: { communicativeGoalKo: '편의점 계산대에서 봉투 질문에 답한다', successCriteria: [] } }

function world(over: Partial<PhraseHelpDeps> & { chat?: ChatFake | null; data?: PhraseHelpResponse } = {}) {
  const calls: string[] = []
  const reqs: LlmJsonRequest<PhraseHelpResponse>[] = []
  const traces: TraceRecord[] = []
  const chat = over.chat === undefined ? talk() : over.chat
  const deps: PhraseHelpDeps = {
    readChat: async (userId, chatId) => (calls.push('chat'), userId === U && chat && chatId === chat.id ? (chat as never) : null),
    isEnded: async () => (calls.push('ended'), false),
    readMaterial: async () => (calls.push('material'), MATERIAL as never),
    learnerLevel: async () => (calls.push('profile'), 'N5'),
    complete: async (req) => (calls.push('llm'), reqs.push(req), llmResult(over.data ?? GOOD)),
    trace: async (t) => void traces.push(t),
    ...over,
  }
  return { deps, calls, reqs, traces }
}

async function rejects(p: Promise<unknown>, code: string, reason?: string): Promise<ApiError> {
  try {
    await p
  } catch (e) {
    assert.ok(e instanceof ApiError, `ApiError 여야 함: ${String(e)}`)
    assert.equal(e.code, code)
    if (reason !== undefined) assert.equal(e.details?.reason, reason)
    return e
  }
  assert.fail(`${code} 오류가 나야 함`)
}

const body = (q = Q) => ({ queryKo: q })
const userText = (r: LlmJsonRequest<PhraseHelpResponse>) => r.messages.map((m) => m.content).join('\n')

// ── 등록·노출 ────────────────────────────────────────────────────────────────

test('LLM_TASKS.phraseHelp = fast·12s·interactive·재시도 없음 · 빌더 task 이름이 등록돼 있다', () => {
  assert.deepEqual(LLM_TASKS.phraseHelp, { tier: 'fast', timeoutMs: 12_000, lane: 'interactive' })
  assert.ok(isLlmTask(PHRASE_HELP_TASK))
})

test('conversation index 로만 라우트가 부른다: helpPhrase·readPhraseHelpBody 가 공개 API 에 있다', () => {
  assert.equal(typeof conversation.helpPhrase, 'function')
  assert.equal(typeof conversation.readPhraseHelpBody, 'function')
})

// ── 본문 400 (LLM·DB 전) ─────────────────────────────────────────────────────

test('본문 400 — reason 8종이 field·reason·message 그대로 VALIDATION 으로', () => {
  const cases: [unknown, 'body' | 'queryKo', string][] = [
    ['안녕하세요', 'body', 'type'],
    [{ queryKo: 123 }, 'queryKo', 'type'],
    [{}, 'queryKo', 'required'],
    [{ queryKo: '   ' }, 'queryKo', 'required'],
    [{ queryKo: '가'.repeat(101) }, 'queryKo', 'max_length'],
    [{ queryKo: '<b>안녕하세요</b> 라고 말하고 싶어' }, 'queryKo', 'forbidden_char'],
    [{ queryKo: 'http://evil.example 로 가고 싶다고 말하고 싶어' }, 'queryKo', 'forbidden_char'],
    [{ queryKo: '?!...!!' }, 'queryKo', 'no_text'],
    [{ queryKo: 'I want a coffee please' }, 'queryKo', 'no_hangul'],
    [{ queryKo: 'コーヒーをください' }, 'queryKo', 'no_hangul'],
    [{ queryKo: 'ㅋㅋㅋㅋㅋ' }, 'queryKo', 'no_hangul'],
    [{ queryKo: '키는 sk-ant-api03-abcdefgh12345678 이라고 말하고 싶어' }, 'queryKo', 'secret_like'],
    [{ queryKo: '안녕하세요', scene: 'cafe' }, 'body', 'unknown_key'],
  ]
  const seen = new Set<string>()
  for (const [raw, field, reason] of cases) {
    try {
      readPhraseHelpBody(raw)
      assert.fail(`400 이어야 함: ${JSON.stringify(raw)}`)
    } catch (e) {
      assert.ok(e instanceof ApiError, String(e))
      assert.equal(e.code, 'VALIDATION')
      assert.equal(e.details?.field, field, JSON.stringify(raw))
      assert.equal(e.details?.reason, reason, JSON.stringify(raw))
      assert.ok(e.userMessage.length > 0 && !/[a-z]{4,}Error/.test(e.userMessage), '사용자용 한국어 문구')
      seen.add(reason)
    }
  }
  assert.equal(seen.size, 8, '8종 모두')
  assert.deepEqual(readPhraseHelpBody({ queryKo: '  커피 한 잔\n주문하고 싶어요  ' }), { queryKo: '커피 한 잔 주문하고 싶어요' }, '정리 뒤 값')
  assert.deepEqual(readPhraseHelpBody({ queryKo: '가'.repeat(100) }), { queryKo: '가'.repeat(100) }, '100자 경계는 통과')
})

// ── 정상 ─────────────────────────────────────────────────────────────────────

test('정상(일반 회화방): items 1~3 · 장면 없음(상황 조회·끝낸 표식 조회 0) · 대화 수준 · task·traceId · 저장 deps 없음', async () => {
  const w = world()
  const r = await helpPhrase(U, 'chat_ph', body(), w.deps)
  assert.deepEqual(r, {
    items: [
      { ja: 'コーヒーを一つお願いします。', ko: '커피 한 잔 부탁드려요.', labelKo: '정중하게', whyKo: '주문할 때 가장 흔히 쓰는 말이에요.' },
      { ja: 'コーヒーください。', ko: '커피 주세요.', labelKo: '편하게' },
    ],
  })
  assert.deepEqual(w.calls, ['chat', 'llm'], '일반 회화방은 끝낸 표식·상황 재료·프로필을 읽지 않는다(대화 수준 있음)')
  assert.equal(w.reqs.length, 1)
  assert.equal(w.reqs[0].task, 'phraseHelp')
  assert.ok(typeof w.reqs[0].traceId === 'string' && w.reqs[0].traceId.length > 0)
  const text = userText(w.reqs[0])
  assert.ok(text.includes(Q), '질의')
  assert.ok(!text.includes('장면:'), '장면 줄 없음')
  assert.ok(w.reqs[0].system.includes('N4'), '대화 수준이 [수준] 줄에')
  assert.equal(w.traces.length, 1)
  assert.equal(w.traces[0].status, 'OK')
  assert.equal(w.traces[0].refType, 'phraseHelp')
  assert.equal(w.traces[0].refId, 'chat_ph')
  assert.equal(w.traces[0].steps[0].name, 'PHRASE_HELP')
  assert.equal(w.traces[0].steps[0].outcome, 'OK')
  assert.equal(w.traces[0].steps[0].scene, 'NONE')
})

test('정상: 항목은 최대 3개(모델이 4개를 내도 앞 3개)', async () => {
  const four: PhraseHelpResponse = {
    status: 'OK',
    items: [
      { ja: 'お願いします。', ko: '부탁드려요.', labelKo: '정중하게', whyKo: null },
      { ja: 'お願い。', ko: '부탁해.', labelKo: '편하게', whyKo: null },
      { ja: 'よろしくお願いいたします。', ko: '잘 부탁드립니다.', labelKo: '더 공손하게', whyKo: null },
      { ja: 'お願いできますか。', ko: '부탁할 수 있을까요?', labelKo: '다른 표현', whyKo: null },
    ],
  }
  const r = await helpPhrase(U, 'chat_ph', body('부탁한다고 말하고 싶어요'), world({ data: four }).deps)
  assert.equal(r.items.length, 3)
  assert.deepEqual(r.items.map((i) => i.ja), ['お願いします。', 'お願い。', 'よろしくお願いいたします。'])
})

test('역할극 방: 끝낸 표식은 대화 생성 시각으로 조회 · 장면 한 줄(내 역할·상대 역할·목표)이 질의와 같은 user 메시지에', async () => {
  const w = world({ chat: talk({ scenarioId: 'scn_conv' }), isEnded: async (_u, c) => (w.calls.push(`ended:${c.createdAt.toISOString()}`), false) })
  const r = await helpPhrase(U, 'chat_ph', body('봉투는 필요 없어요'), w.deps)
  assert.equal(r.items.length, 2)
  assert.ok(w.calls.includes(`ended:${CHAT_AT.toISOString()}`))
  assert.ok(w.calls.includes('material'))
  const text = userText(w.reqs[0])
  assert.ok(text.includes('장면: 내 역할 손님 · 상대 역할 점원 · 목표 편의점 계산대에서 봉투 질문에 답한다'), text)
  assert.equal(w.traces[0].steps[0].scene, 'OK')
  assert.deepEqual(phraseHelpScene(MATERIAL), { learnerRole: '손님', partnerRole: '점원', goalKo: '편의점 계산대에서 봉투 질문에 답한다' })
})

test('대화 수준이 없으면 프로필 수준', async () => {
  const w = world({ chat: talk({ level: null }) })
  await helpPhrase(U, 'chat_ph', body(), w.deps)
  assert.ok(w.calls.includes('profile'))
  assert.ok(w.reqs[0].system.includes('N5'))
})

test('장면 재료를 읽지 못하면 404 가 아니라 장면 없이 진행: 재료 없음(MISSING)·읽기 예외(ERROR)', async () => {
  const missing = world({ chat: talk({ scenarioId: 'scn_gone' }), readMaterial: async () => null })
  assert.equal((await helpPhrase(U, 'chat_ph', body(), missing.deps)).items.length, 2)
  assert.ok(!userText(missing.reqs[0]).includes('장면:'))
  assert.equal(missing.traces[0].steps[0].scene, 'MISSING')

  const warn = console.warn
  const warned: string[] = []
  console.warn = (...a: unknown[]) => void warned.push(a.map(String).join(' '))
  try {
    const broken = world({ chat: talk({ scenarioId: 'scn_x' }), readMaterial: async () => Promise.reject(Object.assign(new Error(`select … ${Q}`), { name: 'PrismaClientKnownRequestError' })) })
    assert.equal((await helpPhrase(U, 'chat_ph', body(), broken.deps)).items.length, 2)
    assert.ok(!userText(broken.reqs[0]).includes('장면:'))
    assert.equal(broken.traces[0].steps[0].scene, 'ERROR')
  } finally {
    console.warn = warn
  }
  assert.equal(warned.length, 1)
  assert.ok(!warned[0].includes(Q) && !warned[0].includes('select'), '오류 이름만 — 메시지·질의 원문 없음')
})

// ── 404 · 409 ────────────────────────────────────────────────────────────────

test('404: 남의 대화·없는 대화·CHAT 방·형식 틀린 id — LLM 0', async () => {
  for (const [label, chat, user, chatId] of [
    ['없는 대화', undefined, U, 'chat_none'],
    ['남의 대화', undefined, 'cuser_other', 'chat_ph'],
    ['CHAT 방', talk({ kind: 'CHAT' }), U, 'chat_ph'],
  ] as const) {
    const w = world(chat ? { chat } : {})
    await rejects(helpPhrase(user, chatId, body(), w.deps), 'NOT_FOUND')
    assert.ok(!w.calls.includes('llm'), label)
    assert.equal(w.traces.length, 0, `${label}: LLM 전 거절은 Trace 없음`)
  }
  const bad = world()
  await rejects(helpPhrase(U, 'x'.repeat(41), body(), bad.deps), 'NOT_FOUND')
  await rejects(helpPhrase(U, '', body(), bad.deps), 'NOT_FOUND')
  assert.deepEqual(bad.calls, [], '형식 틀린 id 는 쿼리 전 404')
})

test('409 ENDED: Chat.endedAt(조회 없이) · 끝낸 표식 · 상황이 지워진 방에 남은 endedAt — LLM 0', async () => {
  const byColumn = world({ chat: talk({ scenarioId: 'scn_conv', endedAt: new Date() }) })
  await rejects(helpPhrase(U, 'chat_ph', body(), byColumn.deps), 'CONFLICT', 'ENDED')
  assert.deepEqual(byColumn.calls, ['chat'], 'endedAt 이 있으면 관측 조회 없이')
  const byMark = world({ chat: talk({ scenarioId: 'scn_conv' }), isEnded: async () => true })
  await rejects(helpPhrase(U, 'chat_ph', body(), byMark.deps), 'CONFLICT', 'ENDED')
  const orphan = world({ chat: talk({ scenarioId: null, endedAt: new Date() }) })
  await rejects(helpPhrase(U, 'chat_ph', body(), orphan.deps), 'CONFLICT', 'ENDED')
  for (const w of [byColumn, byMark, orphan]) assert.ok(!w.calls.includes('llm'))
})

test('턴 진행 중이라도 막지 않는다(TURN_RUNNING 없음) — deps 에 턴·메시지 조회 자체가 없다', () => {
  const keys = Object.keys(world().deps).sort()
  assert.deepEqual(keys, ['complete', 'isEnded', 'learnerLevel', 'readChat', 'readMaterial', 'trace'])
})

test('409 PHRASE_BUSY: 같은 사용자 동시 2건 → 두 번째 거절(LLM 1회) · 다른 사용자는 막지 않음 · 끝나면(실패해도) 다시 가능', async () => {
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  // 첫 호출만 문(gate)에서 기다린다 — 잠금이 빠진 결함이면 둘째 호출이 바로 끝나 단언이 실패로 드러난다(교착 없이).
  const w = world({ complete: async (req) => (w.reqs.push(req), w.reqs.length === 1 ? await gate : undefined, llmResult(GOOD)) })
  const first = helpPhrase(U, 'chat_ph', body(), w.deps)
  try {
    await new Promise((r) => setTimeout(r, 5))
    await rejects(helpPhrase(U, 'chat_ph', body(), w.deps), 'CONFLICT', 'PHRASE_BUSY')
    const otherUser = world({ chat: null, readChat: async () => talk() as never })
    assert.equal((await helpPhrase('cuser_other_000000000000', 'chat_ph', body(), otherUser.deps)).items.length, 2, '다른 사용자')
  } finally {
    // 단언이 실패해도 첫 호출을 풀어 시험이 멈추지 않게(뒤 시험이 cancelled 로 숨지 않게).
    release()
  }
  await first
  assert.equal(w.reqs.length, 1)
  await helpPhrase(U, 'chat_ph', body(), w.deps)

  const failing = world({ complete: async () => Promise.reject(named('LlmTimeoutError')) })
  await assert.rejects(helpPhrase(U, 'chat_ph', body(), failing.deps))
  assert.equal((await helpPhrase(U, 'chat_ph', body(), world().deps)).items.length, 2, '실패 뒤에도 잠금이 풀린다')

  const slowRead = world({ chat: talk({ scenarioId: 'scn_conv' }), readMaterial: async () => Promise.reject(new Error('db')) })
  const warn = console.warn
  console.warn = () => undefined
  try {
    await helpPhrase(U, 'chat_ph', body(), slowRead.deps)
  } finally {
    console.warn = warn
  }
  assert.equal((await helpPhrase(U, 'chat_ph', body(), world().deps)).items.length, 2, '장면 읽기 실패 뒤에도 잠금이 풀린다')
})

// ── 결과 매핑 ────────────────────────────────────────────────────────────────

test('거절 3종(NOT_A_PHRASE·UNSAFE·TOO_LONG) → 200 빈 목록(사유 구분 없음) · Trace 에만 코드', async () => {
  const tooLong: PhraseHelpResponse = { status: 'OK', items: [{ ja: 'あ'.repeat(101) + '。', ko: '아주 긴 말', labelKo: null, whyKo: null }] }
  for (const [want, data] of [
    ['NOT_A_PHRASE', { status: 'NOT_A_PHRASE', items: [] }],
    ['UNSAFE', { status: 'UNSAFE', items: [] }],
    ['TOO_LONG', tooLong],
  ] as const) {
    const w = world({ data: data as PhraseHelpResponse })
    const r = await helpPhrase(U, 'chat_ph', body(), w.deps)
    assert.deepEqual(r, { items: [] }, want)
    assert.deepEqual(Object.keys(r), ['items'], '사유 칸 없음')
    assert.equal(w.traces[0].status, 'OK')
    assert.equal(w.traces[0].steps[0].outcome, want)
  }
})

test('INVALID(쓸 수 있는 항목 0) → 502 ENGINE_ERROR · Trace ERROR', async () => {
  for (const data of [
    { status: 'OK', items: [] },
    { status: 'OK', items: [{ ja: '커피 주세요', ko: '커피 주세요', labelKo: null, whyKo: null }] },
  ] as PhraseHelpResponse[]) {
    const w = world({ data })
    const e = await rejects(helpPhrase(U, 'chat_ph', body(), w.deps), 'ENGINE_ERROR', 'PHRASE_INVALID')
    assert.equal(classifyError(e).status, 502)
    assert.equal(w.traces[0].status, 'ERROR')
    assert.equal(w.traces[0].errorCode, 'ENGINE_ERROR')
    assert.equal(w.traces[0].steps[0].outcome, 'INVALID')
  }
})

test('엔진 실패: 계약 위반 502 · 사용 불가(422)도 502 · 12초 시간 초과 504 — Trace 단계 errorCode', async () => {
  const contract = world({ complete: async () => Promise.reject(named('LlmContractError')) })
  await assert.rejects(helpPhrase(U, 'chat_ph', body(), contract.deps), (e: Error) => classifyError(e).status === 502)
  assert.equal(contract.traces[0].steps[0].errorCode, 'ENGINE_ERROR')

  const un = world({ complete: async () => Promise.reject(named('NoEngineAvailableError')) })
  const e2 = await rejects(helpPhrase(U, 'chat_ph', body(), un.deps), 'ENGINE_ERROR', 'ENGINE_UNAVAILABLE')
  assert.equal(classifyError(e2).status, 502)

  const slow = world({ complete: async () => Promise.reject(named('LlmTimeoutError')) })
  await assert.rejects(helpPhrase(U, 'chat_ph', body(), slow.deps), (e: Error) => classifyError(e).status === 504)
  assert.equal(slow.traces[0].errorCode, 'ENGINE_TIMEOUT')
  assert.equal(slow.traces[0].steps[0].errorCode, 'ENGINE_TIMEOUT')
})

// ── 손님 취소(REV-190 M1) ─────────────────────────────────────────────────────

/**
 * 엔진(claudeCli)과 같은 약속의 가짜 — `signal` 이 abort 되면 name 'AbortError' 로 거절한다.
 * 신호가 안 오는 결함(전달 누락)이어도 시험이 멈추지 않게 1초 뒤 스스로 거절하고, `release` 로 시험이 먼저 끝나도 풀 수 있다(잠금이 뒤 시험으로 새지 않게).
 */
function abortableEngine(w: { calls: string[]; reqs: LlmJsonRequest<PhraseHelpResponse>[] }, seen: { cancelled: boolean; release?: () => void }): PhraseHelpDeps['complete'] {
  return (req) => {
    w.calls.push('llm')
    w.reqs.push(req)
    return new Promise((_resolve, reject) => {
      const timer = setTimeout(() => reject(named('FakeEngineNeverAborted')), 1000)
      seen.release = () => {
        clearTimeout(timer)
        reject(named('FakeEngineReleased'))
      }
      const stop = () => {
        clearTimeout(timer)
        seen.cancelled = true
        reject(named('AbortError'))
      }
      if (req.signal?.aborted) stop()
      else req.signal?.addEventListener('abort', stop, { once: true })
    })
  }
}

test('손님 취소(signal): 신호가 엔진 요청까지 그대로 전달 → 취소되면 분류된 409 CANCELLED(500·오류 로그 0) · 실행 중 취소라 잠금 즉시 해제(큐 대기 중 취소는 차례가 올 때 — 수용) · Trace 는 코드만', async () => {
  const ac = new AbortController()
  const seen: { cancelled: boolean; release?: () => void } = { cancelled: false }
  const w = world()
  w.deps.complete = abortableEngine(w, seen)
  const logged: string[] = []
  const origError = console.error
  console.error = (...a: unknown[]) => void logged.push(a.map(String).join(' '))
  let err: unknown
  try {
    const settled = helpPhrase(U, 'chat_ph', body(), w.deps, ac.signal).then(() => null, (e: unknown) => e)
    await new Promise((r) => setTimeout(r, 5))
    assert.equal(w.reqs.length, 1, '엔진 호출 진행 중')
    assert.equal(w.reqs[0].signal, ac.signal, '라우트가 준 신호가 엔진 요청에 그대로(복사·누락 없음)')
    assert.equal(w.reqs[0].signal?.aborted, false)
    ac.abort()
    err = await settled
    assert.ok(err instanceof ApiError, `ApiError 여야 함: ${String(err)}`)
    assert.equal(err.code, 'CONFLICT')
    assert.equal(err.details?.reason, 'CANCELLED')
    assert.equal(toErrorResponse(err).status, 409, '봉투로 바뀌어도 500 이 아니다')
  } finally {
    console.error = origError
    ac.abort() // 단언이 먼저 실패해도 가짜 엔진을 풀어 잠금이 뒤 시험으로 새지 않게(이미 abort 됐으면 무해).
    seen.release?.()
  }
  assert.equal(seen.cancelled, true, '엔진이 취소를 받았다')
  assert.deepEqual(logged, [], '취소는 오류 로그(INTERNAL 의 console.error)를 내지 않는다')
  assert.equal(classifyError(err).code, 'CONFLICT')

  // 잠금: finally 가 즉시 풀어 같은 사용자가 바로 다시 부를 수 있다(PHRASE_BUSY 아님). 신호 없이 부르면 요청에 signal 칸도 없다.
  const again = world()
  assert.equal((await helpPhrase(U, 'chat_ph', body(), again.deps)).items.length, 2)
  assert.ok(!('signal' in again.reqs[0]), '신호를 안 주면 요청에 signal 칸이 없다(기존 동작 그대로)')

  assert.equal(w.traces.length, 1)
  assert.equal(w.traces[0].status, 'ERROR')
  assert.equal(w.traces[0].errorCode, 'CANCELLED')
  assert.equal(w.traces[0].steps[0].errorCode, 'CANCELLED')
  const t = JSON.stringify(w.traces)
  for (const s of [Q, '커피']) assert.ok(!t.includes(s), `Trace 원문 없음: ${s}`)
})

test('손님 취소: 호출 전에 이미 끊긴 신호도 같은 길(409 CANCELLED, 잠금 해제) — 취소 말고 다른 엔진 실패는 기존 매핑 그대로(504)', async () => {
  const ac = new AbortController()
  ac.abort()
  const seen: { cancelled: boolean; release?: () => void } = { cancelled: false }
  const w = world()
  w.deps.complete = abortableEngine(w, seen)
  await rejects(helpPhrase(U, 'chat_ph', body(), w.deps, ac.signal), 'CONFLICT', 'CANCELLED')
  assert.equal(seen.cancelled, true)
  assert.equal((await helpPhrase(U, 'chat_ph', body(), world().deps)).items.length, 2, '잠금 해제')

  const slow = world({ complete: async () => Promise.reject(named('LlmTimeoutError')) })
  await assert.rejects(helpPhrase(U, 'chat_ph', body(), slow.deps, new AbortController().signal), (e: Error) => classifyError(e).status === 504)
})

test('취소 판정은 오류 이름만이 아니라 신호도 본다(REV-192 L-R2): 신호가 abort 된 AbortError 만 409 CANCELLED · 신호가 살아 있는데 AbortError 가 새면 취소가 아니라 기존 매핑(INTERNAL 500·오류 로그 있음)이고 잠금은 풀린다', async () => {
  const leaky = () => world({ complete: async () => Promise.reject(named('AbortError')) })

  // ① 신호가 abort 된 상태에서 엔진이 AbortError 로 거절 → 기존 동작 그대로 409 CANCELLED.
  const gone = new AbortController()
  gone.abort()
  const a = leaky()
  await rejects(helpPhrase(U, 'chat_ph', body(), a.deps, gone.signal), 'CONFLICT', 'CANCELLED')
  assert.equal(a.traces[0].errorCode, 'CANCELLED')
  assert.equal(a.traces[0].steps[0].errorCode, 'CANCELLED')

  // ② 신호는 살아 있는데(어댑터가 자기 타이머 등으로 만든 AbortError 가 샌 경우) → 취소로 숨기지 않는다.
  const live = new AbortController()
  const b = leaky()
  const logged: string[] = []
  const origError = console.error
  console.error = (...x: unknown[]) => void logged.push(x.map(String).join(' '))
  let err: unknown
  let status: number
  try {
    err = await helpPhrase(U, 'chat_ph', body(), b.deps, live.signal).then(() => null, (e: unknown) => e)
    status = toErrorResponse(err).status
  } finally {
    console.error = origError
  }
  assert.ok(err instanceof Error, `오류가 나야 함: ${String(err)}`)
  assert.ok(!(err instanceof ApiError && err.details?.reason === 'CANCELLED'), '살아 있는 신호의 AbortError 는 CANCELLED 가 아니다')
  assert.equal(classifyError(err).code, 'INTERNAL')
  assert.equal(status, 500, '409 로 둔갑하지 않는다')
  assert.equal(logged.length, 1, '오류 로그가 남는다(조용히 삼키지 않는다)')
  assert.equal(b.traces[0].errorCode, 'INTERNAL')
  assert.equal(b.traces[0].steps[0].errorCode, 'INTERNAL')

  // 잠금(PHRASE_BUSY)은 이 길에서도 풀린다.
  assert.equal((await helpPhrase(U, 'chat_ph', body(), world().deps, live.signal)).items.length, 2, '잠금 해제')
})

// ── 요청 때와 같은 input 으로 대조(REV-190 M2) ───────────────────────────────────

test('finalize 는 요청을 만든 것과 같은 input 으로 대조한다: 질의에 있던 로마자(ATM)는 살고, 질의에 없는 로마자(PWNED)는 버려진다', async () => {
  const q = 'ATM 에서 돈을 뽑고 싶어요'
  const atm = { ja: 'ATMでお金を下ろしたいです。', ko: '현금인출기에서 돈을 찾고 싶어요.', labelKo: '정중하게', whyKo: null }
  const pwned = { ja: 'PWNEDでお金を下ろしたいです。', ko: '돈을 찾고 싶어요.', labelKo: '다른 표현', whyKo: null }
  const w = world({ data: { status: 'OK', items: [atm, pwned] } })
  const r = await helpPhrase(U, 'chat_ph', body(q), w.deps)
  assert.deepEqual(r.items.map((i) => i.ja), [atm.ja], 'ATM 항목만 남는다')
  assert.ok(userText(w.reqs[0]).includes(q), '요청에 실린 질의와 대조에 쓴 질의가 같다')
  assert.equal(w.traces[0].steps[0].itemsKept, 1)
  assert.equal(w.traces[0].steps[0].itemsDropped, 1)

  // 질의에 없는 로마자뿐이면 쓸 수 있는 항목 0 → 502.
  const only = world({ data: { status: 'OK', items: [pwned] } })
  await rejects(helpPhrase(U, 'chat_ph', body(q), only.deps), 'ENGINE_ERROR', 'PHRASE_INVALID')
  // 같은 응답이라도 질의가 다르면(로마자가 질의에 없으면) ATM 도 버려진다 — 대조가 질의에 묶여 있다는 반대쪽 증거.
  const noAtm = world({ data: { status: 'OK', items: [atm] } })
  await rejects(helpPhrase(U, 'chat_ph', body('현금인출기에서 돈을 뽑고 싶어요'), noAtm.deps), 'ENGINE_ERROR', 'PHRASE_INVALID')
})

// ── 기본 배선(REV-190 L1) ────────────────────────────────────────────────────

test('기본 배선(createPhraseHelpDeps): 대화는 (id, userId) 로만 조회 — 남의 대화·인자 뒤바뀜은 못 읽고, helpPhrase 는 404', async () => {
  const OTHER = 'cuser_other_000000000000'
  const rows = [
    { id: 'chat_ph', userId: U, kind: 'TALK', level: 'N4', scenarioId: null, createdAt: CHAT_AT, endedAt: null },
    { id: 'chat_x', userId: OTHER, kind: 'TALK', level: 'N4', scenarioId: null, createdAt: CHAT_AT, endedAt: null },
  ] as Record<string, unknown>[]
  const wheres: Record<string, unknown>[] = []
  const db = {
    chat: {
      // 느슨한 가짜가 아니다: id 와 userId 가 둘 다 where 에 있고 둘 다 맞아야만 읽힌다.
      findFirst: async (a: { where: { id?: string; userId?: string }; select: Record<string, boolean> }) => {
        wheres.push(a.where)
        const r = rows.find((c) => a.where.id !== undefined && a.where.userId !== undefined && c.id === a.where.id && c.userId === a.where.userId)
        return r ? Object.fromEntries(Object.keys(a.select).map((k) => [k, r[k]])) : null
      },
    },
  }
  const deps = createPhraseHelpDeps(db as never)
  assert.deepEqual(await deps.readChat(U, 'chat_ph'), { id: 'chat_ph', kind: 'TALK', level: 'N4', scenarioId: null, createdAt: CHAT_AT, endedAt: null })
  assert.deepEqual(wheres[0], { id: 'chat_ph', userId: U }, '소유 조건이 where 에 있다')
  assert.equal(await deps.readChat(U, 'chat_x'), null, '남의 대화')
  assert.equal(await deps.readChat(OTHER, 'chat_ph'), null, '내 대화는 남에게 안 보인다')

  const w = world()
  const wired = { ...deps, complete: w.deps.complete, trace: w.deps.trace }
  await rejects(helpPhrase(OTHER, 'chat_ph', body(), wired), 'NOT_FOUND')
  assert.ok(!w.calls.includes('llm'), '남의 대화는 LLM 전에 404')
  assert.equal((await helpPhrase(U, 'chat_ph', body(), wired)).items.length, 2, '내 대화는 같은 배선으로 정상')
})

// ── 원문 미보관 · 쓰기 0 ──────────────────────────────────────────────────────

test('Trace 직렬화에 질의·ja·ko·꼬리표·이유 원문이 없다(코드·수치·장면 코드만)', async () => {
  const w = world({ chat: talk({ scenarioId: 'scn_conv' }) })
  await helpPhrase(U, 'chat_ph', body(), w.deps)
  const t = JSON.stringify(w.traces)
  for (const s of [Q, '커피', 'コーヒー', '부탁드려요', '정중하게', '편하게', '주문할 때', '손님', '점원', '편의점']) assert.ok(!t.includes(s), `Trace 원문 없음: ${s}`)
  const step = w.traces[0].steps[0]
  for (const v of Object.values(step)) assert.ok(v === null || v === undefined || ['string', 'number', 'boolean'].includes(typeof v))
  assert.equal(typeof step.itemsKept, 'number')
})

test('DB 쓰기 0 — 서비스·라우트 소스에 쓰기 호출·학습 기록 테이블이 없다', () => {
  const root = process.cwd()
  for (const rel of ['src/modules/conversation/chats/phraseHelp.ts', 'src/app/api/v1/chats/[id]/phrase-help/route.ts']) {
    // 주석(설명에 「StudyLog 0」 같은 말이 있다)은 빼고 코드만 본다.
    const src = readFileSync(join(root, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    // `inFlight.delete(` 는 메모리 잠금(Set) 해제라 뺀다.
    for (const bad of [/\bprisma\b/, /(?<!inFlight)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/,/\$transaction/, /studyLog|statsSnapshot|repetitionItem|wordEntry|learningObservation\.create/i]) {
      assert.ok(!bad.test(src), `${rel}: ${bad}`)
    }
  }
})
