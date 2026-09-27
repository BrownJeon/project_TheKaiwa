/**
 * credentialRef 조회(configuration-resolution §10, speech-platform/08) — **값을 읽지 않고 존재 여부만** 본다.
 *
 *   env:<NAME>   (`^env:[A-Z0-9_]+$`)            → `process.env[NAME]` 가 비어 있지 않은가
 *   file:<name>  (`^file:[a-z0-9][a-z0-9.-]{2,63}$`) → `<SECRETS_DIR>/<name>` 이 일반 파일로 있는가(stat 만, 읽지 않음)
 *
 * 이름 규칙이 `/` 를 허용하지 않아 경로 순회가 불가능하지만, join 결과가 SECRETS_DIR 바로 아래인지 한 번 더 확인한다.
 * 값 해석(`SecretResolver.resolve`)은 어댑터 호출 직전에만 필요하며 Phase 2 에서 여기에 추가한다 — 콘솔 경로는 값을 쓰지 않는다.
 */
import { statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

export const CREDENTIAL_REF_PATTERN = /^(env:[A-Z0-9_]+|file:[a-z0-9][a-z0-9.-]{2,63})$/

export interface CredentialRefStatus {
  ref: string
  source: 'env' | 'file'
  exists: boolean
  /** file: 만 — 파일 수정 시각(회전 확인용). */
  mtime: string | null
}

export function isCredentialRef(v: unknown): boolean {
  return typeof v === 'string' && CREDENTIAL_REF_PATTERN.test(v)
}

function secretsDir(): string | null {
  const d = process.env.SECRETS_DIR?.trim() || process.env.KAIWA_SECRETS_DIR?.trim()
  return d ? resolve(d) : null
}

/** 형식이 틀린 ref 는 null(호출자가 "평문 의심" 으로 처리). */
export function describeCredentialRef(ref: string): CredentialRefStatus | null {
  if (!isCredentialRef(ref)) return null
  if (ref.startsWith('env:')) {
    const v = process.env[ref.slice(4)]
    return { ref, source: 'env', exists: typeof v === 'string' && v.trim().length > 0, mtime: null }
  }
  const name = ref.slice(5)
  const dir = secretsDir()
  if (!dir) return { ref, source: 'file', exists: false, mtime: null }
  const full = join(dir, name)
  if (dirname(full) !== dir || basename(full) !== name) return { ref, source: 'file', exists: false, mtime: null }
  try {
    const st = statSync(full)
    return { ref, source: 'file', exists: st.isFile(), mtime: st.isFile() ? st.mtime.toISOString() : null }
  } catch {
    return { ref, source: 'file', exists: false, mtime: null }
  }
}

/**
 * 내부 서비스 공유 시크릿(부팅 env — configuration-resolution §10 "내부 시크릿은 설정 키가 아니라 부팅 env").
 * **시크릿은 짝지어진 서버 env 주소와 origin(스킴+호스트+포트)이 정확히 같은 대상에게만 내준다**(Codex C2 Finding 1):
 * DB·Effective 설정의 baseUrl 은 관리자 편집 대상이 될 수 있으므로(Phase 2 connection 편집 API) 허용 목록이 될 수 없다 —
 * DB 로 바꿀 수 없는 env 가 허용 목록이다. env 주소가 비어 있으면 어디에도 보내지 않는다.
 * 이름은 고정 목록만 받는다(임의 env 노출 차단). 값은 호출 헤더에만 싣고 로그·응답·Trace 에 남기지 않는다.
 * 16자 미만이면 설정 누락으로 본다(M4 tts-service 가 같은 기준으로 401).
 */
const SERVICE_SECRETS = {
  TTS_SERVICE_SECRET: { targetEnv: 'TTS_SERVICE_URL' },
} as const
export type ServiceSecretName = keyof typeof SERVICE_SECRETS

function secretValue(name: ServiceSecretName): string | null {
  if (!Object.hasOwn(SERVICE_SECRETS, name)) return null
  const v = process.env[name]?.trim()
  return v && v.length >= 16 ? v : null
}

/** 시크릿 값이 설정돼 있는가(값은 돌려주지 않는다 — Health 의 설정 점검용). */
export function hasServiceSecret(name: ServiceSecretName): boolean {
  return secretValue(name) !== null
}

/** 시크릿과 짝지어진 허용 origin(서버 env). http(s)·자격증명 없는 URL 만, 아니면 null. */
export function serviceSecretOrigin(name: ServiceSecretName): string | null {
  if (!Object.hasOwn(SERVICE_SECRETS, name)) return null
  const raw = process.env[SERVICE_SECRETS[name].targetEnv]?.trim().split(/\s+/)[0]
  if (!raw) return null
  try {
    const u = new URL(raw)
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || u.username || u.password) return null
    return u.origin
  } catch {
    return null
  }
}

export type ServiceSecretGrant = { ok: true; secret: string } | { ok: false; reason: 'SECRET_MISSING' | 'TARGET_UNSET' | 'TARGET_NOT_ALLOWED' }

/** `target` 이 허용 origin 과 정확히 같을 때만 시크릿을 내준다. */
export function readServiceSecretFor(name: ServiceSecretName, target: URL): ServiceSecretGrant {
  const allowed = serviceSecretOrigin(name)
  if (!allowed) return { ok: false, reason: 'TARGET_UNSET' }
  if (target.origin !== allowed || target.username || target.password) return { ok: false, reason: 'TARGET_NOT_ALLOWED' }
  const secret = secretValue(name)
  return secret ? { ok: true, secret } : { ok: false, reason: 'SECRET_MISSING' }
}
