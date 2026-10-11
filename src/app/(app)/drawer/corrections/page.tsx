import CorrectionsScreen from '@/components/drawer/CorrectionsScreen'
import { CORRECTIONS_COPY } from '@/components/drawer/correctionsCopy'
import { parseCorrectionsReturnQuery } from '@/components/drawer/logic'

/** 문서 제목 「채택한 교정 · 단어장」 — 앱바 h1 은 「단어장」 그대로(지금 위치는 분절 `aria-current` 가 알린다, screens.md §21-11 ⑨). */
export const metadata = { title: CORRECTIONS_COPY.docTitle }

/**
 * 채택 교정 모음(task-055, screens.md §21). 돌아오기 쿼리(`errorType`·`chunkType`·`q`·`focus`·`n`)는 형식이 틀린 값만 버리고 넘긴다(§21-6 C).
 * 화면은 같은 값을 지금 주소(`useSearchParams`)에서 다시 읽는다 — 휴대폰 뒤로가기는 라우터 캐시의 옛 props 를 쓸 수 있어서다(계획표와 같은 이유).
 * 앱바는 화면 안에서 그린다. 데이터·소유 확인은 화면이 #79 로 한다(자기 교정만).
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const initial = parseCorrectionsReturnQuery(await searchParams)
  return <CorrectionsScreen initial={initial} />
}
