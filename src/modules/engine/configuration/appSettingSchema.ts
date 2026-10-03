/**
 * AppSetting 키 정의(configuration-resolution §13 #11 `appSettingSchema`, api-contract #123b) — 콘솔이 아는 키만 다룬다(모르는 키 404).
 * 한 AppSetting 행 = 한 설정 대상(targetId = 키)이고 편집 키는 `value` 하나다.
 *
 * - 일반 키(012c 편집): 미리듣기 문장(→ 같은 트랜잭션에서 textVersion +1, D-C7) · 기본 목소리 · 재확인 임계(LOCAL 만 — 실행 검증 방법이 없어
 *   PRODUCTION 편집 불가, Leader R3; ACCURATE 는 max(설정, 0.90) — speech/analysis/policy).
 * - 정책 키(environment.policy, Phase 4): 읽기만.
 * - `voice.preview.textVersion` 은 자동(AUTO).
 */
import type { EditKeyDef } from './keys'

export const PREVIEW_TEXT_KEY = 'voice.preview.defaultText'
export const PREVIEW_TEXT_VERSION_KEY = 'voice.preview.textVersion'
export const DEFAULT_VOICE_KEY = 'voice.default.profileId'
export const REVIEW_THRESHOLD_KEY = 'speech.review.threshold'
/** 미리듣기 문장 상한 — 통합 미리듣기는 문장 하나(세그먼트 ≤100자)로 합성한다. */
export const PREVIEW_TEXT_MAX = 100

type SettingDef = Omit<EditKeyDef, 'key'> & { policy?: boolean }

const policy = (description: string, type: EditKeyDef['type'], def: unknown): SettingDef => ({
  type,
  default: def,
  description,
  editability: 'RUNTIME_EDITABLE',
  strict: false,
  consumer: 'APP',
  verify: 'NONE',
  lock: 'POLICY',
  policy: true,
})

export const APP_SETTING_SCHEMA: Readonly<Record<string, SettingDef>> = {
  [PREVIEW_TEXT_KEY]: {
    type: 'STRING',
    default: 'こんにちは。今日も一緒に楽しく日本語を勉強しましょう。',
    maxLength: PREVIEW_TEXT_MAX,
    freeText: true,
    description: '통합 미리듣기 문장(§43) — 바꾸면 미리듣기 캐시 키(textVersion)가 자동으로 올라간다',
    editability: 'RUNTIME_EDITABLE',
    strict: false,
    consumer: 'APP',
    verify: 'TTS_TEXT',
    lock: null,
  },
  [PREVIEW_TEXT_VERSION_KEY]: {
    type: 'INTEGER',
    default: 1,
    min: 1,
    description: '미리듣기 문장 버전(캐시 키) — 문장이 바뀔 때 자동 +1',
    editability: 'RUNTIME_EDITABLE',
    strict: false,
    consumer: 'APP',
    verify: 'NOT_NEEDED',
    lock: 'AUTO',
  },
  [DEFAULT_VOICE_KEY]: {
    type: 'STRING',
    default: 'teacher_haruka',
    pattern: '^[A-Za-z0-9_-]{1,80}$',
    description: '사용자 설정이 없거나 고른 목소리를 쓸 수 없을 때 쓰는 목소리',
    editability: 'RUNTIME_EDITABLE',
    strict: false,
    consumer: 'APP',
    verify: 'TTS_VOICE',
    lock: null,
  },
  [REVIEW_THRESHOLD_KEY]: {
    type: 'NUMBER',
    default: null,
    min: 0,
    max: 1,
    nullable: true,
    description: '발화 재확인 임계(0~1, 비우면 기본 0.85) — 정확 모드는 max(이 값, 0.90)',
    editability: 'RUNTIME_EDITABLE',
    strict: false,
    consumer: 'APP',
    verify: 'NONE',
    lock: null,
  },
  'override.production.enabled': policy('운영 임시 Override 게이트(§106)', 'BOOLEAN', false),
  'debug.production.maxTtlMinutes': policy('운영 Debug session 최대 TTL(분)', 'INTEGER', 60),
  'loglevel.production.maxLevel': policy('운영 영구 로그 레벨 상한', 'STRING', 'INFO'),
  'speech.audio.retentionDays': policy('발화 오디오 보존일', 'INTEGER', 30),
  'trace.retentionDays': policy('RequestTrace 보존일', 'INTEGER', 90),
}

export function isKnownAppSetting(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(APP_SETTING_SCHEMA, key)
}

/** 대상 키의 편집 키 정의(`value` 하나). 모르는 키면 null. */
export function appSettingKeyDefs(settingKey: string): EditKeyDef[] | null {
  const d = APP_SETTING_SCHEMA[settingKey]
  if (!d) return null
  const { policy: _policy, ...rest } = d
  void _policy
  return [{ ...rest, key: 'value' }]
}

export function isPolicyAppSetting(key: string): boolean {
  return APP_SETTING_SCHEMA[key]?.policy === true
}
