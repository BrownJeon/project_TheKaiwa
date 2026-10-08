'use client'

/**
 * 회화 탭 서버 `loading.tsx` 의 내용(task-046 IMP-0027) — 서버 응답이 오기 전에 바로 그려진다.
 * 정적으로 아는 부분(앱바·탭줄·[＋ 새 회화])은 **실제 부품 그대로** 그리고 `inert` 로 눌리지 않게 한다(모양이 같아 점프가 없고, 읽기 도구에도 안 읽힌다).
 * 데이터가 정해야 하는 목록만 자리표시다. 「채택을 기다리는 교정」은 있을 때만 생기는 섹션이라 자리표시에 넣지 않는다.
 * 여기엔 데이터 요청이 없다 — 진짜 화면(`StudyAiHome`)이 올라오면 그쪽이 불러온다.
 */
import Segmented from '@/components/common/Segmented'
import { Btn, Section, SectionHeader } from '@/components/common/ui'
import AppBar from '@/components/shell/AppBar'
import { ChatRowsSkeleton } from '@/components/shell/TabSkeleton'
import { TALK_HOME } from '@/components/talk/talkCopy'
import { STUDY_AI_TABS } from './StudyAiHome'

const noop = () => {}

export default function StudyAiSkeleton() {
  return (
    <>
      <AppBar title="AI와 공부하기" />
      <div className="px-4 pb-8">
        <div inert>
          <Segmented ariaLabel="공부 방식" options={STUDY_AI_TABS} value="talk" onChange={noop} />
          <Btn className="mt-3.5 w-full" tabIndex={-1}>
            {TALK_HOME.newTalk}
          </Btn>
        </div>
        <Section>
          <SectionHeader title={TALK_HOME.section} />
          <ChatRowsSkeleton />
        </Section>
      </div>
    </>
  )
}
