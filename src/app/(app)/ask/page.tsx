import AppBar from '@/components/shell/AppBar'
import ComingSoon from '@/components/common/ComingSoon'

export default function Page() {
  return (
    <>
      <AppBar title="질문" />
      <ComingSoon phase="Phase 3" title="무엇이든 물어보세요" items={['일본어 표현·문법을 선생님에게 물어봐요', '내 학습 기록을 근거로 답하고 출처를 보여 줘요']} />
    </>
  )
}
