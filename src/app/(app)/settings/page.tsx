import { userCan } from '@/modules/admin'
import { auth } from '@/modules/infra'
import { getProfile, VOICE_PARAM_RANGES } from '@/modules/preferences'
import { listSelectableVoices, loadTtsVoice } from '@/modules/speech'
import AppBar from '@/components/shell/AppBar'
import AppVersionRow from '@/components/settings/AppVersionRow'
import AttendanceCard from '@/components/settings/AttendanceCard'
import DataCreditRow from '@/components/settings/DataCreditRow'
import DisplaySettings from '@/components/settings/DisplaySettings'
import LearningSettings from '@/components/settings/LearningSettings'
import OnDeviceDiagnosticsCard from '@/components/settings/OnDeviceDiagnosticsCard'
import SpeechSettings from '@/components/settings/SpeechSettings'
import VoiceSettings from '@/components/settings/VoiceSettings'
import { baselineFrom, type VoiceBaselines } from '@/components/settings/voiceSliderLogic'
import AdminConsoleEntry from './AdminConsoleEntry'
import LogoutButton from './LogoutButton.client'
import ManageEntryRow from './ManageEntryRow'

/**
 * 목소리별 "기본" 원자료(task-022 REV-040) — 합성 때 서버 Resolver 가 읽는 목소리 행(`loadTtsVoice`)에서 숫자·말투 이름만 골라 넘긴다.
 * 모델·화자 식별자는 props 에 싣지 않는다. 합성할 수 없는 목소리는 빠지고, 화면은 #17 응답의 defaults 로 대신한다.
 */
async function loadVoiceBaselines(): Promise<VoiceBaselines> {
  const voices = await listSelectableVoices()
  const rows = await Promise.all(voices.map((v) => loadTtsVoice(v.id)))
  return Object.fromEntries(rows.flatMap((r) => (r ? [[r.id, baselineFrom(r.defaults, r.styles)] as const] : [])))
}

/**
 * 설정 허브(기획서 "5. 프로필" → 설계안 §7-7·§11, task-005): 계정 · 출석 · 기본정보·학습 · 일본어 표시 · AI 선생님 목소리 · 음성 인식.
 * 사용자 화면에는 엔진·모델명이 없다. Advanced·Voice 관리·콘솔 진입은 capability 가 있는 계정에만(task-005b).
 */
export default async function SettingsPage() {
  const session = await auth()
  const user = session?.user
  // 매 요청 DB 역할로 확인한다(캐시 없음). 콘솔 행은 engine.read 보유자에게만 — 서버 컴포넌트라 USER 번들에 문자열이 없다.
  const showConsole = user ? await userCan('engine.read') : false
  // 목소리 카드 머리의 선생님 이름(설정 #11, 비우면 "선생님") — 채팅방과 같은 규칙(screens §7-2 A).
  const teacherName = user ? (await getProfile(user.id)).teacherName?.trim() || '선생님' : '선생님'
  const voiceBaselines = user ? await loadVoiceBaselines() : {}
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
        <ManageEntryRow />
        <LearningSettings />
        <DisplaySettings />
        {/* 슬라이더 범위·목소리 기본값은 서버 정본을 그대로 넘긴다 — 컴포넌트는 preferences·speech 를 import 하지 않는다(task-022). */}
        <VoiceSettings teacherName={teacherName} ranges={VOICE_PARAM_RANGES} baselines={voiceBaselines} />
        <SpeechSettings />
        {/* 앱에서만(웹은 DOM 0): 앱 버전 줄 · 관리자 행 아래 휴대폰 인식 진단(engine.read — task-003f §11-2 G·I). */}
        <AppVersionRow />
        {/* 단어 자료 출처(task-051 D5-A) — 웹·앱 모두. 일반 사용자에게는 설정의 마지막 줄. */}
        <DataCreditRow />
        {showConsole ? <AdminConsoleEntry /> : null}
        <OnDeviceDiagnosticsCard show={showConsole} />
      </div>
    </>
  )
}
