/**
 * 일본어 도우미 「말하기를 시작하면 대기 중인 요청 자동 취소」(task-056, 사용자 결정 2026-10-11, screens §22 `hp-rec`·§22-10) —
 * 컨트롤러 동작은 `phraseHelperRequester.test.ts`, 여기는 그 위의 판단·표시·연결을 잠근다.
 *  - 안내 줄: 문구 한 줄 · 우선순위(서버 400 > 빈 제출 > 100자 초과 > 멈춤 안내 > 글자 수) · 오류 색이 아님 · 말하는 동안 읽지 않음(`aria-live=off`).
 *  - 안내가 언제 남고 언제 지워지는가(`CancelNote`): 판이 열려 있을 때 멈추면 이미 본 것(다시 열면 지움), 닫혀 있을 때 멈추면 다시 열었을 때 한 번 보임, 다음 질의가 지움.
 *  - 연결(소스를 해당 콜백 범위로 잘라서 본다 — 파일 전체 정규식 금지, REV-191 M-1): 훅 `cancelPending`·`ask`·`openPanel`, 방 `onPress`·`sendOutgoing`·최신 함수 동기화.
 *    소스는 **주석을 걷은 것**(`readCode`)에서 본다 — 주석 처리한 호출이 통과하지 않게(REV-194 F-1). 「조건 없이 부른다」는 호출 줄만이 아니라 콜백 본문 시작부터 호출까지를 본다(REV-194 F-2).
 */
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readCode } from '../../__tests__/sourceCode'
import { HELPER } from '../helperCopy'
import PhraseHelperPanel from '../PhraseHelperPanel'
import { cancelNoteOnCancel, cancelNoteOnOpen, helperMsgOf, type CancelNote } from '../phraseHelperLogic'
import type { PhraseHelper } from '../usePhraseHelper'

const SRC = join(process.cwd(), 'src/components/talk')
/** 주석을 걷어 낸 소스. */
const read = (f: string) => readCode(join(SRC, f))
const noop = () => {}

/** `from` 으로 시작해 그 뒤 첫 `to` 직전까지 — 둘 다 있어야 하고 너무 길면(다른 콜백까지 삼키면) 실패. */
function between(src: string, from: string, to: string, maxLen = 1500): string {
  const a = src.indexOf(from)
  assert.ok(a >= 0, `시작 표지가 소스에 없다: ${from}`)
  const b = src.indexOf(to, a + from.length)
  assert.ok(b > a, `끝 표지가 시작 뒤에 없다: ${to}`)
  const out = src.slice(a, b)
  assert.ok(out.length < maxLen, `범위가 너무 넓다(${out.length}자) — ${from} … ${to}`)
  return out
}

/**
 * 콜백(`between` 이 자른 조각, `=> {` 로 시작)에서 `call` 이 **조건 없이** 실행되는지 — 콜백 본문 시작부터 호출 직전까지(`before`)에
 *  - 분기·반복·단락·삼항·열림 확인(`if`·`&&`·`?:`·`helper.open` …)이 없고,
 *  - 중괄호·괄호가 모두 닫혀 있고(호출이 안쪽 블록·인자·화살표 함수 안에 들어 있지 않고),
 *  - 호출이 한 줄 전체인 문장이다.
 * 호출 줄만 보면 `if (helper.open)` 를 윗줄에 두는 변이가 통과한다(REV-194 F-2).
 */
function assertUnconditional(callback: string, call: string): void {
  const head = callback.indexOf('=> {')
  assert.ok(head >= 0, '콜백 머리(=> {) 가 조각에 있다')
  const at = callback.indexOf(call, head)
  assert.ok(at >= 0, `콜백 안에 ${call} 이 있다`)
  const before = callback.slice(head + '=> {'.length, at)
  const count = (re: RegExp) => before.match(re)?.length ?? 0
  assert.doesNotMatch(before, /\b(?:if|else|switch|case|for|while|do|try|catch|return|throw)\b|&&|\|\||\?\?|\?(?!\.)|=>|\b(?:helper|rp)\.(?:open|shown|typing|ended)\b/, `${call} 앞(콜백 시작 ~ 호출)에 조건·분기·열림 확인이 끼면 안 된다: ${before.trim().replace(/\s+/g, ' ')}`)
  assert.equal(count(/\{/g), count(/\}/g), `${call} 앞의 중괄호가 모두 닫혀 있다(블록 안에 들어 있지 않다)`)
  assert.equal(count(/\(/g), count(/\)/g), `${call} 앞의 괄호가 모두 닫혀 있다(인자·조건 안에 들어 있지 않다)`)
  const escaped = call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  assert.match(callback.slice(head), new RegExp(`\\n\\s*${escaped}\\s*;?\\s*\\n`), `${call} 은 한 줄 전체인 문장`)
}

/* ── 문구 · 안내 줄 ─────────────────────────────────────────────────── */

test('문구: 멈춤 안내는 사양 그대로 한 줄 — 엔진·모델 이름 없음', () => {
  assert.equal(HELPER.cancelled, '말하는 동안 도우미를 멈췄어요. 끝나면 다시 물어봐 주세요.')
  assert.doesNotMatch(HELPER.cancelled, /claude|haiku|sonnet|whisper|reazon|style-?bert|qwen|model|traceId/i)
})

test('안내 줄 우선순위: 서버 400 > 빈 제출 > 100자 초과 > 멈춤 안내 > 90자 글자 수 / 멈춤 안내는 오류 색(bad)·오른쪽 정렬(count)이 아니다', () => {
  const base = { query: '목이 쉬었어요', emptyHint: false, serverMsg: null as string | null, cancelled: true }
  assert.deepEqual(helperMsgOf(base), { text: HELPER.cancelled, bad: false, count: false }, '멈춤 안내')
  assert.equal(helperMsgOf({ ...base, cancelled: false }), null, '안 멈췄으면 아무것도 없다')
  assert.equal(helperMsgOf({ query: base.query, emptyHint: false, serverMsg: null }), null, 'cancelled 를 안 넘겨도 예전과 같다')
  assert.deepEqual(helperMsgOf({ ...base, serverMsg: '서버 안내' }), { text: '서버 안내', bad: true, count: false }, '서버 400 안내가 먼저')
  assert.deepEqual(helperMsgOf({ ...base, query: '   ', emptyHint: true }), { text: HELPER.empty, bad: true, count: false }, '빈 제출이 먼저')
  assert.equal(helperMsgOf({ ...base, query: '   ', emptyHint: false })?.text, HELPER.cancelled, '빈 칸이어도 제출 전이면 멈춤 안내')
  const n101 = 'あ'.repeat(101)
  assert.deepEqual(helperMsgOf({ ...base, query: n101 }), { text: HELPER.over(101), bad: true, count: true }, '100자 초과가 먼저')
  const n95 = 'あ'.repeat(95)
  assert.deepEqual(helperMsgOf({ ...base, query: n95 }), { text: HELPER.cancelled, bad: false, count: false }, '90자 이상 글자 수보다 멈춤 안내가 먼저')
  assert.deepEqual(helperMsgOf({ ...base, query: n95, cancelled: false }), { text: HELPER.count(95), bad: false, count: true }, '멈춤이 없으면 글자 수')
})

/* ── 안내가 언제 남고 지워지는가 ───────────────────────────────────── */

test('CancelNote: 멈춘 순간 판이 그려져 있었으면 seen · 닫혀 있었으면 unseen / 열면 seen→지움, unseen→이번에 보임(seen)', () => {
  assert.equal(cancelNoteOnCancel(true), 'seen')
  assert.equal(cancelNoteOnCancel(false), 'unseen')
  assert.equal(cancelNoteOnOpen(null), null)
  assert.equal(cancelNoteOnOpen('seen'), null)
  assert.equal(cancelNoteOnOpen('unseen'), 'seen')
})

test('CancelNote 시나리오(훅 배선과 같은 순서): 열린 채 멈춤 → 닫았다 열면 지움 / 닫힌 채 멈춤 → 열면 보임 → 한 번 더 열면 지움 / 다음 질의가 지움', () => {
  type S = { open: boolean; note: CancelNote }
  const cancel = (s: S): S => ({ ...s, note: cancelNoteOnCancel(s.open) })
  const open = (s: S): S => ({ open: true, note: cancelNoteOnOpen(s.note) })
  const close = (s: S): S => ({ ...s, open: false })
  const ask = (s: S): S => ({ ...s, note: null })
  const visible = (s: S) => s.open && s.note !== null

  // A) 판이 열려 있을 때 녹음을 눌러 멈춤 — 녹음 내내 보이고, 보낸 뒤(accepted 로 판이 닫힘) 다시 열면 지워져 있다
  let a: S = { open: true, note: null }
  a = cancel(a)
  assert.equal(visible(a), true, '녹음 중 판에 보인다')
  a = close(a)
  a = open(a)
  assert.equal(visible(a), false, '다시 열면 이미 본 안내는 지워져 있다')

  // B) 판을 닫아 둔 채 멈춤 — 다시 열었을 때 안내가 보이고, 그다음 열 때 지워진다
  let b: S = { open: false, note: null }
  b = cancel(b)
  assert.equal(b.note, 'unseen')
  b = open(b)
  assert.equal(visible(b), true, '닫혀 있는 동안 멈췄다면 다시 열었을 때 보인다')
  b = close(b)
  b = open(b)
  assert.equal(visible(b), false, '한 번 보인 뒤 다시 열면 지움')

  // C) 안내가 보이는 판에서 다음 질의를 보내면 지운다(요청이 막혀 못 보낸 경우는 지우지 않는다 — 훅 `ask` 가 막힘 검사 뒤에서만 지움)
  let c: S = { open: true, note: null }
  c = ask(cancel(c))
  assert.equal(visible(c), false)

  // D) 멈춘 뒤 판을 연 채 두 번째 취소가 없는 한 안내는 그대로 남는다(질의를 고쳐 써도 사라지지 않는다)
  let d: S = { open: true, note: null }
  d = cancel(d)
  assert.equal(visible(d), true)
})

/* ── 판 렌더 ─────────────────────────────────────────────────────── */

function fakeH(p: Record<string, unknown> = {}): PhraseHelper {
  return {
    open: true, setOpen: noop, close: noop, query: '목이 쉬었어요', setQuery: noop, phase: 'idle', items: [], more: false, setMore: noop, rateUntil: null,
    emptyHint: false, serverMsg: null, cancelled: false, cancelPending: () => false, typing: false, setTyping: noop, announce: '', ask: noop, retry: noop,
    sound: { view: () => ({ phase: 'idle', busy: false, look: 'off' }), line: () => ({ kind: 'live', text: '' }) }, play: noop, stopSound: noop, fresh: true, ...p,
  } as unknown as PhraseHelper
}
const panel = (h: PhraseHelper, locked: boolean) =>
  renderToStaticMarkup(
    createElement(PhraseHelperPanel, { h, kind: 'talk', textMode: false, textOnly: false, locked, focusOnOpen: false, onClose: noop, onFill: noop, blocked: false, otherOpen: false, onDismiss: noop }),
  )
const msgLine = (html: string) => html.match(/<p id="talk-helper-msg"[^>]*>[^<]*<\/p>/)?.[0] ?? ''

test('판 안내 줄: 멈췄으면 문구가 보이고 질의는 입력칸에 남는다 — idle 본문(예시 칩)·오류 상자(alert) 없음 / 멈춤이 없으면 빈 줄', () => {
  for (const locked of [true, false]) {
    const html = panel(fakeH({ cancelled: true }), locked)
    const msg = msgLine(html)
    assert.ok(msg.includes(HELPER.cancelled), `locked=${locked}: 안내 줄에 문구`)
    assert.doesNotMatch(msg, /text-bad/, '오류 색이 아니다')
    assert.ok(html.includes('value="목이 쉬었어요"'), '질의 유지')
    assert.doesNotMatch(html, /role="alert"/, '오류·시간 초과 상자가 뜨지 않는다')
    assert.ok(html.includes(HELPER.examplesLead), 'phase=idle 본문')
  }
  assert.match(msgLine(panel(fakeH(), false)), /<p id="talk-helper-msg" role="status" class="[^"]*"><\/p>/, '멈춤이 없으면 빈 줄')
})

test('판 안내 줄: 말하는 동안(locked)은 aria-live=off 로 읽지 않는다(마이크에 섞이지 않게, §9-0 ⑨) / 풀려 있으면 예전 그대로 role=status 만', () => {
  assert.match(msgLine(panel(fakeH({ cancelled: true }), true)), /^<p id="talk-helper-msg" role="status" aria-live="off" class=/)
  const open = msgLine(panel(fakeH({ cancelled: true }), false))
  assert.doesNotMatch(open, /aria-live/, '글자 전송처럼 말하는 중이 아닐 때는 읽는다')
  assert.match(open, /^<p id="talk-helper-msg" role="status" class=/)
})

/* ── 연결(해당 콜백 범위만 잘라 본다) ─────────────────────────────────── */

test('훅 cancelPending: 컨트롤러가 실제로 취소했을 때만 idle·안내 — 질의·결과는 건드리지 않고 판 열림 여부로 seen/unseen', () => {
  const hook = read('usePhraseHelper.ts')
  const body = between(hook, 'const cancelPending = useCallback(() => {', '}, [req])', 700)
  const gate = body.indexOf('if (!req.cancelPending()) return false')
  const phase = body.indexOf("setPhase('idle')")
  const note = body.indexOf('setCancelNote(cancelNoteOnCancel(helperPanelShown({ open: openRef.current, ended: depsRef.current.ended })))')
  assert.ok(gate >= 0 && phase > gate && note > gate, '컨트롤러가 취소했을 때만(끝난 상태는 false → 표시 없음) idle·안내')
  assert.ok(body.trimEnd().endsWith('return true'))
  assert.doesNotMatch(body, /setQuery|setItems|setMore|setServerMsg|setEmptyHint|setRateUntil|close\(|setOpen/, '질의·결과·열림은 그대로')
  assert.match(hook, /useEffect\(\(\) => \{\s*openRef\.current = open\s*\}, \[open\]\)/, '열림 여부를 ref 로 따라간다')
})

test('훅 ask: 막힘 검사를 통과해 실제로 보낼 때만 멈춤 안내를 지운다 / 판 열기는 cancelNoteOnOpen / 닫기는 안내를 건드리지 않는다 / 반환값', () => {
  const hook = read('usePhraseHelper.ts')
  const ask = between(hook, 'const ask = (override?: string) => {', 'void req.start(', 900)
  const block = ask.indexOf('if (block) return')
  const clear = ask.indexOf('setCancelNote(null)')
  assert.ok(block >= 0 && clear > block, '막혀서 못 보낸 질의는 안내를 지우지 않는다')
  const openPanel = between(hook, 'const openPanel = (v: boolean) => {', '\n  }', 200)
  assert.match(openPanel, /setOpen\(v\)\s*if \(v\) setCancelNote\(cancelNoteOnOpen\)/)
  assert.match(hook, /setOpen: openPanel,/)
  const close = between(hook, 'const close = useCallback(() => {', '}, [])', 200)
  assert.doesNotMatch(close, /setCancelNote|cancelPending/, '닫기는 요청도 안내도 건드리지 않는다(결과 기억)')
  assert.match(hook, /cancelled: cancelNote !== null,\s*cancelPending,/)
  // 훅 안 효과에서 상태를 바꾸지 않는다(set-state-in-effect) — 취소는 방의 사건 처리기에서만 부른다
  assert.doesNotMatch(hook, /useEffect\(\(\) => \{\s*if \(d\.recording\) cancelPending/)
})

test('방 onPress: 마이크를 누르면 소리 정지 뒤 도우미 요청을 접는다 — 녹음 시작(stt.press) 전에, 판이 열려 있든 닫혀 있든 무조건', () => {
  const room = read('TalkRoom.tsx')
  const onPress = between(room, 'const onPress = () => {', 'const onRelease', 900)
  const stop = onPress.indexOf('helper.stopSound()')
  const cancel = onPress.indexOf('helper.cancelPending()')
  const press = onPress.indexOf('stt.press()')
  assert.ok(stop >= 0 && cancel > stop && press > cancel, 'stopSound → cancelPending → stt.press')
  // 열림 여부 조건 없이 부른다 — 콜백 시작부터 호출까지 if·&&·helper.open 이 끼지 않고 블록 안도 아니다(윗줄 `if (helper.open)` 도 잡는다)
  assertUnconditional(onPress, 'helper.cancelPending()')
  // 녹음을 시작하는 길은 onPress 하나(회화방 안)
  assert.equal((room.match(/stt\.press\(\)/g) ?? []).length, 1)
})

test('방 sendOutgoing: 모든 턴 시작(글자 전송·다시 보내기·밀려 있던 말·말 최종)이 지나는 길에서 turn.send 보다 먼저 도우미 요청을 접는다', () => {
  const room = read('TalkRoom.tsx')
  const send = between(room, 'const sendOutgoing = (o: Outgoing, via: InputMode) => {', 'void turn.send(', 1500)
  const cancel = send.indexOf('cancelHelperRef.current()')
  assert.ok(cancel >= 0, 'sendOutgoing 안에서 부른다')
  assert.equal(send.slice(0, send.indexOf('\n') + 1).includes('=> {'), true)
  assert.ok(send.slice(send.indexOf('\n') + 1).trimStart().startsWith('cancelHelperRef.current()'), '본문 첫 줄 — 어떤 상태 기록·타이밍 계산보다 먼저')
  assertUnconditional(send, 'cancelHelperRef.current()')
  // STT 콜백이 닿는 함수라 helper.* 를 직접 쓰면 컴파일러 린트가 onFinal 의 Date.now() 를 오탐한다 — 최신 함수를 ref 로 읽는다
  assert.doesNotMatch(send, /\bhelper\./)
  // 글자 전송·다시 보내기·말 최종·밀려 있던 말이 모두 sendOutgoing 을 지난다
  assert.match(between(room, 'const sendText = (text: string) => {', 'const resendUnsent', 400), /sendOutgoing\(\{ text, utteranceId, origin: \{ origin: 'send', originAt: perfNow\(\) \} \}, 'text'\)/)
  assert.match(between(room, 'const resendUnsent = () => {', 'const editUnsent', 600), /sendOutgoing\(\{ text: u\.text,/)
  assert.match(between(room, 'const onFinal = (f: SttFinal) => {', 'const stt = useRealtimeStt', 1800), /sendOutgoing\(o, 'voice'\)/)
  assert.match(room, /setTimeout\(\(\) => sendOutgoing\(q, 'voice'\), 0\)/)
  // 모든 sendOutgoing 호출처를 센다 — 새 길이 생기면 이 시험이 알려 준다
  assert.equal((room.match(/sendOutgoing\(/g) ?? []).length, 4, '호출처: 글자 전송·다시 보내기·말 최종·밀려 있던 말')
})

test('방 → 훅 연결: 최신 helper.cancelPending 을 효과로 ref 에 옮긴다(렌더 중 ref 쓰기 금지) / 판 열기는 훅의 setOpen(openPanel) 그대로', () => {
  const room = read('TalkRoom.tsx')
  assert.match(room, /const cancelHelperRef = useRef<\(\) => boolean>\(\(\) => false\)/)
  assert.match(room, /const cancelHelperPending = helper\.cancelPending\s*useEffect\(\(\) => \{\s*cancelHelperRef\.current = cancelHelperPending\s*\}, \[cancelHelperPending\]\)/)
  assert.match(room, /rp\.closePractice\(\)\s*if \(rp\.goalOpen\) rp\.toggleGoal\(\)\s*helper\.setOpen\(true\)/)
})
