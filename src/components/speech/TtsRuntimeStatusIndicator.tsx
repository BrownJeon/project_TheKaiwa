'use client'

/**
 * 실행 상태 표시등(screens §7-2 B, speech-platform/16 §12) — 점(10px) + **라벨 상시** + `role="status"`, 색만으로 뜻을 전하지 않는다.
 * 누르면 사유 시트. 상태 전환 안내는 스토어가 전환 1건당 한 번만 내주고(consumeAnnouncement), 받은 화면이 토스트로 띄운다.
 * 엔진명·호스트·연결 키는 어디에도 없다.
 */
import { useEffect, useState } from 'react'
import TtsStatusSheet from './TtsStatusSheet'
import { ariaLabelFor, STATE_LABEL } from './ttsStatusCopy'
import { DOT_CLASS, LABEL_CLASS } from './ttsStatusStyle'
import { useTtsRuntimeStatus } from './useTtsRuntimeStatus'

export default function TtsRuntimeStatusIndicator({ onAnnounce, className = '' }: { onAnnounce?: (message: string) => void; className?: string }) {
  const { snapshot, recheck, consumeAnnouncement } = useTtsRuntimeStatus()
  const [open, setOpen] = useState(false)
  const seq = snapshot.transitionSeq

  useEffect(() => {
    if (!onAnnounce || seq === 0) return
    const msg = consumeAnnouncement(seq)
    if (msg) onAnnounce(msg)
  }, [seq, onAnnounce, consumeAnnouncement])

  const state = snapshot.state
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={ariaLabelFor(state)}
        className={`relative inline-flex max-w-full items-center gap-1.5 rounded text-[12px] leading-4 before:absolute before:-inset-x-2 before:-inset-y-3.5 before:content-[''] focus-visible:outline-2 focus-visible:outline-accent ${className}`}
      >
        <span aria-hidden className={DOT_CLASS[state]} />
        <span role="status" className={`flex-none ${LABEL_CLASS[state]}`}>
          {STATE_LABEL[state]}
        </span>
        <span aria-hidden className="flex-none text-ink3">
          ›
        </span>
      </button>
      <TtsStatusSheet open={open} onClose={() => setOpen(false)} snapshot={snapshot} onRecheck={recheck} />
    </>
  )
}
