'use client'

/**
 * 채팅방 머리(screens.md §3-2 C ChatRoomHeader). 표현 점검 버튼은 `disabled` 가 아니라 `aria-disabled` + 토스트로
 * **왜 못 누르는지** 알린다(눌러도 아무 반응 없는 버튼 금지).
 */
import { useRouter } from 'next/navigation'
import BackBar from '@/components/shell/BackBar'

export default function ChatRoomHeader({
  chatId,
  title,
  teacherName,
  reviewed,
  turnBusy,
  userMessageCount,
  onMenu,
  onToast,
}: {
  chatId: string
  title: string
  teacherName: string
  reviewed: boolean
  turnBusy: boolean
  userMessageCount: number
  onMenu: () => void
  onToast: (msg: string) => void
}) {
  const router = useRouter()
  const reviewHref = `/study/ai/chat/${encodeURIComponent(chatId)}/review`
  const blockedReason = reviewed ? null : turnBusy ? '선생님 답을 받은 뒤 점검할 수 있어요' : userMessageCount === 0 ? '먼저 대화를 나눠 보세요' : null

  const reviewButton = (
    <button
      type="button"
      aria-disabled={blockedReason ? true : undefined}
      onClick={() => {
        if (blockedReason) onToast(blockedReason)
        else router.push(reviewHref)
      }}
      className={`relative inline-flex h-[34px] flex-none items-center rounded-xl px-3 text-[13px] font-semibold before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[''] ${
        reviewed ? 'border border-line bg-surface text-ink' : 'bg-surface2 text-ink'
      } ${blockedReason ? 'opacity-50' : ''}`}
    >
      {reviewed ? '점검 결과' : '표현 점검'}
    </button>
  )

  return (
    <BackBar
      backHref="/study/ai?tab=chat"
      backLabel="채팅 목록으로"
      title={title}
      subtitle={`채팅 · ${teacherName}`}
      right={
        <>
          {reviewButton}
          <button type="button" aria-label="채팅 메뉴" onClick={onMenu} className="grid h-11 w-11 flex-none place-items-center rounded-full text-ink">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>
        </>
      }
    />
  )
}
