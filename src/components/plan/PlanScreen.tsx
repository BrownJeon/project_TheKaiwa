'use client'

/**
 * 계획표 탭(task-012, 승인 데모 `docs/demo/task-012-calendar-v1.html`) — 달력. 맨 위 분절 `[달력 | 성장]`(task-080, screens.md §36-2)으로 성장 탭과 오간다
 * (달력 아래 옛 «분석 · 성장 기록 곧 열려요» 카드는 성장 탭이 생겨 뺐다).
 *
 * - 데이터: #70 달력(월) · #71 하루 상세 · #73 기록 지우기. 지우기는 기록 한 행만 — 통계(StatsSnapshot)는 서버가 건드리지 않는다.
 *   지운 뒤 목록에서 바로 빼고 달력·하루를 조용히 다시 읽어 칸·요약을 맞춘다.
 * - 주소 `?month=&day=` 에 지금 보는 달·열린 날을 적는다(`history.replaceState` — 서버를 다시 부르지 않는다). 원본 화면으로 갔다가
 *   뒤로 오면 같은 달·같은 날 시트가 다시 열리고, 방금 연 기록(`&log=`)으로 초점이 돌아온다. 원본 화면 머리의 ← 도 같은 주소로 오도록
 *   이동 직전에 돌아올 주소를 한 건 적어 두고(`shell/planReturn`), 계획표에 돌아오면 지운다.
 * - 맨 위 챌린지 현황 카드(task-043, #158) — 달력과 따로 읽고, #158 실패는 카드 안에서만 알린다. 화면이 다시 보이면 #158 만 조용히 다시 읽는다.
 * - 첫 값은 `useSearchParams()` 로 읽는다 — 뒤로 가기로 돌아올 때 서버가 처음 렌더한 값이 아니라 지금 주소를 따라야 해서다.
 *   시트는 하이드레이션이 끝난 뒤에만 연다 — 공용 `Sheet` 는 서버에서 아무것도 그리지 않으므로(포털) `?day=` 로 들어와 첫 렌더부터
 *   열면 서버·클라이언트 HTML 이 어긋난다.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiDelete } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import Toast, { useToast } from '@/components/common/Toast'
import { readStore, writeStore } from '@/components/common/storage'
import ChallengePlanCard from '@/components/challenge/ChallengePlanCard'
import { COPY as CHALLENGE_COPY, FLASH_KEY } from '@/components/challenge/challengeCopy'
import { useChallengeToday } from '@/components/challenge/useChallengeData'
import { forgetPlanReturn, rememberPlanReturn } from '@/components/shell/planReturn'
import type { StudyLogDeleteResponse, StudyLogItem } from '@/types/plan'
import { CalendarError, CalendarGrid, CalendarLegend, MonthNav, MonthNoteBlock, SummaryRow } from './CalendarSection'
import DaySheet from './DaySheet'
import { DeleteConfirmSheet, LogMenuSheet, type DeleteState } from './LogSheets'
import { deleteDetail, monthOf, parsePlanParams, planUrl, shiftMonth, sourceHref, MIN_MONTH } from './logic'
import PlanSwitch from './PlanSwitch'
import { useCalendar, useDay } from './usePlanData'

const noopSubscribe = () => () => {}

export default function PlanScreen({ today: serverToday, dailyWordCount }: { today: string; dailyWordCount: number }) {
  const router = useRouter()
  const sp = useSearchParams()
  const [init] = useState(() => parsePlanParams(sp.get('month'), sp.get('day'), sp.get('log'), serverToday))
  const [month, setMonth] = useState(init.month)
  const [openDay, setOpenDay] = useState<string | null>(init.day)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [del, setDel] = useState<DeleteState>('idle')
  const { message, show } = useToast()
  const titleId = useId()
  /** 다음 하루 상세 렌더 뒤 옮길 초점: `row:<id>` | `title`. */
  const focusReq = useRef<string | null>(init.log ? `row:${init.log}` : null)

  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const cal = useCalendar(month)
  const day = useDay(openDay)
  const ch = useChallengeToday()
  const refreshChallenge = ch.refresh
  const today = cal.data?.today ?? serverToday
  const isCurrent = month === monthOf(today)

  // 원본 화면 ← 용 한 건 기록은 계획표에 돌아오면 쓸모가 끝난다(다른 길로 같은 원본을 다시 열 때 계획표로 가지 않게).
  useEffect(() => {
    forgetPlanReturn()
  }, [])

  // 만들기에서 막 돌아왔으면 한 번 알린다(만들기 화면이 적고, 읽은 뒤 지운다).
  useEffect(() => {
    if (readStore('session', FLASH_KEY) !== '1') return
    writeStore('session', FLASH_KEY, null)
    show(CHALLENGE_COPY.flash, 3600)
  }, [show])

  // 오늘 탭에서 과제를 하고 돌아오면 카드만 맞춘다(달력은 그대로).
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshChallenge()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refreshChallenge])

  // 주소 동기화 — 원본에서 뒤로 오면 같은 자리(서버 렌더 없이 기록만 바꾼다).
  useEffect(() => {
    const url = planUrl(month, openDay)
    if (`${window.location.pathname}${window.location.search}` !== url) window.history.replaceState(null, '', url)
  }, [month, openDay])

  // 지운 뒤·원본에서 돌아온 뒤 초점 — 하루 목록이 그려진 다음에.
  useEffect(() => {
    const want = focusReq.current
    if (!want || !hydrated || day.status !== 'ready') return
    focusReq.current = null
    const body = document.querySelector('[data-plan-daybody]')
    const target =
      (want.startsWith('row:') ? body?.querySelector<HTMLElement>(`[data-plan-row="${CSS.escape(want.slice(4))}"]`) : null) ??
      body?.closest('[role="dialog"]')?.querySelector<HTMLElement>('h2')
    target?.focus()
  }, [hydrated, day.status, day.data])

  const logs = useMemo(() => day.data?.logs ?? [], [day.data])
  const menuLog = menuId ? (logs.find((l) => l.id === menuId) ?? null) : null
  const confirmLog = confirmId ? (logs.find((l) => l.id === confirmId) ?? null) : null

  const changeMonth = useCallback((next: string) => {
    setMonth(next)
    setOpenDay(null)
    setMenuId(null)
    setConfirmId(null)
    setDel('idle')
  }, [])

  const closeDay = useCallback(() => {
    setOpenDay(null)
    setMenuId(null)
  }, [])

  const openSource = useCallback(
    (log: StudyLogItem) => {
      // 원본에서 뒤로 오면 이 기록으로 초점이 돌아오게 주소에 적어 둔다(이동은 Link·router 가 한다).
      const back = planUrl(month, openDay, log.id)
      window.history.replaceState(null, '', back)
      const src = sourceHref(log)
      if (src) rememberPlanReturn(back, src)
    },
    [month, openDay],
  )

  const openSourceFromMenu = useCallback(
    (log: StudyLogItem) => {
      const href = sourceHref(log)
      if (!href) return
      openSource(log)
      router.push(href)
    },
    [openSource, router],
  )

  const confirmDelete = useCallback(async () => {
    if (del === 'busy' || !confirmLog) return
    const id = confirmLog.id
    setDel('busy')
    const settle = (toastMsg: string) => {
      const ids = logs.map((l) => l.id)
      const idx = ids.indexOf(id)
      const rest = ids.filter((x) => x !== id)
      focusReq.current = rest.length ? `row:${rest[Math.min(Math.max(idx, 0), rest.length - 1)]}` : 'title'
      day.patch((d) => ({ ...d, logs: d.logs.filter((l) => l.id !== id) }))
      setConfirmId(null)
      setDel('idle')
      show(toastMsg)
      cal.refresh()
      day.refresh()
    }
    try {
      await apiDelete<StudyLogDeleteResponse>(`/api/v1/study-logs/${encodeURIComponent(id)}`)
      settle('기록을 지웠어요')
    } catch (e) {
      // 다른 기기에서 이미 지운 기록 — 지운 것으로 보고 목록을 새로 읽는다.
      if (toErr(e).status === 404) settle('이미 지워진 기록이에요')
      else setDel('fail')
    }
  }, [cal, day, del, confirmLog, logs, show])

  const lastOfDay = confirmLog ? logs.length === 1 : false
  const active = ch.status === 'ready' && ch.data?.challenge?.status === 'ACTIVE' ? ch.data.challenge : null
  const dayCh = day.data?.challenge
  const challengeNeed = active && dayCh && dayCh.challengeId === active.id ? active.dailyGoal.wordsMinAnswered : null
  const showChallenge = !!cal.data?.days.some((d) => d.challenge)

  return (
    <div className="min-w-0 px-4 pb-8">
      <PlanSwitch current="calendar" />
      <ChallengePlanCard status={ch.status} data={ch.data} dailyWordCount={dailyWordCount} onRetry={ch.reload} />
      <section aria-labelledby={titleId} className="mt-[18px] min-w-0">
        <MonthNav
          month={month}
          isCurrent={isCurrent}
          titleId={titleId}
          onPrev={() => {
            const prev = shiftMonth(month, -1)
            if (prev < MIN_MONTH) show('더 이전 달은 볼 수 없어요')
            else changeMonth(prev)
          }}
          onNext={() => changeMonth(shiftMonth(month, 1))}
          onToday={() => changeMonth(monthOf(today))}
          onBlocked={show}
        />
        <SummaryRow status={cal.status} summary={cal.data?.summary ?? null} month={month} today={today} attendHint={!!active && isCurrent} />
        {cal.status === 'error' ? (
          <CalendarError onRetry={cal.reload} />
        ) : (
          <>
            <CalendarGrid
              key={month}
              month={month}
              today={today}
              days={cal.data?.days ?? []}
              loading={cal.status !== 'ready'}
              openDay={openDay}
              onOpen={(date) => {
                setMenuId(null)
                setOpenDay(date)
              }}
            />
            {cal.status === 'ready' && cal.data ? <MonthNoteBlock days={cal.data.days} month={month} today={today} dailyWordCount={dailyWordCount} /> : null}
            <CalendarLegend showChallenge={showChallenge} />
          </>
        )}
      </section>

      <DaySheet
        date={hydrated ? openDay : null}
        today={today}
        status={day.status}
        data={day.data}
        dismissible={!menuId && !confirmId}
        onClose={closeDay}
        onStep={(d) => {
          setMenuId(null)
          setOpenDay(d)
        }}
        onBlocked={show}
        onRetry={day.reload}
        onOpenSource={openSource}
        onGone={() => show('원본이 삭제돼서 열 수 없어요. 기록은 그대로 있어요.')}
        onMenu={(log) => setMenuId(log.id)}
        challengeNeed={challengeNeed}
        onOpenChallenge={(id) => rememberPlanReturn(planUrl(month, openDay), `/plan/challenge/${id}`)}
      />
      <LogMenuSheet
        log={menuLog}
        onClose={() => setMenuId(null)}
        onOpenSource={openSourceFromMenu}
        onDelete={(log) => {
          setMenuId(null)
          setDel('idle')
          setConfirmId(log.id)
        }}
      />
      <DeleteConfirmSheet
        log={confirmLog}
        detail={confirmLog ? deleteDetail(confirmLog, lastOfDay, month, today) : ''}
        state={del}
        onCancel={() => {
          setConfirmId(null)
          setDel('idle')
        }}
        onConfirm={() => void confirmDelete()}
      />
      <Toast message={message} />
    </div>
  )
}
