'use client'

/**
 * 평가 결과(데모 v1 `#result-*`) — 총점·등급(결정 c=B 레벨 기준형, 색+모양+글자)·등급 범위 · 레벨 올리기 제안(SET_LEVEL, 채택해야 바뀜) ·
 * 선생님 한마디·다음에 집중할 것 · 영역별 5차원(0~5 막대+숫자) · 문항별 결과(누르면 내 답·정답·피드백, 들려준 문장도 이제 글자로).
 * 정답 색(초록·빨강)은 이 화면에서만 쓴다. 들려준 문장 다시 듣기는 #67a(횟수 제한 없음).
 */
import Link from 'next/link'
import { useState } from 'react'
import { apiPost } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import TeacherAvatar from '@/components/common/TeacherAvatar'
import Toast, { useToast } from '@/components/common/Toast'
import { formatMonthDay, todayKey } from '@/components/vocab/format'
import { kstDateKey } from '@/components/common/format'
import BackBar from '@/components/shell/BackBar'
import type { EvalDim, EvaluationDetail, EvaluationItem } from '@/types/evaluation'
import { CHUNK_CHOICES, DIM_NAME, DIM_ORDER, GRADE_RANGE, GRADE_SUB, ITEM_KIND, KIND_NAME, LEVEL, RESULT } from './evalCopy'
import { BlankSentence } from './EvalItems'
import { clockText, itemTone, koDuration, levelProposalView, levelRo, promptArr, promptStr, resultMeta, spotFix, type LevelProposalView } from './logic'
import { GradeChip, PlayIcon } from './parts'
import { EVAL_HISTORY_PATH } from './paths'
import { useEvalListen } from './useEvalListen'

const SUBJECTIVE = new Set(['LISTEN_RESPOND', 'SITUATION_RESPOND', 'CORRECTION_SPOT'])
const BOX = 'min-w-0 rounded-xl px-3 py-2.5'
const JA = 'whitespace-pre-wrap text-[17px] leading-[1.7] [overflow-wrap:anywhere]'

function Label({ good, children }: { good?: boolean; children: React.ReactNode }) {
  return <p className={`mb-0.5 text-[12px] font-semibold ${good ? 'text-good' : 'text-ink2'}`}>{children}</p>
}

function chunkLabel(v: unknown): string {
  return CHUNK_CHOICES.find((c) => c.value === v)?.label ?? ''
}

function MyAnswer({ it }: { it: EvaluationItem }) {
  const p = it.prompt
  if (!it.answered || it.answerText === null) return <p className="text-[13px] text-ink2">{RESULT.noAnswer}</p>
  switch (it.kind) {
    case 'MEANING_CHOICE':
      return <p className="text-[15px] break-keep">{it.answerText}</p>
    case 'CHUNK_CLASSIFY':
      return <p className="text-[15px]">{chunkLabel(it.answerText)}</p>
    case 'USAGE_CHOICE':
      return (
        <p lang="ja" className={JA}>
          <BlankSentence text={promptStr(p, 'sentenceJa')} fill={it.answerText} fillClass="font-semibold underline decoration-2 underline-offset-[5px]" />
        </p>
      )
    case 'READING_INPUT':
      return (
        <p lang="ja" className={JA}>
          {it.answerText}
        </p>
      )
    case 'ASSEMBLE': {
      const pieces = promptArr(p, 'pieces')
      return (
        <p lang="ja" className={JA}>
          {it.answerOrder ? it.answerOrder.map((k) => pieces[k] ?? '').join(' ') : it.answerText}
        </p>
      )
    }
    case 'CORRECTION_SPOT': {
      const seg = it.answerSpot != null ? promptArr(p, 'segments')[it.answerSpot] : undefined
      if (seg !== undefined)
        return (
          <>
            <p className="text-[14px]">
              {RESULT.pickedSpot}
              <span lang="ja">{seg}</span>
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[14px] [overflow-wrap:anywhere]">{it.answerText}</p>
          </>
        )
      return (
        <p lang="ja" className={JA}>
          {it.answerText}
        </p>
      )
    }
    default:
      return (
        <>
          <p lang="ja" className={JA}>
            {it.answerText}
          </p>
          <p className="text-[12px] text-ink2">{it.inputSource === 'TEXT' ? RESULT.byText : RESULT.byVoice}</p>
        </>
      )
  }
}

function RightAnswer({ it }: { it: EvaluationItem }) {
  const p = it.prompt
  const e = it.expected ?? {}
  switch (it.kind) {
    case 'MEANING_CHOICE':
      return <p className="text-[15px] break-keep">{promptArr(p, 'choices')[Number(e.answer)] ?? ''}</p>
    case 'CHUNK_CLASSIFY':
      return <p className="text-[15px]">{chunkLabel(e.chunkType)}</p>
    case 'USAGE_CHOICE':
      return (
        <p lang="ja" className={JA}>
          <BlankSentence text={promptStr(p, 'sentenceJa')} fill={promptArr(p, 'choices')[Number(e.answer)] ?? ''} fillClass="font-semibold underline decoration-good decoration-2 underline-offset-[5px]" />
        </p>
      )
    case 'READING_INPUT':
      return (
        <p lang="ja" className={JA}>
          {typeof e.reading === 'string' ? e.reading : ''}
        </p>
      )
    case 'ASSEMBLE':
      return (
        <p lang="ja" className={JA}>
          {Array.isArray(e.order) ? e.order.filter((x): x is string => typeof x === 'string').join(' ') : ''}
        </p>
      )
    case 'CORRECTION_SPOT': {
      const sentence = promptStr(p, 'sentenceJa')
      const corrected = typeof e.correctedJa === 'string' ? e.correctedJa : ''
      const f = spotFix(sentence, typeof e.wrongSpan === 'string' ? e.wrongSpan : '', corrected)
      return (
        <>
          {f ? (
            <p lang="ja" className={JA}>
              {f.before}
              <span className="line-through decoration-bad decoration-2">{f.wrong}</span>
              {f.fix ? (
                <>
                  {' '}
                  <span className="underline decoration-good decoration-2 underline-offset-[5px]">{f.fix}</span>
                </>
              ) : null}
              {f.after}
            </p>
          ) : null}
          {!f || !f.fix ? (
            <p lang="ja" className={`${JA} mt-1`}>
              {corrected}
            </p>
          ) : null}
          {typeof e.explanationKo === 'string' ? <p className="mt-1 text-[14px] break-keep">{e.explanationKo}</p> : null}
        </>
      )
    }
    default:
      return (
        <>
          <p lang="ja" className={JA}>
            {typeof e.modelAnswerJa === 'string' ? e.modelAnswerJa : ''}
          </p>
          {typeof e.modelReading === 'string' ? (
            <p lang="ja" className="text-[14px] leading-[1.6] text-ink2 [overflow-wrap:anywhere]">
              {e.modelReading}
            </p>
          ) : null}
          {typeof e.expectedGistKo === 'string' ? <p className="mt-1 text-[12px] text-ink2 break-keep">{RESULT.gist(e.expectedGistKo)}</p> : null}
        </>
      )
  }
}

function ItemDetail({ it, textOnly, playing, onReplay }: { it: EvaluationItem; textOnly: boolean; playing: boolean; onReplay: () => void }) {
  const p = it.prompt
  const desc = SUBJECTIVE.has(it.kind)
  const full = (it.score ?? 0) >= it.maxScore
  const dims = (it.dims ?? []).filter((d): d is EvalDim => d in DIM_NAME)
  return (
    <div className="flex flex-col gap-2.5 px-3.5 pb-3.5 pl-[50px]">
      {it.kind === 'LISTEN_RESPOND' ? (
        <div>
          <Label>
            {RESULT.heard}
            {it.textRevealed ? RESULT.heardRevealed : ''}
          </Label>
          <p lang="ja" className={JA}>
            {promptStr(p, 'textJa')}
          </p>
          {!textOnly ? (
            <button type="button" onClick={onReplay} className="mt-2 inline-flex h-11 items-center gap-2 rounded-xl bg-surface2 px-3.5 text-[14px] font-semibold">
              <PlayIcon size={14} />
              {playing ? RESULT.replay + '…' : RESULT.replay}
            </button>
          ) : null}
        </div>
      ) : it.kind === 'SITUATION_RESPOND' ? (
        <div>
          <Label>{RESULT.situation}</Label>
          <p className="text-[14px] break-keep">{promptStr(p, 'situationKo')}</p>
        </div>
      ) : it.kind === 'CORRECTION_SPOT' ? (
        <div>
          <Label>{RESULT.sentence}</Label>
          <p lang="ja" className={JA}>
            {promptStr(p, 'sentenceJa')}
          </p>
        </div>
      ) : it.kind === 'ASSEMBLE' ? (
        <div>
          <Label>{RESULT.meaning}</Label>
          <p className="text-[14px] break-keep">{promptStr(p, 'promptKo')}</p>
        </div>
      ) : null}
      <div className={`${BOX} bg-accent-soft`}>
        <Label>{RESULT.mine}</Label>
        <MyAnswer it={it} />
      </div>
      {full && !desc ? (
        <p className="text-[13px] text-ink2">{RESULT.correctLine}</p>
      ) : (
        <div className={`${BOX} bg-surface2`}>
          <Label good>{desc ? (it.kind === 'CORRECTION_SPOT' ? RESULT.fixed : RESULT.model) : RESULT.right}</Label>
          <RightAnswer it={it} />
        </div>
      )}
      {desc ? (
        <div>
          <Label>{RESULT.feedback}</Label>
          <p className="whitespace-pre-wrap text-[14px] break-keep [overflow-wrap:anywhere]">{it.answered ? (it.feedback ?? '') : RESULT.noAnswerFeedback}</p>
          {dims.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-lg bg-surface2 px-2 py-[3px] text-[12px]">{RESULT.dims}</span>
              {dims.map((d) => (
                <span key={d} className="rounded-lg bg-surface2 px-2 py-[3px] text-[12px]">
                  {DIM_NAME[d]}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ItemRow({ it, index, open, onToggle, textOnly, playing, onReplay }: { it: EvaluationItem; index: number; open: boolean; onToggle: () => void; textOnly: boolean; playing: boolean; onReplay: () => void }) {
  const tone = itemTone(it.score, it.maxScore)
  const sym = tone === 'full' ? '✓' : tone === 'zero' ? '✗' : '△'
  const st = tone === 'full' ? RESULT.full : tone === 'zero' ? (it.answered ? RESULT.wrong : RESULT.unanswered) : RESULT.part
  const ist = tone === 'full' ? 'bg-good-soft text-good' : tone === 'zero' ? 'bg-bad-soft text-bad' : 'bg-warn-soft text-ink'
  const tag = promptStr(it.prompt, 'surface') || (it.kind === 'CHUNK_CLASSIFY' ? promptStr(it.prompt, 'textJa') : '')
  const detailId = `eval-idet-${it.id}`
  return (
    <li className={index > 0 ? 'border-t border-line' : ''}>
      <button type="button" aria-expanded={open} aria-controls={detailId} onClick={onToggle} className="grid min-h-[60px] w-full grid-cols-[28px_minmax(0,1fr)_auto_18px] items-center gap-2.5 px-3 py-2 text-left">
        <span aria-hidden="true" className={`grid h-[26px] w-[26px] place-items-center rounded-full text-[13px] font-bold ${ist}`}>
          {sym}
        </span>
        <span className="min-w-0">
          <b className="block truncate text-[14px] font-semibold">
            {index + 1}. {ITEM_KIND[it.kind]}
            {tag ? (
              <>
                {' · '}
                <span lang="ja">{tag}</span>
              </>
            ) : null}
          </b>
          <span className="text-[12px] text-ink2">
            {st}
            {it.textRevealed ? RESULT.revealed : ''}
          </span>
        </span>
        <span className="whitespace-nowrap text-[14px] font-bold tabular-nums">{RESULT.score(it.score ?? 0, it.maxScore)}</span>
        <span aria-hidden="true" className={`text-[18px] text-ink3 motion-safe:transition-transform ${open ? 'rotate-90' : ''}`}>
          ›
        </span>
      </button>
      {open ? (
        <div id={detailId}>
          <ItemDetail it={it} textOnly={textOnly} playing={playing} onReplay={onReplay} />
        </div>
      ) : null}
    </li>
  )
}

function LevelCard({ v, onToast }: { v: LevelProposalView; onToast: (m: string) => void }) {
  const [status, setStatus] = useState(v.status)
  const [busy, setBusy] = useState<'a' | 'r' | null>(null)
  const [failed, setFailed] = useState(false)
  const [today] = useState(() => todayKey())
  const act = async (kind: 'accept' | 'reject') => {
    if (busy) return
    setBusy(kind === 'accept' ? 'a' : 'r')
    setFailed(false)
    try {
      await apiPost(`/api/v1/proposals/${encodeURIComponent(v.id)}/${kind}`)
      setStatus(kind === 'accept' ? 'ACCEPTED' : 'REJECTED')
      if (kind === 'accept') onToast(LEVEL.doneTitle(levelRo(v.to)))
    } catch (e) {
      const err = toErr(e)
      const st = typeof err.details.status === 'string' ? err.details.status : null
      if (err.status === 409 && st) setStatus(st)
      else setFailed(true)
    } finally {
      setBusy(null)
    }
  }
  if (status === 'ACCEPTED') {
    return (
      <section role="status" className="mt-[18px] rounded-[14px] border border-line bg-surface p-3.5">
        <div className="flex items-start gap-2.5">
          <span aria-hidden="true" className="grid h-9 w-9 flex-none place-items-center rounded-full bg-good-soft text-[17px] font-bold text-good">
            ✓
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">{LEVEL.doneTitle(levelRo(v.to))}</p>
            <p className="mt-1 text-[13px] text-ink2 break-keep">{LEVEL.doneBody(v.to)}</p>
          </div>
        </div>
      </section>
    )
  }
  if (status !== 'PROPOSED') {
    return (
      <section role="status" className="mt-[18px] rounded-[14px] bg-surface2 p-3.5">
        <p className="text-[14px] break-keep">{LEVEL.rejected(levelRo(v.from))}</p>
      </section>
    )
  }
  return (
    <section aria-labelledby="eval-level-title" className="mt-[18px] rounded-[14px] border-2 border-accent bg-surface p-3.5">
      <p className="text-[12px] text-ink2">{LEVEL.cap}</p>
      <h3 id="eval-level-title" className="text-[17px] font-bold">
        {LEVEL.title}
      </h3>
      <p aria-hidden="true" className="mt-2 flex items-center gap-2.5 text-[22px] font-bold">
        <span className="text-ink2">{v.from}</span>
        <span>→</span>
        <span>{v.to}</span>
      </p>
      <p className="sr-only">{LEVEL.arrowSr(v.from, levelRo(v.to))}</p>
      <p className="mt-2 text-[14px] break-keep">{LEVEL.why(v.from)}</p>
      {v.basis.length ? (
        <p className="mt-1 text-[12px] text-ink2 break-keep">{v.basis.map((b) => LEVEL.basisRow(b.date === today ? LEVEL.today : formatMonthDay(b.date), KIND_NAME[b.kind], b.score)).join(' · ')}</p>
      ) : null}
      <p className="mt-2 text-[13px] text-ink2 break-keep">{LEVEL.note(v.to)}</p>
      {failed ? (
        <div role="alert" className="mt-2 rounded-xl bg-bad-soft px-3.5 py-3 text-[13px] text-bad">
          {LEVEL.fail}
        </div>
      ) : null}
      <div className="mt-3 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
        <button type="button" aria-busy={busy === 'a' || undefined} onClick={() => void act('accept')} className="h-12 rounded-xl bg-accent px-4 text-[15px] font-semibold text-on-accent aria-busy:opacity-70">
          {busy === 'a' ? LEVEL.accepting : LEVEL.accept(levelRo(v.to))}
        </button>
        <button type="button" aria-busy={busy === 'r' || undefined} onClick={() => void act('reject')} className="h-12 rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold">
          {LEVEL.reject}
        </button>
      </div>
    </section>
  )
}

export default function EvalResult({ detail, teacherName }: { detail: EvaluationDetail; teacherName: string }) {
  const toast = useToast()
  const listen = useEvalListen(detail.id, toast.show)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const r = detail.result
  if (!r) return null
  const meta = resultMeta(detail)
  const proposal = levelProposalView(r.levelProposal)
  const date = r.completedAt ? formatMonthDay(kstDateKey(r.completedAt)) : ''
  return (
    <div className="flex h-full min-h-0 flex-col bg-ground">
      <BackBar backHref="/study/today" backLabel={RESULT.today} title={RESULT.title} subtitle={[KIND_NAME[detail.kind], detail.level, date].filter(Boolean).join(' · ')} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-3.5">
        <section aria-labelledby="eval-total" className="rounded-[14px] border border-line bg-surface px-3.5 pb-4 pt-[18px] text-center">
          <h2 id="eval-total" className="sr-only">
            {RESULT.totalAria}
          </h2>
          <p className="text-[48px] font-bold leading-[1.1] tabular-nums">
            {r.totalScore}
            <small className="ml-0.5 text-[16px] font-medium text-ink2">{RESULT.outOf}</small>
          </p>
          <p className="mt-2">
            <GradeChip grade={r.grade} />
          </p>
          <p className="mt-2 text-[12px] text-ink2 break-keep">
            {GRADE_RANGE[r.grade]} · {GRADE_SUB[r.grade]}
          </p>
          <p className="mt-2.5 flex flex-wrap justify-center gap-x-2.5 gap-y-1 text-[12.5px] text-ink2">
            <span>{RESULT.meta(meta.n, meta.answered)}</span>
            {meta.overSec !== null ? <span className="font-bold text-bad">{RESULT.over(clockText(-meta.overSec))}</span> : null}
            {meta.usedSec !== null ? <span>{RESULT.used(koDuration(meta.usedSec))}</span> : null}
          </p>
        </section>

        {proposal ? <LevelCard v={proposal} onToast={toast.show} /> : null}

        <section className="mt-[18px] rounded-[14px] border border-line bg-surface p-3.5">
          <div className="flex gap-2.5">
            <TeacherAvatar name={teacherName} />
            <div className="min-w-0 flex-1 text-[14px]">
              <Label>{RESULT.teacherSays}</Label>
              <p className="whitespace-pre-wrap break-keep [overflow-wrap:anywhere]">{r.comment}</p>
            </div>
          </div>
          {r.nextFocus.length ? (
            <>
              <h3 className="mt-3 text-[15px] font-semibold">{RESULT.focus}</h3>
              <ol className="mt-2 flex flex-col gap-1.5">
                {r.nextFocus.map((f, k) => (
                  <li key={k} className="grid grid-cols-[22px_minmax(0,1fr)] items-start gap-2 text-[14px]">
                    <span aria-hidden="true" className="grid h-[22px] w-[22px] place-items-center rounded-full bg-accent-soft text-[12px] font-bold">
                      {k + 1}
                    </span>
                    <span className="min-w-0 break-keep [overflow-wrap:anywhere]">{f}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </section>

        {r.rubric ? (
          <section className="mt-[18px] rounded-[14px] border border-line bg-surface p-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[15px] font-semibold">{RESULT.rubric}</h3>
              <span className="text-[12px] text-ink2">{RESULT.rubricScale}</span>
            </div>
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5">
              {DIM_ORDER.map((d) => {
                const v = Math.max(0, Math.min(5, r.rubric?.[d] ?? 0))
                return (
                  <div key={d} className="contents">
                    <dt className="whitespace-nowrap text-[13.5px]">{DIM_NAME[d]}</dt>
                    <dd role="img" aria-label={RESULT.rubricAria(DIM_NAME[d], v)} className="grid grid-cols-5 gap-[3px]">
                      {[0, 1, 2, 3, 4].map((k) => (
                        <i key={k} className={`h-3 rounded-[3px] ${k < v ? 'bg-accent' : 'bg-surface2'}`} />
                      ))}
                    </dd>
                    <dd aria-hidden="true" className="whitespace-nowrap text-right text-[13px] font-bold tabular-nums">
                      {v} / 5
                    </dd>
                  </div>
                )
              })}
            </dl>
            <p className="mt-3 text-[12px] text-ink2 break-keep">
              {RESULT.rubricNote}
              {detail.kind === 'WORDS' ? RESULT.rubricWords : ''}
            </p>
          </section>
        ) : null}

        <section className="mt-[18px]">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-[15px] font-semibold">{RESULT.items}</h3>
            <span className="text-[12px] text-ink2">{RESULT.itemsHint}</span>
          </div>
          <ul className="overflow-hidden rounded-[14px] border border-line bg-surface">
            {detail.items.map((it, k) => (
              <ItemRow
                key={it.id}
                it={it}
                index={k}
                open={!!open[it.id]}
                onToggle={() => setOpen((prev) => ({ ...prev, [it.id]: !prev[it.id] }))}
                textOnly={listen.textOnly}
                playing={listen.active === it.id}
                onReplay={() => (listen.active === it.id ? listen.stop() : listen.play(it.id, { count: false }))}
              />
            ))}
          </ul>
        </section>

        <div className="mt-[18px] flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
          <Link href={EVAL_HISTORY_PATH} className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold">
            {RESULT.history}
          </Link>
          <Link href="/study/today" className="inline-flex h-12 items-center justify-center rounded-xl bg-accent px-4 text-[15px] font-semibold text-on-accent">
            {RESULT.today}
          </Link>
        </div>
      </div>
      <Toast message={toast.message} bottomPx={24} />
    </div>
  )
}
