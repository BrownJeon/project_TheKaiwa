import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findLexiconMatches, lexiconDigest, selectEntries, snapshotHash, validateLexiconEntry, type LexiconEntryData } from '../tts/lexicon'
import { resolveTtsParameters } from '../tts/parameterResolver'
import { buildRenderingPlan, effectiveParams, prepareSegments } from '../tts/renderingPlan'
import { moraCount } from '../tts/text'
import type { ResolvedBase } from '../tts/types'

const E = (o: Partial<LexiconEntryData> & Pick<LexiconEntryData, 'surface' | 'reading'>): LexiconEntryData => ({ accentType: 0, priority: 10, scope: 'GLOBAL', scopeRefId: null, wordType: null, enabled: true, ...o })

test('사전 L-4 검증: 가타카나·長音만, 악센트 ≤ 모라 수, 범위 id 규칙', () => {
  assert.deepEqual(validateLexiconEntry(E({ surface: '日本橋', reading: 'ニホンバシ', accentType: 3 })), [])
  assert.deepEqual(validateLexiconEntry(E({ surface: '日本橋', reading: 'にほんばし' })), ['E_READING'])
  assert.deepEqual(validateLexiconEntry(E({ surface: '東京', reading: 'トーキョー', accentType: 5 })), ['E_ACCENT'])
  assert.deepEqual(validateLexiconEntry(E({ surface: 'x', reading: 'エックス', scope: 'USER', scopeRefId: null })), ['E_SCOPE_REF'])
  assert.deepEqual(validateLexiconEntry(E({ surface: 'x', reading: 'エックス', scopeRefId: 'u1' })), ['E_SCOPE_REF'])
  assert.equal(moraCount('キョート'), 3)
  assert.equal(moraCount('ガッコー'), 4)
})

test('범위 우선순위 USER > VOICE > LESSON > COURSE > GLOBAL, 비활성·다른 대상 제외(L-1·L-3)', () => {
  const entries = [
    E({ surface: '春', reading: 'ハル' }),
    E({ surface: '春', reading: 'シュン', scope: 'VOICE', scopeRefId: 'v1' }),
    E({ surface: '春', reading: 'ハルカ', scope: 'USER', scopeRefId: 'u1' }),
    E({ surface: '春', reading: 'ハルー', scope: 'USER', scopeRefId: 'u2' }),
    E({ surface: '秋', reading: 'アキ', enabled: false }),
  ]
  assert.equal(selectEntries(entries, { userId: 'u1', voiceId: 'v1' }).get('春')?.reading, 'ハルカ')
  assert.equal(selectEntries(entries, { userId: 'u9', voiceId: 'v1' }).get('春')?.reading, 'シュン')
  assert.equal(selectEntries(entries, { userId: 'u9', voiceId: 'v9' }).get('春')?.reading, 'ハル')
  assert.equal(selectEntries(entries, {}).has('秋'), false)
})

test('최장 일치 우선, 같은 길이는 priority 큰 쪽(L-2) — 매칭 구간은 정규화에서 보호된다', () => {
  const sel = selectEntries([E({ surface: '日本橋', reading: 'ニホンバシ' }), E({ surface: '日本橋駅', reading: 'ニホンバシエキ' }), E({ surface: '日本', reading: 'ニッポン' })], {})
  const m = findLexiconMatches('日本橋駅と日本橋と日本', sel)
  assert.deepEqual(
    m.map((x) => [x.surface, x.reading]),
    [
      ['日本橋駅', 'ニホンバシエキ'],
      ['日本橋', 'ニホンバシ'],
      ['日本', 'ニッポン'],
    ],
  )
  const [seg] = prepareSegments('JR1番線', { lexicon: selectEntries([E({ surface: 'JR1番線', reading: 'ジェイアールイチバンセン' })], {}), maxChars: 100, single: true })
  assert.equal(seg.normalizedText, 'JR1番線')
  assert.equal(seg.hints.length, 1)
})

test('사전 요약 해시·스냅샷 해시는 순서와 무관하고 내용이 바뀌면 달라진다', () => {
  const a = { surface: '春', reading: 'ハル', accentType: 1, wordType: null }
  const b = { surface: '秋', reading: 'アキ', accentType: 1, wordType: null }
  assert.equal(lexiconDigest([]), null)
  assert.equal(lexiconDigest([a, b]), lexiconDigest([b, a]))
  assert.notEqual(lexiconDigest([a]), lexiconDigest([{ ...a, reading: 'シュン' }]))
  const s1 = snapshotHash([E({ surface: '春', reading: 'ハル' }), E({ surface: '秋', reading: 'アキ' })])
  assert.equal(s1, snapshotHash([E({ surface: '秋', reading: 'アキ' }), E({ surface: '春', reading: 'ハル' })]))
  assert.notEqual(s1, snapshotHash([E({ surface: '春', reading: 'ハル' }), E({ surface: '秋', reading: 'アキ', enabled: false })]))
})

const STYLES = [
  { name: 'Neutral', styleWeightDefault: 1 },
  { name: 'Happy', styleWeightDefault: 1.2 },
]

test('Resolver: User(AUTO·null 제외) > VoiceProfile > Persona > Context > LLM > DEFAULT', () => {
  const r = resolveTtsParameters({ user: { style: 'AUTO', styleWeight: null, speed: 0.8, pitch: 1.1, intonation: 1 }, voiceDefaults: { style: 'Neutral', styleWeight: 0.9, speed: 0.9 }, voiceStyles: STYLES })
  assert.equal(r.style, 'Neutral')
  assert.equal(r.sourceByKey.style, 'VOICE_PROFILE')
  assert.equal(r.speed, 0.8)
  assert.equal(r.sourceByKey.speed, 'USER_SETTING')
  assert.equal(r.styleWeight, 0.9)
  const u = resolveTtsParameters({ user: { style: 'Happy', styleWeight: 1.5, speed: 1, pitch: 1, intonation: 1 }, voiceDefaults: { style: 'Neutral' }, voiceStyles: STYLES, llmStyle: 'CALM' })
  assert.equal(u.style, 'Happy')
  assert.equal(u.sourceByKey.style, 'USER_SETTING')
  // 없는 스타일 이름은 그 층을 건너뛴다(엔진·다른 voice 스타일 주입 차단)
  const x = resolveTtsParameters({ user: { style: 'Angry', styleWeight: null, speed: 1, pitch: 1, intonation: 1 }, voiceDefaults: {}, voiceStyles: STYLES, llmStyle: 'ENCOURAGING' })
  assert.equal(x.style, 'Happy')
  assert.equal(x.sourceByKey.style, 'LLM')
  assert.equal(x.styleWeight, 1.2)
  const d = resolveTtsParameters({ user: null, voiceDefaults: null, voiceStyles: [] })
  assert.deepEqual([d.style, d.speed, d.pitch, d.intonation, d.styleWeight], ['Neutral', 1, 1, 1, 1])
})

const BASE: ResolvedBase = { style: 'Neutral', styleWeight: 1, speed: 1, pitch: 1, intonation: 1, sourceByKey: { style: 'VOICE_PROFILE', styleWeight: 'VOICE_PROFILE', speed: 'USER_SETTING', pitch: 'USER_SETTING', intonation: 'USER_SETTING' } }
const VOICE = ['Neutral', 'Happy']

test('§4.3 배율: ENCOURAGING → styleWeight 0.8·intonation 1.1, 사용자 1.5 면 1.2', () => {
  const e = effectiveParams({ base: BASE, label: 'ENCOURAGING', speedLabel: null, profile: 'NATIVE', learningSpeed: 0.8, voiceStyles: VOICE })
  assert.deepEqual(e, { style: 'Happy', styleWeight: 0.8, speed: 1, pitch: 1, intonation: 1.1 })
  const u = effectiveParams({ base: { ...BASE, styleWeight: 1.5 }, label: 'ENCOURAGING', speedLabel: null, profile: 'NATIVE', learningSpeed: 0.8, voiceStyles: VOICE })
  assert.equal(u.styleWeight, 1.2)
  const em = effectiveParams({ base: { ...BASE, intonation: 1.1 }, label: 'EMPHASIS', speedLabel: null, profile: 'NATIVE', learningSpeed: 0.8, voiceStyles: VOICE })
  assert.equal(em.intonation, 1.2) // 1.1×1.15 → clamp 1.2
  assert.equal(effectiveParams({ base: BASE, label: null, speedLabel: 'SLOW', profile: 'NATIVE', learningSpeed: 0.8, voiceStyles: VOICE }).speed, 0.8)
  assert.equal(effectiveParams({ base: BASE, label: null, speedLabel: 'VERY_SLOW', profile: 'NATIVE', learningSpeed: 0.8, voiceStyles: VOICE }).speed, 0.6)
})

test('SpeechProfile 5종: LEARNING_SLOW 는 느려지고 PRONUNCIATION 은 억양 고정·LLM 라벨 무시', () => {
  const sp = (profile: Parameters<typeof effectiveParams>[0]['profile'], label: Parameters<typeof effectiveParams>[0]['label'] = null) =>
    effectiveParams({ base: { ...BASE, intonation: 1.05 }, label, speedLabel: null, profile, learningSpeed: 0.8, voiceStyles: VOICE })
  assert.equal(sp('NATIVE').speed, 1)
  assert.equal(sp('LEARNING_NORMAL').speed, 1)
  assert.ok(sp('LEARNING_SLOW', 'EXPLANATION').speed < 1)
  assert.equal(sp('SHADOWING').speed, 0.9)
  assert.equal(sp('PRONUNCIATION', 'ENCOURAGING').intonation, 1.05)
  const plan = buildRenderingPlan({ voiceId: 'v', speechProfile: 'PRONUNCIATION', base: BASE, segments: [{ text: 'a', normalizedText: 'a', hints: [], rulesApplied: 0 }], voiceStyles: VOICE, learningSpeed: 0.8, llmStyle: 'ENCOURAGING' })
  assert.equal(plan.segments[0].style, 'EXPLANATION')
  const slow = buildRenderingPlan({ voiceId: 'v', speechProfile: 'LEARNING_SLOW', base: BASE, segments: [{ text: 'a', normalizedText: 'a', hints: [], rulesApplied: 0 }], voiceStyles: VOICE, learningSpeed: 0.6, llmStyle: null })
  assert.equal(slow.segments[0].effective.speed, 0.6) // 1×0.6×0.9 → 하한 0.6
  const native = buildRenderingPlan({ voiceId: 'v', speechProfile: 'NATIVE', base: BASE, segments: [{ text: 'a', normalizedText: 'a', hints: [], rulesApplied: 0 }], voiceStyles: VOICE, learningSpeed: 0.8, llmStyle: 'CHEERFUL' })
  assert.equal(native.segments[0].style, 'FRIENDLY')
  assert.equal(native.segments[0].effective.style, 'Happy')
})

test('요청 라벨은 LLM 라벨보다 우선하고, 스타일 매핑은 AppSetting tts.styleMap 이 덮는다', () => {
  const plan = buildRenderingPlan({
    voiceId: 'v',
    speechProfile: 'NATIVE',
    base: BASE,
    segments: [{ text: 'a', normalizedText: 'a', hints: [], rulesApplied: 0 }],
    voiceStyles: VOICE,
    learningSpeed: 0.8,
    llmStyle: 'ENCOURAGING',
    requested: [{ style: 'EMPHASIS', pauseBeforeMs: 50 }],
    styleMap: { EMPHASIS: ['Happy'] },
  })
  assert.equal(plan.segments[0].style, 'EMPHASIS')
  assert.equal(plan.segments[0].pauseBeforeMs, 150)
  assert.equal(effectiveParams({ base: BASE, label: 'CALM', speedLabel: null, profile: 'NATIVE', learningSpeed: 0.8, voiceStyles: VOICE, styleMap: { CALM: ['Happy'] } }).style, 'Happy')
  // 매핑 후보가 voice 에 없으면 base 스타일
  assert.equal(effectiveParams({ base: BASE, label: 'FRIENDLY', speedLabel: null, profile: 'NATIVE', learningSpeed: 0.8, voiceStyles: ['Neutral'] }).style, 'Neutral')
})

test('시드 사전: 항목이 L-4 검증을 통과하고, 시드 스냅샷 해시가 앱 규칙과 같다', async () => {
  const { readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { lexiconSnapshotHash, toSnapshot } = await import('../../../../prisma/seed-lexicon')
  const seed = JSON.parse(readFileSync(join(__dirname, '../../../../prisma/seed-data/lexicon.json'), 'utf8')) as { entries: Parameters<typeof toSnapshot>[0] }
  assert.ok(seed.entries.length >= 5)
  const rows = toSnapshot(seed.entries)
  for (const r of rows) assert.deepEqual(validateLexiconEntry(r), [], r.surface)
  assert.equal(lexiconSnapshotHash(rows), snapshotHash(rows))
  assert.equal(new Set(rows.map((r) => r.surface)).size, rows.length)
})
