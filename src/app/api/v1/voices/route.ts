import { ok, requireSession, withApi } from '@/modules/infra'
import { listSelectableVoices } from '@/modules/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #17 선택 가능한 Voice 목록(AVAILABLE·enabled, 내부 모델·speaker 숨김). */
export const GET = withApi(async () => {
  await requireSession()
  return ok(await listSelectableVoices())
})
