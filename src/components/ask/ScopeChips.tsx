'use client'

/**
 * 기간 되묻기 칩(task-064 §25-5 C, D5 A) — 칩 = 서버 `needsScope.options`, 끝에 [직접 쓸게요]. 가장 최근 답·턴이 쉬는 중에만 보인다(방이 정한다).
 * 보이는 높이 40, 위아래 투명 확장으로 터치 44.
 */
import type { AskScopeOption } from '@/types/ask'
import { JaRuns } from '@/components/common/japanese/JaRuns'
import { ASK_COPY } from './askCopy'

const CHIP_BASE =
  "relative h-10 min-w-[44px] flex-none rounded-full border bg-surface px-3.5 text-[14px] before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']"
const CHIP = `${CHIP_BASE} border-accent font-semibold text-ink`
const CHIP_OWN = `${CHIP_BASE} border-line font-normal text-ink2`

export default function ScopeChips({
  options,
  onPick,
  onOwn,
}: {
  options: readonly AskScopeOption[]
  onPick: (o: AskScopeOption) => void
  onOwn: () => void
}) {
  return (
    <div role="group" aria-label={ASK_COPY.scopeGroup} className="flex flex-wrap gap-2">
      <span className="w-full text-[12px] text-ink2">{ASK_COPY.scopeCaption}</span>
      {options.map((o) => (
        <button key={o.key} type="button" onClick={() => onPick(o)} className={CHIP}>
          <JaRuns text={o.label} />
        </button>
      ))}
      <button type="button" onClick={onOwn} className={CHIP_OWN}>
        {ASK_COPY.scopeOwn}
      </button>
    </div>
  )
}
