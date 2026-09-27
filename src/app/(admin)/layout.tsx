import ConsoleShell from '@/components/admin/console/ConsoleShell'
import type { ClientConsoleAccess } from '@/components/admin/console/ConsoleProvider'
import { getEnvironmentInfo, requireConsolePage } from '@/modules/admin'

/**
 * Admin Console 셸(screens.md §6-2 A, task-005b). 학습 앱 하단 탭 없이 환경 띠·콘솔 바·메뉴만.
 *
 * 순서가 보안이다: 가드(세션 없음 → /login, console.access 없음 → 앱 공통 404)를 **먼저** 통과한 뒤에만 콘솔 데이터
 * (메뉴·환경)를 읽는다. `(admin)` 전용 not-found 를 두지 않는다 — USER 가 보는 404 는 앱의 아무 없는 주소와 같아야 한다.
 * layout 은 클라이언트 이동 때 다시 돌지 않으므로 각 page 도 렌더 전에 `requireConsolePage(capability)` 를 부른다.
 */
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { viewer } = await requireConsolePage()
  let appVersion: string | null = null
  try {
    appVersion = (await getEnvironmentInfo(viewer.environment)).appVersion
  } catch {
    // 환경 정보가 없어도 셸은 그린다(띠에 환경 이름만, 버전 생략).
  }
  // 클라이언트로는 역할·capability·환경·거른 메뉴만 넘긴다(이메일·사용자 id 는 넘기지 않는다).
  const access: ClientConsoleAccess = {
    role: viewer.role,
    capabilities: viewer.capabilities,
    environment: viewer.environment,
    appVersion,
    menu: viewer.menu,
  }
  return <ConsoleShell access={access}>{children}</ConsoleShell>
}
