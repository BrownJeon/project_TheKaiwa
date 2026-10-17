'use client'

/**
 * 단어 추가 시트의 일본어 도우미 패널(screens §30-4·§30-6, D2·D3) — 1단계 표현 블록 아래·[뜻 채우기] 위에 끼는 **인라인** 패널.
 * 머리 → 질의 줄([물어보기]) → 안내 줄 → 본문(예시 칩 · 찾는 중 · 첫 카드 + [다른 후보 n개 더 보기] · 빈 결과 · 실패 · 429).
 * 패널 안에 마이크·저장 버튼·`<form>` 이 없다: 패널은 1단계 `<form onSubmit={뜻 채우기}>` **안**이라 중첩 form 이 안 되고, 질의 칸 Enter 는 늘 막는다(§30-11 ①).
 * 안의 모든 버튼은 `type="button"` — 하나라도 submit 이면 그 버튼이 폼의 「기본 버튼」이 되어 표현 칸 Enter 가 [물어보기]를 누른다.
 * 스크롤 상자가 아니다(회화방 판의 `overflow-y-auto`·`data-kb-docked`·키보드 숨김을 베끼지 않는다): 시트 본문이 유일한 스크롤이고, 키보드가 올라와도 본문을 숨기지 않는다.
 * 안내 줄·낭독 줄은 늘 마운트(라이브 영역을 새로 만들지 않는다), 실패 4종만 새로 그리는 `alert` 상자. 공용 `Skeleton` 은 `surface2` 바탕에서 안 보여 쓰지 않는다.
 * 보낸 뒤 초점은 [물어보기]로 옮긴다 — `blur()` 는 초점을 `body` 로 보내 대화상자 밖으로 Tab 이 샌다.
 */
import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { OFF, useAnnotations } from '@/components/common/japanese/annotations'
import { HELPER_PANEL_ID } from '@/components/talk/PhraseHelperButton'
import { keepInputFocus } from '@/components/talk/phraseHelperLogic'
import type { WordHelper } from './useWordPhraseHelper'
import WordHelperCard, { GHOST } from './WordHelperCard'
import { WORD_HELPER } from './wordHelperCopy'
import { helperQueryKeyDown, panelEscapeKeyDown, WORD_HELPER_IDS } from './wordHelperLogic'

const BOX = 'flex flex-col items-start gap-2 rounded-xl bg-surface px-3 py-2.5'
const TEXT = 'text-[13px] text-ink break-keep'

export interface WordPhraseHelperProps {
  h: WordHelper
  qRef: RefObject<HTMLInputElement | null>
  askRef: RefObject<HTMLButtonElement | null>
  /** ✕·Esc — 판을 닫고 초점은 가あ 로(닫는 길이 하나라 초점 복귀가 같다). */
  onClose: () => void
  /** [표현 칸에 넣기] */
  onFill: (ja: string) => void
}

export default function WordPhraseHelper({ h, qRef, askRef, onClose, onFill }: WordPhraseHelperProps) {
  // 같은 사용자 동작 안(패널 마운트 커밋) 한 번 — 키보드가 뜨는 것은 사용자가 가あ 를 누른 결과다. 이전 답이 있으면 초점은 가あ 그대로.
  const focusOnOpenRef = useRef(h.fresh)
  useLayoutEffect(() => {
    if (focusOnOpenRef.current) qRef.current?.focus()
  }, [qRef])

  const ann = useAnnotations(h.items.map((x) => x.ja))
  const msg = h.msg

  // 보냈을 때만(막히면 질의 칸 초점·키보드 그대로) 초점을 [물어보기]로 옮겨 키보드를 내린다.
  const sentFocus = (sent: boolean) => {
    if (sent) askRef.current?.focus({ preventScroll: true })
  }
  const askNow = (q?: string) => sentFocus(h.ask(q))

  const card = (i: number) => <WordHelperCard key={`${i}:${h.items[i].ja}`} item={h.items[i]} index={i} ann={ann[i] ?? OFF} sound={h.sound} onPlay={h.play} onFill={onFill} />

  const retryBtn = (waiting: boolean) => (
    <button
      type="button"
      aria-disabled={waiting || undefined}
      onPointerDown={keepInputFocus}
      onClick={() => {
        if (waiting) return
        sentFocus(h.retry())
      }}
      className={`${GHOST} ${waiting ? 'opacity-40' : ''}`}
    >
      {WORD_HELPER.retry}
    </button>
  )

  let body: ReactNode = null
  switch (h.phase) {
    case 'idle':
      body = (
        <>
          <p className="text-[12px] text-ink2">{WORD_HELPER.examplesLead}</p>
          <div className="mt-1.5 flex min-w-0 flex-wrap gap-1.5">
            {WORD_HELPER.examples.map((ex) => (
              // 말줄임(overflow:hidden)은 안쪽 span 에 — 버튼에 두면 위아래 히트 확장(before:)이 잘려 36px 가 된다. 보이는 36 + 위아래 5px = 터치 44.
              <button
                key={ex}
                type="button"
                onPointerDown={keepInputFocus}
                onClick={() => askNow(ex)}
                className="relative h-9 max-w-full rounded-full border border-line bg-surface px-3 text-[13px] text-ink before:absolute before:inset-x-0 before:-inset-y-[5px] before:content-['']"
              >
                <span className="block truncate">{ex}</span>
              </button>
            ))}
          </div>
        </>
      )
      break
    case 'loading':
    case 'slow':
      body = (
        <>
          <span aria-hidden="true" className="block h-[104px] rounded-[14px] bg-surface" />
          <div className="mt-0.5 flex min-w-0 items-center justify-between gap-2">
            <p className="min-w-0 text-[12px] text-ink2 break-keep">{h.phase === 'slow' ? WORD_HELPER.slow : WORD_HELPER.loading}</p>
            <button
              type="button"
              onPointerDown={keepInputFocus}
              onClick={() => sentFocus(h.stop())}
              className="inline-flex h-11 flex-none items-center px-1 text-[13px] font-semibold text-accent"
            >
              {WORD_HELPER.stop}
            </button>
          </div>
        </>
      )
      break
    case 'result': {
      const rest = h.items.length - 1
      body = (
        <>
          <ul aria-label={WORD_HELPER.listAria} className="flex flex-col gap-2">
            {card(0)}
          </ul>
          {rest > 0 ? (
            <>
              <button
                type="button"
                aria-expanded={h.more}
                aria-controls={WORD_HELPER_IDS.alts}
                onPointerDown={keepInputFocus}
                onClick={() => h.setMore((m) => !m)}
                className="my-1 flex h-11 w-full min-w-0 items-center gap-2 rounded-[10px] px-1 text-left"
              >
                <span className="flex-none text-[13px] font-semibold text-ink">{h.more ? WORD_HELPER.less : WORD_HELPER.more(rest)}</span>
                {/* 요약 칸 — 단어 모드는 꼬리표가 없어 비워 둔다(Q4). ▾ 가 오른쪽 끝에 서도록 자리만 둔다. */}
                <span className="min-w-0 flex-1 truncate text-[12px] text-ink2" />
                <span aria-hidden="true" className="flex-none text-[13px] text-ink2">
                  {h.more ? '▴' : '▾'}
                </span>
              </button>
              <ul id={WORD_HELPER_IDS.alts} aria-label={WORD_HELPER.altsAria} hidden={!h.more} className="flex flex-col gap-2">
                {h.items.slice(1).map((_, j) => card(j + 1))}
              </ul>
            </>
          ) : null}
        </>
      )
      break
    }
    case 'none':
      // [다시 시도] 없음 — 같은 질의를 다시 보내도 같다. 질의 칸·표현 칸·[뜻 채우기]·[직접 입력하기]는 그대로 쓸 수 있다(막다른 길 없음).
      body = (
        <div className={BOX}>
          <p className={TEXT}>{WORD_HELPER.none}</p>
          <p className="text-[12px] text-ink2 break-keep">{WORD_HELPER.noneHint}</p>
        </div>
      )
      break
    case 'rate':
      body = (
        <div className={BOX}>
          <p className={TEXT}>{h.rateWaiting && h.rateLeft ? WORD_HELPER.rate(h.rateLeft) : WORD_HELPER.rateDone}</p>
          {retryBtn(h.rateWaiting)}
        </div>
      )
      break
    case 'busy':
    case 'offline':
    case 'error':
    case 'timeout':
      body = (
        <div role="alert" className={BOX}>
          <p className={TEXT}>{WORD_HELPER[h.phase]}</p>
          {retryBtn(false)}
        </div>
      )
      break
  }

  return (
    <section id={HELPER_PANEL_ID} aria-labelledby={WORD_HELPER_IDS.title} onKeyDown={panelEscapeKeyDown(onClose)} className="min-w-0 rounded-[14px] bg-surface2 px-3 pb-3 pt-1">
      <div className="-mr-2 flex min-h-11 min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <h3 id={WORD_HELPER_IDS.title} className="text-[14px] font-semibold leading-[18px] text-ink">
            {WORD_HELPER.title}
          </h3>
          <p className="truncate text-[12px] leading-4 text-ink2">{WORD_HELPER.sub}</p>
        </div>
        <button type="button" aria-label={WORD_HELPER.close} onPointerDown={keepInputFocus} onClick={onClose} className="grid h-11 w-11 flex-none place-items-center rounded-full text-ink2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="mt-0.5 flex min-w-0 items-center gap-2">
        <label className="sr-only" htmlFor={WORD_HELPER_IDS.q}>
          {WORD_HELPER.inputLabel}
        </label>
        <input
          ref={qRef}
          id={WORD_HELPER_IDS.q}
          type="text"
          lang="ko"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          aria-describedby={WORD_HELPER_IDS.msg}
          value={h.query}
          placeholder={WORD_HELPER.placeholder}
          onChange={(e) => h.setQuery(e.target.value)}
          onKeyDown={(e) => helperQueryKeyDown(() => askNow())(e)}
          className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[16px] text-ink placeholder:text-ink3 focus:outline-2 focus:-outline-offset-1 focus:outline-accent"
        />
        <button
          ref={askRef}
          type="button"
          aria-disabled={h.askDisabled || undefined}
          onPointerDown={keepInputFocus}
          onClick={() => askNow()}
          className="h-11 min-w-11 flex-none whitespace-nowrap rounded-xl bg-accent px-3.5 text-[14px] font-semibold text-on-accent aria-disabled:opacity-40"
        >
          {WORD_HELPER.ask}
        </button>
      </div>
      <p id={WORD_HELPER_IDS.msg} role="status" className={`mt-1 text-[12px] break-keep empty:mt-0 ${msg?.bad ? 'text-bad' : 'text-ink2'} ${msg?.count ? 'text-right' : ''}`}>
        {msg?.text ?? ''}
      </p>
      <p role="status" className="sr-only">
        {h.announce}
      </p>
      <div className="mt-2.5 min-w-0">{body}</div>
    </section>
  )
}
