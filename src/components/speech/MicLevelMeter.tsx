'use client'

/** 입력 레벨 5칸(docs/screens.md §8-2 D) — 기준 dBFS −50/−40/−32/−25/−18. 녹음 중에만 보이고 자리는 항상 차지한다(카드 높이 고정). */
const STEPS = [
  { db: -50, h: 'h-2' },
  { db: -40, h: 'h-3' },
  { db: -32, h: 'h-4' },
  { db: -25, h: 'h-5' },
  { db: -18, h: 'h-6' },
] as const

export default function MicLevelMeter({ db, active }: { db: number | null; active: boolean }) {
  return (
    <div aria-hidden className={`flex h-6 items-end gap-[3px] ${active ? 'visible' : 'invisible'}`}>
      {STEPS.map((s) => (
        <span key={s.db} className={`w-1 rounded-sm ${s.h} ${db !== null && db >= s.db ? 'bg-accent' : 'bg-line'}`} />
      ))}
    </div>
  )
}
