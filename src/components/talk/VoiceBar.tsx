'use client'

/**
 * 음성 입력 바(screens §9-2 F) — 상태 줄(h-6, `#talk-status`) + [⌨ 44 · 푸시투토크 72 · ■ 44]. ■ 가 없을 때도 빈 칸을 두어 버튼이 움직이지 않는다.
 * `trailing`(일본어 도우미, §22)이 있으면 도우미가 우측 끝 44 칸을 쓰고 ■ 는 마이크 오른쪽(12px)으로 옮겨 앉는다.
 * 푸시투토크는 §8 컴포넌트 그대로 — 누름·뗌 순서(barge-in·오디오 깨우기)는 방이 감싼다.
 */
import type { ReactNode } from 'react'
import MicLevelMeter from '@/components/speech/MicLevelMeter'
import PushToTalkButton, { type PttCancelOutside } from '@/components/speech/PushToTalkButton'
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
  trailing,
  cancelOutside,
  safeBottom = true,
  keyboardLabel = TALK_ROOM.keyboard,
}: {
  view: TalkView
  db: number | null
  onPress: () => void
  onRelease: () => void
  onAbort: () => void
  onKeyboard: () => void
  onStop: () => void
  /** 바 우측 끝 44 칸(일본어 도우미 버튼, screens §22-2). 넘기면 ■ 가 마이크 오른쪽으로 옮겨 앉는다. 넘기지 않으면 지금 화면·DOM 그대로. */
  trailing?: ReactNode
  /** 질문 탭만(task-066 §26-7 D) — 그대로 누르고 말하기 버튼에 넘긴다. 없으면 지금 동작 그대로. */
  cancelOutside?: PttCancelOutside
  /** 아래 여백에 제스처 여백을 더한다(기본 true = 지금). 하단 탭·범위 줄 위에 놓이는 질문 탭은 false(8px — §26-8 A). */
  safeBottom?: boolean
  /** ⌨ 버튼 이름(기본 「글자로 입력하기」, 질문 탭 「글자로 묻기」) */
  keyboardLabel?: string
}) {
  const ptt = (
    <PushToTalkButton
      phase={view.ptt.phase}
      disabled={view.ptt.disabled}
      label={view.ptt.label}
      describedBy={TALK_STATUS_ID}
      onPress={onPress}
      onRelease={onRelease}
      onAbort={onAbort}
      cancelOutside={cancelOutside}
    />
  )
  const stop = view.showStop ? (
    <button type="button" aria-label={TALK_ROOM.stopTeacher} onClick={onStop} className="grid h-11 w-11 place-items-center rounded-full bg-surface2 text-ink">
      <StopIcon />
    </button>
  ) : null
  return (
    <div className="flex-none border-t border-line bg-surface px-4 pt-2" style={{ paddingBottom: safeBottom ? 'max(8px, env(safe-area-inset-bottom))' : '8px' }}>
      {/* div — 레벨 미터가 div 라 p 안에 둘 수 없다(수화 오류). */}
      <div id={TALK_STATUS_ID} className="flex h-6 min-w-0 items-center justify-center gap-2 text-[13px] text-ink2">
        <MicLevelMeter db={db} active={view.state === 'RECORDING'} />
        <span className="min-w-0 truncate break-keep">{view.statusText}</span>
      </div>
      <div className="mt-1 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center">
        <button
          type="button"
          aria-label={keyboardLabel}
          aria-disabled={view.keyboardDisabled || undefined}
          onClick={onKeyboard}
          className={`grid h-11 w-11 place-items-center rounded-full text-ink2 ${view.keyboardDisabled ? 'opacity-40' : ''}`}
        >
          <KeyboardIcon />
        </button>
        {trailing ? (
          // 가운데 칸을 [빈 1fr · 마이크 72 · 1fr] 로 — 마이크는 그대로 가운데, 오른쪽 1fr 칸 왼쪽 끝에 ■(마이크와 12px). 도우미는 아래 우측 끝 44 칸.
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] items-center">
            <span aria-hidden="true" />
            {ptt}
            {stop ? <div className="ml-3 justify-self-start">{stop}</div> : <span aria-hidden="true" />}
          </div>
        ) : (
          <div className="flex justify-center">{ptt}</div>
        )}
        {trailing ? <div className="justify-self-end">{trailing}</div> : (stop ?? <span aria-hidden="true" className="h-11 w-11" />)}
      </div>
    </div>
  )
}
