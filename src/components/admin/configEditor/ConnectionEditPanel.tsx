'use client'

/**
 * 연결 상세 편집 모드(사용자 결정 d4 = A "같은 화면에서 편집", 데모 v2 `conn-edit`) — 연결 정보·실행 설정 칸이 설정 화면 Form 과 같은 칸으로 바뀌고
 * 같은 적용 막대를 쓴다(쓰기 = #93 PUT engine-connections/:id). 편집 중에는 저장된 설정용 테스트 패널을 숨기고 막대의 [기능 테스트]가 후보로 테스트한다.
 * 사용 여부는 머리 카드의 스위치(#93a), 비밀 참조는 [비밀 참조 연결](#93b)에서만 — 이 Form 에서는 바꾸지 않는다.
 */
import { useCallback, useState } from 'react'
import type { EffectiveConfigDto, EngineConnectionDetailDto } from '@/types/admin'
import { useConsoleEnv, useConsoleToast } from '../console/ConsoleProvider'
import { ConsoleLoading, LoadError } from '../console/ConsoleStates'
import { useAdminResource } from '../console/useAdminResource'
import { ROLE_PATH } from '../console/labels'
import * as api from './configApi'
import type { ConfigAccess } from './configAccess'
import ConfigTestCard from './ConfigTestCard'
import AppliedNote from './AppliedNote'
import { ConfirmDropSheet } from './ApplySheet'
import { DiffList, summaryOf, SummaryChips } from './DiffView'
import { connectionFormBody, fieldsFromEffective } from './draft'
import EditorChrome from './EditorChrome'
import FieldList from './FieldList'
import { useConfigEditor, type EditorTarget, type Writer } from './useConfigEditor'
import { Note } from './ui'

const HIDDEN = new Set(['enabled'])

function Panel({
  conn,
  eff,
  access,
  reload,
  onEnd,
  onSecrets,
  onCredential,
}: {
  conn: EngineConnectionDetailDto
  eff: EffectiveConfigDto
  access: ConfigAccess
  reload: () => void
  onEnd: () => void
  onSecrets: (ref: string | null) => void
  onCredential: () => void
}) {
  const env = useConsoleEnv()
  const toast = useConsoleToast()
  const target: EditorTarget = { ref: { scope: 'ENGINE_CONNECTION', targetId: conn.id }, name: conn.name, baseVersion: eff.edit?.version ?? 0, fields: fieldsFromEffective(eff, access.production) }
  const writer = useCallback<Writer>(
    ({ patch, meta }) => {
      const body = connectionFormBody(patch)
      return body ? api.updateConnection(conn.id, body, meta) : api.apply({ scope: 'ENGINE_CONNECTION', targetId: conn.id }, patch, meta)
    },
    [conn.id],
  )
  const e = useConfigEditor({
    target,
    access: { ...access, canApply: access.canApplyConn, needsConfirm: access.canApplyConn && access.production },
    writer,
    onApplied: (r) => {
      toast(r.changed ? `적용했어요 · v${r.version?.version}${r.baselineVersion ? ' (기준선 v1 함께)' : ''}` : '바뀐 값이 없어 적용하지 않았어요')
      reload()
    },
    onReload: reload,
  })
  const fields = target.fields.filter((f) => !HIDDEN.has(f.key))
  const errKeys = Object.keys(e.errors)
  const [endAsk, setEndAsk] = useState(false)
  const end = () => (e.count ? setEndAsk(true) : onEnd())
  return (
    <>
      <Note tone="neu" className="mt-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 text-[13px]">
            <b>편집 중</b> · 바뀐 값 {e.count}개 — 아래 막대에서 검증·적용해요
          </span>
          <button type="button" onClick={end} className="inline-flex min-h-11 flex-none items-center px-1 text-[13px] font-medium text-accent">
            편집 끝내기
          </button>
        </div>
      </Note>
      <p className="mt-2 text-[12px] text-ink2 break-keep">편집 중에는 아래 막대의 [기능 테스트]가 저장 전 후보 설정으로 테스트해요.</p>
      <AppliedNote r={e.applied} />
      {e.flow.d && e.diff ? (
        <section className="mt-[18px] min-w-0">
          <h3 className="text-[15px] font-semibold">변경 요약</h3>
          <SummaryChips s={summaryOf(e.diff)} testRequired={access.production ? e.diff.testRequired : null} />
          <DiffList changes={e.diff.changes} />
        </section>
      ) : null}
      {e.test ? <ConfigTestCard test={e.test} at={e.testAt} production={access.production} canTrace={access.canTrace} /> : null}
      {errKeys.length ? (
        <Note tone="bad" role="alert" className="mt-3">
          <b className="text-bad">검증에서 {errKeys.length}개를 고쳐야 해요</b> — 칸 아래 안내를 확인해 주세요.
        </Note>
      ) : null}
      <FieldList
        fields={fields}
        draft={e.draft}
        errors={e.errors}
        secret={{ canRead: access.canSecretsRead, canLink: access.canCredential, onRead: onSecrets, onLink: onCredential }}
        onChange={e.setField}
        onReset={e.resetField}
      />
      <EditorChrome
        editor={e}
        access={{ ...access, canApply: access.canApplyConn, needsConfirm: access.canApplyConn && access.production }}
        env={env}
        targetName={conn.name}
        scopeLabel="연결"
        baseVersion={target.baseVersion}
        showBar
        roleHref={ROLE_PATH[conn.role]}
      />
      <ConfirmDropSheet
        open={endAsk}
        title="편집을 끝낼까요?"
        text={`바꾼 값 ${e.count}개가 사라져요. 저장된 설정은 그대로예요.`}
        go="버리고 끝내기"
        onGo={() => {
          setEndAsk(false)
          e.discard()
          onEnd()
        }}
        onClose={() => setEndAsk(false)}
      />
    </>
  )
}

export default function ConnectionEditPanel(p: {
  conn: EngineConnectionDetailDto
  access: ConfigAccess
  reloadConn: () => void
  onEnd: () => void
  onSecrets: (ref: string | null) => void
  onCredential: () => void
}) {
  const eff = useAdminResource<EffectiveConfigDto>(api.effectivePath('ENGINE_CONNECTION', p.conn.id))
  if (eff.status === 'loading' || eff.status === 'idle') return <ConsoleLoading />
  if (eff.status === 'error' && eff.err) return <LoadError err={eff.err} name="편집 정책" onRetry={eff.reload} />
  return (
    <Panel
      conn={p.conn}
      eff={eff.data!}
      access={p.access}
      reload={() => {
        eff.reload()
        p.reloadConn()
      }}
      onEnd={p.onEnd}
      onSecrets={p.onSecrets}
      onCredential={p.onCredential}
    />
  )
}
