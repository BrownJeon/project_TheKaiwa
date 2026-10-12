/**
 * task-064 dev-S2b — ASK API 층(계약 §2-18-A 1·2·3·4항): #28 생성 검증, #32 ASK 요청 검증(`inputSource`·`utteranceId`·`scope`),
 * ASK 한도(분당 3·하루 60·전역 대기 상한 `ASK_BUSY`), #29 `ask` 객체 노출. DB·엔진 0.
 */
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '@/modules/infra'
import { parseCreateChat, parseTurnBody, assertTurnFitsKind } from '../chats/validate'
import { defaultChatTitle, serializeChat } from '../chats'
import { parseKind } from '../chats/validate'
import {
  admitAskTurn,
  askInflightCount,
  resetAskLimitsForTest,
  ASK_PER_MINUTE,
  ASK_PER_DAY,
  ASK_MAX_INFLIGHT,
  ASK_SLOT_MAX_MS,
} from '../chats/askLimits'
import { messageAskField } from '../chats/askView'

const apiErr = (c: string, check?: (e: ApiError) => boolean) => (e: unknown) => e instanceof ApiError && e.code === c && (check ? check(e) : true)
const field = (f: string) => apiErr('VALIDATION', (e) => e.details?.field === f)

// ── #28 생성 ──────────────────────────────────────────────────────────────────

test('#28 ASK: kind·title 만 허용(FEATURE_NOT_READY 해제), title 생략 = null(서버 기본 「새 질문」), 100자 상한', () => {
  assert.deepEqual(parseCreateChat({ kind: 'ASK' }), { kind: 'ASK', title: null, topicId: null, level: null })
  assert.deepEqual(parseCreateChat({ kind: 'ASK', title: '  지난주에 틀린 거  ' }), { kind: 'ASK', title: '지난주에 틀린 거', topicId: null, level: null })
  assert.throws(() => parseCreateChat({ kind: 'ASK', title: 'あ'.repeat(101) }), field('title'))
  assert.equal(defaultChatTitle('ASK', null), '새 질문')
  assert.equal(defaultChatTitle('ASK', '주제'), '새 질문', 'ASK 는 주제 제목을 쓰지 않는다')
  assert.equal(defaultChatTitle('TALK', null), '새 회화')
  assert.equal(defaultChatTitle('CHAT', null), '새 채팅')
})

test('#28 ASK: topicId·scenarioId·lessonId·level(그리고 그 밖 키)이 오면 null 이어도 400 — 필드 이름을 싣는다', () => {
  for (const k of ['topicId', 'scenarioId', 'lessonId', 'level']) {
    assert.throws(() => parseCreateChat({ kind: 'ASK', [k]: 'x1' }), field(k), k)
    assert.throws(() => parseCreateChat({ kind: 'ASK', [k]: null }), field(k), `${k}:null`)
  }
  assert.throws(() => parseCreateChat({ kind: 'ASK', title: 't', extra: 1 }), field('extra'))
})

test('#28 회귀: TALK·CHAT 동작 불변(모르는 키 무시·level 검증·주제)', () => {
  assert.deepEqual(parseCreateChat({ kind: 'TALK', topicId: 't1', level: 'N4', extra: 1 }), { kind: 'TALK', title: null, topicId: 't1', level: 'N4' })
  assert.deepEqual(parseCreateChat({ kind: 'CHAT', lessonId: 'ls_1' }), { kind: 'CHAT', title: null, topicId: null, level: null })
  assert.throws(() => parseCreateChat({ kind: 'CHAT', level: 'N6' }), field('level'))
  assert.throws(() => parseCreateChat({ kind: 'NOPE' }), field('kind'))
})

// ── #32 요청 검증 ─────────────────────────────────────────────────────────────

test('#32 scope 형식: {key: THIS_WEEK|LAST_30D|ALL} 만, 그 밖 400 field=scope · 생략이면 칸 없음(기존 요청 모양 불변)', () => {
  const plain = parseTurnBody({ text: '안녕' })
  assert.ok(!plain.resume && !('scope' in plain), '생략 시 scope 키 없음')
  for (const key of ['THIS_WEEK', 'LAST_30D', 'ALL'] as const) {
    const r = parseTurnBody({ text: '지난 거', scope: { key } })
    assert.ok(!r.resume && r.scope?.key === key)
    assert.deepEqual(!r.resume && r.scope, { key }, 'orchestrator 는 request.scope?.key 로 읽는다(S2a 인터페이스)')
  }
  assert.ok(!('scope' in parseTurnBody({ text: 'a', scope: null })))
  for (const bad of ['THIS_WEEK', { key: 'YESTERDAY' }, { key: 1 }, [], { }]) assert.throws(() => parseTurnBody({ text: 'a', scope: bad }), field('scope'), JSON.stringify(bad))
})

test('#32 ASK: inputSource 는 TEXT 만(그 밖 400) · utteranceId 거절 400 · TEXT 글자 턴은 통과 · resume 은 검사 대상 아님', () => {
  assert.doesNotThrow(() => assertTurnFitsKind('ASK', parseTurnBody({ text: '이번 주 진도', inputSource: 'TEXT', scope: { key: 'ALL' } })))
  assert.doesNotThrow(() => assertTurnFitsKind('ASK', parseTurnBody({ text: '이번 주 진도' })))
  assert.throws(() => assertTurnFitsKind('ASK', parseTurnBody({ text: 'a', utteranceId: 'u1' })), field('utteranceId'))
  assert.throws(() => assertTurnFitsKind('ASK', parseTurnBody({ text: 'a', utteranceId: 'u1', inputSource: 'SERVER_STT' })), field('utteranceId'))
  assert.throws(() => assertTurnFitsKind('ASK', { resume: false, text: 'a', inputSource: 'SERVER_STT', utteranceId: null, clientTimings: null }), field('inputSource'))
  assert.doesNotThrow(() => assertTurnFitsKind('ASK', parseTurnBody({ resumePending: true })))
})

test('#32 scope 는 ASK 한정 — TALK·CHAT 에 오면 400, 오지 않으면 TALK·CHAT 검증 불변(음성 턴 포함)', () => {
  for (const kind of ['TALK', 'CHAT'] as const) {
    assert.throws(() => assertTurnFitsKind(kind, parseTurnBody({ text: 'a', scope: { key: 'ALL' } })), field('scope'), kind)
    assert.doesNotThrow(() => assertTurnFitsKind(kind, parseTurnBody({ text: 'a' })))
    assert.doesNotThrow(() => assertTurnFitsKind(kind, parseTurnBody({ text: 'a', utteranceId: 'u1' })))
  }
})

// ── ASK 한도 ──────────────────────────────────────────────────────────────────

beforeEach(() => resetAskLimitsForTest())

const T0 = Date.UTC(2026, 9, 12, 3, 0, 0)
const rate = (check?: (d: Record<string, unknown>) => boolean) => apiErr('RATE_LIMITED', (e) => (check ? check(e.details ?? {}) : true))

test('ASK 분당 3: 3번째까지 통과, 4번째 429 + retryAfterSec(1~60) + reason ASK_RATE · 창이 지나면 다시 통과', () => {
  assert.equal(ASK_PER_MINUTE, 3)
  for (let i = 0; i < 3; i++) admitAskTurn('u1', T0 + i * 1000).release()
  assert.throws(() => admitAskTurn('u1', T0 + 10_000), rate((d) => d.retryAfterSec === 50 && d.reason === 'ASK_RATE'))
  assert.doesNotThrow(() => admitAskTurn('u2', T0 + 10_000).release(), '다른 사용자는 별도')
  assert.doesNotThrow(() => admitAskTurn('u1', T0 + 60_000).release(), '창이 지나면 통과')
})

test('ASK 하루 60: 60번째까지 통과, 61번째 429 + reason ASK_DAILY 이고 retryAfterSec > 3600(reason 이 없는 옛 응답은 화면이 이 값으로 추정) — 창 끝 무렵에도', () => {
  assert.equal(ASK_PER_DAY, 60)
  let t = T0
  for (let i = 0; i < 60; i++) {
    admitAskTurn('u1', t).release()
    t += 61_000 // 분당 한도를 넘지 않게
  }
  assert.throws(() => admitAskTurn('u1', t), rate((d) => typeof d.retryAfterSec === 'number' && d.retryAfterSec > 3600 && d.reason === 'ASK_DAILY'))
  const nearEnd = T0 + 86_400_000 - 60_000
  assert.throws(() => admitAskTurn('u1', nearEnd), rate((d) => (d.retryAfterSec as number) > 3600 && d.reason === 'ASK_DAILY'), '창 끝 1분 전에도 3600 초과')
  assert.doesNotThrow(() => admitAskTurn('u1', T0 + 86_400_000).release(), '24시간 창이 지나면 통과')
})

test('ASK 한도는 거절된 시도를 세지 않는다(분 한도 거절이 하루 몫을 깎지 않음) · 수락 전 실패는 refund 로 되돌린다', () => {
  for (let i = 0; i < 3; i++) admitAskTurn('u1', T0).release()
  for (let i = 0; i < 5; i++) assert.throws(() => admitAskTurn('u1', T0 + 1000), rate())
  const a = admitAskTurn('u3', T0)
  a.refund()
  for (let i = 0; i < 3; i++) admitAskTurn('u3', T0 + 1).release()
  assert.throws(() => admitAskTurn('u3', T0 + 2), rate(), 'refund 뒤엔 3번 더 통과하고 4번째 거절')
})

test('refund(수락 전 실패)는 분 몫과 하루 몫을 둘 다 되돌린다 — 되돌린 뒤 분당 3·하루 60 이 온전히 남고, 몫을 넘기는 첫 시도만 거절된다 (S-5/M6f)', () => {
  // 분: refund 한 시도는 세지 않는다 → 같은 분 안에서 3번 통과, 4번째가 ASK_RATE.
  const m = admitAskTurn('rf-min', T0)
  m.refund()
  for (let i = 0; i < ASK_PER_MINUTE; i++) admitAskTurn('rf-min', T0 + 1 + i).release()
  assert.throws(() => admitAskTurn('rf-min', T0 + 10), rate((d) => d.reason === 'ASK_RATE'), '분 몫: refund 한 번은 세지 않는다')

  // 하루: 분 창을 61초씩 건너뛰며 60번 통과 — 하루 몫을 되돌리지 않으면 60번째가 ASK_DAILY 로 거절된다.
  const d = admitAskTurn('rf-day', T0)
  d.refund()
  for (let i = 0; i < ASK_PER_DAY; i++) admitAskTurn('rf-day', T0 + 1 + i * 61_000).release()
  const over = T0 + 1 + ASK_PER_DAY * 61_000
  assert.throws(() => admitAskTurn('rf-day', over), rate((e) => e.reason === 'ASK_DAILY'), '하루 몫: refund 한 번은 세지 않는다 — 61번째에서 비로소 거절')
})

test('전역 대기 상한: 실행 1 + 대기 2 = 3건까지, 4번째 429 {reason:ASK_BUSY, retryAfterSec} · 해제(정상·오류·끊김 공통 release)로 다시 열림 · 중복 해제 무해', () => {
  assert.equal(ASK_MAX_INFLIGHT, 3)
  const held = ['a', 'b', 'c'].map((u) => admitAskTurn(u, T0))
  assert.equal(askInflightCount(T0), 3)
  assert.throws(() => admitAskTurn('d', T0), rate((d) => d.reason === 'ASK_BUSY' && typeof d.retryAfterSec === 'number' && (d.retryAfterSec as number) > 0))
  held[0].release()
  held[0].release()
  assert.equal(askInflightCount(T0), 2, '중복 해제는 한 번만 센다')
  assert.doesNotThrow(() => admitAskTurn('d', T0))
  assert.throws(() => admitAskTurn('e', T0), rate((d) => d.reason === 'ASK_BUSY'))
})

test('ASK_BUSY 거절은 사용자 분·하루 몫을 깎지 않는다 · 새지 않게: 슬롯은 ASK_SLOT_MAX_MS 뒤 저절로 만료', () => {
  ;['a', 'b', 'c'].forEach((u) => admitAskTurn(u, T0))
  for (let i = 0; i < 5; i++) assert.throws(() => admitAskTurn('z', T0), rate((d) => d.reason === 'ASK_BUSY'))
  const later = T0 + ASK_SLOT_MAX_MS + 1
  assert.equal(askInflightCount(later), 0, '해제되지 않은 슬롯도 상한 시간이 지나면 세지 않는다')
  for (let i = 0; i < 3; i++) admitAskTurn('z', later).release()
  assert.throws(() => admitAskTurn('z', later), rate((d) => d.reason === 'ASK_RATE'), 'z 는 3번 통과 뒤 분 한도(BUSY 거절 5번은 안 셈)')
})

test('429 reason 은 항상 있다 — 어느 갈래든 {reason ∈ ASK_RATE|ASK_DAILY|ASK_BUSY, retryAfterSec} · 겹치면 하루 → 분 → 전역 순서(검사 순서와 같다)', () => {
  const reasons = (fn: () => unknown): { reason?: unknown; retryAfterSec?: unknown } => {
    try {
      fn()
    } catch (e) {
      assert.ok(e instanceof ApiError && e.code === 'RATE_LIMITED')
      return e.details ?? {}
    }
    assert.fail('거절되어야 한다')
  }
  // 분 + 전역 동시: 분 한도가 먼저(사용자 몫이 가장 구체적인 원인)
  for (let i = 0; i < 3; i++) admitAskTurn('m', T0 + i).release()
  ;['a', 'b', 'c'].forEach((u) => admitAskTurn(u, T0 + 10))
  assert.equal(reasons(() => admitAskTurn('m', T0 + 20)).reason, 'ASK_RATE', '분 한도 + 전역 가득 → ASK_RATE')
  assert.equal(reasons(() => admitAskTurn('other', T0 + 20)).reason, 'ASK_BUSY', '분 한도 아님 + 전역 가득 → ASK_BUSY')
  resetAskLimitsForTest()
  // 하루 + 분 동시: 하루가 먼저
  let t = T0
  for (let i = 0; i < 57; i++) {
    admitAskTurn('d', t).release()
    t += 61_000
  }
  for (let i = 0; i < 3; i++) admitAskTurn('d', t + i).release() // 57 + 3 = 60, 마지막 3건은 같은 분 창
  const day = reasons(() => admitAskTurn('d', t + 10))
  assert.equal(day.reason, 'ASK_DAILY', '하루 + 분 동시 → ASK_DAILY')
  assert.ok((day.retryAfterSec as number) > 3600, '하루 한도 retryAfterSec 는 기존 값(>3600) 유지')
  // 분 한도 retryAfterSec 는 1~60 의 정수, BUSY 는 양수
  resetAskLimitsForTest()
  for (let i = 0; i < 3; i++) admitAskTurn('m2', T0).release()
  const min = reasons(() => admitAskTurn('m2', T0 + 1000))
  assert.ok(Number.isInteger(min.retryAfterSec) && (min.retryAfterSec as number) >= 1 && (min.retryAfterSec as number) <= 60)
})

// ── #29 ask 노출 ──────────────────────────────────────────────────────────────

const GOOD_ASK = {
  sources: [
    { type: 'CORRECTION', id: 'cr_1', date: '2026-10-10', label: '「行くました」→「行きました」' },
    { type: 'STUDY_LOG', id: null, date: '2026-10-06', label: '이번 주 공부 요약' },
  ],
  confidence: 'HIGH',
  needsScope: null,
  records: { intent: 'PROGRESS', count: 2 },
}

test('#29 ask 노출: toolLog 의 측정 칸·여분 키는 응답에 없다(허용 필드만) · ask 가 없거나 모양이 틀리면 null', () => {
  const toolLog = { traceId: 't_1', model: 'm', llmMs: 900, promptChars: 2000, scopeKey: 'ALL', ask: { ...GOOD_ASK, rawQuestion: '원문', sources: [{ ...GOOD_ASK.sources[0], text: '본문' }, GOOD_ASK.sources[1]] } }
  const { ask } = messageAskField('ASK', 'ASSISTANT', 'DONE', toolLog)
  assert.deepEqual(ask, GOOD_ASK)
  const json = JSON.stringify(ask)
  for (const leak of ['원문', '본문', 'llmMs', 'promptChars', 'traceId', 'scopeKey', 'model']) assert.ok(!json.includes(leak), leak)
  assert.deepEqual(messageAskField('ASK', 'ASSISTANT', 'DONE', { traceId: 't' }), { ask: null })
  assert.deepEqual(messageAskField('ASK', 'ASSISTANT', 'DONE', { ask: { ...GOOD_ASK, confidence: 'SURE' } }), { ask: null })
  assert.deepEqual(messageAskField('ASK', 'ASSISTANT', 'DONE', null), { ask: null })
})

test('#29 messageAskField: ASK 의 ASSISTANT 만 `ask` 키(PENDING·FAILED 는 null) · USER·TALK·CHAT 은 키 없음', () => {
  const tl = { ask: GOOD_ASK }
  assert.deepEqual(messageAskField('ASK', 'ASSISTANT', 'DONE', tl), { ask: GOOD_ASK })
  assert.deepEqual(messageAskField('ASK', 'ASSISTANT', 'PENDING', tl), { ask: null })
  assert.deepEqual(messageAskField('ASK', 'ASSISTANT', 'FAILED', tl), { ask: null })
  assert.deepEqual(messageAskField('ASK', 'USER', 'DONE', tl), {})
  assert.deepEqual(messageAskField('TALK', 'ASSISTANT', 'DONE', tl), {})
  assert.deepEqual(messageAskField('CHAT', 'ASSISTANT', 'DONE', tl), {})
})

test('#27 목록 ASK: kind=ASK 필터 값 통과 · 행 모양 불변(preview·running 그대로)', () => {
  assert.equal(parseKind('ASK'), 'ASK')
  const at = new Date('2026-10-12T08:00:00Z')
  const dto = serializeChat({ id: 'c_ask', kind: 'ASK', title: '새 질문', level: 'N4', lastMessageAt: at, preview: '이번 주에는 동사 활용을 두 번 틀렸어요', messageCount: 2, reviewedAt: null, createdAt: at, topic: null }, true)
  assert.deepEqual(Object.keys(dto).sort(), ['createdAt', 'id', 'kind', 'lastMessageAt', 'level', 'messageCount', 'preview', 'reviewedAt', 'running', 'title', 'topic'])
  assert.equal(dto.preview, '이번 주에는 동사 활용을 두 번 틀렸어요')
  assert.equal(dto.running, true)
})
