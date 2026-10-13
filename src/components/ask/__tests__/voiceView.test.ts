/**
 * task-066 §26-13 ⑥⑦⑧ — 질문 탭 말 바 상태·손을 뗀 뒤 판정·보내기 옵션(순수).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STT_HINT_COPY, STT_STATUS_COPY } from '@/components/speech/sttCopy'
import { TALK_HINT, TALK_STATUS } from '@/components/talk/talkCopy'
import { ASK_VOICE_COPY } from '../askVoiceCopy'
import { askSendOptions } from '../logic'
import { askDailyBlocked, askFinalAction, askIdleHint, askVoiceView, type AskVoiceViewInput } from '../voiceView'

const BASE: AskVoiceViewInput = {
  sttPhase: 'idle',
  busy: false,
  out: false,
  askPermission: false,
  slowConnect: false,
  quiet: false,
  recordingSec: 2,
  rateLimitedSec: null,
  rateReason: null,
  hint: null,
}
const v = (p: Partial<AskVoiceViewInput>) => askVoiceView({ ...BASE, ...p })

test('말 바 7행: 녹음 → 알아듣는 중 → 답 기다림 → 쓸 수 없음 → 하루 → 분당 → 대기', () => {
  const rec = v({ sttPhase: 'recording' })
  assert.deepEqual([rec.state, rec.ptt.disabled, rec.statusText, rec.keyboardDisabled], ['RECORDING', false, TALK_STATUS.recording(2), true])
  assert.equal(TALK_STATUS.recording(2), '듣고 있어요 · 0:02 — 손을 떼면 보내요')
  assert.equal(v({ sttPhase: 'starting' }).state, 'RECORDING')
  const fin = v({ sttPhase: 'finishing' })
  assert.deepEqual([fin.state, fin.ptt.disabled, fin.statusText, fin.keyboardDisabled], ['RECOGNIZING', true, '알아듣는 중…', true])
  const busy = v({ busy: true })
  assert.deepEqual([busy.state, busy.ptt.disabled, busy.statusText, busy.keyboardDisabled], ['THINKING', true, '답을 받은 뒤 말할 수 있어요', false])
  const un = v({ sttPhase: 'unavailable' })
  assert.deepEqual([un.state, un.sub, un.ptt.disabled, un.statusText], ['IDLE', 'unavailable', true, '지금은 말로 물어볼 수 없어요 · 글자로 물어보세요'])
  const day = v({ rateLimitedSec: 40, rateReason: 'ASK_DAILY' })
  assert.deepEqual([day.sub, day.ptt.disabled, day.statusText], ['rateLimited', true, '오늘은 더 물어볼 수 없어요'])
  assert.equal(v({ rateLimitedSec: 3601 }).statusText, ASK_VOICE_COPY.daily, '이유 없어도 3,600초 넘으면 하루')
  const rate = v({ rateLimitedSec: 12, rateReason: 'ASK_RATE' })
  assert.deepEqual([rate.sub, rate.ptt.disabled, rate.statusText], ['rateLimited', true, '12초 뒤에 말할 수 있어요'])
  const idle = v({})
  assert.deepEqual([idle.state, idle.sub, idle.ptt.disabled, idle.statusText], ['IDLE', null, false, '누르고 있는 동안 일본어로 말해요'])
  assert.equal(v({ hint: 'H' }).statusText, 'H')
  assert.equal(v({ busy: true, busyText: '대화를 불러오고 있어요' }).statusText, '대화를 불러오고 있어요', '불러오는 중 잠금 문구(선택)')
})

test('말 바 우선순위: 녹음 중이면 busy·429 여도 RECORDING · 권한 > 밖 > 연결 느림 > 소리 작음 · 하루가 분당보다 먼저 · busy 가 쓸 수 없음보다 먼저', () => {
  assert.equal(v({ sttPhase: 'recording', busy: true, rateLimitedSec: 9 }).state, 'RECORDING')
  assert.equal(v({ sttPhase: 'recording', askPermission: true, out: true }).statusText, TALK_STATUS.askPermission)
  assert.equal(v({ sttPhase: 'recording', out: true, slowConnect: true, quiet: true }).statusText, '손을 떼면 보내지 않아요')
  assert.equal(v({ sttPhase: 'recording', slowConnect: true, quiet: true }).statusText, TALK_STATUS.slowConnect)
  assert.equal(v({ sttPhase: 'recording', quiet: true }).statusText, STT_HINT_COPY.TOO_QUIET)
  assert.equal(v({ busy: true, sttPhase: 'unavailable' }).state, 'THINKING')
  assert.equal(v({ sttPhase: 'unavailable', rateLimitedSec: 9 }).sub, 'unavailable')
  assert.equal(v({ rateLimitedSec: 5000, rateReason: 'ASK_RATE' }).statusText, ASK_VOICE_COPY.daily)
  assert.equal(askDailyBlocked(0, 'ASK_DAILY'), false, '막힌 시간이 끝나면 하루 줄도 끝')
})

test('말 바: 버튼 이름 고정(barge-in 이름 없음) · ■ 없음 · 질문은 줄 세우지 않음(QUEUED 없음)', () => {
  const all: Partial<AskVoiceViewInput>[] = [{}, { sttPhase: 'recording' }, { sttPhase: 'finishing' }, { busy: true }, { sttPhase: 'unavailable' }, { rateLimitedSec: 3 }]
  for (const p of all) {
    const view = v(p)
    assert.equal(view.ptt.label, '누르고 있는 동안 일본어로 말하기')
    assert.equal(view.showStop, false)
    assert.notEqual(view.state, 'QUEUED')
    assert.notEqual(view.state, 'SPEAKING')
  }
})

test('대기 힌트: 이 화면 힌트 > STT 힌트 > 권한 이유 · 취소 직후 「중간에 멈춤」·「짧은 누름」 숨김 · 자동 멈춤·소리 작음은 줄에 안 씀', () => {
  const base = { localHint: null, sttHint: null, cancelled: false, rationale: false, hasError: false }
  assert.equal(askIdleHint({ ...base, localHint: TALK_HINT.tooShort, sttHint: 'EMPTY_RESULT' }), '너무 짧아서 보내지 않았어요. 한 번 더 말해 보세요.')
  for (const h of ['SHORT_PRESS', 'PERMISSION_GRANTED', 'EMPTY_RESULT', 'INTERRUPTED'] as const) assert.equal(askIdleHint({ ...base, sttHint: h }), STT_HINT_COPY[h])
  assert.equal(askIdleHint({ ...base, sttHint: 'INTERRUPTED', cancelled: true }), null)
  assert.equal(askIdleHint({ ...base, sttHint: 'SHORT_PRESS', cancelled: true }), null)
  assert.equal(askIdleHint({ ...base, sttHint: 'EMPTY_RESULT', cancelled: true }), STT_HINT_COPY.EMPTY_RESULT)
  assert.equal(askIdleHint({ ...base, sttHint: 'AUTO_STOPPED' }), null)
  assert.equal(askIdleHint({ ...base, sttHint: 'TOO_QUIET' }), null)
  assert.equal(askIdleHint({ ...base, rationale: true }), STT_STATUS_COPY.rationale)
  assert.equal(askIdleHint({ ...base, rationale: true, hasError: true }), null)
})

test('손을 뗀 뒤 판정: 빈 글 무시 · 1자 이하 안 보냄 · 답 기다리면 띠(줄 세우지 않음) · 429 면 띠 · 그 밖 앞뒤 공백 뺀 글을 바로', () => {
  const s = { busy: false, blockedUntil: null, now: 1000 }
  assert.deepEqual(askFinalAction('', s), { kind: 'ignore' })
  assert.deepEqual(askFinalAction('   ', s), { kind: 'ignore' })
  assert.deepEqual(askFinalAction('木', s), { kind: 'tooShort' })
  assert.deepEqual(askFinalAction(' こ ', s), { kind: 'tooShort' })
  assert.deepEqual(askFinalAction('𠮷', s), { kind: 'tooShort' }, '코드포인트 1개(서로게이트 쌍)')
  assert.deepEqual(askFinalAction('大丈', s), { kind: 'send', text: '大丈' })
  assert.deepEqual(askFinalAction(' 大丈夫 ', s), { kind: 'send', text: '大丈夫' })
  assert.deepEqual(askFinalAction('大丈夫', { ...s, busy: true }), { kind: 'unsentSelf', text: '大丈夫' })
  assert.deepEqual(askFinalAction('大丈夫', { ...s, blockedUntil: 5000 }), { kind: 'unsent429', text: '大丈夫' })
  assert.deepEqual(askFinalAction('大丈夫', { ...s, blockedUntil: 1000 }), { kind: 'send', text: '大丈夫' }, '막힌 시각이 지났으면 보냄')
  assert.deepEqual(askFinalAction('大丈夫', { busy: true, blockedUntil: 5000, now: 1000 }).kind, 'unsentSelf', '답 기다림이 429 보다 먼저')
})

test('보내기 옵션: 말 = REALTIME_STT 만(발화 id 키 없음 — 목소리 미저장), 글자 = 빈 옵션', () => {
  const voice = askSendOptions('voice')
  assert.deepEqual(voice, { inputSource: 'REALTIME_STT' })
  assert.ok(!('utteranceId' in voice))
  assert.deepEqual(Object.keys(voice), ['inputSource'])
  assert.deepEqual(askSendOptions('text'), {})
})
