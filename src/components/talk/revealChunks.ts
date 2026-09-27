/**
 * 선생님 말풍선 점진 표시(screens §9-2 E) — 순수. SSE `audio` 로 받은 문장을 chunkIndex 로 정렬해 **0 부터 빈틈없이 이어진 앞부분만**
 * 드러낸다(늦게 온 앞 청크를 기다린다). FAILED 청크도 글자는 드러낸다(소리만 없다).
 */

export interface AudioChunkView {
  chunkIndex: number
  text: string
  status: 'OK' | 'FAILED'
  last: boolean
}

/** 같은 index 는 먼저 온 것만, 0 부터 이어진 것까지. */
export function visiblePrefix(chunks: readonly AudioChunkView[]): AudioChunkView[] {
  const byIndex = new Map<number, AudioChunkView>()
  for (const c of chunks) if (Number.isInteger(c.chunkIndex) && c.chunkIndex >= 0 && !byIndex.has(c.chunkIndex)) byIndex.set(c.chunkIndex, c)
  const out: AudioChunkView[] = []
  for (let i = 0; byIndex.has(i); i++) out.push(byIndex.get(i) as AudioChunkView)
  return out
}

/** 드러난 앞부분 뒤에 아직 올 문장이 있는가(말풍선 끝 "…"). 마지막 청크가 드러났으면 false. */
export function hasMoreAfter(visible: readonly AudioChunkView[]): boolean {
  if (visible.length === 0) return true
  return !visible[visible.length - 1].last
}

/**
 * 완료 말풍선의 문장 나눔 — 조각을 이은 것이 본문과 **정확히 같을 때만** 조각을 돌려준다(다시 듣기 강조용).
 * 다르면 null → 본문 통째로(서버 저장값 `replyJa` 가 언제나 이긴다).
 */
export function sentenceSpans(content: string, texts: readonly string[] | null | undefined): string[] | null {
  if (!texts || texts.length === 0) return null
  return texts.join('') === content ? [...texts] : null
}

/**
 * 받은 청크가 빠짐없이 다 있는가(완료 말풍선의 강조·다시 듣기를 청크 문장으로 할 수 있는가).
 * `ended`(턴 done — 더 올 청크가 없다)면 `last` 표시 없이도 0..max 가 이어져 있으면 완전하다
 * (조기 합성 문장은 총 개수를 모르는 채로 나가 `last` 가 끝내 붙지 않을 수 있다).
 */
export function completeChunkTexts(chunks: readonly AudioChunkView[], ended = false): string[] | null {
  const v = visiblePrefix(chunks)
  if (v.length === 0) return null
  if (v[v.length - 1].last) return v.map((c) => c.text)
  if (!ended) return null
  const distinct = new Set(chunks.filter((c) => Number.isInteger(c.chunkIndex) && c.chunkIndex >= 0).map((c) => c.chunkIndex))
  return distinct.size === v.length ? v.map((c) => c.text) : null
}
