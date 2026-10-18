'use client'

/**
 * 즐겨찾기 별(task-074 §32-3, 데모 `r-tap`·`r-pend`·`d-base`) — 목록 행(`row`)과 상세·수정 시트 머리(`sheet`) 공용.
 *
 * 켜짐 = 금색 채움 + 가는 `ink` 윤곽(D8 B2), 꺼짐 = `ink2` 외곽선. 이름은 고정(행 「{단어} 즐겨찾기」 · 시트 「즐겨찾기」)이고 상태는
 * `aria-pressed` 로만 — 이름까지 바꾸면 상태를 두 번·반대로 읽는다(D11 A). 처리 중 잠금은 `disabled` 가 아니라 `aria-disabled` + 눌림 무시
 * (초점을 잃지 않고 「사용 불가」로 읽히지 않게), 보이는 변화 없음(데모 `r-pend`). `title` 없음(낭독 중복).
 * 행 별은 열기 단추의 **형제**(단추 중첩 금지)이고 절대 위치 — 누르는 곳은 `::before` 44×44(위 11·아래 5로 치우침), `text-[18px]` 가
 * `top`(em)의 기준이다(글꼴 배율을 따라간다).
 */
import { FAVORITE_COPY } from './labels'
import type { RowStarTop } from './favorite'

const ROW_BOX =
  "absolute right-[9px] z-[1] grid size-7 place-items-center rounded-lg text-[18px] before:absolute before:-inset-x-2 before:-top-[11px] before:-bottom-[5px] before:content-['']"
const SHEET_BOX = 'grid h-11 w-11 flex-none place-items-center rounded-full'

export default function FavoriteStar(
  props: { on: boolean; locked: boolean; onPress: () => void } & ({ variant: 'row'; surface: string; top: RowStarTop } | { variant: 'sheet' }),
) {
  const { on, locked, onPress } = props
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-disabled={locked || undefined}
      onClick={() => {
        if (!locked) onPress()
      }}
      className={props.variant === 'row' ? ROW_BOX : SHEET_BOX}
      style={props.variant === 'row' ? { top: props.top } : undefined}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M12 3.4l2.62 5.31 5.86.85-4.24 4.13 1 5.84L12 16.77l-5.24 2.76 1-5.84-4.24-4.13 5.86-.85z"
          strokeWidth={2}
          strokeLinejoin="round"
          className={on ? 'fill-warn stroke-ink' : 'fill-none stroke-ink2'}
        />
      </svg>
      <span className="sr-only">
        {props.variant === 'row' ? (
          <>
            <span lang="ja">{props.surface}</span> {FAVORITE_COPY.star}
          </>
        ) : (
          FAVORITE_COPY.star
        )}
      </span>
    </button>
  )
}
