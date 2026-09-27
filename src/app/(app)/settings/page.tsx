import { userCan } from '@/modules/admin'
import { auth } from '@/modules/infra'
import AppBar from '@/components/shell/AppBar'
import AttendanceCard from '@/components/settings/AttendanceCard'
import LearningSettings from '@/components/settings/LearningSettings'
import SpeechSettings from '@/components/settings/SpeechSettings'
import VoiceSettings from '@/components/settings/VoiceSettings'
import AdminConsoleEntry from './AdminConsoleEntry'
import LogoutButton from './LogoutButton.client'

/**
 * 설정 허브(기획서 "5. 프로필" → 설계안 §7-7·§11, task-005): 계정 · 출석 · 기본정보·학습 · AI 선생님 목소리 · 음성 인식.
 * 사용자 화면에는 엔진·모델명이 없다. Advanced·Voice 관리·콘솔 진입은 capability 가 있는 계정에만(task-005b).
 */
export default async function SettingsPage() {
  const session = await auth()
  const user = session?.user
  // 매 요청 DB 역할로 확인한다(캐시 없음). 콘솔 행은 engine.read 보유자에게만 — 서버 컴포넌트라 USER 번들에 문자열이 없다.
  const showConsole = user ? await userCan('engine.read') : false
  return (
    <>
      <AppBar title="설정" />
      <AttendanceCard />
      <div className="px-4 pb-8">
        <section className="min-w-0 rounded-[14px] border border-line bg-surface p-3.5">
          <p className="text-[13px] text-ink3">로그인 계정</p>
          <p className="mt-1 truncate text-[16px] font-semibold text-ink">{user?.name ?? '이름 없음'}</p>
          <p className="truncate text-[14px] text-ink2">{user?.email}</p>
          <LogoutButton />
        </section>
        <LearningSettings />
        <VoiceSettings />
        <SpeechSettings />
        {showConsole ? <AdminConsoleEntry /> : null}
      </div>
    </>
  )
}
