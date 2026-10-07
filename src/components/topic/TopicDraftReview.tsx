'use client'

/**
 * S4 주제 초안 검토(screens.md §16-2 S4 — 데모 v2 `scrReview`): 도착 안내(초점) → 「확인해 볼 곳」 → 주제 정보 → 기본 표현 → 상황 초안(`scenarioSlot`) → 저장 줄.
 * 저장 글자·진행 글은 부르는 쪽이 정한다(「주제와 상황 k개 저장」/「주제만 저장」·「상황 i/k 저장 중…」). 상황 초안을 만드는 중이면(`saveHoldId`) 저장을 막고
 * 누르면 그 자리 카드로 초점을 옮긴다. `locked`(주제는 저장됨 — `partial`)면 맨 위 상태 상자·읽기 전용 주제 칸·[상황 다시 저장] 줄로 바뀐다.
 * 스크롤 규칙: 「확인해 볼 곳」 줄은 고쳐도 사라지지 않고 같은 칸에 「✓ 고쳤어요」를 겹쳐 그려 높이를 지킨다(R2). [다시 만들기] 확인은 버튼 아래로 열린다(R3).
 */
import { useState } from 'react'
import { Btn } from '@/components/common/ui'
import ChunkEditor, { CHUNK_ADD_DOM_ID } from './ChunkEditor'
import { topicProblemDomId, warnLineFixed, type EditableTopicDraft, type WarnLine } from './logic'
import TopicInfoFields from './TopicInfoFields'
import { PARTIAL, REVIEW } from './topicCopy'

export const SAVE_MESSAGE_DOM_ID = 'tp-save-msg'
const REGEN_DOM_ID = 'tp-regen'

export default function TopicDraftReview({
  draft,
  setDraft,
  errors,
  problemCount,
  warnLines,
  arrivalTitle,
  saving,
  saveMessage,
  noteRef,
  onSave,
  onRegen,
  onDiscard,
  scenarioSlot,
  saveLabel = REVIEW.saveTopicOnly,
  saveNote = null,
  savingText = REVIEW.saving,
  saveHoldId = null,
  locked = null,
}: {
  draft: EditableTopicDraft
  setDraft: (fn: (d: EditableTopicDraft) => EditableTopicDraft) => void
  errors: Record<string, string>
  problemCount: number
  warnLines: WarnLine[]
  arrivalTitle: string
  saving: boolean
  saveMessage: { text: string; block: boolean } | null
  noteRef: React.RefObject<HTMLHeadingElement | null>
  onSave: () => void
  onRegen: () => void
  onDiscard: () => void
  /** T5-3b 「상황 초안」 절 자리(기본 표현과 저장 줄 사이). */
  scenarioSlot?: React.ReactNode
  saveLabel?: string
  /** 버튼 아래 한 줄(상황을 함께 저장할 때 「주제를 먼저 저장하고…」). */
  saveNote?: string | null
  savingText?: string
  /** 상황 초안을 만드는 중 — 저장을 막고 이 id(자리 카드)를 이유로 잇는다. */
  saveHoldId?: string | null
  /** 주제는 저장됨(`partial`): 맨 위 상자와 저장 줄 대신 쓸 행동 줄. */
  locked?: { top: React.ReactNode; actions: React.ReactNode } | null
}) {
  const [regenAsk, setRegenAsk] = useState(false)
  const blocked = saving || !!saveMessage?.block || !!saveHoldId
  const goTo = (target: WarnLine['target']) => document.getElementById(target === 'chunks' ? CHUNK_ADD_DOM_ID : topicProblemDomId(target))?.focus()
  const fieldsOff = saving || !!locked
  return (
    <>
      {locked ? locked.top : null}
      <div role="note" hidden={!!locked} className="rounded-[14px] bg-accent-soft p-3.5">
        <h2 ref={noteRef} tabIndex={-1} className="text-[14px] font-semibold outline-none">
          {REVIEW.arrivedTitle}
        </h2>
        <p className="mt-1 text-[13px] text-ink break-keep">{REVIEW.arrivedBody}</p>
      </div>

      {warnLines.length && !locked ? (
        <div role="note" aria-labelledby="tp-wl-h" className="rounded-[14px] border border-line bg-surface p-3.5">
          <p id="tp-wl-h" className="text-[13px] font-semibold break-keep">
            {REVIEW.checkHead(warnLines.length)}
          </p>
          <div className="mt-1 flex flex-col">
            {warnLines.map((w) => {
              const fixed = warnLineFixed(w, draft, arrivalTitle)
              return (
                <button
                  key={w.code}
                  type="button"
                  onClick={() => goTo(w.target)}
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

      {locked ? <p className="rounded-xl bg-surface2 px-3.5 py-3 text-[13px] text-ink break-keep">{PARTIAL.topicLocked}</p> : null}
      <TopicInfoFields value={draft} errors={errors} disabled={fieldsOff} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
      <ChunkEditor chunks={draft.chunks} errors={errors} disabled={fieldsOff} onChange={(fn) => setDraft((d) => ({ ...d, chunks: fn(d.chunks) }))} />

      {scenarioSlot ?? null}

      <div className="flex min-w-0 flex-col gap-2">
        {problemCount ? (
          <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-[13px] font-semibold text-bad">
            {REVIEW.problemsHead(problemCount)}
          </p>
        ) : null}
        {locked ? locked.actions : null}
        {saveMessage && !locked ? (
          <p id={SAVE_MESSAGE_DOM_ID} role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-[13px] text-bad break-keep">
            {saveMessage.text}
          </p>
        ) : null}
        <Btn
          hidden={!!locked}
          className={`w-full ${blocked && !saving ? 'opacity-40' : ''}`}
          aria-busy={saving || undefined}
          aria-disabled={blocked || undefined}
          aria-describedby={saveMessage?.block ? SAVE_MESSAGE_DOM_ID : saveHoldId && !saving ? saveHoldId : undefined}
          onClick={() => {
            if (saveHoldId && !saving) document.getElementById(saveHoldId)?.focus()
            else if (!blocked) onSave()
          }}
        >
          {saving ? savingText : saveLabel}
        </Btn>
        {saveNote && !locked ? <p className="text-center text-[12px] text-ink2 break-keep">{saveNote}</p> : null}
        <Btn id={REGEN_DOM_ID} hidden={!!locked} variant="ghost" className="w-full" aria-disabled={saving || undefined} aria-expanded={regenAsk} onClick={() => !saving && setRegenAsk((v) => !v)}>
          {REVIEW.regen}
        </Btn>
        {regenAsk && !locked ? (
          <div className="rounded-xl bg-surface2 p-3">
            <p className="text-[13px] break-keep">{REVIEW.regenAsk}</p>
            <div className="mt-2 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
              <Btn
                size="sm"
                className="min-h-11"
                onClick={() => {
                  setRegenAsk(false)
                  onRegen()
                }}
              >
                {REVIEW.regenYes}
              </Btn>
              <Btn
                size="sm"
                variant="ghost"
                className="min-h-11"
                onClick={() => {
                  setRegenAsk(false)
                  document.getElementById(REGEN_DOM_ID)?.focus()
                }}
              >
                {REVIEW.cancel}
              </Btn>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          hidden={!!locked}
          aria-disabled={saving || undefined}
          onClick={() => !saving && onDiscard()}
          className="mx-auto inline-flex min-h-11 items-center px-2 text-[14px] font-semibold text-bad underline underline-offset-[3px]"
        >
          {REVIEW.discard}
        </button>
      </div>
    </>
  )
}
