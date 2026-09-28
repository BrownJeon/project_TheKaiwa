/**
 * 연결 주소 호스트 허용 목록(task-012c D-C3(c), configuration-resolution §10 (c)) — 도메인·엔진을 모른다. 허용 origin 목록은 호출자(engine)가 준다.
 *
 * 허용 = ① 서버 env 에 적힌 서비스 origin 과 **정확히 같은 origin**(운영자 설정 — 그대로 믿는다)
 *      ② IP 리터럴이 loopback(127.0.0.0/8·::1) 또는 LAN(192.168.219.0/24) — IPv4-mapped IPv6(`::ffff:a.b.c.d`) 는 안의 IPv4 로 판정
 *      ③ 그 밖의 이름(localhost 포함)은 **해석한 주소가 전부** ②에 들 때만(DNS 재바인딩), 그리고 http 만 — 실제 연결은 검사한 주소로 한다
 *         (`connectUrl`, 검사와 연결 사이에 이름이 다른 주소로 바뀌어도 따라가지 않는다). https 이름은 주소 고정이 불가능해(SNI) ①만.
 * 거부 = http(s) 아닌 스킴 · URL 안 자격증명(`user:pass@`) · 위 밖의 주소(0.0.0.0·::·IPv4-compatible·NAT64·링크 로컬·다른 사설망 포함).
 * 10진·8진·16진 IPv4 표기(`http://3232291684/`·`0300.0250…`)는 WHATWG URL 파서가 점 표기로 정규화한 뒤 판정한다.
 * 리다이렉트는 여기서 다루지 않는다 — 호출자가 추종하지 않는다(`redirect:'manual'`·node:http).
 */
import { lookup as dnsLookup } from 'node:dns/promises'
import { isIPv4, isIPv6 } from 'node:net'

export type AddressClass = 'LOOPBACK' | 'LAN'
export type OutboundDenyReason = 'BAD_URL' | 'SCHEME_NOT_ALLOWED' | 'USERINFO' | 'HOST_NOT_ALLOWED' | 'DNS_FAILED'

export const LAN_PREFIX = '192.168.219.'
const MAX_URL_LENGTH = 300
const DNS_TIMEOUT_MS = 2_000

function v4Octets(ip: string): number[] | null {
  if (!isIPv4(ip)) return null
  return ip.split('.').map(Number)
}

function v4Class(o: readonly number[]): AddressClass | null {
  if (o[0] === 127) return 'LOOPBACK'
  if (o[0] === 192 && o[1] === 168 && o[2] === 219) return 'LAN'
  return null
}

/** IPv6 → 16비트 8개(`::` 압축·끝의 점 표기 IPv4 포함). 형식이 틀리면 null. */
function v6Hextets(ip: string): number[] | null {
  if (!isIPv6(ip)) return null
  let s = ip.toLowerCase()
  const lastColon = s.lastIndexOf(':')
  const v4 = v4Octets(s.slice(lastColon + 1))
  if (v4) s = `${s.slice(0, lastColon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`
  const groups = (part: string) => (part === '' ? [] : part.split(':').map((g) => parseInt(g, 16)))
  const halves = s.split('::')
  if (halves.length > 2) return null
  const head = groups(halves[0])
  const tail = halves.length === 2 ? groups(halves[1]) : []
  const fill = 8 - head.length - tail.length
  if (halves.length === 1 ? fill !== 0 : fill < 1) return null
  const out = [...head, ...Array<number>(halves.length === 2 ? fill : 0).fill(0), ...tail]
  return out.length === 8 && out.every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffff) ? out : null
}

/** 주소(대괄호 있어도 됨) 한 개의 허용 분류 — 허용 밖이면 null. zone id(`%eth0`)가 붙은 주소는 거부. */
export function classifyAddress(address: string): AddressClass | null {
  const a = address.startsWith('[') && address.endsWith(']') ? address.slice(1, -1) : address
  if (a.includes('%')) return null
  const o = v4Octets(a)
  if (o) return v4Class(o)
  const h = v6Hextets(a)
  if (!h) return null
  if (h.slice(0, 7).every((x) => x === 0) && h[7] === 1) return 'LOOPBACK'
  // IPv4-mapped(::ffff:a.b.c.d) 만 IPv4 로 본다. IPv4-compatible(::a.b.c.d)·NAT64 등은 다른 경로로 나갈 수 있어 거부.
  if (h.slice(0, 5).every((x) => x === 0) && h[5] === 0xffff) return v4Class([h[6] >> 8, h[6] & 0xff, h[7] >> 8, h[7] & 0xff])
  return null
}

export type OutboundCheck = { ok: true; url: URL; trusted: boolean; hostKind: 'IP' | 'NAME' } | { ok: false; reason: OutboundDenyReason }

/** 동기 판정 — 이름 주소(`hostKind:'NAME'`, 신뢰 origin 아님)는 `vetOutboundUrl` 이 해석해 다시 본다. */
export function checkOutboundUrl(raw: unknown, trustedOrigins: readonly string[]): OutboundCheck {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_URL_LENGTH) return { ok: false, reason: 'BAD_URL' }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, reason: 'BAD_URL' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, reason: 'SCHEME_NOT_ALLOWED' }
  if (url.username || url.password) return { ok: false, reason: 'USERINFO' }
  const trusted = trustedOrigins.includes(url.origin)
  const host = url.hostname
  const literal = host.startsWith('[') || isIPv4(host)
  if (literal) {
    if (trusted || classifyAddress(host)) return { ok: true, url, trusted, hostKind: 'IP' }
    return { ok: false, reason: 'HOST_NOT_ALLOWED' }
  }
  if (trusted) return { ok: true, url, trusted, hostKind: 'NAME' }
  if (url.protocol !== 'http:') return { ok: false, reason: 'HOST_NOT_ALLOWED' }
  return { ok: true, url, trusted, hostKind: 'NAME' }
}

export type LookupFn = (hostname: string) => Promise<{ address: string; family: number }[]>

const defaultLookup: LookupFn = (hostname) => dnsLookup(hostname, { all: true, verbatim: true })

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('DNS_TIMEOUT')), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

export type OutboundVet = { ok: true; url: URL; connectUrl: URL } | { ok: false; reason: OutboundDenyReason }

/**
 * 비동기 판정 — 이름 주소는 해석한 주소 전부가 허용 대역이어야 하고, `connectUrl` 은 그 주소 하나로 고정한 URL 이다
 * (호출자는 `connectUrl` 로 연결한다 — 시크릿을 싣는 호출은 이 함수가 아니라 env origin 고정으로 막는다).
 */
export async function vetOutboundUrl(raw: unknown, trustedOrigins: readonly string[], lookup: LookupFn = defaultLookup): Promise<OutboundVet> {
  const c = checkOutboundUrl(raw, trustedOrigins)
  if (!c.ok) return c
  if (c.trusted || c.hostKind === 'IP') return { ok: true, url: c.url, connectUrl: c.url }
  let addrs: { address: string; family: number }[]
  try {
    addrs = await withTimeout(lookup(c.url.hostname), DNS_TIMEOUT_MS)
  } catch {
    return { ok: false, reason: 'DNS_FAILED' }
  }
  if (addrs.length === 0) return { ok: false, reason: 'DNS_FAILED' }
  if (addrs.some((a) => !classifyAddress(a.address))) return { ok: false, reason: 'HOST_NOT_ALLOWED' }
  const pick = addrs[0].address
  const connectUrl = new URL(c.url.toString())
  connectUrl.hostname = isIPv6(pick) ? `[${pick}]` : pick
  return { ok: true, url: c.url, connectUrl }
}
