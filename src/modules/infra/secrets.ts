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
