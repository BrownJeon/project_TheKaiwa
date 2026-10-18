/**
 * task-077 UI-1 — 오늘의 회화 ⑤ 가 쓰도록 넓힌 공용 부품(말 바·도우미 문구·잠금 규칙·도우미 훅)의 선택 prop·주입 동작.
 * 기본값(= 지금 회화방·질문 탭) 마크업은 `voiceSharedFrozen`·`phraseHelper*` 가 보증하고, 여기서는 새 값이 실제로 쓰이는지와
 * 회화방·역할극 문구가 그대로인지를 손으로 적은 문자열로 본다.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement as h, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ApiError } from '@/components/common/api'
import { HELPER, type HelperRoomKind } from '../helperCopy'
import PhraseHelperPanel, { type PhraseHelperPanelProps } from '../PhraseHelperPanel'
import { claimHelperTip, HELPER_TIP_KEY, helperLocked, helperLockReason, helperLockToast, helperPanelShown, lessonHelperLockReason } from '../phraseHelperLogic'
import { TALK_ROOM } from '../talkCopy'
import type { TalkView } from '../talkState'
import { phraseHelpRequest, usePhraseHelper, type HelperPhase, type PhraseHelper, type PhraseHelperDeps } from '../usePhraseHelper'
import VoiceBar from '../VoiceBar'

const r = (el: ReactElement) => renderToStaticMarkup(el)
const noop = () => undefined
const text = (html: string) => html.replace(/<[^>]+>/g, '')

/* ── VoiceBar 선택 prop ─────────────────────────────────────────────── */

const view = (o: Partial<TalkView> = {}): TalkView => ({ state: 'IDLE', sub: null, ptt: { phase: 'idle', disabled: false, label: '누르고 말하기' }, statusText: '말해 보세요', showStop: false, keyboardDisabled: false, ...o })
const bar = (v: TalkView, p: Record<string, unknown> = {}) =>
  r(h(VoiceBar, { view: v, db: null, onPress: noop, onRelease: noop, onAbort: noop, onKeyboard: noop, onStop: noop, ...p } as never))

test('VoiceBar 기본값 = 지금: stopLabel·statusId 를 기본값 그대로 넘긴 마크업은 넘기지 않은 것과 같다(trailing 유무 × 재생 중)', () => {
  for (const showStop of [false, true]) {
    for (const trailing of [undefined, h('span', null, 'T')]) {
      const v = view({ showStop })
      assert.equal(bar(v, { trailing, stopLabel: '선생님 말 멈추기', statusId: 'talk-status' }), bar(v, { trailing }), `showStop=${showStop} trailing=${!!trailing}`)
    }
  }
  const def = bar(view({ showStop: true }))
  assert.match(def, /<div id="talk-status" class="flex h-6/)
  assert.match(def, /aria-describedby="talk-status"/)
  assert.match(def, /aria-label="선생님 말 멈추기"/)
  assert.equal(TALK_ROOM.stopTeacher, '선생님 말 멈추기')
})

test('VoiceBar stopLabel: ■ 이름만 바뀐다 — 바로 옆 칸(trailing 없음)과 마이크 오른쪽 칸(trailing 있음) 모두', () => {
  for (const trailing of [undefined, h('span', null, '가あ')]) {
    const html = bar(view({ showStop: true }), { stopLabel: '소리 멈추기', trailing })
    assert.match(html, /<button type="button" aria-label="소리 멈추기" class="grid h-11 w-11 place-items-center rounded-full bg-surface2 text-ink">/)
    assert.ok(!html.includes('선생님 말 멈추기'))
    // 이름 말고는 같다
    assert.equal(html.replace('소리 멈추기', '선생님 말 멈추기'), bar(view({ showStop: true }), { trailing }))
  }
  // 재생 중이 아니면 ■ 가 없으니 이름도 없다
  assert.ok(!bar(view(), { stopLabel: '소리 멈추기' }).includes('소리 멈추기'))
})

test('VoiceBar statusId: 상태 줄 id 와 누르고 말하기의 aria-describedby 가 같은 값으로 함께 바뀐다(talk-status 는 남지 않음)', () => {
  const html = bar(view(), { statusId: 'lesson-voice-status' })
  assert.match(html, /<div id="lesson-voice-status" class="flex h-6 min-w-0 items-center justify-center gap-2 text-\[13px\] text-ink2">/)
  assert.match(html, /aria-describedby="lesson-voice-status"/)
  assert.ok(!html.includes('talk-status'))
  assert.equal(html.replaceAll('lesson-voice-status', 'talk-status'), bar(view()))
})

test('VoiceBar 레슨용 view(§34-3): 상태 줄 문구·마이크 이름·확인 중 잠금·재생 중 ■·⌨ 이름·도우미 칸이 그대로 그려진다', () => {
  const lessonView: TalkView = { state: 'IDLE', sub: null, ptt: { phase: 'idle', disabled: true, label: '누르고 답하기' }, statusText: '확인하는 중…', showStop: true, keyboardDisabled: false }
  const html = bar(lessonView, { keyboardLabel: '글자로 답하기', stopLabel: '소리 멈추기', statusId: 'lesson-voice-status', trailing: h('button', { type: 'button', 'aria-label': '일본어 도우미' }) })
  assert.ok(text(html).includes('확인하는 중…'))
  assert.match(html, /aria-label="글자로 답하기"/)
  assert.match(html, /aria-label="소리 멈추기"/)
  assert.match(html, /aria-label="일본어 도우미"/)
  assert.match(html, /<button type="button" aria-label="누르고 답하기"[^>]*disabled=""/)
  assert.ok(!/aria-disabled="true"[^>]*aria-label="글자로 답하기"|aria-label="글자로 답하기" aria-disabled/.test(html), '⌨ 는 잠그지 않는다(keyboardDisabled false)')
  // 녹음 중이면 레벨 미터가 켜진다(view.state 로만 판단 — 레슨 view 는 녹음 때 RECORDING)
  const rec = bar({ ...lessonView, state: 'RECORDING', ptt: { phase: 'recording', disabled: false, label: '떼면 확인해요' }, statusText: '듣고 있어요', showStop: false }, { statusId: 'lesson-voice-status' })
  assert.equal(rec, bar({ ...lessonView, state: 'RECORDING', ptt: { phase: 'recording', disabled: false, label: '떼면 확인해요' }, statusText: '듣고 있어요', showStop: false }).replaceAll('talk-status', 'lesson-voice-status'))
})

/* ── 도우미 문구 ────────────────────────────────────────────────────── */

test("helperCopy 'lesson': 승인 데모 문구 표 그대로(손으로 적은 문자열)", () => {
  assert.equal(HELPER.placeholder.lesson, '예: 주말에 친구를 만났어요')
  assert.deepEqual([...HELPER.examples.lesson], ['주말에 친구를 만났어요', '요리하는 걸 좋아해요', '조금 더 연습하고 싶어요'])
  assert.equal(HELPER.noneExample.lesson, '주말에 친구를 만났어요')
  assert.equal(HELPER.lockedCheck, '답을 확인하는 중에는 열 수 없어요')
  assert.equal(HELPER.locked, '말하는 중에는 열 수 없어요')
})

test('helperCopy 회화방·역할극 문구는 그대로(손으로 적은 문자열)', () => {
  assert.equal(HELPER.placeholder.talk, '예: 목이 쉬었어요')
  assert.equal(HELPER.placeholder.rp, '예: 얼음 적게 해 주세요')
  assert.deepEqual([...HELPER.examples.talk], ['목이 쉬었어요', '천천히 말해 주세요', '다음에 또 가고 싶어요'])
  assert.deepEqual([...HELPER.examples.rp], ['얼음 적게 해 주세요', '빨대는 필요 없어요', '여기서 마실게요'])
  assert.equal(HELPER.noneExample.talk, '천천히 말해 주세요')
  assert.equal(HELPER.noneExample.rp, '얼음 적게 해 주세요')
  assert.equal(HELPER.lockedTurn, '선생님이 답하는 중에는 열 수 없어요')
  assert.equal(HELPER.tip, '한국어로 물어보면 일본어로 알려 줘요')
})

/* ── 판: kind 별 문구 ──────────────────────────────────────────────── */

function fakeH(phase: HelperPhase): PhraseHelper {
  return {
    open: true, setOpen: noop, close: noop, query: '', setQuery: noop, phase, items: [], more: false, setMore: noop, rateUntil: null, emptyHint: false, serverMsg: null,
    cancelled: false, cancelPending: () => false, typing: false, setTyping: noop, announce: '', ask: noop, retry: noop,
    sound: { view: () => ({ phase: 'idle', busy: false, look: 'off' }), line: () => ({ kind: 'none' }), stop: noop, tap: noop }, play: noop, stopSound: noop, fresh: true,
  } as unknown as PhraseHelper
}
const panel = (kind: HelperRoomKind, phase: HelperPhase, p: Partial<PhraseHelperPanelProps> = {}) =>
  r(h(PhraseHelperPanel, { h: fakeH(phase), kind, textMode: false, textOnly: false, locked: false, focusOnOpen: false, onClose: noop, onFill: noop, blocked: false, otherOpen: false, onDismiss: noop, ...p }))

test("판 kind='lesson': 입력칸 예·예시 칩 3개·빈 결과 예가 레슨 문구, 회화방·역할극 문구는 섞이지 않는다", () => {
  const idle = panel('lesson', 'idle')
  assert.match(idle, /placeholder="예: 주말에 친구를 만났어요"/)
  const chips = [...idle.matchAll(/<span class="block truncate">([^<]+)<\/span>/g)].map((m) => m[1])
  assert.deepEqual(chips, ['주말에 친구를 만났어요', '요리하는 걸 좋아해요', '조금 더 연습하고 싶어요'])
  assert.ok(!/목이 쉬었어요|얼음 적게/.test(idle))
  const none = text(panel('lesson', 'none'))
  assert.ok(none.includes('짧은 한국어 문장으로 다시 써 보세요. 예: ‘주말에 친구를 만났어요’'))
})

test("판 kind='talk'·'rp' 는 지금 문구 그대로 — 레슨 문구가 덮지 않는다", () => {
  const talk = panel('talk', 'idle')
  assert.match(talk, /placeholder="예: 목이 쉬었어요"/)
  assert.deepEqual([...talk.matchAll(/<span class="block truncate">([^<]+)<\/span>/g)].map((m) => m[1]), ['목이 쉬었어요', '천천히 말해 주세요', '다음에 또 가고 싶어요'])
  const rp = panel('rp', 'idle')
  assert.match(rp, /placeholder="예: 얼음 적게 해 주세요"/)
  for (const html of [talk, rp, panel('talk', 'none'), panel('rp', 'none')]) assert.ok(!/주말에 친구를|요리하는 걸|연습하고 싶어요/.test(html))
  assert.ok(text(panel('talk', 'none')).includes('예: ‘천천히 말해 주세요’'))
  assert.ok(text(panel('rp', 'none')).includes('예: ‘얼음 적게 해 주세요’'))
  // kind 만 다르고 뼈대는 같다(문구 자리만 바뀜)
  const strip = (s: string) => s.replace(/placeholder="[^"]*"/, '').replace(/<span class="block truncate">[^<]+<\/span>/g, '')
  assert.equal(strip(panel('lesson', 'idle')), strip(talk))
})

/* ── 잠금 규칙 ─────────────────────────────────────────────────────── */

test('lessonHelperLockReason: 시작·녹음·인식 마무리 = voice(확인 중이어도 voice 먼저) · 확인 중 = check · 그 밖 = 잠기지 않음', () => {
  const table: [string, boolean, string | null][] = [
    ['idle', false, null],
    ['idle', true, 'check'],
    ['starting', false, 'voice'],
    ['starting', true, 'voice'],
    ['recording', false, 'voice'],
    ['recording', true, 'voice'],
    ['finishing', false, 'voice'],
    ['finishing', true, 'voice'],
    ['unavailable', false, null],
    ['unavailable', true, 'check'],
  ]
  for (const [phase, checking, want] of table) assert.equal(lessonHelperLockReason(phase, checking), want, `${phase}/${checking}`)
})

test('helperLockToast: voice·null = 「말하는 중」 · turn = 「선생님이 답하는 중」 · check = 「답을 확인하는 중」', () => {
  assert.equal(helperLockToast('voice'), '말하는 중에는 열 수 없어요')
  assert.equal(helperLockToast(null), '말하는 중에는 열 수 없어요')
  assert.equal(helperLockToast('turn'), '선생님이 답하는 중에는 열 수 없어요')
  assert.equal(helperLockToast('check'), '답을 확인하는 중에는 열 수 없어요')
})

test('회화방 잠금 규칙은 그대로 — 턴 상태 전부(check 이유를 내지 않는다)', () => {
  const table: [string, string | null][] = [
    ['IDLE', null], ['RECORDING', 'voice'], ['RECOGNIZING', 'voice'], ['QUEUED', 'turn'], ['THINKING', 'turn'], ['SPEAKING', null], ['ERROR', null], ['', null],
  ]
  for (const [s, want] of table) {
    assert.equal(helperLockReason(s), want, s)
    assert.equal(helperLocked(s), want !== null, s)
  }
})

test('처음 한 번 안내 저장 키는 회화방과 같은 하나(B7 A) — 레슨에서 봤으면 회화방에서도 다시 뜨지 않는다', () => {
  assert.equal(HELPER_TIP_KEY, 'kaiwa.talk.helperTipSeen')
  const mem = new Map<string, string>()
  const read = ((_k: string, key: string) => mem.get(key) ?? null) as Parameters<typeof claimHelperTip>[0]
  const write = ((_k: string, key: string, v: string | null) => void (v === null ? mem.delete(key) : mem.set(key, v))) as Parameters<typeof claimHelperTip>[1]
  assert.equal(claimHelperTip(read, write), true, '처음(어느 화면이든)')
  assert.deepEqual([...mem.keys()], ['kaiwa.talk.helperTipSeen'])
  assert.equal(claimHelperTip(read, write), false, '두 번째 화면은 같은 키라 다시 안 뜬다')
})

test('helperPanelShown: ended 를 넘기지 않으면(마친 방이 없는 레슨) 열림만 본다 · 넘기면 지금 그대로', () => {
  assert.equal(helperPanelShown({ open: true }), true)
  assert.equal(helperPanelShown({ open: false }), false)
  assert.equal(helperPanelShown({ open: true, ended: true }), false)
  assert.equal(helperPanelShown({ open: true, ended: false }), true)
})

/* ── 도우미 훅: 요청 함수 주입 ─────────────────────────────────────── */
// 렌더러가 없어(서버 렌더만) 훅을 한 번 그려 반환값을 잡고, 렌더 밖에서 ask·cancelPending 을 부른다.
// 서버 렌더의 setState 는 아무것도 하지 않으므로 볼 수 있는 것은 요청 함수 호출·컨트롤러(동시 1건·취소)·결말 콜백(onEnded)뿐이다.

function probe(deps: PhraseHelperDeps): PhraseHelper {
  let got: PhraseHelper | null = null
  function Probe() {
    got = usePhraseHelper(deps)
    return null
  }
  r(h(Probe))
  assert.ok(got)
  return got
}

interface Call {
  q: string
  signal: AbortSignal
  resolve: (v: unknown) => void
  reject: (e: unknown) => void
}
function recorder() {
  const calls: Call[] = []
  const request = (q: string, signal: AbortSignal) =>
    new Promise<unknown>((resolve, reject) => {
      calls.push({ q, signal, resolve, reject })
    })
  return { calls, request }
}
const flush = () => new Promise((res) => setImmediate(res))
const base = { recording: false, roomSounding: false, stopOthers: noop }

test('주입한 요청 함수: 정리한 질의와 끊기 신호로 한 번 부르고 #180 주소(fetch)는 쓰지 않는다 · 받는 중엔 다시 부르지 않는다(동시 1건)', async () => {
  const realFetch = globalThis.fetch
  let fetched = 0
  globalThis.fetch = (() => {
    fetched++
    return Promise.reject(new Error('no fetch'))
  }) as typeof fetch
  try {
    const rec = recorder()
    const helper = probe({ ...base, request: rec.request })
    helper.ask('  주말에 친구를 만났어요 ')
    assert.equal(rec.calls.length, 1)
    assert.equal(rec.calls[0].q, '주말에 친구를 만났어요')
    assert.ok(rec.calls[0].signal instanceof AbortSignal)
    assert.equal(rec.calls[0].signal.aborted, false)
    helper.ask('요리하는 걸 좋아해요')
    assert.equal(rec.calls.length, 1, '받는 중에는 막힌다(pending)')
    rec.calls[0].resolve({ items: [{ ja: '週末に友達に会いました', ko: '주말에 친구를 만났어요' }] })
    await flush()
    helper.ask('요리하는 걸 좋아해요')
    assert.equal(rec.calls.length, 2, '결말이 나면 다음 요청을 받는다')
    assert.equal(rec.calls[1].q, '요리하는 걸 좋아해요')
    rec.calls[1].resolve({ items: [] })
    await flush()
    assert.equal(fetched, 0)
  } finally {
    globalThis.fetch = realFetch
  }
})

test('주입 경로의 잠금·빈 질의: recording(=레슨 잠금) 이면 부르지 않는다 · 빈 질의도 부르지 않는다', async () => {
  const rec = recorder()
  probe({ ...base, recording: true, request: rec.request }).ask('주말에 친구를 만났어요')
  const free = probe({ ...base, request: rec.request })
  free.ask('   ')
  assert.equal(rec.calls.length, 0)
})

test('주입 경로의 취소: cancelPending 은 신호를 끊고 true · 그 뒤 온 실패(409 ENDED)는 버린다 · 다시 물으면 새로 부른다', async () => {
  const rec = recorder()
  let ended = 0
  const helper = probe({ ...base, request: rec.request, onEnded: () => ended++ })
  helper.ask('주말에 친구를 만났어요')
  assert.equal(helper.cancelPending(), true)
  assert.equal(rec.calls[0].signal.aborted, true)
  assert.equal(helper.cancelPending(), false, '받는 중이 없으면 false')
  rec.calls[0].reject(new ApiError('끝', 409, null, { reason: 'ENDED' }))
  await flush()
  assert.equal(ended, 0, '취소한 요청의 늦은 실패는 결말로 쓰지 않는다')
  helper.ask('주말에 친구를 만났어요')
  assert.equal(rec.calls.length, 2)
  rec.calls[1].resolve({ items: [] })
  await flush()
})

test('주입 경로의 결말은 회화방과 같은 settle — 409 ENDED 는 onEnded 를 부르고, onEnded 가 없으면(레슨) 아무 일 없이 끝난다', async () => {
  const rec = recorder()
  let ended = 0
  const withEnded = probe({ ...base, request: rec.request, onEnded: () => ended++ })
  withEnded.ask('주말에 친구를 만났어요')
  rec.calls[0].reject(new ApiError('끝', 409, null, { reason: 'ENDED' }))
  await flush()
  assert.equal(ended, 1)

  const unhandled: unknown[] = []
  const onUnhandled = (e: unknown) => unhandled.push(e)
  process.on('unhandledRejection', onUnhandled)
  try {
    const lesson = probe({ ...base, request: rec.request })
    lesson.ask('주말에 친구를 만났어요')
    rec.calls[1].reject(new ApiError('끝', 409, null, { reason: 'ENDED' }))
    await flush()
    await flush()
    assert.deepEqual(unhandled, [], 'onEnded 없음 → 예외 없이 끝')
    lesson.ask('주말에 친구를 만났어요')
    assert.equal(rec.calls.length, 3, '결말이 나고 잠금이 풀렸다')
    rec.calls[2].reject(new ApiError('많이', 429, 'RATE_LIMITED', { retryAfterSec: 30 }))
    await flush()
    assert.deepEqual(unhandled, [])
  } finally {
    process.off('unhandledRejection', onUnhandled)
  }
})

test('기본 경로(chatId) = 지금 #180: fetch 주소·본문이 그대로', async () => {
  const realFetch = globalThis.fetch
  const seen: { url: string; body: string; signal: AbortSignal | null | undefined }[] = []
  globalThis.fetch = ((url: string, init: RequestInit) => {
    seen.push({ url, body: String(init.body), signal: init.signal })
    return Promise.resolve(new Response(JSON.stringify({ success: true, data: { items: [] } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  }) as unknown as typeof fetch
  try {
    probe({ ...base, chatId: 'c/1', ended: false, onEnded: noop }).ask(' 목이 쉬었어요 ')
    assert.equal(seen.length, 1)
    assert.equal(seen[0].url, '/api/v1/chats/c%2F1/phrase-help')
    assert.equal(seen[0].body, '{"queryKo":"목이 쉬었어요"}')
    assert.ok(seen[0].signal instanceof AbortSignal)
    await flush()
    await flush()
  } finally {
    globalThis.fetch = realFetch
  }
})

test('phraseHelpRequest(path): 같은 본문 모양({queryKo})으로 그 주소에 보낸다(#184 용)', async () => {
  const realFetch = globalThis.fetch
  const seen: { url: string; body: string; method?: string }[] = []
  globalThis.fetch = ((url: string, init: RequestInit) => {
    seen.push({ url, body: String(init.body), method: init.method })
    return Promise.resolve(new Response(JSON.stringify({ success: true, data: { items: [{ ja: 'はい', ko: '네' }] } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  }) as unknown as typeof fetch
  try {
    const ac = new AbortController()
    const out = await phraseHelpRequest('/api/v1/lessons/l1/phrase-help')('네', ac.signal)
    assert.deepEqual(seen, [{ url: '/api/v1/lessons/l1/phrase-help', body: '{"queryKo":"네"}', method: 'POST' }])
    assert.deepEqual(out, { items: [{ ja: 'はい', ko: '네' }] })
  } finally {
    globalThis.fetch = realFetch
  }
})
