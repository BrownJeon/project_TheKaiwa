'use client'

/**
 * 빈 대화의 안내 말풍선(task-066 §26-5 D, 데모 `greet()`) — 답 카드와 같은 상자. 칩은 **누르면 바로 물어본다**(§25 의 「입력창 채우기」와 다름).
 * 「모르는 일본어는 🎤 로」 상자는 말해 보는 예일 뿐 누르는 기능이 없다(J3). 이 화면에서 만든 대화는 첫 질문 위에 이 말풍선을 남긴다(`MessageList lead`).
 */
import { useId } from 'react'
import TeacherAvatar from '@/components/common/TeacherAvatar'
import { JaRuns } from '@/components/common/japanese/JaRuns'
import { ASK_COPY } from './askCopy'
import { teacherTitle } from './logic'

const G = ASK_COPY.greeting

/** 마이크 그림(회화 글자 바 🎤 와 같은 모양, 크기만 고른다). */
export function AskMicIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}

export default function AskGreeting({ teacherName, onPick }: { teacherName: string; onPick: (q: string) => void }) {
  const lid = useId()
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="flex items-center gap-2 text-[12px] text-ink2">
        <TeacherAvatar name={teacherName} />
        {teacherTitle(teacherName)}
      </p>
      <div className="flex min-w-0 flex-col gap-3 rounded-[6px_16px_16px_16px] border border-line bg-surface px-3.5 py-3">
        <p className="text-[15px] leading-[1.65]">
          {G.leadHead}
          <b className="font-bold">{G.leadBold}</b>
          {G.leadTail}
        </p>
        <div role="group" aria-labelledby={lid} className="flex min-w-0 flex-col gap-2">
          <p id={lid} className="text-[12px] text-ink2">
            {G.chipsLabel}
          </p>
          {G.examples.map((e) => (
            <button
              key={e.q}
              type="button"
              onClick={() => onPick(e.q)}
              className="inline-flex min-h-11 w-full min-w-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-left text-[14px]"
            >
              <span className="inline-flex h-5 flex-none items-center rounded-md bg-surface2 px-1.5 text-[11.5px] font-semibold text-ink2">{e.tag}</span>
              <span className="min-w-0">
                <JaRuns text={e.q} />
              </span>
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 rounded-xl bg-surface2 px-3 py-2.5">
          <h4 className="flex items-center gap-1.5 text-[13px] font-semibold">
            <AskMicIcon size={14} />
            {G.voiceHead}
          </h4>
          <p className="text-[13px] text-ink2">{G.voiceBody}</p>
          <ul lang="ja" className="flex flex-wrap gap-x-3.5 gap-y-1 text-[15px]">
            {G.voiceExamples.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
