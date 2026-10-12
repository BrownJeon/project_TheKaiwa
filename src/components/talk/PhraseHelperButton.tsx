'use client'

/**
 * 일본어 도우미 버튼(screens §22-3, ④B) — 둥근 아이콘만 44px. 말 모드는 입력 바 우측 끝(VoiceBar `trailing`), 글자 모드는 🎤 오른쪽.
 * 말하는 동안(녹음·인식)과 선생님이 답을 만드는 동안(대기·생각)은 흐리게 잠그되 `disabled` 는 쓰지 않는다 — 눌러서 이유(토스트)를 듣게. hover `title` 은 달지 않는다.
 */
import type { Ref } from 'react'
import { HELPER } from './helperCopy'

export const HELPER_PANEL_ID = 'talk-helper'

export default function PhraseHelperButton({
  open,
  locked,
  describedBy,
  buttonRef,
  onToggle,
  onLocked,
}: {
  open: boolean
  locked: boolean
  /** 처음 한 번 안내 말풍선이 보이는 동안 그 id. */
  describedBy?: string
  buttonRef?: Ref<HTMLButtonElement>
  onToggle: () => void
  onLocked: () => void
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={HELPER.button}
      aria-expanded={open}
      aria-controls={open ? HELPER_PANEL_ID : undefined}
      aria-describedby={describedBy}
      aria-disabled={locked || undefined}
      onClick={() => (locked ? onLocked() : onToggle())}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.preventDefault()
          onToggle()
        }
      }}
      className={`grid h-11 w-11 flex-none place-items-center rounded-full border text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        open ? 'border-transparent bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--color-accent)]' : 'border-line bg-surface'
      } ${locked ? 'opacity-40' : ''}`}
    >
      <span aria-hidden="true" className="whitespace-nowrap text-[14px] font-bold leading-none tracking-[-0.5px]">
        가
        <span lang="ja" className="text-accent">
          あ
        </span>
      </span>
    </button>
  )
}
