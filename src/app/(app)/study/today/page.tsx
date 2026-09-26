import AppBar from '@/components/shell/AppBar'
import ComingSoon from '@/components/common/ComingSoon'

export default function Page() {
  return (
    <>
      <AppBar title="오늘" />
      <ComingSoon phase="Phase 1 · task-008 / Phase 2" title="오늘의 공부" items={['오늘의 단어: 카드를 넘기며 뜻을 맞혀요(약 3분)', '오늘의 회화: 주제·상황으로 1:1 수업(Phase 2)', 'AI 평가: 난이도별 점검과 기록(Phase 2)']} />
    </>
  )
}
