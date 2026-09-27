import { test } from 'node:test'
import assert from 'node:assert/strict'
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

test('음성 draft: 범위(속도 0.6~1.2·높낮이·억양 0.8~1.2·styleWeight 0~2)와 speechProfile', () => {
  const base = { voiceProfileId: 'teacher_haruka', style: 'AUTO', speed: 0.9, pitch: 1, intonation: 1.1, speechProfile: 'NATIVE' }
  assert.equal(parseVoiceDraft(base, { requireSpeechProfile: true }).styleWeight, null)
  assert.match(code(() => parseVoiceDraft({ ...base, speed: 1.3 }, { requireSpeechProfile: true })), /^VALIDATION/)
  assert.match(code(() => parseVoiceDraft({ ...base, pitch: 0.7 }, { requireSpeechProfile: true })), /^VALIDATION/)
  assert.match(code(() => parseVoiceDraft({ ...base, styleWeight: 2.5 }, { requireSpeechProfile: true })), /^VALIDATION/)
  assert.match(code(() => parseVoiceDraft({ ...base, speechProfile: 'LEARNING' }, { requireSpeechProfile: true })), /^VALIDATION/)
  assert.match(code(() => parseVoiceDraft({ ...base, model_id: 'x' }, { requireSpeechProfile: true })), /^VALIDATION:unknown_key/)
  const noProfile: Record<string, unknown> = { ...base }
  delete noProfile.speechProfile
  assert.equal(parseVoiceDraft(noProfile, { requireSpeechProfile: false }).speechProfile, 'NATIVE')
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
