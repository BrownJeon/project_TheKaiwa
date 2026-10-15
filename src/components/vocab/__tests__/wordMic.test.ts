/**
 * task-069 — 단어 추가 시트 말로 쓰기의 순수 규칙: 결과 반영(표현 바꿔 넣기·예문 이어 붙이기·빈 결과·한도), 칸 전환, 막힘 판정, 상태 줄.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recordingStatus, STT_HINT_COPY, STT_STATUS_COPY } from '@/components/speech/sttCopy'
import { initialSttUi, sttUiReducer, type SttUiEvent, type SttUiState } from '@/components/speech/sttUiState'
import {
  applyMicResult,
  applyMicToForm,
  dismissedAfterRetarget,
  micBlockedCode,
  micClose,
  micFinalAction,
  micFinalStep,
  MIC_REFS_INIT,
  micPress,
  micResultFocus,
  micToggle,
  visibleMicError,
  wordMicStatusText,
  type MicRefs,
} from '../wordMic'
import { emptyForm, validateWord } from '../validate'

const run = (s: SttUiState, ...events: SttUiEvent[]) => events.reduce((st, e) => sttUiReducer(st, e).state, s)
const idle = () => initialSttUi(0)
const unavailable = (code: 'INSECURE' | 'SERVER_UNAVAILABLE' = 'INSECURE') => run(idle(), { type: 'PREFLIGHT', error: { code, mountCheck: true }, blocking: true })

test('표현은 바꿔 넣는다 — 한 번 더 말하면 다시 말하기', () => {
  assert.equal(applyMicResult('surface', '映画', '食べる'), '食べる')
  assert.equal(applyMicResult('surface', '', '  よろしくお願いします  '), 'よろしくお願いします')
})

test('표현은 한 줄 칸이라 줄바꿈을 없앤다', () => {
  assert.equal(applyMicResult('surface', '', '映画\n館'), '映画館')
  assert.equal(applyMicResult('surface', '', '映画\r\n'), '映画')
})

test('예문은 끝에 이어 붙인다 — 빈 칸이면 그대로', () => {
  assert.equal(applyMicResult('example', '今日は天気がいいです。', '散歩に行きます。'), '今日は天気がいいです。散歩に行きます。')
  assert.equal(applyMicResult('example', '', '散歩に行きます。'), '散歩に行きます。')
  assert.equal(applyMicResult('example', '  \n ', '散歩に行きます。'), '散歩に行きます。')
})

test('빈 결과는 칸을 건드리지 않는다', () => {
  for (const t of ['surface', 'example'] as const) {
    assert.equal(applyMicResult(t, '映画', ''), null)
    assert.equal(applyMicResult(t, '映画', ' \n '), null)
  }
})

test('한도를 넘어도 자르지 않는다 — 기존 검증 문구가 보인다', () => {
  const longSurface = 'あ'.repeat(81)
  const s = applyMicResult('surface', '', longSurface)
  assert.equal(s, longSurface)
  assert.equal(validateWord({ ...emptyForm(), surface: s ?? '' }).surface, '표현은 80자까지 쓸 수 있어요')
  const ok = applyMicResult('surface', '', 'あ'.repeat(80))
  assert.equal(validateWord({ ...emptyForm(), surface: ok ?? '' }).surface, undefined)

  const e = applyMicResult('example', 'あ'.repeat(1999), 'いう')
  assert.equal(Array.from(e ?? '').length, 2001)
  assert.equal(validateWord({ ...emptyForm(), surface: '映画', example: e ?? '' }).example, '예문은 2,000자까지 쓸 수 있어요')
})

test('손을 뗀 뒤 결과 — 누른 칸을 떠났으면 무시, 비면 안내, 아니면 그 칸에 넣는다', () => {
  assert.deepEqual(micFinalAction(null, 'surface', '映画'), { kind: 'ignore' })
  assert.deepEqual(micFinalAction('surface', null, '映画'), { kind: 'ignore' })
  assert.deepEqual(micFinalAction('surface', 'example', '映画'), { kind: 'ignore' })
  assert.deepEqual(micFinalAction('example', 'example', '  '), { kind: 'empty' })
  assert.deepEqual(micFinalAction('example', 'example', ' 散歩 '), { kind: 'apply', target: 'example', text: '散歩' })
})

test('칸 전환 — 같은 칸을 다시 누르면 글자로, 다른 칸이면 옮기며 녹음을 멈춘다', () => {
  assert.deepEqual(micToggle(null, 'surface', false), { target: 'surface', abort: false })
  assert.deepEqual(micToggle('surface', 'surface', false), { target: null, abort: true })
  assert.deepEqual(micToggle('surface', 'example', false), { target: 'example', abort: true })
})

test('막힌 환경에서는 열지 않지만 이미 열린 칸은 글자로 돌아갈 수 있다', () => {
  assert.deepEqual(micToggle(null, 'surface', true), { target: null, abort: false })
  assert.deepEqual(micToggle('surface', 'example', true), { target: 'surface', abort: false })
  assert.deepEqual(micToggle('example', 'example', true), { target: null, abort: true })
})

test('닫기 — 열린 칸이 없으면 그대로, only 를 주면 그 칸일 때만', () => {
  assert.deepEqual(micClose(null), { target: null, abort: false })
  assert.deepEqual(micClose('surface'), { target: null, abort: true })
  assert.deepEqual(micClose('surface', 'example'), { target: 'surface', abort: false })
  assert.deepEqual(micClose('example', 'example'), { target: null, abort: true })
})

test('막힘 판정 — 사전 점검이 막은 환경과 마이크 거부만, 일시 오류는 막지 않는다', () => {
  assert.equal(micBlockedCode(idle()), null)
  assert.equal(micBlockedCode(unavailable('INSECURE')), 'INSECURE')
  assert.equal(micBlockedCode(unavailable('SERVER_UNAVAILABLE')), 'SERVER_UNAVAILABLE')
  assert.equal(micBlockedCode(run(idle(), { type: 'PERMISSION', state: 'denied' })), 'MIC_DENIED')
  assert.equal(micBlockedCode({ phase: 'unavailable', error: null }), 'UNSUPPORTED')
  const transient = run(idle(), { type: 'ERROR', now: 1, code: 'CONNECT_FAILED' })
  assert.equal(transient.error?.code, 'CONNECT_FAILED')
  assert.equal(micBlockedCode(transient), null)
  // 권한을 다시 허용하면 풀린다
  assert.equal(micBlockedCode(run(idle(), { type: 'PERMISSION', state: 'denied' }, { type: 'PERMISSION', state: 'granted' })), null)
})

test('상태 줄 — 수업 말로 쓰기와 같은 우선순위', () => {
  assert.equal(wordMicStatusText(idle(), null), STT_STATUS_COPY.idle)
  assert.equal(wordMicStatusText(idle(), STT_HINT_COPY.EMPTY_RESULT), STT_HINT_COPY.EMPTY_RESULT)
  assert.equal(wordMicStatusText({ ...idle(), hint: 'SHORT_PRESS' }, null), STT_HINT_COPY.SHORT_PRESS)
  assert.equal(wordMicStatusText({ ...idle(), rationale: true }, null), STT_STATUS_COPY.rationale)
  assert.equal(wordMicStatusText({ ...idle(), rationale: true, error: { code: 'MIC_DENIED' } }, null), STT_STATUS_COPY.idle)
  assert.equal(wordMicStatusText(unavailable(), '무시되는 힌트'), STT_STATUS_COPY.unavailable)
  assert.equal(wordMicStatusText({ ...idle(), phase: 'finishing' }, null), STT_STATUS_COPY.finishing)
  const rec: SttUiState = { ...idle(), phase: 'recording', recordingAt: 0, now: 3000 }
  assert.equal(wordMicStatusText(rec, null), recordingStatus(3))
  assert.equal(wordMicStatusText({ ...rec, hint: 'TOO_QUIET' }, null), STT_HINT_COPY.TOO_QUIET)
  assert.equal(wordMicStatusText({ ...rec, slow: true }, null), STT_STATUS_COPY.slowConnect)
  assert.equal(wordMicStatusText({ ...idle(), phase: 'starting', permBefore: 'prompt' }, null), STT_STATUS_COPY.askPermission)
})

test('결과를 폼 값으로(R3·R9) — 예문은 폼의 지금 값에 이어 붙고 표현은 바꿔 들어가며, 한도를 넘으면 값은 그대로 두고 검증 문구를 돌려준다', () => {
  const form = { ...emptyForm('映画'), example: '今日は天気がいいです。' }
  const ex = applyMicToForm(form, 'example', '散歩に行きます。')
  assert.equal(ex?.value, '今日は天気がいいです。散歩に行きます。')
  assert.equal(ex?.error, undefined)
  const su = applyMicToForm(form, 'surface', ' 食べる ')
  assert.equal(su?.value, '食べる')
  assert.equal(su?.error, undefined)
  assert.equal(applyMicToForm(form, 'example', '  '), null)
  assert.equal(applyMicToForm(form, 'surface', ''), null)

  const longSurface = 'あ'.repeat(81)
  const over = applyMicToForm(form, 'surface', longSurface)
  assert.equal(over?.value, longSurface)
  assert.equal(over?.error, '표현은 80자까지 쓸 수 있어요')
  const longEx = applyMicToForm({ ...form, example: 'あ'.repeat(1999) }, 'example', 'いう')
  assert.equal(Array.from(longEx?.value ?? '').length, 2001)
  assert.equal(longEx?.error, '예문은 2,000자까지 쓸 수 있어요')
  // 다른 칸의 오류(뜻이 비었음)는 이 칸의 안내로 새지 않는다
  assert.equal(applyMicToForm(form, 'example', 'いう')?.error, undefined)
})

test('누름(R8) — 그 순간 열린 칸을 누른 칸으로 기록하고, 열린 칸이 없으면 기록할 칸도 없다', () => {
  assert.deepEqual(micPress({ target: 'example', pressed: null }), { target: 'example', pressed: 'example' })
  assert.deepEqual(micPress({ target: 'surface', pressed: 'example' }), { target: 'surface', pressed: 'surface' })
  assert.deepEqual(micPress({ target: null, pressed: 'example' }), { target: null, pressed: null })
})

test('결과 도착(R4·R7) — 누른 칸에 그대로 있으면 반영하며 닫고, 떠났거나 누른 적 없으면 무시, 비었으면 칸을 열어 둔다', () => {
  // 정상: 표현 칸을 열고 → 누르고 → 결과 → 반영 + 두 값이 비워진다(글자 모드로 복귀)
  const pressed = micPress({ target: 'surface', pressed: null })
  const done = micFinalStep(pressed, ' 映画 ')
  assert.deepEqual(done.action, { kind: 'apply', target: 'surface', text: '映画' })
  assert.deepEqual(done.refs, MIC_REFS_INIT)
  // 같은 결과가 다시 와도(늦은 중복) 이미 닫혔으므로 무시
  const again = micFinalStep(done.refs, '映画')
  assert.deepEqual(again.action, { kind: 'ignore' })
  // 누른 뒤 다른 칸으로 옮겼다면 늦게 온 결과는 버린다
  const moved: MicRefs = { target: 'example', pressed: 'surface' }
  const lost = micFinalStep(moved, '映画')
  assert.deepEqual(lost.action, { kind: 'ignore' })
  assert.equal(lost.refs, moved)
  // 누른 뒤 글자 모드로 돌아갔다면 마찬가지
  assert.deepEqual(micFinalStep({ target: null, pressed: 'surface' }, '映画').action, { kind: 'ignore' })
  // 누른 적이 없는데 온 결과
  assert.deepEqual(micFinalStep({ target: 'surface', pressed: null }, '映画').action, { kind: 'ignore' })
  // 빈 결과는 안내만 — 칸은 열린 채
  const empty = micFinalStep(pressed, '  ')
  assert.deepEqual(empty.action, { kind: 'empty' })
  assert.equal(empty.refs, pressed)
})

test('칸이 바뀌면 그때 보이던 오류를 넘긴다(REV069-4) — 이전 칸의 오류 띠가 다음 칸에 먼저 보이지 않는다', () => {
  const e1 = { code: 'CONNECT_FAILED' as const }
  const e2 = { code: 'CONNECT_FAILED' as const }
  // 표현 칸에서 난 오류를 글자로 쓰기로 닫은 뒤 예문 칸을 연다
  let dismissed = dismissedAfterRetarget('surface', null, e1, null)
  assert.equal(dismissed, e1)
  assert.equal(visibleMicError(e1, dismissed), null)
  dismissed = dismissedAfterRetarget(null, 'example', e1, dismissed)
  assert.equal(visibleMicError(e1, dismissed), null)
  // 칸을 직접 옮길 때도, 닫힌 칸을 열 때도
  assert.equal(dismissedAfterRetarget('surface', 'example', e1, null), e1)
  assert.equal(dismissedAfterRetarget(null, 'surface', e1, null), e1)
  // 그 뒤 새로 난 오류는 보인다(다른 객체)
  assert.equal(visibleMicError(e2, dismissed), e2)
  // 칸이 그대로거나 보이는 오류가 없으면 이전 값을 지키고, 오류가 없으면 가릴 것도 없다
  assert.equal(dismissedAfterRetarget('surface', 'surface', e2, e1), e1)
  assert.equal(dismissedAfterRetarget('surface', null, null, e1), e1)
  assert.equal(visibleMicError(null, e1), null)
  assert.equal(visibleMicError(e1, null), e1)
})

test('결과가 들어간 칸의 전환 버튼으로만 포커스를 옮긴다(REV069-2) — 마운트 때와 남의 칸 결과에는 옮기지 않는다', () => {
  assert.equal(micResultFocus(null, null), false)
  assert.equal(micResultFocus(null, { n: 1 }), true)
  assert.equal(micResultFocus(1, { n: 1 }), false) // 단계가 바뀌어 새로 그려진 칸 — 이미 본 결과
  assert.equal(micResultFocus(1, { n: 2 }), true)
  assert.equal(micResultFocus(2, null), false) // 다른 칸의 결과
})
