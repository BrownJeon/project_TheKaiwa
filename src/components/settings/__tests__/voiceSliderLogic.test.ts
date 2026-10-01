import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
// 서버 검증 정본(설정 저장 #14 · Resolver 가 같이 읽는 값) — 화면은 라우트 props 로 받지만 테스트는 정본과 직접 대조한다.
import { VOICE_PARAM_RANGES } from '../../../modules/preferences/voiceRanges'
import VoiceSlider from '../VoiceSlider'
import {
  baselineFrom,
  baseLabel,
  comboNote,
  directionWord,
  effectiveStyle,
  hasChangedFromDefault,
  NEUTRAL_VOICE_VALUES,
  parseSliderValue,
  rangeNote,
  resetVoiceValues,
  styleWeightNote,
  trackPositions,
  valueText,
  VOICE_STEP,
  voiceBaseValues,
  type VoiceAxis,
} from '../voiceSliderLogic'

const STYLES = [
  { name: 'Neutral', label: '차분' },
  { name: 'Happy', label: '밝은' },
]

test('방향 말·화면 읽기 값: 기본 1.0 · 양쪽', () => {
  assert.equal(directionWord('speed', 1), '기본')
  assert.equal(directionWord('speed', 0.5), '느리게')
  assert.equal(directionWord('pitch', 1.4), '높게')
  assert.equal(directionWord('intonation', 0.6), '평평하게')
  assert.equal(directionWord('styleWeight', 4), '진하게')
  assert.equal(valueText('speed', 1.3), '1.30배, 기본보다 빠르게')
  assert.equal(valueText('intonation', 1), '1.00배, 기본')
  assert.equal(valueText('styleWeight', 0), '0.00배, 말투를 옅게')
})

test('parseSliderValue: 부동소수 꼬리를 두 자리로 잘라 서버 상한(1.4)을 넘지 않는다', () => {
  assert.equal(parseSliderValue('1.4000000000000001'), 1.4)
  assert.equal(parseSliderValue('0.7500000000000001'), 0.75)
  assert.equal(parseSliderValue('0.5'), 0.5)
})

test('trackPositions: 채움은 기본 1.0 과 손잡이 사이만, 1.0 이면 비어 있다', () => {
  const speed = [0.5, 1.5] as const
  assert.deepEqual(trackPositions(1, speed), { def: 0.5, from: 0.5, to: 0.5 })
  assert.deepEqual(trackPositions(1.5, speed), { def: 0.5, from: 0.5, to: 1 })
  assert.deepEqual(trackPositions(0.5, speed), { def: 0.5, from: 0, to: 0.5 })
  const w = trackPositions(2, [0, 4])
  assert.equal(w.def, 0.25)
  assert.equal(w.to, 0.5)
})

test('trackPositions: 범위 밖 값은 표시 위치만 끝에 붙이고 값은 건드리지 않는다', () => {
  const p = trackPositions(2, [0.7, 1.4])
  assert.equal(p.to, 1)
  assert.equal(trackPositions(0.1, [0.7, 1.4]).from, 0)
})

test('옛 저장값(넓히기 전 범위)은 새 범위 안의 제자리에 놓인다 — 클램프 없음', () => {
  const ranges = { speed: [0.5, 1.5], pitch: [0.7, 1.4], intonation: [0.6, 1.4], styleWeight: [0, 4] } as const
  const old = { speed: [0.6, 1.2], pitch: [0.8, 1.2], intonation: [0.8, 1.2], styleWeight: [0, 2] } as const
  for (const k of ['speed', 'pitch', 'intonation', 'styleWeight'] as const) {
    for (const v of old[k]) {
      assert.ok(v >= ranges[k][0] && v <= ranges[k][1], `${k} ${v} 는 새 범위 안`)
      const p = trackPositions(v, ranges[k])
      assert.ok(p.from >= 0 && p.to <= 1)
    }
  }
  // 옛 끝값 속도 1.2 → 막대 70% 지점(데모 "막대 위 위치만 가운데 쪽으로")
  assert.ok(Math.abs(trackPositions(1.2, ranges.speed).to - 0.7) < 1e-9)
})

test('rangeNote(D2 A): 넓히기 전 범위 안은 안내 없음, 밖은 안내 · 높낮이 낮은 쪽만 음질 문구', () => {
  assert.equal(rangeNote('speed', 1.2), null)
  assert.equal(rangeNote('speed', 0.6), null)
  assert.equal(rangeNote('pitch', 0.8), null)
  assert.equal(rangeNote('intonation', 1.2), null)
  assert.match(rangeNote('speed', 1.25) ?? '', /가운데 쪽으로/)
  assert.match(rangeNote('speed', 0.55) ?? '', /가운데 쪽으로/)
  assert.match(rangeNote('pitch', 1.3) ?? '', /가운데 쪽으로/)
  assert.match(rangeNote('pitch', 0.75) ?? '', /거칠어질 수 있어요/)
  assert.match(rangeNote('intonation', 0.6) ?? '', /가운데 쪽으로/)
})

test('comboNote: 높낮이 0.8 미만 + 억양 1.2 초과일 때만', () => {
  assert.match(comboNote(0.7, 1.4) ?? '', /동시에 끝 쪽/)
  assert.match(comboNote(0.75, 1.25) ?? '', /동시에 끝 쪽/)
  assert.equal(comboNote(0.8, 1.4), null)
  assert.equal(comboNote(0.7, 1.2), null)
  assert.equal(comboNote(1, 1), null)
})

test('effectiveStyle: AUTO 는 목소리 기본 말투 → 첫 말투', () => {
  assert.equal(effectiveStyle('Happy', STYLES, 'Neutral'), 'Happy')
  assert.equal(effectiveStyle('AUTO', STYLES, 'Happy'), 'Happy')
  assert.equal(effectiveStyle('AUTO', STYLES, 'AUTO'), 'Neutral')
  assert.equal(effectiveStyle('AUTO', STYLES, undefined), 'Neutral')
  assert.equal(effectiveStyle('AUTO', [], undefined), null)
})

test('styleWeightNote: 자동·차분은 값과 무관하게 항상 안내(데모 문구 그대로)', () => {
  const auto = styleWeightNote({ style: 'AUTO', styles: STYLES, voiceDefaultStyle: 'Neutral', weight: 1 })
  assert.equal(auto, '지금 말투(자동)에서는 세기를 바꿔도 거의 달라지지 않아요. ‘밝은’을 고르면 차이가 커져요.')
  const calm = styleWeightNote({ style: 'Neutral', styles: STYLES, weight: 3 })
  assert.equal(calm, '지금 말투(차분)에서는 세기를 바꿔도 거의 달라지지 않아요. ‘밝은’을 고르면 차이가 커져요.')
})

test('styleWeightNote: 밝은은 2 이하 안내 없음, 2 초과 넓어진 구간 안내', () => {
  assert.equal(styleWeightNote({ style: 'Happy', styles: STYLES, weight: 2 }), null)
  assert.equal(styleWeightNote({ style: 'Happy', styles: STYLES, weight: 0 }), null)
  assert.match(styleWeightNote({ style: 'Happy', styles: STYLES, weight: 2.05 }) ?? '', /과장되게/)
  // 자동이 밝은으로 풀리는 목소리는 밝은과 같게
  assert.equal(styleWeightNote({ style: 'AUTO', styles: STYLES, voiceDefaultStyle: 'Happy', weight: 1 }), null)
})

test('styleWeightNote: 조사(을/를)와 강한 말투가 없는 목소리', () => {
  const two = styleWeightNote({ style: 'Neutral', styles: [...STYLES, { name: 'Sad', label: '슬픈 말투' }], weight: 1 })
  assert.match(two ?? '', /‘밝은’·‘슬픈 말투’를 고르면/)
  const only = styleWeightNote({ style: 'AUTO', styles: [STYLES[0]], weight: 1 })
  assert.equal(only, '지금 말투(자동)에서는 세기를 바꿔도 거의 달라지지 않아요.')
})

test('hasChangedFromDefault(D3 A): 모두 1.0·세기 null 이면 숨김, 하나라도 바뀌면 보임', () => {
  const base = NEUTRAL_VOICE_VALUES
  assert.equal(hasChangedFromDefault({ speed: 1, pitch: 1, intonation: 1, styleWeight: null }, base), false)
  assert.equal(hasChangedFromDefault({ speed: 1, pitch: 1, intonation: 1, styleWeight: 1 }, base), false)
  assert.equal(hasChangedFromDefault({ speed: 1.05, pitch: 1, intonation: 1, styleWeight: null }, base), true)
  assert.equal(hasChangedFromDefault({ speed: 1, pitch: 0.7, intonation: 1, styleWeight: null }, base), true)
  assert.equal(hasChangedFromDefault({ speed: 1, pitch: 1, intonation: 1.4, styleWeight: null }, base), true)
  assert.equal(hasChangedFromDefault({ speed: 1, pitch: 1, intonation: 1, styleWeight: 0 }, base), true)
  assert.equal(hasChangedFromDefault({ ...{ speed: 1.3, pitch: 0.7, intonation: 1.4, styleWeight: 4 }, ...resetVoiceValues(base) }, base), false)
  assert.deepEqual(resetVoiceValues(base), { speed: 1, pitch: 1, intonation: 1, styleWeight: null })
})

const RANGES = VOICE_PARAM_RANGES
const RICH = [
  { name: 'Neutral', label: '차분', styleWeightDefault: 1 },
  { name: 'Happy', label: '밝은', styleWeightDefault: 1.5 },
]

test('voiceBaseValues: 서버 Resolver 와 같은 순서 — 목소리 기본값 → (세기) 말투별 기본 세기 → 1.0, 범위 밖은 건너뜀', () => {
  // 목소리 기본 세기가 있으면 말투와 무관하게 그 값(Resolver 2순위)
  const withWeight = baselineFrom({ style: 'Neutral', styleWeight: 2, speed: 1.1, pitch: 0.9, intonation: 1.2 }, RICH)
  assert.deepEqual(voiceBaseValues(withWeight, 'Happy', RANGES), { speed: 1.1, pitch: 0.9, intonation: 1.2, styleWeight: 2 })
  // 목소리 기본 세기가 없으면 실제로 쓰는 말투의 기본 세기
  const noWeight = baselineFrom({ style: 'Happy' }, RICH)
  assert.equal(voiceBaseValues(noWeight, 'Happy', RANGES).styleWeight, 1.5)
  assert.equal(voiceBaseValues(noWeight, 'Neutral', RANGES).styleWeight, 1)
  assert.equal(voiceBaseValues(noWeight, null, RANGES).styleWeight, 1)
  // 범위 밖 목소리 값은 건너뛰고 1.0(Resolver `num()` 과 같다)
  const bad = baselineFrom({ speed: 3, pitch: 0.2, intonation: 'x', styleWeight: 9 }, RICH)
  assert.deepEqual(voiceBaseValues(bad, 'Happy', RANGES), { speed: 1, pitch: 1, intonation: 1, styleWeight: 1.5 })
  // 원자료가 없으면(합성 불가 목소리) 전부 1.0
  assert.deepEqual(voiceBaseValues(undefined, 'Happy', RANGES), NEUTRAL_VOICE_VALUES)
  // baselineFrom 은 알려진 키의 숫자·말투 이름만 남긴다
  assert.deepEqual(Object.keys(baselineFrom({ style: 'Neutral', internalRef: 'x', other: 3 }, RICH)).sort(), ['intonation', 'pitch', 'speed', 'style', 'styleWeight', 'styleWeights'])
})

test('기본값이 1.0 이 아닌 목소리: 눈금·방향 말·되돌리기 판정·되돌리기 값이 같은 기준을 쓴다', () => {
  const baseline = baselineFrom({ style: 'Happy', speed: 1.1, pitch: 1, intonation: 0.9 }, RICH)
  const style = effectiveStyle('AUTO', RICH, baseline.style)
  assert.equal(style, 'Happy')
  const base = voiceBaseValues(baseline, style, RANGES)
  assert.deepEqual(base, { speed: 1.1, pitch: 1, intonation: 0.9, styleWeight: 1.5 })

  // 저장값 = 목소리 기본값 그대로(세기 null) → 되돌리기 버튼 없음, 슬라이더 세기는 1.5 를 보인다
  const untouched = { speed: 1.1, pitch: 1, intonation: 0.9, styleWeight: null }
  assert.equal(hasChangedFromDefault(untouched, base), false)
  assert.equal(untouched.styleWeight ?? base.styleWeight, 1.5)
  // 속도 1.0 은 이 목소리에서는 "바뀐 값"(기본보다 느리게)
  assert.equal(hasChangedFromDefault({ ...untouched, speed: 1 }, base), true)
  assert.equal(directionWord('speed', 1, base.speed), '느리게')
  assert.equal(valueText('speed', 1.1, base.speed), '1.10배, 기본')
  assert.equal(valueText('intonation', 1, base.intonation), '1.00배, 억양을 크게')
  // 세기를 기본 자리(1.5)에 둔 숫자 값은 바뀐 값이 아니다, 1.0 은 바뀐 값이다(옛 판정은 반대였다)
  assert.equal(hasChangedFromDefault({ ...untouched, styleWeight: 1.5 }, base), false)
  assert.equal(hasChangedFromDefault({ ...untouched, styleWeight: 1 }, base), true)
  // 되돌리기 → 목소리 기본값으로, 세기 null → 판정도 "바뀐 값 없음"
  const edited = { ...untouched, speed: 1.4, pitch: 0.7, styleWeight: 3 }
  assert.equal(hasChangedFromDefault(edited, base), true)
  const reset = { ...edited, ...resetVoiceValues(base) }
  assert.deepEqual(reset, { speed: 1.1, pitch: 1, intonation: 0.9, styleWeight: null })
  assert.equal(hasChangedFromDefault(reset, base), false)
  // 채움 시작점·눈금 표기도 같은 기준
  const atBase = trackPositions(1.1, RANGES.speed, base.speed)
  assert.ok(Math.abs(atBase.def - 0.6) < 1e-9)
  assert.equal(atBase.from, atBase.to) // 기본 자리면 채움 없음
  const faster = trackPositions(1.3, RANGES.speed, base.speed)
  assert.ok(Math.abs(faster.from - 0.6) < 1e-9 && Math.abs(faster.to - 0.8) < 1e-9)
  assert.equal(baseLabel(1), '1.0')
  assert.equal(baseLabel(1.1), '1.1')
  assert.equal(baseLabel(1.5), '1.5')
  assert.equal(baseLabel(1.05), '1.05')
  assert.equal(baseLabel(0), '0.0')
})

test('VoiceSlider: props range 가 입력 min/max 로, base 가 눈금 "기본"·화면 읽기 값으로 배선된다', () => {
  const axes: VoiceAxis[] = ['speed', 'pitch', 'intonation', 'styleWeight']
  for (const axis of axes) {
    const [min, max] = RANGES[axis]
    const html = renderToStaticMarkup(createElement(VoiceSlider, { id: `voice-${axis}`, axis, label: axis, value: 1, range: RANGES[axis], base: 1, note: null, onChange: () => undefined }))
    assert.match(html, new RegExp(`id="voice-${axis}"`))
    assert.match(html, new RegExp(`min="${min}"`), `${axis} min`)
    assert.match(html, new RegExp(`max="${max}"`), `${axis} max`)
    assert.match(html, /step="0.05"/)
    assert.match(html, />기본 1\.0</)
  }
  const shifted = renderToStaticMarkup(createElement(VoiceSlider, { id: 'voice-style-weight', axis: 'styleWeight', label: '말투 세기', value: 1.5, range: RANGES.styleWeight, base: 1.5, note: '안내', onChange: () => undefined }))
  assert.match(shifted, />기본 1\.5</)
  assert.match(shifted, /aria-valuetext="1\.50배, 기본"/)
  assert.match(shifted, /aria-describedby="voice-style-weight-note"/)
  assert.match(shifted, /id="voice-style-weight-note"/)
})

test('4개 축 전 칸(한 칸 0.05) 왕복: 입력 문자열 → 저장 값이 두 자리 칸 값과 같고 정본 범위(서버 검증) 안이다', () => {
  const expectedSteps: Record<VoiceAxis, number> = { styleWeight: 81, speed: 21, pitch: 15, intonation: 17 }
  let checked = 0
  for (const axis of Object.keys(expectedSteps) as VoiceAxis[]) {
    const [min, max] = RANGES[axis]
    const steps = Math.round((max - min) / VOICE_STEP)
    assert.equal(steps + 1, expectedSteps[axis], `${axis} 칸 수`)
    for (let i = 0; i <= steps; i++) {
      const exact = Math.round(min * 100 + i * 5) / 100
      // 브라우저가 돌려줄 수 있는 표기: 부동소수 누적값 그대로 · 고정 자릿수 · 짧은 표기
      for (const raw of [String(min + i * VOICE_STEP), exact.toFixed(2), String(exact)]) {
        const v = parseSliderValue(raw)
        assert.equal(v, exact, `${axis} ${raw}`)
        assert.ok(v >= min && v <= max, `${axis} ${raw} → ${v} 범위 안`)
        checked++
      }
    }
    assert.equal(parseSliderValue(String(min)), min)
    assert.equal(parseSliderValue(String(min + steps * VOICE_STEP)), max)
  }
  assert.equal(checked, (81 + 21 + 15 + 17) * 3)
})
