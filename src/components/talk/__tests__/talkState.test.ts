import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveTalkState, type TalkStateInput } from '../talkState'
import { PTT_LABEL, TALK_STATUS } from '../talkCopy'

const BASE: TalkStateInput = {
  sttPhase: 'idle',
  turnPhase: 'idle',
  playbackPhase: 'idle',
  playbackSource: null,
  queued: false,
  rateLimitedSec: null,
  recordingSec: 0,
  askPermission: false,
  slowConnect: false,
  quietHint: null,
  idleHint: null,
}
const d = (p: Partial<TalkStateInput>) => deriveTalkState({ ...BASE, ...p })

test('회화 상태: IDLE — 누를 수 있고 ⌨ 보임·■ 숨김, 힌트가 있으면 힌트', () => {
  const v = d({})
  assert.equal(v.state, 'IDLE')
  assert.deepEqual(v.ptt, { phase: 'idle', disabled: false, label: PTT_LABEL.normal })
  assert.equal(v.statusText, TALK_STATUS.idle)
  assert.equal(v.showStop, false)
  assert.equal(v.keyboardDisabled, false)
  assert.equal(d({ idleHint: '너무 짧아요' }).statusText, '너무 짧아요')
})

test('회화 상태: IDLE·rateLimited — 막힘 + 남은 초', () => {
  const v = d({ rateLimitedSec: 7 })
  assert.equal(v.state, 'IDLE')
  assert.equal(v.sub, 'rateLimited')
  assert.equal(v.ptt.disabled, true)
  assert.equal(v.statusText, TALK_STATUS.rateLimited(7))
  assert.equal(d({ rateLimitedSec: 0 }).ptt.disabled, false, '0 이면 풀림')
})

test('회화 상태: IDLE·unavailable — 막힘 + 글자 권유', () => {
  const v = d({ sttPhase: 'unavailable' })
  assert.equal(v.state, 'IDLE')
  assert.equal(v.sub, 'unavailable')
  assert.equal(v.ptt.phase, 'unavailable')
  assert.equal(v.ptt.disabled, true)
  assert.equal(v.statusText, TALK_STATUS.unavailable)
})

test('회화 상태: RECORDING — starting/recording, 권한·연결 느림·소리 작음·경과 순', () => {
  for (const sttPhase of ['starting', 'recording'] as const) {
    const v = d({ sttPhase, recordingSec: 3 })
    assert.equal(v.state, 'RECORDING')
    assert.equal(v.ptt.disabled, false)
    assert.equal(v.keyboardDisabled, true)
    assert.equal(v.showStop, false)
    assert.equal(v.statusText, TALK_STATUS.recording(3))
  }
  assert.equal(d({ sttPhase: 'recording', recordingSec: 65 }).statusText, '듣고 있어요 · 1:05 — 손을 떼면 보내요')
  assert.equal(d({ sttPhase: 'starting', askPermission: true, slowConnect: true }).statusText, TALK_STATUS.askPermission)
  assert.equal(d({ sttPhase: 'recording', slowConnect: true, quietHint: 'q' }).statusText, TALK_STATUS.slowConnect)
  assert.equal(d({ sttPhase: 'recording', quietHint: '소리 작음' }).statusText, '소리 작음')
})

test('회화 상태: 녹음이 재생·턴보다 이긴다(barge-in 직후)', () => {
  const v = d({ sttPhase: 'recording', playbackPhase: 'playing', playbackSource: 'turn', turnPhase: 'streaming', queued: true })
  assert.equal(v.state, 'RECORDING')
})

test('회화 상태: RECOGNIZING — 막힘·⌨ 막힘', () => {
  const v = d({ sttPhase: 'finishing', turnPhase: 'streaming' })
  assert.equal(v.state, 'RECOGNIZING')
  assert.equal(v.ptt.disabled, true)
  assert.equal(v.ptt.phase, 'finishing')
  assert.equal(v.keyboardDisabled, true)
  assert.equal(v.statusText, TALK_STATUS.recognizing)
})

test('회화 상태: QUEUED — 재생·턴보다 이긴다, 막힘', () => {
  const v = d({ queued: true, playbackPhase: 'playing', playbackSource: 'turn', turnPhase: 'streaming' })
  assert.equal(v.state, 'QUEUED')
  assert.equal(v.ptt.disabled, true)
  assert.equal(v.keyboardDisabled, true)
  assert.equal(v.statusText, TALK_STATUS.queued)
})

test('회화 상태: SPEAKING — 누를 수 있음(barge-in 라벨)·■ 보임, 소스별 문구', () => {
  const t = d({ playbackPhase: 'playing', playbackSource: 'turn', turnPhase: 'streaming' })
  assert.equal(t.state, 'SPEAKING')
  assert.deepEqual(t.ptt, { phase: 'idle', disabled: false, label: PTT_LABEL.bargeIn })
  assert.equal(t.showStop, true)
  assert.equal(t.statusText, TALK_STATUS.speakingTurn)
  assert.equal(d({ playbackPhase: 'playing', playbackSource: 'replay' }).statusText, TALK_STATUS.speakingReplay)
  assert.equal(d({ playbackPhase: 'playing', playbackSource: 'mine' }).statusText, TALK_STATUS.speakingMine)
  assert.equal(d({ playbackPhase: 'playing', playbackSource: 'turn', sttPhase: 'unavailable' }).ptt.disabled, true, '마이크를 못 쓰면 막힘')
})

test('회화 상태: THINKING — sending·streaming·detached 는 막힘, 청크 받기 대기(waiting)도 THINKING', () => {
  for (const turnPhase of ['sending', 'streaming', 'detached'] as const) {
    const v = d({ turnPhase })
    assert.equal(v.state, 'THINKING')
    assert.equal(v.ptt.disabled, true)
    assert.equal(v.showStop, false)
    assert.equal(v.keyboardDisabled, false)
  }
  assert.equal(d({ turnPhase: 'detached' }).statusText, TALK_STATUS.thinkingDetached)
  assert.equal(d({ turnPhase: 'streaming' }).statusText, TALK_STATUS.thinking)
  assert.equal(d({ turnPhase: 'streaming', playbackPhase: 'waiting', playbackSource: 'turn' }).state, 'THINKING')
  assert.equal(d({ turnPhase: 'streaming', playbackPhase: 'blocked', playbackSource: 'turn' }).state, 'THINKING')
})

test('회화 상태: 턴이 끝났고 재생도 없으면 IDLE(waiting·blocked 도 IDLE — 막힘은 띠가 안내)', () => {
  assert.equal(d({ turnPhase: 'idle', playbackPhase: 'waiting', playbackSource: 'turn' }).state, 'IDLE')
  assert.equal(d({ turnPhase: 'failed' }).state, 'IDLE')
  assert.equal(d({ turnPhase: 'idle', playbackPhase: 'blocked', playbackSource: 'turn' }).ptt.disabled, false)
})
