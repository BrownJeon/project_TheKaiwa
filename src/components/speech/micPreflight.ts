/**
 * 마이크 테스트 카드 마운트 시 사전 점검(docs/screens.md §8-3 C) — **권한을 묻지 않는다**(getUserMedia 호출 없음).
 * Permissions API 는 조회만 한다(지원하지 않는 브라우저는 'unknown').
 */
import { browserEnvironmentProblem, type SttClientConfig, type SttKind } from '@/modules/speech/stt/client'
import type { PermState, SttUiError } from './sttUiState'

export function micPreflight(kind: SttKind, config: SttClientConfig | null): SttUiError | null {
  if (kind === 'GATEWAY') {
    const p = browserEnvironmentProblem()
    if (p) return { code: p }
    if (config?.gateway && config.gateway.enabled === false) return { code: 'SERVER_UNAVAILABLE', mountCheck: true }
  }
  return null
}

type PermissionsLike = { query(d: { name: PermissionName }): Promise<PermissionStatus> }

function permissions(): PermissionsLike | null {
  if (typeof navigator === 'undefined') return null
  const p = (navigator as Navigator & { permissions?: PermissionsLike }).permissions
  return p && typeof p.query === 'function' ? p : null
}

function toPerm(s: string | undefined): PermState {
  return s === 'granted' || s === 'denied' || s === 'prompt' ? s : 'unknown'
}

export async function queryMicPermission(): Promise<PermState> {
  const p = permissions()
  if (!p) return 'unknown'
  try {
    return toPerm((await p.query({ name: 'microphone' as PermissionName })).state)
  } catch {
    return 'unknown'
  }
}

/** 권한 상태 변화를 구독한다(주소창에서 허용으로 바꾸면 alert 를 지우기 위해). 해제 함수를 돌려준다. */
export function watchMicPermission(cb: (s: PermState) => void): () => void {
  const p = permissions()
  if (!p) return () => undefined
  let status: PermissionStatus | null = null
  let alive = true
  const onChange = () => status && cb(toPerm(status.state))
  p.query({ name: 'microphone' as PermissionName })
    .then((st) => {
      if (!alive) return
      status = st
      cb(toPerm(st.state))
      st.addEventListener('change', onChange)
    })
    .catch(() => undefined)
  return () => {
    alive = false
    status?.removeEventListener('change', onChange)
  }
}
