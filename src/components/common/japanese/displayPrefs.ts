/**
 * 일본어 표시 스위치 3개(히라가나·한글·번역) — 앱 전체 한 값(task-026, screens §15-3). 서버 값은 Profile `showFurigana`·`showHangul`·`showTranslation`
 * (#11 GET · #12 PUT, 바꾼 키 하나만). 레이아웃을 건드리지 않고 회화·채팅·수업·단어장·설정이 같은 값을 보도록 React 컨텍스트 대신
 * 모듈 전역 저장소 + `useSyncExternalStore` 를 쓴다.
 *
 * - 첫 구독 때 GET 1회(앱 세션 동안 유지). 로드 전 `loaded:false` → 화면은 층을 그리지 않는다(끈 사용자에게 잠깐 보였다 사라지는 깜박임 방지).
 *   GET 실패 → 기본값(히라가나 켬·한글 켬·번역 끔)으로 `loaded:true` + `error:true`(설정 화면만 오류 블록).
 * - `set` 은 바로 반영(낙관) → PUT. 요청은 한 줄로 보내고 연타하면 마지막 값만 보낸다. 실패하면 서버가 확인한 값으로 되돌리고
 *   `failEpoch` +1 — 실패 알림은 앱 셸(`DisplaySaveNotice`)이 이 값을 보고 한 곳에서 띄운다(REV-096 #2: 호출한 화면을 떠난 뒤에 실패해도
 *   알린다). 이관 PUT 의 실패는 사용자가 누른 것이 아니라 올리지 않는다.
 * - GET·PUT 은 10초 상한(REV-094 M-2) — 응답이 멈추면 실패와 같은 길(기본값 loaded·되돌림)로 간다. 상한이 없으면 층이 영영 안 나오거나
 *   PUT 줄이 멈춰 이후 토글이 서버에 가지 않는다.
 * - 옛 `localStorage kaiwa.chat.readingDefault` 는 첫 GET 성공 직후 한 번 이관한다(§15-3 C) — PUT 은 같은 줄(pump)로 보낸다.
 */
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { apiGet, apiPut } from '@/components/common/api'
import { readStore, writeStore } from '@/components/common/storage'
import { KEYS as CHAT_KEYS } from '@/components/chat/storageKeys'

export type DisplayKey = 'showFurigana' | 'showHangul' | 'showTranslation'
export type ToggleKey = 'fu' | 'hg' | 'tr'

export const TOGGLE_KEY: Record<ToggleKey, DisplayKey> = { fu: 'showFurigana', hg: 'showHangul', tr: 'showTranslation' }

export interface DisplayValues {
  showFurigana: boolean
  showHangul: boolean
  showTranslation: boolean
}

export interface DisplaySnapshot extends DisplayValues {
  loaded: boolean
  /** 마지막 GET 실패(기본값으로 동작 중) — 설정 화면만 오류 블록을 그린다. */
  error: boolean
  /** 번역 스위치를 바꿀 때마다 +1 — 말풍선별 [번역 ▾] 상태를 초기화하는 기준(§15-3 D). */
  trEpoch: number
  /** 사용자가 누른 값의 저장이 실패해 되돌릴 때마다 +1 — 앱 셸 실패 토스트의 기준(REV-096 #2). */
  failEpoch: number
}

export const DISPLAY_DEFAULTS: DisplayValues = { showFurigana: true, showHangul: true, showTranslation: false }
const KEYS: DisplayKey[] = ['showFurigana', 'showHangul', 'showTranslation']

export const DISPLAY_COPY = {
  label: { fu: '히라가나', hg: '한글', tr: '번역' } as Record<ToggleKey, string>,
  barCaption: '표시',
  barGroup: '이 방 전체 표시',
  toolGroup: '보기 설정',
  toast: {
    fu: ['히라가나를 숨겼어요 · 모든 화면에 적용돼요', '히라가나를 보여 줘요 · 모든 화면에 적용돼요'],
    hg: ['한글 발음을 숨겼어요 · 모든 화면에 적용돼요', '한글 발음을 보여 줘요 · 모든 화면에 적용돼요'],
    tr: ['번역을 모두 접었어요 · 모든 화면에 적용돼요', '번역을 모두 펼쳤어요 · 모든 화면에 적용돼요'],
  } as Record<ToggleKey, [string, string]>,
  saveFailed: '표시 설정을 저장하지 못했어요. 다시 눌러 주세요',
  hangulSr: '한글 발음: ',
  preparingSr: '발음과 번역을 준비하고 있어요.',
  translationOpen: '번역 ▴',
  translationClosed: '번역 ▾',
  userTr: {
    pending: '번역 중…',
    failed: '번역을 가져오지 못했어요',
    retry: '다시 가져오기',
    fetch: '번역 가져오기',
    turnRunning: '선생님 답이 끝나면 다시 눌러 주세요',
    busy: '다른 번역을 가져오는 중이에요. 잠시 뒤 다시 눌러 주세요',
    rate: '잠시 뒤 다시 눌러 주세요',
    blocked: '이 말은 번역할 수 없어요',
  },
  settings: {
    title: '일본어 표시',
    rows: [
      ['fu', '히라가나 보기', '한자 위에 작게 읽는 법을 적어요.'],
      ['hg', '한글 발음 보기', '일본어 아래에 한글로 소리를 적어요.'],
      ['tr', '번역 펼쳐 두기', '선생님 말과 내 말의 뜻을 처음부터 펼쳐요.'],
    ] as ReadonlyArray<readonly [ToggleKey, string, string]>,
    help: [
      '회화방·채팅방 위 표시 바, 오늘의 회화·단어장 도구 줄에서도 바꿀 수 있어요. 어디서 바꾸든 같은 값이에요.',
      '한글은 소리를 짐작하는 도움말이에요. 정확한 소리는 선생님 목소리로 들어 보세요.',
    ],
    previewCaption: '미리 보기',
    previewJa: '今日は何を食べましたか？',
    previewKo: '오늘은 뭘 먹었어요?',
    previewHidden: '히라가나와 한글을 모두 숨겼어요',
    loadFailed: '표시 설정을 불러오지 못했어요',
  },
} as const

/** 내 말 번역(#32t) 실패 → 칸 상태. `label` = 다시 누를 버튼 글자(누를 수 없으면 null). */
export type UserTrFailure = { s: 'failed' } | { s: 'blocked'; text: string; label: string | null }

/**
 * #32t 오류 → 번역 칸 문구(screens §15-2 H, REV-094 L-2). 409 는 `details.reason` 으로 가른다 — `TRANSLATION_BUSY` 만 '다른 번역 중',
 * 그 밖(`TURN_RUNNING`·reason 없음)은 '선생님 답이 끝나면'. 429 잠시 뒤 · 400/404 번역 불가(버튼 없음) · 그 밖(네트워크·5xx·시간 초과) 실패+다시.
 */
export function userTrFailure(err: { status: number; details?: Record<string, unknown> | null }, label: string): UserTrFailure {
  const reason = typeof err.details?.reason === 'string' ? err.details.reason : null
  if (err.status === 409) return { s: 'blocked', text: reason === 'TRANSLATION_BUSY' ? DISPLAY_COPY.userTr.busy : DISPLAY_COPY.userTr.turnRunning, label }
  if (err.status === 429) return { s: 'blocked', text: DISPLAY_COPY.userTr.rate, label }
  if (err.status === 400 || err.status === 404) return { s: 'blocked', text: DISPLAY_COPY.userTr.blocked, label: null }
  return { s: 'failed' }
}

/** 토스트 표시 시간(screens §15-5 — 2.2초). */
export const DISPLAY_TOAST_MS = 2200

/** 표시 설정 GET·PUT 시간 상한(REV-094 M-2). */
export const DISPLAY_REQUEST_TIMEOUT_MS = 10_000

/**
 * `fn` 에 취소 신호를 주고 `ms` 안에 끝나지 않으면 신호를 끊고(fetch 중단) 거절한다. 신호를 무시하는 호출도 시간이 되면 거절되므로
 * 호출부의 실패 경로가 반드시 돈다. `AbortSignal.timeout` 대신 직접 타이머를 쓰는 이유: 끝나면 타이머를 지울 수 있고(묶음 요청마다 남지 않음)
 * Node 테스트에서 unref 타이머 때문에 대기가 끊기지 않는다.
 */
export function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const reason = new DOMException('요청 시간이 지났어요', 'TimeoutError')
      ctrl.abort(reason)
      reject(reason)
    }, ms)
  })
  return Promise.race([fn(ctrl.signal), timedOut]).finally(() => clearTimeout(timer))
}

export interface DisplayPrefsDeps {
  get: (signal?: AbortSignal) => Promise<Partial<Record<DisplayKey, unknown>>>
  put: (body: Partial<DisplayValues>, signal?: AbortSignal) => Promise<unknown>
  readLegacy: () => string | null
  removeLegacy: () => void
  /** 테스트가 줄인다. 기본 `DISPLAY_REQUEST_TIMEOUT_MS`. */
  timeoutMs?: number
}

interface Pending {
  value: boolean
  onError?: () => void
  onSuccess?: () => void
  /** 실패해도 `failEpoch` 를 올리지 않는다(옛 값 이관 — 사용자가 누른 것이 아니다). */
  silent?: boolean
}

function pickValues(raw: Partial<Record<DisplayKey, unknown>> | null | undefined): DisplayValues {
  const out = { ...DISPLAY_DEFAULTS }
  for (const k of KEYS) if (raw && typeof raw[k] === 'boolean') out[k] = raw[k] as boolean
  return out
}

/** 저장소 본체 — 테스트가 가짜 GET/PUT 으로 만든다. 화면은 아래 모듈 전역 인스턴스만 쓴다. */
export class DisplayPrefsStore {
  private snap: DisplaySnapshot = { ...DISPLAY_DEFAULTS, loaded: false, error: false, trEpoch: 0, failEpoch: 0 }
  /** 서버가 확인한 값 — 실패 되돌림의 기준. */
  private confirmed: DisplayValues = { ...DISPLAY_DEFAULTS }
  private pending = new Map<DisplayKey, Pending>()
  /** 지금 PUT 을 보내는 중인 키 — reload 가 그 낙관 값·확인 값을 옛 GET 값으로 덮지 않게(REV-094 L-1). */
  private inflight = new Set<DisplayKey>()
  private sending = false
  private loading: Promise<void> | null = null
  private started = false
  private listeners = new Set<() => void>()

  constructor(private readonly deps: DisplayPrefsDeps) {}

  private get timeoutMs(): number {
    return this.deps.timeoutMs ?? DISPLAY_REQUEST_TIMEOUT_MS
  }

  getSnapshot = (): DisplaySnapshot => this.snap

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private emit(patch: Partial<DisplaySnapshot>) {
    this.snap = { ...this.snap, ...patch }
    for (const fn of this.listeners) fn()
  }

  /** 첫 사용 때 한 번 GET(앱 세션 동안 유지). */
  ensureLoaded(): Promise<void> {
    if (!this.started) {
      this.started = true
      return this.reload()
    }
    return this.loading ?? Promise.resolve()
  }

  /** 다시 GET — 설정 화면 진입(다른 기기 변경 반영)·[다시 시도]. 보내는 중인 값은 덮지 않는다. */
  reload(): Promise<void> {
    if (this.loading) return this.loading
    this.started = true
    const run = (async () => {
      let raw: Partial<Record<DisplayKey, unknown>> | null = null
      try {
        raw = await withTimeout((signal) => this.deps.get(signal), this.timeoutMs)
      } catch {
        raw = null
      }
      if (raw === null) {
        // 서버 값을 모른다 — 이미 로드된 값이 있으면 그대로, 처음이면 기본값으로 연다(층은 학습 기능의 일부라 막지 않는다).
        this.emit({ loaded: true, error: true })
        return
      }
      const server = pickValues(raw)
      const confirmed = { ...server }
      const shown: Partial<DisplayValues> = {}
      for (const k of KEYS) {
        // 보내는 중인 키는 GET 이 PUT 앞뒤 어느 쪽 값인지 모른다 — PUT 결과가 확인 값을 정한다.
        if (this.inflight.has(k)) confirmed[k] = this.confirmed[k]
        if (!this.pending.has(k) && !this.inflight.has(k)) shown[k] = server[k]
      }
      this.confirmed = confirmed
      const trChanged = shown.showTranslation !== undefined && shown.showTranslation !== this.snap.showTranslation
      this.emit({ ...shown, loaded: true, error: false, ...(trChanged ? { trEpoch: this.snap.trEpoch + 1 } : {}) })
      this.migrateLegacy()
    })()
    this.loading = run.finally(() => {
      this.loading = null
    })
    return this.loading
  }

  /**
   * 옛 "읽기 항상 펼치기"(`kaiwa.chat.readingDefault`) 1회 이관. 'off' 이고 서버가 히라가나 켬이면 `{showFurigana:false}` 를 사용자 토글과
   * 같은 줄(pump)로 보낸다 → 성공하면 키 삭제(실패면 화면은 서버 값으로 돌아가고 키를 남겨 다음 로드에 다시). 그 밖('on'·서버가 이미 끔)은
   * PUT 없이 키 삭제. 사용자가 이미 히라가나를 눌렀으면(대기·전송 중) 그 선택이 이기므로 이관하지 않는다 — `set` 이 키를 지운다.
   */
  private migrateLegacy() {
    const legacy = this.deps.readLegacy()
    if (legacy === null) return
    if (legacy !== 'off' || !this.confirmed.showFurigana) {
      this.deps.removeLegacy()
      return
    }
    this.enqueue('showFurigana', { value: false, silent: true, onSuccess: () => this.deps.removeLegacy() })
  }

  /** 낙관 반영 → PUT(한 줄). 실패하면 서버 값으로 되돌리고 `failEpoch` +1·`onError`. 같은 키를 연타하면 마지막 값만 보낸다. */
  set(key: DisplayKey, on: boolean, onError?: () => void): void {
    // 사용자가 히라가나를 직접 정했다 — 옛 값 이관은 더 이상 의미가 없다(대기 중인 이관 PUT 은 아래에서 이 값으로 바뀐다).
    if (key === 'showFurigana') this.deps.removeLegacy()
    this.enqueue(key, { value: on, onError })
  }

  private enqueue(key: DisplayKey, p: Pending): void {
    if (this.snap[key] !== p.value) {
      this.emit({ [key]: p.value, ...(key === 'showTranslation' ? { trEpoch: this.snap.trEpoch + 1 } : {}) } as Partial<DisplaySnapshot>)
    }
    this.pending.set(key, p)
    void this.pump()
  }

  private async pump(): Promise<void> {
    if (this.sending) return
    this.sending = true
    try {
      for (;;) {
        const next = this.pending.entries().next()
        if (next.done) return
        const [key, p] = next.value
        this.pending.delete(key)
        if (this.confirmed[key] === p.value) {
          p.onSuccess?.()
          continue
        }
        this.inflight.add(key)
        try {
          await withTimeout((signal) => this.deps.put({ [key]: p.value }, signal), this.timeoutMs)
          this.confirmed = { ...this.confirmed, [key]: p.value }
          p.onSuccess?.()
        } catch {
          // 그사이 더 새로 누른 값이 있으면 그 값을 보낸다 — 되돌리지 않는다.
          if (this.pending.has(key)) continue
          const patch: Partial<DisplaySnapshot> = p.silent ? {} : { failEpoch: this.snap.failEpoch + 1 }
          if (this.snap[key] !== this.confirmed[key]) {
            Object.assign(patch, { [key]: this.confirmed[key] }, key === 'showTranslation' ? { trEpoch: this.snap.trEpoch + 1 } : {})
          }
          if (Object.keys(patch).length > 0) this.emit(patch)
          p.onError?.()
        } finally {
          this.inflight.delete(key)
        }
      }
    } finally {
      this.sending = false
    }
  }
}

export const displayPrefsStore = new DisplayPrefsStore({
  get: (signal) => apiGet<Partial<Record<DisplayKey, unknown>>>('/api/v1/settings/profile', { signal }),
  put: (body, signal) => apiPut('/api/v1/settings/profile', body, { signal }),
  readLegacy: () => readStore('local', CHAT_KEYS.readingDefault),
  removeLegacy: () => writeStore('local', CHAT_KEYS.readingDefault, null),
})

const SERVER_SNAPSHOT: DisplaySnapshot = { ...DISPLAY_DEFAULTS, loaded: false, error: false, trEpoch: 0, failEpoch: 0 }

/**
 * `failEpoch` 가 오를 때마다 `onFail`. 기준은 부를 때의 값이라 지난 실패로는 부르지 않는다(마운트 때 토스트 금지). 돌려준 함수로 구독 해제.
 */
export function watchSaveFailures(store: Pick<DisplayPrefsStore, 'subscribe' | 'getSnapshot'>, onFail: () => void): () => void {
  let seen = store.getSnapshot().failEpoch
  return store.subscribe(() => {
    const now = store.getSnapshot().failEpoch
    if (now === seen) return
    seen = now
    onFail()
  })
}

/**
 * 저장 실패 알림을 "맡는" 화면 — 회화방은 자기 토스트 자리(음성 모드 136)와 녹음 중 미룸 규칙이 있어 앱 셸(84, 즉시)보다 알맞다(task-030 REV-097 L-2).
 * 맡은 화면이 있는 동안 실패는 그 화면 한 곳에서만 알리고(셸은 띄우지 않는다 → 알림 정확히 1개), 맡은 화면이 사라진 뒤 늦게 온 실패는
 * 셸이 띄운다(REV-096 #2). 한 번에 하나 — 나중에 맡은 쪽이 이기고, 해제는 자기 것일 때만 효과가 있다.
 */
export class SaveFailureClaims {
  private current: { fn: () => void; takeLeftover?: () => boolean } | null = null
  private shell: (() => void) | null = null

  /**
   * 맡는다. 돌려준 함수로 해제 — 자기 것일 때만 효과가 있고, 그때 `takeLeftover()` 가 true(맡은 화면이 아직 못 띄운 알림이 남음)면
   * 셸이 그 알림을 1번 대신 띄운다(녹음 중 미룬 알림이 화면 이탈로 사라지지 않게, REV-100 #2).
   */
  claim(fn: () => void, takeLeftover?: () => boolean): () => void {
    const mine = { fn, takeLeftover }
    this.current = mine
    return () => {
      if (this.current !== mine) return
      this.current = null
      if (mine.takeLeftover?.()) this.shell?.()
    }
  }

  /** 해제 때 넘길 셸 알림을 등록한다. 돌려준 함수로 해제(자기 것일 때만). */
  setShell(fn: () => void): () => void {
    this.shell = fn
    return () => {
      if (this.shell === fn) this.shell = null
    }
  }

  isClaimed(): boolean {
    return this.current !== null
  }

  /** 맡은 화면이 있으면 그 화면에, 없으면 `fallback`(셸)에 알린다. */
  route(fallback: () => void): void {
    if (this.current) this.current.fn()
    else fallback()
  }
}

export const saveFailureClaims = new SaveFailureClaims()

/**
 * 저장 실패가 났을 때, 방금(토스트 시간 안에) 이 화면이 띄운 성공 토스트가 아직 떠 있으면 지운다 — 빈 문구·0ms = 숨김. 성공 안내("…적용돼요")가
 * 되돌아간 값 위에 남아 실패 알림과 겹치거나 거짓이 되지 않게(REV-097 L-1). 실패를 맡은 화면이 있으면 지우지 않는다 — 실패 문구가 같은 토스트 칸을
 * 덮어 성공 토스트가 저절로 사라지고, 빈 문구가 미뤄 둔·막 띄운 실패 알림을 지우는 순서 문제도 없다.
 */
export function clearFreshSuccessToast(
  shownAt: number,
  now: number,
  onToast: (msg: string, ms?: number) => void,
  claims: Pick<SaveFailureClaims, 'isClaimed'> = saveFailureClaims,
): void {
  if (claims.isClaimed()) return
  if (now - shownAt < DISPLAY_TOAST_MS) onToast('', 0)
}

/** `enabled` 인 동안만 맡고, 해제 함수를 돌려준다(effect cleanup 이 그대로 부른다). enabled 가 false 면 맡지 않는다. */
export function claimWhile(
  enabled: boolean,
  fn: () => void,
  claims: Pick<SaveFailureClaims, 'claim'> = saveFailureClaims,
  takeLeftover?: () => boolean,
): (() => void) | undefined {
  return enabled ? claims.claim(fn, takeLeftover) : undefined
}

/**
 * 이 화면이 `<Toast>` 를 그리는 동안(`enabled`)만 표시 설정 저장 실패 알림을 맡는다(회화방). 로드 중·오류·없음 화면처럼 토스트가 없는 상태에서는
 * 맡지 않아 셸이 띄운다 — 알림이 0개가 되지 않게(task-030 REV-099 M-1). `onFail`·`takeLeftover` 는 최신 값을 쓴다.
 * 맡기·해제는 layout effect — 커밋과 해제 사이(passive cleanup 이 밀리는 동안) 온 실패가 이미 없는 화면으로 가지 않게 커밋 안에서 동기로 끝낸다(REV-100 #1).
 */
export function useClaimDisplaySaveFailure(onFail: () => void, enabled = true, takeLeftover?: () => boolean): void {
  const ref = useRef(onFail)
  const leftRef = useRef(takeLeftover)
  useEffect(() => {
    ref.current = onFail
    leftRef.current = takeLeftover
  })
  useLayoutEffect(() => claimWhile(enabled, () => ref.current(), saveFailureClaims, () => leftRef.current?.() ?? false), [enabled])
}

/** 표시 설정 저장 실패를 듣는다(앱 셸 알림·호스트의 성공 토스트 정리). `onFail` 은 최신 값을 쓴다. */
export function useDisplaySaveFailure(onFail: () => void): void {
  const ref = useRef(onFail)
  useEffect(() => {
    ref.current = onFail
  })
  useEffect(() => watchSaveFailures(displayPrefsStore, () => ref.current()), [])
}

export interface DisplayPrefs extends DisplaySnapshot {
  set: (key: DisplayKey, on: boolean, onError?: () => void) => void
  reload: () => Promise<void>
}

const setPref = (key: DisplayKey, on: boolean, onError?: () => void) => displayPrefsStore.set(key, on, onError)
const reloadPrefs = () => displayPrefsStore.reload()

export function useDisplayPrefs(): DisplayPrefs {
  const snap = useSyncExternalStore(displayPrefsStore.subscribe, displayPrefsStore.getSnapshot, () => SERVER_SNAPSHOT)
  useEffect(() => {
    void displayPrefsStore.ensureLoaded()
  }, [])
  return { ...snap, set: setPref, reload: reloadPrefs }
}
