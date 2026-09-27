import WordsScreen from '@/components/vocab/WordsScreen'

/**
 * 단어장(screens.md §4). `?word=<id>`(상세 시트)·`?add=1`(추가 시트)는 서버가 `searchParams` 로 받아 넘긴다 —
 * 클라이언트 `useSearchParams` 는 Suspense 경계가 필요해진다(§3 홈의 `initialTab` 과 같은 방식).
 * 앱바는 `WordsScreen` 안에서 그린다(오른쪽 [＋ 추가]가 클라이언트 상태를 쓴다). 데이터·소유 확인은 화면이 #40~#46 으로 한다.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ word?: string | string[]; add?: string | string[] }> }) {
  const { word, add } = await searchParams
  const initialWordId = typeof word === 'string' && word.length > 0 && word.length <= 64 ? word : undefined
  const initialAdd = add === '1'
  return <WordsScreen initialWordId={initialWordId} initialAdd={initialAdd} />
}
