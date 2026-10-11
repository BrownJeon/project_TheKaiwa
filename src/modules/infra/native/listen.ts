/** 플러그인 구독 결과 — Capacitor 버전에 따라 Promise 이거나 바로 핸들이다. (내부용 — index.ts 로 내보내지 않는다) */
export type ListenerHandle = Promise<{ remove: () => Promise<void> | void }> | { remove: () => Promise<void> | void }

/** 구독 결과(Promise·즉시 둘 다)를 해제 함수 하나로. 핸들이 오기 전에 해제하면 도착하자마자 지운다. */
export function listen(result: ListenerHandle | undefined): () => void {
  if (!result) return () => {}
  let disposed = false
  let remove: (() => void) | null = null
  void Promise.resolve(result)
    .then((h) => {
      if (disposed) void h?.remove()
      else remove = () => void h?.remove()
    })
    .catch(() => {})
  return () => {
    disposed = true
    remove?.()
  }
}
