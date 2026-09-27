/**
 * #24 청크 받기 재시도(순수 — 받기 함수를 주입받는다).
 *
 * 방금 합성된(캐시 MISS) 청크는 `audio` 이벤트 직후 GET 이 404 일 수 있다(2026-09-28 실측: 이벤트 뒤 0.6~1.4초 동안 404 —
 * 캐시 행 커밋이 이벤트보다 늦음. 서버 측 근본 수정은 Leader·A 에 보고). 서명 URL 은 방금 받은 것이라 만료가 아니므로
 * **404 만** 짧게 다시 받는다(대기 합 4초 안). 그 밖 오류·취소는 그대로 던진다(큐가 그 청크를 건너뛴다).
 */
export const CHUNK_RETRY_MS = [250, 500, 750, 1000, 1500] as const

export type AudioGetter = (url: string, opts: { signal: AbortSignal }) => Promise<ArrayBuffer>

function statusOf(e: unknown): number | null {
  const s = typeof e === 'object' && e !== null ? (e as { status?: unknown }).status : undefined
  return typeof s === 'number' ? s : null
}

export function sleepAbortable(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('aborted', 'AbortError'))
    const onAbort = () => {
      clearTimeout(t)
      reject(new DOMException('aborted', 'AbortError'))
    }
    const t = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export async function fetchChunkAudio(
  url: string,
  signal: AbortSignal,
  get: AudioGetter,
  sleep: (ms: number, signal: AbortSignal) => Promise<void> = sleepAbortable,
): Promise<ArrayBuffer> {
  for (let i = 0; ; i++) {
    try {
      return await get(url, { signal })
    } catch (e) {
      if (statusOf(e) !== 404 || i >= CHUNK_RETRY_MS.length || signal.aborted) throw e
      await sleep(CHUNK_RETRY_MS[i], signal)
    }
  }
}
