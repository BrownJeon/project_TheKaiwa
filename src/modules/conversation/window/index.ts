/**
 * 대화 창(bjj `masterChat.buildWindow` 이식) — 최근 메시지부터 거꾸로 담되 개수·문자 상한을 넘기면 오래된 것부터 버린다.
 * 한 줄이 줄 상한보다 길면 뒤를 잘라 `…` 를 붙인다(한 메시지가 창 전체를 먹지 않게).
 */
export interface WindowMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface WindowLimits {
  maxCount: number
  maxChars: number
  maxLineChars?: number
}

export function buildWindow(history: WindowMessage[], limits: WindowLimits): WindowMessage[] {
  const lineCap = limits.maxLineChars ?? 400
  const out: WindowMessage[] = []
  let used = 0
  for (let i = history.length - 1; i >= 0 && out.length < limits.maxCount; i--) {
    const m = history[i]
    const content = m.content.length > lineCap ? `${m.content.slice(0, lineCap - 1)}…` : m.content
    if (used + content.length > limits.maxChars) break
    used += content.length
    out.unshift({ role: m.role, content })
  }
  return out
}
