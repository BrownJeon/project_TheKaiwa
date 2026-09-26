import AppBar from '@/components/shell/AppBar'
import ComingSoon from '@/components/common/ComingSoon'

export default function Page() {
  return (
    <>
      <AppBar title="회화" />
      <ComingSoon phase="Phase 1 · task-006·007" title="AI와 공부하기" items={['AI 회화: 말하면 선생님이 대답하고 틀린 표현을 바로 짚어 줘요', 'AI 채팅: 일본어로 대화하고 대화 뒤에 표현을 점검해요', '교정은 제안만 하고, 저장은 직접 채택할 때만 해요']} />
    </>
  )
}
