/**
 * Sentence Detector(speech-platform/16 §6.1) — 정규화 **전** 원문을 문장 조각으로 나눈다(원문 좌표 유지).
 *   - `。！？!?` 뒤, `…` 뒤, 문장 끝 부호 바로 뒤에 오는 닫는 괄호(」』）) 뒤에서 나눈다.
 *   - `maxChars` 를 넘는 조각은 `、` 에서 2차 분할(그래도 넘으면 글자 수로 자른다).
 *   - 4자 미만 조각은 앞 조각에 붙인다.
 * `splitAtComma`(PRONUNCIATION 프로필)면 `、` 에서도 나눈다.
 */

export interface SentencePiece {
  start: number
  end: number
  text: string
}

const END = new Set(['。', '！', '？', '!', '?', '…'])
const CLOSE = new Set(['」', '』', '）', ')'])
const MIN_PIECE = 4

function cut(text: string, isBoundary: (i: number) => boolean): SentencePiece[] {
  const out: SentencePiece[] = []
  let start = 0
  for (let i = 0; i < text.length; i++) {
    if (!isBoundary(i)) continue
    let end = i + 1
    // 연속 부호(！？…)와 문장 끝 뒤 닫는 괄호는 같은 조각에 둔다.
    while (end < text.length && (END.has(text[end]) || CLOSE.has(text[end]))) end++
    if (end > start) out.push({ start, end, text: text.slice(start, end) })
    start = end
    i = end - 1
  }
  if (start < text.length) out.push({ start, end: text.length, text: text.slice(start) })
  return out
}

function splitLong(p: SentencePiece, maxChars: number): SentencePiece[] {
  if ([...p.text].length <= maxChars) return [p]
  const byComma = cut(p.text, (i) => p.text[i] === '、').map((c) => ({ start: p.start + c.start, end: p.start + c.end, text: c.text }))
  const out: SentencePiece[] = []
  for (const c of byComma) {
    if ([...c.text].length <= maxChars) {
      out.push(c)
      continue
    }
    // 쉼표도 없는 긴 조각 — 코드 유닛 기준으로 자르되 서로게이트 쌍을 가르지 않는다.
    let s = c.start
    while (s < c.end) {
      let e = Math.min(c.end, s + maxChars)
      if (e < c.end && /[\uDC00-\uDFFF]/.test(p.text[e - p.start] ?? '')) e--
      out.push({ start: s, end: e, text: p.text.slice(s - p.start, e - p.start) })
      s = e
    }
  }
  return out
}

export function splitSentences(text: string, opts: { maxChars: number; splitAtComma?: boolean }): SentencePiece[] {
  const first = cut(text, (i) => END.has(text[i]) || (!!opts.splitAtComma && text[i] === '、'))
  const pieces = first.flatMap((p) => splitLong(p, opts.maxChars)).filter((p) => p.text.trim().length > 0)
  const merged: SentencePiece[] = []
  for (const p of pieces) {
    const prev = merged[merged.length - 1]
    if (prev && [...p.text.trim()].length < MIN_PIECE && [...prev.text].length + [...p.text].length <= opts.maxChars) {
      merged[merged.length - 1] = { start: prev.start, end: p.end, text: prev.text + p.text }
    } else merged.push(p)
  }
  return merged
}
