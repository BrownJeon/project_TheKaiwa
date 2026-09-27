'use client'

/** 통합 미리듣기 버튼(screens §7-2 D) — 표시만 한다(상태는 useVoicePreview). 전폭 h-12. */
import { Btn } from '@/components/common/ui'

export type PreviewPhase = 'idle' | 'loading' | 'playing' | 'blocked' | 'cooldown'

export default function VoicePreviewButton({ phase, cooldownSec, disabled, onClick, describedBy }: { phase: PreviewPhase; cooldownSec: number | null; disabled: boolean; onClick: () => void; describedBy?: string }) {
  const label =
    phase === 'loading' ? (
      <>
        <span aria-hidden className="inline-block h-4 w-4 rounded-full border-2 border-ink3 border-t-transparent motion-safe:animate-spin" />
        목소리 만드는 중…
      </>
    ) : phase === 'playing' ? (
      '■ 정지'
    ) : phase === 'blocked' ? (
      '▶ 눌러서 듣기'
    ) : phase === 'cooldown' ? (
      `▶ ${cooldownSec ?? ''}초 뒤에 다시 들을 수 있어요`
    ) : (
      '▶ 현재 설정으로 미리듣기'
    )
  const off = disabled || phase === 'loading' || phase === 'cooldown'
  return (
    <Btn
      variant="ghost"
      className="w-full"
      onClick={onClick}
      disabled={off}
      aria-busy={phase === 'loading' || undefined}
      aria-label={phase === 'playing' ? '미리듣기 정지' : undefined}
      aria-describedby={describedBy}
    >
      {label}
    </Btn>
  )
}
