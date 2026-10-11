'use client'

/**
 * 제스처·키 힌트 한 줄(screens.md §5-2 B GestureHint · task-059 §23-6 C). 막힌 동작 안내·소리 안내가 있으면 그 문구로 바뀐다.
 * 화살표는 **손가락이 움직이는 방향**이다 — bjj 원본 문구(`← 이전 · 다음 →`)는 실제 동작과 반대라 옮기지 않았다.
 * 고정 힌트(`cardFirst.fixedHint`)는 스크린리더에 숨긴다(버튼이 같은 기능을 한다).
 *
 * 라이브 영역은 `role=status`(중립)와 `role=alert`(빨강 — 저장 실패·소리 실패) **두 줄을 늘 마운트**해 두고 글만 바꾼다 —
 * 역할을 바꿔 가며 다시 그리거나 새로 마운트한 라이브 영역은 읽히지 않을 수 있다.
 */
import type { DeckHint } from './cardFirst'

export default function GestureHint({ fixed, message }: { fixed: string; message: DeckHint | null }) {
  const neutral = message?.tone === 'neutral' ? message.text : ''
  const bad = message?.tone === 'bad' ? message.text : ''
  return (
    <div className="relative flex h-[18px] flex-none items-center justify-center px-4 text-center text-[12px] leading-[18px]">
      <p role="status" aria-live="polite" className={neutral ? 'min-w-0 truncate font-medium text-ink' : 'sr-only'}>
        {neutral}
      </p>
      <p role="alert" className={bad ? 'min-w-0 truncate font-semibold text-bad' : 'sr-only'}>
        {bad}
      </p>
      {message ? null : (
        <p aria-hidden="true" className="min-w-0 truncate text-ink2">
          {fixed}
        </p>
      )}
    </div>
  )
}
