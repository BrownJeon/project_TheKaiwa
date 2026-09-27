import { ok, withApi } from '@/modules/infra'
import { listSecretRefs, requireCapability } from '@/modules/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #101 credentialRef 이름·존재 여부만(값 없음). 조회마다 AuditLog(secrets.read_ref) 1행.
 * 존재 여부는 **이 서버**의 env·SECRETS_DIR 기준이라 다른 환경 보기(`?environment=`)를 받지 않는다.
 */
export const GET = withApi(async () => {
  const actor = await requireCapability('secrets.read_ref')
  return ok(await listSecretRefs(actor, actor.environment))
})
