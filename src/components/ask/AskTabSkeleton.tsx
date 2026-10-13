'use client'

/**
 * 질문 탭 `/ask` 의 즉시 로딩 화면(task-066 §26-5 F — §17-1 원칙: 정적 요소는 실제, 데이터 칸만 회색). 데이터 요청 없음.
 * 흔한 경우(`/ask` 빈 대화) 기준으로 머리·안내 말풍선·입력 바·범위 줄을 그대로 그리고 모두 `inert`.
 * 입력 바 모양은 기억한 모드(`kaiwa.ask.inputMode`)를 따른다 — 서버 스냅샷은 글자(수화 불일치 없음).
 */
import { useSyncExternalStore } from 'react'
import { readStore } from '@/components/common/storage'
import AppBar from '@/components/shell/AppBar'
import AskGreeting, { AskMicIcon } from './AskGreeting'
import AskHeadTitle from './AskHeadTitle'
import AskHistoryButton from './AskHistoryButton'
import { AskMenuButton } from './AskRoom'
import { ASK_COPY } from './askCopy'
import { ASK_VOICE_COPY } from './askVoiceCopy'
import { ASK_KEYS } from './logic'
import ScopeLine from './ScopeLine'

const noopSubscribe = () => () => {}
const noop = () => {}

export default function AskTabSkeleton() {
  const mode = useSyncExternalStore(
    noopSubscribe,
    () => (readStore('session', ASK_KEYS.inputMode) === 'voice' ? 'voice' : 'text'),
    () => 'text',
  )
  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col bg-ground">
      <AppBar
        title={ASK_COPY.title}
        heading={<AskHeadTitle state="new" />}
        right={
          <div inert className="flex items-center gap-2">
            <AskHistoryButton running={false} newCount={0} />
            <AskMenuButton />
          </div>
        }
      />
      <div className="relative min-h-0 flex-1">
        <div className="relative h-full overflow-hidden px-4 py-3">
          <div inert className="min-w-0">
            <AskGreeting teacherName="선생님" onPick={noop} />
          </div>
        </div>
      </div>
      <div inert>
        {mode === 'voice' ? (
          <div className="flex-none border-t border-line bg-surface px-4 pt-2" style={{ paddingBottom: 8 }}>
            <p className="flex h-6 items-center justify-center text-[13px] text-ink2">{ASK_VOICE_COPY.idle}</p>
            <div className="mt-1 flex justify-center">
              <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-accent text-on-accent">
                <AskMicIcon size={28} />
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-none border-t border-line bg-surface" style={{ paddingBottom: 8 }}>
            <div className="flex min-w-0 items-end gap-2 px-3 pt-2">
              <span className="grid h-11 w-11 flex-none place-items-center rounded-full text-ink2">
                <AskMicIcon size={22} />
              </span>
              <span className="block min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-[16px] leading-6 text-ink3">
                {ASK_COPY.placeholderNew}
              </span>
              <span className="h-11 w-11 flex-none rounded-full bg-accent opacity-40" />
            </div>
          </div>
        )}
      </div>
      <div inert>
        <ScopeLine />
      </div>
    </div>
  )
}
