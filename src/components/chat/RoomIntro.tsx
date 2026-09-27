'use client'

import { TeacherAvatar } from './MessageBubble'

const EXAMPLES = ['こんにちは。はじめまして。', '今日はいい天気ですね。', '週末に映画を見ました。'] as const

/** 빈 채팅방 안내 — 채팅은 대화 중에 고치지 않는다는 것을 먼저 알린다. 예문 칩은 입력창만 채운다(자동 전송 없음). */
export default function RoomIntro({ teacherName, onPick }: { teacherName: string; onPick: (text: string) => void }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 pt-2">
      <div className="flex min-w-0 items-start gap-2">
        <TeacherAvatar name={teacherName} />
        <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-line bg-surface px-3.5 py-2.5">
          <p className="text-[15px] font-semibold break-keep">{teacherName}에게 일본어로 말을 걸어 보세요.</p>
          <p className="mt-1 text-[14px] text-ink2 break-keep">
            채팅에서는 바로 고치지 않아요. 대화를 마치고 &apos;표현 점검&apos;을 누르면 문장마다 고쳐 줘요.
          </p>
        </div>
      </div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {EXAMPLES.map((t) => (
          <button
            key={t}
            type="button"
            lang="ja"
            onClick={() => onPick(t)}
            className="inline-flex h-11 flex-none items-center rounded-full border border-line bg-surface px-3.5 text-[16px] text-ink"
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}
