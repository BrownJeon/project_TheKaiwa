/**
 * `text/event-stream` 파서(api-contract §0-9). 순수 모듈 — DOM·React 를 모른다(단위 테스트 대상).
 *
 * 청크 경계는 아무 데서나 잘린다: 줄 중간, `\r\n` 사이, **UTF-8 다바이트 문자 중간**(일본어·이모지).
 * 그래서 바이트 → 문자는 `TextDecoder` 스트림 모드가, 문자 → 줄은 아래 버퍼가 맡는다.
 */

export interface SseEvent {
  event: string
  data: string
}

export interface SseParser {
  push(chunk: string): void
  /** 스트림 끝. 마지막 빈 줄 없이 끝난 이벤트도 흘려보낸다(서버가 `done` 뒤 빈 줄을 못 쓰고 끊긴 경우를 살린다). */
  end(): void
}

export function createSseParser(onEvent: (e: SseEvent) => void): SseParser {
  let buffer = ''
  let eventName = ''
  let dataLines: string[] = []

  const dispatch = () => {
    if (dataLines.length > 0) onEvent({ event: eventName || 'message', data: dataLines.join('\n') })
    eventName = ''
    dataLines = []
  }

  const handleLine = (line: string) => {
    if (line === '') {
      dispatch()
      return
    }
    // `: ping` 같은 주석 줄(15초 keep-alive)은 버린다.
    if (line.startsWith(':')) return
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'event') eventName = value
    else if (field === 'data') dataLines.push(value)
  }

  return {
    push(chunk: string) {
      buffer += chunk
      for (;;) {
        const lf = buffer.indexOf('\n')
        const cr = buffer.indexOf('\r')
        if (lf === -1 && cr === -1) return
        const at = lf === -1 ? cr : cr === -1 ? lf : Math.min(lf, cr)
        if (buffer[at] === '\r') {
          // `\r\n` 이 청크 경계에서 갈렸을 수 있다 — 다음 청크를 보고 판단한다(빈 줄로 잘못 읽으면 이벤트가 일찍 끊긴다).
          if (at === buffer.length - 1) return
          handleLine(buffer.slice(0, at))
          buffer = buffer.slice(buffer[at + 1] === '\n' ? at + 2 : at + 1)
        } else {
          handleLine(buffer.slice(0, at))
          buffer = buffer.slice(at + 1)
        }
      }
    },
    end() {
      if (buffer.endsWith('\r')) buffer = buffer.slice(0, -1)
      if (buffer !== '') handleLine(buffer)
      buffer = ''
      dispatch()
    },
  }
}

/** 바이트 스트림을 끝까지 읽어 이벤트를 흘려보낸다. 읽기 예외(연결 끊김·취소)는 그대로 던진다. */
export async function readSse(stream: ReadableStream<Uint8Array>, onEvent: (e: SseEvent) => void): Promise<void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder('utf-8')
  const parser = createSseParser(onEvent)
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      parser.push(decoder.decode(value, { stream: true }))
    }
    parser.push(decoder.decode())
    parser.end()
  } finally {
    reader.releaseLock()
  }
}

/** 이벤트 `data` 의 JSON. 깨진 JSON 은 null(한 이벤트가 깨져도 턴 전체를 버리지 않는다). */
export function parseEventData<T>(e: SseEvent): T | null {
  try {
    return JSON.parse(e.data) as T
  } catch {
    return null
  }
}
