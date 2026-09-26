import { auth } from '@/modules/infra'
import AppBar from '@/components/shell/AppBar'
import ComingSoon from '@/components/common/ComingSoon'
import LogoutButton from './LogoutButton'

/**
 * 설정 허브(기획서 "5. 프로필" → 설계안 §7-7·§11). Phase 0 은 계정 확인·로그아웃만 두고,
 * 기본정보·목표·학습·AI 선생님(목소리·미리듣기·Speech Profile)·음성 인식 모드는 task-005 가 채운다.
 * 역할(role)은 표시만 한다 — 권한 판단은 capability(role-permission.md) 로 서버에서.
 */
export default async function SettingsPage() {
  const session = await auth()
  const user = session?.user
  return (
    <>
      <AppBar title="설정" />
      <section className="mx-4 mb-4 min-w-0 rounded-[var(--radius)] border border-line bg-surface p-4">
        <p className="text-[13px] text-ink3">로그인 계정</p>
        <p className="mt-1 truncate text-[16px] font-semibold text-ink">{user?.name ?? '이름 없음'}</p>
        <p className="truncate text-[14px] text-ink2">{user?.email}</p>
        <p className="mt-2 text-[12px] text-ink3">역할: {user?.role}</p>
        <LogoutButton />
      </section>
      <ComingSoon
        phase="Phase 1 · task-005"
        title="준비 중인 설정"
        items={['기본정보·목표·학습(수준·교정 강도·선생님 이름)', 'AI 선생님 목소리·속도·미리듣기', '음성 인식 모드(자동·빠르게·정확하게·오프라인)']}
      />
    </>
  )
}
