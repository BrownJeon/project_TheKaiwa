import AskTabSkeleton from '@/components/ask/AskTabSkeleton'

/**
 * 질문 탭 `/ask` 의 즉시 로딩 화면(task-066 §26-5 F). 하단 탭·앱 셸은 상위 레이아웃이 그대로 두고 이 칸만 바뀐다.
 * 라우트 그룹 `(tab)` 에 둔 이유: `ask/loading.tsx` 로 두면 `/ask/[chatId]` 로 들어갈 때도 이 탭 자리표시가 뜬다(그룹 폴더는 주소에 나타나지 않는다).
 */
export default function Loading() {
  return <AskTabSkeleton />
}
