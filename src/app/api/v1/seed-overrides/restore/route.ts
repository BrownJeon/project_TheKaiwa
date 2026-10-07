import { ok, rateLimit, readJsonObject, requireSession, withApi } from '@/modules/infra'
import { parseSeedRefBody, removeUserTopicTx, restoreSeed } from '@/modules/learning'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * #176 "기본으로 되돌리기"·숨긴 시드 다시 보기(task-045 T1-3). 본문 `{kind:'TOPIC'|'SCENARIO', seedId, ack?}`.
 * - 숨김(`path:'HIDDEN'`)·고아(`ORPHAN`) = override 만 지움(시드가 다시 보임), `removal:null`.
 * - 내 버전(`COPY`): 상황 = 사본 보관(#165 의미) · 주제 = 주제 삭제 포트(`mode:'RESTORE'` — 사본에 붙은 내 상황을 시드 주제로 되돌려 붙이고 사본·진행 중 챌린지를 지움,
 *   `ack` 필요 = 사본 id 로 부른 #172 의 `ack`) → `removal`(= `TopicRemovalResult`, `removal.mode:'RESTORE'`·`removal.scenariosRelinked` 개수).
 * 오류: 400 `kind`·`seedId`·`ack` 형식(한도 미소모) · 404 `NOT_OVERRIDDEN`(되돌릴 것 없음)·`USER_GONE` · 409 `IMPACT_CHANGED` + `details.preview`(확인 창 다시 열기 — `preview.restore`) · 429 분당 20.
 */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  const { kind, seedId, ack } = parseSeedRefBody(await readJsonObject(req, 4 * 1024))
  rateLimit(`${kind === 'TOPIC' ? 'topic' : 'scenario'}-write:${s.user.id}`, 20)
  // 주제 사본 삭제 포트를 반드시 주입한다 — 빼면 ops 기본값(400 FEATURE_NOT_READY, 쓰기 0).
  return ok(await restoreSeed(s.user.id, kind, seedId, { ack }, { removeTopic: removeUserTopicTx }))
})
