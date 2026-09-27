'use client'

/**
 * 오늘 홈의 "오늘의 단어" 카드(screens.md §5-2 A 표). 상태 5가지 — 준비 · 풀던 세트(E3) · 빈 단어장 · 오늘 풀 단어 없음 · 오류.
 * 머리줄(제목 + 준비 상태의 "약 {m}분")은 모든 상태에서 같다. 첫 화면(≈780px) 안에 [시작하기]까지 들어와야 한다.
 */
import Link from 'next/link'
import Segmented from '@/components/common/Segmented'
import { Btn, BtnRow, Card, ErrorBlock } from '@/components/common/ui'
import type { CategoryCount, SessionSummary, VocabMode } from '@/types/vocab'
import CategoryChips from './CategoryChips'
import { countOptions, estimateMinutes } from './deck'
import { formatSessionDate } from './format'
import { MODE_LABEL } from './labels'
import { visibleCategories } from './validate'

export type WordsCardState = 'loading' | 'ready' | 'inProgress' | 'empty' | 'poolEmpty' | 'error'
export type PoolEmptyKind = 'allDone' | 'category'

const MODE_OPTIONS = [
  { value: 'CHOICE', label: MODE_LABEL.CHOICE },
  { value: 'FLIP', label: MODE_LABEL.FLIP },
] as const

const LINK_BTN = 'inline-flex min-h-[44px] items-center text-[13px] font-medium text-accent'

export default function TodayWordsCard({
  state,
  loadError,
  dailyWordCount,
  count,
  mode,
  category,
  categories,
  archivedTotal,
  todayDone,
  inProgress,
  today,
  poolEmptyKind,
  hasKept,
  starting,
  startError,
  seeding,
  finishing,
  onCount,
  onMode,
  onCategory,
  onStart,
  onStartAll,
  onBackToReady,
  onFinish,
  onShowResult,
  onSeed,
  onShowKept,
  onRetry,
}: {
  state: WordsCardState
  loadError: string | null
  dailyWordCount: number
  count: number
  mode: VocabMode
  category: string | null
  categories: CategoryCount[] | null
  archivedTotal: number
  todayDone: { sets: number; correct: number; cards: number }
  inProgress: { session: SessionSummary; answered: number | null } | null
  today: string
  poolEmptyKind: PoolEmptyKind | null
  hasKept: boolean
  starting: boolean
  startError: string | null
  seeding: boolean
  finishing: boolean
  onCount: (n: number) => void
  onMode: (m: VocabMode) => void
  onCategory: (c: string | null) => void
  onStart: () => void
  onStartAll: () => void
  onBackToReady: () => void
  onFinish: () => void
  onShowResult: () => void
  onSeed: () => void
  onShowKept: () => void
  onRetry: () => void
}) {
  const head = (
    <div className="flex items-baseline justify-between gap-2">
      <h2 className="text-[15px] font-semibold">오늘의 단어</h2>
      {state === 'ready' ? <span className="flex-none text-[12px] text-ink2">약 {estimateMinutes(count)}분</span> : null}
    </div>
  )

  let body: React.ReactNode
  switch (state) {
    case 'loading':
      body = (
        <p role="status" className="mt-2 text-[13px] text-ink2">
          불러오는 중…
        </p>
      )
      break
    case 'error':
      body = (
        <div className="mt-2">
          <ErrorBlock message={loadError ?? '오늘의 단어를 불러오지 못했어요.'} onRetry={onRetry} />
        </div>
      )
      break
    case 'inProgress': {
      const s = inProgress!.session
      const answered = inProgress!.answered
      const all = answered !== null && answered >= s.cardCount
      body = (
        <div className="mt-2">
          <p className="text-[15px] font-semibold">풀던 세트가 있어요</p>
          <p className="mt-0.5 text-[13px] text-ink2 break-keep">
            {formatSessionDate(s.date, today) || '오늘'} 시작 · {MODE_LABEL[s.mode]} · {s.cardCount}장
            {answered !== null ? ` 중 ${answered}장 답함` : ''}
          </p>
          <p className="text-[12px] text-ink2 break-keep">답한 카드는 저장돼 있어요.</p>
          {today && s.date !== today ? (
            <p className="text-[12px] text-ink2 break-keep">지난 날 시작한 세트예요. 끝내면 그날 기록으로 남아요.</p>
          ) : null}
          {all ? (
            <Btn className="mt-3 w-full" onClick={onShowResult} aria-disabled={finishing || undefined} aria-busy={finishing || undefined}>
              {finishing ? '끝내는 중…' : '결과 보기'}
            </Btn>
          ) : (
            <BtnRow>
              <Link
                href={`/study/today/words/${encodeURIComponent(s.id)}`}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-accent px-4 text-[15px] font-semibold text-on-accent"
              >
                이어서 풀기
              </Link>
              <Btn variant="ghost" onClick={onFinish}>
                여기서 끝내기
              </Btn>
            </BtnRow>
          )}
        </div>
      )
      break
    }
    case 'empty':
      body = (
        <div className="mt-2">
          <p className="text-[15px] font-semibold">단어장이 비어 있어요</p>
          <p className="mt-0.5 text-[13px] text-ink2 break-keep">오늘의 단어는 내 단어장에서 골라요. 기본 단어로 바로 시작해 볼까요?</p>
          <div className="mt-3 flex flex-col gap-2">
            <Btn className="w-full" onClick={onSeed} aria-disabled={seeding || undefined} aria-busy={seeding || undefined}>
              {seeding ? '넣는 중…' : '기본 단어 50개 넣기'}
            </Btn>
            <Link href="/drawer/words?add=1" className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold">
              단어 직접 추가
            </Link>
          </div>
          {archivedTotal > 0 ? (
            <Link href="/drawer/words" className={`${LINK_BTN} mt-1`}>
              보관한 단어 {archivedTotal}개는 오늘의 단어에 나오지 않아요 · 단어장에서 보기 ›
            </Link>
          ) : null}
        </div>
      )
      break
    case 'poolEmpty':
      body =
        poolEmptyKind === 'category' && category !== null ? (
          <div className="mt-2">
            <p className="text-[14px] break-keep [overflow-wrap:anywhere]">
              ‘{category}’에서 오늘 풀 단어가 없어요. 오늘 끝낸 세트의 단어는 내일 다시 나와요.
            </p>
            <BtnRow>
              <Btn onClick={onStartAll} aria-disabled={starting || undefined} aria-busy={starting || undefined}>
                {starting ? '만드는 중…' : '전체로 풀기'}
              </Btn>
              <Btn variant="ghost" onClick={onBackToReady}>
                분류 바꾸기
              </Btn>
            </BtnRow>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-[14px] break-keep">오늘 풀 단어를 모두 풀었어요. 오늘 끝낸 세트의 단어는 내일 다시 나와요.</p>
            <div className="mt-3 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
              {hasKept ? (
                <Btn variant="ghost" onClick={onShowKept}>
                  보관한 세트 보기
                </Btn>
              ) : null}
              <Link href="/drawer/words?add=1" className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold">
                단어 추가하기
              </Link>
            </div>
          </div>
        )
      break
    default: {
      const counts = countOptions(dailyWordCount).map((n) => ({ value: n, label: `${n}장` }))
      const showChips = visibleCategories(categories, 'active').length > 1
      body = (
        <div className="mt-1">
          <p className="text-[13px] text-ink2 break-keep">카드를 넘기며 뜻을 맞혀요. 틀린 단어일수록 자주 나와요.</p>
          {todayDone.sets > 0 ? (
            <p className="mt-0.5 text-[12px] text-ink2 tabular-nums">
              오늘 {todayDone.sets}세트를 끝냈어요 · 맞힘 {todayDone.correct}/{todayDone.cards}
            </p>
          ) : null}
          <p className="mb-1.5 mt-3 text-[12.5px] text-ink2">장수</p>
          <Segmented<number> size="sm" ariaLabel="카드 장수" options={counts} value={count} onChange={onCount} />
          <p className="mb-1.5 mt-3 text-[12.5px] text-ink2">방식</p>
          <Segmented<VocabMode> size="sm" ariaLabel="푸는 방식" options={MODE_OPTIONS} value={mode} onChange={onMode} />
          {showChips ? (
            <>
              <p className="mb-0.5 mt-3 text-[12.5px] text-ink2">분류</p>
              <CategoryChips items={categories} value={category} onChange={onCategory} basis="active" bleed="-mx-3.5 px-3.5" />
            </>
          ) : null}
          <Btn className="mt-3 w-full" onClick={onStart} aria-disabled={starting || undefined} aria-busy={starting || undefined}>
            {starting ? '만드는 중…' : '시작하기'}
          </Btn>
          {startError ? (
            <p role="alert" className="mt-1.5 text-[12px] text-bad break-keep">
              {startError}
            </p>
          ) : null}
        </div>
      )
    }
  }

  return (
    <Card>
      {head}
      {body}
    </Card>
  )
}
