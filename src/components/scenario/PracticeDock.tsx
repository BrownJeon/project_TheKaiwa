'use client'

/**
 * 대답 연습(가이드 §3-E) — 입력 바 바로 위. 마지막 선생님 말에 무엇을 대답할지 막히면 펼친다(펼칠 때만 S10 한 번).
 * 방식 셋: 고르기(빈칸 보기 3개) · 말하기(뜻만 보고, 힌트·정답 보기) · 따라 하기(듣고 따라).
 * **판 안에 마이크·보내기가 없다** — 말하는 것은 아래 푸시투토크 하나, 글자 모드는 [입력창에 넣기]까지(D-8). 판 안 스크롤은 시트와 같은 예외(M-3).
 * 키보드가 올라오면 연습 문장 한 줄만 남긴다(`:root[data-kb]`). 띠(마이크 오류·보내지 못한 말 등)가 새로 뜨면 접힌 줄로 돌아간다.
 */
import { useEffect, useRef, useState } from 'react'
import Segmented from '@/components/common/Segmented'
import { HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import { OFF, useAnnotations } from '@/components/common/japanese/annotations'
import { useCountdown } from '@/components/common/useNow'
import { Skeleton } from '@/components/challenge/parts'
import { SOUND_MSG, soundText } from '@/components/vocab/wordSound'
import { checkChoice, type PracticeChoice, type PracticeMode, type PracticeView } from './practiceLogic'
import { PRACTICE } from './scenarioCopy'
import type { PracticeState } from './usePractice'
import type { RolePlay } from './useRolePlay'

/** 키보드가 열려 있는 동안 숨는 부분(연습 문장 한 줄만 남긴다). */
const KB_HIDE = '[:root[data-kb]_&]:hidden'
const GHOST = 'inline-flex h-11 min-w-0 items-center justify-center rounded-xl border border-line bg-surface px-3 text-[14px] font-semibold text-ink'
const MODES: { value: PracticeMode; label: string }[] = [
  { value: 'choose', label: PRACTICE.modeChoose },
  { value: 'say', label: PRACTICE.modeSay },
  { value: 'repeat', label: PRACTICE.modeRepeat },
]

export interface PracticeDockProps {
  rp: RolePlay
  voice: boolean
  textOnly: boolean
  /** 방 띠(1~5순위)가 떠 있는가 — 새로 뜨는 순간 판을 접는다. */
  blocked: boolean
  onFill: (text: string) => void
  onToast: (msg: string) => void
}

export default function PracticeDock({ rp, voice, textOnly, blocked, onFill, onToast }: PracticeDockProps) {
  const entryRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const focusEntryRef = useRef(false)
  const prevBlocked = useRef(blocked)
  const { practiceOpen, closePractice } = rp

  useEffect(() => {
    const rose = blocked && !prevBlocked.current
    prevBlocked.current = blocked
    if (rose && practiceOpen) closePractice()
  }, [blocked, practiceOpen, closePractice])

  // 펼침 → 판 머리(고른 방식), ✕ 로 닫음 → 접힌 줄.
  useEffect(() => {
    if (practiceOpen) panelRef.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus()
    else if (focusEntryRef.current) {
      focusEntryRef.current = false
      entryRef.current?.focus()
    }
  }, [practiceOpen])

  if (!rp.practiceShown) return null
  if (!practiceOpen) {
    return (
      <div className="flex-none border-t border-line bg-surface">
        <button ref={entryRef} type="button" aria-expanded={false} onClick={rp.openPractice} className="flex h-11 w-full min-w-0 items-center gap-2 px-4 text-left">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none text-accent">
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z" />
          </svg>
          <span className="flex-none text-[14px] font-semibold text-ink">{PRACTICE.entry}</span>
          <span className="min-w-0 flex-1 truncate text-[12px] text-ink2">{PRACTICE.entrySub}</span>
          <span aria-hidden="true" className="flex-none text-[14px] text-ink3">
            ⌃
          </span>
        </button>
      </div>
    )
  }

  const st = rp.practiceState
  const view = st.phase === 'ready' ? st.view : null
  const close = () => {
    focusEntryRef.current = true
    closePractice()
  }
  const pickMode = (m: PracticeMode) => {
    if (m === 'choose' && view && !view.choose) {
      onToast(PRACTICE.noChoose)
      return
    }
    rp.setPracticeMode(m)
  }
  const fill = (text: string) => {
    onFill(text)
    closePractice()
  }

  return (
    <section
      ref={panelRef}
      aria-label={PRACTICE.region}
      className="max-h-[min(46dvh,320px)] flex-none overflow-y-auto overscroll-contain border-t border-line bg-surface px-4 pb-3 pt-2"
    >
      <div className={`flex min-w-0 items-center gap-2 ${KB_HIDE}`}>
        <div className="min-w-0 flex-1">
          <Segmented size="sm" ariaLabel={PRACTICE.modeAria} options={MODES} value={rp.practiceMode} onChange={pickMode} />
        </div>
        <button type="button" aria-label={PRACTICE.close} onClick={close} className="-mr-2 grid h-11 w-11 flex-none place-items-center rounded-full text-ink2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="mt-2 min-w-0">
        {view ? (
          <PracticeBody key={`${view.messageId}:${rp.practiceMode}`} rp={rp} view={view} mode={rp.practiceMode} voice={voice} textOnly={textOnly} onFill={fill} />
        ) : (
          <PracticeWaiting state={st} onRetry={rp.openPractice} />
        )}
      </div>
    </section>
  )
}

function PracticeWaiting({ state, onRetry }: { state: PracticeState; onRetry: () => void }) {
  const until = state.phase === 'failed' ? state.until : null
  const left = useCountdown(until)
  if (state.phase === 'failed') {
    const f = state.failure
    const waiting = f.kind === 'rate' && left !== 0
    const text = f.kind === 'rate' ? (waiting && left ? PRACTICE.rateIn(left) : PRACTICE.rate) : f.kind === 'busy' ? PRACTICE.busy : PRACTICE.error
    return (
      <div role={f.kind === 'error' ? 'alert' : 'status'} className={KB_HIDE}>
        <p className="text-[13px] text-ink break-keep">{text}</p>
        <button
          type="button"
          aria-disabled={waiting || undefined}
          onClick={() => {
            if (!waiting) onRetry()
          }}
          className={`${GHOST} mt-2 ${waiting ? 'opacity-40' : ''}`}
        >
          {PRACTICE.retry}
        </button>
      </div>
    )
  }
  return (
    <div className={KB_HIDE}>
      <Skeleton heights={[17, 17]} label={PRACTICE.loadingSr} />
      {state.phase === 'loading' && state.slow ? <p className="mt-2 text-[12px] text-ink2">{PRACTICE.slow}</p> : null}
    </div>
  )
}

function PracticeBody({ rp, view, mode, voice, textOnly, onFill }: { rp: RolePlay; view: PracticeView; mode: PracticeMode; voice: boolean; textOnly: boolean; onFill: (t: string) => void }) {
  const ann = useAnnotations([view.ja, view.choose?.before ?? '', view.choose?.after ?? ''])
  if (mode === 'choose' && view.choose) return <ChooseBody view={view} choice={view.choose} ann={ann} voice={voice} onFill={onFill} />
  if (mode === 'say') return <SayBody view={view} ann={ann[0] ?? OFF} voice={voice} />
  return <RepeatBody rp={rp} view={view} ann={ann[0] ?? OFF} voice={voice} textOnly={textOnly} onFill={onFill} />
}

type Ann = ReturnType<typeof useAnnotations>[number]

function ChooseBody({ view, choice, ann, voice, onFill }: { view: PracticeView; choice: PracticeChoice; ann: Ann[]; voice: boolean; onFill: (t: string) => void }) {
  const [wrong, setWrong] = useState<ReadonlySet<number>>(() => new Set())
  const [right, setRight] = useState(false)
  const pick = (i: number) => {
    if (right) return
    if (checkChoice(choice, i)) setRight(true)
    else setWrong((s) => new Set(s).add(i))
  }
  const lastWrong = !right && wrong.size > 0
  return (
    <div className="min-w-0">
      <p className={`text-[13px] text-ink2 break-keep ${KB_HIDE}`}>{PRACTICE.chooseLead}</p>
      {right ? (
        <>
          <JaText text={view.ja} state={ann[0] ?? OFF} className="mt-1 text-[17px] text-ink [overflow-wrap:anywhere]" rt={11} leading={2.1} />
          <HangulLine state={ann[0] ?? OFF} size={13} className={KB_HIDE} />
        </>
      ) : (
        <p lang="ja" className="mt-1 text-[17px] text-ink [overflow-wrap:anywhere]">
          {choice.before ? <JaText as="span" text={choice.before} state={ann[1] ?? OFF} rt={11} leading={2.1} /> : null}
          <span aria-label={PRACTICE.blankAria} className="mx-0.5 inline-block min-w-[3em] border-b-2 border-ink2 align-baseline">
            {String.fromCodePoint(0x3000)}
          </span>
          {choice.after ? <JaText as="span" text={choice.after} state={ann[2] ?? OFF} rt={11} leading={2.1} /> : null}
        </p>
      )}
      <p className={`mt-0.5 text-[13px] text-ink2 break-keep ${KB_HIDE}`}>{view.ko}</p>
      <fieldset className={`mt-2 min-w-0 ${KB_HIDE}`}>
        <legend className="sr-only">{PRACTICE.chooseLegend}</legend>
        <div className="grid grid-cols-3 gap-2">
          {choice.choices.map((c, i) => {
            const isRight = right && i === choice.answerIndex
            const isWrong = wrong.has(i)
            return (
              <button
                key={i}
                type="button"
                lang="ja"
                aria-pressed={isRight || isWrong}
                onClick={() => pick(i)}
                className={`min-h-11 min-w-0 rounded-xl border px-1.5 py-1 text-[16px] [overflow-wrap:anywhere] ${
                  isRight ? 'border-transparent bg-good-soft text-ink' : isWrong ? 'border-bad text-ink' : 'border-line bg-surface text-ink'
                }`}
              >
                {c}
              </button>
            )
          })}
        </div>
      </fieldset>
      <div role="status" className={`mt-2 min-w-0 text-[13px] break-keep ${KB_HIDE}`}>
        {right ? (
          <>
            <p className="font-semibold text-good">{PRACTICE.right}</p>
            {voice ? <p className="mt-0.5 text-ink">{PRACTICE.rightNextVoice}</p> : null}
          </>
        ) : lastWrong ? (
          <p className="font-semibold text-bad">{PRACTICE.wrong}</p>
        ) : null}
      </div>
      {right && !voice ? (
        <button type="button" onClick={() => onFill(view.ja)} className={`${GHOST} mt-2 ${KB_HIDE}`}>
          {PRACTICE.fill}
        </button>
      ) : null}
    </div>
  )
}

function SayBody({ view, ann, voice }: { view: PracticeView; ann: Ann; voice: boolean }) {
  const [hint, setHint] = useState(false)
  const [answer, setAnswer] = useState(false)
  return (
    <div className="min-w-0">
      <p className={`text-[13px] text-ink2 break-keep ${KB_HIDE}`}>{PRACTICE.sayLead}</p>
      <p className="mt-1 text-[16px] text-ink break-keep">{view.ko}</p>
      <div className={`mt-2 flex min-w-0 flex-wrap gap-2 ${KB_HIDE}`}>
        {view.hintKo ? (
          <button type="button" aria-expanded={hint} onClick={() => setHint((h) => !h)} className={GHOST}>
            {PRACTICE.hint}
          </button>
        ) : null}
        <button type="button" aria-expanded={answer} onClick={() => setAnswer((a) => !a)} className={GHOST}>
          {PRACTICE.showAnswer}
        </button>
      </div>
      {hint && view.hintKo ? <p className={`mt-2 rounded-xl bg-accent-soft px-3 py-2 text-[13px] text-ink break-keep ${KB_HIDE}`}>{view.hintKo}</p> : null}
      {answer ? (
        <div className={`mt-2 min-w-0 ${KB_HIDE}`}>
          <JaText text={view.ja} state={ann} className="text-[17px] text-ink [overflow-wrap:anywhere]" rt={11} leading={2.1} />
          <HangulLine state={ann} size={13} />
        </div>
      ) : null}
      <p className={`mt-2 text-[12px] text-ink2 break-keep ${KB_HIDE}`}>{voice ? PRACTICE.sayHowVoice : PRACTICE.sayHowText}</p>
    </div>
  )
}

function RepeatBody({ rp, view, ann, voice, textOnly, onFill }: { rp: RolePlay; view: PracticeView; ann: Ann; voice: boolean; textOnly: boolean; onFill: (t: string) => void }) {
  const key = `practice:${view.messageId}`
  const sv = rp.sound.view(key)
  const line = rp.sound.line(key)
  const speakable = soundText(view.ja)
  const playing = sv.phase === 'playing'
  return (
    <div className="min-w-0">
      <p className={`text-[13px] text-ink2 break-keep ${KB_HIDE}`}>{PRACTICE.repeatLead}</p>
      <JaText text={view.ja} state={ann} className="mt-1 text-[17px] text-ink [overflow-wrap:anywhere]" rt={11} leading={2.1} />
      <HangulLine state={ann} size={13} className={KB_HIDE} />
      <p className={`mt-0.5 text-[13px] text-ink2 break-keep ${KB_HIDE}`}>{view.ko}</p>
      <div className={`mt-2 flex min-w-0 flex-wrap gap-2 ${KB_HIDE}`}>
        {!textOnly && speakable ? (
          <button
            type="button"
            aria-label={playing ? PRACTICE.stopAria : PRACTICE.listenAria}
            aria-busy={sv.busy || undefined}
            onClick={() => (playing ? rp.stopSound() : rp.playPractice(key, speakable))}
            className={`${GHOST} ${sv.look === 'on' ? 'border-transparent bg-accent text-on-accent' : ''}`}
          >
            {playing ? PRACTICE.stop : sv.busy ? PRACTICE.loadingSound : PRACTICE.listen}
          </button>
        ) : null}
        {!voice ? (
          <button type="button" onClick={() => onFill(view.ja)} className={GHOST}>
            {PRACTICE.fill}
          </button>
        ) : null}
      </div>
      {line.kind === 'msg' ? (
        <p role={SOUND_MSG[line.msg].role} className={`mt-1 text-[12px] break-keep ${SOUND_MSG[line.msg].tone === 'bad' ? 'text-bad' : 'text-ink2'} ${KB_HIDE}`}>
          {SOUND_MSG[line.msg].text}
        </p>
      ) : null}
      {voice ? <p className={`mt-2 text-[12px] text-ink2 break-keep ${KB_HIDE}`}>{PRACTICE.repeatHowVoice}</p> : null}
    </div>
  )
}
