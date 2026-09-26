import AppBar from '@/components/shell/AppBar'
import ComingSoon from '@/components/common/ComingSoon'

export default function Page() {
  return (
    <>
      <AppBar title="계획표" />
      <ComingSoon phase="Phase 2·3" title="공부계획표" items={['달력: 날짜별 출석과 공부 기록', '분석: 선생님이 기록을 보고 공부 계획을 제안해요', '성장 기록: 평가·교정 추이']} />
    </>
  )
}
