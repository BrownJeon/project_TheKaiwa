/** 표시등 점·라벨 클래스(screens §7-2 B 표) — 토큰만(하드코딩 색 0). 확인 중은 속 빈 원, 전환 중은 깜빡임으로 모양도 다르다. */
import type { TtsUiState } from './ttsStatusCopy'

const DOT_BASE = 'h-2.5 w-2.5 flex-none rounded-full'

export const DOT_CLASS: Record<TtsUiState, string> = {
  ONLINE: `${DOT_BASE} bg-good`,
  TEXT_ONLY: `${DOT_BASE} bg-bad`,
  ON_DEVICE: `${DOT_BASE} bg-bad`,
  SWITCHING: `${DOT_BASE} bg-warn motion-safe:animate-pulse`,
  CHECKING: `${DOT_BASE} border-2 border-ink3`,
}

export const LABEL_CLASS: Record<TtsUiState, string> = {
  ONLINE: 'text-ink2',
  TEXT_ONLY: 'text-bad',
  ON_DEVICE: 'text-bad',
  SWITCHING: 'text-ink2',
  CHECKING: 'text-ink2',
}
