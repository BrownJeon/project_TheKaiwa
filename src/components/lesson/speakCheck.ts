/**
 * ⑤ 답 확인 한 번(#62b) — 화면 상태를 바꾸지 않는 순서만 여기 둔다(task-077 §34-5, 화면 없이 시험).
 *  1. 시작하면 아직 답이 오지 않은 도우미 요청을 접는다(회화방 턴 시작과 같음).
 *  2. 발화 id 가 이미 쓰였거나 맞지 않으면(409 `UTTERANCE_*`) 글만 다시 보낸다(지금 동작).
 *  3. 결과가 오면 도우미 판을 닫는다(결과는 기억 — 다시 열면 마지막 답).
 *  4. 확인하지 못하면 글자 입력 원문을 입력창에 되돌린다(공용 입력창은 보내는 순간 비운다).
 */
import { detailString, toErr, type Err } from '@/components/common/errors'
import type { SpeakingResult } from '@/types/lesson'

export interface SpeakCheckInput {
  itemId: string
  text: string
  utteranceId: string | null
  /** 글자 입력 원문(trim 전) — 말로 한 답은 없음 */
  raw?: string
}

export interface SpeakCheckDeps {
  post: (body: { itemId: string; text: string; utteranceId?: string }) => Promise<SpeakingResult>
  cancelHelper: () => void
  closeHelper: () => void
  restore: (raw: string) => void
}

export type SpeakCheckOutcome = { ok: true; result: SpeakingResult } | { ok: false; err: Err }

export async function runSpeakCheck(i: SpeakCheckInput, d: SpeakCheckDeps): Promise<SpeakCheckOutcome> {
  d.cancelHelper()
  try {
    let r: SpeakingResult
    try {
      r = await d.post({ itemId: i.itemId, text: i.text, ...(i.utteranceId ? { utteranceId: i.utteranceId } : {}) })
    } catch (e) {
      const err = toErr(e)
      const reason = detailString(err, 'reason')
      if (err.status === 409 && i.utteranceId && reason?.startsWith('UTTERANCE_')) r = await d.post({ itemId: i.itemId, text: i.text })
      else throw e
    }
    d.closeHelper()
    return { ok: true, result: r }
  } catch (e) {
    if (i.raw !== undefined) d.restore(i.raw)
    return { ok: false, err: toErr(e) }
  }
}
