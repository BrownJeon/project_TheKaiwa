/**
 * 콘솔 편집 키 정책(task-012c D-C4 편집 키 표 · Codex C1 CX-2) — 어댑터 스키마 메타(`consumer`·`verify`·`envPinned`·`runtimeMax`·
 * `runtimeEnvWins`·`consoleEdit`)만으로 판정한다. 엔진명은 여기 없다(어댑터가 선언).
 *
 * 잠금 순서(앞이 우선): READ_ONLY → RESTART_REQUIRED(RESTART·REDEPLOY — 재기동 전 실행 검증 불가, CX-2) → CREDENTIAL_ONLY(SECRET_REF —
 * #93b 로만) → DEFERRED(설계 보류) → SERVICE_MANAGED(Python 이 읽음, 015c) → NOT_CONSUMED(런타임이 읽지 않음 — 콘솔 값 ≠ 실제 값) →
 * ENV_PINNED(주소가 서버 env 로 고정) → 편집 가능. 편집 가능 키만 `verify` 로 "실행 검증 방법" 을 가진다.
 */
import type { ConnectionType } from '@prisma/client'
import type { ConfigurationSchema, EditabilityValue, KeyConsumer, SchemaKeyType, VerifyMethod } from '../registry/types'

export type LockReason = 'READ_ONLY' | 'RESTART_REQUIRED' | 'CREDENTIAL_ONLY' | 'DEFERRED' | 'SERVICE_MANAGED' | 'NOT_CONSUMED' | 'ENV_PINNED' | 'AUTO' | 'POLICY'
export type Verifiable = 'YES' | 'NO' | 'NOT_NEEDED'
/**
 * 스키마의 VerifyMethod + 대상 종류별 동적 방법:
 * CONNECTION_TEST = 그 연결 기능 테스트 · SWITCH = 켜기면 기능 테스트, 끄기면 불요 · FALLBACK_NEW = 새로 들어간 연결마다 기능 테스트(없으면 불요) ·
 * TTS_TEXT = 후보 문장 합성 · TTS_VOICE = 후보 목소리로 합성.
 */
export type EditVerify = VerifyMethod | 'CONNECTION_TEST' | 'SWITCH' | 'FALLBACK_NEW' | 'TTS_TEXT' | 'TTS_VOICE'
export type ValidationRuleName =
  | 'type'
  | 'min'
  | 'max'
  | 'enum'
  | 'pattern'
  | 'maxLength'
  | 'required'
  | 'unknownKey'
  | 'readOnly'
  | 'secretValue'
  | 'dependency'
  | 'reference'
  | 'serviceManaged'
  | 'hostNotAllowed'
  | 'refNotAllowed'
  | 'restartRequired'

export interface EditKeyDef {
  key: string
  type: SchemaKeyType
  default: unknown
  min?: number
  max?: number
  enum?: readonly (string | number)[]
  pattern?: string
  maxLength?: number
  /** null 을 값으로 받는다(SECRET_REF 해제·AppSetting 미설정). */
  nullable?: boolean
  description: string
  editability: EditabilityValue
  strict: boolean
  restartTarget?: string
  consumer: KeyConsumer
  verify: EditVerify
  lock: LockReason | null
  allowedRefs?: readonly string[]
  runtimeEnvWins?: readonly string[]
}

const LOCK_MESSAGE: Record<LockReason, string> = {
  READ_ONLY: '읽기 전용 키입니다(코드·배포로만 바뀝니다).',
  RESTART_REQUIRED: '재시작·재배포가 필요한 키는 콘솔에서 바꾸지 않습니다(재기동 전에는 실행 검증을 할 수 없습니다).',
  CREDENTIAL_ONLY: '비밀 참조는 "비밀 참조 연결"(최고관리자)에서만 바꿉니다.',
  DEFERRED: '이 키는 콘솔 편집을 보류했습니다.',
  SERVICE_MANAGED: '음성 서비스가 자기 설정 파일에서 읽는 키입니다 — 서비스 설정 파일에서 관리합니다.',
  NOT_CONSUMED: '앱이 실제로 읽지 않는 키라 바꿔도 효과가 없습니다.',
  ENV_PINNED: '주소는 서버 설정(env)으로 고정돼 있습니다.',
  AUTO: '자동으로 바뀌는 값입니다.',
  POLICY: '환경 정책 키는 최고관리자 정책 화면(Phase 4)에서만 바꿉니다.',
}

export function lockMessage(lock: LockReason): string {
  return LOCK_MESSAGE[lock]
}

/** 잠금 → Validate `rule`(api-contract §2-23 정본 16종 안에서). */
export function lockRule(lock: LockReason): ValidationRuleName {
  if (lock === 'RESTART_REQUIRED') return 'restartRequired'
  if (lock === 'SERVICE_MANAGED') return 'serviceManaged'
  return 'readOnly'
}

/** 잠금 → Diff `blocked.code`(admin-console/08 정본 값). */
export function lockBlockedCode(lock: LockReason): 'READ_ONLY' | 'RESTART_REQUIRED' | 'SERVICE_MANAGED' {
  if (lock === 'RESTART_REQUIRED') return 'RESTART_REQUIRED'
  if (lock === 'SERVICE_MANAGED') return 'SERVICE_MANAGED'
  return 'READ_ONLY'
}

/** 연결 한 개의 편집 키(스키마 키 + 행 칸 `enabled`). `appliesTo` 밖 키는 빠진다. */
export function connectionKeyDefs(schema: ConfigurationSchema, connectionType: ConnectionType | string): EditKeyDef[] {
  const type = connectionType as ConnectionType
  const out: EditKeyDef[] = []
  for (const k of schema.keys) {
    if (k.appliesTo && !k.appliesTo.includes(type)) continue
    const editability = k.editabilityBy?.[type] ?? k.editability
    const consumer = k.consumerBy?.[type] ?? k.consumer ?? 'NONE'
    const lock: LockReason | null =
      editability === 'READ_ONLY'
        ? 'READ_ONLY'
        : editability === 'RESTART_REQUIRED' || editability === 'REDEPLOY_REQUIRED'
          ? 'RESTART_REQUIRED'
          : k.type === 'SECRET_REF'
            ? 'CREDENTIAL_ONLY'
            : k.consoleEdit === false
              ? 'DEFERRED'
              : consumer === 'PYTHON'
                ? 'SERVICE_MANAGED'
                : consumer === 'NONE'
                  ? 'NOT_CONSUMED'
                  : k.envPinned
                    ? 'ENV_PINNED'
                    : null
    const max = k.runtimeMax != null ? Math.min(k.max ?? Number.POSITIVE_INFINITY, k.runtimeMax) : k.max
    out.push({
      key: k.key,
      type: k.type,
      default: k.default,
      ...(k.min != null ? { min: k.min } : {}),
      ...(max != null && Number.isFinite(max) ? { max } : {}),
      ...(k.enum ? { enum: k.enum } : {}),
      ...(k.pattern ? { pattern: k.pattern } : {}),
      ...(k.type === 'SECRET_REF' || k.default === null ? { nullable: true } : {}),
      description: k.description,
      editability,
      strict: k.strict === true,
      ...(k.restartTarget ? { restartTarget: k.restartTarget } : {}),
      consumer,
      verify: k.verify ?? 'NONE',
      lock,
      ...(k.allowedRefs ? { allowedRefs: k.allowedRefs } : {}),
      ...(k.runtimeEnvWins ? { runtimeEnvWins: k.runtimeEnvWins } : {}),
    })
  }
  out.push({
    key: 'enabled',
    type: 'BOOLEAN',
    default: true,
    description: '연결 사용 여부(끄면 Router·음성 경로 후보에서 빠진다)',
    editability: 'RUNTIME_EDITABLE',
    strict: true,
    consumer: 'APP',
    verify: 'SWITCH',
    lock: null,
  })
  return out
}

/** Fallback 정책(EngineFallbackPolicy 행) 편집 키. `retryOnce` 는 Router 가 읽지 않는다(항상 앞 2후보). */
export const FALLBACK_KEY_DEFS: readonly EditKeyDef[] = [
  { key: 'primaryConnectionId', type: 'STRING', default: null, description: '1순위 연결', editability: 'RUNTIME_EDITABLE', strict: true, consumer: 'APP', verify: 'CONNECTION_TEST', lock: null, pattern: '^[A-Za-z0-9_-]{1,80}$' },
  { key: 'fallbackConnectionIds', type: 'JSON', default: [], description: '예비 연결 순서(≤4)', editability: 'RUNTIME_EDITABLE', strict: true, consumer: 'APP', verify: 'FALLBACK_NEW', lock: null },
  { key: 'retryOnce', type: 'BOOLEAN', default: true, description: '실패 시 다음 연결로 1회 재시도(Router 는 항상 앞 2후보를 시도해 이 값을 읽지 않는다)', editability: 'RUNTIME_EDITABLE', strict: true, consumer: 'NONE', verify: 'NONE', lock: 'NOT_CONSUMED' },
  { key: 'enabled', type: 'BOOLEAN', default: true, description: '정책 사용(끄면 그 역할은 연결 없음)', editability: 'RUNTIME_EDITABLE', strict: true, consumer: 'APP', verify: 'SWITCH', lock: null },
]

/** 한 변경 키의 검증 필요 여부 — 동적 방법(SWITCH·FALLBACK_NEW)은 전후 값으로 정한다. */
export function verifiabilityOf(def: Pick<EditKeyDef, 'verify'>, before: unknown, after: unknown): Verifiable {
  switch (def.verify) {
    case 'NOT_NEEDED':
      return 'NOT_NEEDED'
    case 'NONE':
      return 'NO'
    case 'SWITCH':
      return after === false ? 'NOT_NEEDED' : 'YES'
    case 'FALLBACK_NEW':
      return newFallbackIds(before, after).length === 0 ? 'NOT_NEEDED' : 'YES'
    default:
      return 'YES'
  }
}

/** 예비 연결 목록에서 새로 들어간 id(순서 변경·빼기는 실행할 새 대상이 없다). */
export function newFallbackIds(before: unknown, after: unknown): string[] {
  const b = new Set(Array.isArray(before) ? before.filter((x): x is string => typeof x === 'string') : [])
  return (Array.isArray(after) ? after.filter((x): x is string => typeof x === 'string') : []).filter((id) => !b.has(id))
}
