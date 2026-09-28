'use client'

/**
 * 휴대폰 인식 파일 스토어 구독(screens §11-3 B) — 카드·방식 설명·진단 카드가 쓴다. 라우터와 같은 스냅샷이다.
 * 첫 구독·앱 복귀(resume)·`online` 때 **확인만** 한다(`checkModel`) — 받기는 누를 때만(자동 다운로드 금지, Leader ⑬).
 */
import { useEffect, useSyncExternalStore } from 'react'
import { onAppResume } from '@/modules/infra/native'
import { onDeviceModelStore, type ModelSnapshot, type SttClientConfig } from '@/modules/speech/stt/client'

const SERVER_SNAPSHOT: ModelSnapshot = {
  phase: 'unsupported',
  installed: false,
  transfer: 'none',
  updateAvailable: false,
  updating: false,
  totalBytes: null,
  receivedBytes: 0,
  installedBytes: null,
  etaSec: null,
  slow: false,
  requiredBytes: null,
  freeBytes: null,
  error: null,
  cellularConsent: false,
  busy: false,
  justInstalled: false,
  needsConsent: false,
  served: false,
}

const subscribe = (fn: () => void) => onDeviceModelStore().subscribe(fn)
const getSnapshot = () => onDeviceModelStore().snapshot()
const getServerSnapshot = () => SERVER_SNAPSHOT

export function useOnDeviceModel(config: SttClientConfig | null) {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    if (config?.onDevice) onDeviceModelStore().setConfig(config.onDevice)
  }, [config])

  useEffect(() => {
    const store = onDeviceModelStore()
    if (!store.getPlugin()) return
    void store.refresh()
    const onOnline = () => void store.refresh()
    window.addEventListener('online', onOnline)
    const off = onAppResume(() => void store.refresh())
    return () => {
      window.removeEventListener('online', onOnline)
      off()
    }
  }, [])

  const store = onDeviceModelStore()
  return {
    snap,
    download: (allowCellular = false) => store.download({ allowCellular }),
    pause: () => store.pause(),
    remove: () => store.remove(),
    dismissError: () => store.dismissError(),
    declineCellular: () => store.declineCellular(),
    ackInstalled: () => store.ackInstalled(),
    readDiagnostics: () => store.readDiagnostics(),
    preload: (numThreads?: number) => store.preload({ numThreads }),
  }
}
