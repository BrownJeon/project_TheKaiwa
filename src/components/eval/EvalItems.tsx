'use client'

/**
 * 문항 8종 본문(데모 v1 `#w1`~`#t6`). 답은 고를 때·저장할 때마다 #67 로 저장하고 "저장했어요"만 보인다 — 맞았는지·점수·정답 색은 결과에서만.
 * 저장 요청·초안·음성·소리는 `EvalRunner` 가 갖고, 여기는 그리기와 사용자 동작 전달만 한다.
 *
 * 일본어 층(task-033 A, screens §15-11-2): 히라가나·`[한글]` 은 공용 부품(`JaText`·`HangulLine`)으로 앱 설정을 따르되 **정답을 흘리는 자리는 숨긴다** —
 * 읽기 쓰기 단어(P1)는 층 없음 + 안내, 같은 평가 다른 문항 속 그 단어(P2, `guard` 어간 키)는 그 한자 히라가나와 그 블록 `[한글]` 을 뺀다.
 * 조립 조각(P4)은 히라가나만. 평가에는 번역 층이 없다. 규칙 계산은 전부 `displayGuard.ts`.
 */
import { OFF, useAnnotations, useWordLayers, type AnnotationState, type TextRange } from '@/components/common/japanese/annotations'
import { useDisplayPrefs } from '@/components/common/japanese/displayPrefs'
import { HangulLine, JaText, type RubyLeading } from '@/components/common/japanese/JapaneseText'
import MicLevelMeter from '@/components/speech/MicLevelMeter'
import PushToTalkButton from '@/components/speech/PushToTalkButton'
import SttAlert from '@/components/talk/SttAlert'
import { isNativeApp } from '@/modules/infra/native'
import { hasKanji } from '@/modules/speech/reading/client'
import type { AnswerBody, EvaluationItem } from '@/types/evaluation'
import { blankParts, guardedRuby, guardHits, guardWordRuby, showReadingGuardNote, spotSegmentRuby } from './displayGuard'
import { CHUNK_CHOICES, ITEM, ITEM_KIND, LISTEN, RUN } from './evalCopy'
import { choiceIndex, listenLeft, promptArr, promptStr, spotReady, type ListenMode, type SpotDraft } from './logic'
import { AlertBox, KeyboardIcon, MicIcon, PlayIcon, SaveLine, StopIcon, TextLink } from './parts'
import type { EvalVoice } from './useEvalVoice'

export interface SaveState {
  /** 이 문항에 대해 보내는 중이거나 실패한 본문(화면은 그 값을 "내 선택"으로 보인다). */
  pending: AnswerBody | null
  busy: boolean
  failed: boolean
  retry: () => void
}

function SaveBlock({ item, s, emptyText }: { item: EvaluationItem; s: SaveState; emptyText?: string }) {
  if (s.failed) {
    return (
      <AlertBox className="mt-3">
        <p>
          <b className="font-bold">{RUN.saveFail[0]}</b>
          {RUN.saveFail[1]}
        </p>
        <TextLink onClick={s.retry} className="text-bad">
          {RUN.saveRetry}
        </TextLink>
      </AlertBox>
    )
  }
  return <SaveLine state={s.busy ? 'busy' : item.answered ? 'saved' : 'empty'} emptyText={emptyText} />
}

export function ItemHead({ index, item }: { index: number; item: EvaluationItem }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-ink2">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-surface2 text-[12px] tabular-nums text-ink">{index + 1}</span>
        {ITEM_KIND[item.kind]}
      </span>
      <span className="text-[12px] text-ink2">{RUN.points(item.maxScore)}</span>
    </div>
  )
}

function Question({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-[16px] font-semibold leading-[1.55] break-keep">{children}</p>
}

/** 일본어 한 덩어리 — 읽기 분석 상태로 히라가나를 그린다. `hits`(교차 보호)가 있으면 겹친 조각의 읽기를 뺀다(없으면 공용 경로 그대로). */
function GJa({
  text,
  state,
  hits,
  as,
  className,
  leading = 2.1,
  rt = 11,
}: {
  text: string
  state: AnnotationState
  hits: readonly TextRange[]
  as?: 'p' | 'span'
  className?: string
  leading?: RubyLeading
  rt?: 11 | 13 | 16
}) {
  const prefs = useDisplayPrefs()
  const ruby = hits.length > 0 ? guardedRuby(text, state, hits, prefs.loaded && prefs.showFurigana) : undefined
  return <JaText as={as} text={text} state={state} ruby={ruby} className={className} leading={leading} rt={rt} />
}

/** 일본어 블록 + 바로 아래 `[한글]` 13 — 보호 대상(히트 있음)이면 `[한글]` 줄을 그리지 않는다. */
function JaBlock({ text, guard, className }: { text: string; guard: readonly string[]; className: string }) {
  const [st] = useAnnotations([text])
  const hits = guardHits(text, guard)
  return (
    <>
      <GJa text={text} state={st} hits={hits} className={className} />
      {hits.length ? null : <HangulLine state={st} size={13} />}
    </>
  )
}

/** 단어 상자(뜻 고르기·조각 분류) — 저장 읽기 루비 + `[한글]`(저장 읽기와 분석 읽기가 다르면 숨김). 읽기 15px 줄은 없앴다. */
function WordBox({ word, reading, guard }: { word: string; reading?: string | null; guard: readonly string[] }) {
  const layers = useWordLayers(word, reading)
  const hits = guardHits(word, guard)
  const ruby = hits.length ? guardWordRuby(layers.ruby, hits) : layers.ruby
  return (
    <div className="mt-2.5 flex flex-col items-center gap-0.5 rounded-xl bg-surface2 px-2 py-4 text-center">
      <JaText text={word} state={OFF} ruby={ruby} leading={1.8} rt={13} className="text-[32px] font-semibold leading-[1.3] [overflow-wrap:anywhere]" />
      {hits.length ? null : <HangulLine state={layers.hangul} size={14} className="!mt-0" />}
    </div>
  )
}

/** 읽기 쓰기 단어 상자(P1) — 제출 전 히라가나·`[한글]` 을 그리지 않는다(정답이 읽기). 층 부품·분석 요청 없음. */
function PlainWordBox({ word }: { word: string }) {
  return (
    <div className="mt-2.5 flex flex-col items-center gap-0.5 rounded-xl bg-surface2 px-2 py-4 text-center">
      <span lang="ja" className="text-[32px] font-semibold leading-[1.3] [overflow-wrap:anywhere]">
        {word}
      </span>
    </div>
  )
}

/** 용법 빈칸 문장 — 히라가나만(`[한글]` 없음: 빈칸 자리 소리 규칙이 없다). `___` 에서 앞·뒤를 따로 분석하고 한자가 있으면 줄간격을 미리 넓힌다. */
function UsageSentence({ text, guard }: { text: string; guard: readonly string[] }) {
  const prefs = useDisplayPrefs()
  const parts = blankParts(text)
  const blocks = parts ? [parts.before, parts.after] : [text]
  const states = useAnnotations(blocks.map((b) => (hasKanji(b) ? b : '')))
  const reserve = prefs.loaded && prefs.showFurigana && hasKanji(text)
  const ja = (i: number) => <GJa as="span" text={blocks[i]} state={states[i]} hits={guardHits(blocks[i], guard)} />
  return (
    <p lang="ja" className="text-[17px] leading-[1.7] [overflow-wrap:anywhere]" style={reserve ? { lineHeight: 2.1 } : undefined}>
      {parts ? (
        <>
          {ja(0)}
          <span aria-label={ITEM.blank} className="inline-block min-w-[3em] border-b-2 border-ink text-transparent">
            ＿＿＿
          </span>
          {ja(1)}
        </>
      ) : (
        ja(0)
      )}
    </p>
  )
}

/** `___` 를 빈칸 밑줄로(스크린 리더는 "빈칸"). */
export function BlankSentence({ text, fill, fillClass = '' }: { text: string; fill?: string | null; fillClass?: string }) {
  const at = text.indexOf('___')
  if (at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      {fill ? (
        <b className={fillClass}>{fill}</b>
      ) : (
        <span aria-label={ITEM.blank} className="inline-block min-w-[3em] border-b-2 border-ink text-transparent">
          ＿＿＿
        </span>
      )}
      {text.slice(at + 3)}
    </>
  )
}

/** 일본어 보기 — 일본어 17 + 히라가나 + `[한글]` 12.5(버튼 안이라 span). 높이는 내용 맞춤(≈80). */
function JaChoice({ text, guard }: { text: string; guard: readonly string[] }) {
  const [st] = useAnnotations([text])
  const hits = guardHits(text, guard)
  return (
    <>
      <GJa as="span" text={text} state={st} hits={hits} className="block" />
      {hits.length ? null : <HangulLine as="span" state={st} size={12.5} />}
    </>
  )
}

function ChoiceRows({
  labels,
  ja,
  hints,
  selected,
  onPick,
  guard = [],
}: {
  labels: string[]
  ja: boolean
  hints?: string[]
  selected: number | null
  onPick: (i: number) => void
  guard?: readonly string[]
}) {
  return (
    <div role="radiogroup" aria-label={ITEM.choicesAria}>
      {labels.map((c, j) => {
        const on = selected === j
        return (
          <button
            key={j}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(j)}
            className={`mt-2 grid min-h-[52px] w-full grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left ${
              on ? 'border-accent bg-accent-soft shadow-[inset_0_0_0_1px_var(--color-accent)]' : 'border-line bg-surface'
            }`}
          >
            <span aria-hidden="true" className={`grid h-6 w-6 place-items-center rounded-full text-[12px] font-bold ${on ? 'bg-accent text-on-accent' : 'bg-surface2'}`}>
              {j + 1}
            </span>
            <span className={`min-w-0 [overflow-wrap:anywhere] ${ja ? 'text-[17px]' : 'text-[15px] break-keep'}`} lang={ja ? 'ja' : undefined}>
              {ja ? <JaChoice text={c} guard={guard} /> : c}
              {hints ? (
                <>
                  <br />
                  <span className="text-[12px] text-ink2">{hints[j]}</span>
                </>
              ) : null}
            </span>
            {on ? <span className="whitespace-nowrap text-[12px] font-bold text-ink">{ITEM.mine}</span> : <span />}
          </button>
        )
      })}
    </div>
  )
}

/** 뜻 고르기 · 용법 고르기 · 조각 분류 — 누르면 바로 저장. */
export function ChoiceItem({ item, s, onSave, guard }: { item: EvaluationItem; s: SaveState; onSave: (b: AnswerBody) => void; guard: readonly string[] }) {
  const p = item.prompt
  const pendingText = s.pending?.answerText ?? null
  if (item.kind === 'CHUNK_CLASSIFY') {
    const values = CHUNK_CHOICES.map((c) => c.value as string)
    const cur = pendingText ?? item.answerText
    const sel = cur ? values.indexOf(cur) : -1
    return (
      <>
        <Question>{ITEM.chunkQ}</Question>
        <WordBox word={promptStr(p, 'textJa')} reading={promptStr(p, 'reading') || null} guard={guard} />
        <ChoiceRows labels={CHUNK_CHOICES.map((c) => c.label)} hints={CHUNK_CHOICES.map((c) => c.hint)} ja={false} selected={sel < 0 ? null : sel} onPick={(j) => onSave({ answerText: values[j] })} />
        <SaveBlock item={item} s={s} />
      </>
    )
  }
  const choices = promptArr(p, 'choices')
  const sel = choiceIndex(choices, pendingText ?? item.answerText)
  const usage = item.kind === 'USAGE_CHOICE'
  return (
    <>
      <Question>{usage ? ITEM.usageQ : ITEM.meaningQ}</Question>
      {usage ? (
        <div className="mt-2.5 rounded-xl bg-surface2 px-3 py-4 text-center">
          <UsageSentence text={promptStr(p, 'sentenceJa')} guard={guard} />
        </div>
      ) : (
        <WordBox word={promptStr(p, 'surface')} reading={promptStr(p, 'reading') || null} guard={guard} />
      )}
      <ChoiceRows labels={choices} ja={usage} selected={sel} onPick={(j) => onSave({ answerText: choices[j] })} guard={guard} />
      <SaveBlock item={item} s={s} />
    </>
  )
}

/** 읽기 쓰기 — [저장]·Enter·다른 문항으로 가면 저장(일본어 입력 중 Enter 는 무시). */
export function ReadingItem({ item, s, draft, onDraft, onSave, inputId }: { item: EvaluationItem; s: SaveState; draft: string; onDraft: (v: string) => void; onSave: () => void; inputId: string }) {
  const prefs = useDisplayPrefs()
  return (
    <>
      <Question>{ITEM.readingQ}</Question>
      <PlainWordBox word={promptStr(item.prompt, 'surface')} />
      {showReadingGuardNote(prefs.loaded, prefs.showFurigana, prefs.showHangul) ? <p className="mt-1.5 text-[12px] text-ink2 break-keep">{ITEM.readingGuardNote}</p> : null}
      <div className="mt-3 flex items-center gap-2">
        <label htmlFor={inputId} className="sr-only">
          {ITEM.readingLabel}
        </label>
        <input
          id={inputId}
          lang="ja"
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              onSave()
            }
          }}
          placeholder={ITEM.readingPh}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={30}
          className="h-12 w-full min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[18px] text-ink placeholder:text-ink3"
        />
        <button type="button" onClick={onSave} className="h-12 flex-none rounded-xl bg-surface2 px-4 text-[15px] font-semibold">
          {ITEM.save}
        </button>
      </div>
      <SaveBlock item={item} s={s} emptyText={ITEM.readingEmpty} />
    </>
  )
}

export interface ListenView {
  mode: ListenMode
  played: number
  playing: boolean
  loading: boolean
  revealedText: string | null
  revealBusy: boolean
  onPlay: () => void
  onBlocked: () => void
  onReveal: () => void
  onAudioRetry: () => void
}

function ListenBlock({ v, guard }: { v: ListenView; guard: readonly string[] }) {
  if (v.mode === 'revealed') {
    return (
      <>
        <div className="mt-2.5 rounded-xl border border-dashed border-line px-3 py-2.5">
          <JaBlock text={v.revealedText ?? ''} guard={guard} className="whitespace-pre-wrap text-[17px] leading-[1.7] [overflow-wrap:anywhere]" />
        </div>
        <p className="mt-1 text-[12px] text-ink2">{LISTEN.revealedNote}</p>
      </>
    )
  }
  const reveal = (
    <TextLink onClick={v.onReveal} aria-busy={v.revealBusy || undefined} className="text-bad">
      {v.revealBusy ? LISTEN.revealing : LISTEN.reveal}
    </TextLink>
  )
  if (v.mode === 'cut') {
    return (
      <AlertBox className="mt-3">
        <p>
          <b className="font-bold">{LISTEN.cut[0]}</b>
          {LISTEN.cut[1]}
        </p>
        <p className="mt-1">{LISTEN.cut2}</p>
        {reveal}
      </AlertBox>
    )
  }
  if (v.mode === 'audioErr') {
    return (
      <AlertBox className="mt-3">
        <p className="font-bold">{LISTEN.audioErr}</p>
        <div className="mt-1.5 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
          <button type="button" onClick={v.onAudioRetry} className="h-11 rounded-xl border border-line bg-surface px-3 text-[14px] font-semibold text-ink">
            {LISTEN.audioRetry}
          </button>
          <button type="button" onClick={v.onReveal} aria-busy={v.revealBusy || undefined} className="h-11 rounded-xl border border-line bg-surface px-3 text-[14px] font-semibold text-ink">
            {v.revealBusy ? LISTEN.revealing : LISTEN.reveal}
          </button>
        </div>
      </AlertBox>
    )
  }
  const { left, text } = listenLeft(v.played)
  const on = v.playing || v.loading
  const off = !on && left <= 0
  return (
    <>
      <div className="mt-3 flex items-center gap-3 rounded-xl bg-surface2 p-3">
        <button
          type="button"
          aria-label={on ? LISTEN.playingAria : v.played ? LISTEN.replay : LISTEN.play}
          aria-disabled={off || undefined}
          onClick={() => (off ? v.onBlocked() : v.onPlay())}
          className={`grid h-14 w-14 flex-none place-items-center rounded-full ${on ? 'bg-accent text-on-accent' : 'bg-ink text-surface'} ${off ? 'opacity-35' : ''}`}
        >
          {on ? <StopIcon /> : <PlayIcon />}
        </button>
        <div className="min-w-0 flex-1">
          <p role="status" className="text-[14px] font-semibold">
            {v.loading ? LISTEN.loading : v.playing ? LISTEN.playing : v.played ? LISTEN.replayLabel : LISTEN.playLabel}
          </p>
          <p className="text-[12px] text-ink2">{LISTEN[text]}</p>
        </div>
      </div>
      <div aria-hidden="true" className="mt-2.5">
        <span className="my-[7px] block h-3.5 w-[84%] rounded-[7px] bg-surface2" />
        <span className="my-[7px] block h-3.5 w-[58%] rounded-[7px] bg-surface2" />
      </div>
      <p className="text-[12px] text-ink2 break-keep">{LISTEN.hiddenNote}</p>
    </>
  )
}

export interface VoiceView {
  textMode: boolean
  draft: string
  onDraft: (v: string) => void
  onSaveText: () => void
  onToggleMode: () => void
  voice: EvalVoice
  errDismissed: boolean
  onDismissErr: () => void
  saving: boolean
  textareaId: string
}

function VoiceAnswer({ item, s, v, guard }: { item: EvaluationItem; s: SaveState; v: VoiceView; guard: readonly string[] }) {
  if (v.textMode) {
    return (
      <>
        <label htmlFor={v.textareaId} className="mb-1.5 mt-3 block text-[12.5px] font-medium text-ink2">
          {ITEM.answerLabel}
        </label>
        <textarea
          id={v.textareaId}
          lang="ja"
          rows={3}
          maxLength={2000}
          value={v.draft}
          onChange={(e) => v.onDraft(e.target.value)}
          placeholder={ITEM.textPh}
          className="block min-h-24 w-full min-w-0 resize-y rounded-xl border border-line bg-surface p-3 text-[16px] leading-[1.6] text-ink placeholder:text-ink3"
        />
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <TextLink onClick={v.onToggleMode} tone="ink">
            <MicIcon />
            {ITEM.toVoice}
          </TextLink>
          <button type="button" onClick={v.onSaveText} className="h-11 flex-none rounded-xl bg-surface2 px-3.5 text-[14px] font-semibold">
            {ITEM.answerSave}
          </button>
        </div>
        <SaveBlock item={item} s={s} emptyText={ITEM.textEmpty} />
      </>
    )
  }
  const voice = v.voice
  const err = voice.error && !v.errDismissed ? voice.error : null
  const answered = item.answered && !!item.answerText
  const statusId = `eval-voice-status-${item.id}`
  return (
    <>
      {err ? (
        <div className="mt-3">
          <SttAlert
            code={err.code}
            retryAfterSec={err.retryAfterSec}
            mountCheck={err.mountCheck}
            switched={err.switched}
            offlineMode={err.offlineMode}
            native={isNativeApp()}
            textMode={false}
            textModeLabel={ITEM.toText}
            onTextMode={v.onToggleMode}
            onClose={v.onDismissErr}
          />
        </div>
      ) : null}
      {answered && !voice.recording ? <p className="mt-3 text-[12px] font-semibold text-ink2">{item.inputSource === 'TEXT' ? ITEM.wrote : ITEM.said}</p> : null}
      <div aria-hidden="true" className={`${answered && !voice.recording ? 'mt-0.5' : 'mt-3'} flex min-h-16 w-full items-center rounded-xl border border-dashed border-line bg-surface px-3 py-2.5`}>
        {voice.recording ? (
          voice.partial ? (
            <p lang="ja" className="text-[17px] leading-[1.7] text-ink2 [overflow-wrap:anywhere]">
              {voice.partial}…
            </p>
          ) : (
            <span className="text-[13px] text-ink2">{ITEM.listening}</span>
          )
        ) : answered ? (
          <div className="min-w-0 flex-1">
            <JaBlock text={item.answerText ?? ''} guard={guard} className="whitespace-pre-wrap text-[17px] leading-[1.7] text-ink [overflow-wrap:anywhere]" />
          </div>
        ) : (
          <span className="text-[13px] text-ink2 break-keep">{ITEM.liveBox}</span>
        )}
      </div>
      <div className="mt-2.5 flex flex-col items-center gap-1.5">
        <PushToTalkButton phase={voice.phase} disabled={v.saving} label={voice.pttLabel} describedBy={statusId} onPress={voice.press} onRelease={voice.release} onAbort={voice.abort} />
        <div id={statusId} className="flex min-h-6 items-center justify-center gap-2 text-center text-[13px] leading-[1.4] text-ink2">
          <MicLevelMeter db={voice.db} active={voice.phase === 'recording'} />
          <span className="min-w-0 break-keep">{voice.statusText}</span>
        </div>
      </div>
      <TextLink onClick={v.onToggleMode} tone="ink" className="flex w-full justify-center">
        <KeyboardIcon />
        {ITEM.toText}
      </TextLink>
      <SaveBlock item={item} s={s} />
    </>
  )
}

/** 듣고 답하기 · 상황 응답 — 위는 듣기 소리(또는 상황), 아래는 푸시투토크·글자 답. */
export function SpeakItem({ item, s, listen, v, guard }: { item: EvaluationItem; s: SaveState; listen: ListenView | null; v: VoiceView; guard: readonly string[] }) {
  const p = item.prompt
  return (
    <>
      {item.kind === 'LISTEN_RESPOND' ? (
        <>
          <Question>{promptStr(p, 'instructionKo')}</Question>
          {listen ? <ListenBlock v={listen} guard={guard} /> : null}
        </>
      ) : (
        <>
          <Question>{ITEM.situationQ}</Question>
          <div className="mt-2 rounded-xl bg-surface2 px-3 py-2.5">
            <p className="text-[15px] font-semibold leading-[1.55] break-keep">{promptStr(p, 'situationKo')}</p>
          </div>
        </>
      )}
      <VoiceAnswer item={item} s={s} v={v} guard={guard} />
    </>
  )
}

/** 문장 조립 — 조각을 누르면 위 칸에 차례로, 들어간 조각을 누르면 빠진다. 모두 넣으면 저장(`pieceOrder`). */
export function AssembleItem({
  item,
  s,
  draft,
  onDraft,
  onComplete,
  guard,
}: {
  item: EvaluationItem
  s: SaveState
  draft: number[]
  onDraft: (d: number[]) => void
  onComplete: (d: number[]) => void
  guard: readonly string[]
}) {
  const pieces = promptArr(item.prompt, 'pieces')
  // 조각은 히라가나만(P4) — 한자 없는 조각은 그릴 층이 없으니 분석하지 않는다(한글 켬이어도 조각 요청 0).
  const states = useAnnotations(pieces.map((p) => (hasKanji(p) ? p : '')))
  const pieceJa = (k: number) => <GJa as="span" text={pieces[k] ?? ''} state={states[k] ?? OFF} hits={guardHits(pieces[k] ?? '', guard)} />
  const rest = pieces.map((_, k) => k).filter((k) => !draft.includes(k))
  const add = (k: number) => {
    const next = [...draft, k]
    onDraft(next)
    if (next.length === pieces.length) onComplete(next)
  }
  return (
    <>
      <Question>{ITEM.assembleQ}</Question>
      <p className="mt-1 text-[14px] break-keep">{ITEM.assembleKo(promptStr(item.prompt, 'promptKo'))}</p>
      <div role="group" aria-label={ITEM.assembleBox} className="mt-3 flex min-h-16 flex-wrap items-center gap-1.5 rounded-xl border border-dashed border-ink3 bg-surface p-2">
        {draft.length ? (
          draft.map((k, pos) => (
            <button
              key={`${k}-${pos}`}
              type="button"
              aria-label={ITEM.assembleDel(pos + 1, pieces[k] ?? '')}
              onClick={() => onDraft(draft.filter((_, i) => i !== pos))}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] border border-accent bg-accent-soft px-2.5 text-[17px]"
            >
              <span aria-hidden="true" className="text-[11px] font-bold text-ink2">
                {pos + 1}
              </span>
              {pieceJa(k)}
            </button>
          ))
        ) : (
          <span className="px-1 text-[13px] text-ink2 break-keep">{ITEM.assemblePh}</span>
        )}
      </div>
      <div role="group" aria-label={ITEM.assemblePool} className="mt-2.5 flex flex-wrap gap-2">
        {rest.map((k) => (
          <button key={k} type="button" lang="ja" aria-label={ITEM.assembleAdd(pieces[k] ?? '')} onClick={() => add(k)} className="inline-flex min-h-11 items-center rounded-[10px] border border-line bg-surface2 px-3.5 text-[17px]">
            {pieceJa(k)}
          </button>
        ))}
      </div>
      {draft.length ? (
        <TextLink onClick={() => onDraft([])} tone="ink">
          {ITEM.assembleReset}
        </TextLink>
      ) : null}
      {item.answered && draft.length < pieces.length && !s.failed ? (
        <SaveLine state="saved" emptyText={ITEM.assembleKept} />
      ) : (
        <SaveBlock item={item} s={s} emptyText={draft.length ? ITEM.assembleEmpty : RUN.notYet} />
      )}
    </>
  )
}

/**
 * 틀린 곳 찾기 — 결정 f=A: 조각(`prompt.segments`)을 눌러 하나 고르고 고친 말·이유를 쓴다(`spotIndex` + `answerText`).
 * 조각이 없는 옛 문항은 원문이 든 입력칸을 고쳐 쓰고 이유 한 줄(데모 f=B 모양).
 */
export function SpotItem({
  item,
  s,
  draft,
  onDraft,
  onSave,
  onBlocked,
  ids,
  guard,
}: {
  item: EvaluationItem
  s: SaveState
  draft: SpotDraft
  onDraft: (d: SpotDraft) => void
  onSave: () => void
  onBlocked: (why: string) => void
  ids: { text: string; fix: string; why: string }
  guard: readonly string[]
}) {
  const prefs = useDisplayPrefs()
  const segments = promptArr(item.prompt, 'segments')
  const sentence = promptStr(item.prompt, 'sentenceJa')
  // 문장 전체를 한 번 분석해 조각 경계로 나눈다(조각마다 따로 분석하면 활용·조사 읽기가 틀린다).
  const [sentenceState] = useAnnotations([sentence])
  const sentenceHits = guardHits(sentence, guard)
  const segRuby = spotSegmentRuby(sentenceState, segments, prefs.loaded && prefs.showFurigana, sentenceHits)
  const segMode = segments.length > 0
  const ready = spotReady(segMode, draft, sentence)
  const why = segMode ? ITEM.spotWhy : ITEM.fixWhy
  const saveBtn = (
    <button
      type="button"
      aria-disabled={!ready || undefined}
      onClick={() => (ready ? onSave() : onBlocked(why))}
      className={`h-11 flex-none rounded-xl bg-surface2 px-3.5 text-[14px] font-semibold ${ready ? '' : 'opacity-40'}`}
    >
      {ITEM.answerSave}
    </button>
  )
  if (segMode) {
    return (
      <>
        <Question>{ITEM.spotQ}</Question>
        <div role="group" aria-label={ITEM.spotAria} className="mt-3 flex flex-wrap gap-1 rounded-xl bg-surface2 p-2">
          {segments.map((sg, k) => {
            const on = draft.seg === k
            return (
              <button
                key={k}
                type="button"
                lang="ja"
                aria-pressed={on}
                onClick={() => onDraft({ ...draft, seg: on ? null : k })}
                className={`min-h-11 rounded-lg px-2 text-[18px] ${on ? 'bg-accent-soft underline decoration-accent decoration-wavy underline-offset-[6px] shadow-[inset_0_0_0_2px_var(--color-accent)]' : 'bg-surface'}`}
              >
                <JaText as="span" text={sg} state={OFF} ruby={segRuby[k]} leading={2.1} />
              </button>
            )
          })}
        </div>
        {sentenceHits.length ? null : <HangulLine state={sentenceState} size={13} className="!mt-1.5" />}
        <p className="mt-2 text-[12px] text-ink2">
          {draft.seg !== null && segments[draft.seg] !== undefined ? (
            <>
              {ITEM.spotPicked}
              <span lang="ja">{segments[draft.seg]}</span>
            </>
          ) : (
            ITEM.spotPick
          )}
        </p>
        <label htmlFor={ids.text} className="mb-1.5 mt-3 block text-[12.5px] font-medium text-ink2">
          {ITEM.spotLabel}
        </label>
        <textarea
          id={ids.text}
          rows={3}
          maxLength={2000}
          value={draft.text}
          onChange={(e) => onDraft({ ...draft, text: e.target.value })}
          placeholder={ITEM.spotPh}
          className="block min-h-24 w-full min-w-0 resize-y rounded-xl border border-line bg-surface p-3 text-[16px] leading-[1.6] text-ink placeholder:text-ink3"
        />
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-[12px] text-ink2 break-keep">{ITEM.spotMeta}</span>
          {saveBtn}
        </div>
        <SaveBlock item={item} s={s} />
      </>
    )
  }
  return (
    <>
      <Question>{ITEM.fixQ}</Question>
      <div className="mt-2.5 rounded-xl bg-surface2 px-3 py-4 text-center">
        <JaBlock text={sentence} guard={guard} className="text-[17px] leading-[1.7] [overflow-wrap:anywhere]" />
      </div>
      <label htmlFor={ids.fix} className="mb-1.5 mt-3 block text-[12.5px] font-medium text-ink2">
        {ITEM.fixLabel}
      </label>
      <textarea
        id={ids.fix}
        lang="ja"
        rows={2}
        maxLength={2000}
        value={draft.fixed}
        onChange={(e) => onDraft({ ...draft, fixed: e.target.value })}
        className="block min-h-20 w-full min-w-0 resize-y rounded-xl border border-line bg-surface p-3 text-[16px] leading-[1.6] text-ink"
      />
      <p className="mt-1 text-[12px] text-ink2 break-keep">{ITEM.fixNote}</p>
      <label htmlFor={ids.why} className="mb-1.5 mt-3 block text-[12.5px] font-medium text-ink2">
        {ITEM.whyLabel}
      </label>
      <input
        id={ids.why}
        value={draft.why}
        onChange={(e) => onDraft({ ...draft, why: e.target.value })}
        placeholder={ITEM.whyPh}
        maxLength={200}
        autoComplete="off"
        className="h-12 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-[16px] text-ink placeholder:text-ink3"
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-[12px] text-ink2 break-keep">{ITEM.fixMeta}</span>
        {saveBtn}
      </div>
      <SaveBlock item={item} s={s} />
    </>
  )
}

