/**
 * 일본어 도우미 「선생님이 답하는 동안 잠금」(task-056, screens §22-6 잠김 행·§22-7 `lockedTurn`) — 사용자 결정 2026-10-11, QA-B2 재측정:
 * 도우미와 회화 턴이 같은 AI 호출 줄(동시 1건)을 쓰므로 턴을 보낸 직후 도우미를 부르면 턴 첫 음성이 p50 2.42→5.83초(5초 예산 초과)로 밀린다.
 * 열 수 있는 상태는 IDLE·SPEAKING 뿐, 잠기는 상태는 RECORDING·RECOGNIZING(말하는 중, 토스트 `locked`) + QUEUED·THINKING(선생님이 답하는 중, 토스트 `lockedTurn`).
 *  - 실제 입력(`deriveTalkState`)에서 나온 상태로 열림/잠김과 토스트 문구를 본다 — 판단 순서(말하는 중 > 보내기 대기 > 선생님 말 > 생각)가 규칙을 바꾸지 않는지.
 *  - 버튼: 잠긴 채 누르면 판을 열지 않고 이유를 알리며(`aria-disabled`, `disabled` 속성 아님), 풀리면 연다.
 *  - TalkRoom 연결(소스 검사 — 주석을 걷은 소스에서 해당 요소·호출 범위만 잘라 본다): 이유 하나에서 `helperLock`·훅 `recording`·판 `locked`·버튼 `locked`·토스트가 모두 나온다.
 * 훅 상태 배선을 진짜 React 로 돌려 보는 시험은 없다(렌더러·jsdom 없음) — 브라우저 확인은 task-056-dev-ui-record.md 「생각 중 도우미 잠금」.
 */
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { readCode } from '../../__tests__/sourceCode'
import { HELPER } from '../helperCopy'
import PhraseHelperButton from '../PhraseHelperButton'
import { askBlockOf, helperLocked, helperLockReason, helperLockToast } from '../phraseHelperLogic'
import { deriveTalkState, type TalkState, type TalkStateInput } from '../talkState'

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
const stateOf = (p: Partial<TalkStateInput>): TalkState => deriveTalkState({ ...BASE, ...p }).state

/* ── 실제 입력 → 상태 → 열림·잠김·토스트 ─────────────────────────────── */

type Row = [name: string, input: Partial<TalkStateInput>, state: TalkState, toast: string | null]

const ROWS: Row[] = [
  ['대기', {}, 'IDLE', null],
  ['대기·429 로 말하기가 막힘', { rateLimitedSec: 7 }, 'IDLE', null],
  ['대기·마이크 쓸 수 없음', { sttPhase: 'unavailable' }, 'IDLE', null],
  ['턴 실패 뒤', { turnPhase: 'failed' }, 'IDLE', null],
  ['선생님 다시 듣기 로딩(턴 아님)', { playbackPhase: 'waiting', playbackSource: 'replay' }, 'IDLE', null],
  ['선생님 말 재생 중', { playbackPhase: 'playing', playbackSource: 'turn' }, 'SPEAKING', null],
  ['선생님 말 재생 중 · 턴 스트림은 아직 열려 있음(판단 순서: 재생이 생각보다 위)', { playbackPhase: 'playing', playbackSource: 'turn', turnPhase: 'streaming' }, 'SPEAKING', null],
  ['녹음 준비(starting)', { sttPhase: 'starting' }, 'RECORDING', HELPER.locked],
  ['녹음 중', { sttPhase: 'recording', recordingSec: 3 }, 'RECORDING', HELPER.locked],
  ['인식 중', { sttPhase: 'finishing' }, 'RECOGNIZING', HELPER.locked],
  ['녹음 중 · 선생님 말도 재생 중(말하는 중이 위)', { sttPhase: 'recording', playbackPhase: 'playing', playbackSource: 'turn' }, 'RECORDING', HELPER.locked],
  ['보내기 대기', { queued: true }, 'QUEUED', HELPER.lockedTurn],
  ['보내는 중', { turnPhase: 'sending' }, 'THINKING', HELPER.lockedTurn],
  ['답을 받는 중', { turnPhase: 'streaming' }, 'THINKING', HELPER.lockedTurn],
  ['연결이 끊겨 서버에서 계속 도는 턴', { turnPhase: 'detached' }, 'THINKING', HELPER.lockedTurn],
  ['답을 받는 중 · 선생님 소리는 아직 준비 중(waiting)', { turnPhase: 'streaming', playbackPhase: 'waiting', playbackSource: 'turn' }, 'THINKING', HELPER.lockedTurn],
]

test('실제 입력에서 유도한 상태마다: 열 수 있는 것은 IDLE·SPEAKING 뿐, 잠기면 이유에 맞는 토스트(말하는 중 / 선생님이 답하는 중)', () => {
  for (const [name, input, state, toast] of ROWS) {
    assert.equal(stateOf(input), state, `${name}: 상태`)
    assert.equal(helperLocked(state), toast !== null, `${name}: 잠김`)
    if (toast !== null) assert.equal(helperLockToast(helperLockReason(state)), toast, `${name}: 토스트`)
    else assert.equal(helperLockReason(state), null, `${name}: 이유 없음`)
  }
  // 표가 여섯 상태를 모두 지나간다
  assert.deepEqual([...new Set(ROWS.map((r) => r[2]))].sort(), ['IDLE', 'QUEUED', 'RECOGNIZING', 'RECORDING', 'SPEAKING', 'THINKING'])
})

test('문구: lockedTurn 은 정확히 「선생님이 답하는 중에는 열 수 없어요」, 기존 locked 와 다르고 엔진·모델 이름이 없다', () => {
  assert.equal(HELPER.lockedTurn, '선생님이 답하는 중에는 열 수 없어요')
  assert.equal(HELPER.locked, '말하는 중에는 열 수 없어요')
  assert.notEqual(HELPER.lockedTurn, HELPER.locked)
  assert.doesNotMatch(HELPER.lockedTurn, /claude|haiku|sonnet|opus|whisper|reazon|style-?bert|sbv2|qwen|ollama|모델|엔진/i)
})

test('잠긴 상태에서는 [물어보기]도 막힌다 — 훅은 잠김을 `recording` 으로 받아 askBlockOf 에 넘긴다(대기·생각도 같은 막힘)', () => {
  for (const state of ['RECORDING', 'RECOGNIZING', 'QUEUED', 'THINKING'] as const) {
    const recording = helperLocked(state)
    assert.equal(askBlockOf({ query: '목이 쉬었어요', pending: false, recording, rateWaiting: false }), 'recording', state)
  }
  for (const state of ['IDLE', 'SPEAKING'] as const) {
    const recording = helperLocked(state)
    assert.equal(askBlockOf({ query: '목이 쉬었어요', pending: false, recording, rateWaiting: false }), null, state)
  }
})

/* ── 버튼 ──────────────────────────────────────────────────────────── */

type BtnProps = { 'aria-disabled'?: true; onClick: () => void; className: string }
const buttonFor = (state: TalkState) => {
  const calls: string[] = []
  const el = PhraseHelperButton({
    open: false,
    locked: helperLocked(state),
    onToggle: () => calls.push('toggle'),
    onLocked: () => calls.push(helperLockToast(helperLockReason(state))),
  })
  return { props: el.props as BtnProps, calls }
}

test('버튼: 열 수 있는 상태(IDLE·SPEAKING)는 눌러서 판을 열고, 잠기는 네 상태는 판을 열지 않고 이유 토스트만 — aria-disabled 이고 disabled 속성은 아니다', () => {
  for (const state of ['IDLE', 'SPEAKING'] as const) {
    const b = buttonFor(state)
    assert.equal(b.props['aria-disabled'], undefined, `${state}: 잠기지 않음`)
    assert.ok(!b.props.className.includes('opacity-40'), `${state}: 흐리지 않음`)
    b.props.onClick()
    assert.deepEqual(b.calls, ['toggle'], `${state}: 열기`)
  }
  const want: Record<'RECORDING' | 'RECOGNIZING' | 'QUEUED' | 'THINKING', string> = {
    RECORDING: HELPER.locked,
    RECOGNIZING: HELPER.locked,
    QUEUED: HELPER.lockedTurn,
    THINKING: HELPER.lockedTurn,
  }
  for (const [state, toast] of Object.entries(want) as Array<[keyof typeof want, string]>) {
    const b = buttonFor(state)
    assert.equal(b.props['aria-disabled'], true, `${state}: aria-disabled`)
    assert.ok(b.props.className.includes('opacity-40'), `${state}: 흐림`)
    assert.ok(!('disabled' in b.props), `${state}: disabled 속성 금지(눌러서 이유를 듣게)`)
    b.props.onClick()
    assert.deepEqual(b.calls, [toast], `${state}: 판은 열지 않고 이유만`)
  }
})

/* ── TalkRoom 연결(소스 검사 — 주석을 걷은 소스) ───────────────────────── */

const SRC = join(process.cwd(), 'src/components/talk')
const room = readCode(join(SRC, 'TalkRoom.tsx'))

/** `from` 이 처음 나온 곳부터 그 뒤 처음 나오는 `to` 까지(포함). 둘 다 있어야 한다. */
function cut(src: string, from: string, to: string): string {
  const a = src.indexOf(from)
  assert.ok(a >= 0, `찾지 못함: ${from}`)
  const b = src.indexOf(to, a)
  assert.ok(b >= 0, `끝을 찾지 못함: ${to} (from ${from})`)
  return src.slice(a, b + to.length)
}

test('TalkRoom: 잠김은 이유 하나(helperLockReason(view.state))에서 나오고 그 이유로 토스트를 고른다 — 예전 helperLocked·고정 문구는 방에 없다', () => {
  assert.match(room, /import \{ claimHelperTip, helperLockReason, helperLockToast \} from '\.\/phraseHelperLogic'/)
  assert.match(room, /const helperLockWhy = helperLockReason\(view\.state\)\s*const helperLock = helperLockWhy !== null\s*const helper = usePhraseHelper\(/)
  assert.doesNotMatch(room, /\bhelperLocked\b/, '방은 helperLocked 를 따로 부르지 않는다(이유 하나가 근거)')
  assert.doesNotMatch(room, /notify\(HELPER\./, '토스트 문구를 방이 직접 고르지 않는다 — helperLockToast')
  assert.doesNotMatch(room, /\bHELPER\b/, '고정 문구를 쓰지 않으니 문구 객체도 가져오지 않는다')
})

test('TalkRoom: 버튼 = 잠김(helperLock)·이유별 토스트 / 판 = 잠김(helperLock) / 훅 recording = 잠김 / 안내 말풍선은 잠긴 동안 숨는다', () => {
  const button = cut(room, '<PhraseHelperButton', '/>')
  assert.match(button, /locked=\{helperLock\}/)
  assert.match(button, /onLocked=\{\(\) => notify\(helperLockToast\(helperLockWhy\)\)\}/)
  assert.match(button, /onToggle=\{toggleHelper\}/)
  const hook = cut(room, 'usePhraseHelper({', 'onEnded:')
  assert.match(hook, /recording: helperLock,/)
  const panel = cut(room, '<PhraseHelperPanel', 'onDismiss=')
  assert.match(panel, /locked=\{helperLock\}/)
  // 판이 열려 있는 채로 대기·생각이 되어도 판은 그대로 — 판을 그리는 조건에는 잠김이 들어가지 않는다
  assert.match(room, /const helperShown = helper\.shown\n/)
  // 안내 말풍선: 잠긴 동안 숨는다(버튼이 흐려진 채 안내가 떠 있지 않게)
  assert.match(room, /const tipShown = tipOpen && !helper\.open && !helperLock && strip === null/)
})

test('잠김 요청 취소는 그대로: 마이크를 누를 때·모든 턴 시작 때 대기 중 요청만 취소 — 잠김 값에 기대지 않는다', () => {
  const press = cut(room, 'const onPress = () => {', 'stt.press()')
  assert.match(press, /helper\.cancelPending\(\)/)
  assert.doesNotMatch(press, /helperLock/, '취소는 잠김과 무관(이 변경이 건드리지 않음)')
  assert.match(room, /cancelHelperRef\.current\(\)/)
})
