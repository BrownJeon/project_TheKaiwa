'use client'

/**
 * ④ 응용(screens §12-2 I · 데모 v2 `#l4`·`#l4-voice`·`#l4-compare`) — 상황마다 문장을 쓰고(또는 말로 쓰기 — MIC_TEST, 원음 저장 안 함) 모범 답안과
 * 비교한다. 채점하지 않는다. [비교하기]는 그 칸의 글자를 #61 로 저장하고, [모르겠어요]는 저장하지 않는다(다시 들어오면 쓰기부터).
 * 글자 비교(task-025 데모 v1 `#l4-diff`·`#l4-kanji`·`#l4-same`·`#l4-mixed`·`#l4-skip`): 다른 글자 = 굵게 + 밑줄(내 문장에만 점선, 모범 답안에만 실선),
 * 색은 ink·surface 만(빨강·초록·취소선 없음). 정오 판정·저장은 바꾸지 않는 표시일 뿐이다(`compareAnswer`).
 * task-081 §37-5·37-14(데모 v1 `a-*`): 마이크가 기본(`textFirst` 면 글자 입력 + 이유 한 줄) · 알아들은 말은 루비·한글 줄 + 한국어 뜻 줄(⑤ 와 같은
 * `SpeakTranslation`·#185·뜻 메모리 `trCache` 공유) · 비교 뒤 «내 문장» 칸에도 뜻 줄. 번역은 한 번에 지금 상황 하나만 부른다. 말로 했는지(`via`)는
 * 화면 메모리에만 둔다(저장 안 함 — 다시 열면 «알아들은 말을 그대로 옮겼어요» 힌트만 빠진다).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DiffSeg } from '@/components/chat/diff'
import { changedRanges, OFF, useAnnotations, type AnnotationState } from '@/components/common/japanese/annotations'
import { HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import { Btn, Card } from '@/components/common/ui'
import MicLevelMeter from '@/components/speech/MicLevelMeter'
import PushToTalkButton from '@/components/speech/PushToTalkButton'
import { STT_HINT_COPY } from '@/components/speech/sttCopy'
import SttAlert from '@/components/talk/SttAlert'
import type { SttClientConfig } from '@/modules/speech/stt/client'
import { isNativeApp } from '@/modules/infra/native'
import type { LessonContent, LessonDto, LessonProgress } from '@/types/lesson'
import { compareAnswer } from './compare'
import { U4 } from './lessonCopy'
import { ExprChip, PlayWide, targetsOf } from './parts'
import SpeakTranslation from './SpeakTranslation'
import { translationPlan, type SpeakTrPlan } from './speakTranslation'
import type { LessonPlayback } from './useLessonPlayback'
import type { UseLesson } from './useLesson'
import { useLessonVoice } from './useLessonVoice'
import { useSpeakTranslation, type SpeakTrCache } from './useSpeakTranslation'

type Via = 'voice' | 'text'
/** 상황 하나에서 마지막으로 알아들은 말 — `seq` 는 이 상황에서 최종 결과를 받은 횟수(같은 글을 다시 말해도 대상 키가 바뀐다). */
type Heard = { text: string; seq: number }

/**
 * 뜻 줄 대상 하나(§37-5 번역 대상) — 비교 뒤면 저장한 글, 비교 전이면 말로 알아들은 글(그 뒤 글자로 고치지 않았을 때만). 글자로 쓰는 동안은 없음.
 * 저장한 글이 방금 알아들은 글과 같으면 같은 키를 이어 써서 [비교하기] 순간 받는 중인 요청을 끊고 다시 묻지 않게 한다.
 */
export function applyTrTarget(o: {
  idx: number
  shown: boolean
  saved: string | null
  heard: Heard | null
  draft: string
  voiceMode: boolean
  modelAnswerJa: string
  modelKo: string
}): { key: string; text: string; plan: SpeakTrPlan } | null {
  const heardKey = o.heard ? `ap:${o.idx}:${o.heard.seq}` : null
  if (o.shown) {
    if (!o.saved) return null
    const plan = translationPlan({ text: o.saved }, o.modelAnswerJa, o.modelKo)
    if (plan.kind === 'skip') return null
    return { key: heardKey && o.heard?.text === o.saved ? heardKey : `ap:${o.idx}:saved`, text: o.saved, plan }
  }
  if (!o.voiceMode || !o.heard || !heardKey || o.heard.text !== o.draft) return null
  const plan = translationPlan({ text: o.draft }, o.modelAnswerJa, o.modelKo)
  return plan.kind === 'skip' ? null : { key: heardKey, text: o.draft, plan }
}

/** [비교하기] 저장(#61) — 그 칸의 글자만. 말로 했는지(`via`)는 싣지 않는다(§37-5 ★). */
export function applyAnswerPatch(prev: LessonProgress, idx: number, text: string, count: number): LessonProgress {
  const cur = [...(prev.application?.answers ?? [])]
  while (cur.length < count) cur.push(null)
  cur[idx] = text
  return { ...prev, application: { answers: cur } }
}

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

const MARK_BASE = 'rounded-[3px] bg-surface px-px font-bold text-ink underline decoration-ink'
const MARK_MINE = 'decoration-dotted decoration-[2.5px]'
const MARK_MODEL = 'decoration-solid decoration-2'
const markClass = (style: string, legend = false) => `${MARK_BASE} ${style} ${legend ? 'underline-offset-[3px]' : 'underline-offset-[5px]'}`

/**
 * 내 문장·모범 답안 — 비교 밑줄(글자 아래 `mark`)과 히라가나(위)를 함께(MOV ⑦) + `[한글]` 13. 비교 조각을 이은 글이 원문과 다르면(오프셋을
 * 믿을 수 없음) 밑줄 없이 층만 그린다.
 */
function CompareText({ text, segs, mark, state }: { text: string; segs?: DiffSeg[]; mark: string; state: AnnotationState }) {
  const ranges =
    segs && segs.map((s) => s.text).join('') === text ? changedRanges(segs, markClass(mark)).map((r) => ({ ...r, as: 'mark' as const })) : undefined
  return (
    <>
      <JaText text={text} state={state} ranges={ranges} className="text-[17px] leading-[1.7] [overflow-wrap:anywhere]" />
      <HangulLine state={state} size={13} />
    </>
  )
}

function Legend({ mark, word, text }: { mark: string; word: string; text: string }) {
  return (
    <span className="text-[12px] text-ink2">
      <mark className={markClass(mark, true)}>{word}</mark>
      {text}
    </span>
  )
}

function SrList({ items }: { items: string[] }) {
  if (!items.length) return <>{U4.cmpSrNone}</>
  return (
    <>
      {items.map((t, i) => (
        <span key={i}>
          {i ? ', ' : ''}
          <span lang="ja">{t}</span>
        </span>
      ))}
    </>
  )
}

export default function StageApply({
  lesson,
  st,
  pb,
  reviewing,
  config,
  textFirst,
  trCache,
  onToast,
  footer,
}: {
  lesson: LessonDto & { content: LessonContent }
  st: UseLesson
  pb: LessonPlayback
  reviewing: boolean
  config: SttClientConfig | null
  /** 말로 답하기를 못 쓰는 환경(⑤ 와 같은 조건 — `useSpeechConfig`) — 글자 입력으로 연다. */
  textFirst: boolean
  /** 수업 화면 동안의 뜻 메모리 — ④·⑤ 가 함께 쓴다(같은 글이면 다시 묻지 않음). */
  trCache: SpeakTrCache
  onToast: (m: string) => void
  footer: React.ReactNode
}) {
  const items = lesson.content.application
  const saved = items.map((_, i) => {
    const a = lesson.progress.application?.answers?.[i]
    return typeof a === 'string' && a.trim() ? a : null
  })
  const [heard, setHeard] = useState<(Heard | null)[]>(() => items.map(() => null))
  // 써 볼 표현·모범 답안·내 문장·알아들은 말을 단계 마운트 때 한 묶음으로(task-026 §15-4-7). 상태는 문장마다 하나라 문장으로 찾는다.
  // 글자로 쓰는 중인 초안은 넣지 않는다(글쇠마다 분석하지 않게) — 알아들은 말(최종 결과)만.
  const targetsPer = useMemo(() => items.map((ap) => targetsOf(lesson.content, ap.targetIds)), [items, lesson.content])
  const annTexts = [...targetsPer.flat().map((t) => t.ja), ...items.map((ap) => ap.modelAnswerJa), ...saved.map((s) => s ?? ''), ...heard.map((h) => h?.text ?? '')]
  const annList = useAnnotations(annTexts)
  const annOf = (text: string): AnnotationState => annList[annTexts.indexOf(text)] ?? OFF
  const [peeked, setPeeked] = useState<Set<number>>(() => new Set())
  const shownOf = (i: number) => reviewing || saved[i] !== null || peeked.has(i)
  const firstOpen = items.findIndex((_, i) => saved[i] === null)
  const [idx, setIdx] = useState(firstOpen === -1 ? 0 : firstOpen)
  const [drafts, setDrafts] = useState<string[]>(() => items.map(() => ''))
  const [voiceMode, setVoiceMode] = useState(!textFirst)
  /** [비교하기] 를 누른 때의 입력 방법 — 화면 메모리만(§37-5 `via`, 저장 안 함). */
  const [viaOf, setViaOf] = useState<(Via | null)[]>(() => items.map(() => null))
  const [dismissed, setDismissed] = useState<unknown>(null)
  const [heardTick, setHeardTick] = useState(0)
  /** 사용자가 이미 말하거나(누름·결과) 쓰거나 방법을 바꿨는지 — 늦게 온 `textFirst` 가 그 뒤엔 입력 방법을 바꾸지 않게. */
  const touchedRef = useRef(false)
  const compareRef = useRef<HTMLDivElement>(null)
  const voice = useLessonVoice({
    purpose: 'MIC_TEST',
    config,
    pb,
    hadResult: false,
    onToast,
    onFinal: (f) => {
      const t = f.text.trim()
      if (!t) return voice.setHint(STT_HINT_COPY.EMPTY_RESULT)
      touchedRef.current = true
      const clipped = Array.from(t).slice(0, 200).join('')
      setDrafts((d) => d.map((x, k) => (k === idx ? clipped : x)))
      setHeard((h) => h.map((x, k) => (k === idx ? { text: clipped, seq: (x?.seq ?? 0) + 1 } : x)))
      setHeardTick((v) => v + 1)
    },
  })
  const ap = items[idx]
  const shown = shownOf(idx)
  const cmp = shown ? compareAnswer(saved[idx], ap.modelAnswerJa) : ({ kind: 'none' } as const)
  const diff = cmp.kind === 'diff' ? cmp : null
  const draft = drafts[idx]
  const n = Array.from(draft).length
  const key = `a:${idx}`
  const playing = pb.active(key)
  const last = idx === items.length - 1

  // 설정 응답이 늦게 와 글자 우선이 되면, 아직 아무것도 하지 않았을 때만 글자 입력으로(⑤ StageSpeak 와 같은 방식).
  useEffect(() => {
    if (textFirst)
      queueMicrotask(() => {
        if (!touchedRef.current) setVoiceMode(false)
      })
  }, [textFirst])

  // 말한 결과가 들어오면 그려진 뒤 [모범 답안과 비교하기] 를 화면 안으로(데모 P2-1 — 이미 보이면 움직이지 않음). 녹음·글자 입력 중엔 하지 않는다.
  // 결과 하나에 한 번만(다음 상황으로 넘어가거나 녹음이 헛돌고 끝나도 다시 움직이지 않게).
  const recording = voice.recording
  const scrolledTickRef = useRef(0)
  useEffect(() => {
    if (!heardTick || heardTick === scrolledTickRef.current || recording || !voiceMode || shown) return
    scrolledTickRef.current = heardTick
    const raf = requestAnimationFrame(() => compareRef.current?.scrollIntoView({ block: 'nearest' }))
    return () => cancelAnimationFrame(raf)
  }, [heardTick, recording, voiceMode, shown])

  // 한국어 뜻 줄(#185, §37-5) — 훅 하나라 한 번에 지금 상황 하나만 부른다(다시 보기에서도 세 상황을 한꺼번에 부르지 않음).
  const tr = useSpeakTranslation({
    lessonId: lesson.id,
    target: applyTrTarget({ idx, shown, saved: saved[idx], heard: heard[idx], draft, voiceMode, modelAnswerJa: ap.modelAnswerJa, modelKo: ap.modelKo }),
    paused: recording,
    cache: trCache,
  })

  const compare = () => {
    const t = draft.trim()
    if (!t) return onToast(U4.emptyToast)
    const via: Via = voiceMode ? 'voice' : 'text'
    setViaOf((v) => v.map((x, k) => (k === idx ? via : x)))
    st.update((prev) => applyAnswerPatch(prev, idx, t, items.length), ['application'], { immediate: true })
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
            {targetsPer[idx].map((t) => (
              <ExprChip key={t.id} ja={t.ja} ko={t.ko} ann={annOf(t.ja)} />
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
              {cmp.kind !== 'none' ? <p className="mt-3 text-[13px] font-semibold text-ink break-keep">{cmp.kind === 'same' ? U4.cmpSame : U4.cmpDiff}</p> : null}
              <div className={`${cmp.kind !== 'none' ? 'mt-2' : 'mt-3'} grid gap-2 @min-[440px]:grid-cols-2`}>
                <div className="min-w-0 rounded-xl bg-surface2 px-3 py-2.5">
                  <p className="mb-0.5 flex flex-wrap items-baseline justify-between gap-x-2.5 gap-y-0.5">
                    <span className="text-[12px] font-semibold text-ink2">{U4.mine}</span>
                    {diff ? <Legend mark={MARK_MINE} word={U4.cmpLegendMine} text={U4.cmpLegendMineText} /> : null}
                  </p>
                  {saved[idx] ? (
                    <>
                      <CompareText text={saved[idx]} segs={diff?.mine} mark={MARK_MINE} state={annOf(saved[idx])} />
                      <SpeakTranslation state={tr.state} via={viaOf[idx] ?? 'text'} onRetry={tr.retry} />
                    </>
                  ) : (
                    <p className="text-[13px] text-ink2">{U4.skipped}</p>
                  )}
                </div>
                <div className="min-w-0 rounded-xl bg-surface2 px-3 py-2.5">
                  <p className="mb-0.5 flex flex-wrap items-baseline justify-between gap-x-2.5 gap-y-0.5">
                    <span className="text-[12px] font-semibold text-good">{U4.model}</span>
                    {diff ? <Legend mark={MARK_MODEL} word={U4.cmpLegendModel} text={U4.cmpLegendModelText} /> : null}
                  </p>
                  <CompareText text={ap.modelAnswerJa} segs={diff?.model} mark={MARK_MODEL} state={annOf(ap.modelAnswerJa)} />
                  <p className="text-[13px] text-ink2 break-keep">{ap.modelKo}</p>
                  {!pb.textOnly ? (
                    <PlayWide playing={playing} label={U4.playModel} stopLabel={U4.stop} onClick={() => (playing ? pb.stop() : pb.playLines(key, [{ kind: 'application', idx, pace: 'normal' }]))} />
                  ) : null}
                </div>
              </div>
              {diff ? (
                <p className="sr-only">
                  {U4.cmpSrModel}
                  <SrList items={diff.onlyModel} />. {U4.cmpSrMine}
                  <SrList items={diff.onlyMine} />.
                </p>
              ) : null}
              <p className="mt-2 text-[12px] text-ink2 break-keep">{cmp.kind === 'none' ? U4.note : U4.noteCompare}</p>
            </>
          ) : (
            <>
              <label htmlFor="apply-input" className="mt-3 block text-[12.5px] font-medium text-ink2">
                {U4.mine}
              </label>
              {textFirst && !voiceMode ? (
                <p role="status" className="mt-1.5 rounded-[10px] bg-surface2 px-3 py-2 text-[13px] break-keep">
                  {U4.textFirst}
                </p>
              ) : null}
              {voiceMode ? (
                <div className="mt-1.5 flex flex-col items-center gap-2">
                  <div data-apply-heard className="min-h-16 w-full min-w-0 rounded-xl border border-dashed border-line px-3 py-2.5">
                    {/* aria-live 는 알아들은 글에만 — 뜻 줄(SpeakTranslation)은 자체 aria-live 라 안에 넣으면 중첩돼 두 번 읽힐 수 있다(감사 C F1) */}
                    <div aria-live="polite">
                      {voice.recording && voice.partial ? (
                        <p lang="ja" aria-hidden="true" className="text-[17px] text-ink2">
                          {voice.partial}…
                        </p>
                      ) : draft ? (
                        <>
                          <JaText text={draft} state={annOf(draft)} className="text-[17px] leading-[1.7] text-ink [overflow-wrap:anywhere]" />
                          <HangulLine state={annOf(draft)} size={13} />
                        </>
                      ) : (
                        <span className="text-[13px] text-ink2">{U4.voiceBox}</span>
                      )}
                    </div>
                    {!(voice.recording && voice.partial) && draft && heard[idx]?.text === draft ? (
                      <SpeakTranslation state={tr.state} via="voice" onRetry={tr.retry} />
                    ) : null}
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
                  <PushToTalkButton
                    phase={voice.phase}
                    label={voice.pttLabel}
                    describedBy="apply-voice-status"
                    onPress={() => {
                      touchedRef.current = true
                      voice.press()
                    }}
                    onRelease={voice.release}
                    onAbort={voice.abort}
                  />
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
                    touchedRef.current = true
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
                    touchedRef.current = true
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
              <div ref={compareRef} className="mt-2">
                <Btn className={`w-full ${n ? '' : 'opacity-40'}`} aria-disabled={!n || undefined} onClick={compare}>
                  {U4.compare}
                </Btn>
              </div>
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
