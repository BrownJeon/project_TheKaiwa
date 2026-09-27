import Link from 'next/link'

/** 점검을 마친 채팅의 한 줄 바(행 전체가 결과 화면 링크). 남은 교정·제안 수를 같이 알린다. */
export default function ReviewDoneBar({ chatId, remaining, pendingProposals }: { chatId: string; remaining: number; pendingProposals: number }) {
  const parts = ['✓ 점검을 마친 채팅이에요']
  if (remaining > 0) parts.push(`남은 교정 ${remaining}`)
  if (pendingProposals > 0) parts.push(`제안 ${pendingProposals}`)
  return (
    <Link
      href={`/study/ai/chat/${encodeURIComponent(chatId)}/review`}
      className="flex h-11 min-w-0 flex-none items-center gap-2 bg-good-soft px-4 text-[13px] font-medium text-good"
    >
      <span className="min-w-0 flex-1 truncate">{parts.join(' · ')}</span>
      <span aria-hidden="true">›</span>
    </Link>
  )
}
