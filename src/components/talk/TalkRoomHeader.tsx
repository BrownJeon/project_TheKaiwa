'use client'

/**
 * 회화방 머리(screens §9-2 D) 56px — ← · 선생님 아바타 40·이름 · TTS 실행 상태 표시등(§7 그대로) · ⋯.
 * 회화 제목은 360 에서 세 줄 경쟁을 피하려고 보이지 않게(sr-only·목록·메뉴 첫 줄). 56px = 표시등 히트가 목록 첫 버튼과 겹치지 않는 높이.
 */
import Link from 'next/link'
import TeacherAvatar from '@/components/common/TeacherAvatar'
import TtsRuntimeStatusIndicator from '@/components/speech/TtsRuntimeStatusIndicator'
import { TALK_ROOM } from './talkCopy'

export default function TalkRoomHeader({
  teacherName,
  title,
  onMenu,
  onAnnounce,
}: {
  teacherName: string
  title: string | null
  onMenu?: () => void
  onAnnounce?: (msg: string) => void
}) {
  return (
    <header className="flex h-14 min-w-0 flex-none items-center gap-1 border-b border-line bg-surface px-1">
      <Link href="/study/ai?tab=talk" aria-label={TALK_ROOM.back} className="grid h-11 w-11 flex-none place-items-center text-ink">
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
      {onMenu ? (
        <button type="button" aria-label={TALK_ROOM.menu} onClick={onMenu} className="grid h-11 w-11 flex-none place-items-center rounded-full text-ink">
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
