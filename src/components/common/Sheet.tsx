'use client'

/**
 * 공용 바텀시트(screens.md §3-2 H). 새 채팅·교정 채택·채팅 메뉴가 쓰고 task-008 하위 화면도 쓴다.
 *
 * `document.body` 로 포털한다 — 채팅방은 목록이 스크롤 컨테이너라 그 안에 두면 `fixed` 가
 * 컨테이너 쿼리·overflow 에 휘말린다. 열린 동안 앱 셸 `main` 의 스크롤을 잠가 뒤 화면이 따라 움직이지 않게 한다.
 */
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

/** 대화상자 이름·설명 연결. `describedBy` 가 없으면 `aria-describedby` 를 내지 않는다(설명을 쓰지 않는 기존 시트는 그대로). */
export function dialogAria(titleId: string, describedBy?: string): { 'aria-labelledby': string; 'aria-describedby'?: string } {
  return describedBy ? { 'aria-labelledby': titleId, 'aria-describedby': describedBy } : { 'aria-labelledby': titleId }
}

export default function Sheet({
  open,
  title,
  onClose,
  dismissible = true,
  describedBy,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  /** false 면 배경 탭·Esc·✕ 로 닫지 않는다(제출 중). */
  dismissible?: boolean
  /** 열렸을 때 스크린리더가 제목 다음에 읽을 설명 요소의 id(되돌릴 수 없는 확인처럼 본문을 건너뛰면 안 되는 시트). 안에 그 요소가 있을 때만 넘긴다. */
  describedBy?: string
  children: React.ReactNode
}) {
  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    titleRef.current?.focus()
    const main = document.querySelector<HTMLElement>('[data-app-shell] main')
    const prevOverflow = main?.style.overflow ?? ''
    if (main) main.style.overflow = 'hidden'
    return () => {
      if (main) main.style.overflow = prevOverflow
      opener?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open || !dismissible) return
    // 안쪽 요소가 Esc 를 이미 처리했으면(`preventDefault` — 단어 도우미 판·녹음 취소) 시트는 닫지 않는다. React 이벤트 리스너도 `document` 에 있어
    // `stopPropagation` 으로는 같은 대상의 이 리스너를 막을 수 없고, React 의 리스너가 먼저 등록돼 있어 이 시점엔 `defaultPrevented` 가 이미 켜져 있다.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, dismissible, onClose])

  // `open` 은 늘 클라이언트 상태로 시작(false)하므로 서버 렌더와 어긋나지 않는다.
  if (!open || typeof document === 'undefined') return null

  // 키보드(task-021 R4): 시트는 통째로 키보드 위 — 바깥 상자의 아래 끝이 키보드 위로 올라가고(`--kb-inset`, 화면이 줄어드는
  // 환경에선 0 이고 상자 자체가 줄어든다), 최대 높이는 남은 높이의 85%. 입력 칸 여유 스크롤은 `KeyboardInset` 이 시트 본문만 옮긴다.
  // 주 버튼은 내용 끝 제자리(사용자 결정 D2 A).
  return createPortal(
    <div className="fixed inset-x-0 top-0 z-40" style={{ bottom: 'var(--kb-inset, 0px)' }}>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-ink/40"
        onClick={() => {
          if (dismissible) onClose()
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        {...dialogAria(titleId, describedBy)}
        className="absolute inset-x-0 bottom-0 flex max-h-[85%] min-w-0 flex-col rounded-t-2xl bg-surface shadow-xl min-[900px]:left-1/2 min-[900px]:w-[480px] min-[900px]:-translate-x-1/2"
      >
        <div className="flex h-[52px] flex-none items-center gap-2 border-b border-line pl-4 pr-1">
          <h2 id={titleId} ref={titleRef} tabIndex={-1} className="min-w-0 flex-1 truncate text-[17px] font-semibold outline-none">
            {title}
          </h2>
          <button
            type="button"
            aria-label="닫기"
            aria-disabled={!dismissible || undefined}
            onClick={() => {
              if (dismissible) onClose()
            }}
            className={`grid h-11 w-11 flex-none place-items-center rounded-full text-ink2 ${dismissible ? '' : 'opacity-40'}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3"
          style={{ paddingBottom: 'max(16px, var(--safe-bottom))' }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
