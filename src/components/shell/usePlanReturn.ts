'use client'

/**
 * 원본 화면 머리 ← 의 행선지 — 계획표에서 이 화면을 열었으면 계획표(같은 달·날·기록)로, 아니면 화면이 정한 원래 자리로(`planReturn.ts`).
 * 서버 렌더와 하이드레이션 첫 렌더는 원래 자리 그대로다(저장소는 브라우저에만 있다) — 그 뒤에 바꿔 하이드레이션이 어긋나지 않는다.
 * 앱 안에서 이동해 들어온 경우엔 첫 렌더부터 계획표로 간다.
 */
import { useCallback, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { currentPlanReturn, PLAN_RETURN_LABEL } from './planReturn'

const noopSubscribe = () => () => {}
const onServer = () => null

export function usePlanReturn(fallbackHref: string, fallbackLabel: string): { href: string; label: string } {
  const pathname = usePathname()
  const read = useCallback(() => currentPlanReturn(pathname), [pathname])
  const plan = useSyncExternalStore(noopSubscribe, read, onServer)
  return plan ? { href: plan, label: PLAN_RETURN_LABEL } : { href: fallbackHref, label: fallbackLabel }
}
