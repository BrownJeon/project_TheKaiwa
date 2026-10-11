/**
 * 회화방 일본어 도우미(task-056, screens §22)의 순수 규칙 — 처음 한 번 안내 · 버튼 잠김 · 질의 글자 수와 안내 줄 · [물어보기] 막힘 이유 ·
 * #180 응답 읽기 · 실패 → 판 상태 · 요청 하나의 결말 · 요청 수명주기 컨트롤러 · IME 조합 Enter. React·DOM 을 쓰지 않는다(단위 시험 `__tests__/phraseHelper*.test.ts`).
 * 질의·답 원문은 어디에도 저장하지 않는다 — 저장소에 남는 값은 `HELPER_TIP_KEY='1'` 하나다.
 */
import { retryAfterOf, toErr, type Err } from '@/components/common/errors'
import { cpLength } from '@/components/common/format'
import { readStore, writeStore } from '@/components/common/storage'
import type { PhraseHelpItem } from '@/types/phraseHelp'
import { HELPER, HELPER_COUNT_FROM, HELPER_MAX } from './helperCopy'

export const HELPER_TIP_KEY = 'kaiwa.talk.helperTipSeen'
/** 화면 총 상한 — 서버 엔진 12초는 큐 대기를 빼고 세므로 화면이 먼저 끊을 수 있다(pe-record §4). */
export const HELPER_TIMEOUT_MS = 12_000
export const HELPER_SLOW_MS = 5_000
export const HELPER_ITEMS_MAX = 3

/**
 * 처음 한 번 안내를 지금 보일지 — 보이는 순간을 「본 것」으로 기록한다. `writeStore` 는 실패를 알리지 않으므로 써 보고 다시 읽어 가린다:
 * 저장이 막힌 환경(사생활 모드·차단·WebView 설정)은 한 번도 보이지 않는다(방마다 매번 뜨지 않게).
 */
export function claimHelperTip(read: typeof readStore = readStore, write: typeof writeStore = writeStore): boolean {
  if (read('local', HELPER_TIP_KEY) !== null) return false
  write('local', HELPER_TIP_KEY, '1')
  return read('local', HELPER_TIP_KEY) === '1'
}

/** 도우미 버튼이 잠긴 이유 — `voice` = 내가 말하는 중(녹음·인식) · `turn` = 선생님이 답을 만드는 중(보내기 대기·생각). */
export type HelperLockReason = 'voice' | 'turn'

/**
 * 도우미를 열 수 있는 상태는 IDLE·SPEAKING 뿐이다(§22-6). 선생님 말 재생(SPEAKING)은 AI 호출이 이미 끝났으니 허용하고,
 * 보내기 대기·생각(QUEUED·THINKING)은 도우미와 회화 턴이 같은 AI 호출 줄(동시 1건)을 쓰므로 잠근다 — 도우미가 먼저 서면 턴 첫 음성이 5초 예산을 넘긴다.
 * 상태 문자열(`view.state`)만 받는다 — 훅 반환 값을 import 함수에 넘기는 렌더 중 호출은 컴파일러 순수성 검사가 오탐한다.
 */
export function helperLockReason(talkState: string): HelperLockReason | null {
  if (talkState === 'RECORDING' || talkState === 'RECOGNIZING') return 'voice'
  if (talkState === 'QUEUED' || talkState === 'THINKING') return 'turn'
  return null
}

export function helperLocked(talkState: string): boolean {
  return helperLockReason(talkState) !== null
}

/** 잠긴 버튼을 눌렀을 때의 토스트 문구 — 이유별. 이유가 없는 상태(버튼이 잠기지 않아 불리지 않는 길)는 기존 「말하는 중」 문구로 둔다. */
export function helperLockToast(reason: HelperLockReason | null): string {
  return reason === 'turn' ? HELPER.lockedTurn : HELPER.locked
}

/**
 * 판을 그릴지 — 열려 있고 마친 역할극이 아니면 그린다. 말하는 동안(녹음·인식)·결과 유무와는 무관하다(⑤A: 녹음 중에도 판은 남고 입력칸·버튼만 잠긴다).
 * 판이 사라지는 길은 닫기(✕·Esc·버튼)·보내기(`accepted`)·409 ENDED·`helperDismissOf` 뿐이다 — 녹음을 시작해서 사라졌다면 그 직후 오류 띠가 떴는지 본다.
 */
export function helperPanelShown(i: { open: boolean; ended: boolean }): boolean {
  return i.open && !i.ended
}

export interface HelperOverlays {
  /** 방 띠(오류·보내지 못한 말 등)가 떠 있는가 */
  blocked: boolean
  /** 목표 카드·대답 연습이 펼쳐져 있는가 */
  otherOpen: boolean
}

/**
 * 판이 스스로 닫아야 하는가(§22-10 「서로 배타」) — 띠가 **새로 뜨거나**(false→true) 목표 카드·대답 연습이 **새로 펼쳐진** 순간만.
 * 이미 떠 있던 것·내려가는 것·말하기 시작은 해당 없다. 닫아도 질의·결과는 기억한다.
 */
export function helperDismissOf(prev: HelperOverlays, next: HelperOverlays): boolean {
  return (next.blocked && !prev.blocked) || (next.otherOpen && !prev.otherOpen)
}

/** 판 안 버튼을 누르는 동안 입력칸 초점을 지킨다 — pointerdown 취소는 마우스·터치 모두 초점 이동(blur)을 막고 click 은 그대로 온다. */
export function keepInputFocus(e: { preventDefault: () => void }): void {
  e.preventDefault()
}

/**
 * 판 안 키 입력 → Esc 면 `onClose`. ✕ 버튼 `onClick` 과 **같은 `onClose`** 를 부른다(닫는 길이 하나라 초점 복귀·결과 기억이 같다).
 */
export function closeOnEscape(onClose: () => void): (e: { key: string; preventDefault: () => void }) => void {
  return (e) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    onClose()
  }
}

export type AskBlock = 'recording' | 'pending' | 'rate' | 'empty' | 'over' | null

/** [물어보기]를 지금 누를 수 없는 이유(없으면 null). 글자 수는 코드포인트, 빈칸은 공백만 있는 것도 포함. */
export function askBlockOf(i: { query: string; pending: boolean; recording: boolean; rateWaiting: boolean }): AskBlock {
  if (i.recording) return 'recording'
  if (i.pending) return 'pending'
  if (i.rateWaiting) return 'rate'
  if (i.query.trim() === '') return 'empty'
  if (cpLength(i.query) > HELPER_MAX) return 'over'
  return null
}

export interface HelperMsg {
  text: string
  bad: boolean
  /** 글자 수 안내는 오른쪽 정렬 */
  count: boolean
}

/**
 * 입력칸 아래 안내 줄 — 서버 400 안내(질의를 고치면 사라진다) > 빈 제출 > 100자 초과 > 말하느라 멈춘 요청 안내 > 90자부터 글자 수.
 * 멈춤 안내는 오류가 아니라 사정 설명이라 `bad` 가 아니다(고쳐야 하는 입력 문제가 있으면 그쪽이 먼저).
 */
export function helperMsgOf(i: { query: string; emptyHint: boolean; serverMsg: string | null; cancelled?: boolean }): HelperMsg | null {
  if (i.serverMsg) return { text: i.serverMsg, bad: true, count: false }
  if (i.emptyHint && i.query.trim() === '') return { text: HELPER.empty, bad: true, count: false }
  const n = cpLength(i.query)
  if (n > HELPER_MAX) return { text: HELPER.over(n), bad: true, count: true }
  if (i.cancelled) return { text: HELPER.cancelled, bad: false, count: false }
  if (n >= HELPER_COUNT_FROM) return { text: HELPER.count(n), bad: false, count: true }
  return null
}

/**
 * 「말하는 동안 도우미를 멈췄어요」 안내를 언제까지 보일지 — `null` = 없음, `'unseen'` = 판이 닫혀 있을 때 멈춰서 아직 못 봤다, `'seen'` = 판이 열려 있어 이미 봤다.
 * 지우는 때: 다음 질의를 보낼 때(`ask`) · 이미 본 안내는 판을 다시 열 때. 못 본 안내는 다시 열었을 때 한 번 보인다(그다음 열 때 지운다).
 */
export type CancelNote = null | 'unseen' | 'seen'

/** 멈춘 순간 — 판이 그려져 있었으면 이미 본 것. */
export function cancelNoteOnCancel(panelShown: boolean): CancelNote {
  return panelShown ? 'seen' : 'unseen'
}

/** 판을 (다시) 열 때 — 이미 본 안내는 지우고, 닫혀 있는 동안 생긴 안내는 이번에 보이게 둔다. */
export function cancelNoteOnOpen(note: CancelNote): CancelNote {
  return note === 'unseen' ? 'seen' : null
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/**
 * #180 200 응답 → 카드 목록(최대 3개, 서버 순서). 빈 배열 = 못 찾음(거절 포함). 모양이 틀리거나 쓸 수 있는 항목이 하나도 없으면 null(오류).
 * 꼬리표·이유는 빈 값·null 이면 칸만 뺀다(서버 보정과 같은 규칙).
 */
export function readPhraseHelp(raw: unknown): PhraseHelpItem[] | null {
  if (!isObj(raw) || !Array.isArray(raw.items)) return null
  if (raw.items.length === 0) return []
  const out: PhraseHelpItem[] = []
  for (const it of raw.items) {
    if (!isObj(it)) continue
    const ja = text(it.ja)
    const ko = text(it.ko)
    if (!ja || !ko) continue
    const labelKo = text(it.labelKo)
    const whyKo = text(it.whyKo)
    out.push({ ja, ko, ...(labelKo ? { labelKo } : {}), ...(whyKo ? { whyKo } : {}) })
    if (out.length === HELPER_ITEMS_MAX) break
  }
  return out.length ? out : null
}

/** [다른 말투] 줄 오른쪽 요약 — 접힌 카드들의 꼬리표를 ` · ` 로 잇는다(없는 꼬리표는 건너뜀). */
export function altSummary(items: readonly PhraseHelpItem[]): string {
  return items
    .slice(1)
    .map((x) => x.labelKo ?? '')
    .filter(Boolean)
    .join(' · ')
}

export type HelperFailure = { kind: 'error' } | { kind: 'timeout' } | { kind: 'rate'; sec: number } | { kind: 'busy' } | { kind: 'ended' } | { kind: 'invalid'; message: string }

/**
 * #180 실패 → 판 상태(§22-6·§22-9). 12초·504 = 시간 초과 · 429 = 대기 초 · 409 ENDED = 마친 방 · 409 TURN_RUNNING = 선생님 말이 끝나면(지금 계약엔 없음) ·
 * 409 PHRASE_BUSY(다른 탭·기기에서 묻는 중) = 오류 · 400 VALIDATION = 입력 안내(서버 문구 그대로) · 0·5xx·404·그 밖 = 오류.
 */
export function helperFailureOf(err: Err, timedOut: boolean): HelperFailure {
  if (timedOut || err.status === 504) return { kind: 'timeout' }
  if (err.status === 429) return { kind: 'rate', sec: retryAfterOf(err) }
  if (err.status === 409) {
    const why = err.details.reason ?? err.code
    if (why === 'ENDED' || why === 'ROLEPLAY_ENDED') return { kind: 'ended' }
    if (why === 'TURN_RUNNING') return { kind: 'busy' }
    return { kind: 'error' }
  }
  if (err.status === 400 && err.code === 'VALIDATION' && err.message) return { kind: 'invalid', message: err.message }
  return { kind: 'error' }
}

export type HelperSettle = { kind: 'items'; items: PhraseHelpItem[] } | { kind: 'failed'; failure: HelperFailure }

/**
 * 요청 하나의 결말. 언마운트·새 요청으로 더는 살아 있지 않은 요청의 늦은 응답·오류는 버린다. 시간 초과가 아닌 취소(AbortError)도 버린다.
 * 응답 모양이 틀리면 오류.
 */
export async function settleHelper(fx: { request: () => Promise<unknown>; live: () => boolean; timedOut: () => boolean; settle: (r: HelperSettle) => void }): Promise<void> {
  try {
    const raw = await fx.request()
    if (!fx.live()) return
    if (fx.timedOut()) {
      fx.settle({ kind: 'failed', failure: { kind: 'timeout' } })
      return
    }
    const items = readPhraseHelp(raw)
    fx.settle(items ? { kind: 'items', items } : { kind: 'failed', failure: { kind: 'error' } })
  } catch (e) {
    if (!fx.live()) return
    if (e instanceof DOMException && e.name === 'AbortError' && !fx.timedOut()) return
    fx.settle({ kind: 'failed', failure: helperFailureOf(toErr(e), fx.timedOut()) })
  }
}

interface HelperLive {
  ac: AbortController | null
  timeout: ReturnType<typeof setTimeout> | null
  slow: ReturnType<typeof setTimeout> | null
  timedOut: boolean
  /** 결말(`settle`)을 이미 알렸다 — 정리(`finally`)만 남은 짧은 틈에는 취소할 것이 없다. */
  settled: boolean
}
const NO_LIVE: HelperLive = { ac: null, timeout: null, slow: null, timedOut: false, settled: false }

export interface HelperRequestHandlers {
  /** 5초가 지났는데 이 요청이 아직 살아 있다. */
  onSlow: () => void
  /** 결말 — 늦은 응답·시간 초과가 아닌 취소는 `settleHelper` 가 걸러 부르지 않는다. */
  settle: (r: HelperSettle) => void
}

export interface HelperRequester {
  /** 받는 중인 요청이 있는가 — [물어보기] 막힘 이유 `pending` 의 근거. */
  pending: () => boolean
  /** 요청 하나를 시작한다. 이미 받는 중이면 시작하지 않고 null(동시에 하나). 돌려준 약속은 결말·정리가 끝나면 풀린다. */
  start: (request: (signal: AbortSignal) => Promise<unknown>, on: HelperRequestHandlers) => Promise<void> | null
  /**
   * 아직 답이 오지 않은 요청(로딩·5초 넘김)만 취소한다 — 신호를 끊고 타이머를 지우며 그 요청의 응답·오류는 버린다(오류·시간 초과로 알리지 않는다).
   * 돌려주는 값 = 실제로 취소했는가. 이미 결말이 났거나 12초에 끊긴 요청·받는 중이 아닐 때는 아무것도 하지 않고 false. 취소 직후 새 요청을 받는다.
   */
  cancelPending: () => boolean
  /** 언마운트 — 받는 중인 요청을 취소하고 타이머를 지운다(그 요청의 응답은 버린다). 그 뒤에도 새 요청은 받는다. */
  dispose: () => void
}

/**
 * 도우미 요청의 수명주기(§22-10) — 동시에 하나 · 화면 총 상한 12초에 끊어 시간 초과 · 5초부터 `onSlow` · 끝나면 타이머 정리 ·
 * `cancelPending`(말하기 시작·글자 전송)·`dispose`(언마운트)는 취소하고 늦은 응답을 버린다. 결말 판단은 `settleHelper`. 훅 `usePhraseHelper` 가 이 컨트롤러에 맡긴다(React 없이 시험).
 */
export function createHelperRequester(): HelperRequester {
  let live: HelperLive = NO_LIVE
  const stopTimers = (l: HelperLive) => {
    if (l.timeout) clearTimeout(l.timeout)
    if (l.slow) clearTimeout(l.slow)
  }
  return {
    pending: () => live.ac !== null,
    start(request, on) {
      if (live.ac !== null) return null
      const ac = new AbortController()
      const l: HelperLive = { ac, timeout: null, slow: null, timedOut: false, settled: false }
      l.timeout = setTimeout(() => {
        l.timedOut = true
        ac.abort()
      }, HELPER_TIMEOUT_MS)
      l.slow = setTimeout(() => {
        if (live === l) on.onSlow()
      }, HELPER_SLOW_MS)
      live = l
      return settleHelper({
        request: () => request(ac.signal),
        live: () => live === l,
        timedOut: () => l.timedOut,
        settle: (r) => {
          l.settled = true
          on.settle(r)
        },
      }).finally(() => {
        if (live !== l) return
        stopTimers(l)
        live = NO_LIVE
      })
    },
    cancelPending() {
      const l = live
      if (l.ac === null || l.settled || l.timedOut) return false
      live = NO_LIVE
      l.ac.abort()
      stopTimers(l)
      return true
    },
    dispose() {
      const l = live
      l.ac?.abort()
      stopTimers(l)
      live = NO_LIVE
    },
  }
}

/** 한국어 IME 조합 중 Enter — 글자 확정이지 제출이 아니다(브라우저에 따라 `isComposing` 또는 keyCode 229 로만 알린다). */
export function isImeEnter(e: { key: string; keyCode: number; nativeEvent: { isComposing: boolean } }): boolean {
  return e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)
}

/** 늘 마운트된 결과 낭독 줄에 넣을 문장 — 결과 · 빈 결과 · 429(나머지 실패는 alert 상자가 읽힌다). */
export function helperAnnounceOf(r: HelperSettle): string {
  if (r.kind === 'items') return r.items.length ? HELPER.found(r.items.length) : HELPER.none
  if (r.failure.kind === 'rate') return HELPER.rate(r.failure.sec)
  return ''
}
