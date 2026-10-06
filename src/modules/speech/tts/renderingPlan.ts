/**
 * SpeechRenderingPlan(speech-platform/16 §4) — 엔진 독립 플랜. 두 단계다:
 *   ① prepareSegments: 문장 감지 → (세그먼트마다) 사전 매칭 → 매칭 구간 보호한 정규화
 *   ② buildRenderingPlan: 세그먼트 라벨링(요청 라벨 > LLM 라벨 > 프로필 편향) → Resolver base 에 §4.3 배율·프로필 배율 → 범위 clamp
 * 세그먼트 유효값(style·styleWeight·speed·pitch·intonation)은 여기서 **엔진 독립 수치**로 계산해 캐시 키에 쓰고,
 * 어댑터는 이름·단위 변환(예: 속도→길이)과 엔진 고유 튜닝만 한다. 클라이언트가 보낸 수치는 쓰지 않는다(§4.4).
 */
import type { LexiconEntryData, LexiconHint, LexiconMatch } from './lexicon'
import { findLexiconMatches, guardCompoundMatches, rescanHintSurfaces } from './lexicon'
import { normalizeJapanese, type NormalizationResult, type NormalizationToken } from './normalizer'
import { clamp, RANGES, round3 } from './parameterResolver'
import { learningSpeedFactor, PROFILE_POLICIES, type SpeechProfileName } from './profiles'
import { splitSentences } from './sentences'
import type { LlmSpeechStyle, PlanSegment, ResolvedBase, SegmentSpeed, SegmentStyle, SpeechRenderingPlan, VoiceParams } from './types'

export interface PreparedSegment {
  text: string
  normalizedText: string
  hints: LexiconHint[]
  rulesApplied: number
}

/** `prepareSegments` + 그 세그먼트의 정규화 token map(원문 `text` 의 UTF-16 좌표) — 단어 timing 을 조각 글로 되돌릴 때(task-012b-4). */
export interface PreparedSegmentWithTokens extends PreparedSegment {
  tokens: NormalizationToken[]
}

export function prepareSegmentsWithTokens(
  text: string,
  opts: { lexicon: ReadonlyMap<string, LexiconEntryData>; maxChars: number; splitAtComma?: boolean; single?: boolean },
): PreparedSegmentWithTokens[] {
  const pieces = opts.single ? [{ start: 0, end: text.length, text }] : splitSentences(text, { maxChars: opts.maxChars, splitAtComma: opts.splitAtComma })
  return pieces.map((p) => {
    let matches = guardCompoundMatches(p.text, findLexiconMatches(p.text, opts.lexicon))
    for (;;) {
      const n = normalizeJapanese(p.text, { protect: matches })
      const ambiguous = surfacesRescannedElsewhere(p.text, n, matches)
      if (ambiguous.size === 0) {
        return { text: p.text, normalizedText: n.normalizedText, hints: matches.map(({ surface, reading, accentType, wordType }) => ({ surface, reading, accentType, wordType })), rulesApplied: n.rulesApplied, tokens: n.tokens }
      }
      matches = matches.filter((m) => !ambiguous.has(m.surface))
    }
  })
}

/** 결과 모양은 task-035 L-2 고정값 그대로(token map 은 `prepareSegmentsWithTokens` 에만). */
export function prepareSegments(
  text: string,
  opts: { lexicon: ReadonlyMap<string, LexiconEntryData>; maxChars: number; splitAtComma?: boolean; single?: boolean },
): PreparedSegment[] {
  return prepareSegmentsWithTokens(text, opts).map(({ text: t, normalizedText, hints, rulesApplied }) => ({ text: t, normalizedText, hints, rulesApplied }))
}

/**
 * 어댑터 강등 치환은 hint 표기를 정규화 문장에서 위치 없이 다시 찾는다. 그 재검색이 남긴 일치(보호 구간)와 다른 자리를 잡는 표기 —
 * 가드로 버린 `明日香` 옆의 단독 `明日`, 버린 `東京都` 안의 `京都` 등 — 는 이 세그먼트 hint 에서 통째로 빼야 가드가 어댑터에서 다시 뚫리지 않는다
 * (그 표기는 모든 자리에서 엔진 기본 읽기). 빼면 보호 구간·정규화가 바뀌므로 호출부가 빈 집합이 될 때까지 반복한다(표기 수만큼으로 끝난다).
 */
function surfacesRescannedElsewhere(text: string, n: NormalizationResult, matches: readonly LexiconMatch[]): Set<string> {
  const out = new Set<string>()
  if (matches.length === 0) return out
  // 보호 구간의 정규화 문장 좌표 — normalizeJapanese 의 출력 조립(구간 사이 원문 + 치환값, 끝에서 trim)과 같은 순서로 센다.
  const protectedAt = new Map<number, number>()
  let raw = ''
  let pos = 0
  for (const t of n.tokens) {
    raw += text.slice(pos, t.srcStart)
    if (t.rule === 'PROTECTED') protectedAt.set(t.srcStart, raw.length)
    raw += t.replaced
    pos = t.srcEnd
  }
  raw += text.slice(pos)
  // 방어 코드: 정규화기 WHITESPACE 규칙이 원문 앞 공백을 이미 지워 보통 raw 는 공백으로 시작하지 않고 lead=0 이지만, 공백으로 시작하는 표기가
  // 손상 스냅샷으로 들어오면(validateLexiconEntry 는 trim 후 빈 값만 거른다) 보호 구간이 앞 공백을 차지해 0 이 아니다 — 빼면 그 입력에서 hint 가 더 빠진다(task-035, REV-106 L-2).
  const lead = raw.length - raw.trimStart().length
  const expected = new Set<string>()
  for (const m of matches) {
    const at = protectedAt.get(m.start)
    if (at === undefined || !n.normalizedText.startsWith(m.surface, at - lead)) out.add(m.surface)
    else expected.add(`${at - lead}\u0001${m.surface}`)
  }
  const found = new Set(rescanHintSurfaces(n.normalizedText, matches.map((m) => m.surface)).map((r) => `${r.start}\u0001${r.surface}`))
  for (const k of found) if (!expected.has(k)) out.add(k.slice(k.indexOf('\u0001') + 1))
  for (const k of expected) if (!found.has(k)) out.add(k.slice(k.indexOf('\u0001') + 1))
  return out
}

/** 라벨 → voice 스타일 후보(앞에서부터 그 voice 가 가진 첫 이름). AppSetting `tts.styleMap` 이 덮는다(§4.3). */
export const DEFAULT_STYLE_MAP: Readonly<Record<SegmentStyle, readonly string[]>> = {
  FRIENDLY: ['Friendly', 'Happy'],
  CALM: ['Calm', 'Neutral'],
  ENCOURAGING: ['Friendly', 'Happy'],
  EXPLANATION: ['Neutral'],
  EMPHASIS: [],
}

/** LLM `speech.style` → 세그먼트 라벨(§4.2). NEUTRAL 은 라벨 없음(base). */
export function labelFromLlm(s: LlmSpeechStyle | null | undefined): SegmentStyle | null {
  switch (s) {
    case 'ENCOURAGING':
      return 'ENCOURAGING'
    case 'CALM':
      return 'CALM'
    case 'CHEERFUL':
      return 'FRIENDLY'
    default:
      return null
  }
}

const SPEED_PRESETS = [0.6, 0.8, 1.0]
const snap = (v: number) => SPEED_PRESETS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a))

/**
 * 배율(프로필·라벨·SLOW·VERY_SLOW)이 속도를 내릴 수 있는 하한. 범위 하한(0.5, task-022)이 아니라 옛 하한 0.6 을 유지해
 * 기본 속도(1.0)의 학습 결과(예: LEARNING_SLOW 0.6 × EXPLANATION 0.9 = 0.54 → 0.6)가 범위 확대로 바뀌지 않게 한다.
 * base 가 0.6 보다 느리면(사용자·voice 가 고른 값) 그 base 가 하한이다 — 배율이 base 보다 빠르게 만들지 않는다.
 */
const DERIVED_SPEED_FLOOR = 0.6

export interface EffectiveInput {
  base: ResolvedBase
  label: SegmentStyle | null
  speedLabel: SegmentSpeed | null
  profile: SpeechProfileName
  learningSpeed: number
  voiceStyles: readonly string[]
  styleMap?: Partial<Record<SegmentStyle, readonly string[]>> | null
}

/** §4.3 배율표(엔진 독립 수치) + §5 프로필 배율 → clamp·반올림한 세그먼트 유효값. */
export function effectiveParams(i: EffectiveInput): VoiceParams {
  const policy = PROFILE_POLICIES[i.profile]
  const mapped = (label: SegmentStyle) => (i.styleMap?.[label] ?? DEFAULT_STYLE_MAP[label]).find((n) => i.voiceStyles.includes(n)) ?? i.base.style
  let { style, styleWeight, speed, intonation } = i.base
  speed *= policy.speedFactor === 'LEARNING_SPEED' ? learningSpeedFactor(i.learningSpeed) : policy.speedFactor
  switch (i.label) {
    case 'FRIENDLY':
      style = mapped('FRIENDLY')
      break
    case 'CALM':
      style = mapped('CALM')
      styleWeight *= 0.8
      intonation *= 0.95
      break
    case 'ENCOURAGING':
      style = mapped('ENCOURAGING')
      styleWeight *= 0.8
      intonation *= 1.1
      break
    case 'EXPLANATION':
      style = mapped('EXPLANATION')
      speed *= 0.9
      break
    case 'EMPHASIS':
      styleWeight *= 1.1
      intonation *= 1.15
      speed *= 0.9
      break
  }
  // 스냅 프리셋의 최저(0.6)가 base 보다 빠를 수 있어(base 0.5) base 로 누른다 — base ≥ 0.6 이면 스냅 결과가 늘 base 이하라 옛 결과 그대로.
  if (i.speedLabel === 'SLOW') speed = Math.min(snap(speed * 0.8), i.base.speed)
  else if (i.speedLabel === 'VERY_SLOW') speed *= 0.6
  if (policy.fixIntonation) intonation = i.base.intonation
  const speedFloor = Math.max(RANGES.speed[0], Math.min(DERIVED_SPEED_FLOOR, i.base.speed))
  return {
    style,
    styleWeight: round3(clamp(styleWeight, RANGES.styleWeight)),
    speed: round3(clamp(speed, [speedFloor, RANGES.speed[1]])),
    pitch: round3(clamp(i.base.pitch, RANGES.pitch)),
    intonation: round3(clamp(intonation, RANGES.intonation)),
  }
}

export interface RequestedLabels {
  style?: SegmentStyle
  speed?: SegmentSpeed
  pauseBeforeMs?: number
}

export interface BuildPlanInput {
  voiceId: string
  speechProfile: SpeechProfileName
  base: ResolvedBase
  segments: readonly PreparedSegment[]
  voiceStyles: readonly string[]
  learningSpeed: number
  llmStyle?: LlmSpeechStyle | null
  /** 화면(문맥)이 준 세그먼트 라벨 — 세그먼트 index 순. 수치는 받지 않는다. */
  requested?: readonly (RequestedLabels | null | undefined)[] | null
  styleMap?: Partial<Record<SegmentStyle, readonly string[]>> | null
}

export function buildRenderingPlan(i: BuildPlanInput): SpeechRenderingPlan {
  const policy = PROFILE_POLICIES[i.speechProfile]
  const llmLabel = policy.honorLlmLabel ? labelFromLlm(i.llmStyle) : null
  const segments: PlanSegment[] = i.segments.map((s, index) => {
    const req = i.requested?.[index] ?? null
    const label = req?.style ?? llmLabel ?? policy.defaultLabel
    const speedLabel = req?.speed && req.speed !== 'NORMAL' ? req.speed : null
    let pause = index > 0 ? policy.pauseBeforeMs : 0
    if (typeof req?.pauseBeforeMs === 'number') pause = Math.max(pause, Math.min(2000, Math.max(0, Math.round(req.pauseBeforeMs))))
    if (label === 'EMPHASIS') pause = Math.max(pause, 150)
    return {
      index,
      text: s.text,
      normalizedText: s.normalizedText,
      ...(label ? { style: label } : {}),
      ...(req?.speed ? { speed: req.speed } : {}),
      pauseBeforeMs: pause,
      effective: effectiveParams({ base: i.base, label, speedLabel, profile: i.speechProfile, learningSpeed: i.learningSpeed, voiceStyles: i.voiceStyles, styleMap: i.styleMap }),
    }
  })
  return { planVersion: 1, voiceId: i.voiceId, speechProfile: i.speechProfile, base: i.base, segments }
}
