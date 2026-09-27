'use client'

/**
 * 버전 상세 · 되돌리기(screens.md §10-2 I). view = 직전 버전과 비교(L8a `compare=previous`), confirmRollback = 지금과 비교
 * (`compare=active`) + 이유 + (PRODUCTION) 확인 문구 → 새 버전. 되돌리기는 과거 스냅샷을 새 ACTIVE 로 복제하고 밀려난 직전 ACTIVE 가
 * "되돌려짐"이 된다(기록은 지우지 않는다). 지금과 내용이 같으면 확정 버튼을 그리지 않는다.
 */
import { useEffect, useRef, useState } from 'react'
import { isAbort } from '@/components/common/api'
import { type Err, toErr } from '@/components/common/errors'
import Sheet from '@/components/common/Sheet'
import { Btn, BtnRow, SectionHeader } from '@/components/common/ui'
import type { LexiconRollbackResultDto, LexiconVersionDetailDto } from '@/types/lexicon'
import { ConsoleError, ConsoleLoading } from '../console/ConsoleStates'
import { formatDateTime } from '../console/format'
import KeyValueList from '../console/KeyValueList'
import MonoId from '../console/MonoId'
import { useAdminResource } from '../console/useAdminResource'
import { VersionStatusBadge } from './Badges'
import { type FieldError, validateWriteMeta } from './kana'
import { rollback, versionDetailPath } from './lexiconApi'
import { actorLabel, fieldErrorText, mapServerFieldErrors, NOTICE_ACTION_LABEL, QUICK_REASONS, writeErrorNotice, type WriteNotice } from './lexiconCopy'
import LexiconDiffList, { DiffCounts } from './LexiconDiffList'
import SheetNotice from './SheetNotice'
import type { LexiconAccess } from './useLexiconAccess'
import { focusField } from './focus'
import WriteConfirmFields from './WriteConfirmFields'

function DetailError({ err, onRetry }: { err: Err; onRetry: () => void }) {
  if (err.status === 404) return <p className="text-[14px]">그 버전을 찾을 수 없어요.</p>
  return <ConsoleError message={err.status === 0 ? '연결하지 못했어요. 네트워크를 확인해 주세요.' : '버전 정보를 불러오지 못했어요.'} onRetry={onRetry} />
}

/** 상세 시트 발밑: 사용 중 버전 = 안내 · 쓰기 권한 + 사용 중 번호를 앎 = 되돌리기 버튼 · 그 밖 = 없음. */
export function rollbackSlot(d: Pick<LexiconVersionDetailDto, 'status' | 'version'>, active: number | null, canWrite: boolean): 'current' | 'button' | 'none' {
  if (d.status === 'ACTIVE' || d.version === active) return 'current'
  return canWrite && active !== null ? 'button' : 'none'
}

export function isAllZero(d: Pick<LexiconVersionDetailDto, 'counts'>): boolean {
  const c = d.counts
  return c.added + c.changed + c.disabled + c.enabled === 0
}

export default function VersionDetailSheet({
  version,
  activeVersion,
  access,
  onClose,
  onRolledBack,
  onReloadList,
}: {
  version: number
  activeVersion: number | null
  access: LexiconAccess
  onClose: () => void
  onRolledBack: (res: LexiconRollbackResultDto, target: number) => void
  onReloadList: () => void
}) {
  const [mode, setMode] = useState<'view' | 'confirmRollback'>('view')
  const [reason, setReason] = useState('')
  const [confirm, setConfirm] = useState('')
  const [metaErrors, setMetaErrors] = useState<{ reason?: FieldError; confirm?: FieldError }>({})
  const [notice, setNotice] = useState<WriteNotice | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [knownActive, setKnownActive] = useState<number | null>(null)
  const detail = useAdminResource<LexiconVersionDetailDto>(versionDetailPath(version, 'previous'))
  const against = useAdminResource<LexiconVersionDetailDto>(mode === 'confirmRollback' ? versionDetailPath(version, 'active') : null)
  const shownMode = useRef<'view' | 'confirmRollback' | null>(null)
  useEffect(() => {
    const prev = shownMode.current
    shownMode.current = mode
    if (prev === null || prev === mode) return
    setTimeout(() => document.querySelector<HTMLElement>('[role="dialog"] h2')?.focus(), 0)
  }, [mode])

  const active = Math.max(activeVersion ?? 0, knownActive ?? 0) || null
  const d = detail.data

  const submit = async () => {
    if (submitting || active === null) return
    setNotice(null)
    const meta = validateWriteMeta(reason, confirm, access.needsConfirm)
    if (meta.reason || meta.confirm) {
      setMetaErrors(meta)
      focusField(meta.reason ? 'reason' : 'confirm')
      return
    }
    setSubmitting(true)
    try {
      const res = await rollback(version, { reason: reason.trim(), baseVersion: active, ...(access.needsConfirm ? { confirm: confirm.trim() } : {}) })
      onRolledBack(res, version)
    } catch (e) {
      if (isAbort(e)) return
      const err = toErr(e)
      const cur = err.details.currentVersion
      if (err.status === 409 && typeof cur === 'number') setKnownActive(cur)
      const mapped = mapServerFieldErrors(err)
      if (mapped && (mapped.reason || mapped.confirm)) {
        setMetaErrors({ reason: mapped.reason, confirm: mapped.confirm })
        focusField(mapped.reason ? 'reason' : 'confirm')
      } else setNotice(writeErrorNotice(err, 'rollback', { baseVersion: active }))
    } finally {
      setSubmitting(false)
    }
  }

  const noticeAction = notice?.action
  const sheetNotice = notice
    ? {
        text: notice.text,
        action: noticeAction
          ? {
              label: NOTICE_ACTION_LABEL[noticeAction],
              onClick: () => {
                setNotice(null)
                onReloadList()
                against.reload()
              },
            }
          : undefined,
      }
    : null

  return (
    <Sheet open title={`버전 v${version}`} onClose={onClose} dismissible={!submitting}>
      {mode === 'view' ? (
        detail.status === 'loading' ? (
          <ConsoleLoading />
        ) : detail.err && !d ? (
          <DetailError err={detail.err} onRetry={detail.reload} />
        ) : d ? (
          <>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <VersionStatusBadge status={d.status} />
              <span className="text-[13px] text-ink2">
                {formatDateTime(d.createdAt)} · {actorLabel(d.actor)}
              </span>
            </div>
            <p className="mt-1 text-[14px] [overflow-wrap:anywhere]">{d.changeSummary ?? '요약 없음'}</p>
            <KeyValueList
              className="mt-2"
              items={[
                { key: 'entryCount', label: '항목 수', value: `${d.entryCount}개 (사용 중 ${d.enabledCount})` },
                { key: 'snapshotHash', label: '스냅샷 해시', node: <MonoId value={d.snapshotHash.slice(0, 12)} copy label="스냅샷 해시" /> },
              ]}
            />
            <div className="mt-4">
              <SectionHeader title={d.against ? `직전 버전(v${d.against})과 비교` : '첫 버전'} />
            </div>
            <DiffCounts counts={d.counts} />
            <LexiconDiffList rows={d.rows} truncated={d.truncated} />
            {rollbackSlot(d, active, access.canWrite) === 'current' ? (
              <p className="mt-3 text-[13px] text-ink2">지금 쓰는 버전이에요.</p>
            ) : rollbackSlot(d, active, access.canWrite) === 'button' ? (
              <Btn variant="ghost" className="mt-3 w-full" onClick={() => setMode('confirmRollback')}>
                v{version} 내용으로 되돌리기
              </Btn>
            ) : null}
          </>
        ) : null
      ) : (
        <>
          <p className="text-[14px] break-keep">
            지금(v{active}) 사전을 v{version} 내용으로 되돌리면:
          </p>
          {against.status === 'loading' ? (
            <ConsoleLoading />
          ) : against.err && !against.data ? (
            <DetailError err={against.err} onRetry={against.reload} />
          ) : against.data ? (
            <>
              <DiffCounts counts={against.data.counts} />
              <LexiconDiffList rows={against.data.rows} truncated={against.data.truncated} />
              {isAllZero(against.data) ? (
                <>
                  <p className="mt-2 text-[13px] text-ink">지금 사전과 내용이 같아 되돌릴 것이 없어요.</p>
                  <Btn variant="ghost" className="mt-3 w-full" onClick={() => setMode('view')}>
                    돌아가기
                  </Btn>
                </>
              ) : (
                <>
                  <p className="mt-2 text-[13px] text-ink2 break-keep">
                    새 버전 v{(active ?? 0) + 1} 이 만들어지고 v{active} 는 &apos;되돌려짐&apos;으로 표시돼요. 다음 문장부터 반영돼요.
                  </p>
                  <div className="mt-3">
                    <WriteConfirmFields
                      reason={reason}
                      onReason={(v) => {
                        setReason(v)
                        setMetaErrors((m) => ({ ...m, reason: undefined }))
                      }}
                      confirm={confirm}
                      onConfirm={(v) => {
                        setConfirm(v)
                        setMetaErrors((m) => ({ ...m, confirm: undefined }))
                      }}
                      needsConfirm={access.needsConfirm}
                      quick={QUICK_REASONS.rollback}
                      errors={{
                        reason: metaErrors.reason ? fieldErrorText('reason', metaErrors.reason) : undefined,
                        confirm: metaErrors.confirm ? fieldErrorText('confirm', metaErrors.confirm) : undefined,
                      }}
                    />
                  </div>
                  {sheetNotice ? <SheetNotice notice={sheetNotice} /> : null}
                  <BtnRow>
                    <Btn variant="primary" aria-busy={submitting} onClick={() => void submit()}>
                      {submitting ? '되돌리는 중…' : access.needsConfirm ? 'PRODUCTION 에서 되돌리기' : `v${version} 내용으로 되돌리기`}
                    </Btn>
                    <Btn
                      variant="ghost"
                      disabled={submitting}
                      onClick={() => {
                        setNotice(null)
                        setMode('view')
                      }}
                    >
                      돌아가기
                    </Btn>
                  </BtnRow>
                </>
              )}
            </>
          ) : null}
        </>
      )}
    </Sheet>
  )
}
