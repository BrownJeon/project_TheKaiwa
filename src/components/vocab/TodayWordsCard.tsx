'use client'

/**
 * 오늘 홈의 "오늘의 단어" 카드(screens.md §5-2 A 표). 상태 5가지 — 준비 · 풀던 세트(E3) · 빈 단어장 · 오늘 풀 단어 없음 · 오류.
 * 머리줄(제목 + 준비 상태의 "약 {m}분")은 모든 상태에서 같다. 첫 화면(≈780px) 안에 [시작하기]까지 들어와야 한다.
 * task-059(§23-9 B): 푸는 방식을 고르지 않는다 — 새 세트는 늘 카드 우선. 방식 이름은 이전 4지선다 세트에만 붙는다(`modeTag`).
 */
import Link from 'next/link'
import Segmented from '@/components/common/Segmented'
import { Btn, BtnRow, Card, ErrorBlock } from '@/components/common/ui'
import type { SeedPack } from '@/types/seedPack'
import type { CategoryCount, SessionSummary } from '@/types/vocab'
import { modeTag } from './cardFirst'
import CategoryChips from './CategoryChips'
import { countOptions, estimateMinutes } from './deck'
import { formatSessionDate } from './format'
import type { SeedLevels } from './hooks'
import { inProgressNotes, SEED_COPY } from './labels'
import { CardLoadingBody } from './TodaySkeleton'
import { visibleCategories } from './validate'
import { SeedPackButtons } from './WordsEmpty'

export type WordsCardState = 'loading' | 'ready' | 'inProgress' | 'empty' | 'poolEmpty' | 'error'
export type PoolEmptyKind = 'allDone' | 'category'

const LINK_BTN = 'inline-flex min-h-[44px] items-center text-[13px] font-medium text-accent'

export default function TodayWordsCard({
  state,
  loadError,
  dailyWordCount,
  count,
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
  levels,
  seedingPack,
  finishing,
  onCount,
  onCategory,
  onStart,
  onStartAll,
  onBackToReady,
  onFinish,
  onShowResult,
  onSeed,
  onShowKept,
  onRetry,
  embedded = false,
}: {
  state: WordsCardState
  loadError: string | null
  dailyWordCount: number
  count: number
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
  /** 넣기 단계(§19-3) — `empty` 에서만 쓴다. 읽는 중이면 부모가 `loading` 으로 그린다. */
  levels: SeedLevels
  seedingPack: SeedPack | null
  finishing: boolean
  onCount: (n: number) => void
  onCategory: (c: string | null) => void
  onStart: () => void
  onStartAll: () => void
  onBackToReady: () => void
  onFinish: () => void
  onShowResult: () => void
  onSeed: (pack: SeedPack) => void
  onShowKept: () => void
  onRetry: () => void
  /** 챌린지 단어 카드 안 [내 단어장으로 풀기] 펼침(task-044 E10) — 카드 틀·머리줄 없이 본문만(동작 그대로). */
  embedded?: boolean
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
      body = <CardLoadingBody kind="word" />
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
      body = (
        <InProgressBody
          session={s}
          answered={inProgress!.answered}
          today={today}
          notes={inProgressNotes(s.date, today)}
          finishing={finishing}
          onFinish={onFinish}
          onShowResult={onShowResult}
        />
      )
      break
    }
    case 'empty':
      body = (
        <div className="mt-2">
          <p className="text-[15px] font-semibold">단어장이 비어 있어요</p>
          <p className="mt-0.5 text-[13px] text-ink2 break-keep">{levels.main ? SEED_COPY.todayBody(levels.main) : SEED_COPY.todayBodyNoLevel}</p>
          <div className="mt-3 flex flex-col gap-2">
            <SeedPackButtons levels={levels} seedingPack={seedingPack} onSeed={onSeed} />
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

  if (embedded) return <div className="min-w-0">{body}</div>
  return (
    <Card>
      {head}
      {body}
    </Card>
  )
}

/**
 * "풀던 세트" 몸통(E3) — 지금 카드와 챌린지 주제 카드(`TopicWordsCard`, task-044 §3-3)가 같이 쓴다.
 * `chip` = 제목 아래 주제 칩, `source` = 날짜 줄 아래 출처 줄, `notes` = 12px 안내 줄(위에서 아래로).
 */
export function InProgressBody({
  session: s,
  answered,
  today,
  notes,
  finishing,
  chip,
  source,
  onFinish,
  onShowResult,
}: {
  session: SessionSummary
  answered: number | null
  today: string
  notes: readonly string[]
  finishing: boolean
  chip?: React.ReactNode
  source?: React.ReactNode
  onFinish: () => void
  onShowResult: () => void
}) {
  const all = answered !== null && answered >= s.cardCount
  return (
    <div className="mt-2">
      <p className="text-[15px] font-semibold">풀던 세트가 있어요</p>
      {chip ? <div className="mt-1">{chip}</div> : null}
      <p className="mt-0.5 text-[13px] text-ink2 break-keep">
        {formatSessionDate(s.date, today) || '오늘'} 시작 · {modeTag(s.mode)}{s.cardCount}장
        {answered !== null ? ` 중 ${answered}장 답함` : ''}
      </p>
      {source}
      {notes.map((n) => (
        <p key={n} className="text-[12px] text-ink2 break-keep">
          {n}
        </p>
      ))}
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
}

/** 챌린지 단어 카드의 내 단어장 패널 — 지금 카드 준비 몸통(장수·분류·[시작하기]·오류)·빈 단어장·오늘 풀 단어 없음 그대로(task-044 E10). */
export function MineSetPanel(props: Omit<Parameters<typeof TodayWordsCard>[0], 'embedded'>) {
  return <TodayWordsCard {...props} embedded />
}
