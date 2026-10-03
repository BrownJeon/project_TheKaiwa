'use client'

/**
 * 설정 화면 `/admin/configuration`(task-012c, 승인 데모 v2): 보기 탭 4개(Effective · Form · Raw JSON · Diff — 권한 없는 탭은 없다) →
 * 대상 종류(연결 · 운영 설정) + 대상 칩(탭끼리 공유) → 대상 요약 → 탭 본문 → 바뀐 값이 있으면 적용 막대.
 * Form·Raw JSON 은 초안 하나(`useConfigEditor`). 대상·탭은 URL(`?scope=&target=&tab=`) — 기존 `?target=<연결 key>` 링크는 그대로 열린다.
 * 목소리 기본값 편집은 012c-2(D-C14)라 대상 종류에 없다.
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'
import { Card } from '@/components/common/ui'
import type {
  AdminVoiceDto,
  AppSettingDto,
  ConfigEditScopeName,
  ConfigRawDto,
  EffectiveConfigDto,
  EngineConnectionDto,
} from '@/types/admin'
import { ChipRadio, type ChipOption } from '../console/ChipRadio'
import { sortConnections } from '../console/connectionText'
import { useCan, useConsoleEnv, useConsoleToast } from '../console/ConsoleProvider'
import ConsoleSegmented from '../console/ConsoleSegmented'
import { ConsoleError, ConsoleLoading, EmptyNote, LoadError, loadErrorText } from '../console/ConsoleStates'
import { editabilityText, ROLE_LABEL } from '../console/labels'
import * as api from './configApi'
import { configAccess, type ConfigAccess, type ConfigTab, configTabs, pickTab } from './configAccess'
import { APP_SETTING_KEYS, appSettingMeta, EDIT_SCOPE_OPTIONS, SCOPE_KO } from './configCopy'
import ConfigTestCard from './ConfigTestCard'
import { DiffList, DraftPreviewList, summaryOf, SummaryChips, valueText } from './DiffView'
import { baselineOf, fieldFromAppSetting, type FieldModel, fieldsFromEffective } from './draft'
import EditorChrome from './EditorChrome'
import { EffectivePanel } from './EffectiveScreen'
import FieldList, { type VoiceOption } from './FieldList'
import RawTab from './RawTab'
import SourceBadge from './SourceBadge'
import { useAdminResource } from '../console/useAdminResource'
import { useConfigEditor, type EditorTarget, type Writer } from './useConfigEditor'
import { ConfirmDropSheet, shortHash } from './ApplySheet'
import { CredentialSheet } from './ConnectionSheets'
import SecretsSheet from '../console/SecretsSheet'
import AppliedNote from './AppliedNote'
import { LINK_SM, Note } from './ui'

const TAB_LABEL: Record<ConfigTab, string> = { effective: 'Effective', form: 'Form', raw: 'Raw JSON', diff: 'Diff' }
/** Form 에서 숨기는 키 — 연결 사용 여부는 연결 상세의 스위치(#93a)에서 바꾼다. */
const FORM_HIDDEN = new Set(['enabled'])

export function configHref(scope: ConfigEditScopeName, target: string | null, tab: ConfigTab | null): string {
  const u = new URLSearchParams()
  if (scope !== 'ENGINE_CONNECTION') u.set('scope', scope)
  if (target) u.set('target', target)
  if (tab) u.set('tab', tab)
  const q = u.toString()
  return `/admin/configuration${q ? `?${q}` : ''}`
}

interface PickerProps {
  access: ConfigAccess
  scope: ConfigEditScopeName
  target: string | null
  connOptions: ChipOption<string>[]
  onPick: (scope: ConfigEditScopeName, target: string) => void
}

function TargetPicker({ scope, target, connOptions, onPick }: PickerProps) {
  const appOptions: ChipOption<string>[] = APP_SETTING_KEYS.map((m) => ({ value: m.key, label: m.label }))
  const opts = scope === 'APP_SETTING' ? appOptions : connOptions
  return (
    <div className="mt-3 min-w-0">
      <ConsoleSegmented
        ariaLabel="대상 종류"
        options={EDIT_SCOPE_OPTIONS}
        value={scope}
        onChange={(s) => {
          const first = s === 'APP_SETTING' ? appOptions[0]?.value : connOptions[0]?.value
          if (first) onPick(s, first)
        }}
      />
      <div className="mt-1.5">
        {opts.length ? <ChipRadio ariaLabel="대상" options={opts} value={target} onChange={(t) => onPick(scope, t)} /> : <EmptyNote>연결이 없어요.</EmptyNote>}
      </div>
    </div>
  )
}

function TabsBar({ tabs, tab, count, onTab }: { tabs: ConfigTab[]; tab: ConfigTab; count: number; onTab: (t: ConfigTab) => void }) {
  if (tabs.length < 2) return null
  return <ConsoleSegmented ariaLabel="설정 보기" options={tabs.map((t) => ({ value: t, label: t === 'diff' && count ? `${TAB_LABEL[t]} ${count}` : TAB_LABEL[t] }))} value={tab} onChange={onTab} />
}

// ── 대상 하나의 작업 공간(초안은 여기 — 대상이 바뀌면 key 로 다시 마운트) ─────────────────────────

interface WorkspaceProps {
  access: ConfigAccess
  tabs: ConfigTab[]
  tab: ConfigTab
  setTab: (t: ConfigTab) => void
  picker: Omit<PickerProps, 'onPick'>
  onPick: (scope: ConfigEditScopeName, target: string) => void
  target: EditorTarget
  headline: React.ReactNode
  historyHref: string | null
  eff: EffectiveConfigDto | null
  appSetting: AppSettingDto | null
  raw: ConfigRawDto | null
  rawLoading: boolean
  rawError: string | null
  voices: VoiceOption[] | null
  reload: () => void
  connectionHref: string | null
  conn: EngineConnectionDto | null
}

function Workspace(p: WorkspaceProps) {
  const env = useConsoleEnv()
  const toast = useConsoleToast()
  const { access, target, tab, setTab } = p
  const writer = useCallback<Writer>(({ patch, meta, rawText }) => (rawText !== null ? api.applyRaw(target.ref, rawText, meta) : api.apply(target.ref, patch, meta)), [target.ref])
  const e = useConfigEditor({
    target,
    access,
    writer,
    onApplied: (r) => {
      toast(r.changed ? `적용했어요 · v${r.version?.version}${r.baselineVersion ? ' (기준선 v1 함께)' : ''}` : '바뀐 값이 없어 적용하지 않았어요')
      p.reload()
    },
    onReload: p.reload,
    onDiffReady: () => setTab('diff'),
  })
  const [pending, setPending] = useState<{ scope: ConfigEditScopeName; target: string } | null>(null)
  const [secrets, setSecrets] = useState<string | null>(null)
  const [credOpen, setCredOpen] = useState(false)
  const pick = (scope: ConfigEditScopeName, t: string) => {
    if (scope === p.picker.scope && t === p.picker.target) return
    if (e.count > 0) setPending({ scope, target: t })
    else p.onPick(scope, t)
  }
  const syntaxLocked = Boolean(e.raw.editing && e.raw.syntax)
  const onTab = (t: ConfigTab) => {
    if (t === 'form' && syntaxLocked) {
      toast('Raw JSON 문법 오류를 먼저 고쳐 주세요')
      return
    }
    setTab(t)
  }
  const formFields = target.fields.filter((f) => !FORM_HIDDEN.has(f.key))
  const ja = target.fields.some((f) => f.ja)
  const byKey = new Map(target.fields.map((f) => [f.key, f]))
  const previewRows = Object.entries(e.draft.patch).map(([k, v]) => {
    const f = byKey.get(k)
    return { key: k, before: f ? baselineOf(f) : undefined, after: v, strict: Boolean(f?.strict) }
  })
  const errKeys = Object.keys(e.errors)
  const unknownCount = Object.keys(e.draft.unknown).length
  const testHint = target.ref.scope === 'APP_SETTING' ? '미리듣기 합성 1회로 확인' : null
  const next = target.baseVersion === 0 ? 2 : target.baseVersion + 1
  const scrollToField = (key: string) => {
    if (tab !== 'form') setTab('form')
    setTimeout(() => {
      const row = document.querySelector<HTMLElement>(`[data-field="${CSS.escape(key)}"]`)
      row?.scrollIntoView({ block: 'center' })
      row?.querySelector<HTMLElement>('input,textarea,select,button')?.focus({ preventScroll: true })
    }, 0)
  }

  return (
    <>
      <TabsBar tabs={p.tabs} tab={tab} count={e.count} onTab={onTab} />
      <TargetPicker {...p.picker} onPick={pick} />
      <Card flat className="mt-2">
        <div className="text-[13px] [overflow-wrap:anywhere]">{p.headline}</div>
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 flex-1 text-[12px] text-ink2 break-keep">
            {target.baseVersion ? `지금 v${target.baseVersion} 사용 중` : '아직 설정 버전 없음 — 처음 적용할 때 기준선 v1 이 함께 생겨요'} · {env}
          </p>
          {p.historyHref && target.baseVersion ? (
            <Link href={p.historyHref} className={`${LINK_SM} -my-2 flex-none`}>
              버전 기록 ›
            </Link>
          ) : null}
        </div>
      </Card>
      <AppliedNote r={e.applied} />
      {e.applied && e.rawIgnored ? (
        <Note tone="warn" role="note" className="mt-2.5">
          <b>Raw JSON 글은 적용하지 않았어요</b> — 확인한 변경 요약과 달라, 변경 요약(초안) 기준으로 적용했어요. JSON 에서 따로 고친 내용이 있었다면 다시 고쳐 주세요.
        </Note>
      ) : null}
      {e.rebased && e.count ? (
        <Note tone="warn" role="note" className="mt-2.5">
          <b>최신 값 기준으로 다시 불러왔어요</b> — 지금 v{target.baseVersion}. 내 초안은 그대로 두었어요(같아진 값은 뺐어요). 다시 검증해 주세요.
        </Note>
      ) : null}

      {tab === 'effective' ? (
        p.eff ? (
          <EffectivePanel eff={p.eff} />
        ) : p.appSetting ? (
          <ul className="mt-3 overflow-hidden rounded-[14px] border border-line bg-surface">
            <li className="flex min-h-[56px] min-w-0 flex-col gap-1 px-3.5 py-2.5">
              <span className="font-mono text-[13px] text-ink2 [overflow-wrap:anywhere]">{p.appSetting.key}</span>
              <span lang={ja ? 'ja' : undefined} className={`text-[15px] text-ink [overflow-wrap:anywhere] ${ja ? '' : 'font-mono'}`}>
                {valueText(p.appSetting.key, p.appSetting.value)}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <SourceBadge source={p.appSetting.exists ? 'DATABASE' : 'DEFAULT'} />
                <span className="text-[12px] text-ink2">{editabilityText(p.appSetting.editability)}</span>
                {!p.appSetting.exists ? <span className="text-[12px] text-ink2">저장된 행 없음 — 기본값을 써요</span> : null}
              </span>
            </li>
          </ul>
        ) : null
      ) : null}

      {tab === 'form' ? (
        <>
          {syntaxLocked ? (
            <Note tone="bad" role="alert" className="mt-3">
              <b className="text-bad">Raw JSON 에 문법 오류가 있어 Form 을 잠갔어요</b>
              <br />
              Raw JSON 탭 {e.raw.syntax?.line}행 근처를 고치면 다시 열려요. 초안은 마지막으로 읽힌 값이에요.
            </Note>
          ) : null}
          {e.test ? <ConfigTestCard test={e.test} at={e.testAt} production={access.production} canTrace={access.canTrace} /> : null}
          {errKeys.length ? (
            <Note tone="bad" role="alert" className="mt-3">
              <b className="text-bad">검증에서 {errKeys.length}개를 고쳐야 해요</b>
              <ul className="mt-1">
                {errKeys.map((k) => (
                  <li key={k} className="text-[13px] [overflow-wrap:anywhere]">
                    {byKey.has(k) ? (
                      <button type="button" onClick={() => scrollToField(k)} className={LINK_SM}>
                        {byKey.get(k)!.label}
                      </button>
                    ) : (
                      <span className="font-mono">{k}</span>
                    )}{' '}
                    — {e.errors[k].message}
                  </li>
                ))}
              </ul>
            </Note>
          ) : null}
          {unknownCount ? (
            <p className="mt-2.5 text-[12px] text-ink2">
              <span className="inline-flex h-[22px] items-center rounded-md bg-warn-soft px-2 text-[11.5px] font-semibold text-ink">스키마 외 키 {unknownCount}개</span> Raw JSON 에서 넣은 키예요 — 검증에서 걸러져요
            </p>
          ) : null}
          {formFields.length ? (
            <FieldList
              fields={formFields}
              draft={e.draft}
              errors={e.errors}
              frozen={syntaxLocked}
              voices={p.voices}
              groupTitle={target.ref.scope === 'APP_SETTING' ? () => null : undefined}
              secret={{
                canRead: access.canSecretsRead,
                canLink: access.canCredential && Boolean(p.conn),
                onRead: (ref) => setSecrets(ref ?? ''),
                onLink: () => setCredOpen(true),
              }}
              onChange={e.setField}
              onReset={e.resetField}
            />
          ) : (
            <div className="mt-3">
              <EmptyNote>이 대상은 편집 정책을 불러오지 못해 Form 을 열 수 없어요.</EmptyNote>
            </div>
          )}
          {target.ref.scope === 'ENGINE_CONNECTION' && p.connectionHref ? (
            <p className="mt-3 text-[12px] text-ink2 break-keep">
              사용 여부는 연결 상세에서, 예비 순서(기본·예비 연결)는 역할 페이지에서 바꿔요{' '}
              <Link href={p.connectionHref} className={LINK_SM}>
                연결 상세 ›
              </Link>
            </p>
          ) : null}
        </>
      ) : null}

      {tab === 'raw' ? (
        p.raw ? (
          <RawTab editor={e} raw={p.raw} canEdit={access.canRawEdit} />
        ) : p.rawError ? (
          <div className="mt-3">
            <ConsoleError message={p.rawError} onRetry={p.reload} />
          </div>
        ) : p.rawLoading ? (
          <ConsoleLoading />
        ) : null
      ) : null}

      {tab === 'diff' ? (
        e.count === 0 ? (
          <div className="mt-3">
            <EmptyNote>
              바뀐 값이 없어요.
              <br />
              Form {access.canRaw ? '또는 Raw JSON ' : ''}에서 값을 바꾸면 여기에 변경 요약이 나와요.
            </EmptyNote>
          </div>
        ) : (
          <>
            <section className="mt-[18px] min-w-0">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <h3 className="text-[15px] font-semibold">변경 요약</h3>
                <span className="flex-none text-[12px] tabular-nums text-ink2">
                  v{target.baseVersion || '0 (초기값)'} → v{next}
                </span>
              </div>
              {e.diff ? (
                <p className="text-[12px] text-ink2 break-keep">
                  서버 변경 요약 · 방금 만듦
                  {access.production ? (
                    <>
                      {' '}
                      · 요약 해시 <span className="font-mono text-ink">{shortHash(e.diff.summaryHash)}</span> (적용할 때 서버가 다시 계산해 대조해요)
                    </>
                  ) : null}
                </p>
              ) : (
                <p className="text-[12px] text-ink2 break-keep">
                  아직 서버 변경 요약을 만들지 않았어요 — 검증{access.production ? '·기능 테스트' : ''} 뒤 [변경 요약 보기]를 누르면 확정돼요. 아래는 초안 미리 보기예요.
                </p>
              )}
              <SummaryChips
                s={e.diff ? summaryOf(e.diff) : { changed: previewRows.length + unknownCount, strict: previewRows.filter((r) => r.strict).length, blocked: 0, secretTouched: previewRows.some((r) => /credentialRef$/.test(r.key)) }}
                testRequired={e.diff && access.production ? e.diff.testRequired : null}
              />
            </section>
            {access.production ? (
              <Note tone="bad" role="note" className="mt-2.5">
                <b className="text-bad">운영(PRODUCTION) 적용에 필요한 것</b>
                <br />
                최고관리자(SUPER_ADMIN) · 바뀐 키를 모두 실행으로 확인한 기능 테스트(30분 안) · 이 변경 요약 · 이유 10자 이상 · PRODUCTION 입력
                {previewRows.some((r) => r.strict) ? ' · 엄격 키는 최고관리자 본인이 직접' : ''}
              </Note>
            ) : null}
            {e.test ? <ConfigTestCard test={e.test} at={e.testAt} production={access.production} canTrace={access.canTrace} /> : null}
            {e.diff ? <DiffList changes={e.diff.changes} ja={ja} /> : <DraftPreviewList rows={previewRows} ja={ja} />}
            {e.diff && e.diff.unchanged > 0 ? <p className="mt-1.5 text-[12px] text-ink2">바뀌지 않은 키 {e.diff.unchanged}개</p> : null}
          </>
        )
      ) : null}

      <EditorChrome
        editor={e}
        access={access}
        env={env}
        targetName={target.name}
        scopeLabel={SCOPE_KO[target.ref.scope]}
        baseVersion={target.baseVersion}
        showBar={tab !== 'effective'}
        onRawTab={tab === 'raw'}
        testHint={testHint}
        ja={ja}
      />
      {access.canSecretsRead ? <SecretsSheet open={secrets !== null} highlightRef={secrets || null} onClose={() => setSecrets(null)} /> : null}
      {access.canCredential && p.conn ? (
        <CredentialSheet
          key={`cr-${credOpen}`}
          open={credOpen}
          conn={{ id: p.conn.id, key: p.conn.key, name: p.conn.name, enabled: p.conn.enabled, credentialRef: p.conn.credentialRef }}
          baseVersion={target.baseVersion}
          access={access}
          onClose={() => setCredOpen(false)}
          onDone={(r, ref) => {
            setCredOpen(false)
            toast(`${ref ? '비밀 참조를 바꿨어요' : '비밀 참조를 해제했어요'}${r.version ? ` · 설정 v${r.version.version}` : ''}`)
            p.reload()
          }}
        />
      ) : null}
      <ConfirmDropSheet
        open={pending !== null}
        title="다른 대상으로 옮길까요?"
        text={
          <>
            <b>{target.name}</b>에서 바꾼 값 {e.count}개는 저장되지 않고 사라져요.
          </>
        }
        go="버리고 옮기기"
        onGo={() => {
          const t = pending
          setPending(null)
          e.discard()
          if (t) p.onPick(t.scope, t.target)
        }}
        onClose={() => setPending(null)}
      />
    </>
  )
}

// ── 화면(대상·탭·데이터) ─────────────────────────────────────────────────

export default function ConfigScreen({ initialScope, initialTarget, initialTab }: { initialScope: string | null; initialTarget: string | null; initialTab: string | null }) {
  const router = useRouter()
  const can = useCan()
  const env = useConsoleEnv()
  const access = configAccess(can, env)
  const tabs = configTabs(access)
  const [scope, setScope] = useState<ConfigEditScopeName>(initialScope === 'APP_SETTING' ? 'APP_SETTING' : 'ENGINE_CONNECTION')
  const [picked, setPicked] = useState<string | null>(initialTarget)
  const [tab, setTabState] = useState<ConfigTab>(() => pickTab(initialTab, tabs))
  const [rawWanted, setRawWanted] = useState(tab === 'raw')

  const conns = useAdminResource<EngineConnectionDto[]>('/api/admin/v1/engine-connections')
  const list = useMemo(() => sortConnections(conns.data ?? []), [conns.data])
  const connOptions: ChipOption<string>[] = list.map((c) => ({ value: c.key, label: c.key, mono: true }))
  const connKey = scope === 'ENGINE_CONNECTION' ? (picked && list.some((c) => c.key === picked || c.id === picked) ? (list.find((c) => c.key === picked || c.id === picked)?.key ?? null) : (list[0]?.key ?? null)) : null
  const appKey = scope === 'APP_SETTING' ? (picked && appSettingMeta(picked) ? picked : APP_SETTING_KEYS[0].key) : null
  const target = scope === 'APP_SETTING' ? appKey : connKey
  const conn = list.find((c) => c.key === connKey) ?? null

  const eff = useAdminResource<EffectiveConfigDto>(connKey ? api.effectivePath('ENGINE_CONNECTION', connKey) : null)
  const setting = useAdminResource<AppSettingDto>(appKey ? api.appSettingPath(appKey) : null)
  // Raw JSON 은 탭을 열 때 처음 읽는다(운영 대상은 조회마다 감사 1행 — 페이지 진입만으로 남기지 않는다).
  const rawRef = scope === 'APP_SETTING' ? (appKey ? { scope: 'APP_SETTING' as const, targetId: appKey } : null) : eff.data ? { scope: 'ENGINE_CONNECTION' as const, targetId: eff.data.targetId } : null
  const raw = useAdminResource<ConfigRawDto>(access.canRaw && rawWanted && rawRef ? api.rawPath(rawRef) : null)
  const voiceRes = useAdminResource<AdminVoiceDto[]>(scope === 'APP_SETTING' && can('voices.read') ? '/api/admin/v1/voices' : null)
  const voices: VoiceOption[] | null = voiceRes.data ? voiceRes.data.filter((v) => v.enabled || v.status === 'AVAILABLE').map((v) => ({ id: v.id, label: `${v.displayName} (${v.id})` })) : null

  const replaceUrl = useCallback((s: ConfigEditScopeName, t: string | null, tb: ConfigTab) => router.replace(configHref(s, t, tb), { scroll: false }), [router])
  const setTab = useCallback(
    (t: ConfigTab) => {
      setTabState(t)
      if (t === 'raw') setRawWanted(true)
      replaceUrl(scope, target, t)
    },
    [replaceUrl, scope, target],
  )
  const onPick = (s: ConfigEditScopeName, t: string) => {
    setScope(s)
    setPicked(t)
    // Raw JSON 원문은 그 탭을 보고 있을 때만 새 대상으로 읽는다(운영 대상은 조회마다 감사 1행).
    setRawWanted(tab === 'raw')
    replaceUrl(s, t, tab)
  }
  const reload = () => {
    eff.reload()
    setting.reload()
    raw.reload()
    conns.reload()
  }

  if (conns.status === 'loading' || conns.status === 'idle') return <ConsoleLoading />
  if (conns.status === 'error' && conns.err) return <LoadError err={conns.err} name="연결" onRetry={conns.reload} />

  const picker = { access, scope, target, connOptions }
  const main = scope === 'APP_SETTING' ? setting : eff
  const shell = (body: React.ReactNode) => (
    <>
      <TabsBar tabs={tabs} tab={tab} count={0} onTab={setTab} />
      <TargetPicker {...picker} onPick={onPick} />
      {body}
    </>
  )
  if (!target) return shell(null)
  if (main.status === 'loading' || main.status === 'idle') return shell(<ConsoleLoading />)
  if (main.status === 'error' && main.err) {
    return shell(
      main.err.status === 404 ? (
        <div className="mt-3">
          <EmptyNote>대상을 찾을 수 없어요.</EmptyNote>
        </div>
      ) : (
        <LoadError err={main.err} name="설정값" onRetry={main.reload} />
      ),
    )
  }

  let editorTarget: EditorTarget
  let headline: React.ReactNode
  if (scope === 'APP_SETTING') {
    const d = setting.data!
    const meta = appSettingMeta(d.key)
    const field: FieldModel = fieldFromAppSetting(d, meta, access.production)
    editorTarget = { ref: { scope: 'APP_SETTING', targetId: d.key }, name: meta?.label ?? d.key, baseVersion: d.version, fields: [field], rawDoc: raw.data?.json ?? null }
    headline = (
      <>
        운영 설정 · <span className="font-mono">{d.key}</span>
        {d.policy ? ' · 환경 정책 키(읽기만)' : ''}
      </>
    )
  } else {
    const d = eff.data!
    editorTarget = {
      ref: { scope: 'ENGINE_CONNECTION', targetId: d.targetId },
      name: conn?.name ?? d.targetKey ?? d.targetId,
      baseVersion: d.edit?.version ?? 0,
      fields: fieldsFromEffective(d, access.production),
      rawDoc: raw.data?.json ?? null,
    }
    headline = (
      <>
        {conn ? `${conn.name} · ${ROLE_LABEL[conn.role]} · ${conn.engineName || conn.engineId} · ` : ''}스키마 v{d.schemaVersion ?? '—'}
      </>
    )
  }
  const rawError = raw.status === 'error' && raw.err ? loadErrorText(raw.err, 'Raw JSON') : null

  return (
    <>
      {main.err ? (
        <div className="mb-2">
          <ConsoleError message={loadErrorText(main.err, '설정값')} onRetry={main.reload} />
        </div>
      ) : null}
      <Workspace
        key={`${scope}:${target}`}
        access={access}
        tabs={tabs}
        tab={tab}
        setTab={setTab}
        picker={picker}
        onPick={onPick}
        target={editorTarget}
        headline={headline}
        historyHref={access.canAudit ? `/admin/history?scope=${scope}&target=${encodeURIComponent(editorTarget.ref.targetId)}` : null}
        eff={scope === 'ENGINE_CONNECTION' ? eff.data : null}
        appSetting={scope === 'APP_SETTING' ? setting.data : null}
        raw={raw.data}
        rawLoading={raw.status === 'loading'}
        rawError={rawError}
        voices={voices}
        reload={reload}
        connectionHref={conn ? `/admin/connections/${encodeURIComponent(conn.id)}` : null}
        conn={scope === 'ENGINE_CONNECTION' ? conn : null}
      />
      {main.reloading ? <p className="sr-only" role="status">다시 불러오는 중…</p> : null}
    </>
  )
}

