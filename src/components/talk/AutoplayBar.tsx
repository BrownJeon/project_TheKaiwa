'use client'

/** 자동재생이 막혔을 때 한 번(screens §9-2 G ③) — 탭 핸들러 안에서 오디오를 깨운 뒤 그 청크부터 재생한다. */
import { AUTOPLAY_COPY } from './talkCopy'

export default function AutoplayBar({ onPlay }: { onPlay: () => void }) {
  return (
    <div role="status">
      <button type="button" onClick={onPlay} className="flex h-12 w-full min-w-0 flex-col items-center justify-center rounded-xl bg-accent-soft px-3 text-ink">
        <span className="max-w-full truncate text-[14px] font-semibold">{AUTOPLAY_COPY.button}</span>
        <span className="max-w-full truncate text-[12px] text-ink2">{AUTOPLAY_COPY.sub}</span>
      </button>
    </div>
  )
}
