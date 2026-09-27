'use client'

/**
 * 회화 선생님 말풍선(screens §9-2 E) — `streaming`: SSE `audio` 로 드러난 문장을 `<span>` 으로 잇고 재생 중 문장을 `bg-accent-soft` 로
 * 강조(`aria-busy` — done 뒤 한 번만 낭독) · `done`: 채팅 `TutorBubble`(읽기·번역·문법) + ▶ 다시 듣기, 문장 나눔이 본문과 정확히 같을 때만 강조.
 * 강조는 색만이 아니다 — 배경 + [■ 멈춤] + 이름 줄 "말하는 중" 세 단서.
 */
import { JA_BODY, TutorBubble, TutorRow } from '@/components/chat/MessageBubble'
import type { ChatMessageView } from '@/types/chat'
import ReplayButton, { type ReplayState } from './ReplayButton'
import type { AudioChunkView } from './revealChunks'
import SpeakingBars from './SpeakingBars'
import { TALK_ROOM } from './talkCopy'

const HIGHLIGHT = 'rounded-sm bg-accent-soft text-ink'

function SpeakingLabel() {
  return (
    <span className="inline-flex flex-none items-center gap-1">
      <span aria-hidden="true">·</span>
      <SpeakingBars />
      {TALK_ROOM.speaking}
    </span>
  )
}

export default function TalkTutorBubble({
  message,
  mode,
  chunks,
  hasMore,
  spans,
  teacherName,
  showHeader,
  showTime,
  readingDefault,
  playingIndex,
  speaking,
  replay,
  replayDisabled,
  onReplay,
  onStop,
}: {
  message: ChatMessageView
  mode: 'streaming' | 'done'
  /** streaming: 드러난 앞부분 */
  chunks: AudioChunkView[]
  hasMore: boolean
  /** done: 강조 단위 문장(이은 것 = 본문일 때만), 없으면 본문 통째 */
  spans: string[] | null
  teacherName: string
  showHeader: boolean
  showTime: boolean
  readingDefault: boolean
  /** 이 메시지에서 지금 소리 나는 문장 번호 */
  playingIndex: number | null
  /** 이 메시지가 소리 나는 중(쉼 포함) */
  speaking: boolean
  replay: ReplayState
  replayDisabled: boolean
  onReplay: () => void
  onStop: () => void
}) {
  const headerExtra = speaking ? <SpeakingLabel /> : null

  if (mode === 'streaming') {
    return (
      <TutorRow teacherName={teacherName} showHeader={showHeader} headerExtra={headerExtra}>
        <div aria-busy="true" className="min-w-0 max-w-full rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-2.5">
          <span className="sr-only">{teacherName}:</span>
          <p lang="ja" className={JA_BODY}>
            {chunks.map((c) => (
              <span key={c.chunkIndex} className={playingIndex === c.chunkIndex ? HIGHLIGHT : undefined}>
                {c.text}
              </span>
            ))}
            {hasMore ? (
              <span aria-hidden="true" className="text-ink2">
                …
              </span>
            ) : null}
          </p>
        </div>
        {speaking ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-1 text-[12px] text-ink2">
            <ReplayButton state="playing" idleLabel={TALK_ROOM.replayTutor} ariaLabel={TALK_ROOM.replayTutorAria} onClick={onStop} />
          </div>
        ) : null}
      </TutorRow>
    )
  }

  const body = spans
    ? spans.map((t, i) => (
        <span key={i} className={playingIndex === i ? HIGHLIGHT : undefined}>
          {t}
        </span>
      ))
    : undefined

  return (
    <TutorBubble
      message={message}
      teacherName={teacherName}
      showHeader={showHeader}
      showTime={showTime}
      readingDefault={readingDefault}
      headerExtra={headerExtra}
      body={body}
      actions={
        <ReplayButton
          state={replay}
          idleLabel={TALK_ROOM.replayTutor}
          ariaLabel={TALK_ROOM.replayTutorAria}
          disabled={replayDisabled}
          onClick={replay === 'idle' ? onReplay : onStop}
        />
      }
    />
  )
}
