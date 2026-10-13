/**
 * 질문 입력 묶음의 보내기·말 규칙(task-066 §26-7) — `useAskInput` 이 React 상태·ref 에 얽어 두면 시험이 닿지 못하던 판정을
 * 의존(최신 값 읽기·상태 쓰기·인식기 호출)을 주입받는 순수 모양으로 뺀 것. 훅은 이것을 한 번 만들어 꽂기만 한다.
 *
 * 지키는 규칙:
 * - 밀어서/Esc 로 취소한 직후(`cancel`)에는 늦게 온 인식 결과(`onFinal`)를 보내지 않고, **다음 누름(`press`)에서 풀린다**
 *   (안 풀면 한 번 취소한 뒤 말 질문이 전부 조용히 버려진다).
 * - 취소는 인식을 멈추고(`sttAbort`) 토스트 한 줄만 낸다. 전송은 없다.
 * - 손을 뗀 뒤 판정(`askFinalAction`)은 답을 기다리는 중이면 보내지 않고 띠, 429 면 띠, 그 밖은 `onSend(글, 'voice')` 한 번.
 * - 다시 보내기·안내 칩은 같은 검사(`canSendNow`: 바쁨 → 429)를 거친다.
 */
import type { TurnNoticeState } from '@/components/chat/useChatTurn'
import { TALK_HINT } from '@/components/talk/talkCopy'
import { ASK_COPY } from './askCopy'
import { ASK_VOICE_COPY, type AskUnsent } from './askVoiceCopy'
import { askNoticeText, type AskVia } from './logic'
import { askFinalAction } from './voiceView'

/** 429 로 막힌 남은 초(올림). 안 막혔으면 0. */
export function blockedLeftSec(blockedUntil: number | null, now: number): number {
  return blockedUntil !== null && blockedUntil > now ? Math.ceil((blockedUntil - now) / 1000) : 0
}

/** 판정 때 읽는 최신 값 — 훅은 매 호출마다 ref 에서 새로 만든다. */
export interface AskInputSnapshot {
  /** 답 기다림·방 만드는 중·불러오는 중(화면 상태) */
  busy: boolean
  /** 보내기 직전 동기 검사(`turn.isBusy()` 또는 방 만드는 잠금) */
  isBusy: boolean
  blockedUntil: number | null
  notice: TurnNoticeState | null
}

export interface AskInputControlDeps {
  read(): AskInputSnapshot
  now(): number
  onSend(text: string, via: AskVia): void
  toast(msg: string): void
  setUnsent(u: AskUnsent | null): void
  setLocalHint(h: string | null): void
  /** 「중간에 멈춤」 힌트를 숨기는 화면 표지 */
  setCancelled(c: boolean): void
  setOut(o: boolean): void
  sttPress(): void
  sttAbort(): void
}

export interface AskInputControl {
  /** 인식기가 손 뗀 뒤 확정한 글 */
  onFinal(text: string): void
  press(): void
  cancel(): void
  /** 보낼 수 있으면 true, 아니면 이유 토스트 */
  canSendNow(): boolean
  /** 「보내지 못한 말」 띠의 다시 보내기 */
  resend(text: string): void
  /** 취소한 직후(다음 누름 전)인가 */
  isCancelled(): boolean
}

export function makeAskInputControl(d: AskInputControlDeps): AskInputControl {
  let cancelled = false

  const canSendNow = (): boolean => {
    const s = d.read()
    if (s.isBusy) {
      d.toast(ASK_COPY.sendLocked)
      return false
    }
    const left = blockedLeftSec(s.blockedUntil, d.now())
    if (left > 0) {
      d.toast(askNoticeText(s.notice ?? { kind: 'rate', text: '' }, left))
      return false
    }
    return true
  }

  return {
    onFinal: (text) => {
      if (cancelled) return
      const s = d.read()
      const act = askFinalAction(text, { busy: s.busy || s.isBusy, blockedUntil: s.blockedUntil, now: d.now() })
      switch (act.kind) {
        case 'ignore':
          return
        case 'tooShort':
          d.setLocalHint(TALK_HINT.tooShort)
          return
        case 'unsentSelf':
          d.setUnsent({ text: act.text, reason: 'self409' })
          return
        case 'unsent429':
          d.setUnsent({ text: act.text, reason: 429, askReason: s.notice?.reason ?? null, retryAfterSec: s.notice?.retryAfterSec ?? null })
          return
        case 'send':
          d.setUnsent(null)
          d.setLocalHint(null)
          d.onSend(act.text, 'voice')
          return
      }
    },
    press: () => {
      cancelled = false
      d.setCancelled(false)
      d.setLocalHint(null)
      d.sttPress()
    },
    cancel: () => {
      cancelled = true
      d.setCancelled(true)
      d.setOut(false)
      d.sttAbort()
      d.toast(ASK_VOICE_COPY.cancelledToast)
    },
    canSendNow,
    resend: (text) => {
      if (d.read().busy) {
        d.toast(ASK_COPY.sendLocked)
        return
      }
      if (!canSendNow()) return
      d.setUnsent(null)
      d.onSend(text, 'voice')
    },
    isCancelled: () => cancelled,
  }
}
