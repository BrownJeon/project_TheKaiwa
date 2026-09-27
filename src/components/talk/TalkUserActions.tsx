'use client'

/** 사용자 말풍선 아래 ▶ 내 목소리(#21b) — 음성으로 보낸 말(발화 id 있음)에만. 404(30일 지남)면 방이 숨긴다. */
import ReplayButton, { type ReplayState } from './ReplayButton'
import { TALK_ROOM } from './talkCopy'

export default function TalkUserActions({
  replay,
  disabled,
  onPlay,
  onStop,
}: {
  replay: ReplayState
  disabled: boolean
  onPlay: () => void
  onStop: () => void
}) {
  return (
    <ReplayButton
      state={replay}
      idleLabel={TALK_ROOM.replayMine}
      ariaLabel={TALK_ROOM.replayMineAria}
      disabled={disabled}
      onClick={replay === 'idle' ? onPlay : onStop}
    />
  )
}
