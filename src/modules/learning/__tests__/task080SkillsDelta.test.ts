/**
 * task-080 — DAILY `data.skills`(성장 탭 공부결과, screens.md §36-8): `growthSkillDelta` kind→축 표 · 신뢰도 0.6 경계 · 발음 교정 제외 ·
 * 채택/무시/자기수정/대화 유지 관측 제외 · `mergeSkills` 증가만·모르는 키 보존 · `mergeDaily` 칸 생성 조건. DB 0.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ObservationKind, ObservationOutcome, SkillAxis } from '@prisma/client'
import { GROWTH_SKILL_OF_KIND, growthSkillDelta, OBSERVATION_CONFIDENCE_MIN, OBSERVATION_SKILL, type GrowthSkillRow } from '../observations'
import { mergeDaily, mergeSkills } from '../snapshots'

const row = (kind: ObservationKind, outcome: ObservationOutcome, skill?: SkillAxis, confidence = 1): GrowthSkillRow => ({
  kind,
  outcome,
  skill: skill ?? OBSERVATION_SKILL[kind] ?? 'SENTENCE_PRODUCTION',
  confidence,
})
const counts = (o: Partial<Record<'success' | 'partial' | 'fail' | 'skipped' | 'uncertain' | 'fromCorrection', number>>) => ({
  success: 0,
  partial: 0,
  fail: 0,
  skipped: 0,
  uncertain: 0,
  fromCorrection: 0,
  ...o,
})

test('growthSkillDelta — 표 행마다: 단어(인식·산출)=어휘 회상, 문법=문형·조사, 말하기·표현 재사용=문장 산출, 역할극 완료=대화 유지', () => {
  assert.deepEqual(growthSkillDelta([row('VOCAB_RECOGNITION', 'SUCCESS'), row('VOCAB_RECOGNITION', 'FAIL'), row('VOCAB_RECOGNITION', 'SKIPPED'), row('VOCAB_PRODUCTION', 'SUCCESS')]), {
    VOCAB_RECALL: counts({ success: 2, fail: 1, skipped: 1 }),
  })
  assert.deepEqual(growthSkillDelta([row('GRAMMAR_USE', 'FAIL'), row('GRAMMAR_USE', 'SUCCESS')]), { GRAMMAR_PARTICLE: counts({ success: 1, fail: 1 }) })
  assert.deepEqual(growthSkillDelta([row('SENTENCE_PRODUCTION', 'PARTIAL'), row('EXPRESSION_REUSE', 'SUCCESS')]), { SENTENCE_PRODUCTION: counts({ success: 1, partial: 1 }) })
  assert.deepEqual(growthSkillDelta([row('SCENARIO_COMPLETED', 'SUCCESS'), row('SCENARIO_COMPLETED', 'PARTIAL'), row('SCENARIO_COMPLETED', 'FAIL')]), {
    CONVERSATION_MAINTAIN: counts({ success: 1, partial: 1, fail: 1 }),
  })
  assert.deepEqual(growthSkillDelta([row('LISTEN_RESPOND', 'SUCCESS')]), { LISTEN_RESPOND: counts({ success: 1 }) }, '기록 코드가 생기면 세어진다(표시는 GROWTH_AXIS_RECORDED 가 막음)')
})

test('growthSkillDelta — 교정 제안·재사용은 행의 skill(오류 유형 축): MAJOR 틀림·MINOR 일부·재사용 맞힘', () => {
  assert.deepEqual(
    growthSkillDelta([row('CORRECTION_PROPOSED', 'FAIL', 'GRAMMAR_PARTICLE'), row('CORRECTION_PROPOSED', 'PARTIAL', 'VOCAB_RECALL'), row('CORRECTION_REUSED', 'SUCCESS', 'SENTENCE_PRODUCTION')]),
    {
      GRAMMAR_PARTICLE: counts({ fail: 1, fromCorrection: 1 }),
      VOCAB_RECALL: counts({ partial: 1, fromCorrection: 1 }),
      SENTENCE_PRODUCTION: counts({ success: 1, fromCorrection: 1 }),
    },
  )
})

test('growthSkillDelta — fromCorrection(C 규칙): 교정 제안·재사용의 판정된 것만 · 불확실·넘김 제외 · 다른 kind 는 0', () => {
  assert.deepEqual(
    growthSkillDelta([
      row('CORRECTION_REUSED', 'SUCCESS', 'GRAMMAR_PARTICLE'),
      row('CORRECTION_REUSED', 'PARTIAL', 'GRAMMAR_PARTICLE'),
      row('CORRECTION_PROPOSED', 'FAIL', 'GRAMMAR_PARTICLE'),
      row('CORRECTION_PROPOSED', 'FAIL', 'GRAMMAR_PARTICLE', 0.5),
      row('CORRECTION_REUSED', 'SUCCESS', 'GRAMMAR_PARTICLE', 0.59),
      row('CORRECTION_PROPOSED', 'SKIPPED', 'GRAMMAR_PARTICLE'),
      row('GRAMMAR_USE', 'SUCCESS'),
      row('GRAMMAR_USE', 'FAIL'),
    ]),
    { GRAMMAR_PARTICLE: counts({ success: 2, partial: 1, fail: 2, skipped: 1, uncertain: 2, fromCorrection: 3 }) },
    '재사용 맞힘·일부 + 제안 틀림 = 3 · 저신뢰 2건은 uncertain 만 · 넘김은 skipped 만 · 수업 문법은 교정 유래 아님',
  )
  assert.deepEqual(growthSkillDelta([row('CORRECTION_REUSED', 'SUCCESS', 'VOCAB_RECALL')]), { VOCAB_RECALL: counts({ success: 1, fromCorrection: 1 }) }, '재사용만 있어도 교정 유래')
  assert.deepEqual(growthSkillDelta([row('VOCAB_RECOGNITION', 'FAIL'), row('SENTENCE_PRODUCTION', 'FAIL')]), {
    VOCAB_RECALL: counts({ fail: 1 }),
    SENTENCE_PRODUCTION: counts({ fail: 1 }),
  })
})

test('growthSkillDelta — 발음 교정(축 LISTEN_RESPOND)은 세지 않는다 («기록 전»이 거짓이 되지 않게)', () => {
  assert.deepEqual(growthSkillDelta([row('CORRECTION_PROPOSED', 'FAIL', 'LISTEN_RESPOND'), row('CORRECTION_REUSED', 'SUCCESS', 'LISTEN_RESPOND')]), {})
})

test('growthSkillDelta — 교정 채택·무시·자기수정·대화 유지 관측은 세지 않는다', () => {
  assert.deepEqual(
    growthSkillDelta([
      row('CORRECTION_ACCEPTED', 'SUCCESS', 'GRAMMAR_PARTICLE'),
      row('CORRECTION_IGNORED', 'SKIPPED', 'VOCAB_RECALL'),
      row('SELF_CORRECTION', 'SUCCESS'),
      row('CONVERSATION_MAINTAIN', 'SUCCESS'),
    ]),
    {},
  )
  for (const k of ['CORRECTION_ACCEPTED', 'CORRECTION_IGNORED', 'SELF_CORRECTION', 'CONVERSATION_MAINTAIN'] as const) assert.equal(GROWTH_SKILL_OF_KIND[k], undefined, k)
})

test('growthSkillDelta — 신뢰도 < 0.6 은 uncertain 만(맞힘·틀림에 안 넣음), 정확히 0.6 은 판정', () => {
  assert.equal(OBSERVATION_CONFIDENCE_MIN, 0.6)
  assert.deepEqual(growthSkillDelta([row('SENTENCE_PRODUCTION', 'FAIL', undefined, 0.59), row('SENTENCE_PRODUCTION', 'SUCCESS', undefined, 0.5)]), {
    SENTENCE_PRODUCTION: counts({ uncertain: 2 }),
  })
  assert.deepEqual(growthSkillDelta([row('SENTENCE_PRODUCTION', 'FAIL', undefined, 0.6)]), { SENTENCE_PRODUCTION: counts({ fail: 1 }) })
  // 판정 못 한 역할극 끝냄(신뢰도 0.5) → 대화 유지 불확실
  assert.deepEqual(growthSkillDelta([row('SCENARIO_COMPLETED', 'PARTIAL', undefined, 0.5)]), { CONVERSATION_MAINTAIN: counts({ uncertain: 1 }) })
  // 신뢰도 칸이 없으면 컬럼 기본값 1
  assert.deepEqual(growthSkillDelta([{ kind: 'GRAMMAR_USE', outcome: 'SUCCESS', skill: 'GRAMMAR_PARTICLE' }]), { GRAMMAR_PARTICLE: counts({ success: 1 }) })
  assert.deepEqual(growthSkillDelta([]), {})
})

test('mergeSkills — 증가만(음수 무시), 모르는 축·모르는 칸 보존', () => {
  const cur = { VOCAB_RECALL: { success: 3, partial: 0, fail: 1, skipped: 0, uncertain: 0, extra: 'x' }, FUTURE_AXIS: { success: 9 } }
  const out = mergeSkills(cur, { VOCAB_RECALL: { success: 2, fail: -5 }, GRAMMAR_PARTICLE: { partial: 1 } })
  assert.deepEqual(out.VOCAB_RECALL, { success: 5, partial: 0, fail: 1, skipped: 0, uncertain: 0, fromCorrection: 0, extra: 'x' }, '옛 칸(fromCorrection 없음) → 0')
  assert.deepEqual(out.GRAMMAR_PARTICLE, counts({ partial: 1 }))
  assert.deepEqual(out.FUTURE_AXIS, counts({ success: 9 }))
  assert.deepEqual(mergeSkills(undefined, {}), {})
  assert.deepEqual(mergeSkills('깨진 값', { VOCAB_RECALL: { uncertain: 1 } }), { VOCAB_RECALL: counts({ uncertain: 1 }) })
})

test('mergeSkills — fromCorrection 은 증가만: 더하기 · 증가분에 없으면 그대로 · 음수 무시 · 옛 칸은 0 에서 시작', () => {
  const cur = { GRAMMAR_PARTICLE: counts({ fail: 4, fromCorrection: 3 }) }
  assert.equal(mergeSkills(cur, { GRAMMAR_PARTICLE: { fail: 2, fromCorrection: 2 } }).GRAMMAR_PARTICLE.fromCorrection, 5)
  assert.equal(mergeSkills(cur, { GRAMMAR_PARTICLE: { fail: 1 } }).GRAMMAR_PARTICLE.fromCorrection, 3, '덮어쓰지 않는다')
  assert.equal(mergeSkills(cur, { GRAMMAR_PARTICLE: { fromCorrection: -3 } }).GRAMMAR_PARTICLE.fromCorrection, 3)
  assert.equal(mergeSkills(cur, { VOCAB_RECALL: { success: 1 } }).GRAMMAR_PARTICLE.fromCorrection, 3, '다른 축 증가에도 보존')
  const legacy = { GRAMMAR_PARTICLE: { success: 1, partial: 0, fail: 5, skipped: 0, uncertain: 0 } }
  assert.equal(mergeSkills(legacy, { GRAMMAR_PARTICLE: { fail: 1, fromCorrection: 1 } }).GRAMMAR_PARTICLE.fromCorrection, 1)
  // 실시간 쓰기 경로 그대로: growthSkillDelta → mergeDaily 두 번
  const d1 = mergeDaily({}, { skills: growthSkillDelta([row('CORRECTION_PROPOSED', 'FAIL', 'GRAMMAR_PARTICLE')]) })
  const d2 = mergeDaily(d1, { skills: growthSkillDelta([row('CORRECTION_REUSED', 'SUCCESS', 'GRAMMAR_PARTICLE'), row('GRAMMAR_USE', 'SUCCESS')]) })
  assert.deepEqual((d2.skills as Record<string, unknown>).GRAMMAR_PARTICLE, counts({ success: 2, fail: 1, fromCorrection: 2 }))
})

test('mergeDaily — skills 칸: 셀 관측이 없으면 만들지 않고, 있으면 더하며, 다른 증가(skills 없음)에도 기존 칸을 보존한다', () => {
  const noSkill = mergeDaily({}, { corrections: { accepted: 1 }, skills: {} })
  assert.equal('skills' in noSkill, false, '빈 증가분은 칸을 만들지 않는다')
  const once = mergeDaily({}, { skills: { VOCAB_RECALL: { success: 1 } } })
  assert.deepEqual(once.skills, { VOCAB_RECALL: counts({ success: 1 }) })
  const twice = mergeDaily(once, { skills: { VOCAB_RECALL: { success: 1, fail: 1 } } })
  assert.deepEqual(twice.skills, { VOCAB_RECALL: counts({ success: 2, fail: 1 }) })
  const other = mergeDaily(twice, { lessons: 1 })
  assert.deepEqual(other.skills, twice.skills, 'skills 없는 증가에도 칸 보존')
  assert.equal(other.lessons, 1)
  // 옛 코드 롤백 안전: skills 를 모르는 병합(= delta 에 skills 없음)도 `...c` 로 칸을 남긴다
  const legacyLike = mergeDaily({ ...twice }, {})
  assert.deepEqual(legacyLike.skills, twice.skills)
})
