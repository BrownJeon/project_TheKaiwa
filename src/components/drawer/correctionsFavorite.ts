/**
 * 채택 교정 모음의 단어 상세 시트 머리 별(task-074 후속, screens.md §32-5·§32-9) — 같은 상세 시트를 이 화면에서도 쓰므로 머리 별도 같다.
 * 단어장 화면(`WordsScreen`)이 `useWordFavorites` 에 넘기는 두 콜백의 이 화면 버전이다.
 *
 * - 이 화면은 「즐겨찾기」 칸 목록이 아니다 → `inFavoriteView` 는 늘 false(별을 꺼도 빠질 행이 없고 다시 읽을 칸도 없다). 그래서 컨트롤러가
 *   `reload`·「즐겨찾기에서 뺐어요」 토스트를 만들 일이 없고, 화면은 `x.reload` 를 보지 않는다.
 * - 목록(교정 카드)은 별 상태를 그리지 않으므로 별 값을 목록에 되먹일 곳이 없다 — 별 기록은 시트만 본다.
 * - 별 요청이 404(단어가 사라짐)이면 그 단어 시트가 열려 있을 때 이 화면의 「단어가 사라짐」 경로(`wordGone` = 시트 닫기+토스트+목록 다시 읽기)를
 *   그대로 쓴다. 토스트는 한 번만 — 그 경로가 보이므로 여기서 따로 보이지 않는다.
 *
 * 화면은 두 함수를 훅 인자 안에서(인라인 화살표) 부른다 — ref 를 만지는 `wordGone` 을 렌더 중 호출 함수에 넘기면 React Compiler 규칙이 막는다.
 */
import type { FavEffect } from '@/components/vocab/favorite'
import { WORD_NOT_FOUND } from '@/components/vocab/labels'

export type CorrectionsOpenWord = { wordId: string; fromId: string } | null

export interface CorrectionsFavoriteHost {
  toast: (message: string) => void
  /** 열린 단어가 사라졌을 때 이 화면이 하는 일(시트 닫기 + 토스트 + 누른 카드 기준 다시 읽기). */
  wordGone: (fromId: string, message: string) => void
}

export const correctionsInFavoriteView = (): boolean => false

/** `open` = 응답 순간 열려 있는 단어 시트(없으면 null). */
export function correctionsFavoriteEffect(x: FavEffect, open: CorrectionsOpenWord, host: CorrectionsFavoriteHost): void {
  if (x.notFound && open && open.wordId === x.id) {
    host.wordGone(open.fromId, x.toast ?? WORD_NOT_FOUND)
    return
  }
  if (x.toast) host.toast(x.toast)
}
