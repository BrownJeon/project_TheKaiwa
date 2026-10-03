import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BASELINE_SETTLE_MS,
  INITIAL_BASELINE,
  KEYBOARD_MIN_PX,
  REVEAL_GAP_PX,
  baselineFor,
  isTextEntry,
  keyboardState,
  resetBaseline,
  revealDelta,
  trackBaseline,
  type BaselineState,
  type ViewportSample,
} from '../keyboard'

const sample = (o: Partial<ViewportSample> = {}): ViewportSample => ({
  innerHeight: 780,
  baselineHeight: 780,
  vvHeight: 780,
  vvOffsetTop: 0,
  vvScale: 1,
  textFocused: true,
  coarsePointer: true,
  ...o,
})

test('isTextEntry: 소프트 키보드를 띄우는 칸만', () => {
  for (const type of ['text', 'search', 'email', 'number', 'tel', 'url', 'password', undefined]) {
    assert.equal(isTextEntry({ tagName: 'INPUT', type }), true, `input ${type}`)
  }
  for (const type of ['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'color', 'hidden', 'image', 'RANGE']) {
    assert.equal(isTextEntry({ tagName: 'INPUT', type }), false, `input ${type}`)
  }
  assert.equal(isTextEntry({ tagName: 'textarea' }), true)
  assert.equal(isTextEntry({ tagName: 'TEXTAREA', readOnly: true }), false, '읽기 전용')
  assert.equal(isTextEntry({ tagName: 'INPUT', type: 'text', disabled: true }), false, '비활성')
  assert.equal(isTextEntry({ tagName: 'INPUT', type: 'text', inputMode: 'none' }), false, 'inputmode=none')
  assert.equal(isTextEntry({ tagName: 'DIV', isContentEditable: true }), true, 'contenteditable')
  assert.equal(isTextEntry({ tagName: 'SELECT' }), false, 'select 는 선택 창')
  assert.equal(isTextEntry({ tagName: 'BUTTON' }), false)
  assert.equal(isTextEntry({ tagName: 'H2' }), false, '시트 제목 포커스')
  assert.equal(isTextEntry(null), false)
})

test('① 화면이 줄어드는 환경(resizes-content·창이 줄어드는 WebView): 열림, --kb-inset 0', () => {
  const s = keyboardState(sample({ innerHeight: 460, vvHeight: 460 }))
  assert.deepEqual(s, { open: true, insetPx: 0 })
})

test('② 키보드가 덮기만 하는 환경: 열림, 덮인 높이를 --kb-inset 으로', () => {
  assert.deepEqual(keyboardState(sample({ vvHeight: 460 })), { open: true, insetPx: 320 })
  // 브라우저가 보이는 창을 아래로 옮긴 경우(offsetTop) — 레이아웃 창 기준으로 키보드 아래 부분만
  assert.deepEqual(keyboardState(sample({ vvHeight: 460, vvOffsetTop: 40 })), { open: true, insetPx: 280 })
})

test('키보드 아님: 포커스 없음·주소창 차이·두 손가락 확대·데스크톱 창 줄이기', () => {
  assert.deepEqual(keyboardState(sample({ innerHeight: 460, vvHeight: 460, textFocused: false })), { open: false, insetPx: 0 }, '칸 포커스 없음')
  assert.deepEqual(keyboardState(sample({ innerHeight: 724, vvHeight: 724 })), { open: false, insetPx: 0 }, '주소창 56px')
  assert.deepEqual(keyboardState(sample({ vvHeight: 390, vvScale: 2 })), { open: false, insetPx: 0 }, '핀치 확대')
  assert.deepEqual(keyboardState(sample({ innerHeight: 460, vvHeight: 460, coarsePointer: false })), { open: false, insetPx: 0 }, '마우스 기기 창 조절')
  assert.deepEqual(keyboardState(sample({ vvHeight: null })), { open: false, insetPx: 0 }, 'visualViewport 없음·변화 없음')
})

test('문턱: 120px 부터 키보드, 그 아래 가림은 내보내지 않는다', () => {
  assert.equal(keyboardState(sample({ innerHeight: 780 - KEYBOARD_MIN_PX, vvHeight: 780 - KEYBOARD_MIN_PX })).open, true)
  assert.equal(keyboardState(sample({ innerHeight: 780 - KEYBOARD_MIN_PX + 1, vvHeight: 780 - KEYBOARD_MIN_PX + 1 })).open, false)
  assert.deepEqual(keyboardState(sample({ vvHeight: 700 })), { open: false, insetPx: 0 }, '80px 가림은 0')
})

test('앱 WebView(지금): 창도 visualViewport 도 안 줄면 아무것도 바꾸지 않는다', () => {
  assert.deepEqual(keyboardState(sample()), { open: false, insetPx: 0 })
})

test('revealDelta: 입력 칸이 키보드 위 16px 이상에 오게', () => {
  const vis = { visibleTop: 52, visibleBottom: 460 }
  assert.equal(revealDelta({ ...vis, fieldTop: 300, fieldBottom: 344 }), 0, '이미 보임')
  assert.equal(revealDelta({ ...vis, fieldTop: 420, fieldBottom: 464 }), 464 + REVEAL_GAP_PX - 460, '키보드 뒤로 4px — 20px 내림')
  assert.equal(revealDelta({ ...vis, fieldTop: 600, fieldBottom: 644 }), 644 + REVEAL_GAP_PX - 460, '완전히 가려짐')
  assert.equal(revealDelta({ ...vis, fieldTop: 40, fieldBottom: 84 }), 40 - REVEAL_GAP_PX - 52, '헤더 밑 — 위로')
  assert.equal(revealDelta({ ...vis, fieldTop: 400, fieldBottom: 460 - REVEAL_GAP_PX }), 0, '딱 16px 여유는 그대로')
})

test('revealDelta: 보이는 칸보다 큰 긴 글 칸은 브라우저 커서 보이기에 맡긴다', () => {
  assert.equal(revealDelta({ visibleTop: 52, visibleBottom: 460, fieldTop: 100, fieldBottom: 600 }), 0)
  assert.equal(revealDelta({ visibleTop: 52, visibleBottom: 70, fieldTop: 100, fieldBottom: 140 }), 0, '보이는 칸이 없음')
})

// ── 기준 높이 전이(REV-042 M1) ─────────────────────────────────────────────
// KeyboardInset.measure 와 같은 순서: trackBaseline → keyboardState(① 경로, visualViewport 는 창과 같이 줄어듦).
type Step = { w?: number; h: number; focused: boolean; t: number }
function run(steps: Step[], from: BaselineState = INITIAL_BASELINE) {
  let st = from
  const out = steps.map(({ w = 390, h, focused, t }) => {
    st = trackBaseline(st, { width: w, innerHeight: h, textFocused: focused, now: t })
    const base = baselineFor(st, w, h)
    return { base, open: keyboardState(sample({ innerHeight: h, baselineHeight: base, vvHeight: h, textFocused: focused })).open }
  })
  return { st, out }
}

test('baseline: 처음 보는 폭은 지금 높이에서 시작하고, 칸 포커스 중 줄어든 창은 키보드다(기준 그대로)', () => {
  const { out } = run([
    { h: 780, focused: false, t: 0 },
    { h: 780, focused: true, t: 100 },
    { h: 460, focused: true, t: 400 },
  ])
  assert.deepEqual(out.map((o) => o.base), [780, 780, 780])
  assert.deepEqual(out.map((o) => o.open), [false, false, true])
})

test('baseline: 커진 창은 포커스와 상관없이 바로 기준(주소창 접힘·분할 화면 해제)', () => {
  const { out } = run([
    { h: 724, focused: false, t: 0 },
    { h: 780, focused: false, t: 10 },
    { h: 800, focused: true, t: 20 },
  ])
  assert.deepEqual(out.map((o) => o.base), [724, 780, 800])
})

test('baseline: 포커스 없이 줄어든 창(분할 화면·폴더블)은 기준을 낮춘다 → 그 뒤 칸을 눌러도 키보드로 오판하지 않는다', () => {
  const { out } = run([
    { h: 780, focused: false, t: 0 },
    { h: 420, focused: false, t: 5_000 }, // 위아래 분할
    { h: 420, focused: true, t: 6_000 }, // 칸 포커스 — 키보드는 아직
    { h: 420 - 260, focused: true, t: 6_300 }, // 그 창에서 키보드가 올라옴
  ])
  assert.deepEqual(out.map((o) => o.base), [780, 420, 420, 420])
  assert.deepEqual(out.map((o) => o.open), [false, false, false, true], '예전(최대값만 기억)에는 3번째가 열림으로 오판')
})

test('baseline: 칸에서 포커스가 빠진 직후 키보드가 내려가는 중의 창으로는 낮추지 않는다(곧바로 다시 누르면 열림 유지)', () => {
  const { out } = run([
    { h: 780, focused: false, t: 0 },
    { h: 780, focused: true, t: 100 },
    { h: 460, focused: true, t: 400 },
    { h: 460, focused: false, t: 2_000 }, // 보내기 단추 등으로 포커스가 잠깐 빠짐 — 키보드는 아직 떠 있음
    { h: 460, focused: false, t: 2_000 + BASELINE_SETTLE_MS - 1 },
    { h: 460, focused: true, t: 2_000 + BASELINE_SETTLE_MS - 1 }, // 다시 칸으로
  ])
  assert.deepEqual(out.map((o) => o.base), [780, 780, 780, 780, 780, 780])
  assert.deepEqual(out.map((o) => o.open), [false, false, true, false, false, true])
})

test('baseline: 포커스가 빠지고 BASELINE_SETTLE_MS 가 지난 뒤 줄어든 창부터 기준을 낮춘다', () => {
  const { out } = run([
    { h: 780, focused: true, t: 0 },
    { h: 780, focused: false, t: 1_000 }, // 빠짐을 처음 본 시각
    { h: 600, focused: false, t: 1_000 + BASELINE_SETTLE_MS - 1 },
    { h: 600, focused: false, t: 1_000 + BASELINE_SETTLE_MS },
  ])
  assert.deepEqual(out.map((o) => o.base), [780, 780, 780, 600])
})

test('baseline: 마운트 때 키보드가 이미 열려 있으면 그 열림은 알 수 없고(닫힘 유지), 키보드가 한 번 내려가면 다음 열림부터 잡는다', () => {
  const { out } = run([
    { h: 460, focused: true, t: 0 }, // 마운트 — 줄어든 높이가 임시 기준
    { h: 460, focused: true, t: 3_000 },
    { h: 780, focused: true, t: 4_000 }, // 뒤로 제스처로 키보드만 내림(포커스 유지)
    { h: 460, focused: true, t: 5_000 }, // 칸을 다시 눌러 키보드
  ])
  assert.deepEqual(out.map((o) => o.base), [460, 460, 780, 780])
  assert.deepEqual(out.map((o) => o.open), [false, false, false, true], '포커스가 빠질 때까지 기다리지 않고 다시 열림을 잡는다')
})

test('baseline: 회전·화면 복귀(reset)는 폭별 기준을 모두 버리고, 폭마다 따로 잰다', () => {
  const portrait = run([
    { w: 390, h: 780, focused: false, t: 0 },
    { w: 844, h: 360, focused: false, t: 10 }, // 가로
  ]).st
  assert.equal(baselineFor(portrait, 390, 0), 780)
  assert.equal(baselineFor(portrait, 844, 0), 360)
  const cleared = resetBaseline(portrait)
  assert.equal(cleared.heights.size, 0)
  assert.equal(cleared.focused, portrait.focused, '포커스 추적은 그대로')
  assert.equal(resetBaseline(cleared), cleared, '빈 상태는 같은 객체')
  // 오래된 큰 기준(예: 분할 화면 전)이 남아 있지 않다 → 지금 높이에서 다시 시작
  const { out } = run([{ w: 390, h: 500, focused: true, t: 20 }], cleared)
  assert.deepEqual(out, [{ base: 500, open: false }])
  // reset 이 없으면 같은 상황이 키보드로 오판된다(비교용)
  assert.equal(run([{ w: 390, h: 500, focused: true, t: 20 }], portrait).out[0].open, true)
})

test('baseline: 바뀐 것이 없으면 같은 상태 객체(측정마다 Map 을 새로 만들지 않음)', () => {
  const a = trackBaseline(INITIAL_BASELINE, { width: 390, innerHeight: 780, textFocused: false, now: 0 })
  assert.equal(trackBaseline(a, { width: 390, innerHeight: 780, textFocused: false, now: 50 }), a)
  const b = trackBaseline(a, { width: 390, innerHeight: 460, textFocused: true, now: 60 })
  assert.equal(b.heights, a.heights, '포커스만 바뀌면 높이 표는 그대로')
  assert.equal(baselineFor(INITIAL_BASELINE, 390, 777), 777, '기록 없는 폭은 지금 높이')
})
