/**
 * task-066 §26-13 ② — 회화·수업·마이크 테스트가 쓰는 공용 음성 부품(누르고 말하기·말 바·부분 말풍선·보내지 못한 말 띠)의 **지금 마크업 고정**.
 * 질문 탭이 선택 prop(`cancelOutside`·`safeBottom`·`keyboardLabel`·`out`·`caption`·`textOf`·`canResend`)을 더해도, 넘기지 않으면 한 글자도 같아야 한다.
 * 고정 문자열(`fixtures/voiceShared.frozen.json`)은 확장 **전** 코드(2026-10-13 09:27, HEAD 14779e0 작업 트리)를 그린 결과다 — 일부러 바꾸려면 회화 회귀를 먼저 확인한다.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement as h } from 'react'
import { renderToStaticMarkup as r } from 'react-dom/server'
import PushToTalkButton from '@/components/speech/PushToTalkButton'
import VoiceBar from '../VoiceBar'
import LiveUtteranceBubble from '../LiveUtteranceBubble'
import UnsentBar from '../UnsentBar'
import type { TalkView } from '../talkState'

const FROZEN: Record<string, string> = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'voiceShared.frozen.json'), 'utf8'))
const noop = () => undefined

function renderAll(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const phase of ['idle', 'starting', 'recording', 'finishing', 'unavailable'] as const) {
    out[`ptt.${phase}`] = r(h(PushToTalkButton, { phase, label: 'L', describedBy: 'd', onPress: noop, onRelease: noop, onAbort: noop }))
  }
  out['ptt.disabled'] = r(h(PushToTalkButton, { phase: 'idle', disabled: true, label: 'L', onPress: noop, onRelease: noop, onAbort: noop }))
  const views: Record<string, TalkView> = {
    idle: { state: 'IDLE', sub: null, ptt: { phase: 'idle', disabled: false, label: 'P' }, statusText: 'S', showStop: false, keyboardDisabled: false },
    rec: { state: 'RECORDING', sub: null, ptt: { phase: 'recording', disabled: false, label: 'P' }, statusText: 'R', showStop: false, keyboardDisabled: true },
    speak: { state: 'SPEAKING', sub: null, ptt: { phase: 'idle', disabled: false, label: 'B' }, statusText: 'T', showStop: true, keyboardDisabled: false },
  }
  for (const [k, view] of Object.entries(views)) {
    out[`bar.${k}`] = r(h(VoiceBar, { view, db: k === 'rec' ? -30 : null, onPress: noop, onRelease: noop, onAbort: noop, onKeyboard: noop, onStop: noop }))
    out[`bar.${k}.trailing`] = r(h(VoiceBar, { view, db: null, onPress: noop, onRelease: noop, onAbort: noop, onKeyboard: noop, onStop: noop, trailing: h('span', null, 'T') }))
  }
  out['live.listening.empty'] = r(h(LiveUtteranceBubble, { kind: 'listening', partial: '' }))
  out['live.listening'] = r(h(LiveUtteranceBubble, { kind: 'listening', partial: 'あい' }))
  out['live.recognizing'] = r(h(LiveUtteranceBubble, { kind: 'recognizing', partial: 'あ' }))
  out['live.queued'] = r(h(LiveUtteranceBubble, { kind: 'queued', partial: '', text: 'こんにちは' }))
  for (const reason of [409, 429, 400, 0, 'utteranceUsed'] as const) {
    out[`unsent.${reason}`] = r(
      h(UnsentBar, { unsent: { text: '大丈夫', reason, serverMessage: reason === 400 ? '서버 문구' : null }, blockedUntil: null, onResend: noop, onEdit: noop, onDiscard: noop }),
    )
  }
  return out
}

test('공용 음성 부품: 새 prop 없이 그린 마크업 = 확장 전 고정 문자열(21종, §26-13 ②)', () => {
  const now = renderAll()
  assert.deepEqual(Object.keys(now).sort(), Object.keys(FROZEN).sort())
  for (const k of Object.keys(FROZEN)) assert.equal(now[k], FROZEN[k], k)
})

test('공용 음성 부품: 기본 경로에는 밀어서 취소 표지·질문 문구가 없다', () => {
  const all = Object.values(renderAll()).join('\n')
  assert.doesNotMatch(all, /data-out/)
  assert.doesNotMatch(all, /손가락을 버튼 밖으로|손을 떼면 보내지 않아요|글자로 묻기/)
  // 말 바 기본 아래 여백은 제스처 여백을 더한 그대로
  assert.match(renderAll()['bar.idle'], /padding-bottom:max\(8px, env\(safe-area-inset-bottom\)\)/)
})

test('선택 prop 을 넘기면 질문 탭 모양: 말 바 여백 8px·⌨ 이름·부분 말풍선 밖 모양·캡션·띠 문구·다시 보내기 없음', () => {
  const view: TalkView = { state: 'RECORDING', sub: null, ptt: { phase: 'recording', disabled: false, label: 'P' }, statusText: 'R', showStop: false, keyboardDisabled: true }
  const bar = r(
    h(VoiceBar, { view, db: null, onPress: noop, onRelease: noop, onAbort: noop, onKeyboard: noop, onStop: noop, safeBottom: false, keyboardLabel: '글자로 묻기', cancelOutside: { onCancel: noop } }),
  )
  assert.match(bar, /style="padding-bottom:8px"/)
  assert.match(bar, /aria-label="글자로 묻기"/)
  assert.match(bar, /data-\[out=true\]:bg-surface2/, 'cancelOutside 가 버튼까지 간다')

  const outB = r(h(LiveUtteranceBubble, { kind: 'listening', partial: '大丈', out: true, caption: '손을 떼면 보내지 않아요' }))
  assert.match(outB, /border-dashed border-bad/)
  assert.match(outB, /line-through/)
  assert.match(outB, /font-semibold text-bad[^"]*">손을 떼면 보내지 않아요</)
  const inB = r(h(LiveUtteranceBubble, { kind: 'listening', partial: '大丈', out: false, caption: '틀렸으면 손가락을 버튼 밖으로 빼서 떼세요' }))
  assert.match(inB, /border-dashed border-line/)
  assert.doesNotMatch(inB, /line-through/)
  assert.match(inB, /text-ink2">틀렸으면 손가락을 버튼 밖으로 빼서 떼세요</)
  const recog = r(h(LiveUtteranceBubble, { kind: 'recognizing', partial: '大丈夫', caption: 'X' }))
  assert.equal(recog, r(h(LiveUtteranceBubble, { kind: 'recognizing', partial: '大丈夫' })), '알아듣는 중엔 캡션 없음')

  const base = { unsent: { text: '大丈夫', reason: 429 as const }, blockedUntil: null, onResend: noop, onEdit: noop, onDiscard: noop }
  const custom = r(h(UnsentBar, { ...base, textOf: (reason, o) => `질문 문구 ${reason} ${o.retrySec}`, canResend: false }))
  assert.match(custom, /질문 문구 429/)
  assert.doesNotMatch(custom, /다시 보내기/)
  assert.match(custom, /글자로 고치기/)
})

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

test('회화·수업·평가·마이크 테스트 화면은 질문 탭 전용 prop 을 넘기지 않는다(§26-13 ②, L3)', () => {
  const callers = [
    'src/components/talk/TalkRoom.tsx',
    'src/components/lesson/useLessonVoice.ts',
    'src/components/lesson/StageSpeak.tsx',
    'src/components/lesson/StageApply.tsx',
    'src/components/eval/EvalItems.tsx',
    'src/components/speech/MicTestCard.tsx',
  ]
  // task-077 B6 A(사용자 승인 2026-10-18 · Leader 승인 좁은 예외): 오늘의 회화 ⑤ 는 공용 `VoiceBar` 를 쓰고 ⌨ 이름 「글자로 답하기」를 `keyboardLabel` 로 넘긴다.
  // 그래서 수업 ⑤ 두 파일에 한해 `keyboardLabel` 하나만 허용한다 — 다른 파일·다른 질문 탭 전용 prop 은 그대로 금지.
  const keyboardLabelOk = new Set(['src/components/lesson/StageSpeak.tsx', 'src/components/lesson/useLessonVoice.ts'])
  for (const f of callers) {
    const src = read(f)
    for (const bad of ['cancelOutside', 'safeBottom', 'keyboardLabel', 'textOf=', 'canResend', 'caption=']) {
      if (bad === 'keyboardLabel' && keyboardLabelOk.has(f)) continue
      assert.ok(!src.includes(bad), `${f}: ${bad}`)
    }
  }
})
