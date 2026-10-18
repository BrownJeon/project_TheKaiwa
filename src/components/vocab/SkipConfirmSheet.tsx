'use client'

/**
 * 건너뛰기 확인(task-060 D) — 덱에서 안 푼 카드를 왼쪽으로 밀거나(task-075: 푼 카드의 왼쪽 밀기는 다음 카드) S·화면 읽기 전용 [건너뛰기]를 누르면 연다. [건너뛰기]를 눌러야 #50 `skipped` 를 보낸다.
 * 끝내기 확인(`FinishConfirmSheet`)과 같은 공용 `Sheet`(Esc·바깥 탭·✕ 로 닫기, `aria-modal`, 닫으면 연 요소로 초점 복귀)를 쓴다.
 * 첫 초점은 [취소]다 — 실수로 확정하지 않게. 건너뛴 카드는 다시 풀 수 없으므로 두 버튼에 본문을 설명(`aria-describedby`)으로 이어
 * 초점이 버튼에 바로 떨어져도 화면 읽기가 본문을 읽는다. (`Sheet` 의 `describedBy` 는 쓰지 않는다 — 그 연결은 주제 삭제 확인 시트 한 곳으로
 * 시험이 묶어 두었다, topic/__tests__/removalA11y M-1.)
 * 열려 있는 동안 덱 키는 `sheetOpen` 으로, 제스처는 시트 배경이 막는다. 카드가 바뀌거나 답이 들어오면 덱이 `open` 을 내린다.
 */
import { useEffect, useId, useRef } from 'react'
import Sheet from '@/components/common/Sheet'
import { Btn, BtnRow } from '@/components/common/ui'
import { CARD_FIRST } from './cardFirst'

export default function SkipConfirmSheet({ open, onConfirm, onClose }: { open: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet open={open} title={CARD_FIRST.skipSheet.title} onClose={onClose}>
      {open ? <SkipBody onConfirm={onConfirm} onClose={onClose} /> : null}
    </Sheet>
  )
}

function SkipBody({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  const bodyId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  // `Sheet` 는 열릴 때 제목에 초점을 준다(자식 효과보다 뒤에 돈다) — 그다음 차례에 [취소]로 옮긴다.
  useEffect(() => {
    const t = setTimeout(() => cancelRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <p id={bodyId} className="text-[14px] text-ink2 break-keep">
        {CARD_FIRST.skipSheet.body}
      </p>
      <BtnRow>
        <Btn onClick={onConfirm} aria-describedby={bodyId}>
          {CARD_FIRST.skipSheet.confirm}
        </Btn>
        <button
          ref={cancelRef}
          type="button"
          aria-describedby={bodyId}
          onClick={onClose}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold"
        >
          {CARD_FIRST.skipSheet.cancel}
        </button>
      </BtnRow>
    </>
  )
}
