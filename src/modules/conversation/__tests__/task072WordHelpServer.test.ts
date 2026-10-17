/**
 * task-072 #181 단어 추가 시트의 일본어 도우미 — 서버 입구(`helpWordPhrase`)·라우트 배선 단위 시험(DB·LLM 없음, 가짜 deps).
 * 프롬프트·보정 자체(단어 모드 지시문·표제어 검사)는 `phraseHelpWord.test.ts`(prompt-engineer) 몫, 회화 도우미(`helpPhrase`)는 `task056PhraseHelp.test.ts` 가 그대로 지킨다 —
 * 여기서는 ① 채팅 의존이 없는 입구 ② 회화 도우미와 **잠금·한도 공유** ③ 모드·수준·장면 고정 ④ 취소·오류 매핑 ⑤ 원문 미보관 ⑥ 라우트 순서(401 → 400 → 한도 → 호출)를 본다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ApiError, classifyError, rateLimit, readJsonObject, toErrorResponse } from '@/modules/infra'
import type { LlmJsonRequest, LlmJsonResult, TraceRecord } from '@/modules/engine'
import { buildPhraseHelpSystem, PHRASE_HELP_PROMPT_VERSION, PHRASE_HELP_WORD_PROMPT_VERSION, phraseHelpPromptVersion } from '../prompts/phraseHelp'
import type { PhraseHelpResponse } from '../structuredResponse/phraseHelp'
import { runJsonWithRetry } from '../../engine/json/schemaValidate'
import { helpPhrase, helpWordPhrase, readPhraseHelpBody, type PhraseHelpDeps, type WordPhraseHelpDeps } from '../chats/phraseHelp'
import * as conversation from '../index'

const U = 'cuser0000000000000000p072'
const OTHER = 'cuser_other_00000000p072'
const Q = '임팩트'
const CHAT_Q = '커피 한 잔 주문하고 싶어요'
const CHAT_AT = new Date('2026-10-11T01:00:00Z')

const WORD_GOOD: PhraseHelpResponse = {
  status: 'OK',
  items: [
    { ja: 'インパクト', ko: '강한 영향이나 효과', labelKo: null, whyKo: null },
    { ja: '影響', ko: '미치는 영향이나 결과', labelKo: null, whyKo: null },
  ],
}
const CHAT_GOOD: PhraseHelpResponse = {
  status: 'OK',
  items: [
    { ja: 'コーヒーを一つお願いします。', ko: '커피 한 잔 부탁드려요.', labelKo: '정중하게', whyKo: '주문할 때 가장 흔히 쓰는 말이에요.' },
    { ja: 'コーヒーください。', ko: '커피 주세요.', labelKo: '편하게', whyKo: null },
  ],
}

const llmResult = <T>(data: T): LlmJsonResult<T> => ({ data, connectionKey: 'conn', model: 'm', elapsedMs: 1, promptChars: 100, attempts: 1 })
const named = (name: string) => Object.assign(new Error('x'), { name })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const body = (q = Q) => ({ queryKo: q })

/** 단어 도우미 가짜 — 의존 타입이 `learnerLevel`·`complete`·`trace` 셋뿐이라 채팅·역할극을 읽는 칸 자체가 없다. */
function wordWorld(over: Partial<WordPhraseHelpDeps> & { data?: PhraseHelpResponse; level?: string } = {}) {
  const { data, level, ...rest } = over
  const calls: string[] = []
  const reqs: LlmJsonRequest<PhraseHelpResponse>[] = []
  const traces: TraceRecord[] = []
  const deps: WordPhraseHelpDeps = {
    learnerLevel: async () => (calls.push('profile'), level ?? 'N3'),
    complete: async (req) => (calls.push('llm'), reqs.push(req), llmResult(data ?? WORD_GOOD)),
    trace: async (t) => void traces.push(t),
    ...rest,
  }
  return { deps, calls, reqs, traces }
}

/** 회화 도우미 가짜(잠금 공유 시험용). */
function chatWorld(over: Partial<PhraseHelpDeps> = {}) {
  const calls: string[] = []
  const reqs: LlmJsonRequest<PhraseHelpResponse>[] = []
  const traces: TraceRecord[] = []
  const chat = { id: 'chat_ph', kind: 'TALK', level: 'N4', scenarioId: null, createdAt: CHAT_AT, endedAt: null }
  const deps: PhraseHelpDeps = {
    readChat: async (userId, chatId) => (calls.push('chat'), userId === U && chatId === chat.id ? (chat as never) : null),
    isEnded: async () => (calls.push('ended'), false),
    readMaterial: async () => (calls.push('material'), null),
    learnerLevel: async () => (calls.push('profile'), 'N5'),
    complete: async (req) => (calls.push('llm'), reqs.push(req), llmResult(CHAT_GOOD)),
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

/** 엔진(claudeCli)과 같은 약속의 가짜 — `signal` 이 abort 되면 name 'AbortError' 로 거절한다. 신호가 안 오는 결함이어도 1초 뒤 스스로 거절해 시험이 멈추지 않는다. */
function abortableEngine(w: { calls: string[]; reqs: LlmJsonRequest<PhraseHelpResponse>[] }, seen: { cancelled: boolean; release?: () => void }): WordPhraseHelpDeps['complete'] {
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

/** 소스에서 주석을 걷어 코드만 본다. */
const code = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
const ROUTE_WORD = 'src/app/api/v1/words/phrase-help/route.ts'
const ROUTE_CHAT = 'src/app/api/v1/chats/[id]/phrase-help/route.ts'
const SERVICE = 'src/modules/conversation/chats/phraseHelp.ts'

// ── 공개 API · 버전 ──────────────────────────────────────────────────────────

test('conversation index 로만 라우트가 부른다: helpWordPhrase·버전 라벨·모드 판정이 공개 API 에 있고 회화 쪽 값은 그대로', () => {
  assert.equal(typeof conversation.helpWordPhrase, 'function')
  assert.equal(typeof conversation.helpPhrase, 'function')
  assert.equal(typeof conversation.isWordMode, 'function')
  assert.equal(conversation.isWordMode('word'), true)
  assert.equal(conversation.isWordMode('phrase'), false)
  assert.equal(conversation.PHRASE_HELP_WORD_PROMPT_VERSION, 'phraseHelp@v2')
  assert.equal(conversation.PHRASE_HELP_PROMPT_VERSION, 'phraseHelp@v1')
  assert.equal(conversation.phraseHelpPromptVersion('word'), 'phraseHelp@v2')
  assert.equal(conversation.phraseHelpPromptVersion(undefined), 'phraseHelp@v1')
})

// ── 입구: 채팅 의존 없음 · 모드/수준/장면 고정 ───────────────────────────────

test('정상: 채팅·역할극을 읽지 않고(프로필 수준 1회·엔진 1회) 단어 모드 요청이 엔진까지 간다 — task·persona·system·본문·traceId', async () => {
  const w = wordWorld()
  const r = await helpWordPhrase(U, body(), w.deps)
  assert.deepEqual(w.calls, ['profile', 'llm'])
  assert.equal(w.reqs.length, 1)
  const req = w.reqs[0]
  assert.equal(req.task, 'phraseHelp')
  assert.equal(req.persona?.name, 'phrase-help-word', '단어 모드 페르소나')
  assert.equal(req.system, buildPhraseHelpSystem('N3', 'word'), '단어 모드 system(수준 N3)')
  assert.notEqual(req.system, buildPhraseHelpSystem('N3'), '회화 모드 system 이 아니다')
  assert.deepEqual(req.messages, [{ role: 'user', content: `찾을 낱말(한국어): ${Q}` }])
  assert.ok(typeof req.traceId === 'string' && req.traceId.length > 0)
  assert.ok(!('signal' in req), '신호를 안 주면 요청에 signal 칸이 없다')
  assert.deepEqual(r, { items: [{ ja: 'インパクト', ko: '강한 영향이나 효과' }, { ja: '影響', ko: '미치는 영향이나 결과' }] })
})

test('모드는 서버가 word 로 고정한다: 본문에 mode 를 실어 보내도(검증을 우회한 호출 포함) 회화 모드가 되지 않고, 본문 검사는 모르는 키 mode 를 400 으로 막는다', async () => {
  const w = wordWorld()
  await helpWordPhrase(U, { queryKo: Q, mode: 'phrase', scene: { learnerRole: '손님', partnerRole: '점원', goalKo: '주문' } } as never, w.deps)
  assert.equal(w.reqs[0].persona?.name, 'phrase-help-word')
  assert.equal(w.reqs[0].system, buildPhraseHelpSystem('N3', 'word'))
  assert.ok(!w.reqs[0].messages[0].content.includes('장면'), '장면 줄 없음(scene = null)')
  assert.throws(() => readPhraseHelpBody({ queryKo: Q, mode: 'word' }), (e: unknown) => e instanceof ApiError && e.code === 'VALIDATION' && e.details?.reason === 'unknown_key')
  const fn = code(SERVICE).split('export async function helpWordPhrase')[1]
  assert.match(fn, /mode: 'word'/)
  assert.doesNotMatch(fn, /body\.(mode|scene)/, '본문이 모드·장면을 정하지 않는다')
})

test('수준은 프로필에서: learnerLevel 값이 system 에 반영되고(N5 ≠ N2), 알 수 없는 값은 수준 없음과 같다', async () => {
  const a = wordWorld({ level: 'N5' })
  const b = wordWorld({ level: 'N2' })
  await helpWordPhrase(U, body(), a.deps)
  await helpWordPhrase(U, body(), b.deps)
  assert.equal(a.reqs[0].system, buildPhraseHelpSystem('N5', 'word'))
  assert.equal(b.reqs[0].system, buildPhraseHelpSystem('N2', 'word'))
  assert.notEqual(a.reqs[0].system, b.reqs[0].system)
  const odd = wordWorld({ level: 'ZZ' })
  await helpWordPhrase(U, body(), odd.deps)
  assert.equal(odd.reqs[0].system, buildPhraseHelpSystem(null, 'word'))
})

test('질의는 정리(공백·줄바꿈)된 채 한 줄로 들어간다 — 앞뒤 공백 제거', async () => {
  const w = wordWorld()
  await helpWordPhrase(U, body('   임팩트  '), w.deps)
  assert.equal(w.reqs[0].messages[0].content, '찾을 낱말(한국어): 임팩트')
})

// ── 결과 매핑 ────────────────────────────────────────────────────────────────

test('응답 매핑: 항목은 {ja, ko} 뿐 — 모델이 labelKo·whyKo 를 내도 키가 없다 · 4개를 내도 앞 3개', async () => {
  const withLabels: PhraseHelpResponse = {
    status: 'OK',
    items: [
      { ja: 'インパクト', ko: '강한 영향이나 효과', labelKo: '정중하게', whyKo: '이유예요.' },
      { ja: '影響', ko: '미치는 영향이나 결과', labelKo: '편하게', whyKo: null },
    ],
  }
  const a = await helpWordPhrase(U, body(), wordWorld({ data: withLabels }).deps)
  for (const it of a.items) assert.deepEqual(Object.keys(it).sort(), ['ja', 'ko'])
  const four: PhraseHelpResponse = {
    status: 'OK',
    items: ['インパクト', '影響', '衝撃', '効果'].map((ja, i) => ({ ja, ko: ['강한 영향이나 효과', '미치는 영향이나 결과', '강한 충격이나 자극', '일의 보람이나 결과'][i], labelKo: null, whyKo: null })),
  }
  const b = await helpWordPhrase(U, body(), wordWorld({ data: four }).deps)
  assert.equal(b.items.length, 3)
  assert.equal(b.items[0].ja, 'インパクト')
  const one: PhraseHelpResponse = { status: 'OK', items: [{ ja: '雰囲気', ko: '어떤 장소나 상황이 풍기는 분위기', labelKo: null, whyKo: null }] }
  assert.equal((await helpWordPhrase(U, body('분위기'), wordWorld({ data: one }).deps)).items.length, 1)
})

test('거절 3종(NOT_A_PHRASE·UNSAFE·빈 OK) → 200 빈 목록(사유 구분 없음) · Trace 에만 코드', async () => {
  for (const status of ['NOT_A_PHRASE', 'UNSAFE'] as const) {
    const w = wordWorld({ data: { status, items: [] } })
    assert.deepEqual(await helpWordPhrase(U, body(), w.deps), { items: [] })
    assert.equal(w.traces[0].status, 'OK')
    assert.equal(w.traces[0].steps[0].outcome, status)
  }
})

test('INVALID(쓸 수 있는 표제어 0 + 문장형 말고 다른 위반 — 한글 ja·항목 모양·뜻 오류) → 502 ENGINE_ERROR · Trace ERROR', async () => {
  const hangul = wordWorld({ data: { status: 'OK', items: [{ ja: '임팩트', ko: '강한 영향', labelKo: null, whyKo: null }] } })
  const e = await rejects(helpWordPhrase(U, body('스트레스'), hangul.deps), 'ENGINE_ERROR', 'PHRASE_INVALID')
  assert.equal(classifyError(e).status, 502)
  assert.equal(hangul.traces[0].status, 'ERROR')
  assert.equal(hangul.traces[0].errorCode, 'ENGINE_ERROR')
  assert.equal(hangul.traces[0].steps[0].outcome, 'INVALID')
  // 문장형(JA_NOT_WORD)에 항목 모양(ITEM_SHAPE)·뜻 오류(KO_BAD)가 섞이면 빈 목록이 아니라 예전처럼 INVALID → 502.
  const thanks = { ja: 'ありがとうございます', ko: '감사합니다', labelKo: null, whyKo: null }
  const mixes: Array<[string, unknown]> = [
    ['ITEM_SHAPE', null],
    ['KO_BAD', { ja: 'ありがとう', ko: 'ありがとう', labelKo: null, whyKo: null }],
    ['JA_HANGUL', { ja: '감사', ko: '감사', labelKo: null, whyKo: null }],
  ]
  for (const [label, extra] of mixes) {
    const w = wordWorld({ data: { status: 'OK', items: [thanks, extra as never] } })
    const err = await rejects(helpWordPhrase(U, body('감사합니다'), w.deps), 'ENGINE_ERROR', 'PHRASE_INVALID')
    assert.equal(classifyError(err).status, 502, label)
    assert.equal(w.traces[0].steps[0].outcome, 'INVALID', label)
    assert.match(String(w.traces[0].steps[0].dropReasons), /JA_NOT_WORD/, label)
  }
})

test('NOT_A_WORD(감사 M-1): 모델이 정형 인사 한 개(ありがとうございます)만 내면 502 가 아니라 200 빈 목록 — Trace 는 OK·outcome NOT_A_WORD·JA_NOT_WORD(원문 0)·잠금 해제', async () => {
  for (const [q, ja] of [['감사합니다', 'ありがとうございます'], ['죄송합니다', 'すみません'], ['잘 먹겠습니다', 'いただきます']] as const) {
    const w = wordWorld({ data: { status: 'OK', items: [{ ja, ko: '인사말', labelKo: null, whyKo: null }] } })
    assert.deepEqual(await helpWordPhrase(U, body(q), w.deps), { items: [] }, q)
    assert.equal(w.reqs.length, 1)
    assert.equal(w.traces.length, 1)
    assert.equal(w.traces[0].status, 'OK', 'Trace 는 오류가 아니다')
    assert.equal(w.traces[0].errorCode, null)
    const step = w.traces[0].steps[0]
    assert.equal(step.outcome, 'NOT_A_WORD')
    assert.equal(step.dropReasons, 'JA_NOT_WORD')
    assert.equal(step.itemsKept, 0)
    assert.equal(step.mode, 'word')
    const flat = JSON.stringify(w.traces)
    for (const x of [q, ja, '인사말']) assert.ok(!flat.includes(x), `Trace 원문 없음: ${x}`)
  }
  assert.equal((await helpWordPhrase(U, body(), wordWorld().deps)).items.length, 2, '끝나면 다시 가능(잠금 해제)')
})

// ── 엔진과 같은 재시도 규칙(진짜 runJsonWithRetry + ajv + 요청이 만든 extraCheck)으로 본 정형 인사 경로 ─────────────────────

/** 모델이 `responses` 를 차례로 내는 가짜(마지막 응답을 되풀이) — 엔진의 JSON 재시도 루프는 진짜다. `modelCalls` 가 모델 호출 수(첫 시도+재시도). */
function retryingEngine(responses: unknown[]) {
  const state = { modelCalls: 0 }
  const complete: WordPhraseHelpDeps['complete'] = async (req) => {
    const r = await runJsonWithRetry<PhraseHelpResponse>(
      async () => JSON.stringify(responses[Math.min(state.modelCalls++, responses.length - 1)]),
      {
        schema: req.jsonSchema as object,
        extraCheck: (d, info) => req.extraCheck?.(d as PhraseHelpResponse, { ...info, traceId: 't' }) ?? [],
        stripAdditionalProperties: req.stripAdditionalProperties === true,
      },
    )
    return { data: r.data, connectionKey: 'conn', model: 'm', elapsedMs: 1, promptChars: 100, attempts: r.attempts }
  }
  return { state, complete }
}

/** 재시도 루프가 찍는 `[json] …` 경고를 모아 질의·표현 원문이 없는지 보고 소리를 숨긴다. */
async function quietly<T>(run: () => Promise<T>): Promise<{ result: T; warns: string[] }> {
  const warns: string[] = []
  const keep = console.warn
  console.warn = (...a: unknown[]) => void warns.push(a.map(String).join(' '))
  try {
    return { result: await run(), warns }
  } finally {
    console.warn = keep
  }
}

const THANKS_ITEM = { ja: 'ありがとうございます', ko: '감사합니다', labelKo: null, whyKo: null }
const THANKS: PhraseHelpResponse = { status: 'OK', items: [THANKS_ITEM] }

test('정형 인사만 두 번 나오면(재시도 뒤에도) 502 가 아니라 200 빈 목록 — 모델 호출은 정확히 2번(첫 시도+재시도), Trace attempts 2', async () => {
  const eng = retryingEngine([THANKS, THANKS])
  const w = wordWorld({ complete: eng.complete })
  const { result, warns } = await quietly(() => helpWordPhrase(U, body('감사합니다'), w.deps))
  assert.deepEqual(result, { items: [] })
  assert.equal(eng.state.modelCalls, 2, '재시도는 그대로 한 번 한다 — 첫 시도 위반 → 재시도 1회')
  assert.equal(warns.length, 1, '재시도 경고 1건')
  assert.ok(warns.every((x) => !x.includes('ありがとう') && !x.includes('감사')), '경고에는 고정 문장만')
  const step = w.traces[0].steps[0]
  assert.equal(w.traces[0].status, 'OK')
  assert.equal(step.attempts, 2)
  assert.equal(step.outcome, 'NOT_A_WORD')
  assert.equal(step.dropReasons, 'JA_NOT_WORD')
})

test('정형 인사 뒤 재시도가 표제어를 내면 그 표제어(재시도가 살아 있다) · 처음부터 표제어면 재시도 없이 1번', async () => {
  const rescued = retryingEngine([THANKS, { status: 'OK', items: [{ ja: 'ありがとう', ko: '고맙다는 인사말', labelKo: null, whyKo: null }] }])
  const w1 = wordWorld({ complete: rescued.complete })
  const { result } = await quietly(() => helpWordPhrase(U, body('감사합니다'), w1.deps))
  assert.deepEqual(result, { items: [{ ja: 'ありがとう', ko: '고맙다는 인사말' }] })
  assert.equal(rescued.state.modelCalls, 2)
  assert.equal(w1.traces[0].steps[0].attempts, 2)
  assert.equal(w1.traces[0].steps[0].outcome, 'OK')

  const direct = retryingEngine([WORD_GOOD])
  const w2 = wordWorld({ complete: direct.complete })
  assert.equal((await helpWordPhrase(U, body(), w2.deps)).items.length, 2)
  assert.equal(direct.state.modelCalls, 1, '위반이 없으면 재시도하지 않는다')
  assert.equal(w2.traces[0].steps[0].attempts, 1)
})

test('정형 인사에 다른 위반이 섞인 응답은 재시도 뒤에도 502(엔진이 던짐) — 모델 호출 2번, Trace ERROR · 잠금 해제', async () => {
  const mixes: Array<[string, unknown]> = [
    ['JA_HANGUL', { ja: '감사', ko: '감사합니다', labelKo: null, whyKo: null }],
    ['KO_BAD', { ja: 'ありがとう', ko: 'ありがとう', labelKo: null, whyKo: null }],
    ['ITEM_SHAPE(스키마도 거부)', null],
  ]
  for (const [label, extra] of mixes) {
    const eng = retryingEngine([{ status: 'OK', items: [THANKS_ITEM, extra] }])
    const w = wordWorld({ complete: eng.complete })
    const { result } = await quietly(() => helpWordPhrase(U, body('감사합니다'), w.deps).then(() => 'resolved', (e: Error) => e))
    assert.notEqual(result, 'resolved', `${label}: 빈 목록이 아니라 오류여야 한다`)
    assert.equal(classifyError(result as Error).status, 502, label)
    assert.equal(eng.state.modelCalls, 2, label)
    assert.equal(w.traces[0].status, 'ERROR', label)
    assert.equal(w.traces[0].steps[0].errorCode, 'ENGINE_ERROR', label)
  }
  assert.equal((await helpWordPhrase(U, body(), wordWorld().deps)).items.length, 2, '실패 뒤 잠금 해제')
})

// ── 같은 틱 동시 호출 원자성 (REV-072S L-1) ───────────────────────────────────

test('같은 틱에 같은 사용자의 단어 도우미 3건을 동시에 시작해도 정확히 1건만 통과한다 — 나머지는 409 PHRASE_BUSY(프로필·엔진 접촉 0)', async () => {
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  const w = wordWorld()
  w.deps.complete = async (req) => (w.calls.push('llm'), w.reqs.push(req), await gate, llmResult(WORD_GOOD))
  const all = Promise.allSettled([helpWordPhrase(U, body(), w.deps), helpWordPhrase(U, body(), w.deps), helpWordPhrase(U, body(), w.deps)])
  try {
    await sleep(10)
    assert.equal(w.reqs.length, 1, '엔진까지 간 호출은 정확히 1건')
    assert.equal(w.calls.filter((c) => c === 'profile').length, 1, '프로필 읽기도 통과한 1건만')
  } finally {
    release() // 단언이 깨져도 문을 열어 잠금을 풀어 둔다 — 안 그러면 뒤 시험이 연쇄로 PHRASE_BUSY 로 깨져 진짜 원인이 묻힌다.
  }
  const res = await all
  const ok = res.filter((r) => r.status === 'fulfilled')
  const busy = res.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
  assert.equal(ok.length, 1, JSON.stringify(res.map((r) => r.status)))
  assert.equal(busy.length, 2)
  for (const r of busy) {
    assert.ok(r.reason instanceof ApiError)
    assert.equal(r.reason.code, 'CONFLICT')
    assert.equal(r.reason.details?.reason, 'PHRASE_BUSY')
  }
  assert.equal((await helpWordPhrase(U, body(), wordWorld().deps)).items.length, 2, '끝나면 다시 가능')
})

test('동시 호출 원자성(섞어서): 같은 틱의 단어·회화 도우미 4건 중 1건만 통과 · 사용자가 다르면 동시에 모두 통과', async () => {
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  const w = wordWorld()
  w.deps.complete = async (req) => (w.calls.push('llm'), w.reqs.push(req), await gate, llmResult(WORD_GOOD))
  const c = chatWorld()
  c.deps.complete = async (req) => (c.calls.push('llm'), c.reqs.push(req), await gate, llmResult(CHAT_GOOD))
  const all = Promise.allSettled([
    helpWordPhrase(U, body(), w.deps),
    helpPhrase(U, 'chat_ph', body(CHAT_Q), c.deps),
    helpWordPhrase(U, body(), w.deps),
    helpPhrase(U, 'chat_ph', body(CHAT_Q), c.deps),
  ])
  try {
    await sleep(10)
    assert.equal(w.reqs.length + c.reqs.length, 1, '두 도우미를 통틀어 엔진까지 간 호출은 정확히 1건')
  } finally {
    release()
  }
  const res = await all
  assert.equal(res.filter((r) => r.status === 'fulfilled').length, 1, JSON.stringify(res.map((r) => r.status)))
  for (const r of res) if (r.status === 'rejected') assert.equal((r.reason as ApiError).details?.reason, 'PHRASE_BUSY')

  // 다른 사용자끼리는 같은 틱에도 서로 막지 않는다.
  const many = await Promise.all([U, OTHER, 'cuser_third_000000000p072'].map((u) => helpWordPhrase(u, body(), wordWorld().deps)))
  assert.deepEqual(many.map((r) => r.items.length), [2, 2, 2])
})

test('엔진 실패: 계약 위반 502 · 사용 불가(422)도 502 · 12초 시간 초과 504 — 회화 도우미와 같은 매핑·Trace 단계 errorCode', async () => {
  const contract = wordWorld({ complete: async () => Promise.reject(named('LlmContractError')) })
  await assert.rejects(helpWordPhrase(U, body(), contract.deps), (e: Error) => classifyError(e).status === 502)
  assert.equal(contract.traces[0].steps[0].errorCode, 'ENGINE_ERROR')

  const un = wordWorld({ complete: async () => Promise.reject(named('NoEngineAvailableError')) })
  const e2 = await rejects(helpWordPhrase(U, body(), un.deps), 'ENGINE_ERROR', 'ENGINE_UNAVAILABLE')
  assert.equal(classifyError(e2).status, 502)

  const slow = wordWorld({ complete: async () => Promise.reject(named('LlmTimeoutError')) })
  await assert.rejects(helpWordPhrase(U, body(), slow.deps), (e: Error) => classifyError(e).status === 504)
  assert.equal(slow.traces[0].errorCode, 'ENGINE_TIMEOUT')
  assert.equal(slow.traces[0].steps[0].errorCode, 'ENGINE_TIMEOUT')
})

test('질의가 정리 뒤 비면(프롬프트 입력 오류) 400 VALIDATION — 엔진 0', async () => {
  const w = wordWorld()
  const e = await rejects(helpWordPhrase(U, body('​'), w.deps), 'VALIDATION')
  assert.equal(e.details?.field, 'queryKo')
  assert.equal(w.reqs.length, 0)
})

// ── 잠금 공유 (L3) ───────────────────────────────────────────────────────────

test('잠금 공유(L3): 회화 도우미가 도는 동안 같은 사용자의 단어 도우미는 409 PHRASE_BUSY(프로필·엔진 접촉 0) · 다른 사용자는 막지 않음 · 끝나면 풀림', async () => {
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  const c = chatWorld()
  c.deps.complete = async (req) => (c.calls.push('llm'), c.reqs.push(req), await gate, llmResult(CHAT_GOOD))
  const first = helpPhrase(U, 'chat_ph', body(CHAT_Q), c.deps)
  try {
    await sleep(5)
    assert.equal(c.reqs.length, 1, '회화 도우미가 엔진 호출 중')
    const w = wordWorld()
    const e = await rejects(helpWordPhrase(U, body(), w.deps), 'CONFLICT', 'PHRASE_BUSY')
    assert.equal(e.userMessage, '일본어 표현을 찾는 중이에요.')
    assert.equal(classifyError(e).status, 409)
    assert.deepEqual(w.calls, [], '잠금 앞에서 거절 — 프로필·엔진 모두 접촉 0')
    assert.equal((await helpWordPhrase(OTHER, body(), wordWorld().deps)).items.length, 2, '다른 사용자')
  } finally {
    release()
  }
  await first
  assert.equal((await helpWordPhrase(U, body(), wordWorld().deps)).items.length, 2, '끝나면 단어 도우미도 다시 가능')
})

test('잠금 공유(L3, 반대 방향): 단어 도우미가 도는 동안 같은 사용자의 회화 도우미도 409 PHRASE_BUSY(엔진 0) · 단어 도우미끼리도 동시 1건', async () => {
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  const w = wordWorld()
  w.deps.complete = async (req) => (w.calls.push('llm'), w.reqs.push(req), await gate, llmResult(WORD_GOOD))
  const first = helpWordPhrase(U, body(), w.deps)
  try {
    await sleep(5)
    assert.equal(w.reqs.length, 1, '단어 도우미가 엔진 호출 중')
    const c = chatWorld()
    await rejects(helpPhrase(U, 'chat_ph', body(CHAT_Q), c.deps), 'CONFLICT', 'PHRASE_BUSY')
    assert.equal(c.reqs.length, 0, '회화 도우미는 엔진까지 가지 않는다')
    const second = wordWorld()
    await rejects(helpWordPhrase(U, body(), second.deps), 'CONFLICT', 'PHRASE_BUSY')
    assert.deepEqual(second.calls, [])
    // 판정 순서는 회화 도우미 그대로 — 없는 방은 잠금보다 먼저 404.
    await assert.rejects(helpPhrase(U, 'chat_none', body(CHAT_Q), chatWorld().deps), (e: Error) => classifyError(e).status === 404)
  } finally {
    release()
  }
  await first
  assert.equal((await helpPhrase(U, 'chat_ph', body(CHAT_Q), chatWorld().deps)).items.length, 2, '끝나면 회화 도우미도 다시 가능')
})

test('잠금은 실패·취소·INVALID 뒤에도 풀린다(단어 도우미)', async () => {
  const failing = wordWorld({ complete: async () => Promise.reject(named('LlmTimeoutError')) })
  await assert.rejects(helpWordPhrase(U, body(), failing.deps))
  assert.equal((await helpWordPhrase(U, body(), wordWorld().deps)).items.length, 2, '엔진 실패 뒤')

  const invalid = wordWorld({ data: { status: 'OK', items: [] } })
  await assert.rejects(helpWordPhrase(U, body(), invalid.deps))
  assert.equal((await helpWordPhrase(U, body(), wordWorld().deps)).items.length, 2, 'INVALID 뒤')

  const profileFails = wordWorld({ learnerLevel: async () => Promise.reject(new Error('db')) })
  await assert.rejects(helpWordPhrase(U, body(), profileFails.deps))
  assert.equal((await helpWordPhrase(U, body(), wordWorld().deps)).items.length, 2, '프로필 읽기 실패 뒤')

  const bad = wordWorld()
  await rejects(helpWordPhrase(U, body('​'), bad.deps), 'VALIDATION')
  assert.equal((await helpWordPhrase(U, body(), wordWorld().deps)).items.length, 2, '입력 오류 뒤')
})

// ── 손님 취소 ────────────────────────────────────────────────────────────────

test('손님 취소(signal): 신호가 엔진 요청까지 그대로 전달 → 취소되면 분류된 409 CANCELLED(500·오류 로그 0) · 잠금 즉시 해제 · Trace 는 코드만', async () => {
  const ac = new AbortController()
  const seen: { cancelled: boolean; release?: () => void } = { cancelled: false }
  const w = wordWorld()
  w.deps.complete = abortableEngine(w, seen)
  const logged: string[] = []
  const origError = console.error
  console.error = (...a: unknown[]) => void logged.push(a.map(String).join(' '))
  let err: unknown
  try {
    const settled = helpWordPhrase(U, body(), w.deps, ac.signal).then(() => null, (e: unknown) => e)
    await sleep(5)
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
    ac.abort()
    seen.release?.()
  }
  assert.equal(seen.cancelled, true, '엔진이 취소를 받았다')
  assert.deepEqual(logged, [], '취소는 오류 로그를 내지 않는다')

  assert.equal((await helpWordPhrase(U, body(), wordWorld().deps)).items.length, 2, '잠금 해제 — PHRASE_BUSY 아님')
  assert.equal(w.traces.length, 1)
  assert.equal(w.traces[0].status, 'ERROR')
  assert.equal(w.traces[0].errorCode, 'CANCELLED')
  assert.equal(w.traces[0].steps[0].errorCode, 'CANCELLED')
  assert.equal(w.traces[0].steps[0].mode, 'word', '실패 단계에도 모드가 남는다')
  const t = JSON.stringify(w.traces)
  assert.ok(!t.includes(Q), 'Trace 원문 없음')
})

test('손님 취소: 호출 전에 이미 끊긴 신호도 같은 길(409 CANCELLED, 잠금 해제) · 신호가 살아 있는데 AbortError 가 새면 취소가 아니라 INTERNAL 500(오류 로그 있음)', async () => {
  const ac = new AbortController()
  ac.abort()
  const seen: { cancelled: boolean; release?: () => void } = { cancelled: false }
  const w = wordWorld()
  w.deps.complete = abortableEngine(w, seen)
  await rejects(helpWordPhrase(U, body(), w.deps, ac.signal), 'CONFLICT', 'CANCELLED')
  assert.equal(seen.cancelled, true)

  const live = new AbortController()
  const leaky = wordWorld({ complete: async () => Promise.reject(named('AbortError')) })
  const logged: string[] = []
  const origError = console.error
  console.error = (...x: unknown[]) => void logged.push(x.map(String).join(' '))
  let err: unknown
  let status: number
  try {
    err = await helpWordPhrase(U, body(), leaky.deps, live.signal).then(() => null, (e: unknown) => e)
    status = toErrorResponse(err).status
  } finally {
    console.error = origError
  }
  assert.equal(classifyError(err).code, 'INTERNAL')
  assert.equal(status, 500, '409 로 둔갑하지 않는다')
  assert.equal(logged.length, 1)
  assert.equal((await helpWordPhrase(U, body(), wordWorld().deps)).items.length, 2, '잠금 해제')
})

// ── Trace · 원문 미보관 (L5) ─────────────────────────────────────────────────

test('Trace: 방이 없어 refId null · refType phraseHelp · 단계에 mode=word·promptVersion=phraseHelp@v2·scene=NONE — 질의·ja·ko 원문 0', async () => {
  const w = wordWorld()
  await helpWordPhrase(U, body(), w.deps)
  assert.equal(w.traces.length, 1)
  const t = w.traces[0]
  assert.equal(t.kind, 'TURN')
  assert.equal(t.userId, U)
  assert.equal(t.status, 'OK')
  assert.equal(t.refType, 'phraseHelp')
  assert.equal(t.refId, null)
  const step = t.steps[0]
  assert.equal(step.name, 'PHRASE_HELP')
  assert.equal(step.mode, 'word')
  assert.equal(step.promptVersion, PHRASE_HELP_WORD_PROMPT_VERSION)
  assert.equal(step.scene, 'NONE')
  assert.equal(step.outcome, 'OK')
  assert.equal(step.itemsKept, 2)
  for (const v of Object.values(step)) assert.ok(v === null || v === undefined || ['string', 'number', 'boolean'].includes(typeof v))
  const s = JSON.stringify(w.traces)
  for (const x of [Q, 'インパクト', '影響', '강한 영향', '미치는']) assert.ok(!s.includes(x), `Trace 원문 없음: ${x}`)
})

test('로그: 성공·거절·실패·취소 어느 경로에도 질의·표현·뜻이 console 로 나가지 않는다', async () => {
  const out: string[] = []
  const keep = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug }
  const sink = (...a: unknown[]) => void out.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '))
  console.log = console.info = console.warn = console.error = console.debug = sink
  try {
    await helpWordPhrase(U, body(), wordWorld().deps)
    await helpWordPhrase(U, body(), wordWorld({ data: { status: 'NOT_A_PHRASE', items: [] } }).deps)
    await assert.rejects(helpWordPhrase(U, body(), wordWorld({ complete: async () => Promise.reject(named('LlmTimeoutError')) }).deps))
    await assert.rejects(helpWordPhrase(U, body(), wordWorld({ data: { status: 'OK', items: [] } }).deps))
    const ac = new AbortController()
    ac.abort()
    const seen = { cancelled: false }
    const w = wordWorld()
    w.deps.complete = abortableEngine(w, seen)
    await assert.rejects(helpWordPhrase(U, body(), w.deps, ac.signal))
  } finally {
    Object.assign(console, keep)
  }
  const all = out.join('\n')
  for (const x of [Q, 'インパクト', '影響', '강한 영향']) assert.ok(!all.includes(x), `로그 원문 없음: ${x}`)
})

test('저장 없음 — 단어 도우미 함수·라우트 소스에 DB 쓰기·학습 기록 테이블이 없고 서비스 파일 전체에서 console 출력은 장면 읽기 실패 경고 하나뿐(원문 없음)', () => {
  const svc = code(SERVICE)
  const fn = svc.split('export async function helpWordPhrase')[1].split('async function runPhraseHelp')[0]
  const bad = [/\bprisma\b/, /(?<!inFlight)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/, /\$transaction/, /studyLog|statsSnapshot|repetitionItem|wordEntry|learningObservation\.create/i, /console\./]
  for (const b of bad) assert.ok(!b.test(fn), `helpWordPhrase: ${b}`)
  const route = code(ROUTE_WORD)
  for (const b of [...bad, /localStorage|logger\./]) assert.ok(!b.test(route), `route: ${b}`)
  assert.equal((svc.match(/console\./g) ?? []).length, 1, '서비스 파일의 console 은 기존 장면 읽기 경고 하나')
})

// ── 회화 도우미 회귀 (외부 동작 불변) ─────────────────────────────────────────

test('회화 도우미 회귀: Trace 에 mode·promptVersion 칸이 없고 refId 는 방 id · 프롬프트는 v1 · 채팅 의존(readChat·isEnded)은 그대로', async () => {
  const c = chatWorld()
  const r = await helpPhrase(U, 'chat_ph', body(CHAT_Q), c.deps)
  assert.equal(r.items.length, 2)
  assert.equal(r.items[0].labelKo, '정중하게')
  assert.deepEqual(c.calls, ['chat', 'llm'], '대화 소유 확인 → (장면·수준은 대화 값) → 엔진')
  assert.equal(c.traces[0].refId, 'chat_ph')
  assert.equal(c.traces[0].refType, 'phraseHelp')
  const step = c.traces[0].steps[0]
  assert.ok(!('mode' in step) && !('promptVersion' in step))
  assert.equal(c.reqs[0].persona?.name, 'phrase-help')
  assert.equal(c.reqs[0].system, buildPhraseHelpSystem('N4'))
  assert.equal(phraseHelpPromptVersion(undefined), PHRASE_HELP_PROMPT_VERSION)
  const svc = code(SERVICE)
  const chatFn = svc.split('export async function helpPhrase')[1].split('/** 단어 도우미가 쓰는 의존')[0]
  for (const needle of ['deps.readChat(', "chat.kind !== 'TALK'", 'deps.isEnded(', "'ENDED'", 'withPhraseLock(']) assert.ok(chatFn.includes(needle), `helpPhrase 에 ${needle}`)
})

// ── 400: 본문 검사는 한도·DB·엔진 앞 ──────────────────────────────────────────

async function readBody(raw: string | undefined) {
  const req = new Request('http://localhost/api/v1/words/phrase-help', { method: 'POST', headers: { 'content-type': 'application/json' }, ...(raw === undefined ? {} : { body: raw }) })
  return readPhraseHelpBody(await readJsonObject(req as never, 1024))
}

test('본문 400(회화 도우미와 같은 검증): 빈 본문·빈 글·한글 없음·100자 초과·1KB 초과·배열·모르는 키·URL — 전부 VALIDATION', async () => {
  const cases: Array<[string, string | undefined, string | undefined]> = [
    ['빈 본문', undefined, 'required'],
    ['빈 글', JSON.stringify({ queryKo: '   ' }), 'required'],
    ['한글 없음', JSON.stringify({ queryKo: 'impact' }), 'no_hangul'],
    ['일본어만', JSON.stringify({ queryKo: 'インパクト' }), 'no_hangul'],
    ['100자 초과', JSON.stringify({ queryKo: '가'.repeat(101) }), 'max_length'],
    ['1KB 초과', JSON.stringify({ queryKo: '가'.repeat(400) }), undefined],
    ['배열 본문', JSON.stringify([Q]), undefined],
    ['JSON 아님', '{', undefined],
    ['모르는 키', JSON.stringify({ queryKo: Q, mode: 'phrase' }), 'unknown_key'],
    ['URL', JSON.stringify({ queryKo: '임팩트 https://example.com' }), 'forbidden_char'],
  ]
  for (const [name, raw, reason] of cases) {
    try {
      await readBody(raw)
      assert.fail(`${name}: 400 이 나야 함`)
    } catch (e) {
      assert.ok(e instanceof ApiError && e.code === 'VALIDATION', `${name}: VALIDATION 이어야 함 (${String(e)})`)
      if (reason) assert.equal(e.details?.reason, reason, name)
      assert.ok(e.userMessage.length > 0)
    }
  }
  assert.deepEqual(await readBody(JSON.stringify({ queryKo: ` ${Q} ` })), { queryKo: Q })
  assert.deepEqual(await readBody(JSON.stringify({ queryKo: '가'.repeat(100) })), { queryKo: '가'.repeat(100) })
})

// ── 라우트 배선 (소스 스캔 — 인증 쿠키가 필요해 라우트 자체는 실행하지 않는다) ─────

test('라우트 순서: 세션(401) → 본문(400) → 한도 분당·하루(429) → 호출 — 400 은 한도·DB·엔진에 닿지 않고, 호출은 req.signal·no-store 헤더와 함께', () => {
  const src = code(ROUTE_WORD)
  const order = ['requireSession()', 'readPhraseHelpBody(', 'rateLimit(`phrase-help:', 'rateLimit(`phrase-help-day:', 'helpWordPhrase(']
  const idx = order.map((n) => src.indexOf(n))
  idx.forEach((i, k) => assert.ok(i >= 0, `${order[k]} 가 있어야 함`))
  for (let k = 1; k < idx.length; k++) assert.ok(idx[k] > idx[k - 1], `${order[k - 1]} → ${order[k]} 순서`)
  assert.match(src, /readJsonObject\(req, 1024\)/)
  assert.match(src, /helpWordPhrase\(s\.user\.id, body, undefined, req\.signal\)/)
  assert.match(src, /'Cache-Control': 'private, no-store'/)
  assert.match(src, /export const POST = withApi\(/)
  assert.match(src, /export const runtime = 'nodejs'/)
  assert.match(src, /export const dynamic = 'force-dynamic'/)
  assert.doesNotMatch(src, /params|chatId|readChat/, '채팅방 경로 인자가 없다')
  assert.doesNotMatch(src, /\bspawn\b|\bfetch\(|child_process|@\/modules\/(engine|learning|preferences)\b/, '라우트는 conversation·infra 만 부른다')
})

test('한도 공유(L3): #181 의 분당·하루 키·한도·창이 #180 과 글자까지 같고, 실제 rateLimit 에서 한쪽이 쓴 만큼 다른 쪽이 차감된다', () => {
  const limitsOf = (rel: string) => {
    const src = code(rel)
    const num = (name: string) => Number(new RegExp(`const ${name} = ([\\d_]+)`).exec(src)?.[1]?.replace(/_/g, ''))
    const calls = [...src.matchAll(/rateLimit\(`([^`]+)`, (\w+)(?:, ([\d_]+))?\)/g)].map((m) => ({ key: m[1], limit: num(m[2]), windowMs: m[3] ? Number(m[3].replace(/_/g, '')) : 60_000 }))
    return calls
  }
  const word = limitsOf(ROUTE_WORD)
  const chat = limitsOf(ROUTE_CHAT)
  assert.equal(word.length, 2)
  assert.deepEqual(word, chat, '두 라우트의 한도 호출이 같다')
  assert.deepEqual(word.map((x) => [x.key, x.limit, x.windowMs]), [['phrase-help:${s.user.id}', 10, 60_000], ['phrase-help-day:${s.user.id}', 300, 86_400_000]])

  const uid = `cuser_share_${Date.now()}`
  const resolve = (k: string) => k.replace('${s.user.id}', uid)
  // #180 이 분당 10번 쓴 뒤 #181 의 11번째는 429.
  for (let i = 0; i < 10; i++) rateLimit(resolve(chat[0].key), chat[0].limit, chat[0].windowMs)
  assert.throws(() => rateLimit(resolve(word[0].key), word[0].limit, word[0].windowMs), (e: unknown) => e instanceof ApiError && e.code === 'RATE_LIMITED' && typeof e.details?.retryAfterSec === 'number')
  // 하루 창도 같은 버킷.
  const uid2 = `cuser_share2_${Date.now()}`
  const r2 = (k: string) => k.replace('${s.user.id}', uid2)
  for (let i = 0; i < 300; i++) rateLimit(r2(chat[1].key), chat[1].limit, chat[1].windowMs)
  assert.throws(() => rateLimit(r2(word[1].key), word[1].limit, word[1].windowMs), (e: unknown) => e instanceof ApiError && e.code === 'RATE_LIMITED')
  // 다른 사용자는 별개.
  assert.doesNotThrow(() => rateLimit(`phrase-help:${OTHER}`, 10))
})

test('엔진명 비노출: 라우트·단어 도우미 함수 소스와 사용자에게 가는 문구(응답·오류)에 엔진·모델 이름이 없다', async () => {
  const engineName = /claude|haiku|sonnet|opus|anthropic|reazon|whisper|style-?bert|qwen|ollama|speaker_?id|model_?id/i
  assert.doesNotMatch(code(ROUTE_WORD), engineName)
  const fn = code(SERVICE).split('export async function helpWordPhrase')[1].split('async function runPhraseHelp')[0]
  assert.doesNotMatch(fn, engineName)
  const ok = JSON.stringify(await helpWordPhrase(U, body(), wordWorld().deps))
  assert.doesNotMatch(ok, engineName)
  for (const name of ['LlmContractError', 'NoEngineAvailableError', 'LlmTimeoutError']) {
    const e = await helpWordPhrase(U, body(), wordWorld({ complete: async () => Promise.reject(named(name)) }).deps).then(() => null, (x: unknown) => x)
    assert.ok(e instanceof Error, name)
    // 응답 봉투(사용자가 받는 본문)에 엔진·모델 이름이 없다 — 어댑터 오류 이름(LlmContractError 등)은 봉투로 새지 않는다.
    const envelope = JSON.stringify(await toErrorResponse(e).json())
    assert.doesNotMatch(envelope, engineName, name)
    assert.doesNotMatch(envelope, /Llm|NoEngine/, name)
  }
  assert.doesNotMatch(conversation.PHRASE_HELP_FAIL_MESSAGE, engineName)
})

test('6층 방향: 서비스 파일이 단어 도우미를 위해 새로 끌어오는 것은 없다 — import 는 infra·engine·learning·preferences(기존)·같은 모듈뿐', () => {
  const imports = [...readFileSync(join(process.cwd(), SERVICE), 'utf8').matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1])
  for (const i of imports) assert.ok(/^(@\/modules\/(infra|engine|learning|preferences)|\.\.?\/)/.test(i), `허용된 import: ${i}`)
  assert.ok(!imports.some((i) => /admin|speech/.test(i)))
})
