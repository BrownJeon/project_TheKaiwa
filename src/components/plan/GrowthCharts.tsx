'use client'

/**
 * 성장 탭 그림(task-080, screens.md §36-11) — 그림만 그린다(`aria-hidden`). 뜻은 부르는 쪽이 글·표로 따로 준다(색만으로 알리지 않는다).
 * 글자 크기는 CSS px(`style.fontSize`)로 준다 — 앱 글꼴 배율을 따르게. 레이더 라벨 여백은 앱이 배율을 모르므로 130% 기준(84px)으로 고정(36-17 ⑨).
 */
import { useLayoutEffect, useState } from 'react'
import { DIM_NAME, DIM_ORDER } from '@/components/eval/evalCopy'

/**
 * 상자 안 너비(px, 내림) — 재기 전엔 null. 돌려주는 콜백을 상자의 `ref` 로 단다(상자가 조건부로 생겨도 새 요소를 잰다).
 * ResizeObserver 첫 알림으로 재고, 폭이 바뀌면 다시 잰다.
 */
export function useMeasuredWidth(): [(el: HTMLElement | null) => void, number | null] {
  const [el, setEl] = useState<HTMLElement | null>(null)
  const [w, setW] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const next = Math.floor(entries[0]?.contentRect.width ?? 0)
      setW((prev) => (prev === next || next <= 0 ? prev : next))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return [setEl, el ? w : null]
}

const ANG = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / 5

/** 레이더 크기 — 높이 = 너비 × 0.86, 반지름 = min(W/2 − 84, H/2 − 30). */
export function radarGeometry(size: number) {
  const W = size
  const H = Math.round(size * 0.86)
  return { W, H, cx: W / 2, cy: H / 2 + 6, R: Math.max(10, Math.min(W / 2 - 84, H / 2 - 30)) }
}

/** 5축 레이더. `series` 의 `main` = 최근(채움 + 점), 그 밖 = 이 기간 처음(회색 선). 값은 0~5. */
export function RadarChart({ size, series }: { size: number; series: { values: number[]; main: boolean }[] }) {
  const { W, H, cx, cy, R } = radarGeometry(size)
  const pt = (i: number, v: number) => [cx + Math.cos(ANG(i)) * ((R * v) / 5), cy + Math.sin(ANG(i)) * ((R * v) / 5)] as const
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).map((x) => x.toFixed(1)).join(',')).join(' ')
  // 회색(처음)을 먼저 그리고 최근을 위에.
  const ordered = [...series].sort((a, b) => Number(a.main) - Number(b.main))
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="mx-auto block">
      {[1, 2, 3, 4, 5].map((k) => (
        <polygon key={k} points={poly([k, k, k, k, k])} fill="none" stroke="var(--color-line)" strokeWidth={1} />
      ))}
      {DIM_ORDER.map((_, i) => {
        const p = pt(i, 5)
        return <line key={i} x1={cx} y1={cy} x2={p[0].toFixed(1)} y2={p[1].toFixed(1)} stroke="var(--color-line)" strokeWidth={1} />
      })}
      {ordered.map((s, si) =>
        s.main ? (
          <g key={si}>
            <polygon points={poly(s.values)} fill="var(--color-protein)" fillOpacity={0.12} stroke="var(--color-protein)" strokeWidth={2} strokeLinejoin="round" />
            {s.values.map((v, i) => {
              const p = pt(i, v)
              return <circle key={i} cx={p[0].toFixed(1)} cy={p[1].toFixed(1)} r={4} fill="var(--color-protein)" stroke="var(--color-surface)" strokeWidth={2} />
            })}
          </g>
        ) : (
          <polygon key={si} points={poly(s.values)} fill="none" stroke="var(--color-ink2)" strokeWidth={1.5} strokeLinejoin="round" />
        ),
      )}
      {DIM_ORDER.map((d, i) => {
        const x = cx + Math.cos(ANG(i)) * (R + 14)
        const y = cy + Math.sin(ANG(i)) * (R + 14)
        const anchor = Math.abs(x - cx) < 6 ? 'middle' : x > cx ? 'start' : 'end'
        const dy = i === 0 ? -4 : i === 2 || i === 3 ? 12 : 4
        return (
          <text key={d} x={x.toFixed(1)} y={(y + dy).toFixed(1)} textAnchor={anchor} fill="var(--color-ink)" style={{ fontSize: 12 }}>
            {DIM_NAME[d]}
          </text>
        )
      })}
    </svg>
  )
}

/** 작은 추이선 64×22 — 끝 점 강조. 점이 4개 미만이면 그리지 않는다(부르는 쪽이 `showSpark` 로 먼저 고른다). */
export function Sparkline({ points }: { points: number[] }) {
  if (points.length < 4) return null
  const w = 64
  const h = 22
  const mn = Math.min(...points)
  const mx = Math.max(...points)
  const rg = Math.max(0.08, mx - mn)
  const xy = points.map((p, i) => [2 + ((w - 6) * i) / (points.length - 1), 3 + (h - 6) * (1 - (p - mn) / rg)] as const)
  const last = xy[xy.length - 1]
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="flex-none">
      <polyline
        points={xy.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}
        fill="none"
        stroke="var(--color-protein)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r={3.5} fill="var(--color-protein)" stroke="var(--color-surface)" strokeWidth={2} />
    </svg>
  )
}
