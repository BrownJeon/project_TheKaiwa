'use client'

/**
 * 주제 만들기 `/settings/scenarios/topics/new`(task-045 T5-3a — screens.md §16-2 S3·S4). BackBar 52(sticky) + 앱 셸 `main` 한 곳 스크롤.
 * 이 탭 sessionStorage 의 초안은 하이드레이션 뒤에만 읽는다(그 전에는 머리만 그린다 — 서버 HTML 과 어긋나지 않게).
 * ← 는 고친 초안이 있으면 나가기 시트(초안은 이 탭에 남는다). 안드로이드 뒤로는 막지 않는다(§16-0 #7 — 초안은 남아 다시 들어오면 이어 고치기 카드).
 * 초점은 한 곳씩만 옮긴다: 초안 도착 → 안내 제목 · 묻기 오류 → 입력칸 · 저장 검사 실패 → 첫 문제(초점이 그 칸을 화면에 보이게 한다 — 스크롤 호출 없음, R5).
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Sheet from '@/components/common/Sheet'
import { Btn } from '@/components/common/ui'
import { ErrorBox } from '@/components/challenge/parts'
import { Spinner } from '@/components/plan/parts'
import { oneLine, type DraftLevel } from '@/components/scenario/logic'
import BackBar from '@/components/shell/BackBar'
import { chunkKeyOfProblem, chunkRowDomId, MANAGE_HREF, topicProblemDomId, type TopicProblem } from './logic'
import TopicAskForm from './TopicAskForm'
import TopicDraftReview from './TopicDraftReview'
import { CREATE, REVIEW, TOPIC } from './topicCopy'
import { useTopicDraft, type TopicDraftModel } from './useTopicDraft'

const noopSubscribe = () => () => {}
const GEN_FAIL_DOM_ID = 'tp-gen-fail'

export default function TopicCreateScreen({ defaultLevel }: { defaultLevel: DraftLevel }) {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)
  if (!hydrated) return <BackBar sticky backHref={MANAGE_HREF} backLabel={TOPIC.back} title={CREATE.title} />
  return <Screen defaultLevel={defaultLevel} />
}

/** 첫 문제로 초점 — 표현 칸이 접혀 있으면 그 행의 ⋯ 버튼. */
function focusProblem(p: TopicProblem | undefined) {
  if (!p) return
  const el = document.getElementById(topicProblemDomId(p.key)) ?? (chunkKeyOfProblem(p.key) ? document.getElementById(chunkRowDomId(chunkKeyOfProblem(p.key) as string)) : null)
  el?.focus()
}

function Screen({ defaultLevel }: { defaultLevel: DraftLevel }) {
  const m = useTopicDraft(defaultLevel)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const askRef = useRef<HTMLInputElement>(null)
  const noteRef = useRef<HTMLHeadingElement>(null)
  const errors = useMemo(() => {
    const out: Record<string, string> = {}
    for (const p of m.problems) if (!(p.key in out)) out[p.key] = p.message
    return out
  }, [m.problems])

  const problemsRef = useRef(m.problems)
  useEffect(() => {
    problemsRef.current = m.problems
  }, [m.problems])
  useEffect(() => {
    if (m.focus.n === 0) return
    const to = m.focus.to
    requestAnimationFrame(() => {
      if (to === 'arrived') noteRef.current?.focus()
      else if (to === 'ask') askRef.current?.focus()
      else if (to === 'failure') document.getElementById(GEN_FAIL_DOM_ID)?.focus()
      else focusProblem(problemsRef.current[0])
    })
  }, [m.focus])

  const generating = m.stage === 'generating'
  const reviewing = !!m.draft && (m.stage === 'review' || m.stage === 'saving')
  const onBack = () => {
    if (reviewing && m.edited) setLeaveOpen(true)
    else m.leave()
  }

  return (
    <>
      <BackBar sticky backHref={MANAGE_HREF} backLabel={TOPIC.back} title={CREATE.title} onBack={onBack} />
      <div className="mx-auto min-w-0 max-w-[520px] px-4 pb-8 pt-3.5">
        <div className="flex min-w-0 flex-col gap-[18px]">
          {m.restore?.draft ? (
            <div className="rounded-[14px] border border-line bg-surface p-3.5">
              <p className="text-[14px] font-semibold">{CREATE.resumeTitle}</p>
              <p className="mt-1 text-[13px] text-ink2 break-keep [overflow-wrap:anywhere]">{CREATE.resumeBody(oneLine(m.restore.draft.title))}</p>
              <div className="mt-3 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
                <Btn onClick={m.acceptRestore}>{CREATE.resume}</Btn>
                <Btn variant="ghost" onClick={m.dropRestore}>
                  {CREATE.resumeDiscard}
                </Btn>
              </div>
            </div>
          ) : null}

          {generating ? (
            <div role="status" className="rounded-[14px] border border-line bg-surface p-4">
              <p className="flex items-center gap-2 text-[15px] font-semibold">
                <Spinner />
                {CREATE.gen}
              </p>
              <p className="mt-1 text-[13px] text-ink2 break-keep">{CREATE.genSub}</p>
              {m.flight.long ? <p className="mt-1 text-[13px] text-ink2 break-keep">{CREATE.genLong}</p> : null}
              <Btn variant="ghost" className="mt-3 w-full" aria-disabled={!m.flight.cancelable || undefined} onClick={m.cancelGenerate}>
                {CREATE.cancel}
              </Btn>
            </div>
          ) : null}

          {m.canceled && !generating ? (
            <p role="status" className="rounded-xl bg-surface2 px-3.5 py-3 text-[13px] text-ink break-keep">
              {CREATE.canceled}
            </p>
          ) : null}

          {m.genFailure && !generating ? <GenFailure m={m} /> : null}

          {reviewing && !generating && m.draft ? (
            <TopicDraftReview
              draft={m.draft}
              setDraft={m.setDraft}
              errors={errors}
              problemCount={m.problems.length}
              warnLines={m.warnLines}
              arrivalTitle={m.arrivalTitle}
              saving={m.stage === 'saving'}
              saveMessage={m.saveMessage}
              noteRef={noteRef}
              onSave={m.save}
              onRegen={m.generate}
              onDiscard={() => setDiscardOpen(true)}
            />
          ) : (
            <TopicAskForm
              ask={m.ask}
              onAsk={m.setAsk}
              error={m.askError}
              profileLevel={defaultLevel}
              locked={generating}
              blockedBy={m.genFailure?.block ? GEN_FAIL_DOM_ID : null}
              onSubmit={m.generate}
              inputRef={askRef}
            />
          )}
        </div>
      </div>

      <Sheet open={leaveOpen} title={REVIEW.leaveTitle} onClose={() => setLeaveOpen(false)}>
        <p className="text-[14px] break-keep">{REVIEW.leaveBody}</p>
        <div className="mt-3 flex gap-2 pb-2 [&>*]:min-w-0 [&>*]:flex-1">
          <Btn variant="ghost" onClick={m.leave}>
            {REVIEW.leave}
          </Btn>
          <Btn onClick={() => setLeaveOpen(false)}>{REVIEW.stay}</Btn>
        </div>
      </Sheet>
      <Sheet open={discardOpen} title={REVIEW.discardTitle} onClose={() => setDiscardOpen(false)}>
        <p className="text-[14px] break-keep">{REVIEW.discardBody}</p>
        <div className="mt-3 flex gap-2 pb-2 [&>*]:min-w-0 [&>*]:flex-1">
          <Btn variant="danger" className="border-bad" onClick={m.discard}>
            {REVIEW.discard}
          </Btn>
          <Btn variant="ghost" onClick={() => setDiscardOpen(false)}>
            {REVIEW.stay}
          </Btn>
        </div>
      </Sheet>
    </>
  )
}

function GenFailure({ m }: { m: TopicDraftModel }) {
  const f = m.genFailure
  if (!f) return null
  if (f.retry)
    return (
      <div id={GEN_FAIL_DOM_ID} tabIndex={-1} className="outline-none">
        <ErrorBox title={f.text} onRetry={m.generate} retryLabel={REVIEW.regen} />
      </div>
    )
  return (
    <p id={GEN_FAIL_DOM_ID} tabIndex={-1} role="alert" className="rounded-xl bg-surface2 px-3.5 py-3 text-[13px] text-ink break-keep outline-none">
      {f.text}
    </p>
  )
}
