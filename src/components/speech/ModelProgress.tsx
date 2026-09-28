'use client'

/**
 * 휴대폰 인식 파일 받기 진행(screens §11-2 A `ModelProgress`). 막대는 `role=progressbar`, 낭독은 25·50·75·100% 에서만
 * (250ms 진행 이벤트마다 읽지 않는다). 숫자는 `tabular-nums` 로 흔들림 없이.
 */
import { useEffect, useRef, useState } from 'react'
import { formatMB } from '@/components/common/format'
import { MODEL_COPY as C } from './modelCopy'

export default function ModelProgress({
  received,
  total,
  etaSec,
  slow,
  verifying,
  update = false,
}: {
  received: number
  total: number | null
  etaSec: number | null
  slow: boolean
  verifying: boolean
  update?: boolean
}) {
  const pct = total ? Math.min(100, Math.floor((received / total) * 100)) : 0
  const shown = verifying ? 100 : pct
  const [live, setLive] = useState('')
  const said = useRef(0)
  useEffect(() => {
    const step = ([100, 75, 50, 25] as const).find((m) => shown >= m)
    if (step && step > said.current) {
      said.current = step
      setLive(C.milestone[step])
    }
  }, [shown])

  const size = total ? formatMB(total) : null
  const got = formatMB(Math.max(received, 1))
  const eta = slow ? C.slow : etaSec === null ? null : etaSec < 60 ? C.etaUnderMinute : C.etaMinutes(Math.ceil(etaSec / 60))

  return (
    <div className="flex min-w-0 flex-col gap-1.5" aria-busy={verifying || undefined}>
      <p aria-hidden className="text-[15px] text-ink tabular-nums">
        {verifying ? C.verifying : update ? C.progressUpdate(shown) : C.progress(shown)}
      </p>
      <div
        role="progressbar"
        aria-label={C.progressAria}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={shown}
        aria-valuetext={size ? C.progressValueText(got, size) : undefined}
        className="h-2 overflow-hidden rounded-full bg-surface2"
      >
        <div className="h-full rounded-full bg-accent transition-[width] motion-reduce:transition-none" style={{ width: `${shown}%` }} />
      </div>
      {!verifying && size ? (
        <p className="text-[12px] text-ink2 tabular-nums">
          {C.progressBytes(got, size)}
          {eta ? ` · ${eta}` : ''}
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
    </div>
  )
}
