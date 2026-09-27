/**
 * 용도별 파생 키(task-007 K5) — `JWT_SECRET` 하나에서 HKDF-SHA256 으로 용도(`info`)마다 다른 32바이트 키를 만든다.
 * 세션 JWT 서명 키를 다른 MAC(예: TTS 오디오 서명 URL)에 그대로 쓰지 않기 위해서다 — 한 용도의 토큰이 다른 용도로 검증되지 않는다.
 * 새 env 가 필요 없다. 키는 메모리에만 두고 출력하지 않는다.
 */
import { hkdfSync } from 'node:crypto'

const INFO = /^thekaiwa\/[a-z0-9-]{3,40}\/v\d{1,3}$/
const cache = new Map<string, { secret: string; key: Buffer }>()

export function deriveSubkey(info: string): Buffer {
  if (!INFO.test(info)) throw new Error('deriveSubkey: info 형식은 thekaiwa/<용도>/v<n>')
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is not set')
  const hit = cache.get(info)
  if (hit && hit.secret === secret) return hit.key
  const key = Buffer.from(hkdfSync('sha256', secret, 'thekaiwa-subkey', info, 32))
  cache.set(info, { secret, key })
  return key
}
