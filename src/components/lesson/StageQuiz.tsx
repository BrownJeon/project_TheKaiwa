'use client'

/**
 * ③ 문제(screens §12-2 H · 데모 v2 `#l3`·`#l3-wrong`·`#l3-sum`) — 4지선다, 고르는 즉시 정답·설명(화면이 `content.quiz[].answer` 로 채점 —
 * 자습이라 정답이 내용에 있다). 한 번만 고를 수 있고(첫 답 고정 — 서버도 바꾸지 않는다) 바로 #61 로 저장한다. 점수는 완료 때 서버가 다시 계산.
 * 문제 머리(task-025 데모 v1 `#l3-new`·`#l3-old`·`#l3-sum`, task-025b 데모 v1): 한국어 질문(굵게) → 일본어 문장(17px). promptKo 가 비었거나
 * 한글 없이 일본어뿐이면 공통 안내 줄 + 안내 노트(`quizPromptView`·`quizSummaryPrompt` 가 한글 인지로 고른다). 보기(답)에는 한국어를 붙이지 않는다(답 노출).
 */
import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/common/ui'
import type { LessonContent, LessonDto } from '@/types/lesson'
import { U3 } from './lessonCopy'
import { hasJa, quizPromptView, quizSummaryPrompt } from './logic'
import { InfoIcon } from './parts'
import type { UseLesson } from './useLesson'

function Dots({ quiz, answers, current }: { quiz: LessonContent['quiz']; answers: (number | null)[]; current: number | null }) {
  return (
    <div aria-hidden="true" className="flex gap-1">
      {quiz.map((q, i) => {
        const a = answers[i]
        const cls =
          typeof a !== 'number'
            ? i === current
              ? 'bg-surface ring-2 ring-accent ring-inset font-semibold'
              : 'bg-surface2 text-ink2'
            : a === q.answer
              ? 'bg-good-soft text-good font-semibold'
              : 'bg-bad-soft text-bad font-semibold'
        return (
          <span key={q.id} className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${cls}`}>
            {typeof a !== 'number' ? i + 1 : a === q.answer ? '✓' : '✗'}
          </span>
        )
      })}
    </div>
  )
}

function Choice({ text, className = '' }: { text: string; className?: string }) {
  return hasJa(text) ? (
    <span lang="ja" className={`min-w-0 text-[17px] [overflow-wrap:anywhere] ${className}`}>
      {text}
    </span>
  ) : (
    <span className={`min-w-0 text-[15px] break-keep [overflow-wrap:anywhere] ${className}`}>{text}</span>
  )
}

export default function StageQuiz({ lesson, st, reviewing, footer }: { lesson: LessonDto & { content: LessonContent }; st: UseLesson; reviewing: boolean; footer: React.ReactNode }) {
  const quiz = lesson.content.quiz
  const answers = quiz.map((_, i) => {
    const a = lesson.progress.quiz?.answers?.[i]
    return typeof a === 'number' ? a : null
  })
  const firstOpen = answers.findIndex((a) => a === null)
  const [idx, setIdx] = useState(firstOpen === -1 ? 0 : firstOpen)
  const [summary, setSummary] = useState(firstOpen === -1)
  const nextRef = useRef<HTMLButtonElement>(null)
  const firstChoiceRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [focusNext, setFocusNext] = useState<'next' | 'choice' | null>(null)
  useEffect(() => {
    if (focusNext === 'next') nextRef.current?.focus()
    if (focusNext === 'choice') {
      firstChoiceRef.current?.focus()
      cardRef.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [focusNext, idx])

  if (summary || reviewing) {
    const correct = quiz.filter((q, i) => answers[i] === q.answer).length
    return (
      <div>
        <h2 tabIndex={-1} data-stage-title className="text-[17px] font-bold outline-none">
          {U3.sumTitle}
        </h2>
        <Card className="mt-2.5">
          <p className="text-[22px] font-bold tabular-nums">{U3.sumHead(quiz.length, correct)}</p>
          <div className="mt-2">
            <Dots quiz={quiz} answers={answers} current={null} />
          </div>
          <ul className="mt-3 flex flex-col gap-2.5">
            {quiz.map((q, i) => {
              const ok = answers[i] === q.answer
              const mine = answers[i]
              const sp = quizSummaryPrompt(q)
              return (
                <li key={q.id} className="flex min-w-0 items-start gap-2">
                  <span aria-hidden="true" className={`grid h-6 w-6 flex-none place-items-center rounded-full text-[11px] font-semibold ${ok ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'}`}>
                    {ok ? '✓' : '✗'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] break-keep [overflow-wrap:anywhere]">
                      <span className="sr-only">{ok ? '맞음, ' : '틀림, '}</span>
                      {sp.ja ? <span lang="ja">{sp.text}</span> : sp.text}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ink2 [overflow-wrap:anywhere]">
                      {ok || mine === null ? '정답 ' : `내 답 `}
                      {ok || mine === null ? (
                        <Choice text={q.choices[q.answer]} className="!text-[12px]" />
                      ) : (
                        <>
                          <Choice text={q.choices[mine]} className="!text-[12px]" /> · 정답 <Choice text={q.choices[q.answer]} className="!text-[12px]" />
                        </>
                      )}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-[12px] text-ink2 break-keep">{U3.sumNote}</p>
        </Card>
        <div className="mt-[18px]">{footer}</div>
      </div>
    )
  }

  const q = quiz[idx]
  const qp = quizPromptView(q)
  const a = answers[idx]
  const answered = a !== null
  const pick = (j: number) => {
    if (answered) return
    st.update(
      (prev) => {
        const cur = [...(prev.quiz?.answers ?? [])]
        while (cur.length < quiz.length) cur.push(null)
        if (typeof cur[idx] !== 'number') cur[idx] = j
        return { ...prev, quiz: { answers: cur } }
      },
      ['quiz'],
      { immediate: true },
    )
    setFocusNext('next')
  }
  return (
    <div>
      <h2 tabIndex={-1} data-stage-title className="text-[17px] font-bold outline-none">
        {U3.title(quiz.length)}
      </h2>
      <p className="mt-1 text-[13px] text-ink2 break-keep">{U3.desc}</p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-[14px] font-bold">{U3.counter(idx + 1, quiz.length)}</span>
        <Dots quiz={quiz} answers={answers} current={idx} />
      </div>
      <div ref={cardRef}>
        <Card className="mt-2">
          <p className="text-[16px] font-semibold break-keep [overflow-wrap:anywhere]">{qp.ko}</p>
          {qp.ja ? (
            <p lang="ja" className="mt-1 text-[17px] leading-[1.7] [overflow-wrap:anywhere]">
              {qp.ja}
            </p>
          ) : null}
          {qp.legacy ? (
            <p className="mt-2 flex items-start gap-1.5 text-[12px] text-ink2 break-keep">
              <InfoIcon />
              <span>{U3.legacyNote}</span>
            </p>
          ) : null}
          <div role="group" aria-label={U3.choicesAria}>
            {q.choices.map((c, j) => {
              const correct = j === q.answer
              const mine = a === j
              const cls = answered ? (correct ? 'border-good bg-good-soft' : mine ? 'border-bad bg-bad-soft' : 'text-ink2') : ''
              return (
                <button
                  key={j}
                  ref={j === 0 ? firstChoiceRef : undefined}
                  type="button"
                  aria-disabled={answered || undefined}
                  aria-label={U3.choiceAria(j + 1, c, { correct: answered && correct, mine: answered && mine })}
                  onClick={() => pick(j)}
                  className={`mt-2 grid min-h-[52px] w-full grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-left ${cls}`}
                >
                  <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full bg-surface2 text-[12px] font-semibold text-ink">
                    {j + 1}
                  </span>
                  <Choice text={c} />
                  {answered && correct ? <span className="text-[12px] font-bold text-good">{U3.correctTag}</span> : answered && mine ? <span className="text-[12px] font-bold text-bad">{U3.mineTag}</span> : <span />}
                </button>
              )
            })}
          </div>
          {answered ? (
            <div role="status" className="mt-2.5 rounded-xl bg-surface2 p-3">
              <p className={`text-[14px] font-semibold ${a === q.answer ? 'text-good' : 'text-bad'}`}>{a === q.answer ? U3.right : U3.wrong(q.answer + 1)}</p>
              <p className="mt-0.5 text-[14px] break-keep [overflow-wrap:anywhere]">{q.explanationKo}</p>
            </div>
          ) : null}
        </Card>
      </div>
      {answered ? (
        <button
          ref={nextRef}
          type="button"
          className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-xl bg-accent px-4 text-[15px] font-semibold text-on-accent"
          onClick={() => {
            if (idx < quiz.length - 1) {
              setIdx(idx + 1)
              setFocusNext('choice')
            } else setSummary(true)
          }}
        >
          {idx < quiz.length - 1 ? U3.next : U3.result}
        </button>
      ) : null}
    </div>
  )
}
