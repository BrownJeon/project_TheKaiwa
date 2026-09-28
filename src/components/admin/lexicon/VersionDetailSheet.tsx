'use client'

/**
 * 버전 상세 · 되돌리기(screens.md §10-2 I). view = 직전 버전과 비교(L8a `compare=previous`), confirmRollback = 지금과 비교
 * (`compare=active` — 지금 항목 표 기준) + 이유 + (PRODUCTION) 확인 문구 → 새 버전. 되돌리기는 과거 스냅샷을 새 ACTIVE 로 복제하고 밀려난 직전
 * ACTIVE 가 "되돌려짐"이 된다(기록은 지우지 않는다). 지금과 내용이 같으면 확정 버튼을 그리지 않는다.
 * 스냅샷이 손상된 버전(`integrity !== 'OK'`, 또는 서버 422 E_SNAPSHOT_INTEGRITY)은 "기록 손상" + 안내만 — 그럴듯한 빈 diff 도,
 * 되돌리기 버튼도 그리지 않는다(Codex C2).
 */
import { useEffect, useRef, useState } from 'react'
import { isAbort } from '@/components/common/api'
import { type Err, toErr } from '@/components/common/errors'
import Sheet from '@/components/common/Sheet'
import { Btn, BtnRow, SectionHeader } from '@/components/common/ui'
import type { LexiconRollbackResultDto, LexiconSnapshotIntegrity, LexiconVersionDetailDto, LexiconVersionDto } from '@/types/lexicon'
import { ConsoleError, ConsoleLoading } from '../console/ConsoleStates'
import { formatDateTime } from '../console/format'
import KeyValueList from '../console/KeyValueList'
import MonoId from '../console/MonoId'
import { useAdminResource } from '../console/useAdminResource'
import { IntegrityBadge, VersionStatusBadge } from './Badges'
import { focusField } from './focus'
import { type FieldError, validateWriteMeta } from './kana'
import { rollback, versionDetailPath } from './lexiconApi'
import {
  actorLabel,
  fieldErrorText,
  INTEGRITY_KO,
  integrityErrorIsTarget,
  integrityErrorText,
  isDamaged,
  isSnapshotIntegrityError,
  mapServerFieldErrors,
  NOTICE_ACTION_LABEL,
  QUICK_REASONS,
  versionCountText,
  writeErrorNotice,
  type WriteNotice,
} from './lexiconCopy'
import LexiconDiffList, { DiffCounts } from './LexiconDiffList'
import SheetNotice from './SheetNotice'
import type { LexiconAccess } from './useLexiconAccess'
import WriteConfirmFields from './WriteConfirmFields'

export const DAMAGED_NO_ROLLBACK = '기록이 손상돼 이 버전으로는 되돌릴 수 없어요.'

/** 상세 불러오기 실패: 손상(422 E_SNAPSHOT_INTEGRITY)은 재시도 없는 안내 · 404 · 그 밖은 재시도. */
export function VersionLoadError({ err, target, onRetry }: { err: Err; target: number; onRetry: () => void }) {
  if (isSnapshotIntegrityError(err)) {
    return (
      <p role="alert" className="mt-2 rounded-xl border border-bad bg-surface px-3 py-2 text-[13px] font-semibold text-bad break-keep">
        {integrityErrorText(err, target)}
      </p>
    )
  }
  if (err.status === 404) return <p className="text-[14px]">그 버전을 찾을 수 없어요.</p>
  return <ConsoleError message={err.status === 0 ? '연결하지 못했어요. 네트워크를 확인해 주세요.' : '버전 정보를 불러오지 못했어요.'} onRetry={onRetry} />
}

/**
 * 상세 시트 발밑: 사용 중 버전 = 안내 · 기록 손상 = 안내(버튼 없음) · 쓰기 권한 + 사용 중 번호를 앎 = 되돌리기 버튼 · 그 밖 = 없음.
 * `knownDamaged` = 목록 값과 별개로 서버가 이 버전을 손상이라고 답했다(422 의 version = 이 버전).
 */
export function rollbackSlot(
  v: { status: LexiconVersionDto['status']; version: number; integrity?: LexiconSnapshotIntegrity | null },
  active: number | null,
  canWrite: boolean,
  knownDamaged = false,
): 'current' | 'damaged' | 'button' | 'none' {
  if (v.status === 'ACTIVE' || v.version === active) return 'current'
  if (knownDamaged || isDamaged(v.integrity)) return 'damaged'
  return canWrite && active !== null ? 'button' : 'none'
}

export function isAllZero(d: Pick<LexiconVersionDetailDto, 'counts'>): boolean {
  const c = d.counts
  return c.added + c.changed + c.disabled + c.enabled === 0
}

/** 버전 머리: 상태·(손상)·시각·작업자 / 요약 / (손상 뜻) / 항목 수·스냅샷 해시. */
export function VersionHead({ v }: { v: LexiconVersionDto }) {
  const damaged = isDamaged(v.integrity)
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <VersionStatusBadge status={v.status} />
        <IntegrityBadge integrity={v.integrity} />
        <span className="text-[13px] text-ink2">
          {formatDateTime(v.createdAt)} · {actorLabel(v.actor)}
        </span>
      </div>
      <p className="mt-1 text-[14px] [overflow-wrap:anywhere]">{v.changeSummary ?? '요약 없음'}</p>
      {damaged ? <p className="mt-1 text-[13px] text-bad break-keep">{INTEGRITY_KO[v.integrity as Exclude<LexiconSnapshotIntegrity, 'OK'>]}</p> : null}
      <KeyValueList
        className="mt-2"
        items={[
          ...(v.rollbackOf !== null ? [{ key: 'rollbackOf', label: '되돌림', value: `v${v.rollbackOf} 로 되돌림` }] : []),
          { key: 'entryCount', label: '항목 수', value: versionCountText(v) },
          { key: 'snapshotHash', label: '스냅샷 해시', node: <MonoId value={v.snapshotHash.slice(0, 12)} copy label="스냅샷 해시" /> },
        ]}
      />
    </>
  )
}

export default function VersionDetailSheet({
  version,
  summary,
  activeVersion,
  access,
  onClose,
  onRolledBack,
  onReloadList,
}: {
  version: number
  /** 목록에 있던 그 버전(상세가 손상으로 거절돼도 머리 정보를 보이게). */
  summary: LexiconVersionDto | null
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
  const [blocked, setBlocked] = useState(false)
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
  const integrityErr = !d && detail.err && isSnapshotIntegrityError(detail.err) ? detail.err : null
  const head: LexiconVersionDto | null = d ?? (integrityErr ? summary : null)
  const targetDamaged = integrityErr ? integrityErrorIsTarget(integrityErr, version) : false
  const slot = head ? rollbackSlot(head, active, access.canWrite, targetDamaged) : 'none'
  const againstIntegrityErr = !against.data && against.err && isSnapshotIntegrityError(against.err) ? against.err : null

  const submit = async () => {
    if (submitting || blocked || active === null) return
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
      if (isSnapshotIntegrityError(err)) {
        // 다시 눌러도 풀리지 않는 데이터 문제 — 확정 버튼을 거두고 안내만.
        setBlocked(true)
        setNotice(writeErrorNotice(err, 'rollback'))
        return
      }
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

  const backToView = (
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
  )

  return (
    <Sheet open title={`버전 v${version}`} onClose={onClose} dismissible={!submitting}>
      {mode === 'view' ? (
        detail.status === 'loading' ? (
          <ConsoleLoading />
        ) : detail.err && !d && !integrityErr ? (
          <VersionLoadError err={detail.err} target={version} onRetry={detail.reload} />
        ) : (
          <>
            {head ? <VersionHead v={head} /> : null}
            {d ? (
              <>
                <div className="mt-4">
                  <SectionHeader title={d.against ? `직전 버전(v${d.against})과 비교` : '첫 버전'} />
                </div>
                <DiffCounts counts={d.counts} />
                <LexiconDiffList rows={d.rows} truncated={d.truncated} />
              </>
            ) : integrityErr ? (
              <VersionLoadError err={integrityErr} target={version} onRetry={detail.reload} />
            ) : null}
            {slot === 'current' ? (
              <p className="mt-3 text-[13px] text-ink2">지금 쓰는 버전이에요.</p>
            ) : slot === 'damaged' ? (
              <p className="mt-3 text-[13px] text-bad break-keep">{DAMAGED_NO_ROLLBACK}</p>
            ) : slot === 'button' ? (
              <Btn variant="ghost" className="mt-3 w-full" onClick={() => setMode('confirmRollback')}>
                v{version} 내용으로 되돌리기
              </Btn>
            ) : null}
          </>
        )
      ) : (
        <>
          <p className="text-[14px] break-keep">
            지금(v{active}) 사전을 v{version} 내용으로 되돌리면:
          </p>
          {against.status === 'loading' ? (
            <ConsoleLoading />
          ) : againstIntegrityErr ? (
            <>
              <VersionLoadError err={againstIntegrityErr} target={version} onRetry={against.reload} />
              <BtnRow>{backToView}</BtnRow>
            </>
          ) : against.err && !against.data ? (
            <VersionLoadError err={against.err} target={version} onRetry={against.reload} />
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
              ) : blocked ? (
                <>
                  {sheetNotice ? <SheetNotice notice={sheetNotice} /> : null}
                  <BtnRow>{backToView}</BtnRow>
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
                    {backToView}
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
