'use client'

/**
 * 연결 상세의 한 번 쓰기 창(task-012c, 데모 v2): 사용 여부 켜기·끄기(#93a) · 비밀 참조 연결·해제(#93b, SUPER_ADMIN).
 * - 끄기: 이유(+ 운영 PRODUCTION 입력) — 기능 테스트 면제(Leader 03:50 ②), 켜진 대체 정책의 기본 연결이면 409 → 역할 페이지 안내.
 * - 켜기: 기능 테스트(운영 필수·개발 선택) + 이유.
 * - 비밀 참조: 값 입력 칸이 없다 — 이 연결이 허용한 참조(#101 `allowedFor`) 중 서버에 있는 것만 고른다. 허용됐지만 서버에 없는 참조는 이름만 한 줄.
 *   다른 연결의 참조·부팅용 비밀은 목록에 없고 넣어도 422. 운영은 바꿀 참조로 기능 테스트 필수.
 * 운영 쓰기는 같은 후보의 변경 요약 해시를 함께 보낸다(`useWritePrep`).
 */
import { useState } from 'react'
import { toErr } from '@/components/common/errors'
import Sheet from '@/components/common/Sheet'
import { Badge } from '@/components/common/ui'
import type { ConfigApplyResultDto, SecretRefDto } from '@/types/admin'
import { StatusBadge } from '../console/Badges'
import { ConsoleLoading, LoadError } from '../console/ConsoleStates'
import { formatMs } from '../console/format'
import { useAdminResource } from '../console/useAdminResource'
import { SheetNotice } from './ApplySheet'
import * as api from './configApi'
import type { ConfigAccess } from './configAccess'
import { checkConfirmInput, checkReasonInput, type NoticeAction, requestErrorText, writeErrorView } from './flow'
import ReasonFields from './ReasonFields'
import type { SheetNoticeView } from './useConfigEditor'
import { useWritePrep, type WritePrep } from './useWritePrep'
import { StrictBadge } from './ui'

/** 확인 창 안 기능 테스트 칸(운영 필수·개발 선택). */
export function PrepTestSection({ prep, production, required, label = '기능 테스트' }: { prep: WritePrep; production: boolean; required: boolean; label?: string }) {
  if (production && prep.diffLoading) return <ConsoleLoading label="변경 요약을 만드는 중…" />
  if (production && prep.diffError) return <p className="mt-3 text-[13px] text-bad break-keep">{requestErrorText(prep.diffError, '변경 요약')}</p>
  const need = production ? Boolean(prep.diff?.testRequired) : required
  if (production && prep.diff && !prep.diff.testRequired) return <p className="mt-3 text-[13px] text-ink2 break-keep">이 변경은 실행으로 확인할 키가 없어 테스트 없이 적용해요.</p>
  const t = prep.test
  return (
    <section className="mt-3.5 min-w-0">
      <h3 className="mb-1.5 text-[15px] font-semibold">
        {label} {production ? '(필수)' : need ? '(선택)' : ''}
      </h3>
      {prep.testing ? (
        <p role="status" className="text-[13px]">
          테스트 중…
        </p>
      ) : t ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <StatusBadge value={t.status === 'ok' ? 'PASSED' : t.status === 'partial' ? 'DEGRADED' : 'FAILED'} />
          <span className="text-[13px] break-keep">
            {t.status === 'ok' ? '통과' : t.status === 'partial' ? '일부만 확인 — 운영에는 적용할 수 없어요' : '실패'}
            {t.latencyMs !== null ? ` · ${formatMs(t.latencyMs)}` : ''}
            {t.status === 'ok' && t.testResultId ? ' · 30분 유효' : ''}
          </span>
        </div>
      ) : null}
      {prep.testError ? <p className="mt-1 text-[12.5px] text-bad break-keep">{prep.testError}</p> : null}
      {!prep.testing && (!t || t.status !== 'ok') ? (
        <button
          type="button"
          disabled={prep.cooldownSec > 0}
          onClick={prep.runTest}
          className="mt-1.5 inline-flex h-11 w-full items-center justify-center rounded-xl border border-line bg-surface px-3.5 text-[14px] font-semibold text-ink disabled:opacity-40"
        >
          {prep.cooldownSec > 0 ? `${prep.cooldownSec}초 뒤 다시` : t ? '다시 테스트' : '이 설정으로 기능 테스트'}
        </button>
      ) : null}
    </section>
  )
}

function useSheetForm(production: boolean, needsConfirm: boolean) {
  const [reason, setReasonState] = useState('')
  const [confirm, setConfirmState] = useState('')
  const [reasonErr, setReasonErr] = useState<string | null>(null)
  const [confirmErr, setConfirmErr] = useState<string | null>(null)
  const [notice, setNotice] = useState<SheetNoticeView | null>(null)
  const [busy, setBusy] = useState(false)
  const check = () => {
    const r = checkReasonInput(reason, production)
    const c = checkConfirmInput(confirm, needsConfirm)
    setReasonErr(r)
    setConfirmErr(c)
    return !r && !c
  }
  const fail = (e: unknown) => {
    const v = writeErrorView(toErr(e), { changeCount: 1 })
    if (v.kind === 'reason') setReasonErr(v.text)
    else if (v.kind === 'confirm') setConfirmErr(v.text)
    else if (v.kind === 'fields') setNotice({ text: v.errors.map((x) => x.message).join(' · ') || '규칙에 맞지 않아요.', actions: [], block: false })
    else setNotice({ text: v.text, actions: v.actions, block: v.block })
  }
  return {
    reason,
    setReason: (v: string) => {
      setReasonState(v)
      setReasonErr(null)
    },
    confirm,
    setConfirm: (v: string) => {
      setConfirmState(v)
      setConfirmErr(null)
    },
    reasonErr,
    confirmErr,
    notice,
    setNotice,
    busy,
    setBusy,
    check,
    fail,
  }
}

function SheetButtons({ go, danger = false, busy, hideGo, onGo, onClose }: { go: string; danger?: boolean; busy: boolean; hideGo: boolean; onGo: () => void; onClose: () => void }) {
  return (
    <div className="mt-3 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
      {hideGo ? null : (
        <button
          type="button"
          aria-busy={busy || undefined}
          disabled={busy}
          onClick={onGo}
          className={`inline-flex h-12 items-center justify-center rounded-xl px-4 text-[15px] font-semibold disabled:opacity-60 ${danger ? 'border border-line bg-surface text-bad' : 'bg-accent text-on-accent'}`}
        >
          {busy ? '처리하는 중…' : go}
        </button>
      )}
      <button type="button" disabled={busy} onClick={onClose} className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold text-ink disabled:opacity-60">
        취소
      </button>
    </div>
  )
}

export interface SheetConn {
  id: string
  key: string
  name: string
  enabled: boolean
  credentialRef: string | null
}

export function EnabledSheet({
  open,
  conn,
  baseVersion,
  access,
  onDone,
  onClose,
  onRoleLink,
}: {
  open: boolean
  conn: SheetConn
  baseVersion: number
  access: ConfigAccess
  onDone: (r: ConfigApplyResultDto, enabled: boolean) => void
  onClose: () => void
  onRoleLink: () => void
}) {
  const to = !conn.enabled
  const production = access.production
  const f = useSheetForm(production, production)
  const prep = useWritePrep({ open, target: { scope: 'ENGINE_CONNECTION', targetId: conn.id }, candidate: { patch: { enabled: to } }, production })
  const submit = async () => {
    if (!f.check()) return
    if (production && !prep.ready) {
      f.setNotice({ text: to ? '운영에서 켜려면 기능 테스트를 먼저 통과해야 해요.' : '변경 요약을 만들지 못했어요. 창을 닫았다 다시 열어 주세요.', actions: [], block: false })
      return
    }
    f.setBusy(true)
    f.setNotice(null)
    try {
      const r = await api.setEnabled(conn.id, to, prep.meta({ baseVersion, reason: f.reason, confirm: f.confirm }))
      onDone(r, to)
    } catch (e) {
      f.fail(e)
    } finally {
      f.setBusy(false)
    }
  }
  const onNotice = (a: NoticeAction) => {
    if (a === 'roleLink') onRoleLink()
    else onClose()
  }
  return (
    <Sheet open={open} title={to ? '연결 켜기' : '연결 끄기'} onClose={onClose} dismissible={!f.busy}>
      <p className="text-[14px] break-keep">{to ? '켜면 라우터가 이 연결을 다시 고를 수 있어요. 켜기 전에 기능 테스트로 동작을 확인해요.' : '끄면 라우터가 이 연결을 고르지 않아요. 예비 순서에 있으면 그 자리를 건너뛰어요.'}</p>
      <p className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[12px] text-ink2 [overflow-wrap:anywhere]">
        {conn.name} · <span className="font-mono">{conn.key}</span> · 사용 여부는 <StrictBadge /> 키예요{production ? ' — 운영은 최고관리자가 직접' : ''}
      </p>
      {to ? <PrepTestSection prep={prep} production={production} required={false} /> : production && prep.diffLoading ? <ConsoleLoading label="변경 요약을 만드는 중…" /> : null}
      <ReasonFields
        reason={f.reason}
        onReason={f.setReason}
        reasonError={f.reasonErr}
        production={production}
        needsConfirm={production}
        confirm={f.confirm}
        onConfirm={f.setConfirm}
        confirmError={f.confirmErr}
        quick={to ? ['다시 쓰려고', '문제가 해결돼서'] : ['서비스 점검 중', '오류가 계속 나서', '더 이상 안 써서']}
      />
      {f.notice ? <SheetNotice notice={f.notice} onAction={onNotice} /> : null}
      <SheetButtons go={to ? (production ? 'PRODUCTION 에서 켜기' : '켜기') : production ? 'PRODUCTION 에서 끄기' : '끄기'} danger={!to} busy={f.busy} hideGo={Boolean(f.notice?.block)} onGo={() => void submit()} onClose={onClose} />
    </Sheet>
  )
}

/** 비밀 참조 선택지: 이 연결이 허용했고 서버에 있는 것 · 허용됐지만 없는 것(이름만). */
export function credentialChoices(refs: readonly SecretRefDto[], connKey: string): { ok: SecretRefDto[]; missing: SecretRefDto[] } {
  const mine = refs.filter((r) => r.allowedFor.includes(connKey))
  return { ok: mine.filter((r) => r.exists), missing: mine.filter((r) => !r.exists) }
}

export function CredentialSheet({
  open,
  conn,
  baseVersion,
  access,
  onDone,
  onClose,
}: {
  open: boolean
  conn: SheetConn
  baseVersion: number
  access: ConfigAccess
  onDone: (r: ConfigApplyResultDto, ref: string | null) => void
  onClose: () => void
}) {
  const production = access.production
  // 열 때마다 한 번 읽는다(조회마다 감사 1행 — 값은 없다).
  const res = useAdminResource<SecretRefDto[]>(open ? '/api/admin/v1/secrets' : null)
  const cur = conn.credentialRef
  const [pick, setPick] = useState<string | null>(null)
  const chosen = pick === null ? cur : pick === '' ? null : pick
  const changed = pick !== null && chosen !== cur
  const f = useSheetForm(production, production)
  const prep = useWritePrep({ open: open && changed, target: { scope: 'ENGINE_CONNECTION', targetId: conn.id }, candidate: changed ? { patch: { 'connection.credentialRef': chosen } } : null, production })
  const { ok, missing } = credentialChoices(res.data ?? [], conn.key)
  const submit = async () => {
    if (!changed) return
    if (!f.check()) return
    if (production && !prep.ready) {
      f.setNotice({ text: '운영에서는 바꿀 참조로 기능 테스트를 먼저 통과해야 해요.', actions: [], block: false })
      return
    }
    f.setBusy(true)
    f.setNotice(null)
    try {
      const r = await api.setCredential(conn.id, chosen, prep.meta({ baseVersion, reason: f.reason, confirm: f.confirm }))
      onDone(r, chosen)
    } catch (e) {
      f.fail(e)
    } finally {
      f.setBusy(false)
    }
  }
  const radio = (value: string, on: boolean, title: React.ReactNode, sub: string, right?: React.ReactNode) => (
    <button key={value || 'none'} type="button" role="radio" aria-checked={on} onClick={() => setPick(value)} className="flex min-h-[56px] w-full min-w-0 items-start gap-2.5 px-3 py-2 text-left">
      <span aria-hidden="true" className={`mt-0.5 h-5 w-5 flex-none rounded-full ${on ? 'shadow-[inset_0_0_0_6px_var(--accent)]' : 'shadow-[inset_0_0_0_2px_var(--ink2)]'}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] [overflow-wrap:anywhere]">{title}</span>
        <span className="block text-[12px] text-ink2">{sub}</span>
      </span>
      {right}
    </button>
  )
  return (
    <Sheet open={open} title="비밀 참조 연결" onClose={onClose} dismissible={!f.busy}>
      <p className="text-[13px] break-keep">
        값은 여기서 입력하지 않아요. 서버에 넣어 둔 비밀(환경 변수·비밀 파일)의 <b>이름만</b> 연결해요.
      </p>
      <p className="mt-1 text-[12px] text-ink2">
        지금: <span className="font-mono text-ink">{cur ?? '연결 안 됨'}</span>
      </p>
      {res.status === 'loading' ? <ConsoleLoading /> : null}
      {res.status === 'error' && res.err ? <LoadError err={res.err} name="비밀 참조" onRetry={res.reload} /> : null}
      {res.data ? (
        <div role="radiogroup" aria-label="비밀 참조 고르기" className="mt-2">
          <p className="mt-2 text-[12.5px] font-medium text-ink2">이 연결이 허용한 참조 중 서버에 있는 것</p>
          {ok.length ? (
            <div className="mt-1 divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-surface">
              {ok.map((s) => radio(s.ref, chosen === s.ref, <span className="font-mono">{s.ref}</span>, `${s.source === 'file' ? '파일' : '환경 변수'}${s.ref === cur ? ' · 지금 연결됨' : ''}`, <Badge tone="good">있음</Badge>))}
            </div>
          ) : (
            <p className="mt-1 rounded-[14px] border border-dashed border-line px-3 py-3 text-[13px] text-ink2">고를 수 있는 참조가 없어요.</p>
          )}
          {missing.length ? (
            <p className="mt-1.5 text-[12px] text-ink2 [overflow-wrap:anywhere]">
              허용됐지만 서버에 없는 참조 {missing.length}개(<span className="font-mono">{missing.map((s) => s.ref).join(', ')}</span>)는 고를 수 없어요 — 서버에 먼저 넣어 주세요.
            </p>
          ) : null}
          <div className="mt-3 overflow-hidden rounded-[14px] border border-line bg-surface">{radio('', chosen === null, '연결 해제', '비밀 없이 호출해요 — 인증이 필요한 서비스면 실패해요')}</div>
        </div>
      ) : null}
      <p className="mt-2 text-[12px] text-ink2 break-keep">다른 연결의 참조와 부팅용 비밀(세션 서명·내부 서비스·DB 접속 등)은 목록에 나오지 않고, 넣어도 거부돼요(422).</p>
      {changed ? (
        <>
          <PrepTestSection prep={prep} production={production} required label="기능 테스트" />
          <ReasonFields
            reason={f.reason}
            onReason={f.setReason}
            reasonError={f.reasonErr}
            production={production}
            needsConfirm={production}
            confirm={f.confirm}
            onConfirm={f.setConfirm}
            confirmError={f.confirmErr}
            quick={['키를 교체해서', '인증 오류가 나서', '시험해 보려고']}
          />
        </>
      ) : null}
      {f.notice ? <SheetNotice notice={f.notice} onAction={() => onClose()} /> : null}
      {changed ? (
        <SheetButtons go={production ? 'PRODUCTION 에 연결' : chosen === null ? '연결 해제' : '연결'} busy={f.busy} hideGo={Boolean(f.notice?.block)} onGo={() => void submit()} onClose={onClose} />
      ) : (
        <div className="mt-3 flex">
          <button type="button" onClick={onClose} className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold text-ink">
            닫기
          </button>
        </div>
      )}
    </Sheet>
  )
}
