'use client'

/**
 * 주제 고치기 `/settings/scenarios/topics/[id]/edit`(task-045 T5-4 — screens.md §16-2 S7). BackBar 52(sticky) + 앱 셸 `main` 한 곳 스크롤.
 * S4 의 `TopicInfoFields`·`ChunkEditor` 를 그대로 쓴다(표현 행은 서버 id 를 들고 있다). 기본 주제면 안내 + 「내 버전으로 저장」.
 * ← 는 고친 값이 있으면 나가기 시트(이 탭에 남기지 않는다), 저장 중에는 막는다(`backDisabled`). 안드로이드 뒤로는 막지 않는다(§16-0 #7).
 * 초점은 한 곳씩만 옮긴다: 저장 검사 실패 → 첫 문제 · 다른 화면이 먼저 내 버전을 만듦 → 그 상자 · 수준 바꿈 상자 안 버튼이 숨으면 같은 상자의 다음 버튼 ·
 * 표현을 받거나 「지금 표현 두기」 → 고른 수준 칩. 스크롤 호출은 없다(초점이 그 요소를 화면에 보이게 한다 — R1·R5).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import Sheet from '@/components/common/Sheet'
import { Btn } from '@/components/common/ui'
import { BtnLink, ErrorBox, InfoBox, Skeleton } from '@/components/challenge/parts'
import BackBar from '@/components/shell/BackBar'
import ChunkEditor, { CHUNK_ADD_DOM_ID } from './ChunkEditor'
import LevelRegenBox, { LVL_CANCEL_DOM_ID, LVL_REGEN_DOM_ID, LVL_RETRY_DOM_ID } from './LevelRegenBox'
import { chunkKeyOfProblem, chunkRowDomId, editBackAction, MANAGE_HREF, topicEditLocked, topicHref, topicProblemDomId, warnLineFixed, type TopicProblem } from './logic'
import TopicInfoFields from './TopicInfoFields'
import { EDIT, MANAGE, REVIEW, TOPIC } from './topicCopy'
import { useTopicEdit, type EditFocus } from './useTopicEdit'

const COPIED_DOM_ID = 'tp-edit-copied'
const SAVE_MSG_DOM_ID = 'tp-edit-msg'

/** 첫 문제로 초점 — 표현 칸이 접혀 있으면 그 행의 ⋯ 버튼. */
function focusProblem(p: TopicProblem | undefined) {
  if (!p) return
  const k = chunkKeyOfProblem(p.key)
  const el = document.getElementById(topicProblemDomId(p.key)) ?? (k ? document.getElementById(chunkRowDomId(k)) : null)
  el?.focus()
}

function focusTarget(to: EditFocus['to'], problems: TopicProblem[]) {
  if (to === 'problem') return focusProblem(problems[0])
  if (to === 'copied') return document.getElementById(COPIED_DOM_ID)?.focus()
  if (to === 'regenBusy') return document.getElementById(LVL_CANCEL_DOM_ID)?.focus()
  if (to === 'regenFail') return document.getElementById(LVL_RETRY_DOM_ID)?.focus()
  if (to === 'regenPrompt') return document.getElementById(LVL_REGEN_DOM_ID)?.focus()
  const chip = document.getElementById(topicProblemDomId('level'))?.querySelector<HTMLElement>('[aria-checked="true"]')
  chip?.focus()
}

export default function TopicEditScreen({ id }: { id: string }) {
  const m = useTopicEdit(id)
  const [leaveOpen, setLeaveOpen] = useState(false)
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
    requestAnimationFrame(() => focusTarget(to, problemsRef.current))
  }, [m.focus])

  const onBack = () => {
    // 저장 중에는 ← 가 막힌다(REV-166 L-D, S4 와 같은 방식) — 나가면 저장 응답을 놓친 채 다른 화면에 서게 된다.
    const act = editBackAction(m.edited, m.saving)
    if (act === 'ignore') return
    if (act === 'ask') setLeaveOpen(true)
    else m.leave()
  }

  const seed = m.origin === 'SEED'
  const draft = m.draft
  const regenBusy = m.regenFlight.busy
  const blocked = m.saving || m.copied || regenBusy || !!m.saveMessage?.block
  // 받는 중에는 이름·수준·설명·표현 편집도 잠근다(REV-163 M-1) — 받은 표현이 요청 시점 이름·수준 기준이라서. [그만두기] 상자는 잠기지 않는다.
  const locked = topicEditLocked({ saving: m.saving, regenBusy })

  return (
    <>
      <BackBar sticky backHref={topicHref(id)} backLabel={m.origTitle || TOPIC.back} title={EDIT.title} onBack={m.status === 'ready' ? onBack : undefined} backDisabled={m.saving} />
      <div className="mx-auto min-w-0 max-w-[520px] px-4 pb-8 pt-3.5">
        {m.status === 'loading' ? <Skeleton heights={[96, 300, 240]} label={TOPIC.loading} /> : null}
        {m.status === 'error' ? <ErrorBox title={MANAGE.loadFail} body={MANAGE.loadFailBody} retryLabel={MANAGE.retry} onRetry={m.reload} /> : null}
        {m.status === 'notFound' ? <NotFound /> : null}
        {m.status === 'ready' && draft ? (
          <div className="flex min-w-0 flex-col gap-[18px]">
            {seed ? <InfoBox>{EDIT.seedInfo}</InfoBox> : null}

            <TopicInfoFields
              value={draft}
              errors={errors}
              disabled={locked}
              onChange={(patch) => m.setDraft((d) => ({ ...d, ...patch }))}
              levelSlot={
                m.regenPrompt ? (
                  <LevelRegenBox
                    from={m.regenPrompt.from}
                    to={m.regenPrompt.to}
                    busy={regenBusy}
                    cancelable={m.regenFlight.cancelable}
                    long={m.regenFlight.long}
                    failure={m.regenFailure}
                    onRegen={m.regen}
                    onKeep={m.keepChunks}
                    onCancel={m.cancelRegen}
                  />
                ) : null
              }
            />

            {m.regenWarn.length ? (
              <div role="note" aria-labelledby="tp-ew-h" className="rounded-[14px] border border-line bg-surface p-3.5">
                <p id="tp-ew-h" className="text-[13px] font-semibold break-keep">
                  {REVIEW.checkHead(m.regenWarn.length)}
                </p>
                <div className="mt-1 flex flex-col">
                  {m.regenWarn.map((w) => {
                    const fixed = warnLineFixed(w, draft, draft.title)
                    return (
                      <button
                        key={w.code}
                        type="button"
                        onClick={() => document.getElementById(CHUNK_ADD_DOM_ID)?.focus()}
                        className="grid min-h-11 w-full min-w-0 items-center py-1.5 text-left text-[13px] [&>*]:col-start-1 [&>*]:row-start-1"
                      >
                        <span className={`break-keep ${fixed ? 'invisible' : 'text-ink'}`}>{w.text}</span>
                        <span className={`font-semibold ${fixed ? 'text-ink2' : 'invisible'}`}>{REVIEW.fixed}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            <ChunkEditor chunks={draft.chunks} errors={errors} disabled={locked} origTexts={m.origTexts} onChange={(fn) => m.setDraft((d) => ({ ...d, chunks: fn(d.chunks) }))} />

            <div className="flex min-w-0 flex-col gap-2">
              {m.problems.length ? (
                <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-[13px] font-semibold text-bad">
                  {REVIEW.problemsHead(m.problems.length)}
                </p>
              ) : null}
              {m.copied ? (
                <div id={COPIED_DOM_ID} tabIndex={-1} role="alert" className="rounded-xl bg-bad-soft px-3.5 py-3 text-[13px] text-bad outline-none">
                  <p className="break-keep">{EDIT.copied}</p>
                  <Btn size="sm" className="mt-2.5 min-h-11 w-full" aria-busy={m.openingCopy || undefined} aria-disabled={m.openingCopy || undefined} onClick={m.openCopy}>
                    {EDIT.openCopy}
                  </Btn>
                </div>
              ) : null}
              {m.saveMessage ? (
                <p id={SAVE_MSG_DOM_ID} role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-[13px] text-bad break-keep">
                  {m.saveMessage.text}
                </p>
              ) : null}
              <Btn
                className={`w-full ${blocked && !m.saving ? 'opacity-40' : ''}`}
                aria-busy={m.saving || undefined}
                aria-disabled={blocked || undefined}
                aria-describedby={m.saveMessage?.block ? SAVE_MSG_DOM_ID : m.copied ? COPIED_DOM_ID : undefined}
                onClick={() => !blocked && m.save()}
              >
                {m.saving ? REVIEW.saving : seed ? EDIT.saveSeed : EDIT.save}
              </Btn>
            </div>
          </div>
        ) : null}
      </div>

      <Sheet open={leaveOpen} title={REVIEW.leaveTitle} onClose={() => setLeaveOpen(false)}>
        <p className="text-[14px] break-keep">{EDIT.leaveBody}</p>
        <div className="mt-3 flex gap-2 pb-2 [&>*]:min-w-0 [&>*]:flex-1">
          <Btn variant="ghost" onClick={m.leave}>
            {REVIEW.leave}
          </Btn>
          <Btn onClick={() => setLeaveOpen(false)}>{REVIEW.stay}</Btn>
        </div>
      </Sheet>
    </>
  )
}

function NotFound() {
  return (
    <div className="mt-3 rounded-[14px] border border-line bg-surface px-4 py-5 text-center">
      <p className="text-[15px] font-semibold break-keep">{TOPIC.notFound}</p>
      <p className="mt-1 text-[13px] text-ink2 break-keep">{TOPIC.notFoundBody}</p>
      <div className="mt-4 flex">
        <BtnLink href={MANAGE_HREF} replace>
          {TOPIC.notFoundBtn}
        </BtnLink>
      </div>
    </div>
  )
}
