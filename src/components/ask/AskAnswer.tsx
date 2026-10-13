'use client'

/**
 * 선생님 답 묶음(task-064 §25-5 B, D3·D4·D5·D7 A) — 누가 줄 → 답 카드(LOW 줄 · 기록 없음 줄 · 본문 · 되묻기 문장 · 칩) → 근거 → 제안 → 시각.
 * 무엇을 그릴지는 순수 `askAnswerView` 가 정한다. 근거가 비면 근거 영역(머리 포함)을 그리지 않는다(GENERAL 은 늘 빈 배열).
 * 제안은 채택해야만 저장된다 — 카드는 응답을 받은 뒤에만 바뀐다(공용 `ProposalCard`). 3a 제안 종류 밖(ADD_TOPIC 등)은 그리지 않는다.
 */
import type { AskScopeOption } from '@/types/ask'
import type { ChatMessageView, ProposalDto } from '@/types/chat'
import type { AnnotationState } from '@/components/common/japanese/annotations'
import { formatClock } from '@/components/common/format'
import { JaRuns } from '@/components/common/japanese/JaRuns'
import ProposalCard from '@/components/chat/ProposalCard'
import AnswerMarkdown from './AnswerMarkdown'
import { parseAnswerMd } from './answerMd'
import { ASK_COPY } from './askCopy'
import { TeacherLine } from './AskPending'
import { askAnswerView, askOf, isAskProposalKind } from './logic'
import ScopeChips from './ScopeChips'
import SourceList from './SourceList'

/** 이 답에 붙은 제안 중 3a 가 그리는 종류만(서버 순서 그대로). */
export function answerProposals(proposals: readonly ProposalDto[], messageId: string): ProposalDto[] {
  return proposals.filter((p) => p.messageId === messageId && isAskProposalKind(p.kind))
}

function InfoLine({ bold, text }: { bold: string; text: string }) {
  return (
    <p className="grid grid-cols-[18px_minmax(0,1fr)] items-start gap-2 rounded-[10px] bg-surface2 px-2.5 py-[9px] text-[13.5px] leading-normal text-ink">
      <span aria-hidden="true" className="mt-px inline-grid h-[18px] w-[18px] place-items-center rounded-full border-[1.5px] border-current text-[11px] font-bold">
        i
      </span>
      <span className="min-w-0 break-keep">
        <b className="font-bold">{bold}</b>
        {text}
      </span>
    </p>
  )
}

export default function AskAnswer({
  m,
  isLast,
  idle,
  chatId,
  teacherName,
  title,
  proposals,
  annOf,
  onPickScope,
  onOwnScope,
  onProposalChange,
  onToast,
}: {
  m: ChatMessageView
  isLast: boolean
  /** 턴이 쉬는 중(idle·failed) — 되묻기 칩은 이때만 */
  idle: boolean
  /** 근거에서 돌아올 주소도 이 대화(`/ask?chat=<id>` — `SourceList` 가 만든다, task-067 §27-7 B) */
  chatId: string
  teacherName: string
  /** `teacherTitle(teacherName)` */
  title: string
  proposals: readonly ProposalDto[]
  annOf: (ja: string) => AnnotationState
  onPickScope: (o: AskScopeOption) => void
  onOwnScope: () => void
  onProposalChange: (p: ProposalDto) => void
  onToast: (msg: string) => void
}) {
  const ask = askOf(m)
  const view = askAnswerView(m, { isLast, idle })
  const mine = answerProposals(proposals, m.id)
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <TeacherLine teacherName={teacherName} title={title} />
      <article
        aria-label={ASK_COPY.answerAria(title)}
        className="flex min-w-0 flex-col gap-2.5 rounded-[6px_16px_16px_16px] border border-line bg-surface px-3.5 py-3"
      >
        {view.lowLine ? (
          <InfoLine bold={ASK_COPY.lowBold} text={` ${view.lowLine === 'withSources' ? ASK_COPY.lowWithSources : ASK_COPY.lowNoSources}`} />
        ) : null}
        {view.noneLine ? <InfoLine bold={ASK_COPY.noneBold} text={ASK_COPY.noneTail} /> : null}
        <AnswerMarkdown blocks={parseAnswerMd(m.content)} annOf={annOf} />
        {view.promptExtra && ask?.needsScope ? (
          <p className="text-[15px] leading-[1.65] break-keep [overflow-wrap:anywhere]">
            <JaRuns text={ask.needsScope.prompt} />
          </p>
        ) : null}
        {view.chips && ask?.needsScope ? <ScopeChips options={ask.needsScope.options} onPick={onPickScope} onOwn={onOwnScope} /> : null}
      </article>
      {view.showSources && ask ? <SourceList chatId={chatId} sources={ask.sources} /> : null}
      {mine.map((p) => (
        <ProposalCard key={p.id} proposal={p} context="ask" onChange={onProposalChange} onToast={onToast} />
      ))}
      <p className="text-[12px] text-ink2">
        <time dateTime={m.createdAt}>{formatClock(m.createdAt)}</time>
      </p>
    </div>
  )
}
