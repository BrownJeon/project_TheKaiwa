'use client'

/**
 * 분절 선택(데모의 `.seg`) — 끼니·활동량·목표처럼 **한 줄에 들어가는 소수 선택지**용.
 *
 * 라벨이 길어지는 목록(활동량)에서도 잘리지 않게 각 버튼에 `min-w-0` 을 두고 글자를
 * 줄바꿈 없이 축소한다 — 360px 에서 4칸이 들어가야 한다.
 *
 * ── 보이는 크기(36/32px)와 **누르는 크기(44px)를 분리한다** ──────────────────
 * CLAUDE.md 의 모바일 규칙은 터치 타겟 44px 이상인데 이 알약은 36px(`md`)·32px(`sm`)다.
 * 그렇다고 알약을 44px 로 키우면 **10개 화면의 세로 배치가 전부 밀린다** — 412px 실측에서
 * 이미 첫 화면(≈780px) 경계에 걸친 화면이 여럿이고, 밀리면 "무엇을 고르는지"가 접히는 선
 * 아래로 내려간다. 그래서 **알약은 그대로 두고 `::before` 로 히트영역만** 44px 로 넓힌다
 * (이 코드베이스가 링크 5곳에서 이미 쓴 방법).
 *
 * ⚠️ **세로로만 넓힌다**(`inset-x-0`). 분절 버튼은 **가로로 맞붙어 있어서** 좌우로 넓히면
 *    옆 칸의 클릭을 가로챈다 — 누른 것과 켜지는 것이 달라지는, 눈으로는 못 잡는 버그다.
 *    위아래로 4~6px 씩만 나가므로 이웃 요소(대개 10px 이상 떨어져 있다)와 겹치지 않는다.
 *
 * ── 두 줄 변형(`twoLine`, task-051 §19-4 F-1) ─────────────────────────────────
 * 칸 높이 48px(그 자체로 44px 이상이라 `::before` 가 필요 없다), 위 줄 `label` 13px(6칸 이상이면 12.5px)·아래 줄 `sub` 11px.
 * `sub` 가 없는 칸(「없음」)은 한 줄. 칸이 좁아 이름만으로 뜻이 모자라면 `ariaLabel` 로 읽을 이름을 따로 준다.
 */
export type SegOption<T extends string | number> = { value: T; label: string; sub?: string; ariaLabel?: string }

export default function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  twoLine = false,
  describedBy,
}: {
  options: readonly SegOption<T>[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
  size?: 'md' | 'sm'
  twoLine?: boolean
  /** 분절 바로 아래 도움말 요소의 id. */
  describedBy?: string
}) {
  const labelSize = options.length >= 6 ? 'text-[12.5px]' : 'text-[13px]'
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      className="flex gap-[3px] rounded-xl bg-surface2 p-[3px]"
    >
      {options.map((o) => {
        const on = o.value === value
        const tone = on ? 'bg-surface font-semibold text-ink shadow-sm' : 'font-medium text-ink2'
        if (twoLine) {
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={o.ariaLabel}
              onClick={() => onChange(o.value)}
              className={`flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-px rounded-[9px] px-0.5 ${tone}`}
            >
              <span className={`block max-w-full truncate leading-[1.2] ${labelSize}`}>{o.label}</span>
              {o.sub ? <span className="block max-w-full truncate text-[11px] font-medium leading-[1.2] text-ink2">{o.sub}</span> : null}
            </button>
          )
        }
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.ariaLabel}
            onClick={() => onChange(o.value)}
            className={`relative min-w-0 flex-1 rounded-[9px] px-1 before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[''] ${
              size === 'sm' ? 'h-8 text-xs' : 'h-9 text-[13.5px]'
            } ${tone}`}
          >
            {/* `truncate` 가 **버튼이 아니라 라벨에** 붙는다. 버튼에 붙이면 딸려 오는
                `overflow:hidden` 이 위에서 만든 44px `::before` 를 **36px 로 잘라내** 히트영역이
                그대로 사라진다(헤드리스 실측으로 잡았다 — 마크업만 보면 멀쩡해 보인다). */}
            <span className="block truncate">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
