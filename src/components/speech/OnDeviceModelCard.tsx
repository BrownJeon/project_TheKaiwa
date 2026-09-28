'use client'

/**
 * 휴대폰에서 알아듣기 카드(screens §11-2 A) — 설정 → 음성 인식, 방식 카드 아래·마이크 테스트 위. **앱 + 플러그인일 때만** 그린다
 * (웹·플러그인 없는 셸은 null — DOM 0). 받기는 누를 때만, Wi-Fi 전용 기본, 모바일 데이터는 [데이터로 받기] 명시 동의(이번 실행만).
 * 받는 중·멈춤은 화면을 떠나도 유지된다(스토어 1개). 사용자 문구에 모델·엔진 이름·버전이 없다.
 */
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { Badge, Btn, BtnRow, Card } from '@/components/common/ui'
import { formatMB } from '@/components/common/format'
import AppUpdateSheet from '@/components/shell/AppUpdateSheet'
import { isAppUpdateRequired, useAppUpdate } from '@/components/shell/useAppUpdate'
import { decideRoute, isOnDeviceFailedOver, type SttClientConfig } from '@/modules/speech/stt/client'
import ModelDeleteSheet from './ModelDeleteSheet'
import ModelProgress from './ModelProgress'
import { installedRouteLine, MODEL_COPY as C, modelErrorCopy, type RecognitionMode } from './modelCopy'
import { useOnDeviceModel } from './useOnDeviceModel'

function subscribeOnline(fn: () => void): () => void {
  window.addEventListener('online', fn)
  window.addEventListener('offline', fn)
  return () => {
    window.removeEventListener('online', fn)
    window.removeEventListener('offline', fn)
  }
}

function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine !== false, () => true)
}

export default function OnDeviceModelCard({
  config,
  recognitionMode,
  micBusy = false,
  onToast,
}: {
  config: SttClientConfig | null
  recognitionMode: RecognitionMode | null
  micBusy?: boolean
  onToast: (msg: string) => void
}) {
  const m = useOnDeviceModel(config)
  const { snap } = m
  const titleId = useId()
  const online = useOnline()
  const update = useAppUpdate()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [updateSheet, setUpdateSheet] = useState(false)
  const [readyNote, setReadyNote] = useState(false)
  const [slowShown, setSlowShown] = useState(false)

  // 받기가 끝나면 카드 안 role=status 한 줄(1회). 새 버전이었으면 토스트.
  const { justInstalled, updating } = snap
  const wasUpdating = useRef(false)
  useEffect(() => {
    if (updating) wasUpdating.current = true
  }, [updating])
  useEffect(() => {
    if (!justInstalled) return
    if (wasUpdating.current) onToast(C.updatedToast)
    else setReadyNote(true)
    wasUpdating.current = false
    m.ackInstalled()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 스토어 동작은 안정적이다(싱글턴)
  }, [justInstalled])

  // "확인하는 중…" 은 1초 넘을 때만 보인다(깜빡임 방지).
  useEffect(() => {
    if (snap.phase !== 'checking') return
    const t = setTimeout(() => setSlowShown(true), 1000)
    return () => clearTimeout(t)
  }, [snap.phase])

  if (snap.phase === 'unsupported') return null

  const size = snap.totalBytes ? formatMB(snap.totalBytes) : null
  const need = snap.requiredBytes ? formatMB(snap.requiredBytes) : null
  const offlineMode = recognitionMode === 'OFFLINE'
  const route = decideRoute({
    hasPlugin: true,
    config,
    installed: snap.installed,
    downloading: snap.transfer === 'downloading' || snap.transfer === 'verifying',
    updateRequired: isAppUpdateRequired(),
    failedOver: isOnDeviceFailedOver(),
  })
  const disableDownload = !online || snap.busy
  const lowSpace = snap.freeBytes !== null && snap.requiredBytes !== null && snap.freeBytes < snap.requiredBytes

  const startDownload = (allowCellular = false) => {
    setReadyNote(false)
    void m.download(allowCellular)
  }

  const badge = (() => {
    if (snap.phase === 'installed') return <Badge tone="good">{C.badge.installed}</Badge>
    if (snap.phase === 'downloading' || snap.phase === 'verifying') return <Badge>{C.badge.downloading}</Badge>
    if (snap.phase === 'paused') return <Badge>{C.badge.paused}</Badge>
    if (snap.phase === 'off') return <Badge>{C.badge.off}</Badge>
    if (snap.phase === 'error') return <Badge tone="bad">{C.badge.error}</Badge>
    if (snap.phase === 'absent' || snap.phase === 'needsConsent') return <Badge>{C.badge.absent}</Badge>
    return null
  })()

  const errorBox = (code = snap.error) => {
    if (!code) return null
    const e = modelErrorCopy(code, need)
    const act = () => {
      m.dismissError()
      if (code === 'APP_UPDATE_REQUIRED') setUpdateSheet(true)
      else startDownload(snap.cellularConsent)
    }
    return (
      <div role="alert" className="rounded-xl bg-bad-soft px-3.5 py-3 text-[13px] break-keep text-bad">
        <p className="font-semibold">{e.title}</p>
        <p className="mt-0.5">{e.action}</p>
        <button
          type="button"
          onClick={act}
          disabled={code !== 'APP_UPDATE_REQUIRED' && disableDownload}
          className="inline-flex h-11 items-center font-semibold underline underline-offset-4 disabled:opacity-50"
        >
          {e.button}
        </button>
      </div>
    )
  }

  const consentBox = (
    <div role="status" className="rounded-xl bg-surface2 p-3 text-[13px] break-keep text-ink">
      <p className="font-semibold">{C.consentTitle}</p>
      <p className="mt-0.5 text-ink2">{C.consentBody(size)}</p>
      <BtnRow>
        <Btn variant="ghost" onClick={() => startDownload(true)} disabled={disableDownload}>
          {C.useData}
        </Btn>
        <Btn variant="soft" onClick={m.declineCellular}>
          {C.later}
        </Btn>
      </BtnRow>
    </div>
  )

  const offlineNote = !online ? <p className="text-[12px] text-ink2">{C.offlineNote}</p> : null
  const lowSpaceBox = lowSpace && (snap.phase === 'absent' || snap.phase === 'paused' || (snap.phase === 'installed' && snap.updateAvailable)) ? errorBox('INSUFFICIENT_STORAGE') : null

  let body: React.ReactNode = null
  switch (snap.phase) {
    case 'checking':
      body = slowShown ? <p className="text-[12px] text-ink2">{C.checking}</p> : null
      break
    case 'off':
      body = null
      break
    case 'absent':
      body = (
        <>
          {size ? <p className="text-[12px] text-ink2">{C.meta(size)}</p> : null}
          <p className="text-[13px] text-ink2 break-keep">{C.beforeDownload}</p>
          {lowSpaceBox}
          <Btn className="w-full" onClick={() => startDownload(snap.cellularConsent)} disabled={disableDownload || lowSpace}>
            {C.download(size)}
          </Btn>
          {offlineNote}
        </>
      )
      break
    case 'needsConsent':
      body = consentBox
      break
    case 'downloading':
    case 'verifying':
      body = (
        <>
          <ModelProgress received={snap.receivedBytes} total={snap.totalBytes} etaSec={snap.etaSec} slow={snap.slow} verifying={snap.phase === 'verifying'} />
          {snap.phase === 'downloading' ? (
            <>
              <p className="text-[12px] text-ink2 break-keep">{C.downloadingNote}</p>
              <Btn variant="ghost" className="w-full" onClick={() => void m.pause()}>
                {C.pause}
              </Btn>
            </>
          ) : null}
        </>
      )
      break
    case 'paused':
      body = (
        <>
          <PausedBar received={snap.receivedBytes} total={snap.totalBytes} />
          {lowSpaceBox}
          <Btn className="w-full" onClick={() => startDownload(snap.cellularConsent)} disabled={disableDownload || lowSpace}>
            {C.resume}
          </Btn>
          {offlineNote}
          <button type="button" className="inline-flex h-11 items-center self-start text-[13px] font-semibold text-bad" onClick={() => setDeleteOpen(true)} disabled={snap.busy}>
            {C.discardPartial}
          </button>
        </>
      )
      break
    case 'error':
      body = (
        <>
          {errorBox()}
          {offlineNote}
        </>
      )
      break
    case 'installed': {
      const removeBlocked = offlineMode || micBusy || snap.transfer === 'downloading' || snap.transfer === 'verifying'
      body = (
        <>
          <p className="text-[13px] text-ink break-keep">{installedRouteLine(recognitionMode, route)}</p>
          {snap.installedBytes ? <p className="text-[12px] text-ink2">{C.installedMeta(formatMB(snap.installedBytes))}</p> : null}
          {snap.error ? errorBox() : null}
          {snap.needsConsent ? consentBox : null}
          {updating && (snap.transfer === 'downloading' || snap.transfer === 'verifying') ? (
            <>
              <ModelProgress received={snap.receivedBytes} total={snap.totalBytes} etaSec={snap.etaSec} slow={snap.slow} verifying={snap.transfer === 'verifying'} update />
              {snap.transfer === 'downloading' ? (
                <Btn variant="ghost" className="w-full" onClick={() => void m.pause()}>
                  {C.pause}
                </Btn>
              ) : null}
            </>
          ) : updating && snap.transfer === 'paused' ? (
            <>
              <PausedBar received={snap.receivedBytes} total={snap.totalBytes} />
              <Btn className="w-full" onClick={() => startDownload(snap.cellularConsent)} disabled={disableDownload}>
                {C.resume}
              </Btn>
              {offlineNote}
            </>
          ) : snap.updateAvailable && !snap.needsConsent ? (
            <>
              <div role="status" className="rounded-xl bg-surface2 p-3 text-[13px] break-keep text-ink">
                {C.updateNote(size)}
              </div>
              {lowSpaceBox}
              <Btn className="w-full" onClick={() => startDownload(snap.cellularConsent)} disabled={disableDownload || lowSpace}>
                {C.update}
              </Btn>
              {offlineNote}
            </>
          ) : null}
          <Btn variant="danger" className="w-full" aria-disabled={removeBlocked || undefined} onClick={() => !removeBlocked && setDeleteOpen(true)}>
            {C.remove}
          </Btn>
          {offlineMode ? <p className="text-[12px] text-ink2 break-keep">{C.offlineCannotRemove}</p> : null}
        </>
      )
      break
    }
    default:
      body = null
  }

  const showDesc = snap.phase !== 'installed' && snap.phase !== 'off'
  const knowThis = snap.phase === 'absent' || snap.phase === 'installed'

  return (
    <Card className="mt-3 flex flex-col gap-3">
      <div id="ondevice-card" role="group" aria-labelledby={titleId} className="flex min-w-0 flex-col gap-3 scroll-mt-4">
        <div className="flex min-w-0 items-start gap-2">
          <h4 id={titleId} className="min-w-0 flex-1 text-[15px] font-semibold text-ink">
            {C.title}
          </h4>
          {badge}
        </div>
        {snap.phase === 'off' ? <p className="text-[13px] text-ink2 break-keep">{C.off}</p> : showDesc ? <p className="text-[13px] text-ink2 break-keep">{C.desc}</p> : null}
        {body}
        {readyNote && snap.phase === 'installed' ? (
          <p role="status" className="text-[13px] font-semibold text-good">
            {C.ready}
          </p>
        ) : null}
        {knowThis ? <p className="text-[12px] text-ink2 break-keep">{C.knowThis}</p> : null}
      </div>
      <ModelDeleteSheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        size={snap.installedBytes ? formatMB(snap.installedBytes) : size}
        onConfirm={async () => {
          await m.remove()
          setReadyNote(false)
          onToast(C.removedToast)
        }}
      />
      <AppUpdateSheet open={updateSheet} onClose={() => setUpdateSheet(false)} snapshot={update} />
    </Card>
  )
}

function PausedBar({ received, total }: { received: number; total: number | null }) {
  const pct = total ? Math.min(100, Math.floor((received / total) * 100)) : 0
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div aria-hidden className="h-2 overflow-hidden rounded-full bg-surface2">
        <div className="h-full rounded-full bg-ink3" style={{ width: `${pct}%` }} />
      </div>
      {total ? <p className="text-[12px] text-ink2 tabular-nums">{C.paused(formatMB(Math.max(received, 1)), formatMB(total))}</p> : null}
    </div>
  )
}
