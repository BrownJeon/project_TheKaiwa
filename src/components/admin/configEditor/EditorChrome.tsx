'use client'

/**
 * 편집 공통 틀 — 적용 막대 + 적용 확인 창 + 초안 버리기 확인 + 요청 실패 한 줄. 설정 화면·연결 상세 편집·예비 순서 편집이 같이 쓴다.
 * 막대 단계·버튼은 순수 `flowView` 가 정하고, 권한 없는 적용은 🔒 단계로만 보인다(버튼 없음).
 */
import { useRouter } from 'next/navigation'
import type { AdminEnvironment } from '@/types/admin'
import { ConsoleError } from '../console/ConsoleStates'
import ApplySheet, { ConfirmDropSheet } from './ApplySheet'
import type { ConfigAccess } from './configAccess'
import type { ValueNamer } from './DiffView'
import FlowBar from './FlowBar'
import { type FlowButtonId, flowView, type NoticeAction } from './flow'
import type { ConfigEditor } from './useConfigEditor'

export default function EditorChrome({
  editor,
  access,
  env,
  targetName,
  scopeLabel,
  baseVersion,
  showBar,
  onRawTab = false,
  testHint = null,
  ja,
  namer,
  roleHref,
}: {
  editor: ConfigEditor
  access: ConfigAccess
  env: AdminEnvironment
  targetName: string
  scopeLabel: string
  baseVersion: number
  showBar: boolean
  onRawTab?: boolean
  testHint?: string | null
  ja?: boolean
  namer?: ValueNamer
  roleHref?: string | null
}) {
  const router = useRouter()
  const e = editor
  const view = flowView({
    flow: e.flow,
    production: access.production,
    canApply: access.canApply,
    canTest: access.canTest,
    syntaxError: Boolean(e.raw.editing && e.raw.syntax),
    errorCount: Object.keys(e.errors).length,
    changeCount: e.count,
    cooldownSec: e.cooldownSec,
    testSec: e.testSec,
    onRawTab,
    testHint,
  })
  const busyIds: Partial<Record<FlowButtonId, boolean>> = { validate: e.busy === 'validate', diff: e.busy === 'diff' }
  const buttons = view.buttons.map((b) => (busyIds[b.id] ? { ...b, busy: true, disabled: true, label: b.id === 'validate' ? '검증 중…' : '만드는 중…' } : b))
  const onButton = (id: FlowButtonId) => {
    if (id === 'discard') e.openDiscard()
    else if (id === 'validate') void e.runValidate()
    else if (id === 'test') void e.runTest()
    else if (id === 'skip') e.skipTest()
    else if (id === 'diff') void e.runDiff()
    else if (id === 'apply') e.openApply()
  }
  const onNotice = (a: NoticeAction) => {
    if (a === 'roleLink' && roleHref) {
      e.closeSheet()
      router.push(roleHref)
      return
    }
    e.noticeAction(a)
  }
  return (
    <>
      {e.requestError ? (
        <div className="mt-3">
          <ConsoleError message={e.requestError} />
        </div>
      ) : null}
      {showBar && e.count > 0 ? <FlowBar view={{ ...view, buttons }} onButton={onButton} /> : null}
      <ApplySheet
        open={e.sheet === 'apply'}
        production={access.production}
        needsConfirm={access.needsConfirm}
        env={env}
        targetName={targetName}
        scopeLabel={scopeLabel}
        baseVersion={baseVersion}
        diff={e.diff}
        diffAt={e.diffAt}
        test={e.test}
        ja={ja}
        namer={namer}
        reason={e.reason}
        onReason={e.setReason}
        reasonError={e.reasonErr}
        confirm={e.confirm}
        onConfirm={e.setConfirm}
        confirmError={e.confirmErr}
        notice={e.notice}
        onNoticeAction={onNotice}
        applying={e.applying}
        onSubmit={() => void e.submitApply()}
        onClose={e.closeSheet}
      />
      <ConfirmDropSheet
        open={e.sheet === 'discard'}
        title="초안을 버릴까요?"
        text={`바꾼 값 ${e.count}개가 사라져요. 저장된 설정은 그대로예요.`}
        go="버리기"
        onGo={e.discard}
        onClose={e.closeSheet}
      />
    </>
  )
}
