/**
 * 칸 id 와 "첫 오류 칸으로 포커스"(screens.md §10-2 D). 시트가 하나씩만 열리므로 id 는 고정 값이다.
 * 라디오 묶음(악센트·범위)은 묶음 자체가 아니라 지금 탭 순서에 있는 칩(`tabindex=0`)으로 옮긴다.
 */
import type { DraftField } from './kana'

export const FIELD_ID: Record<DraftField, string> = {
  surface: 'lexSurface',
  reading: 'lexReading',
  accentType: 'lexAccent',
  priority: 'lexPriority',
  wordType: 'lexWordType',
  scope: 'lexScope',
  scopeRefId: 'lexScopeRef',
  note: 'lexNote',
}

export const REASON_ID = 'lexReason'
export const CONFIRM_ID = 'lexConfirm'

const SELECTOR: Partial<Record<DraftField | 'reason' | 'confirm', string>> = {
  accentType: `#${FIELD_ID.accentType} [tabindex="0"]`,
  scope: `#${FIELD_ID.scope} [tabindex="0"]`,
  reason: `#${REASON_ID}`,
  confirm: `#${CONFIRM_ID}`,
}

export function focusField(field: DraftField | 'reason' | 'confirm'): void {
  // 오류 문구가 그려진 뒤에 옮긴다(같은 틱이면 aria-describedby 대상이 아직 없다).
  setTimeout(() => {
    const el = document.querySelector<HTMLElement>(SELECTOR[field] ?? `#${FIELD_ID[field as DraftField]}`)
    el?.focus()
    el?.scrollIntoView({ block: 'center', behavior: 'auto' })
  }, 0)
}
