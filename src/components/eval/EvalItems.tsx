'use client'

/**
 * 문항 8종 본문(데모 v1 `#w1`~`#t6`). 답은 고를 때·저장할 때마다 #67 로 저장하고 "저장했어요"만 보인다 — 맞았는지·점수·정답 색은 결과에서만.
 * 저장 요청·초안·음성·소리는 `EvalRunner` 가 갖고, 여기는 그리기와 사용자 동작 전달만 한다.
 */
import MicLevelMeter from '@/components/speech/MicLevelMeter'
import PushToTalkButton from '@/components/speech/PushToTalkButton'
import SttAlert from '@/components/talk/SttAlert'
import { isNativeApp } from '@/modules/infra/native'
import type { AnswerBody, EvaluationItem } from '@/types/evaluation'
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

function WordBox({ word, reading }: { word: string; reading?: string | null }) {
  return (
    <div className="mt-2.5 flex flex-col items-center gap-0.5 rounded-xl bg-surface2 px-2 py-4 text-center">
      <span lang="ja" className="text-[32px] font-semibold leading-[1.3] [overflow-wrap:anywhere]">
        {word}
      </span>
      {reading ? (
        <span lang="ja" className="text-[15px] text-ink2">
          {reading}
        </span>
      ) : null}
    </div>
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

function ChoiceRows({ labels, ja, hints, selected, onPick }: { labels: string[]; ja: boolean; hints?: string[]; selected: number | null; onPick: (i: number) => void }) {
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
              {c}
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
export function ChoiceItem({ item, s, onSave }: { item: EvaluationItem; s: SaveState; onSave: (b: AnswerBody) => void }) {
  const p = item.prompt
  const pendingText = s.pending?.answerText ?? null
  if (item.kind === 'CHUNK_CLASSIFY') {
    const values = CHUNK_CHOICES.map((c) => c.value as string)
    const cur = pendingText ?? item.answerText
    const sel = cur ? values.indexOf(cur) : -1
    return (
      <>
        <Question>{ITEM.chunkQ}</Question>
        <WordBox word={promptStr(p, 'textJa')} reading={promptStr(p, 'reading') || null} />
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
          <p lang="ja" className="text-[17px] leading-[1.7] [overflow-wrap:anywhere]">
            <BlankSentence text={promptStr(p, 'sentenceJa')} />
          </p>
        </div>
      ) : (
        <WordBox word={promptStr(p, 'surface')} reading={promptStr(p, 'reading') || null} />
      )}
      <ChoiceRows labels={choices} ja={usage} selected={sel} onPick={(j) => onSave({ answerText: choices[j] })} />
      <SaveBlock item={item} s={s} />
    </>
  )
}

/** 읽기 쓰기 — [저장]·Enter·다른 문항으로 가면 저장(일본어 입력 중 Enter 는 무시). */
export function ReadingItem({ item, s, draft, onDraft, onSave, inputId }: { item: EvaluationItem; s: SaveState; draft: string; onDraft: (v: string) => void; onSave: () => void; inputId: string }) {
  return (
    <>
      <Question>{ITEM.readingQ}</Question>
      <WordBox word={promptStr(item.prompt, 'surface')} />
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

function ListenBlock({ v }: { v: ListenView }) {
  if (v.mode === 'revealed') {
    return (
      <>
        <div className="mt-2.5 rounded-xl border border-dashed border-line px-3 py-2.5">
          <p lang="ja" className="whitespace-pre-wrap text-[17px] leading-[1.7] [overflow-wrap:anywhere]">
            {v.revealedText}
          </p>
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

function VoiceAnswer({ item, s, v }: { item: EvaluationItem; s: SaveState; v: VoiceView }) {
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
          <p lang="ja" className="whitespace-pre-wrap text-[17px] leading-[1.7] text-ink [overflow-wrap:anywhere]">
            {item.answerText}
          </p>
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
export function SpeakItem({ item, s, listen, v }: { item: EvaluationItem; s: SaveState; listen: ListenView | null; v: VoiceView }) {
  const p = item.prompt
  return (
    <>
      {item.kind === 'LISTEN_RESPOND' ? (
        <>
          <Question>{promptStr(p, 'instructionKo')}</Question>
          {listen ? <ListenBlock v={listen} /> : null}
        </>
      ) : (
        <>
          <Question>{ITEM.situationQ}</Question>
          <div className="mt-2 rounded-xl bg-surface2 px-3 py-2.5">
            <p className="text-[15px] font-semibold leading-[1.55] break-keep">{promptStr(p, 'situationKo')}</p>
          </div>
        </>
      )}
      <VoiceAnswer item={item} s={s} v={v} />
    </>
  )
}

/** 문장 조립 — 조각을 누르면 위 칸에 차례로, 들어간 조각을 누르면 빠진다. 모두 넣으면 저장(`pieceOrder`). */
export function AssembleItem({ item, s, draft, onDraft, onComplete }: { item: EvaluationItem; s: SaveState; draft: number[]; onDraft: (d: number[]) => void; onComplete: (d: number[]) => void }) {
  const pieces = promptArr(item.prompt, 'pieces')
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
              <span lang="ja">{pieces[k]}</span>
            </button>
          ))
        ) : (
          <span className="px-1 text-[13px] text-ink2 break-keep">{ITEM.assemblePh}</span>
        )}
      </div>
      <div role="group" aria-label={ITEM.assemblePool} className="mt-2.5 flex flex-wrap gap-2">
        {rest.map((k) => (
          <button key={k} type="button" lang="ja" aria-label={ITEM.assembleAdd(pieces[k] ?? '')} onClick={() => add(k)} className="inline-flex min-h-11 items-center rounded-[10px] border border-line bg-surface2 px-3.5 text-[17px]">
            {pieces[k]}
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
}: {
  item: EvaluationItem
  s: SaveState
  draft: SpotDraft
  onDraft: (d: SpotDraft) => void
  onSave: () => void
  onBlocked: (why: string) => void
  ids: { text: string; fix: string; why: string }
}) {
  const segments = promptArr(item.prompt, 'segments')
  const sentence = promptStr(item.prompt, 'sentenceJa')
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
                {sg}
              </button>
            )
          })}
        </div>
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
        <p lang="ja" className="text-[17px] leading-[1.7] [overflow-wrap:anywhere]">
          {sentence}
        </p>
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

