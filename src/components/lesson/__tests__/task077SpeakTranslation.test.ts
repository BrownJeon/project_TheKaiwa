/**
 * task-077 §34-4(A1~A5 ★) — 「내가 한 말」 한국어 뜻: 계획(같으면 모범 답안 뜻·다르면 #185) · 오류 표 · 힌트 · 화면 상태 ·
 * 요청 수명주기(동시 1건·대상 바뀜/잠금/언마운트 때 끊기·12초·늦은 답 버림·메모리) · #185 요청 본문 · 번역 칸 마크업.
 * 정답은 손으로 적은 표다(구현에서 계산하지 않는다).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup as r } from 'react-dom/server'
import { ApiError } from '@/components/common/api'
import SpeakTranslation, { speakTrLineText } from '../SpeakTranslation'
import {
  createSpeakTranslator,
  koOf,
  SPEAK_TR_TIMEOUT_MS,
  speakTrFailureOf,
  speakTrHint,
  speakTrRetryable,
  speakTrView,
  translationPlan,
  type SpeakTrState,
} from '../speakTranslation'
import { speakTrRequest } from '../useSpeakTranslation'

const MODEL_JA = '東京に住んでいます。まだ勉強しています。'
const MODEL_KO = '도쿄에 살고 있어요. 아직 공부하고 있어요.'

/* ── 계획(A2) ───────────────────────────────────────────────────────── */

test('translationPlan: 건너뜀·빈 말 → 칸 없음 / 모범 답안과 같음(문장부호·공백만 다름) → 모범 답안 뜻 즉시 / 다름 → #185', () => {
  const rows: [string, Parameters<typeof translationPlan>[0], string, unknown][] = [
    ['결과 없음', null, MODEL_KO, { kind: 'skip' }],
    ['undefined', undefined, MODEL_KO, { kind: 'skip' }],
    ['건너뜀', { text: '', skipped: true }, MODEL_KO, { kind: 'skip' }],
    ['건너뜀(글 있어도)', { text: MODEL_JA, skipped: true }, MODEL_KO, { kind: 'skip' }],
    ['공백만', { text: '  　 ' }, MODEL_KO, { kind: 'skip' }],
    ['똑같음', { text: MODEL_JA }, MODEL_KO, { kind: 'free', ko: MODEL_KO }],
    ['문장부호 없음', { text: '東京に住んでいますまだ勉強しています' }, MODEL_KO, { kind: 'free', ko: MODEL_KO }],
    ['공백·쉼표 더함', { text: '東京に 住んでいます、まだ勉強しています。' }, MODEL_KO, { kind: 'free', ko: MODEL_KO }],
    ['모범 뜻 앞뒤 공백은 정리', { text: MODEL_JA }, `  ${MODEL_KO} `, { kind: 'free', ko: MODEL_KO }],
    ['한 글자 다름', { text: '東京に住んでいます。もう勉強しています。' }, MODEL_KO, { kind: 'fetch' }],
    ['뒤틀린 인식', { text: '私はハンコクの進んでいますまだ勉強ディ・ヨン号の勉強です' }, MODEL_KO, { kind: 'fetch' }],
    ['같지만 모범 뜻이 비었음', { text: MODEL_JA }, '  ', { kind: 'fetch' }],
    ['200자 넘음(비교 안 함)', { text: 'あ'.repeat(201) }, MODEL_KO, { kind: 'fetch' }],
  ]
  for (const [name, res, ko, want] of rows) assert.deepEqual(translationPlan(res, MODEL_JA, ko), want, name)
})

/* ── 오류 표(A5 · §34-7 #185) ───────────────────────────────────────── */

test('speakTrFailureOf: 409 CANCELLED 줄 없음 · 409 바쁨 · 429 한도 · 400/404 막힘 · 그 밖은 실패', () => {
  const rows: [number, Record<string, unknown> | null, SpeakTrState['s']][] = [
    [409, { reason: 'CANCELLED' }, 'none'],
    [409, { reason: 'TRANSLATION_BUSY' }, 'busy'],
    [409, { reason: 'TURN_RUNNING' }, 'fail'],
    [409, null, 'fail'],
    [429, { retryAfterSec: 30 }, 'rate'],
    [400, { field: 'text', reason: 'required' }, 'blocked'],
    [400, { field: 'body', reason: 'unknown_key' }, 'blocked'],
    [404, null, 'blocked'],
    [502, { reason: 'TRANSLATION_REJECTED' }, 'fail'],
    [502, null, 'fail'],
    [504, null, 'fail'],
    [422, null, 'fail'],
    [500, null, 'fail'],
    [0, null, 'fail'],
    [-1, null, 'fail'],
  ]
  for (const [status, details, want] of rows) assert.equal(speakTrFailureOf({ status, details: details ?? {} }).s, want, `${status} ${JSON.stringify(details)}`)
})

test('koOf: 글이 아니거나 비면 null, 앞뒤 공백은 정리', () => {
  assert.equal(koOf({ ko: ' 서울에 살아요 ' }), '서울에 살아요')
  for (const bad of [null, undefined, 'ko', 3, {}, { ko: '' }, { ko: '   ' }, { ko: 3 }, { translation: '서울' }]) assert.equal(koOf(bad), null, JSON.stringify(bad))
})

/* ── 힌트(A4 A) · 단추 · 화면 상태 ───────────────────────────────────── */

test('speakTrHint: 말로 한 답을 AI 가 옮겼을 때만 — 글자로 쓴 답·모범 답안 뜻·실패에는 없음', () => {
  const ai: SpeakTrState = { s: 'ok', ko: '뜻', ai: true }
  const free: SpeakTrState = { s: 'ok', ko: '뜻', ai: false }
  assert.equal(speakTrHint('voice', ai), true)
  assert.equal(speakTrHint('text', ai), false)
  assert.equal(speakTrHint('voice', free), false)
  assert.equal(speakTrHint('text', free), false)
  for (const s of ['idle', 'loading', 'fail', 'rate', 'busy', 'blocked', 'none'] as const) assert.equal(speakTrHint('voice', { s } as SpeakTrState), false, s)
})

test('speakTrRetryable: 실패·한도·바쁨만 [다시 가져오기], 막힘(400·404)은 단추 없음', () => {
  const want: Record<string, boolean> = { idle: false, loading: false, fail: true, rate: true, busy: true, blocked: false, none: false }
  for (const [s, v] of Object.entries(want)) assert.equal(speakTrRetryable({ s } as SpeakTrState), v, s)
  assert.equal(speakTrRetryable({ s: 'ok', ko: 'x', ai: true }), false)
})

test('speakTrView: 칸 없음 · 모범 답안 뜻(AI 아님) · 메모리(AI) · 지금 대상 상태 · 다른 대상이면 아직(idle)', () => {
  const cache = new Map([['あい', '사랑']])
  const cur = { key: 'i1:2', state: { s: 'fail' } as SpeakTrState }
  assert.deepEqual(speakTrView({ kind: 'skip' }, 'あい', cache, cur, 'i1:2'), { s: 'none' })
  assert.deepEqual(speakTrView({ kind: 'free', ko: '모범' }, 'あい', cache, cur, 'i1:2'), { s: 'ok', ko: '모범', ai: false })
  assert.deepEqual(speakTrView({ kind: 'fetch' }, 'あい', cache, cur, 'i1:2'), { s: 'ok', ko: '사랑', ai: true }, '메모리가 먼저')
  assert.deepEqual(speakTrView({ kind: 'fetch' }, 'かき', cache, cur, 'i1:2'), { s: 'fail' })
  assert.deepEqual(speakTrView({ kind: 'fetch' }, 'かき', cache, cur, 'i1:3'), { s: 'idle' }, '새 시도는 다시 묻는다')
  assert.deepEqual(speakTrView({ kind: 'fetch' }, 'かき', new Map(), { key: null, state: { s: 'idle' } }, 'i2:0'), { s: 'idle' })
})

/* ── 요청 수명주기 ──────────────────────────────────────────────────── */

interface Call {
  text: string
  signal: AbortSignal
  resolve: (v: unknown) => void
  reject: (e: unknown) => void
}

function harness() {
  const calls: Call[] = []
  const states: [string, SpeakTrState][] = []
  const cache = new Map<string, string>()
  const tr = createSpeakTranslator({
    request: (text, signal) =>
      new Promise((resolve, reject) => {
        calls.push({ text, signal, resolve, reject })
      }),
    onState: (key, state) => states.push([key, state]),
    onCache: (text, ko) => cache.set(text, ko),
  })
  return { tr, calls, states, cache }
}
const flush = () => new Promise((res) => setImmediate(res))
const sync = (tr: ReturnType<typeof createSpeakTranslator>, key: string | null, text: string, o: Partial<{ paused: boolean; cached: boolean; idle: boolean }> = {}) =>
  tr.sync(key === null ? null : { key, text }, { paused: false, cached: false, idle: true, ...o })

test('수명주기: 다르면 한 번 묻고(준비 → 뜻) 메모리에 둔다 · 같은 대상을 다시 맞춰도 두 번 묻지 않는다', async () => {
  const { tr, calls, states, cache } = harness()
  sync(tr, 'i1:1', 'あい')
  sync(tr, 'i1:1', 'あい')
  assert.equal(calls.length, 1, '받는 중이면 다시 묻지 않음')
  assert.equal(calls[0].text, 'あい')
  assert.deepEqual(states, [['i1:1', { s: 'loading' }]])
  calls[0].resolve({ ko: ' 사랑 ' })
  await flush()
  assert.deepEqual(states.at(-1), ['i1:1', { s: 'ok', ko: '사랑', ai: true }])
  assert.equal(cache.get('あい'), '사랑')
  assert.equal(tr.pendingKey(), null)
  sync(tr, 'i1:1', 'あい', { cached: true, idle: false })
  sync(tr, 'i1:2', 'あい', { cached: true })
  assert.equal(calls.length, 1, '메모리에 있으면 묻지 않음')
})

test('수명주기: 대상이 바뀌면(새 결과·다음 과제·결과 없음) 앞 요청을 끊고 늦게 온 답은 버린다', async () => {
  const { tr, calls, states, cache } = harness()
  sync(tr, 'i1:1', 'あい')
  sync(tr, 'i1:2', 'かき')
  assert.equal(calls[0].signal.aborted, true, '새 결과 → 앞 요청 끊음')
  assert.equal(calls.length, 2)
  calls[0].resolve({ ko: '늦은 답' })
  await flush()
  assert.equal(cache.has('あい'), false, '끊은 요청의 답은 메모리에도 넣지 않음')
  assert.ok(!states.some(([k, s]) => k === 'i1:1' && s.s === 'ok'))
  sync(tr, null, '')
  assert.equal(calls[1].signal.aborted, true, '결과 없는 과제로 → 끊음')
  calls[1].reject(new ApiError('x', 500))
  await flush()
  assert.ok(!states.some(([k, s]) => k === 'i1:2' && s.s === 'fail'), '끊은 요청의 실패도 버림')
})

test('수명주기: 말하는 중·확인 중(잠금)이면 받는 중인 요청을 끊고 idle, 잠금 중엔 새로 묻지 않고, 풀리면 다시 묻는다', async () => {
  const { tr, calls, states } = harness()
  sync(tr, 'i1:1', 'あい', { paused: true })
  assert.equal(calls.length, 0, '잠금 중 시작 안 함')
  sync(tr, 'i1:1', 'あい')
  assert.equal(calls.length, 1)
  sync(tr, 'i1:1', 'あい', { paused: true, idle: false })
  assert.equal(calls[0].signal.aborted, true)
  assert.deepEqual(states.at(-1), ['i1:1', { s: 'idle' }])
  tr.retry({ key: 'i1:1', text: 'あい' })
  assert.equal(calls.length, 1, '잠금 중 [다시 가져오기]도 무시')
  sync(tr, 'i1:1', 'あい')
  assert.equal(calls.length, 2, '잠금이 풀리면 다시 묻는다')
  calls[0].resolve({ ko: '늦음' })
  await flush()
  assert.notDeepEqual(states.at(-1), ['i1:1', { s: 'ok', ko: '늦음', ai: true }])
})

test('수명주기: 실패한 대상은 저절로 다시 묻지 않고 [다시 가져오기]로만 · 받는 중엔 재시도 무시', async () => {
  const { tr, calls, states } = harness()
  sync(tr, 'i1:1', 'あい')
  calls[0].reject(new ApiError('x', 502, 'ENGINE_ERROR', { reason: 'TRANSLATION_REJECTED' }))
  await flush()
  assert.deepEqual(states.at(-1), ['i1:1', { s: 'fail' }])
  sync(tr, 'i1:1', 'あい', { idle: false })
  assert.equal(calls.length, 1, '실패 상태에서는 다시 묻지 않음')
  tr.retry({ key: 'i1:1', text: 'あい' })
  assert.equal(calls.length, 2)
  tr.retry({ key: 'i1:1', text: 'あい' })
  assert.equal(calls.length, 2, '받는 중 재시도 무시')
  calls[1].reject(new ApiError('x', 409, 'CONFLICT', { reason: 'CANCELLED' }))
  await flush()
  assert.deepEqual(states.at(-1), ['i1:1', { s: 'none' }], '서버 취소는 줄 없음')
})

test('수명주기: 오류 → 칸 상태(429 한도 · 409 바쁨 · 404 막힘 · 연결 실패)', async () => {
  const cases: [unknown, SpeakTrState['s']][] = [
    [new ApiError('x', 429, 'RATE_LIMITED', { retryAfterSec: 9 }, 9), 'rate'],
    [new ApiError('x', 409, 'CONFLICT', { reason: 'TRANSLATION_BUSY' }), 'busy'],
    [new ApiError('x', 404, 'NOT_FOUND'), 'blocked'],
    [new ApiError('x', 400, 'VALIDATION', { field: 'text', reason: 'max_length' }), 'blocked'],
    [new ApiError('x', 0), 'fail'],
    [new TypeError('fetch failed'), 'fail'],
  ]
  for (const [err, want] of cases) {
    const { tr, calls, states } = harness()
    sync(tr, 'k', 'あ')
    calls[0].reject(err)
    await flush()
    assert.equal(states.at(-1)?.[1].s, want, String((err as Error).message ?? err))
  }
  const { tr, calls, states } = harness()
  sync(tr, 'k', 'あ')
  calls[0].resolve({ ko: '' })
  await flush()
  assert.deepEqual(states.at(-1), ['k', { s: 'fail' }], '빈 뜻은 실패')
})

test('수명주기: 화면 상한 12초 — 끊고 실패 줄(서버 잠금이 풀리게 신호를 끊는다)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { tr, calls, states } = harness()
  sync(tr, 'k', 'あ')
  t.mock.timers.tick(SPEAK_TR_TIMEOUT_MS - 1)
  assert.equal(calls[0].signal.aborted, false)
  t.mock.timers.tick(1)
  assert.equal(calls[0].signal.aborted, true)
  calls[0].reject(new DOMException('aborted', 'AbortError'))
  await flush()
  assert.deepEqual(states.at(-1), ['k', { s: 'fail' }])
  assert.equal(SPEAK_TR_TIMEOUT_MS, 12_000)
})

test('수명주기: 언마운트(dispose)면 끊고 늦은 답은 버린다 — 다시 마운트(StrictMode)되면 다시 묻는다', async () => {
  const { tr, calls, states, cache } = harness()
  sync(tr, 'k', 'あ')
  tr.dispose()
  assert.equal(calls[0].signal.aborted, true)
  calls[0].resolve({ ko: '늦음' })
  await flush()
  assert.equal(cache.size, 0)
  assert.equal(states.length, 1, '준비 말고는 없음')
  sync(tr, 'k', 'あ')
  assert.equal(calls.length, 2)
})

/* ── #185 요청 본문 ──────────────────────────────────────────────────── */

test('speakTrRequest: POST /api/v1/lessons/:id/speaking-translation 본문 {text} 하나 · 끊기 신호 전달 · 응답 data 그대로', async () => {
  const realFetch = globalThis.fetch
  const seen: { url: string; body: string; method?: string; signal: unknown }[] = []
  globalThis.fetch = ((url: string, init: RequestInit) => {
    seen.push({ url, body: String(init.body), method: init.method, signal: init.signal })
    return Promise.resolve(new Response(JSON.stringify({ success: true, data: { ko: '서울에 살아요' }, message: null }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  }) as unknown as typeof fetch
  try {
    const ac = new AbortController()
    const out = await speakTrRequest('l/1')('ソウルに住んでいます', ac.signal)
    assert.equal(seen.length, 1)
    assert.equal(seen[0].url, '/api/v1/lessons/l%2F1/speaking-translation')
    assert.equal(seen[0].method, 'POST')
    assert.deepEqual(JSON.parse(seen[0].body), { text: 'ソウルに住んでいます' }, 'itemId 등 다른 칸 없음(서버 400 unknown_key)')
    assert.equal(seen[0].signal, ac.signal)
    assert.deepEqual(out, { ko: '서울에 살아요' })
  } finally {
    globalThis.fetch = realFetch
  }
})

/* ── 번역 칸 마크업(A4 ★ — 회화방 내 말 번역 칸과 같은 값) ─────────────── */

const box = (state: SpeakTrState, via: 'voice' | 'text' = 'voice') => r(h(SpeakTranslation, { state, via, onRetry: () => undefined }))
const WRAP = '<div tabindex="-1" aria-live="polite" aria-atomic="true" class="outline-none">'
const ROW = '<div class="mt-2 border-t border-ink/18 flex min-h-[30px] flex-wrap items-center gap-x-2 pt-1.5 text-[13px] text-ink2">'
const RETRY = '<button type="button" class="-my-[7px] -ml-1.5 inline-flex h-11 flex-none items-center px-1.5 text-[13px] text-ink underline underline-offset-[3px]">다시 가져오기</button>'

test('번역 칸: 뜻 = 구분선 + 15px + 시각 숨김 「한국어 뜻: 」, 말로 한 답을 AI 가 옮겼을 때만 12px 힌트', () => {
  const voiceAi = box({ s: 'ok', ko: '저는 한코쿠의 나아가고 있습니다', ai: true }, 'voice')
  assert.equal(
    voiceAi,
    `${WRAP}<p class="mt-2 border-t border-ink/18 pt-2 text-[15px] leading-normal text-ink2 break-keep [overflow-wrap:anywhere]"><span class="sr-only">한국어 뜻: </span>저는 한코쿠의 나아가고 있습니다</p><p class="mt-0.5 text-[12px] text-ink2 break-keep">알아들은 말을 그대로 옮겼어요</p></div>`,
  )
  const textAi = box({ s: 'ok', ko: '서울에 살아요', ai: true }, 'text')
  assert.doesNotMatch(textAi, /알아들은 말을 그대로 옮겼어요/, '글자로 쓴 답')
  const free = box({ s: 'ok', ko: '도쿄에 살아요', ai: false }, 'voice')
  assert.doesNotMatch(free, /알아들은 말을 그대로 옮겼어요/, '모범 답안과 같음')
  assert.match(free, /<span class="sr-only">한국어 뜻: <\/span>도쿄에 살아요<\/p><\/div>$/)
})

test('번역 칸: 준비(아직·받는 중) = 막대 + 「번역 중…」 / 실패·한도·바쁨 = 문구 + [다시 가져오기] / 막힘 = 단추 없음 / 서버 취소 = 빈 칸', () => {
  for (const s of ['idle', 'loading'] as const) {
    const html = box({ s })
    assert.ok(html.startsWith(`${WRAP}${ROW}<span aria-hidden="true" class="mb-1 mt-1.5 block h-3 w-[62%] rounded-md motion-safe:animate-pulse bg-surface !m-0 !w-[72px] flex-none"></span><span>번역 중…</span></div></div>`), s)
  }
  const rows: [SpeakTrState, string, boolean][] = [
    [{ s: 'fail' }, '번역을 가져오지 못했어요', true],
    [{ s: 'rate' }, '잠시 뒤 다시 눌러 주세요', true],
    [{ s: 'busy' }, '다른 번역을 가져오는 중이에요. 잠시 뒤 다시 눌러 주세요', true],
    [{ s: 'blocked' }, '이 말은 번역할 수 없어요', false],
  ]
  for (const [state, text, retry] of rows) {
    assert.equal(box(state), `${WRAP}${ROW}<span class="break-keep">${text}</span>${retry ? RETRY : ''}</div></div>`, state.s)
    assert.equal(speakTrLineText(state), text)
  }
  assert.equal(box({ s: 'none' }), `${WRAP}</div>`)
})

test('번역 칸: 표시 설정(번역 스위치)과 무관 — 설정 저장소가 비어도(서버 그림) 뜻이 보인다(A3)', () => {
  assert.match(box({ s: 'ok', ko: '보임', ai: true }), />보임</)
})
