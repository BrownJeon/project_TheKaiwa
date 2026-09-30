/**
 * task-022 음성 범위 확대 — 정본 하나(preferences VOICE_PARAM_RANGES)·Resolver/Plan 클램프 양 끝·학습 프로필 속도 회귀·캐시 키.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { VOICE_PARAM_RANGES } from '@/modules/preferences'
import { ttsCacheKey, type CacheKeyParts } from '../tts/cache'
import { RANGES, resolveTtsParameters, type UserVoiceInput } from '../tts/parameterResolver'
import { learningSpeedFactor, PROFILE_POLICIES, SPEECH_PROFILES, type SpeechProfileName } from '../tts/profiles'
import { buildRenderingPlan, effectiveParams } from '../tts/renderingPlan'
import { SEGMENT_SPEEDS, SEGMENT_STYLES, type ResolvedBase, type SegmentSpeed, type SegmentStyle } from '../tts/types'

const STYLES = [
  { name: 'Neutral', styleWeightDefault: 1 },
  { name: 'Happy', styleWeightDefault: 1 },
]
const VOICE = ['Neutral', 'Happy']
const SRC: ResolvedBase['sourceByKey'] = { style: 'USER_SETTING', styleWeight: 'USER_SETTING', speed: 'USER_SETTING', pitch: 'USER_SETTING', intonation: 'USER_SETTING' }
const base = (o: Partial<ResolvedBase> = {}): ResolvedBase => ({ style: 'Neutral', styleWeight: 1, speed: 1, pitch: 1, intonation: 1, sourceByKey: SRC, ...o })
const user = (o: Partial<UserVoiceInput> = {}): UserVoiceInput => ({ style: 'AUTO', styleWeight: null, speed: 1, pitch: 1, intonation: 1, ...o })

test('범위 정본은 하나 — speech RANGES 는 preferences VOICE_PARAM_RANGES 그 자체, 값은 Leader 확정 범위', () => {
  assert.equal(RANGES, VOICE_PARAM_RANGES)
  assert.deepEqual(VOICE_PARAM_RANGES, { styleWeight: [0, 4], speed: [0.5, 1.5], pitch: [0.7, 1.4], intonation: [0.6, 1.4] })
})

test('Resolver: 새 양 끝값은 사용자 값으로 채택, 바로 밖은 그 층을 건너뛴다', () => {
  const lo = resolveTtsParameters({ user: user({ speed: 0.5, pitch: 0.7, intonation: 0.6, styleWeight: 0, style: 'Happy' }), voiceDefaults: {}, voiceStyles: STYLES })
  assert.deepEqual([lo.speed, lo.pitch, lo.intonation, lo.styleWeight], [0.5, 0.7, 0.6, 0])
  assert.deepEqual([lo.sourceByKey.speed, lo.sourceByKey.pitch, lo.sourceByKey.intonation, lo.sourceByKey.styleWeight], ['USER_SETTING', 'USER_SETTING', 'USER_SETTING', 'USER_SETTING'])
  const hi = resolveTtsParameters({ user: user({ speed: 1.5, pitch: 1.4, intonation: 1.4, styleWeight: 4 }), voiceDefaults: {}, voiceStyles: STYLES })
  assert.deepEqual([hi.speed, hi.pitch, hi.intonation, hi.styleWeight], [1.5, 1.4, 1.4, 4])
  // 범위 밖 사용자 값(저장 경로는 400 이라 정상적으로는 오지 않는다)은 VoiceProfile → DEFAULT 로 넘어간다
  const out = resolveTtsParameters({ user: user({ speed: 1.51, pitch: 0.69, intonation: 1.41, styleWeight: 4.01 }), voiceDefaults: { speed: 1.5, pitch: 0.7 }, voiceStyles: STYLES })
  assert.deepEqual([out.speed, out.sourceByKey.speed, out.pitch, out.sourceByKey.pitch, out.intonation, out.sourceByKey.intonation, out.styleWeight, out.sourceByKey.styleWeight], [1.5, 'VOICE_PROFILE', 0.7, 'VOICE_PROFILE', 1, 'DEFAULT', 1, 'DEFAULT'])
  // 페르소나 속도 상한도 새 하한으로 clamp
  const cap = resolveTtsParameters({ user: null, voiceDefaults: {}, voiceStyles: STYLES, personaHint: { speedMax: 0.3 } })
  assert.deepEqual([cap.speed, cap.sourceByKey.speed], [0.5, 'PERSONA'])
})

test('Plan 클램프 양 끝: 끝값 base 는 그대로, 배율이 밀어낸 값은 새 범위에서 잘린다', () => {
  const plain = (b: ResolvedBase, label: SegmentStyle | null = null) => effectiveParams({ base: b, label, speedLabel: null, profile: 'NATIVE', learningSpeed: 0.8, voiceStyles: VOICE })
  assert.deepEqual(plain(base({ styleWeight: 0, speed: 0.5, pitch: 0.7, intonation: 0.6 })), { style: 'Neutral', styleWeight: 0, speed: 0.5, pitch: 0.7, intonation: 0.6 })
  assert.deepEqual(plain(base({ styleWeight: 4, speed: 1.5, pitch: 1.4, intonation: 1.4 })), { style: 'Neutral', styleWeight: 4, speed: 1.5, pitch: 1.4, intonation: 1.4 })
  const em = plain(base({ styleWeight: 4, intonation: 1.4 }), 'EMPHASIS') // ×1.1·×1.15
  assert.deepEqual([em.styleWeight, em.intonation], [4, 1.4])
  const calm = plain(base({ styleWeight: 0, intonation: 0.6 }), 'CALM') // ×0.8·×0.95
  assert.deepEqual([calm.styleWeight, calm.intonation], [0, 0.6])
  const enc = plain(base({ styleWeight: 4 }), 'ENCOURAGING')
  assert.equal(enc.styleWeight, 3.2)
})

// task-022 이전 effectiveParams 의 속도 계산(범위 0.6~1.2, VERY_SLOW 하한 0.6) — 회귀 비교 기준.
function legacySpeed(b: number, profile: SpeechProfileName, label: SegmentStyle | null, speedLabel: SegmentSpeed | null, learningSpeed: number): number {
  const presets = [0.6, 0.8, 1.0]
  const snap = (v: number) => presets.reduce((a, c) => (Math.abs(c - v) < Math.abs(a - v) ? c : a))
  const f = PROFILE_POLICIES[profile].speedFactor
  let s = b * (f === 'LEARNING_SPEED' ? learningSpeedFactor(learningSpeed) : f)
  if (label === 'EXPLANATION' || label === 'EMPHASIS') s *= 0.9
  if (speedLabel === 'SLOW') s = snap(s * 0.8)
  else if (speedLabel === 'VERY_SLOW') s = Math.max(0.6, s * 0.6)
  return Math.round(Math.min(1.2, Math.max(0.6, s)) * 1000) / 1000
}

const LABELS: (SegmentStyle | null)[] = [null, ...SEGMENT_STYLES]
const SPEED_LABELS: (SegmentSpeed | null)[] = [null, ...SEGMENT_SPEEDS.filter((s) => s !== 'NORMAL')]
const LEARNING = [0.6, 0.8, 1]
interface Combo {
  profile: SpeechProfileName
  label: SegmentStyle | null
  speedLabel: SegmentSpeed | null
  learningSpeed: number
}
function* combos(): Generator<Combo> {
  for (const profile of SPEECH_PROFILES) for (const label of LABELS) for (const speedLabel of SPEED_LABELS) for (const learningSpeed of LEARNING) yield { profile, label, speedLabel, learningSpeed }
}
const speedOf = (b: number, c: Combo) =>
  effectiveParams({ base: base({ speed: b }), label: c.label, speedLabel: c.speedLabel, profile: c.profile, learningSpeed: c.learningSpeed, voiceStyles: VOICE }).speed

test('학습 프로필 속도 회귀: 옛 범위 base(0.6~1.2) 에서는 모든 프로필·라벨·SLOW/VERY_SLOW·learningSpeed 조합이 확대 전과 같다', () => {
  let n = 0
  for (let b100 = 60; b100 <= 120; b100 += 5) {
    const b = b100 / 100
    for (const c of combos()) {
      assert.equal(speedOf(b, c), legacySpeed(b, c.profile, c.label, c.speedLabel, c.learningSpeed), `base ${b} ${JSON.stringify(c)}`)
      n++
    }
  }
  assert.ok(n > 1000)
  // 대표값 고정: 기본 속도 1.0 에서 SLOW 0.8 · VERY_SLOW 0.6 · LEARNING_SLOW(0.6)×EXPLANATION 0.54 → 0.6
  const at1 = (profile: SpeechProfileName, label: SegmentStyle | null, speedLabel: SegmentSpeed | null, learningSpeed = 0.8) => speedOf(1, { profile, label, speedLabel, learningSpeed })
  assert.equal(at1('NATIVE', null, 'SLOW'), 0.8)
  assert.equal(at1('NATIVE', null, 'VERY_SLOW'), 0.6)
  assert.equal(at1('LEARNING_SLOW', 'EXPLANATION', null, 0.6), 0.6)
  assert.equal(at1('PRONUNCIATION', 'EXPLANATION', null), 0.72)
})

test('새 하한(0.5)은 사용자 speed 를 0.6 아래로 골랐을 때만 — 기본 1.0 에서는 어떤 조합도 0.6 밑으로 가지 않는다', () => {
  let min1 = Infinity
  for (const c of combos()) min1 = Math.min(min1, speedOf(1, c))
  assert.equal(min1, 0.6)
  // base 0.5: 배율이 더 내려도 base(=새 하한)에서 멈추고, SLOW 스냅(최저 0.6)이 base 보다 빠르게 만들지 않는다
  for (const c of combos()) assert.equal(speedOf(0.5, c), 0.5, JSON.stringify(c))
  // base 0.55: base 가 하한 — 새 범위 하한(0.5)까지 끌어내리지 않는다
  for (const c of combos()) assert.equal(speedOf(0.55, c), 0.55, JSON.stringify(c))
  // 전체 경로: 사용자 0.5 저장 → LEARNING_SLOW 레슨 낭독도 0.5
  const b = resolveTtsParameters({ user: user({ speed: 0.5 }), voiceDefaults: {}, voiceStyles: STYLES })
  const plan = buildRenderingPlan({ voiceId: 'v', speechProfile: 'LEARNING_SLOW', base: b, segments: [{ text: 'a', normalizedText: 'a', hints: [], rulesApplied: 0 }], voiceStyles: VOICE, learningSpeed: 0.6, llmStyle: null })
  assert.equal(plan.segments[0].effective.speed, 0.5)
})

test('캐시 키(12요소): speed·pitch·intonation·styleWeight 새 범위 값마다 다른 키, 같은 입력은 같은 키', () => {
  const keyFor = (u: UserVoiceInput | null, profile: SpeechProfileName = 'NATIVE') => {
    const b = resolveTtsParameters({ user: u, voiceDefaults: {}, voiceStyles: STYLES, context: { mode: 'PREVIEW' } })
    const eff = buildRenderingPlan({ voiceId: 'teacher_haruka', speechProfile: profile, base: b, segments: [{ text: 'a', normalizedText: 'ありがとうございます。', hints: [], rulesApplied: 0 }], voiceStyles: VOICE, learningSpeed: 0.8, llmStyle: null }).segments[0].effective
    const parts: CacheKeyParts = {
      normalizedText: 'ありがとうございます。', voiceProfileId: 'teacher_haruka', modelVersion: '1.0.0', dictionaryVersion: 1, lexiconDigest: null, speechProfile: profile,
      style: eff.style, styleWeight: eff.styleWeight, speed: eff.speed, pitch: eff.pitch, intonation: eff.intonation, engineConnectionKey: 'tts-primary', textVersion: 1,
    }
    return ttsCacheKey(parts)
  }
  const variants: UserVoiceInput[] = [
    user(),
    user({ speed: 0.5 }), user({ speed: 1.5 }), user({ speed: 1.3 }),
    user({ pitch: 0.7 }), user({ pitch: 1.4 }),
    user({ intonation: 0.6 }), user({ intonation: 1.4 }),
    user({ style: 'Happy', styleWeight: 0 }), user({ style: 'Happy', styleWeight: 1 }), user({ style: 'Happy', styleWeight: 3 }), user({ style: 'Happy', styleWeight: 4 }),
  ]
  const keys = variants.map((u) => keyFor(u))
  assert.equal(new Set(keys).size, variants.length)
  assert.equal(keyFor(user({ pitch: 1.4 })), keys[5])
  // 옛 범위 저장값은 옛 유효값과 같은 키(캐시가 불필요하게 갈리지 않는다)
  const old = user({ speed: 0.8, pitch: 1.1, intonation: 0.9 })
  const oldParts: CacheKeyParts = {
    normalizedText: 'ありがとうございます。', voiceProfileId: 'teacher_haruka', modelVersion: '1.0.0', dictionaryVersion: 1, lexiconDigest: null, speechProfile: 'NATIVE',
    style: 'Neutral', styleWeight: 1, speed: 0.8, pitch: 1.1, intonation: 0.9, engineConnectionKey: 'tts-primary', textVersion: 1,
  }
  assert.equal(keyFor(old), ttsCacheKey(oldParts))
})
