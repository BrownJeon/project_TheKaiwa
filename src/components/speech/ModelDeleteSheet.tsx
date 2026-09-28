'use client'

/**
 * 휴대폰 인식 파일 지우기 확인 시트(screens §11-2 A `ModelDeleteSheet`). 지우는 중에는 닫히지 않는다.
 * 실패는 시트 안 한 줄(녹음·받기 중이면 BUSY 문구).
 */
import { useState } from 'react'
import Sheet from '@/components/common/Sheet'
import { Btn } from '@/components/common/ui'
import { MODEL_DELETE_COPY as C } from './modelCopy'

export default function ModelDeleteSheet({ open, onClose, onConfirm, size }: { open: boolean; onClose: () => void; onConfirm: () => Promise<void>; size: string | null }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError((e as { code?: unknown })?.code === 'BUSY' ? C.busy : C.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} title={C.title} onClose={() => { setError(null); onClose() }} dismissible={!busy}>
      <p className="break-keep text-[15px] text-ink">{C.body(size)}</p>
      <p className="mt-1 break-keep text-[13px] text-ink2">{C.sub(size)}</p>
      {error ? (
        <p role="alert" className="mt-2 break-keep text-[13px] text-bad">
          {error}
        </p>
      ) : null}
      <Btn variant="danger" className="mt-4 w-full" onClick={confirm} disabled={busy}>
        {busy ? C.deleting : C.confirm}
      </Btn>
      <Btn variant="ghost" className="mt-2 w-full" onClick={onClose} disabled={busy}>
        {C.cancel}
      </Btn>
    </Sheet>
  )
}
