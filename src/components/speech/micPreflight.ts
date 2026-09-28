/**
 * 마이크 테스트 카드·회화방 마운트 시 사전 점검(docs/screens.md §8-3 C · §11-3 D) — **권한을 묻지 않는다**(getUserMedia·requestPermissions 호출 없음).
 * 권한은 조회만 한다 — 앱(플러그인 있음)은 플러그인 `checkPermissions()`(모델 스토어 경유), 그 밖은 Permissions API(지원 안 하면 'unknown').
 * 휴대폰 경로는 인터넷 없이도 알아들으므로 OFFLINE·서버 점검은 서버 경로(`GATEWAY`)일 때만 한다.
 */
import { browserEnvironmentProblem, onDeviceModelStore, type SttClientConfig, type SttRoute } from '@/modules/speech/stt/client'
import { onAppResume } from '@/modules/infra/native'
import type { PermState, SttUiError } from './sttUiState'

export function micPreflight(route: SttRoute, config: SttClientConfig | null, opts: { modelInstalled: boolean } = { modelInstalled: false }): SttUiError | null {
  if (route.kind === 'GATEWAY') {
    const p = browserEnvironmentProblem()
    if (p) return { code: p }
    if (config?.gateway && config.gateway.enabled === false) return { code: 'SERVER_UNAVAILABLE', mountCheck: true }
    return null
  }
  // 오프라인 방식 + 파일 없음 — 서버로 바꾸지 않으므로 누를 수 없다(§11-2 C).
  if (route.reason === 'MODE_OFFLINE' && !opts.modelInstalled) return { code: 'MODEL_REQUIRED', mountCheck: true }
  return null
}

function fromNative(s: string | null): PermState {
  if (s === 'prompt-with-rationale') return 'rationale'
  return s === 'granted' || s === 'denied' || s === 'prompt' ? s : 'unknown'
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

/**
 * 권한 상태 변화를 구독한다(주소창·앱 설정에서 허용으로 바꾸면 alert 를 지우기 위해). 해제 함수를 돌려준다.
 * 앱(플러그인 있음): 처음 한 번 + 앱으로 돌아올 때마다(resume) 다시 읽는다 — WebView 에서는 Permissions API `onchange` 가 오지 않을 수 있다.
 * 돌아온 것만으로 녹음을 시작하지 않는다(상태만 갱신).
 */
export function watchMicPermission(cb: (s: PermState) => void): () => void {
  const store = onDeviceModelStore()
  if (store.getPlugin()) {
    let alive = true
    const read = () => void store.micPermission().then((s) => alive && cb(fromNative(s)))
    read()
    const off = onAppResume(read)
    return () => {
      alive = false
      off()
    }
  }
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
