import WordsSkeleton from '@/components/vocab/WordsSkeleton'

/** 단어장 탭 `/drawer/words` 의 즉시 로딩 화면(task-046 IMP-0027). `drawer/words/` 아래에는 `page.tsx` 뿐이라 하위 경로로 새지 않는다. */
export default function Loading() {
  return <WordsSkeleton />
}
