'use client'

/**
 * 오늘의 공부 홈 `/study/today`(screens.md §5-2 A·§5-3 B). 마운트·화면 복귀 때 #46 · #48(최근 10) · #48(보관 5) · #54 를 함께 읽는다.
 * task-010: 단어 카드 바로 아래 "오늘의 회화" 카드(§12-2 A) — #58 을 같은 tick 으로 나란히, 상태는 따로 읽는다.
 * task-011: 그 아래 "AI 평가" 카드(`EvalHomeCard`) — #69·#66 을 카드가 직접 읽고 같은 tick 으로 다시 읽는다.
 * task-010b: "오늘의 복습" 카드(§14-2 A) — 같은 #58 응답으로 `deriveReviewCard` 가 상태를 정하고, 할 일이 있으면 오늘의 회화 위·아니면 아래,
 * 가드면 맨 아래 "곧 열려요". 건너뛰기 5초 되돌리기·판단 대기 재확인·만드는 중 잡 감시는 여기 훅에 둔다(카드는 표시 전용).
 * #46·#48(최근) 실패만 카드 오류이고, 보관 세트·통계 실패는 그 섹션을 조용히 숨긴다. 자동 폴링은 없다.
 *
 * 풀던 세트는 사용자당 하나이고 새 세트·다시 풀기를 막으므로 늘 가장 최근에 시작한 세트다 → 최근 10개 안에서 찾는다(F3 `answeredCount`).
 * 장수는 저장하지 않고 늘 설정(`dailyWordCount`)에서 시작한다. 방식·분류는 마지막 선택을 기억한다(저장소가 막혀도 기본값으로 동작).
 *
 * task-044(챌린지 T4): #158 을 #58 과 같은 tick 으로 읽어 맨 위 챌린지 띠·단어 카드(주제 모드)·회화 카드(챌린지 모드)를 정한다(가이드 §3-1).
 * #158 이 끝나기 전엔 두 카드가 몸통 자리표시(`CardLoadingBody`), 실패하면 지금 카드 그대로 + 맨 위 한 줄 오류. 챌린지가 없으면 지금 화면 그대로.
 * 주제 세트 [시작하기]·[한 세트 더]는 시작 값만 남기고 대기 화면으로 간다 — 새 단어 생성 요청은 오늘 탭에서 보내지 않는다(§2 5초 예산 규칙 1).
 *
 * task-046(IMP-0027, T3): 요청 4곳(홈 묶음·#58·#158·평가 카드)이 도착 순서대로 따로 그려지면 본문이 3~4번 바뀌며 +669px 자랐다. 첫 화면은
 * **모두 끝난 뒤(상한 `TODAY_HOLD_MS` 가 지나면 그때까지 온 것만) 한 번에** 보인다. 그 전에는 같은 높이의 자리표시(`TodayCardsSkeleton`)만 보이고,
 * 진짜 카드는 `invisible` 로 **제자리에 이미 마운트돼 요청을 보내고 있다**(요청 수·시점은 그대로). 자리표시는 그 위에 겹쳐 그린다 — 카드를 `display:none`·높이 0 으로
 * 숨기면 분류 칩의 `scrollIntoView` 가 화면 밖 좌표를 읽어 본문을 밀 수 있고, 겹쳐 두면 카드가 처음부터 최종 좌표에 있다. 카드마다 로딩 몸통의 높이가 자리표시와 같아
 * 보이기 전과 후의 전체 높이도 같다. 한 번 보인 뒤에는 되돌아가지 않는다 — [다시 시도]·화면 복귀 때는 카드 안 몸통 자리표시만 잠깐 보인다.
 */
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, apiPost } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import Toast, { useToast } from '@/components/common/Toast'
import type { CategoryCount, CreateSessionResult, FinishResult, Paged, SessionDetail, SessionSummary, VocabMode, VocabStats } from '@/types/vocab'
import type { TodayLessons } from '@/types/lesson'
import TodayLessonCard from '@/components/lesson/TodayLessonCard'
import EvalHomeCard from '@/components/eval/EvalHomeCard'
import { useJobWatch } from '@/components/lesson/useJobWatch'
import { lessonPath } from '@/components/lesson/useLessonCreate'
import { RV_HOME } from '@/components/lesson/review/reviewCopy'
import { deriveReviewCard, reviewPlacement, startReviewErrorText, watchesDecision } from '@/components/lesson/review/reviewLogic'
import ReviewSoonSection from '@/components/lesson/review/ReviewSoonSection'
import TodayReviewCard from '@/components/lesson/review/TodayReviewCard'
import UndoToast from '@/components/lesson/review/UndoToast'
import { useDecisionWatch } from '@/components/lesson/review/useDecisionWatch'
import { useReviewSkip } from '@/components/lesson/review/useReviewSkip'
import type { StartReviewResult } from '@/types/review'
import type { JlptLevel } from '@/types/lesson'
import { isAnswered } from './deck'
import FinishConfirmSheet from './FinishConfirmSheet'
import { todayKey } from './format'
import { putSession, takeSession, useSeedPack, useStoredPref, useStoredString, VOCAB_KEYS } from './hooks'
import KeptSets from './KeptSets'
import { actionErrorText, FLASH, HINT, homeLoadErrorText, seedResultText, startErrorText } from './labels'
import ChallengeStrip, { ChallengeStripError } from './ChallengeStrip'
import { TODAY_HOLD_MS, todayRevealed } from './todayHold'
import TodayWordsCard, { type PoolEmptyKind, type WordsCardState } from './TodayWordsCard'
import { stripModel, todayMode, topicSetsTally } from './topicLogic'
import { TodayCardsSkeleton } from './TodaySkeleton'
import TopicWordsCard from './TopicWordsCard'
import { useTodayChallenge } from './useTodayChallenge'
import { writeTopicStart } from './useTopicSetStart'
import { categoryTotals, normalizeCategories, visibleCategories } from './validate'
import VocabStatsCard from './VocabStatsCard'

const MODES = ['CHOICE', 'FLIP'] as const satisfies readonly VocabMode[]

interface HomeData {
  categories: CategoryCount[]
  recent: SessionSummary[]
  kept: Paged<SessionSummary> | null
  stats: VocabStats | null
  today: string
  inProgress: { session: SessionSummary; answered: number | null } | null
}

export default function TodayHome({ dailyWordCount, myLevel, teacherName = '선생님' }: { dailyWordCount: number; myLevel: JlptLevel; teacherName?: string }) {
  const router = useRouter()
  const toast = useToast()
  const { seed, seeding } = useSeedPack()
  const [mode, setMode] = useStoredPref<VocabMode>(VOCAB_KEYS.mode, 'CHOICE', MODES)
  const [storedCategory, setStoredCategory] = useStoredString(VOCAB_KEYS.category)
  const [count, setCount] = useState(dailyWordCount)
  const [data, setData] = useState<HomeData | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadSeq, setLoadSeq] = useState(0)
  const [override, setOverride] = useState<{ state: 'empty' | 'poolEmpty'; kind: PoolEmptyKind | null } | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [finishOpen, setFinishOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [replayingId, setReplayingId] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  // 오늘의 회화(#58)는 단어 쪽과 따로 읽는다 — 한쪽 실패가 다른 카드를 막지 않게(screens §12-2 A).
  const [lessonToday, setLessonToday] = useState<{ state: 'loading' | 'error' | 'ready'; data: TodayLessons | null }>({ state: 'loading', data: null })
  const [lessonTick, setLessonTick] = useState(0)
  const [reviewBusy, setReviewBusy] = useState(false)
  const reviewBusyRef = useRef(false)
  const [challenge, retryChallenge] = useTodayChallenge(tick, lessonTick)
  // 첫 화면을 한 번에 보이기 위한 기다림(task-046) — 평가 카드는 자기 요청을 갖고 있어 끝났다고 알려 온다.
  const [evalSettled, setEvalSettled] = useState(false)
  const onEvalSettled = useCallback(() => setEvalSettled(true), [])
  const [holdOver, setHoldOver] = useState(false)
  const [shown, setShown] = useState(false)
  // 렌더 중 조정(효과로 풀면 한 프레임 늦는다) — 한 번 참이 되면 다시 거두지 않는다.
  if (!shown && todayRevealed({ home: loadState !== 'loading', lessons: lessonToday.state !== 'loading', challenge: challenge.state !== 'loading', evaluation: evalSettled }, holdOver)) {
    setShown(true)
  }
  const [nowKey] = useState(() => todayKey())
  const [mineOpen, setMineOpen] = useState(false)
  const [topicStarting, setTopicStarting] = useState(false)
  const topicStartingRef = useRef(false)
  const keptRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const { show } = toast
  const reloadLessons = useCallback(() => setLessonTick((t) => t + 1), [])
  const review = lessonToday.state === 'ready' ? (lessonToday.data?.review ?? null) : null
  const rvSkip = useReviewSkip(review, { onCommitted: reloadLessons, onToast: show })
  const rvCard = deriveReviewCard(lessonToday.state, lessonToday.data, rvSkip.skip)
  const rvPlace = reviewPlacement(rvCard)
  useDecisionWatch(watchesDecision(rvCard), reloadLessons)
  useJobWatch(rvCard.kind === 'gen' ? rvCard.jobId : null, { delays: [5000], onSettled: reloadLessons })

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiGet<unknown>('/api/v1/words/categories'),
      apiGet<Paged<SessionSummary>>('/api/v1/vocab/sessions?limit=10'),
      apiGet<Paged<SessionSummary>>('/api/v1/vocab/sessions?kept=1&limit=5').catch(() => null),
      apiGet<VocabStats>('/api/v1/vocab/stats?days=30').catch(() => null),
    ])
      .then(async ([cats, rec, kept, stats]) => {
        const recent = rec.items ?? []
        const ip = recent.find((s) => s.status === 'IN_PROGRESS') ?? null
        let answered: number | null = ip && typeof ip.answeredCount === 'number' ? ip.answeredCount : null
        if (ip && answered === null) {
          // 계약(F3) 전 서버 방어: 답한 수를 세트에서 센다
          const d = await apiGet<SessionDetail>(`/api/v1/vocab/sessions/${encodeURIComponent(ip.id)}`).catch(() => null)
          answered = d ? d.cards.filter((c) => isAnswered(c)).length : null
        }
        if (cancelled) return
        setData({
          categories: normalizeCategories(cats),
          recent,
          kept: kept ? { items: (kept.items ?? []).filter((s) => s.status === 'DONE'), nextCursor: kept.nextCursor ?? null } : null,
          stats: stats && Array.isArray(stats.byCount) ? stats : null,
          today: todayKey(),
          inProgress: ip ? { session: ip, answered } : null,
        })
        setOverride(null)
        setLoadState('ready')
        setLoadSeq((n) => n + 1)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setLoadError(homeLoadErrorText(toErr(e)))
        setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [tick])

  useEffect(() => {
    let cancelled = false
    apiGet<TodayLessons>('/api/v1/lessons/today').then(
      (d) => !cancelled && setLessonToday({ state: 'ready', data: d }),
      () => !cancelled && setLessonToday((prev) => ({ state: 'error', data: prev.data })),
    )
    return () => {
      cancelled = true
    }
  }, [tick, lessonTick])

  useEffect(() => {
    const id = setTimeout(() => setHoldOver(true), TODAY_HOLD_MS)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') setTick((t) => t + 1)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // 덱에서 돌아왔을 때 한 번 띄울 안내(풀던 세트 저장·기록 없이 닫힘·풀던 세트 먼저)
  // 대기 화면 빈 상태의 [내 단어장으로 풀기]로 왔으면 내 단어장 패널을 펼친 채로(task-044 E10).
  useEffect(() => {
    const id = setTimeout(() => {
      const msg = takeSession(VOCAB_KEYS.flash)
      if (msg) show(msg)
      if (takeSession(VOCAB_KEYS.openMine)) setMineOpen(true)
    }, 0)
    return () => clearTimeout(id)
  }, [show])

  const categories = data?.categories ?? null
  const totals = categoryTotals(categories)
  const category = storedCategory !== null && visibleCategories(categories, 'active').some((c) => c.category === storedCategory) ? storedCategory : null

  let state: WordsCardState
  if (loadState === 'loading') state = 'loading'
  else if (loadState === 'error' || !data) state = 'error'
  else if (data.inProgress) state = 'inProgress'
  else if (override) state = override.state
  else state = (totals?.active ?? 0) === 0 ? 'empty' : 'ready'

  const todayDone = (data?.recent ?? [])
    .filter((s) => s.status === 'DONE' && s.date === data?.today)
    .reduce((a, s) => ({ sets: a.sets + 1, correct: a.correct + s.correctCount, cards: a.cards + s.cardCount }), { sets: 0, correct: 0, cards: 0 })

  const start = async (cat: string | null) => {
    if (starting) return
    setStarting(true)
    setStartError(null)
    try {
      const r = await apiPost<CreateSessionResult>('/api/v1/vocab/sessions', { count, mode, category: cat })
      if (r.session) {
        putSession(VOCAB_KEYS.notice(r.session.id), r.session.downgraded ? 'few' : '')
        router.push(`/study/today/words/${encodeURIComponent(r.session.id)}`)
        return
      }
      setStarting(false)
      const reason = r.empty?.reason
      if (reason === 'NO_WORDS') setOverride({ state: 'empty', kind: null })
      else setOverride({ state: 'poolEmpty', kind: cat !== null || reason === 'NO_WORDS_IN_CATEGORY' ? 'category' : 'allDone' })
    } catch (e) {
      setStarting(false)
      const err = toErr(e)
      if (err.status === 409) {
        show('풀던 세트가 있어요. 이어서 풀거나 끝내 주세요.')
        setTick((t) => t + 1)
        return
      }
      setStartError(startErrorText(err))
    }
  }

  const runSeed = async () => {
    if (seeding) return
    try {
      const r = await seed()
      show(seedResultText(r))
      setTick((t) => t + 1)
    } catch (e) {
      show(actionErrorText(toErr(e)))
    }
  }

  /** 풀던 세트 끝내기(#51). 답 0장이면 서버가 기록 없이 닫는다(F2). */
  const finishInProgress = async () => {
    const ip = data?.inProgress
    if (!ip || finishing) return
    setFinishing(true)
    setFinishError(null)
    try {
      const r = await apiPost<FinishResult>(`/api/v1/vocab/sessions/${encodeURIComponent(ip.session.id)}/finish`)
      setFinishOpen(false)
      if (r.session.status === 'ABANDONED') {
        setFinishing(false)
        show(FLASH.closed)
        setTick((t) => t + 1)
        return
      }
      router.push(`/study/today/words/${encodeURIComponent(ip.session.id)}`)
    } catch (e) {
      setFinishing(false)
      const err = toErr(e)
      if (err.status === 404) {
        setFinishOpen(false)
        setTick((t) => t + 1)
        return
      }
      setFinishError(err.status === 0 ? actionErrorText(err) : HINT.finishFailed)
    }
  }

  const replay = async (id: string) => {
    if (replayingId) return
    setReplayingId(id)
    try {
      const r = await apiPost<CreateSessionResult>(`/api/v1/vocab/sessions/${encodeURIComponent(id)}/replay`)
      if (r.session) {
        if (r.session.downgraded) putSession(VOCAB_KEYS.notice(r.session.id), 'deleted')
        router.push(`/study/today/words/${encodeURIComponent(r.session.id)}`)
        return
      }
      setReplayingId(null)
      show(actionErrorText({ status: -1 }))
    } catch (e) {
      setReplayingId(null)
      const err = toErr(e)
      if (err.status === 409) {
        show(FLASH.finishFirst)
        setTick((t) => t + 1)
        cardRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
        return
      }
      show(actionErrorText(err))
    }
  }

  /** [복습 시작]·[다시 만들기](#63) — 두 번 눌러도 한 번. 성공하면 수업 경로(대기 화면이 잡을 지켜본다). */
  const startReview = async () => {
    if (!review || reviewBusyRef.current) return
    reviewBusyRef.current = true
    setReviewBusy(true)
    try {
      const r = await apiPost<StartReviewResult>(`/api/v1/reviews/${encodeURIComponent(review.id)}/start`)
      router.push(lessonPath(r.lessonId))
    } catch (e) {
      reviewBusyRef.current = false
      setReviewBusy(false)
      const { text, reload } = startReviewErrorText(toErr(e))
      show(text)
      if (reload) reloadLessons()
    }
  }

  const reviewCard = (
    <TodayReviewCard
      card={rvCard}
      teacherName={teacherName}
      todayKey={lessonToday.data?.date ?? ''}
      busy={reviewBusy}
      skipFailed={rvSkip.skipFailed}
      onStart={() => void startReview()}
      onRetry={() => void startReview()}
      onOpen={(id) => router.push(lessonPath(id))}
      onSkip={rvSkip.start}
      titleRef={rvSkip.titleRef}
      skipBtnRef={rvSkip.skipBtnRef}
    />
  )

  const ip = data?.inProgress ?? null
  const answeredNow = ip?.answered ?? null
  const tm = todayMode(challenge.state, challenge.data)
  const strip = challenge.state === 'ready' ? stripModel(challenge.data, data?.today ?? nowKey) : null
  const ctx = tm.ctx

  /** 챌린지 주제 세트 [시작하기]·[한 세트 더] — 시작 값(E2)만 남기고 대기 화면으로. 두 번 눌러도 한 번. */
  const startTopic = () => {
    if (!ctx || !tm.wordsTask || topicStartingRef.current) return
    topicStartingRef.current = true
    setTopicStarting(true)
    writeTopicStart({ topicId: ctx.topicId, title: ctx.title, count: tm.wordsTask.wordCount ?? 10, mode, wordsDone: tm.wordsTask.state === 'DONE' })
    router.push('/study/today/words/new')
  }

  const wordsCardProps = {
    state: tm.loading ? ('loading' as const) : state,
    loadError,
    dailyWordCount,
    count,
    mode,
    category,
    categories,
    archivedTotal: totals?.archived ?? 0,
    todayDone,
    inProgress: ip,
    today: data?.today ?? '',
    poolEmptyKind: override?.kind ?? null,
    hasKept: !!data?.kept && data.kept.items.length > 0,
    starting,
    startError,
    seeding,
    finishing,
    onCount: setCount,
    onMode: (m: VocabMode) => setMode(m),
    onCategory: (c: string | null) => setStoredCategory(c),
    onStart: () => void start(category),
    onStartAll: () => {
      setStoredCategory(null)
      void start(null)
    },
    onBackToReady: () => setOverride(null),
    onFinish: () => {
      setFinishError(null)
      setFinishOpen(true)
    },
    onShowResult: () => void finishInProgress(),
    onSeed: () => void runSeed(),
    onShowKept: () => keptRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
    onRetry: () => {
      setLoadState('loading')
      setTick((t) => t + 1)
    },
  }

  return (
    <div className="relative px-4 pb-8">
      {shown ? null : (
        <div className="absolute inset-x-4 top-0">
          <TodayCardsSkeleton />
        </div>
      )}
      <div className={shown ? undefined : 'invisible'} aria-hidden={shown ? undefined : true} inert={!shown}>
        {tm.error ? <ChallengeStripError onRetry={retryChallenge} /> : strip ? <ChallengeStrip model={strip} /> : null}
        <div ref={cardRef} className="scroll-mt-16">
          {ctx && tm.wordsTask ? (
            <TopicWordsCard
              loadState={loadState === 'loading' ? 'loading' : loadState === 'error' || !data ? 'error' : 'ready'}
              loadError={loadError}
              ctx={ctx}
              task={tm.wordsTask}
              inProgress={ip}
              today={data?.today ?? ''}
              tally={topicSetsTally(data?.recent ?? [], ctx.topicId, data?.today ?? '')}
              mode={mode}
              starting={topicStarting}
              finishing={finishing}
              mineOpen={mineOpen}
              mineProps={wordsCardProps}
              onMode={(m) => setMode(m)}
              onStartTopic={startTopic}
              onFinish={wordsCardProps.onFinish}
              onShowResult={wordsCardProps.onShowResult}
              onToggleMine={() => setMineOpen((o) => !o)}
              onRetry={wordsCardProps.onRetry}
            />
          ) : (
            <TodayWordsCard {...wordsCardProps} />
          )}
        </div>
        {rvPlace === 'above' ? reviewCard : null}
        <TodayLessonCard
          state={lessonToday.state}
          today={lessonToday.data}
          onToast={show}
          errorText={RV_HOME.loadError}
          challenge={ctx && tm.lessonTask ? { ctx, task: tm.lessonTask } : null}
          challengeLoading={tm.loading}
          onReload={() => {
            setLessonToday((prev) => (prev.state === 'error' ? { state: 'loading', data: prev.data } : prev))
            setLessonTick((t) => t + 1)
          }}
        />
        {rvPlace === 'below' ? reviewCard : null}
        {/* task-011: AI 평가 카드(데모 v1 — 오늘의 회화 카드 바로 아래, "곧 열려요" 칸은 없어진다). 자기 요청·오류를 따로 갖는다. */}
        <EvalHomeCard myLevel={myLevel} reloadKey={tick} onToast={show} onSettled={onEvalSettled} />
        {data?.stats && data.stats.byCount.length > 0 ? <VocabStatsCard stats={data.stats} today={data.today} /> : null}
        {data?.kept && data.kept.items.length > 0 ? (
          <KeptSets key={loadSeq} initial={data.kept} today={data.today} busyId={replayingId} onReplay={(id) => void replay(id)} anchorRef={keptRef} />
        ) : null}
        {rvCard.kind === 'guard' ? <ReviewSoonSection guard={rvCard.guard} /> : null}
      </div>
      <FinishConfirmSheet
        open={finishOpen}
        answered={answeredNow}
        unanswered={Math.max(0, (ip?.session.cardCount ?? 0) - (answeredNow ?? 0))}
        busy={finishing}
        error={finishError}
        onConfirm={() => void finishInProgress()}
        onClose={() => setFinishOpen(false)}
      />
      {/* 되돌리기 토스트가 떠 있는 동안 같은 자리 공용 토스트는 띄우지 않는다(§14-2 C). */}
      <Toast message={rvSkip.undoOpen ? null : toast.message} />
      <UndoToast open={rvSkip.undoOpen} message={RV_HOME.undoMessage} actionLabel={RV_HOME.undo} onAction={rvSkip.undo} actionRef={rvSkip.undoRef} />
    </div>
  )
}
