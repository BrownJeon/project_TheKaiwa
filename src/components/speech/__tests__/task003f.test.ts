import { test } from 'node:test'
import assert from 'node:assert/strict'
import { APP_LABEL, pathCaption, routeReasonShort, sttErrorCopy, STT_SWITCH_TOAST } from '../sttCopy'
import { installedRouteLine, MODEL_COPY, modelErrorCopy, modeDescription } from '../modelCopy'
import { initialSttUi, isBlockingError, sttUiReducer, type SttUiEvent, type SttUiState } from '../sttUiState'
import { formatMB } from '../../common/format'
import type { SttRouteReason } from '@/modules/speech/stt/client'

const ENGINE = /reazon|sherpa|zipformer|onnx|int8|whisper|gateway|style-?bert|ondevice-ja|manifest/i

function run(s: SttUiState, ...events: SttUiEvent[]) {
  let st = s
  const effects: string[] = []
  for (const e of events) {
    const r = sttUiReducer(st, e)
    st = r.state
    effects.push(...r.effects)
  }
  return { state: st, effects }
}

test('경로 한 줄 9종·메뉴 이유 줄 — 엔진명 0, 받을 수 있는 이유면 "위에서 받을 수 있어요"', () => {
  const reasons: SttRouteReason[] = ['WEB', 'READY', 'MODEL_ABSENT', 'MODEL_DOWNLOADING', 'MODE_ACCURATE', 'MODE_OFFLINE', 'ONDEVICE_FAILED', 'SERVER_DISABLED', 'UPDATE_REQUIRED']
  for (const reason of reasons) {
    const kind = reason === 'READY' || reason === 'MODE_OFFLINE' ? 'ONDEVICE' : 'GATEWAY'
    const line = pathCaption({ kind, reason })
    assert.ok(line.length > 0)
    assert.doesNotMatch(line, ENGINE, reason)
    assert.doesNotMatch(routeReasonShort({ kind, reason }) ?? '', ENGINE)
  }
  assert.equal(pathCaption({ kind: 'GATEWAY', reason: 'WEB' }), '지금은 서버에서 알아들어요.')
  assert.match(pathCaption({ kind: 'GATEWAY', reason: 'MODEL_ABSENT' }), /위에서 받을 수 있어요/)
  assert.equal(pathCaption({ kind: 'ONDEVICE', reason: 'READY' }), '지금은 휴대폰에서 알아들어요.')
  assert.equal(routeReasonShort({ kind: 'ONDEVICE', reason: 'READY' }), null)
  assert.doesNotMatch(STT_SWITCH_TOAST, ENGINE)
})

test('오류 문구 — MIC_DENIED 앱(버튼 있음·없음=앱 이름 경로)·웹, ENGINE_ERROR 전환·오프라인 방식, MODEL_REQUIRED 막힘', () => {
  assert.equal(APP_LABEL, 'Lingofy Japanese')
  assert.match(sttErrorCopy('MIC_DENIED', { native: true, canOpenSettings: true }).action, /^앱 설정 → 권한/)
  assert.match(sttErrorCopy('MIC_DENIED', { native: true, canOpenSettings: false }).action, /애플리케이션 → Lingofy Japanese → 권한/)
  assert.match(sttErrorCopy('MIC_DENIED', { native: false }).action, /주소창/)
  assert.equal(sttErrorCopy('ENGINE_ERROR', { native: true }).action, '다시 눌러 말해 주세요.')
  assert.match(sttErrorCopy('ENGINE_ERROR', { native: true, switched: true }).action, /다음부터는 서버에서/)
  assert.match(sttErrorCopy('ENGINE_ERROR', { native: true, offlineMode: true }).action, /오프라인 방식이라/)
  const mr = sttErrorCopy('MODEL_REQUIRED', { native: true, place: 'talk' })
  assert.equal(mr.title, '휴대폰 인식 파일이 없어요.')
  assert.match(mr.action, /설정 → 음성 인식/)
  assert.match(sttErrorCopy('MODEL_REQUIRED', { native: true, place: 'micTest' }).action, /위에서 파일을/)
  assert.ok(isBlockingError({ code: 'MODEL_REQUIRED', mountCheck: true }))
  for (const c of ['MIC_DENIED', 'ENGINE_ERROR', 'MODEL_REQUIRED'] as const) {
    for (const o of [{ native: true, switched: true }, { native: true, offlineMode: true }, { native: true, canOpenSettings: false }]) {
      const copy = sttErrorCopy(c, o)
      assert.doesNotMatch(`${copy.title}${copy.action}`, ENGINE)
    }
  }
})

test('UI 상태: 앱 첫 누름 = 권한만(PERMISSION_ONLY → 힌트), rationale 표시, 휴대폰 세션 INTERRUPTED, ERROR 의 switched·offlineMode 보존', () => {
  const started = run(initialSttUi(), { type: 'PRESS', now: 0, perm: 'rationale' })
  assert.equal(started.state.phase, 'starting')
  const perm = run(started.state, { type: 'PERMISSION_ONLY', now: 50 })
  assert.equal(perm.state.phase, 'idle')
  assert.equal(perm.state.hint, 'PERMISSION_GRANTED')
  assert.deepEqual(perm.effects, [])

  const r = run(initialSttUi(), { type: 'PERMISSION', state: 'rationale' })
  assert.equal(r.state.rationale, true)
  assert.equal(run(r.state, { type: 'PERMISSION', state: 'granted' }).state.rationale, false)

  const rec = run(initialSttUi(), { type: 'PRESS', now: 0, perm: 'granted' }, { type: 'BEGIN_OK', now: 10 })
  const intr = run(rec.state, { type: 'INTERRUPTED', now: 20 })
  assert.equal(intr.state.phase, 'idle')
  assert.equal(intr.state.hint, 'INTERRUPTED')
  assert.deepEqual(intr.effects, ['CANCEL'])

  const err = run(rec.state, { type: 'ERROR', now: 30, code: 'ENGINE_ERROR', switched: true })
  assert.deepEqual(err.state.error, { code: 'ENGINE_ERROR', switched: true })
  const offErr = run(rec.state, { type: 'ERROR', now: 30, code: 'ENGINE_ERROR', offlineMode: true })
  assert.deepEqual(offErr.state.error, { code: 'ENGINE_ERROR', offlineMode: true })
})

test('휴대폰에서 알아듣기 카드 문구 — 엔진명·"목소리가 서버로 가지 않아요" 없음, 방식 설명(§11-8 ⓓ)', () => {
  const all = JSON.stringify(MODEL_COPY) + ['AUTO', 'FAST', 'ACCURATE', 'OFFLINE'].map((m) => installedRouteLine(m as never, null)).join('')
  assert.doesNotMatch(all, ENGINE)
  assert.doesNotMatch(all, /목소리가 서버로 가지 않/)
  assert.match(MODEL_COPY.knowThis, /서버에 저장돼요\(30일/)
  for (const code of ['INSUFFICIENT_STORAGE', 'OFFLINE', 'DOWNLOAD_FAILED', 'SERVER', 'APP_UPDATE_REQUIRED', 'MODEL_CORRUPT', 'UNKNOWN'] as const) {
    const e = modelErrorCopy(code, '430MB')
    assert.ok(e.title && e.action && e.button)
    assert.doesNotMatch(`${e.title}${e.action}`, ENGINE)
  }
  assert.match(modelErrorCopy('INSUFFICIENT_STORAGE', '430MB').action, /약 430MB/)
  assert.deepEqual(modeDescription('OFFLINE', { native: false, onDevice: false, installed: false }), { desc: '앱에서만 쓸 수 있어요', disabled: true })
  assert.equal(modeDescription('OFFLINE', { native: true, onDevice: true, installed: false }).disabled, true)
  assert.equal(modeDescription('OFFLINE', { native: true, onDevice: true, installed: true }).disabled, false)
  assert.match(modeDescription('OFFLINE', { native: true, onDevice: true, installed: true }).desc, /선생님 대답에는 인터넷이 필요해요/)
  assert.match(modeDescription('FAST', { native: false, onDevice: false, installed: false }).desc, /웹에서는 서버에서/, '웹 "빠르게 = 휴대폰" 오해 정정(Leader ⑭)')
  assert.match(modeDescription('AUTO', { native: true, onDevice: true, installed: false }).desc, /파일을 받기 전에는 서버/)
  assert.match(installedRouteLine('AUTO', { kind: 'GATEWAY', reason: 'UPDATE_REQUIRED' }), /업데이트하면/)
})

test('formatMB: 10⁶ 기준 반올림·최소 1MB·GB', () => {
  assert.equal(formatMB(169_824_553), '170MB')
  assert.equal(formatMB(424_561_383), '425MB')
  assert.equal(formatMB(1), '1MB')
  assert.equal(formatMB(1_234_000_000), '1.2GB')
  assert.equal(formatMB(Number.NaN), '1MB')
})
