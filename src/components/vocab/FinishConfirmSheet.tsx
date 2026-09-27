'use client'

/**
 * 끝내기 확인(screens.md §5-2 F) — 오늘 홈 [여기서 끝내기]·덱 [끝내기] 공용.
 * 답한 카드가 0장이면 서버가 기록 없이 닫는다(ABANDONED, F2) — 문구도 "기록 없이 닫혀요"로 알린다.
 */
import Sheet from '@/components/common/Sheet'
import { Btn, BtnRow } from '@/components/common/ui'

export default function FinishConfirmSheet({
  open,
  answered,
  unanswered,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean
  /** 답한 카드 수. 모르면 null(두 경우를 함께 안내) */
  answered: number | null
  unanswered: number
  busy: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}) {
  const none = answered === 0
  const text =
    answered === null
      ? '답하지 않은 카드는 건너뛴 것으로 기록돼요. 답한 카드가 없으면 기록 없이 닫혀요.'
      : none
        ? '아직 답한 카드가 없어요. 지금 그만두면 기록 없이 세트가 닫혀요.'
        : `${unanswered > 0 ? `답하지 않은 ${unanswered}장은 건너뛴 것으로 기록돼요.` : '모든 카드에 답했어요.'} 끝내면 결과가 기록에 남아요.`
  return (
    <Sheet open={open} title={none ? '이 세트를 그만둘까요?' : '여기서 끝낼까요?'} onClose={onClose} dismissible={!busy}>
      <p className="text-[14px] text-ink2 break-keep">{text}</p>
      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-bad break-keep">
          {error}
        </p>
      ) : null}
      <BtnRow>
        <Btn onClick={onConfirm} aria-disabled={busy || undefined} aria-busy={busy || undefined}>
          {busy ? '끝내는 중…' : none ? '그만두기' : '끝내기'}
        </Btn>
        <Btn variant="ghost" onClick={onClose} aria-disabled={busy || undefined}>
          계속 풀기
        </Btn>
      </BtnRow>
    </Sheet>
  )
}
