/**
 * 단어 즐겨찾기 별의 순수 규칙(task-074, screens.md §32-9). React 없음 — 화면 훅(`useWordFavorites`)이 얇게 감싼다.
 *
 * 한 단어의 별 상태는 화면 전체에서 하나(목록 행과 열린 시트가 같은 기록을 본다). 누르면 바로 바꿔 보이고(낙관적) 그 단어 별만 잠근다 —
 * 잠금 덕분에 한 단어에 요청은 늘 하나라 「마지막 값 우선」 처리가 필요 없다(D5 A). 실패하면 **누르기 전 기록**으로 되돌린다(`!to` 로 뒤집지 않는다).
 * 목록·시트 응답은 그 값을 읽기 시작한 시각(`readAt`)과 별 기록의 확정 시각(`at`)을 비교해, 별을 만진 뒤에 받은 값만 이기게 한다(§32-5).
 */
import type { AnnotationState } from '@/components/common/japanese/annotations'
import { hangulLine } from '@/modules/speech/reading/client'
import { FAVORITE_COPY, GENERIC_ERROR, NETWORK_ERROR, WORD_NOT_FOUND } from './labels'

/** `at` = 확정(처리 중이면 누른) 시각 — `now()` 와 같은 시계. `before` = 누르기 전 기록(처리 중일 때만). */
export interface FavEntry {
  value: boolean
  pending: boolean
  at: number
  before: FavEntry | null
}
export type FavState = Readonly<Record<string, FavEntry>>
export type FavEvent =
  | { type: 'press'; id: string; shown: boolean; at: number }
  | { type: 'ok'; id: string; value: boolean; at: number; inFavoriteView: boolean }
  | { type: 'fail'; id: string; status: number }
export interface FavStep {
  state: FavState
  send: { id: string; to: boolean } | null
  ignored: boolean
  reload: boolean
  toast: string | null
  notFound: boolean
}
export interface FavView {
  on: boolean
  locked: boolean
}
export interface FavEffect {
  id: string
  reload: boolean
  toast: string | null
  notFound: boolean
}

/** 실패 문구 — 서버 문구·429 문구를 보이지 않는다(`actionErrorText` 는 400 서버 문구·403 READ_ONLY 를 내므로 쓰지 않는다). */
export function favoriteErrorText(status: number): string {
  if (status === 0) return NETWORK_ERROR
  if (status === 404) return WORD_NOT_FOUND
  return GENERIC_ERROR
}

export function favoriteStep(s: FavState, e: FavEvent): FavStep {
  const same: FavStep = { state: s, send: null, ignored: false, reload: false, toast: null, notFound: false }
  const cur = s[e.id]
  if (e.type === 'press') {
    if (cur?.pending) return { ...same, ignored: true }
    const to = !e.shown
    return { ...same, state: { ...s, [e.id]: { value: to, pending: true, at: e.at, before: cur ?? null } }, send: { id: e.id, to } }
  }
  // 처리 중 기록이 없는 응답(해제 뒤 늦은 응답 등)은 무시한다.
  if (!cur?.pending) return { ...same, ignored: true }
  if (e.type === 'ok') {
    const reload = e.inFavoriteView && e.value === false
    return {
      ...same,
      state: { ...s, [e.id]: { value: e.value, pending: false, at: e.at, before: null } },
      reload,
      toast: reload ? FAVORITE_COPY.removedToast : null,
    }
  }
  const next: Record<string, FavEntry> = { ...s }
  if (cur.before) next[e.id] = cur.before
  else delete next[e.id]
  return { ...same, state: next, toast: favoriteErrorText(e.status), notFound: e.status === 404 }
}

/** 화면에 그릴 별 — 처리 중이면 기록(잠김), 기록이 그 값을 읽은 뒤에 확정됐으면 기록, 그 밖은 서버 값. */
export function favoriteView(server: boolean | undefined, readAt: number, e: FavEntry | undefined): FavView {
  if (e?.pending) return { on: e.value, locked: true }
  if (e && e.at > readAt) return { on: e.value, locked: false }
  return { on: server === true, locked: false }
}

export type RowStarTop = '2.471em' | '2.021em'

/**
 * 행 별의 세로 자리·셋째 줄 오른쪽 비움(§32-2). 판정은 그리는 부품과 똑같이 — 한글 줄은 `HangulLine`(설정 로드 전·끔·off·none·빈 한글이면 안 그림,
 * 로딩은 자리표시 막대), 첫 줄 줄간격은 `JaText`(넘겨받은 루비가 있고 히라가나 켬일 때만 1.95, 아니면 본문 1.5).
 * `top` = 첫 줄 높이 + 0.521em(px 항이 지워져 글꼴 배율을 따라간다).
 */
export function rowStarLayout(i: {
  prefsLoaded: boolean
  showFurigana: boolean
  showHangul: boolean
  ruby: readonly unknown[] | null
  hangul: AnnotationState
}): { top: RowStarTop; line3Pad: boolean } {
  const h = i.hangul
  const hasHangulLine = i.prefsLoaded && i.showHangul && (h.s === 'loading' || (h.s === 'ready' && !!hangulLine(h.segments)))
  const rubyReserved = i.prefsLoaded && i.showFurigana && i.ruby !== null
  return { top: rubyReserved ? '2.471em' : '2.021em', line3Pad: !hasHangulLine }
}

/** 요청 실패의 HTTP 상태(네트워크 0). `send` 가 `{ status }` 로 거절한다고 본다 — 모르는 모양은 -1(일반 실패). */
function statusOf(e: unknown): number {
  const s = (e as { status?: unknown } | null)?.status
  return typeof s === 'number' ? s : -1
}

export interface FavoriteController {
  press(id: string, shown: boolean): void
  view(id: string, server: boolean | undefined, readAt: number): FavView
  stamp(): number
  dispose(): void
}

export function createFavoriteController(deps: {
  send: (id: string, to: boolean) => Promise<{ favorite?: unknown } | null | undefined>
  now: () => number
  /** 응답 순간 지금 깔린 목록이 「즐겨찾기」 칸인가. */
  inFavoriteView: () => boolean
  onChange: (s: FavState) => void
  onEffect: (x: FavEffect) => void
}): FavoriteController {
  let state: FavState = {}
  let disposed = false

  const apply = (e: FavEvent): FavStep => {
    const step = favoriteStep(state, e)
    if (step.state !== state) {
      state = step.state
      deps.onChange(state)
    }
    return step
  }

  const press = (id: string, shown: boolean) => {
    if (disposed) return
    const step = apply({ type: 'press', id, shown, at: deps.now() })
    if (!step.send) return
    const to = step.send.to
    let req: Promise<{ favorite?: unknown } | null | undefined>
    try {
      req = deps.send(id, to)
    } catch (err) {
      req = Promise.reject(err)
    }
    req.then(
      (r) => {
        if (disposed) return
        const value = typeof r?.favorite === 'boolean' ? r.favorite : to
        const s = apply({ type: 'ok', id, value, at: deps.now(), inFavoriteView: deps.inFavoriteView() })
        if (s.reload || s.toast || s.notFound) deps.onEffect({ id, reload: s.reload, toast: s.toast, notFound: s.notFound })
      },
      (err: unknown) => {
        if (disposed) return
        const s = apply({ type: 'fail', id, status: statusOf(err) })
        if (!s.ignored) deps.onEffect({ id, reload: false, toast: s.toast, notFound: s.notFound })
      },
    )
  }

  return {
    press,
    view: (id, server, readAt) => favoriteView(server, readAt, state[id]),
    stamp: () => deps.now(),
    dispose: () => {
      disposed = true
    },
  }
}
