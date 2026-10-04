/**
 * credentialRef 조회(configuration-resolution §10, speech-platform/08) — **값을 읽지 않고 존재 여부만** 본다.
 *
 *   env:<NAME>   (`^env:[A-Z0-9_]+$`)            → `process.env[NAME]` 가 비어 있지 않은가
 *   file:<name>  (`^file:[a-z0-9][a-z0-9.-]{2,63}$`) → `<SECRETS_DIR>/<name>` 이 일반 파일로 있는가(stat 만, 읽지 않음)
 *
 * 이름 규칙이 `/` 를 허용하지 않아 경로 순회가 불가능하지만, join 결과가 SECRETS_DIR 바로 아래인지 한 번 더 확인한다.
 * 값 해석은 `readCredentialFor`(어댑터 호출 직전, 전송 대상 origin 고정 — task-012c D-C3(a)) 하나뿐이다. 콘솔 경로는 값을 쓰지 않는다.
 */
import { closeSync, constants as fsConstants, fstatSync, openSync, readlinkSync, readSync, realpathSync, statSync } from 'node:fs'
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

// ── 전역 거부 분류(task-012c Codex C1 CX-1, configuration-resolution §10 (b) ②) ─────────────────────────
//
// 부팅·내부 시크릿을 가리키는 ref 는 어댑터 descriptor 의 허용 목록(`allowedRefs`)이 실수로 담아도 거부한다(이중 방어 — descriptor 보다 먼저 검사).
// `file:` 은 이름을 env 모양(대문자·`-`/`.` → `_`)으로 바꿔 같은 규칙으로 본다(`file:jwt-secret` = `JWT_SECRET`).

const DENIED_ENV_NAMES = new Set([
  'JWT_SECRET',
  'DATABASE_URL',
  'SHADOW_DATABASE_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'SIGNUP_INVITE_CODE',
  'SPEECH_INTERNAL_SECRET',
  'TTS_SERVICE_SECRET',
  'ANTHROPIC_API_KEY',
])
const DENIED_ENV_PATTERNS: readonly RegExp[] = [
  /^JWT_/,
  /(^|_)DATABASE(_|$)/,
  /^(DB|MYSQL|MARIADB|REDIS)_/,
  /^(GOOGLE|OAUTH|NEXTAUTH|AUTH)_/,
  /INTERNAL_SECRET/,
  /SERVICE_SECRET/,
  /(^|_)SESSION(_|$)/,
  /^SIGNUP_/,
  /INVITE_CODE/,
  /^OWNER_/,
  /^ANTHROPIC_/,
  /OAUTH/,
  /^(AWS|GH|GITHUB|GITEA|NPM|WEBHOOK)_/,
  /PRIVATE_KEY/,
  /PASSWORD|PASSWD/,
  /COOKIE/,
]

function refNameAsEnv(ref: string): string | null {
  const m = /^(env|file):(.+)$/i.exec(ref.trim())
  if (!m) return null
  return m[2].toUpperCase().replace(/[-.]/g, '_')
}

/** 부팅·내부 시크릿을 가리키는 ref 인가(형식이 틀려도 이름 부분으로 판정 — 대소문자 무시). */
export function isDeniedCredentialRef(ref: string): boolean {
  const name = refNameAsEnv(ref)
  if (!name) return false
  return DENIED_ENV_NAMES.has(name) || DENIED_ENV_PATTERNS.some((re) => re.test(name))
}

/** 서버 env 에 적힌 주소의 origin(값 뒤의 주석·공백은 무시). http(s)·자격증명 없는 URL 만, 아니면 null. */
export function envOrigin(envName: string): string | null {
  if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(envName)) return null
  const raw = process.env[envName]?.trim().split(/\s+/)[0]
  if (!raw) return null
  try {
    const u = new URL(raw)
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || u.username || u.password) return null
    return u.origin
  } catch {
    return null
  }
}

const SECRET_FILE_MAX_BYTES = 4 * 1024

type SecretRead = { ok: true; value: string } | { ok: false; reason: 'SECRET_MISSING' | 'SECRET_PERMISSION' }

/** 파일시스템 경계(단위 테스트가 `mock.method` 로 바꿔 끼워 "열기 직전·직후 바꿔치기" 를 흉내 낸다). */
export const secretFileDeps = {
  open: (path: string, flags: number): number => openSync(path, flags),
  /** 열린 fd 의 실제 경로(Linux `/proc/self/fd`). 알 수 없으면 null — 그때는 O_NOFOLLOW·fstat 검사만으로 판정한다. */
  fdPath: (fd: number): string | null => {
    try {
      return readlinkSync(`/proc/self/fd/${fd}`)
    } catch {
      return null
    }
  },
}

/**
 * `file:<name>` 값(task-012c Codex C2 ② — 옛 구현은 lstat 검사 뒤 **같은 경로를 다시 열어** 읽어, 그 사이 심볼릭 링크로 바꿔치기하면
 * 검사를 통과한 뒤 링크 대상을 읽는 TOCTOU 가 있었다). 이제 **fd 하나로 열기·검사·읽기**를 끝낸다:
 *   ① SECRETS_DIR 의 realpath 바로 아래 경로를 `O_RDONLY|O_NOFOLLOW|O_NONBLOCK` 로 연다 — 마지막 성분이 심볼릭 링크면 ELOOP 로 실패,
 *      FIFO 에서 막히지 않는다(O_NONBLOCK)
 *   ② 그 fd 로 `fstat` — 일반 파일·그룹/기타 권한 없음(0600 류)·소유자 본인·4KB 이하
 *   ③ 그 fd 의 실제 경로(`/proc/self/fd`)가 `realpath(SECRETS_DIR)/<name>` 인지 — 디렉터리 성분을 바꿔치기해 밖의 파일을 열게 한 경우 거부
 *   ④ 같은 fd 로 최대 4KB+1 바이트만 읽고 닫는다(경로 재오픈 없음)
 */
function readSecretFile(name: string): SecretRead {
  const dir = secretsDir()
  if (!dir) return { ok: false, reason: 'SECRET_MISSING' }
  let realDir: string
  try {
    realDir = realpathSync(dir)
  } catch {
    return { ok: false, reason: 'SECRET_MISSING' }
  }
  const full = join(realDir, name)
  if (dirname(full) !== realDir || basename(full) !== name) return { ok: false, reason: 'SECRET_MISSING' }
  let fd: number
  try {
    fd = secretFileDeps.open(full, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK)
  } catch (e) {
    const code = (e as { code?: string })?.code
    return { ok: false, reason: code === 'ENOENT' || code === 'ENOTDIR' ? 'SECRET_MISSING' : 'SECRET_PERMISSION' }
  }
  try {
    const st = fstatSync(fd)
    if (!st.isFile()) return { ok: false, reason: 'SECRET_PERMISSION' }
    if ((st.mode & 0o077) !== 0 || (typeof process.getuid === 'function' && st.uid !== process.getuid())) return { ok: false, reason: 'SECRET_PERMISSION' }
    if (st.size > SECRET_FILE_MAX_BYTES) return { ok: false, reason: 'SECRET_PERMISSION' }
    const where = secretFileDeps.fdPath(fd)
    if (where !== null && where !== full) return { ok: false, reason: 'SECRET_PERMISSION' }
    const buf = Buffer.alloc(SECRET_FILE_MAX_BYTES + 1)
    let n = 0
    for (;;) {
      const r = readSync(fd, buf, n, buf.length - n, n)
      if (r === 0) break
      n += r
      if (n >= buf.length) return { ok: false, reason: 'SECRET_PERMISSION' }
    }
    const v = buf.subarray(0, n).toString('utf8').trim()
    return v ? { ok: true, value: v } : { ok: false, reason: 'SECRET_MISSING' }
  } catch {
    return { ok: false, reason: 'SECRET_MISSING' }
  } finally {
    closeSync(fd)
  }
}

export type CredentialGrant = { ok: true; secret: string } | { ok: false; reason: 'TARGET_UNSET' | 'TARGET_NOT_ALLOWED' | 'REF_NOT_ALLOWED' | 'SECRET_MISSING' | 'SECRET_PERMISSION' }

/**
 * credentialRef 값 해석(configuration-resolution §10 SecretResolver) — **어댑터가 호출을 만드는 순간에만** 부른다.
 * 값은 `target` 의 origin 이 서버 env `originEnv`(예: 그 서비스의 주소 env)의 origin 과 정확히 같을 때만 내준다(D-C3(a) — DB·Effective 주소는
 * 관리자 편집 대상이라 허용 목록이 될 수 없다). 전역 거부 분류와 **호출자 어댑터의 허용 목록(`allowedRefs`, 필수 인자)**도 여기서 다시 본다
 * (REV-035 Low 1 — 호출자가 앞 검사를 빠뜨려도 다른 엔진의 ref 가 새지 않게). 값은 로그·응답·Trace 에 싣지 않는다.
 */
export function readCredentialFor(ref: string | null, target: URL, originEnv: string, allowedRefs: readonly string[]): CredentialGrant {
  const allowed = envOrigin(originEnv)
  if (!allowed) return { ok: false, reason: 'TARGET_UNSET' }
  if (target.origin !== allowed || target.username || target.password) return { ok: false, reason: 'TARGET_NOT_ALLOWED' }
  if (!ref) return { ok: false, reason: 'SECRET_MISSING' }
  if (!isCredentialRef(ref) || isDeniedCredentialRef(ref) || !allowedRefs.includes(ref)) return { ok: false, reason: 'REF_NOT_ALLOWED' }
  if (ref.startsWith('env:')) {
    const v = process.env[ref.slice(4)]?.trim()
    return v ? { ok: true, secret: v } : { ok: false, reason: 'SECRET_MISSING' }
  }
  const r = readSecretFile(ref.slice(5))
  return r.ok ? { ok: true, secret: r.value } : r
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
  // 앱 → speech gateway 내부 라우트(task-026 S1 `/text/annotate`). gateway → 앱 콜백(`/api/internal/*`)과 같은 값, 방향만 반대.
  SPEECH_INTERNAL_SECRET: { targetEnv: 'SPEECH_GATEWAY_URL' },
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
  return envOrigin(SERVICE_SECRETS[name].targetEnv)
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
