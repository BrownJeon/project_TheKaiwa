'use client'

/**
 * ⑤ 말하기(screens §12-2 J · 데모 v2 `#l5`·`#l5-ok`·`#l5-miss`·`#l5-text`·`#l5-denied`·`#l5-fail`·`#l5-donefail`).
 * 판정은 서버 코드(#62b, AI 채점 없음). 음성 = `useRealtimeStt(TURN, chatId 없음)` → final → #62b `{itemId, text, utteranceId}`,
 * 글자 = 입력 바 → #62b `{itemId, text}`. 과제는 몇 번이든 다시(서버는 마지막 시도로). 세 과제 모두 결과(또는 건너뜀)가 있으면 [수업 마치기] → #62.
 * 이 화면은 본문 스크롤과 아래 입력 영역을 함께 그린다(입력 영역은 스크롤 밖 고정).
 * task-077(§34): 아래 입력 영역은 회화방 공용 부품 — 말 = `VoiceBar`(레슨 view·문구는 `lessonVoiceView`), 글자 = `Composer`(레슨 초안 키·Enter 확인·「확인하기」),
 * 일본어 도우미(#184, 회화방 §22 와 같은 자리·동작) · 「내가 한 말」 한국어 뜻(#185, `useSpeakTranslation`). 판 + 바 높이는 수업 화면 토스트 바닥으로 올린다.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { apiPost } from '@/components/common/api'
import { OFF, useAnnotations, type AnnotationState } from '@/components/common/japanese/annotations'
import { HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import { Btn, Card } from '@/components/common/ui'
import Composer, { type ComposerHandle } from '@/components/chat/Composer'
import { STT_HINT_COPY } from '@/components/speech/sttCopy'
import PhraseHelperButton from '@/components/talk/PhraseHelperButton'
import PhraseHelperPanel from '@/components/talk/PhraseHelperPanel'
import PhraseHelperTip, { HELPER_TIP_ID } from '@/components/talk/PhraseHelperTip'
import { claimHelperTip, helperLockToast, lessonHelperLockReason } from '@/components/talk/phraseHelperLogic'
import SttAlert from '@/components/talk/SttAlert'
import { phraseHelpRequest, usePhraseHelper } from '@/components/talk/usePhraseHelper'
import VoiceBar from '@/components/talk/VoiceBar'
import { isNativeApp } from '@/modules/infra/native'
import type { SttClientConfig } from '@/modules/speech/stt/client'
import type { LessonContent, LessonDto, SpeakingResult } from '@/types/lesson'
import { U4, U5 } from './lessonCopy'
import { lessonVoiceView, taskSentenceHidden } from './lessonVoiceView'
import { ExprChip, PlayWide, targetsOf } from './parts'
import { runSpeakCheck } from './speakCheck'
import SpeakTranslation from './SpeakTranslation'
import { translationPlan } from './speakTranslation'
import type { LessonPlayback } from './useLessonPlayback'
import type { UseLesson } from './useLesson'
import { LESSON_KEYS } from './useLessonCreate'
import { useLessonVoice } from './useLessonVoice'
import { useSpeakTranslation, type SpeakTrCache } from './useSpeakTranslation'

/** 말 바 상태 줄 id — 지금 레슨 DOM id 그대로(누르고 말하기 `aria-describedby`). */
export const LESSON_VOICE_STATUS_ID = 'lesson-voice-status'

interface ItemResult {
  text: string
  via: 'voice' | 'text'
  used: boolean
  matchedIds: string[]
  missedIds: string[]
  unknownIds: string[]
  utteranceId: string | null
  hasAudio: boolean
  skipped?: boolean
  /** 시도 번호 — 같은 글을 다시 말해도 새 결과로 보고 뜻을 다시 맞춘다(불러온 결과는 0). */
  seq: number
}

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}

export default function StageSpeak({
  lesson,
  st,
  pb,
  reviewing,
  config,
  textFirst,
  onToast,
  onDone,
  reviewNote,
  footer,
  toastOpen,
  onBottomHeight,
  trCache,
}: {
  lesson: LessonDto & { content: LessonContent }
  st: UseLesson
  pb: LessonPlayback
  reviewing: boolean
  config: SttClientConfig | null
  textFirst: boolean
  onToast: (m: string) => void
  onDone: () => Promise<void>
  reviewNote: React.ReactNode
  footer: React.ReactNode
  /** 수업 화면 토스트가 떠 있는가 — 도우미 처음 한 번 안내를 잠깐 숨긴다(§22-4). */
  toastOpen: boolean
  /** 하단 묶음(도우미 판 + 입력 바) 실제 높이 — 입력 영역이 없으면(다시 보기) null. 수업 화면이 토스트 바닥으로 쓴다(B8 A). */
  onBottomHeight: (h: number | null) => void
  /** 「내가 한 말」 한국어 뜻 메모리(수업 화면 동안) */
  trCache: SpeakTrCache
}) {
  const content = lesson.content
  const items = content.speaking
  const [results, setResults] = useState<Record<string, ItemResult>>(() => {
    const out: Record<string, ItemResult> = {}
    for (const r of lesson.progress.speaking ?? []) {
      out[r.itemId] = { text: r.text, via: r.utteranceId ? 'voice' : 'text', used: r.missedIds.length === 0 && r.matchedIds.length > 0, matchedIds: r.matchedIds, missedIds: r.missedIds, unknownIds: [], utteranceId: r.utteranceId, hasAudio: !!r.utteranceId, seq: 0 }
    }
    return out
  })
  const firstOpen = items.findIndex((s) => !results[s.id])
  const [idx, setIdx] = useState(firstOpen === -1 ? items.length - 1 : firstOpen)
  const [textMode, setTextMode] = useState(textFirst)
  const [checking, setChecking] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState(false)
  const [dismissed, setDismissed] = useState<unknown>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLParagraphElement>(null)
  const targetsLabelRef = useRef<HTMLParagraphElement>(null)
  const composerRef = useRef<ComposerHandle | null>(null)
  const attemptRef = useRef(0)
  /** 도우미 훅은 음성 훅 뒤에 만들어져(잠금이 음성 상태를 본다) 확인 함수가 직접 부를 수 없다 — 최신 취소·닫기를 여기 둔다(회화방과 같은 방식). */
  const helperOpsRef = useRef<{ cancelPending: () => boolean; close: () => void }>({ cancelPending: () => false, close: () => undefined })
  const [focusResult, setFocusResult] = useState(0)
  const item = items[idx]
  const res = results[item.id]
  const draftKey = LESSON_KEYS.speakDraft(lesson.id, item.id)
  // 목표 표현·모범 답안·내가 한 말을 한 묶음으로(task-026 §15-4-7). 녹음 중 자막은 달지 않는다.
  const annTexts = [
    ...items.flatMap((s) => targetsOf(content, s.targetIds).map((t) => t.ja)),
    ...items.map((s) => s.modelAnswerJa),
    ...items.map((s) => (results[s.id] && !results[s.id].skipped ? results[s.id].text : '')),
  ]
  const annList = useAnnotations(annTexts)
  const annOf = (text: string): AnnotationState => annList[annTexts.indexOf(text)] ?? OFF

  useEffect(() => {
    if (textFirst) queueMicrotask(() => setTextMode(true))
  }, [textFirst])
  useEffect(() => {
    if (!focusResult) return
    cardRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    resultRef.current?.focus()
  }, [focusResult])

  /** `raw` = 글자 입력의 원문 — 입력창은 보내는 순간 비므로 확인하지 못하면 되돌린다. */
  const check = async (text: string, via: 'voice' | 'text', utteranceId: string | null, raw?: string) => {
    if (checking || reviewing) {
      if (raw !== undefined) composerRef.current?.restore(raw)
      return
    }
    setChecking(true)
    const path = `/api/v1/lessons/${encodeURIComponent(lesson.id)}/speaking`
    try {
      // 순서(도우미 접기 → #62b → 판 닫기 / 실패 시 원문 되돌리기)는 `runSpeakCheck` — §34-5.
      const out = await runSpeakCheck(
        { itemId: item.id, text, utteranceId, raw },
        {
          post: (body) => apiPost<SpeakingResult>(path, body),
          cancelHelper: () => void helperOpsRef.current.cancelPending(),
          closeHelper: () => helperOpsRef.current.close(),
          restore: (t) => composerRef.current?.restore(t),
        },
      )
      if (!out.ok) {
        if (out.err.status === 409) void st.reload()
        onToast(U5.checkFail)
        return
      }
      const r = out.result
      const seq = ++attemptRef.current
      setResults((prev) => ({ ...prev, [item.id]: { text, via, used: r.used, matchedIds: r.matchedIds, missedIds: r.missedIds, unknownIds: r.unknownIds, utteranceId: r.utteranceId, hasAudio: r.hasAudio, seq } }))
      st.update((prev) => ({
        ...prev,
        speaking: [...(prev.speaking ?? []).filter((x) => x.itemId !== item.id), { itemId: item.id, text, matchedIds: r.matchedIds, missedIds: r.missedIds, utteranceId: r.utteranceId, at: new Date().toISOString() }],
      }))
      setFocusResult((n) => n + 1)
    } finally {
      setChecking(false)
    }
  }

  const voice = useLessonVoice({
    purpose: 'TURN',
    config,
    pb,
    hadResult: !!res,
    onToast,
    onFinal: (f) => {
      const t = f.text.trim()
      if (!t) return voice.setHint(STT_HINT_COPY.EMPTY_RESULT)
      void check(t, 'voice', f.utteranceId)
    },
  })

  const allDone = items.every((s) => !!results[s.id])
  const last = idx === items.length - 1
  const finish = async () => {
    if (finishing) return
    setFinishing(true)
    setFinishError(false)
    try {
      await onDone()
    } catch {
      setFinishError(true)
    } finally {
      setFinishing(false)
    }
  }

  const err = voice.error && voice.error !== dismissed ? voice.error : null
  const targets = targetsOf(content, item.targetIds)
  const missedLabels = res ? targets.filter((t) => res.missedIds.includes(t.id)).map((t) => t.ja) : []
  const modelKey = `s:${idx}`
  const mineKey = `me:${idx}`
  const sendText = (raw: string) => {
    const t = raw.trim()
    if (!t) return
    void check(t, 'text', null, raw)
  }

  /* ── 일본어 도우미(#184, §34-5 — 회화방 §22 와 같은 자리·동작) ───────────────── */

  // 잠김 = 말하는 중(시작·녹음·인식) + 답을 확인하는 중(B5 A). 훅의 `recording` 도 같은 값으로 입력·[물어보기]·카드 버튼을 잠근다.
  const lockWhy = lessonHelperLockReason(voice.phase, checking)
  const helperLock = lockWhy !== null
  const helperRequest = useMemo(() => phraseHelpRequest(`/api/v1/lessons/${encodeURIComponent(lesson.id)}/phrase-help`), [lesson.id])
  const helper = usePhraseHelper({
    request: helperRequest,
    recording: helperLock,
    roomSounding: pb.snapshot.phase === 'playing',
    stopOthers: () => pb.stop(),
  })
  const { cancelPending: cancelHelperPending, close: closeHelper } = helper
  useEffect(() => {
    helperOpsRef.current = { cancelPending: cancelHelperPending, close: closeHelper }
  }, [cancelHelperPending, closeHelper])
  const helperBtnRef = useRef<HTMLButtonElement>(null)
  const focusHelperBtnRef = useRef(false)
  // ✕·Esc 로 닫으면 초점은 도우미 버튼으로 — 입력 중에는 버튼이 그려지지 않으므로 다시 그려진 뒤에 옮긴다.
  useEffect(() => {
    if (helper.open || helper.typing || !focusHelperBtnRef.current) return
    focusHelperBtnRef.current = false
    helperBtnRef.current?.focus()
  }, [helper.open, helper.typing])
  // [입력창에 넣기]로 닫으면 초점은 입력창으로 — 누르는 순간 입력창은 아직 숨겨져 있어(`hidden`) 다시 그려진 뒤에 옮긴다.
  const focusComposerRef = useRef(false)
  useEffect(() => {
    if (helper.open || helper.typing || !focusComposerRef.current) return
    focusComposerRef.current = false
    composerRef.current?.focus()
  }, [helper.open, helper.typing])
  // 처음 한 번 안내 — 말 모드 입력 바가 처음 그려진 뒤 한 번 판정(회화방과 같은 저장 키, B7 A). 인식 설정을 읽기 전에는 판정하지 않는다(글자로 시작할 수 있음).
  const [tipOpen, setTipOpen] = useState(false)
  const tipClaimRef = useRef<boolean | null>(null)
  const voiceBarReady = !reviewing && !textMode && (config !== null || textFirst)
  useEffect(() => {
    if (!voiceBarReady || tipClaimRef.current !== null) return
    tipClaimRef.current = claimHelperTip()
    if (tipClaimRef.current) setTipOpen(true)
  }, [voiceBarReady])
  // 잠긴 버튼 토스트는 녹음 중이면 끝난 뒤에(회화방 규칙 — 낭독이 마이크에 섞이지 않게).
  const deferredLockToastRef = useRef<string | null>(null)
  useEffect(() => {
    if (voice.recording || deferredLockToastRef.current === null) return
    const m = deferredLockToastRef.current
    deferredLockToastRef.current = null
    onToast(m)
  }, [voice.recording, onToast])
  // 판을 열 때 과제 문장(카드 머리 ~ 「목표 표현」)이 본문에서 가려져 있으면 카드 머리로 한 번 맞춘다(B8 A). 보이면 그대로.
  const alignOnOpenRef = useRef(false)
  useLayoutEffect(() => {
    if (!helper.shown || !alignOnOpenRef.current) return
    alignOnOpenRef.current = false
    const view = scrollRef.current?.getBoundingClientRect()
    const card = cardRef.current?.getBoundingClientRect()
    const label = targetsLabelRef.current?.getBoundingClientRect()
    if (view && card && label && taskSentenceHidden({ viewTop: view.top, viewBottom: view.bottom, top: card.top, bottom: label.bottom })) cardRef.current?.scrollIntoView({ block: 'start' })
  }, [helper.shown])

  const tipShown = tipOpen && !helper.open && !helperLock && !err && !toastOpen && !textMode
  const toggleHelper = () => {
    if (helper.open) {
      helper.close()
      return
    }
    setTipOpen(false)
    alignOnOpenRef.current = true
    helper.setOpen(true)
  }
  const closeHelperToButton = () => {
    focusHelperBtnRef.current = true
    helper.close()
  }
  const helperButton = (
    <PhraseHelperButton
      open={helper.shown}
      locked={helperLock}
      describedBy={tipShown ? HELPER_TIP_ID : undefined}
      buttonRef={helperBtnRef}
      onToggle={toggleHelper}
      onLocked={() => {
        const m = helperLockToast(lockWhy)
        if (voice.recording) deferredLockToastRef.current = m
        else onToast(m)
      }}
    />
  )

  /* ── 「내가 한 말」 한국어 뜻(#185, §34-4) ───────────────────────────── */

  const trPlan = translationPlan(res, item.modelAnswerJa, item.modelKo)
  const tr = useSpeakTranslation({
    lessonId: lesson.id,
    target: res && trPlan.kind !== 'skip' ? { key: `${item.id}:${res.seq}`, text: res.text, plan: trPlan } : null,
    paused: helperLock,
    cache: trCache,
  })

  /* ── 입력 영역 ───────────────────────────────────────────────────── */

  const view = lessonVoiceView({ phase: voice.phase, statusText: voice.statusText, pttLabel: voice.pttLabel, checking, playing: pb.snapshot.phase === 'playing' })
  const onPress = () => {
    helper.stopSound()
    // 말하기를 시작하면 도우미 요청을 접는다(판이 열려 있든 닫혀 있든 — 회화방과 같음).
    helper.cancelPending()
    voice.press()
  }
  // ⌨ 로 바꾸면 입력창에 초점(키보드 — 사용자가 고른 동작, 회화방과 같음). 처음부터 글자 모드로 열릴 때는 주지 않는다(§34-3).
  const focusTextRef = useRef(false)
  useEffect(() => {
    if (textMode && focusTextRef.current) {
      focusTextRef.current = false
      composerRef.current?.focus()
    }
  }, [textMode])
  const toText = () => {
    focusTextRef.current = true
    setTextMode(true)
  }
  // 다음 과제로 가면 도우미 판을 닫는다(결과는 기억). 대기 중 번역 요청은 대상이 바뀌어 끊긴다.
  const goNext = () => {
    helper.close()
    setIdx(idx + 1)
  }
  // 하단 묶음(판 + 바) 높이 → 수업 화면 토스트 바닥(B8 A). 입력 영역이 없는 다시 보기는 null(지금 값).
  const stackRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = stackRef.current
    if (!el) {
      onBottomHeight(null)
      return
    }
    const report = () => onBottomHeight(el.getBoundingClientRect().height)
    report()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => ro.disconnect()
  }, [onBottomHeight, reviewing])

  return (
    <>
      <div ref={scrollRef} aria-live={voice.recording ? 'off' : undefined} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-3.5">
        {reviewNote}
        <h2 tabIndex={-1} data-stage-title className="text-[17px] font-bold outline-none">
          {U5.title(items.length)}
        </h2>
        <p className="mt-1 text-[13px] text-ink2 break-keep">{U5.desc}</p>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="text-[14px] font-bold">{U5.counter(idx + 1, items.length)}</span>
          <div aria-hidden="true" className="flex gap-1">
            {items.map((s, k) => {
              const r = results[s.id]
              const cls = r ? (r.skipped || !r.used ? 'bg-surface ring-1 ring-line ring-inset' : 'bg-good-soft font-semibold text-good') : k === idx ? 'bg-surface font-semibold ring-2 ring-accent ring-inset' : 'bg-surface2 text-ink2'
              return (
                <span key={s.id} className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${cls}`}>
                  {r ? (r.used && !r.skipped ? '✓' : '△') : k + 1}
                </span>
              )
            })}
          </div>
        </div>
        {reviewing ? (
          <div className="mt-2 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
            {items.map((s, k) => (
              <button key={s.id} type="button" onClick={() => setIdx(k)} className={`h-11 rounded-xl text-[13px] font-semibold ${k === idx ? 'bg-surface2' : 'border border-line bg-surface'}`}>
                {U5.task(k + 1)}
              </button>
            ))}
          </div>
        ) : null}
        <div ref={cardRef} className="scroll-mt-3">
          <Card className="mt-2">
            <p className="text-[16px] font-semibold break-keep [overflow-wrap:anywhere]">{item.promptKo}</p>
            <p ref={targetsLabelRef} className="mt-2 text-[12px] text-ink2">
              {U5.targets}
            </p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {targets.map((t) => {
                const hit = !!res && res.matchedIds.includes(t.id)
                const miss = !!res && res.missedIds.includes(t.id)
                return (
                  <ExprChip
                    key={t.id}
                    ja={t.ja}
                    ko={t.ko}
                    ann={annOf(t.ja)}
                    tone={hit ? 'good' : 'plain'}
                    tail={hit ? <span className="text-[12px] font-bold text-good">{U5.used}</span> : miss ? <span className="text-[12px] text-ink2">{U5.notYet}</span> : null}
                  />
                )
              })}
            </ul>
            {err && !textMode ? (
              <div className="mt-2.5">
                <SttAlert
                  code={err.code}
                  retryAfterSec={err.retryAfterSec}
                  mountCheck={err.mountCheck}
                  switched={err.switched}
                  offlineMode={err.offlineMode}
                  native={isNativeApp()}
                  textMode={textMode}
                  textModeLabel={U5.textMode}
                  onTextMode={() => {
                    setDismissed(voice.error)
                    setTextMode(true)
                  }}
                  onClose={() => setDismissed(voice.error)}
                />
              </div>
            ) : null}
            {res ? (
              <>
                <p className="mt-3 text-[12px] font-semibold text-ink2">{res.skipped ? '' : res.via === 'voice' ? U5.said : U5.wrote}</p>
                {res.skipped ? (
                  <p className="text-[13px] text-ink2">{U5.skipped}</p>
                ) : (
                  <div className="mt-1 inline-block max-w-full rounded-[14px] bg-accent-soft px-3 py-2">
                    <JaText text={res.text} state={annOf(res.text)} className="text-[17px] text-ink [overflow-wrap:anywhere]" />
                    {/* 말풍선 안, 위 여백 0(MOV ⑨) */}
                    <HangulLine state={annOf(res.text)} size={13} onTint className="!mt-0" />
                    <SpeakTranslation state={tr.state} via={res.via} onRetry={tr.retry} />
                  </div>
                )}
                {res.utteranceId && res.hasAudio && !pb.textOnly ? (
                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        pb.active(mineKey)
                          ? pb.stop()
                          : pb.playMine(mineKey, res.utteranceId as string, () => {
                              onToast(U5.noAudio)
                              setResults((prev) => ({ ...prev, [item.id]: { ...res, hasAudio: false } }))
                            })
                      }
                      className="inline-flex h-11 items-center text-[13px] font-medium underline underline-offset-4"
                    >
                      {pb.active(mineKey) ? U5.stop : U5.myVoice}
                    </button>
                  </div>
                ) : null}
                {!res.skipped ? (
                  <p ref={resultRef} tabIndex={-1} role="status" className={`mt-2 text-[14px] font-semibold outline-none break-keep [overflow-wrap:anywhere] ${res.used ? 'text-good' : 'text-ink'}`}>
                    {res.used ? (
                      U5.allUsed
                    ) : (
                      <>
                        {U5.missed('')}
                        <span lang="ja">{missedLabels.join(', ')}</span>
                      </>
                    )}
                  </p>
                ) : null}
                <div className="mt-2 rounded-xl bg-surface2 px-3 py-2.5">
                  <p className="text-[12px] font-semibold text-good">{U4.model}</p>
                  <JaText text={item.modelAnswerJa} state={annOf(item.modelAnswerJa)} className="text-[17px] [overflow-wrap:anywhere]" />
                  <HangulLine state={annOf(item.modelAnswerJa)} size={13} />
                  <p className="text-[13px] text-ink2 break-keep">{item.modelKo}</p>
                  {!pb.textOnly ? (
                    <PlayWide playing={pb.active(modelKey)} label={U4.playModel} stopLabel={U4.stop} onClick={() => (pb.active(modelKey) ? pb.stop() : pb.playLines(modelKey, [{ kind: 'speaking', idx, pace: 'normal' }]))} />
                  ) : null}
                </div>
                {!reviewing ? <p className="mt-2 text-[12px] text-ink2">{U5.again}</p> : null}
              </>
            ) : (
              <>
                <div aria-hidden="true" className="mt-3 min-h-16 rounded-xl border border-dashed border-line px-3 py-2.5">
                  {voice.recording && voice.partial ? (
                    <p lang="ja" className="text-[17px] text-ink2">
                      {voice.partial}…
                    </p>
                  ) : (
                    <span className="text-[13px] text-ink2">{textMode ? U5.textBox : U5.voiceBox}</span>
                  )}
                </div>
                {!reviewing ? (
                  <button
                    type="button"
                    onClick={() => {
                      setResults((prev) => ({ ...prev, [item.id]: { text: '', via: 'text', used: false, matchedIds: [], missedIds: [], unknownIds: [], utteranceId: null, hasAudio: false, skipped: true, seq: 0 } }))
                      if (!last) goNext()
                    }}
                    className="inline-flex h-11 items-center text-[13px] font-medium text-ink2 underline underline-offset-4"
                  >
                    {U5.skip}
                  </button>
                ) : null}
              </>
            )}
          </Card>
        </div>
        {res && !last ? (
          <Btn className="mt-3 w-full" onClick={goNext}>
            {U5.next}
          </Btn>
        ) : null}
        {reviewing ? <div className="mt-3">{footer}</div> : allDone && res && last ? (
          <div className="mt-3">
            {finishError ? (
              <div role="alert" className="mb-2 rounded-xl border border-bad-soft bg-bad-soft px-3.5 py-3 text-[13px] text-bad break-keep">
                <p className="font-semibold">{U5.finishFail}</p>
                <p>{U5.finishFail2}</p>
              </div>
            ) : null}
            <Btn className="w-full" aria-busy={finishing || undefined} aria-disabled={finishing || undefined} onClick={() => void finish()}>
              {finishing ? U5.finishing : U5.finish}
            </Btn>
          </div>
        ) : null}
      </div>
      {!reviewing ? (
        // 판 + 바를 한 상자로 — 높이를 재서 토스트 바닥으로 올린다(B8 A). 판의 최대 높이·안쪽 스크롤은 회화방 판 그대로.
        <div ref={stackRef} className="flex-none">
          {helper.shown ? (
            <PhraseHelperPanel
              h={helper}
              kind="lesson"
              textMode={textMode}
              textOnly={pb.textOnly}
              locked={helperLock}
              focusOnOpen={helper.fresh}
              onClose={closeHelperToButton}
              onFill={(ja) => {
                composerRef.current?.fill(ja)
                focusComposerRef.current = true
                helper.close()
              }}
              blocked={!!err && !textMode}
              otherOpen={false}
              onDismiss={helper.close}
            />
          ) : null}
          {textMode ? (
            // 도우미 입력칸에 초점이 있는 동안 숨기기만 한다(내리지 않음) — 쓰던 초안·입력창 핸들이 그대로 남게(회화방과 같음).
            <div hidden={helper.typing} className="contents">
              <Composer
                key={item.id}
                draftKey={draftKey}
                enterSends="always"
                sendLabel={U5.send}
                placeholder={U5.inputPlaceholder}
                inputLabel={U5.textMode}
                busy={checking}
                busyReason={U5.checking}
                blockedUntil={null}
                onSend={sendText}
                onBlocked={onToast}
                handleRef={composerRef}
                leading={
                  <>
                    <button type="button" aria-label={U5.voiceMode} onClick={() => setTextMode(false)} className="grid h-11 w-11 flex-none place-items-center rounded-full text-ink2">
                      <MicIcon />
                    </button>
                    {helperButton}
                  </>
                }
              />
            </div>
          ) : helper.typing ? null : (
            // 상자는 안내 말풍선의 기준(회화방과 같음).
            <div className="relative flex-none">
              {tipShown ? <PhraseHelperTip onClose={() => setTipOpen(false)} /> : null}
              <VoiceBar
                view={view}
                db={voice.db}
                onPress={onPress}
                onRelease={voice.release}
                onAbort={voice.abort}
                onKeyboard={toText}
                onStop={() => pb.stop()}
                trailing={helperButton}
                keyboardLabel={U5.textMode}
                stopLabel={U5.stopSound}
                statusId={LESSON_VOICE_STATUS_ID}
              />
            </div>
          )}
        </div>
      ) : null}
    </>
  )
}
