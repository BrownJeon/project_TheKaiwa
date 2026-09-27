/**
 * 같은 캐시 키의 합성을 하나로 합친다(QA-014 결함 #1). 요청마다 결과의 **출처**를 정확히 돌려준다:
 *   CACHE  — 파일 캐시에서 읽음(엔진 호출 0)
 *   SHARED — 진행 중인(또는 저장 중인) 합성에 합류(엔진 호출 0 → 사용자에게는 캐시 적중과 같은 뜻, `X-Tts-Cache: HIT`)
 *   SYNTH  — 이 요청이 엔진을 불렀다(MISS)
 *
 * 순서가 틈을 막는다: 진행 중 항목은 **저장이 끝난 뒤에야** 지워지고(그 사이 도착한 요청은 합류), 지워질 때마다 `settled` 를 올린다.
 * `lookup` 이 캐시를 못 찾은 뒤 `produce` 전에 어떤 합성이 끝났다면(`settled` 변화) 캐시를 한 번 더 읽는다 —
 * "캐시에도 없고 진행 중 항목도 사라진" 순간에 도착한 요청이 다시 합성하지 않는다.
 * 합류한 요청의 실패는 원 요청이 이미 상태 판정(연속 실패)에 넣으므로 호출자가 다시 세지 않는다(source 로 구분).
 */

export type Lookup<C, S> = { source: 'CACHE'; value: C } | { source: 'SHARED'; promise: Promise<S> } | { source: 'MISS'; seq: number }
export type Produced<C, S> = { source: 'CACHE'; value: C } | { source: 'SHARED' | 'SYNTH'; promise: Promise<S> }

export interface SingleFlightDeps<C, S> {
  readCache(key: string): Promise<C | null>
  store(key: string, value: S): Promise<void>
  onStoreError?(e: unknown): void
}

export interface SingleFlight<C, S> {
  lookup(key: string): Promise<Lookup<C, S>>
  produce(key: string, seq: number, start: () => Promise<S>): Promise<Produced<C, S>>
  /** 테스트·진단용 — 진행 중 키 수. */
  size(): number
}

export function createSingleFlight<C, S>(deps: SingleFlightDeps<C, S>): SingleFlight<C, S> {
  const inflight = new Map<string, Promise<S>>()
  let settled = 0

  function begin(key: string, start: () => Promise<S>): Promise<S> {
    const p = start()
    inflight.set(key, p)
    p.then((v) => deps.store(key, v))
      .catch((e) => deps.onStoreError?.(e))
      .finally(() => {
        inflight.delete(key)
        settled++
      })
    return p
  }

  return {
    async lookup(key) {
      const running = inflight.get(key)
      if (running) return { source: 'SHARED', promise: running }
      const seq = settled
      const hit = await deps.readCache(key)
      if (hit) return { source: 'CACHE', value: hit }
      // 캐시를 읽는 사이에 시작된 합성이 있으면 합류한다.
      const late = inflight.get(key)
      if (late) return { source: 'SHARED', promise: late }
      return { source: 'MISS', seq }
    },
    async produce(key, seq, start) {
      const running = inflight.get(key)
      if (running) return { source: 'SHARED', promise: running }
      if (settled !== seq) {
        // lookup 뒤에 어떤 합성이 끝났다 — 이 키였다면 이미 저장돼 있다.
        const again = await deps.readCache(key)
        if (again) return { source: 'CACHE', value: again }
        const late = inflight.get(key)
        if (late) return { source: 'SHARED', promise: late }
      }
      return { source: 'SYNTH', promise: begin(key, start) }
    },
    size: () => inflight.size,
  }
}
