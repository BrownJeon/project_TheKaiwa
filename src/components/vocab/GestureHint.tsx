'use client'

/**
 * 제스처·키 힌트 한 줄(screens.md §5-2 B GestureHint). 막힌 동작 안내가 있으면 2초 동안 그 문구로 바뀐다(`role=status`).
 * 화살표는 **손가락이 움직이는 방향**이다 — bjj 원본 문구(`← 이전 · 다음 →`)는 실제 동작과 반대라 옮기지 않았다.
 * 고정 힌트는 스크린리더에 숨긴다(버튼이 같은 기능을 한다).
 */
import type { VocabMode } from '@/types/vocab'

export default function GestureHint({ mode, hint, coarse }: { mode: VocabMode; hint: string | null; coarse: boolean }) {
  const fixed = coarse
    ? '← 밀어 다음 · → 밀어 이전 · ↑ 밀어 표시'
    : mode === 'FLIP'
      ? 'Space 뒤집기 · 1 알았어요 · 2 몰랐어요 · → 다음'
      : '1~4 고르기 · → 다음 · ← 이전 · F 표시'
  return (
    <div className="relative flex h-[18px] flex-none items-center justify-center px-4 text-center text-[12px] leading-[18px]">
      <p role="status" aria-live="polite" className={hint ? 'min-w-0 truncate font-medium text-ink' : 'sr-only'}>
        {hint ?? ''}
      </p>
      {hint ? null : (
        <p aria-hidden="true" className="min-w-0 truncate text-ink2">
          {fixed}
        </p>
      )}
    </div>
  )
}
