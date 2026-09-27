/**
 * 경로 인식 증분 JSON 토크나이저(task-007 K2-2, Codex C1-3 ①) — LLM 이 스트리밍으로 내는 JSON 문서에서
 * **최상위 객체 기준 지정 경로의 문자열 값만** 디코드된 글자 단위로 흘려보낸다.
 *
 *  - 정규식이 아니라 문자 단위 상태기계다. 다른 문자열 값 안에 `"replyJa":"…"` 같은 흉내가 있어도 그것은 문자열 내용이라
 *    경로가 되지 않는다. 경로는 객체 키의 연쇄(배열은 경로를 끊는다 — 배열 안의 값은 어떤 감시 경로와도 맞지 않는다).
 *  - 첫 `{` 앞의 글자(코드펜스·잡담)는 건너뛴다. 최상위 객체가 닫히면 이후 입력은 무시한다.
 *  - 문법 오류를 만나면 `failed=true` 로 멈춘다(이후 콜백 없음). 최종 검증은 호출자가 완성본으로 따로 한다 — 이 리더는
 *    "앞부분을 미리 보는" 용도일 뿐 파서의 대체물이 아니다.
 *  - 같은 경로가 두 번 나오면(중복 키) 두 번 다 흘린다 — JSON.parse 는 마지막 값을 쓰므로 호출자는 완성본과 대조해야 한다.
 */

export interface JsonPathWatch {
  path: readonly string[]
  /** 문자열 값의 디코드된 조각(이스케이프 해석 후). */
  onChunk?: (text: string) => void
  /** 문자열 값이 닫혔을 때 전체 값. */
  onComplete?: (value: string) => void
}

export interface JsonPathStreamReader {
  push(text: string): void
  readonly failed: boolean
  readonly finished: boolean
}

type Frame =
  | { kind: 'object'; state: 'key' | 'colon' | 'value' | 'comma'; key: string | null }
  | { kind: 'array'; state: 'value' | 'comma' }

type Lexer =
  | { mode: 'idle' }
  | { mode: 'string'; role: 'key' | 'value'; buf: string; esc: null | { kind: 'char' } | { kind: 'unicode'; hex: string }; watch: JsonPathWatch | null }
  | { mode: 'literal'; buf: string }

const WS = new Set([' ', '\t', '\n', '\r'])
const ESCAPES: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }
const LITERAL_CHAR = /[0-9a-zA-Z+\-.]/
const LITERAL = /^(true|false|null|-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?)$/

export function createJsonPathStreamReader(watches: readonly JsonPathWatch[]): JsonPathStreamReader {
  const stack: Frame[] = []
  let started = false
  let finished = false
  let failed = false
  let lex: Lexer = { mode: 'idle' }
  let pending = ''

  const fail = () => {
    failed = true
  }

  /** 지금 값을 읽으려는 위치의 경로 — 모든 조상이 객체일 때만 의미가 있다(배열이 끼면 null). */
  const valuePath = (): string[] | null => {
    const out: string[] = []
    for (const f of stack) {
      if (f.kind !== 'object' || f.key === null) return null
      out.push(f.key)
    }
    return out
  }

  const watchFor = (path: string[] | null): JsonPathWatch | null => {
    if (!path) return null
    return watches.find((w) => w.path.length === path.length && w.path.every((p, i) => p === path[i])) ?? null
  }

  const flushPending = () => {
    if (lex.mode === 'string' && lex.watch?.onChunk && pending) lex.watch.onChunk(pending)
    pending = ''
  }

  /** 값 하나가 끝났다 — 부모 프레임을 다음 상태로. */
  const afterValue = () => {
    const top = stack.at(-1)
    if (!top) {
      finished = true
      return
    }
    top.state = 'comma'
  }

  const beginValue = (ch: string): boolean => {
    if (ch === '{') {
      stack.push({ kind: 'object', state: 'key', key: null })
      return true
    }
    if (ch === '[') {
      stack.push({ kind: 'array', state: 'value' })
      return true
    }
    if (ch === '"') {
      lex = { mode: 'string', role: 'value', buf: '', esc: null, watch: watchFor(valuePath()) }
      return true
    }
    if (LITERAL_CHAR.test(ch)) {
      lex = { mode: 'literal', buf: ch }
      return true
    }
    return false
  }

  const closeContainer = (ch: string): boolean => {
    const top = stack.at(-1)
    if (!top) return false
    if (ch === '}' && top.kind === 'object' && (top.state === 'comma' || (top.state === 'key' && top.key === null))) {
      stack.pop()
      afterValue()
      return true
    }
    if (ch === ']' && top.kind === 'array' && (top.state === 'comma' || top.state === 'value')) {
      stack.pop()
      afterValue()
      return true
    }
    return false
  }

  const endLiteral = (): boolean => {
    if (lex.mode !== 'literal') return true
    const ok = LITERAL.test(lex.buf)
    lex = { mode: 'idle' }
    if (!ok) return false
    afterValue()
    return true
  }

  const stringChar = (ch: string) => {
    if (lex.mode !== 'string') return
    if (lex.esc) {
      if (lex.esc.kind === 'char') {
        const v = ESCAPES[ch]
        if (ch === 'u') {
          lex.esc = { kind: 'unicode', hex: '' }
          return
        }
        if (v === undefined) return fail()
        lex.esc = null
        lex.buf += v
        pending += v
        return
      }
      if (!/[0-9a-fA-F]/.test(ch)) return fail()
      lex.esc.hex += ch
      if (lex.esc.hex.length === 4) {
        const v = String.fromCharCode(parseInt(lex.esc.hex, 16))
        lex.esc = null
        lex.buf += v
        pending += v
      }
      return
    }
    if (ch === '\\') {
      lex.esc = { kind: 'char' }
      return
    }
    if (ch === '"') {
      flushPending()
      const s = lex
      lex = { mode: 'idle' }
      if (s.role === 'key') {
        const top = stack.at(-1)
        if (!top || top.kind !== 'object') return fail()
        top.key = s.buf
        top.state = 'colon'
        return
      }
      s.watch?.onComplete?.(s.buf)
      afterValue()
      return
    }
    // JSON 문자열에는 원시 제어문자가 올 수 없다.
    if (ch < ' ') return fail()
    lex.buf += ch
    pending += ch
  }

  const structural = (ch: string) => {
    if (WS.has(ch)) return
    const top = stack.at(-1)
    if (!top) return fail()
    if (top.kind === 'object') {
      switch (top.state) {
        case 'key':
          if (ch === '"') {
            lex = { mode: 'string', role: 'key', buf: '', esc: null, watch: null }
            return
          }
          if (!closeContainer(ch)) fail()
          return
        case 'colon':
          if (ch === ':') top.state = 'value'
          else fail()
          return
        case 'value':
          if (!beginValue(ch)) fail()
          return
        case 'comma':
          if (ch === ',') {
            top.state = 'key'
            top.key = null
            return
          }
          if (!closeContainer(ch)) fail()
          return
      }
    }
    if (top.state === 'value') {
      if (ch === ']' ? !closeContainer(ch) : !beginValue(ch)) fail()
      return
    }
    if (ch === ',') top.state = 'value'
    else if (!closeContainer(ch)) fail()
  }

  return {
    push(text: string) {
      for (const ch of text) {
        if (failed || finished) break
        if (!started) {
          if (ch !== '{') continue
          started = true
          stack.push({ kind: 'object', state: 'key', key: null })
          continue
        }
        if (lex.mode === 'string') {
          stringChar(ch)
          continue
        }
        if (lex.mode === 'literal') {
          if (LITERAL_CHAR.test(ch)) {
            lex.buf += ch
            continue
          }
          if (!endLiteral()) {
            fail()
            break
          }
        }
        structural(ch)
      }
      // 조각이 끝날 때마다 모인 글자를 내보낸다(문자열 한가운데에서 끊겨도 앞부분은 바로 쓸 수 있게).
      if (!failed) flushPending()
      else pending = ''
    },
    get failed() {
      return failed
    },
    get finished() {
      return finished
    },
  }
}
