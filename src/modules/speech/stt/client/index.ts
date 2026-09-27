/**
 * speech 클라이언트 안전 진입점(Leader M4 — 컴포넌트는 이 경로만 import). 서버 코드(Prisma·engine·infra 서버측)를 끌어오지 않는다
 * (eslint `src/modules/speech/stt/client/**` 규칙 + `speech/__tests__/sttClientBoundary.test.ts`).
 *
 * `createRealtimeSttClient(config, deps)` — 웹은 언제나 서버 경로(`WebSocketSttClient`). 온디바이스 클라이언트(네이티브 플러그인)는
 * task-003f 에서 이 함수 안에 붙는다: `config.onDevice.enabled` + 플러그인·모델 준비 시 선택, 세션 중 오류 2회면 서버 경로로.
 */
import { WebSocketSttClient, type WebSocketSttDeps } from './WebSocketSttClient'
import type { RealtimeSttClient, SttClientConfig } from './types'

export * from './types'
export { WebSocketSttClient, browserEnvironmentProblem, PRE_READY_BUFFER_FRAMES, IDLE_CLOSE_MS } from './WebSocketSttClient'
export type { WebSocketSttDeps } from './WebSocketSttClient'
export { parseServerMessage, mapServerError, mapCloseCode, mapTicketFailure, mapMediaError, resolveWsUrl, buildStartMessage, FRAME_BYTES } from './protocol'
export { Downsampler, FrameChunker, LevelMeter, rmsDb, SILENCE_DB } from './pcm'

export function createRealtimeSttClient(_config: SttClientConfig | null, deps: WebSocketSttDeps): RealtimeSttClient {
  return new WebSocketSttClient(deps)
}
