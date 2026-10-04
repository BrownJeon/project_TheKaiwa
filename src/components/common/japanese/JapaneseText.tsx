'use client'

/**
 * 일본어 표시 층(task-026, screens §15-1·§15-2 F·G) — 한 블록 안 위→아래: 히라가나(한자 위 `<rt>`) → 본문 → `[한글]` 한 줄 → 번역.
 * - `JaText`: 루비 + 범위 겹치기(문장 강조·교정 diff·비교 밑줄). 루비 줄간격은 한자가 있고 히라가나 켬일 때만, 분석을 기다리는 동안에도 미리 넓힌다.
 * - `HangulLine`: `hangulLine()` 결과만(화면이 변환 규칙을 만들지 않는다). 기다리는 동안 같은 높이의 옅은 막대.
 * - rt·한글 줄은 `select-none`(복사에 섞이지 않게), rt 는 `aria-hidden`(본문과 겹쳐 두 번 읽힘), 한글 줄은 "한글 발음: …" 으로 읽힌다.
 * - `DisplayToggles`·`DisplayBar`: 앱 전체 표시 스위치(`useDisplayPrefs`). 성공 토스트는 호스트가, 저장 실패 토스트는 앱 셸이 띄운다.
 */
import { hangulLine, hasKanji, rubyPieces } from '@/modules/speech/reading/client'
import { cutRubyByRanges, plainPieces, type AnnotationState, type TextRange } from './annotations'
import type { RubyPiece } from '@/modules/speech/reading/client'
import { useRef } from 'react'
import { clearFreshSuccessToast, DISPLAY_COPY, DISPLAY_TOAST_MS, TOGGLE_KEY, useDisplayPrefs, useDisplaySaveFailure, type ToggleKey } from './displayPrefs'

const RT_CLASS: Record<11 | 13 | 16, string> = {
  11: 'text-[11px]',
  13: 'text-[13px]',
  16: 'text-[16px]',
}

/** 루비가 붙는 블록의 줄간격(데모 `.fu`) — 본문 클래스의 leading 을 이기도록 style 로 넣는다. */
export type RubyLeading = 1.7 | 1.8 | 1.95 | 2 | 2.1 | 2.15

function Ruby({ piece, rt }: { piece: RubyPiece; rt: 11 | 13 | 16 }) {
  if (!piece.reading) return <>{piece.text}</>
  return (
    <ruby className="[ruby-align:center] [ruby-position:over]">
      {piece.text}
      <rt aria-hidden="true" className={`${RT_CLASS[rt]} font-normal leading-none tracking-normal text-ink2 select-none`}>
        {piece.reading}
      </rt>
    </ruby>
  )
}

/** 히라가나를 그릴 상태인가(분석 결과에 읽기 조각이 하나라도 있을 때). */
function rubyOf(state: AnnotationState, showFurigana: boolean): RubyPiece[] | null {
  if (!showFurigana || state.s !== 'ready') return null
  const pieces = rubyPieces(state.segments)
  return pieces.some((p) => p.reading) ? pieces : null
}

export function JaText({
  text,
  state,
  className,
  ranges,
  as: Tag = 'p',
  leading = 2.1,
  rt = 11,
  ruby: givenRuby,
  rubyAlways = false,
}: {
  text: string
  state: AnnotationState
  className?: string
  ranges?: TextRange[]
  as?: 'p' | 'span'
  /** 루비가 있을(또는 기다리는) 때 줄간격 */
  leading?: RubyLeading
  rt?: 11 | 13 | 16
  /** 단어 표제어처럼 저장 읽기로 이미 만든 루비(있으면 `state` 대신 쓴다). */
  ruby?: RubyPiece[] | null
  /** 주어진 `ruby` 를 앱 히라가나 설정과 무관하게 그린다 — 오늘의 단어 카드는 카드 [읽기] 가 정한다(§15-4-6). */
  rubyAlways?: boolean
}) {
  const prefs = useDisplayPrefs()
  const showFu = prefs.loaded && prefs.showFurigana
  const pieces = givenRuby !== undefined ? (showFu || rubyAlways ? givenRuby : null) : rubyOf(state, showFu)
  const reserve = givenRuby !== undefined ? !!pieces : showFu && hasKanji(text) && (state.s === 'loading' || !!pieces)
  const runs = cutRubyByRanges(pieces ?? plainPieces(text), ranges)
  return (
    <Tag lang="ja" className={className} style={reserve ? { lineHeight: leading } : undefined}>
      {runs.map((run, i) => {
        const inner = run.pieces.map((p, k) => <Ruby key={k} piece={p} rt={rt} />)
        if (!run.range) return <span key={i}>{inner}</span>
        const R = run.range.as ?? 'span'
        return (
          <R key={i} className={run.range.className}>
            {inner}
          </R>
        )
      })}
    </Tag>
  )
}

const HANGUL_SIZE: Record<12 | 12.5 | 13 | 14 | 15, string> = {
  12: 'text-[12px]',
  12.5: 'text-[12.5px]',
  13: 'text-[13px]',
  14: 'text-[14px]',
  15: 'text-[15px]',
}

/**
 * 분석을 기다리는 동안 한글 줄 자리. 기본은 막대 + 위아래 여백(18px — 바로 아래 번역 칸의 위 여백과 겹쳐 더 줄어든다).
 * `asLine` 이면 자리를 실제 한글 줄과 같은 높이(위 2 + 줄 19.5)로 잡고 막대를 가운데에 둔다 — 아래 번역 칸이 있어도 분석이 도착할 때
 * 말풍선이 거의 안 밀린다(내 말풍선, task-030 QA-L3). 막대 모양은 같다.
 */
export const HANGUL_LINE_SLOT_CLASS = 'mt-0.5 flex h-[19.5px] items-center'

export function HangulPlaceholder({ onTint = false, className = '', asLine = false }: { onTint?: boolean; className?: string; asLine?: boolean }) {
  const bar = `block h-3 w-[62%] rounded-md motion-safe:animate-pulse ${onTint ? 'bg-surface' : 'bg-surface2'}`
  if (asLine)
    return (
      <span aria-hidden="true" className={`${HANGUL_LINE_SLOT_CLASS} ${className}`}>
        <span className={bar} />
      </span>
    )
  return <span aria-hidden="true" className={`mb-1 mt-1.5 ${bar} ${className}`} />
}

export function HangulLine({
  state,
  size = 13,
  inline = false,
  onTint = false,
  as,
  className = '',
  waitAsLine = false,
}: {
  state: AnnotationState
  size?: 12 | 12.5 | 13 | 14 | 15
  /** 기다리는 동안 자리를 한글 줄 높이로 잡는다(내 말풍선) — `HangulPlaceholder` 의 `asLine`. */
  waitAsLine?: boolean
  /** 버튼 안처럼 `<p>` 를 둘 수 없는 자리는 'span'(블록으로 그린다). 기본은 inline 이면 span, 아니면 p. */
  as?: 'p' | 'span'
  /** 칩 안 같은 흐름(일본어 뒤 `<span>`) */
  inline?: boolean
  /** 색 바탕(내 말 말풍선·교정 칸) 위 — 막대를 `surface` 로 */
  onTint?: boolean
  className?: string
}) {
  const prefs = useDisplayPrefs()
  if (!prefs.loaded || !prefs.showHangul) return null
  if (state.s === 'loading') return inline ? null : <HangulPlaceholder onTint={onTint} asLine={waitAsLine} />
  if (state.s !== 'ready') return null
  const h = hangulLine(state.segments)
  if (!h) return null
  const Tag = as ?? (inline ? 'span' : 'p')
  return (
    <Tag
      lang="ko"
      className={`${inline ? '' : size === 15 ? 'mt-1 block' : 'mt-0.5 block'} ${HANGUL_SIZE[size]} leading-[1.5] text-ink2 select-none [overflow-wrap:anywhere] [word-break:normal] ${className}`}
    >
      <span className="sr-only">{DISPLAY_COPY.hangulSr}</span>
      <span aria-hidden="true" className="text-ink3">
        [
      </span>
      {h}
      <span aria-hidden="true" className="text-ink3">
        ]
      </span>
    </Tag>
  )
}

/**
 * 저장 실패 알림은 앱 셸(`DisplaySaveNotice`)이 띄운다. 방금 이 화면이 띄운 성공 토스트가 아직 떠 있으면 지워 두 토스트가 겹치지 않게 한다
 * (빈 문구 = 숨김). 반환값은 성공 토스트를 띄운 시각을 남기는 함수.
 */
export function useClearSuccessOnSaveFail(onToast: (msg: string, ms?: number) => void): () => void {
  const shownAt = useRef(0)
  useDisplaySaveFailure(() => clearFreshSuccessToast(shownAt.current, Date.now(), onToast))
  return () => {
    shownAt.current = Date.now()
  }
}

export function DisplayToggles({ keys, onToast }: { keys: ToggleKey[]; onToast: (msg: string, ms?: number) => void }) {
  const prefs = useDisplayPrefs()
  const markShown = useClearSuccessOnSaveFail(onToast)
  return (
    <>
      {keys.map((k) => {
        const key = TOGGLE_KEY[k]
        const on = prefs.loaded && prefs[key]
        return (
          <button
            key={k}
            type="button"
            aria-pressed={on}
            aria-disabled={!prefs.loaded || undefined}
            onClick={() => {
              if (!prefs.loaded) return
              const next = !prefs[key]
              prefs.set(key, next)
              onToast(DISPLAY_COPY.toast[k][next ? 1 : 0], DISPLAY_TOAST_MS)
              markShown()
            }}
            className={`relative h-8 flex-none whitespace-nowrap rounded-full border px-3 text-[13px] before:absolute before:inset-x-0 before:-inset-y-[7px] before:content-[''] ${
              on ? 'border-ink bg-ink font-semibold text-surface' : 'border-line bg-surface text-ink'
            } ${prefs.loaded ? '' : 'opacity-50'}`}
          >
            {on ? (
              <span aria-hidden="true" className="mr-[3px]">
                ✓
              </span>
            ) : null}
            {DISPLAY_COPY.label[k]}
          </button>
        )
      })}
    </>
  )
}

/**
 * 회화방·채팅방 머리 바로 아래 표시 바(E3-A) — 고정 머리의 일부(목록 스크롤 밖). 바 아래 선은 border 가 아니라 안쪽 1px 그림자 —
 * border 면 안쪽 높이가 43px 라 토글 터치 영역(`overflow-x-auto` 가 위아래를 자른다)이 41px 가 된다(task-030 QA-L2). 선의 색·자리는 같다.
 */
export function DisplayBar({ onToast }: { onToast: (msg: string, ms?: number) => void }) {
  return (
    <div
      role="group"
      aria-label={DISPLAY_COPY.barGroup}
      className="flex h-11 min-w-0 flex-none items-center gap-1.5 overflow-x-auto bg-surface px-3 shadow-[inset_0_-1px_0_var(--color-line)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <span aria-hidden="true" className="mr-0.5 flex-none text-[12px] text-ink2">
        {DISPLAY_COPY.barCaption}
      </span>
      <DisplayToggles keys={['fu', 'hg', 'tr']} onToast={onToast} />
    </div>
  )
}
