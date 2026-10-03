'use client'

/**
 * ① 이해(screens §12-2 F · 데모 v2 `#l1`·`#l1-playing`·`#l1-memo`·`#l1-textonly`) — 구간 아코디언(한 번에 하나), 느리게 → 보통 순서로
 * **누를 때만** 재생(b=B), 느리게 들을 땐 글자를 가린다(d=B), 구간마다 들린 단어 메모 → 모아서 #62a 제안.
 * 다시 보기(끝낸 단계)에서는 쓰기 요청을 보내지 않는다(듣기만).
 * 줄 다시 듣기(task-025 데모 v1 `#l1`·`#l1-line`·`#l1-interrupt`·`#l1-review`): 줄마다 오른쪽 ▶ — 그 줄 하나만, 진행 기록 없음(`playLineReplay`).
 * 글자 가림 중에도 보이고 가림은 풀지 않는다. 자막만이면 숨긴다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { apiPost } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { readStore, writeStore } from '@/components/common/storage'
import ProposalCard from '@/components/chat/ProposalCard'
import { Badge, Btn, BtnRow, Card } from '@/components/common/ui'
import type { ProposalDto } from '@/types/chat'
import type { AudioPace, LessonContent, LessonDto, LessonProgress, MemoResult } from '@/types/lesson'
import { SKIP_REASON, U1 } from './lessonCopy'
import { activeLineReplay, cleanMemo, lineReplayKey, lineReplayPace, memoRequest, memoWordProblem, playLineReplay, rateLabel, segmentLines } from './logic'
import { RoleChip, Spinner, StopIcon, PlayIcon, Toggle } from './parts'
import type { LessonPlayback } from './useLessonPlayback'
import type { UseLesson } from './useLesson'
import { LESSON_KEYS } from './useLessonCreate'

const uniq = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b)

/** 줄 오른쪽 다시 듣기 — 보이는 원 32px, 누르는 범위 44px(줄 그리드 마지막 칸). */
function LineReplayButton({ n, slow, state, onClick }: { n: number; slow: boolean; state: 'idle' | 'loading' | 'playing'; onClick: () => void }) {
  const on = state !== 'idle'
  return (
    <button type="button" onClick={onClick} aria-label={on ? U1.lineStopAria(n) : U1.lineAria(n, slow)} className="-my-1 -mr-2 grid h-11 w-11 place-items-center rounded-full text-ink">
      <span aria-hidden="true" className={`grid h-8 w-8 place-items-center rounded-full border ${on ? 'border-ink bg-ink text-surface' : 'border-line bg-surface'}`}>
        {state === 'loading' ? <Spinner /> : on ? <StopIcon /> : <PlayIcon />}
      </span>
    </button>
  )
}

function withPlayed(p: LessonProgress, seg: number, pace: 'slow' | 'normal'): LessonProgress {
  const l = p.listen ?? {}
  const played = { slow: l.played?.slow ?? [], normal: l.played?.normal ?? [] }
  played[pace] = uniq([...played[pace], seg])
  const both = played.slow.includes(seg) && played.normal.includes(seg)
  return { ...p, listen: { ...l, played, segmentsDone: both ? uniq([...(l.segmentsDone ?? []), seg]) : l.segmentsDone ?? [] } }
}

export default function StageUnderstand({
  lesson,
  st,
  pb,
  reviewing,
  reading,
  onReading,
  learningSpeed,
  onToast,
  footer,
}: {
  lesson: LessonDto & { content: LessonContent }
  st: UseLesson
  pb: LessonPlayback
  reviewing: boolean
  reading: boolean
  onReading: (on: boolean) => void
  learningSpeed: number | null
  onToast: (m: string) => void
  footer: React.ReactNode
}) {
  const c = lesson.content
  const p = lesson.progress
  const segs = useMemo(() => segmentLines(c), [c])
  const segNums = [...segs.keys()].sort((a, b) => a - b)
  const textOnly = pb.textOnly
  const slowDone = p.listen?.played?.slow ?? []
  const normalDone = p.listen?.played?.normal ?? []
  const segDone = (k: number) => (p.listen?.segmentsDone ?? []).includes(k) || (slowDone.includes(k) && normalDone.includes(k))
  const [open, setOpen] = useState<number | null>(() => segNums.find((k) => !((p.listen?.segmentsDone ?? []).includes(k))) ?? segNums[0] ?? null)
  const [trans, setTrans] = useState(false)
  const [shown, setShown] = useState<Set<number>>(() => new Set())
  const memo = p.listen?.memo ?? []

  const play = (k: number, pace: 'slow' | 'normal') => {
    const key = `seg:${k}:${pace}`
    if (pb.active(key)) return pb.stop()
    if (pace === 'normal') setShown((s) => new Set(s).add(k))
    const lines = (segs.get(k) ?? []).map((idx) => ({ kind: 'dialogue' as const, idx, pace }))
    pb.playLines(key, lines, reviewing ? undefined : () => st.update((prev) => withPlayed(prev, k, pace), ['listen']))
  }
  const playingKey = (k: number) => (pb.active(`seg:${k}:slow`) ? `seg:${k}:slow` : pb.active(`seg:${k}:normal`) ? `seg:${k}:normal` : null)
  const lineNow = activeLineReplay(pb.snapshot)
  const playLine = (idx: number, pace: AudioPace) => (pb.active(lineReplayKey(idx)) ? pb.stop() : playLineReplay(pb, idx, pace))

  return (
    <div>
      <h2 tabIndex={-1} data-stage-title className="text-[17px] font-bold outline-none">
        {U1.title}
      </h2>
      <p className="mt-1 text-[13px] text-ink2 break-keep">{textOnly ? U1.descTextOnly : U1.desc}</p>
      <div role="group" aria-label={U1.toolsAria} className="mt-2.5 flex min-w-0 flex-wrap items-center gap-2">
        <Toggle on={reading} onClick={() => onReading(!reading)}>
          {U1.reading}
        </Toggle>
        <Toggle on={trans} onClick={() => setTrans(!trans)}>
          {U1.translation}
        </Toggle>
        <span className="ml-auto flex items-center gap-1 text-[12px] text-ink2">
          <RoleChip who="A" small />
          {c.rolesKo.A}
          <span className="ml-1" />
          <RoleChip who="B" small />
          {c.rolesKo.B}
        </span>
      </div>
      <div className="mt-2.5 flex flex-col gap-2">
        {segNums.map((k, si) => {
          const lines = segs.get(k) ?? []
          const isOpen = open === k
          const done = segDone(k)
          // 자막만으로 끝낸 구간(segmentsDone 만 있고 played 없음)은 목소리가 돌아와도 "다 들음"으로 보여 준다(배지와 순서 칸이 어긋나지 않게).
          const slow = slowDone.includes(k) || done
          const norm = normalDone.includes(k) || done
          const mcount = memo.filter((m) => m.segment === k).length
          const pk = playingKey(k)
          const line = pk ? pb.lineOf(pk) : null
          const hidden = !textOnly && !reviewing && !norm && !shown.has(k) && !done
          const lineHere = lineNow && lines.includes(lineNow.idx) ? lineNow : null
          const linePace = lineReplayPace(norm, reviewing)
          const lineBtn = (idx: number) =>
            textOnly ? null : (
              <LineReplayButton
                n={idx + 1}
                slow={linePace === 'slow'}
                state={lineNow?.idx !== idx ? 'idle' : lineNow.loading ? 'loading' : 'playing'}
                onClick={() => playLine(idx, linePace)}
              />
            )
          const last = si === segNums.length - 1
          const nextSeg = () => setOpen(segNums[si + 1] ?? null)
          let mark: React.ReactNode = null
          if (done) mark = <Badge tone="good">{textOnly ? U1.read : U1.heard}</Badge>
          else if (!textOnly && (slow || norm)) mark = <span className="text-[12px] text-ink2">{slow ? '느리게 ✓' : '느리게'} · {norm ? '보통 ✓' : '보통'}</span>
          let status: string
          if (lineHere) status = lineHere.loading ? U1.lineLoading(lineHere.idx + 1) : U1.linePlaying(lineHere.idx + 1, linePace === 'slow')
          else if (pk && line !== null) status = U1.statusPlaying(pk.endsWith(':slow'), line + 1, lines.length)
          else if (slow && norm) status = last ? U1.statusAllDone : U1.statusDone
          else if (slow) status = U1.statusThenNormal
          else status = U1.statusFirst
          const unblock = pb.blocked && (pk || lineHere)
          const rowCols = textOnly ? 'grid-cols-[26px_minmax(0,1fr)]' : 'grid-cols-[26px_minmax(0,1fr)_44px] items-start'
          return (
            <section key={k} className={`min-w-0 rounded-[14px] border bg-surface ${isOpen ? 'border-accent' : 'border-line'}`}>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`seg-body-${k}`}
                onClick={() => setOpen(isOpen ? null : k)}
                className="flex min-h-[52px] w-full min-w-0 items-center gap-2 px-3.5 text-left"
              >
                <span className="min-w-0 flex-1 text-[15px] font-semibold">
                  {U1.segment(k)}
                  <span className="text-[12px] font-normal text-ink2">
                    {U1.range(lines[0] + 1, lines[lines.length - 1] + 1)}
                    {mcount && !isOpen ? U1.memoCount(mcount) : ''}
                  </span>
                </span>
                {mark}
                <span aria-hidden="true" className={`text-[18px] text-ink3 transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                  ›
                </span>
              </button>
              {isOpen ? (
                <div id={`seg-body-${k}`} className="px-3.5 pb-3.5">
                  {hidden ? (
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[12px] text-ink2">{U1.hiddenNote}</span>
                      <button type="button" onClick={() => setShown((s) => new Set(s).add(k))} className="h-11 text-[13px] font-medium underline underline-offset-4">
                        {U1.showText}
                      </button>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-0.5">
                    {lines.map((idx, li) => {
                      const d = c.dialogue[idx]
                      const now = line === li || lineNow?.idx === idx
                      if (hidden)
                        return (
                          <div key={idx} className={`-mx-2 grid ${rowCols} gap-2 rounded-[10px] px-2 py-1.5 ${now ? 'bg-accent-soft' : ''}`}>
                            <RoleChip who={d.speaker} />
                            <div className="flex min-w-0 flex-col gap-1.5 pt-1">
                              <span className="sr-only">{U1.hiddenSr(c.rolesKo[d.speaker])}</span>
                              <span aria-hidden="true" className="block h-3.5 w-4/5 rounded bg-surface2" />
                              {Array.from(d.ja).length > 14 ? <span aria-hidden="true" className="block h-3.5 w-1/2 rounded bg-surface2" /> : null}
                            </div>
                            {lineBtn(idx)}
                          </div>
                        )
                      return (
                        <div key={idx} className={`-mx-2 grid ${rowCols} gap-2 rounded-[10px] px-2 py-1.5 ${now ? 'bg-accent-soft' : ''}`}>
                          <RoleChip who={d.speaker} />
                          <div className="min-w-0">
                            <span className="sr-only">{c.rolesKo[d.speaker]}: </span>
                            <p lang="ja" className="whitespace-pre-wrap text-[17px] leading-[1.7] [overflow-wrap:anywhere]">
                              {d.ja}
                            </p>
                            {reading && d.reading !== d.ja ? (
                              <p lang="ja" className="text-[14px] text-ink2 [overflow-wrap:anywhere]">
                                {d.reading}
                              </p>
                            ) : null}
                            {trans ? <p className="text-[13px] text-ink2 break-keep">{d.ko}</p> : null}
                          </div>
                          {lineBtn(idx)}
                        </div>
                      )
                    })}
                  </div>
                  {textOnly ? (
                    <>
                      <p role="status" className="mt-2 rounded-xl bg-surface2 px-3.5 py-2.5 text-[13px] break-keep">
                        {U1.textOnlyNote}
                      </p>
                      <div className="mt-2.5">
                        {done ? (
                          !last ? (
                            <Btn className="w-full" onClick={nextSeg}>
                              {U1.nextSegment}
                            </Btn>
                          ) : null
                        ) : (
                          <Btn
                            className="w-full"
                            onClick={() => {
                              if (!reviewing) st.update((prev) => ({ ...prev, listen: { ...(prev.listen ?? {}), segmentsDone: uniq([...(prev.listen?.segmentsDone ?? []), k]) } }), ['listen'])
                              if (!last) nextSeg()
                            }}
                          >
                            {last ? U1.readLast : U1.readNext}
                          </Btn>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="mt-2.5 text-[12px] text-ink2 break-keep">{U1.lineCaption}</p>
                      <ol aria-label={U1.ladderAria} className="mt-2 grid grid-cols-2 gap-1.5">
                        <li className={`grid h-7 place-items-center rounded-lg text-[12px] ${slow ? 'bg-good-soft font-semibold text-good' : 'bg-surface font-semibold ring-[1.5px] ring-accent ring-inset'}`}>
                          {U1.ladderSlow}
                          {slow ? ' ✓' : ''}
                        </li>
                        <li className={`grid h-7 place-items-center rounded-lg text-[12px] ${norm ? 'bg-good-soft font-semibold text-good' : slow ? 'bg-surface font-semibold ring-[1.5px] ring-accent ring-inset' : 'bg-surface2 text-ink2'}`}>
                          {U1.ladderNormal}
                          {norm ? ' ✓' : ''}
                        </li>
                      </ol>
                      <p role="status" className="mt-2 min-h-5 text-[13px] text-ink2 break-keep">
                        {status}
                      </p>
                      <div className="mt-2">
                        {unblock ? (
                          <Btn className="w-full" onClick={pb.resume}>
                            {U1.unblock}
                          </Btn>
                        ) : pk ? (
                          <Btn variant="ghost" className="w-full" onClick={() => pb.stop()}>
                            <StopIcon /> {U1.stop.replace('■ ', '')}
                          </Btn>
                        ) : !slow ? (
                          <Btn className="w-full" onClick={() => play(k, 'slow')}>
                            <PlayIcon /> {U1.playSlow(rateLabel(learningSpeed)).replace('▶ ', '')}
                          </Btn>
                        ) : !norm ? (
                          <div className="flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
                            <Btn onClick={() => play(k, 'normal')}>
                              <PlayIcon /> {U1.playNormal.replace('▶ ', '')}
                            </Btn>
                            <Btn variant="ghost" onClick={() => play(k, 'slow')}>
                              {U1.againSlow}
                            </Btn>
                          </div>
                        ) : !last ? (
                          <div className="flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
                            <Btn onClick={nextSeg}>{U1.nextSegment}</Btn>
                            <Btn variant="ghost" onClick={() => play(k, 'normal')}>
                              <PlayIcon /> {U1.replay.replace('▶ ', '')}
                            </Btn>
                          </div>
                        ) : (
                          <Btn variant="ghost" className="w-full" onClick={() => play(k, 'normal')}>
                            <PlayIcon /> {U1.replay.replace('▶ ', '')}
                          </Btn>
                        )}
                      </div>
                    </>
                  )}
                  <MemoBox segment={k} st={st} reviewing={reviewing} memo={memo} />
                </div>
              ) : null}
            </section>
          )
        })}
      </div>
      <MemoSummaryCard lesson={lesson} reviewing={reviewing} onToast={onToast} beforeAsk={st.flush} />
      <div className="mt-[18px]">{footer}</div>
    </div>
  )
}

function MemoBox({ segment, st, reviewing, memo }: { segment: number; st: UseLesson; reviewing: boolean; memo: { segment: number; ja: string }[] }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const list = memo.filter((m) => m.segment === segment)
  const full = list.length >= 5
  const inputId = `memo-in-${segment}`
  const errId = `memo-err-${segment}`
  const add = () => {
    const w = cleanMemo(value)
    const problem = memoWordProblem(w, segment, memo)
    if (problem) {
      setError(problem === 'NOT_JA' ? U1.memoNotJa : problem === 'DUP' ? U1.memoDup : problem === 'SEGMENT_FULL' ? U1.memoFull : U1.memoLessonFull)
      return
    }
    setError(null)
    setValue('')
    st.update((prev) => ({ ...prev, listen: { ...(prev.listen ?? {}), memo: [...(prev.listen?.memo ?? []), { segment, ja: w }] } }), ['listen'])
  }
  const remove = (w: string) =>
    st.update((prev) => ({ ...prev, listen: { ...(prev.listen ?? {}), memo: (prev.listen?.memo ?? []).filter((m) => !(m.segment === segment && m.ja === w)) } }), ['listen'])
  return (
    <div className="mt-3.5 border-t border-line pt-3">
      <div className="flex items-baseline justify-between gap-2 text-[13.5px] font-semibold">
        <label htmlFor={inputId}>{U1.memoLabel}</label>
        <span className="text-[12px] font-normal tabular-nums text-ink2">{list.length}/5</span>
      </div>
      <p className="mt-0.5 text-[12px] text-ink2 break-keep">{U1.memoHelp}</p>
      {list.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {list.map((m) => (
            <li key={m.ja} className="inline-flex h-9 max-w-full min-w-0 items-center gap-0.5 rounded-lg bg-surface2 pl-2.5 pr-0.5">
              <span lang="ja" className="truncate text-[15px]">
                {m.ja}
              </span>
              {!reviewing ? (
                <button
                  type="button"
                  aria-label={U1.memoRemove(m.ja)}
                  onClick={() => remove(m.ja)}
                  className="relative grid h-8 w-8 flex-none place-items-center text-ink2 before:absolute before:-inset-1.5 before:content-['']"
                >
                  ✕
                </button>
              ) : (
                <span className="w-2" />
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {!reviewing ? (
        <div className="mt-2 flex gap-2">
          <input
            id={inputId}
            lang="ja"
            value={value}
            maxLength={20}
            enterKeyHint="done"
            autoComplete="off"
            disabled={full}
            placeholder={full ? U1.memoFull : U1.memoPlaceholder}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errId : undefined}
            onChange={(e) => {
              setValue(e.target.value)
              if (error) setError(null)
            }}
            onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'nearest' })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault()
                add()
              }
            }}
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[16px] text-ink placeholder:text-ink3 disabled:bg-surface2"
          />
          <button
            type="button"
            aria-disabled={full || undefined}
            onClick={() => (full ? setError(U1.memoFull) : add())}
            className={`h-11 flex-none rounded-xl border border-line bg-surface px-4 text-[14px] font-semibold ${full ? 'opacity-40' : ''}`}
          >
            {U1.memoAdd}
          </button>
        </div>
      ) : null}
      {error ? (
        <p id={errId} role="alert" className="mt-1.5 text-[12.5px] text-bad break-keep">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function MemoSummaryCard({ lesson, reviewing, onToast, beforeAsk }: { lesson: LessonDto; reviewing: boolean; onToast: (m: string) => void; beforeAsk: () => Promise<unknown> }) {
  const memo = lesson.progress.listen?.memo ?? []
  const processed = lesson.progress.listen?.proposed ?? []
  const [result, setResult] = useState<MemoResult | 'loading' | null>(null)
  const restored = useRef(false)
  const lessonId = lesson.id

  const ask = async () => {
    if (result === 'loading' || !memo.length || reviewing) return
    const prev = result
    setResult('loading')
    try {
      // 서버 메모 초안이 화면과 같아야 한도(구간 5·수업 15) 판정이 맞다 — 모아 둔 #61 을 먼저 보낸다.
      await beforeAsk()
      const r = await apiPost<MemoResult>(`/api/v1/lessons/${encodeURIComponent(lessonId)}/memo`, memoRequest(memo))
      setResult(r)
    } catch (e) {
      const err = toErr(e)
      setResult(prev)
      onToast(err.status === 429 ? '잠시 후 다시 눌러 주세요.' : err.status === 0 ? '연결하지 못했어요. 네트워크를 확인해 주세요.' : U1.memoError)
    }
  }

  // 다시 들어왔을 때 — 제안 카드는 저장돼 있지 않으니 메모 초안으로 한 번 다시 불러 지금 상태를 복원한다(서버는 새 행을 만들지 않는다).
  useEffect(() => {
    if (restored.current || reviewing || !processed.length || !memo.length) return
    restored.current = true
    queueMicrotask(() => void ask())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 처음 한 번만
  }, [])

  const onProposal = (next: ProposalDto) => {
    if (result && result !== 'loading') {
      const before = result.proposals.find((x) => x.id === next.id)
      if (before?.status !== 'ACCEPTED' && next.status === 'ACCEPTED') {
        const n = Number(readStore('session', LESSON_KEYS.added(lessonId)) ?? '0') || 0
        writeStore('session', LESSON_KEYS.added(lessonId), String(n + 1))
      }
      setResult({ ...result, proposals: result.proposals.map((x) => (x.id === next.id ? next : x)) })
    }
  }

  if (!memo.length) {
    return (
      <Card flat className="mt-[18px]">
        <h3 className="text-[15px] font-semibold">{U1.sumTitle}</h3>
        <p className="mt-1 text-[13px] text-ink2 break-keep">{U1.sumEmpty}</p>
      </Card>
    )
  }
  const handled = new Set<string>()
  if (result && result !== 'loading') {
    for (const pr of result.proposals) {
      const m = pr.payload.memo
      handled.add(typeof m === 'string' ? m : String(pr.payload.surface ?? ''))
    }
    for (const s of result.skipped) if (s.reason !== 'ENRICH_FAILED') handled.add(s.surface)
  }
  const fresh = memo.filter((m) => !handled.has(m.ja)).length
  const enrichFailed = result && result !== 'loading' && result.skipped.some((s) => s.reason === 'ENRICH_FAILED')

  return (
    <Card className="mt-[18px]">
      <h3 className="text-[15px] font-semibold">{U1.sumCount(memo.length)}</h3>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {memo.map((m) => (
          <li key={`${m.segment}-${m.ja}`} lang="ja" className="inline-flex h-9 items-center rounded-lg bg-surface2 px-2.5 text-[15px]">
            {m.ja}
          </li>
        ))}
      </ul>
      {result === null ? (
        reviewing ? null : (
          <>
            <p className="mt-2 text-[13px] text-ink2 break-keep">{U1.sumHelp}</p>
            <Btn variant="ghost" className="mt-2 w-full" onClick={() => void ask()}>
              {U1.sumAsk}
            </Btn>
          </>
        )
      ) : result === 'loading' ? (
        <p role="status" className="mt-2 flex items-center gap-1.5 text-[13px] text-ink2">
          <span aria-hidden="true" className="inline-block h-3.5 w-3.5 rounded-full border-2 border-accent border-t-transparent motion-safe:animate-spin" />
          {U1.sumLoading}
        </p>
      ) : (
        <>
          <p className="mt-2 text-[13px] text-ink2 break-keep">{U1.sumResult(result.proposals.filter((x) => x.status === 'PROPOSED').length)}</p>
          <div className="mt-2 flex flex-col gap-2">
            {result.proposals.map((pr) => {
              const via = pr.payload.via
              const lineIdx = typeof pr.payload.lineIdx === 'number' ? pr.payload.lineIdx : null
              const memoWord = typeof pr.payload.memo === 'string' ? pr.payload.memo : null
              const surface = typeof pr.payload.surface === 'string' ? pr.payload.surface : ''
              return (
                <ProposalCard
                  key={pr.id}
                  proposal={pr}
                  onToast={onToast}
                  onChange={onProposal}
                  caption={via === 'CHUNK' && lineIdx !== null ? U1.captionChunk(lineIdx + 1) : via === 'ENRICH' ? U1.captionEnrich : undefined}
                  note={
                    memoWord && memoWord !== surface ? (
                      <>
                        메모 <span lang="ja">{memoWord}</span> {U1.memoChanged}
                      </>
                    ) : undefined
                  }
                />
              )
            })}
            {result.skipped.map((s) =>
              SKIP_REASON[s.reason] ? (
                <div key={`${s.surface}-${s.reason}`} className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-surface2 px-3.5 py-2.5">
                  <span lang="ja" className="min-w-0 truncate text-[15px]">
                    {s.surface}
                  </span>
                  <span className="flex-none text-right text-[12px] text-ink2 break-keep">{SKIP_REASON[s.reason]}</span>
                </div>
              ) : null,
            )}
          </div>
          {!reviewing && (fresh > 0 || enrichFailed) ? (
            <BtnRow>
              <Btn variant="ghost" onClick={() => void ask()}>
                {fresh > 0 ? U1.sumMore(fresh) : U1.sumAsk}
              </Btn>
            </BtnRow>
          ) : null}
        </>
      )}
    </Card>
  )
}
