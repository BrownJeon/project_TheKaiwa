/**
 * #19 `GET /api/v1/speech/config` — 클라이언트 실시간 인식 경로 선택에 필요한 **시크릿·주소 없는** 설정.
 *
 * 정본과 다르게 한 것(task-003e 기록):
 *  - `onDevice.connectionKey` 는 connection **id(불투명)** 를 싣는다. 정본 예시의 key(엔진 이름이 들어간 문자열)는
 *    "사용자 응답 엔진명 0"(완료 기준 6)과 충돌한다. #21 은 id·key 둘 다 받아 서버가 key 로 스냅샷한다.
 *  - 웹(`platform=web`)에는 onDevice 세부(모델·manifest)를 싣지 않는다 — 웹은 온디바이스 엔진이 없다.
 *  - `tts.fallbackChain`(connection key 목록)은 싣지 않는다(엔진명).
 *  - (task-003f) `onDevice.model` 은 **불투명 id**(`ondevice-ja-v1`)·배포 manifest 의 `version`·`totalBytes`·불투명 `manifestUrl` 만.
 *    디스크 디렉터리·모델 이름(엔진명)은 manifest 본문에만 있다. `version` 은 connection `runtime.modelVersion`(gateway 모델 이름)이
 *    아니라 **지금 서빙 중인 manifest 의 version** — 플러그인이 설치본과 비교해 갱신 여부를 정하는 값이라 서빙본과 같아야 한다.
 *    배포본이 없으면 `version`·`totalBytes` 가 null(앱은 내려받기를 막고 서버 인식으로 쓴다).
 * `configVersion` 은 응답 본문 해시 — 사용자 모드·플랫폼·서버 설정 중 무엇이 바뀌어도 달라진다(ETag 로 그대로 쓴다).
 */
import { createHash } from 'node:crypto'
import { stt } from '@/modules/engine'
import { SPEECH_PROFILES, TTS_SEGMENT_MAX_CHARS } from '../tts'
import { gatewayTarget } from './gateway'
import { onDeviceModelSummary } from './modelPackage'
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
        /** 경로 선택만 뜻한다(방식·플랫폼 해석이 휴대폰인가). 모델 블록은 enabled 와 무관하게 싣는다(task-003f Leader ②). */
        enabled: boolean
        /** 서버에 휴대폰 인식 파일 배포본이 있는가(manifest 검증 통과). */
        available: boolean
        connectionKey: string
        runtime: { numThreads: number | null; decodingMethod: string | null; provider: 'cpu'; vad: { silenceMs: number | null; threshold: number | null }; partial: boolean }
        model: { id: string; version: string | null; manifestUrl: string; totalBytes: number | null; wifiRecommended: true }
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

  // 앱 + ONDEVICE 연결이 있으면 방식과 무관하게 모델 블록을 싣는다 — 정확하게 방식에서도 설정 카드가 크기·받기·지우기를 보여야 한다.
  // 웹은 온디바이스 엔진이 없어 `{enabled:false}` 만.
  let onDevice: SpeechConfig['onDevice'] = { enabled: false }
  if (input.platform === 'app' && od) {
    const [r, model] = await Promise.all([stt.publicRuntime(od), onDeviceModelSummary()])
    onDevice = {
      enabled: resolved.realtime === 'ONDEVICE',
      available: model.version !== null && model.totalBytes !== null,
      connectionKey: od.id,
      runtime: { numThreads: r.numThreads, decodingMethod: r.decodingMethod, provider: 'cpu', vad: { silenceMs: r.vadSilenceMs, threshold: r.vadThreshold }, partial: r.partial },
      model: { id: model.id, version: model.version, manifestUrl: model.manifestUrl, totalBytes: model.totalBytes, wifiRecommended: true },
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
