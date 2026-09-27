/**
 * Style-Bert-VITS2 Engine Provider — 맥 M4 tts-service(자체 FastAPI 래퍼, :8200). 합성은 `styleBertHttp`.
 * 스키마 키는 실제 저장 모양(seed `style-bert-m4`: `runtime.defaultModel`)을 따른다. SBV2 파라미터명은 이 디렉토리 밖으로 나가지 않는다.
 *
 * Health = ① 주소 점검(설정 baseUrl 의 origin 이 서버 env `TTS_SERVICE_URL` 과 같아야 한다 — 다르면 호출하지 않고 MISCONFIGURED, Codex C2 Finding 1)
 *   → ② 공개 `GET /health`(무인증·시크릿 없음, liveness `{status, warmedUp}` — 옛 서비스의 전체 필드도 그대로 받는다)의 `status` 판정
 *   → ③ 앱 `TTS_SERVICE_SECRET` 설정 여부 → ④ `detail` 요청일 때만(관리자 콘솔) `GET /health/detail`(시크릿) 로 device·모델 수·메모리 보강.
 *   상태 표시등 확인(speech/tts/status)은 ④ 없이 공개 경로만 쓴다(Finding 3).
 *   OK → HEALTHY · DEGRADED(워밍업 전·CPU 폴백 — 합성은 된다) → DEGRADED · LOADING(기동 중 — 합성이 503) · FAILED(모델 0) → UNAVAILABLE
 *   · MISCONFIGURED(서비스 시크릿 없음) → MISCONFIGURED. 상태등 판정은 "새 문장을 합성할 수 있는가"(16 §12) 기준이다.
 * Functional Test = 기본 모델로 고정 문장 1회 합성(30초 상한) — 오디오는 저장하지 않고 크기·길이만 남긴다.
 */
import { hasServiceSecret, readServiceSecretFor } from '@/modules/infra'
import type { EngineProvider, HealthOutcome } from '../../registry/types'
import { isTtsEngineError } from '../../tts/errors'
import { healthUrl, probeHttpHealth, type HealthInterpreter } from '../common/httpHealth'
import { key, LOG_LEVEL_KEY, REPO_ADAPTERS, SCHEMA_GROUPS } from '../common/schema'
import { fetchHealthDetail, g2pHttp, maxCharsOf, synthesizeHttp } from './styleBertHttp'

const FUNCTIONAL_TEXT = 'これはテストです。'
const FUNCTIONAL_TIMEOUT_MS = 30_000

const SERVICE_STATUS: Record<string, { status: HealthOutcome['status']; message?: string }> = {
  OK: { status: 'HEALTHY' },
  DEGRADED: { status: 'DEGRADED', message: '워밍업 전이거나 기본 모델·장치가 기대와 다릅니다' },
  LOADING: { status: 'UNAVAILABLE', message: '모델을 불러오는 중입니다(기동 중)' },
  FAILED: { status: 'UNAVAILABLE', message: '불러온 음성 모델이 없습니다' },
  MISCONFIGURED: { status: 'MISCONFIGURED', message: '서비스 쪽 내부 인증 설정이 비어 있습니다' },
}

const interpret: HealthInterpreter = (json) => {
  const s = typeof json.status === 'string' ? SERVICE_STATUS[json.status] : undefined
  const models = typeof json.modelsLoaded === 'number' && Number.isFinite(json.modelsLoaded) ? Math.trunc(json.modelsLoaded) : undefined
  const detail = { ...(models !== undefined ? { models } : {}), ...(s?.message ? { errorCode: `SERVICE_${String(json.status)}`, message: s.message } : {}) }
  if (!s) return json.ok === false ? { ok: false, status: 'DEGRADED', detail } : { detail }
  return { ok: s.status === 'HEALTHY' || s.status === 'DEGRADED', status: s.status, detail }
}

function durationFromWav(buf: Buffer): number | null {
  if (buf.length < 44) return null
  const byteRate = buf.readUInt32LE(28)
  let off = 12
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    if (id === 'data') return byteRate > 0 ? Math.round((Math.min(size, buf.length - off - 8) * 1000) / byteRate) : null
    off += 8 + size + (size % 2)
  }
  return null
}

export const styleBertVits2Provider: EngineProvider = {
  descriptor: {
    id: 'style-bert-vits2',
    displayName: 'Style-Bert-VITS2',
    type: 'TTS',
    roles: ['TTS'],
    connectionTypes: ['HTTP'],
    // SUPPORTS_USER_DICT 없음 — 래퍼가 사용자 사전을 받지 않아 발음 사전은 플랫폼 치환(styleBertHttp)으로 강등한다.
    capabilities: ['MULTI_VOICE', 'STYLE', 'SPEED', 'PITCH', 'INTONATION', 'MODEL_REFRESH', 'VOICE_IMPORT', 'SUPPORTS_STYLE', 'SUPPORTS_PITCH', 'SUPPORTS_INTONATION'],
    schemaVersion: 1,
    pluginVersion: '0.2.0',
    providerClass: 'StyleBertVits2Provider',
    sourcePath: `${REPO_ADAPTERS}/tts/styleBertVits2.provider.ts`,
  },
  configurationSchema: () => ({
    engineId: 'style-bert-vits2',
    schemaVersion: 1,
    groups: SCHEMA_GROUPS,
    keys: [
      key('connection.baseUrl', 'URL', 'http://192.168.219.100:8200', { strict: true, envAlias: ['TTS_SERVICE_URL', 'TTS_BASE_URL'], description: 'M4 tts-service 주소' }),
      key('connection.timeoutMs', 'INTEGER', 20000, { min: 5000, max: 60000, description: '요청 상한(문장 1건은 8s fail-fast)' }),
      key('connection.retry', 'INTEGER', 1, { min: 0, max: 3, description: '재시도 횟수' }),
      key('connection.credentialRef', 'SECRET_REF', 'file:tts-service-token', { strict: true, description: 'tts-service 인증 ref(값은 서버 파일). Phase 1 은 앱 env TTS_SERVICE_SECRET 을 쓴다' }),
      key('runtime.defaultModel', 'STRING', 'jvnv-F1-jp', { strict: true, description: '기본 음성 모델(AppSetting voice.default 의 VoiceProfile 과 일치해야 함)' }),
      key('runtime.language', 'ENUM', 'JP', { enum: ['JP'], editability: 'READ_ONLY', description: '언어 고정' }),
      key('runtime.maxChars', 'INTEGER', 100, { min: 50, max: 200, description: '문장 분할 상한(서비스 상한 100 을 넘지 않는다)' }),
      key('runtime.sdpRatio', 'NUMBER', 0.2, { min: 0, max: 1, description: 'SDP 비율' }),
      key('runtime.noise', 'NUMBER', 0.6, { min: 0, max: 2, description: '노이즈' }),
      key('runtime.noiseW', 'NUMBER', 0.8, { min: 0, max: 2, description: '노이즈 W' }),
      key('runtime.device', 'ENUM', 'mps', { enum: ['cpu', 'mps'], editability: 'RESTART_REQUIRED', restartTarget: 'tts-service', description: '합성 장치', impact: 'M4 MPS vs CPU 합성 시간' }),
      LOG_LEVEL_KEY,
    ],
  }),
  async healthCheck(profile, opts) {
    const target = healthUrl(profile.values['connection.baseUrl'], '/synthesize')
    if (target) {
      const grant = readServiceSecretFor('TTS_SERVICE_SECRET', target)
      if (!grant.ok && grant.reason !== 'SECRET_MISSING') {
        const message = grant.reason === 'TARGET_UNSET' ? '서버의 TTS 주소 설정(env)이 비어 있어 내부 인증을 보낼 수 없습니다' : '허용되지 않은 TTS 주소입니다(서버 env 의 TTS 주소와 다름)'
        return { ok: false, status: 'MISCONFIGURED', latencyMs: null, detail: { errorCode: grant.reason, message } }
      }
    }
    const out = await probeHttpHealth(profile.values['connection.baseUrl'], { interpret })
    if (!out.ok) return out
    if (!hasServiceSecret('TTS_SERVICE_SECRET')) {
      return { ok: false, status: 'MISCONFIGURED', latencyMs: out.latencyMs, detail: { ...out.detail, errorCode: 'CREDENTIAL_MISSING', message: '앱 서버의 TTS 내부 시크릿이 설정돼 있지 않습니다' } }
    }
    if (opts?.detail === false) return out
    const extra = await fetchHealthDetail(profile)
    return extra ? { ...out, detail: { ...out.detail, ...extra } } : out
  },
  async functionalTest(profile) {
    const model = typeof profile.values['runtime.defaultModel'] === 'string' ? (profile.values['runtime.defaultModel'] as string) : ''
    const startedAt = Date.now()
    try {
      const r = await synthesizeHttp(
        profile,
        { model, speakerId: 0, modelVersion: '1.0.0' },
        { text: FUNCTIONAL_TEXT, style: 'Neutral', styleWeight: 1, speed: 1, pitch: 1, intonation: 1, lexiconHints: [], dictionaryVersion: 0, speechProfile: 'NATIVE' },
        { traceId: `ft_${startedAt.toString(36)}`, timeoutMs: FUNCTIONAL_TIMEOUT_MS },
      )
      const durationMs = r.metrics.audioMs ?? durationFromWav(r.audio)
      return { ok: true, status: 'HEALTHY', latencyMs: Date.now() - startedAt, detail: { model, audioBytes: r.audio.length, ...(durationMs !== null ? { durationMs } : {}) } }
    } catch (e) {
      const kind = isTtsEngineError(e) ? e.kind : 'ENGINE_ERROR'
      const code = isTtsEngineError(e) ? e.code : 'ENGINE_ERROR'
      const status: HealthOutcome['status'] = kind === 'MISCONFIGURED' ? 'MISCONFIGURED' : kind === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'DEGRADED'
      const message = kind === 'TIMEOUT' ? '30초 안에 합성하지 못했습니다' : kind === 'MISCONFIGURED' ? '연결 설정(주소·내부 시크릿)이 맞지 않습니다' : kind === 'UNAVAILABLE' ? '합성 서비스에 연결하지 못했습니다' : '고정 문장 합성에 실패했습니다'
      return { ok: false, status, latencyMs: Date.now() - startedAt, detail: { errorCode: code, message, model } }
    }
  },
  tts: {
    maxChars: maxCharsOf,
    synthesize: synthesizeHttp,
    g2p: g2pHttp,
  },
  modelSummary: (values) => (typeof values['runtime.defaultModel'] === 'string' ? (values['runtime.defaultModel'] as string) : null),
}
