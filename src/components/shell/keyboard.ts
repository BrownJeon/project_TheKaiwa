/**
 * 키보드 판정·입력 칸 여유 계산(task-021, 데모 v1 R1·R4·R5) — DOM 없이 숫자만 받는 순수 함수. `KeyboardInset` 이 쓴다.
 *
 * 키보드를 알아채는 길은 두 가지다.
 *  ① 화면이 줄어든다 — 모바일 Chrome(`interactive-widget=resizes-content`)·창이 키보드만큼 줄어드는 앱 WebView.
 *     `innerHeight` 가 같은 폭의 키보드 없는 높이(`trackBaseline`)보다 줄어든다. `--kb-inset` 은 0(화면이 이미 줄었으니 더 올릴 것이 없다).
 *  ② 화면은 그대로이고 키보드가 덮는다 — `resizes-content` 를 모르는 브라우저. `visualViewport` 가 가려진 높이를 알려 준다.
 *     그 값을 `--kb-inset` 으로 내보내 앱 셸·시트가 그만큼 위로 올라간다.
 * 둘 다 아니면(창도 visualViewport 도 안 바뀌는 WebView) 웹은 키보드를 알 수 없다 — 아무것도 바꾸지 않는다.
 */

/** 키보드로 볼 최소 높이. 주소창이 접히고 펴지는 차이(≈56px)·추천 단어 띠만 남은 외부 키보드는 키보드로 치지 않는다. */
export const KEYBOARD_MIN_PX = 120

/** 입력 칸 위아래로 남길 여유(R4·R5 "키보드 위 16px 이상"). */
export const REVEAL_GAP_PX = 16

/** 소프트 키보드를 띄우지 않는 input 종류 — 슬라이더(목소리 설정)·체크·버튼·파일 등. */
const NON_TEXT_INPUT = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'])

export interface FieldLike {
  tagName: string
  type?: string
  readOnly?: boolean
  disabled?: boolean
  isContentEditable?: boolean
  inputMode?: string
}

/** 이 요소에 포커스가 있으면 소프트 키보드가 뜨는가. select 는 선택 창이 뜨므로 아니다. */
export function isTextEntry(el: FieldLike | null | undefined): boolean {
  if (!el) return false
  if (el.isContentEditable) return el.inputMode !== 'none'
  const tag = el.tagName.toUpperCase()
  if (tag !== 'INPUT' && tag !== 'TEXTAREA') return false
  if (el.readOnly || el.disabled || el.inputMode === 'none') return false
  return tag === 'TEXTAREA' || !NON_TEXT_INPUT.has((el.type ?? 'text').toLowerCase())
}

/**
 * 텍스트 칸에서 포커스가 빠진 뒤 이 시간 동안은 기준 높이를 낮추지 않는다. 키보드가 내려가는 중의 줄어든 창을 기준으로
 * 삼으면, 그 사이 다시 칸을 눌러 키보드가 그대로 남을 때 열림을 놓친다(안드로이드 키보드 닫힘 ≈ 0.3초).
 */
export const BASELINE_SETTLE_MS = 1000

/** ① 경로의 기준 — 폭별 "키보드 없는 `innerHeight`". `KeyboardInset` 이 들고 있고 전이는 아래 함수로만 한다. */
export interface BaselineState {
  /** 폭(px) → 키보드 없는 높이. 돌리면 폭이 바뀌어 따로 잰다. */
  readonly heights: ReadonlyMap<number, number>
  /** 직전 측정에서 소프트 키보드를 띄우는 칸에 포커스가 있었나 */
  readonly focused: boolean
  /** 그 포커스가 빠진 것을 처음 본 시각(ms, `performance.now`). 아직 없으면 -Infinity */
  readonly blurredAt: number
}

export const INITIAL_BASELINE: BaselineState = { heights: new Map(), focused: false, blurredAt: Number.NEGATIVE_INFINITY }

export interface BaselineSample {
  width: number
  innerHeight: number
  textFocused: boolean
  now: number
}

/**
 * 측정 한 번마다의 기준 높이 전이(REV-042 M1).
 *  - 처음 보는 폭: 지금 높이. 칸에 포커스가 있으면 키보드가 이미 열려 줄어든 값일 수 있는 임시값이다 — 키보드가 내려가
 *    창이 커지면 바로 아래 규칙으로 고쳐져 다음 열림부터 잡는다. 이미 열려 있던 그 키보드는 비교할 높이가 없어 ① 경로로는
 *    알 수 없다 → 닫힘으로 둔다(아무것도 바꾸지 않는 쪽).
 *  - 커진 높이: 언제든 기준으로 삼는다. 키보드는 창을 줄이기만 한다.
 *  - 줄어든 높이: 칸 포커스가 없고, 빠진 지 `BASELINE_SETTLE_MS` 가 지났을 때만 — 분할 화면·자유 창·폴더블처럼 키보드가 아닌
 *    이유로 창이 줄었다. 칸 포커스 중에 줄어든 것은 키보드로 본다(기준 그대로).
 */
export function trackBaseline(s: BaselineState, m: BaselineSample): BaselineState {
  const blurredAt = !m.textFocused && s.focused ? m.now : s.blurredAt
  const prev = s.heights.get(m.width)
  const settled = !m.textFocused && m.now - blurredAt >= BASELINE_SETTLE_MS
  const next = prev === undefined || m.innerHeight > prev || settled ? m.innerHeight : prev
  if (next === prev && m.textFocused === s.focused && blurredAt === s.blurredAt) return s
  return { heights: next === prev ? s.heights : new Map(s.heights).set(m.width, next), focused: m.textFocused, blurredAt }
}

/** 회전(`orientationchange`)·화면 복귀(`visibilitychange`) — 그 사이 창 크기가 바뀌었을 수 있어 폭별 기준을 모두 버린다. */
export function resetBaseline(s: BaselineState): BaselineState {
  return s.heights.size === 0 ? s : { ...s, heights: new Map() }
}

/** 이 폭의 기준 높이. `trackBaseline` 을 먼저 거친 상태라면 항상 있다. */
export function baselineFor(s: BaselineState, width: number, innerHeight: number): number {
  return s.heights.get(width) ?? innerHeight
}

export interface ViewportSample {
  /** `window.innerHeight` */
  innerHeight: number
  /** 같은 폭의 키보드 없는 높이(`trackBaseline`) */
  baselineHeight: number
  /** `visualViewport` 값 — 없는 브라우저는 null */
  vvHeight: number | null
  vvOffsetTop: number
  vvScale: number
  /** 포커스가 소프트 키보드를 띄우는 칸에 있는가 */
  textFocused: boolean
  /** 손가락 입력 기기인가 — 데스크톱 창 크기 조절을 키보드로 착각하지 않게 ①(화면 줄어듦)에만 건다 */
  coarsePointer: boolean
}

export interface KeyboardState {
  open: boolean
  /** ② 경로에서 키보드가 덮은 높이(px). ① 경로·키보드 없음은 0. */
  insetPx: number
}

export function keyboardState(s: ViewportSample): KeyboardState {
  // 두 손가락 확대도 visualViewport 를 줄인다 — 그건 키보드가 아니다(R7).
  const covered = s.vvHeight === null || s.vvScale > 1.01 ? 0 : s.innerHeight - s.vvHeight - s.vvOffsetTop
  const insetPx = covered > 1 ? Math.round(covered) : 0
  const shrunk = s.coarsePointer ? s.baselineHeight - s.innerHeight : 0
  const open = s.textFocused && (insetPx >= KEYBOARD_MIN_PX || shrunk >= KEYBOARD_MIN_PX)
  // 키보드로 보지 않는 작은 가림(주소창 등)은 내보내지 않는다 — 앱 셸이 몇 px 씩 출렁이지 않게.
  return { open, insetPx: open ? insetPx : 0 }
}

export interface RevealInput {
  /** 입력 칸 위·아래(화면 좌표) */
  fieldTop: number
  fieldBottom: number
  /** 스크롤 영역에서 실제로 보이는 위·아래 — 붙박이 헤더 아래 ~ 키보드 위 */
  visibleTop: number
  visibleBottom: number
}

/**
 * 입력 칸을 키보드 위 16px 이상에 두려면 스크롤을 얼마나 옮겨야 하는가(+ 아래로, − 위로, 0 그대로).
 * 칸이 보이는 칸보다 크면(늘려 놓은 긴 글 칸) 0 — 브라우저가 커서 줄을 스스로 보여 주는 동작에 맡긴다.
 */
export function revealDelta(r: RevealInput): number {
  const room = r.visibleBottom - r.visibleTop - REVEAL_GAP_PX * 2
  if (room <= 0 || r.fieldBottom - r.fieldTop > room) return 0
  if (r.fieldBottom + REVEAL_GAP_PX > r.visibleBottom) return Math.ceil(r.fieldBottom + REVEAL_GAP_PX - r.visibleBottom)
  if (r.fieldTop - REVEAL_GAP_PX < r.visibleTop) return Math.floor(r.fieldTop - REVEAL_GAP_PX - r.visibleTop)
  return 0
}
