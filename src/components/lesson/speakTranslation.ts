/**
 * 오늘의 회화 ⑤ 「내가 한 말」 한국어 뜻(task-077 §34-4, A1~A5 ★) — 순수 규칙과 요청 수명주기. 화면·React 없이 시험한다.
 *  - 계획(A2): 건너뜀·빈 말 → 칸 없음 · 모범 답안과 같음(`compareAnswer` same, ④ 응용과 같은 함수) → 모범 답안 뜻 즉시(호출 0) · 다름 → #185 1회.
 *  - 요청(A1): 결과가 보이면 자동·비차단. 한 번에 하나. 대상이 바뀌거나(새 결과·다음 과제) 말하는 중·확인 중이 되면 앞 요청을 끊는다
 *    (서버가 `req.signal` 로 잠금을 풀어 곧이은 [다시 가져오기]가 409 바쁨이 되지 않게). 화면 상한 12초. 늦게 온 답은 버린다.
 *  - 오류(A5): 칸 안 한 줄 — 실패(0·5xx·502·504·422·12초) · 한도(429) · 바쁨(409 TRANSLATION_BUSY) · 막힘(400·404, 단추 없음) · 409 CANCELLED 는 줄 없음.
 *  - 힌트(A4 A): 말로 한 답을 AI 가 옮겼을 때만 「알아들은 말을 그대로 옮겼어요」.
 * 저장 없음 — 같은 글의 뜻은 수업 화면 메모리에만(L1). 엔진·모델 이름은 다루지 않는다.
 */
import { toErr, type Err } from '@/components/common/errors'
import { compareAnswer } from './compare'

export const SPEAK_TR_TIMEOUT_MS = 12_000

export type SpeakTrPlan = { kind: 'skip' } | { kind: 'free'; ko: string } | { kind: 'fetch' }

/** 결과 하나의 번역 계획. 모범 답안 뜻이 비어 있으면 같아도 AI 로 옮긴다. */
export function translationPlan(res: { text: string; skipped?: boolean } | null | undefined, modelAnswerJa: string, modelKo: string): SpeakTrPlan {
  if (!res || res.skipped || !res.text.trim()) return { kind: 'skip' }
  if (modelKo.trim() && compareAnswer(res.text, modelAnswerJa).kind === 'same') return { kind: 'free', ko: modelKo.trim() }
  return { kind: 'fetch' }
}

/**
 * 칸 상태. `idle` = 아직 묻지 않음(곧 묻는다 — 화면은 준비 줄), `none` = 서버가 취소로 끝냄(줄 없음).
 * `ok.ai` = AI 가 옮긴 뜻(힌트 판단), false 면 모범 답안 뜻.
 */
export type SpeakTrState =
  | { s: 'idle' }
  | { s: 'loading' }
  | { s: 'ok'; ko: string; ai: boolean }
  | { s: 'fail' }
  | { s: 'rate' }
  | { s: 'busy' }
  | { s: 'blocked' }
  | { s: 'none' }

/** 실패 → 칸 상태(§34-7 #185 오류 처리 표). */
export function speakTrFailureOf(err: Pick<Err, 'status' | 'details'>): SpeakTrState {
  const reason = typeof err.details?.reason === 'string' ? err.details.reason : null
  if (err.status === 409 && reason === 'CANCELLED') return { s: 'none' }
  if (err.status === 409 && reason === 'TRANSLATION_BUSY') return { s: 'busy' }
  if (err.status === 429) return { s: 'rate' }
  if (err.status === 400 || err.status === 404) return { s: 'blocked' }
  return { s: 'fail' }
}

/** 응답 본문에서 뜻 — 글이 아니거나 비면 null(실패 줄). */
export function koOf(body: unknown): string | null {
  const ko = body && typeof body === 'object' ? (body as { ko?: unknown }).ko : null
  return typeof ko === 'string' && ko.trim() ? ko.trim() : null
}

/** 힌트(A4 A) — 말로 한 답 + AI 가 옮긴 뜻일 때만. 글자로 쓴 답·모범 답안과 같을 때는 없음. */
export function speakTrHint(via: 'voice' | 'text', state: SpeakTrState): boolean {
  return via === 'voice' && state.s === 'ok' && state.ai
}

/** [다시 가져오기] 단추가 있는 상태. 막힘(400·404)은 다시 눌러도 같아 단추가 없다. */
export function speakTrRetryable(state: SpeakTrState): boolean {
  return state.s === 'fail' || state.s === 'rate' || state.s === 'busy'
}

/** 화면에 보일 상태 — 계획 · 메모리 뜻 · 지금 대상의 요청 상태에서. */
export function speakTrView(plan: SpeakTrPlan, text: string, cache: ReadonlyMap<string, string>, cur: { key: string | null; state: SpeakTrState }, key: string): SpeakTrState {
  if (plan.kind === 'skip') return { s: 'none' }
  if (plan.kind === 'free') return { s: 'ok', ko: plan.ko, ai: false }
  const hit = cache.get(text)
  if (hit) return { s: 'ok', ko: hit, ai: true }
  return cur.key === key ? cur.state : { s: 'idle' }
}

export interface SpeakTrTarget {
  /** 결과 하나를 가리키는 키(과제 · 시도 번호 · 글) — 바뀌면 새 대상 */
  key: string
  text: string
}

export interface SpeakTranslatorDeps {
  /** #185 — 정리된 글과 끊기 신호를 받아 응답 본문(`{ko}`)을 돌려준다. 실패는 `apiPost` 와 같은 예외. */
  request: (text: string, signal: AbortSignal) => Promise<unknown>
  /** 지금 대상의 상태가 바뀜(준비·뜻·실패…). 끊은 요청에는 부르지 않는다. */
  onState: (key: string, state: SpeakTrState) => void
  /** 받은 뜻 — 같은 글은 다시 묻지 않게 화면 메모리에 둔다. */
  onCache: (text: string, ko: string) => void
  timeoutMs?: number
}

/**
 * 요청 수명주기 — 동시에 하나 · 대상이 바뀌면 끊음 · 잠금(말하는 중·확인 중)이면 끊고 `idle` 로 · 12초 상한 · 늦은 답 버림.
 * `sync` 는 화면 효과에서, `retry` 는 [다시 가져오기]에서, `dispose` 는 언마운트에서 부른다.
 */
export function createSpeakTranslator(d: SpeakTranslatorDeps) {
  const timeoutMs = d.timeoutMs ?? SPEAK_TR_TIMEOUT_MS
  let inflight: { id: number; key: string; ctrl: AbortController; timer: ReturnType<typeof setTimeout> } | null = null
  let seq = 0
  let paused = false

  const abort = () => {
    if (!inflight) return
    clearTimeout(inflight.timer)
    inflight.ctrl.abort()
    inflight = null
  }

  const start = (t: SpeakTrTarget) => {
    abort()
    const id = ++seq
    const ctrl = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      ctrl.abort()
    }, timeoutMs)
    inflight = { id, key: t.key, ctrl, timer }
    d.onState(t.key, { s: 'loading' })
    const mine = () => inflight !== null && inflight.id === id
    const finish = (state: SpeakTrState) => {
      clearTimeout(timer)
      inflight = null
      d.onState(t.key, state)
    }
    void d.request(t.text, ctrl.signal).then(
      (body) => {
        if (!mine()) return
        const ko = koOf(body)
        if (ko) d.onCache(t.text, ko)
        finish(ko ? { s: 'ok', ko, ai: true } : { s: 'fail' })
      },
      (e: unknown) => {
        if (!mine()) return
        finish(timedOut ? { s: 'fail' } : speakTrFailureOf(toErr(e)))
      },
    )
  }

  return {
    /**
     * 화면 대상·잠금을 맞춘다. `cached` = 이 글의 뜻이 메모리에 있음, `idle` = 지금 대상을 아직 묻지 않았음(`speakTrView` 가 `idle`).
     * 대상이 없거나 바뀌면 앞 요청을 끊는다. 잠금 중이면 받는 중인 요청을 끊고 `idle`(잠금이 풀리면 다시 묻는다).
     */
    sync(t: SpeakTrTarget | null, o: { paused: boolean; cached: boolean; idle: boolean }) {
      paused = o.paused
      if (inflight && (!t || inflight.key !== t.key)) abort()
      if (!t || o.cached) return
      if (o.paused) {
        if (inflight) {
          abort()
          d.onState(t.key, { s: 'idle' })
        }
        return
      }
      if (o.idle && !inflight) start(t)
    },
    /** [다시 가져오기] — 잠금 중·받는 중이면 무시. */
    retry(t: SpeakTrTarget) {
      if (paused || inflight) return
      start(t)
    },
    /** 받는 중인 대상 키(시험·진단용). */
    pendingKey(): string | null {
      return inflight ? inflight.key : null
    },
    /** 언마운트 — 받는 중인 요청을 끊는다(늦은 답은 버려진다). 영구 정지는 아니다(개발 모드 StrictMode 가 효과를 다시 돌린다). */
    dispose() {
      abort()
    },
  }
}

export type SpeakTranslator = ReturnType<typeof createSpeakTranslator>
