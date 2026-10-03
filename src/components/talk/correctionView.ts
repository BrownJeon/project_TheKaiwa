/**
 * 회화방 교정 표시 계산(task-010c, 순수) — 유창성의 "모아 둔 교정"(LATER)은 대화 속에 그리지 않고, 코치 힌트 교정은 정답을 열기 전까지
 * 힌트만 보인다. 정답 공개는 [정답 보기]를 누르거나(화면 상태) 다음 말에서 고치지 못했을 때(MISSED, 결정 b=B) 열린다.
 */
import type { ChatMessageView, CorrectionDto, SelfCheckResult } from '@/types/chat'
import { isTemp } from '@/components/chat/messages'

/** 대화 속(사용자 말풍선 아래)에 바로 그리는 교정인가 — LATER 만 아니다(없으면 지금처럼 NOW). */
export function isInlineCorrection(c: Pick<CorrectionDto, 'deliver'>): boolean {
  return c.deliver !== 'LATER'
}

export type CoachLine = 'self' | 'repeat' | 'missed' | 'afterReveal' | null

export interface CoachCardView {
  /** false 면 힌트 카드(내 문장·힌트·[정답 보기]만, 교정문·설명·채택 숨김). */
  open: boolean
  badge: 'SELF' | 'REPEAT' | null
  line: CoachLine
}

/** 힌트가 없는 교정은 늘 열린 기존 카드(데모 co-nohint). */
export function coachCardView(c: Pick<CorrectionDto, 'hintKo' | 'selfCheck' | 'status'>, revealed: boolean): CoachCardView {
  if (!c.hintKo) return { open: true, badge: null, line: null }
  const judged: SelfCheckResult | null = c.selfCheck ?? null
  if (judged === 'SELF') return { open: true, badge: 'SELF', line: 'self' }
  if (judged === 'REPEAT') return { open: true, badge: 'REPEAT', line: 'repeat' }
  if (judged === 'MISSED') return { open: true, badge: null, line: revealed ? null : 'missed' }
  if (!revealed) return { open: false, badge: null, line: null }
  return { open: true, badge: null, line: c.status === 'PROPOSED' ? 'afterReveal' : null }
}

/**
 * 다시 말해 보기를 기다리는 코치 카드 — 마지막(서버에 저장된) 사용자 말에 달린, 힌트가 있고 판정 전이며 아직 제안인 교정.
 * 상태 줄 문구와 다음 턴의 `coachRevealed` 가 이 값을 본다.
 */
export function waitingCoach(ms: readonly ChatMessageView[]): CorrectionDto | null {
  for (let i = ms.length - 1; i >= 0; i--) {
    const m = ms[i]
    if (m.role !== 'USER') continue
    if (isTemp(m)) return null
    return (m.corrections ?? []).find((c) => !!c.hintKo && !c.selfCheck && c.status === 'PROPOSED') ?? null
  }
  return null
}

/** 턴 `done.selfCheck` 를 그 교정에 단다. */
export function applySelfCheck(ms: readonly ChatMessageView[], sc: { correctionId: string; result: SelfCheckResult }): ChatMessageView[] {
  return ms.map((m) =>
    m.corrections?.some((c) => c.id === sc.correctionId) ? { ...m, corrections: m.corrections.map((c) => (c.id === sc.correctionId ? { ...c, selfCheck: sc.result } : c)) } : m,
  )
}
