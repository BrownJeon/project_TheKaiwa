import { ok, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { getProfile, parseProfilePatch, updateProfile } from '@/modules/preferences'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #11 학습 설정 조회(화이트리스트 필드만, 첫 조회 때 기본 행 생성). */
export const GET = withApi(async () => {
  const s = await requireSession()
  return ok(await getProfile(s.user.id))
})

/** #12 학습 설정 수정 — 화이트리스트 밖 키(음성·엔진 등)는 400. */
export const PUT = withApi(async (req) => {
  const s = await requireSession()
  const patch = parseProfilePatch(await readJsonObject(req))
  return ok(await updateProfile(s.user.id, patch))
})
