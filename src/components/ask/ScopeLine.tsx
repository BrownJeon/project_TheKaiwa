'use client'

/**
 * 입력 바 **아래** 보내는 범위 한 줄(task-066 §26-8 B, D2 A) — 줄 전체가 버튼, 누르면 정보 시트. 확인·저장 없음.
 * 보이는 32 + 위 8(입력 바의 아래 여백 8px 안) + 아래 4 = 터치 44. 그래서 위 입력 바는 `safeBottom={false}`(8px 고정)여야 한다.
 * 제스처 바 여백은 묶음의 맨 아래 요소 하나만 갖는다: 탭 화면은 하단 탭이 갖고(4px), 지난 대화(탭 없음)는 이 줄이 갖는다.
 */
import { ASK_COPY } from './askCopy'

export type ScopeLineVariant = 'tab' | 'room'

export function scopeLinePaddingBottom(variant: ScopeLineVariant): string | number {
  return variant === 'tab' ? 4 : 'max(4px, var(--safe-bottom))'
}

export default function ScopeLine({ variant, onOpen }: { variant: ScopeLineVariant; onOpen?: () => void }) {
  return (
    <div data-kb-docked className="flex-none bg-surface" style={{ paddingBottom: scopeLinePaddingBottom(variant) }}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={ASK_COPY.scopeLine.aria}
        className="relative flex min-h-8 w-full min-w-0 items-center justify-center gap-1.5 px-3 text-[12px] text-ink2 before:absolute before:inset-x-0 before:-top-2 before:-bottom-1 before:content-['']"
      >
        <span aria-hidden="true" className="inline-grid h-[15px] w-[15px] flex-none place-items-center rounded-full border-[1.3px] border-current text-[11px] font-bold">
          i
        </span>
        <span className="min-w-0 truncate">{ASK_COPY.scopeLine.text}</span>
        <span className="flex-none font-semibold text-ink underline underline-offset-[3px]">{ASK_COPY.scopeLine.more}</span>
      </button>
    </div>
  )
}
