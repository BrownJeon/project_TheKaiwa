import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialSttUi, sttUiReducer, transcriptParts, showAskPermission, elapsedSec, type SttUiEvent, type SttUiState } from '../sttUiState'
import { sttErrorCopy } from '../sttCopy'

function run(s: SttUiState, ...evs: SttUiEvent[]): { state: SttUiState; effects: string[] } {
  let st = s
  const effects: string[] = []
  for (const e of evs) {
    const r = sttUiReducer(st, e)
    st = r.state
    effects.push(...r.effects)
  }
  return { state: st, effects }
}

test('누름 → starting(STOP_TTS·BEGIN) → 준비 → recording → 뗌 → finishing(END) → final → idle', () => {
  const r = run(initialSttUi(), { type: 'PRESS', now: 0, perm: 'granted' }, { type: 'BEGIN_OK', now: 50 }, { type: 'PARTIAL', segIdx: 0, text: 'こん' }, { type: 'RELEASE', now: 1500 })
  assert.equal(r.state.phase, 'finishing')
  assert.deepEqual(r.effects, ['STOP_TTS', 'BEGIN', 'END'])
  assert.deepEqual(transcriptParts(r.state), { committed: '', partial: 'こん' })
  const f = run(r.state, { type: 'FINAL', now: 1800, text: 'こんにちは' })
  assert.equal(f.state.phase, 'idle')
  assert.deepEqual(f.state.committed, ['こんにちは'])
  assert.deepEqual(f.state.segs, {})
  assert.equal(f.state.announce?.text, 'こんにちは')
  assert.equal(f.state.hadResult, true)
})

test('첫 누름이 권한 프롬프트면 녹음 없이 끝(권한 허용 힌트), 허용된 기기의 짧은 누름은 SHORT_PRESS', () => {
  const r = run(initialSttUi(), { type: 'PRESS', now: 0, perm: 'prompt' }, { type: 'RELEASE', now: 200 }, { type: 'BEGIN_OK', now: 3000 })
  assert.equal(r.state.phase, 'idle')
  assert.equal(r.state.hint, 'PERMISSION_GRANTED')
  assert.deepEqual(r.effects, ['STOP_TTS', 'BEGIN', 'CANCEL'])
  const u = run(initialSttUi(), { type: 'PRESS', now: 0, perm: 'unknown' }, { type: 'RELEASE', now: 100 }, { type: 'BEGIN_OK', now: 900 })
  assert.equal(u.state.hint, 'PERMISSION_GRANTED', 'Permissions API 없음 + 600ms 이상 걸림 = 프롬프트로 본다')
  const g = run(initialSttUi(), { type: 'PRESS', now: 0, perm: 'granted' }, { type: 'RELEASE', now: 100 }, { type: 'BEGIN_OK', now: 120 })
  assert.equal(g.state.hint, 'SHORT_PRESS')
})

test('300ms 미만 녹음은 취소, 뗀 뒤 8초 결과 없음은 TIMEOUT', () => {
  const s = run(initialSttUi(), { type: 'PRESS', now: 0, perm: 'granted' }, { type: 'BEGIN_OK', now: 20 }, { type: 'RELEASE', now: 250 })
  assert.equal(s.state.phase, 'idle')
  assert.equal(s.state.hint, 'SHORT_PRESS')
  assert.equal(s.effects.at(-1), 'CANCEL')
  const t = run(initialSttUi(), { type: 'PRESS', now: 0, perm: 'granted' }, { type: 'BEGIN_OK', now: 20 }, { type: 'RELEASE', now: 1000 }, { type: 'TICK', now: 8_999 }, { type: 'TICK', now: 9_000 })
  assert.equal(t.state.phase, 'idle')
  assert.equal(t.state.error?.code, 'TIMEOUT')
  assert.equal(t.effects.at(-1), 'CANCEL')
})

test('30초 상한 자동 멈춤, 누르는 중 온 final 은 누적, 빈 결과 힌트', () => {
  const r = run(initialSttUi(), { type: 'PRESS', now: 0, perm: 'granted' }, { type: 'BEGIN_OK', now: 0 }, { type: 'LEVEL', now: 100, db: -20 }, { type: 'FINAL', now: 5000, text: 'はい' }, { type: 'TICK', now: 30_000 })
  assert.equal(r.state.phase, 'finishing')
  assert.equal(r.state.hint, 'AUTO_STOPPED')
  assert.deepEqual(r.state.committed, ['はい'])
  const done = run(r.state, { type: 'FINAL', now: 30_500, text: 'いいえ' })
  assert.deepEqual(done.state.committed, ['はい', 'いいえ'])
  assert.equal(done.state.hint, 'AUTO_STOPPED')
  const empty = run(initialSttUi(), { type: 'PRESS', now: 0, perm: 'granted' }, { type: 'BEGIN_OK', now: 0 }, { type: 'RELEASE', now: 900 }, { type: 'FINAL', now: 1200, text: '  ' })
  assert.equal(empty.state.hint, 'EMPTY_RESULT')
  assert.equal(empty.state.announce, null)
})

test('소리 작음: 최근 3초 −50dBFS 미만이면 힌트, 커지면 지움', () => {
  const r = run(initialSttUi(), { type: 'PRESS', now: 0, perm: 'granted' }, { type: 'BEGIN_OK', now: 0 }, { type: 'LEVEL', now: 500, db: -70 }, { type: 'TICK', now: 3_100 })
  assert.equal(r.state.hint, 'TOO_QUIET')
  assert.equal(r.state.phase, 'recording')
  const loud = run(r.state, { type: 'LEVEL', now: 3_200, db: -30 })
  assert.equal(loud.state.hint, null)
  assert.equal(elapsedSec(loud.state), 3)
})

test('오류: 누름 중 오류는 idle + CANCEL, 막는 오류는 unavailable, 오프라인/온라인 전환', () => {
  const e = run(initialSttUi(), { type: 'PRESS', now: 0, perm: 'granted' }, { type: 'BEGIN_OK', now: 0 }, { type: 'ERROR', now: 10, code: 'CONNECTION_LOST' })
  assert.equal(e.state.phase, 'idle')
  assert.equal(e.state.error?.code, 'CONNECTION_LOST')
  assert.equal(e.effects.at(-1), 'CANCEL')
  const f = run(initialSttUi(), { type: 'PRESS', now: 0, perm: 'granted' }, { type: 'BEGIN_FAIL', now: 5, code: 'MIC_DENIED' })
  assert.equal(f.state.phase, 'idle', '권한 거부는 버튼을 막지 않는다')
  const off = run(initialSttUi(), { type: 'OFFLINE', now: 1 })
  assert.equal(off.state.phase, 'unavailable')
  assert.equal(run(off.state, { type: 'ONLINE', now: 2 }).state.phase, 'idle')
  const pre = run(initialSttUi(), { type: 'PREFLIGHT', error: { code: 'SERVER_UNAVAILABLE', mountCheck: true }, blocking: true })
  assert.equal(pre.state.phase, 'unavailable')
  assert.equal(run(pre.state, { type: 'PRESS', now: 0, perm: 'granted' }).effects.length, 0, '막힌 상태에서 누름 무시')
  const denied = run(initialSttUi(), { type: 'PERMISSION', state: 'denied' })
  assert.equal(denied.state.error?.code, 'MIC_DENIED')
  assert.equal(run(denied.state, { type: 'PERMISSION', state: 'granted' }).state.error, null)
})

test('권한 묻는 문구는 prompt 이거나 400ms 넘을 때만, 문구에 엔진·주소 없음', () => {
  const s = run(initialSttUi(), { type: 'PRESS', now: 0, perm: 'granted' }, { type: 'TICK', now: 100 }).state
  assert.equal(showAskPermission(s), false)
  assert.equal(showAskPermission(run(s, { type: 'TICK', now: 450 }).state), true)
  const codes = ['INSECURE', 'UNSUPPORTED', 'MIC_DENIED', 'MIC_NOT_FOUND', 'MIC_BUSY', 'OFFLINE', 'SERVER_UNAVAILABLE', 'CONNECT_FAILED', 'CONNECTION_LOST', 'TICKET', 'REPLACED', 'BUSY', 'ENGINE_ERROR', 'TIMEOUT', 'MODEL_REQUIRED'] as const
  for (const c of codes) {
    for (const native of [false, true]) {
      const copy = sttErrorCopy(c, { native, retryAfterSec: 7 })
      assert.ok(copy.title && copy.action, c)
      assert.doesNotMatch(`${copy.title}${copy.action}`, /reazon|sherpa|gateway|:\d{3,5}|ws:\/\/|wss:\/\//i)
    }
  }
  assert.match(sttErrorCopy('BUSY', { native: false, retryAfterSec: 7 }).action, /7초/)
})
