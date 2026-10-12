'use client'

/**
 * 회화 탭 서버 `loading.tsx` 의 내용(task-046 IMP-0027) — 서버 응답이 오기 전에 바로 그려진다.
 * 정적으로 아는 부분(앱바·탭줄·[＋ 새로 만들기])은 **실제 부품 그대로** 그리고 `inert` 로 눌리지 않게 한다(모양이 같아 점프가 없고, 읽기 도구에도 안 읽힌다).
 * 데이터가 정해야 하는 목록만 자리표시다. 「채택을 기다리는 교정」은 있을 때만 생기는 섹션이라 자리표시에 넣지 않는다.
 * 여기엔 데이터 요청이 없다 — 진짜 화면(`StudyAiHome`)이 올라오면 그쪽이 불러온다.
 *
 * 어느 탭인지는 주소의 `?tab=` 에서 읽는다(REV-171 M-1) — 서버 `loading.tsx` 는 `searchParams` 를 받지 못하므로 클라이언트 부품이 읽는다. 채팅방 뒤로가기·채팅 삭제 뒤·시나리오 저장 뒤처럼
 * `?tab=chat|scenario` 로 새로 들어올 때 자리표시가 회화를 그렸다가 바뀌지 않게 한다. 판정은 서버 `page.tsx` 와 같은 `parseStudyAiTab`.
 */
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Segmented from '@/components/common/Segmented'
import { Btn, Section, SectionHeader } from '@/components/common/ui'
import AppBar from '@/components/shell/AppBar'
import { ChatRowsSkeleton, SkeletonRegion } from '@/components/shell/TabSkeleton'
import { listSectionTitle, newButtonLabel, parseStudyAiTab, STUDY_AI_TABS, type StudyAiTab } from './studyAiTabs'

const noop = () => {}

/**
 * `useSearchParams()` 는 빌드의 정적 생성 단계에서 Suspense 경계를 요구한다 — `loading.tsx` 자신은 경계의 fallback 자리라 그 밖이므로 여기서 따로 감싼다(`PlanSkeleton` 과 같은 이유).
 * 실제 요청에서는 주소를 바로 읽어 fallback(= 회화 모양)은 쓰이지 않는다.
 */
export default function StudyAiSkeleton() {
  return (
    <Suspense fallback={<StudyAiSkeletonView tab="talk" />}>
      <StudyAiSkeletonFromUrl />
    </Suspense>
  )
}

function StudyAiSkeletonFromUrl() {
  const sp = useSearchParams()
  const all = sp.getAll('tab')
  return <StudyAiSkeletonView tab={parseStudyAiTab(all.length > 1 ? all : all[0])} />
}

export function StudyAiSkeletonView({ tab }: { tab: StudyAiTab }) {
  return (
    <>
      <AppBar title="자유로운 대화" />
      <div className="px-4 pb-8">
        <div inert>
          <Segmented ariaLabel="공부 방식" options={STUDY_AI_TABS} value={tab} onChange={noop} />
          {tab === 'scenario' ? null : (
            <Btn className="mt-3.5 w-full" tabIndex={-1}>
              {newButtonLabel(tab)}
            </Btn>
          )}
        </div>
        {tab === 'scenario' ? (
          // 시나리오 홈은 자체 로딩(상황 카드 자리표시)을 가진다 — 탭줄 아래는 비워 두고 알림 한 줄만 둔다(진짜 화면의 내용은 탭줄 아래에 붙기만 해서 밀리는 것이 없다).
          <SkeletonRegion>{null}</SkeletonRegion>
        ) : (
          <Section>
            <SectionHeader title={listSectionTitle(tab)} />
            <ChatRowsSkeleton />
          </Section>
        )}
      </div>
    </>
  )
}
