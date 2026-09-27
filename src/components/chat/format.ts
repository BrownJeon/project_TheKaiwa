/**
 * 채팅 전용 시각 규칙. 공용 KST 표기·글자 수는 `@/components/common/format`(task-008 F10 에서 옮김).
 */
import { toDate } from '@/components/common/format'

/** 같은 역할 말풍선을 한 묶음으로 보는 간격(5분). */
export const GROUP_GAP_MS = 5 * 60 * 1000

export function withinGroupGap(aIso: string, bIso: string): boolean {
  const a = toDate(aIso)
  const b = toDate(bIso)
  if (!a || !b) return false
  return Math.abs(b.getTime() - a.getTime()) <= GROUP_GAP_MS
}
