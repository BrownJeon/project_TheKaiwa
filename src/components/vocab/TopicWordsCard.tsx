'use client'

/**
 * 오늘 탭 "오늘의 단어" — 챌린지 주제 모드(task-044 가이드 §3-3). 진행 중 챌린지에 단어 과제가 있을 때만 지금 카드 대신 그린다.
 * 장수 칩·방식 선택은 없다(장수 = 목표 장수, 세트는 늘 카드 우선 — task-059). [시작하기]·[한 세트 더]는 대기 화면(`/study/today/words/new`)으로 간다 — 새 단어 생성 요청은 그 화면에서만 나간다.
 * [내 단어장으로 풀기]는 카드 안 펼침(`aria-expanded`) — 지금 카드 준비 몸통 그대로(`MineSetPanel`), 챌린지에는 세지 않는다.
 */
import Link from 'next/link'
import { Btn, Card, ErrorBlock } from '@/components/common/ui'
import type { ChallengeWordsTask } from '@/types/challenge'
import type { SessionSummary } from '@/types/vocab'
import { estimateMinutes } from './deck'
import { CardLoadingBody } from './TodaySkeleton'
import { WORDS_CARD } from './topicCopy'
import { topicSourceLine, wipCardNotes, wordsCardKind, type ChallengeCtx } from './topicLogic'
import { InProgressBody, MineSetPanel } from './TodayWordsCard'

export function TopicChip({ text, sr }: { text: string; sr: string }) {
  return (
    <span className="inline-flex h-6 min-w-0 max-w-full items-center truncate rounded-full bg-surface2 px-2 text-[12px] font-semibold text-ink2">
      <span className="sr-only">{sr}</span>
      <span className="truncate">{text}</span>
    </span>
  )
}

export default function TopicWordsCard({
  loadState,
  loadError,
  ctx,
  task,
  inProgress,
  today,
  tally,
  starting,
  finishing,
  mineOpen,
  mineProps,
  onStartTopic,
  onFinish,
  onShowResult,
  onToggleMine,
  onRetry,
}: {
  loadState: 'loading' | 'error' | 'ready'
  loadError: string | null
  ctx: ChallengeCtx
  task: ChallengeWordsTask
  inProgress: { session: SessionSummary; answered: number | null } | null
  today: string
  tally: { sets: number; correct: number; wrong: number; skipped: number }
  starting: boolean
  finishing: boolean
  mineOpen: boolean
  mineProps: Omit<Parameters<typeof MineSetPanel>[0], never>
  onStartTopic: () => void
  onFinish: () => void
  onShowResult: () => void
  onToggleMine: () => void
  onRetry: () => void
}) {
  const n = task.wordCount ?? 10
  const need = task.minAnswered ?? Math.ceil((4 * n) / 5)
  const kind = loadState === 'ready' ? wordsCardKind(task, inProgress, ctx.topicId) : null

  const head = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <h2 className="text-[15px] font-semibold">{WORDS_CARD.title}</h2>
      <TopicChip text={WORDS_CARD.chip(ctx.title)} sr={WORDS_CARD.chipSr} />
      {kind === 'todo' ? <span className="ml-auto flex-none text-[12px] text-ink2">약 {estimateMinutes(n)}분</span> : null}
    </div>
  )

  let body: React.ReactNode
  if (loadState === 'loading') {
    // 챌린지 카드의 실제 높이는 상태·주제에 따라 달라 실측하지 못했다 — 지금 단어 카드(준비)와 같은 높이로 둔다.
    body = <CardLoadingBody kind="word" />
  } else if (loadState === 'error') {
    body = (
      <div className="mt-2">
        <ErrorBlock message={loadError ?? '오늘의 단어를 불러오지 못했어요.'} onRetry={onRetry} />
      </div>
    )
  } else if ((kind === 'wip' || kind === 'otherWip') && inProgress) {
    const s = inProgress.session
    body = (
      <InProgressBody
        session={s}
        answered={inProgress.answered}
        today={today}
        notes={wipCardNotes(kind, s.date, today)}
        finishing={finishing}
        chip={kind === 'otherWip' && s.topic ? <TopicChip text={s.topic.title} sr="주제: " /> : null}
        source={kind === 'wip' && s.topic ? <p className="mt-0.5 text-[12.5px] text-ink2 break-keep">{topicSourceLine(s.topic, s.cardCount, null)}</p> : null}
        onFinish={onFinish}
        onShowResult={onShowResult}
      />
    )
  } else if (kind === 'ipDefense') {
    body = (
      <div className="mt-2">
        <p className="text-[15px] font-semibold">{WORDS_CARD.ipDefense}</p>
        {task.sessionId ? (
          <Link
            href={`/study/today/words/${encodeURIComponent(task.sessionId)}`}
            className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-accent px-4 text-[15px] font-semibold text-on-accent"
          >
            {WORDS_CARD.resume}
          </Link>
        ) : null}
      </div>
    )
  } else if (kind === 'short') {
    body = (
      <div className="mt-2">
        <p className="text-[15px] font-semibold tabular-nums break-keep">{WORDS_CARD.shortHead(task.answered, need)}</p>
        {tally.sets > 0 ? <p className="mt-0.5 text-[13px] text-ink2 tabular-nums">{WORDS_CARD.setsLine(tally.sets, tally.correct, tally.wrong, tally.skipped)}</p> : null}
        <p role="note" className="mt-2 rounded-xl bg-warn-soft px-3 py-2.5 text-[13px] text-ink break-keep">
          <b>{WORDS_CARD.shortMemoStrong}</b>
          {WORDS_CARD.shortMemo}
        </p>
        <Btn className="mt-3 w-full" onClick={onStartTopic} aria-disabled={starting || undefined} aria-busy={starting || undefined}>
          {WORDS_CARD.oneMore}
        </Btn>
      </div>
    )
  } else if (kind === 'done') {
    body = (
      <div className="mt-2">
        <p className="text-[15px] font-semibold">{WORDS_CARD.doneHead}</p>
        <p className="mt-0.5 text-[13px] text-ink2 tabular-nums break-keep">{WORDS_CARD.doneBody(Math.max(tally.sets, task.sets), task.answered, need, tally.correct)}</p>
        <Btn variant="ghost" className="mt-3 w-full" onClick={onStartTopic} aria-disabled={starting || undefined} aria-busy={starting || undefined}>
          {WORDS_CARD.oneMore}
        </Btn>
      </div>
    )
  } else {
    body = (
      <div className="mt-2">
        <p className="text-[15px] font-semibold tabular-nums break-keep [overflow-wrap:anywhere]">{WORDS_CARD.todoHead(ctx.title, n, need)}</p>
        <p className="mt-0.5 text-[13px] text-ink2 break-keep">{WORDS_CARD.todoBody(n, need)}</p>
        <Btn
          className="mt-3 w-full"
          onClick={onStartTopic}
          aria-label={WORDS_CARD.startAria(ctx.title, n)}
          aria-disabled={starting || undefined}
          aria-busy={starting || undefined}
        >
          {WORDS_CARD.start}
        </Btn>
      </div>
    )
  }

  const showMine = loadState === 'ready' && kind !== 'wip' && kind !== 'otherWip'
  return (
    <Card>
      {head}
      {body}
      {showMine ? (
        <>
          <button
            type="button"
            aria-expanded={mineOpen}
            aria-controls="mine-panel"
            onClick={onToggleMine}
            className="mt-1 inline-flex min-h-11 items-center text-[13px] font-semibold text-ink underline underline-offset-4"
          >
            {WORDS_CARD.mine}
          </button>
          {mineOpen ? (
            <div id="mine-panel" className="mt-2 border-t border-line pt-3">
              <p className="text-[12px] text-ink2 break-keep">{WORDS_CARD.mineNote}</p>
              <MineSetPanel {...mineProps} />
            </div>
          ) : null}
        </>
      ) : null}
    </Card>
  )
}
