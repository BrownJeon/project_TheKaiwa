/**
 * SSE 응답(api-contract §0-9) — `event: <name>\ndata: <json>\n\n`, 15초마다 `: ping`, 버퍼링 끄는 헤더.
 *
 * **끊김은 오류가 아니다**: 클라이언트가 스트림을 닫아도 `run` 은 끝까지 돈다(쓰기만 조용히 무시된다). 작업의 수명은
 * 스트림이 아니라 호출자가 쥔 promise 에 있다 — 라우트는 저장까지 끝나야 하는 작업을 이 스트림에 묶지 않는다.
 * `Cache-Control: no-transform` 은 Next 의 응답 압축(compression)이 스트림을 모아 보내지 않게 하는 조건이기도 하다.
 */

export interface SseChannel {
  send(event: string, data: unknown): void
  readonly closed: boolean
}

export const SSE_PING_MS = 15_000

export function formatSseEvent(event: string, data: unknown): string {
  // JSON.stringify 결과에는 원시 줄바꿈이 없다(문자열 안의 \n 은 이스케이프된다) — data 줄 하나로 충분하다.
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export function sseResponse(run: (ch: SseChannel) => Promise<void>, opts: { pingMs?: number } = {}): Response {
  const encoder = new TextEncoder()
  let closed = false
  let timer: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          closed = true
        }
      }
      const finish = () => {
        if (timer) clearInterval(timer)
        if (closed) return
        closed = true
        try {
          controller.close()
        } catch {
          // 이미 닫힌 스트림
        }
      }
      const ch: SseChannel = {
        send: (event, data) => write(formatSseEvent(event, data)),
        get closed() {
          return closed
        },
      }
      timer = setInterval(() => write(': ping\n\n'), opts.pingMs ?? SSE_PING_MS)
      run(ch)
        .catch((e) => console.error('[sse] 스트림 작업 예외:', e instanceof Error ? `${e.name}: ${e.message}` : String(e)))
        .finally(finish)
    },
    cancel() {
      closed = true
      if (timer) clearInterval(timer)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  })
}
