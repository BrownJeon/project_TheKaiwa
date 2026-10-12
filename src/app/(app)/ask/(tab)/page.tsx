import AppBar from '@/components/shell/AppBar'
import AskHome from '@/components/ask/AskHome'

/**
 * 무엇이든 물어보세요 — 질문 목록(task-064, screens.md §25-2·25-4). 질문 방(`/ask/[chatId]`)과 같은 폴더 아래이지만
 * 라우트 그룹 `(tab)` 에 둔다 — 같은 그룹의 `loading.tsx`(목록 자리표시)가 질문 방으로 들어갈 때는 뜨지 않게(§17-1 ②).
 */
export default function Page() {
  return (
    <>
      <AppBar title="질문" />
      <AskHome />
    </>
  )
}
