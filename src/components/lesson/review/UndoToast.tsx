'use client'

/**
 * 되돌리기 토스트(screens §14-2 C · 데모 `#rv-skip`) — 공용 `Toast` 는 `pointer-events-none` 이라 버튼을 달 수 없어 따로 둔다.
 * 자리는 공용 토스트와 같다(탭 바·safe-area·키보드 위). 카운트다운 숫자·나타남 애니메이션은 없다(움직임 줄이기 설정과 무관하게 같다).
 */
import type { RefObject } from 'react'

export default function UndoToast({
  open,
  message,
  actionLabel,
  onAction,
  actionRef,
}: {
  open: boolean
  message: string
  actionLabel: string
  onAction: () => void
  actionRef?: RefObject<HTMLButtonElement | null>
}) {
  // 알림 영역(`role=status`)은 닫혀 있어도 같은 노드로 붙여 둔다 — 토스트와 함께 새로 붙으면 일부 스크린리더가 첫 문구를 읽지 않는다.
  // 닫힘 상태는 `sr-only`(1px·clip·absolute)라 레이아웃·포인터에 영향이 없고 문구도 비어 있다.
  return (
    <div
      className={open ? 'fixed right-4 left-4 z-50 flex items-center justify-between gap-2 rounded-xl bg-ink py-0.5 pr-1 pl-3.5 text-surface shadow-lg' : 'pointer-events-none sr-only'}
      style={open ? { bottom: 'calc(84px + var(--safe-bottom) + var(--kb-inset, 0px))' } : undefined}
    >
      <p role="status" aria-live="polite" className="min-w-0 text-[13.5px]">
        {open ? message : ''}
      </p>
      {open ? (
        <button
          ref={actionRef}
          type="button"
          onClick={onAction}
          className="min-h-11 flex-none px-3 text-[14px] font-bold text-surface underline underline-offset-[3px] focus-visible:outline-surface"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
