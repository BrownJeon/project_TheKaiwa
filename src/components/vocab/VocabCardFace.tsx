'use client'

/**
 * 카드 한 장의 면(screens.md §5-2 B VocabCardFace). 앞면 = 표현(+카드 [읽기] 켬이면 히라가나 루비, 카드 [한글] 켬이면 `[한글]` — task-026 §15-4-6 · task-060),
 * 뒷면 = 표현(저장 읽기 루비는 앱 히라가나 설정과 무관하게 늘 — task-033 C1-A)·`[한글]` + 결과 띠 + 뜻 + 예문(히라가나·`[한글]` 1줄)·번역.
 * 카드 영역은 스크롤할 수 없어(`touch-action:none`) 예문은 2줄·번역 1줄에서 자르고 전체는 결과 화면·단어 상세에서 본다.
 * `[한글]` 줄은 카드에 자리가 없을 때만 뺀다(C2-A, 번역 우선, 되돌림 없음) — 면을 그릴 때 재고, 드래그 중에는 재지 않는다.
 * 뒷면 세로 간격(띠·본문 위 `mt-1.5`, 예문 위 `mt-1`, 예문 `[한글]` 위 0·줄간격 1.3)은 예문 `[한글]` 도 같은 카드에 들어가도록 줄인 값이다(task-083) — `!` 는 `HangulLine` 기본 `mt-0.5`·`leading-[1.5]` 를 이기려는 것.
 * 예문 `[한글]` 을 먼저 빼고, 표제어 `[한글]` 은 표제어와 같은 줄(인라인)이라 세로 자리를 쓰지 않으면 빼도 높이가 안 줄어 늘 둔다.
 * 예문 `[한글]` 을 뺀 뒤에도 넘치고 **표제어 `[한글]` 이 아래 줄로 내려가 자기 줄을 차지할 때만** 그것도 뺀다(긴 표제어·좁은 카드, task-082 r2·r3).
 * **안에 버튼을 두지 않는다**(제스처 영역). `memo` — 드래그 중에는 transform 만 바뀌고 이 면은 다시 그리지 않는다.
 * 카드 우선 세트(task-059): 앞면 안내는 `cardFirst.frontHint`, 보기를 열면 테두리 accent, 결과 띠는 그 카드를 답한 방식대로(객관식 = 맞았어요/틀렸어요).
 */
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { AnnotationState } from '@/components/common/japanese/annotations'
import { useDisplayPrefs } from '@/components/common/japanese/displayPrefs'
import { HangulLine, JaText } from '@/components/common/japanese/JapaneseText'
import type { RubyPiece } from '@/modules/speech/reading/client'
import type { VocabMode } from '@/types/vocab'
import { answeredBy, frontHint } from './cardFirst'
import { surfaceSize, type CardSide } from './deck'
import { resultBand } from './labels'
import type { DeckCard } from './useVocabDeck'

const BAND_TONE = {
  good: 'bg-good-soft text-good',
  bad: 'bg-bad-soft text-bad',
  neutral: 'bg-surface2 text-ink2',
} as const

function Star({ on }: { on: boolean }) {
  if (!on) return null
  return (
    <span className="flex-none text-accent">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
      </svg>
      <span className="sr-only">다시 볼 카드</span>
    </span>
  )
}

/** 본문 상자 안 내용이 상자 아래로 넘쳤는가(C2-A, 데모 `measure()` 와 같은 판정 — 0.5px 넘으면 넘침). */
export function overflowsBody(bodyBottom: number, childBottoms: readonly number[]): boolean {
  return childBottoms.some((b) => b > bodyBottom + 0.5)
}

/**
 * 표제어 `[한글]` 이 표제어 아래 줄로 내려가 자기 줄을 차지하는가 — 입력은 표제어 아랫변 offset(`offsetTop + offsetHeight`)·한글 윗변 offset(`offsetTop`).
 * 같은 줄(인라인)이면 baseline 정렬이라 윗변이 표제어 아랫변보다 위다. 정수 offset 이라 허용 오차 1.
 * transform 에 둔감한 offset 좌표를 쓴다 — 회전 중 `getBoundingClientRect` 는 외접 사각형이 겹쳐 놓친다(task-082 r4).
 */
export function hangulOnOwnLine(headwordBottom: number, hangulTop: number): boolean {
  return hangulTop >= headwordBottom - 1
}

/** 뒷면에서 뺀 `[한글]` 줄 단계 — 0 = 다 보임, 1 = 예문 `[한글]` 뺌, 2 = 표제어 `[한글]` 도 뺌(§15-11-3 B6, 2단계는 그 한글이 자기 줄을 차지할 때만 — task-082 r3). */
export type DropLevel = 0 | 1 | 2

/**
 * 한 번 잰 결과 → 다음 단계. 넘치면 한 단계만 올리고 2단계 뒤에는 더 빼지 않으며 내리지 않는다(되돌림 없음).
 * 0 → 1 은 넘침만으로, 1 → 2 는 넘침 + `headwordWrapped`(표제어 `[한글]` 이 아래 줄)일 때만 — 인라인 한글은 빼도 높이가 안 준다.
 */
export function nextDropLevel(level: DropLevel, overflow: boolean, headwordWrapped = true): DropLevel {
  if (!overflow) return level
  if (level === 0) return 1
  if (level === 1 && headwordWrapped) return 2
  return level
}

/** 단계별 측정값(`overflowAt[i]`·`wrappedAt[i]` = i 단계로 그렸을 때 넘쳤는가·표제어 한글이 아래 줄이었는가) 열에서 최종 단계를 고른다 — 컴포넌트의 재측정 루프와 같은 규칙(`wrappedAt` 생략 = 아래 줄). */
export function pickDropLevel(overflowAt: readonly boolean[], wrappedAt: readonly boolean[] = []): DropLevel {
  let level: DropLevel = 0
  while (level < 2) {
    const next = nextDropLevel(level, overflowAt[level] ?? false, wrappedAt[level] ?? true)
    if (next === level) break
    level = next
  }
  return level
}

function VocabCardFace({
  card,
  side,
  mode,
  showReading,
  peekable,
  ruby,
  hangul,
  backHangul,
  exampleAnn,
}: {
  card: DeckCard
  side: CardSide
  mode: VocabMode
  showReading: boolean
  peekable: boolean
  /** 표제어 루비(저장 읽기 정렬) — 앞면은 카드 [읽기] 켰을 때만, 뒷면은 늘 그린다. 덱이 한 번에 만들어 넘긴다(memo 유지). */
  ruby: RubyPiece[] | null
  /** 앞면 `[한글]`(표제어 분석, 앱 한글 설정) — 카드 [한글] 켰을 때만 덱이 층을 넘기고 끄면 `OFF`(task-060, 옛: [읽기]가 함께 켬). */
  hangul: AnnotationState
  /** 뒷면 표제어 `[한글]`(앱 한글 설정, 카드 [읽기]와 무관). */
  backHangul: AnnotationState
  /** 뒷면 예문 분석(히라가나·`[한글]`). 카드 면 안에서 훅을 부르지 않으려 덱이 한 번에 받아 넘긴다. */
  exampleAnn: AnnotationState
}) {
  const prefs = useDisplayPrefs()
  const shellRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState('')
  const [fontsTick, setFontsTick] = useState(0)
  const [drop, setDrop] = useState<{ key: string; level: DropLevel }>({ key: '', level: 0 })

  // 카드 상자 크기만 본다(ResizeObserver) — 드래그는 바깥 래퍼의 transform 만 바꿔 이 상자 크기는 변하지 않는다.
  useLayoutEffect(() => {
    const el = shellRef.current
    if (!el) return
    const read = () => `${el.offsetWidth}x${el.offsetHeight}`
    setBox(read())
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setBox(read()))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 글꼴이 늦게 로드되면 줄 높이가 달라지므로 한 번 더 잰다(이미 로드됐으면 건너뜀).
  useEffect(() => {
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined
    if (!fonts || fonts.status === 'loaded') return
    let alive = true
    void fonts.ready.then(() => {
      if (alive) setFontsTick((t) => t + 1)
    })
    return () => {
      alive = false
    }
  }, [])

  // 측정 키 — 이 값이 바뀔 때만 한 번 잰다. 예문이 없거나 한글 끔이거나 뒷면이 아니면 재지 않는다.
  const wantMeasure = side === 'back' && !!card.example && prefs.loaded && prefs.showHangul
  const measureKey = wantMeasure
    ? [
        card.order,
        side,
        card.example,
        exampleAnn.s,
        backHangul.s,
        card.answer ?? '',
        card.correctText ?? card.meaning ?? '',
        card.exampleKo ?? '',
        prefs.showFurigana,
        box,
        fontsTick,
      ].join('\u0001')
    : ''
  // 키가 바뀌면 0 단계로 돌아가 줄을 다시 넣은 채 그린다. 같은 키 안에서는 단계가 올라가기만 한다.
  const dropLevel: DropLevel = wantMeasure && drop.key === measureKey ? drop.level : 0

  // 같은 레이아웃 단계에서 재고(0 → 1 → 2, 단계가 바뀌면 이 효과가 다시 돈다) 페인트 전에 끝나 깜박임이 없다. 키가 그대로면 다시 재지 않는다.
  useLayoutEffect(() => {
    if (!measureKey) return
    const body = bodyRef.current
    if (!body) return
    const bottoms = Array.from(body.children, (c) => c.getBoundingClientRect().bottom)
    // 표제어 줄 자식 = [표제어, 표제어 한글] — 한글이 없으면(대기·끔·2단계) 아래 줄이 아니다. offset 좌표는 같은 offsetParent 형제끼리라 래퍼 회전에 영향받지 않는다.
    const kids = headRef.current?.children
    const first = kids && kids.length >= 2 ? kids[0] : null
    const last = kids && kids.length >= 2 ? kids[kids.length - 1] : null
    const headwordWrapped =
      first instanceof HTMLElement && last instanceof HTMLElement && hangulOnOwnLine(first.offsetTop + first.offsetHeight, last.offsetTop)
    const next = nextDropLevel(dropLevel, overflowsBody(body.getBoundingClientRect().bottom, bottoms), headwordWrapped)
    if (next !== dropLevel) setDrop({ key: measureKey, level: next })
  }, [measureKey, dropLevel])

  const shell = 'flex h-full min-w-0 flex-col overflow-hidden rounded-[18px] border bg-surface p-4 shadow-sm'

  if (side === 'front') {
    const hint = frontHint(mode, card, peekable)
    return (
      <div ref={shellRef} className={`${shell} ${card.open && hint ? 'border-accent' : 'border-line'}`}>
        <div className="flex h-6 flex-none justify-end">
          <Star on={card.flagged} />
        </div>
        <div className="grid min-h-0 flex-1 place-items-center text-center">
          <div className="min-w-0">
            <JaText
              text={card.surface}
              state={hangul}
              ruby={showReading ? ruby : null}
              rubyAlways
              leading={1.7}
              rt={16}
              className={`${surfaceSize(card.surface)} line-clamp-3 font-semibold leading-tight [overflow-wrap:anywhere]`}
            />
            <HangulLine state={hangul} size={15} />
          </div>
        </div>
        {hint ? <p className="flex-none text-center text-[12px] text-ink2 break-keep">{hint}</p> : null}
      </div>
    )
  }

  const band = card.answer ? resultBand(card.answer, answeredBy(card, mode) === 'choice' ? 'CHOICE' : 'FLIP') : null
  const meaning = card.correctText ?? card.meaning ?? ''
  return (
    <div ref={shellRef} className={`${shell} border-line`}>
      <div className="flex min-w-0 flex-none items-start gap-2">
        <div ref={headRef} className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
          <JaText
            as="span"
            text={card.surface}
            state={backHangul}
            ruby={ruby}
            rubyAlways
            leading={2}
            rt={11}
            className="block max-w-full truncate text-[22px] font-semibold"
          />
          {dropLevel >= 2 ? null : <HangulLine state={backHangul} size={13} inline />}
        </div>
        <Star on={card.flagged} />
      </div>
      {band ? <p className={`mt-1.5 self-start rounded-lg px-2.5 py-1 text-[13px] font-semibold ${BAND_TONE[band.tone]}`}>{band.text}</p> : null}
      <div ref={bodyRef} className="mt-1.5 min-h-0 flex-1">
        <p className="line-clamp-3 text-[19px] font-semibold break-keep [overflow-wrap:anywhere]">{meaning}</p>
        {card.example ? (
          <div>
            <JaText text={card.example} state={exampleAnn} leading={2.15} className="mt-1 line-clamp-2 text-[16px] leading-[1.6] [overflow-wrap:anywhere]" />
            {dropLevel >= 1 ? null : <HangulLine state={exampleAnn} size={13} className="line-clamp-1! mt-0! leading-[1.3]!" />}
          </div>
        ) : null}
        {card.exampleKo ? <p className="line-clamp-1 text-[14px] text-ink2 break-keep [overflow-wrap:anywhere]">{card.exampleKo}</p> : null}
      </div>
    </div>
  )
}

export default memo(VocabCardFace)
