/**
 * credentialRef 허용 판정(task-012c Codex C1 CX-1, configuration-resolution §10 (b), api-contract #93b) — 순수 함수(어댑터·registry 가 같이 쓴다).
 *
 * 검사 순서(정본 #93b): ⓪ ref 모양이 아님(`env:`/`file:` 로 시작하지 않음 — 평문 의심) → ① 전역 거부 분류(부팅·내부 시크릿)
 *   → ② 어댑터 descriptor 의 정확한 허용 목록(`allowedRefs`) → ③ 형식(정규식) → ④ 존재(선택).
 * ⓪ 은 `400 E_CONN_SECRET_VALUE`(api-contract §2-19 — 값을 되돌려주지 않는다), ①② 는 `422 E_REF_NOT_ALLOWED`(Validate `rule:refNotAllowed`),
 * ③ 은 `400 {rule:'pattern'}`, ④ 는 `400 {rule:'reference'}` 로 호출자(admin)가 바꾼다. `null`(해제)은 목록 검사 없이 통과.
 */
import { describeCredentialRef, isCredentialRef, isDeniedCredentialRef } from '@/modules/infra'

export type CredentialRefProblem = 'PLAINTEXT' | 'REF_NOT_ALLOWED' | 'BAD_FORMAT' | 'MISSING'
export type CredentialRefCheck = { ok: true } | { ok: false; problem: CredentialRefProblem; deniedBy?: 'GLOBAL' | 'DESCRIPTOR' }

export function checkCredentialRef(allowedRefs: readonly string[], ref: string | null, opts: { checkExists: boolean }): CredentialRefCheck {
  if (ref === null) return { ok: true }
  if (typeof ref !== 'string' || !/^(env|file):/i.test(ref)) return { ok: false, problem: 'PLAINTEXT' }
  if (isDeniedCredentialRef(ref)) return { ok: false, problem: 'REF_NOT_ALLOWED', deniedBy: 'GLOBAL' }
  if (!allowedRefs.includes(ref)) return { ok: false, problem: 'REF_NOT_ALLOWED', deniedBy: 'DESCRIPTOR' }
  if (!isCredentialRef(ref)) return { ok: false, problem: 'BAD_FORMAT' }
  if (opts.checkExists && !describeCredentialRef(ref)?.exists) return { ok: false, problem: 'MISSING' }
  return { ok: true }
}
