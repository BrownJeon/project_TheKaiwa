'use client'

/**
 * 뜻 보기 면 카드 바로 아래 듣기 줄(task-059 D3, screens.md §23-5) — [단어 듣기][예문 듣기], 읽을 글이 없는 버튼은 그리지 않는다(한 칸이면 꽉 차게).
 * 표시만 한다: 상태는 덱의 `useWordSound()`, 모양·문구는 `cardFirst.deckSoundView`. **카드 면(제스처 영역) 밖**에 둔다 — 영역 안 버튼은 휴대폰에서 눌리지 않는다.
 * 실패 안내는 이 줄이 아니라 덱 힌트 줄 한 줄로 보인다(높이 예산). 재생 중 알림만 이 줄의 화면 읽기 전용 줄로 낸다.
 */
import { deckSoundLive, deckSoundView, type DeckSoundLook } from './cardFirst'
import type { SoundTarget, WordSoundState } from './wordSound'

const LOOK: Record<DeckSoundLook, string> = {
  idle: 'border-line bg-surface text-ink',
  loading: 'border-line bg-surface text-ink',
  on: 'border-ink bg-ink text-surface',
  mute: 'border-transparent bg-surface2 text-ink2',
  blocked: 'border-line bg-surface text-ink ring-2 ring-accent',
  fail: 'border-bad bg-surface text-bad',
}

function Icon({ kind }: { kind: 'play' | 'stop' | 'spin' }) {
  if (kind === 'spin') {
    return (
      <span
        aria-hidden="true"
        className="h-3.5 w-3.5 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin motion-reduce:opacity-50"
      />
    )
  }
  if (kind === 'stop') {
    return (
      <svg width={11} height={11} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="5" y="5" width="14" height="14" rx="2" />
      </svg>
    )
  }
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 4.5v15l13-7.5z" />
    </svg>
  )
}

function ListenButton({ state, target, text, onPress }: { state: WordSoundState; target: SoundTarget; text: string; onPress: (t: SoundTarget, text: string) => void }) {
  const v = deckSoundView(state, target)
  return (
    <button
      type="button"
      onClick={() => onPress(target, text)}
      aria-label={v.ariaLabel}
      aria-busy={v.busy || undefined}
      className={`flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl border px-2.5 text-[14px] font-semibold ${LOOK[v.look]}`}
    >
      <span aria-hidden="true" className={`grid h-6 w-6 flex-none place-items-center rounded-full ${v.look === 'on' ? 'bg-surface text-ink' : 'bg-surface2'}`}>
        <Icon kind={v.icon} />
      </span>
      <span className="min-w-0 truncate">{v.text}</span>
    </button>
  )
}

export default function DeckListenRow({
  state,
  word,
  ex,
  onPress,
}: {
  state: WordSoundState
  /** 단어 듣기가 읽을 글(`cardFirst.listenTexts`) — null 이면 버튼 없음 */
  word: string | null
  /** 예문 듣기가 읽을 글 — 예문 없음·100자 초과면 null */
  ex: string | null
  /** onClick 안에서 동기로 부른다(오디오 깨우기). */
  onPress: (target: SoundTarget, text: string) => void
}) {
  if (!word && !ex) return null
  const two = !!word && !!ex
  return (
    <div className="flex-none px-4 pb-1">
      <div className={`mx-auto -mt-1 grid w-[80%] max-w-[340px] gap-2 ${two ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {word ? <ListenButton state={state} target="word" text={word} onPress={onPress} /> : null}
        {ex ? <ListenButton state={state} target="ex" text={ex} onPress={onPress} /> : null}
      </div>
      <p role="status" className="sr-only">
        {deckSoundLive(state)}
      </p>
    </div>
  )
}
