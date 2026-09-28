/**
 * Engine credentials(module-dependency L5 `credentials/`) — connection 의 credentialRef 허용 판정을 엔진 스키마(descriptor)와 묶는다.
 * 값은 다루지 않는다(해석은 어댑터 호출 직전 infra `readCredentialFor`). 편집 API(#93b)·Validate·#101 `allowedFor` 가 쓴다.
 */
import type { ConnectionType } from '@prisma/client'
import { getConfigurationSchema } from '../registry'
import { checkCredentialRef, type CredentialRefCheck } from './policy'

export { checkCredentialRef } from './policy'
export type { CredentialRefCheck, CredentialRefProblem } from './policy'

const CREDENTIAL_KEY = 'connection.credentialRef'

/** 그 엔진·연결 종류가 걸 수 있는 ref 목록. 스키마에 credentialRef 키가 없거나 연결 종류에 해당하지 않으면 빈 배열(어떤 ref 도 불가). */
export function allowedRefsFor(engineId: string, connectionType: ConnectionType | string): readonly string[] {
  const k = getConfigurationSchema(engineId)?.keys.find((x) => x.key === CREDENTIAL_KEY)
  if (!k || k.type !== 'SECRET_REF') return []
  if (k.appliesTo && !k.appliesTo.includes(connectionType as ConnectionType)) return []
  return k.allowedRefs ?? []
}

export function checkConnectionCredentialRef(engineId: string, connectionType: ConnectionType | string, ref: string | null, opts: { checkExists: boolean }): CredentialRefCheck {
  return checkCredentialRef(allowedRefsFor(engineId, connectionType), ref, opts)
}
