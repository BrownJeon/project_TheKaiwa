/**
 * 설정 > AI 선생님 목소리 슬라이더 로직(task-022 데모 v2 승인안 — D1 A·D2 A·D3 A·D4 A).
 * 조절 범위는 서버 정본(`preferences` `VOICE_PARAM_RANGES`)을 라우트가 props 로 내려준다 — 여기서 min/max 를 적지 않는다.
 */

export type VoiceAxis = 'speed' | 'pitch' | 'intonation' | 'styleWeight'
export type VoiceRanges = { readonly [K in VoiceAxis]: readonly [number, number] }
/** 축별 "기본" 값 — 학습자가 값을 정하지 않았을 때 들리는 값(`voiceBaseValues`). */
export type VoiceValues = Record<VoiceAxis, number>

export const VOICE_STEP = 0.05
/** 목소리도 값을 정하지 않았을 때의 마지막 기본값(서버 Resolver DEFAULT). */
const DEFAULT = 1
const EPS = 1e-9
export const NEUTRAL_VOICE_VALUES: Readonly<VoiceValues> = { speed: DEFAULT, pitch: DEFAULT, intonation: DEFAULT, styleWeight: DEFAULT }

const WORDS: Record<VoiceAxis, { lo: string; hi: string; vlo: string; vhi: string }> = {
  speed: { lo: '느리게', hi: '빠르게', vlo: '기본보다 느리게', vhi: '기본보다 빠르게' },
  pitch: { lo: '낮게', hi: '높게', vlo: '기본보다 낮게', vhi: '기본보다 높게' },
  intonation: { lo: '평평하게', hi: '크게', vlo: '억양을 평평하게', vhi: '억양을 크게' },
  styleWeight: { lo: '옅게', hi: '진하게', vlo: '말투를 옅게', vhi: '말투를 진하게' },
}

/**
 * "넓어진 구간" 안내 기준 = 넓히기 전 범위. 저장·검증 범위가 아니라 안내 문구의 경계일 뿐이다 —
 * 음성 서버 실측(task-022)에서 이 안쪽은 음질 저하 신호가 없었고, 바깥은 사용자가 들어 보고 판단한다.
 */
const HINT_COMFORT: Record<VoiceAxis, readonly [number, number]> = {
  speed: [0.6, 1.2],
  pitch: [0.8, 1.2],
  intonation: [0.8, 1.2],
  styleWeight: [0, 2],
}

export function isDefaultValue(v: number, base: number = DEFAULT): boolean {
  return Math.abs(v - base) < 0.001
}

/** 방향 말은 그 축의 "기본"(`base`, 목소리 기본값) 기준이다 — 눈금 "기본" 자리와 같은 값. */
export function directionWord(axis: VoiceAxis, v: number, base: number = DEFAULT): string {
  return isDefaultValue(v, base) ? '기본' : v < base ? WORDS[axis].lo : WORDS[axis].hi
}

/** 화면 읽기 값 — "1.30배, 기본보다 빠르게". */
export function valueText(axis: VoiceAxis, v: number, base: number = DEFAULT): string {
  const dir = isDefaultValue(v, base) ? '기본' : v < base ? WORDS[axis].vlo : WORDS[axis].vhi
  return `${v.toFixed(2)}배, ${dir}`
}

/** 눈금 "기본 1.0" 의 숫자 — 0.1 단위면 한 자리(1.0·1.1), 아니면 두 자리(1.05). */
export function baseLabel(base: number): string {
  return Number.isInteger(Math.round(base * 1000) / 100) ? base.toFixed(1) : base.toFixed(2)
}

/** range 입력값 → 저장 값. 부동소수 꼬리(1.4000000000000001)가 서버 상한 검증(400)에 걸리지 않게 두 자리로 자른다. */
export function parseSliderValue(raw: string): number {
  return Math.round(Number(raw) * 100) / 100
}

/**
 * 막대 위 위치(0~1). 기본 자리(`def`, 목소리 기본값 — 대개 1.0)와 손잡이(`at`) 사이만 채운다(기본값이면 채움 없음).
 * 표시용이라 0~1 로만 묶는다 — 값 자체는 건드리지 않는다(저장값 클램프 금지).
 */
export function trackPositions(v: number, [min, max]: readonly [number, number], base: number = DEFAULT): { def: number; from: number; to: number } {
  const pos = (x: number) => (max > min ? Math.min(1, Math.max(0, (x - min) / (max - min))) : 0)
  const def = pos(base)
  const at = pos(v)
  return { def, from: Math.min(def, at), to: Math.max(def, at) }
}

function outsideComfort(axis: VoiceAxis, v: number): boolean {
  const [lo, hi] = HINT_COMFORT[axis]
  return v < lo - EPS || v > hi + EPS
}

/** 속도·높낮이·억양의 넓어진 구간 안내(D2 A). 높낮이를 낮추는 쪽만 음질 문구가 다르다(실측 유성 구간 감소). */
export function rangeNote(axis: 'speed' | 'pitch' | 'intonation', v: number): string | null {
  if (!outsideComfort(axis, v)) return null
  if (axis === 'pitch' && v < HINT_COMFORT.pitch[0]) return '넓어진 구간이에요. 낮출수록 소리가 조금 거칠어질 수 있어요 — 미리듣기로 확인해 보세요.'
  return '넓어진 구간이에요. 어색하면 가운데 쪽으로 옮겨 보세요.'
}

/** 높낮이 낮게 + 억양 크게를 동시에 넓어진 구간으로 — 실측에서 이 조합만 기준을 넘었다(서버는 막지 않고 화면이 알린다). */
export function comboNote(pitch: number, intonation: number): string | null {
  return pitch < HINT_COMFORT.pitch[0] - EPS && intonation > HINT_COMFORT.intonation[1] + EPS
    ? '높낮이를 낮게, 억양을 크게 — 둘을 동시에 끝 쪽으로 두면 소리가 갈라지거나 얇아질 수 있어요. 한쪽을 가운데 쪽으로 옮겨 보세요.'
    : null
}

export interface VoiceStyleOption {
  name: string
  label: string
}

/**
 * 세기를 곱해도 거의 달라지지 않는 말투. 'Neutral' 은 목소리 스타일들의 평균이라 세기를 바꿔도 평균 그대로에 가깝다
 * (task-022 실측 — 'Happy' 는 세기 4 에서 높이 +3~6%, 'Neutral' 은 기준 편차 수준).
 */
const WEAK_WEIGHT_STYLES: ReadonlySet<string> = new Set(['Neutral'])

/** 실제로 쓰는 말투 — 서버 Resolver 와 같은 순서(고른 말투 → 목소리 기본 말투 → 첫 말투). 목소리에 없는 이름은 건너뛴다. */
export function effectiveStyle(style: string, styles: readonly VoiceStyleOption[], voiceDefaultStyle: string | null | undefined): string | null {
  if (style !== 'AUTO' && styles.some((s) => s.name === style)) return style
  if (voiceDefaultStyle && styles.some((s) => s.name === voiceDefaultStyle)) return voiceDefaultStyle
  return styles[0]?.name ?? null
}

function objectParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1)
  if (code < 0xac00 || code > 0xd7a3) return '을(를)'
  return (code - 0xac00) % 28 === 0 ? '를' : '을'
}

/**
 * 말투 세기 안내. 약한 말투(자동이 약한 말투로 풀리는 경우 포함)면 D2 와 무관하게 항상 보인다(Leader 지시),
 * 그 밖에는 넓어진 구간(2 초과)에서만 D2 안내.
 */
export function styleWeightNote(input: {
  style: string
  styles: readonly VoiceStyleOption[]
  voiceDefaultStyle?: string | null
  weight: number
}): string | null {
  const eff = effectiveStyle(input.style, input.styles, input.voiceDefaultStyle)
  if (eff === null || WEAK_WEIGHT_STYLES.has(eff)) {
    const label = input.style === 'AUTO' ? '자동' : (input.styles.find((s) => s.name === input.style)?.label ?? input.style)
    const strong = input.styles.filter((s) => !WEAK_WEIGHT_STYLES.has(s.name)).map((s) => s.label)
    const head = `지금 말투(${label})에서는 세기를 바꿔도 거의 달라지지 않아요.`
    if (strong.length === 0) return head
    return `${head} ‘${strong.join('’·‘')}’${objectParticle(strong[strong.length - 1])} 고르면 차이가 커져요.`
  }
  return outsideComfort('styleWeight', input.weight) ? '넓어진 구간이에요. 진하게 할수록 과장되게 들릴 수 있어요 — 미리듣기로 확인해 보세요.' : null
}

/**
 * 목소리가 정한 기본값 원자료 — 서버 TTS Resolver 가 읽는 입력(목소리 defaults · 말투별 기본 세기)에서 숫자와 말투 이름만 고른 것.
 * 컴포넌트는 preferences·speech 를 import 할 수 없어 라우트(서버 컴포넌트)가 목소리 id 별로 props 로 넘긴다. 빠진 값은 null.
 */
export interface VoiceBaseline {
  style: string | null
  styleWeight: number | null
  speed: number | null
  pitch: number | null
  intonation: number | null
  /** 말투 이름 → 그 말투의 기본 세기 */
  styleWeights: Readonly<Record<string, number>>
}
export type VoiceBaselines = Readonly<Record<string, VoiceBaseline>>

const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const within = (v: unknown, [lo, hi]: readonly [number, number]): number | null => {
  const n = finite(v)
  return n !== null && n >= lo && n <= hi ? n : null
}

/** 목소리 defaults(JSON)·말투 목록 → 원자료. 알려진 키의 숫자·말투 이름만 남긴다(다른 키는 props 로 내보내지 않는다). */
export function baselineFrom(rawDefaults: unknown, styles: readonly { name: string; styleWeightDefault: number }[]): VoiceBaseline {
  const d = (rawDefaults && typeof rawDefaults === 'object' ? rawDefaults : {}) as Record<string, unknown>
  const styleWeights: Record<string, number> = {}
  for (const s of styles) {
    const w = finite(s.styleWeightDefault)
    if (w !== null) styleWeights[s.name] = w
  }
  return {
    style: typeof d.style === 'string' ? d.style : null,
    styleWeight: finite(d.styleWeight),
    speed: finite(d.speed),
    pitch: finite(d.pitch),
    intonation: finite(d.intonation),
    styleWeights,
  }
}

/**
 * 학습자가 값을 정하지 않았을 때 들리는 값 = 슬라이더의 "기본". 서버 Resolver 2순위 이하와 같은 순서다:
 * 속도·높낮이·억양은 목소리 기본값 → 1.0, 말투 세기는 목소리 기본 세기 → 실제로 쓰는 말투(`style`, 자동이면 풀린 말투)의 기본 세기 → 1.0.
 * 범위 밖 값은 Resolver 처럼 건너뛴다.
 */
export function voiceBaseValues(baseline: Partial<VoiceBaseline> | null | undefined, style: string | null, ranges: VoiceRanges): VoiceValues {
  const b = baseline ?? {}
  const pick = (axis: 'speed' | 'pitch' | 'intonation') => within(b[axis], ranges[axis]) ?? DEFAULT
  const styleDefault = style !== null ? b.styleWeights?.[style] : undefined
  return {
    speed: pick('speed'),
    pitch: pick('pitch'),
    intonation: pick('intonation'),
    styleWeight: within(b.styleWeight, ranges.styleWeight) ?? within(styleDefault, ranges.styleWeight) ?? DEFAULT,
  }
}

/**
 * 되돌리기 버튼을 보일지(D3 A — 바꾼 값이 있을 때만). 기준은 슬라이더 눈금의 "기본"과 같은 `base`(목소리 기본값).
 * 말투 세기 null 은 "목소리 기본"이라 바꾼 값이 아니다.
 */
export function hasChangedFromDefault(
  v: { speed: number; pitch: number; intonation: number; styleWeight: number | null },
  base: Readonly<VoiceValues>,
): boolean {
  return (
    !isDefaultValue(v.speed, base.speed) ||
    !isDefaultValue(v.pitch, base.pitch) ||
    !isDefaultValue(v.intonation, base.intonation) ||
    (v.styleWeight !== null && !isDefaultValue(v.styleWeight, base.styleWeight))
  )
}

/** 되돌리기 결과(저장은 하지 않는다). 속도·높낮이·억양은 목소리 기본값으로, 말투 세기는 null 로 — 목소리·말투 기본값을 다시 따른다. */
export function resetVoiceValues(base: Readonly<VoiceValues>): { speed: number; pitch: number; intonation: number; styleWeight: null } {
  return { speed: base.speed, pitch: base.pitch, intonation: base.intonation, styleWeight: null }
}
