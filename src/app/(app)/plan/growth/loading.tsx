import GrowthSkeleton from '@/components/plan/GrowthSkeleton'

/**
 * 성장 탭 `/plan/growth` 의 즉시 로딩 화면(task-080, screens.md §36-13). `plan/growth/` 아래에는 `page.tsx` 뿐이라 하위 경로로 새지 않는다
 * (`drawer/corrections` 선례). 자리표시에는 날짜가 들어가지 않아 오늘을 넘기지 않는다.
 */
export default function Loading() {
  return <GrowthSkeleton />
}
