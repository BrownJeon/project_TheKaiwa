'use client'

/**
 * 단어 추가 시트 일본어 도우미 상태(task-072, screens §30-10) — #181 `POST /api/v1/words/phrase-help {queryKo}`, 저장 없음.
 *  - 모든 값은 **메모리만**(시트를 닫으면 사라진다) — 질의 초안·결과를 localStorage·sessionStorage 에 두지 않는다.
 *  - 요청 수명주기(동시에 하나 · 화면 12초 끊기 · 5초 `onSlow` · 취소 · 늦은 응답 버림)는 회화방 도우미의 시험된 `createHelperRequester` 를 그대로 쓴다.
 *    그 안의 결말 판단은 실패를 회화방 규칙으로만 가르므로, 요청 함수 래퍼가 **이 요청 하나의 실패를 단어 규칙으로 먼저 분류**해 지역 변수에 담고 다시 던진다.
 *  - 취소는 셋: 언마운트(`dispose`), [그만두기](`stop`), 시트가 [뜻 채우기]·[직접 입력하기]를 시작할 때(`cancelPending` — AI 호출 줄이 한 줄이라 도우미가 뜻 채우기를 늦추지 않게).
 *  - 소리는 `useKeyedSound` 키 `whelper:{index}` — 한 번에 하나, 판이 닫히면 멈춘다.
 * 엔진·모델 이름은 다루지 않는다.
 */
import { useEffect, useRef, useState } from 'react'
import { apiPost, isAbort } from '@/components/common/api'
import { toErr } from '@/components/common/errors'
import { useCountdown } from '@/components/common/useNow'
import { useKeyedSound } from '@/components/scenario/useKeyedSound'
import { createHelperRequester, type HelperSettle } from '@/components/talk/phraseHelperLogic'
import type { WordPhraseHelpItem } from '@/types/phraseHelp'
import { WORD_HELPER } from './wordHelperCopy'
import {
  wordAskBlockOf,
  wordAskDisabled,
  wordHelperApply,
  wordHelperFailureOf,
  wordHelperMsgOf,
  wordHelperOutcomeOf,
  wordHelperSoundKey,
  type WordHelperFailure,
  type WordHelperOutcome,
  type WordHelperPhase,
  type WordHint,
} from './wordHelperLogic'

const PATH = '/api/v1/words/phrase-help'

export function useWordPhraseHelper() {
  const [open, setOpen] = useState(false)
  const [query, setQueryState] = useState('')
  const [phase, setPhase] = useState<WordHelperPhase>('idle')
  const [items, setItems] = useState<WordPhraseHelpItem[]>([])
  const [more, setMore] = useState(false)
  const [rateUntil, setRateUntil] = useState<number | null>(null)
  const [hint, setHint] = useState<WordHint>(null)
  const [announce, setAnnounce] = useState('')
  const [fillAnnounce, setFillAnnounce] = useState('')

  const [req] = useState(createHelperRequester)
  const lastSentRef = useRef<string | null>(null)

  const sound = useKeyedSound()
  const { stop: stopSound, tap: tapSound } = sound

  const rateLeft = useCountdown(phase === 'rate' ? rateUntil : null)
  const rateWaiting = phase === 'rate' && rateUntil !== null && rateLeft !== 0
  const pending = phase === 'loading' || phase === 'slow'
  const askDisabled = wordAskDisabled(wordAskBlockOf({ query, pending, rateWaiting }))

  useEffect(() => {
    if (!open) stopSound()
  }, [open, stopSound])

  // 언마운트 — 받는 중인 요청을 버린다(시트를 닫으면 결과도 사라진다).
  useEffect(() => () => req.dispose(), [req])

  const apply = (o: WordHelperOutcome) => {
    const a = wordHelperApply(o)
    setPhase(a.phase)
    if (a.items) setItems(a.items)
    if (a.rateSec !== undefined) setRateUntil(Date.now() + a.rateSec * 1000)
    if (a.hint !== undefined) setHint(a.hint)
    setAnnounce(a.announce)
  }

  /** 질의를 고치면 안내 줄의 사유(빈 말·한글 없음·서버 문구·멈춤)가 사라진다. */
  const setQuery = (q: string) => {
    setQueryState(q)
    setHint(null)
  }

  /**
   * 물어보기 — 칩·[다시 시도]는 그 말을 넘긴다(입력 칸도 그 말로). 막혀 있으면 이유(빈 말·한글 없음)만 안내 줄에 남기고 보내지 않는다.
   * 돌려주는 값 = 실제로 보냈는가(화면이 초점을 [물어보기]로 옮길지 판단).
   */
  const ask = (override?: string): boolean => {
    const q = override ?? query
    const rateNow = rateUntil !== null && Date.now() < rateUntil
    const block = wordAskBlockOf({ query: q, pending: req.pending(), rateWaiting: rateNow })
    if (override !== undefined && override !== query) setQueryState(q)
    if (block === 'empty' || block === 'noHangul') setHint(block)
    if (block !== null) return false
    lastSentRef.current = q
    stopSound()
    setPhase('loading')
    setMore(false)
    setHint(null)
    setRateUntil(null)
    setAnnounce(WORD_HELPER.loading)
    let failure: WordHelperFailure | null = null
    void req.start(
      (signal) =>
        apiPost<unknown>(PATH, { queryKo: q.trim() }, { signal }).catch((e: unknown) => {
          if (!isAbort(e)) failure = wordHelperFailureOf(toErr(e), false)
          throw e
        }),
      {
        onSlow: () => setPhase((p) => (p === 'loading' ? 'slow' : p)),
        settle: (r: HelperSettle) => apply(wordHelperOutcomeOf(r, failure)),
      },
    )
    return true
  }

  /** [다시 시도] — 마지막으로 **보낸** 말을 다시 묻는다. */
  const retry = (): boolean => ask(lastSentRef.current ?? query)

  /** [그만두기] — 아직 답이 오지 않은 요청만 멈춘다. 멈췄으면 `idle` · 질의 유지 · 안내 줄 「찾기를 멈췄어요」. 이미 결말이 났으면 아무것도 안 한다. */
  const stop = (): boolean => {
    if (!req.cancelPending()) return false
    setPhase('idle')
    setHint('stopped')
    setAnnounce('')
    return true
  }

  /** 시트가 [뜻 채우기]·[직접 입력하기]를 시작할 때 — 기다리는 요청만 멈춘다(안내 줄 문구 없음). */
  const cancelPending = (): boolean => {
    if (!req.cancelPending()) return false
    setPhase('idle')
    setAnnounce('')
    return true
  }

  /** 가あ — 열렸으면 true. 열 때 시트 낭독 줄을 비운다(같은 단어를 다시 넣어도 다시 읽히게). */
  const toggle = (): boolean => {
    if (open) {
      setOpen(false)
      return false
    }
    setOpen(true)
    setFillAnnounce('')
    return true
  }

  const close = () => setOpen(false)

  /** [표현 칸에 넣기] 중 이 훅이 맡는 부분 — 판 닫기·소리 멈춤·시트 낭독 줄. 표현 칸 채우기·확인 안내 거둠·초점은 시트가 한다. */
  const fill = (ja: string) => {
    setOpen(false)
    stopSound()
    setFillAnnounce(WORD_HELPER.filled(ja))
  }

  const play = (index: number, text: string) => tapSound(wordHelperSoundKey(index), text)

  return {
    open,
    toggle,
    close,
    query,
    setQuery,
    phase,
    items,
    more,
    setMore,
    rateUntil,
    rateLeft,
    rateWaiting,
    msg: wordHelperMsgOf({ query, hint }),
    askDisabled,
    announce,
    fillAnnounce,
    ask,
    retry,
    stop,
    cancelPending,
    fill,
    /** 다시 열 때 질의 칸에 초점을 줄지 — 이전 답(결과·실패·요청 중)이 없을 때만. */
    fresh: phase === 'idle',
    sound,
    play,
  }
}

export type WordHelper = ReturnType<typeof useWordPhraseHelper>
