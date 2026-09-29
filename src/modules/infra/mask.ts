/**
 * 민감정보 마스킹(module-dependency L6 `logging.maskSensitive`, configuration-resolution §10, role-permission §7 QA 대조 항목).
 * 콘솔 응답·AuditLog before/after·Trace 에 **시크릿 형태 문자열**이 섞이지 않게 `"***"` 로 바꾼다. credentialRef(`env:`·`file:`) 이름은 그대로 둔다.
 *
 * 판정: `sk-`/`pk-`/`ghp_`/`xox?-` 접두 · `Bearer ` 포함 · JWT(`eyJ….….…`) · 32자 이상 hex · 32자 이상 base64 계열(대·소문자·숫자 모두 포함, 하이픈 없음)
 * · URL 안의 자격증명(`user:pass@`)·토큰 쿼리 · 키 이름이 secret/password/token/apiKey/authorization/cookie 인 문자열 값.
 * 하이픈으로 이어진 모델 id(`zipformer-ja-…-int8`)·cuid 는 가리지 않는다.
 */
import { isCredentialRef } from './secrets'

export const MASK = '***'

const PREFIX = /^(sk-|pk-|ghp_|gho_|xox[abpr]-)/i
const BEARER = /bearer\s+\S+/i
const JWT_LIKE = /^eyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}$/
const HEX_LONG = /^[A-Fa-f0-9]{32,}$/
const B64_LONG = /^[A-Za-z0-9+/=_]{32,}$/
const SECRET_KEY_NAME = /(secret|password|passwd|token|api[-_]?key|authorization|cookie|credential)(?!ref)/i
const SECRET_QUERY = /([?&](?:key|token|apikey|api_key|secret|password|sig|signature|access_token)=)[^&#]+/gi

export function looksSecret(s: string): boolean {
  if (isCredentialRef(s)) return false
  const t = s.trim()
  if (PREFIX.test(t) || BEARER.test(t) || JWT_LIKE.test(t) || HEX_LONG.test(t)) return true
  return B64_LONG.test(t) && /[A-Z]/.test(t) && /[a-z]/.test(t) && /\d/.test(t)
}

function maskUrl(s: string): string {
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return s
  let out = s
  try {
    const u = new URL(s)
    if (u.username || u.password) {
      u.username = ''
      u.password = ''
      out = u.toString()
    }
  } catch {
    return s
  }
  return out.replace(SECRET_QUERY, `$1${MASK}`)
}

export function maskString(s: string): string {
  if (looksSecret(s)) return MASK
  return maskUrl(s)
}

const ASCII_RUN = /[!-~]+/g
const EDGE_PUNCT = /^([("'`[{<]*)(.*?)([)"'`\]}>.,;:!?]*)$/

/**
 * 자유 텍스트(관리자 `reason`·요약 문장) 마스킹 — `maskString` 은 문자열 **전체**가 비밀 모양일 때만 가리므로, 문장 안에 섞인 조각을 따로 본다.
 * 공백·한글·일본어로 끊긴 ASCII 조각마다(앞뒤 괄호·문장부호는 떼고) 비밀 모양이면 `***`, URL 이면 자격증명·토큰 쿼리를 지운다.
 * `Bearer <토큰>` 은 두 조각이라 먼저 한 번에 가린다. 다른 글자·공백은 그대로 둔다.
 */
export function maskText(s: string): string {
  return s.replace(/bearer\s+\S+/gi, `Bearer ${MASK}`).replace(ASCII_RUN, (run) => {
    const m = EDGE_PUNCT.exec(run)
    const [lead, core, tail] = m ? [m[1], m[2], m[3]] : ['', run, '']
    if (!core || core === MASK) return run
    return `${lead}${looksSecret(core) ? MASK : maskUrl(core)}${tail}`
  })
}

/** 깊은 복사하며 마스킹(깊이 8·배열 200개 상한 — 콘솔 응답용). 원본은 바꾸지 않는다. */
export function maskSensitive<T>(value: T, depth = 0): T {
  if (depth > 8) return MASK as unknown as T
  if (typeof value === 'string') return maskString(value) as unknown as T
  if (Array.isArray(value)) return value.slice(0, 200).map((v) => maskSensitive(v, depth + 1)) as unknown as T
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // credentialRef 자리에 ref 형식이 아닌 값이 있으면 평문 의심(E_CONN_SECRET_VALUE) — 무엇이든 가린다.
      if (typeof v === 'string' && (SECRET_KEY_NAME.test(k) || /credentialref$/i.test(k)) && !isCredentialRef(v) && v.length > 0) out[k] = MASK
      else out[k] = maskSensitive(v, depth + 1)
    }
    return out as T
  }
  return value
}
