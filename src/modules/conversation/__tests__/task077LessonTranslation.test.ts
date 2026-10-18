/**
 * task-077 #185 레슨 ⑤ 「내가 한 말」 번역 — 서비스(`translateLessonSpeech`)·본문 검사(`readLessonTranslationBody`) 단위 시험(DB·LLM 없음, 가짜 deps).
 * ① 본문 표(손으로 적은 정답) ② #32t 와 같은 프롬프트·엔진 태스크 ③ 정리 표(버려지면 502 TRANSLATION_REJECTED) ④ 엔진 오류 그대로·취소 409
 * ⑤ 사용자당 동시 1건 — 이 입구만의 잠금(#32t·도우미 잠금과 서로 막지 않음) ⑥ Trace·로그에 원문·번역 0 ⑦ 실패해도 잠금 풀림.
 */
import { mock, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Prisma } from '@prisma/client'
import { ApiError, classifyError, prisma } from '@/modules/infra'
import type { LlmJsonRequest, LlmJsonResult, TraceRecord } from '@/modules/engine'
import type { UserTranslationResponse } from '../prompts/userTranslation'
import type { PhraseHelpResponse } from '../structuredResponse/phraseHelp'
import { lessonTranslationDeps, readLessonTranslationBody, translateLessonSpeech, type LessonTranslationDeps } from '../chats/lessonTranslation'
import { helpWordPhrase, type WordPhraseHelpDeps } from '../chats/phraseHelp'
import { retryUserTranslation, translationDeps } from '../chats/translation'
import * as conversation from '../index'

const U = 'cuser0000000000000000t077'
const LESSON = 'ls_t077_0000000000000001'
const JA = 'これ、いくら？'
const KO = '이거 얼마야?'

const llmResult = (userKo: unknown): LlmJsonResult<UserTranslationResponse> => ({ data: { userKo } as UserTranslationResponse, connectionKey: 'conn-x', model: 'model-x', elapsedMs: 3, promptChars: 321, attempts: 1 })
const named = (name: string) => Object.assign(new Error('engine said no'), { name })

function world(over: Partial<LessonTranslationDeps> & { userKo?: unknown; level?: string } = {}) {
  const { userKo, level, ...rest } = over
  const calls: string[] = []
  const reqs: LlmJsonRequest<UserTranslationResponse>[] = []
  const traces: TraceRecord[] = []
  const deps: LessonTranslationDeps = {
    learnerLevel: async () => (calls.push('profile'), level ?? 'N4'),
    complete: async (req) => (calls.push('llm'), reqs.push(req), llmResult(userKo === undefined ? KO : userKo)),
    trace: async (t) => void traces.push(t),
    ...rest,
  }
  return { deps, calls, reqs, traces }
}

/**
 * DB 호출 기록기(⑧ 저장 없음) — 진짜 `prisma` 의 모든 모델 델리게이트와 raw·트랜잭션 진입점을 «기록만 하고 null 을 돌려주는» 가짜로 바꾼다.
 * `await` 하지 않는 숨은 쓰기(`void prisma.lesson.updateMany(…).catch()`)는 가짜 DATABASE_URL 의 연결 실패가 응답에 나타나지 않아 응답 시험으로는 못 잡지만(REV-077S M7),
 * 기록기에는 호출이 남는다. 기록기가 null 을 돌려주므로 `await` 쓰기도 응답을 깨지 않는다 — 그래서 아래 소스 스캔과 기록기 단언이 이 파일의 «쓰기 0» 근거다.
 */
const dbCalls: string[] = []
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const recordingDelegate = (model: string): object =>
  new Proxy({}, { get: (_t, op) => (typeof op === 'string' && op !== 'then' ? async () => (dbCalls.push(`${model}.${op}`), null) : undefined) })
for (const m of Object.values(Prisma.ModelName)) Object.defineProperty(prisma, lowerFirst(m), { configurable: true, writable: true, value: recordingDelegate(lowerFirst(m)) })
for (const fn of ['$transaction', '$executeRaw', '$executeRawUnsafe', '$queryRaw', '$queryRawUnsafe', '$runCommandRaw']) {
  Object.defineProperty(prisma, fn, { configurable: true, writable: true, value: async () => (dbCalls.push(fn), null) })
}

const codeOf = (e: unknown) => classifyError(e)
const reasonOf = (e: unknown) => (classifyError(e).details as { reason?: string; field?: string } | undefined)?.reason
const fieldOf = (e: unknown) => (classifyError(e).details as { field?: string } | undefined)?.field
const tick = () => new Promise((r) => setImmediate(r))

// ── ① 본문 ─────────────────────────────────────────────────────────────────────

test('본문 표: 통과 — 정리(앞뒤 공백·제어문자 제거, 줄바꿈 유지)한 글, 코드포인트 1~1,000', () => {
  const pass: [Record<string, unknown>, string][] = [
    [{ text: JA }, JA],
    [{ text: `  ${JA}\n` }, JA],
    [{ text: 'a' }, 'a'],
    [{ text: '안녕하세요' }, '안녕하세요'], // 일본어가 아니어도 길이·타입만 본다
    [{ text: '一行目\n二行目' }, '一行目\n二行目'],
    [{ text: 'こん\u0007にちは' }, 'こんにちは'],
    [{ text: 'あ'.repeat(1000) }, 'あ'.repeat(1000)],
    [{ text: '😀'.repeat(1000) }, '😀'.repeat(1000)], // UTF-16 2,000 단위지만 코드포인트 1,000
    [{ text: ` ${'あ'.repeat(1000)} ` }, 'あ'.repeat(1000)],
  ]
  for (const [body, want] of pass) assert.deepEqual(readLessonTranslationBody(body), { text: want }, JSON.stringify(body).slice(0, 30))
})

test('본문 표: 거절 — field·reason 손으로 적은 정답(VALIDATION 400)', () => {
  const rows: [Record<string, unknown>, string, string][] = [
    [{}, 'text', 'required'],
    [{ text: null }, 'text', 'required'],
    [{ text: '' }, 'text', 'required'],
    [{ text: '   \n\t ' }, 'text', 'required'],
    [{ text: '\u0000\u0007\u001b' }, 'text', 'required'],
    [{ text: 123 }, 'text', 'type'],
    [{ text: ['あ'] }, 'text', 'type'],
    [{ text: { ja: 'あ' } }, 'text', 'type'],
    [{ text: true }, 'text', 'type'],
    [{ text: 'あ'.repeat(1001) }, 'text', 'max_length'],
    [{ text: '😀'.repeat(1001) }, 'text', 'max_length'],
    [{ text: JA, itemId: 's1' }, 'body', 'unknown_key'], // 화면은 itemId 를 보내지 않는다(계약 = {text} 하나)
    [{ text: JA, lessonId: LESSON }, 'body', 'unknown_key'],
    [{ ko: '번역' }, 'body', 'unknown_key'],
  ]
  for (const [body, field, reason] of rows) {
    assert.throws(
      () => readLessonTranslationBody(body),
      (e: unknown) => e instanceof ApiError && codeOf(e).status === 400 && codeOf(e).code === 'VALIDATION' && fieldOf(e) === field && reasonOf(e) === reason,
      JSON.stringify(body).slice(0, 40),
    )
  }
})

// ── ② 프롬프트·엔진 태스크 ─────────────────────────────────────────────────────

test('정상: {ko} 만 돌려준다 · 엔진 1회 · #32t 와 같은 태스크(userTranslation)·같은 지시(반말 규칙 포함)·학습자 수준 · 신호·traceId 전달', async () => {
  const w = world({ level: 'N3' })
  const ac = new AbortController()
  const out = await translateLessonSpeech(U, LESSON, { text: JA }, w.deps, ac.signal)
  assert.deepEqual(out, { ko: KO })
  assert.deepEqual(Object.keys(out), ['ko'])
  assert.deepEqual(w.calls, ['profile', 'llm'])
  const r = w.reqs[0]
  assert.equal(r.task, 'userTranslation')
  assert.match(r.system ?? '', /^\[모드\] USER_TRANSLATION/)
  assert.match(r.system ?? '', /N3 수준/)
  assert.match(r.system ?? '', /반말.*반말로/)
  assert.deepEqual(r.messages, [{ role: 'user', content: `[입력] ${JA}` }])
  assert.deepEqual((r.jsonSchema as { required: string[] }).required, ['userKo'])
  assert.equal(r.signal, ac.signal)
  assert.match(String(r.traceId), /\S/)
  assert.equal(w.traces[0].traceId, r.traceId, 'Trace 상관 id 가 엔진 요청과 같다')
})

test('신호가 없으면 요청에 signal 칸을 싣지 않는다', async () => {
  const w = world()
  await translateLessonSpeech(U, LESSON, { text: JA }, w.deps)
  assert.equal('signal' in w.reqs[0], false)
})

test('서비스 단독 호출 방어: 정리 안 된 빈 글·1,000자 초과가 와도 엔진 전 400(잠금도 풀림)', async () => {
  const w = world()
  for (const text of ['   ', 'あ'.repeat(1001)]) {
    await assert.rejects(translateLessonSpeech(U, LESSON, { text }, w.deps), (e: unknown) => codeOf(e).status === 400)
  }
  assert.equal(w.calls.filter((c) => c === 'llm').length, 0)
  assert.deepEqual(await translateLessonSpeech(U, LESSON, { text: JA }, w.deps), { ko: KO })
})

// ── ③ 정리 표 ──────────────────────────────────────────────────────────────────

test('정리 표: 버려지면 502 ENGINE_ERROR TRANSLATION_REJECTED(저장·재시도 없음), 통과하면 앞뒤 공백만 걷은 값', async () => {
  const rows: [string, unknown, string | null][] = [
    [JA, KO, KO],
    [JA, `  ${KO}  `, KO],
    [JA, '', null],
    [JA, '   ', null],
    [JA, null, null],
    [JA, 42, null],
    [JA, JA, null], // 입력 베끼기
    [JA, 'How much is this?', null], // 일본어 입력인데 한글 0
    [JA, '가'.repeat(201), null], // 짧은 입력(7자)의 상한 200 초과 — 자르지 않음
    ['안녕하세요', '안녕하세요', null], // 일본어가 아닌 말: 그대로 베끼면 버려진다
    ['OK', '좋아', '좋아'], // 입력에 일본어가 없으면 한글 유무를 따지지 않는다(여기선 한글이라 통과)
  ]
  for (const [text, userKo, want] of rows) {
    const w = world({ userKo })
    const label = `${text.slice(0, 6)} → ${JSON.stringify(userKo)?.slice(0, 12)}`
    if (want === null) {
      await assert.rejects(translateLessonSpeech(U, LESSON, { text }, w.deps), (e: unknown) => codeOf(e).status === 502 && codeOf(e).code === 'ENGINE_ERROR' && reasonOf(e) === 'TRANSLATION_REJECTED', label)
    } else {
      assert.deepEqual(await translateLessonSpeech(U, LESSON, { text }, w.deps), { ko: want }, label)
    }
    assert.equal(w.calls.filter((c) => c === 'llm').length, 1, `${label}: 엔진 1회(재시도 없음)`)
  }
})

// ── ④ 엔진 오류·취소 ───────────────────────────────────────────────────────────

test('엔진 오류는 #32t 처럼 그대로 → withApi 매핑(손으로 적은 표) · 실패 뒤 잠금 풀림', async () => {
  const rows: [string, number, string][] = [
    ['LlmTimeoutError', 504, 'ENGINE_TIMEOUT'],
    ['NoEngineAvailableError', 422, 'ENGINE_UNAVAILABLE'],
    ['LlmError', 502, 'ENGINE_ERROR'],
    ['LlmContractError', 502, 'ENGINE_ERROR'],
    ['JsonSchemaError', 502, 'ENGINE_ERROR'],
    ['LlmHttpError', 502, 'ENGINE_ERROR'],
    ['TypeError', 500, 'INTERNAL'],
  ]
  for (const [name, status, code] of rows) {
    const w = world({ complete: async () => Promise.reject(named(name)) })
    await assert.rejects(translateLessonSpeech(U, LESSON, { text: JA }, w.deps), (e: unknown) => codeOf(e).status === status && codeOf(e).code === code, name)
    assert.deepEqual(await translateLessonSpeech(U, LESSON, { text: JA }, world().deps), { ko: KO }, `${name} 뒤 다음 요청이 막히지 않는다`)
  }
})

test('수준 읽기(DB) 실패도 잠금을 푼다', async () => {
  const w = world({ learnerLevel: async () => Promise.reject(new Error('db down')) })
  await assert.rejects(translateLessonSpeech(U, LESSON, { text: JA }, w.deps))
  assert.deepEqual(await translateLessonSpeech(U, LESSON, { text: JA }, world().deps), { ko: KO })
})

test('취소: 보낸 신호가 끊긴 AbortError 만 409 CANCELLED · 신호가 살아 있는 AbortError 는 취소가 아니다', async () => {
  const ac = new AbortController()
  const w = world({
    complete: (req) =>
      new Promise((_, reject) => req.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))),
  })
  const p = translateLessonSpeech(U, LESSON, { text: JA }, w.deps, ac.signal)
  await tick()
  ac.abort()
  await assert.rejects(p, (e: unknown) => codeOf(e).status === 409 && reasonOf(e) === 'CANCELLED')
  assert.equal(w.traces[0].errorCode, 'CANCELLED')
  assert.deepEqual(await translateLessonSpeech(U, LESSON, { text: JA }, world().deps), { ko: KO }, '취소 뒤 잠금 풀림')

  const live = new AbortController()
  const w2 = world({ complete: async () => Promise.reject(Object.assign(new Error('own timer'), { name: 'AbortError' })) })
  await assert.rejects(translateLessonSpeech(U, LESSON, { text: JA }, w2.deps, live.signal), (e: unknown) => reasonOf(e) !== 'CANCELLED')
})

// ── ⑤ 잠금 ─────────────────────────────────────────────────────────────────────

function gated() {
  let release: () => void = () => {}
  const gate = new Promise<void>((r) => (release = r))
  return { gate, release: () => release() }
}

test('동시 1건: 같은 사용자 두 번째 409 TRANSLATION_BUSY(엔진 0) · 다른 사용자는 통과 · 끝나면 다시 통과', async () => {
  const g = gated()
  const slow = world({ complete: async () => (await g.gate, llmResult(KO)) })
  const first = translateLessonSpeech(U, LESSON, { text: JA }, slow.deps)
  await tick()
  const second = world()
  await assert.rejects(translateLessonSpeech(U, LESSON, { text: '別の文' }, second.deps), (e: unknown) => codeOf(e).status === 409 && codeOf(e).code === 'CONFLICT' && reasonOf(e) === 'TRANSLATION_BUSY')
  assert.deepEqual(second.calls, [], '바쁨이면 수준·엔진 모두 안 부른다')
  assert.deepEqual(await translateLessonSpeech('cuser_other_000000000t077', LESSON, { text: JA }, world().deps), { ko: KO })
  g.release()
  assert.deepEqual(await first, { ko: KO })
  assert.deepEqual(await translateLessonSpeech(U, LESSON, { text: JA }, world().deps), { ko: KO })
})

const PHRASE_OK: PhraseHelpResponse = { status: 'OK', items: [{ ja: 'インパクト', ko: '강한 영향', labelKo: null, whyKo: null }] }
const phraseResult = (): LlmJsonResult<PhraseHelpResponse> => ({ data: PHRASE_OK, connectionKey: 'c', model: 'm', elapsedMs: 1, promptChars: 1, attempts: 1 })

test('잠금 독립 ①: 레슨 번역이 도는 동안 같은 사용자의 도우미(#181 잠금 = #180·#184 공유)와 #32t 번역은 막히지 않는다', async (t) => {
  const g = gated()
  const lesson = translateLessonSpeech(U, LESSON, { text: JA }, world({ complete: async () => (await g.gate, llmResult(KO)) }).deps)
  await tick()
  const helpDeps: WordPhraseHelpDeps = { learnerLevel: async () => 'N4', complete: async () => phraseResult(), trace: async () => undefined }
  assert.equal((await helpWordPhrase(U, { queryKo: '임팩트' }, helpDeps)).items.length, 1)
  t.mock.method(translationDeps, 'loadMessage', async () => ({ id: 'mu', role: 'USER' as const, content: JA, translation: null, chat: { kind: 'TALK' as const } }))
  t.mock.method(translationDeps, 'isChatRunning', async () => false)
  t.mock.method(translationDeps, 'learnerLevel', async () => 'N4')
  t.mock.method(translationDeps, 'complete', async () => llmResult(KO))
  t.mock.method(translationDeps, 'saveIfEmpty', async () => ({ saved: true as const }))
  assert.deepEqual(await retryUserTranslation(U, 'c1', 'mu'), { messageId: 'mu', translation: KO, cached: false })
  g.release()
  assert.deepEqual(await lesson, { ko: KO })
})

test('잠금 독립 ②: 도우미가 도는 동안·#32t 번역이 도는 동안에도 같은 사용자의 레슨 번역은 통과', async (t) => {
  const g1 = gated()
  const help = helpWordPhrase(U, { queryKo: '임팩트' }, { learnerLevel: async () => 'N4', complete: async () => (await g1.gate, phraseResult()), trace: async () => undefined })
  await tick()
  await assert.rejects(helpWordPhrase(U, { queryKo: '임팩트' }, { learnerLevel: async () => 'N4', complete: async () => phraseResult(), trace: async () => undefined }), (e: unknown) => reasonOf(e) === 'PHRASE_BUSY', '도우미는 자기 잠금이 걸려 있다(대조)')
  assert.deepEqual(await translateLessonSpeech(U, LESSON, { text: JA }, world().deps), { ko: KO })
  g1.release()
  await help

  const g2 = gated()
  let entered: () => void = () => {}
  const inEngine = new Promise<void>((r) => (entered = r))
  t.mock.method(translationDeps, 'loadMessage', async () => ({ id: 'mu', role: 'USER' as const, content: JA, translation: null, chat: { kind: 'TALK' as const } }))
  t.mock.method(translationDeps, 'isChatRunning', async () => false)
  t.mock.method(translationDeps, 'learnerLevel', async () => 'N4')
  t.mock.method(translationDeps, 'complete', async () => (entered(), await g2.gate, llmResult(KO)))
  t.mock.method(translationDeps, 'saveIfEmpty', async () => ({ saved: true as const }))
  const chatTr = retryUserTranslation(U, 'c1', 'mu')
  await inEngine
  await assert.rejects(retryUserTranslation(U, 'c1', 'mu'), (e: unknown) => reasonOf(e) === 'TRANSLATION_BUSY', '#32t 는 자기 잠금이 걸려 있다(대조)')
  assert.deepEqual(await translateLessonSpeech(U, LESSON, { text: JA }, world().deps), { ko: KO })
  g2.release()
  assert.equal((await chatTr).cached, false)
})

// ── ⑥ Trace·로그 ───────────────────────────────────────────────────────────────

test('Trace: 코드·수치만(원문·번역 0) · refType lessonTranslation · refId 레슨 · 성공/버림/엔진 오류 단계', async () => {
  const ok = world()
  await translateLessonSpeech(U, LESSON, { text: JA }, ok.deps)
  const t0 = ok.traces[0]
  assert.equal(t0.kind, 'TURN')
  assert.equal(t0.status, 'OK')
  assert.equal(t0.userId, U)
  assert.equal(t0.refType, 'lessonTranslation')
  assert.equal(t0.refId, LESSON)
  assert.equal(t0.errorCode, null)
  assert.equal(t0.steps.length, 1)
  assert.equal(t0.steps[0].name, 'USER_TRANSLATION')
  assert.equal(t0.steps[0].textChars, 7)
  assert.equal(t0.steps[0].koChars, 7)
  assert.equal(t0.steps[0].result, 'OK')
  assert.equal(t0.steps[0].promptVersion, 'userTranslation@v1')
  assert.equal(t0.steps[0].attempts, 1)

  const rej = world({ userKo: JA })
  await assert.rejects(translateLessonSpeech(U, LESSON, { text: JA }, rej.deps))
  assert.equal(rej.traces[0].status, 'ERROR')
  assert.equal(rej.traces[0].errorCode, 'ENGINE_ERROR')
  assert.equal(rej.traces[0].steps[0].result, 'REJECTED')
  assert.equal(rej.traces[0].steps[0].koChars, 0)

  const to = world({ complete: async () => Promise.reject(named('LlmTimeoutError')) })
  await assert.rejects(translateLessonSpeech(U, LESSON, { text: JA }, to.deps))
  assert.equal(to.traces[0].errorCode, 'ENGINE_TIMEOUT')
  assert.equal(to.traces[0].steps[0].errorCode, 'ENGINE_TIMEOUT')

  for (const tr of [ok.traces[0], rej.traces[0], to.traces[0]]) {
    const s = JSON.stringify(tr)
    for (const raw of [JA, KO, 'いくら', '얼마']) assert.equal(s.includes(raw), false, `Trace 에 원문·번역 없음: ${raw}`)
  }
})

test('Trace 기록 실패는 응답을 막지 않는다', async () => {
  const w = world({ trace: async () => Promise.reject(new Error('trace db down')) })
  assert.deepEqual(await translateLessonSpeech(U, LESSON, { text: JA }, w.deps), { ko: KO })
})

test('로그: 성공·버림·엔진 오류·DB 오류 어디에도 원문·번역을 콘솔에 남기지 않는다', async (t) => {
  const lines: string[] = []
  for (const k of ['log', 'info', 'warn', 'error', 'debug'] as const) t.mock.method(console, k, (...a: unknown[]) => void lines.push(a.map(String).join(' ')))
  await translateLessonSpeech(U, LESSON, { text: JA }, world().deps)
  await assert.rejects(translateLessonSpeech(U, LESSON, { text: JA }, world({ userKo: JA }).deps))
  await assert.rejects(translateLessonSpeech(U, LESSON, { text: JA }, world({ complete: async () => Promise.reject(named('LlmError')) }).deps))
  await assert.rejects(translateLessonSpeech(U, LESSON, { text: JA }, world({ learnerLevel: async () => Promise.reject(new Error('db')) }).deps))
  for (const line of lines) for (const raw of [JA, KO]) assert.equal(line.includes(raw), false, line.slice(0, 60))
})

// ── 공개 API·기본 배선 ─────────────────────────────────────────────────────────

test('conversation index 가 서비스·본문 검사·기본 deps 를 내보낸다(라우트가 쓰는 이름) · 기본 deps 는 엔진·프로필·Trace 세 칸', () => {
  assert.equal(conversation.translateLessonSpeech, translateLessonSpeech)
  assert.equal(conversation.readLessonTranslationBody, readLessonTranslationBody)
  assert.equal(conversation.lessonTranslationDeps, lessonTranslationDeps)
  assert.deepEqual(Object.keys(lessonTranslationDeps).sort(), ['complete', 'learnerLevel', 'trace'])
})

test('기본 deps 를 mock.method 로 바꿔 끼우면 서비스 기본 인자가 그것을 쓴다(라우트 시험 방식)', async (t) => {
  t.mock.method(lessonTranslationDeps, 'learnerLevel', async () => 'N5')
  const seen: string[] = []
  t.mock.method(lessonTranslationDeps, 'complete', async (req: LlmJsonRequest<UserTranslationResponse>) => (seen.push(req.system ?? ''), llmResult(KO)))
  t.mock.method(lessonTranslationDeps, 'trace', async () => undefined)
  assert.deepEqual(await translateLessonSpeech(U, LESSON, { text: JA }), { ko: KO })
  assert.match(seen[0], /N5 수준/)
  mock.restoreAll()
})

// ── ⑧ 저장 없음 — 소스·동작 (REV-077S Low-1) ────────────────────────────────────
// #184 의 «저장 없음» 소스 스캔(task077LessonHelpServer)과 같은 수준을 #185 에도 둔다. 서비스의 바깥 접촉은 기본 deps 세 칸(프로필 읽기·엔진·Trace 1행)뿐이다 —
// 프로필 첫 읽기가 Profile 행을 upsert 하는 것은 `getProfile`(preferences) 안의 일이고 #32t·#180·#181 과 같은 기존 동작이다(api-contract #185 에 명시).

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
const SERVICE_SRC = stripComments(readFileSync(join(__dirname, '..', 'chats', 'lessonTranslation.ts'), 'utf8'))
const DEPS_BLOCK = SERVICE_SRC.split('export const lessonTranslationDeps')[1].split('\n}')[0]

/** `import { a, type B as C } from 'x'` 들 → 모듈 → 가져온 원래 이름(`type` 표시·별칭 제거). */
function importsOf(src: string): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const m of src.matchAll(/^import\s+(?:type\s+)?(?:\{([^}]*)\}|\*\s+as\s+(\w+)|(\w+))\s+from\s+'([^']+)'/gm)) {
    const names = (m[1] ?? m[2] ?? m[3] ?? '')
      .split(',')
      .map((n) => n.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0])
      .filter(Boolean)
    out.set(m[4], [...(out.get(m[4]) ?? []), ...names])
  }
  return out
}

test('저장 없음(소스): 서비스에 DB 접촉·쓰기 호출·fire-and-forget·로그가 없고, 바깥 접촉은 기본 deps 세 칸 안에만 있다', () => {
  assert.ok(DEPS_BLOCK.length > 0)
  const forbidden: [string, RegExp][] = [
    ['prisma', /\bprisma\b/],
    ['트랜잭션·raw 쿼리', /withTransaction|lockUserRow|\$transaction|\$execute|\$query|\$runCommandRaw/],
    ['쓰기 메서드', /\.(create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert|deleteMany)\(/],
    ['delete (잠금 해제 inFlight.delete 만 허용)', /(?<!\binFlight)\.delete\(/],
    ['로그(원문·번역이 새는 길)', /\bconsole\b|process\.(stdout|stderr)|\blogger\b/],
    ['.then 체인', /\.then\(/],
  ]
  for (const [label, re] of forbidden) assert.doesNotMatch(SERVICE_SRC, re, `서비스 소스에 ${label} 가 있다`)

  // 결과를 기다리지 않는 호출은 Trace 1행(`void deps.trace(…).catch(…)`) 하나뿐 — 숨은 쓰기가 들어오면 여기서 갯수가 어긋난다.
  const voids = [...SERVICE_SRC.matchAll(/\bvoid\s+([^\n]{0,40})/g)].map((m) => m[1])
  assert.equal(voids.length, 1, `void 호출: ${JSON.stringify(voids)}`)
  assert.match(voids[0], /^deps\.trace\(/)
  assert.equal((SERVICE_SRC.match(/\.catch\(/g) ?? []).length, 1, '.catch 는 Trace 기록 실패 삼키기 하나뿐')

  // 기본 deps 안에만 프로필 읽기·엔진·Trace 가 있고, 그 밖 코드는 deps 인자로만 부른다.
  for (const token of ['getProfile(', 'llm.completeJson', 'recordTrace(']) assert.ok(DEPS_BLOCK.includes(token), `기본 deps 에 ${token}`)
  const outside = SERVICE_SRC.replace(DEPS_BLOCK, '').replace(/^import[\s\S]*?\sfrom\s'[^']+'$/gm, '')
  assert.doesNotMatch(outside, /\bgetProfile\b|\brecordTrace\b|\bllm\b/, '기본 deps 밖에서 프로필·엔진·Trace 를 직접 부른다')
  assert.deepEqual(Object.keys(lessonTranslationDeps).sort(), ['complete', 'learnerLevel', 'trace'])

  // import: infra 는 오류·정리 도우미만(prisma·트랜잭션·감사 없음), engine 은 엔진·Trace, preferences 는 프로필 읽기 하나.
  const imports = importsOf(SERVICE_SRC)
  assert.deepEqual([...imports.keys()].sort(), ['../prompts/userTranslation', './requestCancel', '@/modules/engine', '@/modules/infra', '@/modules/preferences', '@/types/lesson'])
  for (const name of imports.get('@/modules/infra') ?? []) assert.ok(['ApiError', 'classifyError', 'codePointLength', 'sanitizeText'].includes(name), `infra 에서 ${name} 를 가져온다`)
  for (const name of imports.get('@/modules/engine') ?? []) assert.ok(['llm', 'newTraceId', 'recordTrace', 'LlmJsonRequest', 'LlmJsonResult', 'TraceRecord', 'TraceStep'].includes(name), `engine 에서 ${name} 를 가져온다`)
  assert.deepEqual(imports.get('@/modules/preferences'), ['getProfile'])
})

test('엔진·모델 이름이 서비스 소스에 없다(어댑터·seed 밖 금지) — 이름은 deps 로 흘러든 Trace 단계 값에만', () => {
  assert.doesNotMatch(SERVICE_SRC, /reazon|whisper|style-?bert|claude|sbv2|haiku|sonnet|opus|anthropic|qwen|ollama|speaker_?id|model_?id/i)
})

test('저장 없음(동작): 성공·버림·엔진 오류·수준 읽기 오류·바쁨·취소·Trace 실패 어느 경로도 DB 호출 0 — 이 파일 전체를 지난 뒤에도 기록기가 비어 있다', async () => {
  assert.deepEqual(dbCalls, [], '앞선 모든 시험이 지나는 동안 DB 호출이 없었다')

  assert.deepEqual(await translateLessonSpeech(U, LESSON, { text: JA }, world().deps), { ko: KO })
  await assert.rejects(translateLessonSpeech(U, LESSON, { text: JA }, world({ userKo: JA }).deps))
  await assert.rejects(translateLessonSpeech(U, LESSON, { text: JA }, world({ complete: async () => Promise.reject(named('LlmError')) }).deps))
  await assert.rejects(translateLessonSpeech(U, LESSON, { text: JA }, world({ learnerLevel: async () => Promise.reject(new Error('db')) }).deps))
  assert.deepEqual(await translateLessonSpeech(U, LESSON, { text: JA }, world({ trace: async () => Promise.reject(new Error('trace db down')) }).deps), { ko: KO })
  const g = gated()
  const slow = translateLessonSpeech(U, LESSON, { text: JA }, world({ complete: async () => (await g.gate, llmResult(KO)) }).deps)
  await tick()
  await assert.rejects(translateLessonSpeech(U, LESSON, { text: JA }, world().deps), (e: unknown) => reasonOf(e) === 'TRANSLATION_BUSY')
  g.release()
  await slow
  const ac = new AbortController()
  const cancelled = translateLessonSpeech(U, LESSON, { text: JA }, world({ complete: (req) => new Promise((_, reject) => req.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))) }).deps, ac.signal)
  await tick()
  ac.abort()
  await assert.rejects(cancelled, (e: unknown) => reasonOf(e) === 'CANCELLED')
  await tick() // 결과를 기다리지 않는 호출이 있다면 여기서 모두 기록기에 닿는다
  assert.deepEqual(dbCalls, [])

  // 기록기가 살아 있다는 대조 — 같은 모양의 숨은 쓰기가 들어오면 이 배열에 남는다.
  void prisma.lesson.updateMany({ where: { id: 'x' }, data: {} }).catch(() => undefined)
  await prisma.chatMessage.update({ where: { id: 'x' }, data: {} })
  assert.deepEqual(dbCalls, ['lesson.updateMany', 'chatMessage.update'])
  dbCalls.length = 0
})
