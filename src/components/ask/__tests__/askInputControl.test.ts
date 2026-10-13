/**
 * task-066 FIX(REV-U2 F-1) — 질문 입력 묶음의 말 모드 배선 규칙을 가짜 의존으로 잠근다.
 * 감사 변이 V2(말 질문이 글자로 저장) · V3(한 번 취소하면 이후 말 질문이 전부 버려짐) · V4(취소가 인식을 안 멈춤) · V5(답 대기 중에도 전송) ·
 * V7(오류 띠가 글자 모드에도 보임) · V15(모드 서버 스냅샷이 'voice') · V17(다시 보내기에서 429 검사 빠짐) 이 여기서 실패한다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import ts from 'typescript'
import { TALK_HINT } from '@/components/talk/talkCopy'
import { ASK_COPY } from '../askCopy'
import { ASK_VOICE_COPY, type AskUnsent } from '../askVoiceCopy'
import { blockedLeftSec, makeAskInputControl, type AskInputSnapshot } from '../askInputControl'
import { askNoticeText, type AskVia } from '../logic'
import { ASK_INPUT_MODE_SERVER, askModeOf, askShowSttAlert } from '../voiceView'
import { calls, declOf, effectCallbacks, ownerName, parseCode, text, walk } from './astCode'

function fake(init: Partial<AskInputSnapshot> = {}) {
  const snap: AskInputSnapshot = { busy: false, isBusy: false, blockedUntil: null, notice: null, ...init }
  const log = {
    sent: [] as Array<[string, AskVia]>,
    toasts: [] as string[],
    unsent: [] as Array<AskUnsent | null>,
    hints: [] as Array<string | null>,
    cancelled: [] as boolean[],
    out: [] as boolean[],
    press: 0,
    abort: 0,
  }
  let clock = 1_000
  const ctl = makeAskInputControl({
    read: () => snap,
    now: () => clock,
    onSend: (t, v) => log.sent.push([t, v]),
    toast: (m) => log.toasts.push(m),
    setUnsent: (u) => log.unsent.push(u),
    setLocalHint: (h) => log.hints.push(h),
    setCancelled: (c) => log.cancelled.push(c),
    setOut: (o) => log.out.push(o),
    sttPress: () => void log.press++,
    sttAbort: () => void log.abort++,
  })
  return { ctl, snap, log, setNow: (n: number) => void (clock = n) }
}

test('V2 손을 뗀 뒤 글은 앞뒤 공백을 빼고 「말」 갈래로 한 번 보낸다 — 띠·힌트는 비운다', () => {
  const f = fake()
  f.ctl.onFinal(' 大丈夫 ')
  assert.deepEqual(f.log.sent, [['大丈夫', 'voice']], "via 는 'voice' (글자로 보내면 inputSource 가 TEXT 로 저장된다)")
  assert.deepEqual(f.log.unsent, [null])
  assert.deepEqual(f.log.hints, [null])
})

test('빈 글은 무시 · 1자 이하는 보내지 않고 힌트 · 그 밖은 보냄', () => {
  const f = fake()
  f.ctl.onFinal('   ')
  assert.deepEqual([f.log.sent, f.log.hints, f.log.unsent], [[], [], []])
  f.ctl.onFinal('木')
  assert.deepEqual(f.log.sent, [])
  assert.deepEqual(f.log.hints, [TALK_HINT.tooShort])
})

test('V3 한 번 취소해도 다음 누름에서 풀려 이후 말 질문이 다시 보내진다 · 취소 중에 늦게 온 결과는 보내지 않는다', () => {
  const f = fake()
  f.ctl.cancel()
  assert.equal(f.ctl.isCancelled(), true)
  f.ctl.onFinal('大丈夫') // 취소 직후 늦게 도착한 인식 결과
  assert.deepEqual(f.log.sent, [], '취소한 말은 늦게 와도 보내지 않는다')
  assert.deepEqual(f.log.unsent, [], '띠도 만들지 않는다')
  f.ctl.press()
  assert.equal(f.ctl.isCancelled(), false, '다음 누름이 취소 표지를 푼다')
  f.ctl.onFinal('大丈夫')
  assert.deepEqual(f.log.sent, [['大丈夫', 'voice']], '풀리지 않으면 이후 말 질문이 전부 조용히 버려진다')
})

test('V4 취소 = 인식 중단 1번 + 토스트 + 밖 표시 해제 + 취소 표지, 전송 없음 · 누름 = 표지·힌트 비움 + 인식 시작 1번', () => {
  const f = fake()
  f.ctl.cancel()
  assert.equal(f.log.abort, 1, '인식을 멈추지 않으면 녹음이 계속된다')
  assert.deepEqual(f.log.toasts, [ASK_VOICE_COPY.cancelledToast])
  assert.deepEqual(f.log.out, [false])
  assert.deepEqual(f.log.cancelled, [true])
  assert.deepEqual(f.log.sent, [])
  f.ctl.press()
  assert.equal(f.log.press, 1)
  assert.deepEqual(f.log.cancelled, [true, false])
  assert.deepEqual(f.log.hints, [null])
})

test('V5 답을 기다리는 중에는 보내지 않고 「보내지 못한 말」 띠 — 화면 상태(busy)와 동기 검사(isBusy) 둘 다', () => {
  for (const snap of [{ busy: true }, { isBusy: true }, { busy: true, isBusy: true }]) {
    const f = fake(snap)
    f.ctl.onFinal('大丈夫')
    assert.deepEqual(f.log.sent, [], JSON.stringify(snap))
    assert.deepEqual(f.log.unsent, [{ text: '大丈夫', reason: 'self409' }], JSON.stringify(snap))
  }
})

test('429 로 막힌 동안은 보내지 않고 띠 — 서버 이유·남은 초를 안내 줄에서 가져온다 · 막힌 시각이 지났으면 보냄', () => {
  const f = fake({ blockedUntil: 5_000, notice: { kind: 'rate', text: '', retryAfterSec: 40, status: 429, reason: 'ASK_RATE' } })
  f.ctl.onFinal('大丈夫')
  assert.deepEqual(f.log.sent, [])
  assert.deepEqual(f.log.unsent, [{ text: '大丈夫', reason: 429, askReason: 'ASK_RATE', retryAfterSec: 40 }])
  f.setNow(5_000)
  f.ctl.onFinal('大丈夫')
  assert.deepEqual(f.log.sent, [['大丈夫', 'voice']])
  const bare = fake({ blockedUntil: 5_000 })
  bare.ctl.onFinal('大丈夫')
  assert.deepEqual(bare.log.unsent, [{ text: '大丈夫', reason: 429, askReason: null, retryAfterSec: null }])
})

test('V17 보낼 수 있나(canSendNow) — 바쁨 → 429 → 통과, 이유는 토스트 · 다시 보내기도 같은 검사를 거친다', () => {
  const busy = fake({ isBusy: true })
  assert.equal(busy.ctl.canSendNow(), false)
  assert.deepEqual(busy.log.toasts, [ASK_COPY.sendLocked])

  const notice = { kind: 'rate' as const, text: '', retryAfterSec: 30, status: 429, reason: 'ASK_RATE' }
  const blocked = fake({ blockedUntil: 1_000 + 12_000, notice })
  assert.equal(blocked.ctl.canSendNow(), false)
  assert.deepEqual(blocked.log.toasts, [askNoticeText(notice, 12)])
  assert.equal(fake().ctl.canSendNow(), true)

  // 다시 보내기: 화면이 바쁘면 sendLocked, 동기 검사가 바쁘면 sendLocked, 429 면 안내, 통과하면 띠 비우고 말로 보냄
  const r1 = fake({ busy: true })
  r1.ctl.resend('大丈夫')
  assert.deepEqual([r1.log.sent, r1.log.toasts], [[], [ASK_COPY.sendLocked]])
  const r2 = fake({ isBusy: true })
  r2.ctl.resend('大丈夫')
  assert.deepEqual([r2.log.sent, r2.log.toasts], [[], [ASK_COPY.sendLocked]])
  const r3 = fake({ blockedUntil: 1_000 + 12_000, notice })
  r3.ctl.resend('大丈夫')
  assert.deepEqual([r3.log.sent, r3.log.toasts], [[], [askNoticeText(notice, 12)]], '429 로 막혔는데 다시 보내면 안 된다')
  assert.deepEqual(r3.log.unsent, [], '막힌 동안 띠는 그대로(비우지 않는다)')
  const r4 = fake()
  r4.ctl.resend('大丈夫')
  assert.deepEqual(r4.log.sent, [['大丈夫', 'voice']])
  assert.deepEqual(r4.log.unsent, [null])
})

test('blockedLeftSec — 막히지 않았으면 0, 올림', () => {
  assert.equal(blockedLeftSec(null, 1000), 0)
  assert.equal(blockedLeftSec(1000, 1000), 0)
  assert.equal(blockedLeftSec(1001, 1000), 1)
  assert.equal(blockedLeftSec(2500, 1000), 2)
})

// ── 순수 도우미(V7·V15) ──────────────────────────────────────────────────────────

test('V7 인식 오류 띠는 말 모드에서만 · 닫은 오류는 숨김', () => {
  const err = { code: 'MIC_DENIED' }
  assert.equal(askShowSttAlert('voice', err, null), true)
  assert.equal(askShowSttAlert('text', err, null), false, '글자로 묻는 사람에게 마이크 오류를 먼저 보이지 않는다')
  assert.equal(askShowSttAlert('voice', null, null), false)
  assert.equal(askShowSttAlert('voice', err, err), false, '닫은 오류')
  assert.equal(askShowSttAlert('voice', err, { code: 'MIC_DENIED' }), true, '새 오류 객체는 다시 보인다')
})

test('V15 입력 모드 — 서버 첫 그림은 늘 글자, 저장 값은 voice 만 말', () => {
  assert.equal(ASK_INPUT_MODE_SERVER, 'text')
  assert.equal(askModeOf('voice'), 'voice')
  for (const raw of ['text', '', null, 'VOICE', 'x']) assert.equal(askModeOf(raw), 'text', String(raw))
})

// ── 훅 배선(소스 구조) ───────────────────────────────────────────────────────────

const hookFile = join(__dirname, '..', 'useAskInput.tsx')

test('훅 배선 — 컨트롤러 1개를 만들어 누름·취소·손 뗌·다시 보내기·칩에 꽂는다(규칙을 훅에 다시 쓰지 않는다)', () => {
  const sf = parseCode(hookFile)
  const mk = calls(sf, (c) => c === 'makeAskInputControl')
  assert.equal(mk.length, 1)
  const obj = mk[0].arguments[0]
  assert.ok(obj && ts.isObjectLiteralExpression(obj))
  const props = new Map(obj.properties.filter(ts.isPropertyAssignment).map((p) => [p.name.getText(), p.initializer.getText()]))
  const short = obj.properties.filter(ts.isShorthandPropertyAssignment).map((p) => p.name.getText())
  assert.deepEqual([...props.keys(), ...short].sort(), ['now', 'onSend', 'read', 'setCancelled', 'setLocalHint', 'setOut', 'setUnsent', 'sttAbort', 'sttPress', 'toast'])
  assert.deepEqual(short.sort(), ['setCancelled', 'setLocalHint', 'setOut', 'setUnsent'], '화면 상태 쓰기는 훅의 상태 setter 그대로')
  // 최신 값은 매번 ref 에서 새로 읽는다(busy 를 false 로 고정하지 않는다)
  const read = props.get('read') ?? ''
  assert.match(read, /busy: c\.busy, isBusy: c\.isBusy\(\), blockedUntil: c\.blockedUntil, notice: c\.notice/)
  assert.match(props.get('onSend') ?? '', /optsRef\.current\.onSend\(text, via\)/)
  assert.match(props.get('sttPress') ?? '', /sttApiRef\.current\.press\(\)/)
  assert.match(props.get('sttAbort') ?? '', /sttApiRef\.current\.abort\(\)/)
  assert.equal(props.get('now'), 'Date.now')

  const t = text(sf)
  assert.match(t, /const onFinal = useCallback\(\(f: SttFinal\) => control\.onFinal\(f\.text\), \[control\]\)/)
  assert.match(t, /const press = control\.press/)
  assert.match(t, /useState\(\(\) => \(\{ onCancel: control\.cancel, onOutChange: setOut \}\)\)/)
  assert.match(t, /onResend=\{\(\) => control\.resend\(u\.text\)\}/)
  assert.match(t, /if \(!control\.canSendNow\(\)\) return false\s*onSend\(text, 'text'\)/)
  // 규칙이 훅으로 되돌아오지 않았다
  assert.ok(!/cancelledRef|askFinalAction|blockedLeftSec/.test(t), '취소 표지·손 뗀 뒤 판정·429 계산은 컨트롤러 안에만')
  // 인식기 호출은 최신 인식기를 layout 효과로 ref 에 넣는다
  const fx = effectCallbacks(sf).map(text).find((e) => e.includes('sttApiRef.current ='))
  assert.ok(fx && /press: stt\.press, abort: stt\.abort/.test(fx))
  // 말 바의 중단(onAbort)은 취소 표지를 켜지 않는 인식 중단 그대로
  assert.match(t, /onAbort=\{sttAbort\}/)
})

test('V7·V15 훅 배선 — 띠는 askShowSttAlert(mode, …) 로 · 모드 서버 스냅샷은 ASK_INPUT_MODE_SERVER', () => {
  const sf = parseCode(hookFile)
  const show = calls(sf, (c) => c === 'askShowSttAlert')
  assert.equal(show.length, 1)
  assert.equal(ownerName(show[0]), 'showSttAlert')
  assert.deepEqual(show[0].arguments.map((a) => a.getText()), ['mode', 'sttError', 'dismissedSttError'])
  const syncs = calls(sf, (c) => c === 'useSyncExternalStore')
  assert.equal(syncs.length, 1)
  assert.deepEqual(syncs[0].arguments.map((a) => a.getText()), ['subscribeMode', 'readMode', '() => ASK_INPUT_MODE_SERVER'])
  assert.match(text(declOf(sf, 'readMode')), /askModeOf\(readStore\('session', ASK_KEYS\.inputMode\)\)/)
  // 옛 상수 이름이 다시 생기지 않았다
  let others = 0
  walk(sf, (n) => {
    if (ts.isIdentifier(n) && n.text === 'serverMode') others++
  })
  assert.equal(others, 0)
})
