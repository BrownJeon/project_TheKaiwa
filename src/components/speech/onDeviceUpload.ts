/**
 * 휴대폰 경로 TURN 발화 업로드(#21) — 온디바이스 클라이언트가 final 때 부른다(마이크 테스트는 부르지 않는다).
 * `realtimeConnectionKey` 는 #19 가 준 불투명 id 를 그대로 돌려준다. 실패는 null(회화방은 글자 턴으로 보낸다 — §9-11 ②), 재시도 없음.
 */
import { apiUpload } from '@/components/common/api'
import type { OnDeviceUpload } from '@/modules/speech/stt/client'

export async function uploadOnDeviceUtterance(u: OnDeviceUpload, signal: AbortSignal): Promise<string | null> {
  const form = new FormData()
  form.set('audio', new Blob([u.wav], { type: 'audio/wav' }), 'utterance.wav')
  form.set('text', u.text)
  form.set('realtimeConnectionKey', u.connectionKey)
  form.set('durationMs', String(u.durationMs))
  if (u.chatId) form.set('chatId', u.chatId)
  if (u.segments.length > 0) form.set('segments', JSON.stringify(u.segments))
  if (Object.keys(u.timings).length > 0) form.set('timings', JSON.stringify(u.timings))
  try {
    const r = await apiUpload<{ utteranceId?: unknown }>('/api/v1/speech/utterances', form, 'POST', { signal })
    return typeof r?.utteranceId === 'string' ? r.utteranceId : null
  } catch {
    return null
  }
}
