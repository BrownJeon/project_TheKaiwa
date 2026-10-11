/**
 * 붙여넣기 화면의 공유 도착·2,000자 자르기 규칙(screens §20-4 ④⑤⑥, task-052). 순수 함수 — 화면·브리지·저장소를 모른다.
 * 글자 수는 붙여넣기 화면(`pasteMeta`)과 같이 코드포인트로 센다(이모지 등 서로게이트 쌍 = 1자).
 */

export const PASTE_MAX = 2000

export function charCount(s: string): number {
  return Array.from(s).length
}

/** 공유 본문을 입력칸 값과 같은 모양으로 — 줄바꿈을 `\n` 로 맞추고 앞뒤 공백만 정리한다. */
export function normalizeShared(raw: string): string {
  return raw.replace(/\r\n?/g, '\n').trim()
}

/** 안내 띠. `n` = 띠가 말하는 「되돌릴 수 있는 쪽」 글의 글자 수. */
export type ShareBannerState = { kind: 'arrived' } | { kind: 'replaced'; n: number } | { kind: 'restored'; n: number }

export type ShareArrival =
  | { kind: 'empty' }
  | { kind: 'fill'; text: string; alt: string | null; banner: ShareBannerState }

/**
 * 공유 글이 도착했을 때 입력칸을 어떻게 바꿀지(D2-A). `prev` = 지금 입력칸 글.
 * 빈 공유(공백뿐 포함)는 아무것도 바꾸지 않는다(D5-A — 화면이 토스트만 띄운다).
 */
export function arriveShare(prev: string, raw: string): ShareArrival {
  const fill = normalizeShared(raw)
  if (fill === '') return { kind: 'empty' }
  if (prev !== '' && prev !== fill) return { kind: 'fill', text: fill, alt: prev, banner: { kind: 'replaced', n: charCount(prev) } }
  return { kind: 'fill', text: fill, alt: null, banner: { kind: 'arrived' } }
}

export interface ShareSwap {
  text: string
  alt: string
  banner: { kind: 'replaced' | 'restored'; n: number }
}

/** [쓰던 글로 되돌리기] ↔ [공유한 글 다시 넣기]. `n` = 지금 빠지는 쪽 글의 길이. */
export function swapShare(text: string, alt: string, banner: { kind: 'replaced' | 'restored' }): ShareSwap {
  return {
    text: alt,
    alt: text,
    banner: { kind: banner.kind === 'replaced' ? 'restored' : 'replaced', n: charCount(text) },
  }
}

const SENTENCE_END = new Set(['。', '！', '？', '!', '?', '\n'])

/**
 * `max` 자 안으로 문장이 끝나는 곳에서 자른다(D3-A). `max` 이하면 그대로.
 * 끝에서 `lookback` 자 안에 문장 끝이 없으면 `max` 에서 자른다. 자른 끝의 공백·줄바꿈은 지운다.
 */
export function trimToLimit(text: string, max = PASTE_MAX, lookback = 400): string {
  const a = Array.from(text)
  if (a.length <= max) return text
  let cut = max
  for (let i = max - 1; i >= Math.max(0, max - lookback); i--) {
    if (SENTENCE_END.has(a[i])) {
      cut = i + 1
      break
    }
  }
  return a.slice(0, cut).join('').replace(/\s+$/u, '')
}

/** 자르면 빠지는 글자 수(「자르기 전」 줄의 `{r}`). `max` 이하면 0. */
export function trimRemoved(text: string, max = PASTE_MAX): number {
  return charCount(text) - charCount(trimToLimit(text, max))
}
