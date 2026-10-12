'use client'

/**
 * 처음 한 번 안내 말풍선(screens §22-4, ④B) — VoiceBar 를 감싼 `relative` 상자 기준으로 도우미 버튼 위에 뜬다.
 * 위치 = 도우미가 바 우측 끝 44 칸이라 말풍선 오른쪽 끝을 바 오른쪽에서 16px(= VoiceBar 의 px-4, 도우미 오른쪽 가장자리)에 둔다 —
 * 폭에 따라 움직이는 값이 없어 화면 밖으로 나가지 않고, 꼬리(`right-[15px]` + 반폭 7 = 22)는 도우미 가운데(44/2)에 선다.
 * VoiceBar 의 px-4 · 우측 44 칸이 바뀌면 같이 고친다. `role="note"` 라 나타날 때 낭독하지 않고, 보이는 동안 버튼 `aria-describedby` 로 읽힌다.
 */
import { HELPER } from './helperCopy'

export const HELPER_TIP_ID = 'talk-helper-tip'

export default function PhraseHelperTip({ onClose }: { onClose: () => void }) {
  return (
    <div
      id={HELPER_TIP_ID}
      role="note"
      className="absolute bottom-[calc(100%+8px)] right-4 z-[5] flex w-[196px] items-start gap-0.5 rounded-[10px] bg-ink py-2 pl-3 pr-0.5 text-[12.5px] leading-[1.45] text-surface break-keep shadow-[0_6px_16px_rgba(0,0,0,.18)]"
    >
      <p className="min-w-0 flex-1">{HELPER.tip}</p>
      <button
        type="button"
        aria-label={HELPER.tipClose}
        onClick={onClose}
        className="relative grid h-7 w-7 flex-none place-items-center rounded-full text-surface before:absolute before:-inset-2 before:content-['']"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <span aria-hidden="true" className="absolute right-[15px] top-full border-[7px] border-transparent border-t-ink" />
    </div>
  )
}
