/**
 * 단어장 화면(`WordsScreen`)의 즐겨찾기 배선(task-074 §32-9) — 화면은 여기 함수를 부르기만 한다. jsdom 없이 동작 시험하려고 화면 밖으로 뺐다
 * (REV-074U M-1). 교정 모음 쪽 같은 역할은 `drawer/correctionsFavorite.ts`.
 *
 * - 효과(`FavEffect`) → 할 일: 토스트는 늘 그대로 한 번. 404 면 그 단어 상세 시트가 열려 있을 때만 닫고 전체 다시 읽기(시트의 `onNotFound` 는 따로
 *   부르지 않는다 — 토스트 1번). 즐겨찾기 칸에서 끈 응답이면 같은 쪽 다시 읽기 + 응답을 깐 뒤 초점 확인(D3).
 * - 목록 응답 꼬리: 성공 응답만 `listReadAt` 을 그 요청의 보내기 직전 시각으로 바꾸고, 초점 확인이 걸려 있으면 한 번 소비해 다음 그림 뒤에
 *   초점이 사라졌을 때(body·없음)만 머리 줄로 보낸다(화면은 끌어올리지 않는다).
 */
import type { WordEntry } from '@/types/vocab'
import type { FavEffect } from './favorite'
import type { WordsListState } from './wordsPaging'

/** 응답 순간 지금 깔린 목록이 「즐겨찾기」 칸인가. */
export function wordsInFavoriteView(list: Pick<WordsListState, 'shown'>): boolean {
  return list.shown?.source === 'favorite'
}

export interface WordsFavoritePlan {
  toast: string | null
  /** 이 id 의 상세 시트가 열려 있으면 닫는다(404). */
  closeDetailId: string | null
  reloadAll: boolean
  /** 즐겨찾기 칸에서 끈 응답 — 같은 쪽 다시 읽기. */
  reload: boolean
  /** 다시 읽은 응답을 깐 뒤 초점이 사라졌으면 머리 줄로. */
  focusCheck: boolean
}

export function wordsFavoriteEffect(x: FavEffect): WordsFavoritePlan {
  if (x.notFound) return { toast: x.toast, closeDetailId: x.id, reloadAll: true, reload: false, focusCheck: false }
  if (x.reload) return { toast: x.toast, closeDetailId: null, reloadAll: false, reload: true, focusCheck: true }
  return { toast: x.toast, closeDetailId: null, reloadAll: false, reload: false, focusCheck: false }
}

type SheetLike = { kind: string; id?: string } | null

/** 그 단어의 상세 시트면 닫고(null), 다른 시트·다른 단어면 그대로. */
export function detailSheetAfterGone<S extends SheetLike>(s: S, id: string): S {
  return s !== null && s.kind === 'detail' && s.id === id ? (null as S) : s
}

export interface WordsFavoriteDeps<S extends SheetLike> {
  showToast: (message: string) => void
  setSheet: (update: (s: S) => S) => void
  reloadAll: () => void
  request: (kind: 'reload') => void
  focusCheck: { current: boolean }
}

/** 효과 하나를 화면 상태에 옮긴다 — 순서는 토스트 → 시트 닫기 → 전체 다시 읽기 | 초점 확인 걸기 → 같은 쪽 다시 읽기. */
export function runWordsFavoriteEffect<S extends SheetLike>(x: FavEffect, d: WordsFavoriteDeps<S>): void {
  const p = wordsFavoriteEffect(x)
  if (p.toast) d.showToast(p.toast)
  if (p.closeDetailId !== null) {
    const id = p.closeDetailId
    d.setSheet((s) => detailSheetAfterGone(s, id))
  }
  if (p.reloadAll) d.reloadAll()
  if (p.focusCheck) d.focusCheck.current = true
  if (p.reload) d.request('reload')
}

/** 행 별 처리기 — `shownOn`(누른 순간 보인 값)을 그대로 넘긴다. 뒤집는 것은 컨트롤러. */
export function wordsStarHandler(press: (id: string, shown: boolean) => void): (w: Pick<WordEntry, 'id'>, shownOn: boolean) => void {
  return (w, shownOn) => press(w.id, shownOn)
}

export interface WordsArrivalDeps {
  setListReadAt: (t: number) => void
  showToast: (message: string) => void
  /** 머리 줄 초점 요청 — `scroll` 은 화면을 끌어올릴지. */
  focusHead: (scroll: boolean) => void
  focusCheck: { current: boolean }
  /** 다음 그림 뒤에 부른다(브라우저 `requestAnimationFrame`). */
  nextFrame: (cb: () => void) => void
  activeElement: () => unknown
  body: () => unknown
}

/** clamp 가 아닌 목록 응답을 깐 직후(`settleWords` 다음) 할 일. `readAt` = 그 요청을 보내기 직전 시각. */
export function finishWordsArrival(a: { ok: boolean; readAt: number; toast: string | null; focusHead: boolean }, d: WordsArrivalDeps): void {
  if (a.ok) d.setListReadAt(a.readAt)
  if (a.toast) d.showToast(a.toast)
  if (a.focusHead) d.focusHead(true)
  if (d.focusCheck.current) {
    d.focusCheck.current = false
    d.nextFrame(() => {
      const el = d.activeElement()
      if (!el || el === d.body()) d.focusHead(false)
    })
  }
}
