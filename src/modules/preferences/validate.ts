/**
 * 설정 입력 검증 — 화이트리스트 밖 키·범위 밖 값은 전부 `400 VALIDATION`(api-contract #12·#14·#16).
 * 순수 함수라 단위 테스트로 경계를 고정한다. Voice 존재·스타일 이름 검사는 speech 층 소관이라 라우트가 조합한다.
 */
import { ApiError } from '@/modules/infra'
import { VOICE_PARAM_RANGES, type VoiceParamRangeKey } from './voiceRanges'

export const PROFILE_KEYS = [
  'displayName', 'teacherName', 'level', 'politeness', 'goalLevel', 'goalTopics', 'goalDeadline',
  'dailyWordCount', 'dailyMinutes', 'strictness', 'correctionMode', 'explainLang', 'explainDepth',
  'showFurigana', 'showHangul', 'showTranslation',
] as const
/** 일본어 표시 스위치(task-026) — 앱 전체 하나. 불리언만 받는다(문자열 'true'·0/1·null 은 400). */
export const DISPLAY_KEYS = ['showFurigana', 'showHangul', 'showTranslation'] as const
export const VOICE_KEYS = ['voiceProfileId', 'style', 'styleWeight', 'speed', 'pitch', 'intonation', 'speechProfile'] as const
export const SPEECH_KEYS = ['recognitionMode', 'explainLang'] as const

export const JLPT = ['N5', 'N4', 'N3', 'N2', 'N1'] as const
export const SPEECH_PROFILES = ['NATIVE', 'LEARNING_NORMAL', 'LEARNING_SLOW', 'PRONUNCIATION', 'SHADOWING'] as const
/**
 * #14 저장·#18 미리듣기 draft 로 받는 프로필 — 설정 화면 선택지 3종만(Codex task-007 C2-1). PRONUNCIATION·SHADOWING 은 화면이
 * 요청 단위로 지정한다(#23 `speechProfile`, 정본 speech-platform/13 §3·16 §5). 2026-09-28 운영 DB 저장 행은 NATIVE·LEARNING_SLOW 뿐이라
 * 이 제한으로 깨지는 기존 행은 없다(설정 화면·회화방 메뉴도 3종만 보낸다).
 */
export const USER_SPEECH_PROFILES = ['NATIVE', 'LEARNING_NORMAL', 'LEARNING_SLOW'] as const
export const RECOGNITION_MODES = ['AUTO', 'FAST', 'ACCURATE', 'OFFLINE'] as const
/**
 * 교정 방식(task-010c, learning-personalization §2-7·§2-8) — 회화(TALK)에서 교정을 **언제** 보여 줄지. 무엇을 오류로 볼지는
 * `strictness` 라 서로 독립이다. 기본 FLUENCY(결정 D6). 역할극은 이 값과 무관하게 코치(conversation `resolveTalkCorrectionMode`).
 */
export const CORRECTION_MODE_VALUES = ['FLUENCY', 'COACH'] as const

const bad = (field: string, reason: string, message: string): never => {
  throw new ApiError('VALIDATION', message, { field, reason })
}

function onlyKeys(body: Record<string, unknown>, allowed: readonly string[]): void {
  const extra = Object.keys(body).filter((k) => !allowed.includes(k))
  if (extra.length) bad(extra[0], 'unknown_key', `설정할 수 없는 항목입니다: ${extra.join(', ')}`)
}

function str(v: unknown, field: string, max: number, opts: { nullable?: boolean; min?: number } = {}): string | null {
  if (v === null && opts.nullable) return null
  if (typeof v !== 'string') return bad(field, 'string', `${field} 형식이 올바르지 않습니다.`)
  const t = v.trim()
  if (t.length < (opts.min ?? 0) || t.length > max) return bad(field, `length ${opts.min ?? 0}~${max}`, `${field} 은(는) ${max}자 이내여야 합니다.`)
  if (opts.nullable && t.length === 0) return null
  return t
}

function oneOf<T extends string>(v: unknown, field: string, values: readonly T[], nullable = false): T | null {
  if (v === null && nullable) return null
  if (typeof v !== 'string' || !(values as readonly string[]).includes(v)) return bad(field, values.join('|'), `${field} 값이 올바르지 않습니다.`)
  return v as T
}

function num(v: unknown, field: string, min: number, max: number, opts: { int?: boolean; nullable?: boolean } = {}): number | null {
  if (v === null && opts.nullable) return null
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (opts.int && !Number.isInteger(v))) {
    return bad(field, `${min}~${max}`, `${field} 은(는) ${min}~${max} 사이여야 합니다.`)
  }
  return v
}

function bool(v: unknown, field: string): boolean {
  if (typeof v !== 'boolean') return bad(field, 'boolean', `${field} 은(는) true/false 여야 합니다.`)
  return v
}

function voiceNum(v: unknown, key: VoiceParamRangeKey, opts: { nullable?: boolean } = {}): number | null {
  const [min, max] = VOICE_PARAM_RANGES[key]
  return num(v, key, min, max, opts)
}

export type ProfilePatch = Partial<{
  displayName: string | null
  teacherName: string | null
  level: (typeof JLPT)[number]
  politeness: 'POLITE' | 'CASUAL'
  goalLevel: (typeof JLPT)[number] | null
  goalTopics: string[] | null
  goalDeadline: Date | null
  dailyWordCount: number
  dailyMinutes: number
  strictness: 'GENTLE' | 'NORMAL' | 'STRICT'
  correctionMode: (typeof CORRECTION_MODE_VALUES)[number]
  explainLang: 'ko' | 'ja' | 'en'
  explainDepth: 'BRIEF' | 'NORMAL' | 'DETAILED'
  showFurigana: boolean
  showHangul: boolean
  showTranslation: boolean
}>

export function parseProfilePatch(body: Record<string, unknown>): ProfilePatch {
  onlyKeys(body, PROFILE_KEYS)
  const out: ProfilePatch = {}
  if ('displayName' in body) out.displayName = str(body.displayName, 'displayName', 40, { nullable: true })
  if ('teacherName' in body) out.teacherName = str(body.teacherName, 'teacherName', 30, { nullable: true })
  if ('level' in body) out.level = oneOf(body.level, 'level', JLPT)!
  if ('politeness' in body) out.politeness = oneOf(body.politeness, 'politeness', ['POLITE', 'CASUAL'] as const)!
  if ('goalLevel' in body) out.goalLevel = oneOf(body.goalLevel, 'goalLevel', JLPT, true)
  if ('goalTopics' in body) {
    const v = body.goalTopics
    if (v === null) out.goalTopics = null
    else if (!Array.isArray(v) || v.length > 10) bad('goalTopics', 'array ≤10', '목표 주제는 10개 이하로 골라 주세요.')
    else out.goalTopics = v.map((x, i) => str(x, `goalTopics[${i}]`, 40, { min: 1 })!)
  }
  if ('goalDeadline' in body) {
    const v = body.goalDeadline
    if (v === null) out.goalDeadline = null
    else if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) bad('goalDeadline', 'YYYY-MM-DD', '목표 날짜 형식이 올바르지 않습니다.')
    else out.goalDeadline = new Date(`${v}T00:00:00Z`)
  }
  if ('dailyWordCount' in body) out.dailyWordCount = num(body.dailyWordCount, 'dailyWordCount', 5, 30, { int: true })!
  if ('dailyMinutes' in body) out.dailyMinutes = num(body.dailyMinutes, 'dailyMinutes', 5, 120, { int: true })!
  if ('strictness' in body) out.strictness = oneOf(body.strictness, 'strictness', ['GENTLE', 'NORMAL', 'STRICT'] as const)!
  if ('correctionMode' in body) out.correctionMode = oneOf(body.correctionMode, 'correctionMode', CORRECTION_MODE_VALUES)!
  if ('explainLang' in body) out.explainLang = oneOf(body.explainLang, 'explainLang', ['ko', 'ja', 'en'] as const)!
  if ('explainDepth' in body) out.explainDepth = oneOf(body.explainDepth, 'explainDepth', ['BRIEF', 'NORMAL', 'DETAILED'] as const)!
  for (const k of DISPLAY_KEYS) if (k in body) out[k] = bool(body[k], k)
  return out
}

export interface VoiceDraft {
  voiceProfileId: string
  style: string
  styleWeight: number | null
  speed: number
  pitch: number
  intonation: number
  speechProfile: (typeof SPEECH_PROFILES)[number]
}

/** #14 PUT 본문(전체) 과 #18 미리듣기 draft(speechProfile 선택) 공용. */
export function parseVoiceDraft(body: Record<string, unknown>, opts: { requireSpeechProfile: boolean }): VoiceDraft {
  onlyKeys(body, VOICE_KEYS)
  return {
    voiceProfileId: str(body.voiceProfileId, 'voiceProfileId', 80, { min: 1 })!,
    style: str(body.style ?? 'AUTO', 'style', 40, { min: 1 })!,
    styleWeight: voiceNum(body.styleWeight ?? null, 'styleWeight', { nullable: true }),
    speed: voiceNum(body.speed, 'speed')!,
    pitch: voiceNum(body.pitch, 'pitch')!,
    intonation: voiceNum(body.intonation, 'intonation')!,
    speechProfile: opts.requireSpeechProfile || 'speechProfile' in body ? oneOf(body.speechProfile, 'speechProfile', USER_SPEECH_PROFILES)! : 'NATIVE',
  }
}

export function parseSpeechPatch(body: Record<string, unknown>, platform: 'web' | 'app'): { recognitionMode?: (typeof RECOGNITION_MODES)[number]; explainLang?: 'ko' | 'ja' | 'en' } {
  onlyKeys(body, SPEECH_KEYS)
  // PUT 은 전체 치환이다(speech-platform/13 §3.6, REV-006 M6) — 두 필드 모두 필수.
  for (const k of SPEECH_KEYS) if (!(k in body)) bad(k, 'required', `${k} 가 필요합니다.`)
  const out: { recognitionMode?: (typeof RECOGNITION_MODES)[number]; explainLang?: 'ko' | 'ja' | 'en' } = {}
  if ('recognitionMode' in body) {
    out.recognitionMode = oneOf(body.recognitionMode, 'recognitionMode', RECOGNITION_MODES)!
    if (out.recognitionMode === 'OFFLINE' && platform === 'web') bad('recognitionMode', 'offline_web', '오프라인 인식은 앱에서만 쓸 수 있어요.')
  }
  if ('explainLang' in body) out.explainLang = oneOf(body.explainLang, 'explainLang', ['ko', 'ja', 'en'] as const)!
  return out
}
