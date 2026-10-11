'use client'

/**
 * 도우미 결과 카드 하나(screens §22-5, ②B·③A·⑥A) — 일본어(루비·한글은 앱 표시 스위치) · 한국어 뜻(「번역」 스위치와 무관하게 늘) ·
 * 꼬리표(후보 2개 이상일 때) · 왜 자연스러운지 한 줄(있을 때만) · ▶ 듣기 · (글자 모드) [입력창에 넣기]. 저장 버튼은 없다(AI 는 제안만).
 * 잠긴 동안(녹음·인식·선생님이 답하는 중)에는 카드 버튼이 잠긴다(aria-disabled). 소리 실패 안내는 그 카드 안 아래 한 줄.
 * 두 버튼 모두 누르는 동안 입력칸 초점을 지킨다(`keepInputFocus` — 판이 밀려 click 을 놓치는 것을 막는다, QA-C F-3).
 */
import type { AnnotationState } from '@/components/common/japanese/annotations'
import { JaQuoted } from '@/components/common/japanese/JaQuoted'
import { HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import { Badge } from '@/components/common/ui'
import type { useKeyedSound } from '@/components/scenario/useKeyedSound'
import { SOUND_MSG, SOUND_RETRYING, soundText } from '@/components/vocab/wordSound'
import type { PhraseHelpItem } from '@/types/phraseHelp'
import { HELPER } from './helperCopy'
import { keepInputFocus } from './phraseHelperLogic'

/** PracticeDock 의 GHOST 와 같은 값(§22-5). */
const GHOST = 'inline-flex h-11 min-w-0 items-center justify-center rounded-xl border border-line bg-surface px-3 text-[14px] font-semibold text-ink'

export const helperSoundKey = (index: number) => `helper:${index}`

export default function PhraseHelperCard({
  item,
  index,
  count,
  ann,
  textMode,
  textOnly,
  locked,
  sound,
  onPlay,
  onFill,
}: {
  item: PhraseHelpItem
  index: number
  /** 받은 후보 수 — 2개 이상이면 꼬리표를 단다. */
  count: number
  ann: AnnotationState
  textMode: boolean
  /** 머리 표시등 「자막만」 — ▶ 없음. */
  textOnly: boolean
  /** 도우미가 잠긴 상태(녹음·인식 + 선생님이 답하는 중) */
  locked: boolean
  sound: ReturnType<typeof useKeyedSound>
  onPlay: (index: number, text: string) => void
  onFill: (ja: string) => void
}) {
  const key = helperSoundKey(index)
  const sv = sound.view(key)
  const line = sound.line(key)
  const speakable = soundText(item.ja)
  const playing = sv.phase === 'playing'
  const badge = count >= 2 && !!item.labelKo
  return (
    <li className="flex min-w-0 gap-0.5 rounded-[14px] border border-line bg-surface py-2.5 pl-3 pr-1">
      <div className="min-w-0 flex-1">
        {badge ? <Badge tone="neutral">{item.labelKo}</Badge> : null}
        <JaText text={item.ja} state={ann} rt={11} leading={2.1} className={`${badge ? 'mt-1 ' : ''}text-[17px] text-ink [overflow-wrap:anywhere]`} />
        <HangulLine state={ann} size={13} />
        <p className="mt-0.5 text-[13px] text-ink2 break-keep">{item.ko}</p>
        {item.whyKo ? (
          <p className="mt-1.5 border-l-2 border-line pl-2 text-[13px] text-ink break-keep">
            <JaQuoted text={item.whyKo} />
          </p>
        ) : null}
        {textMode ? (
          <button
            type="button"
            aria-disabled={locked || undefined}
            onPointerDown={keepInputFocus}
            onClick={() => {
              if (!locked) onFill(item.ja)
            }}
            className={`${GHOST} mt-2 ${locked ? 'opacity-40' : ''}`}
          >
            {HELPER.fill}
          </button>
        ) : null}
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
      {!textOnly && speakable ? (
        <button
          type="button"
          aria-label={playing ? HELPER.stop(item.ja) : HELPER.listen(item.ja)}
          aria-busy={sv.busy || undefined}
          aria-disabled={locked || undefined}
          onPointerDown={keepInputFocus}
          onClick={() => {
            if (!locked) onPlay(index, speakable)
          }}
          className={`grid h-11 w-11 flex-none place-items-center rounded-full ${sv.look === 'on' ? 'bg-accent text-on-accent' : 'text-ink'} ${locked ? 'opacity-40' : ''}`}
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
