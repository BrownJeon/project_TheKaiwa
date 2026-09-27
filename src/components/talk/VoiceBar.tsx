'use client'

/**
 * 음성 입력 바(screens §9-2 F) — 상태 줄(h-6, `#talk-status`) + [⌨ 44 · 푸시투토크 72 · ■ 44]. ■ 가 없을 때도 빈 칸을 두어 버튼이 움직이지 않는다.
 * 푸시투토크는 §8 컴포넌트 그대로 — 누름·뗌 순서(barge-in·오디오 깨우기)는 방이 감싼다.
 */
import MicLevelMeter from '@/components/speech/MicLevelMeter'
import PushToTalkButton from '@/components/speech/PushToTalkButton'
import { TALK_ROOM } from './talkCopy'
import type { TalkView } from './talkState'

export const TALK_STATUS_ID = 'talk-status'

function KeyboardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  )
}

export default function VoiceBar({
  view,
  db,
  onPress,
  onRelease,
  onAbort,
  onKeyboard,
  onStop,
}: {
  view: TalkView
  db: number | null
  onPress: () => void
  onRelease: () => void
  onAbort: () => void
  onKeyboard: () => void
  onStop: () => void
}) {
  return (
    <div className="flex-none border-t border-line bg-surface px-4 pt-2" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
      {/* div — 레벨 미터가 div 라 p 안에 둘 수 없다(수화 오류). */}
      <div id={TALK_STATUS_ID} className="flex h-6 min-w-0 items-center justify-center gap-2 text-[13px] text-ink2">
        <MicLevelMeter db={db} active={view.state === 'RECORDING'} />
        <span className="min-w-0 truncate break-keep">{view.statusText}</span>
      </div>
      <div className="mt-1 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center">
        <button
          type="button"
          aria-label={TALK_ROOM.keyboard}
          aria-disabled={view.keyboardDisabled || undefined}
          onClick={onKeyboard}
          className={`grid h-11 w-11 place-items-center rounded-full text-ink2 ${view.keyboardDisabled ? 'opacity-40' : ''}`}
        >
          <KeyboardIcon />
        </button>
        <div className="flex justify-center">
          <PushToTalkButton
            phase={view.ptt.phase}
            disabled={view.ptt.disabled}
            label={view.ptt.label}
            describedBy={TALK_STATUS_ID}
            onPress={onPress}
            onRelease={onRelease}
            onAbort={onAbort}
          />
        </div>
        {view.showStop ? (
          <button type="button" aria-label={TALK_ROOM.stopTeacher} onClick={onStop} className="grid h-11 w-11 place-items-center rounded-full bg-surface2 text-ink">
            <StopIcon />
          </button>
        ) : (
          <span aria-hidden="true" className="h-11 w-11" />
        )}
      </div>
    </div>
  )
}
