'use client'

/**
 * 챌린지 상세 `/plan/challenge/[id]`(가이드 §3-4·§3-6) — 진행 중이면 수행 현황(S4), 끝났으면 같은 경로가 결과(S8).
 * 데이터는 #157 하나(하루 시트도 이 값으로 그림) + [다시 도전] 노출 판단용 #158. 그만두기는 확인 시트 뒤 #159(두 번 눌러도 한 번).
 * `?day=` 로 들어오면 하이드레이션 뒤 그날 시트를 연다(공용 `Sheet` 는 서버에서 그리지 않는다). 시트를 열고 닫으면 주소의 `?day=` 를 맞춘다.
 * 셸 `main` 이 스크롤 한 곳이고 머리(BackBar)만 붙는다 — 공용 `Sheet` 가 `main` 스크롤을 잠그기 때문.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useSearchParams } from 'next/navigation'
import { apiPost } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import Toast, { useToast } from '@/components/common/Toast'
import { Badge } from '@/components/common/ui'
import BackBar from '@/components/shell/BackBar'
import type { ChallengeDetail, ChallengeSummary } from '@/types/challenge'
import { COPY } from './challengeCopy'
import { ChallengeDaySheet, EndChallengeSheet, type EndState } from './ChallengeSheets'
import { DayStrip, ScoreTable, TopicProgressBlock } from './DayStrip'
import {
  activeTodayView,
  canRetry,
  detailMemo,
  isFresh,
  isLastDay,
  longestTile,
  md,
  parseDayParam,
  rateTile,
  resultHeroView,
  ruleLines,
  streakTile,
  taskCounts,
} from './logic'
import { BtnLink, ErrorBox, InfoBox, PartialMark, Skeleton, StatTiles, TaskRows, ULink } from './parts'
import { useChallengeDetail, useChallengeToday } from './useChallengeData'

const noopSubscribe = () => () => {}

function H2({ children, id, focusRef }: { children: React.ReactNode; id?: string; focusRef?: React.Ref<HTMLHeadingElement> }) {
  return (
    <h2 id={id} ref={focusRef} tabIndex={focusRef ? -1 : undefined} className="mb-2 text-[15px] font-semibold outline-none break-keep">
      {children}
    </h2>
  )
}

export default function ChallengeScreen({ id }: { id: string }) {
  const sp = useSearchParams()
  const fromList = sp.get('from') === 'list'
  const [openDay, setOpenDay] = useState<string | null>(() => parseDayParam(sp.get('day')))
  const [endOpen, setEndOpen] = useState(false)
  const [endState, setEndState] = useState<EndState>('idle')
  const endBusy = useRef(false)
  const focusResult = useRef(false)
  const heroRef = useRef<HTMLParagraphElement>(null)
  const { message, show } = useToast()
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const det = useChallengeDetail(id)
  const today = useChallengeToday()
  const d = det.data

  // 시트 날짜를 주소에 적는다(새로 고침·원본에서 돌아오기).
  useEffect(() => {
    if (!hydrated) return
    const q = new URLSearchParams(window.location.search)
    if (openDay) q.set('day', openDay)
    else q.delete('day')
    const s = q.toString()
    const url = `${window.location.pathname}${s ? `?${s}` : ''}`
    if (`${window.location.pathname}${window.location.search}` !== url) window.history.replaceState(window.history.state, '', url)
  }, [hydrated, openDay])

  // 그만둔 뒤 결과 화면으로 바뀌면 결과 큰 글로 초점.
  useEffect(() => {
    if (focusResult.current && d && d.status !== 'ACTIVE') {
      focusResult.current = false
      heroRef.current?.focus()
    }
  }, [d])

  const confirmEnd = useCallback(async () => {
    if (endBusy.current) return
    endBusy.current = true
    setEndState('busy')
    const done = (msg: string) => {
      endBusy.current = false
      setEndOpen(false)
      setEndState('idle')
      focusResult.current = true
      det.refresh()
      today.refresh()
      show(msg)
    }
    try {
      await apiPost<ChallengeSummary>(`/api/v1/challenges/${encodeURIComponent(id)}/end`, {})
      done(COPY.endDone)
    } catch (e) {
      const err = toErr(e)
      if (err.status === 409) done(COPY.endAlready)
      else if (err.status === 404) {
        endBusy.current = false
        setEndOpen(false)
        setEndState('idle')
        det.reload()
      } else {
        endBusy.current = false
        setEndState('fail')
      }
    }
  }, [det, id, show, today])

  const back = fromList ? { href: '/plan/challenges', label: COPY.toList } : { href: '/plan', label: COPY.toPlan }
  let title = COPY.loading.replace('…', '')
  let subtitle: string | undefined
  if (d) {
    title = d.title
    const range = `${md(d.startDate)} ~ ${md(d.endDate)}`
    if (d.status === 'ACTIVE')
      subtitle = d.stats.dayIndex === 0 ? `내일 시작 / ${d.lengthDays}일 · ${range}` : `${d.stats.dayIndex}일째 / ${d.lengthDays}일 · ${isLastDay(d) ? '오늘 자정에 마감돼요' : range}`
    else subtitle = `${d.status === 'ENDED' ? '그만둠' : '끝남'} · ${range}`
  } else if (det.status === 'error') title = '챌린지'

  return (
    <>
      <BackBar sticky backHref={back.href} backLabel={back.label} title={title} subtitle={subtitle} />
      <div className="mx-auto min-w-0 max-w-[520px] px-4 pb-8 pt-3">
        {det.status === 'loading' ? (
          <Skeleton heights={[120, 160, 200]} label={COPY.loading} />
        ) : det.status === 'error' || !d ? (
          det.errStatus === 404 ? (
            <InfoBox>
              <p>{COPY.notFound}</p>
              <ULink href="/plan">{COPY.toPlan}</ULink>
            </InfoBox>
          ) : (
            <ErrorBox title={COPY.errorTitle} body={COPY.errorBody} onRetry={det.reload} />
          )
        ) : d.status === 'ACTIVE' ? (
          <ActiveBody
            d={d}
            onOpenDay={setOpenDay}
            onEnd={() => {
              setEndState('idle')
              setEndOpen(true)
            }}
          />
        ) : (
          <ResultBody d={d} heroRef={heroRef} retry={canRetry(today.status === 'ready' ? today.data : null, d.id)} onOpenDay={setOpenDay} />
        )}
      </div>
      {d ? (
        <>
          <ChallengeDaySheet detail={d} date={hydrated && !endOpen ? openDay : null} onClose={() => setOpenDay(null)} onStep={setOpenDay} onBlocked={show} />
          <EndChallengeSheet
            detail={d}
            open={endOpen && d.status === 'ACTIVE'}
            state={endState}
            onConfirm={() => void confirmEnd()}
            onCancel={() => {
              setEndOpen(false)
              setEndState('idle')
            }}
          />
        </>
      ) : null}
      <Toast message={message} bottomPx={24} />
    </>
  )
}

function ActiveBody({ d, onOpenDay, onEnd }: { d: ChallengeDetail; onOpenDay: (date: string) => void; onEnd: () => void }) {
  const s = d.stats
  const tasks = d.today?.tasks ?? []
  const { todayIndex, todayDay, rows } = activeTodayView(d)
  const { done, total } = taskCounts(tasks)
  const fresh = isFresh(s)
  return (
    <>
      <section aria-label="수행 현황">
        <StatTiles cols={3} tiles={[rateTile(s), streakTile(s, true), longestTile(s.longestStreak)]} label="수행 현황" />
        <p className="mt-2 text-[12.5px] text-ink2 break-keep">{detailMemo(s)}</p>
      </section>
      <section className="mt-[18px]">
        <H2>{COPY.stripTitle}</H2>
        <DayStrip days={d.days} lengthDays={d.lengthDays} todayIndex={todayIndex} onOpen={onOpenDay} />
      </section>
      {d.today ? (
        <section className="mt-[18px]">
          <H2>
            {COPY.todayTasks} {d.today.dayIndex}일째 · {todayDay ? md(todayDay.date) : md(d.today.date)} · {done} / {total}
          </H2>
          <TaskRows rows={rows} />
        </section>
      ) : null}
      {d.topicProgress ? (
        <section className="mt-[18px]">
          <H2>「{d.topic.title}」 표현</H2>
          <TopicProgressBlock p={d.topicProgress} totals={d.totals} />
        </section>
      ) : null}
      {fresh ? null : (
        <>
          <section className="mt-[18px]">
            <H2>{COPY.scoreTitle}</H2>
            <p className="mb-1 text-[12px] text-ink2 break-keep">{COPY.scoreNote}</p>
            <ScoreTable days={d.days} goal={d.dailyGoal} todayIndex={todayIndex} />
          </section>
          <section className="mt-[18px]">
            <H2>{COPY.totalsTitle}</H2>
            <Totals lessons={d.totals.lessonsDone} sets={d.totals.wordSets} correct={d.totals.wordsCorrect} />
          </section>
        </>
      )}
      <details className="mt-[18px] rounded-xl bg-surface2 px-3.5">
        <summary className="flex min-h-11 cursor-pointer items-center text-[14px] font-semibold">{COPY.rulesSummary}</summary>
        <ul className="flex list-disc flex-col gap-1 pb-3 pl-5 text-[12.5px] break-keep">
          <li>
            {COPY.ruleLegend.before}
            <PartialMark className="mr-[0.3em] align-[-0.125em]" />
            {COPY.ruleLegend.after}
          </li>
          {ruleLines(d.dailyGoal).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </details>
      <ULink href="/plan/challenges" className="mt-2">
        {COPY.historyLink}
      </ULink>
      <div className="mt-6">
        <button type="button" onClick={onEnd} aria-haspopup="dialog" className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-line bg-surface text-[15px] font-semibold text-bad">
          {COPY.endBtn}
        </button>
        <p className="mt-1.5 text-[12px] text-ink2 break-keep">{COPY.endNote}</p>
      </div>
    </>
  )
}

function Totals({ lessons, sets, correct }: { lessons: number; sets: number; correct: number }) {
  const cells = [
    { v: `${lessons}개`, n: '수업' },
    { v: `${sets}세트`, n: '오늘의 단어' },
    { v: `${correct}장`, n: '맞힌 카드' },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {cells.map((c) => (
        <div key={c.n} className="min-w-0 rounded-xl border border-line bg-surface px-2 py-2.5 text-center">
          <b className="block text-[18px] font-bold tabular-nums">{c.v}</b>
          <span className="block truncate text-[12px] text-ink2">{c.n}</span>
        </div>
      ))}
    </div>
  )
}

function ResultBody({
  d,
  heroRef,
  retry,
  onOpenDay,
}: {
  d: ChallengeDetail
  heroRef: React.Ref<HTMLParagraphElement>
  retry: ReturnType<typeof canRetry>
  onOpenDay: (date: string) => void
}) {
  const v = resultHeroView(d)
  if (v.removed) return <InfoBox>{COPY.removed}</InfoBox>
  return (
    <>
      <section aria-labelledby={`hero-${d.id}`} className="min-w-0 rounded-[14px] border border-line bg-surface p-3.5">
        <Badge tone={v.badge.tone}>{v.badge.text}</Badge>
        <p id={`hero-${d.id}`} ref={heroRef} tabIndex={-1} className="mt-1.5 text-[22px] font-semibold outline-none break-keep">
          {v.big}
        </p>
        <p className="mt-0.5 text-[13px] text-ink2 break-keep">{v.sub}</p>
      </section>
      <section className="mt-[18px]">
        <H2>{COPY.stripTitle}</H2>
        <DayStrip days={d.days} lengthDays={d.lengthDays} onOpen={onOpenDay} />
      </section>
      <section className="mt-[18px]">
        <H2>{COPY.doneTitle}</H2>
        {v.preStart ? (
          <InfoBox>{COPY.prestopEmpty}</InfoBox>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: `${v.done.longest}일`, n: '최장 연속' },
                { v: `${v.done.lessons}개`, n: '수업' },
                { v: `${v.done.correct}장`, n: '맞힌 카드' },
              ].map((c) => (
                <div key={c.n} className="min-w-0 rounded-xl border border-line bg-surface px-2 py-2.5 text-center">
                  <b className="block text-[18px] font-bold tabular-nums">{c.v}</b>
                  <span className="block truncate text-[12px] text-ink2">{c.n}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12.5px] text-ink2 break-keep">
              「{d.topic.title}」 오늘의 단어 {v.done.sets}세트
            </p>
          </>
        )}
      </section>
      <section className="mt-[18px]">
        <H2>{COPY.nextTitle}</H2>
        <p className="text-[13px] text-ink2 break-keep">{COPY.nextBody}</p>
        {retry.kind === 'show' ? (
          <div className="mt-3 flex gap-2">
            <BtnLink href={`/plan/challenge/new?again=${encodeURIComponent(d.id)}`}>
              {COPY.retryChallenge} ({d.lengthDays}일)
            </BtnLink>
            <BtnLink href="/plan/challenge/new" variant="ghost">
              {COPY.otherTopicShort}
            </BtnLink>
          </div>
        ) : (
          <InfoBox className="mt-3">
            <p>
              지금은 「{retry.title}」({retry.dayIndex === 0 ? '내일 시작' : `${retry.dayIndex}일째`})를 하고 있어요. 진행 중인 챌린지가 끝나면 다시 도전할 수 있어요.
            </p>
            <ULink href={`/plan/challenge/${encodeURIComponent(retry.id)}`}>{COPY.seeActive}</ULink>
          </InfoBox>
        )}
      </section>
      <p className="mt-[18px] text-[12px] text-ink2 break-keep">{COPY.resultKeep}</p>
    </>
  )
}
