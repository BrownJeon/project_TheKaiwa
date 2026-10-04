import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyError } from '@/modules/infra'
import { parseProfilePatch, parseSpeechPatch, parseVoiceDraft } from '../validate'

const code = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return (e as { code?: string; details?: { reason?: string } }).code + ':' + ((e as { details?: { reason?: string } }).details?.reason ?? '')
  }
  return 'OK'
}

test('프로필: 화이트리스트 밖 키(음성·엔진)는 400', () => {
  assert.match(code(() => parseProfilePatch({ speed: 1 })), /^VALIDATION:unknown_key/)
  assert.match(code(() => parseProfilePatch({ tutorModel: 'OPUS' })), /^VALIDATION:unknown_key/)
})

test('프로필: 범위·형식 검증과 빈 이름 → null(선생님 기본값)', () => {
  assert.deepEqual(parseProfilePatch({ teacherName: '  ', level: 'N4' }), { teacherName: null, level: 'N4' })
  assert.match(code(() => parseProfilePatch({ dailyWordCount: 31 })), /^VALIDATION/)
  assert.match(code(() => parseProfilePatch({ dailyMinutes: 10.5 })), /^VALIDATION/)
  assert.match(code(() => parseProfilePatch({ teacherName: 'x'.repeat(31) })), /^VALIDATION/)
  assert.match(code(() => parseProfilePatch({ goalDeadline: '2026-13-01' })), /^VALIDATION/)
  assert.equal(parseProfilePatch({ goalDeadline: '2026-12-31' }).goalDeadline?.toISOString(), '2026-12-31T00:00:00.000Z')
})

test('프로필 표시 스위치(task-026): 3칸 불리언만, 보낸 키만 바뀐다', () => {
  assert.deepEqual(parseProfilePatch({ showFurigana: false }), { showFurigana: false })
  assert.deepEqual(parseProfilePatch({ showFurigana: true, showHangul: false, showTranslation: true }), { showFurigana: true, showHangul: false, showTranslation: true })
  assert.deepEqual(parseProfilePatch({ level: 'N3', showTranslation: false }), { level: 'N3', showTranslation: false })
  for (const k of ['showFurigana', 'showHangul', 'showTranslation']) {
    for (const v of ['true', 'false', 1, 0, null, undefined, {}, []]) {
      assert.equal(code(() => parseProfilePatch({ [k]: v })), 'VALIDATION:boolean', `${k}=${JSON.stringify(v)}`)
    }
  }
  // 화이트리스트 밖 표시 키(옛 localStorage 이름·화면별 값)는 받지 않는다 — 스위치는 앱 전체 하나.
  assert.match(code(() => parseProfilePatch({ readingDefault: 'off' })), /^VALIDATION:unknown_key/)
  assert.match(code(() => parseProfilePatch({ showReading: false })), /^VALIDATION:unknown_key/)
})

test('음성 draft: 범위(task-022 — 속도 0.5~1.5·높낮이 0.7~1.4·억양 0.6~1.4·styleWeight 0~4)와 speechProfile', () => {
  const base = { voiceProfileId: 'teacher_haruka', style: 'AUTO', speed: 0.9, pitch: 1, intonation: 1.1, speechProfile: 'NATIVE' }
  const opts = { requireSpeechProfile: true }
  assert.equal(parseVoiceDraft(base, opts).styleWeight, null)
  // 양 끝값은 통과(값 그대로)
  const lo = parseVoiceDraft({ ...base, speed: 0.5, pitch: 0.7, intonation: 0.6, styleWeight: 0 }, opts)
  assert.deepEqual([lo.speed, lo.pitch, lo.intonation, lo.styleWeight], [0.5, 0.7, 0.6, 0])
  const hi = parseVoiceDraft({ ...base, speed: 1.5, pitch: 1.4, intonation: 1.4, styleWeight: 4 }, opts)
  assert.deepEqual([hi.speed, hi.pitch, hi.intonation, hi.styleWeight], [1.5, 1.4, 1.4, 4])
  // 끝값 바로 밖은 400 VALIDATION(422 아님), reason 은 정본 범위 문자열
  const outside: [string, number, string][] = [
    ['speed', 0.49, '0.5~1.5'], ['speed', 1.51, '0.5~1.5'],
    ['pitch', 0.69, '0.7~1.4'], ['pitch', 1.41, '0.7~1.4'],
    ['intonation', 0.59, '0.6~1.4'], ['intonation', 1.41, '0.6~1.4'],
    ['styleWeight', -0.01, '0~4'], ['styleWeight', 4.01, '0~4'],
  ]
  for (const [field, v, reason] of outside) assert.equal(code(() => parseVoiceDraft({ ...base, [field]: v }, opts)), `VALIDATION:${reason}`, `${field}=${v}`)
  assert.throws(() => parseVoiceDraft({ ...base, speed: 1.6 }, opts), (e: unknown) => classifyError(e).status === 400 && classifyError(e).code === 'VALIDATION')
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, '1.0', null]) assert.match(code(() => parseVoiceDraft({ ...base, speed: bad }, opts)), /^VALIDATION/, `speed=${String(bad)}`)
  assert.match(code(() => parseVoiceDraft({ ...base, speechProfile: 'LEARNING' }, opts)), /^VALIDATION/)
  assert.match(code(() => parseVoiceDraft({ ...base, model_id: 'x' }, opts)), /^VALIDATION:unknown_key/)
  const noProfile: Record<string, unknown> = { ...base }
  delete noProfile.speechProfile
  assert.equal(parseVoiceDraft(noProfile, { requireSpeechProfile: false }).speechProfile, 'NATIVE')
})

test('음성 draft(task-022 회귀): 옛 범위(속도 0.6~1.2·높낮이·억양 0.8~1.2·styleWeight 0~2) 안 저장값은 그대로 유효', () => {
  const base = { voiceProfileId: 'teacher_haruka', style: 'AUTO', speechProfile: 'NATIVE' }
  const olds = [
    { speed: 0.6, pitch: 0.8, intonation: 0.8, styleWeight: 0 },
    { speed: 1.2, pitch: 1.2, intonation: 1.2, styleWeight: 2 },
    { speed: 0.85, pitch: 1.05, intonation: 0.95, styleWeight: 1.5 },
  ]
  for (const o of olds) {
    const d = parseVoiceDraft({ ...base, ...o }, { requireSpeechProfile: true })
    assert.deepEqual({ speed: d.speed, pitch: d.pitch, intonation: d.intonation, styleWeight: d.styleWeight }, o)
  }
})

test('음성 draft(task-007 Codex C2-1): 저장·미리듣기 프로필은 설정 화면 3종만 — PRONUNCIATION·SHADOWING 은 화면이 요청 단위로', () => {
  const base = { voiceProfileId: 'teacher_haruka', style: 'AUTO', speed: 0.9, pitch: 1, intonation: 1.1 }
  for (const p of ['NATIVE', 'LEARNING_NORMAL', 'LEARNING_SLOW']) assert.equal(parseVoiceDraft({ ...base, speechProfile: p }, { requireSpeechProfile: true }).speechProfile, p)
  for (const p of ['PRONUNCIATION', 'SHADOWING']) {
    assert.match(code(() => parseVoiceDraft({ ...base, speechProfile: p }, { requireSpeechProfile: true })), /^VALIDATION/, `PUT ${p}`)
    assert.match(code(() => parseVoiceDraft({ ...base, speechProfile: p }, { requireSpeechProfile: false })), /^VALIDATION/, `미리듣기 ${p}`)
  }
})

test('인식 모드: 웹에서 OFFLINE 은 400, 앱은 허용', () => {
  assert.match(code(() => parseSpeechPatch({ recognitionMode: 'OFFLINE', explainLang: 'ko' }, 'web')), /^VALIDATION:offline_web/)
  assert.deepEqual(parseSpeechPatch({ recognitionMode: 'OFFLINE', explainLang: 'ko' }, 'app'), { recognitionMode: 'OFFLINE', explainLang: 'ko' })
  assert.match(code(() => parseSpeechPatch({ recognitionMode: 'AUTO' }, 'app')), /^VALIDATION:required/, 'PUT 은 전체 치환')
  assert.equal(parseProfilePatch({ goalTopics: null }).goalTopics, null)
})
