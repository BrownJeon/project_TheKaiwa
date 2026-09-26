/**
 * Speech Mode Resolver(design-spec §9-B, api-contract #16 `resolved`) — 사용자 인식 모드를 실행 경로로 해석한다.
 * 엔진명 없이 경로 종류만 돌려준다.
 *   AUTO     = 라우터 판단(앱은 온디바이스 우선, 웹은 gateway)
 *   FAST     = 온디바이스 고정(웹은 gateway 로 강등)
 *   ACCURATE = gateway + 분석 STT 재확인(requiresReview 임계 0.9)
 *   OFFLINE  = 온디바이스만(앱 전용 — 웹 저장은 검증에서 거부)
 */
export type RecognitionMode = 'AUTO' | 'FAST' | 'ACCURATE' | 'OFFLINE'

export interface ResolvedRecognition {
  realtime: 'ONDEVICE' | 'GATEWAY'
  analysis: boolean
  reviewThreshold: 0.85 | 0.9
}

export function resolveRecognitionMode(mode: RecognitionMode, platform: 'web' | 'app'): ResolvedRecognition {
  switch (mode) {
    case 'ACCURATE':
      return { realtime: 'GATEWAY', analysis: true, reviewThreshold: 0.9 }
    case 'OFFLINE':
      return { realtime: 'ONDEVICE', analysis: false, reviewThreshold: 0.85 }
    case 'FAST':
      return { realtime: platform === 'app' ? 'ONDEVICE' : 'GATEWAY', analysis: false, reviewThreshold: 0.85 }
    case 'AUTO':
    default:
      return { realtime: platform === 'app' ? 'ONDEVICE' : 'GATEWAY', analysis: true, reviewThreshold: 0.85 }
  }
}

/** 요청 플랫폼 — 앱 WebView 는 `X-Client-Platform: app` 을 보낸다(없으면 web). */
export function platformFrom(headers: Headers): 'web' | 'app' {
  return headers.get('x-client-platform') === 'app' ? 'app' : 'web'
}
