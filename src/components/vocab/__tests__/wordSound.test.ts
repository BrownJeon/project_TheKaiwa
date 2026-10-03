import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SOUND_IDLE, SOUND_MSG, SOUND_TEXT_MAX, soundButtonView, soundFailureKind, soundLine, soundTapAction, soundText, type WordSoundState } from '../wordSound'

const LEAK = /claude|haiku|sonnet|opus|qwen|whisper|reazon|style-?bert|sbv2|엔진|모델|trace|서버 이름/i

test('soundText: 공백·줄바꿈은 한 칸으로 접고 제어문자 제거, 1~100 코드포인트만(넘으면 버튼 숨김)', () => {
  assert.equal(soundText('食べる'), '食べる')
  assert.equal(soundText('  今日は暑い。\n明日は\t寒い。 '), '今日は暑い。 明日は 寒い。')
  assert.equal(soundText('あ\u0007い'), 'あい')
  assert.equal(soundText(null), null)
  assert.equal(soundText(undefined), null)
  assert.equal(soundText('   \n '), null)
  assert.equal(soundText('あ'.repeat(SOUND_TEXT_MAX)), 'あ'.repeat(100))
  assert.equal(soundText('あ'.repeat(SOUND_TEXT_MAX + 1)), null)
  assert.equal(soundText('😀'.repeat(100)), '😀'.repeat(100), '이모지는 코드포인트 1자')
})

test('soundFailureKind: 422 자막만 · 429 너무 자주 · 504/시간 초과 늦음 · 0 오프라인 · 막힘 · 그 밖 실패', () => {
  assert.equal(soundFailureKind({ status: 422 }), 'textonly')
  assert.equal(soundFailureKind({ status: 429 }), 'rate')
  assert.equal(soundFailureKind({ status: 504 }), 'slow')
  assert.equal(soundFailureKind({ status: null, timedOut: true }), 'slow')
  assert.equal(soundFailureKind({ status: 0 }), 'offline')
  assert.equal(soundFailureKind({ status: null, notAllowed: true }), 'blocked')
  for (const s of [400, 401, 500, 502, 503, null]) assert.equal(soundFailureKind({ status: s }), 'fail', String(s))
})

test('안내 문구: 실패·늦음·오프라인 = bad + [다시 듣기] · 자막만 = [다시 확인] · 한도·막힘 = 링크 없음 · 엔진명 없음', () => {
  for (const k of ['fail', 'slow', 'offline'] as const) {
    assert.equal(SOUND_MSG[k].tone, 'bad')
    assert.equal(SOUND_MSG[k].retry, '다시 듣기')
    assert.equal(SOUND_MSG[k].role, 'alert')
  }
  assert.equal(SOUND_MSG.textonly.retry, '다시 확인')
  assert.equal(SOUND_MSG.rate.retry, null)
  assert.equal(SOUND_MSG.blocked.retry, null)
  for (const m of Object.values(SOUND_MSG)) assert.doesNotMatch(m.text, LEAK)
})

test('버튼 모양: 대기 ▶ → 불러오는 중(취소) → 재생 중 ■, 소리는 한 번에 하나, 자막만 안내면 흐린 모양', () => {
  assert.deepEqual(soundButtonView(SOUND_IDLE, 'word'), { phase: 'idle', look: 'idle', label: '단어 소리 듣기', busy: false })
  const loading: WordSoundState = { target: 'word', phase: 'loading', msg: null, retry: false }
  assert.deepEqual(soundButtonView(loading, 'word'), { phase: 'loading', look: 'idle', label: '단어 소리를 불러오는 중, 누르면 취소', busy: true })
  assert.equal(soundButtonView(loading, 'ex').phase, 'idle', '다른 버튼은 대기')
  const playing: WordSoundState = { target: 'ex', phase: 'playing', msg: null, retry: false }
  assert.deepEqual(soundButtonView(playing, 'ex'), { phase: 'playing', look: 'on', label: '예문 소리 멈추기', busy: false })
  assert.equal(soundButtonView(playing, 'word').look, 'idle')
  const muted: WordSoundState = { target: null, phase: 'idle', msg: { target: 'word', kind: 'textonly' }, retry: false }
  assert.equal(soundButtonView(muted, 'word').look, 'mute')
  assert.equal(soundButtonView(muted, 'ex').look, 'idle')
  const blocked: WordSoundState = { target: 'word', phase: 'blocked', msg: { target: 'word', kind: 'blocked' }, retry: false }
  assert.equal(soundButtonView(blocked, 'word').look, 'blocked')
  assert.equal(soundButtonView(blocked, 'word').label, '단어 소리 듣기')
})

test('버튼 아래 한 줄: 다시 불러오는 중 / 누른 버튼의 안내만 / 재생 중은 화면 읽기 전용', () => {
  assert.deepEqual(soundLine({ target: 'word', phase: 'loading', msg: null, retry: true }, 'word'), { kind: 'retrying' })
  assert.deepEqual(soundLine({ target: 'word', phase: 'loading', msg: null, retry: false }, 'word'), { kind: 'live', text: '' })
  const failed: WordSoundState = { target: null, phase: 'idle', msg: { target: 'ex', kind: 'fail' }, retry: false }
  assert.deepEqual(soundLine(failed, 'ex'), { kind: 'msg', msg: 'fail' })
  assert.deepEqual(soundLine(failed, 'word'), { kind: 'live', text: '' })
  assert.deepEqual(soundLine({ target: 'word', phase: 'playing', msg: null, retry: false }, 'word'), { kind: 'live', text: '단어 소리 재생 중' })
})

test('탭 동작: 같은 버튼 불러오는 중·재생 중 = 멈춤, 다른 버튼 = 새로 불러오기, 막힘 + 쥔 소리 = 바로 틀기', () => {
  assert.equal(soundTapAction(SOUND_IDLE, 'word', null, null), 'load')
  const loading: WordSoundState = { target: 'word', phase: 'loading', msg: null, retry: false }
  assert.equal(soundTapAction(loading, 'word', null, null), 'stop')
  assert.equal(soundTapAction(loading, 'ex', null, null), 'load')
  const playing: WordSoundState = { target: 'ex', phase: 'playing', msg: null, retry: false }
  assert.equal(soundTapAction(playing, 'ex', null, null), 'stop')
  const blocked: WordSoundState = { target: 'word', phase: 'blocked', msg: { target: 'word', kind: 'blocked' }, retry: false }
  assert.equal(soundTapAction(blocked, 'word', 'word', null), 'resume')
  assert.equal(soundTapAction(blocked, 'ex', 'word', null), 'load', '다른 버튼은 쥔 소리와 상관없이 새로 불러온다')
  assert.equal(soundTapAction(blocked, 'word', null, null), 'load', '쥔 소리가 없으면 다시 받는다')
})

test('막힘 뒤 빠른 더블탭(L-1): 첫 탭이 쥔 소리를 놓고 불러오는 중으로 바뀐 뒤의 두 번째 탭은 무시 — 겹쳐 재생·취소 없음', () => {
  const blocked: WordSoundState = { target: 'word', phase: 'blocked', msg: { target: 'word', kind: 'blocked' }, retry: false }
  assert.equal(soundTapAction(blocked, 'word', 'word', null), 'resume')
  // 첫 탭 직후 useWordSound 상태: pending = null, resuming = 'word', phase = loading.
  const resuming: WordSoundState = { target: 'word', phase: 'loading', msg: null, retry: false }
  assert.equal(soundTapAction(resuming, 'word', null, 'word'), 'ignore')
  assert.equal(soundTapAction(resuming, 'ex', null, 'word'), 'load', '다른 버튼은 앞 소리를 끊고 새로 불러온다')
  // 재생이 시작되면(resuming 해제) 같은 버튼은 다시 멈춤이다.
  assert.equal(soundTapAction({ ...resuming, phase: 'playing' }, 'word', null, null), 'stop')
  // 다시 막히면(pending 재충전) 다음 탭에 또 바로 튼다.
  assert.equal(soundTapAction(blocked, 'word', 'word', null), 'resume')
})
