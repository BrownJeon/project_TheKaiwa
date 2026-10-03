'use client'

/**
 * 설정 버전 상세·되돌리기(#108a·#109, 데모 v2 `verSheet`). 보기 = [직전 버전과 | 지금과] 비교 + 스냅샷 전체(DEVELOPER 이상만 원문).
 * 되돌리기 = 과거 버전 내용으로 **새 버전**(밀려난 직전은 "되돌려짐", 기록은 지우지 않는다). 지금과의 차이 · 지금 스키마에 없는 키 경고 ·
 * 이유(+ 운영: 되돌릴 설정으로 기능 테스트 필수 · 요약 해시 · PRODUCTION 입력). 내용이 같으면 확정 버튼 없이 "되돌릴 것이 없어요".
 * 기록 손상(목록 integrity ≠ OK 또는 서버 422)은 안내만 — 비교·되돌리기 버튼을 그리지 않는다.
 * 되돌리기 버튼은 `config.rollback`(운영은 최고관리자) 보유자만 — 운영 비 최고관리자는 버튼 대신 한 줄.
 */
import { useState } from 'react'
import Sheet from '@/components/common/Sheet'
import { toErr } from '@/components/common/errors'
import type { ConfigRollbackResultDto, ConfigVersionDetailDto, ConfigVersionItemDto, ConfigVersionListDto } from '@/types/admin'
import { ConsoleError, ConsoleLoading } from '../console/ConsoleStates'
import ConsoleSegmented from '../console/ConsoleSegmented'
import { formatDateTime } from '../console/format'
import KeyValueList from '../console/KeyValueList'
import { useAdminResource } from '../console/useAdminResource'
import { SheetNotice } from '../configEditor/ApplySheet'
import * as api from '../configEditor/configApi'
import type { ConfigAccess } from '../configEditor/configAccess'
import { ORIGIN_KO, SCOPE_KO } from '../configEditor/configCopy'
import { PrepTestSection } from '../configEditor/ConnectionSheets'
import { ValueSpan } from '../configEditor/DiffView'
import { checkConfirmInput, checkReasonInput, writeErrorView } from '../configEditor/flow'
import ReasonFields from '../configEditor/ReasonFields'
import type { SheetNoticeView } from '../configEditor/useConfigEditor'
import { useWritePrep } from '../configEditor/useWritePrep'
import { DamagedBadge, NeutralTag, Note, VersionStatusBadge } from '../configEditor/ui'

type Compare = 'previous' | 'active'

function isIntegrityErr(status: number, details: Record<string, unknown>): boolean {
  return status === 422 && details.reason === 'E_SNAPSHOT_INTEGRITY'
}

function EntryList({ entries }: { entries: ConfigVersionDetailDto['entries'] }) {
  return (
    <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
      {entries.map((r) => {
        const ja = /defaultText/.test(r.key)
        const added = r.before === null || r.before === undefined
        const removed = r.after === null || r.after === undefined
        return (
          <li key={r.key} className="min-w-0 px-3 py-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <NeutralTag>{added ? '추가' : removed ? '제거' : '바뀜'}</NeutralTag>
              <span className="min-w-0 flex-1 font-mono text-[13px] [overflow-wrap:anywhere]">{r.key}</span>
            </div>
            <div className="mt-1 text-[15px] [overflow-wrap:anywhere]">
              {added ? null : (
                <>
                  <ValueSpan k={r.key} v={r.before} ja={ja} strike />
                  <span aria-hidden="true" className="px-1 text-ink2">
                    →
                  </span>
                  <span className="sr-only">에서 다음으로</span>
                </>
              )}
              {removed ? <span className="text-ink2">(없음)</span> : <ValueSpan k={r.key} v={r.after} ja={ja} />}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function DamagedNote() {
  return (
    <Note tone="bad" role="alert" className="mt-3">
      <b className="text-bad">기록이 손상돼 이 버전으로는 비교·되돌리기를 할 수 없어요.</b>
      <br />
      기록 형식이 깨졌거나 지금 규칙에 맞지 않는 값이 있어요. 다시 불러와도 바뀌지 않는 데이터 문제예요.
    </Note>
  )
}

function Rollback({ v, access, onBack, onDone }: { v: ConfigVersionItemDto; access: ConfigAccess; onBack: () => void; onDone: (r: ConfigRollbackResultDto) => void }) {
  const production = access.production
  const detail = useAdminResource<ConfigVersionDetailDto>(api.versionPath(v.id, 'active'))
  const active = useAdminResource<ConfigVersionListDto>(api.versionsPath({ scope: v.scope, targetId: v.targetId, status: 'ACTIVE', limit: 1 }))
  const activeV = active.data?.items[0]?.version ?? null
  const entries = detail.data?.entries ?? []
  const prep = useWritePrep({ open: entries.length > 0, target: { scope: v.scope, targetId: v.targetId }, candidate: { versionId: v.id }, production })
  const [reason, setReason] = useState('')
  const [confirm, setConfirm] = useState('')
  const [reasonErr, setReasonErr] = useState<string | null>(null)
  const [confirmErr, setConfirmErr] = useState<string | null>(null)
  const [notice, setNotice] = useState<SheetNoticeView | null>(null)
  const [busy, setBusy] = useState(false)

  if (detail.status === 'loading' || active.status === 'loading') return <ConsoleLoading />
  if (detail.status === 'error' && detail.err) {
    if (isIntegrityErr(detail.err.status, detail.err.details)) return <DamagedNote />
    return <ConsoleError message="되돌릴 내용을 불러오지 못했어요." onRetry={detail.reload} />
  }
  const d = detail.data
  if (!d) return null

  const submit = async () => {
    const r = checkReasonInput(reason, production)
    const c = checkConfirmInput(confirm, production)
    setReasonErr(r)
    setConfirmErr(c)
    if (r || c) return
    if (activeV === null) {
      setNotice({ text: '지금 쓰는 버전을 알 수 없어요. 새로 불러와 주세요.', actions: ['reload'], block: true })
      return
    }
    if (production && !prep.ready) {
      setNotice({ text: '운영 되돌리기는 되돌릴 설정으로 기능 테스트를 먼저 통과해야 해요.', actions: [], block: false })
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      onDone(await api.rollback(v.id, prep.meta({ baseVersion: activeV, reason, confirm })))
    } catch (e) {
      const view = writeErrorView(toErr(e), { changeCount: entries.length })
      if (view.kind === 'reason') setReasonErr(view.text)
      else if (view.kind === 'confirm') setConfirmErr(view.text)
      else if (view.kind === 'fields') setNotice({ text: view.errors.map((x) => x.message).join(' · '), actions: [], block: true })
      else setNotice({ text: view.text, actions: view.actions, block: view.block })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p className="text-[14px]">
        지금{activeV !== null ? `(v${activeV})` : ''} 설정을 v{v.version} 내용으로 되돌리면:
      </p>
      {d.droppedKeys.length ? (
        <Note tone="warn" role="note" className="mt-2">
          <b>지금 스키마에 없는 키 {d.droppedKeys.length}개는 빠져요</b>
          <br />
          <span className="font-mono [overflow-wrap:anywhere]">{d.droppedKeys.join(', ')}</span> — 그 사이 설정 형식이 바뀌어 더는 쓰지 않는 키예요.
        </Note>
      ) : null}
      {entries.length === 0 ? (
        <>
          <p className="mt-2 rounded-[14px] border border-dashed border-line px-4 py-6 text-center text-[13px] text-ink2">지금 설정과 내용이 같아 되돌릴 것이 없어요.</p>
          <div className="mt-3 flex">
            <button type="button" onClick={onBack} className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold text-ink">
              돌아가기
            </button>
          </div>
        </>
      ) : (
        <>
          <EntryList entries={entries} />
          {d.truncated ? <p className="mt-1 text-[12px] text-ink2">외 {d.truncated}개</p> : null}
          <p className="mt-2 text-[13px] text-ink2 break-keep">
            새 버전{activeV !== null ? ` v${activeV + 1}` : ''} 이 만들어지고{activeV !== null ? ` v${activeV} 는` : ' 지금 버전은'} “되돌려짐”으로 표시돼요. 이 서버에는 바로, 다른 서버 프로세스에는 30초 안에 반영돼요.
          </p>
          {production ? <PrepTestSection prep={prep} production required label="되돌릴 설정으로 기능 테스트" /> : null}
          <ReasonFields
            reason={reason}
            onReason={(x) => {
              setReason(x)
              setReasonErr(null)
            }}
            reasonError={reasonErr}
            production={production}
            needsConfirm={production}
            confirm={confirm}
            onConfirm={(x) => {
              setConfirm(x)
              setConfirmErr(null)
            }}
            confirmError={confirmErr}
            quick={['응답이 느려져서', '오류가 나서', '적용 전으로 되돌림']}
          />
          {notice ? <SheetNotice notice={notice} onAction={() => onBack()} /> : null}
          <div className="mt-3 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
            {notice?.block ? null : (
              <button type="button" aria-busy={busy || undefined} disabled={busy} onClick={() => void submit()} className="inline-flex h-12 items-center justify-center rounded-xl bg-accent px-4 text-[15px] font-semibold text-on-accent disabled:opacity-60">
                {busy ? '되돌리는 중…' : production ? 'PRODUCTION 에서 되돌리기' : `v${v.version} 내용으로 되돌리기`}
              </button>
            )}
            <button type="button" disabled={busy} onClick={onBack} className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold text-ink disabled:opacity-60">
              돌아가기
            </button>
          </div>
        </>
      )}
    </>
  )
}

function Detail({ v, access, onRollback }: { v: ConfigVersionItemDto; access: ConfigAccess; onRollback: () => void }) {
  const [compare, setCompare] = useState<Compare>('previous')
  const damagedInList = v.integrity !== 'OK'
  const detail = useAdminResource<ConfigVersionDetailDto>(damagedInList ? null : api.versionPath(v.id, compare))
  const damaged = damagedInList || Boolean(detail.err && isIntegrityErr(detail.err.status, detail.err.details))
  const d = detail.data
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <VersionStatusBadge status={v.status} />
        {v.origin === 'BASELINE' ? <NeutralTag>기준선</NeutralTag> : null}
        <DamagedBadge integrity={damaged ? (v.integrity === 'OK' ? 'MALFORMED' : v.integrity) : 'OK'} />
        <span className="text-[13px] text-ink2">
          {formatDateTime(v.createdAt)} · {v.actor?.email ?? '시스템'}
        </span>
      </div>
      <p className="mt-1.5 text-[14px] [overflow-wrap:anywhere]">{v.origin === 'BASELINE' ? '첫 적용 전 값을 기준선으로 남김' : (v.reason ?? '이유 없음')}</p>
      <KeyValueList
        className="mt-2"
        items={[
          { key: 'origin', label: '출처', value: `${v.origin ? ORIGIN_KO[v.origin] : '알 수 없음'}${v.restoredFromVersion !== null ? ` · v${v.restoredFromVersion} 로 되돌림` : ''}` },
          { key: 'test', label: '기능 테스트', value: v.testResult ? (v.testResult.ok ? '통과' : '실패') : '—' },
          { key: 'target', label: '대상', value: `${v.targetName ?? v.targetKey ?? v.targetId} · ${SCOPE_KO[v.scope]}` },
          { key: 'env', label: '환경', value: v.environment },
        ]}
      />
      {damaged ? (
        <DamagedNote />
      ) : (
        <>
          <div className="mt-3">
            <ConsoleSegmented
              ariaLabel="비교 기준"
              options={[
                { value: 'previous' as const, label: '직전 버전과' },
                { value: 'active' as const, label: '지금과' },
              ]}
              value={compare}
              onChange={setCompare}
            />
          </div>
          {detail.status === 'loading' ? <ConsoleLoading /> : null}
          {detail.status === 'error' && detail.err ? <ConsoleError message="버전 정보를 불러오지 못했어요." onRetry={detail.reload} /> : null}
          {d ? (
            <>
              <p className="mt-2 text-[12px] text-ink2">
                {compare === 'previous'
                  ? d.against && 'version' in d.against
                    ? `직전 버전(v${d.against.version})과 비교`
                    : '첫 버전(기준선)이에요 — 아래 스냅샷이 그때 값이에요.'
                  : '지금 저장값과 비교 — 이 버전으로 되돌리면 바뀌는 값'}
              </p>
              {d.entries.length ? <EntryList entries={d.entries} /> : compare === 'active' || d.against ? <p className="mt-2 rounded-[14px] border border-dashed border-line px-4 py-5 text-center text-[13px] text-ink2">바뀐 값이 없어요.</p> : null}
              {d.truncated ? <p className="mt-1 text-[12px] text-ink2">외 {d.truncated}개</p> : null}
              {Object.keys(d.snapshot).length ? (
                <details className="group mt-2">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
                    <span aria-hidden="true" className="inline-block text-ink2 group-open:rotate-90">
                      ▸
                    </span>
                    스냅샷 전체 보기
                  </summary>
                  <pre className="m-0 whitespace-pre-wrap rounded-[10px] bg-surface2 px-2.5 py-2 font-mono text-[12px] leading-[1.5] text-ink [overflow-wrap:anywhere]">{JSON.stringify(d.snapshot, null, 2)}</pre>
                  <p className="mt-1 text-[12px] text-ink2">비밀은 참조 이름만 담겨요.</p>
                </details>
              ) : null}
            </>
          ) : null}
          {v.status === 'ACTIVE' ? (
            <p className="mt-3 text-[13px] text-ink2">지금 쓰는 버전이에요.</p>
          ) : access.canRollback ? (
            <button type="button" onClick={onRollback} className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-line bg-surface px-3.5 text-[14px] font-semibold text-ink">
              v{v.version} 내용으로 되돌리기
            </button>
          ) : access.rollbackProdOnly ? (
            <p className="mt-3 text-[13px] text-ink2">운영(PRODUCTION) 되돌리기는 최고관리자만 할 수 있어요.</p>
          ) : null}
        </>
      )}
    </>
  )
}

export default function ConfigVersionSheet({ v, access, onClose, onRolledBack }: { v: ConfigVersionItemDto | null; access: ConfigAccess; onClose: () => void; onRolledBack: (r: ConfigRollbackResultDto) => void }) {
  const [mode, setMode] = useState<'view' | 'rollback'>('view')
  if (!v) return null
  const title = mode === 'rollback' ? `v${v.version} 내용으로 되돌리기` : `v${v.version} · ${v.targetName ?? v.targetKey ?? v.targetId}`
  return (
    <Sheet open title={title} onClose={onClose}>
      {mode === 'view' ? <Detail v={v} access={access} onRollback={() => setMode('rollback')} /> : <Rollback v={v} access={access} onBack={() => setMode('view')} onDone={onRolledBack} />}
    </Sheet>
  )
}
