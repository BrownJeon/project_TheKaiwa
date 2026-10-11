'use client'

/**
 * 원본 화면 머리 ← 의 행선지 — 계획표에서 이 화면을 열었으면 계획표(같은 달·날·기록)로(`planReturn.ts`), 채택 교정 모음에서 열었으면
 * 교정 모음(같은 조건·그 카드)으로(`correctionsReturn.ts`, task-055 D5), 둘 다 아니면 화면이 정한 원래 자리로. 두 기록이 모두 맞으면 나중에 연 쪽.
 * 서버 렌더와 하이드레이션 첫 렌더는 원래 자리 그대로다(저장소는 브라우저에만 있다) — 그 뒤에 바꿔 하이드레이션이 어긋나지 않는다.
 * 앱 안에서 이동해 들어온 경우엔 첫 렌더부터 돌아갈 곳으로 간다.
 * 스냅샷은 문자열/null 이어야 한다 — 객체를 돌려주면 `useSyncExternalStore` 가 매번 새 값으로 보고 렌더를 되풀이한다.
 */
import { useCallback, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { backLabelOf, currentBackHref } from './correctionsReturn'

const noopSubscribe = () => () => {}
const onServer = () => null

export function usePlanReturn(fallbackHref: string, fallbackLabel: string): { href: string; label: string } {
  const pathname = usePathname()
  const read = useCallback(() => currentBackHref(pathname), [pathname])
  const back = useSyncExternalStore(noopSubscribe, read, onServer)
  return back ? { href: back, label: backLabelOf(back) } : { href: fallbackHref, label: fallbackLabel }
}
