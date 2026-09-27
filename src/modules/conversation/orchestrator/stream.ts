/**
 * 턴 이벤트 버퍼 — 턴의 수명(저장까지)을 SSE 연결의 수명과 떼어 놓는다. 처리 쪽은 연결이 있든 없든 `emit` 하고,
 * 구독자는 붙는 순간 지난 이벤트를 다시 받은 뒤 이어서 받는다. 연결이 끊겨 구독을 놓아도 처리는 계속된다(§0-9).
 */
export interface TurnEvent {
  event: 'accepted' | 'status' | 'done' | 'error'
  data: unknown
}

export type TurnListener = (e: TurnEvent) => void

export class TurnStream {
  private readonly events: TurnEvent[] = []
  private readonly listeners = new Set<TurnListener>()
  private finished = false
  private resolveDone!: () => void
  readonly done: Promise<void> = new Promise((r) => (this.resolveDone = r))

  emit(e: TurnEvent): void {
    if (this.finished) return
    this.events.push(e)
    for (const l of this.listeners) {
      try {
        l(e)
      } catch {
        // 구독자(스트림 쓰기) 오류는 처리 흐름에 영향을 주지 않는다
      }
    }
  }

  finish(): void {
    if (this.finished) return
    this.finished = true
    this.listeners.clear()
    this.resolveDone()
  }

  /** 지난 이벤트를 먼저 다시 보내고 이어서 받는다. 반환 promise 는 턴이 끝나면(done/error 뒤) 풀린다. */
  subscribe(listener: TurnListener): Promise<void> {
    for (const e of this.events) {
      try {
        listener(e)
      } catch {
        // 위와 같음
      }
    }
    if (this.finished) return Promise.resolve()
    this.listeners.add(listener)
    return this.done
  }
}
