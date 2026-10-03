'use client'

/**
 * 회화방 머리(screens §9-2 D) 56px — ← · 선생님 아바타 40·이름 · TTS 실행 상태 표시등(§7 그대로) · ⋯.
 * 회화 제목은 360 에서 세 줄 경쟁을 피하려고 보이지 않게(sr-only·목록·메뉴 첫 줄). 56px = 표시등 히트가 목록 첫 버튼과 겹치지 않는 높이.
 * 계획표 하루 시트에서 연 회화방이면 ← 는 "계획표로"(task-012, `BackBar` 와 같은 규칙).
 * task-010c(결정 a=A): ⋯ 바로 왼쪽에 "모아 둔 교정 N" 칩 — 처리하지 않은 모아 둔 교정이 1개 이상일 때만. 360 폭(<375)은 "교정 N".
 * 숫자가 늘면 잠깐 커졌다 돌아온다(움직임 줄이기면 없음).
 */
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import TeacherAvatar from '@/components/common/TeacherAvatar'
import { usePlanReturn } from '@/components/shell/usePlanReturn'
import TtsRuntimeStatusIndicator from '@/components/speech/TtsRuntimeStatusIndicator'
import { LATER_COPY, TALK_ROOM } from './talkCopy'

export interface LaterChipProps {
  count: number
  /** 늘어날 때마다 바뀐다 — 숫자 튀김 애니메이션 신호. */
  bumpKey: number
  onOpen: () => void
}

function LaterChip({ count, bumpKey, onOpen }: LaterChipProps) {
  const numRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (bumpKey === 0) return
    const el = numRef.current
    if (!el || typeof el.animate !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 450, easing: 'ease-out' })
  }, [bumpKey])
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={LATER_COPY.chipAria(count)}
      className="relative ml-0.5 inline-flex h-8 flex-none items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-soft pl-3 pr-[5px] text-[13px] font-semibold text-ink before:absolute before:inset-x-0 before:-inset-y-1.5"
    >
      <span className="max-[374px]:hidden">{LATER_COPY.chip}</span>
      <span className="hidden max-[374px]:inline">{LATER_COPY.chipShort}</span>
      <b ref={numRef} className="grid h-[22px] min-w-[22px] place-items-center rounded-[11px] bg-accent px-1.5 text-[12px] font-semibold text-on-accent tabular-nums">
        {count}
      </b>
    </button>
  )
}

export default function TalkRoomHeader({
  teacherName,
  title,
  onMenu,
  onAnnounce,
  later,
  menuRef,
}: {
  teacherName: string
  title: string | null
  onMenu?: () => void
  onAnnounce?: (msg: string) => void
  /** 모아 둔 교정 칩(task-010c) — count 0 이면 그리지 않는다. */
  later?: LaterChipProps
  /** 시트를 닫았는데 칩이 사라졌을 때 초점을 ⋯ 로 돌려준다. */
  menuRef?: React.Ref<HTMLButtonElement>
}) {
  const back = usePlanReturn('/study/ai?tab=talk', TALK_ROOM.back)
  return (
    <header className="flex h-14 min-w-0 flex-none items-center gap-1 border-b border-line bg-surface px-1">
      <Link href={back.href} aria-label={back.label} className="grid h-11 w-11 flex-none place-items-center text-ink">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>
      <TeacherAvatar name={teacherName} size="md" />
      <div className="flex min-w-0 flex-1 flex-col items-start pl-1.5">
        <h1 className="max-w-full truncate text-[16px] font-semibold leading-5">
          {teacherName}
          {title ? <span className="sr-only">{TALK_ROOM.srTitle(title)}</span> : null}
        </h1>
        {onAnnounce ? <TtsRuntimeStatusIndicator onAnnounce={onAnnounce} /> : null}
      </div>
      {later && later.count > 0 ? <LaterChip {...later} /> : null}
      {onMenu ? (
        <button ref={menuRef} type="button" aria-label={TALK_ROOM.menu} onClick={onMenu} className="grid h-11 w-11 flex-none place-items-center rounded-full text-ink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        </button>
      ) : null}
    </header>
  )
}
