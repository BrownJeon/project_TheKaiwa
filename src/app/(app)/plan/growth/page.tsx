import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import GrowthScreen from '@/components/plan/GrowthScreen'
import { GROWTH } from '@/components/plan/growthCopy'
import AppBar from '@/components/shell/AppBar'
import { auth } from '@/modules/infra'
import { todayKst } from '@/modules/infra/dates'

/** 문서 제목 «성장 · 계획표» — 앱바 h1 은 «계획표» 그대로(지금 위치는 분절 `aria-current` 가 알린다, §21 「채택한 교정 · 단어장」 선례). */
export const metadata = { title: GROWTH.docTitle }

/**
 * 계획표 성장 탭(task-080, screens.md §36). `(tab)` 그룹 밖 형제 폴더다 — `(tab)/loading.tsx` 는 그 아래 모든 경로를 감싸므로 안에 두면
 * 이리 올 때 달력 자리표시가 먼저 뜬다. 데이터(#78)는 화면이 읽고(자기 기록만), 기간 `?weeks=` 은 화면이 지금 주소에서 직접 읽는다.
 */
export default async function Page() {
  const session = await auth()
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent('/plan/growth')}`)
  return (
    <>
      <AppBar title="계획표" />
      <Suspense fallback={null}>
        <GrowthScreen today={todayKst()} />
      </Suspense>
    </>
  )
}
