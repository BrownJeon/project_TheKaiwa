import PlanSkeleton from '@/components/plan/PlanSkeleton'
import { todayKst } from '@/modules/infra/dates'

/**
 * 계획표 탭 `/plan` 의 즉시 로딩 화면(task-046 IMP-0027, T3). 하단 탭·앱 셸은 상위 레이아웃이 그대로 두고 이 칸만 바뀐다.
 * 라우트 그룹 `(tab)` 에 둔 이유: `loading.tsx` 는 같은 폴더의 모든 하위 경로(`challenge/[id]`·`challenge/new`·`challenges`)를 감싸므로
 * `plan/` 바로 아래에 두면 챌린지 화면으로 들어갈 때도 이 달력 자리표시가 뜬다. 그룹 폴더는 주소에 나타나지 않는다.
 */
export default function Loading() {
  return <PlanSkeleton today={todayKst()} />
}
