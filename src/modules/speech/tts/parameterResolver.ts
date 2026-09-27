/**
 * TTS Parameter Resolver(configuration-resolution §4) — 요청 시점 값 해석. 위가 아래를 덮는다:
 *   1 User Setting(AUTO·null 제외) > 2 VoiceProfile.defaults > 3 Persona hint > 4 Conversation context > 5 LLM speech.style > DEFAULT
 *
 * - LLM 은 `style` 하나만 제공하고 그것도 voice 의 실제 스타일로 **매핑만** 된다(speaker·model·pitch·styleWeight 불가, §68).
 * - style 은 선택된 voice 가 가진 스타일일 때만 채택한다(없는 이름은 그 층을 건너뛴다).
 * - 출력은 엔진 독립 `ResolvedBase`(+ `sourceByKey`, 관리자·Trace 용 — 사용자 화면에는 싣지 않는다).
 *   엔진 고유 파라미터 변환은 L5 어댑터 몫이다.
 */
import type { LlmSpeechStyle, ParamSource, ResolvedBase, VoiceParams } from './types'

export const RANGES = {
  styleWeight: [0, 2],
  speed: [0.6, 1.2],
  pitch: [0.8, 1.2],
  intonation: [0.8, 1.2],
} as const

export interface UserVoiceInput {
  style: string
  styleWeight: number | null
  speed: number
  pitch: number
  intonation: number
}

export interface ResolveInput {
  user: UserVoiceInput | null
  voiceDefaults: unknown
  voiceStyles: readonly { name: string; styleWeightDefault: number }[]
  personaHint?: { style?: string; speedMax?: number } | null
  context?: { mode: 'TALK' | 'LESSON_READ' | 'REVIEW' | 'PREVIEW' | 'EVAL' | 'TTS'; speed?: number; style?: string } | null
  llmStyle?: LlmSpeechStyle | null
}

/** LLM 의미 스타일 → voice 스타일 후보(configuration-resolution §4 5순위 매핑표). */
const LLM_STYLE_CANDIDATES: Record<LlmSpeechStyle, string[]> = {
  ENCOURAGING: ['Friendly', 'Happy'],
  CHEERFUL: ['Cheerful', 'Happy'],
  CALM: ['Neutral', 'Calm'],
  NEUTRAL: ['Neutral'],
}

export function clamp(v: number, [lo, hi]: readonly [number, number]): number {
  return Math.min(hi, Math.max(lo, v))
}

/** 부동소수 오차(0.8×1.1=0.8800000000000001)를 없애 캐시 키가 흔들리지 않게 한다. */
export function round3(v: number): number {
  return Math.round(v * 1000) / 1000
}

function num(v: unknown, range: readonly [number, number]): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= range[0] && v <= range[1] ? v : null
}

export function resolveTtsParameters(input: ResolveInput): ResolvedBase {
  const has = (name: unknown): name is string => typeof name === 'string' && name !== 'AUTO' && input.voiceStyles.some((s) => s.name === name)
  const d = (input.voiceDefaults && typeof input.voiceDefaults === 'object' ? input.voiceDefaults : {}) as Record<string, unknown>
  const u = input.user
  const src = {} as Record<keyof VoiceParams, ParamSource>

  let style: string | null = null
  if (u && has(u.style)) [style, src.style] = [u.style, 'USER_SETTING']
  else if (has(d.style)) [style, src.style] = [d.style, 'VOICE_PROFILE']
  else if (has(input.personaHint?.style)) [style, src.style] = [input.personaHint!.style!, 'PERSONA']
  else if (has(input.context?.style)) [style, src.style] = [input.context!.style!, 'CONTEXT']
  else if (input.llmStyle) {
    const hit = LLM_STYLE_CANDIDATES[input.llmStyle].find((n) => has(n))
    if (hit) [style, src.style] = [hit, 'LLM']
  }
  if (!style) [style, src.style] = [input.voiceStyles[0]?.name ?? 'Neutral', 'DEFAULT']

  const pick = (key: 'speed' | 'pitch' | 'intonation'): number => {
    const r = RANGES[key]
    const fromUser = u ? num(u[key], r) : null
    if (fromUser !== null) return ((src[key] = 'USER_SETTING'), fromUser)
    const fromVoice = num(d[key], r)
    if (fromVoice !== null) return ((src[key] = 'VOICE_PROFILE'), fromVoice)
    if (key === 'speed') {
      const fromCtx = num(input.context?.speed, r)
      if (fromCtx !== null) return ((src[key] = 'CONTEXT'), fromCtx)
    }
    return ((src[key] = 'DEFAULT'), 1)
  }
  let speed = pick('speed')
  // 페르소나 속도 상한은 학습자·voice 가 속도를 정하지 않았을 때만 적용한다(§4 3순위 조건).
  const cap = input.personaHint?.speedMax
  if (src.speed === 'DEFAULT' && typeof cap === 'number' && cap < speed) [speed, src.speed] = [clamp(cap, RANGES.speed), 'PERSONA']
  const pitch = pick('pitch')
  const intonation = pick('intonation')

  let styleWeight: number
  const uw = u ? num(u.styleWeight, RANGES.styleWeight) : null
  const dw = num(d.styleWeight, RANGES.styleWeight)
  if (uw !== null) [styleWeight, src.styleWeight] = [uw, 'USER_SETTING']
  else if (dw !== null) [styleWeight, src.styleWeight] = [dw, 'VOICE_PROFILE']
  else {
    const def = input.voiceStyles.find((s) => s.name === style)?.styleWeightDefault
    styleWeight = num(def, RANGES.styleWeight) ?? 1
    src.styleWeight = 'DEFAULT'
  }

  return { style, styleWeight: round3(styleWeight), speed: round3(speed), pitch: round3(pitch), intonation: round3(intonation), sourceByKey: src }
}
