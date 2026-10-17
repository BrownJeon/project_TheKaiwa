'use client'

/**
 * 단어 도우미 결과 카드 하나(screens §30-5, D4·D9) — 일본어 20px semibold(루비·한글 줄은 앱 표시 스위치) · 한국어 뜻(늘 보임) · [표현 칸에 넣기] · ▶ 듣기.
 * **꼬리표·「왜」 줄은 그리지 않는다** — 서버가 단어 모드에서 두 칸을 보내지 않고(#181), 혹시 와도 그리지 않는다(props 타입에 두 칸이 없다).
 * 저장 버튼은 없다(AI 는 제안만). 회화방 카드(`talk/PhraseHelperCard`)를 넓히지 않고 모양만 같게 새로 둔다 — talk 는 건드리지 않는다.
 * 두 버튼 모두 누르는 동안 질의 칸 초점을 지킨다(`keepInputFocus` — 키보드가 먼저 내려가 시트가 움직이면 click 을 놓친다).
 */
import type { AnnotationState } from '@/components/common/japanese/annotations'
import { HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import type { useKeyedSound } from '@/components/scenario/useKeyedSound'
import { keepInputFocus } from '@/components/talk/phraseHelperLogic'
import type { WordPhraseHelpItem } from '@/types/phraseHelp'
import { WORD_HELPER } from './wordHelperCopy'
import { wordHelperSoundKey } from './wordHelperLogic'
import { SOUND_MSG, SOUND_RETRYING, soundText } from './wordSound'

export const GHOST = 'inline-flex h-11 min-w-0 items-center justify-center rounded-xl border border-line bg-surface px-3 text-[14px] font-semibold text-ink'

export default function WordHelperCard({
  item,
  index,
  ann,
  sound,
  onPlay,
  onFill,
}: {
  item: WordPhraseHelpItem
  index: number
  ann: AnnotationState
  sound: ReturnType<typeof useKeyedSound>
  onPlay: (index: number, text: string) => void
  onFill: (ja: string) => void
}) {
  const key = wordHelperSoundKey(index)
  const sv = sound.view(key)
  const line = sound.line(key)
  const speakable = soundText(item.ja)
  const playing = sv.phase === 'playing'
  return (
    <li className="flex min-w-0 gap-0.5 rounded-[14px] border border-line bg-surface pb-3 pl-3 pr-1 pt-2.5">
      <div className="min-w-0 flex-1">
        <JaText text={item.ja} state={ann} rt={11} leading={2.1} className="text-[20px] font-semibold leading-[1.6] text-ink [overflow-wrap:anywhere]" />
        <HangulLine state={ann} size={13} />
        <p className="mt-0.5 text-[13px] text-ink2 break-keep [overflow-wrap:anywhere]">{item.ko}</p>
        <button type="button" onPointerDown={keepInputFocus} onClick={() => onFill(item.ja)} className={`${GHOST} mt-2`}>
          {WORD_HELPER.fill}
        </button>
        {line.kind === 'msg' ? (
          <p role={SOUND_MSG[line.msg].role} className={`mt-1 text-[12px] break-keep ${SOUND_MSG[line.msg].tone === 'bad' ? 'text-bad' : 'text-ink2'}`}>
            {SOUND_MSG[line.msg].text}
          </p>
        ) : line.kind === 'retrying' ? (
          <p role="status" className="mt-1 text-[12px] text-ink2">
            {SOUND_RETRYING}
          </p>
        ) : null}
      </div>
      {speakable ? (
        <button
          type="button"
          aria-label={playing ? WORD_HELPER.stopSound(item.ja) : WORD_HELPER.listen(item.ja)}
          aria-busy={sv.busy || undefined}
          onPointerDown={keepInputFocus}
          onClick={() => onPlay(index, speakable)}
          className={`grid h-11 w-11 flex-none place-items-center rounded-full ${sv.look === 'on' ? 'bg-accent text-on-accent' : 'text-ink'}`}
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="5" y="5" width="14" height="14" rx="2" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M7 4.5v15l13-7.5z" />
            </svg>
          )}
        </button>
      ) : null}
    </li>
  )
}
