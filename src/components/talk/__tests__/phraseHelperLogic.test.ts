/**
 * 회화방 일본어 도우미(task-056, screens §22)의 순수 규칙 — 처음 한 번 안내 플래그 · 잠김 · 글자 수·안내 줄 · [물어보기] 막힘 ·
 * #180 응답 읽기 · 실패 → 판 상태 · 요청 결말 · 낭독 문장 · 문구 표(엔진명 없음) · 대답 연습 부제(⑦A).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { PRACTICE } from '@/components/scenario/scenarioCopy'
import { HELPER, HELPER_COUNT_FROM, HELPER_MAX } from '../helperCopy'
import {
  altSummary,
  askBlockOf,
  claimHelperTip,
  HELPER_ITEMS_MAX,
  HELPER_SLOW_MS,
  HELPER_TIMEOUT_MS,
  HELPER_TIP_KEY,
  helperAnnounceOf,
  helperFailureOf,
  helperLockReason,
  helperLocked,
  helperLockToast,
  helperMsgOf,
  readPhraseHelp,
  settleHelper,
  type HelperLockReason,
  type HelperSettle,
} from '../phraseHelperLogic'
import type { TalkState } from '../talkState'

/* ── 처음 한 번 안내(④B) ─────────────────────────────────────────── */

function fakeStore(opts: { blocked?: boolean; init?: Record<string, string> } = {}) {
  const m = new Map<string, string>(Object.entries(opts.init ?? {}))
  const writes: Array<[string, string, string | null]> = []
  const read = (kind: 'local' | 'session', key: string) => (kind === 'local' ? (m.get(key) ?? null) : null)
  const write = (kind: 'local' | 'session', key: string, value: string | null) => {
    writes.push([kind, key, value])
    if (opts.blocked) return // 사생활 모드·차단 — writeStore 는 실패를 알리지 않는다
    if (value === null) m.delete(key)
    else m.set(key, value)
  }
  return { m, writes, read, write }
}

test('claimHelperTip: 처음이면 true + 키 하나에 "1" 을 쓴다(그 밖 값·세션 저장소는 쓰지 않는다)', () => {
  const s = fakeStore()
  assert.equal(claimHelperTip(s.read, s.write), true)
  assert.deepEqual(s.writes, [['local', 'kaiwa.talk.helperTipSeen', '1']])
  assert.equal(HELPER_TIP_KEY, 'kaiwa.talk.helperTipSeen')
  // 같은 기기 다음 방 — 다시 보이지 않는다
  assert.equal(claimHelperTip(s.read, s.write), false)
  assert.equal(s.writes.length, 1, '이미 본 뒤에는 쓰지도 않는다')
})

test('claimHelperTip: 이미 본 기기는 false, 값이 무엇이든(예전 값) 다시 보이지 않는다', () => {
  for (const v of ['1', '0', '']) {
    const s = fakeStore({ init: { [HELPER_TIP_KEY]: v } })
    assert.equal(claimHelperTip(s.read, s.write), false, JSON.stringify(v))
    assert.equal(s.writes.length, 0)
  }
})

test('claimHelperTip: 저장이 막힌 환경은 한 번도 보이지 않는다(써 보고 다시 읽어 가린다)', () => {
  const s = fakeStore({ blocked: true })
  assert.equal(claimHelperTip(s.read, s.write), false)
  assert.equal(claimHelperTip(s.read, s.write), false, '방마다 매번 뜨지 않는다')
})

/* ── 잠김 ─────────────────────────────────────────────────────────── */

/**
 * 의도 변경(사용자 결정 2026-10-11, QA-B2): 예전에는 「녹음·인식 중에만 잠긴다 — 생각·대기·선생님 말 중에는 열 수 있다」를 단언했다.
 * 도우미와 회화 턴이 같은 AI 호출 줄(동시 1건)을 쓰므로 턴을 보낸 직후(QUEUED·THINKING)에 도우미가 서면 턴 첫 음성이 5초 예산을 넘긴다(p50 2.42→5.83초).
 * 지금은 열 수 있는 상태가 IDLE·SPEAKING 뿐이다. `Record<TalkState, …>` 라 상태가 늘면 이 표를 고치기 전에는 타입 검사가 실패한다.
 */
const LOCK_WANT: Record<TalkState, HelperLockReason | null> = {
  IDLE: null,
  RECORDING: 'voice',
  RECOGNIZING: 'voice',
  QUEUED: 'turn',
  THINKING: 'turn',
  SPEAKING: null,
}

test('helperLockReason·helperLocked: 열 수 있는 상태는 IDLE·SPEAKING 뿐 — 녹음·인식 = voice, 보내기 대기·생각 = turn (6개 상태 전수)', () => {
  const states = Object.keys(LOCK_WANT) as TalkState[]
  assert.equal(states.length, 6)
  for (const s of states) {
    assert.equal(helperLockReason(s), LOCK_WANT[s], s)
    assert.equal(helperLocked(s), LOCK_WANT[s] !== null, s)
  }
  assert.deepEqual(
    states.filter((s) => !helperLocked(s)),
    ['IDLE', 'SPEAKING'],
    '열 수 있는 상태',
  )
  assert.deepEqual(
    states.filter((s) => helperLocked(s)),
    ['RECORDING', 'RECOGNIZING', 'QUEUED', 'THINKING'],
    '잠기는 상태 네 개',
  )
  // 상태 문자열이 아닌 값은 잠그지 않는다(예전에도 그랬다)
  assert.equal(helperLockReason(''), null)
  assert.equal(helperLocked('thinking'), false)
})

test('helperLockToast: 이유별 토스트 — 말하는 중 / 선생님이 답하는 중(문구 그대로, 서로 다름)', () => {
  assert.equal(helperLockToast('voice'), '말하는 중에는 열 수 없어요')
  assert.equal(helperLockToast('turn'), '선생님이 답하는 중에는 열 수 없어요')
  assert.equal(HELPER.lockedTurn, '선생님이 답하는 중에는 열 수 없어요')
  assert.equal(HELPER.locked, '말하는 중에는 열 수 없어요', '기존 문구는 그대로')
  assert.notEqual(helperLockToast('voice'), helperLockToast('turn'))
  assert.equal(helperLockToast(null), HELPER.locked, '이유가 없는 길(버튼이 잠기지 않아 불리지 않음)은 기존 문구')
  // 상태에서 토스트까지 — 방이 하는 합성(`helperLockToast(helperLockReason(view.state))`)
  const toastOf = (s: TalkState) => helperLockToast(helperLockReason(s))
  assert.equal(toastOf('RECORDING'), HELPER.locked)
  assert.equal(toastOf('RECOGNIZING'), HELPER.locked)
  assert.equal(toastOf('QUEUED'), HELPER.lockedTurn)
  assert.equal(toastOf('THINKING'), HELPER.lockedTurn)
})

/* ── [물어보기] 막힘 · 안내 줄 ──────────────────────────────────────── */

const base = { query: '목이 쉬었어요', pending: false, recording: false, rateWaiting: false }

test('askBlockOf: 빈칸(공백만 포함)·100자 초과·요청 중·녹음 중·429 대기에서 막힌다', () => {
  assert.equal(askBlockOf(base), null)
  assert.equal(askBlockOf({ ...base, query: '' }), 'empty')
  assert.equal(askBlockOf({ ...base, query: '   \n ' }), 'empty')
  assert.equal(askBlockOf({ ...base, query: '가'.repeat(HELPER_MAX) }), null, '100자는 된다')
  assert.equal(askBlockOf({ ...base, query: '가'.repeat(HELPER_MAX + 1) }), 'over')
  // 글자 수는 코드포인트 — 이모지 100개(UTF-16 200칸)도 100자
  assert.equal(askBlockOf({ ...base, query: '😀'.repeat(HELPER_MAX) }), null)
  assert.equal(askBlockOf({ ...base, pending: true }), 'pending')
  assert.equal(askBlockOf({ ...base, recording: true }), 'recording')
  assert.equal(askBlockOf({ ...base, rateWaiting: true }), 'rate')
  // 녹음이 가장 앞(입력칸 자체가 잠김)
  assert.equal(askBlockOf({ query: '', pending: true, recording: true, rateWaiting: true }), 'recording')
})

test('helperMsgOf: 89자 없음 · 90~100자 「n/100」 · 101자 bad 초과 · 빈 제출 안내 · 서버 400 문구가 가장 앞', () => {
  assert.equal(helperMsgOf({ query: '가'.repeat(HELPER_COUNT_FROM - 1), emptyHint: false, serverMsg: null }), null)
  assert.deepEqual(helperMsgOf({ query: '가'.repeat(90), emptyHint: false, serverMsg: null }), { text: '90/100', bad: false, count: true })
  assert.deepEqual(helperMsgOf({ query: '가'.repeat(100), emptyHint: false, serverMsg: null }), { text: '100/100', bad: false, count: true })
  assert.deepEqual(helperMsgOf({ query: '가'.repeat(101), emptyHint: false, serverMsg: null }), { text: '100자까지 물어볼 수 있어요 · 101/100', bad: true, count: true })
  assert.deepEqual(helperMsgOf({ query: '  ', emptyHint: true, serverMsg: null }), { text: '물어볼 말을 한국어로 써 주세요', bad: true, count: false })
  assert.equal(helperMsgOf({ query: '안녕', emptyHint: true, serverMsg: null }), null, '글자를 쓰면 빈 제출 안내는 사라진다')
  assert.deepEqual(helperMsgOf({ query: 'hello', emptyHint: false, serverMsg: '하고 싶은 말을 한국어로 써 주세요.' }), {
    text: '하고 싶은 말을 한국어로 써 주세요.',
    bad: true,
    count: false,
  })
})

/* ── 응답 읽기 ─────────────────────────────────────────────────────── */

test('readPhraseHelp: 서버 순서 그대로 최대 3개, 꼬리표·이유는 빈 값·null 이면 칸만 뺀다', () => {
  const items = readPhraseHelp({
    items: [
      { ja: '喉が枯れました。', ko: '목이 쉬었어요.', labelKo: '정중하게', whyKo: '「枯れる」는 목소리가 쉴 때 써요.' },
      { ja: '声がかすれちゃった。', ko: '목소리가 쉬어 버렸어.', labelKo: ' 편하게 ', whyKo: null },
      { ja: '喉がガラガラです。', ko: '목이 칼칼해요.', labelKo: null, whyKo: '' },
      { ja: '四つ目', ko: '네 번째' },
    ],
  })
  assert.ok(items)
  assert.equal(items.length, HELPER_ITEMS_MAX)
  assert.deepEqual(items[0], { ja: '喉が枯れました。', ko: '목이 쉬었어요.', labelKo: '정중하게', whyKo: '「枯れる」는 목소리가 쉴 때 써요.' })
  assert.deepEqual(items[1], { ja: '声がかすれちゃった。', ko: '목소리가 쉬어 버렸어.', labelKo: '편하게' })
  assert.deepEqual(items[2], { ja: '喉がガラガラです。', ko: '목이 칼칼해요.' })
})

test('readPhraseHelp: 빈 배열 = 못 찾음([]) · 모양이 틀리거나 쓸 항목이 하나도 없으면 null(오류) · ja·ko 빈 항목은 버림', () => {
  assert.deepEqual(readPhraseHelp({ items: [] }), [])
  assert.equal(readPhraseHelp(null), null)
  assert.equal(readPhraseHelp({}), null)
  assert.equal(readPhraseHelp({ items: 'x' }), null)
  assert.equal(readPhraseHelp([]), null)
  assert.equal(readPhraseHelp({ items: [{ ja: '', ko: 'a' }, { ja: 'あ' }, 3] }), null)
  assert.deepEqual(readPhraseHelp({ items: [{ ja: ' ', ko: 'x' }, { ja: 'はい', ko: '네' }] }), [{ ja: 'はい', ko: '네' }])
})

test('altSummary: 접힌 카드들의 꼬리표를 「 · 」로(첫 카드 제외, 없는 꼬리표 건너뜀)', () => {
  assert.equal(
    altSummary([
      { ja: 'a', ko: 'a', labelKo: '정중하게' },
      { ja: 'b', ko: 'b', labelKo: '편하게' },
      { ja: 'c', ko: 'c' },
    ]),
    '편하게',
  )
  assert.equal(
    altSummary([
      { ja: 'a', ko: 'a' },
      { ja: 'b', ko: 'b', labelKo: '편하게' },
      { ja: 'c', ko: 'c', labelKo: '짧게' },
    ]),
    '편하게 · 짧게',
  )
  assert.equal(altSummary([{ ja: 'a', ko: 'a', labelKo: 'x' }]), '')
})

/* ── 실패 → 판 상태 ────────────────────────────────────────────────── */

const err = (status: number, code: string | null = null, details: Record<string, unknown> | null = null, retryAfter: number | null = null, message = '') =>
  toErr(new ApiError(message, status, code as never, details, retryAfter))

test('helperFailureOf: 12초·504 = 시간 초과 · 429 = 대기 초(details → 헤더 → 10초)', () => {
  assert.deepEqual(helperFailureOf(err(0), true), { kind: 'timeout' })
  assert.deepEqual(helperFailureOf(err(504), false), { kind: 'timeout' })
  assert.deepEqual(helperFailureOf(err(429, 'RATE_LIMITED', { retryAfterSec: 7.2 }), false), { kind: 'rate', sec: 8 })
  assert.deepEqual(helperFailureOf(err(429, 'RATE_LIMITED', null, 30), false), { kind: 'rate', sec: 30 })
  assert.deepEqual(helperFailureOf(err(429), false), { kind: 'rate', sec: 10 })
})

test('helperFailureOf: 409 ENDED = 마친 방 · TURN_RUNNING = busy · PHRASE_BUSY(다른 탭) 와 그 밖 409 = 오류', () => {
  assert.deepEqual(helperFailureOf(err(409, 'CONFLICT', { reason: 'ENDED' }), false), { kind: 'ended' })
  assert.deepEqual(helperFailureOf(err(409, 'ENDED' as never), false), { kind: 'ended' })
  assert.deepEqual(helperFailureOf(err(409, 'CONFLICT', { reason: 'ROLEPLAY_ENDED' }), false), { kind: 'ended' })
  assert.deepEqual(helperFailureOf(err(409, 'CONFLICT', { reason: 'TURN_RUNNING' }), false), { kind: 'busy' })
  assert.deepEqual(helperFailureOf(err(409, 'CONFLICT', { reason: 'PHRASE_BUSY' }), false), { kind: 'error' })
  assert.deepEqual(helperFailureOf(err(409, 'CONFLICT'), false), { kind: 'error' })
})

test('helperFailureOf: 400 VALIDATION 은 서버 문구 그대로 입력 안내, 그 밖(0·404·502·봉투 밖)은 오류', () => {
  assert.deepEqual(helperFailureOf(err(400, 'VALIDATION', { field: 'queryKo', reason: 'no_hangul' }, null, '하고 싶은 말을 한국어로 써 주세요.'), false), {
    kind: 'invalid',
    message: '하고 싶은 말을 한국어로 써 주세요.',
  })
  assert.deepEqual(helperFailureOf(err(400, null, null, null, '요청을 처리하지 못했습니다 (400)'), false), { kind: 'error' })
  for (const s of [0, 404, 422, 500, 502]) assert.deepEqual(helperFailureOf(err(s), false), { kind: 'error' }, String(s))
  assert.deepEqual(helperFailureOf(toErr(new Error('x')), false), { kind: 'error' })
})

/* ── 요청 결말 ─────────────────────────────────────────────────────── */

async function run(request: () => Promise<unknown>, o: { live?: boolean; timedOut?: boolean } = {}): Promise<HelperSettle[]> {
  const got: HelperSettle[] = []
  await settleHelper({ request, live: () => o.live ?? true, timedOut: () => o.timedOut ?? false, settle: (r) => got.push(r) })
  return got
}
const abortErr = () => new DOMException('aborted', 'AbortError')

test('settleHelper: 결과 · 못 찾음 · 모양 틀림(오류) · HTTP 실패', async () => {
  assert.deepEqual(await run(async () => ({ items: [{ ja: 'はい', ko: '네' }] })), [{ kind: 'items', items: [{ ja: 'はい', ko: '네' }] }])
  assert.deepEqual(await run(async () => ({ items: [] })), [{ kind: 'items', items: [] }])
  assert.deepEqual(await run(async () => ({ nope: 1 })), [{ kind: 'failed', failure: { kind: 'error' } }])
  assert.deepEqual(
    await run(async () => {
      throw new ApiError('x', 429, 'RATE_LIMITED' as never, { retryAfterSec: 5 })
    }),
    [{ kind: 'failed', failure: { kind: 'rate', sec: 5 } }],
  )
})

test('settleHelper: 살아 있지 않은 요청의 늦은 응답·오류는 버린다 · 시간 초과 아닌 취소도 버린다 · 12초 끊김은 시간 초과', async () => {
  assert.deepEqual(await run(async () => ({ items: [] }), { live: false }), [])
  assert.deepEqual(
    await run(async () => {
      throw new ApiError('x', 502)
    }, { live: false }),
    [],
  )
  assert.deepEqual(
    await run(async () => {
      throw abortErr()
    }),
    [],
  )
  assert.deepEqual(
    await run(
      async () => {
        throw abortErr()
      },
      { timedOut: true },
    ),
    [{ kind: 'failed', failure: { kind: 'timeout' } }],
  )
})

test('helperAnnounceOf: 결과 「표현 n개를 찾았어요」 · 빈 결과 · 429 문장만 낭독 줄에(오류는 alert 상자)', () => {
  assert.equal(helperAnnounceOf({ kind: 'items', items: [{ ja: 'a', ko: 'a' }, { ja: 'b', ko: 'b' }] }), '표현 2개를 찾았어요')
  assert.equal(helperAnnounceOf({ kind: 'items', items: [] }), '이 말에 맞는 일본어를 찾지 못했어요.')
  assert.equal(helperAnnounceOf({ kind: 'failed', failure: { kind: 'rate', sec: 12 } }), '12초 뒤 다시 물어볼 수 있어요.')
  for (const kind of ['error', 'timeout', 'busy', 'ended'] as const) assert.equal(helperAnnounceOf({ kind: 'failed', failure: { kind } }), '', kind)
})

/* ── 문구·상수 ─────────────────────────────────────────────────────── */

test('문구 표(§22-7): 한도 100·시간 12초/5초, 데모 문구 그대로, 엔진·모델 이름 없음', () => {
  assert.equal(HELPER_MAX, 100)
  assert.equal(HELPER_COUNT_FROM, 90)
  assert.equal(HELPER_TIMEOUT_MS, 12_000)
  assert.equal(HELPER_SLOW_MS, 5_000)
  assert.equal(HELPER.button, '일본어 도우미')
  assert.equal(HELPER.tip, '한국어로 물어보면 일본어로 알려 줘요')
  assert.equal(HELPER.sub, '하고 싶은 말을 한국어로 물어보세요')
  assert.equal(HELPER.more(2), '다른 말투 2개 더 보기')
  assert.equal(HELPER.noneHint(HELPER.noneExample.rp), '짧은 한국어 문장으로 다시 써 보세요. 예: ‘얼음 적게 해 주세요’')
  assert.deepEqual(HELPER.examples.talk, ['목이 쉬었어요', '천천히 말해 주세요', '다음에 또 가고 싶어요'])
  assert.deepEqual(HELPER.examples.rp, ['얼음 적게 해 주세요', '빨대는 필요 없어요', '여기서 마실게요'])
  const all = JSON.stringify(HELPER, (_k, v) => (typeof v === 'function' ? v('X') : v))
  assert.doesNotMatch(all, /claude|haiku|sonnet|opus|whisper|reazon|style-?bert|sbv2|qwen|ollama|모델|엔진/i)
})

test('⑦A 대답 연습 입구 부제 — 문구 한 줄만 바뀐다', () => {
  assert.equal(PRACTICE.entrySub, '선생님 말에 맞는 대답 예시를 봐요')
  assert.equal(PRACTICE.entry, '대답 연습')
})
