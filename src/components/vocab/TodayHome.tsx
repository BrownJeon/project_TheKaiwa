'use client'

/**
 * 오늘의 공부 홈 `/study/today`(screens.md §5-2 A·§5-3 B). 마운트·화면 복귀 때 #46 · #48(최근 10) · #48(보관 5) · #54 를 함께 읽는다.
 * #46·#48(최근) 실패만 카드 오류이고, 보관 세트·통계 실패는 그 섹션을 조용히 숨긴다. 자동 폴링은 없다.
 *
 * 풀던 세트는 사용자당 하나이고 새 세트·다시 풀기를 막으므로 늘 가장 최근에 시작한 세트다 → 최근 10개 안에서 찾는다(F3 `answeredCount`).
 * 장수는 저장하지 않고 늘 설정(`dailyWordCount`)에서 시작한다. 방식·분류는 마지막 선택을 기억한다(저장소가 막혀도 기본값으로 동작).
 */
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { apiGet, apiPost } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import Toast, { useToast } from '@/components/common/Toast'
import type { CategoryCount, CreateSessionResult, FinishResult, Paged, SessionDetail, SessionSummary, VocabMode, VocabStats } from '@/types/vocab'
import { isAnswered } from './deck'
import FinishConfirmSheet from './FinishConfirmSheet'
import { todayKey } from './format'
import { putSession, takeSession, useSeedPack, useStoredPref, useStoredString, VOCAB_KEYS } from './hooks'
import KeptSets from './KeptSets'
import { actionErrorText, FLASH, HINT, homeLoadErrorText, seedResultText, startErrorText } from './labels'
import TodayComingSoon from './TodayComingSoon'
import TodayWordsCard, { type PoolEmptyKind, type WordsCardState } from './TodayWordsCard'
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

export default function TodayHome({ dailyWordCount }: { dailyWordCount: number }) {
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
  const keptRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const { show } = toast

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
    const onVis = () => {
      if (document.visibilityState === 'visible') setTick((t) => t + 1)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // 덱에서 돌아왔을 때 한 번 띄울 안내(풀던 세트 저장·기록 없이 닫힘·풀던 세트 먼저)
  useEffect(() => {
    const id = setTimeout(() => {
      const msg = takeSession(VOCAB_KEYS.flash)
      if (msg) show(msg)
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

  const ip = data?.inProgress ?? null
  const answeredNow = ip?.answered ?? null

  return (
    <div className="px-4 pb-8">
      <div ref={cardRef} className="scroll-mt-16">
        <TodayWordsCard
          state={state}
          loadError={loadError}
          dailyWordCount={dailyWordCount}
          count={count}
          mode={mode}
          category={category}
          categories={categories}
          archivedTotal={totals?.archived ?? 0}
          todayDone={todayDone}
          inProgress={ip}
          today={data?.today ?? ''}
          poolEmptyKind={override?.kind ?? null}
          hasKept={!!data?.kept && data.kept.items.length > 0}
          starting={starting}
          startError={startError}
          seeding={seeding}
          finishing={finishing}
          onCount={setCount}
          onMode={(m) => setMode(m)}
          onCategory={(c) => setStoredCategory(c)}
          onStart={() => void start(category)}
          onStartAll={() => {
            setStoredCategory(null)
            void start(null)
          }}
          onBackToReady={() => setOverride(null)}
          onFinish={() => {
            setFinishError(null)
            setFinishOpen(true)
          }}
          onShowResult={() => void finishInProgress()}
          onSeed={() => void runSeed()}
          onShowKept={() => keptRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })}
          onRetry={() => {
            setLoadState('loading')
            setTick((t) => t + 1)
          }}
        />
      </div>
      {data?.stats && data.stats.byCount.length > 0 ? <VocabStatsCard stats={data.stats} today={data.today} /> : null}
      {data?.kept && data.kept.items.length > 0 ? (
        <KeptSets key={loadSeq} initial={data.kept} today={data.today} busyId={replayingId} onReplay={(id) => void replay(id)} anchorRef={keptRef} />
      ) : null}
      <TodayComingSoon />
      <FinishConfirmSheet
        open={finishOpen}
        answered={answeredNow}
        unanswered={Math.max(0, (ip?.session.cardCount ?? 0) - (answeredNow ?? 0))}
        busy={finishing}
        error={finishError}
        onConfirm={() => void finishInProgress()}
        onClose={() => setFinishOpen(false)}
      />
      <Toast message={toast.message} />
    </div>
  )
}
