/**
 * #24r 읽기 분석 요청 묶기·캐시·상태(task-026, screens §15-2 B~E). 화면의 히라가나(루비)·한글 줄은 전부 여기서 받은 세그먼트로 그린다 —
 * 변환은 `@/modules/speech/reading/client` 만(한글 줄 = `hangulLine()`, QA O-1).
 *
 * - 화면 전체의 `useAnnotations` 가 넘긴 문장을 한 대기열에 모아 같은 tick 끝에 최대 64개씩 `POST /api/v1/text/annotate`(차례로 — 서버 동시 2건 상한).
 * - 같은 문장은 한 번만 보낸다. 결과는 문장 → 세그먼트|null 메모리 캐시(LRU 2,000, 앱 세션 동안).
 * - `available:true` 인데 칸이 null = 분석 불가 → null 로 캐시(다시 묻지 않음). `available:false` 의 null 칸·HTTP 실패(429 포함)·12초 시간
 *   초과(REV-094 M-2) = 캐시하지 않고 조각별 실패 기록 `{at, n}` → 숨김. 같은 규칙으로 다시 묻는다(REV-096 #1): 마지막 실패에서 35초가
 *   지났고(서버 쉼 30초 안에서는 묻지 않는다) 재시도가 2회 남았을 때만(최초 포함 3번 실패하면 앱 세션 동안 그 문장은 숨김). 다시 묻는 계기는
 *   이벤트뿐 — 화면에 새 문장이 오거나(캐시 버전 변화)·앱으로 돌아오거나(visibilitychange)·네트워크가 돌아오거나(online)·표시 설정을 켤 때.
 *   타이머 폴링은 하지 않는다(장애 중 요청을 늘리지 않는다). 재시도 중에도 숨김을 유지한다(오래 머무는 방의 앞 말풍선이 막대로 흔들리지 않게).
 * - 400자 넘는 말은 400자 안의 마지막 `。！？!?\n` 뒤에서 잘라 보내고 결과를 잇는다. 끊을 곳이 없으면 숨김.
 * - "애매하면 숨김": 세그먼트 표기를 이은 것이 원문과 다르면 쓰지 않는다(옛 읽기 줄·다른 변환으로 대체하지 않는다).
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { apiPost } from '@/components/common/api'
import {
  alignWordRuby,
  hasKanji,
  READING_MAX_CHARS,
  READING_MAX_TEXTS,
  type ReadingSegment,
  type RubyPiece,
} from '@/modules/speech/reading/client'
import { useDisplayPrefs, withTimeout } from './displayPrefs'

export type AnnotationState =
  | { s: 'off' }
  | { s: 'loading' }
  | { s: 'ready'; segments: ReadingSegment[] }
  | { s: 'none' }

export const OFF: AnnotationState = { s: 'off' }
export const NONE: AnnotationState = { s: 'none' }
export const LOADING: AnnotationState = { s: 'loading' }

export const ANNOTATION_CACHE_MAX = 2000
/** 실패한 조각을 다시 묻기까지 기다리는 시간 — 서버의 전역 쉼(30초) + 여유. */
export const ANNOTATE_RETRY_AFTER_MS = 35_000
/** 최초 요청 뒤 다시 묻는 최대 횟수(실패 3번째에서 멈춘다). */
export const ANNOTATE_RETRY_MAX = 2
/** #24r 한 묶음의 시간 상한 — 넘으면 실패와 같이 숨긴다(막대가 계속 돌지 않게). */
export const ANNOTATE_TIMEOUT_MS = 12_000
const CUT_AFTER = /[。！？!?\n]/

/**
 * 400자(서버 상한) 넘는 말을 문장 끝에서 나눈다. 나눈 조각을 이으면 원문과 같다. 400자 안에 끊을 곳이 없으면 null(그 말은 숨김 —
 * 중간을 자르면 단어가 잘려 읽기가 틀린다).
 */
export function splitForAnnotate(text: string, max = READING_MAX_CHARS): string[] | null {
  if (text.length <= max) return [text]
  const out: string[] = []
  let rest = text
  while (rest.length > max) {
    let cut = -1
    for (let i = max - 1; i >= 0; i--) {
      if (CUT_AFTER.test(rest[i])) {
        cut = i + 1
        break
      }
    }
    if (cut <= 0) return null
    out.push(rest.slice(0, cut))
    rest = rest.slice(cut)
  }
  if (rest.length > 0) out.push(rest)
  return out
}

const isBlank = (s: string) => s.trim().length === 0

/** 공백뿐인 조각(나눈 뒤 남은 줄바꿈 등)은 분석하지 않고 그대로 이어 붙인다. */
function plainSegment(text: string): ReadingSegment {
  return { surface: text, ruby: null, pron: text, boundary: null }
}

export interface AnnotateItem {
  segments: ReadingSegment[]
}
export interface AnnotateResponse {
  items: Array<AnnotateItem | null>
  available: boolean
}

type PieceStatus = 'queued' | 'inflight'

/** 조각 하나의 실패 기록 — `at` 마지막 실패 시각, `n` 실패 횟수(최초 포함). */
export interface AnnotateFailure {
  at: number
  n: number
}

/** 실패한 조각을 지금 다시 물어도 되는가(간격·횟수 상한). */
export function canRetryAnnotate(f: AnnotateFailure, now: number): boolean {
  return f.n - 1 < ANNOTATE_RETRY_MAX && now - f.at >= ANNOTATE_RETRY_AFTER_MS
}

export interface AnnotationClientDeps {
  post: (texts: string[], signal?: AbortSignal) => Promise<AnnotateResponse>
  /** 같은 tick 끝 — 테스트는 직접 flush 한다. */
  schedule: (fn: () => void) => void
  /** 테스트가 줄인다. 기본 `ANNOTATE_TIMEOUT_MS`. */
  timeoutMs?: number
  /** 테스트가 시계를 정한다. 기본 `Date.now`. */
  now?: () => number
}

/** 묶음 요청·캐시 본체(테스트가 가짜 post 로 만든다). 화면은 모듈 전역 인스턴스만 쓴다. */
export class AnnotationClient {
  private cache = new Map<string, ReadingSegment[] | null>()
  private status = new Map<string, PieceStatus>()
  /** 실패한 조각(캐시와 같은 상한·오래된 것부터 삭제). 성공·null 캐시 때 지운다. */
  private failures = new Map<string, AnnotateFailure>()
  private queue: string[] = []
  private scheduled = false
  private listeners = new Set<() => void>()
  private ver = 0

  constructor(private readonly deps: AnnotationClientDeps) {}

  version = (): number => this.ver

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private emit() {
    this.ver++
    for (const fn of this.listeners) fn()
  }

  private put(text: string, value: ReadingSegment[] | null) {
    this.cache.delete(text)
    this.cache.set(text, value)
    while (this.cache.size > ANNOTATION_CACHE_MAX) {
      const oldest = this.cache.keys().next().value as string
      this.cache.delete(oldest)
    }
  }

  private fail(text: string, now: number) {
    const n = (this.failures.get(text)?.n ?? 0) + 1
    this.failures.delete(text)
    this.failures.set(text, { at: now, n })
    while (this.failures.size > ANNOTATION_CACHE_MAX) {
      const oldest = this.failures.keys().next().value as string
      this.failures.delete(oldest)
    }
  }

  private now(): number {
    return (this.deps.now ?? Date.now)()
  }

  /** 테스트·디버그용. */
  cached(text: string): ReadingSegment[] | null | undefined {
    return this.cache.get(text)
  }

  /** 테스트·디버그용. */
  failure(text: string): AnnotateFailure | undefined {
    return this.failures.get(text)
  }

  /**
   * 문장들을 요청한다. 캐시·대기·요청 중이면 건너뛰고(캐시 적중은 LRU 순서만 새로 한다), 실패한 조각은 `canRetryAnnotate` 일 때만 다시
   * 넣는다. 그래서 화면 훅은 같은 문장을 몇 번 넘겨도 된다 — 새로 넣은 조각이 없으면 아무 일도 일어나지 않는다(emit 없음 → 루프 없음).
   */
  request(texts: readonly string[]): void {
    let added = false
    let now: number | null = null
    for (const t of texts) {
      for (const piece of splitForAnnotate(t) ?? []) {
        if (isBlank(piece)) continue
        if (this.cache.has(piece)) {
          this.put(piece, this.cache.get(piece) ?? null)
          continue
        }
        if (this.status.has(piece)) continue
        const f = this.failures.get(piece)
        if (f && !canRetryAnnotate(f, (now ??= this.now()))) continue
        this.status.set(piece, 'queued')
        this.queue.push(piece)
        added = true
      }
    }
    if (added) {
      this.emit()
      if (!this.scheduled) {
        this.scheduled = true
        this.deps.schedule(() => void this.flush())
      }
    }
  }

  async flush(): Promise<void> {
    this.scheduled = false
    const all = this.queue.splice(0)
    for (let i = 0; i < all.length; i += READING_MAX_TEXTS) {
      const batch = all.slice(i, i + READING_MAX_TEXTS)
      for (const t of batch) this.status.set(t, 'inflight')
      let res: AnnotateResponse | null = null
      try {
        res = await withTimeout((signal) => this.deps.post(batch, signal), this.deps.timeoutMs ?? ANNOTATE_TIMEOUT_MS)
      } catch {
        res = null
      }
      batch.forEach((t, k) => {
        const item = res && Array.isArray(res.items) ? res.items[k] : undefined
        if (item && Array.isArray(item.segments)) {
          const segs = item.segments
          // 표기를 이은 것이 원문과 다르면 범위·루비가 어긋난다 — 분석 불가로 본다.
          this.put(t, segs.length > 0 && segs.map((s) => s.surface).join('') === t ? segs : null)
          this.failures.delete(t)
        } else if (res && res.available === true && item === null) {
          this.put(t, null)
          this.failures.delete(t)
        } else {
          this.fail(t, this.now())
        }
        this.status.delete(t)
      })
      this.emit()
    }
  }

  /** 한 문장의 상태(조각을 이어서). 요청 전·대기·요청 중 = loading, 분석 불가·실패(재시도 중 포함)·나눌 수 없음 = none. */
  stateOf(text: string): AnnotationState {
    if (isBlank(text)) return NONE
    const pieces = splitForAnnotate(text)
    if (!pieces) return NONE
    const segs: ReadingSegment[] = []
    let loading = false
    for (const piece of pieces) {
      if (isBlank(piece)) {
        segs.push(plainSegment(piece))
        continue
      }
      const hit = this.cache.get(piece)
      if (hit === null) return NONE
      if (hit) {
        segs.push(...hit)
        continue
      }
      if (this.failures.has(piece)) return NONE
      loading = true
    }
    return loading ? LOADING : { s: 'ready', segments: segs }
  }
}

export const annotationClient = new AnnotationClient({
  post: (texts, signal) => apiPost<AnnotateResponse>('/api/v1/text/annotate', { texts }, { signal }),
  schedule: (fn) => {
    setTimeout(fn, 0)
  },
})

/** 이 문장에 분석이 필요한가 — 두 층 끔·한자 없는데 한글 끔이면 요청하지 않는다(§15-2 B 4). */
export function needsAnnotation(text: string, showFurigana: boolean, showHangul: boolean): boolean {
  if (isBlank(text)) return false
  if (showHangul) return true
  return showFurigana && hasKanji(text)
}

/**
 * 앱으로 돌아올 때(`visibilitychange` → visible)·네트워크가 돌아올 때(`online`) `onWake`. 돌려준 함수가 두 리스너를 모두 뗀다.
 * 실패한 문장을 다시 물을 계기일 뿐 — 묻는 여부는 `AnnotationClient.request` 의 간격·횟수 상한이 정한다.
 */
export function listenWake(doc: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>, win: Pick<Window, 'addEventListener' | 'removeEventListener'>, onWake: () => void): () => void {
  const onVisible = () => {
    if (doc.visibilityState === 'visible') onWake()
  }
  doc.addEventListener('visibilitychange', onVisible)
  win.addEventListener('online', onWake)
  return () => {
    doc.removeEventListener('visibilitychange', onVisible)
    win.removeEventListener('online', onWake)
  }
}

/**
 * 문장들의 분석 상태(입력 순서). 표시 설정 로드 전·두 층 끔이면 `off`(요청 0). 필요한 문장을 `[want, ver, wake]` 가 바뀔 때마다
 * `request` 에 넘긴다 — 중복·실패 재시도 상한은 클라이언트가 거른다(REV-096 #1, 타이머 없음).
 */
export function useAnnotations(texts: readonly string[]): AnnotationState[] {
  const prefs = useDisplayPrefs()
  const ver = useSyncExternalStore(annotationClient.subscribe, annotationClient.version, () => 0)
  const [wake, setWake] = useState(0)
  const key = texts.join('\u0000')
  const active = prefs.loaded && (prefs.showFurigana || prefs.showHangul)

  const want = useMemo(
    () => (active ? texts.filter((t) => needsAnnotation(t, prefs.showFurigana, prefs.showHangul)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 문장 목록은 `key`(이은 문자열)로 비교한다(매 렌더 새 배열)
    [key, active, prefs.showFurigana, prefs.showHangul],
  )

  useEffect(() => listenWake(document, window, () => setWake((w) => w + 1)), [])

  useEffect(() => {
    if (want.length > 0) annotationClient.request(want)
  }, [want, ver, wake])

  return useMemo(
    () =>
      texts.map((t) => {
        if (!active) return OFF
        if (isBlank(t)) return NONE
        if (!needsAnnotation(t, prefs.showFurigana, prefs.showHangul)) return OFF
        return annotationClient.stateOf(t)
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 위와 같음 + 캐시 버전
    [key, active, prefs.showFurigana, prefs.showHangul, ver],
  )
}

export function useAnnotation(text: string): AnnotationState {
  return useAnnotations([text])[0]
}

/* ── 단어(저장된 읽기가 있는 표제어) ─────────────────────────────────────── */

function kataToHira(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
}

/** 분석기가 읽은 히라가나 — 조각마다 루비가 있으면 그 읽기(없으면 표기), 없으면 표기. 가타카나는 히라가나로. */
export function segmentsHiragana(segments: readonly ReadingSegment[]): string {
  let out = ''
  for (const s of segments) out += s.ruby ? s.ruby.map(([t, r]) => r ?? t).join('') : s.surface
  return kataToHira(out)
}

/** 저장 읽기와 분석기 읽기가 같은가(가타카나→히라가나·공백 무시). 저장 읽기가 없으면 대조하지 않는다(같다고 본다). */
export function readingMatches(segments: readonly ReadingSegment[], stored: string | null | undefined): boolean {
  const want = stored ? kataToHira(stored).replace(/\s+/g, '') : ''
  if (!want) return true
  return segmentsHiragana(segments).replace(/\s+/g, '') === want
}

/**
 * 단어 한글 줄 상태 — 한글 끔이면 `off`, 분석 읽기가 저장 읽기와 다르면 `none`(서로 어긋난 발음을 보이지 않는다, ★ Leader 확인 ①),
 * 그 밖은 분석 상태 그대로. 훅(`useWordLayersList`)은 이 함수로만 정한다(REV-095 M-1).
 */
export function wordHangulState(on: boolean, st: AnnotationState, stored: string | null | undefined): AnnotationState {
  if (!on) return OFF
  return st.s === 'ready' && !readingMatches(st.segments, stored) ? NONE : st
}

export interface WordLayers {
  /** 표제어 루비(저장 읽기로 정렬, 히라가나 끔·한자 없음·정렬 실패면 null). */
  ruby: RubyPiece[] | null
  /** 한글 줄용 상태 — 분석 읽기가 저장 읽기와 다르면 `none`(서로 어긋난 발음을 보이지 않는다, ★ Leader 확인 ①). */
  hangul: AnnotationState
}

export interface WordInput {
  surface: string
  reading?: string | null
}

/** 단어 여러 개의 층(단어장 목록·오늘의 단어 덱이 한 번에 받는다). 루비는 서버 없이, 한글은 표제어 #24r(한글 켬일 때만). */
export function useWordLayersList(words: readonly WordInput[]): WordLayers[] {
  const prefs = useDisplayPrefs()
  const surfaces = words.map((w) => (prefs.showHangul ? w.surface : ''))
  const states = useAnnotations(surfaces)
  const key = words.map((w) => `${w.surface}\u0001${w.reading ?? ''}`).join('\u0000')
  return useMemo(
    () =>
      words.map((w, i) => {
        const ruby = prefs.loaded && prefs.showFurigana && w.reading ? alignWordRuby(w.surface, w.reading) : null
        return { ruby, hangul: wordHangulState(prefs.loaded && prefs.showHangul, states[i], w.reading) }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 단어 목록은 `key` 로 비교한다
    [key, prefs.loaded, prefs.showFurigana, prefs.showHangul, states],
  )
}

export function useWordLayers(surface: string, reading?: string | null): WordLayers {
  return useWordLayersList([{ surface, reading }])[0]
}

/* ── 루비 조각 × 범위(문장 강조·교정 diff·비교 밑줄) ───────────────────── */

export interface TextRange {
  /** 코드포인트 기준 [start, end) */
  start: number
  end: number
  className: string
  as?: 'span' | 'mark'
}

export interface RubyRun {
  range: TextRange | null
  pieces: RubyPiece[]
}

const cpLen = (s: string) => Array.from(s).length

/**
 * 루비 조각을 범위 경계에서 잘라 같은 범위끼리 묶는다(겹치지 않는 범위 전제). 경계가 한자 묶음 한가운데를 자르면 그 묶음만 읽기를 뺀다 —
 * 글자·범위 표시는 그대로(반쪽 읽기를 보이지 않는다). 조각을 이으면 원문과 같다.
 */
export function cutRubyByRanges(pieces: readonly RubyPiece[], ranges: readonly TextRange[] = []): RubyRun[] {
  const sorted = ranges.filter((r) => r.end > r.start).slice().sort((a, b) => a.start - b.start)
  const rangeAt = (pos: number) => sorted.find((r) => r.start <= pos && pos < r.end) ?? null
  const cuts = new Set<number>()
  for (const r of sorted) {
    cuts.add(r.start)
    cuts.add(r.end)
  }
  const runs: RubyRun[] = []
  const push = (piece: RubyPiece, at: number) => {
    const range = rangeAt(at)
    const last = runs[runs.length - 1]
    if (last && last.range === range) {
      const prev = last.pieces[last.pieces.length - 1]
      if (prev && prev.reading === null && piece.reading === null) prev.text += piece.text
      else last.pieces.push({ ...piece })
    } else runs.push({ range, pieces: [{ ...piece }] })
  }
  let pos = 0
  for (const p of pieces) {
    const chars = Array.from(p.text)
    const len = chars.length
    const inner: number[] = []
    for (let k = 1; k < len; k++) if (cuts.has(pos + k)) inner.push(k)
    if (inner.length === 0) {
      if (len > 0) push(p, pos)
    } else {
      let from = 0
      for (const k of [...inner, len]) {
        push({ text: chars.slice(from, k).join(''), reading: null }, pos + from)
        from = k
      }
    }
    pos += len
  }
  return runs
}

/** 원문을 루비 없는 한 조각으로(분석 전·끔·실패일 때 범위만 그린다). */
export function plainPieces(text: string): RubyPiece[] {
  return text ? [{ text, reading: null }] : []
}

/** 문장 조각들(이으면 본문) → 그중 i번째의 코드포인트 범위. */
export function spanRange(spans: readonly string[], index: number, className: string): TextRange | null {
  if (index < 0 || index >= spans.length) return null
  let start = 0
  for (let i = 0; i < index; i++) start += cpLen(spans[i])
  return { start, end: start + cpLen(spans[index]), className }
}

/** diff 조각 중 바뀐 것 → 범위. */
export function changedRanges(segs: ReadonlyArray<{ text: string; changed: boolean }>, className: string): TextRange[] {
  const out: TextRange[] = []
  let pos = 0
  for (const s of segs) {
    const n = cpLen(s.text)
    if (s.changed && n > 0) out.push({ start: pos, end: pos + n, className })
    pos += n
  }
  return out
}
