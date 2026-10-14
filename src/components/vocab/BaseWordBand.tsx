'use client'

/**
 * 처음 한 번 안내 띠(task-068 J9 · §28-6 C, 데모 `.band`) — 머리 줄과 목록 사이, **닫기 전까지** 쪽·조건과 상관없이 보인다.
 * 숫자는 #40 응답 `baseTotal`(기본 단어 전체 수) — 7,755 로 고정하지 않는다(옛 행이 합쳐져 다를 수 있다). 없거나 0 이면 그리지 않는다.
 * 닫으면 이 기기에 기억(`VOCAB_KEYS.baseBand = '1'`). 저장소가 막혀도 `useStoredString` 의 메모리 사본으로 이번 화면에서는 닫힌다.
 * 하이드레이션 전에는 그리지 않는다(서버 그림과 어긋나지 않게). 닫은 뒤 초점은 호출부가 머리 줄로 옮긴다(`onClosed`).
 */
import { BASE_BAND } from './labels'
import { useHydrated, useStoredString, VOCAB_KEYS } from './hooks'

/** 띠를 그리는가 — 순수(시험 T27). */
export function showBaseBand(v: { hydrated: boolean; baseTotal: number | null | undefined; closed: string | null }): boolean {
  return v.hydrated && typeof v.baseTotal === 'number' && v.baseTotal > 0 && v.closed !== '1'
}

export function BaseWordBandView({ n, onClose }: { n: number; onClose: () => void }) {
  return (
    <div role="note" className="mb-2.5 flex items-start gap-1 rounded-xl bg-accent-soft py-2.5 pl-3 pr-1 text-[13px] text-ink">
      <p className="min-w-0 flex-1 pt-0.5 break-keep">
        <b className="block text-[13.5px] font-semibold">{BASE_BAND.title(n)}</b>
        {BASE_BAND.body}
      </p>
      <button type="button" aria-label={BASE_BAND.close} onClick={onClose} className="-mt-2.5 grid h-11 w-11 flex-none place-items-center rounded-full text-ink2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}

export default function BaseWordBand({ baseTotal, onClosed }: { baseTotal: number | null; onClosed: () => void }) {
  const hydrated = useHydrated()
  const [closed, setClosed] = useStoredString(VOCAB_KEYS.baseBand)
  if (!showBaseBand({ hydrated, baseTotal, closed }) || baseTotal === null) return null
  return (
    <BaseWordBandView
      n={baseTotal}
      onClose={() => {
        setClosed('1')
        onClosed()
      }}
    />
  )
}
