'use client'

/**
 * ④ 응용(screens §12-2 I · 데모 v2 `#l4`·`#l4-voice`·`#l4-compare`) — 상황마다 문장을 쓰고(또는 말로 쓰기 — MIC_TEST, 원음 저장 안 함) 모범 답안과
 * 비교한다. 채점하지 않는다. [비교하기]는 그 칸의 글자를 #61 로 저장하고, [모르겠어요]는 저장하지 않는다(다시 들어오면 쓰기부터).
 */
import { useState } from 'react'
import { Btn, Card } from '@/components/common/ui'
import MicLevelMeter from '@/components/speech/MicLevelMeter'
import PushToTalkButton from '@/components/speech/PushToTalkButton'
import { STT_HINT_COPY } from '@/components/speech/sttCopy'
import SttAlert from '@/components/talk/SttAlert'
import type { SttClientConfig } from '@/modules/speech/stt/client'
import { isNativeApp } from '@/modules/infra/native'
import type { LessonContent, LessonDto } from '@/types/lesson'
import { U4 } from './lessonCopy'
import { ExprChip, PlayWide, targetsOf } from './parts'
import type { LessonPlayback } from './useLessonPlayback'
import type { UseLesson } from './useLesson'
import { useLessonVoice } from './useLessonVoice'

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}

function KeyboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </svg>
  )
}

export default function StageApply({
  lesson,
  st,
  pb,
  reviewing,
  reading,
  config,
  onToast,
  footer,
}: {
  lesson: LessonDto & { content: LessonContent }
  st: UseLesson
  pb: LessonPlayback
  reviewing: boolean
  reading: boolean
  config: SttClientConfig | null
  onToast: (m: string) => void
  footer: React.ReactNode
}) {
  const items = lesson.content.application
  const saved = items.map((_, i) => {
    const a = lesson.progress.application?.answers?.[i]
    return typeof a === 'string' && a.trim() ? a : null
  })
  const [peeked, setPeeked] = useState<Set<number>>(() => new Set())
  const shownOf = (i: number) => reviewing || saved[i] !== null || peeked.has(i)
  const firstOpen = items.findIndex((_, i) => saved[i] === null)
  const [idx, setIdx] = useState(firstOpen === -1 ? 0 : firstOpen)
  const [drafts, setDrafts] = useState<string[]>(() => items.map(() => ''))
  const [voiceMode, setVoiceMode] = useState(false)
  const [dismissed, setDismissed] = useState<unknown>(null)
  const voice = useLessonVoice({
    purpose: 'MIC_TEST',
    config,
    pb,
    hadResult: false,
    onToast,
    onFinal: (f) => {
      const t = f.text.trim()
      if (!t) return voice.setHint(STT_HINT_COPY.EMPTY_RESULT)
      setDrafts((d) => d.map((x, k) => (k === idx ? Array.from(t).slice(0, 200).join('') : x)))
    },
  })
  const ap = items[idx]
  const shown = shownOf(idx)
  const draft = drafts[idx]
  const n = Array.from(draft).length
  const key = `a:${idx}`
  const playing = pb.active(key)
  const last = idx === items.length - 1

  const compare = () => {
    const t = draft.trim()
    if (!t) return onToast(U4.emptyToast)
    st.update(
      (prev) => {
        const cur = [...(prev.application?.answers ?? [])]
        while (cur.length < items.length) cur.push(null)
        cur[idx] = t
        return { ...prev, application: { answers: cur } }
      },
      ['application'],
      { immediate: true },
    )
  }

  const err = voice.error && voice.error !== dismissed ? voice.error : null
  return (
    <div>
      <h2 tabIndex={-1} data-stage-title className="text-[17px] font-bold outline-none">
        {U4.title(items.length)}
      </h2>
      <p className="mt-1 text-[13px] text-ink2 break-keep">{U4.desc}</p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-[14px] font-bold">{U4.counter(idx + 1, items.length)}</span>
        <div aria-hidden="true" className="flex gap-1">
          {items.map((it, k) => (
            <span
              key={it.id}
              className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${saved[k] !== null || peeked.has(k) ? 'bg-good-soft font-semibold text-good' : k === idx ? 'bg-surface font-semibold ring-2 ring-accent ring-inset' : 'bg-surface2 text-ink2'}`}
            >
              {saved[k] !== null || peeked.has(k) ? '✓' : k + 1}
            </span>
          ))}
        </div>
      </div>
      {reviewing ? (
        <div className="mt-2 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
          {items.map((it, k) => (
            <button key={it.id} type="button" onClick={() => setIdx(k)} className={`h-11 rounded-xl text-[13px] font-semibold ${k === idx ? 'bg-surface2' : 'border border-line bg-surface'}`}>
              {U4.situation(k + 1)}
            </button>
          ))}
        </div>
      ) : null}
      <div className="@container">
        <Card className="mt-2">
          <p className="text-[16px] font-semibold break-keep [overflow-wrap:anywhere]">{ap.promptKo}</p>
          <p className="mt-2 text-[12px] text-ink2">{U4.tryExpr}</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {targetsOf(lesson.content, ap.targetIds).map((t) => (
              <ExprChip key={t.id} ja={t.ja} ko={t.ko} />
            ))}
          </ul>
          {ap.hintJa ? (
            <p className="mt-2 text-[12px] text-ink2">
              {U4.hint}
              <span lang="ja">{ap.hintJa}</span>
            </p>
          ) : null}
          {shown ? (
            <>
              <div className="mt-3 grid gap-2 @min-[440px]:grid-cols-2">
                <div className="min-w-0 rounded-xl bg-surface2 px-3 py-2.5">
                  <p className="text-[12px] font-semibold text-ink2">{U4.mine}</p>
                  {saved[idx] ? (
                    <p lang="ja" className="text-[17px] [overflow-wrap:anywhere]">
                      {saved[idx]}
                    </p>
                  ) : (
                    <p className="text-[13px] text-ink2">{U4.skipped}</p>
                  )}
                </div>
                <div className="min-w-0 rounded-xl bg-surface2 px-3 py-2.5">
                  <p className="text-[12px] font-semibold text-good">{U4.model}</p>
                  <p lang="ja" className="text-[17px] [overflow-wrap:anywhere]">
                    {ap.modelAnswerJa}
                  </p>
                  {reading ? (
                    <p lang="ja" className="text-[14px] text-ink2 [overflow-wrap:anywhere]">
                      {ap.modelReading}
                    </p>
                  ) : null}
                  <p className="text-[13px] text-ink2 break-keep">{ap.modelKo}</p>
                  {!pb.textOnly ? (
                    <PlayWide playing={playing} label={U4.playModel} stopLabel={U4.stop} onClick={() => (playing ? pb.stop() : pb.playLines(key, [{ kind: 'application', idx, pace: 'normal' }]))} />
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-[12px] text-ink2 break-keep">{U4.note}</p>
            </>
          ) : (
            <>
              <label htmlFor="apply-input" className="mt-3 block text-[12.5px] font-medium text-ink2">
                {U4.mine}
              </label>
              {voiceMode ? (
                <div className="mt-1.5 flex flex-col items-center gap-2">
                  <div aria-hidden="true" className="min-h-16 w-full rounded-xl border border-dashed border-line px-3 py-2.5">
                    {voice.recording && voice.partial ? (
                      <p lang="ja" className="text-[17px] text-ink2">
                        {voice.partial}…
                      </p>
                    ) : draft ? (
                      <p lang="ja" className="text-[17px] text-ink [overflow-wrap:anywhere]">
                        {draft}
                      </p>
                    ) : (
                      <span className="text-[13px] text-ink2">{U4.voiceBox}</span>
                    )}
                  </div>
                  {err ? (
                    <div className="w-full">
                      <SttAlert
                        code={err.code}
                        retryAfterSec={err.retryAfterSec}
                        mountCheck={err.mountCheck}
                        switched={err.switched}
                        offlineMode={err.offlineMode}
                        native={isNativeApp()}
                        textMode={false}
                        textModeLabel={U4.byText}
                        onTextMode={() => {
                          setDismissed(voice.error)
                          setVoiceMode(false)
                        }}
                        onClose={() => setDismissed(voice.error)}
                      />
                    </div>
                  ) : null}
                  <PushToTalkButton phase={voice.phase} label={voice.pttLabel} describedBy="apply-voice-status" onPress={voice.press} onRelease={voice.release} onAbort={voice.abort} />
                  <div id="apply-voice-status" className="flex h-6 min-w-0 items-center justify-center gap-2 text-[13px] text-ink2">
                    <MicLevelMeter db={voice.db} active={voice.phase === 'recording'} />
                    <span className="min-w-0 truncate break-keep">{voice.statusText}</span>
                  </div>
                </div>
              ) : (
                <textarea
                  id="apply-input"
                  lang="ja"
                  rows={3}
                  maxLength={200}
                  value={draft}
                  placeholder={U4.placeholder}
                  onChange={(e) => {
                    const v = e.target.value
                    setDrafts((d) => d.map((x, k) => (k === idx ? v : x)))
                  }}
                  onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'nearest' })}
                  className="mt-1.5 block min-h-[84px] w-full min-w-0 resize-y rounded-xl border border-line bg-surface px-3 py-2.5 text-[16px] text-ink placeholder:text-ink3"
                />
              )}
              <div className="mt-1 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (voiceMode) voice.abort()
                    setVoiceMode(!voiceMode)
                  }}
                  className="inline-flex h-11 items-center gap-1 text-[13px] font-medium underline underline-offset-4"
                >
                  {voiceMode ? <KeyboardIcon /> : <MicIcon />}
                  {voiceMode ? U4.byText : U4.byVoice}
                </button>
                <span className="text-[12px] tabular-nums text-ink2">{U4.count(n)}</span>
              </div>
              <Btn className={`mt-2 w-full ${n ? '' : 'opacity-40'}`} aria-disabled={!n || undefined} onClick={compare}>
                {U4.compare}
              </Btn>
              <button
                type="button"
                onClick={() => setPeeked((s) => new Set(s).add(idx))}
                className="mt-1 flex h-11 w-full items-center justify-center text-[13px] font-medium text-ink2 underline underline-offset-4"
              >
                {U4.dontKnow}
              </button>
            </>
          )}
        </Card>
      </div>
      {shown ? (
        <div className="mt-3">
          {!last && !reviewing ? (
            <Btn className="w-full" onClick={() => setIdx(idx + 1)}>
              {U4.next}
            </Btn>
          ) : (
            footer
          )}
        </div>
      ) : null}
    </div>
  )
}
