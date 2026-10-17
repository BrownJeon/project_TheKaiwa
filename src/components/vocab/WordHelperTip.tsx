'use client'

/**
 * 처음 한 번 안내 줄(screens §30-3, D6′) — 시트 안 **흐름**에 끼운다(떠 있지 않음): 표현 라벨 줄 바로 아래, 꼬리는 위의 가あ 를 가리킨다.
 * 시트 머리 ✕ 와 표현 입력 칸을 가리지 않는다. `role="note"` 라 나타날 때 낭독하지 않고, 보이는 동안 가あ 의 `aria-describedby` 로 읽힌다.
 * 꼬리 `right-[15px]` + 반폭 7 = 22 = 가あ(44px) 가운데. 가あ 오른쪽 끝 = 시트 본문 오른쪽 끝이라 폭에 따라 움직이는 값이 없다.
 */
import { WORD_HELPER } from './wordHelperCopy'
import { WORD_HELPER_IDS } from './wordHelperLogic'

export default function WordHelperTip({ onClose }: { onClose: () => void }) {
  return (
    <div
      id={WORD_HELPER_IDS.tip}
      role="note"
      className="relative mt-1.5 flex w-[min(100%,236px)] items-start gap-0.5 self-end rounded-[10px] bg-ink py-2 pl-3 pr-0.5 text-[12.5px] leading-[1.45] text-surface break-keep before:absolute before:bottom-full before:right-[15px] before:border-[7px] before:border-transparent before:border-b-ink before:content-['']"
    >
      <p className="min-w-0 flex-1">{WORD_HELPER.tip}</p>
      <button
        type="button"
        aria-label={WORD_HELPER.tipClose}
        onClick={onClose}
        className="relative grid h-7 w-7 flex-none place-items-center rounded-full text-surface before:absolute before:-inset-2 before:content-['']"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}
