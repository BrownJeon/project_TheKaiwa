'use client'

/**
 * 변형 축 고르기(screens.md §16-2 A `VariantAxes`) — 축마다 `fieldset`+`legend`, 칩은 한 축 안 라디오(`radiogroup`, 화살표 키로 옮겨 다님).
 * 축 이름·칩 라벨은 `types/scenarioVariant.ts` 단일 출처. 기준이 N1 이면 「한 단계 위」는 `aria-disabled` + 이유.
 * 라디오는 칩 안에 둔다(`relative` — 눈에 안 보이는 입력이 멀리 놓여 초점 때 스크롤이 튀지 않게, R1). 고른 칩은 색에 더해 ✓ 글자로 구분한다.
 */
import { SCENARIO_VARIANT_AXIS_KEYS, SCENARIO_VARIANT_AXIS_LABELS, type ScenarioVariantAxes, type ScenarioVariantAxisKey } from '@/types/scenarioVariant'
import type { JlptLevel } from '@/types/lesson'
import { VARIANT } from './scenarioCopy'
import { axisOptions } from './variantLogic'

export default function VariantAxes({
  axes,
  baseLevel,
  onPick,
  locked = false,
}: {
  axes: ScenarioVariantAxes
  baseLevel: JlptLevel
  onPick: (key: ScenarioVariantAxisKey, value: string) => void
  locked?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {SCENARIO_VARIANT_AXIS_KEYS.map((k) => (
        <AxisGroup key={k} axis={k} value={axes[k]} baseLevel={baseLevel} onPick={onPick} locked={locked} />
      ))}
    </div>
  )
}

function AxisGroup({
  axis,
  value,
  baseLevel,
  onPick,
  locked,
}: {
  axis: ScenarioVariantAxisKey
  value: string
  baseLevel: JlptLevel
  onPick: (key: ScenarioVariantAxisKey, value: string) => void
  locked: boolean
}) {
  const opts = axisOptions(axis, baseLevel)
  const topId = `va-${axis}-top`
  const showTop = opts.some((o) => o.disabled)
  return (
    <fieldset role="radiogroup" className="min-w-0" aria-busy={locked || undefined}>
      <legend className="text-[12.5px] font-medium text-ink2">{SCENARIO_VARIANT_AXIS_LABELS[axis].title}</legend>
      <div className="mt-1.5 flex min-w-0 flex-wrap gap-x-2">
        {opts.map((o) => {
          const checked = value === o.value
          const off = o.disabled || locked
          return (
            <label key={o.value} className={`relative inline-flex min-h-11 min-w-0 items-center ${o.disabled ? 'opacity-40' : ''}`}>
              <input
                type="radio"
                name={`va-${axis}`}
                value={o.value}
                checked={checked}
                aria-disabled={off || undefined}
                aria-describedby={o.disabled ? topId : undefined}
                onChange={() => !off && onPick(axis, o.value)}
                className="peer sr-only"
              />
              <span
                className={`rounded-full border px-3.5 py-2 text-[13.5px] leading-tight break-keep peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
                  checked ? 'border-accent bg-accent-soft font-semibold text-ink' : 'border-line bg-surface text-ink'
                }`}
              >
                {checked ? <span aria-hidden="true">✓ </span> : null}
                {o.label}
              </span>
            </label>
          )
        })}
      </div>
      {showTop ? (
        <p id={topId} className="mt-0.5 text-[12px] text-ink2 break-keep">
          {VARIANT.levelTop}
        </p>
      ) : null}
    </fieldset>
  )
}
