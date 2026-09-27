import { ok, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { addSeedPack, parseSeedPackBody } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** #46b 기본 단어 팩 — 사용자 직접 행위(CTA). 같은 표현은 건너뛰고 `{added, skipped}`. */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  const pack = parseSeedPackBody(await readJsonObject(req))
  return ok(await addSeedPack(s.user.id, pack))
})
