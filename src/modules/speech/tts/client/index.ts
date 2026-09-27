/**
 * speech TTS 클라이언트 안전 진입점(screens §9-3 D · module-dependency L4 클라 `TtsPlaybackQueue`). 컴포넌트는 TTS 쪽으로 이 경로만 import 한다.
 * 서버 코드(Prisma·engine·infra 서버측)를 끌어오지 않는다 — eslint `src/modules/speech/tts/client/**` 규칙 + `speech/__tests__/ttsClientBoundary.test.ts`.
 * `splitSentences` 는 순수 함수라 서버 Sentence Detector 를 그대로 다시 내보낸다(다시 듣기 #23 을 서버와 같은 경계로 나누게).
 */
export {
  AUDIO_URL_PREFIX,
  createTtsPlaybackQueue,
  FETCH_CONCURRENCY,
  IDLE_SNAPSHOT,
  RETAIN_BYTES,
  RETAIN_MESSAGES,
} from './playbackQueue'
export type {
  ChunkInput,
  InterruptReason,
  PlaybackDeps,
  PlaybackHandle,
  PlaybackPhase,
  PlaybackSignal,
  PlaybackSnapshot,
  PlaybackSource,
  TtsPlaybackQueue,
  TurnTimings,
} from './playbackQueue'
export { splitSentences } from '../sentences'
export type { SentencePiece } from '../sentences'
