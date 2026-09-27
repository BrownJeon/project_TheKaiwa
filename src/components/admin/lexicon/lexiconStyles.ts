/**
 * 발음 사전 입력 칸 모양(screens.md §10-2 C) — 단어장 입력(§4-2 B)과 같은 모양을 콘솔 안 상수로 둔다
 * (admin 은 `(app)` 컴포넌트를 import 하지 않는다). 높이 44px, 글자 16px(iOS·안드로이드 확대 방지).
 */
export const INPUT =
  'h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-[16px] text-ink placeholder:text-ink3 aria-[invalid=true]:border-bad'

export const TEXTAREA =
  'block w-full min-w-0 resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-[16px] leading-[1.5] text-ink placeholder:text-ink3 aria-[invalid=true]:border-bad'

/** 칸 아래 오류 한 줄. */
export const FIELD_ERROR = 'mt-1 text-[12px] text-bad break-keep'

/** 칸 아래 도움말 한 줄. */
export const FIELD_HELP = 'mt-1 text-[12px] text-ink2 break-keep'

export const LABEL = 'text-[12.5px] font-medium text-ink2'
