'use client'

/**
 * 카드 스택 제스처(screens.md §5-2 C) — 출처 `bjj-trainning/web/src/components/SwipeCardDeck.jsx`.
 *
 * 그대로 옮긴 것: 시작 좌표·진행 여부는 ref(이벤트 핸들러의 stale closure 방지), 판정 순서 탭(<10) → 위(dy<−80) → 좌우(|dx|>60),
 * 3장 스택 transform, 드래그 중 transition 없음, 영역 폭 80%·`touch-action:none`, `touchend` 에서 `preventDefault`
 * (호환 mouse/click 이 **뒤집기 직후 새로 생긴 [알았어요] 버튼**에 떨어지는 유령 클릭을 막는다), 마우스 mouseleave 로 끝냄.
 * 바꾼 것: 위 = 뜻 보기(task-060, 옛 표시 토글 — 카드는 넘어가지 않고, 부모가 실제로 뜻을 열었을 때만 튀었다 돌아옴),
 * 좌우 = 손가락이 간 쪽(`'left' | 'right'`)만 부모(`onSwipe`)에 넘긴다 — 어느 쪽이 무슨 일인지(왼쪽 = 푼 카드는 다음·안 푼 카드는 건너뛰기 확인,
 * 오른쪽 = 이전 카드, task-075 가 task-070 의 지도를 맞바꿈)는 `cardFirst.swipeAction` 한 곳에만 있고 여기서는 모른다.
 * 막힌 방향은 ×0.25 저항(`canSwipe(side)`), 다음 카드로 넘어가는 카드는 왼쪽으로 날아간다(`FLY_OUT_TRANSFORM` — 손가락 방향과 같게),
 * 두 손가락·touchcancel 은 동작 없이 원위치, reduced-motion 은 회전·날아가기 없음.
 * 방향 판정·저항은 `deck.ts` 의 순수 함수(`classifyGesture`·`resistX`)가 한다.
 *
 * 이 영역 안에는 버튼을 두지 않는다 — `touchend preventDefault` 가 영역 안의 click 을 죽인다(§5-0 4).
 * React 의 onTouchStart/Move 는 passive 라 거기서는 preventDefault 하지 않는다(스크롤은 touch-action 이 막는다).
 */
import { useEffect, useRef, useState } from 'react'
import { classifyGesture, FLY_OUT_TRANSFORM, resistX, type SwipeSide } from './deck'

const BUMP_MS = 90

export default function SwipeCardStack({
  count,
  view,
  renderTop,
  canSwipe,
  locked,
  exiting,
  reducedMotion,
  onTap,
  onUp,
  onSwipe,
}: {
  count: number
  view: number
  renderTop: () => React.ReactNode
  /** 그쪽으로 끌 수 있는가 — 아니면 ×0.25 저항(왼쪽 = 다음·건너뛰기 확인을 할 수 있을 때, 오른쪽 = 이전 카드가 있을 때) */
  canSwipe: (side: SwipeSide) => boolean
  /** 넘기는 중·답 응답 대기 중에는 드래그를 시작하지 않는다 */
  locked: boolean
  /** 부모가 다음 카드로 넘기는 중(카드가 왼쪽으로 날아간다 — 트리거가 제스처·버튼·키 어느 것이든 같다) */
  exiting: boolean
  reducedMotion: boolean
  onTap: () => void
  /** 위로 밀기. 카드가 실제로 반응했으면(뜻이 열렸으면) true — 그때만 튄다(처리 못 한 밀기에 튀면 된 것처럼 보인다). */
  onUp: () => boolean
  /** 손가락이 간 쪽. 그 쪽이 무슨 일을 하는지는 부모(`cardFirst.swipeAction`)가 정한다. */
  onSwipe: (side: SwipeSide) => void
}) {
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false })
  const [bump, setBump] = useState(false)
  const startRef = useRef({ x: 0, y: 0 })
  const activeRef = useRef(false)
  const topRef = useRef<HTMLDivElement>(null)
  const firstView = useRef(true)
  const bumpTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (bumpTimer.current) clearTimeout(bumpTimer.current)
  }, [])

  // 새 카드는 투명에서 나타난다(이전 카드로 돌아갈 때도 같은 전환). 첫 카드는 그대로.
  useEffect(() => {
    if (firstView.current) {
      firstView.current = false
      return
    }
    topRef.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'ease-out' })
  }, [view])

  const cancel = () => {
    activeRef.current = false
    setDrag({ x: 0, y: 0, active: false })
  }

  const dragStart = (x: number, y: number) => {
    if (locked || exiting) return
    startRef.current = { x, y }
    activeRef.current = true
    setDrag({ x: 0, y: 0, active: true })
  }

  const dragMove = (x: number, y: number) => {
    if (!activeRef.current) return
    setDrag({ x: x - startRef.current.x, y: y - startRef.current.y, active: true })
  }

  const dragEnd = (x: number, y: number) => {
    if (!activeRef.current) return
    activeRef.current = false
    const g = classifyGesture(x - startRef.current.x, y - startRef.current.y)
    setDrag({ x: 0, y: 0, active: false })
    if (g === 'tap') onTap()
    else if (g === 'up') {
      if (onUp() && !reducedMotion) {
        setBump(true)
        if (bumpTimer.current) clearTimeout(bumpTimer.current)
        bumpTimer.current = setTimeout(() => setBump(false), BUMP_MS)
      }
    } else if (g === 'left' || g === 'right') onSwipe(g)
  }

  const shownX = resistX(drag.x, canSwipe('left'), canSwipe('right'))

  let transform = 'none'
  let transition = 'transform 0.3s ease, opacity 0.3s ease'
  let opacity = 1
  if (exiting) {
    opacity = 0
    if (reducedMotion) transition = 'opacity 0.12s ease'
    else {
      transform = FLY_OUT_TRANSFORM
      transition = 'transform 0.18s ease, opacity 0.18s ease'
    }
  } else if (drag.active) {
    transform = reducedMotion ? `translateX(${shownX}px)` : `translateX(${shownX}px) translateY(${Math.min(0, drag.y)}px) rotate(${shownX * 0.05}deg)`
    transition = 'none'
  } else if (bump) {
    transform = 'translateY(-16px)'
    transition = 'transform 0.16s ease'
  }

  const shells = [view + 2, view + 1].filter((i) => i < count)

  return (
    <div
      role="group"
      aria-roledescription="카드"
      aria-label={`${view + 1}번째 카드, 모두 ${count}장`}
      className="relative h-full max-h-[340px] min-h-[200px] w-[80%] max-w-[340px] select-none"
      style={{ touchAction: 'none', WebkitUserSelect: 'none' }}
      onMouseDown={(e) => {
        if (e.button !== 0) return
        e.preventDefault()
        dragStart(e.clientX, e.clientY)
      }}
      onMouseMove={(e) => dragMove(e.clientX, e.clientY)}
      onMouseUp={(e) => dragEnd(e.clientX, e.clientY)}
      onMouseLeave={(e) => {
        if (activeRef.current) dragEnd(e.clientX, e.clientY)
      }}
      onTouchStart={(e) => {
        if (e.touches.length > 1) {
          cancel()
          return
        }
        const t = e.touches[0]
        dragStart(t.clientX, t.clientY)
      }}
      onTouchMove={(e) => {
        if (e.touches.length > 1) {
          cancel()
          return
        }
        const t = e.touches[0]
        dragMove(t.clientX, t.clientY)
      }}
      onTouchEnd={(e) => {
        if (e.cancelable) e.preventDefault()
        const t = e.changedTouches[0]
        if (t) dragEnd(t.clientX, t.clientY)
        else cancel()
      }}
      onTouchCancel={cancel}
    >
      {shells.map((i) => {
        const offset = i - view
        return (
          <div
            key={`shell-${offset}`}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[18px] border border-line bg-surface shadow-sm"
            style={{ transform: `scale(${1 - offset * 0.04}) translateY(${offset * 8}px)`, transition: 'transform 0.3s ease' }}
          />
        )
      })}
      <div key={view} ref={topRef} className="absolute inset-0" style={{ transform, transition, opacity }}>
        {renderTop()}
      </div>
    </div>
  )
}
