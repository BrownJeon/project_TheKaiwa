'use client'

/**
 * 상황 카드(가이드 §3-B) — 행 전체가 버튼(시트를 연다). 목록·추천·(B3) 수업 카드·(챌린지 T6) 하루 과제가 함께 쓴다 —
 * 장소 칩·묶음은 `ScenarioHome` 쪽에 두고 카드에는 넣지 않는다. 상태는 색이 아니라 뱃지 글자로 구분한다.
 * `aria-label` 을 두지 않는다(보이는 글이 순서대로 이름이 된다). 난이도 점은 읽지 않고 sr 문장 하나로.
 */
import { Badge } from '@/components/common/ui'
import type { ScenarioListItem } from '@/types/scenario'
import { cardMetaSteps, cardStatus, difficultyOf, recommendReasonText, type CardStatus } from './logic'
import { CARD } from './scenarioCopy'

const DOTS = [1, 2, 3, 4, 5] as const

export function DifficultyDots({ value }: { value: number }) {
  const d = difficultyOf(value)
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden="true">{CARD.difficulty}</span>
      <span aria-hidden="true" className="inline-flex items-center gap-[3px]">
        {DOTS.map((i) => (
          <span key={i} className={`block h-1.5 w-1.5 rounded-full ${i <= d ? 'bg-ink2' : 'bg-line'}`} />
        ))}
      </span>
      <span className="sr-only">{CARD.difficultySr(d)}</span>
    </span>
  )
}

function StatusBits({ st }: { st: CardStatus }) {
  if (st.kind === 'first') return <span>{CARD.first}</span>
  if (st.kind === 'achieved')
    return (
      <span className="inline-flex items-center gap-1.5">
        <Badge tone="good">{CARD.achieved}</Badge>
        {st.date ? <span>{st.date}</span> : null}
      </span>
    )
  if (st.kind === 'almost')
    return (
      <span className="inline-flex items-center gap-1.5">
        <Badge>{CARD.almost}</Badge>
        {st.date ? <span>{st.date}</span> : null}
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge>{CARD.tried}</Badge>
      <span>{st.date ? CARD.notYetOn(st.date) : CARD.notYet}</span>
    </span>
  )
}

export default function ScenarioCard({ item, variant = 'list', onOpen }: { item: ScenarioListItem; variant?: 'list' | 'reco'; onOpen: (id: string) => void }) {
  const reason = variant === 'reco' ? recommendReasonText(item.recommendReason) : null
  const steps = cardMetaSteps(item.stepCount)
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      data-scenario-id={item.id}
      onClick={() => onOpen(item.id)}
      className="flex min-h-[88px] w-full min-w-0 flex-col items-stretch rounded-[14px] border border-line bg-surface p-3.5 text-left"
    >
      <span className="flex min-w-0 items-start gap-1.5">
        <span className="line-clamp-2 min-w-0 flex-1 text-[15px] font-semibold leading-snug [overflow-wrap:anywhere]">{item.title}</span>
        {item.isMine ? <Badge>{CARD.mine}</Badge> : null}
        <Badge>{item.level}</Badge>
        <span aria-hidden="true" className="flex-none text-[15px] leading-[22px] text-ink2">
          ›
        </span>
      </span>
      {item.titleJa ? (
        <span lang="ja" className="mt-0.5 block min-w-0 truncate text-[13px] text-ink2">
          {item.titleJa}
        </span>
      ) : null}
      {reason ? <span className="mt-1 block min-w-0 text-[13px] text-ink break-keep">{reason}</span> : null}
      <span className="mt-1 block min-w-0 truncate text-[13px] text-ink2">{CARD.goal(item.goalKo)}</span>
      <span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink2">
        {steps ? <span>{steps}</span> : null}
        <DifficultyDots value={item.difficulty} />
        <StatusBits st={cardStatus(item)} />
        {item.inProgressChatId ? <span className="font-semibold text-accent">{CARD.inProgress}</span> : null}
      </span>
    </button>
  )
}
