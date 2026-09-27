/** 말하는 중 막대 3개(12px, `bg-accent`) — 장식이라 `aria-hidden`, 움직임은 `motion-safe` 에서만. "말하는 중" 글자가 늘 옆에 있다. */
export default function SpeakingBars() {
  return (
    <span aria-hidden="true" className="inline-flex h-3 flex-none items-end gap-[2px]">
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="h-3 w-[3px] origin-bottom rounded-sm bg-accent motion-safe:animate-pulse" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  )
}
