/**
 * task-077 #184 오늘의 회화 ⑤ 말하기의 일본어 도우미 — 서버 입구(`helpLessonPhrase`) 단위 시험(DB·LLM 없음, 가짜 deps).
 * 회화 도우미(`helpPhrase`)는 `task056PhraseHelp.test.ts`, 단어 도우미(`helpWordPhrase`)는 `task072WordHelpServer.test.ts` 가 그대로 지킨다 —
 * 여기서는 ① 요청이 **장면 없는 회화방(일반 모드)과 바이트까지 같다**(단어 모드 아님·레슨 맥락 없음) ② 수준 = 프로필 ③ 결과 매핑(1/2/3개·빈 목록·무효·엔진 오류·시간 초과)
 * ④ **잠금을 #180·#181 과 공유**(양방향) ⑤ 취소 ⑥ Trace·로그 원문 0 ⑦ 저장 없음을 본다. 정답은 손으로 적었다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError, classifyError, toErrorResponse } from '@/modules/infra'
import type { LlmJsonRequest, LlmJsonResult, TraceRecord } from '@/modules/engine'
import { buildPhraseHelpSystem, PHRASE_HELP_PROMPT_VERSION } from '../prompts/phraseHelp'
import type { PhraseHelpResponse } from '../structuredResponse/phraseHelp'
import { helpLessonPhrase, helpPhrase, helpWordPhrase, type LessonPhraseHelpDeps, type PhraseHelpDeps, type WordPhraseHelpDeps } from '../chats/phraseHelp'
import * as conversation from '../index'

const U = 'cuser0000000000000000p077'
const OTHER = 'cuser_other_00000000p077'
const LESSON = 'cles0000000000000000l077'
const Q = '주말에 친구를 만났어요'

const GOOD: PhraseHelpResponse = {
  status: 'OK',
  items: [
    { ja: '週末に友達に会いました。', ko: '주말에 친구를 만났어요.', labelKo: '정중하게', whyKo: '지난 일을 말할 때 가장 흔한 모양이에요.' },
    { ja: '週末、友達に会ったよ。', ko: '주말에 친구 만났어.', labelKo: '편하게', whyKo: null },
  ],
}
const WORD_GOOD: PhraseHelpResponse = { status: 'OK', items: [{ ja: '友達', ko: '친한 사이의 사람', labelKo: null, whyKo: null }] }

const llmResult = <T>(data: T): LlmJsonResult<T> => ({ data, connectionKey: 'conn', model: 'm', elapsedMs: 1, promptChars: 100, attempts: 1 })
const named = (name: string) => Object.assign(new Error('x'), { name })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const body = (q = Q) => ({ queryKo: q })

/** 레슨 도우미 가짜 — 의존 타입이 `learnerLevel`·`complete`·`trace` 셋뿐이라 대화·역할극·레슨 행을 읽는 칸 자체가 없다. */
function lessonWorld(over: Partial<LessonPhraseHelpDeps> & { data?: PhraseHelpResponse; level?: string } = {}) {
  const { data, level, ...rest } = over
  const calls: string[] = []
  const reqs: LlmJsonRequest<PhraseHelpResponse>[] = []
  const traces: TraceRecord[] = []
  const deps: LessonPhraseHelpDeps = {
    learnerLevel: async () => (calls.push('profile'), level ?? 'N3'),
    complete: async (req) => (calls.push('llm'), reqs.push(req), llmResult(data ?? GOOD)),
    trace: async (t) => void traces.push(t),
    ...rest,
  }
  return { deps, calls, reqs, traces }
}

/** 회화 도우미 가짜 — 장면 없는 TALK 방(`scenarioId: null`) · 대화 수준 `level`. */
function chatWorld(level = 'N3', over: Partial<PhraseHelpDeps> = {}) {
  const calls: string[] = []
  const reqs: LlmJsonRequest<PhraseHelpResponse>[] = []
  const chat = { id: 'chat_ph077', kind: 'TALK', level, scenarioId: null, createdAt: new Date('2026-10-18T01:00:00Z'), endedAt: null }
  const deps: PhraseHelpDeps = {
    readChat: async (userId, chatId) => (calls.push('chat'), userId === U && chatId === chat.id ? (chat as never) : null),
    isEnded: async () => (calls.push('ended'), false),
    readMaterial: async () => (calls.push('material'), null),
    learnerLevel: async () => (calls.push('profile'), 'N5'),
    complete: async (req) => (calls.push('llm'), reqs.push(req), llmResult(GOOD)),
    trace: async () => undefined,
    ...over,
  }
  return { deps, calls, reqs }
}

function wordWorld() {
  const reqs: LlmJsonRequest<PhraseHelpResponse>[] = []
  const deps: WordPhraseHelpDeps = {
    learnerLevel: async () => 'N3',
    complete: async (req) => (reqs.push(req), llmResult(WORD_GOOD)),
    trace: async () => undefined,
  }
  return { deps, reqs }
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

/** 엔진과 같은 약속의 가짜 — `signal` 이 abort 되면 name 'AbortError' 로 거절한다(신호가 안 오는 결함이면 1초 뒤 스스로 거절). */
function abortableEngine(w: { calls: string[]; reqs: LlmJsonRequest<PhraseHelpResponse>[] }, seen: { cancelled: boolean; release?: () => void }): LessonPhraseHelpDeps['complete'] {
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

/** 요청에서 호출마다 다른 칸(traceId·signal)과 함수(extraCheck)를 빼고 나머지를 JSON 으로 — 두 입구의 요청이 같은지 바이트로 비교한다. */
const requestBytes = (req: LlmJsonRequest<PhraseHelpResponse>): string => JSON.stringify({ ...req, traceId: undefined, signal: undefined })

const code = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
const SERVICE = 'src/modules/conversation/chats/phraseHelp.ts'

// ── 공개 API ─────────────────────────────────────────────────────────────────

test('conversation index 에 helpLessonPhrase 가 있다(라우트는 index 로만 부른다) · 기존 두 입구도 그대로', () => {
  assert.equal(conversation.helpLessonPhrase, helpLessonPhrase)
  assert.equal(typeof conversation.helpPhrase, 'function')
  assert.equal(typeof conversation.helpWordPhrase, 'function')
})

// ── 요청 = 장면 없는 회화방(일반 모드) ──────────────────────────────────────────

test('요청은 장면 없는 회화방과 바이트까지 같다(같은 수준이면) — 문장 모드 v1 페르소나·system·본문·스키마, 레슨 맥락·장면 줄 없음', async () => {
  const l = lessonWorld({ level: 'N3' })
  const c = chatWorld('N3')
  await helpLessonPhrase(U, LESSON, body(), l.deps)
  await helpPhrase(U, 'chat_ph077', body(), c.deps)
  assert.equal(l.reqs.length, 1)
  assert.equal(c.reqs.length, 1)
  assert.equal(requestBytes(l.reqs[0]), requestBytes(c.reqs[0]), '레슨 요청 = 장면 없는 회화방 요청')
  assert.equal(typeof l.reqs[0].extraCheck, typeof c.reqs[0].extraCheck)
  const req = l.reqs[0]
  assert.equal(req.task, 'phraseHelp')
  assert.equal(req.persona?.name, 'phrase-help', '회화 도우미 페르소나')
  assert.equal(req.system, buildPhraseHelpSystem('N3'))
  assert.deepEqual(req.messages.map((m) => m.role), ['user'])
  assert.ok(req.messages[0].content.includes(Q), '질의')
  assert.ok(!req.messages[0].content.includes('장면'), '장면 줄 없음')
  assert.ok(!JSON.stringify(req).includes(LESSON), '레슨 id 가 프롬프트에 없다')
  assert.ok(typeof req.traceId === 'string' && req.traceId.length > 0)
  assert.ok(!('signal' in req), '신호를 안 주면 요청에 signal 칸이 없다')
})

test('단어 모드가 아니다: 단어 도우미 요청(페르소나·system·본문)과 다르고, 결과에 labelKo·whyKo 가 살아 있다', async () => {
  const l = lessonWorld()
  const w = wordWorld()
  const r = await helpLessonPhrase(U, LESSON, body(), l.deps)
  await helpWordPhrase(U, body(), w.deps)
  assert.notEqual(l.reqs[0].persona?.name, w.reqs[0].persona?.name)
  assert.equal(w.reqs[0].persona?.name, 'phrase-help-word')
  assert.notEqual(l.reqs[0].system, buildPhraseHelpSystem('N3', 'word'))
  assert.notEqual(l.reqs[0].messages[0].content, w.reqs[0].messages[0].content)
  assert.deepEqual(r, {
    items: [
      { ja: '週末に友達に会いました。', ko: '주말에 친구를 만났어요.', labelKo: '정중하게', whyKo: '지난 일을 말할 때 가장 흔한 모양이에요.' },
      { ja: '週末、友達に会ったよ。', ko: '주말에 친구 만났어.', labelKo: '편하게' },
    ],
  })
})

test('본문이 모드·장면·레슨 맥락을 정하지 않는다: 검증을 우회해 mode·scene·task 칸을 실어 보내도 요청은 그대로', async () => {
  const plain = lessonWorld()
  const sneaky = lessonWorld()
  await helpLessonPhrase(U, LESSON, body(), plain.deps)
  await helpLessonPhrase(U, LESSON, { queryKo: Q, mode: 'word', scene: { learnerRole: '손님', partnerRole: '점원', goalKo: '주문' }, taskJa: '自己紹介をしましょう', targetJa: '趣味' } as never, sneaky.deps)
  assert.equal(requestBytes(sneaky.reqs[0]), requestBytes(plain.reqs[0]))
  assert.ok(!JSON.stringify(sneaky.reqs[0]).includes('自己紹介'), '과제 문장 없음')
  assert.ok(!JSON.stringify(sneaky.reqs[0]).includes('손님'), '장면 없음')
})

test('수준은 프로필에서(1회): N5 ≠ N2 가 system 에 반영 · 알 수 없는 값은 수준 없음과 같다', async () => {
  const a = lessonWorld({ level: 'N5' })
  const b = lessonWorld({ level: 'N2' })
  await helpLessonPhrase(U, LESSON, body(), a.deps)
  await helpLessonPhrase(U, LESSON, body(), b.deps)
  assert.deepEqual(a.calls, ['profile', 'llm'])
  assert.equal(a.reqs[0].system, buildPhraseHelpSystem('N5'))
  assert.equal(b.reqs[0].system, buildPhraseHelpSystem('N2'))
  assert.notEqual(a.reqs[0].system, b.reqs[0].system)
  const odd = lessonWorld({ level: 'ZZ' })
  await helpLessonPhrase(U, LESSON, body(), odd.deps)
  assert.equal(odd.reqs[0].system, buildPhraseHelpSystem(null))
})

// ── 결과 매핑 ────────────────────────────────────────────────────────────────

test('결과 1·2·3개 — 모델이 4개를 내도 앞 3개, 1개면 꼬리표 없이 1개', async () => {
  const one: PhraseHelpResponse = { status: 'OK', items: [{ ja: '友達に会いました。', ko: '친구를 만났어요.', labelKo: null, whyKo: null }] }
  assert.deepEqual(await helpLessonPhrase(U, LESSON, body(), lessonWorld({ data: one }).deps), { items: [{ ja: '友達に会いました。', ko: '친구를 만났어요.' }] })
  assert.equal((await helpLessonPhrase(U, LESSON, body(), lessonWorld().deps)).items.length, 2)
  const four: PhraseHelpResponse = {
    status: 'OK',
    items: [
      { ja: 'お願いします。', ko: '부탁드려요.', labelKo: '정중하게', whyKo: null },
      { ja: 'お願い。', ko: '부탁해.', labelKo: '편하게', whyKo: null },
      { ja: 'よろしくお願いいたします。', ko: '잘 부탁드립니다.', labelKo: '더 공손하게', whyKo: null },
      { ja: 'お願いできますか。', ko: '부탁할 수 있을까요?', labelKo: '다른 표현', whyKo: null },
    ],
  }
  const r = await helpLessonPhrase(U, LESSON, body('부탁한다고 말하고 싶어요'), lessonWorld({ data: four }).deps)
  assert.deepEqual(r.items.map((i) => i.ja), ['お願いします。', 'お願い。', 'よろしくお願いいたします。'])
})

test('거절·못 찾음(NOT_A_PHRASE·UNSAFE·TOO_LONG) → 빈 목록(사유 칸 없음) · Trace 는 OK + outcome 코드', async () => {
  const tooLong: PhraseHelpResponse = { status: 'OK', items: [{ ja: 'あ'.repeat(101) + '。', ko: '아주 긴 말', labelKo: null, whyKo: null }] }
  for (const [want, data] of [
    ['NOT_A_PHRASE', { status: 'NOT_A_PHRASE', items: [] }],
    ['UNSAFE', { status: 'UNSAFE', items: [] }],
    ['TOO_LONG', tooLong],
  ] as const) {
    const w = lessonWorld({ data: data as PhraseHelpResponse })
    const r = await helpLessonPhrase(U, LESSON, body(), w.deps)
    assert.deepEqual(r, { items: [] }, want)
    assert.deepEqual(Object.keys(r), ['items'])
    assert.equal(w.traces[0].status, 'OK')
    assert.equal(w.traces[0].steps[0].outcome, want)
  }
})

test('무효(INVALID — 쓸 수 있는 항목 0) → 502 ENGINE_ERROR PHRASE_INVALID · Trace ERROR', async () => {
  for (const data of [
    { status: 'OK', items: [] },
    { status: 'OK', items: [{ ja: '친구를 만났어요', ko: '친구를 만났어요', labelKo: null, whyKo: null }] },
  ] as PhraseHelpResponse[]) {
    const w = lessonWorld({ data })
    const e = await rejects(helpLessonPhrase(U, LESSON, body(), w.deps), 'ENGINE_ERROR', 'PHRASE_INVALID')
    assert.equal(classifyError(e).status, 502)
    assert.equal(e.userMessage, '일본어 표현을 만들지 못했어요. 다시 시도해 주세요.')
    assert.equal(w.traces[0].status, 'ERROR')
    assert.equal(w.traces[0].errorCode, 'ENGINE_ERROR')
    assert.equal(w.traces[0].steps[0].outcome, 'INVALID')
  }
})

test('엔진 실패: 계약 위반 502 · 사용 불가 502(ENGINE_UNAVAILABLE) · 12초 시간 초과 504 — #180 과 같은 매핑, 봉투에 엔진 이름 없음', async () => {
  const engineName = /claude|haiku|sonnet|opus|anthropic|qwen|ollama|Llm|NoEngine/i
  const cases: Array<[string, number, string | undefined, string]> = [
    ['LlmContractError', 502, undefined, 'ENGINE_ERROR'],
    ['NoEngineAvailableError', 502, 'ENGINE_UNAVAILABLE', 'ENGINE_UNAVAILABLE'], // 단계 코드는 원래 오류의 분류, 응답은 502 로 접힌다(#180 과 같음)
    ['LlmTimeoutError', 504, undefined, 'ENGINE_TIMEOUT'],
  ]
  for (const [name, status, reason, stepCode] of cases) {
    const w = lessonWorld({ complete: async () => Promise.reject(named(name)) })
    const lessonErr = await helpLessonPhrase(U, LESSON, body(), w.deps).then(() => null, (e: unknown) => e)
    const chatErr = await helpPhrase(U, 'chat_ph077', body(), chatWorld('N3', { complete: async () => Promise.reject(named(name)) }).deps).then(() => null, (e: unknown) => e)
    assert.ok(lessonErr instanceof Error, name)
    assert.equal(classifyError(lessonErr).status, status, name)
    if (reason) assert.equal((lessonErr as ApiError).details?.reason, reason, name)
    assert.equal(w.traces[0].steps[0].errorCode, stepCode, name)
    const lessonEnv = JSON.stringify(await toErrorResponse(lessonErr).json())
    const chatEnv = JSON.stringify(await toErrorResponse(chatErr).json())
    assert.equal(lessonEnv, chatEnv, `${name}: 오류 봉투가 #180 과 바이트까지 같다`)
    assert.doesNotMatch(lessonEnv, engineName, name)
  }
})

test('질의가 정리 뒤 비면(프롬프트 입력 오류) 400 VALIDATION queryKo — 엔진 0 · 잠금 해제', async () => {
  const w = lessonWorld()
  const e = await rejects(helpLessonPhrase(U, LESSON, body('​'), w.deps), 'VALIDATION')
  assert.equal(e.details?.field, 'queryKo')
  assert.equal(w.reqs.length, 0)
  assert.equal((await helpLessonPhrase(U, LESSON, body(), lessonWorld().deps)).items.length, 2)
})

// ── 잠금 공유 (B3 A) ──────────────────────────────────────────────────────────

test('잠금 공유: 레슨 도우미가 도는 동안 같은 사용자의 회화(#180)·단어(#181)·레슨 도우미는 409 PHRASE_BUSY(엔진 0) · 다른 사용자는 통과 · 끝나면 풀림', async () => {
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  const l = lessonWorld()
  l.deps.complete = async (req) => (l.calls.push('llm'), l.reqs.push(req), await gate, llmResult(GOOD))
  const first = helpLessonPhrase(U, LESSON, body(), l.deps)
  try {
    await sleep(5)
    assert.equal(l.reqs.length, 1, '레슨 도우미가 엔진 호출 중')
    const c = chatWorld()
    const e1 = await rejects(helpPhrase(U, 'chat_ph077', body(), c.deps), 'CONFLICT', 'PHRASE_BUSY')
    assert.equal(e1.userMessage, '일본어 표현을 찾는 중이에요.')
    assert.equal(c.reqs.length, 0)
    const w = wordWorld()
    await rejects(helpWordPhrase(U, body(), w.deps), 'CONFLICT', 'PHRASE_BUSY')
    assert.equal(w.reqs.length, 0)
    const second = lessonWorld()
    const e3 = await rejects(helpLessonPhrase(U, 'cles_another_lesson_0077', body(), second.deps), 'CONFLICT', 'PHRASE_BUSY')
    assert.equal(classifyError(e3).status, 409)
    assert.deepEqual(second.calls, [], '잠금 앞에서 거절 — 프로필·엔진 접촉 0')
    assert.equal((await helpLessonPhrase(OTHER, LESSON, body(), lessonWorld().deps)).items.length, 2, '다른 사용자')
  } finally {
    release()
  }
  await first
  assert.equal((await helpPhrase(U, 'chat_ph077', body(), chatWorld().deps)).items.length, 2, '끝나면 회화 도우미 다시 가능')
  assert.equal((await helpLessonPhrase(U, LESSON, body(), lessonWorld().deps)).items.length, 2, '끝나면 레슨 도우미 다시 가능')
})

test('잠금 공유(반대): 회화 도우미(#180)·단어 도우미(#181)가 도는 동안 같은 사용자의 레슨 도우미는 409 PHRASE_BUSY(프로필·엔진 0)', async () => {
  for (const which of ['chat', 'word'] as const) {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    let first: Promise<unknown>
    if (which === 'chat') {
      const c = chatWorld()
      c.deps.complete = async (req) => (c.reqs.push(req), await gate, llmResult(GOOD))
      first = helpPhrase(U, 'chat_ph077', body(), c.deps)
    } else {
      const w = wordWorld()
      w.deps.complete = async (req) => (w.reqs.push(req), await gate, llmResult(WORD_GOOD))
      first = helpWordPhrase(U, body(), w.deps)
    }
    try {
      await sleep(5)
      const l = lessonWorld()
      await rejects(helpLessonPhrase(U, LESSON, body(), l.deps), 'CONFLICT', 'PHRASE_BUSY')
      assert.deepEqual(l.calls, [], `${which}: 레슨 도우미는 프로필·엔진에 닿지 않는다`)
    } finally {
      release()
    }
    await first
    assert.equal((await helpLessonPhrase(U, LESSON, body(), lessonWorld().deps)).items.length, 2, `${which}: 끝나면 레슨 도우미 가능`)
  }
})

test('같은 틱에 레슨·회화·단어 도우미 4건을 동시에 시작해도 정확히 1건만 엔진까지 간다(나머지 PHRASE_BUSY)', async () => {
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  const l = lessonWorld()
  l.deps.complete = async (req) => (l.calls.push('llm'), l.reqs.push(req), await gate, llmResult(GOOD))
  const c = chatWorld()
  c.deps.complete = async (req) => (c.reqs.push(req), await gate, llmResult(GOOD))
  const w = wordWorld()
  w.deps.complete = async (req) => (w.reqs.push(req), await gate, llmResult(WORD_GOOD))
  const all = Promise.allSettled([helpLessonPhrase(U, LESSON, body(), l.deps), helpPhrase(U, 'chat_ph077', body(), c.deps), helpWordPhrase(U, body(), w.deps), helpLessonPhrase(U, LESSON, body(), l.deps)])
  try {
    await sleep(10)
    assert.equal(l.reqs.length + c.reqs.length + w.reqs.length, 1)
  } finally {
    release()
  }
  const res = await all
  assert.equal(res.filter((r) => r.status === 'fulfilled').length, 1, JSON.stringify(res.map((r) => r.status)))
  for (const r of res) if (r.status === 'rejected') assert.equal((r.reason as ApiError).details?.reason, 'PHRASE_BUSY')
})

test('잠금은 실패·무효·프로필 읽기 실패 뒤에도 풀린다', async () => {
  await assert.rejects(helpLessonPhrase(U, LESSON, body(), lessonWorld({ complete: async () => Promise.reject(named('LlmTimeoutError')) }).deps))
  assert.equal((await helpLessonPhrase(U, LESSON, body(), lessonWorld().deps)).items.length, 2, '엔진 실패 뒤')
  await assert.rejects(helpLessonPhrase(U, LESSON, body(), lessonWorld({ data: { status: 'OK', items: [] } }).deps))
  assert.equal((await helpLessonPhrase(U, LESSON, body(), lessonWorld().deps)).items.length, 2, 'INVALID 뒤')
  await assert.rejects(helpLessonPhrase(U, LESSON, body(), lessonWorld({ learnerLevel: async () => Promise.reject(new Error('db')) }).deps))
  assert.equal((await helpLessonPhrase(U, LESSON, body(), lessonWorld().deps)).items.length, 2, '프로필 읽기 실패 뒤')
})

// ── 손님 취소 ────────────────────────────────────────────────────────────────

test('손님 취소(signal): 신호가 엔진 요청에 그대로 → 취소되면 409 CANCELLED(오류 로그 0) · 잠금 즉시 해제 · Trace 는 코드만', async () => {
  const ac = new AbortController()
  const seen: { cancelled: boolean; release?: () => void } = { cancelled: false }
  const w = lessonWorld()
  w.deps.complete = abortableEngine(w, seen)
  const logged: string[] = []
  const origError = console.error
  console.error = (...a: unknown[]) => void logged.push(a.map(String).join(' '))
  try {
    const settled = helpLessonPhrase(U, LESSON, body(), w.deps, ac.signal).then(() => null, (e: unknown) => e)
    await sleep(5)
    assert.equal(w.reqs[0].signal, ac.signal, '라우트가 준 신호가 엔진 요청에 그대로')
    ac.abort()
    const err = await settled
    assert.ok(err instanceof ApiError)
    assert.equal(err.code, 'CONFLICT')
    assert.equal(err.details?.reason, 'CANCELLED')
    assert.equal(toErrorResponse(err).status, 409)
  } finally {
    console.error = origError
    seen.release?.()
  }
  assert.equal(seen.cancelled, true)
  assert.deepEqual(logged, [])
  assert.equal((await helpLessonPhrase(U, LESSON, body(), lessonWorld().deps)).items.length, 2, '잠금 해제')
  assert.equal(w.traces[0].errorCode, 'CANCELLED')
  assert.equal(w.traces[0].steps[0].entry, 'lesson', '실패 단계에도 입구 표시')
  assert.ok(!JSON.stringify(w.traces).includes(Q))
})

// ── Trace · 로그 원문 0 ──────────────────────────────────────────────────────

test('Trace: refType phraseHelp · refId = 레슨 id · 단계 entry=lesson·promptVersion=phraseHelp@v1·scene=NONE · mode 칸 없음 — 질의·ja·ko·꼬리표·이유 원문 0', async () => {
  const w = lessonWorld()
  await helpLessonPhrase(U, LESSON, body(), w.deps)
  assert.equal(w.traces.length, 1)
  const t = w.traces[0]
  assert.equal(t.kind, 'TURN')
  assert.equal(t.userId, U)
  assert.equal(t.status, 'OK')
  assert.equal(t.refType, 'phraseHelp')
  assert.equal(t.refId, LESSON)
  const step = t.steps[0]
  assert.equal(step.name, 'PHRASE_HELP')
  assert.equal(step.entry, 'lesson')
  assert.equal(step.promptVersion, PHRASE_HELP_PROMPT_VERSION)
  assert.equal(step.scene, 'NONE')
  assert.ok(!('mode' in step), '단어 모드 표시 없음')
  assert.equal(step.outcome, 'OK')
  for (const v of Object.values(step)) assert.ok(v === null || v === undefined || ['string', 'number', 'boolean'].includes(typeof v))
  const s = JSON.stringify(w.traces)
  for (const x of [Q, '週末に友達', '친구를 만났어요', '정중하게', '지난 일을']) assert.ok(!s.includes(x), `Trace 원문 없음: ${x}`)
})

test('로그: 성공·거절·무효·시간 초과·취소 어느 경로에도 질의·표현·뜻이 console 로 나가지 않는다', async () => {
  const out: string[] = []
  const keep = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug }
  const sink = (...a: unknown[]) => void out.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '))
  console.log = console.info = console.warn = console.error = console.debug = sink
  try {
    await helpLessonPhrase(U, LESSON, body(), lessonWorld().deps)
    await helpLessonPhrase(U, LESSON, body(), lessonWorld({ data: { status: 'NOT_A_PHRASE', items: [] } }).deps)
    await assert.rejects(helpLessonPhrase(U, LESSON, body(), lessonWorld({ data: { status: 'OK', items: [] } }).deps))
    await assert.rejects(helpLessonPhrase(U, LESSON, body(), lessonWorld({ complete: async () => Promise.reject(named('LlmTimeoutError')) }).deps))
    const ac = new AbortController()
    ac.abort()
    const w = lessonWorld()
    w.deps.complete = abortableEngine(w, { cancelled: false })
    await assert.rejects(helpLessonPhrase(U, LESSON, body(), w.deps, ac.signal))
  } finally {
    Object.assign(console, keep)
  }
  const all = out.join('\n')
  for (const x of [Q, '週末に友達', '친구를 만났어요']) assert.ok(!all.includes(x), `로그 원문 없음: ${x}`)
})

// ── 저장 없음 ────────────────────────────────────────────────────────────────

test('저장 없음: 레슨 도우미 함수 소스에 DB·학습 기록 쓰기·console 이 없고, 의존은 프로필 읽기·엔진·Trace 셋뿐', () => {
  const fn = code(SERVICE).split('export async function helpLessonPhrase')[1].split('async function runPhraseHelp')[0]
  assert.ok(fn.length > 0)
  for (const b of [/\bprisma\b/, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/, /\$transaction/, /studyLog|statsSnapshot|repetitionItem|wordEntry|lesson\.|progress/i, /console\./]) assert.ok(!b.test(fn), `helpLessonPhrase: ${b}`)
  const l = lessonWorld()
  assert.deepEqual(Object.keys(l.deps).sort(), ['complete', 'learnerLevel', 'trace'])
})
