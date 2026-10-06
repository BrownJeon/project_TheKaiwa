'use client'

/**
 * 새 단어 대기 화면 `/study/today/words/new`(task-044 가이드 §3-5) — 주제 세트를 시작하는 모든 곳(오늘 카드 [시작하기]·[한 세트 더], 결과 [한 세트 더])이 거친다.
 * 집중 화면 접두(`/study/today/words/`)라 하단 탭이 없다 — 회화 탭으로 가려면 ← 를 거치고, 그 순간 요청이 취소된다(§2 5초 예산 규칙 2).
 * [주제 표현으로 바로 풀기]는 대기 UI 가 보이는 순간부터 있다. "떠나면 취소돼요" 문구는 쓰지 않는다(설계서 §13-5 50).
 */
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Btn, BtnRow, Card } from '@/components/common/ui'
import { mmss } from '@/components/lesson/logic'
import BackBar from '@/components/shell/BackBar'
import { MODE_LABEL } from './labels'
import { WAIT } from './topicCopy'
import { useTopicSetStart } from './useTopicSetStart'

function Bar() {
  return (
    <div aria-hidden="true" className="mt-4 h-1 overflow-hidden rounded-full bg-surface2">
      <div className="h-full w-2/5 rounded-full bg-accent motion-safe:animate-[lesson-indet_1.6s_ease-in-out_infinite]" />
    </div>
  )
}

export default function TopicSetStart() {
  const { token, state, startedAt, skip, retry, openMine } = useTopicSetStart()
  const [now, setNow] = useState(() => Date.now())
  const headRef = useRef<HTMLHeadingElement>(null)
  const ticking = state.kind === 'gen' || state.kind === 'busy409'
  const showHead = state.kind === 'gen' || (state.kind === 'busy409' && !state.gaveUp)

  useEffect(() => {
    if (!ticking) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [ticking])

  // 대기 UI 가 처음 뜰 때 제목에 초점(화면 리더가 무엇을 기다리는지 읽는다).
  useEffect(() => {
    if (showHead) headRef.current?.focus({ preventScroll: true })
  }, [showHead])

  const title = token?.title ?? ''
  const sr =
    state.kind === 'quiet'
      ? WAIT.srQuiet
      : state.kind === 'gen'
        ? state.long
          ? WAIT.genLong(title)
          : WAIT.genTitle(title)
        : state.kind === 'busy409'
          ? state.gaveUp
            ? WAIT.busyGiveUp
            : WAIT.busyTitle
          : state.kind === 'error'
            ? state.rate
              ? WAIT.rate
              : WAIT.error
            : ''
  const skipping = state.kind === 'skipping'
  // `aria-disabled` 만으로는 눌림이 막히지 않는다 — 보내는 중엔 핸들러도 떼고, 상태 기계도 두 번째 요청을 무시한다(REV-125 M-2).
  const skipBtn = (variant: 'ghost' | 'primary' = 'ghost', full = true) => (
    <Btn
      variant={variant}
      className={full ? 'mt-6 w-full' : ''}
      onClick={skipping ? undefined : skip}
      aria-disabled={skipping || undefined}
      aria-busy={skipping || undefined}
    >
      {skipping ? WAIT.skipping : WAIT.skip}
    </Btn>
  )

  let body: React.ReactNode = null
  switch (state.kind) {
    case 'gen':
    case 'skipping':
      body = (
        <>
          <h2 ref={headRef} tabIndex={-1} className="text-[17px] font-bold break-keep outline-none [overflow-wrap:anywhere]">
            {WAIT.genTitle(title)}
          </h2>
          <p className="mt-1 text-[14px] text-ink2 break-keep">{state.kind === 'gen' && state.long ? WAIT.genLong(title) : WAIT.genBody}</p>
          <Bar />
          {startedAt !== null && state.kind === 'gen' ? (
            <p aria-hidden="true" className="mt-1.5 text-[12px] text-ink2 tabular-nums">
              {mmss(Math.max(0, now - startedAt) / 1000)}
            </p>
          ) : null}
          {skipBtn()}
          <p className="mt-2 text-[12px] text-ink2 break-keep">{WAIT.skipNote(title)}</p>
        </>
      )
      break
    case 'busy409':
      body = (
        <>
          <h2 ref={headRef} tabIndex={-1} className="text-[17px] font-bold break-keep outline-none">
            {WAIT.busyTitle}
          </h2>
          {state.gaveUp ? (
            <>
              <p className="mt-1 text-[14px] text-ink2 break-keep">{WAIT.busyGiveUp}</p>
              <BtnRow>
                <Btn onClick={retry}>{WAIT.retry}</Btn>
                {skipBtn('ghost', false)}
              </BtnRow>
            </>
          ) : (
            <>
              <p className="mt-1 text-[14px] text-ink2 break-keep">{WAIT.busyBody}</p>
              <Bar />
              {skipBtn()}
            </>
          )}
        </>
      )
      break
    case 'error':
      body = (
        <>
          <div role="alert" className="rounded-xl border border-bad-soft bg-bad-soft px-3.5 py-3 text-[13px] text-bad break-keep">
            {state.rate ? WAIT.rate : WAIT.error}
          </div>
          <BtnRow>
            <Btn onClick={retry}>{WAIT.retry}</Btn>
            {skipBtn('ghost', false)}
          </BtnRow>
          <Link href="/study/today" className="mt-1 flex h-11 items-center justify-center text-[13px] font-medium text-ink2 underline underline-offset-4">
            {WAIT.today}
          </Link>
        </>
      )
      break
    case 'empty':
      body = (
        <Card>
          <p className="text-[15px] font-semibold break-keep">{state.reason === 'TOPIC_EMPTY' ? WAIT.topicEmptyTitle : WAIT.allDoneTitle}</p>
          {state.reason === 'TOPIC_EMPTY' ? null : <p className="mt-0.5 text-[13px] text-ink2 break-keep">{WAIT.allDoneBody(!!token?.wordsDone)}</p>}
          <BtnRow>
            <Btn onClick={openMine}>{WAIT.mine}</Btn>
            <Link href="/study/today" className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold">
              {WAIT.today}
            </Link>
          </BtnRow>
        </Card>
      )
      break
    default:
      body = null
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-ground">
      <BackBar
        backHref="/study/today"
        backLabel={WAIT.back}
        title={WAIT.title}
        subtitle={token ? WAIT.subtitle(token.title, MODE_LABEL[token.mode], token.count) : undefined}
      />
      <div className="min-w-0 px-4 pt-8">{body}</div>
      <p role="status" aria-live="polite" className="sr-only">
        {sr}
      </p>
    </div>
  )
}
