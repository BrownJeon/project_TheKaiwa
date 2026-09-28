'use client'

/**
 * ⑤ 말하기(screens §12-2 J · 데모 v2 `#l5`·`#l5-ok`·`#l5-miss`·`#l5-text`·`#l5-denied`·`#l5-fail`·`#l5-donefail`).
 * 판정은 서버 코드(#62b, AI 채점 없음). 음성 = `useRealtimeStt(TURN, chatId 없음)` → final → #62b `{itemId, text, utteranceId}`,
 * 글자 = 입력 바 → #62b `{itemId, text}`. 과제는 몇 번이든 다시(서버는 마지막 시도로). 세 과제 모두 결과(또는 건너뜀)가 있으면 [수업 마치기] → #62.
 * 이 화면은 본문 스크롤과 아래 입력 바를 함께 그린다(입력 바는 스크롤 밖 고정).
 */
import { useEffect, useRef, useState } from 'react'
import { apiPost } from '@/components/common/api'
import { detailString, toErr } from '@/components/common/errors'
import { readStore, writeStore } from '@/components/common/storage'
import { Btn, Card } from '@/components/common/ui'
import MicLevelMeter from '@/components/speech/MicLevelMeter'
import PushToTalkButton from '@/components/speech/PushToTalkButton'
import { STT_HINT_COPY } from '@/components/speech/sttCopy'
import SttAlert from '@/components/talk/SttAlert'
import { isNativeApp } from '@/modules/infra/native'
import type { SttClientConfig } from '@/modules/speech/stt/client'
import type { LessonContent, LessonDto, SpeakingResult } from '@/types/lesson'
import { U4, U5 } from './lessonCopy'
import { ExprChip, PlayWide, StopIcon, targetsOf } from './parts'
import type { LessonPlayback } from './useLessonPlayback'
import type { UseLesson } from './useLesson'
import { LESSON_KEYS } from './useLessonCreate'
import { useLessonVoice } from './useLessonVoice'

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
}

function KeyboardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </svg>
  )
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
  reading,
  config,
  textFirst,
  onToast,
  onDone,
  reviewNote,
  footer,
}: {
  lesson: LessonDto & { content: LessonContent }
  st: UseLesson
  pb: LessonPlayback
  reviewing: boolean
  reading: boolean
  config: SttClientConfig | null
  textFirst: boolean
  onToast: (m: string) => void
  onDone: () => Promise<void>
  reviewNote: React.ReactNode
  footer: React.ReactNode
}) {
  const content = lesson.content
  const items = content.speaking
  const [results, setResults] = useState<Record<string, ItemResult>>(() => {
    const out: Record<string, ItemResult> = {}
    for (const r of lesson.progress.speaking ?? []) {
      out[r.itemId] = { text: r.text, via: r.utteranceId ? 'voice' : 'text', used: r.missedIds.length === 0 && r.matchedIds.length > 0, matchedIds: r.matchedIds, missedIds: r.missedIds, unknownIds: [], utteranceId: r.utteranceId, hasAudio: !!r.utteranceId }
    }
    return out
  })
  const firstOpen = items.findIndex((s) => !results[s.id])
  const [idx, setIdx] = useState(firstOpen === -1 ? items.length - 1 : firstOpen)
  const [textMode, setTextMode] = useState(textFirst)
  const [draft, setDraft] = useState('')
  const [checking, setChecking] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState(false)
  const [dismissed, setDismissed] = useState<unknown>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLParagraphElement>(null)
  const [focusResult, setFocusResult] = useState(0)
  const item = items[idx]
  const res = results[item.id]
  const draftKey = LESSON_KEYS.speakDraft(lesson.id, item.id)

  useEffect(() => {
    if (textFirst) queueMicrotask(() => setTextMode(true))
  }, [textFirst])
  useEffect(() => {
    queueMicrotask(() => setDraft(readStore('session', draftKey) ?? ''))
  }, [draftKey])
  useEffect(() => {
    if (!focusResult) return
    cardRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    resultRef.current?.focus()
  }, [focusResult])

  const check = async (text: string, via: 'voice' | 'text', utteranceId: string | null) => {
    if (checking || reviewing) return
    setChecking(true)
    const path = `/api/v1/lessons/${encodeURIComponent(lesson.id)}/speaking`
    try {
      let r: SpeakingResult
      try {
        r = await apiPost<SpeakingResult>(path, { itemId: item.id, text, ...(utteranceId ? { utteranceId } : {}) })
      } catch (e) {
        const err = toErr(e)
        const reason = detailString(err, 'reason')
        if (err.status === 409 && utteranceId && reason?.startsWith('UTTERANCE_')) r = await apiPost<SpeakingResult>(path, { itemId: item.id, text })
        else throw e
      }
      setResults((prev) => ({ ...prev, [item.id]: { text, via, used: r.used, matchedIds: r.matchedIds, missedIds: r.missedIds, unknownIds: r.unknownIds, utteranceId: r.utteranceId, hasAudio: r.hasAudio } }))
      st.update((prev) => ({
        ...prev,
        speaking: [...(prev.speaking ?? []).filter((x) => x.itemId !== item.id), { itemId: item.id, text, matchedIds: r.matchedIds, missedIds: r.missedIds, utteranceId: r.utteranceId, at: new Date().toISOString() }],
      }))
      if (via === 'text') {
        setDraft('')
        writeStore('session', draftKey, null)
      }
      setFocusResult((n) => n + 1)
    } catch (e) {
      const err = toErr(e)
      if (err.status === 409) void st.reload()
      onToast(U5.checkFail)
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
  const sendText = () => {
    const t = draft.trim()
    if (!t) return onToast(U5.emptyToast)
    void check(t, 'text', null)
  }

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
            <p className="mt-2 text-[12px] text-ink2">{U5.targets}</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {targets.map((t) => {
                const hit = !!res && res.matchedIds.includes(t.id)
                const miss = !!res && res.missedIds.includes(t.id)
                return (
                  <ExprChip
                    key={t.id}
                    ja={t.ja}
                    ko={t.ko}
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
                  <p lang="ja" className="mt-1 inline-block max-w-full rounded-[14px] bg-accent-soft px-3 py-2 text-[17px] text-ink [overflow-wrap:anywhere]">
                    {res.text}
                  </p>
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
                  <p lang="ja" className="text-[17px] [overflow-wrap:anywhere]">
                    {item.modelAnswerJa}
                  </p>
                  {reading ? (
                    <p lang="ja" className="text-[14px] text-ink2 [overflow-wrap:anywhere]">
                      {item.modelReading}
                    </p>
                  ) : null}
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
                      setResults((prev) => ({ ...prev, [item.id]: { text: '', via: 'text', used: false, matchedIds: [], missedIds: [], unknownIds: [], utteranceId: null, hasAudio: false, skipped: true } }))
                      if (!last) setIdx(idx + 1)
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
          <Btn className="mt-3 w-full" onClick={() => setIdx(idx + 1)}>
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
        textMode ? (
          <div className="flex-none border-t border-line bg-surface px-2 pt-2" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))', marginBottom: 'var(--kb-inset, 0px)' }}>
            <div className="flex items-end gap-1">
              <button type="button" aria-label={U5.voiceMode} onClick={() => setTextMode(false)} className="grid h-11 w-11 flex-none place-items-center rounded-full text-ink2">
                <MicIcon />
              </button>
              <textarea
                lang="ja"
                rows={1}
                value={draft}
                aria-label={U5.textMode}
                placeholder={U5.inputPlaceholder}
                onChange={(e) => {
                  setDraft(e.target.value)
                  writeStore('session', draftKey, e.target.value || null)
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = `${Math.min(el.scrollHeight, 5 * 26 + 20)}px`
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    sendText()
                  }
                }}
                className="max-h-[150px] min-h-11 min-w-0 flex-1 resize-none rounded-[22px] border border-line bg-surface px-3.5 py-2.5 text-[16px] leading-[26px] text-ink placeholder:text-ink3"
              />
              <button type="button" aria-label={U5.send} aria-busy={checking || undefined} onClick={sendText} className="grid h-11 w-11 flex-none place-items-center rounded-full bg-accent text-on-accent">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 19V5M6 11l6-6 6 6" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-none border-t border-line bg-surface px-4 pt-2" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
            <div id="lesson-voice-status" className="flex h-6 min-w-0 items-center justify-center gap-2 text-[13px] text-ink2">
              <MicLevelMeter db={voice.db} active={voice.phase === 'recording'} />
              <span className="min-w-0 truncate break-keep">{checking ? U5.checking : voice.statusText}</span>
            </div>
            <div className="mt-1 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center">
              <button type="button" aria-label={U5.textMode} onClick={() => setTextMode(true)} className="grid h-11 w-11 place-items-center rounded-full text-ink2">
                <KeyboardIcon />
              </button>
              <div className="flex justify-center">
                <PushToTalkButton
                  phase={voice.phase}
                  disabled={checking}
                  label={voice.pttLabel}
                  describedBy="lesson-voice-status"
                  onPress={voice.press}
                  onRelease={voice.release}
                  onAbort={voice.abort}
                />
              </div>
              {pb.snapshot.phase === 'playing' ? (
                <button type="button" aria-label={U5.stopSound} onClick={() => pb.stop()} className="grid h-11 w-11 place-items-center rounded-full bg-surface2 text-ink">
                  <StopIcon size={18} />
                </button>
              ) : (
                <span aria-hidden="true" className="h-11 w-11" />
              )}
            </div>
          </div>
        )
      ) : null}
    </>
  )
}
