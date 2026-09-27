'use client'

/** 빈 회화방 안내(screens §9-2 E TalkIntro) — 예문은 누르는 기능 없이 "말로 해 보는 예"만 보인다. */
import TeacherAvatar from '@/components/common/TeacherAvatar'
import { TALK_ROOM } from './talkCopy'

export default function TalkIntro({ teacherName }: { teacherName: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2 pt-2">
      <TeacherAvatar name={teacherName} />
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-line bg-surface px-3.5 py-2.5">
        <p className="text-[15px] font-semibold break-keep">{TALK_ROOM.introLead(teacherName)}</p>
        <p className="mt-1 text-[14px] text-ink2 break-keep">{TALK_ROOM.introHow}</p>
        <p className="mt-1 text-[14px] text-ink2 break-keep">{TALK_ROOM.introFix}</p>
        <p className="mt-2 text-[13px] text-ink2 break-keep">{TALK_ROOM.introTry}</p>
        <ul className="mt-1 flex min-w-0 flex-col gap-0.5">
          {TALK_ROOM.introExamples.map((t) => (
            <li key={t} lang="ja" className="text-[15px] text-ink2 [overflow-wrap:anywhere]">
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
