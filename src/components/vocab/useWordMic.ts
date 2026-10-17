'use client'

/**
 * 단어 추가 시트의 말로 쓰기 훅(task-069) — 수업·질문과 같은 `useRealtimeStt` 를 그대로 쓰고(새 인식 경로 없음), 칸 열기/닫기·결과 전달만 맡는다.
 * 용도는 항상 `MIC_TEST`: 서버·휴대폰 모두 원음을 저장하지 않고 대화 id 도 넘기지 않는다. 알아들은 말은 React 상태에만 있고 로그로 내보내지 않는다.
 * 수업의 `useLessonVoice` 는 재생 큐(`pb`)와 토스트에 묶여 있어 쓰지 않고, 같은 우선순위의 상태 줄 규칙만 `wordMicStatusText` 로 옮겼다.
 */
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { useSpeechConfig } from '@/components/lesson/useLessonVoice'
import { MIC_TEST_COPY, STT_HINT_COPY } from '@/components/speech/sttCopy'
import { transcriptParts, type SttUiError } from '@/components/speech/sttUiState'
import { useRealtimeStt, type SttFinal } from '@/components/speech/useRealtimeStt'
import {
  dismissedAfterRetarget,
  micBlockedCode,
  micClose,
  micFinalStep,
  MIC_REFS_INIT,
  micPress,
  micNoticeAfterFinal,
  micNoticeStep,
  MIC_NOTICES_INIT,
  micToggle,
  visibleMicError,
  wordMicStatusText,
  type MicNotices,
  type MicRefs,
  type MicTargetStep,
  type WordMic,
  type WordMicTarget,
} from './wordMic'

export function useWordMic(o: { onResult: (target: WordMicTarget, text: string) => void }): WordMic {
  const { config } = useSpeechConfig()
  const [target, setTarget] = useState<WordMicTarget | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<SttUiError | null>(null)
  const [announce, setAnnounce] = useState<WordMic['announce']>(null)
  const [notice, setNotice] = useState<MicNotices>(MIC_NOTICES_INIT)
  // 이벤트(누름·뗌·결과)가 읽는 값은 ref — 결과는 비동기로 오므로 그 시점의 칸을 봐야 한다. 갱신 규칙은 `wordMic.ts` 의 순수 함수.
  const refs = useRef<MicRefs>(MIC_REFS_INIT)
  const optsRef = useRef(o)
  useLayoutEffect(() => {
    optsRef.current = o
  })

  const onFinal = useCallback((f: SttFinal) => {
    const { action, refs: next } = micFinalStep(refs.current, f.text)
    if (action.kind === 'ignore') return
    if (action.kind === 'empty') {
      setHint(STT_HINT_COPY.EMPTY_RESULT)
      return
    }
    // 결과가 칸에 들어가면 글자 모드로 돌아온다 — 사용자가 확인·수정한 뒤 저장한다.
    refs.current = next
    setTarget(next.target)
    setAnnounce((prev) => ({ target: action.target, text: action.text, n: (prev?.n ?? 0) + 1 }))
    setNotice((n) => micNoticeAfterFinal(n, action))
    optsRef.current.onResult(action.target, action.text)
  }, [])

  const stt = useRealtimeStt({ purpose: 'MIC_TEST', config, maxSec: 30, onFinal })
  const ui = stt.ui
  const { press: sttPress, release: sttRelease, abort: sttAbort } = stt
  const blocked = micBlockedCode(ui)
  const error = ui.error

  // 열린 칸을 바꾼다(열기·옮기기·닫기). 바뀌면 그때 보이던 오류를 넘긴 것으로 처리해 다음 칸에 새지 않게 한다. 바뀌었으면 true.
  const retarget = useCallback(
    (step: MicTargetStep): boolean => {
      if (step.abort) sttAbort()
      const prev = refs.current.target
      if (step.target === prev) return false
      refs.current = { ...refs.current, target: step.target }
      setTarget(step.target)
      setDismissed((d) => dismissedAfterRetarget(prev, step.target, error, d))
      return true
    },
    [error, sttAbort],
  )

  const toggle = useCallback(
    (t: WordMicTarget) => {
      const step = micToggle(refs.current.target, t, blocked !== null)
      if (!retarget(step)) return
      setHint(null)
      // 다시 말하려고 칸을 열면 지난 결과의 안내는 거둔다.
      const to = step.target
      if (to !== null) setNotice((n) => micNoticeStep(n, { type: 'speak', target: to }))
    },
    [blocked, retarget],
  )

  const close = useCallback(
    (only?: WordMicTarget) => {
      retarget(micClose(refs.current.target, only))
      setNotice((n) => micNoticeStep(n, { type: 'leave', only }))
    },
    [retarget],
  )

  const edited = useCallback((t: WordMicTarget) => setNotice((n) => micNoticeStep(n, { type: 'edited', target: t })), [])

  const press = useCallback(() => {
    refs.current = micPress(refs.current)
    setHint(null)
    sttPress()
  }, [sttPress])

  const { committed, partial } = transcriptParts(ui)
  return {
    target,
    blocked,
    announce,
    notice,
    edited,
    toggle,
    close,
    dismissError: () => setDismissed(error),
    voice: {
      phase: ui.phase,
      recording: ui.phase === 'starting' || ui.phase === 'recording',
      db: ui.db,
      partial: [committed, partial].filter(Boolean).join(''),
      statusText: wordMicStatusText(ui, hint),
      pttLabel: MIC_TEST_COPY.buttonLabel,
      error: visibleMicError(error, dismissed),
      press,
      release: sttRelease,
      abort: sttAbort,
    },
  }
}
