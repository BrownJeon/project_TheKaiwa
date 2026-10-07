'use client'

/**
 * 주제 만들기 `/settings/scenarios/topics/new`(task-045 T5-3a — screens.md §16-2 S3·S4). BackBar 52(sticky) + 앱 셸 `main` 한 곳 스크롤.
 * 이 탭 sessionStorage 의 초안은 하이드레이션 뒤에만 읽는다(그 전에는 머리만 그린다 — 서버 HTML 과 어긋나지 않게).
 * ← 는 고친 초안이 있으면 나가기 시트(초안은 이 탭에 남는다). 안드로이드 뒤로는 막지 않는다(§16-0 #7 — 초안은 남아 다시 들어오면 이어 고치기 카드).
 * 초점은 한 곳씩만 옮긴다: 초안 도착 → 안내 제목 · 묻기 오류 → 입력칸 · 저장 검사 실패 → 첫 문제(초점이 그 칸을 화면에 보이게 한다 — 스크롤 호출 없음, R5).
 * S5(T5-3b): 카드 [고치기] → `?step=sc0|sc1` 를 `{ scroll: false }` 로 붙인 같은 경로의 단계(안드로이드 뒤로 = S4). S4 는 언마운트하지 않고 `hidden` 으로 두어
 * 칸 상태를 지키고, 돌아오면 그 카드 [고치기]에 초점을 둔다(초점이 카드를 화면에 보이게 한다 — 스크롤 값을 직접 바꾸지 않는다, R1~R6 시험).
 */
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Sheet from '@/components/common/Sheet'
import { Btn } from '@/components/common/ui'
import { ErrorBox } from '@/components/challenge/parts'
import { Spinner } from '@/components/plan/parts'
import { oneLine, problemMap, type DraftLevel, type EditableDraft } from '@/components/scenario/logic'
import BackBar from '@/components/shell/BackBar'
import { chunkKeyOfProblem, chunkRowDomId, isScenarioSlotKey, MANAGE_HREF, TOPIC_NEW_HREF, topicProblemDomId, type ScenarioSlotKey, type TopicProblem } from './logic'
import ScenarioDraftCards, { PARTIAL_DOM_ID, PartialActions, PartialTop, ScenarioSlotEditor, SC_GEN_DOM_ID, scEditDomId } from './ScenarioDraftCards'
import TopicAskForm from './TopicAskForm'
import TopicDraftReview from './TopicDraftReview'
import { CREATE, PARTIAL, REVIEW, SCDRAFT, TOPIC } from './topicCopy'
import { useTopicDraft, type TopicDraftModel } from './useTopicDraft'

const noopSubscribe = () => () => {}
const GEN_FAIL_DOM_ID = 'tp-gen-fail'

/** `userId` 는 이 탭 보관 초안의 주인 확인에만 쓴다(화면에 나오지 않는다 — REV-162 M-1). */
export default function TopicCreateScreen({ defaultLevel, userId }: { defaultLevel: DraftLevel; userId: string }) {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)
  if (!hydrated) return <BackBar sticky backHref={MANAGE_HREF} backLabel={TOPIC.back} title={CREATE.title} />
  return <Screen defaultLevel={defaultLevel} userId={userId} />
}

/** 첫 문제로 초점 — 표현 칸이 접혀 있으면 그 행의 ⋯ 버튼. */
function focusProblem(p: TopicProblem | undefined) {
  if (!p) return
  const el = document.getElementById(topicProblemDomId(p.key)) ?? (chunkKeyOfProblem(p.key) ? document.getElementById(chunkRowDomId(chunkKeyOfProblem(p.key) as string)) : null)
  el?.focus()
}

function Screen({ defaultLevel, userId }: { defaultLevel: DraftLevel; userId: string }) {
  const m = useTopicDraft(defaultLevel, userId)
  const router = useRouter()
  const step = useSearchParams().get('step')
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [laterOpen, setLaterOpen] = useState(false)
  const askRef = useRef<HTMLInputElement>(null)
  const noteRef = useRef<HTMLHeadingElement>(null)
  const s5HeadRef = useRef<HTMLHeadingElement>(null)
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
      else if (to === 'partial') document.getElementById(PARTIAL_DOM_ID)?.focus()
      else focusProblem(problemsRef.current[0])
    })
  }, [m.focus])

  const generating = m.stage === 'generating'
  const reviewing = !!m.draft && (m.stage === 'review' || m.stage === 'saving' || m.stage === 'partial')
  const saving = m.stage === 'saving'
  const pending = m.scenarios.filter((x) => !x.savedId)

  // S5 — 주소의 단계가 남은(저장 안 한) 카드를 가리킬 때만. 저장 중에는 열지 않는다.
  const stepKey: ScenarioSlotKey | null = isScenarioSlotKey(step) ? step : null
  const editSlot = reviewing && !saving && stepKey ? (pending.find((x) => x.key === stepKey) ?? null) : null
  const editKey = editSlot?.key ?? null
  const pushedStep = useRef(false)
  const entrySnap = useRef<{ key: ScenarioSlotKey; draft: EditableDraft } | null>(null)
  const prevEditKey = useRef<ScenarioSlotKey | null>(null)
  useEffect(() => {
    const prev = prevEditKey.current
    prevEditKey.current = editKey
    if (editKey === prev) return
    requestAnimationFrame(() => {
      if (editKey) s5HeadRef.current?.focus()
      else if (prev) document.getElementById(scEditDomId(prev))?.focus()
    })
  }, [editKey])
  // [취소]가 되돌릴 값 — [고치기]를 누른 때의 카드 값(주소로 바로 들어온 S5 는 되돌릴 값이 없어 [완료]와 같다).
  const openStep = (key: ScenarioSlotKey) => {
    const slot = pending.find((x) => x.key === key)
    entrySnap.current = slot ? { key, draft: slot.draft } : null
    pushedStep.current = true
    router.push(`${TOPIC_NEW_HREF}?step=${key}`, { scroll: false })
  }
  const closeStep = () => {
    entrySnap.current = null
    if (pushedStep.current) {
      pushedStep.current = false
      router.back()
    } else router.replace(TOPIC_NEW_HREF, { scroll: false })
  }
  const cancelStep = () => {
    const snap = entrySnap.current
    if (snap) m.setScenarioDraft(snap.key, () => snap.draft)
    closeStep()
  }
  const slotErrors = useMemo(() => (editKey ? problemMap(m.scProblems.get(editKey) ?? []) : {}), [editKey, m.scProblems])

  const onBack = () => {
    if (editSlot) closeStep()
    else if (reviewing && m.edited) setLeaveOpen(true)
    else m.leave()
  }
  const k = m.pick.k
  const savingText = m.progress?.phase === 'scenario' ? REVIEW.savingScenario(m.progress.i, m.progress.k) : REVIEW.saving
  const partial = m.partial

  return (
    <>
      <BackBar
        sticky
        backHref={editSlot ? TOPIC_NEW_HREF : MANAGE_HREF}
        backLabel={editSlot ? SCDRAFT.backToReview : TOPIC.back}
        title={CREATE.title}
        onBack={onBack}
      />
      {editSlot && m.draft ? (
        <div className="mx-auto min-w-0 max-w-[520px] px-4 pb-8 pt-3.5">
          <ScenarioSlotEditor
            draft={editSlot.draft}
            topicTitle={oneLine(m.draft.title) || m.arrivalTitle}
            errors={slotErrors}
            headRef={s5HeadRef}
            onChange={(fn) => m.setScenarioDraft(editSlot.key, fn)}
            onDone={closeStep}
            onCancel={cancelStep}
          />
        </div>
      ) : null}
      <div hidden={!!editSlot} className="mx-auto min-w-0 max-w-[520px] px-4 pb-8 pt-3.5">
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
              saving={saving}
              saveMessage={m.saveMessage}
              noteRef={noteRef}
              onSave={m.save}
              onRegen={m.generate}
              onDiscard={() => setDiscardOpen(true)}
              saveLabel={k > 0 ? REVIEW.save(k) : REVIEW.saveTopicOnly}
              saveNote={k > 0 ? REVIEW.saveOrder : null}
              savingText={savingText}
              saveHoldId={m.scFlight.busy ? SC_GEN_DOM_ID : null}
              locked={
                partial
                  ? {
                      top: <PartialTop view={partial} />,
                      actions: <PartialActions view={partial} saving={saving} savingText={savingText} onRetry={m.save} onLater={() => (partial.m ? setLaterOpen(true) : m.goToTopic())} />,
                    }
                  : null
              }
              scenarioSlot={
                <ScenarioDraftCards
                  slots={pending}
                  pick={m.pick}
                  flight={m.scFlight}
                  failure={m.savedTopicId ? null : m.scFailure}
                  problems={m.scProblems}
                  disabled={saving}
                  allowMore={!m.savedTopicId}
                  onToggle={m.toggleKeep}
                  onEdit={openStep}
                  onCancel={m.cancelScenario}
                  onRetry={m.retryScenario}
                  onMore={m.requestMore}
                />
              }
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
      <Sheet open={laterOpen} title={PARTIAL.laterTitle} onClose={() => setLaterOpen(false)}>
        <p className="text-[14px] break-keep">{PARTIAL.laterBody(partial?.m ?? 0)}</p>
        <div className="mt-3 flex gap-2 pb-2 [&>*]:min-w-0 [&>*]:flex-1">
          <Btn onClick={m.goToTopic}>{PARTIAL.later}</Btn>
          <Btn variant="ghost" onClick={() => setLaterOpen(false)}>
            {REVIEW.stay}
          </Btn>
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
