import CorrectionsSkeleton from '@/components/drawer/CorrectionsSkeleton'

/** 채택 교정 모음 `/drawer/corrections` 의 즉시 로딩 화면(task-055 §21-7 B). `drawer/corrections/` 아래에는 `page.tsx` 뿐이라 하위 경로로 새지 않는다. */
export default function Loading() {
  return <CorrectionsSkeleton />
}
