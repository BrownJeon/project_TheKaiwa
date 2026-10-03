'use client'

/**
 * 평가 풀기(데모 v1 `#w*`·`#t*`·`#time-*`·`#submit-*`·`#leave`) — 머리(나가기·종류·답함·[회화]목소리 표시등·10분 타이머) · 번호 줄(결정 a=B 자유 이동 + [제출]) ·
 * 문항 카드(유일한 스크롤) · 아래 [이전]/[다음]·[제출하기].
 *  - 타이머는 서버 마감(`deadlineAt`) 기준이라 나갔다 와도 이어진다. 1분 남으면 토스트 1번, 지나면 막지 않고 "시간 지남 +m:ss" + 위 안내.
 *  - 답은 고를 때마다 #67 로 저장하고 "저장했어요"만 보인다. 글자 입력(읽기·글자 답·틀린 곳)은 [저장] 또는 다른 문항으로 갈 때 저장한다.
 *  - 말하기는 회화방과 같은 푸시투토크(TURN 발화 → #67 `utteranceId`). 발화 연결이 안 되면 알아들은 글자로 저장한다.
 *  - 듣고 답하기 소리는 #67a, 2번까지(e=B). 푸는 도중 목소리가 끊기거나 소리를 못 받으면 그 문항만 [글자로 보기](#67c, 결과에 표시).
 *  - 제출은 확인 시트(안 푼 문항 0점 안내·번호로 가기) → #68 → 채점 화면.
 *  - 저장하지 못한 답(이미 답한 문항의 수정 실패 포함)은 따로 모아 두고, 제출 전에 한 번 다시 보낸다. 그래도 남으면 #68 을 보내지 않고
 *    시트에 그 문항 번호를 보인다(REV-051 — 서버 `answered` 만 보면 옛 답이 그대로 채점된다).
 */
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { apiPost } from '@/components/common/api'
import { detailString, toErr } from '@/components/common/errors'
import Sheet from '@/components/common/Sheet'
import Toast, { useToast } from '@/components/common/Toast'
import { useNow } from '@/components/common/useNow'
import { Btn } from '@/components/common/ui'
import { useSpeechConfig } from '@/components/lesson/useLessonVoice'
import { STT_STATUS_COPY } from '@/components/speech/sttCopy'
import TtsRuntimeStatusIndicator from '@/components/speech/TtsRuntimeStatusIndicator'
import type { SttFinal } from '@/components/speech/useRealtimeStt'
import type { AnswerBody, AnswerResult, EvaluationDetail, EvaluationItem, RevealResult, SubmitResult } from '@/types/evaluation'
import { ITEM, ITEM_KIND, KIND_NAME, LEAVE, LISTEN, RUN, SUBMIT } from './evalCopy'
import { AssembleItem, ChoiceItem, ItemHead, ReadingItem, SpeakItem, SpotItem, type ListenView, type SaveState, type VoiceView } from './EvalItems'
import {
  clampIndex,
  clockText,
  EVAL_TIME_LIMIT_SEC,
  firstOpenIndex,
  koDuration,
  listenMode,
  missingIndexes,
  promptStr,
  recordSaveOutcome,
  remainSecOf,
  sameSpot,
  spanSec,
  spotBody,
  spotDraftFrom,
  spotReady,
  spotSegments,
  submitGate,
  timerTone,
  unsavedIndexes,
  WARN_SEC,
  type SaveOutcome,
  type SaveRetry,
  type SpotDraft,
} from './logic'
import { AlertBox, SumGrid, TextLink } from './parts'
import { useEvalListen } from './useEvalListen'
import { useEvalVoice } from './useEvalVoice'

const SPEAK_KINDS = new Set(['LISTEN_RESPOND', 'SITUATION_RESPOND'])

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

function Timer({ remain }: { remain: number | null }) {
  const tone = timerTone(remain)
  const box = tone === 'over' ? 'bg-bad' : tone === 'warn' ? 'bg-bad-soft' : 'bg-surface2'
  const txt = tone === 'over' ? 'text-surface' : tone === 'warn' ? 'text-bad' : ''
  const label = tone === 'over' ? RUN.timerLabel.over : tone === 'warn' ? RUN.timerLabel.warn : RUN.timerLabel.normal
  const value = remain === null ? '—' : clockText(remain)
  const aria = remain === null ? label : remain < 0 ? RUN.timerAria.over(koDuration(-remain)) : RUN.timerAria.normal(koDuration(remain))
  return (
    <div role="timer" aria-label={aria} className={`flex h-11 min-w-[68px] flex-none flex-col items-end justify-center rounded-xl px-2.5 tabular-nums ${box}`}>
      <span className={`whitespace-nowrap text-[11px] leading-[14px] ${txt || 'text-ink2'}`}>{label}</span>
      <span className={`text-[17px] font-bold leading-[22px] ${txt}`}>{value}</span>
    </div>
  )
}

interface Pending {
  itemId: string
  body: AnswerBody
  failed: boolean
}

export default function EvalRunner({ detail, onSubmitted, onConflict }: { detail: EvaluationDetail; onSubmitted: () => void; onConflict: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const { show } = toast
  const [items, setItems] = useState<EvaluationItem[]>(detail.items)
  const [idx, setIdx] = useState(() => firstOpenIndex(detail.items))
  const [deadlineAt, setDeadlineAt] = useState(detail.deadlineAt)
  const [reading, setReading] = useState<Record<string, string>>(() => Object.fromEntries(detail.items.filter((i) => i.kind === 'READING_INPUT').map((i) => [i.id, i.answerText ?? ''])))
  const [texts, setTexts] = useState<Record<string, string>>(() => Object.fromEntries(detail.items.filter((i) => SPEAK_KINDS.has(i.kind)).map((i) => [i.id, i.answerText ?? ''])))
  const [asm, setAsm] = useState<Record<string, number[]>>(() => Object.fromEntries(detail.items.filter((i) => i.kind === 'ASSEMBLE').map((i) => [i.id, i.answerOrder ?? []])))
  const [spots, setSpots] = useState<Record<string, SpotDraft>>(() => Object.fromEntries(detail.items.filter((i) => i.kind === 'CORRECTION_SPOT').map((i) => [i.id, spotDraftFrom(i)])))
  const [revealed, setRevealed] = useState<Record<string, string>>(() =>
    Object.fromEntries(detail.items.filter((i) => i.kind === 'LISTEN_RESPOND' && i.textRevealed && promptStr(i.prompt, 'textJa')).map((i) => [i.id, promptStr(i.prompt, 'textJa')])),
  )
  const [revealBusy, setRevealBusy] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [textMode, setTextMode] = useState(false)
  const [errDismissed, setErrDismissed] = useState<unknown>(null)
  const [sheet, setSheet] = useState<'submit' | 'leave' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState(false)
  const [live, setLive] = useState('')
  const stripRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const voiceItemRef = useRef<string | null>(null)
  const inFlight = useRef(0)
  const saveChain = useRef<Promise<unknown>>(Promise.resolve())
  const unsavedRef = useRef<Map<string, SaveRetry>>(new Map())
  /** 문항별로 줄에 남은 저장 수 — `retrySave` 가 옛 본문으로 새 답을 덮지 않게. */
  const queued = useRef(new Map<string, number>())
  const [unsaved, setUnsaved] = useState<ReadonlyMap<string, SaveRetry>>(() => new Map())

  const { config, textFirst } = useSpeechConfig()
  useEffect(() => {
    if (textFirst) queueMicrotask(() => setTextMode(true))
  }, [textFirst])

  const listen = useEvalListen(detail.id, show)
  const now = useNow(true)
  const remain = remainSecOf(deadlineAt, now)
  const item = items[idx]
  const n = items.length
  const answered = items.filter((i) => i.answered).length
  const missing = missingIndexes(items)
  const unsavedIdx = unsavedIndexes(items, unsaved)
  const isTalk = detail.kind === 'TALK'

  const prevRemain = useRef<number | null>(null)
  useEffect(() => {
    const p = prevRemain.current
    prevRemain.current = remain
    if (p === null || remain === null) return
    if (p > WARN_SEC && remain <= WARN_SEC && remain >= 0) {
      queueMicrotask(() => {
        show(RUN.oneMinute, 4000)
        setLive(RUN.oneMinute)
      })
    }
    if (p >= 0 && remain < 0) queueMicrotask(() => setLive(RUN.overAnnounce))
  }, [remain, show])

  useLayoutEffect(() => {
    const strip = stripRef.current
    const cur = strip?.querySelector<HTMLElement>('[aria-current="step"]')
    if (strip && cur) strip.scrollLeft = Math.max(0, cur.offsetLeft - (strip.clientWidth - cur.offsetWidth) / 2)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [idx])

  const applyResult = useCallback((itemId: string, r: AnswerResult) => {
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, answered: true, answerText: r.answerText, answerOrder: r.answerOrder, answerSpot: r.answerSpot ?? null, inputSource: r.inputSource, answeredAt: r.answeredAt } : it)))
    setDeadlineAt((d) => d ?? r.deadlineAt)
  }, [])

  /** 제출이 곧바로 읽어야 해서 ref 가 기준이고, 상태는 화면 표시용 사본이다. */
  const markSave = useCallback((itemId: string, outcome: SaveOutcome, retry?: SaveRetry) => {
    const next = recordSaveOutcome(unsavedRef.current, itemId, outcome, retry)
    unsavedRef.current = next
    setUnsaved(next)
  }, [])

  /**
   * 저장(#67). `quiet` = 다른 문항으로 가며 저장 — 결과를 토스트로만 알린다. 409(제출·채점 끝)는 화면을 다시 읽는다.
   * 요청은 한 줄로 차례대로 보낸다(빠르게 두 번 고르면 나중 것이 남게, 제출 전에 남은 저장이 먼저 끝나게 — `submit` 이 이 줄을 기다린다).
   */
  const save = useCallback(
    (itemId: string, body: AnswerBody, o: { quiet?: boolean; textFallback?: string } = {}): Promise<SaveOutcome> => {
      const my = ++inFlight.current
      const path = `/api/v1/evaluations/${encodeURIComponent(detail.id)}/items/${encodeURIComponent(itemId)}/answer`
      setPending({ itemId, body, failed: false })
      queued.current.set(itemId, (queued.current.get(itemId) ?? 0) + 1)
      const attempt = async (): Promise<SaveOutcome> => {
        try {
          let r: AnswerResult
          try {
            r = await apiPost<AnswerResult>(path, body)
          } catch (e) {
            const err = toErr(e)
            const reason = detailString(err, 'reason') ?? ''
            if (err.status === 409 && body.utteranceId && reason.startsWith('UTTERANCE_') && o.textFallback) r = await apiPost<AnswerResult>(path, { answerText: o.textFallback, inputSource: 'TEXT' })
            else throw e
          }
          applyResult(itemId, r)
          markSave(itemId, 'OK')
          if (my === inFlight.current) setPending(null)
          if (o.quiet) show(RUN.savedToast)
          return 'OK'
        } catch (e) {
          const err = toErr(e)
          if (err.status === 409) {
            markSave(itemId, 'CONFLICT')
            if (my === inFlight.current) setPending(null)
            onConflict()
            return 'CONFLICT'
          }
          markSave(itemId, 'FAIL', { body, textFallback: o.textFallback })
          if (my === inFlight.current) setPending({ itemId, body, failed: true })
          if (o.quiet) show(RUN.saveFailToast)
          return 'FAIL'
        }
      }
      const run = async (): Promise<SaveOutcome> => {
        try {
          return await attempt()
        } finally {
          const left = (queued.current.get(itemId) ?? 1) - 1
          if (left > 0) queued.current.set(itemId, left)
          else queued.current.delete(itemId)
        }
      }
      const p = saveChain.current.then(run, run)
      saveChain.current = p.catch(() => 'FAIL')
      return p
    },
    [applyResult, detail.id, markSave, onConflict, show],
  )

  /**
   * 저장하지 못한 그 본문 그대로 다시 보낸다(음성 답이면 알아들은 글자 대체도 함께).
   * 같은 문항의 저장이 아직 줄에 있으면 그쪽이 더 새 답이라 보내지 않는다 — 옛 본문을 뒤에 다시 보내면 새 답을 덮는다.
   */
  const retrySave = useCallback(
    (itemId: string): Promise<SaveOutcome> => {
      if (queued.current.has(itemId)) return saveChain.current.then(() => (unsavedRef.current.has(itemId) ? 'FAIL' : 'OK'))
      const r = unsavedRef.current.get(itemId)
      return r ? save(itemId, r.body, { textFallback: r.textFallback }) : Promise.resolve('OK')
    },
    [save],
  )

  /** 지금 문항의 글자 초안이 저장본과 다르면 저장한다(다른 문항으로 가기·제출 시트·나가기 전). */
  const flush = useCallback(() => {
    const it = items[idx]
    if (!it || (pending && pending.itemId === it.id && !pending.failed)) return
    if (it.kind === 'READING_INPUT') {
      const d = (reading[it.id] ?? '').trim()
      if (d && d !== it.answerText) void save(it.id, { answerText: d }, { quiet: true })
    } else if (SPEAK_KINDS.has(it.kind) && textMode) {
      const d = (texts[it.id] ?? '').trim()
      if (d && (d !== it.answerText || it.inputSource !== 'TEXT')) void save(it.id, { answerText: d, inputSource: 'TEXT' }, { quiet: true })
    } else if (it.kind === 'CORRECTION_SPOT') {
      const segMode = spotSegments(it).length > 0
      const sp = spots[it.id]
      if (sp && spotReady(segMode, sp, promptStr(it.prompt, 'sentenceJa')) && !sameSpot(segMode, sp, it)) void save(it.id, spotBody(segMode, sp), { quiet: true })
    }
  }, [items, idx, pending, reading, texts, textMode, spots, save])

  const onFinal = useCallback(
    (f: SttFinal) => {
      const itemId = voiceItemRef.current
      const text = f.text.trim()
      if (!itemId || !text) return
      setTexts((prev) => ({ ...prev, [itemId]: text }))
      if (f.utteranceId) void save(itemId, { inputSource: 'REALTIME_STT', utteranceId: f.utteranceId }, { textFallback: text })
      else void save(itemId, { answerText: text, inputSource: 'TEXT' })
    },
    [save],
  )

  const saving = !!pending && !pending.failed && pending.itemId === item?.id
  const voice = useEvalVoice({
    config,
    playing: listen.phase === 'playing',
    stopSound: listen.stop,
    hadAnswer: !!item?.answered,
    busy: saving && SPEAK_KINDS.has(item?.kind ?? ''),
    busyText: STT_STATUS_COPY.finishing,
    onFinal,
    onToast: show,
  })
  const goTo = (i: number) => {
    const next = clampIndex(i, n)
    if (next === idx) return
    flush()
    listen.stop()
    setErrDismissed(null)
    voice.setHint(null)
    setIdx(next)
  }

  const reveal = async (itemId: string) => {
    if (revealBusy) return
    setRevealBusy(itemId)
    try {
      const r = await apiPost<RevealResult>(`/api/v1/evaluations/${encodeURIComponent(detail.id)}/items/${encodeURIComponent(itemId)}/reveal`)
      listen.stop()
      listen.clearFailed(itemId)
      setRevealed((prev) => ({ ...prev, [itemId]: r.textJa }))
      setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, textRevealed: true } : it)))
    } catch (e) {
      if (toErr(e).status === 409) onConflict()
      else show(LISTEN.revealFail)
    } finally {
      setRevealBusy(null)
    }
  }

  const openSubmit = () => {
    flush()
    listen.stop()
    setSubmitErr(false)
    setSheet('submit')
  }

  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    setSubmitErr(false)
    try {
      await saveChain.current
      if (submitGate(unsavedRef.current) === 'BLOCK') {
        for (const id of [...unsavedRef.current.keys()]) {
          if ((await retrySave(id)) === 'CONFLICT') {
            setSubmitting(false)
            setSheet(null)
            return
          }
        }
        if (submitGate(unsavedRef.current) === 'BLOCK') {
          setSubmitting(false)
          setLive(SUBMIT.unsaved[0])
          return
        }
      }
      await apiPost<SubmitResult>(`/api/v1/evaluations/${encodeURIComponent(detail.id)}/submit`)
      setSheet(null)
      onSubmitted()
    } catch (e) {
      const err = toErr(e)
      setSubmitting(false)
      if (err.status === 409) {
        setSheet(null)
        onConflict()
        return
      }
      setSubmitErr(true)
    }
  }

  if (!item) return null
  const mine = pending && pending.itemId === item.id ? pending : null
  const lost = unsaved.get(item.id)
  const s: SaveState = {
    pending: mine ? mine.body : (lost?.body ?? null),
    busy: saving,
    failed: mine ? mine.failed : !!lost,
    retry: () => void retrySave(item.id),
  }
  const over = remain !== null && remain < 0
  const last = idx === n - 1

  let body: React.ReactNode
  switch (item.kind) {
    case 'MEANING_CHOICE':
    case 'USAGE_CHOICE':
    case 'CHUNK_CLASSIFY':
      body = <ChoiceItem item={item} s={s} onSave={(b) => void save(item.id, b)} />
      break
    case 'READING_INPUT':
      body = (
        <ReadingItem
          item={item}
          s={s}
          inputId={`eval-ri-${item.id}`}
          draft={reading[item.id] ?? ''}
          onDraft={(v) => setReading((prev) => ({ ...prev, [item.id]: v }))}
          onSave={() => {
            const d = (reading[item.id] ?? '').trim()
            if (!d) return show(ITEM.writeFirst)
            void save(item.id, { answerText: d })
          }}
        />
      )
      break
    case 'LISTEN_RESPOND':
    case 'SITUATION_RESPOND': {
      const lv: ListenView | null =
        item.kind === 'LISTEN_RESPOND'
          ? {
              mode: listenMode({ revealed: !!revealed[item.id], textOnly: listen.textOnly, audioErr: listen.failed(item.id) }),
              played: listen.played(item.id),
              playing: listen.active === item.id && listen.phase === 'playing',
              loading: listen.active === item.id && listen.phase === 'loading',
              revealedText: revealed[item.id] ?? null,
              revealBusy: revealBusy === item.id,
              onPlay: () => (listen.active === item.id ? listen.stop() : listen.play(item.id)),
              onBlocked: () => show(LISTEN.noneWhy),
              onReveal: () => void reveal(item.id),
              onAudioRetry: () => listen.play(item.id),
            }
          : null
      const vv: VoiceView = {
        textMode,
        draft: texts[item.id] ?? '',
        onDraft: (v) => setTexts((prev) => ({ ...prev, [item.id]: v })),
        onSaveText: () => {
          const d = (texts[item.id] ?? '').trim()
          if (!d) return show(ITEM.writeFirst)
          void save(item.id, { answerText: d, inputSource: 'TEXT' })
        },
        onToggleMode: () => {
          setTextMode((m) => !m)
          setErrDismissed(voice.error)
        },
        voice: {
          ...voice,
          press: () => {
            voiceItemRef.current = item.id
            voice.press()
          },
        },
        errDismissed: errDismissed === voice.error,
        onDismissErr: () => setErrDismissed(voice.error),
        saving,
        textareaId: `eval-ta-${item.id}`,
      }
      body = <SpeakItem item={item} s={s} listen={lv} v={vv} />
      break
    }
    case 'ASSEMBLE':
      body = (
        <AssembleItem
          item={item}
          s={s}
          draft={asm[item.id] ?? []}
          onDraft={(d) => setAsm((prev) => ({ ...prev, [item.id]: d }))}
          onComplete={(d) => void save(item.id, { pieceOrder: d })}
        />
      )
      break
    case 'CORRECTION_SPOT': {
      const segMode = spotSegments(item).length > 0
      const sp = spots[item.id] ?? spotDraftFrom(item)
      body = (
        <SpotItem
          item={item}
          s={s}
          draft={sp}
          onDraft={(d) => setSpots((prev) => ({ ...prev, [item.id]: d }))}
          onSave={() => void save(item.id, spotBody(segMode, sp))}
          onBlocked={(why) => show(why)}
          ids={{ text: `eval-spt-${item.id}`, fix: `eval-spf-${item.id}`, why: `eval-spw-${item.id}` }}
        />
      )
      break
    }
  }

  const usedSec = spanSec(detail.startedAt, now ? new Date(now).toISOString() : null)
  return (
    <div className="flex h-full min-h-0 flex-col bg-ground">
      <header className="flex h-14 min-w-0 flex-none items-center gap-1 bg-surface pl-1 pr-2.5">
        <button type="button" aria-label={RUN.leaveAria} onClick={() => setSheet('leave')} className="grid h-11 w-11 flex-none place-items-center rounded-full text-ink">
          <BackIcon />
        </button>
        <div className="min-w-0 flex-1 pl-0.5">
          <h1 className="truncate text-[16px] font-semibold leading-5">
            {KIND_NAME[detail.kind]} · {detail.level}
          </h1>
          <p className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-[12px] leading-4 text-ink2">
            <span>{RUN.answered(answered, n)}</span>
            {isTalk ? (
              <>
                <span aria-hidden="true" className="text-ink3">
                  ·
                </span>
                <TtsRuntimeStatusIndicator onAnnounce={show} />
              </>
            ) : null}
          </p>
        </div>
        <Timer remain={remain} />
      </header>
      <nav aria-label={RUN.navAria} className="flex-none border-b border-line bg-surface">
        <div ref={stripRef} className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pb-2.5 pt-1.5">
          {items.map((it, k) => {
            const cur = k === idx
            return (
              <button
                key={it.id}
                type="button"
                aria-label={RUN.qAria(k + 1, ITEM_KIND[it.kind], it.answered)}
                aria-current={cur ? 'step' : undefined}
                onClick={() => goTo(k)}
                className={`h-11 w-11 flex-none rounded-xl border text-[15px] font-semibold tabular-nums ${it.answered ? 'border-ink bg-ink text-surface' : cur ? 'border-line bg-surface text-ink' : 'border-line bg-surface text-ink2'} ${
                  cur ? 'shadow-[0_0_0_2px_var(--color-surface),0_0_0_4px_var(--color-accent)]' : ''
                }`}
              >
                {k + 1}
              </button>
            )
          })}
          <button type="button" onClick={openSubmit} className="h-11 flex-none whitespace-nowrap rounded-xl border border-accent bg-surface px-3.5 text-[14px] font-bold text-accent">
            {RUN.submit}
          </button>
        </div>
      </nav>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-3.5">
        {over ? (
          <div role="status" className="mb-2.5 rounded-xl bg-bad-soft px-3.5 py-3 text-[13.5px] text-ink break-keep">
            <p>
              <b className="text-bad">{RUN.overBanner[0]}</b>
              {RUN.overBanner[1]}
            </p>
            <p className="mt-1">{RUN.overBanner2}</p>
            <TextLink onClick={openSubmit} tone="ink">
              {RUN.overSubmit}
            </TextLink>
          </div>
        ) : null}
        <section aria-labelledby={`eval-qh-${item.id}`} className="min-w-0 rounded-[14px] border border-line bg-surface p-3.5">
          <h2 id={`eval-qh-${item.id}`} className="sr-only">
            {idx + 1}번 문항, {ITEM_KIND[item.kind]}
          </h2>
          <ItemHead index={idx} item={item} />
          {body}
        </section>
      </div>
      <div className="flex flex-none gap-2 border-t border-line bg-surface px-4 pt-2" style={{ paddingBottom: 'max(10px, var(--safe-bottom, env(safe-area-inset-bottom, 0px)))' }}>
        <Btn variant="ghost" className={`min-w-0 flex-1 ${idx === 0 ? 'opacity-40' : ''}`} aria-disabled={idx === 0 || undefined} onClick={() => (idx === 0 ? show(RUN.firstItem) : goTo(idx - 1))}>
          {RUN.prev}
        </Btn>
        {last ? (
          <Btn className="min-w-0 flex-1" onClick={openSubmit}>
            {RUN.submitFull}
          </Btn>
        ) : (
          <Btn className="min-w-0 flex-1" onClick={() => goTo(idx + 1)}>
            {RUN.next}
          </Btn>
        )}
      </div>

      <Sheet open={sheet === 'submit'} title={SUBMIT.title} dismissible={!submitting} onClose={() => setSheet(null)}>
        <SumGrid
          cells={[
            { value: String(answered), label: SUBMIT.answered },
            { value: String(missing.length), label: SUBMIT.missing, warn: missing.length > 0 },
            over
              ? { value: clockText(remain ?? 0), label: SUBMIT.over, warn: true }
              : { value: clockText(Math.min(usedSec ?? 0, detail.timeLimitSec || EVAL_TIME_LIMIT_SEC)), label: SUBMIT.used },
          ]}
        />
        {missing.length ? (
          <AlertBox className="mt-3">
            <p>
              <b className="font-bold">{SUBMIT.missingAlert(missing.length)}</b>
              {SUBMIT.missingAlert2}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {missing.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setSheet(null)
                    goTo(k)
                  }}
                  className="h-11 rounded-xl border border-line bg-surface px-3.5 text-[14px] font-semibold text-ink"
                >
                  {SUBMIT.jump(k + 1)}
                </button>
              ))}
            </div>
          </AlertBox>
        ) : null}
        {over ? <p className="mt-3 text-[13px] text-ink2 break-keep">{SUBMIT.overNote(koDuration(-(remain ?? 0)))}</p> : null}
        <p className="mt-3 text-[14px] break-keep">{SUBMIT.lock(detail.kind === 'WORDS')}</p>
        {unsavedIdx.length ? (
          <AlertBox className="mt-3">
            <p>
              <b className="font-bold">{SUBMIT.unsaved[0]}</b>
              {SUBMIT.unsaved[1]}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {unsavedIdx.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    if (submitting) return
                    setSheet(null)
                    goTo(k)
                    void retrySave(items[k].id)
                  }}
                  className="h-11 rounded-xl border border-line bg-surface px-3.5 text-[14px] font-semibold text-ink"
                >
                  {SUBMIT.jump(k + 1)}
                </button>
              ))}
            </div>
          </AlertBox>
        ) : null}
        {submitErr ? (
          <AlertBox className="mt-3">
            <p>
              <b className="font-bold">{SUBMIT.fail[0]}</b>
              {SUBMIT.fail[1]}
            </p>
            <p className="mt-1">{SUBMIT.fail2}</p>
          </AlertBox>
        ) : null}
        <div className="mt-3 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
          <Btn
            variant="ghost"
            onClick={() => {
              setSheet(null)
              if (missing.length) goTo(missing[0])
            }}
          >
            {missing.length ? SUBMIT.goAnswer : SUBMIT.back}
          </Btn>
          <Btn aria-busy={submitting || undefined} aria-disabled={submitting || undefined} className="aria-busy:opacity-70" onClick={() => void submit()}>
            {submitting ? SUBMIT.going : unsavedIdx.length ? SUBMIT.goRetry : missing.length ? SUBMIT.goAnyway : SUBMIT.go}
          </Btn>
        </div>
      </Sheet>

      <Sheet open={sheet === 'leave'} title={LEAVE.title} onClose={() => setSheet(null)}>
        {unsavedIdx.length ? <p className="text-[15px] font-semibold text-bad break-keep">{LEAVE.bodyUnsaved(unsavedIdx.map((k) => k + 1))}</p> : <p className="text-[15px]">{LEAVE.body}</p>}
        <p className="mt-1 text-[14px] break-keep">{LEAVE.body2}</p>
        <div className="mt-3 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
          <Btn
            variant="ghost"
            onClick={() => {
              flush()
              for (const id of [...unsavedRef.current.keys()]) void retrySave(id)
              listen.stop()
              router.push('/study/today')
            }}
          >
            {LEAVE.go}
          </Btn>
          <Btn onClick={() => setSheet(null)}>{LEAVE.stay}</Btn>
        </div>
      </Sheet>
      <p role="status" aria-live="polite" className="sr-only">
        {live}
      </p>
      <Toast message={toast.message} bottomPx={84} />
    </div>
  )
}
