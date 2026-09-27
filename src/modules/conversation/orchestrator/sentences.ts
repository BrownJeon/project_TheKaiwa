/**
 * 회화 답(replyJa)의 문장 나누기 — 조기 합성(스트리밍)과 최종 합성이 **같은 규칙**을 쓴다(task-007 K2-2·K3).
 *  - 경계: 。！？!?… 뒤(연속 부호와 문장 끝 뒤 닫는 괄호 」』）) 는 같은 문장). 부호를 뺀 글자가 2자 미만인 조각은 다음 문장에 붙인다.
 *  - 스트리밍에서는 경계 부호 **다음 글자**가 와야(또는 문자열이 끝나야) 문장을 확정한다 — 「？！」「。」」 를 둘로 가르지 않게.
 *  - 최종 경로는 100자(= TTS 세그먼트 상한)를 넘는 문장을 、 에서, 그래도 길면 글자 수로 자른다.
 * speech 의 Sentence Detector(§6.1)와 규칙이 거의 같지만, 턴 청크는 conversation 이 스트림에서 바로 끊어야 해서 여기 둔다
 * (conversation 은 speech 를 import 하지 않는다). 청크 경계가 같을 필요는 없다 — 최종 대조는 앞부분 일치(prefix)로 한다.
 */

const END = new Set(['。', '！', '？', '!', '?', '…'])
const CLOSE = new Set(['」', '』', '）', ')'])
export const MIN_SENTENCE_CHARS = 2
export const SPEECH_CHUNK_MAX_CHARS = 100

const cpLen = (s: string) => [...s].length
/** 문장 부호·괄호·공백을 뺀 글자 수 — 「え。」 같은 한 글자 조각은 다음 문장에 붙인다. */
const bodyLen = (s: string) => [...s].filter((c) => !END.has(c) && !CLOSE.has(c) && !/[\s「『（(、]/.test(c)).length

/** 스트리밍 문장 분리기 — `push` 는 확정된 문장만 돌려준다(앞뒤 공백 제거). */
export class StreamingSentenceSplitter {
  private buf = ''

  push(text: string): string[] {
    this.buf += text
    const out: string[] = []
    let from = 0
    for (;;) {
      let i = from
      while (i < this.buf.length && !END.has(this.buf[i])) i++
      if (i >= this.buf.length) break
      let end = i + 1
      while (end < this.buf.length && (END.has(this.buf[end]) || CLOSE.has(this.buf[end]))) end++
      // 경계 부호가 버퍼 끝이면 다음 글자(추가 부호·닫는 괄호일 수 있다)를 기다린다.
      if (end >= this.buf.length) break
      const sentence = this.buf.slice(0, end).trim()
      if (bodyLen(sentence) < MIN_SENTENCE_CHARS) {
        from = end
        continue
      }
      out.push(sentence)
      this.buf = this.buf.slice(end)
      from = 0
    }
    return out
  }

  /** 문자열이 끝났다 — 남은 글자를 마지막 문장으로(비었으면 null). */
  end(): string | null {
    const rest = this.buf.trim()
    this.buf = ''
    return rest ? rest : null
  }
}

function capLength(s: string, max: number): string[] {
  if (cpLen(s) <= max) return [s]
  const out: string[] = []
  let rest = s
  while (cpLen(rest) > max) {
    const cps = [...rest]
    const head = cps.slice(0, max).join('')
    const comma = head.lastIndexOf('、')
    const cut = comma >= Math.floor(max / 3) ? comma + 1 : head.length
    out.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) out.push(rest)
  return out.filter(Boolean)
}

/** 완성된 텍스트 → 합성 청크들(각 ≤100자). */
export function splitForSpeech(text: string, max = SPEECH_CHUNK_MAX_CHARS): string[] {
  const s = new StreamingSentenceSplitter()
  const parts = [...s.push(text)]
  const last = s.end()
  if (last) parts.push(last)
  return parts.flatMap((p) => capLength(p, max))
}
