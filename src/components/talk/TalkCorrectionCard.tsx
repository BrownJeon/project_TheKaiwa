'use client'

/**
 * 회화 교정 카드(task-010c, 데모 v1 `co-*`) — 코치 힌트 교정은 정답을 열기 전까지 내 문장·힌트·[정답 보기]만 보이고(교정문·틀린 곳·설명·채택
 * 숨김), 열린 뒤에는 기존 교정 카드에 판정 줄("스스로 고쳤어요" 등)을 얹는다. 힌트가 없는 교정은 지금 카드 그대로.
 */
import { Badge, Btn } from '@/components/common/ui'
import CorrectionCard from '@/components/chat/CorrectionCard'
import { CHUNK_LABEL, ERROR_TYPE_LABEL } from '@/components/chat/labels'
import type { CorrectionDto } from '@/types/chat'
import { coachCardView, type CoachLine } from './correctionView'
import { COACH_COPY } from './talkCopy'

const JA_TEXT = 'whitespace-pre-wrap [overflow-wrap:anywhere] text-[17px] leading-[1.7]'

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px flex-none text-accent">
      <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}

function RetryLine({ text }: { text: string }) {
  return (
    <p className="mt-2.5 flex min-w-0 items-start gap-2 text-[14px] text-ink break-keep">
      <MicIcon />
      <span className="min-w-0">{text}</span>
    </p>
  )
}

function DoneLine({ text }: { text: string }) {
  return <p className="mt-2.5 rounded-xl bg-good-soft px-3 py-2 text-[14px] font-semibold text-good break-keep">{text}</p>
}

function noteOf(line: CoachLine): React.ReactNode {
  switch (line) {
    case 'self':
      return <DoneLine text={COACH_COPY.selfLine} />
    case 'repeat':
      return <DoneLine text={COACH_COPY.repeatLine} />
    case 'missed':
      return <RetryLine text={COACH_COPY.missed} />
    case 'afterReveal':
      return <RetryLine text={COACH_COPY.afterReveal} />
    default:
      return null
  }
}

export default function TalkCorrectionCard({
  correction,
  revealed,
  onReveal,
  busy,
  highlighted,
  onAccept,
  onReject,
}: {
  correction: CorrectionDto
  /** 이 화면에서 [정답 보기]를 눌렀는가(서버에 남지 않는다 — 다시 들어오면 힌트부터). */
  revealed: boolean
  onReveal: (c: CorrectionDto) => void
  busy: boolean
  highlighted: boolean
  onAccept: (c: CorrectionDto) => void
  onReject: (c: CorrectionDto) => void
}) {
  const c = correction
  const view = coachCardView(c, revealed)
  if (view.open) {
    const badge = view.badge === 'SELF' ? <Badge tone="good">{COACH_COPY.selfBadge}</Badge> : view.badge === 'REPEAT' ? <Badge tone="good">{COACH_COPY.repeatBadge}</Badge> : undefined
    return (
      <CorrectionCard
        correction={c}
        index={1}
        total={1}
        showCounter={false}
        busy={busy}
        highlighted={highlighted}
        onAccept={onAccept}
        onReject={onReject}
        statusBadge={badge}
        note={noteOf(view.line)}
      />
    )
  }
  const chunk = c.chunkType ? CHUNK_LABEL[c.chunkType] : null
  const cardId = `cr_${c.id}`
  return (
    <li
      id={cardId}
      className={`min-w-0 scroll-mt-16 rounded-[14px] border bg-surface p-3.5 transition-colors ${highlighted ? 'border-accent ring-2 ring-accent' : 'border-line'}`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <Badge>{ERROR_TYPE_LABEL[c.errorType] ?? '기타'}</Badge>
        {c.severity === 'MAJOR' ? <Badge tone="bad">중요</Badge> : null}
        {chunk ? <span className="min-w-0 truncate text-[12px] text-ink2">{chunk}</span> : null}
        <span className="ml-auto flex-none">
          <Badge>{COACH_COPY.hintBadge}</Badge>
        </span>
      </div>
      <div className="mt-2 min-w-0 rounded-xl bg-surface2 p-2.5">
        <p className="text-[12px] text-ink2">{COACH_COPY.mine}</p>
        <p lang="ja" className={`mt-0.5 ${JA_TEXT}`}>
          {c.original}
        </p>
      </div>
      <div className="mt-2.5 min-w-0 rounded-xl bg-accent-soft px-3 py-2.5">
        <p className="text-[12px] font-bold text-ink">{COACH_COPY.hint}</p>
        <p className="mt-0.5 text-[15px] text-ink break-keep [overflow-wrap:anywhere]">{c.hintKo}</p>
      </div>
      <RetryLine text={COACH_COPY.waiting} />
      <Btn variant="ghost" className="mt-3 !h-11 w-full !text-[14px]" aria-expanded={false} aria-controls={cardId} onClick={() => onReveal(c)}>
        {COACH_COPY.reveal}
      </Btn>
    </li>
  )
}
