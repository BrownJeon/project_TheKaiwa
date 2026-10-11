'use client'

/**
 * 일본어 도우미 판(screens §22-5·§22-6, ①A) — 입력 바 바로 위, 대답 연습 판과 같은 자리·모양(동시에 열리지 않음 — TalkRoom 이 정한다).
 * 머리 → 한국어 입력 줄([물어보기]) → 본문(예시 칩 · 스켈레톤 · 첫 카드 + [다른 말투 n개] · 빈 결과 · 오류 · 429).
 * 판 안에 마이크·보내기·저장 버튼은 없다(D-8). 판 안 세로 스크롤은 대답 연습 판과 같은 예외.
 * 키보드가 올라오면(`:root[data-kb]`) 본문을 숨겨 머리+입력 줄만 남긴다. 입력칸 초점 여부는 방에 알린다(아래 바 숨김 — 초점 기반).
 * 안내 줄·결과 낭독 줄은 늘 마운트(라이브 영역을 새로 만들지 않는다), 오류·시간 초과만 새로 그리는 `alert` 상자.
 * 판 안의 모든 버튼(✕·[물어보기]·예시 칩·[다른 말투]·[다시 시도]·카드의 ▶·[입력창에 넣기])은 `onPointerDown={keepInputFocus}` 로 입력칸 초점을 지킨다 —
 * 초점이 버튼으로 옮겨 가면 입력 중에 숨겼던 아래 바가 다시 그려져 판이 밀리고 손가락을 뗄 때 click 이 버튼을 놓친다(QA-C F-2·F-3). 키보드·스크린리더는 pointer 가 아니라 영향 없다.
 */
import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { useAnnotations, OFF } from '@/components/common/japanese/annotations'
import { useCountdown } from '@/components/common/useNow'
import { Skeleton } from '@/components/challenge/parts'
import { HELPER, type HelperRoomKind } from './helperCopy'
import PhraseHelperCard from './PhraseHelperCard'
import { HELPER_PANEL_ID } from './PhraseHelperButton'
import { altSummary, askBlockOf, closeOnEscape, helperDismissOf, helperMsgOf, isImeEnter, keepInputFocus } from './phraseHelperLogic'
import type { PhraseHelper } from './usePhraseHelper'

const KB_HIDE = '[:root[data-kb]_&]:hidden'
const GHOST = 'inline-flex h-11 min-w-0 items-center justify-center rounded-xl border border-line bg-surface px-3 text-[14px] font-semibold text-ink'
const INPUT_ID = 'talk-helper-q'
const MSG_ID = 'talk-helper-msg'
const TITLE_ID = 'talk-helper-title'
const ALTS_ID = 'talk-helper-alts'

export interface PhraseHelperPanelProps {
  h: PhraseHelper
  kind: HelperRoomKind
  textMode: boolean
  textOnly: boolean
  /** 도우미가 잠긴 상태(녹음·인식 + 선생님이 답하는 중) — 입력 disabled · [물어보기]·카드 버튼 aria-disabled */
  locked: boolean
  /** 판 마운트 직후 입력칸 초점(처음 열기 — 이전 답 없음). */
  focusOnOpen: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  /** ✕·Esc — 판 닫고 초점은 도우미 버튼으로. */
  onClose: () => void
  /** [입력창에 넣기] */
  onFill: (ja: string) => void
  /** 방 띠(오류·보내지 못한 말 등)가 떠 있는가 — 새로 뜨는 순간 판을 닫는다(결과는 기억). */
  blocked: boolean
  /** 목표 카드·대답 연습이 펼쳐져 있는가 — 새로 펼쳐지는 순간 판을 닫는다. */
  otherOpen: boolean
  /** 초점을 옮기지 않고 닫기(띠·다른 판). */
  onDismiss: () => void
}

/**
 * 판 머리 — 제목·부제와 ✕. 훅이 없는 순수 부품이라 단위 시험이 요소 트리에서 ✕ 를 찾아 부른다.
 * ✕ 는 누르는 동안 입력칸 초점을 지킨다: 초점이 옮겨 가 입력칸이 blur 되면 입력 중에 숨겼던 아래 바가 다시 그려져 판이 그 높이만큼 밀리고,
 * 손가락을 뗄 때 ✕ 는 이미 다른 자리라 click 이 사라진다(QA-C F-2 — 마우스 실측 판 −117px). Esc 와 같은 `onClose` 하나로 닫는다.
 */
export function PhraseHelperHead({ onClose }: { onClose: () => void }) {
  return (
    <div className="-mr-2 flex min-h-11 min-w-0 items-center gap-2">
      <div className="min-w-0 flex-1">
        <h2 id={TITLE_ID} className="text-[14px] font-semibold leading-[18px] text-ink">
          {HELPER.title}
        </h2>
        <p className="truncate text-[12px] leading-4 text-ink2">{HELPER.sub}</p>
      </div>
      <button type="button" aria-label={HELPER.close} onPointerDown={keepInputFocus} onClick={onClose} className="grid h-11 w-11 flex-none place-items-center rounded-full text-ink2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}

export default function PhraseHelperPanel({ h, kind, textMode, textOnly, locked, focusOnOpen, inputRef, onClose, onFill, blocked, otherOpen, onDismiss }: PhraseHelperPanelProps) {
  const ownRef = useRef<HTMLInputElement>(null)
  const ref = inputRef ?? ownRef
  const focusOnOpenRef = useRef(focusOnOpen)
  // 같은 사용자 동작 안(판 마운트 커밋) 한 번 — 키보드가 뜨는 것은 사용자가 버튼을 누른 결과다.
  useLayoutEffect(() => {
    if (focusOnOpenRef.current) ref.current?.focus()
  }, [ref])

  const prevRef = useRef({ blocked, otherOpen })
  useEffect(() => {
    const p = prevRef.current
    prevRef.current = { blocked, otherOpen }
    if (helperDismissOf(p, { blocked, otherOpen })) onDismiss()
  }, [blocked, otherOpen, onDismiss])

  const left = useCountdown(h.phase === 'rate' ? h.rateUntil : null)
  const rateWaiting = h.phase === 'rate' && h.rateUntil !== null && left !== 0
  const pending = h.phase === 'loading' || h.phase === 'slow'
  const block = askBlockOf({ query: h.query, pending, recording: locked, rateWaiting })
  const msg = helperMsgOf({ query: h.query, emptyHint: h.emptyHint, serverMsg: h.serverMsg, cancelled: h.cancelled })
  const ann = useAnnotations(h.items.map((x) => x.ja))

  // 새 질의는 입력칸을 내린다(키보드 내림, §22-10) — [물어보기]·예시 칩·[다시 시도]가 같다. 막혀 있으면(요청 중·대기·녹음 중·빈 말) 초점을 그대로 둔다.
  const askNow = (q?: string) => {
    if (askBlockOf({ query: q ?? h.query, pending, recording: locked, rateWaiting }) === null) ref.current?.blur()
    h.ask(q)
  }
  const submit = () => askNow()

  const card = (i: number) => (
    <PhraseHelperCard
      key={`${i}:${h.items[i].ja}`}
      item={h.items[i]}
      index={i}
      count={h.items.length}
      ann={ann[i] ?? OFF}
      textMode={textMode}
      textOnly={textOnly}
      locked={locked}
      sound={h.sound}
      onPlay={h.play}
      onFill={onFill}
    />
  )

  const retryBtn = (waiting: boolean) => (
    <button
      type="button"
      aria-disabled={waiting || locked || undefined}
      onPointerDown={keepInputFocus}
      onClick={() => {
        if (waiting || locked) return
        ref.current?.blur()
        h.retry()
      }}
      className={`${GHOST} mt-2 ${waiting || locked ? 'opacity-40' : ''}`}
    >
      {HELPER.retry}
    </button>
  )

  let body: ReactNode = null
  switch (h.phase) {
    case 'idle':
      body = (
        <>
          <p className="text-[12px] text-ink2">{HELPER.examplesLead}</p>
          <div className="mt-1.5 flex min-w-0 flex-wrap gap-1.5">
            {HELPER.examples[kind].map((ex) => (
              // 말줄임(overflow:hidden)은 안쪽 span 에 — 버튼에 두면 위아래 히트 확장(before:)이 잘려 36px 가 된다(REV-191 L-3).
              // `::before` 는 테두리 안쪽(padding box 34px)이 기준이라 위아래 5px 씩 늘려야 보이는 36px 의 위아래 4px, 합 44px 가 된다(QA-C F-5: 4px 는 42px).
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
          <Skeleton heights={[120, 120]} label={HELPER.loadingSr} />
          {h.phase === 'slow' ? <p className="mt-2 text-[12px] text-ink2">{HELPER.slow}</p> : null}
        </>
      )
      break
    case 'result': {
      const rest = h.items.length - 1
      body = (
        <>
          <ul aria-label={HELPER.listAria} className="flex flex-col gap-2">
            {card(0)}
          </ul>
          {rest > 0 ? (
            <>
              <button
                type="button"
                aria-expanded={h.more}
                aria-controls={ALTS_ID}
                onPointerDown={keepInputFocus}
                onClick={() => h.setMore((m) => !m)}
                className="my-1 flex h-11 w-full min-w-0 items-center gap-2 rounded-[10px] px-1 text-left"
              >
                <span className="flex-none text-[13px] font-semibold text-ink">{h.more ? HELPER.less : HELPER.more(rest)}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-ink2">{altSummary(h.items)}</span>
                <span aria-hidden="true" className="flex-none text-[13px] text-ink2">
                  {h.more ? '▴' : '▾'}
                </span>
              </button>
              <ul id={ALTS_ID} aria-label={HELPER.altsAria} hidden={!h.more} className="flex flex-col gap-2">
                {h.items.slice(1).map((_, j) => card(j + 1))}
              </ul>
            </>
          ) : null}
        </>
      )
      break
    }
    case 'none':
      body = (
        <div>
          <p className="text-[13px] text-ink break-keep">{HELPER.none}</p>
          <p className="mt-1 text-[12px] text-ink2 break-keep">{HELPER.noneHint(HELPER.noneExample[kind])}</p>
        </div>
      )
      break
    case 'error':
    case 'timeout':
    case 'busy':
      body = (
        <div role="alert">
          <p className="text-[13px] text-ink break-keep">{h.phase === 'error' ? HELPER.error : h.phase === 'timeout' ? HELPER.timeout : HELPER.busy}</p>
          {retryBtn(false)}
        </div>
      )
      break
    case 'rate':
      body = (
        <div>
          <p className="text-[13px] text-ink break-keep">{rateWaiting && left ? HELPER.rate(left) : HELPER.rateDone}</p>
          {retryBtn(rateWaiting)}
        </div>
      )
      break
  }

  return (
    <section
      id={HELPER_PANEL_ID}
      aria-labelledby={TITLE_ID}
      data-kb-docked
      onKeyDown={closeOnEscape(onClose)}
      className="max-h-[min(46dvh,320px)] flex-none overflow-y-auto overscroll-contain border-t border-line bg-surface px-4 pb-3"
      style={h.typing ? { paddingBottom: 'max(12px, var(--safe-bottom))' } : undefined}
    >
      <PhraseHelperHead onClose={onClose} />
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="mt-0.5 flex min-w-0 items-center gap-2"
      >
        <label className="sr-only" htmlFor={INPUT_ID}>
          {HELPER.inputLabel}
        </label>
        <input
          ref={ref}
          id={INPUT_ID}
          type="text"
          lang="ko"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          aria-describedby={MSG_ID}
          disabled={locked}
          value={h.query}
          placeholder={HELPER.placeholder[kind]}
          onChange={(e) => h.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (isImeEnter(e)) e.preventDefault()
          }}
          onFocus={() => h.setTyping(true)}
          onBlur={() => h.setTyping(false)}
          className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[16px] text-ink placeholder:text-ink3 focus:outline-2 focus:-outline-offset-1 focus:outline-accent disabled:opacity-60"
        />
        <button
          type="submit"
          aria-disabled={block !== null || undefined}
          onPointerDown={keepInputFocus}
          className="h-11 min-w-11 flex-none whitespace-nowrap rounded-xl bg-accent px-3.5 text-[14px] font-semibold text-on-accent aria-disabled:opacity-40"
        >
          {HELPER.ask}
        </button>
      </form>
      {/* 잠긴 동안(말하는 중·선생님이 답하는 중)은 이 줄이 바뀌어도 읽지 않는다 — 말하기 시작과 함께 뜨는 멈춤 안내를 스크린리더가 읽어 마이크에 섞이지 않게(§9-0 ⑨, 낭독은 녹음이 끝난 뒤). */}
      <p id={MSG_ID} role="status" aria-live={locked ? 'off' : undefined} className={`mt-1 text-[12px] break-keep empty:mt-0 ${msg?.bad ? 'text-bad' : 'text-ink2'} ${msg?.count ? 'text-right' : ''}`}>
        {msg?.text ?? ''}
      </p>
      <p role="status" className="sr-only">
        {h.announce}
      </p>
      <div className={`mt-2.5 min-w-0 ${KB_HIDE}`}>{body}</div>
    </section>
  )
}
