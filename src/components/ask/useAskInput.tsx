'use client'

/**
 * 질문 탭 입력 묶음(task-066 §26-7 B) — 글자 바(Composer)·말 바(VoiceBar)·띠(SttAlert > UnsentBar > TurnNotice)·꼬리 부분 말풍선을 한 곳에서 만들고,
 * 화면(`AskRoom`·`AskNewConversation`)은 `bar`·`strip`·`tail` 을 제자리에 꽂기만 한다. 보낼 글은 검사를 마친 뒤 `onSend(text, via)` 로 넘긴다
 * — 방 만들기(#28)·턴(#32)은 화면 몫이고, 말로 보낼 때 옵션은 `askSendOptions('voice')`(발화 id 없음).
 *
 * 말 모드는 회화와 같은 실시간 인식(`useRealtimeStt`)을 쓰되 티켓 용도는 수업 「말로 쓰기」와 같은 점검 용도다 — 서버·휴대폰 모두 녹음을 남기지 않고,
 * 대화 id 도 넘기지 않는다(§26-1 L1). 인식된 글은 화면 상태에만 있고 콘솔·로그로 내보내지 않는다.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { readStore, writeStore } from '@/components/common/storage'
import { useNativeEnv } from '@/components/common/useNativeEnv'
import { useCountdown } from '@/components/common/useNow'
import Composer, { type ComposerHandle } from '@/components/chat/Composer'
import { KEYS } from '@/components/chat/storageKeys'
import TurnNotice from '@/components/chat/TurnNotice'
import type { RestoreInfo, TurnNoticeState } from '@/components/chat/useChatTurn'
import { useSpeechConfig } from '@/components/lesson/useLessonVoice'
import { STT_HINT_COPY, STT_SWITCH_TOAST } from '@/components/speech/sttCopy'
import { elapsedSec, showAskPermission, transcriptParts, type SttUiError } from '@/components/speech/sttUiState'
import { useRealtimeStt, type SttFinal } from '@/components/speech/useRealtimeStt'
import LiveUtteranceBubble from '@/components/talk/LiveUtteranceBubble'
import SttAlert from '@/components/talk/SttAlert'
import { TALK_TOAST } from '@/components/talk/talkCopy'
import UnsentBar from '@/components/talk/UnsentBar'
import VoiceBar from '@/components/talk/VoiceBar'
import type { SttRoute } from '@/modules/speech/stt/client'
import { ASK_COPY } from './askCopy'
import { makeAskInputControl } from './askInputControl'
import { ASK_VOICE_COPY, askUnsentBarReason, askUnsentCanResend, askUnsentReasonOf, askUnsentText, type AskUnsent } from './askVoiceCopy'
import { ASK_KEYS, askNoticeText, type AskVia } from './logic'
import { ASK_INPUT_MODE_SERVER, askIdleHint, askModeOf, askShowSttAlert, askVoiceView, type AskInputMode } from './voiceView'

export type { AskVia, AskInputMode }

export interface AskInputOptions {
  /** Composer 초안 키 — 대화 id 또는 'ask-new' */
  draftKey: string
  /** 답 기다림(sending|streaming|detached) · 방 만드는 중 · 불러오는 중 */
  busy: boolean
  /** 글자 바 잠금 문구(§26-6 표) */
  busyReason: string
  /** 보내기 직전 동기 검사(turn.isBusy 또는 creatingRef) */
  isBusy: () => boolean
  blockedUntil: number | null
  /** turn.notice — 글자로 보낸 것의 안내 줄 */
  notice: TurnNoticeState | null
  clearNotice: () => void
  placeholder: string
  /** 검사가 끝난 글 — 화면이 #28/#32 로 보낸다 */
  onSend: (text: string, via: AskVia) => void
  toast: (msg: string) => void
  /** 말 바 잠금 상태 줄(선택) — 없으면 「답을 받은 뒤 말할 수 있어요」. `?chat=` 불러오는 중엔 「대화를 불러오고 있어요」(§26-5 B). */
  voiceBusyText?: string
}

export interface AskInputApi {
  bar: ReactNode
  strip: ReactNode | null
  tail: ReactNode | null
  mode: AskInputMode
  /** ⋯ 메뉴 「알아듣는 곳」 */
  route: SttRoute
  /** 안내 칩 — busy·429 검사 후 onSend(text,'text'). 보냈으면 true(화면이 그때만 목록에 초점). */
  sendChip: (text: string) => boolean
  /** [고쳐서 묻기]·[글자로 고치기] — 글자 모드 + 입력창 덮어 채움·초점 */
  fixAsk: (text: string) => void
  fill: (text: string) => void
  focus: () => void
  /** useChatTurn.restoreText */
  onRestore: (text: string, info?: RestoreInfo) => void
}

// ── 입력 모드 기억(세션, 질문 탭 전용 키 — 회화와 따로 §26-7 A) ─────────────────────────
// 서버 그림은 늘 글자 모드(수화 불일치 없이) — 수화 뒤 저장된 모드로 다시 그린다. 자리표시(AskTabSkeleton)도 같은 훅을 쓸 수 있다.
const modeListeners = new Set<() => void>()
function subscribeMode(fn: () => void): () => void {
  modeListeners.add(fn)
  return () => {
    modeListeners.delete(fn)
  }
}
function readMode(): AskInputMode {
  return askModeOf(readStore('session', ASK_KEYS.inputMode))
}
export function writeAskInputMode(m: AskInputMode): void {
  writeStore('session', ASK_KEYS.inputMode, m)
  for (const fn of modeListeners) fn()
}
export function useAskInputMode(): AskInputMode {
  return useSyncExternalStore(subscribeMode, readMode, () => ASK_INPUT_MODE_SERVER)
}

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}

const noop = () => undefined

export function useAskInput(o: AskInputOptions): AskInputApi {
  const composerRef = useRef<ComposerHandle | null>(null)
  const optsRef = useRef(o)
  useLayoutEffect(() => {
    optsRef.current = o
  })
  const { draftKey, blockedUntil, notice, toast, onSend } = o
  const mode = useAskInputMode()
  const native = useNativeEnv().native

  const [unsent, setUnsent] = useState<AskUnsent | null>(null)
  const [localHint, setLocalHint] = useState<string | null>(null)
  const [out, setOut] = useState(false)
  /** 사용자가 밀어서/Esc 로 취소한 직후 — 「중간에 멈춤」 힌트를 숨긴다. 다음 누름에서 풀린다. */
  const [cancelled, setCancelled] = useState(false)
  const [dismissedSttError, setDismissedSttError] = useState<SttUiError | null>(null)
  const focusTextRef = useRef(false)

  /* ── 실시간 인식(점검 용도 — 녹음 저장 없음, 대화 id 없음) ─────────────────────────── */

  const { config } = useSpeechConfig()
  // 보내기·취소·손 뗀 뒤 판정은 `askInputControl` 이 정한다(시험이 가짜 의존으로 잠근다). 인식기는 컨트롤러보다 뒤에 만들어져 ref 로 부른다.
  const sttApiRef = useRef<{ press: () => void; abort: () => void }>({ press: noop, abort: noop })
  // eslint-disable-next-line react-hooks/refs -- 아래 클로저의 ref 읽기는 이벤트·콜백(손 뗌·누름·취소)에서만 일어난다. 렌더 중에는 읽지 않는다.
  const [control] = useState(() =>
    makeAskInputControl({
      read: () => {
        const c = optsRef.current
        return { busy: c.busy, isBusy: c.isBusy(), blockedUntil: c.blockedUntil, notice: c.notice }
      },
      now: Date.now,
      onSend: (text, via) => optsRef.current.onSend(text, via),
      toast: (msg) => optsRef.current.toast(msg),
      setUnsent,
      setLocalHint,
      setCancelled,
      setOut,
      sttPress: () => sttApiRef.current.press(),
      sttAbort: () => sttApiRef.current.abort(),
    }),
  )
  const onFinal = useCallback((f: SttFinal) => control.onFinal(f.text), [control])
  const stt = useRealtimeStt({ purpose: 'MIC_TEST', config, maxSec: 30, onFinal })
  const sttUi = stt.ui
  const { release: sttRelease, abort: sttAbort } = stt
  useLayoutEffect(() => {
    sttApiRef.current = { press: stt.press, abort: stt.abort }
  })

  // 휴대폰 → 서버 전환 안내 1회(회화와 같음) · 30초 자동 멈춤은 상태 줄이 곧 「답을 받은 뒤…」로 바뀌어 보이지 않으므로 토스트.
  const switchNotice = stt.switchNotice
  useEffect(() => {
    if (switchNotice > 0) optsRef.current.toast(STT_SWITCH_TOAST)
  }, [switchNotice])
  const sttHint = sttUi.hint
  const prevHintRef = useRef(sttHint)
  useEffect(() => {
    if (sttHint === 'AUTO_STOPPED' && prevHintRef.current !== 'AUTO_STOPPED') optsRef.current.toast(STT_HINT_COPY.AUTO_STOPPED)
    prevHintRef.current = sttHint
  }, [sttHint])

  const press = control.press
  const release = useCallback(() => sttRelease(), [sttRelease])
  // 버튼에 넘기는 묶음은 한 번만 만든다(매 렌더 새 객체면 버튼 핸들러가 매번 바뀐다).
  const [cancelOutside] = useState(() => ({ onCancel: control.cancel, onOutChange: setOut }))

  /* ── 모드 ─────────────────────────────────────────────────────────── */

  const recordingLike = sttUi.phase === 'starting' || sttUi.phase === 'recording' || sttUi.phase === 'finishing'
  const toText = useCallback(() => {
    if (recordingLike) {
      toast(TALK_TOAST.modeWhileRecording)
      return
    }
    focusTextRef.current = true
    writeAskInputMode('text')
  }, [recordingLike, toast])
  const toVoice = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    writeAskInputMode('voice')
  }, [])
  // 사용자가 글자 모드를 고른 경우에만 입력창 초점(키보드가 뜨는 것은 사용자가 고른 동작).
  useEffect(() => {
    if (mode === 'text' && focusTextRef.current) {
      focusTextRef.current = false
      composerRef.current?.focus()
    }
  }, [mode])

  /* ── 보내기·되돌리기 ───────────────────────────────────────────────── */

  const sendText = useCallback(
    (text: string) => {
      // Composer 는 보낸 뒤 300ms 뒤에 초안을 비운다 — 빈 대화는 그 안에 AskRoom 으로 바뀌어(언마운트) 옛 글이 남을 수 있어 여기서 먼저 비운다(§26-15 Q-6).
      writeStore('session', KEYS.draft(draftKey), null)
      onSend(text, 'text')
    },
    [draftKey, onSend],
  )

  /** 안내 칩 — 바쁨·429 검사(`control.canSendNow`) 뒤에 글자로 보낸다. */
  const sendChip = useCallback(
    (text: string): boolean => {
      if (!control.canSendNow()) return false
      onSend(text, 'text')
      return true
    },
    [control, onSend],
  )

  const fill = useCallback((text: string) => composerRef.current?.fill(text), [])
  const focus = useCallback(() => composerRef.current?.focus(), [])
  const fixAsk = useCallback((text: string) => {
    focusTextRef.current = false
    writeAskInputMode('text')
    // 글자 모드로 바뀐 뒤 그려지는 입력창에 채운다(말 모드였으면 다음 틱에 입력창이 생긴다).
    setTimeout(() => composerRef.current?.fill(text), 0)
  }, [])

  const onRestore = useCallback((text: string, info?: RestoreInfo) => {
    if (info?.opts.inputSource !== 'REALTIME_STT') {
      const c = composerRef.current
      if (c) c.restore(text)
      else {
        // 말 모드로 바꾼 뒤 거절이 오면 입력창이 없다 — 초안에 남겨 글자 모드에서 보이게(비어 있을 때만, Composer.restore 와 같은 규칙).
        const key = KEYS.draft(optsRef.current.draftKey)
        if ((readStore('session', key) ?? '').trim() === '') writeStore('session', key, text)
      }
      return
    }
    const d = info.details
    setUnsent({
      text,
      reason: askUnsentReasonOf(info.status),
      askReason: typeof d.reason === 'string' ? d.reason : null,
      retryAfterSec: typeof d.retryAfterSec === 'number' ? d.retryAfterSec : null,
      serverMessage: info.status === 400 ? info.message : null,
    })
  }, [])

  /* ── 그리기 ───────────────────────────────────────────────────────── */

  const rateLeft = useCountdown(blockedUntil)
  const view = askVoiceView({
    sttPhase: sttUi.phase,
    busy: o.busy,
    out,
    askPermission: showAskPermission(sttUi),
    slowConnect: sttUi.slow,
    quiet: sttUi.hint === 'TOO_QUIET',
    recordingSec: elapsedSec(sttUi),
    rateLimitedSec: blockedUntil !== null ? (rateLeft ?? 0) : null,
    rateReason: notice?.reason ?? null,
    hint: askIdleHint({ localHint, sttHint: sttUi.hint, cancelled, rationale: sttUi.rationale, hasError: !!sttUi.error }),
    busyText: o.voiceBusyText ?? null,
  })

  const bar =
    mode === 'voice' ? (
      <VoiceBar
        view={view}
        db={sttUi.db}
        onPress={press}
        onRelease={release}
        onAbort={sttAbort}
        onKeyboard={toText}
        onStop={noop}
        cancelOutside={cancelOutside}
        safeBottom={false}
        keyboardLabel={ASK_VOICE_COPY.toText}
      />
    ) : (
      <Composer
        chatId={draftKey}
        lang="ko"
        inputLabel={ASK_COPY.inputLabel}
        busy={o.busy}
        busyReason={o.busyReason}
        blockedUntil={blockedUntil}
        placeholder={o.placeholder}
        onSend={sendText}
        onBlocked={toast}
        handleRef={composerRef}
        safeBottom={false}
        leading={
          <button type="button" aria-label={ASK_VOICE_COPY.toVoice} onClick={toVoice} className="grid h-11 w-11 flex-none place-items-center rounded-full text-ink2">
            <MicIcon />
          </button>
        }
      />
    )

  // 띠는 하나만(§26-8 A): 인식 오류 > 보내지 못한 말 > 안내 줄. 인식 오류는 말 모드에서만 — 글자로 묻는 사람에게 마이크 오류를 먼저 보이지 않는다.
  const sttError = sttUi.error
  const showSttAlert = askShowSttAlert(mode, sttError, dismissedSttError)
  let strip: ReactNode = null
  if (showSttAlert && sttError) {
    strip = (
      <div className="flex-none px-4 pb-2 pt-1">
        <SttAlert
          code={sttError.code}
          retryAfterSec={sttError.retryAfterSec}
          mountCheck={sttError.mountCheck}
          switched={sttError.switched}
          offlineMode={sttError.offlineMode}
          native={native}
          textMode={false}
          textModeLabel={ASK_VOICE_COPY.toText}
          onTextMode={() => {
            setDismissedSttError(sttError)
            focusTextRef.current = true
            writeAskInputMode('text')
          }}
          onClose={() => setDismissedSttError(sttError)}
        />
      </div>
    )
  } else if (unsent) {
    const u = unsent
    strip = (
      <div className="flex-none px-4 pb-2 pt-1">
        <UnsentBar
          unsent={{ text: u.text, reason: askUnsentBarReason(u), serverMessage: u.serverMessage ?? null }}
          blockedUntil={blockedUntil}
          textOf={(_reason, x) => askUnsentText(u, x.retrySec)}
          canResend={askUnsentCanResend(u, rateLeft)}
          onResend={() => control.resend(u.text)}
          onEdit={() => {
            setUnsent(null)
            fixAsk(u.text)
          }}
          onDiscard={() => {
            setUnsent(null)
            o.clearNotice()
          }}
        />
      </div>
    )
  } else if (notice) {
    strip = (
      <div className="flex-none">
        <TurnNotice notice={notice} blockedUntil={blockedUntil} onClose={o.clearNotice} textOf={askNoticeText} notFoundLink={{ href: '/ask', label: ASK_COPY.toList }} />
      </div>
    )
  }

  const phase = sttUi.phase
  let tail: ReactNode = null
  if (mode === 'voice' && (phase === 'starting' || phase === 'recording' || phase === 'finishing')) {
    const { committed, partial } = transcriptParts(sttUi)
    const live = `${committed}${partial}`
    tail =
      phase === 'finishing' ? (
        <LiveUtteranceBubble kind="recognizing" partial={live} />
      ) : (
        <LiveUtteranceBubble kind="listening" partial={live} out={out} caption={out ? ASK_VOICE_COPY.out : ASK_VOICE_COPY.cancelHint} />
      )
  }

  return { bar, strip, tail, mode, route: stt.route, sendChip, fixAsk, fill, focus, onRestore }
}
