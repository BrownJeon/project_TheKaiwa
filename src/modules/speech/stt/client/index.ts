/**
 * speech 클라이언트 안전 진입점(Leader M4 — 컴포넌트는 이 경로만 import). 서버 코드(Prisma·engine·infra 서버측)를 끌어오지 않는다
 * (eslint `src/modules/speech/stt/client/**` 규칙 + `speech/__tests__/sttClientBoundary.test.ts`).
 *
 * `createRealtimeSttClient(config, deps)` = 경로 라우터(task-003f): 누를 때마다 휴대폰(앱 + 파일 설치) / 서버(그 밖·오류 누적)를 고른다.
 * 웹·플러그인 없는 셸은 언제나 서버 경로다. 휴대폰 인식 파일 관리(확인·받기·지우기)는 `onDeviceModelStore()`.
 */
import { SttRouter, type RoutedSttClient, type RouterDeps } from './router'
import type { SttClientConfig } from './types'

export * from './types'
export { WebSocketSttClient, browserEnvironmentProblem, PRE_READY_BUFFER_FRAMES, IDLE_CLOSE_MS } from './WebSocketSttClient'
export type { WebSocketSttDeps } from './WebSocketSttClient'
export { OnDeviceSttClient, isCountableFailure, sessionErrorCode, lastOnDeviceTimings, UPLOAD_TIMEOUT_MS, PERMISSION_ONLY } from './OnDeviceSttClient'
export type { OnDeviceSttDeps, OnDeviceUpload, OnDeviceFailure } from './OnDeviceSttClient'
export { SttRouter, decideRoute, resetOnDeviceRunStateForTest, isOnDeviceFailedOver, DEFAULT_FAILURE_THRESHOLD } from './router'
export type { RoutedSttClient, RouterDeps } from './router'
export { OnDeviceModelStore, onDeviceModelStore, setOnDeviceModelStoreForTest, estimateEtaSec, downloadErrorCode } from './onDeviceModel'
export type { ModelSnapshot, ModelPhase, ModelTransfer, ModelErrorCode } from './onDeviceModel'
export { parseServerMessage, mapServerError, mapCloseCode, mapTicketFailure, mapMediaError, resolveWsUrl, buildStartMessage, FRAME_BYTES } from './protocol'
export { Downsampler, FrameChunker, LevelMeter, rmsDb, SILENCE_DB } from './pcm'

export function createRealtimeSttClient(config: SttClientConfig | null, deps: RouterDeps): RoutedSttClient {
  const r = new SttRouter(deps)
  if (config) r.configure(config)
  return r
}
