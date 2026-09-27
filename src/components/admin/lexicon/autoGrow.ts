/** textarea 자동 높이 — 줄 수 상한까지 늘리고 그 뒤는 칸 안 스크롤. `scrollHeight` 는 안쪽 여백은 넣고 테두리는 뺀 값이다. */
export function autoGrow(el: HTMLTextAreaElement, maxRows: number): void {
  const cs = getComputedStyle(el)
  const border = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0)
  const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)
  const line = parseFloat(cs.lineHeight) || 24
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight + border, line * maxRows + pad + border)}px`
}
