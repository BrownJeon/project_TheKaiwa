import AppBar from '@/components/shell/AppBar'
import ComingSoon from '@/components/common/ComingSoon'

export default function Page() {
  return (
    <>
      <AppBar title="서랍장" />
      <ComingSoon phase="Phase 1 · task-008" title="단어장" items={['단어 추가·보관·카테고리', '교정에서 채택한 표현도 여기에 모여요']} />
    </>
  )
}
