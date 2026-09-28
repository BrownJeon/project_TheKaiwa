import { ok, rateLimit, readFormDataCapped, requireSession, withApi } from '@/modules/infra'
import { getOwnedChat } from '@/modules/conversation'
import { assertOwnedLesson } from '@/modules/learning'
import { parseUploadForm, recordUploadedUtterance, UTTERANCE_MAX_BYTES } from '@/modules/speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 오디오 2MB + 텍스트·구간·계측 필드 여유. */
const BODY_MAX_BYTES = UTTERANCE_MAX_BYTES + 256 * 1024

/**
 * #21 발화 wav(PCM16 16kHz mono ≤2MB·≤60초) + 실시간 텍스트 업로드 — 온디바이스 경로(task-003f 에서 사용).
 * 저장 `DATA_ROOT/users/<userId>/utterances/YYYY-MM/<id>.wav`(30일), `Utterance(RECORDED)`. chatId 는 소유자만(타인 404) — 확인한 방을
 * `Utterance.chatId` 로 남겨 #32 턴이 같은 방인지 본다(task-018 ①). 확인은 읽기 1회(getOwnedChat — #29 조회의 stale 정리를 타지 않는다).
 * 분석 잡(task-012b D-B3): 워커 claim 120초 안·인식 모드 ≠ OFFLINE·분석 connection·오디오가 모두 맞으면 같은 쓰기로 `SpeechJob` 을 넣고
 * `status:QUEUED, analysisQueued:true`, 아니면 `RECORDED`·`false`(발화 저장은 그대로). `lessonId`(task-010) 는 소유자 레슨만(타인 404, chatId 와 함께면 400) → `Utterance.lessonId`.
 * evaluationItemId 는 400 FEATURE_NOT_READY. 사용자당 30/분.
 */
export const POST = withApi(async (req) => {
  const s = await requireSession()
  rateLimit(`speech-utterance:${s.user.id}`, 30)
  const input = await parseUploadForm(await readFormDataCapped(req, BODY_MAX_BYTES))
  if (input.chatId) await getOwnedChat(s.user.id, input.chatId)
  if (input.lessonId) await assertOwnedLesson(s.user.id, input.lessonId)
  return ok(await recordUploadedUtterance(s.user.id, input))
})
