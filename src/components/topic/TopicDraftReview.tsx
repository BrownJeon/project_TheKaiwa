'use client'

/**
 * S4 주제 초안 검토(screens.md §16-2 S4 — 데모 v2 `scrReview`): 도착 안내(초점) → 「확인해 볼 곳」 → 주제 정보 → 기본 표현 → (상황 초안 자리) → 저장 줄.
 * `scenarioSlot` 은 T5-3b 의 「상황 초안」 절이 들어올 자리다 — 없으면 아무것도 그리지 않는다. 이번 저장 버튼은 「주제만 저장」(#57) 하나.
 * 스크롤 규칙: 「확인해 볼 곳」 줄은 고쳐도 사라지지 않고 같은 칸에 「✓ 고쳤어요」를 겹쳐 그려 높이를 지킨다(R2). [다시 만들기] 확인은 버튼 아래로 열린다(R3).
 */
import { useState } from 'react'
import { Btn } from '@/components/common/ui'
import ChunkEditor, { CHUNK_ADD_DOM_ID } from './ChunkEditor'
import { topicProblemDomId, warnLineFixed, type EditableTopicDraft, type WarnLine } from './logic'
import TopicInfoFields from './TopicInfoFields'
import { REVIEW } from './topicCopy'

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
}) {
  const [regenAsk, setRegenAsk] = useState(false)
  const blocked = saving || !!saveMessage?.block
  const goTo = (target: WarnLine['target']) => document.getElementById(target === 'chunks' ? CHUNK_ADD_DOM_ID : topicProblemDomId(target))?.focus()
  return (
    <>
      <div role="note" className="rounded-[14px] bg-accent-soft p-3.5">
        <h2 ref={noteRef} tabIndex={-1} className="text-[14px] font-semibold outline-none">
          {REVIEW.arrivedTitle}
        </h2>
        <p className="mt-1 text-[13px] text-ink break-keep">{REVIEW.arrivedBody}</p>
      </div>

      {warnLines.length ? (
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

      <TopicInfoFields value={draft} errors={errors} disabled={saving} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
      <ChunkEditor chunks={draft.chunks} errors={errors} disabled={saving} onChange={(fn) => setDraft((d) => ({ ...d, chunks: fn(d.chunks) }))} />

      {scenarioSlot ?? null}

      <div className="flex min-w-0 flex-col gap-2">
        {problemCount ? (
          <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-[13px] font-semibold text-bad">
            {REVIEW.problemsHead(problemCount)}
          </p>
        ) : null}
        {saveMessage ? (
          <p id={SAVE_MESSAGE_DOM_ID} role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-[13px] text-bad break-keep">
            {saveMessage.text}
          </p>
        ) : null}
        <Btn
          className={`w-full ${blocked && !saving ? 'opacity-40' : ''}`}
          aria-busy={saving || undefined}
          aria-disabled={blocked || undefined}
          aria-describedby={saveMessage?.block ? SAVE_MESSAGE_DOM_ID : undefined}
          onClick={() => !blocked && onSave()}
        >
          {saving ? REVIEW.saving : REVIEW.saveTopicOnly}
        </Btn>
        <Btn id={REGEN_DOM_ID} variant="ghost" className="w-full" aria-disabled={saving || undefined} aria-expanded={regenAsk} onClick={() => !saving && setRegenAsk((v) => !v)}>
          {REVIEW.regen}
        </Btn>
        {regenAsk ? (
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
