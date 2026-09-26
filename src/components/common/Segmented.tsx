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
 */
export type SegOption<T extends string | number> = { value: T; label: string }

export default function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
}: {
  options: readonly SegOption<T>[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
  size?: 'md' | 'sm'
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex gap-[3px] rounded-xl bg-surface2 p-[3px]"
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`relative min-w-0 flex-1 rounded-[9px] px-1 before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[''] ${
              size === 'sm' ? 'h-8 text-xs' : 'h-9 text-[13.5px]'
            } ${on ? 'bg-surface font-semibold text-ink shadow-sm' : 'font-medium text-ink2'}`}
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
