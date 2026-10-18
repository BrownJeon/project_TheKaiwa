/**
 * 오늘의 회화 ⑤ 말 바 상태(task-077 §34-3) — `useLessonVoice` 값·확인 중·재생 중에서 공용 `VoiceBar` 가 받는 `TalkView` 를 **순수하게 유도**한다
 * (질문 탭 `ask/voiceView.ts` 와 같은 방식). 문구는 지금 레슨 그대로 — 상태 줄은 `useLessonVoice.statusText`, 확인 중이면 `U5.checking`.
 * `VoiceBar` 가 `state` 로 보는 것은 레벨 미터뿐이라 `RECORDING` 은 지금 레슨처럼 `phase === 'recording'` 일 때만 둔다.
 * ⌨ 는 지금 레슨처럼 늘 누를 수 있다(`keyboardDisabled` false) — 회화방과 달리 말하는 중 잠금 토스트가 없다.
 */
import type { TalkView } from '@/components/talk/talkState'
import { U5 } from './lessonCopy'
import type { LessonVoice } from './useLessonVoice'

export interface LessonVoiceViewInput {
  phase: LessonVoice['phase']
  statusText: string
  pttLabel: string
  /** #62b 확인 중 — 누르고 말하기 잠금, 상태 줄 「확인하는 중…」 */
  checking: boolean
  /** 레슨 소리(모범 답안·내 목소리·대화)가 나는 중 — ■ 를 보인다 */
  playing: boolean
}

export function lessonVoiceView(i: LessonVoiceViewInput): TalkView {
  return {
    state: i.phase === 'recording' ? 'RECORDING' : i.phase === 'finishing' ? 'RECOGNIZING' : 'IDLE',
    sub: i.phase === 'unavailable' ? 'unavailable' : null,
    ptt: { phase: i.phase, disabled: i.checking, label: i.pttLabel },
    statusText: i.checking ? U5.checking : i.statusText,
    showStop: i.playing,
    keyboardDisabled: false,
  }
}

/** 토스트 바닥(B8 A) — ⑤ 는 하단 묶음(도우미 판 + 입력 바) 실제 높이 + 12px, 재기 전(또는 입력 영역이 없는 다시 보기)은 지금 값 136, 그 밖 단계는 24. */
export const LESSON_TOAST_GAP = 12
export const LESSON_TOAST_DEFAULT = 136
export const LESSON_TOAST_OTHER = 24

export function lessonToastBottom(stage: number, bottomHeight: number | null): number {
  if (stage !== 5) return LESSON_TOAST_OTHER
  if (bottomHeight === null || !Number.isFinite(bottomHeight) || bottomHeight <= 0) return LESSON_TOAST_DEFAULT
  return Math.round(bottomHeight) + LESSON_TOAST_GAP
}

/**
 * 도우미 판을 열 때 과제 문장(과제 카드 머리 ~ 「목표 표현」)이 본문 보이는 영역에서 가려졌는가(B8 A) — 가려졌으면 카드 머리로 한 번 맞춘다.
 * 위로 넘어갔거나 아래로 잘렸으면 가려진 것. 1px 안의 차이는 반올림 오차로 본다.
 */
export function taskSentenceHidden(r: { viewTop: number; viewBottom: number; top: number; bottom: number }): boolean {
  return r.top < r.viewTop - 1 || r.bottom > r.viewBottom + 1
}
