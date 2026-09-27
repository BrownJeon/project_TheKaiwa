/**
 * #19 `GET /api/v1/speech/config` — 클라이언트 실시간 인식 경로 선택에 필요한 **시크릿·주소 없는** 설정.
 *
 * 정본과 다르게 한 것(task-003e 기록):
 *  - `onDevice.connectionKey` 는 connection **id(불투명)** 를 싣는다. 정본 예시의 key(엔진 이름이 들어간 문자열)는
 *    "사용자 응답 엔진명 0"(완료 기준 6)과 충돌한다. #21 은 id·key 둘 다 받아 서버가 key 로 스냅샷한다.
 *  - 웹(`platform=web`)에는 onDevice 세부(모델·manifest)를 싣지 않는다 — 웹은 온디바이스 엔진이 없다.
 *  - `tts.fallbackChain`(connection key 목록)은 싣지 않는다(엔진명).
 * `configVersion` 은 응답 본문 해시 — 사용자 모드·플랫폼·서버 설정 중 무엇이 바뀌어도 달라진다(ETag 로 그대로 쓴다).
 */
import { createHash } from 'node:crypto'
import { stt } from '@/modules/engine'
import { SPEECH_PROFILES, TTS_SEGMENT_MAX_CHARS } from '../tts'
import { gatewayTarget } from './gateway'
import { resolveRecognitionMode, type RecognitionMode } from './modeResolver'
import { STT_FRAME_MS, STT_SAMPLE_RATE } from './ticket'
import { UTTERANCE_MAX_BYTES, UTTERANCE_MAX_DURATION_MS } from '../utterances/limits'

export const ONDEVICE_FAILURE_THRESHOLD = 2

export interface SpeechConfig {
  configVersion: string
  recognitionMode: RecognitionMode
  onDevice:
    | { enabled: false }
    | {
        enabled: true
        connectionKey: string
        runtime: { numThreads: number | null; decodingMethod: string | null; provider: 'cpu'; vad: { silenceMs: number | null; threshold: number | null }; partial: boolean }
        model: { version: string | null; manifestUrl: string | null; totalBytes: number | null; wifiRecommended: true }
      }
  gateway: { enabled: boolean; wsPath: string; frameMs: number; sampleRate: number; partial: boolean }
  fallback: { onDeviceFailureThreshold: number; toGateway: boolean; toTextOnly: true }
  upload: { maxBytes: number; maxDurationMs: number; format: 'wav/pcm16/16k/mono' }
  tts: { sentenceMaxChars: number; speechProfiles: string[] }
}

export async function getSpeechConfig(input: { recognitionMode: RecognitionMode; platform: 'web' | 'app' }): Promise<SpeechConfig> {
  const resolved = resolveRecognitionMode(input.recognitionMode, input.platform)
  const targets = await stt.realtimeTargets()
  const gw = await gatewayTarget()
  const od = targets.find((t) => t.connectionType === 'ONDEVICE') ?? null

  const gwRuntime = gw ? await stt.publicRuntime(gw) : null
  // "구성돼 있는가" 만 본다(DISABLED 는 targets 에서 이미 빠짐). 지금 쓸 수 있는지는 티켓(#20)이 재확인 후 판정한다 —
  // 설정은 앱 기동 시 한 번 받아 ETag 로 오래 쓰므로 일시 상태를 여기 넣으면 복구 뒤에도 막힌 채 남는다.
  const gatewayEnabled = !!gw
  // OFFLINE 은 폴백하지 않는다(speech-platform/12 §3.5). ACCURATE 는 서버 경로 강제(modeResolver).
  const toGateway = input.recognitionMode !== 'OFFLINE' && gatewayEnabled

  let onDevice: SpeechConfig['onDevice'] = { enabled: false }
  if (input.platform === 'app' && od && resolved.realtime === 'ONDEVICE') {
    const r = await stt.publicRuntime(od)
    onDevice = {
      enabled: true,
      connectionKey: od.id,
      runtime: { numThreads: r.numThreads, decodingMethod: r.decodingMethod, provider: 'cpu', vad: { silenceMs: r.vadSilenceMs, threshold: r.vadThreshold }, partial: r.partial },
      model: { version: r.modelVersion, manifestUrl: r.manifestUrl, totalBytes: r.modelBytes, wifiRecommended: true },
    }
  }

  const body: Omit<SpeechConfig, 'configVersion'> = {
    recognitionMode: input.recognitionMode,
    onDevice,
    gateway: {
      enabled: gatewayEnabled && !(input.platform === 'app' && input.recognitionMode === 'OFFLINE'),
      wsPath: gwRuntime?.wsPath ?? '/ws/speech',
      frameMs: STT_FRAME_MS,
      sampleRate: STT_SAMPLE_RATE,
      partial: gwRuntime?.partial ?? true,
    },
    fallback: { onDeviceFailureThreshold: ONDEVICE_FAILURE_THRESHOLD, toGateway, toTextOnly: true },
    upload: { maxBytes: UTTERANCE_MAX_BYTES, maxDurationMs: UTTERANCE_MAX_DURATION_MS, format: 'wav/pcm16/16k/mono' },
    tts: { sentenceMaxChars: TTS_SEGMENT_MAX_CHARS, speechProfiles: [...SPEECH_PROFILES] },
  }
  const configVersion = `cv_${createHash('sha1').update(JSON.stringify(body)).digest('hex').slice(0, 12)}`
  return { configVersion, ...body }
}
