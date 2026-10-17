/**
 * task-072 — 단어 추가 일본어 도우미의 순수 규칙(screens §30-10·§30-14 ①). React·DOM 없이 가짜 입력으로 돌린다:
 * 한글 판정 · [물어보기] 막힘 순서 · 안내 줄 우선순위 · #181 실패 분류 · 결말 → 판 상태 · 질의 칸 Enter · 판 안 Esc · 서로 닫기 · 처음 안내 · 넣기 순서 · 문구 정본.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Err } from '@/components/common/errors'
import { HELPER, HELPER_COUNT_FROM, HELPER_MAX } from '@/components/talk/helperCopy'
import { claimHelperTip, HELPER_TIP_KEY, type HelperSettle } from '@/components/talk/phraseHelperLogic'
import { NETWORK_ERROR } from '../labels'
import { WORD_HELPER } from '../wordHelperCopy'
import {
  fillSurfaceFromHelper,
  hasHangul,
  helperQueryKeyDown,
  micOpenedNow,
  panelEscapeKeyDown,
  wordAskBlockOf,
  wordAskDisabled,
  wordHelperApply,
  wordHelperFailureOf,
  wordHelperMsgOf,
  wordHelperOutcomeOf,
  wordHelperSoundKey,
  wordHelperTipShown,
  WORD_HELPER_IDS,
} from '../wordHelperLogic'

const err = (status: number, over: Partial<Err> = {}): Err => ({ status, message: '', code: null, details: {}, retryAfterSec: null, ...over })
const validation = (reason: string | null, message = '서버 안내'): Err =>
  err(400, { code: 'VALIDATION', message, details: reason === null ? {} : { reason } })

test('hasHangul — 한글 음절이 하나라도 있어야 한다(자모만·영문·일본어는 아니다)', () => {
  assert.equal(hasHangul('임팩트'), true)
  assert.equal(hasHangul('impact'), false)
  assert.equal(hasHangul('インパクト'), false)
  assert.equal(hasHangul('ㅋㅋ'), false)
  assert.equal(hasHangul('임팩트 impact'), true)
  assert.equal(hasHangul('impact 임'), true)
  assert.equal(hasHangul(''), false)
})

test('[물어보기] 막힘 순서 — 요청 중 > 대기 > 빈 말 > 100자 초과 > 한글 없음 > 통과(녹음 잠금은 없다)', () => {
  const base = { query: '임팩트', pending: false, rateWaiting: false }
  assert.equal(wordAskBlockOf(base), null)
  assert.equal(wordAskBlockOf({ ...base, pending: true, rateWaiting: true, query: '' }), 'pending')
  assert.equal(wordAskBlockOf({ ...base, rateWaiting: true, query: '' }), 'rate')
  assert.equal(wordAskBlockOf({ ...base, query: '   ' }), 'empty')
  assert.equal(wordAskBlockOf({ ...base, query: 'a'.repeat(HELPER_MAX + 1) }), 'over') // 한글도 없지만 초과가 먼저
  assert.equal(wordAskBlockOf({ ...base, query: 'impact' }), 'noHangul')
  assert.equal(wordAskBlockOf({ ...base, query: '가'.repeat(HELPER_MAX) }), null) // 100자는 허용
  assert.notEqual(wordAskBlockOf({ ...base, query: '임팩트' }), 'recording')
})

test('흐림 — 요청 중·대기·빈 말·초과만 흐리고, 한글 없음은 흐리지 않는다(눌러야 이유가 보인다)', () => {
  assert.deepEqual(
    (['pending', 'rate', 'empty', 'over', 'noHangul', null] as const).map((b) => wordAskDisabled(b)),
    [true, true, true, true, false, false],
  )
})

test('안내 줄 우선순위 — 서버 문구 > 한글 없음 > 빈 제출 > 100자 초과 > 멈춤 > 90자부터 글자 수 > 없음', () => {
  const text = (query: string, hint: Parameters<typeof wordHelperMsgOf>[0]['hint']) => wordHelperMsgOf({ query, hint })
  assert.deepEqual(text('임', { server: '꺾쇠(< >)는 쓸 수 없어요.' }), { text: '꺾쇠(< >)는 쓸 수 없어요.', bad: true, count: false })
  assert.deepEqual(text('가'.repeat(101), { server: 'x' }), { text: 'x', bad: true, count: false }) // 서버 문구가 초과보다 앞
  assert.deepEqual(text('impact', 'noHangul'), { text: '한국어로 써 주세요. 일본어는 위 표현 칸에 바로 적으면 돼요.', bad: true, count: false })
  assert.deepEqual(text('  ', 'empty'), { text: '물어볼 말을 한국어로 써 주세요', bad: true, count: false })
  assert.equal(text('임', 'empty'), null, '빈 제출 안내는 질의가 비었을 때만')
  assert.deepEqual(text('가'.repeat(101), 'stopped'), { text: `100자까지 물어볼 수 있어요 · 101/100`, bad: true, count: true }) // 초과가 멈춤보다 앞
  assert.deepEqual(text('임', 'over'), { text: '100자까지 물어볼 수 있어요 · 1/100', bad: true, count: true })
  assert.deepEqual(text('임팩트', 'stopped'), { text: '찾기를 멈췄어요. 다시 물어볼 수 있어요.', bad: false, count: false })
  assert.deepEqual(text('가'.repeat(95), 'stopped'), { text: '찾기를 멈췄어요. 다시 물어볼 수 있어요.', bad: false, count: false }) // 멈춤이 글자 수보다 앞
  assert.deepEqual(text('가'.repeat(HELPER_COUNT_FROM), null), { text: '90/100', bad: false, count: true })
  assert.deepEqual(text('가'.repeat(HELPER_COUNT_FROM - 1), null), null)
  assert.equal(text('', null), null)
})

test('실패 분류 — 12초·504 = 시간 초과 · 상태 0 = 연결 실패 · 429 = 대기 초(details → 헤더 → 10)', () => {
  assert.deepEqual(wordHelperFailureOf(err(0), true), { kind: 'timeout' })
  assert.deepEqual(wordHelperFailureOf(err(504), false), { kind: 'timeout' })
  assert.deepEqual(wordHelperFailureOf(err(0), false), { kind: 'offline' })
  assert.deepEqual(wordHelperFailureOf(err(429, { details: { retryAfterSec: 7.2 } }), false), { kind: 'rate', sec: 8 })
  assert.deepEqual(wordHelperFailureOf(err(429, { retryAfterSec: 30 }), false), { kind: 'rate', sec: 30 })
  assert.deepEqual(wordHelperFailureOf(err(429), false), { kind: 'rate', sec: 10 })
})

test('실패 분류 — 409 PHRASE_BUSY(details.reason·code 둘 다) = 바쁨, 그 밖의 409(취소 포함) = 오류', () => {
  assert.deepEqual(wordHelperFailureOf(err(409, { code: 'CONFLICT', details: { reason: 'PHRASE_BUSY' } }), false), { kind: 'busy' })
  assert.deepEqual(wordHelperFailureOf(err(409, { code: 'PHRASE_BUSY' }), false), { kind: 'busy' })
  assert.deepEqual(wordHelperFailureOf(err(409, { code: 'CANCELLED' }), false), { kind: 'error' })
  assert.deepEqual(wordHelperFailureOf(err(409, { code: 'CONFLICT', details: { reason: 'CANCELLED' } }), false), { kind: 'error' })
  assert.deepEqual(wordHelperFailureOf(err(409), false), { kind: 'error' })
})

test('실패 분류 — 400 VALIDATION 은 사유별 입력 안내, 서버 문구는 forbidden_char·secret_like 둘뿐', () => {
  assert.deepEqual(wordHelperFailureOf(validation('required'), false), { kind: 'hint', hint: 'empty' })
  assert.deepEqual(wordHelperFailureOf(validation('no_text'), false), { kind: 'hint', hint: 'empty' })
  assert.deepEqual(wordHelperFailureOf(validation('max_length'), false), { kind: 'hint', hint: 'over' })
  assert.deepEqual(wordHelperFailureOf(validation('no_hangul'), false), { kind: 'hint', hint: 'noHangul' })
  // required·no_hangul 의 서버 문구(회화방 맥락)는 단어 시트에 내지 않는다 — 화면 문구가 대신한다
  assert.deepEqual(wordHelperFailureOf(validation('forbidden_char', '꺾쇠(< >)는 쓸 수 없어요.'), false), { kind: 'hint', hint: { server: '꺾쇠(< >)는 쓸 수 없어요.' } })
  assert.deepEqual(wordHelperFailureOf(validation('secret_like', '비밀번호·키처럼 보이는 글은 넣을 수 없어요.'), false), { kind: 'hint', hint: { server: '비밀번호·키처럼 보이는 글은 넣을 수 없어요.' } })
  assert.deepEqual(wordHelperFailureOf(validation('forbidden_char', ''), false), { kind: 'error' }, '문구가 비면 보일 말이 없다')
  for (const reason of ['type', 'unknown_key', null, 'other']) assert.deepEqual(wordHelperFailureOf(validation(reason), false), { kind: 'error' }, String(reason))
  assert.deepEqual(wordHelperFailureOf(err(400, { code: 'BAD_REQUEST', details: { reason: 'required' } }), false), { kind: 'error' }, 'VALIDATION 이 아니면 오류')
})

test('실패 분류 — 401·502·그 밖 5xx·봉투 밖 예외 = 오류(서버 message 는 쓰지 않는다)', () => {
  for (const s of [401, 404, 500, 502, 503, -1]) assert.deepEqual(wordHelperFailureOf(err(s, { message: '서버가 한 말' }), false), { kind: 'error' }, String(s))
})

test('결말 → 판 상태 — 결과·빈 결과·429·입력 안내·실패 4종', () => {
  const items = [
    { ja: 'インパクト', ko: '임팩트', labelKo: '꼬리표', whyKo: '이유' },
    { ja: '衝撃', ko: '충격' },
  ]
  const r = wordHelperApply({ kind: 'items', items })
  assert.equal(r.phase, 'result')
  assert.deepEqual(r.items, [
    { ja: 'インパクト', ko: '임팩트' },
    { ja: '衝撃', ko: '충격' },
  ]) // 꼬리표·이유가 와도 버린다
  assert.equal(r.announce, '표현 2개를 찾았어요')
  assert.deepEqual(wordHelperApply({ kind: 'items', items: [] }), { phase: 'none', items: [], announce: '이 말에 맞는 일본어를 찾지 못했어요.' })
  assert.deepEqual(wordHelperApply({ kind: 'rate', sec: 12 }), { phase: 'rate', rateSec: 12, announce: '12초 뒤 다시 물어볼 수 있어요.' })
  assert.deepEqual(wordHelperApply({ kind: 'hint', hint: 'noHangul' }), { phase: 'idle', hint: 'noHangul', announce: '' })
  for (const kind of ['busy', 'offline', 'error', 'timeout'] as const) assert.deepEqual(wordHelperApply({ kind }), { phase: kind, announce: '' }, kind)
})

function keyEvent(over: Partial<{ key: string; keyCode: number; isComposing: boolean }> = {}) {
  const calls = { prevented: 0 }
  const e = {
    key: over.key ?? 'Enter',
    keyCode: over.keyCode ?? 13,
    nativeEvent: { isComposing: over.isComposing ?? false },
    preventDefault: () => {
      calls.prevented += 1
    },
  }
  return { e, calls }
}

test('질의 칸 Enter — 늘 preventDefault(바깥 form 암묵 제출 차단), 보내기는 조합 중이 아닐 때만', () => {
  let asked = 0
  const onKey = helperQueryKeyDown(() => {
    asked += 1
  })
  const plain = keyEvent()
  onKey(plain.e)
  assert.deepEqual([plain.calls.prevented, asked], [1, 1])
  const composing = keyEvent({ isComposing: true })
  onKey(composing.e)
  assert.deepEqual([composing.calls.prevented, asked], [1, 1], '조합 중 Enter 는 막기만')
  const ime229 = keyEvent({ keyCode: 229 })
  onKey(ime229.e)
  assert.deepEqual([ime229.calls.prevented, asked], [1, 1], 'keyCode 229 도 조합')
  const other = keyEvent({ key: 'a' })
  onKey(other.e)
  assert.deepEqual([other.calls.prevented, asked], [0, 1], '다른 키는 건드리지 않는다')
})

test('판 안 Esc — preventDefault(시트의 Esc 닫기를 건너뛰게 하는 신호) + 판 닫기, 조합 중 Esc 는 신호만, 다른 키는 아무것도', () => {
  let closed = 0
  const onKey = panelEscapeKeyDown(() => {
    closed += 1
  })
  const esc = keyEvent({ key: 'Escape' })
  onKey(esc.e)
  assert.deepEqual([esc.calls.prevented, closed], [1, 1])
  const composing = keyEvent({ key: 'Escape', isComposing: true })
  onKey(composing.e)
  assert.deepEqual([composing.calls.prevented, closed], [1, 1])
  const other = keyEvent({ key: 'Enter' })
  onKey(other.e)
  assert.deepEqual([other.calls.prevented, closed], [0, 1])
})

test('말로 쓰기 새로 열림 — 표현 칸으로 바뀐 렌더만(이미 열림·닫힘·다른 칸은 아님)', () => {
  assert.equal(micOpenedNow(null, 'surface'), true)
  assert.equal(micOpenedNow('example', 'surface'), true)
  assert.equal(micOpenedNow('surface', 'surface'), false)
  assert.equal(micOpenedNow('surface', null), false)
  assert.equal(micOpenedNow(null, 'example'), false)
  assert.equal(micOpenedNow(null, null), false)
})

test('처음 안내 표시 — 1단계에서 판·말로 쓰기가 닫혀 있고 아직 안 닫았을 때만', () => {
  const base = { tipOpen: true, step: 'surface', helperOpen: false, micTarget: null as string | null }
  assert.equal(wordHelperTipShown(base), true)
  assert.equal(wordHelperTipShown({ ...base, tipOpen: false }), false)
  assert.equal(wordHelperTipShown({ ...base, step: 'form' }), false)
  assert.equal(wordHelperTipShown({ ...base, step: 'enriching' }), false)
  assert.equal(wordHelperTipShown({ ...base, helperOpen: true }), false)
  assert.equal(wordHelperTipShown({ ...base, micTarget: 'surface' }), false)
  assert.equal(wordHelperTipShown({ ...base, micTarget: 'example' }), true, '예문 칸은 폼 단계라 1단계엔 없지만 표현 칸 안내와 무관')
})

test('처음 안내 플래그 — 회화방과 같은 키를 공유한다(회화방이 먼저 기록했으면 거짓, 저장이 막힌 환경은 거짓)', () => {
  assert.equal(HELPER_TIP_KEY, 'kaiwa.talk.helperTipSeen')
  const store = new Map<string, string>()
  const read = (_: unknown, k: string) => store.get(k) ?? null
  const write = (_: unknown, k: string, v: string | null) => void (v === null ? store.delete(k) : store.set(k, v))
  assert.equal(claimHelperTip(read as never, write as never), true, '처음엔 보인다')
  assert.equal(claimHelperTip(read as never, write as never), false, '한 번 본 뒤엔 안 보인다')
  const seenInTalk = new Map([[HELPER_TIP_KEY, '1']])
  assert.equal(
    claimHelperTip(((_: unknown, k: string) => seenInTalk.get(k) ?? null) as never, (() => {}) as never),
    false,
    '회화방 안내를 본 프로필은 단어 시트 안내가 안 뜬다(D6 양방향)',
  )
  assert.equal(claimHelperTip((() => null) as never, (() => {}) as never), false, '저장이 막힌 환경은 한 번도 안 뜬다')
})

test('넣기 — 확인 안내 거둠 → 표현 칸 값 바꿈 → 판 닫기·낭독 → 초점, 이 순서뿐이고 [뜻 채우기]·저장 같은 다음 행동을 부르지 않는다(D5)', () => {
  const log: string[] = []
  fillSurfaceFromHelper({
    ja: 'インパクト',
    edited: (t) => log.push(`edited:${t}`),
    setSurface: (v) => log.push(`set:${v}`),
    fill: (ja) => log.push(`fill:${ja}`),
    focusSurface: () => log.push('focus'),
  })
  assert.deepEqual(log, ['edited:surface', 'set:インパクト', 'fill:インパクト', 'focus'])
})

test('문구 정본 — 데모 문구 그대로, 같은 문장은 회화방 HELPER 를 참조하고, 엔진·모델 이름이 없다', () => {
  assert.equal(WORD_HELPER.tip, '한국어로 물어보면 일본어 표현을 알려 줘요')
  assert.equal(WORD_HELPER.sub, '모르는 말을 한국어로 물어보세요')
  assert.equal(WORD_HELPER.placeholder, '예: 임팩트, 어색하다')
  assert.deepEqual([...WORD_HELPER.examples], ['임팩트', '어색하다', '귀찮다'])
  assert.equal(WORD_HELPER.noHangul, '한국어로 써 주세요. 일본어는 위 표현 칸에 바로 적으면 돼요.')
  assert.equal(WORD_HELPER.stop, '그만두기')
  assert.equal(WORD_HELPER.stopped, '찾기를 멈췄어요. 다시 물어볼 수 있어요.')
  assert.equal(WORD_HELPER.more(2), '다른 후보 2개 더 보기')
  assert.equal(WORD_HELPER.less, '다른 후보 접기')
  assert.equal(WORD_HELPER.altsAria, '다른 후보')
  assert.equal(WORD_HELPER.fill, '표현 칸에 넣기')
  assert.equal(WORD_HELPER.filled('インパクト'), '표현 칸에 ‘インパクト’를 넣었어요')
  assert.equal(WORD_HELPER.noneHint, '짧은 한국어 낱말로 다시 써 보세요. 예: ‘어색하다’')
  assert.equal(WORD_HELPER.busy, '다른 화면에서 일본어 표현을 찾는 중이에요. 끝나면 다시 물어봐 주세요.')
  // 회화방과 같은 문장은 값이 같다(복사가 아니라 참조 — 한쪽만 바뀌면 이 시험이 깨진다)
  for (const k of ['button', 'tipClose', 'title', 'close', 'inputLabel', 'ask', 'empty', 'examplesLead', 'slow', 'listAria', 'none', 'error', 'timeout', 'retry', 'rateDone'] as const) {
    assert.equal(WORD_HELPER[k], HELPER[k], k)
  }
  assert.equal(WORD_HELPER.loading, HELPER.loadingSr)
  assert.equal(WORD_HELPER.listen('x'), HELPER.listen('x'))
  assert.equal(WORD_HELPER.stopSound('x'), HELPER.stop('x'))
  assert.equal(WORD_HELPER.rate(3), HELPER.rate(3))
  assert.equal(WORD_HELPER.found(3), HELPER.found(3))
  assert.equal(WORD_HELPER.offline, NETWORK_ERROR)
  assert.doesNotMatch(JSON.stringify(WORD_HELPER) + WORD_HELPER.more(1) + WORD_HELPER.filled('x'), /reazon|whisper|style-?bert|claude|haiku|sonnet|opus|qwen|sherpa|speaker_?id|model_?id/i)
})

test('id 상수 — 단어 시트 전용 접두(wadd_helper_*)로 모두 다르다', () => {
  const ids = Object.values(WORD_HELPER_IDS)
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ids) assert.match(id, /^wadd_helper_/)
})

test('결말 합치기 — 시간 초과만 수명주기의 결말을 믿고, 나머지 실패는 요청 래퍼가 단어 규칙으로 먼저 분류한 것을 쓴다(없으면 오류)', () => {
  const failed = (kind: 'error' | 'timeout' | 'rate' | 'busy' | 'ended' | 'invalid'): HelperSettle =>
    ({ kind: 'failed', failure: kind === 'rate' ? { kind, sec: 3 } : kind === 'invalid' ? { kind, message: '회화방 문구' } : { kind } }) as HelperSettle
  assert.deepEqual(wordHelperOutcomeOf({ kind: 'items', items: [{ ja: 'a', ko: 'b' }] }, null), { kind: 'items', items: [{ ja: 'a', ko: 'b' }] })
  assert.deepEqual(wordHelperOutcomeOf(failed('timeout'), null), { kind: 'timeout' }, '화면 12초는 취소(AbortError)라 래퍼가 분류하지 않는다')
  assert.deepEqual(wordHelperOutcomeOf(failed('timeout'), { kind: 'busy' }), { kind: 'timeout' })
  assert.deepEqual(wordHelperOutcomeOf(failed('error'), { kind: 'busy' }), { kind: 'busy' }, '회화방 규칙은 409 PHRASE_BUSY 를 오류로 본다 — 래퍼 분류가 이긴다')
  assert.deepEqual(wordHelperOutcomeOf(failed('error'), { kind: 'offline' }), { kind: 'offline' }, '상태 0 도 마찬가지')
  assert.deepEqual(wordHelperOutcomeOf(failed('rate'), { kind: 'rate', sec: 12 }), { kind: 'rate', sec: 12 })
  assert.deepEqual(wordHelperOutcomeOf(failed('invalid'), { kind: 'hint', hint: 'noHangul' }), { kind: 'hint', hint: 'noHangul' }, '회화방의 400 서버 문구는 쓰지 않는다')
  assert.deepEqual(wordHelperOutcomeOf(failed('error'), null), { kind: 'error' }, '응답 모양 오류는 던져진 예외가 없어 분류가 없다 → 오류')
  assert.deepEqual(wordHelperOutcomeOf(failed('ended'), null), { kind: 'error' })
})

test('소리 열쇠 — 자체 접두(회화방 helper:{n} 과 겹치지 않는다)', () => {
  assert.equal(wordHelperSoundKey(0), 'whelper:0')
  assert.equal(wordHelperSoundKey(2), 'whelper:2')
})
