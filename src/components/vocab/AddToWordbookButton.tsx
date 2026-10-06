'use client'

/**
 * 주제 세트 결과의 [단어장에 넣기](task-044 가이드 §3-8·E7, 설계서 N1 A) — 사용자가 누를 때만 #41 로 바로 저장(예문·품사 없이).
 * 결과 화면이 열릴 때는 아무것도 저장하지 않는다. 넣은 카드만 "✓ 넣었어요", 같은 표기가 이미 있으면(409) "단어장에 있어요".
 */
import { Btn } from '@/components/common/ui'
import { ADD } from './topicCopy'

export type AddState = 'idle' | 'busy' | 'added' | 'exists'

export default function AddToWordbookButton({ surface, state, onAdd }: { surface: string; state: AddState; onAdd: () => void }) {
  if (state === 'added')
    return (
      <span role="status" className="flex-none text-[13px] font-semibold text-good">
        {ADD.added}
      </span>
    )
  if (state === 'exists')
    return (
      <span role="status" className="flex-none text-[13px] text-ink2">
        {ADD.exists}
      </span>
    )
  const busy = state === 'busy'
  return (
    <Btn
      variant="ghost"
      className="!h-11 flex-none !px-3 !text-[13px]"
      aria-label={ADD.aria(surface)}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      onClick={() => {
        if (!busy) onAdd()
      }}
    >
      {busy ? ADD.busy : ADD.add}
    </Btn>
  )
}
