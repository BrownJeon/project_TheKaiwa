import { ok, rateLimit, readFormDataCapped, requireSession, withApi } from '@/modules/infra'
import { getOwnedChat } from '@/modules/conversation'
import { parseUploadForm, recordUploadedUtterance, UTTERANCE_MAX_BYTES } from '@/modules/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 오디오 2MB + 텍스트·구간·계측 필드 여유. */
const BODY_MAX_BYTES = UTTERANCE_MAX_BYTES + 256 * 1024

/**
 * #21 발화 wav(PCM16 16kHz mono ≤2MB·≤60초) + 실시간 텍스트 업로드 — 온디바이스 경로(task-003f 에서 사용).
 * 저장 `DATA_ROOT/users/<userId>/utterances/YYYY-MM/<id>.wav`(30일), `Utterance(RECORDED)`. chatId 는 소유자만(타인 404) — 확인한 방을
 * `Utterance.chatId` 로 남겨 #32 턴이 같은 방인지 본다(task-018 ①). 확인은 읽기 1회(getOwnedChat — #29 조회의 stale 정리를 타지 않는다).
 * Phase 1 은 분석 큐 없음(`analysisQueued:false`). lessonId·evaluationItemId 는 400 FEATURE_NOT_READY. 사용자당 30/분.
 */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  rateLimit(`speech-utterance:${s.user.id}`, 30)
  const input = await parseUploadForm(await readFormDataCapped(req, BODY_MAX_BYTES))
  if (input.chatId) await getOwnedChat(s.user.id, input.chatId)
  return ok(await recordUploadedUtterance(s.user.id, input))
})
